import { z } from 'zod';
import { MUSCLE_IDS } from './muscles.js';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');

const muscleSchema = z.object({ muscleId: z.enum(MUSCLE_IDS), role: z.enum(['primary', 'secondary']) });
export const exerciseDtoSchema = z.object({ id: z.string().uuid(), name: z.string(), slug: z.string(), muscles: z.array(muscleSchema) });
export type ExerciseDto = z.infer<typeof exerciseDtoSchema>;

const workoutExerciseSchema = z.object({ exercise: exerciseDtoSchema, position: z.number().int(), sets: z.number().int().nullable(), reps: z.number().int().nullable(), weightKg: z.number().nullable() });
export const workoutDtoSchema = z.object({
  id: z.string().uuid(), title: z.string(), scheduledFor: dateString,
  status: z.enum(['scheduled', 'completed', 'skipped']), completedAt: z.string().datetime().nullable(), exercises: z.array(workoutExerciseSchema),
});
export type WorkoutDto = z.infer<typeof workoutDtoSchema>;

const createExercise = z.object({ exerciseId: z.string().uuid(), sets: z.number().int().min(1).max(100).optional(), reps: z.number().int().min(1).max(1000).optional(), weightKg: z.number().min(0).max(1000).optional() });
export const createWorkoutSchema = z.object({ title: z.string().min(1).max(100), scheduledFor: dateString, exercises: z.array(createExercise).max(50) });
export type CreateWorkout = z.infer<typeof createWorkoutSchema>;

export const updateWorkoutSchema = z.object({ title: z.string().min(1).max(100).optional(), scheduledFor: dateString.optional(), exercises: z.array(createExercise).max(50).optional(), status: z.enum(['scheduled', 'skipped']).optional() }).refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export type UpdateWorkout = z.infer<typeof updateWorkoutSchema>;

export const listWorkoutsQuerySchema = z.object({ from: dateString, to: dateString }).refine(({ from, to }) => from <= to, { message: 'from must be before or equal to to', path: ['to'] }).refine(({ from, to }) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 <= 62, { message: 'date span cannot exceed 62 days', path: ['to'] });
export type ListWorkoutsQuery = z.infer<typeof listWorkoutsQuerySchema>;

export const errorEnvelopeSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }) });
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
