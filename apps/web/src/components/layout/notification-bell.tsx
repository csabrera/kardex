'use client';

import { Bell, CheckCheck, Wifi, WifiOff, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { useSocket, type Notification } from '@/providers/socket-provider';

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(ts).toLocaleDateString('es-PE');
}

function NotificationItem({ n, onClick }: { n: Notification; onClick: () => void }) {
  const isAlert = n.event === 'alert.created';
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-accent transition-colors',
        !n.read && 'bg-primary/5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <div
              className={cn(
                'h-1.5 w-1.5 rounded-full shrink-0',
                !n.read ? 'bg-primary' : 'bg-transparent',
              )}
            />
            <p
              className={cn(
                'text-xs font-medium truncate',
                isAlert && 'text-amber-600 dark:text-amber-400',
              )}
            >
              {n.title}
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
            {n.message}
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatRelative(n.timestamp)}
        </span>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const {
    connected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useSocket();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-10 w-10 p-0"
          aria-label="Notificaciones"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span
            className={cn(
              'absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full',
              connected ? 'bg-green-500' : 'bg-muted-foreground/50',
            )}
            title={connected ? 'Conectado en tiempo real' : 'Desconectado'}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Notificaciones</span>
            {connected ? (
              <Wifi className="h-3 w-3 text-green-500" aria-label="Conectado" />
            ) : (
              <WifiOff
                className="h-3 w-3 text-muted-foreground"
                aria-label="Desconectado"
              />
            )}
          </div>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={markAllAsRead}
                title="Marcar todas como leídas"
              >
                <CheckCheck className="h-3 w-3" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={clearNotifications}
                title="Limpiar"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-xs text-muted-foreground gap-2">
              <Bell className="h-6 w-6 opacity-50" />
              <p>No hay notificaciones</p>
              {!connected && (
                <p className="text-[10px]">· Conexión en tiempo real no activa ·</p>
              )}
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} n={n} onClick={() => markAsRead(n.id)} />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
