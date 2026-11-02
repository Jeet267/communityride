import { GroupStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';

/** Every allowed move in one table. ALLOCATED -> ALLOCATED lets the operator fix an allocation (47 -> 52). */
const allowed: Record<GroupStatus, GroupStatus[]> = {
  OPEN_FOR_QUOTES: ['QUOTE_ACCEPTED', 'CANCELLED'],
  QUOTE_ACCEPTED: ['ALLOCATED', 'CANCELLED'],
  ALLOCATED: ['ALLOCATED', 'CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  CANCELLED: [],
};

export function assertTransition(from: GroupStatus, to: GroupStatus) {
  if (!allowed[from].includes(to)) throw new AppError('BOOKING_STATE_CONFLICT', 409, `Cannot move this request from ${from} to ${to}`);
}
