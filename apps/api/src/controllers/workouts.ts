import type { CreateWorkout, ListWorkoutsQuery, UpdateWorkout } from '@amino/shared';
import type { Request, Response } from 'express';
import type { WorkoutService } from '../services/workouts.js';

/** Query values parsed by validate(listWorkoutsQuerySchema, 'query'). */
function validatedQuery(res: Response): ListWorkoutsQuery {
  return res.locals.validated.query as ListWorkoutsQuery;
}

/** The :id segment, already checked as a uuid by the route's validate(idSchema, 'params'). */
function workoutId(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string') throw new Error('Expected a single :id route parameter');
  return id;
}

export function workoutControllers(service: WorkoutService) {
  return {
    async list(req: Request, res: Response) {
      const { from, to } = validatedQuery(res);
      res.json(await service.list(req.userId, from, to));
    },

    async create(req: Request, res: Response) {
      const input = req.body as CreateWorkout;
      res.status(201).json(await service.create(req.userId, input));
    },

    async update(req: Request, res: Response) {
      const patch = req.body as UpdateWorkout;
      res.json(await service.update(req.userId, workoutId(req), patch));
    },

    async remove(req: Request, res: Response) {
      await service.remove(req.userId, workoutId(req));
      res.status(204).end();
    },

    async complete(req: Request, res: Response) {
      res.json(await service.complete(req.userId, workoutId(req)));
    },

    async uncomplete(req: Request, res: Response) {
      res.json(await service.uncomplete(req.userId, workoutId(req)));
    },
  };
}
