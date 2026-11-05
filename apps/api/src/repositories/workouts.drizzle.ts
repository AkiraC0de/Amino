import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { exercises, exerciseMuscles, workoutExercises, workouts } from '../db/schema.js';
import type { CreateWorkoutInput, UpdateWorkoutInput, WorkoutRepository } from './types.js';

export function createDrizzleWorkoutRepository(db: Db): WorkoutRepository {
  async function hydrate(userId: string, id: string) {
    const [w] = await db.select().from(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, userId)));
    if (!w) return null;
    const rows = await db.select({ we: workoutExercises, ex: exercises, em: exerciseMuscles }).from(workoutExercises).innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id)).leftJoin(exerciseMuscles, eq(exerciseMuscles.exerciseId, exercises.id)).where(eq(workoutExercises.workoutId, id)).orderBy(asc(workoutExercises.position));
    const map = new Map<string, any>();
    for (const row of rows) { let x = map.get(row.we.id); if (!x) { x = { exercise: { id: row.ex.id, name: row.ex.name, slug: row.ex.slug, muscles: [] }, position: row.we.position, sets: row.we.sets, reps: row.we.reps, weightKg: row.we.weightKg }; map.set(row.we.id, x); } if (row.em) x.exercise.muscles.push({ muscleId: row.em.muscleId, role: row.em.role }); }
    return { id: w.id, title: w.title, scheduledFor: w.scheduledFor, status: w.status, completedAt: w.completedAt?.toISOString() ?? null, exercises: [...map.values()] };
  }
  return {
    async list(userId, from, to) { const ws = await db.select().from(workouts).where(and(eq(workouts.userId, userId), gte(workouts.scheduledFor, from), lte(workouts.scheduledFor, to))).orderBy(asc(workouts.scheduledFor), asc(workouts.createdAt)); const result = []; for (const w of ws) { const dto = await hydrate(userId, w.id); if (dto) result.push(dto); } return result; },
    get: hydrate,
    async create(userId, input) { return db.transaction(async (tx) => { const ids = [...new Set(input.exercises.map((e) => e.exerciseId))]; if (ids.length) { const found = await tx.select({ id: exercises.id }).from(exercises).where(and(eq(exercises.userId, userId))); const built = await tx.select({ id: exercises.id }).from(exercises).where(isNull(exercises.userId)); const allowed = new Set([...found, ...built].map((x) => x.id)); if (ids.some((id) => !allowed.has(id))) throw new Error('UNKNOWN_EXERCISE'); } const [w] = await tx.insert(workouts).values({ userId, title: input.title, scheduledFor: input.scheduledFor }).returning(); if (input.exercises.length) await tx.insert(workoutExercises).values(input.exercises.map((e, i) => ({ workoutId: w.id, exerciseId: e.exerciseId, position: i, sets: e.sets, reps: e.reps, weightKg: e.weightKg }))); return (await hydrate(userId, w.id))!; }); },
    async update(userId, id, patch) { return db.transaction(async (tx) => { const current = await hydrate(userId, id); if (!current) return null; const values: any = {}; if (patch.title !== undefined) values.title = patch.title; if (patch.scheduledFor !== undefined) values.scheduledFor = patch.scheduledFor; if (patch.status !== undefined) values.status = patch.status; if (Object.keys(values).length) await tx.update(workouts).set(values).where(and(eq(workouts.id, id), eq(workouts.userId, userId))); if (patch.exercises) { await tx.delete(workoutExercises).where(eq(workoutExercises.workoutId, id)); if (patch.exercises.length) await tx.insert(workoutExercises).values(patch.exercises.map((e, i) => ({ workoutId: id, exerciseId: e.exerciseId, position: i, sets: e.sets, reps: e.reps, weightKg: e.weightKg }))); } return hydrate(userId, id); }); },
    async remove(userId, id) { const result = await db.delete(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, userId))).returning({ id: workouts.id }); return result.length > 0; },
    async setCompletion(userId, id, completedAt) { const result = await db.update(workouts).set({ status: completedAt ? 'completed' : 'scheduled', completedAt }).where(and(eq(workouts.id, id), eq(workouts.userId, userId))).returning({ id: workouts.id }); return result.length ? hydrate(userId, id) : null; },
  };
}
