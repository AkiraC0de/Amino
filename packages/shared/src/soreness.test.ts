import { describe, expect, it } from 'vitest';
import {
  collapseWorkoutMuscles,
  eventIntensity,
  hoursUntilRecovered,
  muscleIntensities,
  type ExerciseDto,
  type SorenessEvent,
} from './index.js';

const now = new Date('2026-01-03T00:00:00.000Z');
const event = (hoursAgo: number, role: SorenessEvent['role'] = 'primary'): SorenessEvent => ({
  muscleId: 'chest',
  role,
  completedAt: new Date(now.getTime() - hoursAgo * 3600000).toISOString(),
});

describe('soreness math', () => {
  it('decays primary intensity from 1 to 0 over 48 hours', () => {
    expect(eventIntensity(event(0), now)).toBe(1);
    expect(eventIntensity(event(24), now)).toBe(0.5);
    expect(eventIntensity(event(48), now)).toBe(0);
    expect(eventIntensity(event(72), now)).toBe(0);
  });

  it('weights secondary events at half intensity', () => {
    expect(eventIntensity(event(0, 'secondary'), now)).toBe(0.5);
  });

  it('clamps future timestamps to full role weight', () => {
    const future: SorenessEvent = { ...event(0), completedAt: new Date(now.getTime() + 3 * 3600000).toISOString() };
    expect(eventIntensity(future, now)).toBe(1);
    expect(eventIntensity({ ...future, role: 'secondary' }, now)).toBe(0.5);
  });

  it('returns all muscles and maxes overlapping intensities at one', () => {
    const values = muscleIntensities([event(0), event(12, 'secondary')], now);
    expect(Object.keys(values)).toHaveLength(15);
    expect(values.chest).toBe(1);
    expect(values.calves).toBe(0);
    expect(Math.max(...Object.values(values))).toBeLessThanOrEqual(1);
  });

  it('reports remaining recovery hours and zero for untouched muscles', () => {
    expect(hoursUntilRecovered([event(24)], 'chest', now)).toBe(24);
    expect(hoursUntilRecovered([], 'calves', now)).toBe(0);
  });

  it('collapses duplicate muscles with primary role winning', () => {
    const exercise = (muscleId: 'chest', role: 'primary' | 'secondary'): ExerciseDto => ({
      id: crypto.randomUUID(), name: 'Press', slug: 'press', muscles: [{ muscleId, role }],
    });
    expect(collapseWorkoutMuscles([exercise('chest', 'secondary'), exercise('chest', 'primary')])).toEqual([
      { muscleId: 'chest', role: 'primary' },
    ]);
  });
});
