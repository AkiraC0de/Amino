import { describe, expect, it } from 'vitest';
import { AppError } from '../http/errors.js';
import { createMemoryWorkoutRepository } from '../repositories/memory/workouts.js';
import { BENCH_PRESS_ID, FOREIGN_EXERCISE_ID, MISSING_ID, OWN_EXERCISE_ID, buildCatalog } from '../test/workoutFixtures.js';
import { createWorkoutService } from './workouts.js';

const OWNER = 'user-a';
const OTHER = 'user-b';
const CLOCK_TIME = '2026-11-05T10:00:00.000Z';
const fixedClock = () => new Date(CLOCK_TIME);
const input = { title: 'Leg day', scheduledFor: '2026-11-05', exercises: [] };

function setup(clock: () => Date = fixedClock) {
  const repo = createMemoryWorkoutRepository(buildCatalog(OWNER, OTHER));
  return { repo, service: createWorkoutService(repo, clock) };
}

async function expectRejection(promise: Promise<unknown>, status: number, code: string): Promise<void> {
  const error = await promise.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ status, code });
}

describe('workouts service: completion', () => {
  it('complete sets status completed and completedAt to the clock time', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    const completed = await service.complete(OWNER, created.id);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe(CLOCK_TIME);
  });

  it('completing twice keeps the first completedAt', async () => {
    let now = new Date(CLOCK_TIME);
    const { service } = setup(() => now);
    const created = await service.create(OWNER, input);
    const first = await service.complete(OWNER, created.id);
    now = new Date('2026-11-05T12:00:00.000Z');
    const second = await service.complete(OWNER, created.id);
    expect(second.completedAt).toBe(first.completedAt);
  });

  it('two concurrent completes keep the first completedAt', async () => {
    let tick = 0;
    const times = ['2026-11-05T10:00:00.000Z', '2026-11-05T10:00:01.000Z'];
    const { service } = setup(() => new Date(times[Math.min(tick++, times.length - 1)]));
    const created = await service.create(OWNER, input);
    const [a, b] = await Promise.all([service.complete(OWNER, created.id), service.complete(OWNER, created.id)]);
    const stored = await service.get(OWNER, created.id);
    expect(a.completedAt).toBe(stored.completedAt);
    expect(b.completedAt).toBe(stored.completedAt);
    expect(stored.completedAt).toBe(times[0]);
  });

  it('uncomplete returns a completed workout to scheduled with completedAt null', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    await service.complete(OWNER, created.id);
    const reverted = await service.uncomplete(OWNER, created.id);
    expect(reverted.status).toBe('scheduled');
    expect(reverted.completedAt).toBeNull();
  });

  it('uncomplete on a scheduled workout returns it unchanged', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    const result = await service.uncomplete(OWNER, created.id);
    expect(result).toEqual(created);
  });

  it('uncomplete on a skipped workout leaves it skipped', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    const skipped = await service.update(OWNER, created.id, { status: 'skipped' });
    const result = await service.uncomplete(OWNER, created.id);
    expect(result.status).toBe('skipped');
    expect(result).toEqual(skipped);
  });

  it('complete on a skipped workout sets completed and completedAt', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    await service.update(OWNER, created.id, { status: 'skipped' });
    const completed = await service.complete(OWNER, created.id);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe(CLOCK_TIME);
  });

  it('uncomplete then complete sets a new completedAt', async () => {
    let now = new Date(CLOCK_TIME);
    const { service } = setup(() => now);
    const created = await service.create(OWNER, input);
    await service.complete(OWNER, created.id);
    await service.uncomplete(OWNER, created.id);
    now = new Date('2026-11-05T11:00:00.000Z');
    expect((await service.complete(OWNER, created.id)).completedAt).toBe(now.toISOString());
  });
});

describe('workouts service: not found and ownership', () => {
  it('get and complete on an unknown id throw 404 WORKOUT_NOT_FOUND', async () => {
    const { service } = setup();
    await expectRejection(service.get(OWNER, MISSING_ID), 404, 'WORKOUT_NOT_FOUND');
    await expectRejection(service.complete(OWNER, MISSING_ID), 404, 'WORKOUT_NOT_FOUND');
  });

  it('another user gets 404 for get, complete, update and remove', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    await expectRejection(service.get(OTHER, created.id), 404, 'WORKOUT_NOT_FOUND');
    await expectRejection(service.complete(OTHER, created.id), 404, 'WORKOUT_NOT_FOUND');
    await expectRejection(service.update(OTHER, created.id, { title: 'x' }), 404, 'WORKOUT_NOT_FOUND');
    await expectRejection(service.remove(OTHER, created.id), 404, 'WORKOUT_NOT_FOUND');
  });
});

describe('workouts service: update rules', () => {
  it('update with exercises on a completed workout throws 409 WORKOUT_COMPLETED', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    await service.complete(OWNER, created.id);
    await expectRejection(
      service.update(OWNER, created.id, { exercises: [{ exerciseId: BENCH_PRESS_ID }] }),
      409,
      'WORKOUT_COMPLETED',
    );
  });

  it('PATCH status on a completed workout throws 409 WORKOUT_COMPLETED', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    await service.complete(OWNER, created.id);
    await expectRejection(service.update(OWNER, created.id, { status: 'skipped' }), 409, 'WORKOUT_COMPLETED');
  });

  it('PATCH title only on a completed workout is allowed', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    await service.complete(OWNER, created.id);
    const updated = await service.update(OWNER, created.id, { title: 'Renamed' });
    expect(updated.title).toBe('Renamed');
    expect(updated.status).toBe('completed');
  });
});

describe('workouts service: exercises', () => {
  it('create with zero exercises succeeds', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    expect(created.exercises).toEqual([]);
  });

  it('create with an unknown exerciseId throws 400 UNKNOWN_EXERCISE', async () => {
    const { service } = setup();
    await expectRejection(
      service.create(OWNER, { ...input, exercises: [{ exerciseId: MISSING_ID }] }),
      400,
      'UNKNOWN_EXERCISE',
    );
  });

  it('create with another user custom exercise throws 400 UNKNOWN_EXERCISE', async () => {
    const { service } = setup();
    await expectRejection(
      service.create(OWNER, { ...input, exercises: [{ exerciseId: FOREIGN_EXERCISE_ID }] }),
      400,
      'UNKNOWN_EXERCISE',
    );
  });

  it('create accepts built-in and own custom exercises', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, {
      ...input,
      exercises: [{ exerciseId: BENCH_PRESS_ID, sets: 3 }, { exerciseId: OWN_EXERCISE_ID }],
    });
    expect(created.exercises.map((entry) => entry.exercise.id)).toEqual([BENCH_PRESS_ID, OWN_EXERCISE_ID]);
  });

  it('update with an unknown exerciseId throws 400 UNKNOWN_EXERCISE and leaves the workout unchanged', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, { ...input, exercises: [{ exerciseId: BENCH_PRESS_ID }] });
    await expectRejection(
      service.update(OWNER, created.id, { exercises: [{ exerciseId: MISSING_ID }] }),
      400,
      'UNKNOWN_EXERCISE',
    );
    expect(await service.get(OWNER, created.id)).toEqual(created);
  });

  it('update with another user custom exercise throws 400 UNKNOWN_EXERCISE', async () => {
    const { service } = setup();
    const created = await service.create(OWNER, input);
    await expectRejection(
      service.update(OWNER, created.id, { exercises: [{ exerciseId: FOREIGN_EXERCISE_ID }] }),
      400,
      'UNKNOWN_EXERCISE',
    );
  });
});
