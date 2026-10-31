import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { checklistSchema, createListingSchema, rentalBookingSchema, rentalSearchSchema, updateListingSchema } from './rentals.schema';
import * as svc from './rentals.service';

export const rentalsRouter = Router();
const owner = [authenticate, requireRole('RENTAL_OWNER')];
const idParam = validate({ params: z.object({ id: z.string().uuid() }) });

rentalsRouter.get('/rentals', validate({ query: rentalSearchSchema }), h(async (req, res) => ok(res, await svc.searchListings(req.query as any))));
rentalsRouter.get('/rentals/mine', ...owner, h(async (req, res) => ok(res, await svc.myListings(req.user!.id)))); // before /rentals/:id
rentalsRouter.get('/rentals/:id', idParam, h(async (req, res) => ok(res, await svc.getListing(req.params.id))));
rentalsRouter.get('/rentals/:id/availability', idParam, h(async (req, res) => ok(res, await svc.availability(req.params.id))));
rentalsRouter.post('/rentals', ...owner, validate({ body: createListingSchema }), h(async (req, res) => ok(res, await svc.createListing(req.user!.id, req.body), 201)));
rentalsRouter.patch('/rentals/:id', ...owner, idParam, validate({ body: updateListingSchema }), h(async (req, res) => ok(res, await svc.updateListing(req.user!.id, req.params.id, req.body))));
rentalsRouter.post('/rentals/:id/bookings', authenticate, idParam, validate({ body: rentalBookingSchema }),
  h(async (req, res) => ok(res, await svc.bookRental(req.user!.id, req.params.id, req.body), 201)));

rentalsRouter.get('/users/me/rental-bookings', authenticate, h(async (req, res) => ok(res, await svc.myRentalBookings(req.user!.id))));
rentalsRouter.get('/rental-bookings/owner', ...owner, h(async (req, res) => ok(res, await svc.ownerBookings(req.user!.id))));
rentalsRouter.post('/rental-bookings/:id/accept', ...owner, idParam, h(async (req, res) => ok(res, await svc.acceptRental(req.params.id, req.user!.id))));
rentalsRouter.post('/rental-bookings/:id/reject', ...owner, idParam, h(async (req, res) => ok(res, await svc.rejectRental(req.params.id, req.user!.id))));
rentalsRouter.post('/rental-bookings/:id/pickup', ...owner, idParam, validate({ body: checklistSchema }), h(async (req, res) => ok(res, await svc.pickupRental(req.params.id, req.user!.id, req.body))));
rentalsRouter.post('/rental-bookings/:id/return', ...owner, idParam, validate({ body: checklistSchema }), h(async (req, res) => ok(res, await svc.returnRental(req.params.id, req.user!.id, req.body))));
rentalsRouter.post('/rental-bookings/:id/cancel', authenticate, idParam, h(async (req, res) => ok(res, await svc.cancelRental(req.params.id, req.user!.id))));
