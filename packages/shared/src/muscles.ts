export const MUSCLE_IDS = [
  'chest', 'upper-back', 'lats', 'traps', 'shoulders', 'biceps', 'triceps',
  'forearms', 'abs', 'obliques', 'lower-back', 'glutes', 'quads', 'hamstrings', 'calves',
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];
export type MuscleRole = 'primary' | 'secondary';

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Chest', 'upper-back': 'Upper Back', lats: 'Lats', traps: 'Traps', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques',
  'lower-back': 'Lower Back', glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves',
};

export const RECOVERY_HOURS = 48;
