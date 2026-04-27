'use client';

import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CommandPaletteProvider } from '@/components/layout/command-palette';
import { NavigationProgress } from '@/components/layout/navigation-progress';
import { SessionInitializer } from '@/components/layout/session-initializer';
import { AppSidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';

const SIDEBAR_COOKIE_NAME = 'kardex-sidebar:state';

/** Lee la cookie del Provider (se setea en cliente al usar el toggle). */
function readSidebarCookie(): boolean {
  if (typeof document === 'undefined') return true;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
  if (!match) return true;
  return match.split('=')[1] !== 'false';
}

/**
 * Cierra el drawer mobile automáticamente al navegar.
 *
 * Vive dentro del SidebarProvider para poder usar `useSidebar()`.
 */
function MobileAutoClose() {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Lazy init desde la cookie en el primer render client-side. El SidebarProvider
  // persiste automáticamente el estado en `kardex-sidebar:state`, así que NO hay
  // que pasarle `onOpenChange` (hacerlo lo pone en modo "controlled parcial" y
  // el toggle deja de actualizar el estado interno).
  const [defaultOpen] = useState<boolean>(readSidebarCookie);

  return (
    <SessionInitializer>
      <CommandPaletteProvider>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <SidebarProvider defaultOpen={defaultOpen}>
          <MobileAutoClose />
          <AppSidebar />
          <SidebarInset>
            <Topbar />
            <main className="flex-1 overflow-y-auto bg-muted/30 dark:bg-background">
              <div className="w-full px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10 2xl:px-12 2xl:py-12">
                {children}
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </CommandPaletteProvider>
    </SessionInitializer>
  );
}
