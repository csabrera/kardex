'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/use-auth-store';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

/**
 * Detecta inactividad del usuario en el dashboard y cierra la sesión cuando
 * pasa el umbral. Se monta una sola vez dentro del SessionInitializer.
 *
 * Implementación:
 * - `lastActivityRef` guarda el timestamp del último evento de actividad.
 * - Cada 30s verificamos si pasamos el umbral — más eficiente que resetear
 *   un setTimeout en cada mousemove.
 * - Throttle de los listeners a 1s — evita 60+ updates/s al mover el mouse.
 *
 * No hay "1 minuto de aviso antes": preferimos UX simple y sin interrupciones.
 * Si el usuario quiere extender la sesión, simplemente hace cualquier acción.
 */
export function IdleTimer() {
  const lastActivityRef = useRef<number>(Date.now());
  const loggingOutRef = useRef<boolean>(false);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    let throttleHandle = 0;
    const onActivity = () => {
      const now = Date.now();
      // Throttle: solo registrar actividad cada 1s.
      if (now - throttleHandle < 1000) return;
      throttleHandle = now;
      lastActivityRef.current = now;
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true }),
    );

    // Check cada 30s si hemos pasado el umbral.
    const checkInterval = window.setInterval(() => {
      if (loggingOutRef.current) return;
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_TIMEOUT_MS) {
        loggingOutRef.current = true;
        void handleIdleLogout();
      }
    }, 30_000);

    async function handleIdleLogout() {
      toast.info('Tu sesión expiró por inactividad. Vuelve a ingresar.', {
        duration: 6000,
      });
      try {
        await apiClient.post('/auth/logout');
      } catch {
        /* ignore — limpiar igual */
      }
      clearSession();
      window.location.replace('/login');
    }

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.clearInterval(checkInterval);
    };
  }, [clearSession]);

  return null;
}
