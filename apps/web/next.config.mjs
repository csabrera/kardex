/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // ESLint: no bloquear el build por warnings/errors. El linting se ejecuta
  // por separado (`npm run lint`) y debe pasar como gate en CI antes del build.
  // Sin esto, `next build` falla por reglas de a11y y refactors pendientes
  // que no son funcionales.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Transpile shared workspace packages
  transpilePackages: ['@kardex/types', '@kardex/utils'],

  // Images config
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**.railway.app',
      },
    ],
  },

  // Experimental features
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Proxy all /api/* requests to the NestJS backend so the browser only talks
  // to localhost:3000. This ensures cookies are set on the same origin as the
  // frontend and the Next.js middleware can always read the refresh_token cookie.
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // Redirects para URLs consolidadas:
  // - Pase 1 (consolidación 23-abr): movimientos/stock/kardex absorbidos por
  //   /almacen-principal y /items/[id]
  // - Pase 2 (Nivel C, 24-abr): /almacen-principal pasa a ser hub con tabs.
  //   Las URLs operativas se redirigen al tab correspondiente (?tab=).
  async redirects() {
    return [
      // Pase 1
      {
        source: '/dashboard/movimientos/:path*',
        destination: '/dashboard/almacen-principal?tab=movimientos',
        permanent: true,
      },
      {
        source: '/dashboard/stock',
        destination: '/dashboard/almacen-principal',
        permanent: true,
      },
      {
        source: '/dashboard/kardex',
        destination: '/dashboard/items',
        permanent: true,
      },
      // Pase 2 — Nivel C
      {
        // /items era el "catálogo"; resultó ser la misma data que el inventario
        // del Principal. Fusionado como tab default `?tab=inventario` (no se
        // necesita query param porque es el default).
        source: '/dashboard/items',
        destination: '/dashboard/almacen-principal',
        permanent: true,
      },
      {
        source: '/dashboard/transferencias',
        destination: '/dashboard/almacen-principal?tab=transferencias',
        permanent: true,
      },
      {
        source: '/dashboard/herramientas',
        destination: '/dashboard/almacen-principal?tab=prestamos',
        permanent: true,
      },
      {
        source: '/dashboard/epp',
        destination: '/dashboard/almacen-principal?tab=epp',
        permanent: true,
      },
      {
        source: '/dashboard/combustible',
        destination: '/dashboard/almacen-principal?tab=combustible',
        permanent: true,
      },
      {
        source: '/dashboard/mantenimientos',
        destination: '/dashboard/almacen-principal?tab=mantenimientos',
        permanent: true,
      },
      {
        source: '/dashboard/inventarios',
        destination: '/dashboard/almacen-principal?tab=inventarios',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
