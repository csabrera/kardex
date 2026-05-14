'use client';

import { ChevronRight, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { SidebarTrigger } from '@/components/ui/sidebar';

import { useCommandPalette } from './command-palette';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/almacen-principal': 'Almacén Principal',
  '/dashboard/obras': 'Obras',
  '/dashboard/empleados': 'Empleados',
  '/dashboard/almacenes': 'Almacenes',
  '/dashboard/categorias': 'Categorías',
  '/dashboard/unidades': 'Unidades',
  '/dashboard/items': 'Ítems',
  '/dashboard/alertas': 'Alertas',
  '/dashboard/transferencias': 'Transferencias',
  '/dashboard/herramientas': 'Herramientas',
  '/dashboard/usuarios': 'Usuarios',
  '/dashboard/compras': 'Compras',
  '/dashboard/proveedores': 'Proveedores',
  '/dashboard/reportes': 'Reportes',
  '/dashboard/auditoria': 'Auditoría',
  '/dashboard/especialidades': 'Especialidades',
  '/dashboard/mi-obra': 'Mi Obra',
};

function useCurrentTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  const match = Object.keys(ROUTE_TITLES)
    .filter((r) => pathname.startsWith(r + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_TITLES[match]! : '';
}

export function Topbar() {
  const pathname = usePathname();
  const title = useCurrentTitle(pathname);
  const { setOpen } = useCommandPalette();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 sm:gap-4 border-b border-border/60 bg-background/80 backdrop-blur-md px-4 sm:px-6 lg:px-10 shrink-0">
      {/* Trigger del sidebar — en desktop hace toggle collapsed/expanded, en mobile abre el Sheet */}
      <SidebarTrigger className="-ml-1" />

      {/* Breadcrumb — Kardex como brand mark + título de página */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0">
        <span className="font-display text-[15px] font-semibold tracking-tight text-foreground/90 hidden sm:inline">
          Kardex
        </span>
        {title && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 hidden sm:inline" />
            <span className="text-sm font-medium text-foreground truncate">{title}</span>
          </>
        )}
      </nav>

      {/* Búsqueda global — abre el Command Palette (⌘K) */}
      <div className="flex-1 max-w-lg hidden md:block">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir búsqueda (Ctrl+K)"
          className="group relative w-full h-9 pl-10 pr-14 text-sm rounded-lg border border-border/70 bg-muted/30 text-left text-muted-foreground transition-base hover:bg-muted hover:border-border hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 group-hover:text-foreground transition-fast pointer-events-none" />
          <span className="truncate">Buscar ítems, obras, comandos...</span>
          <kbd className="hidden lg:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 shadow-soft transition-fast group-hover:border-foreground/30 group-hover:text-foreground">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-0.5">
        <ThemeToggle />
        <NotificationBell />
        <div className="w-px h-5 bg-border/60 mx-1.5" />
        <UserMenu />
      </div>
    </header>
  );
}
