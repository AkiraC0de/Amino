import { MUSCLE_IDS, RECOVERY_HOURS, type MuscleId, type MuscleRole } from './muscles.js';
import type { ExerciseDto } from './schemas.js';

export interface SorenessEvent {
  muscleId: MuscleId;
  role: MuscleRole;
  completedAt: string;
}

const roleWeight: Record<MuscleRole, number> = { primary: 1, secondary: 0.5 };

export function eventIntensity(event: SorenessEvent, now: Date): number {
  const hoursSince = Math.max(0, (now.getTime() - new Date(event.completedAt).getTime()) / 3_600_000);
  return roleWeight[event.role] * Math.max(0, 1 - hoursSince / RECOVERY_HOURS);
}

export function muscleIntensities(events: SorenessEvent[], now: Date): Record<MuscleId, number> {
  const values = Object.fromEntries(MUSCLE_IDS.map((id) => [id, 0])) as Record<MuscleId, number>;
  for (const event of events) values[event.muscleId] = Math.min(1, Math.max(values[event.muscleId], eventIntensity(event, now)));
  return values;
}

export function hoursUntilRecovered(events: SorenessEvent[], muscleId: MuscleId, now: Date): number {
  const remaining = events.filter((event) => event.muscleId === muscleId).map((event) => {
    const hoursSince = Math.max(0, (now.getTime() - new Date(event.completedAt).getTime()) / 3_600_000);
    return Math.max(0, RECOVERY_HOURS - hoursSince);
  });
  return remaining.length ? Math.max(...remaining) : 0;
}

export function collapseWorkoutMuscles(exercises: ExerciseDto[]): { muscleId: MuscleId; role: MuscleRole }[] {
  const roles = new Map<MuscleId, MuscleRole>();
  for (const exercise of exercises) for (const muscle of exercise.muscles) {
    if (muscle.role === 'primary' || !roles.has(muscle.muscleId)) roles.set(muscle.muscleId, muscle.role);
  }
  return [...roles].map(([muscleId, role]) => ({ muscleId, role }));
}
