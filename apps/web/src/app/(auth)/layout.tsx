import { Building2 } from 'lucide-react';

import type { ReactNode } from 'react';

/**
 * Layout compartido de páginas de auth (login, recuperar password, reset).
 *
 * Panel izquierdo: brand block con grid arquitectónico SVG, copy profesional
 * sobrio, acento naranja construcción puntual. Reemplaza el patrón "gradient +
 * blobs blurred" estilo template SaaS.
 *
 * Panel derecho: contenedor del formulario, centrado, máx-w-md.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-background">
      {/* Panel izquierdo — brand (desktop only) */}
      <aside className="hidden lg:flex relative overflow-hidden bg-[hsl(222_47%_8%)] flex-col justify-between p-12 text-white">
        {/* Grid arquitectónico — patrón plano técnico, evoca construcción */}
        <BlueprintGrid />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-white/8 backdrop-blur-sm ring-1 ring-white/15">
            <Building2 className="h-6 w-6 text-white" strokeWidth={2.25} />
            {/* Marca de identidad — punto naranja en esquina superior derecha */}
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-construction ring-2 ring-[hsl(222_47%_8%)]" />
          </div>
          <div>
            <p className="font-display font-bold text-xl leading-none tracking-tight">
              Kardex
            </p>
            <p className="mt-1.5 text-[10.5px] uppercase tracking-[0.12em] text-white/55 font-medium">
              Inventario · Construcción
            </p>
          </div>
        </div>

        {/* Hero */}
        <div className="relative max-w-md space-y-7">
          {/* Cota técnica decorativa — refuerza el lenguaje de plano */}
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.2em] text-construction font-medium">
            <span className="h-px w-8 bg-construction" />
            <span>Sistema</span>
          </div>

          <h1 className="font-display text-[42px] leading-[1.05] tracking-[-0.02em] font-bold text-balance">
            Trazabilidad total
            <br />
            <span className="text-white/60">de tu obra.</span>
          </h1>

          <p className="text-white/65 text-[15px] leading-relaxed">
            Cada material, cada herramienta, cada entrada y salida. Registrado al
            milímetro desde el Almacén Principal hasta el último puesto de trabajo en
            obra.
          </p>

          {/* Tres pilares en lugar de cuatro — menos chrome */}
          <ul className="space-y-3 pt-4 border-t border-white/10">
            {[
              { num: '01', label: 'Multi-obra y almacenes' },
              { num: '02', label: 'Auditoría y trazabilidad' },
              { num: '03', label: 'Alertas en tiempo real' },
            ].map(({ num, label }) => (
              <li key={num} className="flex items-baseline gap-3 text-sm text-white/75">
                <span className="font-display text-[11px] font-semibold text-construction tabular-nums tracking-wider">
                  {num}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer — cota decorativa + copyright */}
        <div className="relative flex items-end justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/30">
            <span className="h-px w-6 bg-white/20" />
            <span>© {new Date().getFullYear()} · Kardex</span>
          </div>
          <span className="font-mono text-[10px] text-white/25 tabular-nums">v0.1.0</span>
        </div>
      </aside>

      {/* Panel derecho — formulario */}
      <main className="relative flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12">
        {/* Mobile brand */}
        <div className="lg:hidden mb-10 flex items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent/80 text-accent-foreground shadow-soft ring-1 ring-accent/30">
            <Building2 className="h-5 w-5" strokeWidth={2.25} />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-construction ring-2 ring-background" />
          </div>
          <div>
            <p className="font-display font-bold text-lg leading-none tracking-tight">
              Kardex
            </p>
            <p className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground mt-1 font-medium">
              Inventario · Construcción
            </p>
          </div>
        </div>

        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

/**
 * Grid arquitectónico SVG — patrón tipo plano técnico para el background
 * del panel izquierdo. Combina líneas finas (grid principal) con líneas más
 * gruesas (cota cada 4 unidades) y detalles de medida en naranja construcción.
 */
function BlueprintGrid() {
  return (
    <>
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-white/[0.06]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="blueprint-grid-fine"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern
            id="blueprint-grid-major"
            width="128"
            height="128"
            patternUnits="userSpaceOnUse"
          >
            <rect width="128" height="128" fill="url(#blueprint-grid-fine)" />
            <path
              d="M 128 0 L 0 0 0 128"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.6"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#blueprint-grid-major)" />
      </svg>

      {/* Detalle de cota decorativa — referencia visual tipo plano */}
      <svg
        aria-hidden="true"
        className="absolute top-1/3 right-0 w-32 h-32 text-construction/30"
        viewBox="0 0 128 128"
        fill="none"
      >
        {/* Línea de cota vertical */}
        <line x1="20" y1="20" x2="20" y2="108" stroke="currentColor" strokeWidth="1" />
        {/* Flechas extremos */}
        <path
          d="M 16 24 L 20 20 L 24 24"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 16 104 L 20 108 L 24 104"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
        {/* Texto cota */}
        <text
          x="40"
          y="68"
          fill="currentColor"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
          letterSpacing="1"
        >
          1.00
        </text>
      </svg>

      {/* Glow muy sutil para profundidad — sin caer en blob template */}
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 h-64 w-[140%] rounded-full bg-accent/10 blur-3xl pointer-events-none" />
    </>
  );
}
