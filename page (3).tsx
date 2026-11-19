"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Aviso } from "@/components/PantallaAcceso";

function Formulario() {
  const router = useRouter();
  const bienvenida = useSearchParams().get("bienvenida") === "1";
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (p1.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (p1 !== p2) return setError("Las dos contraseñas no coinciden.");
    setCargando(true);
    const { error } = await createClient().auth.updateUser({ password: p1 });
    setCargando(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("different")
          ? "La nueva contraseña debe ser distinta de la anterior."
          : "No se ha podido cambiar la contraseña. Inténtalo de nuevo.",
      );
      return;
    }
    setOk(true);
    setP1("");
    setP2("");
    if (bienvenida) setTimeout(() => router.replace("/"), 1200);
  }

  return (
    <div className="max-w-md">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
        {bienvenida ? "Bienvenido a EXPLO" : "Cambiar contraseña"}
      </h1>
      <p className="mt-1 text-muted">
        {bienvenida
          ? "Crea tu contraseña para entrar a partir de ahora con tu correo."
          : "Elige una contraseña nueva de al menos 8 caracteres."}
      </p>
      <form onSubmit={guardar} className="card p-5 mt-5 space-y-4">
        <div>
          <label className="label" htmlFor="p1">Nueva contraseña</label>
          <input id="p1" type="password" autoComplete="new-password" className="input"
            value={p1} onChange={(e) => setP1(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="p2">Repite la contraseña</label>
          <input id="p2" type="password" autoComplete="new-password" className="input"
            value={p2} onChange={(e) => setP2(e.target.value)} required />
        </div>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">Contraseña guardada.</Aviso>}
        <button type="submit" className="btn btn-primary w-full" disabled={cargando}>
          {cargando ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}

export default function PasswordPage() {
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}
