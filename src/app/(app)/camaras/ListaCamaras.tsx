"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Aviso } from "@/components/PantallaAcceso";
import {
  Buscador, Cabecera, Campo, Insignia, Modal, PRODUCCIONES, SEDES, Segmentos, Vacio, nombreSede, prodInfo,
} from "@/components/ui";

export type Camara = {
  id: string;
  codigo: string;
  num_visible: string | null;
  numero_serie: string | null;
  propiedad: string;
  estado: string;
  sede_id: string | null;
  produccion_id: string | null;
  temp_sede_id: string | null;
  temp_produccion_id: string | null;
  temp_motivo: string | null;
  generacion_id: string | null;
  fecha_alta: string | null;
  fecha_baja: string | null;
  notas: string | null;
  modelo: { modelo: string; categoria_id: string };
  proveedor: { nombre: string } | null;
  equipos: { id: string; nombre: string; activo: boolean }[];
};

export const ESTADOS: Record<string, { label: string; color: string }> = {
  operativo: { label: "Operativa", color: "var(--ok)" },
  mantenimiento: { label: "Mantenimiento", color: "var(--warn)" },
  averiado: { label: "Averiada", color: "var(--danger)" },
  custodia: { label: "Custodia", color: "#8b5cf6" },
  reserva: { label: "Reserva", color: "var(--accent)" },
  baja: { label: "Baja", color: "var(--muted)" },
};

type FiltroEstado = "servicio" | "taller" | "bajas" | "todas";

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

export function ListaCamaras({ camaras, sedeInicial, prodInicial }: {
  camaras: Camara[]; sedeInicial: string; prodInicial: string;
}) {
  const router = useRouter();
  const [sede, setSede] = useState(sedeInicial);
  const [prod, setProd] = useState(prodInicial);
  const [est, setEst] = useState<FiltroEstado>("servicio");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Camara | null>(null);
  const [form, setForm] = useState<Partial<Camara>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const t = sinAcentos(q.trim());
    return camaras.filter((c) => {
      const s = c.temp_sede_id ?? c.sede_id;
      const p = c.temp_produccion_id ?? c.produccion_id;
      if (sede !== "todas" && s !== sede) return false;
      if (prod === "sin" ? p !== null : prod !== "todas" && p !== prod) return false;
      if (est === "servicio" && c.estado === "baja") return false;
      if (est === "taller" && !["mantenimiento", "averiado"].includes(c.estado)) return false;
      if (est === "bajas" && c.estado !== "baja") return false;
      if (t && !sinAcentos(`${c.codigo} ${c.num_visible ?? ""} ${c.numero_serie ?? ""} ${c.modelo.modelo} ${c.notas ?? ""}`).includes(t)) return false;
      return true;
    });
  }, [camaras, sede, prod, est, q]);

  const grupos = useMemo(() => {
    const m = new Map<string, Camara[]>();
    visibles.forEach((c) => m.set(c.modelo.modelo, [...(m.get(c.modelo.modelo) ?? []), c]));
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [visibles]);

  const enServicio = camaras.filter((c) => c.estado !== "baja");

  function abrir(c: Camara) {
    setError(null);
    setSel(c);
    setForm({ estado: c.estado, sede_id: c.sede_id, produccion_id: c.produccion_id, num_visible: c.num_visible, notas: c.notas });
  }

  async function guardar() {
    if (!sel) return;
    setGuardando(true);
    setError(null);
    const supabase = createClient();
    const pasaABaja = form.estado === "baja" && sel.estado !== "baja";
    const { error } = await supabase.from("elementos").update({
      estado: form.estado,
      sede_id: form.sede_id || null,
      produccion_id: form.produccion_id || null,
      num_visible: form.num_visible?.trim() || null,
      notas: form.notas?.trim() || null,
      fecha_baja: form.estado === "baja" ? sel.fecha_baja ?? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", sel.id);
    if (!error && pasaABaja) {
      // Al dar de baja la cámara, su equipo deja de estar activo
      await supabase.from("equipos").update({ activo: false, fecha_baja: new Date().toISOString().slice(0, 10) })
        .eq("camara_id", sel.id).eq("activo", true);
    }
    setGuardando(false);
    if (error) return setError(`No se ha podido guardar: ${error.message}`);
    setSel(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Cabecera titulo="Cámaras" sub={`${enServicio.length} en servicio · ${camaras.length - enServicio.length} de baja`} />

      <div className="flex flex-wrap gap-3 items-center">
        <Segmentos etiqueta="Estado" valor={est} onChange={setEst} opciones={[
          { id: "servicio", label: "En servicio" },
          { id: "taller", label: "Taller", color: "var(--warn)" },
          { id: "bajas", label: "Bajas" },
          { id: "todas", label: "Todas" },
        ]} />
        <Segmentos etiqueta="Producción" valor={prod} onChange={setProd} opciones={[
          { id: "todas", label: "Todas" },
          ...PRODUCCIONES.map((p) => ({ id: p.id, label: p.id, color: p.color })),
          { id: "sin", label: "Sin asignar" },
        ]} />
        <select className="input !w-auto" value={sede} onChange={(e) => setSede(e.target.value)} aria-label="Sede">
          <option value="todas">Todas las sedes</option>
          {SEDES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <Buscador valor={q} onChange={setQ} placeholder="Buscar código, nº, serie…" />
      </div>

      {grupos.length === 0 ? (
        <Vacio>No hay cámaras con estos filtros.</Vacio>
      ) : (
        grupos.map(([modelo, lista]) => (
          <section key={modelo} aria-label={modelo}>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold mb-2.5 flex items-baseline gap-2">
              {modelo} <span className="text-sm text-muted font-sans font-medium">{lista.length}</span>
            </h2>
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {lista.map((c) => <Ficha key={c.id} c={c} onClick={() => abrir(c)} />)}
            </div>
          </section>
        ))
      )}

      {sel && (
        <Modal
          titulo={`${sel.modelo.modelo} · ${sel.codigo}`}
          onClose={() => setSel(null)}
          pie={<>
            <button className="btn btn-ghost" onClick={() => setSel(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
          </>}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm card p-4 bg-surface-2">
            <dt className="text-muted">Código / QR</dt><dd className="font-semibold">{sel.codigo}</dd>
            <dt className="text-muted">Nº de serie</dt><dd className="font-semibold">{sel.numero_serie ?? "—"}</dd>
            <dt className="text-muted">Propiedad</dt>
            <dd className="font-semibold capitalize">{sel.propiedad}{sel.proveedor ? ` · ${sel.proveedor.nombre}` : ""}</dd>
            <dt className="text-muted">Generación</dt><dd className="font-semibold">{sel.generacion_id === "RENOVE" ? "Renove" : "Actual"}</dd>
            <dt className="text-muted">Alta</dt><dd className="font-semibold">{fecha(sel.fecha_alta)}</dd>
            <dt className="text-muted">Equipo</dt>
            <dd className="font-semibold">{sel.equipos.find((e) => e.activo)?.nombre ?? "—"}</dd>
          </dl>

          <Campo label="Estado">
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(ESTADOS).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setForm({ ...form, estado: k })}
                  aria-pressed={form.estado === k}
                  className="h-10 rounded-lg border text-sm font-semibold transition-colors"
                  style={form.estado === k
                    ? { background: v.color, borderColor: v.color, color: "#fff" }
                    : { borderColor: "var(--border)", color: v.color }}>
                  {v.label}
                </button>
              ))}
            </div>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Sede">
              <select className="input" value={form.sede_id ?? ""} onChange={(e) => setForm({ ...form, sede_id: e.target.value || null })}>
                <option value="">—</option>
                {SEDES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Producción">
              <select className="input" value={form.produccion_id ?? ""} onChange={(e) => setForm({ ...form, produccion_id: e.target.value || null })}>
                <option value="">Sin asignar</option>
                {PRODUCCIONES.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Nº visible (etiqueta)">
            <input className="input" value={form.num_visible ?? ""} onChange={(e) => setForm({ ...form, num_visible: e.target.value })} />
          </Campo>
          <Campo label="Notas">
            <textarea className="input !h-28 py-2" value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </Campo>
          {form.estado === "baja" && sel.estado !== "baja" && (
            <Aviso tipo="error">Al guardar, la cámara pasará a bajas y su equipo dejará de estar activo. Su historial se conserva.</Aviso>
          )}
          {error && <Aviso tipo="error">{error}</Aviso>}
        </Modal>
      )}
    </div>
  );
}

function Ficha({ c, onClick }: { c: Camara; onClick: () => void }) {
  const e = ESTADOS[c.estado] ?? ESTADOS.operativo;
  const p = prodInfo(c.temp_produccion_id ?? c.produccion_id);
  const desplazada = !!c.temp_sede_id;
  return (
    <button onClick={onClick}
      className={`card text-left overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all ${c.estado === "baja" ? "opacity-70" : ""}`}>
      <div className="h-1.5" style={{ background: p?.color ?? "var(--border)" }} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          <span className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-none tabular-nums">
            {c.num_visible || "—"}
          </span>
          <span className="text-[11px] font-bold" style={{ color: p?.color ?? "var(--muted)" }}>{p?.id ?? "S/A"}</span>
        </div>
        <p className="mt-1 text-xs text-muted tabular-nums">#{c.codigo}</p>
        <p className="mt-0.5 text-xs text-muted truncate">{nombreSede(c.temp_sede_id ?? c.sede_id)}{desplazada ? " (temporal)" : ""}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {c.propiedad !== "propio" && <Insignia color="#8b5cf6">{c.proveedor?.nombre ?? "Alquiler"}</Insignia>}
          {c.generacion_id === "RENOVE" && <Insignia color="var(--renove)">Renove</Insignia>}
        </div>
      </div>
      <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"
        style={{ background: `color-mix(in srgb, ${e.color} 14%, transparent)`, color: e.color }}>
        <span className="size-2 rounded-full" style={{ background: e.color }} /> {e.label}
      </div>
    </button>
  );
}
