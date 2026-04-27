'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/use-auth-store';

import type { UserPublic } from '@kardex/types';

/**
 * Restores the access token from the httpOnly refresh-token cookie and
 * re-hydrates the user from /auth/me before rendering authenticated content.
 *
 * Without this, a page refresh loses the in-memory accessToken, queries fire
 * without auth, and stale user data (e.g. outdated role shape) leaks into the
 * sidebar/routing. We block children until both token AND user are fresh.
 */
export function SessionInitializer({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let token = accessToken;

        // 1. Si no hay token en memoria, refrescarlo con el cookie httpOnly.
        if (!token) {
          const { data } = await apiClient.post<{ data: { accessToken: string } }>(
            '/auth/refresh',
          );
          token = data.data.accessToken;
        }

        // 2. SIEMPRE re-hidratar el user desde /auth/me para asegurar el
        //    shape correcto de role (objeto, no string) y permisos actualizados.
        const meRes = await apiClient.get<{ data: UserPublic }>('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSession(meRes.data.data, token);
        setReady(true);
      } catch {
        clearSession();
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          // ignore
        }
        window.location.replace('/login');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
