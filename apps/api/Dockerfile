# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Kardex API — multi-stage Dockerfile para Railway / cualquier PaaS
# Monorepo Turborepo con shared packages (@kardex/types, @kardex/utils).
# Build context: raíz del repo (no apps/api).
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: deps — instalar dependencias de todo el workspace
FROM node:20-alpine AS deps
WORKDIR /app

# Tools nativos que requieren algunas deps (bcrypt, prisma engines)
RUN apk add --no-cache libc6-compat openssl

# Copiar manifests del workspace + lockfile
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY testing/package.json ./testing/

# Skip Puppeteer Chromium download — lo manejamos manualmente si se requiere PDF gen.
# Para Railway: el bundle de Puppeteer pesa ~180MB; deshabilitar reduce build time.
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN npm ci --include=dev


# Stage 2: builder — compilar API con Prisma client + dist/
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Buildear packages compartidos PRIMERO (apps/api los importa por su `dist/`).
# Tanto @kardex/types como @kardex/utils tienen package.json con
# "main": "./dist/index.js" — sin este build, nest build falla con TS2307.
RUN npm run build --workspace=@kardex/types --if-present \
 && npm run build --workspace=@kardex/utils --if-present

# Generar Prisma client (necesita schema.prisma)
WORKDIR /app/apps/api
RUN npx prisma generate

# Build NestJS — produce apps/api/dist/main.js
RUN npm run build


# Stage 3: runner — imagen final mínima
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini

# Usuario no-root por seguridad
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nestjs

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copiar artefactos compilados + node_modules de producción
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
# tsconfig necesario para que `ts-node prisma/seed.ts` (Pre-Deploy seed) corra.
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

USER nestjs

# Railway inyecta PORT en runtime; el código lee process.env.PORT
EXPOSE 4000

# tini = init mínimo para forwardear señales (graceful shutdown)
ENTRYPOINT ["/sbin/tini", "--"]

# El release command de Railway corre `prisma migrate deploy` antes del start.
# Aquí solo arrancamos el servidor.
CMD ["node", "apps/api/dist/main.js"]
