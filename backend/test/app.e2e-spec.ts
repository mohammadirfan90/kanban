import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { NEST_APP_OPTIONS, configureApp } from '../src/app-config';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(moduleFixture.createNestApplication(NEST_APP_OPTIONS));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns ok', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: { body: { status: string; timestamp: string } }) => {
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.timestamp).toBe('string');
      });
  });

  it('GET /api/unknown returns 404 in error format', () => {
    return request(app.getHttpServer())
      .get('/api/this-route-does-not-exist')
      .expect(404)
      .expect((res: { body: { statusCode: number; error: string } }) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 404,
            error: expect.any(String),
          }),
        );
      });
  });
});
