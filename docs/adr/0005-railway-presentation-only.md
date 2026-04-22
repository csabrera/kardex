# ADR-0005: Railway para Presentación al Cliente (NO Producción Final)

## Status
✅ Accepted

## Context
Cliente aún no aprobó proyecto final. MVP debe ser demostrable en semanas/pocos meses. Deployar a AWS es caro ($$$) y requiere configuración DevOps compleja (RDS, ALB, S3, IAM, etc.).

## Decision
**Railway para presentación al cliente.** Producción final será decidida después (AWS, self-hosted, etc.).

**Estructura:**
```
Presentación (Railway):
- PostgreSQL managed
- API (Node.js)
- Web (Node.js)
- Redis (BullMQ)
- Dominio: *.railway.app

Producción Final (posterior):
- Decidir con cliente (AWS, etc.)
```

## Consequences

✅ **Positivos:**
- MVP rápido sin costo de infraestructura.
- No requiere DevOps complex (Railway manage todo).
- Dominio gratuito (*.railway.app).
- Ideal para presentación/prueba.

⚠️ **Trade-offs:**
- Sin backups (data de prueba es descartable).
- No multi-region (fine para presentación).
- Limitaciones de Railway (quotas, uptime).
- Cuando cliente apruebe, migración a AWS (esfuerzo manual).

## Alternatives Considered

1. **AWS desde inicio:**
   - ✅ Production-ready.
   - ❌ Caro ($500+/mes).
   - ❌ Setup DevOps complejo.
   - ❌ Lentifica MVP.

2. **Self-hosted VPS:**
   - ❌ Sin auto-scaling.
   - ❌ Baja confiabilidad.

## Migration Path (Futuro)

Si cliente aprueba:
1. Datos de Railway → dump PostgreSQL.
2. Configurar RDS en AWS.
3. Redeploy en AWS (código idéntico, solo env vars).
4. Actualizar DNS.
