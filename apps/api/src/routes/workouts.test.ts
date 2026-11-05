import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createMemoryWorkoutRepository } from '../repositories/memory/workouts.js';
import { createWorkoutService } from '../services/workouts.js';

function app() { return createApp({ workouts: createWorkoutService(createMemoryWorkoutRepository()) }); }
const body = { title: 'Run', scheduledFor: '2026-11-05', exercises: [] };
describe('workout routes', () => {
  it('validates range and ids', async () => { expect((await request(app()).get('/api/v1/workouts?to=2026-11-05')).status).toBe(400); expect((await request(app()).get('/api/v1/workouts?from=2026-01-01&to=2026-03-05')).status).toBe(400); expect((await request(app()).post('/api/v1/workouts/not-a-uuid/complete')).status).toBe(400); });
  it('creates, lists, completes idempotently, then removes', async () => { const a = app(); const created = await request(a).post('/api/v1/workouts').send(body); expect(created.status).toBe(201); expect((await request(a).get('/api/v1/workouts?from=2026-11-01&to=2026-11-30')).body).toHaveLength(1); const first = await request(a).post(`/api/v1/workouts/${created.body.id}/complete`); const second = await request(a).post(`/api/v1/workouts/${created.body.id}/complete`); expect(first.status).toBe(200); expect(second.body.completedAt).toBe(first.body.completedAt); expect((await request(a).delete(`/api/v1/workouts/${created.body.id}`)).status).toBe(204); expect((await request(a).get(`/api/v1/workouts?from=2026-11-01&to=2026-11-30`)).body).toHaveLength(0); });
  it('returns envelope for unknown uuid', async () => { const response = await request(app()).get('/api/v1/workouts/00000000-0000-0000-0000-000000000000'); expect(response.status).toBe(404); expect(response.body.error.code).toBe('NOT_FOUND'); });
});
