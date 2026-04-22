# @kardex/utils

Shared utilities for the Kardex monorepo.

## Installation (Internal)

```json
{
  "dependencies": {
    "@kardex/utils": "workspace:*"
  }
}
```

## Usage

### Validators

```typescript
import { validateDocument, isValidEmail, isStrongPassword } from '@kardex/utils';

// Document validation
const result = validateDocument('DNI', '12345678');
if (!result.valid) {
  console.error(result.error);
}

// Email
isValidEmail('user@example.com'); // true

// Strong password
const check = isStrongPassword('MyPassword123');
if (!check.valid) {
  console.error(check.errors);
}
```

### Formatters

```typescript
import {
  formatCurrency,
  formatDate,
  formatMovementCode,
} from '@kardex/utils';

formatCurrency(1234.56); // "S/ 1,234.56"
formatDate(new Date(), 'long'); // "21 de abril de 2026"
formatMovementCode('ENTRADA', 42); // "ENT-00042"
```

## Testing

```bash
npm run test
```

## Building

```bash
npm run build
```
