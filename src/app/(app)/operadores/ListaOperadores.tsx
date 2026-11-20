"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Plus, Pencil, UserX, UserCheck, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Aviso } from "@/components/PantallaAcceso";
import {
  Buscador, Cabecera, Campo, Insignia, Modal, PRODUCCIONES, SEDES, Segmentos, Vacio, nombreSede, prodInfo,
} from "@/components/ui";

export type Operador = {
  id: string;
  nombre: string;
  apellidos: string | null;
  alias: string | null;
  telefono: string | null;
  telefono_personal: string | null;
  contrato: string | null;
  email: string | null;
  sede_id: string | null;
  produccion_id: string | null;
  activo: boolean;
  notas: string | null;
};

type Edicion = Omit<Operador, "id"> & { id?: string };
const NUEVO: Edicion = {
  nombre: "", apellidos: "", alias: "", telefono: "", telefono_personal: "", contrato: null, email: "", sede_id: "MAD", produccion_id: "L6", activo: true, notas: "",
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const iniciales = (o: Operador) =>
  ((o.nombre?.[0] ?? "") + (o.apellidos?.[0] ?? "")).toUpperCase();

type Privado = { dni: string; dni_caducidad: string; direccion: string; comprobado_el: string; a_revisar: boolean; notas: string };
const PRIV_VACIO: Privado = { dni: "", dni_caducidad: "", direccion: "", comprobado_el: "", a_revisar: false, notas: "" };

export function ListaOperadores({ operadores, esAdmin }: { operadores: Operador[]; esAdmin: boolean }) {
  const router = useRouter();
  const [prod, setProd] = useState<"todos" | "A3" | "L6">("todos");
  const [verBajas, setVerBajas] = useState(false);
  const [soloFdi, setSoloFdi] = useState(false);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priv, setPriv] = useState<Privado | null>(null);
  const [privOriginal, setPrivOriginal] = useState<string>("");

  // Datos privados: solo el administrador (la base de datos no los devuelve a otros usuarios)
  useEffect(() => {
    setPriv(null);
    if (!esAdmin || !edit?.id) return;
    createClient().from("operador_datos_privados")
      .select("dni, dni_caducidad, direccion, comprobado_el, a_revisar, notas").eq("operador_id", edit.id).maybeSingle()
      .then(({ data }) => {
        const p = { ...PRIV_VACIO, ...Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, v ?? (k === "a_revisar" ? false : "")])) } as Privado;
        setPriv(p);
        setPrivOriginal(JSON.stringify(p));
      });
  }, [esAdmin, edit?.id]);

  const visibles = useMemo(() => {
    const t = sinAcentos(q.trim());
    return operadores.filter((o) =>
      (verBajas ? !o.activo : o.activo) &&
      (!soloFdi || o.contrato === "FDI") &&
      (prod === "todos" || o.produccion_id === prod) &&
      (!t || sinAcentos(`${o.nombre} ${o.apellidos ?? ""} ${o.alias ?? ""} ${o.telefono ?? ""} ${o.telefono_personal ?? ""}`).includes(t)),
    );
  }, [operadores, prod, q, verBajas, soloFdi]);

  const activos = operadores.filter((o) => o.activo);
  const n = (p: string) => activos.filter((o) => o.produccion_id === p).length;

  async function guardar() {
    if (!edit) return;
    if (!edit.nombre.trim()) return setError("El nombre es obligatorio.");
    setGuardando(true);
    setError(null);
    const supabase = createClient();
    const datos = {
      nombre: edit.nombre.trim(),
      apellidos: edit.apellidos?.trim() || null,
      alias: edit.alias?.trim() || null,
      telefono: edit.telefono?.trim() || null,
      telefono_personal: edit.telefono_personal?.trim() || null,
      contrato: edit.contrato || null,
      email: edit.email?.trim() || null,
      sede_id: edit.sede_id,
      produccion_id: edit.produccion_id,
      activo: edit.activo,
      notas: edit.notas?.trim() || null,
      fecha_baja: edit.activo ? null : new Date().toISOString().slice(0, 10),
    };
    const { error } = edit.id
      ? await supabase.from("operadores").update(datos).eq("id", edit.id)
      : await supabase.from("operadores").insert(datos);
    if (!error && esAdmin && edit.id && priv && JSON.stringify(priv) !== privOriginal) {
      const { error: e2 } = await supabase.from("operador_datos_privados").upsert({
        operador_id: edit.id,
        dni: priv.dni.trim() || null,
        dni_caducidad: priv.dni_caducidad || null,
        direccion: priv.direccion.trim() || null,
        comprobado_el: priv.comprobado_el || null,
        a_revisar: priv.a_revisar,
        notas: priv.notas.trim() || null,
      });
      if (e2) { setGuardando(false); return setError(`Datos generales guardados, pero no los privados: ${e2.message}`); }
    }
    setGuardando(false);
    if (error) return setError(`No se ha podido guardar: ${error.message}`);
    setEdit(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Cabecera titulo="Operadores" sub={`${activos.length} operadores de cámara en activo`}>
        <button className="btn btn-primary" onClick={() => { setError(null); setEdit({ ...NUEVO }); }}>
          <Plus size={18} /> Nuevo operador
        </button>
      </Cabecera>

      <div className="flex flex-wrap gap-3 items-center">
        <Segmentos
          etiqueta="Producción"
          valor={prod}
          onChange={setProd}
          opciones={[
            { id: "todos", label: "Todos", n: activos.length },
            ...PRODUCCIONES.map((p) => ({ id: p.id as "A3" | "L6", label: p.nombre, color: p.color, n: n(p.id) })),
          ]}
        />
        <Buscador valor={q} onChange={setQ} placeholder="Buscar por nombre, alias o teléfono" />
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
          <input type="checkbox" className="size-4" checked={soloFdi} onChange={(e) => setSoloFdi(e.target.checked)} />
          Solo FDI ({activos.filter((o) => o.contrato === "FDI").length})
        </label>
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
          <input type="checkbox" className="size-4" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
          Ver bajas
        </label>
      </div>

      {visibles.length === 0 ? (
        <Vacio>No hay operadores que coincidan.</Vacio>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((o) => {
            const p = prodInfo(o.produccion_id);
            return (
              <li key={o.id} className="card p-3.5 flex items-center gap-3">
                <span className="grid place-items-center size-11 rounded-full shrink-0 text-white font-bold"
                  style={{ background: p?.color ?? "var(--muted)" }} aria-hidden>
                  {iniciales(o)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight truncate">
                    {o.nombre} {o.apellidos}
                    {o.alias && <span className="text-muted font-normal"> · {o.alias}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {p && <Insignia color={p.color}>{p.id}</Insignia>}
                    {o.contrato === "FDI" && <Insignia color="#d97706">FDI</Insignia>}
                    <span className="text-muted">{nombreSede(o.sede_id)}</span>
                    {o.telefono || o.telefono_personal ? (
                      <a href={`tel:${(o.telefono ?? o.telefono_personal ?? "").split("/")[0].replace(/\s/g, "")}`}
                        className="inline-flex items-center gap-1 text-accent font-medium hover:underline">
                        <Phone size={13} /> {o.telefono ?? o.telefono_personal}
                        {!o.telefono && <span className="text-[11px] font-normal text-muted">(personal)</span>}
                      </a>
                    ) : (
                      <span className="text-muted text-xs">Sin teléfono</span>
                    )}
                  </div>
                </div>
                <button className="btn btn-ghost !min-h-9 !px-2.5 shrink-0" aria-label={`Editar ${o.nombre}`}
                  onClick={() => { setError(null); setEdit({ ...o }); }}>
                  <Pencil size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {edit && (
        <Modal
          titulo={edit.id ? "Editar operador" : "Nuevo operador"}
          onClose={() => setEdit(null)}
          pie={
            <>
              <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nombre">
              <input className="input" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
            </Campo>
            <Campo label="Alias">
              <input className="input" value={edit.alias ?? ""} onChange={(e) => setEdit({ ...edit, alias: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Apellidos">
            <input className="input" value={edit.apellidos ?? ""} onChange={(e) => setEdit({ ...edit, apellidos: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Teléfono de empresa">
              <input className="input" inputMode="tel" placeholder="600 000 000 / 1234" value={edit.telefono ?? ""}
                onChange={(e) => setEdit({ ...edit, telefono: e.target.value })} />
            </Campo>
            <Campo label="Teléfono personal">
              <input className="input" inputMode="tel" placeholder="Si no tiene de empresa" value={edit.telefono_personal ?? ""}
                onChange={(e) => setEdit({ ...edit, telefono_personal: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Contrato">
            <select className="input" value={edit.contrato ?? ""} onChange={(e) => setEdit({ ...edit, contrato: e.target.value || null })}>
              <option value="">Plantilla / otro</option>
              <option value="FDI">FDI</option>
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Producción">
              <select className="input" value={edit.produccion_id ?? ""} onChange={(e) => setEdit({ ...edit, produccion_id: e.target.value || null })}>
                {PRODUCCIONES.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Sede">
              <select className="input" value={edit.sede_id ?? ""} onChange={(e) => setEdit({ ...edit, sede_id: e.target.value || null })}>
                {SEDES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
          </div>
          {esAdmin && edit.id && priv && (
            <fieldset className="card p-4 space-y-3" style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--border))" }}>
              <legend className="px-1 text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-accent" /> Datos privados · solo administrador
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="DNI / NIE">
                  <input className="input uppercase" value={priv.dni} onChange={(e) => setPriv({ ...priv, dni: e.target.value })} />
                </Campo>
                <Campo label="Caducidad DNI">
                  <input type="date" className="input" value={priv.dni_caducidad} onChange={(e) => setPriv({ ...priv, dni_caducidad: e.target.value })} />
                </Campo>
              </div>
              <Campo label="Dirección">
                <textarea className="input !h-20 py-2" value={priv.direccion} onChange={(e) => setPriv({ ...priv, direccion: e.target.value })} />
              </Campo>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Comprobada: {priv.comprobado_el ? new Date(priv.comprobado_el + "T12:00:00").toLocaleDateString("es-ES") : "nunca"}</span>
                <button type="button" className="btn btn-ghost !min-h-8 !text-xs"
                  onClick={() => setPriv({ ...priv, comprobado_el: new Date().toISOString().slice(0, 10), a_revisar: false })}>
                  Marcar comprobada hoy
                </button>
                <label className="flex items-center gap-1.5 ml-auto">
                  <input type="checkbox" className="size-4" checked={priv.a_revisar} onChange={(e) => setPriv({ ...priv, a_revisar: e.target.checked })} />
                  A revisar
                </label>
              </div>
              {priv.notas && <p className="text-xs text-warn">{priv.notas}</p>}
            </fieldset>
          )}
          <Campo label="Notas">
            <textarea className="input !h-24 py-2" value={edit.notas ?? ""} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} />
          </Campo>
          {edit.id && (
            <button type="button" className="btn btn-ghost w-full"
              style={{ color: edit.activo ? "var(--danger)" : "var(--ok)" }}
              onClick={() => setEdit({ ...edit, activo: !edit.activo })}>
              {edit.activo ? <><UserX size={17} /> Marcar como baja</> : <><UserCheck size={17} /> Reactivar</>}
            </button>
          )}
          {edit.id && !edit.activo && (
            <p className="text-sm text-muted">Al guardar, pasará a la lista de bajas. Su historial se conserva.</p>
          )}
          {error && <Aviso tipo="error">{error}</Aviso>}
        </Modal>
      )}
    </div>
  );
}
