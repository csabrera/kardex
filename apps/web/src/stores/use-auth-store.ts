import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth state store.
 *
 * In Fase 2A:
 * - accessToken is stored in memory (not localStorage) for security
 * - refreshToken lives in httpOnly cookie (set by backend)
 * - user is hydrated from /auth/me on page load
 *
 * Only the userId is persisted to recover the session client-side;
 * the actual token comes from the refresh flow.
 */

import type { UserPublic } from '@kardex/types';

interface AuthState {
  user: UserPublic | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  setUser: (user: UserPublic | null) => void;
  setAccessToken: (token: string | null) => void;
  setSession: (user: UserPublic, token: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setAccessToken: (token) => set({ accessToken: token }),
      setSession: (user, token) =>
        set({ user, accessToken: token, isAuthenticated: true }),
      clearSession: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'kardex-auth',
      // Only persist user info (not tokens — they come from refresh)
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
