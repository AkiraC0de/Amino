import type { CreateWorkout, ExerciseDto, UpdateWorkout, WorkoutDto } from '@amino/shared';
export type CreateWorkoutInput = CreateWorkout;
export type UpdateWorkoutInput = UpdateWorkout;
export interface WorkoutRepository {
  list(userId: string, from: string, to: string): Promise<WorkoutDto[]>;
  get(userId: string, id: string): Promise<WorkoutDto | null>;
  create(userId: string, input: CreateWorkoutInput): Promise<WorkoutDto>;
  update(userId: string, id: string, patch: UpdateWorkoutInput): Promise<WorkoutDto | null>;
  remove(userId: string, id: string): Promise<boolean>;
  setCompletion(userId: string, id: string, completedAt: Date | null): Promise<WorkoutDto | null>;
}
export type ExerciseLookup = (ids: string[], userId: string) => Promise<ExerciseDto[]>;
