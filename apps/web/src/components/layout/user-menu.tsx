'use client';

import { ChevronDown, KeyRound, LogOut, User } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLogout } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/use-auth-store';

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  if (!user) return null;

  const initials =
    `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  const displayName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2.5 pl-1.5 pr-2.5 hover:bg-muted"
          aria-label="Menú de usuario"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-white font-semibold text-xs">
            {initials || '?'}
          </div>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium truncate max-w-[140px]">
              {displayName}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {user.role?.name ?? ''}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-0">
        {/* Header con info del usuario */}
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-white font-semibold text-sm">
            {initials || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            {user.email && (
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide font-medium">
              {user.role?.name ?? ''}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="p-1">
          <Link href="/dashboard/usuarios">
            <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors">
              <User className="h-4 w-4 text-muted-foreground" />
              Perfil y usuarios
            </button>
          </Link>
          <Link href="/cambiar-password">
            <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Cambiar contraseña
            </button>
          </Link>
        </div>

        {/* Logout en rojo, destacado */}
        <div className="p-1 border-t">
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors font-medium"
          >
            <LogOut className="h-4 w-4" />
            {logout.isPending ? 'Cerrando sesión...' : 'Cerrar sesión'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
