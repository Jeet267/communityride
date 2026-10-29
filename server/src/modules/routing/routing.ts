import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';

export type LatLng = { lat: number; lng: number };
type RouteResult = { distanceMeters: number; durationSeconds: number; provider: string };
interface RoutingAdapter { route(a: LatLng, b: LatLng): Promise<RouteResult> }

/** Free OSRM road routing. Swap for Google/Ola Maps by adding another adapter. */
const osrm: RoutingAdapter = {
  async route(a, b) {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const j: any = await res.json();
    if (j.code !== 'Ok' || !j.routes?.[0]) throw new Error('No route');
    return { distanceMeters: Math.round(j.routes[0].distance), durationSeconds: Math.round(j.routes[0].duration), provider: 'osrm' };
  },
};

/** Offline adapter: straight-line distance × 1.3 (typical Indian road detour). Tests can pin an exact value. */
let pinnedDistance: number | null = null;
export const setMockDistance = (m: number | null) => { pinnedDistance = m; };
const toRad = (d: number) => (d * Math.PI) / 180;
const haversine = (a: LatLng, b: LatLng) => {
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};
const mock: RoutingAdapter = {
  async route(a, b) {
    const d = pinnedDistance ?? Math.round(haversine(a, b) * 1.3);
    return { distanceMeters: d, durationSeconds: Math.round(d / 16), provider: 'mock' };
  },
};

/** Server-side 500 km rule. Fails closed when the maps provider is down. */
export async function getValidatedRoute(a: LatLng, b: LatLng): Promise<RouteResult> {
  const adapter = env.ROUTING_PROVIDER === 'mock' ? mock : osrm;
  let r: RouteResult;
  try { r = await adapter.route(a, b); }
  catch { throw new AppError('DISTANCE_UNAVAILABLE', 503, 'We could not calculate this route. Try again in a minute.'); }
  if (r.distanceMeters <= 0) throw new AppError('VALIDATION_ERROR', 400, 'Pickup and drop are the same place.');
  if (r.distanceMeters > env.MAX_JOURNEY_METERS) throw new AppError('DISTANCE_LIMIT_EXCEEDED', 422,
    `This route is ${Math.round(r.distanceMeters / 1000)} km. RideMate supports journeys up to 500 km.`,
    { distanceMeters: r.distanceMeters, maxMeters: env.MAX_JOURNEY_METERS });
  return r;
}
