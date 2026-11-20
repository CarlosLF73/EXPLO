"use client";

import { X, Search } from "lucide-react";
import { useEffect } from "react";

export const SEDES: { id: string; nombre: string }[] = [
  { id: "MAD", nombre: "Madrid" },
  { id: "BIL", nombre: "Bilbao" },
  { id: "SCQ", nombre: "Santiago" },
  { id: "LCG", nombre: "A Coruña" },
  { id: "VAL", nombre: "Valencia" },
];
export const PRODUCCIONES: { id: string; nombre: string; color: string }[] = [
  { id: "A3", nombre: "Antena 3", color: "var(--a3)" },
  { id: "L6", nombre: "La Sexta", color: "var(--l6)" },
];
export const nombreSede = (id: string | null) => SEDES.find((s) => s.id === id)?.nombre ?? "—";
export const prodInfo = (id: string | null) => PRODUCCIONES.find((p) => p.id === id);

/** Cabecera de página con título, subtítulo y acciones. */
export function Cabecera({ titulo, sub, children }: { titulo: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-semibold leading-none">{titulo}</h1>
        {sub && <p className="mt-1.5 text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Grupo de botones tipo pestaña para filtrar. */
export function Segmentos<T extends string>({
  valor, opciones, onChange, etiqueta,
}: {
  valor: T;
  opciones: { id: T; label: string; color?: string; n?: number }[];
  onChange: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex flex-wrap rounded-xl bg-surface-2 p-1 gap-1">
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(o.id)}
            className={`h-9 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              activo ? "bg-surface shadow-sm text-text" : "text-muted hover:text-text"
            }`}
          >
            {o.color && <span className="size-2.5 rounded-full" style={{ background: o.color }} />}
            {o.label}
            {o.n !== undefined && <span className="text-xs text-muted tabular-nums">{o.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Buscador({ valor, onChange, placeholder }: { valor: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative flex-1 min-w-52 max-w-sm">
      <span className="sr-only">{placeholder}</span>
      <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input className="input !pl-9" placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Ventana modal sencilla (panel lateral en escritorio, hoja inferior en móvil). */
export function Modal({ titulo, onClose, children, pie }: {
  titulo: string; onClose: () => void; children: React.ReactNode; pie?: React.ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch" role="dialog" aria-modal="true" aria-label={titulo}>
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative w-full sm:w-[460px] max-h-[92dvh] sm:max-h-none bg-surface sm:h-full rounded-t-2xl sm:rounded-none shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold truncate">{titulo}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-surface-2" aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {pie && <div className="border-t border-border p-4 flex gap-2 justify-end shrink-0">{pie}</div>}
      </div>
    </div>
  );
}

export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Insignia({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>
      {children}
    </span>
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-muted">{children}</div>;
}
