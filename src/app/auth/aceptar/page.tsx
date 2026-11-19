"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PantallaAcceso, Aviso } from "@/components/PantallaAcceso";

/**
 * Destino de los enlaces de invitación y de cambio de contraseña enviados por el
 * administrador. Supabase devuelve la sesión en el fragmento (#access_token=…)
 * o como ?code=…; aquí se convierte en sesión y se continúa a `next`.
 */
function Aceptar() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = params.get("next") ?? "/cuenta/password";
    const destino = next.startsWith("/") ? next : "/";
    const supabase = createClient();
    const hash = new URLSearchParams(window.location.hash.slice(1));

    async function procesar() {
      const desc = hash.get("error_description") ?? params.get("error_description");
      if (desc) {
        setError(
          desc.toLowerCase().includes("expired")
            ? "El enlace ha caducado. Pide al administrador que te envíe uno nuevo."
            : "El enlace no es válido o ya se ha usado.",
        );
        return;
      }
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      const code = params.get("code");
      let fallo = null;
      if (access_token && refresh_token) {
        ({ error: fallo } = await supabase.auth.setSession({ access_token, refresh_token }));
      } else if (code) {
        ({ error: fallo } = await supabase.auth.exchangeCodeForSession(code));
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) fallo = new Error("sin sesión");
      }
      if (fallo) {
        setError("El enlace no es válido o ya se ha usado.");
        return;
      }
      router.replace(destino);
      router.refresh();
    }
    procesar();
  }, [params, router]);

  return (
    <PantallaAcceso titulo={error ? "Enlace no válido" : "Un momento…"}>
      {error ? (
        <div className="space-y-4">
          <Aviso tipo="error">{error}</Aviso>
          <Link href="/login" className="btn btn-ghost w-full">Ir al acceso</Link>
        </div>
      ) : (
        <p className="text-sm text-muted">Comprobando el enlace…</p>
      )}
    </PantallaAcceso>
  );
}

export default function AceptarPage() {
  return (
    <Suspense>
      <Aceptar />
    </Suspense>
  );
}
