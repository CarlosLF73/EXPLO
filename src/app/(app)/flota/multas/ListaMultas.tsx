"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, FileText, Mail, UserCheck, Wallet, CheckCircle2, Settings2, AlertTriangle, ShieldCheck, Ban, FileDown, Sparkles, Pencil, Undo2, Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generarPdfMulta } from "@/lib/pdfMulta";
import { Aviso } from "@/components/PantallaAcceso";
import { Buscador, Cabecera, Campo, Insignia, Modal, PRODUCCIONES, Segmentos, Vacio, nombreSede, prodInfo } from "@/components/ui";

// ---------------------------------------------------------------- tipos
export type VehMin = {
  id: string; codigo: string | null; matricula: string; marca: string | null; modelo: string | null;
  sede_id?: string | null; produccion_id?: string | null;
};
export type OpMin = { id: string; nombre: string; apellidos: string | null; produccion_id: string | null; email: string | null };
export type Doc = { id: string; entidad_id: string; tipo: string; nombre_archivo: string | null; storage_path: string; created_at: string };
export type Privado = {
  operador_id: string; dni: string | null; dni_caducidad: string | null; direccion: string | null;
  comprobado_el: string | null; a_revisar: boolean; notas: string | null;
};
export type Contactos = { para: string[]; cc: string[] };
export type Multa = {
  id: string; vehiculo_id: string | null; matricula: string | null; fecha_infraccion: string | null;
  lugar: string | null; organismo: string | null; expediente: string | null; importe: number | null; puntos: number | null;
  fecha_notificacion: string | null; plazo_identificacion: string | null; origen: string | null;
  estado: "recibida" | "identificado" | "comunicada" | "pagada" | "cerrada" | "anulada";
  via: "identificacion" | "paga_conductor" | null; operador_id: string | null; conductor_origen: string | null;
  fecha_identificado: string | null; fecha_comunicada: string | null; fecha_pago: string | null; fecha_cierre: string | null;
  notas: string | null; created_at: string;
  medio_comunicacion: "correo" | "pdf" | "manual" | null; nota_comunicacion: string | null;
  vehiculo: VehMin | null;
  operador: { id: string; nombre: string; apellidos: string | null; telefono: string | null; telefono_personal: string | null; email: string | null } | null;
};

const PASOS: { id: Multa["estado"]; label: string }[] = [
  { id: "recibida", label: "Recibida" },
  { id: "identificado", label: "Conductor" },
  { id: "comunicada", label: "Comunicada" },
  { id: "pagada", label: "Pagada" },
  { id: "cerrada", label: "Cerrada" },
];
const MEDIOS = { correo: "por correo", pdf: "con PDF", manual: "a mano" } as const; // "manual" solo para datos antiguos
type Medio = keyof typeof MEDIOS;
const ORIGENES: Record<string, string> = {
  pyramid: "Pyramid Consulting", multas_mediapro: "Multas Mediapro", dgt: "DGT", renting: "Renting", otro: "Otro",
};

// ---------------------------------------------------------------- utilidades
const hoy = () => new Date().toISOString().slice(0, 10);
const masDias = (iso: string, d: number) => { const f = new Date(iso + "T12:00:00"); f.setDate(f.getDate() + d); return f.toISOString().slice(0, 10); };
const fecha = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es-ES") : "—");
const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—";
const diasHasta = (iso: string | null) =>
  iso ? Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 86_400_000) : null;
const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const nombreCompleto = (o: { nombre: string; apellidos: string | null } | null) => (o ? `${o.nombre} ${o.apellidos ?? ""}`.trim() : "");
const euros = (n: number | null) => (n == null ? "—" : `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`);

/** Color del semáforo según días que quedan para identificar. */
function semaforo(m: Multa) {
  if (!["recibida", "identificado"].includes(m.estado)) return null;
  const d = diasHasta(m.plazo_identificacion);
  if (d === null) return { color: "var(--muted)", texto: "Sin plazo" };
  if (d < 0) return { color: "var(--danger)", texto: `Vencido hace ${-d} d` };
  if (d <= 3) return { color: "var(--danger)", texto: d === 0 ? "Vence hoy" : `${d} d` };
  if (d <= 7) return { color: "var(--warn)", texto: `${d} días` };
  return { color: "var(--ok)", texto: `${d} días` };
}

/** Abre el correo en Outlook. Outlook separa los destinatarios con punto y coma. */
function abrirCorreo(para: string[], cc: string[], asunto: string, cuerpo: string) {
  const partes = [
    cc.length ? `cc=${cc.join(";")}` : "",
    `subject=${encodeURIComponent(asunto)}`,
    `body=${encodeURIComponent(cuerpo.replace(/\n/g, "\r\n"))}`,
  ].filter(Boolean);
  window.location.href = `mailto:${para.join(";")}?${partes.join("&")}`;
}

/** Despedida del correo: sin firma, para insertar la de Outlook (Insertar → Firma). */
const DESPEDIDA = ["Un saludo,", ""];

/** Problemas de los datos privados antes de comunicarlos. */
function problemasPrivados(p: Privado | undefined) {
  if (!p) return ["No hay DNI ni dirección guardados para este operador."];
  const r: string[] = [];
  if (!p.dni) r.push("Falta el DNI.");
  if (!p.direccion) r.push("Falta la dirección.");
  if (p.dni_caducidad && p.dni_caducidad < hoy()) r.push(`El DNI caducó el ${fecha(p.dni_caducidad)}.`);
  if (!p.dni_caducidad) r.push("No consta la caducidad del DNI.");
  if (p.comprobado_el && p.comprobado_el < masDias(hoy(), -180)) r.push(`Dirección comprobada por última vez el ${fecha(p.comprobado_el)}.`);
  return r;
}

// ================================================================ componente
export function ListaMultas({
  multas, vehiculos, operadores, docs, contactos, privados, esAdmin, miNombre,
}: {
  multas: Multa[]; vehiculos: VehMin[]; operadores: OpMin[]; docs: Doc[]; contactos: Contactos;
  privados: Privado[]; esAdmin: boolean; miNombre: string;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<"abiertas" | "cerradas" | "todas">("abiertas");
  const [q, setQ] = useState("");
  const [nueva, setNueva] = useState(false);
  const [sel, setSel] = useState<Multa | null>(null);
  const [verContactos, setVerContactos] = useState(false);
  const [editar, setEditar] = useState<Multa | null>(null);

  const visibles = useMemo(() => {
    const t = sinAcentos(q.trim());
    return multas
      .filter((m) =>
        filtro === "todas" ? true : filtro === "cerradas" ? ["cerrada", "anulada"].includes(m.estado) : !["cerrada", "anulada"].includes(m.estado))
      .filter((m) => !t || sinAcentos(`${m.expediente ?? ""} ${m.matricula ?? ""} ${m.vehiculo?.codigo ?? ""} ${m.lugar ?? ""} ${nombreCompleto(m.operador)}`).includes(t))
      .sort((a, b) => (a.plazo_identificacion ?? "9").localeCompare(b.plazo_identificacion ?? "9"));
  }, [multas, filtro, q]);

  const kpi = {
    identificar: multas.filter((m) => ["recibida", "identificado"].includes(m.estado)).length,
    urgentes: multas.filter((m) => ["recibida", "identificado"].includes(m.estado) && (diasHasta(m.plazo_identificacion) ?? 99) <= 3).length,
    pago: multas.filter((m) => m.estado === "comunicada" && m.via === "paga_conductor").length,
    justificante: multas.filter((m) => m.estado === "pagada").length,
  };

  return (
    <div className="space-y-5">
      <Cabecera titulo="Multas" sub="Recepción, identificación del conductor, pago y justificante">
        <button className="btn btn-ghost" onClick={() => setVerContactos(true)}><Settings2 size={17} /> Contactos</button>
        <button className="btn btn-primary" onClick={() => setNueva(true)}><Plus size={18} /> Nueva multa</button>
      </Cabecera>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "Por identificar", n: kpi.identificar, c: "var(--accent)" },
          { l: "Plazo ≤ 3 días", n: kpi.urgentes, c: "var(--danger)" },
          { l: "Pendientes de pago", n: kpi.pago, c: "var(--warn)" },
          { l: "Justificante por enviar", n: kpi.justificante, c: "#8b5cf6" },
        ].map((k) => (
          <div key={k.l} className="card p-4">
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-none tabular-nums" style={{ color: k.n ? k.c : undefined }}>{k.n}</p>
            <p className="text-[13px] text-muted mt-1">{k.l}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Segmentos etiqueta="Estado" valor={filtro} onChange={setFiltro} opciones={[
          { id: "abiertas", label: "En curso" }, { id: "cerradas", label: "Cerradas" }, { id: "todas", label: "Todas" },
        ]} />
        <Buscador valor={q} onChange={setQ} placeholder="Expediente, matrícula, lugar o conductor" />
      </div>

      {visibles.length === 0 ? (
        <Vacio>{multas.length === 0 ? "Todavía no hay multas registradas. Pulsa «Nueva multa» cuando llegue la próxima." : "No hay multas con estos filtros."}</Vacio>
      ) : (
        <ul className="space-y-2.5">
          {visibles.map((m) => {
            const s = semaforo(m);
            const paso = PASOS.findIndex((p) => p.id === m.estado);
            return (
              <li key={m.id}>
                <button onClick={() => setSel(m)} className="card w-full text-left p-4 hover:shadow-lg transition-shadow grid gap-3 md:grid-cols-[110px_1fr_auto] items-center">
                  <div className="flex md:flex-col items-center md:items-start gap-2">
                    {s ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold"
                        style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}>
                        <span className="size-2.5 rounded-full" style={{ background: s.color }} /> {s.texto}
                      </span>
                    ) : m.estado === "anulada" ? <Insignia color="var(--muted)">Anulada</Insignia> : (
                      <span className="text-sm text-muted">{PASOS[paso]?.label}</span>
                    )}
                    <span className="font-mono text-sm font-bold border-2 border-text/80 rounded px-1.5">{m.vehiculo?.matricula ?? m.matricula ?? "—"}</span>
                    {m.vehiculo && (
                      <span className="flex items-center gap-1.5 text-xs">
                        {prodInfo(m.vehiculo.produccion_id ?? null) && (
                          <Insignia color={prodInfo(m.vehiculo.produccion_id ?? null)!.color}>{m.vehiculo.produccion_id}</Insignia>
                        )}
                        <span className="text-muted">{nombreSede(m.vehiculo.sede_id ?? null)}</span>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {m.organismo ?? "Multa"} {m.expediente && <span className="text-muted font-normal">· Expte. {m.expediente}</span>}
                    </p>
                    <p className="text-sm text-muted truncate">
                      {fechaHora(m.fecha_infraccion)} · {m.lugar ?? "lugar sin indicar"} · {euros(m.importe)}{m.puntos ? ` · ${m.puntos} pts` : ""}
                    </p>
                    <p className="text-sm mt-0.5">
                      {m.operador ? <><UserCheck size={14} className="inline -mt-0.5 text-ok" /> {nombreCompleto(m.operador)}</> : <span className="text-warn font-medium">Conductor sin identificar</span>}
                    </p>
                  </div>
                  <ol className="hidden md:flex items-center gap-1" aria-label="Progreso">
                    {PASOS.map((p, i) => (
                      <li key={p.id} title={p.label}
                        className="h-2 w-8 rounded-full"
                        style={{ background: m.estado === "anulada" ? "var(--border)" : i <= paso ? "var(--accent)" : "var(--border)" }} />
                    ))}
                  </ol>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {nueva && <NuevaMulta vehiculos={vehiculos} onClose={() => setNueva(false)} onGuardada={() => { setNueva(false); router.refresh(); }} />}
      {editar && <NuevaMulta multa={editar} vehiculos={vehiculos} onClose={() => setEditar(null)} onGuardada={() => { setEditar(null); router.refresh(); }} />}
      {sel && (
        <FichaMulta
          multa={sel} operadores={operadores} docs={docs.filter((d) => d.entidad_id === sel.id)} contactos={contactos}
          privados={privados} esAdmin={esAdmin} miNombre={miNombre}
          onClose={() => setSel(null)} onCambio={() => { setSel(null); router.refresh(); }}
          onEditar={() => { setEditar(sel); setSel(null); }}
        />
      )}
      {verContactos && <EditarContactos contactos={contactos} onClose={() => setVerContactos(false)} onGuardado={() => { setVerContactos(false); router.refresh(); }} />}
    </div>
  );
}

// ================================================================ subir documento
async function subirDocumento(multaId: string, archivo: File, tipo: "multa" | "justificante_pago" | "comunicacion") {
  const supabase = createClient();
  const limpio = archivo.name.normalize("NFD").replace(/[^\w.\-]+/g, "_");
  const ruta = `multas/${multaId}/${Date.now()}-${limpio}`;
  const { error: e1 } = await supabase.storage.from("documentos").upload(ruta, archivo, { contentType: archivo.type });
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("documentos").insert({
    storage_path: ruta, nombre_archivo: archivo.name, mime: archivo.type, tipo, entidad: "multa", entidad_id: multaId,
  });
  if (e2) throw e2;
}

// ================================================================ nueva multa
function NuevaMulta({ multa, vehiculos, onClose, onGuardada }: {
  multa?: Multa; vehiculos: VehMin[]; onClose: () => void; onGuardada: () => void;
}) {
  const fi = multa?.fecha_infraccion ? new Date(multa.fecha_infraccion) : null;
  const [f, setF] = useState(multa ? {
    matricula: multa.vehiculo?.matricula ?? multa.matricula ?? "",
    fecha: fi ? fi.toLocaleDateString("sv-SE") : "",
    hora: fi ? fi.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
    lugar: multa.lugar ?? "", organismo: multa.organismo ?? "", expediente: multa.expediente ?? "",
    importe: multa.importe != null ? String(multa.importe).replace(".", ",") : "", puntos: multa.puntos != null ? String(multa.puntos) : "",
    origen: multa.origen ?? "otro", notificacion: multa.fecha_notificacion ?? "", plazo: multa.plazo_identificacion ?? "", notas: multa.notas ?? "",
  } : {
    matricula: "", fecha: "", hora: "", lugar: "", organismo: "", expediente: "", importe: "", puntos: "",
    origen: "pyramid", notificacion: hoy(), plazo: masDias(hoy(), 20), notas: "",
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<"correo" | "pdf" | "manual">(multa ? "manual" : "correo");
  const [textoCorreo, setTextoCorreo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [leido, setLeido] = useState<{ ok: boolean; m: string } | null>(null);

  /** Envía el correo y/o el PDF al servidor y rellena el formulario con lo encontrado. */
  async function leer() {
    if (!textoCorreo.trim() && !archivo) return setLeido({ ok: false, m: modo === "pdf" ? "Elige el PDF de la multa." : "Pega el texto del correo." });
    setLeyendo(true);
    setLeido(null);
    const fd = new FormData();
    if (textoCorreo.trim()) fd.set("texto", textoCorreo);
    if (archivo) fd.set("archivo", archivo);
    try {
      const res = await fetch("/api/extraer-multa", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? res.statusText);
      const enFlota = (d.matriculas as string[] ?? []).find((m) => vehiculos.some((v) => v.matricula.replace(/\s/g, "").toUpperCase() === m));
      const notif = d.notificacion ?? f.notificacion;
      setF((prev) => ({
        ...prev,
        matricula: enFlota ?? d.matriculas?.[0] ?? prev.matricula,
        fecha: d.fecha ?? prev.fecha, hora: d.hora ?? prev.hora,
        lugar: d.lugar ?? prev.lugar, organismo: d.organismo ?? prev.organismo, expediente: d.expediente ?? prev.expediente,
        importe: d.importe ?? prev.importe, puntos: d.puntos ?? prev.puntos,
        origen: d.origen ?? prev.origen, notificacion: notif, plazo: notif ? masDias(notif, 20) : prev.plazo,
      }));
      const encontrados = ["matriculas", "expediente", "fecha", "lugar", "organismo", "importe", "puntos"]
        .filter((k) => (k === "matriculas" ? d.matriculas?.length : d[k])).length;
      setLeido({
        ok: encontrados > 0,
        m: d.aviso ?? (encontrados
          ? `${d.metodo === "ia" ? "Leído con IA" : "Leído automáticamente"}: ${encontrados} de 7 datos. Revisa y completa lo que falte.`
          : "No he encontrado datos reconocibles. Rellénalos a mano."),
      });
    } catch (e) {
      setLeido({ ok: false, m: `No se ha podido leer: ${(e as Error).message}` });
    }
    setLeyendo(false);
  }

  const veh = vehiculos.find((v) => v.matricula.replace(/\s/g, "").toUpperCase() === f.matricula.replace(/\s/g, "").toUpperCase());

  async function guardar() {
    setError(null);
    if (!f.matricula.trim()) return setError("Indica la matrícula.");
    if (!f.fecha) return setError("Indica la fecha de la infracción.");
    setGuardando(true);
    const supabase = createClient();
    const momento = new Date(`${f.fecha}T${f.hora || "12:00"}:00`).toISOString();
    const datos = {
      vehiculo_id: veh?.id ?? null,
      matricula: f.matricula.replace(/\s/g, "").toUpperCase(),
      fecha_infraccion: momento,
      lugar: f.lugar.trim() || null, organismo: f.organismo.trim() || null, expediente: f.expediente.trim() || null,
      importe: f.importe ? Number(f.importe.replace(",", ".")) : null, puntos: f.puntos ? Number(f.puntos) : null,
      origen: f.origen, fecha_notificacion: f.notificacion || null, plazo_identificacion: f.plazo || null,
      notas: [f.notas.trim(), modo === "correo" && textoCorreo.trim() ? `Correo original:\n${textoCorreo.trim().slice(0, 4000)}` : ""].filter(Boolean).join("\n\n") || null,
    };
    const { data, error } = multa
      ? await supabase.from("multas").update(datos).eq("id", multa.id).select("id").single()
      : await supabase.from("multas").insert(datos).select("id").single();
    if (error || !data) { setGuardando(false); return setError(`No se ha podido guardar: ${error?.message}`); }
    try {
      if (archivo) await subirDocumento(data.id, archivo, "multa");
    } catch (e) {
      setGuardando(false);
      return setError(`La multa se ha guardado, pero el PDF no se ha podido subir: ${(e as Error).message}`);
    }
    onGuardada();
  }

  return (
    <Modal titulo={multa ? "Editar multa" : "Nueva multa"} onClose={onClose} pie={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
    </>}>
      <Segmentos etiqueta="Cómo llega la multa" valor={modo} onChange={(v) => { setModo(v); setLeido(null); }} opciones={[
        { id: "correo", label: "Desde correo" }, { id: "pdf", label: "Desde PDF" }, { id: "manual", label: "A mano" },
      ]} />

      {modo === "correo" && (
        <div className="space-y-3">
          <Campo label="Texto del correo">
            <textarea className="input !h-36 py-2 text-sm" value={textoCorreo} onChange={(e) => setTextoCorreo(e.target.value)}
              placeholder="Abre el correo de Pyramid o de multas@ en Outlook, pulsa Ctrl+A y Ctrl+C, y pégalo aquí." />
          </Campo>
          <Campo label="PDF adjunto del correo (opcional)">
            <input type="file" accept="application/pdf,image/*" className="input py-2" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </Campo>
        </div>
      )}
      {modo === "pdf" && (
        <Campo label="Notificación (PDF o foto)">
          <input type="file" accept="application/pdf,image/*" className="input py-2" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </Campo>
      )}
      {modo !== "manual" && (
        <button type="button" className="btn btn-primary w-full" disabled={leyendo} onClick={leer}>
          <Sparkles size={17} /> {leyendo ? "Leyendo…" : "Leer datos"}
        </button>
      )}
      {leido && <Aviso tipo={leido.ok ? "ok" : "error"}>{leido.m}</Aviso>}
      {modo === "manual" && (
        <Campo label="Notificación (PDF o foto, opcional)">
          <input type="file" accept="application/pdf,image/*" className="input py-2" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </Campo>
      )}
      <hr className="border-border" />
      <Campo label="Matrícula">
        <input className="input font-mono uppercase" list="matriculas" value={f.matricula} onChange={(e) => setF({ ...f, matricula: e.target.value })} placeholder="1234ABC" />
        <datalist id="matriculas">{vehiculos.map((v) => <option key={v.id} value={v.matricula}>{v.codigo}</option>)}</datalist>
      </Campo>
      {f.matricula && (
        <p className="text-sm -mt-2" style={{ color: veh ? "var(--ok)" : "var(--warn)" }}>
          {veh ? `${veh.codigo} · ${veh.marca} ${veh.modelo}` : "Esta matrícula no está en la flota. Se guardará igualmente."}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha infracción"><input type="date" className="input" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
        <Campo label="Hora"><input type="time" className="input" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></Campo>
      </div>
      <Campo label="Lugar"><input className="input" value={f.lugar} onChange={(e) => setF({ ...f, lugar: e.target.value })} placeholder="M-30 km 12, Madrid" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Organismo"><input className="input" value={f.organismo} onChange={(e) => setF({ ...f, organismo: e.target.value })} placeholder="DGT, Ayto. Madrid…" /></Campo>
        <Campo label="Nº expediente"><input className="input" value={f.expediente} onChange={(e) => setF({ ...f, expediente: e.target.value })} /></Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Importe (€)"><input className="input" inputMode="decimal" value={f.importe} onChange={(e) => setF({ ...f, importe: e.target.value })} /></Campo>
        <Campo label="Puntos"><input className="input" inputMode="numeric" value={f.puntos} onChange={(e) => setF({ ...f, puntos: e.target.value })} /></Campo>
      </div>
      <Campo label="Recibida de">
        <select className="input" value={f.origen} onChange={(e) => setF({ ...f, origen: e.target.value })}>
          {Object.entries(ORIGENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha notificación">
          <input type="date" className="input" value={f.notificacion}
            onChange={(e) => setF({ ...f, notificacion: e.target.value, plazo: e.target.value ? masDias(e.target.value, 20) : f.plazo })} />
        </Campo>
        <Campo label="Plazo identificar">
          <input type="date" className="input" value={f.plazo} onChange={(e) => setF({ ...f, plazo: e.target.value })} />
        </Campo>
      </div>
      <p className="text-xs text-muted -mt-2">El plazo se calcula a 20 días naturales desde la notificación. Ajústalo si Pyramid te indica otra fecha.</p>
      <Campo label="Notas"><textarea className="input !h-20 py-2" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Campo>
      {error && <Aviso tipo="error">{error}</Aviso>}
    </Modal>
  );
}

// ================================================================ ficha de multa
function FichaMulta({
  multa: m, operadores, docs, contactos, privados, esAdmin, miNombre, onClose, onCambio, onEditar,
}: {
  multa: Multa; operadores: OpMin[]; docs: Doc[]; contactos: Contactos; privados: Privado[];
  esAdmin: boolean; miNombre: string; onClose: () => void; onCambio: () => void; onEditar: () => void;
}) {
  const [sugerido, setSugerido] = useState<{ operador_id: string; origen: string } | null>(null);
  const [conductor, setConductor] = useState(m.operador_id ?? "");
  const [pago, setPago] = useState({ fecha: hoy(), archivo: null as File | null });
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; m: string } | null>(null);
  const [medio, setMedio] = useState<Medio>("correo");
  const [volverA, setVolverA] = useState("");
  const supabase = createClient();

  // ¿Quién conducía? (salida con ese coche o adjudicación vigente)
  useEffect(() => {
    if (m.operador_id || !m.vehiculo_id || !m.fecha_infraccion) return;
    createClient().rpc("conductor_probable", { p_vehiculo: m.vehiculo_id, p_momento: m.fecha_infraccion })
      .then(({ data }) => {
        const r = (data as { operador_id: string; origen: string }[] | null)?.[0];
        if (r?.operador_id) { setSugerido(r); setConductor(r.operador_id); }
      });
  }, [m.operador_id, m.vehiculo_id, m.fecha_infraccion]);

  const op = operadores.find((o) => o.id === (m.operador_id ?? conductor));
  const priv = privados.find((p) => p.operador_id === op?.id);
  const problemas = esAdmin && op ? problemasPrivados(priv) : [];
  const matricula = m.vehiculo?.matricula ?? m.matricula ?? "";
  const ref = `Expte. ${m.expediente ?? "s/n"} · ${matricula}`;
  const descMulta = `la multa con expediente ${m.expediente ?? "(sin número)"} del vehículo ${matricula}${m.vehiculo ? ` (${m.vehiculo.marca} ${m.vehiculo.modelo})` : ""}, de fecha ${fechaHora(m.fecha_infraccion)}${m.lugar ? ` en ${m.lugar}` : ""}`;

  async function actualizar(cambios: Partial<Multa>, ok: string) {
    setOcupado(true);
    setAviso(null);
    const { error } = await supabase.from("multas").update(cambios).eq("id", m.id);
    setOcupado(false);
    if (error) return setAviso({ ok: false, m: error.message });
    setAviso({ ok: true, m: ok });
    onCambio();
  }

  async function verDoc(d: Doc) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(d.storage_path, 120);
    if (error || !data) return setAviso({ ok: false, m: "No se ha podido abrir el documento." });
    window.open(data.signedUrl, "_blank", "noopener");
  }

  function textoIdentificacion() {
    return [
      "Hola,", "",
      `En relación con ${descMulta}, os indico los datos del conductor:`, "",
      `Nombre: ${nombreCompleto(op ?? null)}`,
      `DNI: ${priv?.dni ?? "[completar]"}`,
      `Dirección: ${priv?.direccion ?? "[completar]"}`, "",
      "Adjunto la notificación.", "",
      ...DESPEDIDA,
    ].join("\n");
  }
  function textoConductor() {
    return [
      `Hola ${op?.nombre ?? ""},`, "",
      `Te reenvío ${descMulta}.`,
      `Importe: ${euros(m.importe)}${m.puntos ? ` · ${m.puntos} puntos` : ""}.`, "",
      "Recuerda que, si se paga dentro del plazo de pronto pago indicado en la notificación, suele tener un 50 % de descuento.",
      "Cuando la pagues, envíame por favor el justificante de pago.", "",
      ...DESPEDIDA,
    ].join("\n");
  }

  /** Comunica la multa por el medio elegido y la marca como comunicada. */
  async function comunicar(via: "identificacion" | "paga_conductor") {
    if (!op) return;
    const cambios: Partial<Multa> = {
      estado: "comunicada", via, fecha_comunicada: hoy(), medio_comunicacion: medio, nota_comunicacion: null,
    };
    if (medio === "correo") {
      if (via === "identificacion") abrirCorreo(contactos.para, contactos.cc, `Identificación de conductor · ${ref}`, textoIdentificacion());
      else abrirCorreo(op.email ? [op.email] : [], [], `Multa ${ref}`, textoConductor());
    }
    if (medio === "pdf") {
      setOcupado(true);
      try {
        const blob = await generarPdfMulta({
          tipo: via === "identificacion" ? "identificacion" : "conductor",
          expediente: m.expediente, organismo: m.organismo, matricula,
          vehiculo: m.vehiculo ? `${m.vehiculo.marca ?? ""} ${m.vehiculo.modelo ?? ""} (${m.vehiculo.codigo ?? ""})`.trim() : null,
          fechaInfraccion: fechaHora(m.fecha_infraccion), lugar: m.lugar, importe: euros(m.importe), puntos: m.puntos,
          conductor: { nombre: nombreCompleto(op), dni: priv?.dni, direccion: priv?.direccion },
          firmante: miNombre,
          destinatarios: via === "identificacion" ? "Pyramid Consulting · Multas Mediapro" : undefined,
        });
        const nombre = `${via === "identificacion" ? "Identificacion" : "Comunicacion_conductor"}_${(m.expediente ?? "multa").replace(/[^\w-]+/g, "_")}_${matricula}.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = nombre; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        await subirDocumento(m.id, new File([blob], nombre, { type: "application/pdf" }), "comunicacion");
      } catch (e) {
        setOcupado(false);
        return setAviso({ ok: false, m: `No se ha podido generar el PDF: ${(e as Error).message}` });
      }
    }
    actualizar(cambios, via === "identificacion"
      ? `Conductor comunicado a Pyramid y Multas ${MEDIOS[medio]}.`
      : `Multa comunicada al conductor ${MEDIOS[medio]}.`);
  }

  function correoJustificante() {
    const cuerpo = [
      "Hola,", "",
      `Adjunto el justificante de pago de ${descMulta}${op ? `, abonada por ${nombreCompleto(op)}` : ""}${m.fecha_pago ? ` el ${fecha(m.fecha_pago)}` : ""}.`, "",
      ...DESPEDIDA,
    ].join("\n");
    abrirCorreo(contactos.para, contactos.cc, `Justificante de pago · ${ref}`, cuerpo);
    actualizar({ estado: "cerrada", fecha_cierre: hoy() }, "Multa cerrada.");
  }

  async function registrarPago() {
    setOcupado(true);
    setAviso(null);
    try {
      if (pago.archivo) await subirDocumento(m.id, pago.archivo, "justificante_pago");
    } catch (e) {
      setOcupado(false);
      return setAviso({ ok: false, m: `No se ha podido subir el justificante: ${(e as Error).message}` });
    }
    await actualizar({ estado: "pagada", fecha_pago: pago.fecha }, "Pago registrado.");
  }

  /** Pasos a los que se puede volver (anteriores al actual). */
  const pasosPrevios = (() => {
    const actual = m.estado === "anulada" ? PASOS.length : PASOS.findIndex((p) => p.id === m.estado);
    return PASOS.slice(0, actual);
  })();

  /** Vuelve la multa al paso elegido y borra los datos de los pasos posteriores. */
  function volver(destino: Multa["estado"]) {
    const orden = PASOS.findIndex((p) => p.id === destino);
    const cambios: Partial<Multa> = { estado: destino, fecha_cierre: null };
    if (orden < 3) Object.assign(cambios, { fecha_pago: null });
    if (orden < 2) Object.assign(cambios, { via: null, fecha_comunicada: null, medio_comunicacion: null, nota_comunicacion: null });
    if (orden < 1) Object.assign(cambios, { operador_id: null, conductor_origen: null, fecha_identificado: null });
    setVolverA("");
    actualizar(cambios, `Multa devuelta a «${PASOS[orden].label}».`);
  }

  /** Borra la multa, sus documentos y los archivos guardados (solo administrador). */
  async function eliminar() {
    setOcupado(true);
    setAviso(null);
    if (docs.length) await supabase.storage.from("documentos").remove(docs.map((d) => d.storage_path));
    await supabase.from("documentos").delete().eq("entidad", "multa").eq("entidad_id", m.id);
    const { error } = await supabase.from("multas").delete().eq("id", m.id);
    setOcupado(false);
    if (error) return setAviso({ ok: false, m: `No se ha podido eliminar: ${error.message}` });
    onCambio();
  }

  const paso = PASOS.findIndex((p) => p.id === m.estado);

  return (
    <Modal titulo={ref} onClose={onClose}>
      {/* progreso */}
      <ol className="flex gap-1" aria-label="Progreso">
        {PASOS.map((p, i) => (
          <li key={p.id} className="flex-1">
            <div className="h-1.5 rounded-full" style={{ background: m.estado !== "anulada" && i <= paso ? "var(--accent)" : "var(--border)" }} />
            <p className={`mt-1 text-[11px] font-semibold ${i === paso ? "text-text" : "text-muted"}`}>{p.label}</p>
          </li>
        ))}
      </ol>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm card p-4 bg-surface-2">
        <dt className="text-muted">Vehículo</dt><dd className="font-semibold">{m.vehiculo ? `${m.vehiculo.codigo} · ${matricula}` : matricula}</dd>
        <dt className="text-muted">Delegación</dt>
        <dd className="font-semibold flex items-center gap-1.5">
          {m.vehiculo ? (
            <>
              {prodInfo(m.vehiculo.produccion_id ?? null) && (
                <Insignia color={prodInfo(m.vehiculo.produccion_id ?? null)!.color}>{prodInfo(m.vehiculo.produccion_id ?? null)!.nombre}</Insignia>
              )}
              {nombreSede(m.vehiculo.sede_id ?? null)}
            </>
          ) : "Vehículo fuera de la flota"}
        </dd>
        <dt className="text-muted">Infracción</dt><dd className="font-semibold">{fechaHora(m.fecha_infraccion)}</dd>
        <dt className="text-muted">Lugar</dt><dd className="font-semibold">{m.lugar ?? "—"}</dd>
        <dt className="text-muted">Organismo</dt><dd className="font-semibold">{m.organismo ?? "—"}</dd>
        <dt className="text-muted">Importe</dt><dd className="font-semibold">{euros(m.importe)}{m.puntos ? ` · ${m.puntos} pts` : ""}</dd>
        <dt className="text-muted">Recibida de</dt><dd className="font-semibold">{ORIGENES[m.origen ?? "otro"]}</dd>
        <dt className="text-muted">Notificación</dt><dd className="font-semibold">{fecha(m.fecha_notificacion)}</dd>
        <dt className="text-muted">Plazo identificar</dt><dd className="font-semibold">{fecha(m.plazo_identificacion)}</dd>
      </dl>
      {m.notas && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">Notas{m.notas.includes("Correo original:") ? " y correo original" : ""}</summary>
          <p className="mt-2 whitespace-pre-wrap">{m.notas}</p>
        </details>
      )}

      {/* documentos */}
      <div className="flex flex-wrap gap-2">
        {docs.map((d) => (
          <button key={d.id} className="btn btn-ghost !min-h-9 text-sm" onClick={() => verDoc(d)}>
            <FileText size={15} /> {d.tipo === "justificante_pago" ? "Justificante" : d.tipo === "comunicacion" ? "Comunicación (PDF)" : "Notificación"}
          </button>
        ))}
        {docs.length === 0 && <p className="text-sm text-muted">Sin documentos adjuntos.</p>}
      </div>

      {/* paso 1: conductor */}
      {(m.estado === "recibida" || m.estado === "identificado") && (
        <fieldset className="card p-4 space-y-3">
          <legend className="px-1 text-sm font-semibold flex items-center gap-1.5"><UserCheck size={15} /> ¿Quién conducía?</legend>
          {sugerido && !m.operador_id && (
            <p className="text-sm rounded-lg px-3 py-2 bg-surface-2">
              Propuesta: <b>{nombreCompleto(operadores.find((o) => o.id === sugerido.operador_id) ?? null)}</b>
              {" "}({sugerido.origen === "salida" ? "llevaba el coche en una salida a esa hora" : "tenía el coche adjudicado ese día"})
            </p>
          )}
          {!sugerido && !m.operador_id && (
            <p className="text-sm text-warn">No hay salida ni adjudicación de este coche en esa fecha: elige el conductor.</p>
          )}
          <select className="input" value={conductor} onChange={(e) => setConductor(e.target.value)} aria-label="Conductor">
            <option value="">Elegir operador…</option>
            {PRODUCCIONES.map((p) => (
              <optgroup key={p.id} label={p.nombre}>
                {operadores.filter((o) => o.produccion_id === p.id).map((o) => <option key={o.id} value={o.id}>{nombreCompleto(o)}</option>)}
              </optgroup>
            ))}
          </select>
          {conductor !== (m.operador_id ?? "") && (
            <button className="btn btn-primary w-full" disabled={!conductor || ocupado}
              onClick={() => actualizar({
                operador_id: conductor, estado: "identificado", fecha_identificado: hoy(),
                conductor_origen: sugerido?.operador_id === conductor ? (sugerido.origen as Multa["conductor_origen"]) : "manual",
              }, "Conductor identificado.")}>
              Confirmar conductor
            </button>
          )}
        </fieldset>
      )}

      {/* datos privados (solo admin) */}
      {esAdmin && op && ["identificado", "comunicada"].includes(m.estado) && (
        <div className="card p-4 space-y-2 text-sm">
          <p className="font-semibold flex items-center gap-1.5"><ShieldCheck size={15} className="text-accent" /> Datos para la identificación</p>
          <p>{nombreCompleto(op)}<br />DNI: <b>{priv?.dni ?? "—"}</b>{priv?.dni_caducidad && ` (caduca ${fecha(priv.dni_caducidad)})`}<br />{priv?.direccion ?? "Sin dirección"}</p>
          {problemas.length > 0 && (
            <div className="rounded-lg px-3 py-2 text-warn" style={{ background: "color-mix(in srgb, var(--warn) 12%, transparent)" }}>
              <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={15} /> Revisa antes de enviar</p>
              <ul className="list-disc ml-5">{problemas.map((p) => <li key={p}>{p}</li>)}</ul>
              <p className="mt-1 text-xs">Puedes corregirlos en Operadores → ficha del operador.</p>
            </div>
          )}
        </div>
      )}

      {/* paso 2: comunicar */}
      {m.estado === "identificado" && op && (
        <fieldset className="card p-4 space-y-3">
          <legend className="px-1 text-sm font-semibold flex items-center gap-1.5"><Mail size={15} /> Comunicar</legend>
          <Segmentos etiqueta="Medio" valor={medio} onChange={setMedio} opciones={[
            { id: "correo", label: "Correo" }, { id: "pdf", label: "PDF" },
          ]} />
          {medio === "correo" && <p className="text-xs text-muted">Se abre el correo en Outlook con el texto preparado. Adjunta la notificación (botón de arriba).</p>}
          {medio === "pdf" && <p className="text-xs text-muted">Se descarga un PDF con los datos de la multa y del conductor, listo para enviar o imprimir. Queda guardado en la ficha.</p>}
          <button className="btn btn-primary w-full" disabled={ocupado} onClick={() => comunicar("identificacion")}>
            {medio === "correo" ? <Mail size={17} /> : <FileDown size={17} />}
            Identificar a Pyramid + Multas
          </button>
          <button className="btn btn-ghost w-full" disabled={ocupado} onClick={() => comunicar("paga_conductor")}>
            <Wallet size={17} /> Lo paga el conductor (avisarle)
          </button>
          {!esAdmin && <p className="text-xs text-muted">Solo el administrador ve el DNI y la dirección; en el correo o el PDF quedarán para completar.</p>}
        </fieldset>
      )}

      {/* paso 3: pago */}
      {m.estado === "comunicada" && (
        <fieldset className="card p-4 space-y-3">
          <legend className="px-1 text-sm font-semibold flex items-center gap-1.5"><Wallet size={15} /> Pago</legend>
          <p className="text-sm text-muted">
            {m.via === "identificacion"
              ? `Conductor comunicado a Pyramid y Multas el ${fecha(m.fecha_comunicada)}`
              : `Avisado ${nombreCompleto(op ?? null)} el ${fecha(m.fecha_comunicada)}`}
            {m.medio_comunicacion ? ` ${MEDIOS[m.medio_comunicacion]}` : ""}.
            {m.nota_comunicacion && <><br />{m.nota_comunicacion}</>}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Fecha de pago"><input type="date" className="input" value={pago.fecha} onChange={(e) => setPago({ ...pago, fecha: e.target.value })} /></Campo>
            <Campo label="Justificante"><input type="file" accept="application/pdf,image/*" className="input py-2" onChange={(e) => setPago({ ...pago, archivo: e.target.files?.[0] ?? null })} /></Campo>
          </div>
          <button className="btn btn-primary w-full" disabled={ocupado} onClick={registrarPago}>Registrar pago</button>
          {m.via === "identificacion" && (
            <button className="btn btn-ghost w-full" disabled={ocupado}
              onClick={() => actualizar({ estado: "cerrada", fecha_cierre: hoy() }, "Multa cerrada.")}>
              <CheckCircle2 size={17} /> Cerrar (tramitada por Pyramid, sin pago nuestro)
            </button>
          )}
        </fieldset>
      )}

      {/* paso 4: justificante */}
      {m.estado === "pagada" && (
        <div className="space-y-2">
          <button className="btn btn-primary w-full" disabled={ocupado} onClick={correoJustificante}>
            <Mail size={17} /> Enviar justificante a Pyramid + Multas y cerrar
          </button>
          <p className="text-xs text-muted">Recuerda adjuntar el justificante (botón «Justificante» de arriba).</p>
        </div>
      )}

      {m.estado === "cerrada" && <Aviso tipo="ok">Cerrada el {fecha(m.fecha_cierre)}.</Aviso>}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <button className="btn btn-ghost !min-h-9 text-sm" disabled={ocupado} onClick={onEditar}>
          <Pencil size={15} /> Editar datos
        </button>
        {pasosPrevios.length > 0 && (
          <label className="flex items-center gap-1.5 text-sm">
            <Undo2 size={15} className="text-muted" />
            <select className="input !min-h-9 !w-auto !text-sm" value={volverA} disabled={ocupado} aria-label="Volver a un paso anterior"
              onChange={(e) => {
                const d = e.target.value as Multa["estado"];
                setVolverA(d);
                if (d && confirm(`¿Volver la multa a «${PASOS.find((p) => p.id === d)?.label}»? Se borrarán los datos de los pasos posteriores.`)) volver(d);
                else setVolverA("");
              }}>
              <option value="">Volver a…</option>
              {pasosPrevios.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
        )}
        {!["cerrada", "anulada"].includes(m.estado) && (
          <button className="btn btn-ghost !min-h-9 text-sm" disabled={ocupado}
            onClick={() => { if (confirm("¿Anular esta multa? (recurrida, duplicada, no corresponde…). Se conserva en el historial.")) actualizar({ estado: "anulada", fecha_cierre: hoy() }, "Multa anulada."); }}>
            <Ban size={15} /> Anular
          </button>
        )}
        {esAdmin && (
          <button className="btn btn-ghost !min-h-9 text-sm ml-auto" style={{ color: "var(--danger)" }} disabled={ocupado}
            onClick={() => { if (confirm("¿Eliminar definitivamente esta multa y sus documentos? No se puede deshacer. Si solo no procede, mejor «Anular».")) eliminar(); }}>
            <Trash2 size={15} /> Eliminar
          </button>
        )}
      </div>

      {aviso && <Aviso tipo={aviso.ok ? "ok" : "error"}>{aviso.m}</Aviso>}
    </Modal>
  );
}

// ================================================================ contactos
function EditarContactos({ contactos, onClose, onGuardado }: { contactos: Contactos; onClose: () => void; onGuardado: () => void }) {
  const [para, setPara] = useState(contactos.para.join("\n"));
  const [cc, setCc] = useState(contactos.cc.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const lista = (s: string) => s.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);

  async function guardar() {
    const { error } = await createClient().from("ajustes").upsert({ clave: "multas_contactos", valor: { para: lista(para), cc: lista(cc) } });
    if (error) return setError(error.message);
    onGuardado();
  }
  return (
    <Modal titulo="Contactos de multas" onClose={onClose} pie={<>
      <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={guardar}>Guardar</button>
    </>}>
      <p className="text-sm text-muted">Destinatarios de los correos de identificación y de justificante. Uno por línea.</p>
      <Campo label="Para"><textarea className="input !h-24 py-2 font-mono text-sm" value={para} onChange={(e) => setPara(e.target.value)} /></Campo>
      <Campo label="CC"><textarea className="input !h-24 py-2 font-mono text-sm" value={cc} onChange={(e) => setCc(e.target.value)} /></Campo>
      {error && <Aviso tipo="error">{error}</Aviso>}
    </Modal>
  );
}
