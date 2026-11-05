import type { WorkoutDto } from '@amino/shared';
import type { CreateWorkoutInput, UpdateWorkoutInput, WorkoutRepository } from '../types.js';
import { randomUUID } from 'node:crypto';

export function createMemoryWorkoutRepository(): WorkoutRepository {
  const rows = new Map<string, { userId: string; dto: WorkoutDto }>();
  return {
    async list(userId, from, to) { return [...rows.values()].filter((r) => r.userId === userId && r.dto.scheduledFor >= from && r.dto.scheduledFor <= to).map((r) => r.dto); },
    async get(userId, id) { const r = rows.get(id); return r?.userId === userId ? r.dto : null; },
    async create(userId, input: CreateWorkoutInput) {
      const dto: WorkoutDto = { id: randomUUID(), title: input.title, scheduledFor: input.scheduledFor, status: 'scheduled', completedAt: null, exercises: input.exercises.map((e, i) => ({ exercise: { id: e.exerciseId, name: '', slug: '', muscles: [] }, position: i, sets: e.sets ?? null, reps: e.reps ?? null, weightKg: e.weightKg ?? null })) };
      rows.set(dto.id, { userId, dto }); return dto;
    },
    async update(userId, id, patch: UpdateWorkoutInput) { const r = rows.get(id); if (!r || r.userId !== userId) return null; Object.assign(r.dto, patch.title === undefined ? {} : { title: patch.title }, patch.scheduledFor === undefined ? {} : { scheduledFor: patch.scheduledFor }, patch.status === undefined ? {} : { status: patch.status, completedAt: null }); if (patch.exercises) r.dto.exercises = patch.exercises.map((e, i) => ({ exercise: { id: e.exerciseId, name: '', slug: '', muscles: [] }, position: i, sets: e.sets ?? null, reps: e.reps ?? null, weightKg: e.weightKg ?? null })); return r.dto; },
    async remove(userId, id) { const r = rows.get(id); if (!r || r.userId !== userId) return false; rows.delete(id); return true; },
    async setCompletion(userId, id, completedAt) { const r = rows.get(id); if (!r || r.userId !== userId) return null; r.dto.status = completedAt ? 'completed' : 'scheduled'; r.dto.completedAt = completedAt?.toISOString() ?? null; return r.dto; },
  };
}
