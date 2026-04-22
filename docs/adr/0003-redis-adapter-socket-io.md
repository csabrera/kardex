# ADR-0003: Redis Adapter para Socket.IO (Escalabilidad)

## Status
✅ Accepted

## Context
Sistema con WebSocket (Socket.IO) para notificaciones en vivo. Hoy: 1 instancia API. Futuro: si hay múltiples instancias detrás de load balancer, Socket.IO no brodea entre servidores (usuario en servidor A no recibe eventos emitidos en servidor B).

## Decision
Instalar **Redis adapter para Socket.IO** (`@socket.io/redis-adapter`) desde **Fase 5B**.

**Setup:**
```typescript
// apps/api/src/main.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const io = new Server(app);
const redisClient = createClient({ url: process.env.REDIS_URL });
const redisSubscriber = redisClient.duplicate();

io.adapter(createAdapter(redisClient, redisSubscriber));
```

## Consequences

✅ **Positivos:**
- Escalabilidad horizontal lista.
- Broadcasts entre servidores funcionan.
- Railway ofrece Redis (gratuito en algunos planes).

⚠️ **Trade-offs:**
- Dependencia nueva: Redis (debe estar arriba).
- Desarrollo local: Redis en Docker Compose.
- Costo futuro: instancia Redis en producción.

## Alternatives Considered

1. **Sin adapter (único servidor):**
   - ✅ Simple ahora.
   - ❌ No escalable horizontalmente.

2. **Sticky sessions (no recomendado):**
   - Complica load balancing.
