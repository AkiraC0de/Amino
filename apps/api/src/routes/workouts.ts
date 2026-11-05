import { Router } from 'express';
import { createWorkoutSchema, listWorkoutsQuerySchema, updateWorkoutSchema } from '@amino/shared';
import { validate } from '../http/validate.js';
import { workoutControllers } from '../controllers/workouts.js';
import type { WorkoutService } from '../services/workouts.js';
import { z } from 'zod';
const idSchema = z.object({ id: z.string().uuid() });
export function createWorkoutsRouter(service: WorkoutService) {
  const c = workoutControllers(service); const router = Router();
  router.get('/', validate(listWorkoutsQuerySchema, 'query'), c.list);
  router.post('/', validate(createWorkoutSchema, 'body'), c.create);
  router.patch('/:id', validate(idSchema, 'params'), validate(updateWorkoutSchema, 'body'), c.update);
  router.delete('/:id', validate(idSchema, 'params'), c.remove);
  router.post('/:id/complete', validate(idSchema, 'params'), c.complete);
  router.post('/:id/uncomplete', validate(idSchema, 'params'), c.uncomplete);
  return router;
}
