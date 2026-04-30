# @kardex/web

Next.js 14 frontend for the Kardex system.

## 🚀 Quick Start

```bash
# From repo root
npm install

# Start dev (requires API at :4000)
cd apps/web
cp .env.example .env.local
npm run dev
```

→ http://localhost:3000

## 📦 Structure

```
apps/web/
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # Root layout with providers + fonts
│   │   ├── page.tsx           # Home page
│   │   ├── error.tsx          # Global error boundary
│   │   ├── not-found.tsx      # 404 page
│   │   ├── loading.tsx        # Loading skeleton
│   │   └── globals.css        # Tailwind + CSS variables
│   ├── components/
│   │   └── ui/                # shadcn/ui components (button, input, card, etc.)
│   ├── features/              # Feature-based modules (auth, items, etc.) — added in Fase 2+
│   ├── hooks/                 # Custom React hooks
│   ├── lib/
│   │   ├── cn.ts              # clsx + tailwind-merge helper
│   │   ├── api-client.ts      # Axios instance
│   │   └── constants.ts
│   ├── providers/
│   │   ├── providers.tsx      # Root provider composition
│   │   ├── query-provider.tsx # TanStack Query + DevTools
│   │   ├── theme-provider.tsx # next-themes
│   │   ├── toast-provider.tsx # Sonner
│   │   └── socket-provider.tsx # Socket.IO (placeholder — Fase 5B)
│   └── stores/                # Zustand stores
│       ├── use-ui-store.ts
│       ├── use-auth-store.ts
│       └── use-warehouse-store.ts
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
├── components.json            # shadcn/ui config
└── package.json
```

## 🎨 Design System

- **Base:** TailwindCSS + shadcn/ui (new-york style) + Radix UI primitives
- **Colors:** Slate base + blue accent, semantic colors (success/warning/info/destructive)
- **Typography:** Inter (sans) + JetBrains Mono (mono) via `next/font`
- **Dark mode:** `next-themes` with `system` default
- **Icons:** Lucide Icons only (no mixing)
- **Radius:** 8px (inputs/cards), 12px (large containers), 16px (hero)

## 🧩 Adding shadcn/ui Components

Follow the shadcn docs manually (components are copied into `src/components/ui/`):

```bash
# Manual approach (recommended — no CLI global install needed)
# See https://ui.shadcn.com/docs/components for source
```

## 📜 Scripts

| Command                 | What it does             |
| ----------------------- | ------------------------ |
| `npm run dev`           | Start dev server (:3000) |
| `npm run build`         | Build for production     |
| `npm run start`         | Start production build   |
| `npm run lint`          | Lint + auto-fix          |
| `npm run type-check`    | TypeScript check         |
| `npm run test`          | Unit tests (Vitest)      |
| `npm run test:watch`    | Tests in watch mode      |
| `npm run test:coverage` | Tests with coverage      |

## 🔐 Auth State (Fase 2)

- `accessToken` → in-memory only (Zustand, not persisted)
- `refreshToken` → httpOnly cookie (set by backend)
- `user` → persisted to restore UI state (not credentials)

## 🌐 API Calls

```typescript
import { apiClient, getErrorMessage } from '@/lib/api-client';

try {
  const { data } = await apiClient.get('/items');
  return data.data; // unwraps the { data, meta } envelope
} catch (error) {
  toast.error(getErrorMessage(error));
}
```

## 📚 More

- Root README: [../../README.md](../../README.md)
- Full plan: [../../plan-kardex-refactorizado.md](../../plan-kardex-refactorizado.md)
- Testing guide: [../../testing/README.md](../../testing/README.md)
