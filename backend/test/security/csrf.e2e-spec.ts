import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NEST_APP_OPTIONS, configureApp } from '../../src/app-config';
import { tokenFromResponse } from '../auth-cookie';

/**
 * Regression cover for a real, exploited CSRF hole.
 *
 * The JWT lives in an httpOnly cookie, and in production that cookie is
 * SameSite=None because the frontend and the API are different registrable
 * domains — so the browser attaches it to cross-site requests. CORS does not
 * help: the origin callback returns `callback(null, false)`, which withholds
 * the response headers but still runs the handler.
 *
 * A cross-site HTML form can only send urlencoded, text/plain or
 * multipart, and none of the three preflight. Nest parses urlencoded by
 * default, so an auto-submitting hidden form could call
 * `POST /boards/:id/share` as the victim and grant the attacker EDITOR on a
 * private board. That was reproduced against the running stack before the fix.
 *
 * The fix is to parse `application/json` and nothing else: a form cannot
 * produce it, and any script that sets it triggers a preflight CORS rejects.
 * These tests fail if the urlencoded parser is ever re-enabled.
 */
describe('CSRF hardening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const victimEmail = `csrf-victim-${Date.now()}@example.com`;
  const attackerEmail = `csrf-attacker-${Date.now()}@example.com`;
  const password = 'Password123!';

  let victimToken: string;
  let victimCookie: string;
  let attackerId: string;
  let attackerToken: string;
  let boardId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleFixture.createNestApplication(NEST_APP_OPTIONS));
    await app.init();
    prisma = app.get(PrismaService);

    const victim = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: victimEmail, password, name: 'Victim' })
      .expect(201);
    victimToken = tokenFromResponse(victim);
    victimCookie = `kanban_token=${victimToken}`;

    const attacker = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: attackerEmail, password, name: 'Attacker' })
      .expect(201);
    attackerToken = tokenFromResponse(attacker);
    attackerId = attacker.body.user.id;

    const board = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Cookie', victimCookie)
      .send({ title: 'Victim private board' })
      .expect(201);
    boardId = board.body.id;
  });

  afterAll(async () => {
    await prisma.board.deleteMany({ where: { id: boardId } });
    await prisma.user.deleteMany({ where: { email: { in: [victimEmail, attackerEmail] } } });
    await app.close();
  });

  // The three content types a cross-site <form> can emit without a preflight.
  const formContentTypes = [
    'application/x-www-form-urlencoded',
    'text/plain',
    'multipart/form-data; boundary=----boundary',
  ];

  describe.each(formContentTypes)('a cross-site form sending %s', (contentType) => {
    it('cannot create a board as the authenticated victim', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/boards')
        .set('Cookie', victimCookie)
        .set('Origin', 'https://evil.example')
        .set('Content-Type', contentType)
        .send('title=csrf');

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('cannot grant the attacker access to the victim board', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/boards/${boardId}/share`)
        .set('Cookie', victimCookie)
        .set('Origin', 'https://evil.example')
        .set('Content-Type', contentType)
        .send(`userId=${attackerId}&role=EDITOR`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  it('leaves the attacker with no access after every attempt', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/boards')
      .set('Authorization', `Bearer ${attackerToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('still accepts the same request as application/json from the real client', async () => {
    await request(app.getHttpServer())
      .post(`/api/boards/${boardId}/share`)
      .set('Cookie', victimCookie)
      .send({ userId: attackerId, role: 'EDITOR' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/boards')
      .set('Authorization', `Bearer ${attackerToken}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
  });
});
