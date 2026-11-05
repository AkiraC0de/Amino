import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createMemoryWorkoutRepository } from '../repositories/memory/workouts.js';
import { createWorkoutService } from '../services/workouts.js';
import { BENCH_PRESS_ID, FOREIGN_EXERCISE_ID, MISSING_ID, buildCatalog } from '../test/workoutFixtures.js';

const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const BASE = '/api/v1/workouts';
const range = '?from=2026-11-01&to=2026-11-30';
const body = { title: 'Run', scheduledFor: '2026-11-05', exercises: [] };
const UNKNOWN_UUID = '00000000-0000-4000-8000-0000000000ee';

/** A fresh app per test: the in-memory repository holds the workouts, so tests must not share one. */
function makeApp() {
  return createApp({ workouts: createWorkoutService(createMemoryWorkoutRepository(buildCatalog(USER, OTHER))) });
}

async function createWorkout(app: ReturnType<typeof makeApp>, payload: object = body) {
  const response = await request(app).post(BASE).send(payload);
  expect(response.status).toBe(201);
  return response.body as { id: string; completedAt: string | null; status: string; title: string };
}

describe('workout routes: validation', () => {
  it('GET without from is 400 VALIDATION_ERROR', async () => {
    const response = await request(makeApp()).get(`${BASE}?to=2026-11-05`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('a 63-day range is 400 VALIDATION_ERROR', async () => {
    const response = await request(makeApp()).get(`${BASE}?from=2026-01-01&to=2026-03-05`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('a malformed uuid on complete is 400 VALIDATION_ERROR', async () => {
    const response = await request(makeApp()).post(`${BASE}/not-a-uuid/complete`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('a malformed uuid on PATCH is 400 VALIDATION_ERROR', async () => {
    const response = await request(makeApp()).patch(`${BASE}/not-a-uuid`).send({ title: 'x' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('a PATCH with no fields is 400 VALIDATION_ERROR', async () => {
    const app = makeApp();
    const created = await createWorkout(app);
    const response = await request(app).patch(`${BASE}/${created.id}`).send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('workout routes: lifecycle', () => {
  it('creates, lists in range, completes idempotently, then deletes with 204', async () => {
    const app = makeApp();
    const created = await createWorkout(app);

    const listed = await request(app).get(`${BASE}${range}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const first = await request(app).post(`${BASE}/${created.id}/complete`);
    const second = await request(app).post(`${BASE}/${created.id}/complete`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.completedAt).toBe(first.body.completedAt);

    const deleted = await request(app).delete(`${BASE}/${created.id}`);
    expect(deleted.status).toBe(204);
    expect((await request(app).get(`${BASE}${range}`)).body).toHaveLength(0);
  });

  it('uncomplete returns the workout to scheduled', async () => {
    const app = makeApp();
    const created = await createWorkout(app);
    await request(app).post(`${BASE}/${created.id}/complete`);
    const reverted = await request(app).post(`${BASE}/${created.id}/uncomplete`);
    expect(reverted.status).toBe(200);
    expect(reverted.body.status).toBe('scheduled');
    expect(reverted.body.completedAt).toBeNull();
  });

  it('PATCH changes the title and returns the updated workout', async () => {
    const app = makeApp();
    const created = await createWorkout(app);
    const response = await request(app).patch(`${BASE}/${created.id}`).send({ title: 'Long run' });
    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Long run');
  });

  it('PATCH status on a completed workout is 409 WORKOUT_COMPLETED', async () => {
    const app = makeApp();
    const created = await createWorkout(app);
    await request(app).post(`${BASE}/${created.id}/complete`);
    const response = await request(app).patch(`${BASE}/${created.id}`).send({ status: 'skipped' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('WORKOUT_COMPLETED');
  });

  it('PATCH title only on a completed workout is allowed', async () => {
    const app = makeApp();
    const created = await createWorkout(app);
    await request(app).post(`${BASE}/${created.id}/complete`);
    const response = await request(app).patch(`${BASE}/${created.id}`).send({ title: 'Renamed' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
  });

  it('PATCH with an unknown exerciseId is 400 UNKNOWN_EXERCISE, not 500', async () => {
    const app = makeApp();
    const created = await createWorkout(app);
    const response = await request(app)
      .patch(`${BASE}/${created.id}`)
      .send({ exercises: [{ exerciseId: MISSING_ID }] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UNKNOWN_EXERCISE');
  });

  it('PATCH with another user custom exercise is rejected with 400 UNKNOWN_EXERCISE', async () => {
    const app = makeApp();
    const created = await createWorkout(app);
    const response = await request(app)
      .patch(`${BASE}/${created.id}`)
      .send({ exercises: [{ exerciseId: FOREIGN_EXERCISE_ID }] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UNKNOWN_EXERCISE');
  });

  it('create with a built-in exercise returns it fully populated', async () => {
    const app = makeApp();
    const created = await createWorkout(app, {
      ...body,
      exercises: [{ exerciseId: BENCH_PRESS_ID, sets: 3, reps: 8, weightKg: 60 }],
    });
    expect(created.status).toBe('scheduled');
    expect(created).toMatchObject({
      exercises: [
        {
          exercise: { id: BENCH_PRESS_ID, name: 'Bench press', muscles: [{ muscleId: 'chest', role: 'primary' }, { muscleId: 'triceps', role: 'secondary' }] },
          position: 0,
          sets: 3,
          reps: 8,
          weightKg: 60,
        },
      ],
    });
  });
});

describe('workout routes: not found', () => {
  it('complete on an unknown uuid is 404 WORKOUT_NOT_FOUND in the error envelope', async () => {
    const response = await request(makeApp()).post(`${BASE}/${UNKNOWN_UUID}/complete`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'WORKOUT_NOT_FOUND', message: 'Workout not found' } });
  });

  it('PATCH on an unknown uuid is 404 WORKOUT_NOT_FOUND', async () => {
    const response = await request(makeApp()).patch(`${BASE}/${UNKNOWN_UUID}`).send({ title: 'x' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('WORKOUT_NOT_FOUND');
  });
});
