'use client';

/**
 * Socket.IO provider placeholder for Fase 5B.
 *
 * Will be implemented in Fase 5B to provide:
 * - Global Socket.IO connection with JWT auth
 * - Automatic reconnection
 * - Room subscriptions based on user + warehouse
 * - Event handlers that invalidate TanStack Query cache
 */

import { createContext, useContext, type ReactNode } from 'react';

interface SocketContextValue {
  connected: boolean;
  // Will be extended with emit, on, off helpers in Fase 5B
}

const SocketContext = createContext<SocketContextValue>({
  connected: false,
});

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps): JSX.Element {
  // TODO(Fase 5B): Implement Socket.IO client with @kardex/types/enums WS_EVENTS

  return (
    <SocketContext.Provider value={{ connected: false }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
