import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NEST_APP_OPTIONS, configureApp } from '../../src/app-config';
import { tokenFromResponse } from '../auth-cookie';

/**
 * Public view-only board links.
 *
 * This is the first unauthenticated data path in the API, which changes the
 * cost of a projection mistake: a leak here reaches the open internet rather
 * than an already-authorised member. Hence the emphasis below on what the
 * payload must NOT contain.
 */
describe('Board public links (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const ownerEmail = `pl-owner-${stamp}@example.com`;
  const editorEmail = `pl-editor-${stamp}@example.com`;
  const viewerEmail = `pl-viewer-${stamp}@example.com`;
  const outsiderEmail = `pl-outsider-${stamp}@example.com`;
  const password = 'Password123!';

  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let boardId: string;
  let slug: string;

  const reg = async (email: string, name: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, name })
      .expect(201);
    return { token: tokenFromResponse(res), id: res.body.user.id as string };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleFixture.createNestApplication(NEST_APP_OPTIONS));
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await reg(ownerEmail, 'Owner Person');
    const editor = await reg(editorEmail, 'Editor Person');
    const viewer = await reg(viewerEmail, 'Viewer Person');
    const outsider = await reg(outsiderEmail, 'Outsider Person');
    ownerToken = owner.token;
    editorToken = editor.token;
    viewerToken = viewer.token;
    outsiderToken = outsider.token;

    const board = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Public Link Board' })
      .expect(201);
    boardId = board.body.id;

    for (const [userId, role] of [
      [editor.id, 'EDITOR'],
      [viewer.id, 'VIEWER'],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId, role })
        .expect(201);
    }

    // A task with an assignee, so the public payload has a person on it to leak.
    const columnId = board.body.columns[0].id;
    await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ columnId, title: 'Task with an assignee', assigneeId: owner.id })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.board.deleteMany({ where: { id: boardId } });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, editorEmail, viewerEmail, outsiderEmail] } },
    });
    await app.close();
  });

  describe('who may publish a board', () => {
    it('lets the OWNER create a link', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);
      expect(res.body.slug).toEqual(expect.any(String));
      expect(res.body.slug.length).toBeGreaterThanOrEqual(20);
      slug = res.body.slug;
    });

    // Publishing to the internet is a strictly larger power than inviting one
    // named user, and `share` is already OWNER-only.
    it('refuses an EDITOR', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(403);
    });

    it('refuses a VIEWER', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('refuses a non-member', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('refuses an EDITOR trying to revoke', async () => {
      await request(app.getHttpServer())
        .delete(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(403);
    });
  });

  describe('who may see the slug', () => {
    it('gives the OWNER the slug', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.slug).toBe(slug);
    });

    it('tells an EDITOR the board is public but withholds the slug', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);
      expect(res.body).toEqual({ isPublic: true });
      expect(res.body.slug).toBeUndefined();
    });

    it('shows every member the public badge on the board itself', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
      expect(res.body.isPublic).toBe(true);
    });

    it('refuses a non-member entirely', async () => {
      await request(app.getHttpServer())
        .get(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });
  });

  describe('the public view', () => {
    it('serves the board with no credentials at all', async () => {
      const res = await request(app.getHttpServer()).get(`/api/public/boards/${slug}`).expect(200);
      expect(res.body.title).toBe('Public Link Board');
      expect(res.body.columns.length).toBeGreaterThan(0);
    });

    /*
      The important one. The authenticated response carries members[].email and
      assignee.email; the public projection is a separate mapper precisely so
      neither can reach an anonymous visitor. Asserting on the whole serialised
      payload rather than on named fields means a future field that happens to
      carry an address fails here too.
    */
    it('never exposes an email address anywhere in the payload', async () => {
      const res = await request(app.getHttpServer()).get(`/api/public/boards/${slug}`).expect(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('@');
      expect(body).not.toContain(ownerEmail);
      expect(body).not.toContain(editorEmail);
    });

    it('exposes no members, roles, owner or board id', async () => {
      const res = await request(app.getHttpServer()).get(`/api/public/boards/${slug}`).expect(200);
      expect(res.body.members).toBeUndefined();
      expect(res.body.role).toBeUndefined();
      expect(res.body.ownerId).toBeUndefined();
      expect(res.body.id).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(boardId);
    });

    it('shows an assignee by name only', async () => {
      const res = await request(app.getHttpServer()).get(`/api/public/boards/${slug}`).expect(200);
      const tasks = res.body.columns.flatMap((c: { tasks: unknown[] }) => c.tasks);
      const assigned = tasks.find(
        (t: { assigneeName: string | null }) => t.assigneeName !== null,
      ) as { assigneeName: string; assignee?: unknown };
      expect(assigned.assigneeName).toBe('Owner Person');
      expect(assigned.assignee).toBeUndefined();
    });

    it('is marked noindex and uncacheable', async () => {
      const res = await request(app.getHttpServer()).get(`/api/public/boards/${slug}`).expect(200);
      expect(res.headers['x-robots-tag']).toContain('noindex');
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('offers no way to write through the public path', async () => {
      // View-only is enforced by there being no other route on this path.
      for (const method of ['post', 'patch', 'delete', 'put'] as const) {
        const res = await request(app.getHttpServer())[method](`/api/public/boards/${slug}`).send({
          title: 'hacked',
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
      const after = await request(app.getHttpServer())
        .get(`/api/public/boards/${slug}`)
        .expect(200);
      expect(after.body.title).toBe('Public Link Board');
    });

    it('404s an unknown slug', async () => {
      await request(app.getHttpServer())
        .get('/api/public/boards/definitely-not-a-real-slug')
        .expect(404);
    });
  });

  describe('rotation and revocation', () => {
    it('kills the previous slug when the link is rotated', async () => {
      const previous = slug;
      const res = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);
      const rotated = res.body.slug;
      expect(rotated).not.toBe(previous);

      await request(app.getHttpServer()).get(`/api/public/boards/${previous}`).expect(404);
      await request(app.getHttpServer()).get(`/api/public/boards/${rotated}`).expect(200);
      slug = rotated;
    });

    it('stops serving the board once revoked', async () => {
      await request(app.getHttpServer())
        .delete(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      // A revoked slug and a slug that never existed answer identically, so a
      // URL cannot be probed for having once been live.
      await request(app.getHttpServer()).get(`/api/public/boards/${slug}`).expect(404);

      const board = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(board.body.isPublic).toBe(false);
    });

    it('404s a revoke when there is nothing to revoke', async () => {
      await request(app.getHttpServer())
        .delete(`/api/boards/${boardId}/public-link`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });
});
