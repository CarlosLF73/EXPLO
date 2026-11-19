import type { LucideIcon } from "lucide-react";

/** Marcador para las secciones que llegan en las siguientes fases. */
export function Proximamente({
  titulo,
  icon: Icon,
  puntos,
}: {
  titulo: string;
  icon: LucideIcon;
  puntos: string[];
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-semibold">{titulo}</h1>
      <div className="card p-6 mt-5">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center size-12 rounded-xl bg-surface-2 text-accent">
            <Icon size={24} />
          </span>
          <div>
            <p className="font-semibold">En construcción</p>
            <p className="text-sm text-muted">Esta sección llega en las próximas versiones.</p>
          </div>
        </div>
        <ul className="mt-5 space-y-2 text-[15px]">
          {puntos.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-accent">•</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
