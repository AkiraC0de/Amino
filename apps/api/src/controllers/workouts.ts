import type { RequestHandler } from 'express';
import type { WorkoutService } from '../services/workouts.js';
export function workoutControllers(service: WorkoutService) {
  const list: RequestHandler = async (req, res) => res.json(await service.list(req.userId, res.locals.validated.query.from, res.locals.validated.query.to));
  const create: RequestHandler = async (req, res) => res.status(201).json(await service.create(req.userId, req.body));
  const update: RequestHandler = async (req, res) => res.json(await service.update(req.userId, req.params.id as string, req.body));
  const remove: RequestHandler = async (req, res) => { await service.remove(req.userId, req.params.id as string); res.status(204).end(); };
  const complete: RequestHandler = async (req, res) => res.json(await service.complete(req.userId, req.params.id as string));
  const uncomplete: RequestHandler = async (req, res) => res.json(await service.uncomplete(req.userId, req.params.id as string));
  return { list, create, update, remove, complete, uncomplete };
}
