import type { WorkoutDto } from '@amino/shared';
import { AppError } from '../http/errors.js';
import { UnknownExerciseError } from '../repositories/errors.js';
import type { CreateWorkoutInput, UpdateWorkoutInput, WorkoutRepository } from '../repositories/types.js';

export interface WorkoutService {
  list(userId: string, from: string, to: string): Promise<WorkoutDto[]>;
  get(userId: string, id: string): Promise<WorkoutDto>;
  create(userId: string, input: CreateWorkoutInput): Promise<WorkoutDto>;
  update(userId: string, id: string, patch: UpdateWorkoutInput): Promise<WorkoutDto>;
  remove(userId: string, id: string): Promise<void>;
  complete(userId: string, id: string): Promise<WorkoutDto>;
  uncomplete(userId: string, id: string): Promise<WorkoutDto>;
}

function workoutNotFound(): AppError {
  return new AppError(404, 'WORKOUT_NOT_FOUND', 'Workout not found');
}

function workoutCompleted(): AppError {
  return new AppError(409, 'WORKOUT_COMPLETED', 'Completed workout must be uncompleted before changing exercises or status');
}

/** Converts the repository's typed exercise error into the public 400 error. */
async function mapUnknownExercise<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof UnknownExerciseError) {
      throw new AppError(400, 'UNKNOWN_EXERCISE', 'Unknown exercise');
    }
    throw error;
  }
}

export function createWorkoutService(repo: WorkoutRepository, clock: () => Date = () => new Date()): WorkoutService {
  async function requireWorkout(userId: string, id: string): Promise<WorkoutDto> {
    const workout = await repo.get(userId, id);
    if (!workout) throw workoutNotFound();
    return workout;
  }

  async function applyCompletion(userId: string, id: string, completedAt: Date | null): Promise<WorkoutDto> {
    const updated = await repo.setCompletion(userId, id, completedAt);
    if (!updated) throw workoutNotFound();
    return updated;
  }

  return {
    list: (userId, from, to) => repo.list(userId, from, to),

    get: (userId, id) => requireWorkout(userId, id),

    create: (userId, input) => mapUnknownExercise(() => repo.create(userId, input)),

    async update(userId, id, patch) {
      const current = await requireWorkout(userId, id);
      const touchesLockedFields = patch.status !== undefined || patch.exercises !== undefined;
      if (current.status === 'completed' && touchesLockedFields) throw workoutCompleted();
      const updated = await mapUnknownExercise(() => repo.update(userId, id, patch));
      if (!updated) throw workoutNotFound();
      return updated;
    },

    async remove(userId, id) {
      const removed = await repo.remove(userId, id);
      if (!removed) throw workoutNotFound();
    },

    async complete(userId, id) {
      const current = await requireWorkout(userId, id);
      if (current.status === 'completed') return current;
      return applyCompletion(userId, id, clock());
    },

    async uncomplete(userId, id) {
      const current = await requireWorkout(userId, id);
      if (current.status !== 'completed') return current;
      return applyCompletion(userId, id, null);
    },
  };
}
