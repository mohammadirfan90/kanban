import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GoogleService } from '../../src/auth/google.service';
import { NEST_APP_OPTIONS, configureApp } from '../../src/app-config';

/**
 * Google sign-in.
 *
 * Google itself is never contacted: `resolveUser` is stubbed with the profile
 * an exchange would have produced, so these tests cover the parts that are ours
 * and can be got wrong — the CSRF state check, which account a profile resolves
 * to, and what happens to password login once an account has no password.
 */
describe('Google sign-in (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let google: GoogleService;

  const stamp = Date.now();
  const localEmail = `g-local-${stamp}@example.com`;
  const freshEmail = `g-fresh-${stamp}@example.com`;
  const unverifiedEmail = `g-unverified-${stamp}@example.com`;
  const password = 'Password123!';

  const emails = [localEmail, freshEmail, unverifiedEmail];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleFixture.createNestApplication(NEST_APP_OPTIONS));
    await app.init();
    prisma = app.get(PrismaService);
    google = app.get(GoogleService);

    // A pre-existing password account, to test linking.
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: localEmail, password, name: 'Local Person' })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Pretend the code exchange returned this profile. */
  const stubGoogle = (profile: {
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
  }) => {
    const real = Object.getPrototypeOf(google) as GoogleService;
    jest
      .spyOn(google as unknown as { exchangeCode: (c: string) => Promise<unknown> }, 'exchangeCode')
      .mockResolvedValue(profile);
    return real;
  };

  describe('GET /api/auth/providers', () => {
    it('reports whether Google is configured', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/providers').expect(200);
      expect(typeof res.body.google).toBe('boolean');
    });
  });

  describe('the CSRF state check', () => {
    it('rejects a callback with no state at all', () => {
      expect(() => google.verifyState(undefined, undefined)).toThrow();
    });

    it('rejects a state that does not match the cookie', () => {
      expect(() => google.verifyState('aaaaaaaaaaaa', 'bbbbbbbbbbbb')).toThrow();
    });

    it('rejects a state of a different length', () => {
      expect(() => google.verifyState('short', 'considerably-longer')).toThrow();
    });

    it('accepts a matching pair', () => {
      const state = google.newState();
      expect(() => google.verifyState(state, state)).not.toThrow();
    });

    it('generates a long, unguessable state', () => {
      const a = google.newState();
      const b = google.newState();
      expect(a.length).toBeGreaterThanOrEqual(40);
      expect(a).not.toEqual(b);
    });
  });

  describe('resolving a Google profile to an account', () => {
    it('creates a new user with no password when nobody matches', async () => {
      stubGoogle({
        sub: `sub-fresh-${stamp}`,
        email: freshEmail,
        email_verified: true,
        name: 'Fresh Person',
      });

      const user = await google.resolveUser('any-code');
      expect(user.email).toBe(freshEmail);
      expect(user.name).toBe('Fresh Person');

      const row = await prisma.user.findUnique({ where: { email: freshEmail } });
      // The whole point of making passwordHash nullable.
      expect(row!.passwordHash).toBeNull();

      const identity = await prisma.authIdentity.findFirst({ where: { userId: row!.id } });
      expect(identity!.provider).toBe('google');
      expect(identity!.providerAccountId).toBe(`sub-fresh-${stamp}`);
    });

    it('returns the same user on a second sign-in, without creating another', async () => {
      stubGoogle({ sub: `sub-fresh-${stamp}`, email: freshEmail, email_verified: true });
      const again = await google.resolveUser('any-code');

      const count = await prisma.user.count({ where: { email: freshEmail } });
      expect(count).toBe(1);
      const identities = await prisma.authIdentity.count({
        where: { providerAccountId: `sub-fresh-${stamp}` },
      });
      expect(identities).toBe(1);
      expect(again.email).toBe(freshEmail);
    });

    it('matches on the Google sub, not the email, so a changed address still signs in', async () => {
      const before = await prisma.user.findUnique({ where: { email: freshEmail } });
      // Same Google account, different address on Google's side.
      stubGoogle({
        sub: `sub-fresh-${stamp}`,
        email: `changed-${stamp}@example.com`,
        email_verified: true,
      });

      const user = await google.resolveUser('any-code');
      expect(user.id).toBe(before!.id);
      // No second account was made for the new address.
      expect(await prisma.user.count({ where: { email: `changed-${stamp}@example.com` } })).toBe(0);
    });

    it('links to an existing password account when Google verified the address', async () => {
      const local = await prisma.user.findUnique({ where: { email: localEmail } });
      stubGoogle({ sub: `sub-local-${stamp}`, email: localEmail, email_verified: true });

      const user = await google.resolveUser('any-code');
      expect(user.id).toBe(local!.id);

      const identity = await prisma.authIdentity.findFirst({ where: { userId: local!.id } });
      expect(identity).not.toBeNull();
      // Linking must not disturb the password they already had.
      const after = await prisma.user.findUnique({ where: { email: localEmail } });
      expect(after!.passwordHash).not.toBeNull();
    });

    /*
      The account-takeover case. Without the email_verified check, anyone able
      to create a Google account asserting someone else's address could sign in
      as them and inherit every board they own.
    */
    it('refuses to link an UNVERIFIED Google address to an existing account', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: unverifiedEmail, password, name: 'Victim' })
        .expect(201);

      stubGoogle({ sub: `sub-attacker-${stamp}`, email: unverifiedEmail, email_verified: false });

      await expect(google.resolveUser('any-code')).rejects.toThrow();

      const identities = await prisma.authIdentity.count({
        where: { providerAccountId: `sub-attacker-${stamp}` },
      });
      expect(identities).toBe(0);
    });
  });

  describe('password login against a Google-only account', () => {
    it('is refused, with the same generic message as any bad password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: freshEmail, password: 'AnyPassword123!' })
        .expect(401);

      // Not "this account uses Google" — that would leak which addresses are
      // Google accounts, undoing the enumeration protection on this route.
      expect(res.body.message).toBe('Invalid credentials');
    });
  });
});
