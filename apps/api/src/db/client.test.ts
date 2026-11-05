import { describe, expect, it, vi } from 'vitest';
import { logger } from '../logger.js';
import { createDb } from './client.js';

describe('database pool', () => {
  it('applies pool defaults and handles idle errors without leaking URLs', async () => {
    const { db, pool, close } = createDb('postgresql://user:pass@localhost:5432/test');
    const poolConfig = (pool as unknown as { options: Record<string, unknown> }).options;
    expect(poolConfig.max).toBe(10);
    expect(poolConfig.idleTimeoutMillis).toBe(30_000);
    expect(poolConfig.connectionTimeoutMillis).toBe(10_000);
    expect(pool.listenerCount('error')).toBeGreaterThan(0);

    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);
    expect(() => pool.emit('error', Object.assign(new Error('postgresql://user:pass@localhost'), { code: 'EPIPE' }))).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith({ code: 'EPIPE' }, 'Unexpected idle database client error');
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('postgresql://user:pass@localhost');
    errorSpy.mockRestore();
    void db;
    await close();
  });

  it('allows pool options to be overridden', async () => {
    const { pool, close } = createDb('postgresql://user:pass@localhost:5432/test', {
      max: 2,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 3_000,
    });
    const poolConfig = (pool as unknown as { options: Record<string, unknown> }).options;
    expect(poolConfig.max).toBe(2);
    expect(poolConfig.idleTimeoutMillis).toBe(5_000);
    expect(poolConfig.connectionTimeoutMillis).toBe(3_000);
    await close();
  });
});
