import { eq, isNull } from 'drizzle-orm';
import { loadConfig } from '../../config.js';
import { DEFAULT_USER_ID } from '../../constants.js';
import { createDb } from '../client.js';
import { exerciseMuscles, exercises, users } from '../schema.js';
import { EXERCISE_SEED } from './exercises.js';

const { db, close } = createDb(loadConfig(process.env).databaseUrl);

try {
  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id: DEFAULT_USER_ID }).onConflictDoNothing({ target: users.id });
    for (const seed of EXERCISE_SEED) {
      const [exercise] = await tx
        .insert(exercises)
        .values({ name: seed.name, slug: seed.slug, userId: null })
        .onConflictDoUpdate({
          target: exercises.slug,
          targetWhere: isNull(exercises.userId),
          set: { name: seed.name, updatedAt: new Date() },
        })
        .returning({ id: exercises.id });
      if (!exercise) throw new Error(`Failed to upsert exercise ${seed.slug}`);
      await tx.delete(exerciseMuscles).where(eq(exerciseMuscles.exerciseId, exercise.id));
      await tx.insert(exerciseMuscles).values(seed.muscles.map((muscle) => ({ exerciseId: exercise.id, ...muscle })));
    }
  });
  console.log(`Seeded ${EXERCISE_SEED.length} exercises.`);
} finally {
  await close();
}
