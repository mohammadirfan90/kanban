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

interface BoardFixture {
  id: string;
  columns: Array<{ id: string; title: string }>;
}

describe('Tasks (e2e)', () => {
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

  let board: BoardFixture;

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

    for (const f of [owner, editor, viewer, stranger]) {
      f.email = `${f.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: f.email, password: f.password, name: f.name })
        .expect(201);
      f.token = res.body.access_token;
      f.userId = res.body.user.id;
    }

    // Main board: owner = OWNER, editor = EDITOR, viewer = VIEWER.
    const mainRes = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Tasks Board' })
      .expect(201);
    board = {
      id: mainRes.body.id,
      columns: mainRes.body.columns.map((c: { id: string; title: string }) => ({
        id: c.id,
        title: c.title,
      })),
    };
    await request(app.getHttpServer())
      .post(`/api/boards/${board.id}/share`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ userId: editor.userId, role: 'EDITOR' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/boards/${board.id}/share`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ userId: viewer.userId, role: 'VIEWER' })
      .expect(201);
  });

  afterAll(async () => {
    const emails = [owner.email, editor.email, viewer.email, stranger.email];
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    const userIds = users.map((u) => u.id);
    await prisma.board.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /api/tasks
  // ──────────────────────────────────────────────────────────────────────
  describe('POST /api/tasks', () => {
    it('returns 201 + position=1 on an empty column', async () => {
      const colId = board.columns[0].id;
      const res = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: colId, title: 'First task' })
        .expect(201);

      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.columnId).toBe(colId);
      expect(res.body.title).toBe('First task');
      expect(res.body.description).toBeNull();
      expect(res.body.position).toBe(1);
      expect(res.body.assignee).toBeNull();
    });

    it('returns 201 + position=(max+1) for subsequent creates', async () => {
      const colId = board.columns[1].id;
      const a = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: colId, title: 'A' })
        .expect(201);
      expect(a.body.position).toBe(1);

      const b = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: colId, title: 'B' })
        .expect(201);
      expect(b.body.position).toBe(2);
    });

    it('returns 201 + includes nested assignee when assigneeId is provided (board member)', async () => {
      // editor is a member of board.
      const res = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          columnId: board.columns[2].id,
          title: 'Assigned task',
          description: 'With details',
          assigneeId: editor.userId,
        })
        .expect(201);

      expect(res.body.description).toBe('With details');
      expect(res.body.assignee).toEqual({
        id: editor.userId,
        name: editor.name,
        email: editor.email,
      });
    });

    it('returns 403 when caller is VIEWER on the board', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ columnId: board.columns[0].id, title: 'Nope' })
        .expect(403);
    });

    it('returns 403 when caller has no access to the board', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ columnId: board.columns[0].id, title: 'Trespass' })
        .expect(403);
    });

    it('returns 404 when columnId does not exist', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: fakeId, title: 'Ghost' })
        .expect(404);
    });

    it('returns 400 when title is empty', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: board.columns[0].id, title: '' })
        .expect(400);
    });

    it('returns 400 when title exceeds 200 chars', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: board.columns[0].id, title: 'x'.repeat(201) })
        .expect(400);
    });

    it('returns 400 when description exceeds 5000 chars', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          columnId: board.columns[0].id,
          title: 'Too verbose',
          description: 'x'.repeat(5001),
        })
        .expect(400);
    });

    it('returns 400 when assigneeId refers to a non-existent user', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: board.columns[0].id, title: 'Bad assignee', assigneeId: fakeId })
        .expect(400);
    });

    it('returns 400 when assigneeId refers to a user who is NOT a board member', async () => {
      // editor is a member, but stranger is not a member of board.
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: board.columns[0].id, title: 'Bad assignee', assigneeId: stranger.userId })
        .expect(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /api/tasks/:id
  // ──────────────────────────────────────────────────────────────────────
  describe('GET /api/tasks/:id', () => {
    let seededTaskId: string;
    let assignedTaskId: string;

    beforeAll(async () => {
      const a = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: board.columns[0].id, title: 'For GET' })
        .expect(201);
      seededTaskId = a.body.id;

      const b = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          columnId: board.columns[0].id,
          title: 'Assigned For GET',
          assigneeId: editor.userId,
        })
        .expect(201);
      assignedTaskId = b.body.id;
    });

    it('returns 200 + task with assignee=null', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/tasks/${seededTaskId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      expect(res.body.id).toBe(seededTaskId);
      expect(res.body.title).toBe('For GET');
      expect(res.body.assignee).toBeNull();
      // Verify response shape: no passwordHash leak, no extra fields.
      expect(Object.keys(res.body.assignee ?? {})).toEqual([]);
    });

    it('returns 200 + task with nested assignee (id/name/email only)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/tasks/${assignedTaskId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      expect(res.body.assignee).toEqual({
        id: editor.userId,
        name: editor.name,
        email: editor.email,
      });
      // Critical: assignee object should have exactly these 3 keys.
      expect(Object.keys(res.body.assignee).sort()).toEqual(['email', 'id', 'name']);
    });

    it('returns 200 for VIEWER (read access allowed)', async () => {
      await request(app.getHttpServer())
        .get(`/api/tasks/${seededTaskId}`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .expect(200);
    });

    it('returns 403 for stranger (no board access)', async () => {
      await request(app.getHttpServer())
        .get(`/api/tasks/${seededTaskId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);
    });

    it('returns 404 for an unknown task id', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/tasks/${fakeId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // PATCH /api/tasks/:id
  // ──────────────────────────────────────────────────────────────────────
  describe('PATCH /api/tasks/:id', () => {
    let patchTaskId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: board.columns[1].id, title: 'To patch' })
        .expect(201);
      patchTaskId = res.body.id;
    });

    it('returns 200 + updates title only', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${patchTaskId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Patched title' })
        .expect(200);
      expect(res.body.title).toBe('Patched title');
      expect(res.body.description).toBeNull();
    });

    it('returns 200 + updates description only', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${patchTaskId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ description: 'New description' })
        .expect(200);
      expect(res.body.description).toBe('New description');
      expect(res.body.title).toBe('Patched title');
    });

    it('returns 200 + replaces assignee', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${patchTaskId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ assigneeId: editor.userId })
        .expect(200);
      expect(res.body.assignee).toEqual({
        id: editor.userId,
        name: editor.name,
        email: editor.email,
      });
    });

    it('returns 200 + accepts explicit null to unassign', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${patchTaskId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ assigneeId: null })
        .expect(200);
      expect(res.body.assignee).toBeNull();
    });

    it('returns 403 when caller is VIEWER on the board', async () => {
      await request(app.getHttpServer())
        .patch(`/api/tasks/${patchTaskId}`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ title: 'Nope' })
        .expect(403);
    });

    it('returns 403 when caller has no access', async () => {
      await request(app.getHttpServer())
        .patch(`/api/tasks/${patchTaskId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ title: 'Nope' })
        .expect(403);
    });

    it('returns 404 when task id does not exist', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .patch(`/api/tasks/${fakeId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Ghost' })
        .expect(404);
    });

    it('returns 400 when assigneeId refers to a non-board-member', async () => {
      await request(app.getHttpServer())
        .patch(`/api/tasks/${patchTaskId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ assigneeId: stranger.userId })
        .expect(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // DELETE /api/tasks/:id
  // ──────────────────────────────────────────────────────────────────────
  describe('DELETE /api/tasks/:id', () => {
    it("returns 204 + leaves siblings' positions unchanged (gaps allowed)", async () => {
      // Seed three tasks in a fresh column.
      const freshCol = await prisma.column.create({
        data: { boardId: board.id, title: 'Delete Test', position: 9999 },
      });
      const t1 = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: freshCol.id, title: 'T1' })
        .expect(201);
      const t2 = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: freshCol.id, title: 'T2' })
        .expect(201);
      const t3 = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: freshCol.id, title: 'T3' })
        .expect(201);

      expect(t1.body.position).toBe(1);
      expect(t2.body.position).toBe(2);
      expect(t3.body.position).toBe(3);

      // Delete the middle one.
      await request(app.getHttpServer())
        .delete(`/api/tasks/${t2.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      // Confirm t1 and t3 are still 1 and 3 (gap is allowed).
      const t1After = await request(app.getHttpServer())
        .get(`/api/tasks/${t1.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      const t3After = await request(app.getHttpServer())
        .get(`/api/tasks/${t3.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(t1After.body.position).toBe(1);
      expect(t3After.body.position).toBe(3);

      // Confirm t2 is gone (GET → 404).
      await request(app.getHttpServer())
        .get(`/api/tasks/${t2.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(404);
    });

    it('returns 403 when caller is VIEWER on the board', async () => {
      const t = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: board.columns[0].id, title: 'Protected' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/tasks/${t.body.id}`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .expect(403);
    });

    it('returns 403 when caller has no access', async () => {
      const t = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnId: board.columns[0].id, title: 'Protected' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/tasks/${t.body.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);
    });

    it('returns 404 when task id does not exist', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/tasks/${fakeId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(404);
    });
  });
});
