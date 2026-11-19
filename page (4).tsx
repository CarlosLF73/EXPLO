import Link from "next/link";
import { Camera, Wrench, Radio, Car, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Resumen = {
  sede_id: string;
  produccion_id: string;
  equipos: number;
  camaras_operativas: number;
  camaras_en_taller: number;
  salidas_activas: number;
  vehiculos: number;
};
type Sede = { id: string; nombre: string; delegacion_id: string; orden: number };
type Delegacion = { id: string; nombre: string; orden: number };
type Produccion = { id: string; nombre: string };
type EquipoGen = { sede_id: string; produccion_id: string; generacion_id: string | null };

const COLOR_PROD: Record<string, string> = { A3: "var(--a3)", L6: "var(--l6)" };

export default async function PanelPage() {
  const supabase = await createClient();
  const [resumen, sedes, delegaciones, producciones, equipos] = await Promise.all([
    supabase.from("v_resumen_sede_produccion").select("*").returns<Resumen[]>(),
    supabase.from("sedes").select("id, nombre, delegacion_id, orden").order("orden").returns<Sede[]>(),
    supabase.from("delegaciones").select("id, nombre, orden").order("orden").returns<Delegacion[]>(),
    supabase.from("producciones").select("id, nombre").order("id").returns<Produccion[]>(),
    supabase.from("equipos").select("sede_id, produccion_id, generacion_id").eq("activo", true).returns<EquipoGen[]>(),
  ]);

  const filas = resumen.data ?? [];
  const prods = producciones.data ?? [];
  const eqs = equipos.data ?? [];
  const clave = (s: string, p: string) => `${s}|${p}`;
  const porCelda = new Map(filas.map((r) => [clave(r.sede_id, r.produccion_id), r]));

  const total = (k: keyof Resumen) => filas.reduce((acc, r) => acc + Number(r[k] ?? 0), 0);
  const kpis = [
    { label: "Equipos", valor: total("equipos"), icon: Layers, color: "var(--accent)" },
    { label: "Cámaras operativas", valor: total("camaras_operativas"), icon: Camera, color: "var(--ok)" },
    { label: "En taller", valor: total("camaras_en_taller"), icon: Wrench, color: "var(--warn)" },
    { label: "En la calle ahora", valor: total("salidas_activas"), icon: Radio, color: "var(--danger)" },
    { label: "Vehículos", valor: total("vehiculos"), icon: Car, color: "var(--muted)" },
  ];
  const renoveTotal = eqs.filter((e) => e.generacion_id === "RENOVE").length;

  const error = resumen.error || sedes.error;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-semibold leading-none">
            Panel general
          </h1>
          <p className="mt-1.5 text-muted">Reparto de equipos y flota por delegación y producción</p>
        </div>
        {eqs.length > 0 && (
          <div className="card px-4 py-2.5 flex items-center gap-3 text-sm">
            <span className="font-semibold">Renove</span>
            <BarraGeneracion renove={renoveTotal} total={eqs.length} ancho="w-32" />
            <span className="text-muted tabular-nums">{renoveTotal}/{eqs.length}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="card p-4 text-danger text-sm">No se han podido cargar los datos: {error.message}</p>
      )}

      <section aria-label="Totales" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(({ label, valor, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <span className="grid place-items-center size-11 rounded-xl shrink-0"
              style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
              <Icon size={22} />
            </span>
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-none tabular-nums">{valor}</p>
              <p className="text-[13px] text-muted mt-1 truncate">{label}</p>
            </div>
          </div>
        ))}
      </section>

      {total("equipos") === 0 && !error && (
        <div className="card p-5 border-dashed text-center">
          <p className="font-semibold">Aún no hay equipos cargados</p>
          <p className="text-sm text-muted mt-1">
            En cuanto se cargue el inventario de cámaras, cada delegación mostrará aquí sus equipos.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {(delegaciones.data ?? []).map((d) => {
          const sedesDeleg = (sedes.data ?? []).filter((s) => s.delegacion_id === d.id);
          return (
            <section key={d.id} aria-labelledby={`del-${d.id}`}>
              <h2 id={`del-${d.id}`}
                className="font-[family-name:var(--font-display)] text-xl font-semibold uppercase tracking-wide text-muted mb-2.5">
                {d.nombre}
              </h2>
              <div className="space-y-3">
                {sedesDeleg.map((s) => (
                  <div key={s.id} className="grid gap-3 md:grid-cols-[150px_1fr_1fr] items-stretch">
                    <div className="flex md:flex-col md:justify-center gap-2 md:gap-0.5 px-1">
                      <span className="font-semibold text-lg leading-tight">{s.nombre}</span>
                      {sedesDeleg.length > 1 && <span className="text-xs text-muted md:mt-0.5">sede</span>}
                    </div>
                    {prods.map((p) => {
                      const r = porCelda.get(clave(s.id, p.id));
                      if (!r) {
                        return (
                          <div key={p.id}
                            className="rounded-[14px] border border-dashed border-border grid place-items-center p-4 text-sm text-muted min-h-24">
                            Sin {p.nombre} en {s.nombre}
                          </div>
                        );
                      }
                      const eqCelda = eqs.filter((e) => e.sede_id === s.id && e.produccion_id === p.id);
                      const renove = eqCelda.filter((e) => e.generacion_id === "RENOVE").length;
                      return (
                        <Celda key={p.id} r={r} prod={p} renove={renove} totalEq={eqCelda.length} />
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Celda({ r, prod, renove, totalEq }: { r: Resumen; prod: Produccion; renove: number; totalEq: number }) {
  const color = COLOR_PROD[prod.id] ?? "var(--accent)";
  const chips = [
    { icon: Camera, valor: r.camaras_operativas, label: "operativas", color: "var(--ok)" },
    { icon: Wrench, valor: r.camaras_en_taller, label: "taller", color: "var(--warn)" },
    { icon: Radio, valor: r.salidas_activas, label: "en la calle", color: "var(--danger)" },
    { icon: Car, valor: r.vehiculos, label: "vehículos", color: "var(--muted)" },
  ];
  return (
    <Link
      href={`/camaras?sede=${r.sede_id}&prod=${r.produccion_id}`}
      className="card relative overflow-hidden p-4 pl-5 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
    >
      <span aria-hidden className="absolute left-0 inset-y-0 w-1.5" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{prod.nombre}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-none tabular-nums">
              {r.equipos}
            </span>
            <span className="text-sm text-muted">equipos</span>
          </p>
        </div>
        {totalEq > 0 && (
          <div className="text-right">
            <BarraGeneracion renove={renove} total={totalEq} ancho="w-24" />
            <p className="text-[11px] text-muted mt-1">{renove} renove · {totalEq - renove} actual</p>
          </div>
        )}
      </div>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {chips.map(({ icon: Icon, valor, label, color: c }) => (
          <span key={label}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium bg-surface-2"
            style={{ color: Number(valor) > 0 ? c : "var(--muted)" }}>
            <Icon size={14} />
            <span className="tabular-nums font-semibold">{valor}</span>
            <span className="text-muted">{label}</span>
          </span>
        ))}
      </div>
    </Link>
  );
}

function BarraGeneracion({ renove, total, ancho }: { renove: number; total: number; ancho: string }) {
  const pct = total ? Math.round((renove / total) * 100) : 0;
  return (
    <div className={`${ancho} h-2 rounded-full overflow-hidden bg-actual/40`}
      role="img" aria-label={`${pct}% de equipos del renove`}>
      <div className="h-full bg-renove" style={{ width: `${pct}%` }} />
    </div>
  );
}
