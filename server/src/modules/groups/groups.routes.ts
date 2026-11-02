import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { createGroupSchema, participantsSchema } from './groups.schema';
import * as svc from './groups.service';

export const groupsRouter = Router();
const idParam = validate({ params: z.object({ id: z.string().uuid() }) });

groupsRouter.post('/group-requests', authenticate, validate({ body: createGroupSchema }), h(async (req, res) => ok(res, await svc.createGroupRequest(req.user!.id, req.body), 201)));
groupsRouter.get('/group-requests/mine', authenticate, h(async (req, res) => ok(res, await svc.myGroupRequests(req.user!.id)))); // before /:id
groupsRouter.get('/group-requests/:id', authenticate, idParam, h(async (req, res) => ok(res, await svc.getGroupRequest(req.params.id, req.user!))));
groupsRouter.post('/group-requests/:id/quotes/:quoteId/accept', authenticate,
  validate({ params: z.object({ id: z.string().uuid(), quoteId: z.string().uuid() }) }),
  h(async (req, res) => ok(res, await svc.acceptQuote(req.user!.id, req.params.id, req.params.quoteId))));
groupsRouter.post('/group-requests/:id/confirm', authenticate, idParam, h(async (req, res) => ok(res, await svc.confirmGroup(req.user!.id, req.params.id))));
groupsRouter.post('/group-requests/:id/cancel', authenticate, idParam, h(async (req, res) => ok(res, await svc.cancelGroup(req.user!.id, req.params.id))));
groupsRouter.post('/group-requests/:id/participants', authenticate, idParam, validate({ body: participantsSchema }),
  h(async (req, res) => ok(res, await svc.addParticipants(req.user!.id, req.params.id, req.body.participants), 201)));
groupsRouter.get('/group-requests/:id/manifest', authenticate, idParam, h(async (req, res) => ok(res, await svc.manifest(req.params.id, req.user!.id))));
