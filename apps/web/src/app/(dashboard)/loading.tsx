/**
 * Fallback mostrado por Next.js (App Router) como Suspense boundary durante
 * la navegación entre rutas del dashboard. Simula la estructura típica de
 * una página (header + filtros + KPIs + tabla) para dar sensación de
 * "algo está apareciendo" en lugar de un spinner plano.
 *
 * Este archivo se aplica automáticamente a TODAS las rutas dentro de
 * `apps/web/src/app/(dashboard)/*`. Si una página específica necesita un
 * esqueleto distinto, puede crear su propio `loading.tsx` en su carpeta.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header: icono + título + descripción + acciones */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-muted" />
          <div className="space-y-2 min-w-0">
            <div className="h-7 w-56 rounded-md bg-muted" />
            <div className="h-3.5 w-80 max-w-full rounded-md bg-muted/70" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-lg bg-muted" />
          <div className="h-10 w-28 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Barra de filtros / búsqueda */}
      <div className="flex gap-3 flex-wrap">
        <div className="h-10 w-64 max-w-full rounded-lg bg-muted" />
        <div className="h-10 w-44 rounded-lg bg-muted" />
        <div className="h-10 w-44 rounded-lg bg-muted" />
      </div>

      {/* Grid de KPIs (4 columnas) — se omite en pantallas pequeñas */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-muted/80" />
              <div className="h-8 w-8 rounded-lg bg-muted" />
            </div>
            <div className="h-9 w-24 rounded-md bg-muted" />
            <div className="h-3 w-32 rounded bg-muted/60" />
          </div>
        ))}
      </div>

      {/* Tabla: cabecera + 8 filas */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/40">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-3 rounded bg-muted-foreground/20"
              style={{
                width: ['6%', '28%', '18%', '14%', '18%'][i],
              }}
            />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, row) => (
          <div
            key={row}
            className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
          >
            <div className="h-4 w-8 rounded bg-muted" />
            <div className="h-4 flex-1 max-w-[320px] rounded bg-muted/80" />
            <div className="h-6 w-20 rounded-full bg-muted/60" />
            <div className="h-4 w-16 rounded bg-muted/60" />
            <div className="h-8 w-20 rounded-md bg-muted" />
          </div>
        ))}
      </div>

      {/* Aria-live para anunciar carga a lectores de pantalla */}
      <span className="sr-only" role="status" aria-live="polite">
        Cargando contenido…
      </span>
    </div>
  );
}
