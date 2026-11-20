"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Fuel, Gauge, Wrench, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Aviso } from "@/components/PantallaAcceso";
import {
  Buscador, Cabecera, Campo, Insignia, Modal, PRODUCCIONES, SEDES, Segmentos, Vacio, nombreSede, prodInfo,
} from "@/components/ui";

type Evento = { id: string; tipo: string; fecha: string; descripcion: string | null; estado: string };
export type Vehiculo = {
  id: string;
  codigo: string | null;
  matricula: string;
  marca: string | null;
  modelo: string | null;
  propiedad: string;
  estado: string;
  sede_id: string | null;
  produccion_id: string | null;
  coste_mensual: number | null;
  telepeaje: string | null;
  notas: string | null;
  proveedor: { nombre: string } | null;
  vehiculo_km: { km: number; fecha: string }[];
  vehiculo_tarjetas: { hasta: string | null; tarjeta: { alias: string; emisor: string; ultimos_digitos: string | null; estado: string } | null }[];
  vehiculo_eventos: Evento[];
};

const TIPOS: Record<string, { label: string; color: string }> = {
  taller: { label: "Taller", color: "var(--warn)" },
  revision: { label: "Revisión", color: "var(--warn)" },
  itv: { label: "ITV", color: "var(--accent)" },
  neumaticos: { label: "Neumáticos", color: "#8b5cf6" },
  incidencia: { label: "Incidencia", color: "var(--danger)" },
  siniestro: { label: "Siniestro", color: "var(--danger)" },
  multa: { label: "Multa", color: "var(--danger)" },
  repostaje: { label: "Repostaje", color: "var(--ok)" },
  otro: { label: "Otro", color: "var(--muted)" },
};
const ESTADO_VEH: Record<string, { label: string; color: string }> = {
  operativo: { label: "Operativo", color: "var(--ok)" },
  taller: { label: "En taller", color: "var(--warn)" },
  inmovilizado: { label: "Inmovilizado", color: "var(--danger)" },
  baja: { label: "Baja", color: "var(--muted)" },
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-ES");
const kmActual = (v: Vehiculo) =>
  [...v.vehiculo_km].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.km - a.km)[0]?.km ?? null;
const tarjetaActual = (v: Vehiculo) => v.vehiculo_tarjetas.find((t) => !t.hasta)?.tarjeta ?? null;
const hoy = () => new Date().toISOString().slice(0, 10);

export function ListaFlota({ vehiculos, sedeInicial, prodInicial }: { vehiculos: Vehiculo[]; sedeInicial: string; prodInicial: string }) {
  const router = useRouter();
  const [sede, setSede] = useState(sedeInicial);
  const [prod, setProd] = useState(prodInicial);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Vehiculo | null>(null);
  const [estado, setEstado] = useState("operativo");
  const [km, setKm] = useState("");
  const [nuevo, setNuevo] = useState({ tipo: "incidencia", fecha: hoy(), descripcion: "" });
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; m: string } | null>(null);

  const visibles = useMemo(() => {
    const t = sinAcentos(q.trim());
    return vehiculos.filter((v) =>
      v.estado !== "baja" &&
      (sede === "todas" || v.sede_id === sede) &&
      (prod === "todas" || v.produccion_id === prod) &&
      (!t || sinAcentos(`${v.codigo ?? ""} ${v.matricula} ${v.marca ?? ""} ${v.modelo ?? ""}`).includes(t)),
    );
  }, [vehiculos, sede, prod, q]);

  function abrir(v: Vehiculo) {
    setSel(v);
    setEstado(v.estado);
    setKm("");
    setNuevo({ tipo: "incidencia", fecha: hoy(), descripcion: "" });
    setAviso(null);
  }

  async function guardar() {
    if (!sel) return;
    setGuardando(true);
    setAviso(null);
    const supabase = createClient();
    const errores: string[] = [];
    if (estado !== sel.estado) {
      const { error } = await supabase.from("vehiculos").update({ estado }).eq("id", sel.id);
      if (error) errores.push(error.message);
    }
    if (km.trim()) {
      const n = parseInt(km.replace(/\D/g, ""), 10);
      if (Number.isFinite(n)) {
        const { error } = await supabase.from("vehiculo_km").insert({ vehiculo_id: sel.id, km: n, origen: "manual" });
        if (error) errores.push(error.message);
      }
    }
    if (nuevo.descripcion.trim()) {
      const { error } = await supabase.from("vehiculo_eventos").insert({
        vehiculo_id: sel.id, tipo: nuevo.tipo, fecha: nuevo.fecha, descripcion: nuevo.descripcion.trim(), estado: "abierto",
      });
      if (error) errores.push(error.message);
    }
    setGuardando(false);
    if (errores.length) return setAviso({ ok: false, m: `No se ha podido guardar: ${errores.join(" · ")}` });
    setSel(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Cabecera titulo="Flota" sub={`${visibles.length} vehículos`} />

      <div className="flex flex-wrap gap-3 items-center">
        <Segmentos etiqueta="Producción" valor={prod} onChange={setProd} opciones={[
          { id: "todas", label: "Todas" },
          ...PRODUCCIONES.map((p) => ({ id: p.id, label: p.nombre, color: p.color })),
        ]} />
        <select className="input !w-auto" value={sede} onChange={(e) => setSede(e.target.value)} aria-label="Sede">
          <option value="todas">Todas las sedes</option>
          {SEDES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <Buscador valor={q} onChange={setQ} placeholder="Buscar matrícula, código o modelo" />
      </div>

      {visibles.length === 0 ? <Vacio>No hay vehículos con estos filtros.</Vacio> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((v) => {
            const p = prodInfo(v.produccion_id);
            const t = tarjetaActual(v);
            const k = kmActual(v);
            const e = ESTADO_VEH[v.estado] ?? ESTADO_VEH.operativo;
            const abiertos = v.vehiculo_eventos.filter((x) => x.estado === "abierto" || x.estado === "pendiente").length;
            return (
              <button key={v.id} onClick={() => abrir(v)}
                className="card text-left overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="h-1.5" style={{ background: p?.color ?? "var(--border)" }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-[family-name:var(--font-display)] text-xl font-semibold leading-tight truncate">{v.codigo ?? v.matricula}</p>
                      <p className="text-sm text-muted truncate">{v.marca} {v.modelo}</p>
                    </div>
                    <span className="shrink-0 rounded-md border-2 border-text/80 px-1.5 py-0.5 font-mono text-sm font-bold tracking-wider">
                      {v.matricula}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-muted"><Gauge size={15} />
                      <b className="text-text tabular-nums">{k !== null ? k.toLocaleString("es-ES") : "—"}</b> km</span>
                    <span className="flex items-center gap-1.5 text-muted"><Fuel size={15} />
                      {t ? <b className="text-text">···{t.ultimos_digitos}</b> : "Sin tarjeta"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {p && <Insignia color={p.color}>{p.id}</Insignia>}
                    <span className="text-xs text-muted">{nombreSede(v.sede_id)}</span>
                    {v.proveedor && <span className="text-xs text-muted">· {v.proveedor.nombre}</span>}
                    {abiertos > 0 && <Insignia color="var(--danger)">{abiertos} abierta{abiertos > 1 ? "s" : ""}</Insignia>}
                  </div>
                </div>
                <div className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide flex items-center justify-between"
                  style={{ background: `color-mix(in srgb, ${e.color} 14%, transparent)`, color: e.color }}>
                  <span>{e.label}</span>
                  <span className="flex items-center gap-1 normal-case font-medium"><Wrench size={12} /> {v.vehiculo_eventos.length}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {sel && (
        <Modal titulo={`${sel.codigo ?? ""} · ${sel.matricula}`} onClose={() => setSel(null)}
          pie={<>
            <button className="btn btn-ghost" onClick={() => setSel(null)}>Cerrar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
          </>}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm card p-4 bg-surface-2">
            <dt className="text-muted">Vehículo</dt><dd className="font-semibold">{sel.marca} {sel.modelo}</dd>
            <dt className="text-muted">Renting</dt><dd className="font-semibold">{sel.proveedor?.nombre ?? "—"}</dd>
            <dt className="text-muted">Cuota/mes</dt><dd className="font-semibold">{sel.coste_mensual ? `${sel.coste_mensual.toLocaleString("es-ES")} €` : "—"}</dd>
            <dt className="text-muted">Tarjeta</dt><dd className="font-semibold">{tarjetaActual(sel) ? `${tarjetaActual(sel)!.emisor} ···${tarjetaActual(sel)!.ultimos_digitos}` : "—"}</dd>
            <dt className="text-muted">Telepeaje</dt><dd className="font-semibold">{sel.telepeaje ?? "—"}</dd>
            <dt className="text-muted">Kilómetros</dt><dd className="font-semibold">{kmActual(sel)?.toLocaleString("es-ES") ?? "—"}</dd>
          </dl>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Estado">
              <select className="input" value={estado} onChange={(e) => setEstado(e.target.value)}>
                {Object.entries(ESTADO_VEH).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Campo>
            <Campo label="Nuevos km">
              <input className="input" inputMode="numeric" placeholder={kmActual(sel)?.toString() ?? ""} value={km} onChange={(e) => setKm(e.target.value)} />
            </Campo>
          </div>

          <fieldset className="card p-4 space-y-3">
            <legend className="px-1 text-sm font-semibold flex items-center gap-1.5"><Plus size={15} /> Anotar incidencia</legend>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Tipo">
                <select className="input" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Campo>
              <Campo label="Fecha">
                <input type="date" className="input" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} />
              </Campo>
            </div>
            <Campo label="Descripción">
              <textarea className="input !h-20 py-2" placeholder="Qué ha pasado…" value={nuevo.descripcion}
                onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} />
            </Campo>
          </fieldset>

          {aviso && <Aviso tipo={aviso.ok ? "ok" : "error"}>{aviso.m}</Aviso>}

          <div>
            <h3 className="label">Historial ({sel.vehiculo_eventos.length})</h3>
            <ol className="space-y-2">
              {[...sel.vehiculo_eventos].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((ev) => {
                const t = TIPOS[ev.tipo] ?? TIPOS.otro;
                return (
                  <li key={ev.id} className="flex gap-3 text-sm">
                    <span className="w-20 shrink-0 text-muted tabular-nums">{fecha(ev.fecha)}</span>
                    <div className="min-w-0">
                      <Insignia color={t.color}>{t.label}</Insignia>
                      <p className="mt-0.5">{ev.descripcion}</p>
                    </div>
                  </li>
                );
              })}
              {sel.vehiculo_eventos.length === 0 && <li className="text-sm text-muted">Sin incidencias registradas.</li>}
            </ol>
          </div>
        </Modal>
      )}
    </div>
  );
}
