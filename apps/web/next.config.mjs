/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

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

  // Proxy API in dev to avoid CORS issues
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/backend/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
