import { randomUUID } from 'node:crypto';
import type { ExerciseDto, WorkoutDto } from '@amino/shared';
import { UnknownExerciseError } from '../errors.js';
import type { CreateWorkoutInput, UpdateWorkoutInput, WorkoutRepository } from '../types.js';

/** An exercise the fake knows about. A null userId marks a built-in exercise. */
export interface CatalogExercise extends ExerciseDto {
  userId: string | null;
}

type WorkoutStatus = WorkoutDto['status'];
type WorkoutExerciseDto = WorkoutDto['exercises'][number];
type ExerciseItems = CreateWorkoutInput['exercises'];

interface StoredEntry {
  exerciseId: string;
  position: number;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
}

interface StoredWorkout {
  id: string;
  userId: string;
  title: string;
  scheduledFor: string;
  status: WorkoutStatus;
  completedAt: string | null;
  createdSeq: number;
  entries: StoredEntry[];
}

/** In-memory WorkoutRepository that mirrors the Drizzle repository's visibility and completion rules. */
export function createMemoryWorkoutRepository(catalog: CatalogExercise[] = []): WorkoutRepository {
  const exerciseById = new Map(catalog.map((exercise) => [exercise.id, exercise] as const));
  const workouts = new Map<string, StoredWorkout>();
  let sequence = 0;

  function assertExercisesAllowed(userId: string, exerciseIds: string[]): void {
    for (const id of new Set(exerciseIds)) {
      const exercise = exerciseById.get(id);
      const visible = exercise !== undefined && (exercise.userId === null || exercise.userId === userId);
      if (!visible) throw new UnknownExerciseError();
    }
  }

  function ownedWorkout(userId: string, id: string): StoredWorkout | undefined {
    const workout = workouts.get(id);
    return workout && workout.userId === userId ? workout : undefined;
  }

  function toEntries(items: ExerciseItems): StoredEntry[] {
    return items.map((item, position) => ({
      exerciseId: item.exerciseId,
      position,
      sets: item.sets ?? null,
      reps: item.reps ?? null,
      weightKg: item.weightKg ?? null,
    }));
  }

  function toEntryDto(entry: StoredEntry): WorkoutExerciseDto {
    const exercise = exerciseById.get(entry.exerciseId);
    if (!exercise) throw new Error(`Exercise ${entry.exerciseId} missing from catalog`);
    return {
      exercise: {
        id: exercise.id,
        name: exercise.name,
        slug: exercise.slug,
        muscles: exercise.muscles.map((muscle) => ({ ...muscle })),
      },
      position: entry.position,
      sets: entry.sets,
      reps: entry.reps,
      weightKg: entry.weightKg,
    };
  }

  function toWorkoutDto(workout: StoredWorkout): WorkoutDto {
    return {
      id: workout.id,
      title: workout.title,
      scheduledFor: workout.scheduledFor,
      status: workout.status,
      completedAt: workout.completedAt,
      exercises: workout.entries.map(toEntryDto),
    };
  }

  return {
    async list(userId, from, to) {
      return [...workouts.values()]
        .filter((workout) => workout.userId === userId && workout.scheduledFor >= from && workout.scheduledFor <= to)
        .sort(byScheduleThenCreation)
        .map(toWorkoutDto);
    },

    async get(userId, id) {
      const workout = ownedWorkout(userId, id);
      return workout ? toWorkoutDto(workout) : null;
    },

    async create(userId, input) {
      assertExercisesAllowed(userId, input.exercises.map((item) => item.exerciseId));
      const stored: StoredWorkout = {
        id: randomUUID(),
        userId,
        title: input.title,
        scheduledFor: input.scheduledFor,
        status: 'scheduled',
        completedAt: null,
        createdSeq: ++sequence,
        entries: toEntries(input.exercises),
      };
      workouts.set(stored.id, stored);
      return toWorkoutDto(stored);
    },

    async update(userId, id, patch) {
      const workout = ownedWorkout(userId, id);
      if (!workout) return null;
      if (patch.exercises) {
        assertExercisesAllowed(userId, patch.exercises.map((item) => item.exerciseId));
        workout.entries = toEntries(patch.exercises);
      }
      if (patch.title !== undefined) workout.title = patch.title;
      if (patch.scheduledFor !== undefined) workout.scheduledFor = patch.scheduledFor;
      if (patch.status !== undefined) workout.status = patch.status;
      return toWorkoutDto(workout);
    },

    async remove(userId, id) {
      if (!ownedWorkout(userId, id)) return false;
      workouts.delete(id);
      return true;
    },

    async setCompletion(userId, id, completedAt) {
      const workout = ownedWorkout(userId, id);
      if (!workout) return null;
      if (completedAt) {
        markCompleted(workout, completedAt);
      } else {
        clearCompletion(workout);
      }
      return toWorkoutDto(workout);
    },
  };
}

function byScheduleThenCreation(a: StoredWorkout, b: StoredWorkout): number {
  if (a.scheduledFor !== b.scheduledFor) return a.scheduledFor < b.scheduledFor ? -1 : 1;
  return a.createdSeq - b.createdSeq;
}

/** A completed workout keeps its first completedAt. */
function markCompleted(workout: StoredWorkout, completedAt: Date): void {
  if (workout.status === 'completed') return;
  workout.status = 'completed';
  workout.completedAt = completedAt.toISOString();
}

/** Only a completed workout is changed; scheduled and skipped stay as they are. */
function clearCompletion(workout: StoredWorkout): void {
  if (workout.status !== 'completed') return;
  workout.status = 'scheduled';
  workout.completedAt = null;
}
