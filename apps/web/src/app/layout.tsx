import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { Outfit } from 'next/font/google';

import { Providers } from '@/providers/providers';

import type { Metadata, Viewport } from 'next';

import './globals.css';

// Outfit como display font para títulos, brand y encabezados destacados.
// Geist Sans (body) se mantiene para UI y texto regular.
const displayFont = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Kardex — Sistema de Inventario',
    template: '%s — Kardex',
  },
  description:
    'Sistema integral de gestión de inventario, almacenes, transferencias y reportes para empresas constructoras.',
  applicationName: 'Kardex',
  authors: [{ name: 'Kardex Team' }],
  keywords: [
    'kardex',
    'inventario',
    'construcción',
    'almacenes',
    'movimientos',
    'transferencias',
  ],
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1120' },
  ],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${displayFont.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
