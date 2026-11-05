import { describe, expect, it, vi } from 'vitest';
import { closeServerAndDatabase } from './server.js';

function fakeServer(serverError?: Error) {
  return { close: vi.fn((callback: (error?: Error) => void) => callback(serverError)) };
}

describe('closeServerAndDatabase', () => {
  it('reports success after the server and database both close', async () => {
    const onDone = vi.fn();
    const database = { close: vi.fn(() => Promise.resolve()) };
    closeServerAndDatabase(fakeServer(), database, onDone);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(database.close).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(undefined);
  });

  it('still calls back when the database close rejects', async () => {
    const onDone = vi.fn();
    const database = { close: vi.fn(() => Promise.reject(new Error('pool closed twice'))) };
    closeServerAndDatabase(fakeServer(), database, onDone);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onDone.mock.calls[0][0].message).toBe('pool closed twice');
  });

  it('keeps the server error when both the server and database fail', async () => {
    const onDone = vi.fn();
    const database = { close: vi.fn(() => Promise.reject(new Error('db'))) };
    closeServerAndDatabase(fakeServer(new Error('server')), database, onDone);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone.mock.calls[0][0].message).toBe('server');
  });
});
