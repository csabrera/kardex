# Architecture Decision Records (ADRs)

> Registro de decisiones arquitectónicas importantes del proyecto Kardex.

Cuando enfrentes una decisión técnica significativa, documéntala aquí. Esto ayuda a:
- ✅ Justificar decisiones futuras
- ✅ Onboard nuevo equipo rápidamente
- ✅ Evitar repetir discusiones
- ✅ Mantener consistencia en el proyecto

## 📋 Índice de ADRs

| ADR | Título | Status | Área |
|-----|--------|--------|------|
| [0001](./0001-monorepo-turborepo.md) | Monorepo con Turborepo | ✅ Accepted | Infraestructura |
| [0002](./0002-optimistic-locking-stock.md) | Optimistic Locking para Stock | ✅ Accepted | Backend |
| [0003](./0003-redis-adapter-socket-io.md) | Redis Adapter para Socket.IO | ✅ Accepted | Backend |
| [0004](./0004-async-queue-pdf-generation.md) | Async Queue para PDFs (BullMQ) | ✅ Accepted | Backend |
| [0005](./0005-railway-presentation-only.md) | Railway para Presentación | ✅ Accepted | DevOps |

## 🎯 Cómo Escribir un ADR

### Template

```markdown
# ADR-NNNN: Titulo de la Decision

## Status
Accepted / Proposed / Deprecated

## Context
¿Qué problema enfrentamos? ¿Por qué es importante?

## Decision
¿Qué decidimos? ¿Por qué?

## Consequences
¿Cuál es el impacto? ¿Qué ganancias y trade-offs?

## Alternatives Considered
¿Qué otras opciones consideramos? ¿Por qué no?
```

### Pasos

1. Crear archivo `000N-short-title.md` (usar siguiente número)
2. Rellenar template
3. Crear PR para revisar (discusión)
4. Merge cuando hay consenso

### Ejemplo Minimalista

```markdown
# ADR-0006: Usar Zod para Validación Frontend

## Status
Accepted

## Decision
Usar **Zod** para validación de esquemas en frontend (apps/web).

## Consequences
✅ Compartir esquemas entre frontend y backend (packages/utils)
✅ Type-safe validation
⚠️ Otra dependencia JS (28KB)

## Alternatives
- Manual validation: más código
- Joi: más lento en browser
```

## 🔄 Estados

- **Accepted:** Decidido, implementado o en progreso
- **Proposed:** Idea nueva, bajo discusión
- **Deprecated:** Ya no se usa, reemplazado por otra ADR

## 📚 Lectura Recomendada

- [ADRs en Lightweight Architecture Decision Records](https://adr.github.io/)
- [Example ADRs from Nygard](https://github.com/joelparkerhenderson/architecture-decision-record/tree/main/examples)

---

**Próximo ADR a crear:** Validación con Zod (frontend)
