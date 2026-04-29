# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Kardex Web — multi-stage Dockerfile para Railway / cualquier PaaS
# Next.js 14 con `output: 'standalone'` para imagen final mínima.
# Monorepo Turborepo con shared packages (@kardex/types, @kardex/utils).
# Build context: raíz del repo (no apps/web).
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: deps — instalar dependencias de todo el workspace
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY testing/package.json ./testing/

# Skip Puppeteer aunque sea dep de @kardex/api — no se usa en build de web.
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN npm ci --include=dev


# Stage 2: builder — Next.js standalone build
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars se "hornean" en build time (Next.js las inlinea en el bundle).
# Railway las inyecta antes del docker build via build args.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ENV NEXT_TELEMETRY_DISABLED=1

# Build packages compartidos primero (si tienen dist propio)
RUN npm run build --workspace=@kardex/types --if-present \
 && npm run build --workspace=@kardex/utils --if-present

# Build Next.js — produce apps/web/.next/standalone/
WORKDIR /app/apps/web
RUN npm run build


# Stage 3: runner — imagen final con solo el standalone build
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat tini

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone build trae su propio node_modules mínimo + server.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]

# server.js está en apps/web/server.js dentro del standalone.
# Railway inyecta PORT y HOSTNAME automáticamente.
CMD ["node", "apps/web/server.js"]
