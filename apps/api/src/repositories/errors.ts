/** Thrown by repositories when a workout references an exercise the caller may not use. */
export class UnknownExerciseError extends Error {
  constructor() {
    super('Unknown exercise');
    this.name = 'UnknownExerciseError';
  }
}
