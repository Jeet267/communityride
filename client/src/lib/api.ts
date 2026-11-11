const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: any) { super(message); }
}

// Access token lives in memory only; the refresh token is kept in localStorage so a reload keeps you signed in.
// Production upgrade: move the refresh token to an httpOnly cookie (see README).
let accessToken: string | null = null;
const RT = 'rm_refresh';
const store = {
  get: () => { try { return localStorage.getItem(RT); } catch { return null; } },
  set: (v: string | null) => { try { v ? localStorage.setItem(RT, v) : localStorage.removeItem(RT); } catch { /* storage blocked */ } },
};

export const getRefreshToken = () => store.get();
export function setSession(t: { accessToken: string; refreshToken: string } | null) {
  accessToken = t?.accessToken ?? null;
  store.set(t?.refreshToken ?? null);
}

// Single-flight refresh: refresh tokens rotate, so two parallel refreshes would log the user out.
let inflight: Promise<boolean> | null = null;
export function refreshSession() {
  if (!inflight) {
    inflight = (async () => {
      const rt = store.get();
      if (!rt) return false;
      try {
        const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
        if (!r.ok) { setSession(null); return false; }
        const { data } = await r.json();
        setSession(data);
        return true;
      } catch { return false; }
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

type Opts = { method?: string; body?: unknown; form?: FormData; idempotencyKey?: string };

export async function api<T = any>(path: string, opts: Opts = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (!opts.form) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server. Is the API running?', 0);
  }
  if (res.status === 401 && retry && (await refreshSession())) return api<T>(path, opts, false);
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!json?.success) throw new ApiError(json?.error?.code ?? 'INTERNAL', json?.error?.message ?? 'Something went wrong', res.status, json?.error?.details);
  return json.data as T;
}

/** Opens a private admin document (needs the auth header, so it cannot be a plain link). */
export async function openPrivateDoc(key: string) {
  const res = await fetch(`${BASE}/admin/documents/${key}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  if (!res.ok) throw new ApiError('NOT_FOUND', 'Document not found', res.status);
  window.open(URL.createObjectURL(await res.blob()), '_blank');
}
