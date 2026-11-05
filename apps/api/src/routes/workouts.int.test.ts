import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createApp } from '../app.js';
import { DEFAULT_USER_ID } from '../constants.js';
import { createDb, type DatabaseClient } from '../db/client.js';
import { exercises, users } from '../db/schema.js';
import { createDrizzleWorkoutRepository } from '../repositories/workouts.drizzle.js';
import { createWorkoutService } from '../services/workouts.js';

/**
 * Runs only against TEST_DATABASE_URL (a Neon test branch). Skipped when it is unset.
 * The suite truncates the workout tables, so it must never point at the real database.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const BASE = '/api/v1/workouts';
const BENCH_ID = '00000000-0000-4000-8000-0000000000b1';
const UNKNOWN_UUID = '00000000-0000-4000-8000-0000000000ee';

if (TEST_DATABASE_URL && TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL: the integration suite truncates tables');
}

describe.skipIf(!TEST_DATABASE_URL)('workout routes against Postgres', () => {
  let client: DatabaseClient;

  beforeAll(async () => {
    client = createDb(TEST_DATABASE_URL as string, { max: 2 });
    await client.db.insert(users).values({ id: DEFAULT_USER_ID }).onConflictDoNothing({ target: users.id });
    await client.db
      .insert(exercises)
      .values({ id: BENCH_ID, userId: null, name: 'Bench press', slug: 'int-test-bench-press' })
      .onConflictDoNothing({ target: exercises.id });
  });

  beforeEach(async () => {
    await client.db.execute(sql`truncate table workout_exercises, workouts cascade`);
  });

  afterAll(async () => {
    await client.close();
  });

  function app() {
    return createApp({ workouts: createWorkoutService(createDrizzleWorkoutRepository(client.db)) });
  }

  async function createWorkout(payload: object = { title: 'Push', scheduledFor: '2026-11-05', exercises: [] }) {
    const response = await request(app()).post(BASE).send(payload);
    expect(response.status).toBe(201);
    return response.body as { id: string; completedAt: string | null };
  }

  it('creates a workout with an exercise and returns it populated', async () => {
    const created = await createWorkout({
      title: 'Push',
      scheduledFor: '2026-11-05',
      exercises: [{ exerciseId: BENCH_ID, sets: 3, reps: 5, weightKg: 80 }],
    });
    expect(created).toMatchObject({
      title: 'Push',
      scheduledFor: '2026-11-05',
      status: 'scheduled',
      completedAt: null,
      exercises: [{ exercise: { id: BENCH_ID, name: 'Bench press' }, position: 0, sets: 3, reps: 5, weightKg: 80 }],
    });
  });

  it('lists workouts in range and excludes those outside it', async () => {
    await createWorkout({ title: 'In', scheduledFor: '2026-11-05', exercises: [] });
    await createWorkout({ title: 'Out', scheduledFor: '2026-12-20', exercises: [] });
    const response = await request(app()).get(`${BASE}?from=2026-11-01&to=2026-11-30`);
    expect(response.status).toBe(200);
    expect(response.body.map((workout: { title: string }) => workout.title)).toEqual(['In']);
  });

  it('a list without from returns 400', async () => {
    const response = await request(app()).get(`${BASE}?to=2026-11-30`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('a 63-day range returns 400', async () => {
    const response = await request(app()).get(`${BASE}?from=2026-01-01&to=2026-03-05`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH changes the title and returns the patched state', async () => {
    const created = await createWorkout();
    const response = await request(app()).patch(`${BASE}/${created.id}`).send({ title: 'Pull', status: 'skipped' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ title: 'Pull', status: 'skipped' });
  });

  it('DELETE returns 204 and the workout is gone', async () => {
    const created = await createWorkout();
    const deleted = await request(app()).delete(`${BASE}/${created.id}`);
    expect(deleted.status).toBe(204);
    expect((await request(app()).get(`${BASE}?from=2026-11-01&to=2026-11-30`)).body).toHaveLength(0);
  });

  it('complete twice returns 200 both times with an equal completedAt', async () => {
    const created = await createWorkout();
    const first = await request(app()).post(`${BASE}/${created.id}/complete`);
    const second = await request(app()).post(`${BASE}/${created.id}/complete`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.completedAt).toBe(first.body.completedAt);
  });

  it('a malformed uuid returns 400 VALIDATION_ERROR', async () => {
    const response = await request(app()).post(`${BASE}/not-a-uuid/complete`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('a random valid uuid returns 404 WORKOUT_NOT_FOUND in the envelope', async () => {
    const response = await request(app()).post(`${BASE}/${UNKNOWN_UUID}/complete`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('WORKOUT_NOT_FOUND');
  });
});
