export type Role = 'PASSENGER' | 'DRIVER' | 'RENTAL_OWNER' | 'FLEET_OPERATOR' | 'ADMIN';

/** The "Sign in as …" choices on the login screen, in the order they are shown. */
export const LOGIN_ROLES: { role: Role; label: string; hint: string }[] = [
  { role: 'PASSENGER', label: 'Passenger', hint: 'Book seats, rent vehicles, group trips' },
  { role: 'DRIVER', label: 'Driver', hint: 'Publish rides from your car' },
  { role: 'RENTAL_OWNER', label: 'Car owner', hint: 'Rent out your car, bike or scooter' },
  { role: 'FLEET_OPERATOR', label: 'Bus fleet', hint: 'Quote and run group trips' },
  { role: 'ADMIN', label: 'Admin', hint: 'Verify drivers and vehicles' },
];

export const ROLE_LABEL: Record<Role, string> = {
  PASSENGER: 'Passenger', DRIVER: 'Driver', RENTAL_OWNER: 'Car owner', FLEET_OPERATOR: 'Bus fleet', ADMIN: 'Admin',
};

/** Each role's dashboard. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin', FLEET_OPERATOR: '/fleet', DRIVER: '/driver', RENTAL_OWNER: '/rentals/manage', PASSENGER: '/rides',
};

/** "My dashboard" in the menu: the strongest role the account has. */
export function homeFor(roles: string[] = []): string {
  const order: Role[] = ['ADMIN', 'FLEET_OPERATOR', 'DRIVER', 'RENTAL_OWNER', 'PASSENGER'];
  return ROLE_HOME[order.find(r => roles.includes(r)) ?? 'PASSENGER'];
}

/** A first-time driver must finish onboarding; owners and fleets add a vehicle first. */
export function firstStepFor(role: Role): string {
  if (role === 'DRIVER') return '/driver/onboarding';
  if (role === 'RENTAL_OWNER' || role === 'FLEET_OPERATOR') return '/vehicles';
  return ROLE_HOME[role];
}

/** After login: a safe `next=` link wins; otherwise the dashboard of the role they signed in as. */
export function afterLogin(loginAs: Role, next: string | null, isNewUser = false): string {
  if (next && next !== '/' && next.startsWith('/') && !next.startsWith('//')) return next;
  return isNewUser ? firstStepFor(loginAs) : ROLE_HOME[loginAs];
}
