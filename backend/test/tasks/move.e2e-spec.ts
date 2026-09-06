import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';
import { tokenFromResponse } from '../auth-cookie';

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
  position: string;
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

  // Helper: seed a task with an explicit ordering key. Bypasses the service so
  // a test can construct an exact starting order.
  const seedTask = async (
    columnId: string,
    title: string,
    position: string,
  ): Promise<SeededTask> => {
    // boardId and number are NOT NULL and unique per board. Seeds bypass the
    // service, so they have to supply both; a monotonic counter keeps them
    // distinct without every caller having to think about it.
    const { boardId } = await prisma.column.findUniqueOrThrow({
      where: { id: columnId },
      select: { boardId: true },
    });
    const board = await prisma.board.update({
      where: { id: boardId },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true },
    });
    const created = await prisma.task.create({
      data: { columnId, boardId, number: board.taskCounter, title, position },
      select: { id: true, title: true, position: true, columnId: true },
    });
    return created;
  };

  // Helper: fetch a task's ordering key directly.
  const fetchPosition = async (taskId: string): Promise<string> => {
    const row = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: { position: true },
    });
    return row.position;
  };

  // Helper: the ids of a column's tasks, in stored order.
  //
  // Assertions below check *this* rather than exact key values. What the API
  // owes a caller is "the task lands at the index I asked for and the column
  // keeps a total order"; the particular key that achieves it is an
  // implementation detail. Pinning exact keys is what made the old float suite
  // need rewriting the moment the algorithm changed.
  const orderOf = async (columnId: string): Promise<string[]> => {
    const rows = await prisma.task.findMany({
      where: { columnId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
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
      f.token = tokenFromResponse(res);
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
      // Seed three tasks with deterministic ordering keys.
      tA1 = await seedTask(colA, 'A1', 'a1');
      tA2 = await seedTask(colA, 'A2', 'a2');
      tA3 = await seedTask(colA, 'A3', 'a3');
    });

    it('moves a task to the start (newIndex=0)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tA2.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: 0 })
        .expect(200);

      expect(res.body.columnId).toBe(colA);
      expect(await orderOf(colA)).toEqual([tA2.id, tA1.id, tA3.id]);
      // Siblings keep their keys — a move rewrites one row, never the column.
      expect(await fetchPosition(tA1.id)).toBe('a1');
      expect(await fetchPosition(tA3.id)).toBe('a3');
    });

    it('moves a task to the end (newIndex = length)', async () => {
      // Order is currently [A2, A1, A3]; move A1 to the end.
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tA1.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: 3 })
        .expect(200);

      expect(res.body.columnId).toBe(colA);
      expect(await orderOf(colA)).toEqual([tA2.id, tA3.id, tA1.id]);
      expect(await fetchPosition(tA3.id)).toBe('a3');
    });

    it('moves a task to an interior index', async () => {
      // Order is currently [A2, A3, A1]. Moving A3 to index 1 would be a no-op,
      // so move A1 to index 1 instead.
      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tA1.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colA, newIndex: 1 })
        .expect(200);

      expect(res.body.columnId).toBe(colA);
      expect(await orderOf(colA)).toEqual([tA2.id, tA1.id, tA3.id]);
      // The new key sorts strictly between its neighbours.
      const [pA2, pA1, pA3] = await Promise.all([
        fetchPosition(tA2.id),
        fetchPosition(tA1.id),
        fetchPosition(tA3.id),
      ]);
      expect(pA2 < pA1).toBe(true);
      expect(pA1 < pA3).toBe(true);
    });

    it('does NOT renumber siblings on a normal move', async () => {
      // Reset to a clean three-task column for this check.
      const freshCol = await prisma.column.create({
        data: { boardId: board.id, title: 'Sib Check', position: 'a9' },
      });
      const x1 = await seedTask(freshCol.id, 'X1', 'a1');
      const x2 = await seedTask(freshCol.id, 'X2', 'a2');
      const x3 = await seedTask(freshCol.id, 'X3', 'a3');

      await request(app.getHttpServer())
        .patch(`/api/tasks/${x1.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: freshCol.id, newIndex: 3 })
        .expect(200);

      // X2 and X3 keep their original keys — no renumbering pass.
      expect(await fetchPosition(x2.id)).toBe('a2');
      expect(await fetchPosition(x3.id)).toBe('a3');
      expect(await orderOf(freshCol.id)).toEqual([x2.id, x3.id, x1.id]);
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

    it('moves a task into an empty column', async () => {
      const t1 = await seedTask(colA, 'Forward', 'a1');
      expect(await prisma.task.count({ where: { columnId: colB } })).toBe(0);

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${t1.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colB, newIndex: 0 })
        .expect(200);

      expect(res.body.columnId).toBe(colB);
      expect(await orderOf(colB)).toEqual([t1.id]);
      expect(await prisma.task.count({ where: { columnId: colA } })).toBe(0);
    });

    it('moves a task back into a column that already has tasks', async () => {
      // colB holds one task from the previous test. Seed another in colC, then
      // move it into colB at newIndex=1 (after the existing one).
      const tC = await seedTask(colC, 'Backward', 'a1');

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tC.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colB, newIndex: 1 })
        .expect(200);

      expect(res.body.columnId).toBe(colB);
      expect((await orderOf(colB)).at(-1)).toBe(tC.id);
      expect(await prisma.task.count({ where: { columnId: colC } })).toBe(0);
    });

    it('moves a task between two siblings in a populated column', async () => {
      // colB currently holds 2 tasks. Seed a third at the tail so a move to
      // newIndex=1 lands between two real neighbours.
      const tB3 = await seedTask(colB, 'Mid', 'z9');

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${tB3.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colB, newIndex: 1 })
        .expect(200);

      expect(res.body.columnId).toBe(colB);
      // Lands at index 1 of a 3-task column.
      expect((await orderOf(colB)).indexOf(tB3.id)).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Precision — the failure mode that motivated fractional indexing
  // ──────────────────────────────────────────────────────────────────────
  describe('precision under repeated inserts into one gap', () => {
    it('survives 100 consecutive inserts at the head without renumbering', async () => {
      // The float implementation computed `first.position / 2` here, halving
      // toward zero until two rows collapsed onto one value; it needed an
      // O(n) renumber of the whole column to recover. Fractional keys have a
      // representable value between any two distinct keys, so this is just a
      // hundred single-row writes.
      const col = await prisma.column.create({
        data: { boardId: board.id, title: 'Precision', position: 'z1' },
      });
      const anchor = await seedTask(col.id, 'Anchor', 'a1');

      const movers: string[] = [];
      for (let i = 0; i < 100; i++) {
        const t = await seedTask(col.id, `P${i}`, `z${i.toString(36)}zz`);
        await request(app.getHttpServer())
          .patch(`/api/tasks/${t.id}/move`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ targetColumnId: col.id, newIndex: 0 })
          .expect(200);
        movers.unshift(t.id);
      }

      const rows = await prisma.task.findMany({
        where: { columnId: col.id },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });

      expect(rows).toHaveLength(101);
      // Every key distinct — this is what the float version could not hold.
      expect(new Set(rows.map((r) => r.position)).size).toBe(101);
      // Strictly ascending, and the most recent insert is first.
      expect(rows.every((r, i) => i === 0 || rows[i - 1].position < r.position)).toBe(true);
      expect(rows.map((r) => r.id)).toEqual([...movers, anchor.id]);
      // The anchor never moved, so it never got renumbered.
      expect(await fetchPosition(anchor.id)).toBe('a1');
    }, 60_000);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Response shape
  // ──────────────────────────────────────────────────────────────────────
  describe('response shape', () => {
    it('returns the updated task with columnId and position reflecting the move', async () => {
      const colX = await prisma.column.create({
        data: { boardId: board.id, title: 'Shape', position: 'z3' },
      });
      const colY = await prisma.column.create({
        data: { boardId: board.id, title: 'Shape2', position: 'z4' },
      });
      const t = await seedTask(colX.id, 'Shapey', 'a1');

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${t.id}/move`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ targetColumnId: colY.id, newIndex: 0 })
        .expect(200);

      expect(res.body.id).toBe(t.id);
      expect(res.body.columnId).toBe(colY.id);
      expect(typeof res.body.position).toBe('string');
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
      movable = await seedTask(colA, 'Auth Task', 'a1');
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
      expect(typeof res.body.position).toBe('string');
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
      real = await seedTask(colA, 'Real', 'a5');
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
  // Conflict-free ordering under genuine concurrency
  //
  // This is the requirement the brief calls out by name: "Ensure task ordering
  // remains stable, accurate, and conflict-free when tasks are rearranged."
  //
  // The previous float implementation failed it outright. Read-compute-write
  // with no transaction and no uniqueness meant N concurrent moves to the same
  // index all read the same neighbours, all computed the same midpoint, and
  // all wrote it: eight concurrent moves to index 0 left seven tasks sharing
  // position 0.5, with no deterministic order for any client to render.
  // ──────────────────────────────────────────────────────────────────────
  describe('conflict-free ordering under concurrency', () => {
    const CONTENDERS = 8;

    it('keeps every position distinct when N moves race for the same index', async () => {
      const col = await prisma.column.create({
        data: { boardId: board.id, title: 'Race Same Index', position: 'z5' },
      });
      const tasks = [];
      for (let i = 0; i < CONTENDERS; i++) {
        tasks.push(await seedTask(col.id, `Race${i}`, `a${i}`));
      }

      // Fire simultaneously — no awaits in between.
      const results = await Promise.all(
        tasks.map((t) =>
          request(app.getHttpServer())
            .patch(`/api/tasks/${t.id}/move`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ targetColumnId: col.id, newIndex: 0 }),
        ),
      );

      // Every request resolves: winners get 200, and a caller that loses the
      // slot five times running gets a 409 telling it to refetch — never a 500
      // and never a silent success that corrupted the order.
      for (const r of results) {
        expect([200, 409]).toContain(r.status);
      }

      const rows = await prisma.task.findMany({
        where: { columnId: col.id },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });

      expect(rows).toHaveLength(CONTENDERS);
      // The invariant: no two tasks share a position key.
      expect(new Set(rows.map((r) => r.position)).size).toBe(CONTENDERS);
      // ...and the column still has a strict total order.
      expect(rows.every((r, i) => i === 0 || rows[i - 1].position < r.position)).toBe(true);
    }, 30_000);

    it('keeps ordering intact when concurrent moves target different indices', async () => {
      const col = await prisma.column.create({
        data: { boardId: board.id, title: 'Race Mixed Index', position: 'z6' },
      });
      const tasks = [];
      for (let i = 0; i < CONTENDERS; i++) {
        tasks.push(await seedTask(col.id, `Mixed${i}`, `a${i}`));
      }

      const results = await Promise.all(
        tasks.map((t, i) =>
          request(app.getHttpServer())
            .patch(`/api/tasks/${t.id}/move`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ targetColumnId: col.id, newIndex: (CONTENDERS - 1 - i) % CONTENDERS }),
        ),
      );

      for (const r of results) {
        expect([200, 409]).toContain(r.status);
      }

      const rows = await prisma.task.findMany({
        where: { columnId: col.id },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
      expect(rows).toHaveLength(CONTENDERS);
      expect(new Set(rows.map((r) => r.position)).size).toBe(CONTENDERS);
      expect(rows.every((r, i) => i === 0 || rows[i - 1].position < r.position)).toBe(true);
    }, 30_000);

    it('keeps both columns consistent when moves race across columns', async () => {
      const from = await prisma.column.create({
        data: { boardId: board.id, title: 'Race From', position: 'z7' },
      });
      const to = await prisma.column.create({
        data: { boardId: board.id, title: 'Race To', position: 'z8' },
      });
      const tasks = [];
      for (let i = 0; i < CONTENDERS; i++) {
        tasks.push(await seedTask(from.id, `Cross${i}`, `a${i}`));
      }

      const results = await Promise.all(
        tasks.map((t) =>
          request(app.getHttpServer())
            .patch(`/api/tasks/${t.id}/move`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ targetColumnId: to.id, newIndex: 0 }),
        ),
      );

      const moved = results.filter((r) => r.status === 200).length;
      for (const r of results) {
        expect([200, 409]).toContain(r.status);
      }

      const [fromRows, toRows] = await Promise.all([
        prisma.task.findMany({
          where: { columnId: from.id },
          orderBy: { position: 'asc' },
          select: { position: true },
        }),
        prisma.task.findMany({
          where: { columnId: to.id },
          orderBy: { position: 'asc' },
          select: { position: true },
        }),
      ]);

      // No task is lost or duplicated across the two columns.
      expect(fromRows.length + toRows.length).toBe(CONTENDERS);
      expect(toRows).toHaveLength(moved);
      for (const rows of [fromRows, toRows]) {
        expect(new Set(rows.map((r) => r.position)).size).toBe(rows.length);
        expect(rows.every((r, i) => i === 0 || rows[i - 1].position < r.position)).toBe(true);
      }
    }, 30_000);
  });
});
