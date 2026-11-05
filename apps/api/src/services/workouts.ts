import type { WorkoutDto } from '@amino/shared';
import { AppError } from '../http/errors.js';
import type { CreateWorkoutInput, UpdateWorkoutInput, WorkoutRepository } from '../repositories/types.js';

export interface WorkoutService { list(userId: string, from: string, to: string): Promise<WorkoutDto[]>; get(userId: string, id: string): Promise<WorkoutDto>; create(userId: string, input: CreateWorkoutInput): Promise<WorkoutDto>; update(userId: string, id: string, patch: UpdateWorkoutInput): Promise<WorkoutDto>; remove(userId: string, id: string): Promise<void>; complete(userId: string, id: string): Promise<WorkoutDto>; uncomplete(userId: string, id: string): Promise<WorkoutDto>; }
const missing = () => new AppError(404, 'WORKOUT_NOT_FOUND', 'Workout not found');
export function createWorkoutService(repo: WorkoutRepository, clock = () => new Date()): WorkoutService {
  const get = async (userId: string, id: string) => (await repo.get(userId, id)) ?? Promise.reject(missing());
  return {
    list: (u, f, t) => repo.list(u, f, t),
    get,
    async create(u, i) { try { return await repo.create(u, i); } catch (error) { if (error instanceof Error && error.message === 'UNKNOWN_EXERCISE') throw new AppError(400, 'UNKNOWN_EXERCISE', 'Unknown exercise'); throw error; } },
    async update(u, id, patch) { const current = await get(u, id); if (current.status === 'completed' && (patch.status !== undefined || patch.exercises !== undefined)) throw new AppError(409, 'WORKOUT_COMPLETED', 'Completed workout must be uncompleted first'); return (await repo.update(u, id, patch)) ?? Promise.reject(missing()); },
    async remove(u, id) { if (!(await repo.remove(u, id))) throw missing(); },
    async complete(u, id) { const current = await get(u, id); if (current.status === 'completed') return current; return (await repo.setCompletion(u, id, clock())) ?? Promise.reject(missing()); },
    async uncomplete(u, id) { return (await repo.setCompletion(u, id, null)) ?? Promise.reject(missing()); },
  };
}
