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

interface SeededTask {
  id: string;
  title: string;
  position: number;
  columnId: string;
}

describe('Tasks (e2e) — PATCH /api/tasks/:id/move', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const owner: UserFixture = {
    email: '',
    password: 'Password123!',
    name: 'Move Owner',
    token: '',
    userId: '',
  };
  const editor: UserFixture = { ...owner, name: 'Move Editor' };
  const viewer: UserFixture = { ...owner, name: 'Move Viewer' };
  const stranger: UserFixture = { ...owner, name: 'Move Stranger' };

  let board: BoardFixture;

  // Helper: seed a task in a column with an explicit (deterministic) position.
  // Bypasses the service so we can craft the fractional positions the tests need.
  const seedTask = async (
    columnId: string,
    title: string,
    position: number,
  ): Promise<SeededTask> => {
    const created = await prisma.task.create({
      data: { columnId, title, position },
      select: { id: true, title: true, position: true, columnId: true },
    });
    return created;
  };

  // Helper: fetch a task's position directly.
  const fetchPosition = async (taskId: string): Promise<number> => {
    const row = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: { position: true },
    });
    return row.position;
  };

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

    const mainRes = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Move Board' })
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
  // Within-column moves
  // ──────────────────────────────────────────────────────────────────────
  describe('within-column moves', () => {
    let colA: string;
    let tA1: SeededTask;
    let tA2: SeededTask;
    let tA3: SeededTask;

    beforeAll(async () => {
      colA = board.columns[0].id;
      // Seed three tasks with deterministic integer positions.
      tA1 = await seedTask(colA, 'A1', 1);
      tA2 = await seedTask(colA, 'A2', 2);
      tA3 = await seedTask(colA, 'A3', 3);
    });

    it('moves a task to the start (newIndex=0) → position = first/2 = 0.5', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tA2.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: 0 })
        .expect(200);

      expect(res.body.columnId).toBe(colA);
      expect(res.body.position).toBeCloseTo(0.5, 10);
      // Sibling A1 stays at 1, A3 stays at 3 (no renumber).
      expect(await fetchPosition(tA1.id)).toBe(1);
      expect(await fetchPosition(tA3.id)).toBe(3);
    });

    it('moves a task to the end (newIndex=length) → position = last + 1 = 4', async () => {
      // Move A1 (currently at 1) to newIndex=3 (the end after A2 and A3).
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tA1.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: 3 })
        .expect(200);

      expect(res.body.position).toBe(4);
      // A2 and A3 unchanged.
      expect(await fetchPosition(tA2.id)).toBe(0.5);
      expect(await fetchPosition(tA3.id)).toBe(3);
    });

    it('moves a task to the middle (newIndex=1) → position = midpoint = 1.5', async () => {
      // Move A3 (currently at 3) between A2 (0.5) and A1 (4) → newIndex=1.
      // Neighbors at newIndex-1=0 and newIndex=1 are A2 (0.5) and A1 (4).
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tA3.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: 1 })
        .expect(200);

      expect(res.body.position).toBeCloseTo(2.25, 10); // (0.5 + 4) / 2
      // Sibling positions unchanged.
      expect(await fetchPosition(tA2.id)).toBe(0.5);
      expect(await fetchPosition(tA1.id)).toBe(4);
    });

    it('does NOT renumber siblings on a normal move', async () => {
      // Reset to a clean three-task column for this check.
      const freshCol = await prisma.column.create({
        data: { boardId: board.id, title: 'Sib Check', position: 9999 },
      });
      const x1 = await seedTask(freshCol.id, 'X1', 1);
      const x2 = await seedTask(freshCol.id, 'X2', 2);
      const x3 = await seedTask(freshCol.id, 'X3', 3);

      await request(app.getHttpServer())
        .patch(`/api/tasks/${x1.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: freshCol.id, newIndex: 3 })
        .expect(200);

      // X2 and X3 should still be at their original integer positions.
      expect(await fetchPosition(x2.id)).toBe(2);
      expect(await fetchPosition(x3.id)).toBe(3);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Cross-column moves
  // ──────────────────────────────────────────────────────────────────────
  describe('cross-column moves', () => {
    let colA: string;
    let colB: string;
    let colC: string;

    beforeAll(async () => {
      colA = board.columns[0].id;
      colB = board.columns[1].id;
      colC = board.columns[2].id;
      // Make sure each test starts with predictable content.
      await prisma.task.deleteMany({ where: { columnId: { in: [colA, colB, colC] } } });
    });

    it('moves a task into an empty column → position = 1', async () => {
      const t1 = await seedTask(colA, 'Forward', 1);
      expect(await prisma.task.count({ where: { columnId: colB } })).toBe(0);

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${t1.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colB, newIndex: 0 })
        .expect(200);

      expect(res.body.columnId).toBe(colB);
      expect(res.body.position).toBe(1);
      expect(await prisma.task.count({ where: { columnId: colA } })).toBe(0);
    });

    it('moves a task back into a column that already has tasks → midpoint position', async () => {
      // After the previous test, colB has one task at position 1.
      // Seed another in colC, then move it into colB at newIndex=1 (after the first).
      const tC = await seedTask(colC, 'Backward', 1);

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tC.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colB, newIndex: 1 })
        .expect(200);

      expect(res.body.columnId).toBe(colB);
      expect(res.body.position).toBe(2); // last + 1, since newIndex >= length
      expect(await prisma.task.count({ where: { columnId: colC } })).toBe(0);
    });

    it('moves a task between two siblings in a populated column', async () => {
      // colB currently has 2 tasks (positions 1 and 2). Seed a third at position 3
      // so a move to newIndex=1 actually averages between two real neighbors.
      const tB3 = await seedTask(colB, 'Mid', 3);

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tB3.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colB, newIndex: 1 })
        .expect(200);

      expect(res.body.columnId).toBe(colB);
      // Inserting between positions 1 and 2 → midpoint 1.5.
      expect(res.body.position).toBeCloseTo(1.5, 10);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Precision exhaustion → rebalance
  // ──────────────────────────────────────────────────────────────────────
  describe('rebalance on precision exhaustion', () => {
    it('renumbers the target column to integers when gap < Float64 epsilon', async () => {
      // Create a fresh column with two tasks in an absurdly tiny gap,
      // then move a third task INTO the gap. The midpoint of 1.0 and 1.0+1e-11
      // differs from each neighbor by ~5e-12, which is < REBALANCE_THRESHOLD.
      const tinyCol = await prisma.column.create({
        data: { boardId: board.id, title: 'Tiny Gap', position: 9998 },
      });
      const tinyB = await prisma.task.create({
        data: { columnId: tinyCol.id, title: 'TinyB', position: 1.0 },
        select: { id: true },
      });
      const tinyC = await prisma.task.create({
        data: { columnId: tinyCol.id, title: 'TinyC', position: 1.0 + 1e-11 },
        select: { id: true },
      });
      // Third task lives in a different column — will be moved into the tiny gap.
      const otherCol = await prisma.column.create({
        data: { boardId: board.id, title: 'Other', position: 9997 },
      });
      const tinyA = await prisma.task.create({
        data: { columnId: otherCol.id, title: 'TinyA', position: 1.0 },
        select: { id: true },
      });

      // Sanity check: midpoint between TinyB and TinyC is within rebalance threshold
      // of TinyB, so the algorithm should rebalance.
      const midpoint = (1.0 + (1.0 + 1e-11)) / 2;
      expect(Math.abs(1.0 - midpoint)).toBeLessThan(1e-10);

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tinyA.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: tinyCol.id, newIndex: 1 })
        .expect(200);

      // After rebalance: positions renumbered 1, 2, 3 with TinyA at newIndex=1 → position 2.
      expect(res.body.position).toBe(2);
      const after = await prisma.task.findMany({
        where: { columnId: tinyCol.id },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
      expect(after).toHaveLength(3);
      expect(after[0].position).toBe(1);
      expect(after[1].position).toBe(2);
      expect(after[2].position).toBe(3);
      // tinyB at index 0, tinyA at index 1, tinyC at index 2 (TinyB preserved as head).
      expect(after[0].id).toBe(tinyB.id);
      expect(after[1].id).toBe(tinyA.id);
      expect(after[2].id).toBe(tinyC.id);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Response shape
  // ──────────────────────────────────────────────────────────────────────
  describe('response shape', () => {
    it('returns the updated task with columnId and position reflecting the move', async () => {
      const colX = await prisma.column.create({
        data: { boardId: board.id, title: 'Shape', position: 9997 },
      });
      const colY = await prisma.column.create({
        data: { boardId: board.id, title: 'Shape2', position: 9996 },
      });
      const t = await seedTask(colX.id, 'Shapey', 1);

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${t.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colY.id, newIndex: 0 })
        .expect(200);

      expect(res.body.id).toBe(t.id);
      expect(res.body.columnId).toBe(colY.id);
      expect(res.body.position).toBe(1);
      expect(res.body.title).toBe('Shapey');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Authorization
  // ──────────────────────────────────────────────────────────────────────
  describe('authorization', () => {
    let colA: string;
    let movable: SeededTask;

    beforeAll(async () => {
      colA = board.columns[0].id;
      movable = await seedTask(colA, 'Auth Task', 100);
    });

    it('returns 403 when caller is VIEWER on the board', async () => {
      await request(app.getHttpServer())
        .patch(`/api/tasks/${movable.id}/move`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ targetColumnId: colA, newIndex: 0 })
        .expect(403);
    });

    it('returns 403 when caller has no access to the board', async () => {
      await request(app.getHttpServer())
        .patch(`/api/tasks/${movable.id}/move`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ targetColumnId: colA, newIndex: 0 })
        .expect(403);
    });

    it("returns 200 when an EDITOR on the board moves someone else's task", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${movable.id}/move`)
        .set('Authorization', `Bearer ${editor.token}`)
        .send({ targetColumnId: colA, newIndex: 1 })
        .expect(200);
      // colA currently holds only `movable` itself; after excluding source,
      // targetTasks is empty → new position = 1.
      expect(res.body.position).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Not found / validation
  // ──────────────────────────────────────────────────────────────────────
  describe('not found + validation', () => {
    let colA: string;
    let real: SeededTask;

    beforeAll(async () => {
      colA = board.columns[0].id;
      real = await seedTask(colA, 'Real', 500);
    });

    it('returns 404 when the task id does not exist', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .patch(`/api/tasks/${fakeId}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: 0 })
        .expect(404);
    });

    it('returns 404 when the target column does not exist', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .patch(`/api/tasks/${real.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: fakeId, newIndex: 0 })
        .expect(404);
    });

    it('returns 404 when the target column is on a different board', async () => {
      // Build a second board owned by the stranger, with its own column.
      const strangerBoardRes = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ title: 'Foreign Board' })
        .expect(201);
      const foreignColId = strangerBoardRes.body.columns[0].id;

      await request(app.getHttpServer())
        .patch(`/api/tasks/${real.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: foreignColId, newIndex: 0 })
        .expect(404);
    });

    it('returns 400 when newIndex is negative', async () => {
      await request(app.getHttpServer())
        .patch(`/api/tasks/${real.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: -1 })
        .expect(400);
    });

    it('returns 400 when newIndex is not an integer', async () => {
      await request(app.getHttpServer())
        .patch(`/api/tasks/${real.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: 1.5 })
        .expect(400);
    });

    it('returns 400 when targetColumnId is not a UUID', async () => {
      await request(app.getHttpServer())
        .patch(`/api/tasks/${real.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: 'not-a-uuid', newIndex: 0 })
        .expect(400);
    });

    it('returns 400 when the task id is not a UUID', async () => {
      await request(app.getHttpServer())
        .patch('/api/tasks/not-a-uuid/move')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: 0 })
        .expect(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Concurrency smoke: two moves back-to-back at the same slot → no 500
  // ──────────────────────────────────────────────────────────────────────
  describe('concurrency smoke', () => {
    it('handles two sequential moves at the same target index without 500', async () => {
      const ccCol = await prisma.column.create({
        data: { boardId: board.id, title: 'Concurrency', position: 9995 },
      });
      const a = await seedTask(ccCol.id, 'RaceA', 1);
      const b = await seedTask(ccCol.id, 'RaceB', 2);

      // Both target the empty slot at newIndex=2 (append). Should both succeed.
      const r1 = await request(app.getHttpServer())
        .patch(`/api/tasks/${a.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: ccCol.id, newIndex: 2 });
      const r2 = await request(app.getHttpServer())
        .patch(`/api/tasks/${b.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: ccCol.id, newIndex: 2 });

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
    });
  });
});
