'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import { useItems } from '@/hooks/use-items';
import { useCreateTransfer } from '@/hooks/use-transfers';
import { useWarehouses } from '@/hooks/use-warehouses';

const schema = z
  .object({
    fromWarehouseId: z.string().min(1, 'Requerido'),
    toWarehouseId: z.string().min(1, 'Requerido'),
    notes: z.string().max(500).optional(),
    items: z
      .array(
        z.object({
          itemId: z.string().min(1, 'Selecciona un ítem'),
          requestedQty: z.coerce.number().min(0.001, 'Debe ser > 0'),
        }),
      )
      .min(1),
  })
  .refine((d) => d.fromWarehouseId !== d.toWarehouseId, {
    message: 'El almacén origen y destino no pueden ser el mismo',
    path: ['toWarehouseId'],
  });

type FormData = z.infer<typeof schema>;

function ItemRow({ index, register, setValue, errors, onRemove }: any) {
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: itemsData } = useItems({
    search: debouncedSearch || undefined,
    pageSize: 10,
  });

  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1 relative">
        <div className="flex items-center gap-1 border rounded-md px-3 h-9 bg-background">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder="Buscar ítem..."
            value={selectedName || search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedName('');
              setValue(`items.${index}.itemId`, '');
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          />
        </div>
        {showDropdown && debouncedSearch && (itemsData?.items.length ?? 0) > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
            {itemsData?.items.map((item: any) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  setValue(`items.${index}.itemId`, item.id);
                  setSelectedName(`[${item.code}] ${item.name}`);
                  setSearch('');
                  setShowDropdown(false);
                }}
              >
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {item.code}
                </span>
                {item.name}{' '}
                <span className="text-xs text-muted-foreground">
                  ({item.unit.abbreviation})
                </span>
              </button>
            ))}
          </div>
        )}
        <input type="hidden" {...register(`items.${index}.itemId`)} />
        {errors?.items?.[index]?.itemId && (
          <p className="text-xs text-destructive mt-0.5">
            {errors.items[index].itemId.message}
          </p>
        )}
      </div>
      <div className="w-32 shrink-0">
        <Input
          type="number"
          step="0.001"
          min="0.001"
          placeholder="Cantidad"
          {...register(`items.${index}.requestedQty`)}
        />
        {errors?.items?.[index]?.requestedQty && (
          <p className="text-xs text-destructive mt-0.5">
            {errors.items[index].requestedQty.message}
          </p>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        <Minus className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

export default function NuevaTransferenciaPage() {
  const router = useRouter();
  const { data: warehousesData } = useWarehouses({ pageSize: 100 });
  const mutation = useCreateTransfer();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromWarehouseId: '',
      toWarehouseId: '',
      notes: '',
      items: [{ itemId: '', requestedQty: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data, { onSuccess: () => router.push('/dashboard/transferencias') });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Nueva transferencia</h1>
        <p className="text-sm text-muted-foreground">
          Solicitar traslado de ítems entre almacenes
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-lg border bg-card p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Almacén origen *</Label>
            <Select onValueChange={(v) => setValue('fromWarehouseId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {warehousesData?.items.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    [{w.code}] {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.fromWarehouseId && (
              <p className="text-xs text-destructive">{errors.fromWarehouseId.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Almacén destino *</Label>
            <Select onValueChange={(v) => setValue('toWarehouseId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {warehousesData?.items.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    [{w.code}] {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.toWarehouseId && (
              <p className="text-xs text-destructive">{errors.toWarehouseId.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Observaciones</Label>
          <Input {...register('notes')} placeholder="Opcional" />
        </div>

        <div className="space-y-2">
          <Label>Ítems a transferir *</Label>
          {fields.map((field, index) => (
            <ItemRow
              key={field.id}
              index={index}
              register={register}
              setValue={setValue}
              errors={errors}
              onRemove={() => fields.length > 1 && remove(index)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ itemId: '', requestedQty: 0 })}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar ítem
          </Button>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Enviando...' : 'Crear solicitud de transferencia'}
          </Button>
        </div>
      </form>
    </div>
  );
}
