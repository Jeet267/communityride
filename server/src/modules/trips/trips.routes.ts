import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import * as svc from './trips.service';

export const tripsRouter = Router();
const driver = [authenticate, requireRole('DRIVER')];
const rideParam = validate({ params: z.object({ rideId: z.string().uuid() }) });

tripsRouter.get('/driver/dashboard', ...driver, h(async (req, res) => ok(res, await svc.dashboard(req.user!.id))));
tripsRouter.post('/driver/trips/:rideId/checklist', ...driver, rideParam,
  validate({ body: z.object({ tyresOk: z.boolean(), fuelOk: z.boolean(), documentsOk: z.boolean(), notes: z.string().max(300).optional() }) }),
  h(async (req, res) => ok(res, await svc.saveChecklist(req.params.rideId, req.user!.id, req.body))));
tripsRouter.post('/driver/trips/:rideId/start', ...driver, rideParam, h(async (req, res) => ok(res, await svc.startTrip(req.params.rideId, req.user!.id))));
tripsRouter.post('/driver/trips/:rideId/complete', ...driver, rideParam, h(async (req, res) => ok(res, await svc.completeTrip(req.params.rideId, req.user!.id))));
