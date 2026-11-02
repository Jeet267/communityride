import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z, ZodTypeAny } from 'zod';
import { otpRequestSchema, otpVerifySchema, refreshSchema } from '../modules/auth/auth.schema';
import { onboardingSchema } from '../modules/drivers/drivers.schema';
import { publishRideSchema, searchRidesSchema } from '../modules/rides/rides.schema';
import { createListingSchema, rentalBookingSchema, checklistSchema } from '../modules/rentals/rentals.schema';
import { allocationSchema, createGroupSchema, driverAssignSchema, participantsSchema, quoteSchema } from '../modules/groups/groups.schema';

extendZodWithOpenApi(z);

type Method = 'get' | 'post' | 'patch';
const ERRORS: Record<number, string> = {
  400: 'VALIDATION_ERROR', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'SEATS_UNAVAILABLE / VEHICLE_UNAVAILABLE / BOOKING_STATE_CONFLICT',
  422: 'DISTANCE_LIMIT_EXCEEDED / GROUP_CAPACITY_INSUFFICIENT / DRIVER_NOT_ASSIGNED', 503: 'DISTANCE_UNAVAILABLE',
};

/** Swagger is generated from the same Zod schemas that validate requests, so the docs never drift. */
export function openApiDoc() {
  const reg = new OpenAPIRegistry();
  reg.registerComponent('securitySchemes', 'bearer', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });

  const path = (method: Method, p: string, tag: string, summary: string, opts: { body?: ZodTypeAny; query?: any; auth?: boolean; errors?: number[] } = {}) =>
    reg.registerPath({
      method, path: p, tags: [tag], summary,
      security: opts.auth === false ? [] : [{ bearer: [] }],
      request: {
        ...(opts.body ? { body: { content: { 'application/json': { schema: opts.body } } } } : {}),
        ...(opts.query ? { query: opts.query } : {}),
      },
      responses: Object.fromEntries([[200, { description: 'Success' }], ...(opts.errors ?? []).map(c => [c, { description: ERRORS[c] }])]),
    });

  path('post', '/auth/otp/request', 'Auth', 'Send OTP', { body: otpRequestSchema, auth: false });
  path('post', '/auth/otp/verify', 'Auth', 'Verify OTP and sign in', { body: otpVerifySchema, auth: false, errors: [401, 429] });
  path('post', '/auth/refresh', 'Auth', 'Rotate refresh token', { body: refreshSchema, auth: false, errors: [401] });
  path('get', '/users/me', 'Users', 'Current profile', { errors: [401] });
  path('post', '/drivers/onboarding', 'Drivers', 'Submit driver licence', { body: onboardingSchema });
  path('get', '/rides', 'Rides', 'Search rides', { query: searchRidesSchema, auth: false });
  path('get', '/rides/tours', 'Rides', 'Open group tours', { auth: false });
  path('post', '/rides', 'Rides', 'Publish ride (server checks 500 km)', { body: publishRideSchema, errors: [403, 422, 503] });
  path('post', '/rides/{rideId}/bookings', 'Bookings', 'Request seats (send Idempotency-Key)', { body: z.object({ seatsRequested: z.number().int() }), errors: [409] });
  path('post', '/driver/bookings/{id}/accept', 'Bookings', 'Driver accepts', { errors: [403, 409] });
  path('post', '/driver/trips/{rideId}/start', 'Trips', 'Start trip', { errors: [409] });
  path('post', '/rentals', 'Rentals', 'Create listing', { body: createListingSchema });
  path('post', '/rentals/{id}/bookings', 'Rentals', 'Book rental (overlap blocked by DB)', { body: rentalBookingSchema, errors: [409] });
  path('post', '/rental-bookings/{id}/pickup', 'Rentals', 'Pickup checklist', { body: checklistSchema });
  path('post', '/group-requests', 'Groups', 'Create 40-50+ group request', { body: createGroupSchema, errors: [422] });
  path('post', '/fleet/group-requests/{id}/quotes', 'Fleet', 'Operator quote', { body: quoteSchema });
  path('post', '/fleet/group-requests/{id}/allocations', 'Fleet', 'Allocate vehicles', { body: allocationSchema, errors: [409] });
  path('post', '/fleet/group-requests/{id}/driver-assignments', 'Fleet', 'Assign verified drivers', { body: driverAssignSchema, errors: [403, 409] });
  path('post', '/group-requests/{id}/confirm', 'Groups', 'Confirm (capacity + drivers re-checked)', { errors: [422] });
  path('post', '/group-requests/{id}/participants', 'Groups', 'Add manifest participants', { body: participantsSchema });
  path('post', '/payments/orders', 'Payments', 'Mock payment (Idempotency-Key required)', {
    body: z.object({ bookingType: z.enum(['RIDE', 'RENTAL', 'GROUP']), bookingId: z.string().uuid(), purpose: z.enum(['FULL', 'ADVANCE', 'BALANCE']) }),
  });

  return new OpenApiGeneratorV3(reg.definitions).generateDocument({
    openapi: '3.0.0',
    info: { title: 'RideMate API', version: '1.0.0', description: 'Carpools, rentals and 40-50+ group trips within 500 km' },
    servers: [{ url: '/api/v1' }],
  });
}
