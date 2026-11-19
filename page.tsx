"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Aviso, PantallaAcceso } from "@/components/PantallaAcceso";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/cuenta/password`,
    });
    setCargando(false);
    if (error) {
      setError("No se ha podido enviar el correo. Espera un minuto y vuelve a intentarlo.");
      return;
    }
    setEnviado(true);
  }

  return (
    <PantallaAcceso
      titulo="Recuperar contraseña"
      subtitulo="Te enviaremos un enlace para crear una nueva."
    >
      {enviado ? (
        <div className="space-y-4">
          <Aviso tipo="ok">
            Si el correo está dado de alta, recibirás un enlace en unos minutos. Revisa también el correo no deseado.
          </Aviso>
          <Link href="/login" className="btn btn-ghost w-full">Volver al acceso</Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <button type="submit" className="btn btn-primary w-full" disabled={cargando}>
            {cargando ? "Enviando…" : "Enviar enlace"}
          </button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-accent font-medium hover:underline">Volver al acceso</Link>
          </p>
        </form>
      )}
    </PantallaAcceso>
  );
}
