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
  columns: Array<{ id: string; title: string; position: string }>;
}

describe('Columns (e2e)', () => {
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

  let ownersBoard: BoardFixture;
  let editorsBoard: BoardFixture;

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

    // Register fixtures via the public endpoint.
    for (const f of [owner, editor, viewer, stranger]) {
      f.email = `${f.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: f.email, password: f.password, name: f.name })
        .expect(201);
      f.token = tokenFromResponse(res);
      f.userId = res.body.user.id;
    }

    // Create three boards: one where owner is OWNER, one where editor is OWNER (and
    // viewer is shared as VIEWER), one where owner is just OWNER but we won't touch.
    const ownersBoardRes = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Owner Board' })
      .expect(201);
    ownersBoard = {
      id: ownersBoardRes.body.id,
      columns: ownersBoardRes.body.columns.map(
        (c: { id: string; title: string; position: string }) => ({
          id: c.id,
          title: c.title,
          position: c.position,
        }),
      ),
    };

    const editorsBoardRes = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Editor Board' })
      .expect(201);
    editorsBoard = {
      id: editorsBoardRes.body.id,
      columns: editorsBoardRes.body.columns.map(
        (c: { id: string; title: string; position: number }) => ({
          id: c.id,
          title: c.title,
          position: c.position,
        }),
      ),
    };

    // Share viewer onto editor's board as VIEWER.
    await request(app.getHttpServer())
      .post(`/api/boards/${editorsBoard.id}/share`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ userId: viewer.userId, role: 'VIEWER' })
      .expect(201);
  });

  afterAll(async () => {
    // Delete all boards first (cascades to columns + tasks), then users.
    const emails = [owner.email, editor.email, viewer.email, stranger.email];
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    const userIds = users.map((u) => u.id);
    await prisma.board.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /api/columns
  // ──────────────────────────────────────────────────────────────────────
  describe('POST /api/columns', () => {
    it('returns 201 + appends the new column after the existing ones', async () => {
      const maxBefore = ownersBoard.columns
        .map((c) => c.position)
        .reduce((a, b) => (a > b ? a : b));

      const res = await request(app.getHttpServer())
        .post('/api/columns')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ boardId: ownersBoard.id, title: 'Backlog' })
        .expect(201);

      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.boardId).toBe(ownersBoard.id);
      expect(res.body.title).toBe('Backlog');
      expect(res.body.position > maxBefore).toBe(true);
      expect(res.body.tasks).toEqual([]);

      // Track for cleanup in later tests.
      ownersBoard.columns.push({ id: res.body.id, title: 'Backlog', position: res.body.position });
    });

    it('returns 400 when the client tries to supply a position', async () => {
      // Ordering keys are opaque and server-generated. Accepting one from the
      // client would let a caller write a malformed key that breaks
      // lexicographic sorting for the whole board, and would bypass the
      // conflict-free placement path. Placement is expressed as intent via
      // PATCH /columns/reorder instead.
      await request(app.getHttpServer())
        .post('/api/columns')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ boardId: ownersBoard.id, title: 'Mid-prio', position: 1500 })
        .expect(400);
    });

    it('appends new columns after the existing ones', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/columns')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ boardId: ownersBoard.id, title: 'Mid-prio' })
        .expect(201);

      const all = await prisma.column.findMany({
        where: { boardId: ownersBoard.id },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      expect(all.at(-1)!.id).toBe(res.body.id);
      ownersBoard.columns.push({
        id: res.body.id,
        title: 'Mid-prio',
        position: res.body.position,
      });
    });

    it('returns 403 when caller is VIEWER on the board', async () => {
      await request(app.getHttpServer())
        .post('/api/columns')
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ boardId: editorsBoard.id, title: 'Sneaky' })
        .expect(403);
    });

    it('returns 403 when caller has no access to the boardId', async () => {
      await request(app.getHttpServer())
        .post('/api/columns')
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ boardId: ownersBoard.id, title: 'Trespass' })
        .expect(403);
    });

    it('returns 400 when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/columns')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ boardId: ownersBoard.id })
        .expect(400);
    });

    it('returns 400 when title is empty', async () => {
      await request(app.getHttpServer())
        .post('/api/columns')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ boardId: ownersBoard.id, title: '' })
        .expect(400);
    });

    it('returns 400 when boardId is not a UUID', async () => {
      await request(app.getHttpServer())
        .post('/api/columns')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ boardId: 'not-a-uuid', title: 'X' })
        .expect(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // PATCH /api/columns/:id
  // ──────────────────────────────────────────────────────────────────────
  describe('PATCH /api/columns/:id', () => {
    let patchTarget: { id: string; title: string };

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/columns')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ boardId: ownersBoard.id, title: 'To Rename' })
        .expect(201);
      patchTarget = { id: res.body.id, title: 'To Rename' };
    });

    it('returns 200 + updates title', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/columns/${patchTarget.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Renamed' })
        .expect(200);
      expect(res.body.title).toBe('Renamed');
      patchTarget.title = 'Renamed';
    });

    it('returns 400 when the client tries to patch a position', async () => {
      // Same reasoning as create: reordering goes through
      // PATCH /columns/reorder, which places by index and is retry-safe.
      await request(app.getHttpServer())
        .patch(`/api/columns/${patchTarget.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ position: 512 })
        .expect(400);
    });

    it('returns 403 when caller is VIEWER on the board', async () => {
      await request(app.getHttpServer())
        .patch(`/api/columns/${patchTarget.id}`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ title: 'Nope' })
        .expect(403);
    });

    it('returns 403 when caller has no access to the column', async () => {
      await request(app.getHttpServer())
        .patch(`/api/columns/${patchTarget.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ title: 'Nope' })
        .expect(403);
    });

    it('returns 404 when columnId does not exist', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .patch(`/api/columns/${fakeId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Ghost' })
        .expect(404);
    });

    it('returns 400 when title is empty', async () => {
      await request(app.getHttpServer())
        .patch(`/api/columns/${patchTarget.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: '' })
        .expect(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // DELETE /api/columns/:id
  // ──────────────────────────────────────────────────────────────────────
  describe('DELETE /api/columns/:id', () => {
    it('returns 204 + cascades to its tasks', async () => {
      // Create a fresh board so we can delete a column without violating the
      // "last column" rule on the shared boards.
      const boardRes = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'For Delete' })
        .expect(201);
      const boardId = boardRes.body.id;
      const colA = boardRes.body.columns[0];
      const colB = boardRes.body.columns[1];

      // Seed a task directly via Prisma so we can verify cascade without
      // depending on Spec 07's /api/tasks endpoints.
      const seeded = await prisma.task.create({
        data: {
          columnId: colB.id,
          boardId,
          number: 1,
          title: 'Doomed Task',
          position: 'a1',
        },
      });
      const taskId = seeded.id;

      // Delete colB → cascades to its task.
      await request(app.getHttpServer())
        .delete(`/api/columns/${colB.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      const after = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      const stillThere = after.body.columns.find((c: { id: string }) => c.id === colB.id);
      expect(stillThere).toBeUndefined();
      // Cascade: task should be gone from the DB.
      const taskAfter = await prisma.task.findUnique({ where: { id: taskId } });
      expect(taskAfter).toBeNull();
      // Reference colA to silence "declared but never used" if linter cares.
      expect(colA.id).toEqual(expect.any(String));
    });

    it('returns 400 when deleting the last column on a board', async () => {
      // Reduce owner's main board to a single column by deleting all but one.
      // We need a dedicated board so we don't nuke fixtures.
      const boardRes = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Last Column Board' })
        .expect(201);
      const cols: Array<{ id: string }> = boardRes.body.columns;
      // Delete all but the first column.
      for (let i = 1; i < cols.length; i++) {
        await request(app.getHttpServer())
          .delete(`/api/columns/${cols[i].id}`)
          .set('Authorization', `Bearer ${owner.token}`)
          .expect(204);
      }

      // Now try to delete the last remaining column.
      await request(app.getHttpServer())
        .delete(`/api/columns/${cols[0].id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(400);
    });

    it('returns 403 when caller is VIEWER on the board', async () => {
      // editor owns editorsBoard; viewer is shared as VIEWER; try to delete one of its columns.
      const targetColumnId = editorsBoard.columns[0].id;
      await request(app.getHttpServer())
        .delete(`/api/columns/${targetColumnId}`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .expect(403);
    });

    it('returns 403 when caller has no access to the column', async () => {
      const targetColumnId = ownersBoard.columns[0].id;
      await request(app.getHttpServer())
        .delete(`/api/columns/${targetColumnId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);
    });

    it('returns 404 when columnId does not exist', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/columns/${fakeId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // PUT /api/columns/reorder
  // ──────────────────────────────────────────────────────────────────────
  describe('PUT /api/columns/reorder', () => {
    let reorderBoard: BoardFixture;

    beforeAll(async () => {
      const boardRes = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'For Reorder' })
        .expect(201);
      reorderBoard = {
        id: boardRes.body.id,
        columns: boardRes.body.columns.map(
          (c: { id: string; title: string; position: number }) => ({
            id: c.id,
            title: c.title,
            position: c.position,
          }),
        ),
      };
    });

    it('returns 200 + persists the new order (reversed)', async () => {
      const reversed = [...reorderBoard.columns].reverse().map((c) => c.id);

      const res = await request(app.getHttpServer())
        .put('/api/columns/reorder')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ boardId: reorderBoard.id, columnIds: reversed })
        .expect(200);

      expect(res.body).toHaveLength(reversed.length);
      expect(res.body.map((c: { id: string }) => c.id)).toEqual(reversed);

      // Keys are opaque; what matters is that they ascend left-to-right, so
      // the response order and any client sort agree.
      const positions = res.body.map((c: { position: string }) => c.position);
      expect(new Set(positions).size).toBe(positions.length);
      expect(positions.every((p: string, i: number) => i === 0 || positions[i - 1] < p)).toBe(true);

      // Verify via GET /api/boards/:id that the new order is persisted.
      const boardRes = await request(app.getHttpServer())
        .get(`/api/boards/${reorderBoard.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(boardRes.body.columns.map((c: { id: string }) => c.id)).toEqual(reversed);

      reorderBoard.columns = res.body.map((c: { id: string; title: string; position: string }) => ({
        id: c.id,
        title: c.title,
        position: c.position,
      }));
    });

    it('returns 403 when caller is VIEWER on the board', async () => {
      await request(app.getHttpServer())
        .put('/api/columns/reorder')
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({
          boardId: reorderBoard.id,
          columnIds: reorderBoard.columns.map((c) => c.id),
        })
        .expect(403);
    });

    it('returns 400 when boardId is missing', async () => {
      await request(app.getHttpServer())
        .put('/api/columns/reorder')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ columnIds: reorderBoard.columns.map((c) => c.id) })
        .expect(400);
    });

    it('returns 400 when columnIds is empty', async () => {
      await request(app.getHttpServer())
        .put('/api/columns/reorder')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ boardId: reorderBoard.id, columnIds: [] })
        .expect(400);
    });

    it('returns 404 when a columnId belongs to a different board', async () => {
      // Mix one column from reorderBoard with one from ownersBoard.
      await request(app.getHttpServer())
        .put('/api/columns/reorder')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          boardId: reorderBoard.id,
          columnIds: [reorderBoard.columns[0].id, ownersBoard.columns[0].id],
        })
        .expect(404);
    });

    it('returns 404 when a columnId does not exist', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await request(app.getHttpServer())
        .put('/api/columns/reorder')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          boardId: reorderBoard.id,
          columnIds: [reorderBoard.columns[0].id, fakeId],
        })
        .expect(404);
    });

    it('returns 400 when columnIds is missing a column on the board (partial reorder)', async () => {
      await request(app.getHttpServer())
        .put('/api/columns/reorder')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          boardId: reorderBoard.id,
          columnIds: [reorderBoard.columns[0].id], // only one of three
        })
        .expect(400);
    });
  });
});
