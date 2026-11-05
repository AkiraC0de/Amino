import type { CatalogExercise } from '../repositories/memory/workouts.js';

export const BENCH_PRESS_ID = '00000000-0000-4000-8000-0000000000a1';
export const OWN_EXERCISE_ID = '00000000-0000-4000-8000-0000000000a2';
export const FOREIGN_EXERCISE_ID = '00000000-0000-4000-8000-0000000000a3';
export const MISSING_ID = '00000000-0000-4000-8000-0000000000ff';

/** A built-in exercise, the caller's own custom exercise, and another user's custom exercise. */
export function buildCatalog(ownerId: string, otherId: string): CatalogExercise[] {
  return [
    {
      id: BENCH_PRESS_ID,
      userId: null,
      name: 'Bench press',
      slug: 'bench-press',
      muscles: [
        { muscleId: 'chest', role: 'primary' },
        { muscleId: 'triceps', role: 'secondary' },
      ],
    },
    {
      id: OWN_EXERCISE_ID,
      userId: ownerId,
      name: 'My lift',
      slug: 'my-lift',
      muscles: [{ muscleId: 'quads', role: 'primary' }],
    },
    {
      id: FOREIGN_EXERCISE_ID,
      userId: otherId,
      name: 'Their lift',
      slug: 'their-lift',
      muscles: [],
    },
  ];
}
