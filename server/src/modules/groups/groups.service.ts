import { GroupRequest, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { decrypt, encrypt, mask } from '../../utils/crypto';
import { notify } from '../../utils/notify';
import { getValidatedRoute } from '../routing/routing';
import { assertTransition } from './groups.state';
import { CreateGroupInput } from './groups.schema';

/** Row lock so accept / allocate / confirm on the same request run one after another. */
export async function lockRequest(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<GroupRequest[]>`SELECT * FROM "GroupRequest" WHERE id = ${id}::uuid FOR UPDATE`;
  if (!rows[0]) throw new AppError('NOT_FOUND', 404, 'Group request not found');
  return rows[0];
}

export async function createGroupRequest(organizerId: string, input: CreateGroupInput) {
  const route = await getValidatedRoute(input.origin, input.destination); // 500 km rule applies to group trips too
  return prisma.groupRequest.create({
    data: {
      organizerUserId: organizerId, originName: input.origin.name, destName: input.destination.name,
      departureAt: input.departureAt, returnAt: input.returnAt, distanceMeters: route.distanceMeters,
      passengerCount: input.passengerCount, luggageNotes: input.luggageNotes, vehiclePreference: input.vehiclePreference,
      budgetTotalPaise: input.budgetTotalPaise ? BigInt(input.budgetTotalPaise) : null,
    },
  });
}

export async function myGroupRequests(userId: string) {
  const rows = await prisma.groupRequest.findMany({
    where: { organizerUserId: userId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { quotes: true } } },
  });
  return rows.map(r => ({ id: r.id, origin: r.originName, destination: r.destName, departureAt: r.departureAt,
    passengerCount: r.passengerCount, status: r.status, quotes: r._count.quotes }));
}

export async function getGroupRequest(id: string, user: { id: string; roles: string[] }) {
  const r = await prisma.groupRequest.findUnique({
    where: { id },
    include: {
      _count: { select: { participants: true } },
      quotes: {
        orderBy: { totalPricePaise: 'asc' },
        include: {
          operator: { select: { fullName: true } },
          allocations: { where: { active: true }, include: { vehicle: true, driverAssignment: { include: { driver: { select: { fullName: true } } } } } },
        },
      },
    },
  });
  if (!r) throw new AppError('NOT_FOUND', 404, 'Group request not found');
  const isOrganizer = r.organizerUserId === user.id;
  const myQuote = r.quotes.find(q => q.operatorUserId === user.id);
  const canBrowse = user.roles.includes('FLEET_OPERATOR') && r.status === 'OPEN_FOR_QUOTES';
  if (!isOrganizer && !myQuote && !canBrowse) throw new AppError('FORBIDDEN', 403);

  const accepted = r.quotes.find(q => q.status === 'ACCEPTED');
  const allocations = (accepted?.allocations ?? []).map(a => ({
    id: a.id, vehicleId: a.vehicleId, vehicle: `${a.vehicle.make} ${a.vehicle.model}`, seatCapacity: a.vehicle.seatCapacity,
    assignedPassengers: a.assignedPassengers,
    driver: a.driverAssignment?.active ? { id: a.driverAssignment.driverUserId, name: a.driverAssignment.driver.fullName } : null,
  }));
  const paid = isOrganizer
    ? (await prisma.payment.aggregate({ _sum: { amountPaise: true }, where: { bookingType: 'GROUP', bookingId: id, status: 'CAPTURED' } }))._sum.amountPaise ?? 0n
    : 0n;

  return {
    id: r.id, origin: r.originName, destination: r.destName, departureAt: r.departureAt, returnAt: r.returnAt,
    distanceKm: Math.round(r.distanceMeters / 1000), passengerCount: r.passengerCount, luggageNotes: r.luggageNotes,
    vehiclePreference: r.vehiclePreference, budgetTotalPaise: r.budgetTotalPaise, status: r.status,
    isOrganizer, participantsCount: r._count.participants, paidPaise: paid,
    quotes: (isOrganizer ? r.quotes : r.quotes.filter(q => q.operatorUserId === user.id)).map(q => ({
      id: q.id, operator: q.operator.fullName, totalPricePaise: q.totalPricePaise, vehiclePlan: q.vehiclePlan,
      inclusions: q.inclusions, cancellationTerms: q.cancellationTerms, validUntil: q.validUntil, status: q.status,
    })),
    acceptedQuote: accepted
      ? { id: accepted.id, operator: accepted.operator.fullName, totalPricePaise: accepted.totalPricePaise, byMe: accepted.operatorUserId === user.id }
      : null,
    allocations,
    summary: {
      required: r.passengerCount,
      assigned: allocations.reduce((s, a) => s + a.assignedPassengers, 0),
      capacity: allocations.reduce((s, a) => s + a.seatCapacity, 0),
      driversMissing: allocations.filter(a => !a.driver).length,
    },
  };
}

export async function acceptQuote(organizerId: string, requestId: string, quoteId: string) {
  return prisma.$transaction(async tx => {
    const req = await lockRequest(tx, requestId);
    if (req.organizerUserId !== organizerId) throw new AppError('FORBIDDEN', 403);
    assertTransition(req.status, 'QUOTE_ACCEPTED');
    const q = await tx.groupQuote.findFirst({ where: { id: quoteId, groupRequestId: requestId, status: 'SUBMITTED' } });
    if (!q) throw new AppError('NOT_FOUND', 404, 'Quote not found');
    if (q.validUntil < new Date()) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'This quote has expired');
    await tx.groupQuote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } });
    await tx.groupQuote.updateMany({ where: { groupRequestId: requestId, id: { not: quoteId } }, data: { status: 'REJECTED' } });
    await tx.groupRequest.update({ where: { id: requestId }, data: { status: 'QUOTE_ACCEPTED' } });
    await notify(q.operatorUserId, 'QUOTE_ACCEPTED', { requestId }, tx);
    return { status: 'QUOTE_ACCEPTED' };
  });
}

/** Core invariant: never confirm 50 people with 48 seats, or a vehicle without a verified driver. */
export async function confirmGroup(organizerId: string, requestId: string) {
  return prisma.$transaction(async tx => {
    const req = await lockRequest(tx, requestId);
    if (req.organizerUserId !== organizerId) throw new AppError('FORBIDDEN', 403);
    assertTransition(req.status, 'CONFIRMED');
    const allocs = await tx.groupAllocation.findMany({
      where: { active: true, quote: { groupRequestId: requestId, status: 'ACCEPTED' } },
      include: { vehicle: true, driverAssignment: true, quote: true },
    });
    const capacity = allocs.reduce((s, a) => s + a.vehicle.seatCapacity, 0);
    const assigned = allocs.reduce((s, a) => s + a.assignedPassengers, 0);
    if (assigned < req.passengerCount || capacity < req.passengerCount)
      throw new AppError('GROUP_CAPACITY_INSUFFICIENT', 422, `Seats are allocated for ${assigned} of ${req.passengerCount} passengers.`,
        { required: req.passengerCount, assigned, capacity });
    const noDriver = allocs.filter(a => !a.driverAssignment?.active);
    if (noDriver.length) throw new AppError('DRIVER_NOT_ASSIGNED', 422, `${noDriver.length} vehicle(s) still need a driver.`,
      { allocationIds: noDriver.map(a => a.id) });
    await tx.groupRequest.update({ where: { id: requestId }, data: { status: 'CONFIRMED' } });
    await tx.auditLog.create({ data: { actorId: organizerId, action: 'group.CONFIRMED', entityType: 'GroupRequest', entityId: requestId,
      metadata: { capacity, assigned, vehicles: allocs.length } } });
    await notify(allocs[0].quote.operatorUserId, 'GROUP_CONFIRMED', { requestId }, tx);
    for (const a of allocs) await notify(a.driverAssignment!.driverUserId, 'GROUP_TRIP_ASSIGNED', { requestId }, tx);
    return { status: 'CONFIRMED', capacity, assigned };
  });
}

export async function cancelGroup(organizerId: string, requestId: string) {
  return prisma.$transaction(async tx => {
    const req = await lockRequest(tx, requestId);
    if (req.organizerUserId !== organizerId) throw new AppError('FORBIDDEN', 403);
    assertTransition(req.status, 'CANCELLED');
    const allocs = await tx.groupAllocation.findMany({ where: { active: true, quote: { groupRequestId: requestId } }, include: { quote: true } });
    await tx.driverAssignment.updateMany({ where: { groupAllocationId: { in: allocs.map(a => a.id) } }, data: { active: false } });
    await tx.groupAllocation.updateMany({ where: { id: { in: allocs.map(a => a.id) } }, data: { active: false } }); // vehicles become free
    await tx.groupRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED' } });
    if (allocs[0]) await notify(allocs[0].quote.operatorUserId, 'GROUP_CANCELLED', { requestId }, tx);
    return { status: 'CANCELLED' };
  });
}

export async function addParticipants(organizerId: string, requestId: string, list: { name: string; phone?: string; notes?: string }[]) {
  const r = await prisma.groupRequest.findUnique({ where: { id: requestId }, include: { _count: { select: { participants: true } } } });
  if (!r || r.organizerUserId !== organizerId) throw new AppError('FORBIDDEN', 403);
  if (r._count.participants + list.length > r.passengerCount)
    throw new AppError('VALIDATION_ERROR', 400, `This group is for ${r.passengerCount} people; ${r._count.participants} are already added.`);
  await prisma.groupParticipant.createMany({
    data: list.map(p => ({ groupRequestId: requestId, name: p.name, notes: p.notes, phoneEnc: p.phone ? encrypt(p.phone) : null })),
  });
  return { total: r._count.participants + list.length };
}

/** Organizer sees everything, the operator sees masked phones, an assigned driver sees names only. */
export async function manifest(requestId: string, userId: string) {
  const r = await prisma.groupRequest.findUnique({
    where: { id: requestId },
    include: {
      participants: true,
      quotes: { where: { status: 'ACCEPTED' }, include: { allocations: { where: { active: true }, include: { driverAssignment: true } } } },
    },
  });
  if (!r) throw new AppError('NOT_FOUND', 404);
  const q = r.quotes[0];
  const isDriver = q?.allocations.some(a => a.driverAssignment?.active && a.driverAssignment.driverUserId === userId);
  const level = r.organizerUserId === userId ? 'full' : q?.operatorUserId === userId ? 'masked' : isDriver ? 'names' : null;
  if (!level) throw new AppError('FORBIDDEN', 403, 'Only the organizer, operator and assigned drivers can see the manifest');
  return {
    count: r.participants.length, required: r.passengerCount,
    participants: r.participants.map(p => ({
      name: p.name, notes: p.notes,
      phone: level === 'names' || !p.phoneEnc ? undefined : level === 'full' ? decrypt(p.phoneEnc) : mask(decrypt(p.phoneEnc)),
    })),
  };
}
