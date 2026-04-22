# ADR-0001: Monorepo con Turborepo

## Status
✅ Accepted

## Context
Proyecto con múltiples apps (frontend Next.js, backend NestJS) y paquetes compartidos (types, utils, config). Necesita:
- Compartir tipos TypeScript entre web y api.
- Reutilizar configuraciones (ESLint, TypeScript, utilidades).
- Pipeline de build eficiente (caché remoto, hot-reload).

## Decision
Usar monorepo con **Turborepo** + **npm workspaces**.

**Estructura:**
```
kardex/
├── apps/web/        (Next.js)
├── apps/api/        (NestJS)
├── packages/types/  (Tipos TS compartidos)
├── packages/ui/     (Componentes compartidos)
├── packages/utils/  (Utilidades comunes)
└── turbo.json       (Pipeline)
```

## Consequences

✅ **Positivos:**
- DX excelente: tipos compartidos evitan duplicación.
- Caché inteligente: builds incrementales rápidas.
- Hot-reload en ambas apps con `npm run dev`.
- Menos complejidad que Nx para este tamaño.

⚠️ **Trade-offs:**
- Setup inicial más complejo que proyectos individuales.
- Dependencias entre workspaces pueden crear círculos (evitar).

## Alternatives Considered

1. **Proyectos separados (web + api):**
   - ❌ Duplicación de tipos y validadores.
   - ❌ Desincronización entre frontend y backend.

2. **Nx:**
   - Más poderoso pero overkill para este tamaño.
   - Curva de aprendizaje más empinada.

3. **Yarn/PNPM workspaces sin Turborepo:**
   - ❌ Sin caché remoto ni pipeline optimizado.
