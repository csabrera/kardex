# ADR-0002: Optimistic Locking para Control de Concurrencia en Stock

## Status
✅ Accepted

## Context
Sistema de inventario con múltiples transacciones paralelas (transferencias, despachos, movimientos) que actualizan stock. Sin control de concurrencia:
- Overselling (vender más de lo disponible).
- Inconsistencia en saldos.

## Decision
Implementar **Optimistic Locking** con campo `version` en tabla `Stock`.

**Schema Prisma:**
```prisma
model Stock {
  id              String   @id @default(cuid())
  itemId          String
  warehouseId     String
  quantity        Int
  version         Int      @default(0)  // ← Versionado
  updatedAt       DateTime @updatedAt
  
  @@unique([itemId, warehouseId])
  @@index([version])
}
```

**Flujo de actualización:**
```typescript
const stock = await db.stock.findUniqueOrThrow({
  where: { itemId_warehouseId: {...} }
});

const updated = await db.stock.updateMany({
  where: {
    itemId_warehouseId: {...},
    version: stock.version  // ← Validar version
  },
  data: {
    quantity: stock.quantity - 50,
    version: stock.version + 1  // ← Incrementar
  }
});

if (updated.count === 0) {
  throw new BusinessException(
    BusinessErrorCode.STOCK_CONFLICT,
    'Stock fue modificado por otra transacción. Reintentar.'
  );
}
```

## Consequences

✅ **Positivos:**
- Sin deadlocks (mejor performance).
- Simple de implementar (un field extra).
- Fácil de testear en paralelo.
- TanStack Query puede reintentar automáticamente en cliente.

⚠️ **Trade-offs:**
- Si hay muchas colisiones, reintenta frecuentes (mitigable con backoff exponencial).
- Requiere manejo de error `STOCK_CONFLICT` en servicio + cliente.

## Alternatives Considered

1. **Pessimistic Locking (SELECT FOR UPDATE):**
   - Más simple: transacción atrapa el lock.
   - ❌ Riesgo de deadlocks en transferencias cruzadas (A→B, B→A paralelo).

2. **Message Queue/Event Sourcing:**
   - Garantía más fuerte (at-least-once).
   - ❌ Overkill para inventario (no es e-commerce).
