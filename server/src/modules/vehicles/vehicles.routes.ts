import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { createVehicleSchema } from './vehicles.schema';
import { createVehicle, listMine } from './vehicles.service';

export const vehiclesRouter = Router();
const owners = requireRole('DRIVER', 'RENTAL_OWNER', 'FLEET_OPERATOR');

vehiclesRouter.post('/vehicles', authenticate, owners, validate({ body: createVehicleSchema }),
  h(async (req, res) => ok(res, await createVehicle(req.user!.id, req.body), 201)));
vehiclesRouter.get('/vehicles/me', authenticate, h(async (req, res) => ok(res, await listMine(req.user!.id))));
