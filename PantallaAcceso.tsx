import { Marca } from "./Marca";

/** Contenedor común de las pantallas sin sesión (login, recuperar). */
export function PantallaAcceso({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10 bg-ink relative overflow-hidden">
      {/* franjas de producción como detalle de marca */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 flex">
        <div className="flex-1 bg-a3" />
        <div className="flex-1 bg-l6" />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Marca claro />
        </div>
        <div className="card p-6 sm:p-7 shadow-2xl">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-muted">{subtitulo}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function Aviso({ tipo, children }: { tipo: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className="rounded-lg px-3 py-2 text-sm font-medium"
      style={{
        background: tipo === "error" ? "color-mix(in srgb, var(--danger) 12%, transparent)" : "color-mix(in srgb, var(--ok) 12%, transparent)",
        color: tipo === "error" ? "var(--danger)" : "var(--ok)",
      }}
    >
      {children}
    </p>
  );
}
