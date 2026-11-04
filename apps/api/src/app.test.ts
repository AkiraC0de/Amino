import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const app = createApp({});

describe('API foundation', () => {
  it('returns health status under the v1 API prefix', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns a not found error envelope for unknown paths', async () => {
    const response = await request(app).get('/api/v1/unknown');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('Not found');
  });

  it('hides original errors and stacks in the internal error envelope', async () => {
    const throwingApp = createApp({}, (router) => {
      router.get('/api/v1/throws', () => {
        throw new Error('secret failure');
      });
    });

    const response = await request(throwingApp).get('/api/v1/throws');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
    expect(JSON.stringify(response.body)).not.toContain('secret failure');
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('requires DATABASE_URL and strips channel_binding from config URLs', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);

    const config = loadConfig({
      DATABASE_URL:
        'postgresql://user:pass@localhost:5432/test?sslmode=require&channel_binding=require',
      PORT: '3010',
      NODE_ENV: 'test',
    });

    expect(config).toEqual({
      port: 3010,
      databaseUrl: 'postgresql://user:pass@localhost:5432/test?sslmode=require',
      nodeEnv: 'test',
    });
  });
});
