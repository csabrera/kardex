'use client';

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Box,
  Building,
  Building2,
  ClipboardCheck,
  Droplet,
  FileText,
  HardHat,
  LayoutDashboard,
  Plus,
  Ruler,
  Shield,
  Star,
  Tag,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { useDebounce } from '@/hooks/use-debounce';
import { useItems } from '@/hooks/use-items';
import { useObras } from '@/hooks/use-obras';
import { useWarehouses } from '@/hooks/use-warehouses';

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});

export function useCommandPalette() {
  return React.useContext(CommandPaletteContext);
}

const NAV_ITEMS: {
  label: string;
  href: string;
  icon: React.ElementType;
  keywords?: string;
}[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    keywords: 'inicio home resumen',
  },
  {
    label: 'Almacén Principal · Inventario',
    href: '/dashboard/almacen-principal',
    icon: Star,
    keywords: 'stock items catalogo materiales kardex entrada salida ajuste',
  },
  // Tabs del Almacén Principal — accesibles via deep-link `?tab=`
  {
    label: 'Transferencias',
    href: '/dashboard/almacen-principal?tab=transferencias',
    icon: Warehouse,
    keywords: 'transferir envío recepción',
  },
  {
    label: 'EPP',
    href: '/dashboard/almacen-principal?tab=epp',
    icon: Shield,
    keywords: 'equipo proteccion personal casco guantes asignacion',
  },
  {
    label: 'Equipos',
    href: '/dashboard/equipos',
    icon: Truck,
    keywords: 'maquinaria vehiculos horometro',
  },
  {
    label: 'Combustible',
    href: '/dashboard/almacen-principal?tab=combustible',
    icon: Droplet,
    keywords: 'gasolina diesel despacho abastecimiento',
  },
  {
    label: 'Mantenimientos',
    href: '/dashboard/almacen-principal?tab=mantenimientos',
    icon: Wrench,
    keywords: 'preventivo correctivo servicio',
  },
  {
    label: 'Préstamos de herramientas',
    href: '/dashboard/almacen-principal?tab=prestamos',
    icon: Wrench,
    keywords: 'prestamos loans herramientas',
  },
  {
    label: 'Inventarios físicos',
    href: '/dashboard/almacen-principal?tab=inventarios',
    icon: ClipboardCheck,
    keywords: 'conteo ajuste',
  },
  {
    label: 'Movimientos del Principal',
    href: '/dashboard/almacen-principal?tab=movimientos',
    icon: FileText,
    keywords: 'kardex entrada salida ajuste historico',
  },
  { label: 'Alertas', href: '/dashboard/alertas', icon: AlertTriangle },
  { label: 'Obras', href: '/dashboard/obras', icon: Building },
  {
    label: 'Empleados',
    href: '/dashboard/empleados',
    icon: HardHat,
    keywords: 'trabajadores workers',
  },
  { label: 'Almacenes', href: '/dashboard/almacenes', icon: Warehouse },
  {
    label: 'Proveedores',
    href: '/dashboard/proveedores',
    icon: Truck,
    keywords: 'suppliers compras RUC contactos',
  },
  { label: 'Categorías', href: '/dashboard/categorias', icon: Tag },
  { label: 'Unidades', href: '/dashboard/unidades', icon: Ruler },
  { label: 'Usuarios', href: '/dashboard/usuarios', icon: Users },
];

const QUICK_ACTIONS: {
  label: string;
  href: string;
  icon: React.ElementType;
  keywords?: string;
}[] = [
  {
    label: 'Registrar entrada al Principal',
    href: '/dashboard/almacen-principal',
    icon: ArrowRight,
    keywords: 'compra entrada movimiento',
  },
  {
    label: 'Nueva transferencia',
    href: '/dashboard/transferencias/nueva',
    icon: ArrowRight,
  },
  {
    label: 'Nuevo ítem',
    href: '/dashboard/almacen-principal?action=new',
    icon: Plus,
    keywords: 'crear nuevo material inventario',
  },
  { label: 'Nueva obra', href: '/dashboard/obras', icon: Plus },
  {
    label: 'Ver alertas pendientes',
    href: '/dashboard/alertas',
    icon: Bell,
    keywords: 'notificaciones stock bajo',
  },
];

function CommandPaletteInner() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const debounced = useDebounce(query, 250);

  const runCommand = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  // Clear query when dialog closes so next open starts fresh
  React.useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setQuery(''), 150);
    return () => clearTimeout(t);
  }, [open]);

  const hasSearch = debounced.trim().length >= 2;

  const itemsQuery = useItems({ pageSize: 6, search: hasSearch ? debounced : undefined });
  const obrasQuery = useObras({ pageSize: 6, search: hasSearch ? debounced : undefined });
  const warehousesQuery = useWarehouses({
    pageSize: 6,
    search: hasSearch ? debounced : undefined,
  });

  const normalized = query.toLowerCase().trim();
  const matches = (text: string | undefined) =>
    !normalized || !text ? true : text.toLowerCase().includes(normalized);

  const filteredNav = NAV_ITEMS.filter((n) => matches(n.label) || matches(n.keywords));
  const filteredActions = QUICK_ACTIONS.filter(
    (a) => matches(a.label) || matches(a.keywords),
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar ítems, obras, almacenes o ir a..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Sin resultados para &quot;{query}&quot;.</CommandEmpty>

        {filteredActions.length > 0 && (
          <CommandGroup heading="Acciones rápidas">
            {filteredActions.map((action) => (
              <CommandItem
                key={action.href + action.label}
                value={`action-${action.label}`}
                onSelect={() => runCommand(action.href)}
              >
                <action.icon />
                <span>{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredNav.length > 0 && (
          <CommandGroup heading="Ir a">
            {filteredNav.map((nav) => (
              <CommandItem
                key={nav.href}
                value={`nav-${nav.label}`}
                onSelect={() => runCommand(nav.href)}
              >
                <nav.icon />
                <span>{nav.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasSearch && (itemsQuery.data?.items.length ?? 0) > 0 && (
          <CommandGroup heading="Ítems del catálogo">
            {itemsQuery.data!.items.map((item) => (
              <CommandItem
                key={item.id}
                value={`item-${item.id}`}
                onSelect={() => runCommand(`/dashboard/items/${item.id}`)}
              >
                <Box />
                <span className="truncate">{item.name}</span>
                <CommandShortcut>{item.category.name}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasSearch && (obrasQuery.data?.items.length ?? 0) > 0 && (
          <CommandGroup heading="Obras">
            {obrasQuery.data!.items.map((obra) => (
              <CommandItem
                key={obra.id}
                value={`obra-${obra.id}`}
                onSelect={() => runCommand(`/dashboard/obras/${obra.id}`)}
              >
                <Building />
                <span className="truncate">{obra.name}</span>
                <CommandShortcut>{obra.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasSearch && (warehousesQuery.data?.items.length ?? 0) > 0 && (
          <CommandGroup heading="Almacenes">
            {warehousesQuery.data!.items.map((w) => (
              <CommandItem
                key={w.id}
                value={`wh-${w.id}`}
                onSelect={() => runCommand('/dashboard/almacenes')}
              >
                {w.type === 'CENTRAL' ? <Star /> : <Warehouse />}
                <span className="truncate">{w.name}</span>
                <CommandShortcut>
                  {w.type === 'CENTRAL' ? 'Principal' : 'Obra'}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3 w-3" />
          <span>Kardex</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">↑↓</kbd>
          <span>moverse</span>
          <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">↵</kbd>
          <span>abrir</span>
          <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">esc</kbd>
          <span>cerrar</span>
        </div>
      </div>
    </CommandDialog>
  );
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  const toggle = React.useCallback(() => setOpen((v) => !v), []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const value = React.useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPaletteInner />
    </CommandPaletteContext.Provider>
  );
}
