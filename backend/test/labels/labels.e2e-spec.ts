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

describe('Labels + task depth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const owner: UserFixture = {
    email: '',
    password: 'Password123!',
    name: 'Label Owner',
    token: '',
    userId: '',
  };
  const viewer: UserFixture = { ...owner, name: 'Label Viewer' };
  const stranger: UserFixture = { ...owner, name: 'Label Stranger' };

  let boardId: string;
  let boardKey: string;
  let columnId: string;

  const auth = (u: UserFixture) => ({ Authorization: `Bearer ${u.token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    for (const f of [owner, viewer, stranger]) {
      f.email = `${f.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: f.email, password: f.password, name: f.name })
        .expect(201);
      f.token = res.body.access_token;
      f.userId = res.body.user.id;
    }

    // "Delivery Pipeline" exercises the multi-word key path -> DP.
    const board = await request(app.getHttpServer())
      .post('/api/boards')
      .set(auth(owner))
      .send({ title: 'Delivery Pipeline' })
      .expect(201);
    boardId = board.body.id;
    boardKey = board.body.key;
    columnId = board.body.columns[0].id;

    await request(app.getHttpServer())
      .post(`/api/boards/${boardId}/share`)
      .set(auth(owner))
      .send({ userId: viewer.userId, role: 'VIEWER' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────
  describe('board keys', () => {
    it('derives the key from the title', () => {
      expect(boardKey).toBe('DP');
    });

    it('uses the leading characters of a single-word title', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .set(auth(owner))
        .send({ title: 'Phronesis' })
        .expect(201);
      expect(res.body.key).toBe('PHRO');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  describe('POST /api/boards/:boardId/labels', () => {
    it('creates a label', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/labels`)
        .set(auth(owner))
        .send({ name: 'bug', color: 'rose' })
        .expect(201);
      expect(res.body).toMatchObject({ boardId, name: 'bug', color: 'rose' });
    });

    it('rejects a duplicate name on the same board', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/labels`)
        .set(auth(owner))
        .send({ name: 'bug', color: 'amber' })
        .expect(409);
    });

    it('rejects a raw color value — the palette is tokens only', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/labels`)
        .set(auth(owner))
        .send({ name: 'crimson', color: '#ff0000' })
        .expect(400);
    });

    it('returns 403 for a VIEWER', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/labels`)
        .set(auth(viewer))
        .send({ name: 'nope', color: 'sky' })
        .expect(403);
    });

    it('returns 403 for a non-member', async () => {
      await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/labels`)
        .set(auth(stranger))
        .send({ name: 'nope', color: 'sky' })
        .expect(403);
    });

    it('allows the same label name on a different board', async () => {
      const other = await request(app.getHttpServer())
        .post('/api/boards')
        .set(auth(owner))
        .send({ title: 'Other Board' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/boards/${other.body.id}/labels`)
        .set(auth(owner))
        .send({ name: 'bug', color: 'rose' })
        .expect(201);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  describe('task depth', () => {
    let bugId: string;
    let choreId: string;

    beforeAll(async () => {
      const labels = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}/labels`)
        .set(auth(owner))
        .expect(200);
      bugId = labels.body.find((l: { name: string }) => l.name === 'bug').id;

      const chore = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/labels`)
        .set(auth(owner))
        .send({ name: 'chore', color: 'sky' })
        .expect(201);
      choreId = chore.body.id;
    });

    it('creates a task with priority, due date and labels', async () => {
      const dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'Ship it', priority: 'HIGH', dueDate, labelIds: [bugId] })
        .expect(201);

      expect(res.body.priority).toBe('HIGH');
      expect(new Date(res.body.dueDate).toISOString()).toBe(dueDate);
      expect(res.body.labels.map((l: { name: string }) => l.name)).toEqual(['bug']);
      expect(res.body.key).toMatch(/^DP-\d+$/);
      expect(res.body.boardId).toBe(boardId);
    });

    it('assigns sequential keys', async () => {
      const a = await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'First' })
        .expect(201);
      const b = await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'Second' })
        .expect(201);
      expect(b.body.number).toBe(a.body.number + 1);
    });

    it('does not recycle a number after the task is deleted', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'Doomed' })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/api/tasks/${created.body.id}`)
        .set(auth(owner))
        .expect(204);

      const next = await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'After' })
        .expect(201);
      expect(next.body.number).toBeGreaterThan(created.body.number);
    });

    it('keeps numbers unique when creates race', async () => {
      // The counter is incremented atomically rather than read-then-written, so
      // concurrent creates cannot claim the same key.
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          request(app.getHttpServer())
            .post('/api/tasks')
            .set(auth(owner))
            .send({ columnId, title: `Race ${i}` }),
        ),
      );
      const numbers = results.filter((r) => r.status === 201).map((r) => r.body.number);
      expect(numbers.length).toBe(8);
      expect(new Set(numbers).size).toBe(8);
    }, 30_000);

    it('replaces labels wholesale on update', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'Relabel me', labelIds: [bugId] })
        .expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/api/tasks/${created.body.id}`)
        .set(auth(owner))
        .send({ labelIds: [choreId] })
        .expect(200);
      expect(updated.body.labels.map((l: { name: string }) => l.name)).toEqual(['chore']);

      const cleared = await request(app.getHttpServer())
        .patch(`/api/tasks/${created.body.id}`)
        .set(auth(owner))
        .send({ labelIds: [] })
        .expect(200);
      expect(cleared.body.labels).toEqual([]);
    });

    it('clears priority and dueDate with null, and leaves them alone when omitted', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({
          columnId,
          title: 'Clearable',
          priority: 'URGENT',
          dueDate: new Date().toISOString(),
        })
        .expect(201);

      const untouched = await request(app.getHttpServer())
        .patch(`/api/tasks/${created.body.id}`)
        .set(auth(owner))
        .send({ title: 'Renamed' })
        .expect(200);
      expect(untouched.body.priority).toBe('URGENT');
      expect(untouched.body.dueDate).not.toBeNull();

      const cleared = await request(app.getHttpServer())
        .patch(`/api/tasks/${created.body.id}`)
        .set(auth(owner))
        .send({ priority: null, dueDate: null })
        .expect(200);
      expect(cleared.body.priority).toBeNull();
      expect(cleared.body.dueDate).toBeNull();
    });

    it('rejects a label belonging to another board', async () => {
      const other = await request(app.getHttpServer())
        .post('/api/boards')
        .set(auth(owner))
        .send({ title: 'Foreign Board' })
        .expect(201);
      const foreign = await request(app.getHttpServer())
        .post(`/api/boards/${other.body.id}/labels`)
        .set(auth(owner))
        .send({ name: 'foreign', color: 'violet' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'Cross-board', labelIds: [foreign.body.id] })
        .expect(400);
    });

    it('rejects an invalid priority', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'Bad', priority: 'SUPER_URGENT' })
        .expect(400);
    });

    it('rejects a malformed due date', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'Bad', dueDate: 'next tuesday' })
        .expect(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  describe('DELETE /api/labels/:id', () => {
    it('detaches the label from its tasks without deleting them', async () => {
      const label = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/labels`)
        .set(auth(owner))
        .send({ name: 'ephemeral', color: 'amber' })
        .expect(201);

      const task = await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth(owner))
        .send({ columnId, title: 'Keeps living', labelIds: [label.body.id] })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/labels/${label.body.id}`)
        .set(auth(owner))
        .expect(204);

      const after = await request(app.getHttpServer())
        .get(`/api/tasks/${task.body.id}`)
        .set(auth(owner))
        .expect(200);
      expect(after.body.title).toBe('Keeps living');
      expect(after.body.labels).toEqual([]);

      // And the join row is gone, not orphaned.
      const joins = await prisma.taskLabel.count({ where: { labelId: label.body.id } });
      expect(joins).toBe(0);
    });

    it('returns 403 for a VIEWER', async () => {
      const label = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/labels`)
        .set(auth(owner))
        .send({ name: 'protected', color: 'indigo' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/labels/${label.body.id}`)
        .set(auth(viewer))
        .expect(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  describe('board response shape', () => {
    it('carries the board key, its labels, and full task depth', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set(auth(owner))
        .expect(200);

      expect(res.body.key).toBe('DP');
      expect(Array.isArray(res.body.labels)).toBe(true);
      expect(res.body.labels.length).toBeGreaterThan(0);

      const tasks = res.body.columns.flatMap((c: { tasks: unknown[] }) => c.tasks);
      expect(tasks.length).toBeGreaterThan(0);
      for (const task of tasks) {
        // The board, column and task endpoints share one mapper, so this shape
        // is the same everywhere. Asserting it here is what stops the three
        // drifting apart again.
        expect(task).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            columnId: expect.any(String),
            boardId,
            key: expect.stringMatching(/^DP-\d+$/),
            number: expect.any(Number),
            title: expect.any(String),
            position: expect.any(String),
            labels: expect.any(Array),
          }),
        );
        expect(task).toHaveProperty('priority');
        expect(task).toHaveProperty('dueDate');
      }
    });
  });
});
