'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/use-auth-store';

export const WS_EVENTS = {
  TRANSFER_PENDING: 'transfer.pending',
  TRANSFER_APPROVED: 'transfer.approved',
  TRANSFER_IN_TRANSIT: 'transfer.in_transit',
  TRANSFER_RECEIVED: 'transfer.received',
  TRANSFER_REJECTED: 'transfer.rejected',
  TRANSFER_CANCELLED: 'transfer.cancelled',
  STOCK_CHANGED: 'stock.changed',
  ALERT_CREATED: 'alert.created',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
} as const;

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

export interface Notification {
  id: string;
  event: WsEvent;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: unknown;
}

interface SocketContextValue {
  connected: boolean;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  on: <T = unknown>(event: WsEvent, handler: (payload: T) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue>({
  connected: false,
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
  on: () => () => {},
});

const NOTIF_TITLES: Record<WsEvent, string> = {
  [WS_EVENTS.TRANSFER_PENDING]: 'Nueva transferencia solicitada',
  [WS_EVENTS.TRANSFER_APPROVED]: 'Transferencia aprobada',
  [WS_EVENTS.TRANSFER_IN_TRANSIT]: 'Transferencia en tránsito',
  [WS_EVENTS.TRANSFER_RECEIVED]: 'Transferencia recibida',
  [WS_EVENTS.TRANSFER_REJECTED]: 'Transferencia rechazada',
  [WS_EVENTS.TRANSFER_CANCELLED]: 'Transferencia cancelada',
  [WS_EVENTS.STOCK_CHANGED]: 'Cambio de stock',
  [WS_EVENTS.ALERT_CREATED]: 'Nueva alerta',
  [WS_EVENTS.CONNECTED]: '',
  [WS_EVENTS.DISCONNECTED]: '',
};

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

export function SocketProvider({ children }: { children: ReactNode }): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[socket] connect_error:', err.message);
    });

    // Handlers que invalidan queries de TanStack Query y crean notificaciones
    const pushNotification = (event: WsEvent, message: string, data: unknown) => {
      setNotifications((prev) =>
        [
          {
            id: `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            event,
            title: NOTIF_TITLES[event] || event,
            message,
            timestamp: Date.now(),
            read: false,
            data,
          },
          ...prev,
        ].slice(0, 50),
      );
    };

    const onTransfer = (event: WsEvent) => (t: any) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      const msg = `${t.code}: ${t.fromWarehouse?.name ?? '—'} → ${t.toWarehouse?.name ?? '—'}`;
      pushNotification(event, msg, t);
      toast.info(`${NOTIF_TITLES[event]} · ${t.code}`);
    };

    socket.on(WS_EVENTS.TRANSFER_PENDING, onTransfer(WS_EVENTS.TRANSFER_PENDING));
    socket.on(WS_EVENTS.TRANSFER_APPROVED, onTransfer(WS_EVENTS.TRANSFER_APPROVED));
    socket.on(WS_EVENTS.TRANSFER_IN_TRANSIT, onTransfer(WS_EVENTS.TRANSFER_IN_TRANSIT));
    socket.on(WS_EVENTS.TRANSFER_RECEIVED, onTransfer(WS_EVENTS.TRANSFER_RECEIVED));
    socket.on(WS_EVENTS.TRANSFER_REJECTED, onTransfer(WS_EVENTS.TRANSFER_REJECTED));
    socket.on(WS_EVENTS.TRANSFER_CANCELLED, onTransfer(WS_EVENTS.TRANSFER_CANCELLED));

    socket.on(WS_EVENTS.STOCK_CHANGED, (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['kardex'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      // Stock changes no generan notificación visible (demasiado frecuentes)
      void data;
    });

    socket.on(WS_EVENTS.ALERT_CREATED, (alert: any) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      const msg = `${alert.message ?? `${alert.item?.name} en ${alert.warehouse?.name ?? ''}`}`;
      pushNotification(WS_EVENTS.ALERT_CREATED, msg, alert);
      if (alert.type === 'STOCK_CRITICO') {
        toast.error(msg);
      } else {
        toast.warning(msg);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken, queryClient]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const on = useCallback(
    <T = unknown,>(event: WsEvent, handler: (payload: T) => void): (() => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on(event, handler as (payload: unknown) => void);
      return () => socket.off(event, handler as (payload: unknown) => void);
    },
    [],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SocketContext.Provider
      value={{
        connected,
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        on,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

export function useNotifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } =
    useSocket();
  return { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications };
}
