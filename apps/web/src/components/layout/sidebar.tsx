'use client';

import {
  AlertTriangle,
  BarChart3,
  Building,
  Building2,
  LayoutDashboard,
  Ruler,
  ShieldCheck,
  Star,
  Tag,
  Truck,
  Users,
  Warehouse,
  HardHat,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuthStore } from '@/stores/use-auth-store';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

type NavSection = { title?: string; items: NavItem[] };

// ──────────────────────────────────────────────────────────────────────
// ALMACENERO — operativo, hub = /almacen-principal con tabs
// (las URLs viejas /transferencias, /epp, /herramientas, /combustible,
//  /mantenimientos, /inventarios redirigen al tab correspondiente)
// ──────────────────────────────────────────────────────────────────────
const ALMACENERO_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      // Almacén Principal absorbió el antiguo `/items` — ahora es el hub del
      // inventario con 8 tabs. Entrada única para el catálogo + operaciones.
      { label: 'Almacén Principal', href: '/dashboard/almacen-principal', icon: Star },
    ],
  },
  {
    title: 'Organización',
    items: [
      { label: 'Obras', href: '/dashboard/obras', icon: Building },
      { label: 'Empleados', href: '/dashboard/empleados', icon: HardHat },
      { label: 'Almacenes', href: '/dashboard/almacenes', icon: Warehouse },
      { label: 'Equipos', href: '/dashboard/equipos', icon: Truck },
      { label: 'Proveedores', href: '/dashboard/proveedores', icon: Truck },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { label: 'Reportes', href: '/dashboard/reportes', icon: BarChart3 },
      { label: 'Alertas', href: '/dashboard/alertas', icon: AlertTriangle },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────
// ADMIN — Opción B: operativo + administrativo
// (mismo hub que el almacenero + secciones de administración del sistema)
// ──────────────────────────────────────────────────────────────────────
const ADMIN_SECTIONS: NavSection[] = [
  ...ALMACENERO_SECTIONS,
  {
    title: 'Administración',
    items: [
      { label: 'Usuarios', href: '/dashboard/usuarios', icon: Users },
      { label: 'Auditoría', href: '/dashboard/auditoria', icon: ShieldCheck },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { label: 'Categorías', href: '/dashboard/categorias', icon: Tag },
      { label: 'Unidades', href: '/dashboard/unidades', icon: Ruler },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────
// RESIDENTE — solo /mi-obra (intacto desde Fase 7A)
// ──────────────────────────────────────────────────────────────────────
const RESIDENTE_SECTIONS: NavSection[] = [
  {
    items: [{ label: 'Mi Obra', href: '/dashboard/mi-obra', icon: Building }],
  },
];

function getSectionsForRole(roleName?: string): NavSection[] {
  if (roleName === 'RESIDENTE') return RESIDENTE_SECTIONS;
  if (roleName === 'ADMIN') return ADMIN_SECTIONS;
  return ALMACENERO_SECTIONS;
}

/**
 * Sidebar principal basado en shadcn/ui v2 primitives.
 *
 * - Desktop: colapsa a "icon mode" (solo íconos con tooltip) vía `Ctrl+B`.
 * - Mobile: se renderiza como Sheet (drawer lateral) automáticamente.
 * - Estado persistido en cookie `kardex-sidebar:state` por SidebarProvider.
 *
 * Tres perfiles distintos:
 *  - ADMIN: operativo + administrativo (Opción B del Nivel C)
 *  - ALMACENERO: solo operativo, mismo hub que comparte con el RESIDENTE
 *  - RESIDENTE: una sola entrada `/mi-obra` con tabs internas
 */
export function AppSidebar() {
  const roleName = useAuthStore((s) => s.user?.role?.name);
  const sections = getSectionsForRole(roleName);
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-none">Kardex</span>
            <span className="text-[11px] text-sidebar-foreground/70 leading-tight mt-0.5 truncate">
              Inventario constructora
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section, idx) => (
          <SidebarGroup key={idx}>
            {section.title && <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  // Match exacto para el root /dashboard (si usamos `startsWith` se
                  // activa en TODAS las sub-rutas porque /dashboard es prefijo de todo).
                  // Para el resto de entradas, startsWith cubre las fichas hijas
                  // (ej. /dashboard/items/[id] debe activar "Ítems").
                  const isRoot = item.href === '/dashboard';
                  const isActive = isRoot
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <p className="text-[10px] text-sidebar-foreground/50 text-center px-2 py-1 group-data-[collapsible=icon]:hidden">
          Kardex © {new Date().getFullYear()} · v0.1.0
        </p>
      </SidebarFooter>
      {/* SidebarRail eliminado: el toggle ya está en topbar (<SidebarTrigger>)
          y con atajo Ctrl+B. El rail promete resize (cursor w-resize) pero
          solo hace toggle — affordance engañoso */}
    </Sidebar>
  );
}
