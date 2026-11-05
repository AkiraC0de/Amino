import { MUSCLE_IDS } from '@amino/shared';
import {
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const muscleIdEnum = pgEnum('muscle_id', MUSCLE_IDS);
export const muscleRoleEnum = pgEnum('muscle_role', ['primary', 'secondary']);
export const workoutStatusEnum = pgEnum('workout_status', ['scheduled', 'completed', 'skipped']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  ...timestamps,
});

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    ...timestamps,
  },
  (table) => ({
    builtInSlugUnique: uniqueIndex('exercises_builtin_slug_unique').on(table.slug).where(sql`${table.userId} is null`),
    userSlugUnique: uniqueIndex('exercises_user_slug_unique').on(table.userId, table.slug).where(sql`${table.userId} is not null`),
  }),
);

export const exerciseMuscles = pgTable(
  'exercise_muscles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
    muscleId: muscleIdEnum('muscle_id').notNull(),
    role: muscleRoleEnum('role').notNull(),
    ...timestamps,
  },
  (table) => ({
    exerciseMuscleUnique: unique('exercise_muscles_exercise_muscle_unique').on(table.exerciseId, table.muscleId),
  }),
);

export const workouts = pgTable(
  'workouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    scheduledFor: date('scheduled_for', { mode: 'string' }).notNull(),
    status: workoutStatusEnum('status').default('scheduled').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    userScheduledIndex: index('workouts_user_scheduled_for_idx').on(table.userId, table.scheduledFor),
    userCompletedIndex: index('workouts_user_completed_at_idx').on(table.userId, table.completedAt),
  }),
);

export const workoutExercises = pgTable(
  'workout_exercises',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workoutId: uuid('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    sets: integer('sets'),
    reps: integer('reps'),
    weightKg: numeric('weight_kg', { mode: 'number' }),
    ...timestamps,
  },
  (table) => ({
    workoutPositionUnique: unique('workout_exercises_workout_position_unique').on(table.workoutId, table.position),
  }),
);

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type ExerciseMuscle = typeof exerciseMuscles.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
