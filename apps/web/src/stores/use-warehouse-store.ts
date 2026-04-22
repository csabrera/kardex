import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WarehouseState {
  /** Currently active warehouse (for filtering stock views, etc.) */
  activeWarehouseId: string | null;
  setActiveWarehouse: (id: string | null) => void;
  clearActiveWarehouse: () => void;
}

export const useWarehouseStore = create<WarehouseState>()(
  persist(
    (set) => ({
      activeWarehouseId: null,
      setActiveWarehouse: (id) => set({ activeWarehouseId: id }),
      clearActiveWarehouse: () => set({ activeWarehouseId: null }),
    }),
    {
      name: 'kardex-active-warehouse',
    },
  ),
);
