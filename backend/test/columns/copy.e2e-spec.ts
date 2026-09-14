import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NEST_APP_OPTIONS, configureApp } from '../../src/app-config';
import { tokenFromResponse } from '../auth-cookie';

describe('Copy column + board background (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const ownerEmail = `cp-owner-${stamp}@example.com`;
  const viewerEmail = `cp-viewer-${stamp}@example.com`;
  const password = 'Password123!';

  let ownerToken: string;
  let viewerToken: string;
  let boardId: string;
  let sourceColumnId: string;
  let labelId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleFixture.createNestApplication(NEST_APP_OPTIONS));
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: ownerEmail, password, name: 'Copy Owner' })
      .expect(201);
    ownerToken = tokenFromResponse(owner);

    const viewer = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: viewerEmail, password, name: 'Copy Viewer' })
      .expect(201);
    viewerToken = tokenFromResponse(viewer);

    const board = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Copy Board' })
      .expect(201);
    boardId = board.body.id;
    sourceColumnId = board.body.columns[0].id;

    await request(app.getHttpServer())
      .post(`/api/boards/${boardId}/share`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: viewer.body.user.id, role: 'VIEWER' })
      .expect(201);

    const label = await request(app.getHttpServer())
      .post(`/api/boards/${boardId}/labels`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'copyme', color: 'sky' })
      .expect(201);
    labelId = label.body.id;

    for (const title of ['First card', 'Second card', 'Third card']) {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ columnId: sourceColumnId, title, priority: 'HIGH', labelIds: [labelId] })
        .expect(201);
    }
  });

  afterAll(async () => {
    await prisma.board.deleteMany({ where: { id: boardId } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  describe('POST /columns/:id/copy', () => {
    let copyId: string;

    it('duplicates the column and every card in order', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/columns/${sourceColumnId}/copy`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      copyId = res.body.id;
      expect(res.body.id).not.toBe(sourceColumnId);
      expect(res.body.title).toBe('To Do (copy)');
      expect(res.body.tasks.map((t: { title: string }) => t.title)).toEqual([
        'First card',
        'Second card',
        'Third card',
      ]);
    });

    it('gives every copied card a new id and its own board key', async () => {
      const board = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const source = board.body.columns.find((c: { id: string }) => c.id === sourceColumnId);
      const copy = board.body.columns.find((c: { id: string }) => c.id === copyId);

      const sourceIds = source.tasks.map((t: { id: string }) => t.id);
      const copyIds = copy.tasks.map((t: { id: string }) => t.id);
      expect(copyIds.some((id: string) => sourceIds.includes(id))).toBe(false);

      // Keys are unique per board, so a copy cannot reuse the original's.
      const keys = board.body.columns.flatMap((c: { tasks: { key: string }[] }) =>
        c.tasks.map((t) => t.key),
      );
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('carries labels across, and copies rather than shares the cards', async () => {
      const board = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const copy = board.body.columns.find((c: { id: string }) => c.id === copyId);
      expect(copy.tasks[0].labels[0].id).toBe(labelId);
      expect(copy.tasks[0].priority).toBe('HIGH');

      // Editing a copy must not touch the original.
      await request(app.getHttpServer())
        .patch(`/api/tasks/${copy.tasks[0].id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Renamed in the copy' })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const source = after.body.columns.find((c: { id: string }) => c.id === sourceColumnId);
      expect(source.tasks[0].title).toBe('First card');
    });

    it('refuses a VIEWER', async () => {
      await request(app.getHttpServer())
        .post(`/api/columns/${sourceColumnId}/copy`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('404s an unknown column', async () => {
      await request(app.getHttpServer())
        .post('/api/columns/11111111-1111-4111-8111-111111111111/copy')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  describe('board background', () => {
    it('defaults to null', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.background).toBeNull();
    });

    it('accepts a palette token', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ background: 'dusk' })
        .expect(200);
      expect(res.body.background).toBe('dusk');
    });

    it('clears back to the default surface with an empty string', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/boards/${boardId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ background: '' })
        .expect(200);
      expect(res.body.background).toBeNull();
    });

    // The value is rendered into a style attribute, so anything outside the
    // palette must be rejected at the edge rather than sanitised downstream.
    it('rejects anything that is not a palette token', async () => {
      for (const background of ['#ff0000', 'url(https://evil.example/x.png)', 'javascript:1']) {
        await request(app.getHttpServer())
          .patch(`/api/boards/${boardId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ background })
          .expect(400);
      }
    });

    it('can be set when the board is created', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Pretty Board', background: 'forest' })
        .expect(201);
      expect(res.body.background).toBe('forest');
      await prisma.board.delete({ where: { id: res.body.id } });
    });
  });
});
