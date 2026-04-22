'use client';

import type { ReactNode } from 'react';

import { QueryProvider } from './query-provider';
import { SocketProvider } from './socket-provider';
import { ThemeProvider } from './theme-provider';
import { ToastProvider } from './toast-provider';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root providers composition.
 *
 * Order matters:
 * 1. ThemeProvider (outermost) — affects all children including toasts
 * 2. QueryProvider — server cache for API data
 * 3. SocketProvider — real-time events, depends on auth (wired in Fase 5B)
 * 4. Children render
 * 5. ToastProvider — bottom-level UI layer
 */
export function Providers({ children }: ProvidersProps): JSX.Element {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <SocketProvider>
          {children}
          <ToastProvider />
        </SocketProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
