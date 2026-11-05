import type { ExerciseDto, WorkoutDto } from '@amino/shared';
import { and, asc, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { exerciseMuscles, exercises, workoutExercises, workouts } from '../db/schema.js';
import { UnknownExerciseError } from './errors.js';
import type { CreateWorkoutInput, UpdateWorkoutInput, WorkoutRepository } from './types.js';

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Transaction;

type WorkoutRow = typeof workouts.$inferSelect;
type WorkoutInsert = typeof workouts.$inferInsert;
type ExerciseRow = typeof exercises.$inferSelect;
type MuscleRow = typeof exerciseMuscles.$inferSelect;
type WorkoutExerciseDto = WorkoutDto['exercises'][number];
type ExerciseInput = CreateWorkoutInput['exercises'][number];

export function createDrizzleWorkoutRepository(db: Db): WorkoutRepository {
  return {
    list: (userId, from, to) => listWorkouts(db, userId, from, to),
    get: (userId, id) => findWorkout(db, userId, id),
    create: (userId, input) => createWorkout(db, userId, input),
    update: (userId, id, patch) => updateWorkout(db, userId, id, patch),
    remove: (userId, id) => removeWorkout(db, userId, id),
    setCompletion: (userId, id, completedAt) => setCompletion(db, userId, id, completedAt),
  };
}

function ownedWorkout(userId: string, id: string) {
  return and(eq(workouts.id, id), eq(workouts.userId, userId));
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

/** One query: every referenced exercise must be a built-in or owned by the caller. */
async function assertExercisesAllowed(executor: Executor, userId: string, exerciseIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(exerciseIds)];
  if (uniqueIds.length === 0) return;
  const visible = await executor
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(inArray(exercises.id, uniqueIds), or(eq(exercises.userId, userId), isNull(exercises.userId))));
  if (visible.length !== uniqueIds.length) throw new UnknownExerciseError();
}

async function insertWorkoutExercises(executor: Executor, workoutId: string, items: ExerciseInput[]): Promise<void> {
  if (items.length === 0) return;
  await executor.insert(workoutExercises).values(
    items.map((item, position) => ({
      workoutId,
      exerciseId: item.exerciseId,
      position,
      sets: item.sets,
      reps: item.reps,
      weightKg: item.weightKg,
    })),
  );
}

async function replaceWorkoutExercises(
  tx: Transaction,
  userId: string,
  workoutId: string,
  items: ExerciseInput[],
): Promise<void> {
  await assertExercisesAllowed(tx, userId, items.map((item) => item.exerciseId));
  await tx.delete(workoutExercises).where(eq(workoutExercises.workoutId, workoutId));
  await insertWorkoutExercises(tx, workoutId, items);
}

function selectExerciseLinks(executor: Executor, workoutIds: string[]) {
  return executor
    .select({ link: workoutExercises, exercise: exercises })
    .from(workoutExercises)
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(inArray(workoutExercises.workoutId, workoutIds))
    .orderBy(asc(workoutExercises.position));
}

async function selectMuscles(executor: Executor, exerciseIds: string[]): Promise<MuscleRow[]> {
  if (exerciseIds.length === 0) return [];
  return executor.select().from(exerciseMuscles).where(inArray(exerciseMuscles.exerciseId, exerciseIds));
}

function toExerciseDto(exercise: ExerciseRow, muscles: MuscleRow[]): ExerciseDto {
  return {
    id: exercise.id,
    name: exercise.name,
    slug: exercise.slug,
    muscles: muscles.map((muscle) => ({ muscleId: muscle.muscleId, role: muscle.role })),
  };
}

/** Batched hydration: three queries regardless of how many workouts are passed. Row order is kept. */
async function loadWorkoutDtos(executor: Executor, rows: WorkoutRow[]): Promise<WorkoutDto[]> {
  if (rows.length === 0) return [];
  const links = await selectExerciseLinks(executor, rows.map((row) => row.id));
  const exerciseIds = [...new Set(links.map(({ exercise }) => exercise.id))];
  const musclesByExercise = groupBy(await selectMuscles(executor, exerciseIds), (muscle) => muscle.exerciseId);

  const entries = links.map(({ link, exercise }) => ({
    workoutId: link.workoutId,
    dto: {
      exercise: toExerciseDto(exercise, musclesByExercise.get(exercise.id) ?? []),
      position: link.position,
      sets: link.sets,
      reps: link.reps,
      weightKg: link.weightKg,
    } satisfies WorkoutExerciseDto,
  }));
  const entriesByWorkout = groupBy(entries, (entry) => entry.workoutId);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    scheduledFor: row.scheduledFor,
    status: row.status,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    exercises: (entriesByWorkout.get(row.id) ?? []).map((entry) => entry.dto),
  }));
}

async function findWorkout(executor: Executor, userId: string, id: string): Promise<WorkoutDto | null> {
  const rows = await executor.select().from(workouts).where(ownedWorkout(userId, id));
  const [workout] = await loadWorkoutDtos(executor, rows);
  return workout ?? null;
}

async function requireWorkout(executor: Executor, userId: string, id: string): Promise<WorkoutDto> {
  const workout = await findWorkout(executor, userId, id);
  if (!workout) throw new Error(`Workout ${id} missing after write`);
  return workout;
}

async function listWorkouts(db: Db, userId: string, from: string, to: string): Promise<WorkoutDto[]> {
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.scheduledFor, from), lte(workouts.scheduledFor, to)))
    .orderBy(asc(workouts.scheduledFor), asc(workouts.createdAt));
  return loadWorkoutDtos(db, rows);
}

async function createWorkout(db: Db, userId: string, input: CreateWorkoutInput): Promise<WorkoutDto> {
  return db.transaction(async (tx) => {
    await assertExercisesAllowed(tx, userId, input.exercises.map((item) => item.exerciseId));
    const [inserted] = await tx
      .insert(workouts)
      .values({ userId, title: input.title, scheduledFor: input.scheduledFor })
      .returning({ id: workouts.id });
    await insertWorkoutExercises(tx, inserted.id, input.exercises);
    return requireWorkout(tx, userId, inserted.id);
  });
}

function toWorkoutValues(patch: UpdateWorkoutInput): Partial<WorkoutInsert> {
  const values: Partial<WorkoutInsert> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.scheduledFor !== undefined) values.scheduledFor = patch.scheduledFor;
  if (patch.status !== undefined) values.status = patch.status;
  return values;
}

async function updateWorkout(
  db: Db,
  userId: string,
  id: string,
  patch: UpdateWorkoutInput,
): Promise<WorkoutDto | null> {
  return db.transaction(async (tx) => {
    const owned = await tx.select({ id: workouts.id }).from(workouts).where(ownedWorkout(userId, id));
    if (owned.length === 0) return null;

    if (patch.exercises) {
      await replaceWorkoutExercises(tx, userId, id, patch.exercises);
    }
    const values = toWorkoutValues(patch);
    if (Object.keys(values).length > 0) {
      await tx.update(workouts).set(values).where(ownedWorkout(userId, id));
    }
    return requireWorkout(tx, userId, id);
  });
}

async function removeWorkout(db: Db, userId: string, id: string): Promise<boolean> {
  const deleted = await db.delete(workouts).where(ownedWorkout(userId, id)).returning({ id: workouts.id });
  return deleted.length > 0;
}

/**
 * The WHERE clauses make the write conditional, so a repeated complete is a no-op and the
 * first completedAt wins even when two requests race. Clearing only touches completed rows,
 * so uncomplete never changes a scheduled or skipped workout.
 */
async function setCompletion(
  db: Db,
  userId: string,
  id: string,
  completedAt: Date | null,
): Promise<WorkoutDto | null> {
  if (completedAt) {
    await db
      .update(workouts)
      .set({ status: 'completed', completedAt })
      .where(and(ownedWorkout(userId, id), ne(workouts.status, 'completed')));
  } else {
    await db
      .update(workouts)
      .set({ status: 'scheduled', completedAt: null })
      .where(and(ownedWorkout(userId, id), eq(workouts.status, 'completed')));
  }
  return findWorkout(db, userId, id);
}
