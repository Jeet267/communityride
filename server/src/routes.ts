import { Router } from 'express';
import { prisma } from './config/prisma';
import { ok } from './utils/response';
import { h } from './utils/asyncHandler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';
import { driversRouter } from './modules/drivers/drivers.routes';
import { vehiclesRouter } from './modules/vehicles/vehicles.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { ridesRouter } from './modules/rides/rides.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { tripsRouter } from './modules/trips/trips.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { rentalsRouter } from './modules/rentals/rentals.routes';
import { groupsRouter } from './modules/groups/groups.routes';
import { fleetRouter } from './modules/fleet/fleet.routes';

export const apiRouter = Router();

apiRouter.get('/health', h(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  ok(res, { status: 'ok' });
}));

// Every router applies `authenticate` on its own routes, so nothing here leaks auth onto other routes.
apiRouter.use(
  authRouter, usersRouter, uploadsRouter, driversRouter, vehiclesRouter, adminRouter, notificationsRouter,
  ridesRouter, bookingsRouter, tripsRouter, paymentsRouter, reviewsRouter, rentalsRouter, groupsRouter, fleetRouter,
);
