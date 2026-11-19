"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Aviso, PantallaAcceso } from "@/components/PantallaAcceso";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setCargando(false);
      setError(
        error.message.includes("Invalid login")
          ? "Correo o contraseña incorrectos."
          : "No se ha podido iniciar sesión. Inténtalo de nuevo.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <PantallaAcceso titulo="Acceso" subtitulo="Gestión de equipos, operadores y flota">
      <form onSubmit={entrar} className="space-y-4">
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
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <button type="submit" className="btn btn-primary w-full" disabled={cargando}>
          {cargando ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-center text-sm">
          <Link href="/recuperar" className="text-accent font-medium hover:underline">
            ¿Has olvidado la contraseña?
          </Link>
        </p>
      </form>
    </PantallaAcceso>
  );
}
