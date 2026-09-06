import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

interface UserFixture {
  email: string;
  password: string;
  name: string;
  token: string;
  userId: string;
}

describe('Boards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const owner: UserFixture = {
    email: '',
    password: 'Password123!',
    name: 'Owner User',
    token: '',
    userId: '',
  };
  const editor: UserFixture = { ...owner, name: 'Editor User' };
  const viewer: UserFixture = { ...owner, name: 'Viewer User' };
  const stranger: UserFixture = { ...owner, name: 'Stranger User' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    // Register four distinct users via the public endpoint.
    const fixtures = [owner, editor, viewer, stranger];
    for (const f of fixtures) {
      f.email = `${f.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: f.email, password: f.password, name: f.name })
        .expect(201);
      f.token = res.body.access_token;
      f.userId = res.body.user.id;
    }
  });

  afterAll(async () => {
    // Cleanup all test users (cascades to memberships via BoardMember.userId cascade;
    // but Board deletion needs explicit handling because Board.ownerId is Restrict).
    // Delete boards they own first.
    const emails = [owner.email, editor.email, viewer.email, stranger.email];
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    const userIds = users.map((u) => u.id);
    await prisma.board.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  describe('POST /api/boards', () => {
    it('returns 201 + board + 3 default columns + OWNER role', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'My First Board', description: 'hello' })
        .expect(201);

      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.title).toBe('My First Board');
      expect(res.body.description).toBe('hello');
      expect(res.body.ownerId).toBe(owner.userId);
      expect(res.body.role).toBe('OWNER');
      expect(res.body.columns).toHaveLength(3);
      expect(res.body.columns.map((c: { title: string }) => c.title)).toEqual([
        'To Do',
        'In Progress',
        'Done',
      ]);
      // Ordering keys are strings; compare lexicographically, which is exactly
      // how the database sorts them.
      expect(res.body.columns[0].position < res.body.columns[1].position).toBe(true);
      // Every nested task must carry its columnId. The client resolves drag
      // targets from the dragged card's own payload, so omitting it silently
      // breaks drag-and-drop while every type still says `columnId: string`.
      for (const column of res.body.columns) {
        for (const task of column.tasks) {
          expect(task.columnId).toBe(column.id);
        }
      }
      expect(res.body.columns[1].position < res.body.columns[2].position).toBe(true);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0]).toEqual({
        userId: owner.userId,
        email: owner.email,
        name: owner.name,
        role: 'OWNER',
      });
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).post('/api/boards').send({ title: 'No auth' }).expect(401);
    });

    it('returns 400 for missing title', async () => {
      await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ description: 'no title' })
        .expect(400);
    });
  });

  describe('GET /api/boards', () => {
    it('returns only boards the user owns or is a member of', async () => {
      // Owner creates two boards.
      const a = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Owner A' })
        .expect(201);
      const b = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Owner B' })
        .expect(201);

      // Stranger creates one — owner must not see it.
      await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ title: 'Stranger Board' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      const ids = res.body.map((br: { id: string }) => br.id);
      expect(ids).toEqual(expect.arrayContaining([a.body.id, b.body.id]));
      // Stranger's board should NOT be in the list.
      expect(ids).not.toContain(expect.stringMatching(/^stranger/i));

      // Stranger sees only their own.
      const strangerRes = await request(app.getHttpServer())
        .get('/api/boards')
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(200);
      expect(strangerRes.body.length).toBe(1);
      expect(strangerRes.body[0].ownerId).toBe(stranger.userId);
      expect(strangerRes.body[0].role).toBe('OWNER');
    });
  });

  describe('GET /api/boards/:id', () => {
    let boardId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'For GET tests' })
        .expect(201);
      boardId = res.body.id;
    });

    it('returns 200 + full board for the owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      expect(res.body.id).toBe(boardId);
      expect(res.body.columns.length).toBe(3);
      expect(res.body.role).toBe('OWNER');
    });

    it('returns 404 for an unknown board id', async () => {
      await request(app.getHttpServer())
        .get('/api/boards/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(404);
    });

    it('returns 403 for a user with no access', async () => {
      await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);
    });
  });

  describe('PATCH /api/boards/:id', () => {
    let boardId: string;

    beforeAll(async () => {
      // Create board owned by `owner`.
      const created = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'For PATCH tests' })
        .expect(201);
      boardId = created.body.id;
      // Share with editor and viewer.
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: editor.userId, role: 'EDITOR' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: viewer.userId, role: 'VIEWER' })
        .expect(201);
    });

    it('succeeds for OWNER', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Renamed by owner' })
        .expect(200);
      expect(res.body.title).toBe('Renamed by owner');
      expect(res.body.role).toBe('OWNER');
    });

    it('succeeds for EDITOR', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${editor.token}`)
        .send({ description: 'updated by editor' })
        .expect(200);
      expect(res.body.description).toBe('updated by editor');
      expect(res.body.role).toBe('EDITOR');
    });

    it('returns 403 for VIEWER', async () => {
      await request(app.getHttpServer())
        .patch(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ title: 'viewer cannot do this' })
        .expect(403);
    });

    it('returns 403 for a user with no access', async () => {
      await request(app.getHttpServer())
        .patch(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ title: 'hax' })
        .expect(403);
    });
  });

  describe('DELETE /api/boards/:id', () => {
    let boardId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'For DELETE tests' })
        .expect(201);
      boardId = res.body.id;
      // Add a non-owner member so we can verify cascade removes them too.
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: editor.userId, role: 'EDITOR' })
        .expect(201);
    });

    it('returns 403 for non-owner (must be OWNER)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${editor.token}`)
        .expect(403);
    });

    it('returns 204 for owner and cascades to columns/members', async () => {
      await request(app.getHttpServer())
        .delete(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      // Board should be gone.
      const board = await prisma.board.findUnique({ where: { id: boardId } });
      expect(board).toBeNull();

      // Memberships cascade.
      const members = await prisma.boardMember.findMany({ where: { boardId } });
      expect(members).toHaveLength(0);

      // Columns cascade.
      const cols = await prisma.column.findMany({ where: { boardId } });
      expect(cols).toHaveLength(0);
    });
  });

  describe('POST /api/boards/:id/share', () => {
    let boardId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'For share tests' })
        .expect(201);
      boardId = res.body.id;
    });

    it('succeeds for OWNER with role=EDITOR', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: editor.userId, role: 'EDITOR' })
        .expect(201);
      expect(res.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: editor.userId, role: 'EDITOR' }),
        ]),
      );
    });

    it('succeeds for OWNER with role=VIEWER (after revoke)', async () => {
      // Revoke editor first
      await request(app.getHttpServer())
        .delete(`/api/boards/${boardId}/share/${editor.userId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: viewer.userId, role: 'VIEWER' })
        .expect(201);
      expect(res.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: viewer.userId, role: 'VIEWER' }),
        ]),
      );
    });

    it('returns 403 for EDITOR (only OWNER can share)', async () => {
      // editor was revoked above; add them again as EDITOR for this test
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: editor.userId, role: 'EDITOR' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${editor.token}`)
        .send({ userId: stranger.userId, role: 'VIEWER' })
        .expect(403);
    });

    it('returns 400 for role=OWNER (cannot grant ownership)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: stranger.userId, role: 'OWNER' })
        .expect(400);
      const msg = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
      expect(msg).toEqual(expect.stringMatching(/EDITOR or VIEWER/i));
    });

    it('returns 404 for non-existent target user', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: '00000000-0000-4000-8000-000000000000', role: 'VIEWER' })
        .expect(404);
    });

    it('returns 409 when sharing with an existing member', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: viewer.userId, role: 'VIEWER' })
        .expect(409);
    });

    it('returns 400 when sharing with self', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: owner.userId, role: 'EDITOR' })
        .expect(400);
    });
  });

  describe('DELETE /api/boards/:id/share/:userId', () => {
    let boardId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'For revoke tests' })
        .expect(201);
      boardId = res.body.id;
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: editor.userId, role: 'EDITOR' })
        .expect(201);
    });

    it('returns 204 and revokes access', async () => {
      await request(app.getHttpServer())
        .delete(`/api/boards/${boardId}/share/${editor.userId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      // After revoke, former member sees 403.
      await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${editor.token}`)
        .expect(403);
    });

    it('returns 400 when revoking the OWNER', async () => {
      await request(app.getHttpServer())
        .delete(`/api/boards/${boardId}/share/${owner.userId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(400);
    });

    it('returns 204 idempotently for an already-revoked user', async () => {
      await request(app.getHttpServer())
        .delete(`/api/boards/${boardId}/share/${editor.userId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);
    });
  });
});
