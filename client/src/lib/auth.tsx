'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getRefreshToken, refreshSession, setSession } from './api';

export type Me = {
  id: string; fullName: string; phone: string; email: string | null; roles: string[];
  driverStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null; driverRejectionReason: string | null;
};
type Ctx = {
  user: Me | null; loading: boolean;
  signIn: (t: { accessToken: string; refreshToken: string }) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  hasRole: (r: string) => boolean;
};

const AuthCtx = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshSession()
      .then(ok => (ok ? api<Me>('/users/me') : null))
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (t: { accessToken: string; refreshToken: string }) => {
    setSession(t);
    setUser(await api<Me>('/users/me'));
  }, []);
  // Roles live inside the access token, so after a role change we rotate the token first.
  const reload = useCallback(async () => {
    await refreshSession();
    setUser(await api<Me>('/users/me'));
  }, []);
  const signOut = useCallback(async () => {
    const rt = getRefreshToken();
    if (rt) await api('/auth/logout', { method: 'POST', body: { refreshToken: rt } }).catch(() => undefined);
    setSession(null);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, signIn, signOut, reload, hasRole: r => !!user?.roles.includes(r) }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
