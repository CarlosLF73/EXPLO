import { redirect } from "next/navigation";
import { getSesion } from "@/lib/supabase/server";
import { Cabecera } from "@/components/Cabecera";
import { PantallaAcceso } from "@/components/PantallaAcceso";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");

  const { user, perfil } = sesion;

  if (perfil && !perfil.activo) {
    return (
      <PantallaAcceso titulo="Acceso desactivado">
        <p className="text-sm text-muted">
          Tu usuario está desactivado. Si crees que es un error, contacta con el administrador.
        </p>
      </PantallaAcceso>
    );
  }

  return (
    <>
      <Cabecera
        nombre={perfil?.nombre ?? ""}
        email={perfil?.email ?? user.email ?? ""}
        esAdmin={perfil?.rol === "admin"}
      />
      <main className="mx-auto max-w-7xl px-3 sm:px-5 py-5 sm:py-7">{children}</main>
    </>
  );
}
