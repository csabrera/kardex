import { Building2, Package, ShieldCheck, Zap } from 'lucide-react';

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Panel izquierdo — Branding (solo desktop) */}
      <aside className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex-col justify-between p-12 text-white">
        {/* Decoración de fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-lg leading-tight">Kardex</p>
            <p className="text-xs text-white/60">Gestión de inventario · Construcción</p>
          </div>
        </div>

        {/* Hero */}
        <div className="relative max-w-md space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance">
            Control total de tus obras, herramientas y materiales.
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Sistema integral de kardex diseñado para empresas constructoras. Trazabilidad
            en tiempo real, desde el almacén central hasta cada estación de trabajo.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { icon: Package, label: 'Inventario en tiempo real' },
              { icon: Building2, label: 'Multi-obra y almacenes' },
              { icon: ShieldCheck, label: 'Auditoría completa' },
              { icon: Zap, label: 'Alertas inteligentes' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-white/80">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10">
                  <Icon className="h-4 w-4" />
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Kardex — Todos los derechos reservados.
        </div>
      </aside>

      {/* Panel derecho — Formulario */}
      <main className="flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12">
        {/* Logo mobile */}
        <div className="lg:hidden mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">Kardex</span>
        </div>

        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
