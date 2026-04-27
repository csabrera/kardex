import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Estado del sidebar:
 *  - `collapsed`: modo compacto (64px, solo íconos con tooltip). Persistido en localStorage.
 *  - `mobileOpen`: controla el drawer en viewports < lg. No se persiste.
 */
interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
  setMobileOpen: (value: boolean) => void;
  closeMobile: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      mobileOpen: false,
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (value) => set({ collapsed: value }),
      setMobileOpen: (value) => set({ mobileOpen: value }),
      closeMobile: () => set({ mobileOpen: false }),
    }),
    {
      name: 'kardex-sidebar',
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);
