import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { editRideSchema, publishRideSchema, searchRidesSchema, sharedRidesSchema } from './rides.schema';
import * as svc from './rides.service';

export const ridesRouter = Router();
const idParam = validate({ params: z.object({ id: z.string().uuid() }) });

ridesRouter.get('/rides', validate({ query: searchRidesSchema }), h(async (req, res) => ok(res, await svc.searchRides(req.query as any))));
ridesRouter.get('/rides/shared', validate({ query: sharedRidesSchema }), h(async (req, res) => ok(res, await svc.listSharedRides(req.query as any)))); // before /rides/:id
ridesRouter.get('/rides/tours', h(async (_req, res) => ok(res, await svc.listTours()))); // must come before /rides/:id
ridesRouter.get('/rides/:id', idParam, h(async (req, res) => ok(res, await svc.getRide(req.params.id))));
ridesRouter.post('/rides', authenticate, requireRole('DRIVER'), validate({ body: publishRideSchema }),
  h(async (req, res) => ok(res, await svc.publishRide(req.user!.id, req.body), 201)));
ridesRouter.patch('/rides/:id', authenticate, requireRole('DRIVER'), idParam, validate({ body: editRideSchema }),
  h(async (req, res) => ok(res, await svc.editRide(req.user!.id, req.params.id, req.body))));
ridesRouter.post('/rides/:id/cancel', authenticate, requireRole('DRIVER'), idParam,
  validate({ body: z.object({ reason: z.string().min(3).max(200) }) }),
  h(async (req, res) => { await svc.cancelRide(req.user!.id, req.params.id, req.body.reason); ok(res, { status: 'CANCELLED' }); }));
