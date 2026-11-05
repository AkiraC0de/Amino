import { describe, expect, it } from 'vitest';
import { AppError } from '../http/errors.js';
import { createMemoryWorkoutRepository } from '../repositories/memory/workouts.js';
import { createWorkoutService } from './workouts.js';

const input = { title: 'Leg day', scheduledFor: '2026-11-05', exercises: [] };
const clock = () => new Date('2026-11-05T10:00:00.000Z');

describe('workouts service', () => {
  it('creates zero-exercise workout and completes idempotently', async () => {
    const service = createWorkoutService(createMemoryWorkoutRepository(), clock);
    const created = await service.create('user-a', input);
    const first = await service.complete('user-a', created.id);
    const second = await service.complete('user-a', created.id);
    expect(first.status).toBe('completed');
    expect(second.completedAt).toBe(first.completedAt);
  });
  it('uncompletes then completes with new clock time', async () => {
    let now = new Date('2026-11-05T10:00:00.000Z');
    const service = createWorkoutService(createMemoryWorkoutRepository(), () => now);
    const created = await service.create('user-a', input);
    await service.complete('user-a', created.id);
    await service.uncomplete('user-a', created.id);
    now = new Date('2026-11-05T11:00:00.000Z');
    expect((await service.complete('user-a', created.id)).completedAt).toBe(now.toISOString());
  });
  it('scopes missing and other-user workouts', async () => {
    const repo = createMemoryWorkoutRepository();
    const service = createWorkoutService(repo, clock);
    const created = await service.create('user-a', input);
    for (const action of [() => service.get('user-b', created.id), () => service.complete('user-b', created.id), () => service.update('user-b', created.id, { title: 'x' }), () => service.remove('user-b', created.id)]) {
      await expect(action()).rejects.toMatchObject({ status: 404, code: 'WORKOUT_NOT_FOUND' });
    }
  });
  it('rejects exercise or status changes on completed workout', async () => {
    const service = createWorkoutService(createMemoryWorkoutRepository(), clock);
    const created = await service.create('user-a', input);
    await service.complete('user-a', created.id);
    await expect(service.update('user-a', created.id, { status: 'skipped' })).rejects.toMatchObject({ status: 409, code: 'WORKOUT_COMPLETED' });
  });
});
