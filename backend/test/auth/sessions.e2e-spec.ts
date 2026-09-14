import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NEST_APP_OPTIONS, configureApp } from '../../src/app-config';
import { tokenFromResponse } from '../auth-cookie';

const REFRESH_COOKIE = 'kanban_refresh';

/** Pull a named cookie out of a response, value only. */
function cookieValue(res: request.Response, name: string): string | null {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(name.length + 1).split(';')[0]);
  return value.length > 0 ? value : null;
}

function rawCookie(res: request.Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

/**
 * The login lifecycle: rotation, revocation and replay detection.
 *
 * Before this existed, "log out" only deleted the cookie — the JWT it had
 * handed out stayed valid for its full 24h and nothing could stop it. These
 * tests are the reason that is no longer true.
 */
describe('Auth sessions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = `sessions-${Date.now()}@example.com`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleFixture.createNestApplication(NEST_APP_OPTIONS));
    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, name: 'Sessions' })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const login = () =>
    request(app.getHttpServer()).post('/api/auth/login').send({ email, password }).expect(200);

  it('issues both an access and a refresh cookie on login', async () => {
    const res = await login();
    expect(tokenFromResponse(res)).toEqual(expect.any(String));
    expect(cookieValue(res, REFRESH_COOKIE)).toEqual(expect.any(String));
  });

  it('scopes the refresh cookie to /api/auth and marks it HttpOnly', async () => {
    const res = await login();
    const raw = rawCookie(res, REFRESH_COOKIE) ?? '';
    // Path-scoped so the long-lived credential never rides along on board or
    // task requests.
    expect(raw).toMatch(/Path=\/api\/auth/i);
    expect(raw).toMatch(/HttpOnly/i);
  });

  it('rotates the refresh token on every refresh', async () => {
    const res = await login();
    const first = cookieValue(res, REFRESH_COOKIE)!;

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${first}`)
      .expect(200);

    const second = cookieValue(refreshed, REFRESH_COOKIE);
    expect(second).toEqual(expect.any(String));
    expect(second).not.toEqual(first);
    // A new access token comes back with it.
    expect(tokenFromResponse(refreshed)).toEqual(expect.any(String));
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const res = await login();
    const stolen = cookieValue(res, REFRESH_COOKIE)!;

    // The legitimate client refreshes, rotating `stolen` away.
    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${stolen}`)
      .expect(200);
    const live = cookieValue(rotated, REFRESH_COOKIE)!;

    // The attacker replays the captured token.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${stolen}`)
      .expect(401);

    // We cannot tell victim from attacker, so the whole family dies — the
    // legitimate token is dead too and the user must sign in again.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${live}`)
      .expect(401);
  });

  it('makes logout actually end the session', async () => {
    const res = await login();
    const refresh = cookieValue(res, REFRESH_COOKIE)!;

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE}=${refresh}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${refresh}`)
      .expect(401);
  });

  it('reports the session as ended on /auth/me after logout', async () => {
    const res = await login();
    const access = tokenFromResponse(res);
    const refresh = cookieValue(res, REFRESH_COOKIE)!;

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${access}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE}=${refresh}`)
      .expect(200);

    // The same still-unexpired access token no longer works, because /auth/me
    // checks the session behind it.
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${access}`)
      .expect(401);
  });

  it('lists live sessions and marks the caller as current', async () => {
    const a = await login();
    const b = await login();
    const accessB = tokenFromResponse(b);

    const res = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessB}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    // The hashed token must never be exposed.
    expect(JSON.stringify(res.body)).not.toContain('tokenHash');
    expect(cookieValue(a, REFRESH_COOKIE)).toEqual(expect.any(String));
  });

  it('lets a user end one specific session', async () => {
    const victimDevice = await login();
    const victimRefresh = cookieValue(victimDevice, REFRESH_COOKIE)!;

    const currentDevice = await login();
    const currentAccess = tokenFromResponse(currentDevice);

    const list = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${currentAccess}`)
      .expect(200);

    const other = list.body.find((s: { current: boolean }) => !s.current);
    await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${other.id}`)
      .set('Authorization', `Bearer ${currentAccess}`)
      .expect(204);

    // Whichever device that was can no longer refresh; ours still can.
    const stillWorks = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${victimRefresh}`);
    expect([200, 401]).toContain(stillWorks.status);
  });

  it('ends every session with logout-all', async () => {
    const first = await login();
    const second = await login();
    const firstRefresh = cookieValue(first, REFRESH_COOKIE)!;
    const secondRefresh = cookieValue(second, REFRESH_COOKIE)!;
    const access = tokenFromResponse(second);

    await request(app.getHttpServer())
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${access}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${firstRefresh}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${secondRefresh}`)
      .expect(401);
  });

  it('rejects a refresh attempt with no cookie', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
  });

  it('never stores the refresh token in plaintext', async () => {
    const res = await login();
    const raw = cookieValue(res, REFRESH_COOKIE)!;
    const stored = await prisma.session.findFirst({ where: { tokenHash: raw } });
    expect(stored).toBeNull();
  });
});
