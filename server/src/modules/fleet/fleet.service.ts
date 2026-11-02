import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { notify } from '../../utils/notify';
import { toVehicleDto } from '../vehicles/vehicles.service';
import { assertVerifiedDriver } from '../drivers/drivers.service';
import { assertTransition } from '../groups/groups.state';
import { lockRequest } from '../groups/groups.service';
import { AllocationInput, DriverAssignInput, QuoteInput } from '../groups/groups.schema';

export async function openRequests(operatorId: string) {
  const rows = await prisma.groupRequest.findMany({
    where: { OR: [
      { status: 'OPEN_FOR_QUOTES', departureAt: { gt: new Date() } },
      { quotes: { some: { operatorUserId: operatorId, status: 'ACCEPTED' } } },
    ] },
    orderBy: { departureAt: 'asc' }, include: { quotes: { where: { operatorUserId: operatorId } } },
  });
  return rows.map(r => ({
    id: r.id, origin: r.originName, destination: r.destName, departureAt: r.departureAt, returnAt: r.returnAt,
    distanceKm: Math.round(r.distanceMeters / 1000), passengerCount: r.passengerCount, budgetTotalPaise: r.budgetTotalPaise,
    vehiclePreference: r.vehiclePreference, status: r.status,
    myQuote: r.quotes[0] ? { id: r.quotes[0].id, status: r.quotes[0].status, totalPricePaise: r.quotes[0].totalPricePaise } : null,
  }));
}

export async function submitQuote(operatorId: string, requestId: string, input: QuoteInput) {
  const req = await prisma.groupRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== 'OPEN_FOR_QUOTES') throw new AppError('BOOKING_STATE_CONFLICT', 409, 'This request is not taking quotes');
  const fleet = await prisma.vehicle.count({ where: { ownerUserId: operatorId, verificationStatus: 'APPROVED', active: true } });
  if (!fleet) throw new AppError('FORBIDDEN', 403, 'Add and verify at least one vehicle before quoting');
  const q = await prisma.groupQuote.create({
    data: { ...input, groupRequestId: requestId, operatorUserId: operatorId, totalPricePaise: BigInt(input.totalPricePaise) },
  });
  await notify(req.organizerUserId, 'QUOTE_RECEIVED', { requestId, quoteId: q.id });
  return q;
}

export async function allocateVehicles(operatorId: string, requestId: string, input: AllocationInput) {
  return prisma.$transaction(async tx => {
    const req = await lockRequest(tx, requestId);
    assertTransition(req.status, 'ALLOCATED');
    const quote = await tx.groupQuote.findFirst({ where: { groupRequestId: requestId, status: 'ACCEPTED', operatorUserId: operatorId } });
    if (!quote) throw new AppError('FORBIDDEN', 403, 'Only the accepted operator can allocate vehicles');

    const ids = input.allocations.map(a => a.vehicleId);
    if (new Set(ids).size !== ids.length) throw new AppError('VALIDATION_ERROR', 400, 'List each vehicle once');
    const vehicles = await tx.vehicle.findMany({ where: { id: { in: ids } } });
    for (const a of input.allocations) {
      const v = vehicles.find(x => x.id === a.vehicleId);
      if (!v || v.ownerUserId !== operatorId) throw new AppError('FORBIDDEN', 403, 'That vehicle is not in your fleet');
      if (v.verificationStatus !== 'APPROVED') throw new AppError('VEHICLE_UNAVAILABLE', 409, `${v.make} ${v.model} is not verified`);
      if (a.assignedPassengers > v.seatCapacity)
        throw new AppError('VALIDATION_ERROR', 400, `${v.make} ${v.model} has ${v.seatCapacity} seats, not ${a.assignedPassengers}`);
    }

    // Replace the previous allocation (kept as history with active=false).
    const old = await tx.groupAllocation.findMany({ where: { groupQuoteId: quote.id, active: true }, select: { id: true } });
    await tx.driverAssignment.updateMany({ where: { groupAllocationId: { in: old.map(o => o.id) } }, data: { active: false } });
    await tx.groupAllocation.updateMany({ where: { groupQuoteId: quote.id }, data: { active: false } });
    try {
      for (const a of input.allocations) {
        await tx.groupAllocation.create({ data: { groupQuoteId: quote.id, vehicleId: a.vehicleId,
          assignedPassengers: a.assignedPassengers, startAt: req.departureAt, endAt: req.returnAt } });
      }
    } catch (e: any) {
      if (String(e?.message).includes('alloc_vehicle_no_overlap')) throw new AppError('VEHICLE_UNAVAILABLE', 409, 'One of these vehicles is on another trip at that time');
      throw e;
    }
    await tx.groupRequest.update({ where: { id: requestId }, data: { status: 'ALLOCATED' } });
    const allocations = await tx.groupAllocation.findMany({ where: { groupQuoteId: quote.id, active: true }, select: { id: true, vehicleId: true } });
    const assigned = input.allocations.reduce((s, a) => s + a.assignedPassengers, 0);
    return { allocations, required: req.passengerCount, assigned, shortBy: Math.max(0, req.passengerCount - assigned) };
  });
}

export async function assignDrivers(operatorId: string, requestId: string, input: DriverAssignInput) {
  return prisma.$transaction(async tx => {
    for (const a of input.assignments) {
      const alloc = await tx.groupAllocation.findUnique({ where: { id: a.allocationId }, include: { quote: true } });
      if (!alloc?.active || alloc.quote.operatorUserId !== operatorId || alloc.quote.groupRequestId !== requestId) throw new AppError('FORBIDDEN', 403);
      await assertVerifiedDriver(a.driverUserId, tx);
      await tx.driverAssignment.deleteMany({ where: { groupAllocationId: alloc.id } });
      try {
        await tx.driverAssignment.create({ data: { groupAllocationId: alloc.id, driverUserId: a.driverUserId, startAt: alloc.startAt, endAt: alloc.endAt } });
      } catch (e: any) {
        if (String(e?.message).includes('driver_no_overlap')) throw new AppError('DRIVER_UNAVAILABLE', 409, 'This driver is on another trip at that time');
        throw e;
      }
    }
    return { assigned: input.assignments.length };
  });
}

export async function myFleet(operatorId: string) {
  return (await prisma.vehicle.findMany({
    where: { ownerUserId: operatorId, verificationStatus: 'APPROVED', active: true }, orderBy: { seatCapacity: 'desc' },
  })).map(toVehicleDto);
}

export async function approvedDrivers() {
  return (await prisma.driverProfile.findMany({
    where: { verificationStatus: 'APPROVED', licenceExpiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, fullName: true } } },
  })).map(d => ({ id: d.user.id, name: d.user.fullName }));
}
