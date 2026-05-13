'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Eye, Paperclip, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { PageHeader } from '@/components/layout/page-header';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentViewButton } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { useDebounce } from '@/hooks/use-debounce';
import { useMovements, type Movement } from '@/hooks/use-movements';
import { useSuppliers, type Supplier } from '@/hooks/use-suppliers';

function CompraDetail({ movement }: { movement: Movement }) {
  const total = movement.items.reduce(
    (acc, mi) => acc + Number(mi.quantity) * Number(mi.unitCost ?? 0),
    0,
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Código</p>
          <p className="font-mono font-semibold">{movement.code}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Fecha</p>
          <p>{new Date(movement.createdAt).toLocaleString('es-PE')}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Proveedor</p>
          <p>{movement.supplier?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Almacén</p>
          <p>{movement.warehouse.name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Registró</p>
          <p>
            {movement.user.firstName} {movement.user.lastName}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Total valorizado</p>
          <p className="font-semibold tabular-nums">
            S/ {total.toLocaleString('es-PE', { maximumFractionDigits: 2 })}
          </p>
        </div>
        {movement.notes && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Observaciones</p>
            <p>{movement.notes}</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Ítems comprados</p>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-muted-foreground font-medium">
                  Ítem
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Cantidad
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Costo unit.
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {movement.items.map((mi) => {
                const qty = Number(mi.quantity);
                const cost = Number(mi.unitCost ?? 0);
                return (
                  <tr key={mi.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-muted-foreground mr-1">
                        {mi.item.code}
                      </span>
                      {mi.item.name}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {qty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                      {mi.item.unit.abbreviation}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                      {cost > 0
                        ? `S/ ${cost.toLocaleString('es-PE', { maximumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {cost > 0
                        ? `S/ ${(qty * cost).toLocaleString('es-PE', {
                            maximumFractionDigits: 2,
                          })}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {movement.attachments && movement.attachments.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">
            Adjuntos ({movement.attachments.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {movement.attachments.map((a) => (
              <DocumentViewButton
                key={a.id}
                filename={a.filename}
                originalName={a.originalName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComprasPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [supplierId, setSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [detail, setDetail] = useState<Movement | null>(null);

  const { data, isLoading } = useMovements({
    page,
    pageSize,
    source: 'COMPRA',
    supplierId: supplierId || undefined,
    search: debouncedSearch || undefined,
  });

  const { data: suppliersData, isFetching: suppliersLoading } = useSuppliers({
    search: supplierSearch || undefined,
    pageSize: 30,
  });
  const selectedSupplier = useMemo<Supplier | null>(
    () => (suppliersData?.items ?? []).find((s) => s.id === supplierId) ?? null,
    [suppliersData, supplierId],
  );

  const columns: ColumnDef<Movement>[] = [
    rowNumberColumn<Movement>({ page, pageSize }),
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {new Date(row.original.createdAt).toLocaleDateString('es-PE')}
        </span>
      ),
    },
    {
      accessorKey: 'code',
      header: 'Código',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
    },
    {
      accessorKey: 'supplier',
      header: 'Proveedor',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.supplier?.name ?? '—'}</span>
      ),
    },
    {
      id: 'items',
      header: 'Ítems',
      cell: ({ row }) => (
        <Badge variant="outline" className="tabular-nums">
          {row.original.items.length} {row.original.items.length === 1 ? 'ítem' : 'ítems'}
        </Badge>
      ),
    },
    {
      id: 'total',
      header: 'Total',
      cell: ({ row }) => {
        const total = row.original.items.reduce(
          (acc, mi) => acc + Number(mi.quantity) * Number(mi.unitCost ?? 0),
          0,
        );
        return (
          <span className="text-sm font-medium tabular-nums">
            {total > 0
              ? `S/ ${total.toLocaleString('es-PE', { maximumFractionDigits: 2 })}`
              : '—'}
          </span>
        );
      },
    },
    {
      id: 'attachments',
      header: 'Adjuntos',
      cell: ({ row }) => {
        const count = row.original.attachments?.length ?? 0;
        if (count === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <Badge variant="secondary" className="gap-1 tabular-nums">
            <Paperclip className="h-3 w-3" />
            {count}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <ActionButton
          tone="info"
          icon={Eye}
          label="Ver detalle"
          onClick={() => setDetail(row.original)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ShoppingCart}
        title="Compras"
        description="Historial de compras al Almacén Principal con sus guías, boletas y fotos adjuntas."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por código o notas..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-64"
        />
        <div className="w-full sm:w-72">
          <SearchCombobox<Supplier>
            value={supplierId}
            onChange={(id) => {
              setSupplierId(id);
              setPage(1);
            }}
            items={suppliersData?.items ?? []}
            selectedItem={selectedSupplier}
            isLoading={suppliersLoading}
            onSearchChange={setSupplierSearch}
            getId={(s) => s.id}
            getLabel={(s) => (s.taxId ? `${s.name} — ${s.taxId}` : s.name)}
            placeholder="Filtrar por proveedor..."
            emptyMessage="Sin coincidencias"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onRowClick={(row) => setDetail(row)}
      />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de compra</DialogTitle>
          </DialogHeader>
          {detail && <CompraDetail movement={detail} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
