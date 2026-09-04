import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Test User';

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
  });

  afterAll(async () => {
    // Cleanup test user
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('returns 201 + access_token + user for valid body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword, name: testName })
        .expect(201);

      expect(res.body.access_token).toEqual(expect.any(String));
      expect(res.body.user).toEqual({
        id: expect.any(String),
        email: testEmail,
        name: testName,
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();
    });

    it('hashes the password with bcrypt (not plaintext)', async () => {
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      expect(user).not.toBeNull();
      expect(user!.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(user!.passwordHash).not.toContain(testPassword);
      expect(await bcrypt.compare(testPassword, user!.passwordHash)).toBe(true);
    });

    it('returns 409 for duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword, name: testName })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
    });

    it('returns 400 for missing email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ password: testPassword, name: testName })
        .expect(400);
    });

    it('returns 400 for password shorter than 8 chars', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'short-pw@example.com', password: 'short', name: testName })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 + access_token + user for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(res.body.access_token).toEqual(expect.any(String));
      expect(res.body.user.email).toBe(testEmail);
    });

    it('returns 401 "Invalid credentials" for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'WrongPassword!' })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
    });

    it('returns 401 "Invalid credentials" for non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'noone@example.com', password: testPassword })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });
      token = res.body.access_token;
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('returns the user (without passwordHash) with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.email).toBe(testEmail);
      expect(res.body.name).toBe(testName);
      expect(res.body.passwordHash).toBeUndefined();
    });
  });
});
