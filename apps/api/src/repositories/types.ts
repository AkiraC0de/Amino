import type { CreateWorkout, UpdateWorkout, WorkoutDto } from '@amino/shared';

export type CreateWorkoutInput = CreateWorkout;
export type UpdateWorkoutInput = UpdateWorkout;

/**
 * Exercise visibility: a built-in exercise (user id null) or one owned by the caller.
 * Create and update throw UnknownExerciseError when any referenced exercise is not visible.
 */
export interface WorkoutRepository {
  list(userId: string, from: string, to: string): Promise<WorkoutDto[]>;
  get(userId: string, id: string): Promise<WorkoutDto | null>;
  create(userId: string, input: CreateWorkoutInput): Promise<WorkoutDto>;
  update(userId: string, id: string, patch: UpdateWorkoutInput): Promise<WorkoutDto | null>;
  remove(userId: string, id: string): Promise<boolean>;
  /**
   * Non-null completedAt marks completed; a completed workout keeps its first completedAt.
   * Null clears completion only for a completed workout, returning it to scheduled.
   * Returns the workout after the change, or null when it is not owned by the caller.
   */
  setCompletion(userId: string, id: string, completedAt: Date | null): Promise<WorkoutDto | null>;
}
