"use client";

import { useState, useTransition } from "react";
import { Mail, UserPlus, KeyRound, Power, ShieldCheck, Copy } from "lucide-react";
import { Aviso } from "@/components/PantallaAcceso";
import {
  cambiarActivo, cambiarRol, enviarRecuperacion, fijarPasswordTemporal, invitarUsuario, type Resultado,
} from "./actions";

export type Fila = {
  id: string;
  email: string;
  nombre: string | null;
  rol: "admin" | "usuario";
  activo: boolean;
  ultimoAcceso: string | null;
  pendiente: boolean;
  invitadoEl: string | null;
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—";

function generarPassword() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => c[n % c.length]).join("");
}

export function TablaUsuarios({ filas, miId }: { filas: Fila[]; miId: string }) {
  const [pendiente, start] = useTransition();
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [temporal, setTemporal] = useState<{ id: string; pass: string } | null>(null);

  function ejecutar(fn: () => Promise<Resultado>, despues?: () => void) {
    start(async () => {
      const r = await fn();
      setAviso(r);
      if (r.ok) despues?.();
    });
  }

  return (
    <div className="space-y-5">
      <form
        className="card p-4 sm:p-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end"
        onSubmit={(e) => {
          e.preventDefault();
          ejecutar(() => invitarUsuario(email, nombre), () => { setEmail(""); setNombre(""); });
        }}
      >
        <div>
          <label className="label" htmlFor="inv-email">Correo</label>
          <input id="inv-email" type="email" required className="input" placeholder="nombre@mediapro.tv"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="inv-nombre">Nombre</label>
          <input id="inv-nombre" className="input" placeholder="Nombre y apellido"
            value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={pendiente}>
          <UserPlus size={18} /> Invitar
        </button>
      </form>

      {aviso && <Aviso tipo={aviso.ok ? "ok" : "error"}>{aviso.mensaje}</Aviso>}

      {temporal && (
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm">Contraseña temporal:</span>
          <code className="px-2 py-1 rounded bg-surface-2 font-mono text-base">{temporal.pass}</code>
          <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(temporal.pass)}>
            <Copy size={16} /> Copiar
          </button>
          <button className="btn btn-primary" disabled={pendiente}
            onClick={() => ejecutar(() => fijarPasswordTemporal(temporal.id, temporal.pass), () => setTemporal(null))}>
            Confirmar y fijar
          </button>
          <button className="btn btn-ghost" onClick={() => setTemporal(null)}>Cancelar</button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold">ID</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Último acceso</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{f.nombre || "—"}{f.id === miId && <span className="text-muted font-normal"> (tú)</span>}</p>
                  <p className="text-muted">{f.email}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted" title={f.id}>{f.id.slice(0, 8)}…</td>
                <td className="px-4 py-3">
                  <select
                    className="input !min-h-9 !w-auto !text-sm"
                    value={f.rol}
                    disabled={pendiente || f.id === miId}
                    onChange={(e) => ejecutar(() => cambiarRol(f.id, e.target.value as Fila["rol"]))}
                    aria-label={`Rol de ${f.email}`}
                  >
                    <option value="usuario">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {!f.activo ? (
                    <Estado color="var(--danger)">Desactivado</Estado>
                  ) : f.pendiente ? (
                    <Estado color="var(--warn)">Invitación pendiente</Estado>
                  ) : (
                    <Estado color="var(--ok)">Activo</Estado>
                  )}
                </td>
                <td className="px-4 py-3 text-muted whitespace-nowrap">{fecha(f.ultimoAcceso)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button className="btn btn-ghost !min-h-9 !px-2.5" title="Enviar enlace para cambiar contraseña"
                      disabled={pendiente} onClick={() => ejecutar(() => enviarRecuperacion(f.email))}>
                      <Mail size={16} />
                    </button>
                    <button className="btn btn-ghost !min-h-9 !px-2.5" title="Fijar contraseña temporal"
                      disabled={pendiente} onClick={() => setTemporal({ id: f.id, pass: generarPassword() })}>
                      <KeyRound size={16} />
                    </button>
                    {f.id !== miId && (
                      <button className="btn btn-ghost !min-h-9 !px-2.5"
                        title={f.activo ? "Desactivar acceso" : "Reactivar acceso"}
                        style={{ color: f.activo ? "var(--danger)" : "var(--ok)" }}
                        disabled={pendiente} onClick={() => ejecutar(() => cambiarActivo(f.id, !f.activo))}>
                        {f.activo ? <Power size={16} /> : <ShieldCheck size={16} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Todavía no hay usuarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Estado({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium" style={{ color }}>
      <span className="size-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
