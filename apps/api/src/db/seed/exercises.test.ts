import { describe, expect, it } from 'vitest';
import { MUSCLE_IDS } from '@amino/shared';
import { EXERCISE_SEED } from './exercises.js';

describe('exercise seed data', () => {
  it('contains at least 30 real exercises with unique slugs', () => {
    expect(EXERCISE_SEED.length).toBeGreaterThanOrEqual(30);
    expect(new Set(EXERCISE_SEED.map((exercise) => exercise.slug)).size).toBe(EXERCISE_SEED.length);
  });

  it('gives every exercise at least one primary muscle', () => {
    for (const exercise of EXERCISE_SEED) {
      expect(exercise.muscles.some((muscle) => muscle.role === 'primary')).toBe(true);
    }
  });

  it('covers every muscle as a primary target', () => {
    const primaryMuscles = new Set(
      EXERCISE_SEED.flatMap((exercise) =>
        exercise.muscles.filter((muscle) => muscle.role === 'primary').map((muscle) => muscle.muscleId),
      ),
    );
    expect(primaryMuscles).toEqual(new Set(MUSCLE_IDS));
  });

  it('has no duplicate exercise and muscle pairs', () => {
    for (const exercise of EXERCISE_SEED) {
      const pairs = exercise.muscles.map((muscle) => `${exercise.slug}:${muscle.muscleId}`);
      expect(new Set(pairs).size).toBe(pairs.length);
    }
  });
});
