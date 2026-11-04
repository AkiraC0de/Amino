import { describe, expect, it } from 'vitest';
import { listWorkoutsQuerySchema, updateWorkoutSchema } from './schemas.js';

describe('workout schemas', () => {
  it('rejects from dates after to dates', () => {
    expect(listWorkoutsQuerySchema.safeParse({ from: '2026-02-02', to: '2026-02-01' }).success).toBe(false);
  });

  it('rejects a 63-day span', () => {
    expect(listWorkoutsQuerySchema.safeParse({ from: '2026-01-01', to: '2026-03-05' }).success).toBe(false);
  });

  it('accepts exactly a 62-day span', () => {
    // Span means to - from in calendar days; exactly 62 days is accepted.
    expect(listWorkoutsQuerySchema.safeParse({ from: '2026-01-01', to: '2026-03-04' }).success).toBe(true);
  });

  it('rejects completed as an update status', () => {
    expect(updateWorkoutSchema.safeParse({ status: 'completed' }).success).toBe(false);
  });
});
