'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  Box,
  ChevronDown,
  Cog,
  Edit2,
  ExternalLink,
  FileUp,
  Plus,
  Shield,
  SlidersHorizontal,
  Trash2,
  Truck,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { ImportDialog } from '@/components/items/import-dialog';
import { QuickAdjustDialog } from '@/components/items/quick-adjust-dialog';
import {
  QuickCreateCategoryDialog,
  QuickCreateSupplierDialog,
  QuickCreateUnitDialog,
} from '@/components/items/quick-create-dialogs';
import { QuickEntryDialog } from '@/components/items/quick-entry-dialog';
import { QuickOutgoingDialog } from '@/components/items/quick-outgoing-dialog';
import { QuickTransferDialog } from '@/components/items/quick-transfer-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { type Category, useCategories } from '@/hooks/use-categories';
import { useDebounce } from '@/hooks/use-debounce';
import {
  type Item,
  type ItemType,
  type CreateItemDto,
  useItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from '@/hooks/use-items';
import { type Supplier, useSuppliers } from '@/hooks/use-suppliers';
import { type Unit, useUnits } from '@/hooks/use-units';
import { cn } from '@/lib/cn';

const ITEM_TYPE_META: Record<
  ItemType,
  { label: string; icon: React.ElementType; description: string; variant: string }
> = {
  MATERIAL: {
    label: 'Material',
    icon: Box,
    description: 'Cemento, arena, agregados',
    variant: 'info',
  },
  HERRAMIENTA: {
    label: 'Herramienta',
    icon: Wrench,
    description: 'Taladros, llaves, que se prestan',
    variant: 'warning',
  },
  EPP: {
    label: 'EPP',
    icon: Shield,
    description: 'Cascos, arneses, guantes',
    variant: 'success',
  },
  EQUIPO: {
    label: 'Equipo',
    icon: Truck,
    description: 'Maquinaria con horómetro',
    variant: 'secondary',
  },
  REPUESTO: {
    label: 'Repuesto',
    icon: Cog,
    description: 'Repuestos y consumibles',
    variant: 'outline',
  },
};

const ITEM_TYPES: ItemType[] = ['MATERIAL', 'HERRAMIENTA', 'EPP', 'EQUIPO', 'REPUESTO'];

// Motivos del movimiento inicial (reflejan MovementSource del backend)
const INITIAL_SOURCES = [
  { value: 'COMPRA', label: 'Compra a proveedor' },
  { value: 'DEVOLUCION', label: 'Devolución de obra' },
  { value: 'AJUSTE', label: 'Ajuste de inventario' },
] as const;

const schema = z
  .object({
    name: z.string().min(1, 'Requerido').max(200),
    description: z.string().max(1000).optional(),
    type: z.enum(['MATERIAL', 'HERRAMIENTA', 'EPP', 'EQUIPO', 'REPUESTO']),
    categoryId: z.string().min(1, 'Requerido'),
    unitId: z.string().min(1, 'Requerido'),
    minStock: z.coerce.number().min(0).optional(),
    maxStock: z.coerce.number().min(0).optional(),
    // Carga inicial
    loadInitialStock: z.boolean().optional(),
    initialStock: z.coerce.number().min(0).optional(),
    initialUnitCost: z.coerce.number().min(0).optional(),
    initialSource: z.enum(['COMPRA', 'DEVOLUCION', 'AJUSTE']).optional(),
    initialSupplierId: z.string().optional(),
    initialNotes: z.string().max(500).optional(),
  })
  .refine(
    (d) =>
      d.maxStock === undefined ||
      d.minStock === undefined ||
      Number(d.maxStock) >= Number(d.minStock),
    { message: 'El máximo debe ser ≥ al mínimo', path: ['maxStock'] },
  )
  .refine((d) => !d.loadInitialStock || Number(d.initialStock ?? 0) > 0, {
    message: 'Cantidad requerida (> 0) cuando cargas stock inicial',
    path: ['initialStock'],
  })
  .refine(
    (d) => !d.loadInitialStock || d.initialSource !== 'COMPRA' || !!d.initialSupplierId,
    {
      message: 'Proveedor requerido cuando el motivo es COMPRA',
      path: ['initialSupplierId'],
    },
  );
type FormData = z.infer<typeof schema>;

const LS_LAST_CATEGORY = 'kardex-item-form:last-category';
const LS_LAST_UNIT = 'kardex-item-form:last-unit';

function ItemForm({
  defaultValues,
  onSubmit,
  isPending,
  isEdit = false,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  isEdit?: boolean;
}) {
  // Recordar última categoría/unidad (solo en modo crear, no en edit)
  const rememberedCategoryId =
    !isEdit && typeof window !== 'undefined'
      ? (localStorage.getItem(LS_LAST_CATEGORY) ?? undefined)
      : undefined;
  const rememberedUnitId =
    !isEdit && typeof window !== 'undefined'
      ? (localStorage.getItem(LS_LAST_UNIT) ?? undefined)
      : undefined;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'MATERIAL',
      categoryId: rememberedCategoryId,
      unitId: rememberedUnitId,
      initialSource: 'COMPRA',
      ...defaultValues,
    },
  });

  // ── Comboboxes ─────────────────────────────────────────────
  const [categorySearch, setCategorySearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  const { data: categoriesData, isFetching: catLoading } = useCategories({
    search: categorySearch || undefined,
    pageSize: 30,
  });
  const { data: unitsData, isFetching: unitLoading } = useUnits({
    search: unitSearch || undefined,
    pageSize: 30,
  });
  const { data: suppliersData, isFetching: supplierLoading } = useSuppliers({
    search: supplierSearch || undefined,
    pageSize: 30,
  });

  // Selected objects (para mostrar en el combobox cuando es pre-cargado)
  const selectedCategory = useMemo<Category | null>(() => {
    const id = watch('categoryId');
    return (categoriesData?.items ?? []).find((c) => c.id === id) ?? null;
  }, [categoriesData, watch]);

  const selectedUnit = useMemo<Unit | null>(() => {
    const id = watch('unitId');
    return (unitsData?.items ?? []).find((u) => u.id === id) ?? null;
  }, [unitsData, watch]);

  const selectedSupplier = useMemo<Supplier | null>(() => {
    const id = watch('initialSupplierId');
    return (suppliersData?.items ?? []).find((s) => s.id === id) ?? null;
  }, [suppliersData, watch]);

  // ── Sub-modales de creación rápida ─────────────────────────
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  // ── Carga inicial (Wave 2) ─────────────────────────────────
  const loadInitialStock = watch('loadInitialStock') ?? false;
  const initialSource = watch('initialSource');

  // ── Submit button label dinámico ───────────────────────────
  const submitLabel = (() => {
    if (isPending) return 'Guardando...';
    if (isEdit) return 'Guardar cambios';
    return loadInitialStock ? 'Crear ítem y cargar stock' : 'Crear ítem';
  })();

  // ── Ctrl+Enter submit ──────────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(submitWithMemory)();
    }
  };

  const submitWithMemory = (d: FormData) => {
    if (!isEdit && typeof window !== 'undefined') {
      if (d.categoryId) localStorage.setItem(LS_LAST_CATEGORY, d.categoryId);
      if (d.unitId) localStorage.setItem(LS_LAST_UNIT, d.unitId);
    }
    onSubmit(d);
  };

  return (
    <>
      <form
        onSubmit={handleSubmit(submitWithMemory)}
        onKeyDown={onKeyDown}
        className="space-y-5"
      >
        {/* Sección 1 — Identificación */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              {...register('name')}
              placeholder="Cemento Portland Tipo I — bolsa 42.5 kg"
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Tipo como grid visual */}
          <div className="space-y-1.5">
            <Label>
              Tipo <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ITEM_TYPES.map((t) => {
                const meta = ITEM_TYPE_META[t];
                const selected = watch('type') === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setValue('type', t, { shouldValidate: true })}
                    className={cn(
                      'flex items-start gap-2 rounded-md border p-2.5 text-left transition-all',
                      selected
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                        : 'border-border hover:border-foreground/20 hover:bg-muted/40',
                    )}
                  >
                    <meta.icon
                      className={cn(
                        'h-4 w-4 mt-0.5 shrink-0',
                        selected ? 'text-accent' : 'text-muted-foreground',
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                        {meta.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categoría — Combobox buscable + "+ Nueva" */}
            <div className="space-y-1.5">
              <Label>
                Categoría <span className="text-destructive">*</span>
              </Label>
              <SearchCombobox<Category>
                value={watch('categoryId') ?? ''}
                onChange={(id) => setValue('categoryId', id, { shouldValidate: true })}
                items={categoriesData?.items ?? []}
                selectedItem={selectedCategory}
                isLoading={catLoading}
                onSearchChange={setCategorySearch}
                getId={(c) => c.id}
                getLabel={(c) => c.name}
                placeholder="Buscar categoría..."
                emptyMessage="No hay categorías que coincidan"
                error={!!errors.categoryId}
              />
              <button
                type="button"
                onClick={() => setCatDialogOpen(true)}
                className="text-xs text-accent hover:underline"
              >
                + Nueva categoría
              </button>
              {errors.categoryId && (
                <p className="text-xs text-destructive">{errors.categoryId.message}</p>
              )}
            </div>

            {/* Unidad — Combobox buscable + "+ Nueva" */}
            <div className="space-y-1.5">
              <Label>
                Unidad de medida <span className="text-destructive">*</span>
              </Label>
              <SearchCombobox<Unit>
                value={watch('unitId') ?? ''}
                onChange={(id) => setValue('unitId', id, { shouldValidate: true })}
                items={unitsData?.items ?? []}
                selectedItem={selectedUnit}
                isLoading={unitLoading}
                onSearchChange={setUnitSearch}
                getId={(u) => u.id}
                getLabel={(u) => `${u.name} (${u.abbreviation})`}
                placeholder="Buscar unidad..."
                emptyMessage="No hay unidades que coincidan"
                error={!!errors.unitId}
              />
              <button
                type="button"
                onClick={() => setUnitDialogOpen(true)}
                className="text-xs text-accent hover:underline"
              >
                + Nueva unidad
              </button>
              {errors.unitId && (
                <p className="text-xs text-destructive">{errors.unitId.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Sección 2 — Niveles de stock */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Stock mínimo</Label>
            <Input
              type="number"
              step="0.001"
              min="0"
              {...register('minStock')}
              placeholder="0"
            />
            <p className="text-[11px] text-muted-foreground">
              Dispara alerta STOCK_BAJO cuando el stock del Principal caiga debajo.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Stock máximo</Label>
            <Input
              type="number"
              step="0.001"
              min="0"
              {...register('maxStock')}
              placeholder="—"
            />
            <p className="text-[11px] text-muted-foreground">
              Opcional. Referencia para evitar compras excesivas.
            </p>
            {errors.maxStock && (
              <p className="text-xs text-destructive">{errors.maxStock.message}</p>
            )}
          </div>
        </div>

        {/* Sección 3 — Descripción */}
        <div className="space-y-1.5">
          <Label>Descripción</Label>
          <Textarea
            {...register('description')}
            rows={3}
            placeholder="Especificaciones técnicas, marca, características..."
          />
        </div>

        {/* Sección 4 — Carga inicial colapsable */}
        {!isEdit && (
          <div className="rounded-lg border bg-muted/20">
            <label className="flex items-start gap-3 p-4 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('loadInitialStock')}
                className="h-4 w-4 mt-0.5 accent-accent"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Cargar stock al crear</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Se registrará un movimiento ENTRADA al Almacén Principal en la misma
                  transacción.
                </p>
              </div>
            </label>

            {loadInitialStock && (
              <div className="border-t bg-background p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>
                      Cantidad <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      {...register('initialStock')}
                      placeholder="0"
                    />
                    {errors.initialStock && (
                      <p className="text-xs text-destructive">
                        {errors.initialStock.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Costo unitario</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('initialUnitCost')}
                      placeholder="—"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Motivo <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={initialSource ?? 'COMPRA'}
                    onValueChange={(v) =>
                      setValue('initialSource', v as 'COMPRA' | 'DEVOLUCION' | 'AJUSTE', {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INITIAL_SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Proveedor — solo si motivo = COMPRA */}
                {initialSource === 'COMPRA' && (
                  <div className="space-y-1.5">
                    <Label>
                      Proveedor <span className="text-destructive">*</span>
                    </Label>
                    <SearchCombobox<Supplier>
                      value={watch('initialSupplierId') ?? ''}
                      onChange={(id) =>
                        setValue('initialSupplierId', id, { shouldValidate: true })
                      }
                      items={suppliersData?.items ?? []}
                      selectedItem={selectedSupplier}
                      isLoading={supplierLoading}
                      onSearchChange={setSupplierSearch}
                      getId={(s) => s.id}
                      getLabel={(s) => (s.taxId ? `${s.name} — ${s.taxId}` : s.name)}
                      placeholder="Buscar proveedor..."
                      emptyMessage="Sin coincidencias"
                      error={!!errors.initialSupplierId}
                    />
                    <button
                      type="button"
                      onClick={() => setSupplierDialogOpen(true)}
                      className="text-xs text-accent hover:underline"
                    >
                      + Nuevo proveedor
                    </button>
                    {errors.initialSupplierId && (
                      <p className="text-xs text-destructive">
                        {errors.initialSupplierId.message}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Notas</Label>
                  <Input
                    {...register('initialNotes')}
                    placeholder="Nº factura, guía, observaciones..."
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t">
          <p className="text-[11px] text-muted-foreground hidden md:block">
            <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">
              Ctrl
            </kbd>{' '}
            +{' '}
            <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">
              Enter
            </kbd>{' '}
            para guardar
          </p>
          <Button type="submit" disabled={isPending} className="gap-2">
            {submitLabel}
          </Button>
        </div>
      </form>

      {/* Sub-modales de creación rápida */}
      <QuickCreateCategoryDialog
        open={catDialogOpen}
        onClose={() => setCatDialogOpen(false)}
        onCreated={(id) => setValue('categoryId', id, { shouldValidate: true })}
      />
      <QuickCreateUnitDialog
        open={unitDialogOpen}
        onClose={() => setUnitDialogOpen(false)}
        onCreated={(id) => setValue('unitId', id, { shouldValidate: true })}
      />
      <QuickCreateSupplierDialog
        open={supplierDialogOpen}
        onClose={() => setSupplierDialogOpen(false)}
        onCreated={(id) => setValue('initialSupplierId', id, { shouldValidate: true })}
      />
    </>
  );
}

interface Props {
  /**
   * URL base para limpiar el query param `?action=new` después de abrir el
   * modal. Default: `/dashboard/almacen-principal` (donde vive el panel).
   */
  cleanUrlBase?: string;
}

/**
 * Inventario del Almacén Principal — DataTable del catálogo + CRUD + acciones
 * rápidas por fila (Entrada/Transferir/Ajustar/Salida/Editar/Eliminar).
 *
 * Vive como tab default en `/dashboard/almacen-principal?tab=inventario` y
 * reemplaza la antigua página `/dashboard/items` (consolidación Nivel C).
 */
export function ItemsPanel({
  cleanUrlBase = '/dashboard/almacen-principal',
}: Props = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<ItemType | '_all'>('_all');
  const debouncedSearch = useDebounce(search, 300);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Deep-link `?action=new` (e.g. Command Palette / atajos externos):
  // abre el modal y limpia el query param.
  useEffect(() => {
    if (searchParams.get('action') !== 'new') return;
    setIsCreating(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('action');
    const qs = params.toString();
    router.replace(`${cleanUrlBase}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [searchParams, router, cleanUrlBase]);

  const { data, isLoading } = useItems({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    type: filterType === '_all' ? undefined : filterType,
  });
  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem();
  const deleteMutation = useDeleteItem();
  const confirm = useConfirm();

  const [quickEntryItem, setQuickEntryItem] = useState<Item | null>(null);
  const [quickOutgoingItem, setQuickOutgoingItem] = useState<Item | null>(null);
  const [quickTransferItem, setQuickTransferItem] = useState<Item | null>(null);
  const [quickAdjustItem, setQuickAdjustItem] = useState<Item | null>(null);

  const columns: ColumnDef<Item>[] = [
    rowNumberColumn<Item>({ page, pageSize }),
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => (
        <Link
          href={`/dashboard/items/${row.original.id}`}
          className="font-medium hover:text-accent transition-colors"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: 'category',
      header: 'Categoría',
      size: 140,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.category.name}
        </span>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Tipo',
      size: 130,
      cell: ({ row }) => (
        <Badge variant={ITEM_TYPE_META[row.original.type].variant as any}>
          {ITEM_TYPE_META[row.original.type].label}
        </Badge>
      ),
    },
    {
      id: 'principalStock',
      header: 'Stock Principal',
      size: 130,
      cell: ({ row }) => {
        const qty = Number(row.original.principalStock ?? 0);
        const min = Number(row.original.minStock ?? 0);
        const low = min > 0 && qty < min;
        const out = qty === 0;
        return (
          <span
            className={`text-base font-semibold tabular-nums ${out ? 'text-destructive' : low ? 'text-amber-600 dark:text-amber-400' : ''}`}
          >
            {qty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
          </span>
        );
      },
    },
    {
      id: 'unit',
      header: 'Unidad',
      size: 110,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.unit.name}</span>
      ),
    },
    {
      id: 'minStock',
      header: 'Mín.',
      size: 80,
      cell: ({ row }) => {
        const min = Number(row.original.minStock ?? 0);
        return min > 0 ? (
          <span className="text-sm tabular-nums">
            {min.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: 'active',
      header: 'Estado',
      size: 90,
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'success' : 'secondary'}>
          {row.original.active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 130,
      cell: ({ row }) => {
        const item = row.original;
        const qty = Number(item.principalStock ?? 0);
        const noStock = !item.active || qty === 0;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                Acciones
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Operaciones</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => setQuickEntryItem(item)}
                disabled={!item.active}
              >
                <ArrowDownCircle className="text-green-600 dark:text-green-500" />
                Registrar entrada
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setQuickTransferItem(item)}
                disabled={noStock}
              >
                <ArrowRight className="text-blue-600 dark:text-blue-500" />
                Transferir a obra
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Avanzado</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => setQuickAdjustItem(item)}
                disabled={!item.active}
              >
                <SlidersHorizontal className="text-amber-600 dark:text-amber-500" />
                Ajustar stock
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setQuickOutgoingItem(item)}
                disabled={noStock}
              >
                <ArrowUpCircle className="text-red-600 dark:text-red-500" />
                Salida directa
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/items/${item.id}`}>
                  <ExternalLink />
                  Ver ficha y kardex
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditTarget(item)}>
                <Edit2 />
                Editar ítem
              </DropdownMenuItem>
              <DropdownMenuItem
                destructive
                onSelect={async () => {
                  const ok = await confirm({
                    title: `Eliminar ítem "${item.name}"`,
                    description:
                      'No podrá eliminarse si tiene stock registrado o movimientos históricos.',
                    confirmText: 'Eliminar',
                    tone: 'destructive',
                  });
                  if (ok) deleteMutation.mutate(item.id);
                }}
              >
                <Trash2 />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filtros + acciones en UNA fila — con wrap natural en pantallas chicas. */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar ítem..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-64"
        />
        <Select
          value={filterType}
          onValueChange={(v) => {
            setFilterType(v as ItemType | '_all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los tipos</SelectItem>
            {ITEM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ITEM_TYPE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Acciones al extremo derecho vía ml-auto */}
        <Button
          variant="outline"
          onClick={() => setIsImporting(true)}
          className="gap-2 ml-auto"
        >
          <FileUp className="h-4 w-4" /> Importar Excel
        </Button>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo ítem
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />

      <ImportDialog open={isImporting} onOpenChange={setIsImporting} />

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo ítem</DialogTitle>
          </DialogHeader>
          <ItemForm
            onSubmit={(dto) => {
              // Mapea al DTO del backend. Los campos de carga inicial solo se
              // envían si `loadInitialStock` está activo.
              const payload: CreateItemDto & Record<string, any> = {
                name: dto.name,
                description: dto.description,
                type: dto.type,
                categoryId: dto.categoryId,
                unitId: dto.unitId,
                minStock: dto.minStock,
                maxStock: dto.maxStock,
              };
              if (dto.loadInitialStock && dto.initialStock) {
                payload.initialStock = dto.initialStock;
                payload.initialUnitCost = dto.initialUnitCost;
                payload.initialSource = dto.initialSource;
                payload.initialNotes = dto.initialNotes;
                if (dto.initialSource === 'COMPRA') {
                  payload.initialSupplierId = dto.initialSupplierId;
                }
              }
              createMutation.mutate(payload as CreateItemDto, {
                onSuccess: () => setIsCreating(false),
              });
            }}
            isPending={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar ítem</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <ItemForm
              isEdit
              defaultValues={{
                name: editTarget.name,
                description: editTarget.description ?? undefined,
                type: editTarget.type,
                categoryId: editTarget.categoryId,
                unitId: editTarget.unitId,
                minStock: Number(editTarget.minStock),
                maxStock:
                  editTarget.maxStock != null ? Number(editTarget.maxStock) : undefined,
              }}
              onSubmit={(dto) =>
                updateMutation.mutate(
                  {
                    id: editTarget.id,
                    name: dto.name,
                    description: dto.description,
                    type: dto.type,
                    categoryId: dto.categoryId,
                    unitId: dto.unitId,
                    minStock: dto.minStock,
                    maxStock: dto.maxStock,
                  } as Parameters<typeof updateMutation.mutate>[0],
                  { onSuccess: () => setEditTarget(null) },
                )
              }
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <QuickEntryDialog item={quickEntryItem} onClose={() => setQuickEntryItem(null)} />
      <QuickOutgoingDialog
        item={quickOutgoingItem}
        onClose={() => setQuickOutgoingItem(null)}
      />
      <QuickTransferDialog
        item={quickTransferItem}
        onClose={() => setQuickTransferItem(null)}
      />
      <QuickAdjustDialog
        item={quickAdjustItem}
        onClose={() => setQuickAdjustItem(null)}
      />
    </div>
  );
}
