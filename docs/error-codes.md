# Catálogo de Errores de Negocio

> Todos los errores del sistema tienen un código único (`BusinessErrorCode`) que identifica la regla violada. El frontend usa el código para localizar mensajes; el backend lo retorna en el envelope `ApiError`.

**Fuente de verdad:** [`packages/types/src/errors/business-error-code.ts`](../packages/types/src/errors/business-error-code.ts)

## 📋 Formato de Respuesta de Error

Todas las respuestas de error siguen este shape:

```json
{
  "error": {
    "code": "STOCK_INSUFFICIENT",
    "message": "Stock insuficiente. Disponible: 50, solicitado: 100",
    "details": {
      "available": 50,
      "requested": 100,
      "itemId": "ck123abc"
    },
    "timestamp": "2026-04-21T22:30:00.000Z",
    "path": "/api/movements"
  }
}
```

| Campo | Descripción |
|-------|-------------|
| `code` | Código estable para logic check en frontend |
| `message` | Texto en español, listo para mostrar al usuario |
| `details` | Contexto adicional (opcional) |
| `timestamp` | Cuando ocurrió el error (ISO 8601) |
| `path` | Endpoint que falló |

## 🏷️ Códigos por Categoría

### Autenticación

| Código | HTTP | Descripción | Ejemplo |
|--------|------|-------------|---------|
| `INVALID_CREDENTIALS` | 401 | DNI/password incorrectos | Usuario intenta login con password errónea |
| `INVALID_DOCUMENT_FORMAT` | 400 | Documento no cumple regex | DNI con 7 dígitos |
| `USER_NOT_FOUND` | 404 | Usuario no existe | Lookup por ID |
| `USER_INACTIVE` | 403 | Cuenta desactivada | Login de usuario dado de baja |
| `MUST_CHANGE_PASSWORD` | 403 | Requiere cambio de password | Primer login de admin seeded |
| `SETUP_ALREADY_COMPLETED` | 403 | Setup ya hecho | Intento de rehacer wizard |
| `SETUP_NOT_COMPLETED` | 403 | Setup pendiente | Login sin bootstrap |
| `TOKEN_EXPIRED` | 401 | Access token caducó | Frontend debe refrescar |
| `TOKEN_INVALID` | 401 | JWT malformado o firma inválida | Tampering sospechoso |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token expiró | Logout forzoso |

### Permisos

| Código | HTTP | Descripción |
|--------|------|-------------|
| `PERMISSION_DENIED` | 403 | Rol no tiene el permiso requerido |
| `WAREHOUSE_SCOPE_VIOLATION` | 403 | Usuario intenta acceder a almacén no asignado |

### Usuarios

| Código | HTTP | Descripción |
|--------|------|-------------|
| `USER_ALREADY_EXISTS` | 409 | Crear usuario con doc ya registrado |
| `DOCUMENT_ALREADY_REGISTERED` | 409 | Misma `(documentType, documentNumber)` en uso |

### Stock & Movimientos

| Código | HTTP | Descripción | Cuándo ocurre |
|--------|------|-------------|----------------|
| `STOCK_INSUFFICIENT` | 409 | Cantidad solicitada > disponible | Salida o transferencia |
| `STOCK_CONFLICT` | 409 | Optimistic locking falló (stale version) | Dos transacciones paralelas → cliente reintenta |
| `ITEM_NOT_FOUND` | 404 | Ítem no existe | Lookup inválido |
| `ITEM_ALREADY_EXISTS` | 409 | Código duplicado | Crear ítem con código en uso |
| `WAREHOUSE_NOT_FOUND` | 404 | Almacén no existe | Movimiento a warehouseId inválido |
| `NEGATIVE_QUANTITY_NOT_ALLOWED` | 400 | Cantidad ≤ 0 | Validación de input |

### Transferencias

| Código | HTTP | Descripción |
|--------|------|-------------|
| `TRANSFER_NOT_FOUND` | 404 | Transfer ID no existe |
| `TRANSFER_INVALID_STATE` | 409 | Acción no válida en estado actual (ej. aprobar transfer ya recibida) |
| `TRANSFER_SAME_WAREHOUSE` | 400 | origen === destino |

### Requisiciones

| Código | HTTP | Descripción |
|--------|------|-------------|
| `REQUISITION_NOT_FOUND` | 404 | Requisition ID no existe |
| `REQUISITION_INVALID_STATE` | 409 | Acción no válida en estado actual |

### Mantenimientos & Equipos

| Código | HTTP | Descripción |
|--------|------|-------------|
| `MAINTENANCE_NOT_FOUND` | 404 | Mantenimiento no existe |
| `EQUIPMENT_NOT_FOUND` | 404 | Equipo no existe |

### EPP & Herramientas

| Código | HTTP | Descripción |
|--------|------|-------------|
| `WORKER_NOT_FOUND` | 404 | Trabajador no registrado |
| `TOOL_LOAN_NOT_FOUND` | 404 | Préstamo no existe |
| `TOOL_ALREADY_LOANED` | 409 | Herramienta ya prestada (no devuelta) |

### Importación / Exportación

| Código | HTTP | Descripción |
|--------|------|-------------|
| `IMPORT_VALIDATION_FAILED` | 400 | Excel tiene errores de validación |
| `IMPORT_DUPLICATE_CODES` | 409 | Códigos duplicados en el archivo |
| `EXPORT_JOB_NOT_FOUND` | 404 | Job de PDF no existe (polling con jobId inválido) |
| `EXPORT_GENERATION_FAILED` | 500 | Puppeteer falló al renderizar |

### Genéricos

| Código | HTTP | Descripción |
|--------|------|-------------|
| `INVALID_INPUT` | 400 | Fallback cuando class-validator rechaza |
| `NOT_FOUND` | 404 | Recurso genérico no encontrado |
| `INTERNAL_SERVER_ERROR` | 500 | Error inesperado (stack solo en dev) |
| `RATE_LIMIT_EXCEEDED` | 429 | `@nestjs/throttler` rechazó la request |

---

## 💻 Uso en Backend

**Lanzar una `BusinessException`:**

```typescript
import { BusinessException } from '@/common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { HttpStatus } from '@nestjs/common';

throw new BusinessException(
  BusinessErrorCode.STOCK_INSUFFICIENT,
  `Stock insuficiente. Disponible: ${available}, solicitado: ${requested}`,
  HttpStatus.CONFLICT,
  { available, requested, itemId: item.id },
);
```

El `AllExceptionsFilter` serializa automáticamente al envelope `ApiError`.

---

## 🖥️ Uso en Frontend

**Type-safe catch con código de error:**

```typescript
import { BusinessErrorCode, isApiError } from '@kardex/types';
import { apiClient, getErrorCode } from '@/lib/api-client';
import { toast } from 'sonner';

try {
  await apiClient.post('/movements', payload);
} catch (error) {
  const code = getErrorCode(error);

  switch (code) {
    case BusinessErrorCode.STOCK_INSUFFICIENT:
      toast.error('No hay stock suficiente para esta operación');
      break;
    case BusinessErrorCode.STOCK_CONFLICT:
      // Auto-retry con optimistic locking
      retryWithBackoff();
      break;
    default:
      toast.error(getErrorMessage(error));
  }
}
```

---

## ➕ Añadir un Nuevo Código

1. **Declarar en enum:** `packages/types/src/errors/business-error-code.ts`
2. **Añadir mensaje:** mismo archivo, mapa `ERROR_MESSAGES`
3. **Documentar aquí:** agregar fila a la tabla correspondiente
4. **Usar en backend:** `throw new BusinessException(BusinessErrorCode.NEW_CODE, ...)`
5. **Manejar en frontend:** `switch` case específico si requiere UX especial

**Rebuild los tipos** tras cambiar el enum:

```bash
cd packages/types && npm run build
```
