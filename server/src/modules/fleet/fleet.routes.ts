import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { allocationSchema, driverAssignSchema, quoteSchema } from '../groups/groups.schema';
import * as svc from './fleet.service';

export const fleetRouter = Router();
const op = [authenticate, requireRole('FLEET_OPERATOR')];
const idParam = validate({ params: z.object({ id: z.string().uuid() }) });

fleetRouter.get('/fleet/group-requests', ...op, h(async (req, res) => ok(res, await svc.openRequests(req.user!.id))));
fleetRouter.get('/fleet/vehicles', ...op, h(async (req, res) => ok(res, await svc.myFleet(req.user!.id))));
fleetRouter.get('/fleet/drivers', ...op, h(async (_req, res) => ok(res, await svc.approvedDrivers())));
fleetRouter.post('/fleet/group-requests/:id/quotes', ...op, idParam, validate({ body: quoteSchema }),
  h(async (req, res) => ok(res, await svc.submitQuote(req.user!.id, req.params.id, req.body), 201)));
fleetRouter.post('/fleet/group-requests/:id/allocations', ...op, idParam, validate({ body: allocationSchema }),
  h(async (req, res) => ok(res, await svc.allocateVehicles(req.user!.id, req.params.id, req.body))));
fleetRouter.post('/fleet/group-requests/:id/driver-assignments', ...op, idParam, validate({ body: driverAssignSchema }),
  h(async (req, res) => ok(res, await svc.assignDrivers(req.user!.id, req.params.id, req.body))));
