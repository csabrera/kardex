'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Barra de progreso fina en la parte superior que se anima durante cada
 * navegación del App Router. Funciona combinando:
 *   (1) un click-handler global sobre <a href> internos para iniciar la barra
 *   (2) un efecto sobre `usePathname` que completa y oculta la barra cuando
 *       la nueva ruta ya está montada
 *
 * Sin dependencias externas. Usa tokens HSL del design system.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuando termine la navegación (cambio real de pathname o searchParams),
  // completamos la barra al 100% y la ocultamos.
  useEffect(() => {
    if (!visible) return;
    setProgress(100);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Click-handler global que detecta navegación a rutas internas e inicia
  // la barra de progreso.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Solo click primario sin modificadores
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as HTMLElement | null)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href) return;
      // Ignorar externas, anclas, mailto, tel, nuevas pestañas y descargas
      if (
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        target.target === '_blank' ||
        target.hasAttribute('download')
      ) {
        return;
      }
      // Si es la misma ruta, no mostrar barra
      try {
        const url = new URL(href, window.location.origin);
        if (url.pathname === pathname && url.search === window.location.search) return;
      } catch {
        return;
      }

      start();
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const start = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    setVisible(true);
    setProgress(8);
    // Avanza progresivamente hasta el 80% para indicar actividad
    tickTimerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 80) return p;
        // Incremento desacelerado a medida que avanza
        const delta = p < 30 ? 12 : p < 55 ? 6 : 3;
        return Math.min(80, p + delta);
      });
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 top-0 z-[60] h-[2px]"
    >
      <div
        className="h-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-[width,opacity] duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
