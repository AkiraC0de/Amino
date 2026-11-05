import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createShutdown, isMainModule } from './server.js';

it.skipIf(process.platform !== 'win32')('recognizes Windows main module paths', () => {
  expect(isMainModule('file:///C:/Users/x/server.ts', 'C:\\Users\\x\\server.ts')).toBe(true);
});

it('recognizes POSIX and mismatch main module paths', () => {
  expect(isMainModule('file:///home/x/server.ts', '/home/x/server.ts')).toBe(true);
  expect(isMainModule('file:///home/x/other.ts', '/home/x/server.ts')).toBe(false);
  expect(isMainModule('file:///home/x/server.ts', undefined)).toBe(false);
});
import { validate } from './http/validate.js';

const fakeDatabaseUrl = 'postgresql://user:pass@localhost:5432/test';
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
      router.get('/api/v1/throws', () => { throw new Error('secret failure'); });
    });
    const response = await request(throwingApp).get('/api/v1/throws');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: 'INTERNAL', message: 'Internal server error' } });
    expect(JSON.stringify(response.body)).not.toContain('secret failure');
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('does not write a second response after headers are sent', async () => {
    const writingApp = createApp({}, (router) => {
      router.get('/api/v1/write-then-throw', (_req, res) => {
        res.status(200).end();
        throw new Error('after write');
      });
    });
    await expect(request(writingApp).get('/api/v1/write-then-throw')).resolves.toMatchObject({ status: 200 });
  });

  it('validates query and exposes parsed values to the handler', async () => {
    const queryApp = createApp({}, (router) => {
      router.get('/api/v1/query', validate(z.object({ count: z.coerce.number().int() }), 'query'), (req, res) => {
        res.json({ count: res.locals.validated.query.count });
      });
    });
    const good = await request(queryApp).get('/api/v1/query?count=4');
    expect(good.status).toBe(200);
    expect(good.body).toEqual({ count: 4 });
    const bad = await request(queryApp).get('/api/v1/query?count=nope');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns body parser error envelopes', async () => {
    const malformed = await request(app).post('/api/v1/health').set('content-type', 'application/json').send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('INVALID_JSON');
    const oversized = await request(app).post('/api/v1/health').set('content-type', 'application/json').send(JSON.stringify({ data: 'x'.repeat(100 * 1024 + 1) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('validates PORT range', () => {
    for (const port of ['abc', '0', '70000', '-1']) {
      expect(() => loadConfig({ DATABASE_URL: fakeDatabaseUrl, PORT: port })).toThrow('Invalid PORT');
    }
    expect(loadConfig({ DATABASE_URL: fakeDatabaseUrl, PORT: '8080' }).port).toBe(8080);
  });

  it('requires DATABASE_URL and strips channel_binding from config URLs', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    const config = loadConfig({ DATABASE_URL: `${fakeDatabaseUrl}?sslmode=require&channel_binding=require`, PORT: '3010', NODE_ENV: 'test' });
    expect(config).toEqual({ port: 3010, databaseUrl: `${fakeDatabaseUrl}?sslmode=require`, nodeEnv: 'test' });
  });

  it('guards shutdown and clears forced exit after clean close', () => {
    vi.useFakeTimers();
    const close = vi.fn((callback: (error?: Error) => void) => callback());
    const closeIdleConnections = vi.fn();
    const exit = vi.fn();
    const shutdown = createShutdown({ close, closeIdleConnections }, exit);
    shutdown();
    shutdown();
    expect(close).toHaveBeenCalledTimes(1);
    expect(closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    vi.advanceTimersByTime(10000);
    expect(exit).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
