# @kardex/types

Shared TypeScript types for the Kardex monorepo.

## Structure

```
src/
├── entities/       # Domain entities (User, Item, Warehouse, etc.)
├── enums/          # Enums (DocumentType, UserRole, MovementType, etc.)
├── dto/            # Data Transfer Objects (API contracts)
├── errors/         # Error codes (BusinessErrorCode) + ApiError shapes
└── index.ts        # Main entry point
```

## Usage

### Import from root

```typescript
import { User, LoginDto, BusinessErrorCode } from '@kardex/types';
```

### Import from specific module

```typescript
import { User } from '@kardex/types/entities';
import { UserRole, DocumentType } from '@kardex/types/enums';
import { LoginDto, PaginationQueryDto } from '@kardex/types/dto';
import { BusinessErrorCode, isApiError } from '@kardex/types/errors';
```

## Key Types

### Enums

- `DocumentType`: DNI, CE, PASAPORTE
- `UserRole`: ADMIN, JEFE, ALMACENERO, RESIDENTE
- `MovementType`: ENTRADA, SALIDA, AJUSTE
- `MovementSourceType`: COMPRA, CONSUMO, TRANSFERENCIA, etc.
- `TransferStatus`: SOLICITADA, APROBADA, EN_TRANSITO, RECIBIDA, etc.
- `ItemType`: MATERIAL, HERRAMIENTA, EPP, REPUESTO, EQUIPO
- `WarehouseType`: CENTRAL, OBRA
- `AlertType` / `AlertLevel`

### Errors

- `BusinessErrorCode` — enum with 40+ error codes
- `ApiError` — standard error response shape
- `ApiSuccessResponse<T>` — success response shape
- `isApiError(response)` — type guard

### WebSocket Events

- `WS_EVENTS` — centralized event names
- `wsRoomForUser(userId)`, `wsRoomForWarehouse(id)`, `wsRoomForRole(role)`

## Building

```bash
npm run build
```

## Adding New Types

1. Create file in appropriate folder (`entities/`, `enums/`, etc.)
2. Export from corresponding `index.ts`
3. Build: `npm run build`
4. Commit with `feat(types): add XXX type`
