import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion, type Perfil } from "@/lib/supabase/server";
import { TablaUsuarios, type Fila } from "./TablaUsuarios";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const sesion = await getSesion();
  if (sesion?.perfil?.rol !== "admin") redirect("/");

  let filas: Fila[] = [];
  let error: string | null = null;
  try {
    const admin = createAdminClient();
    const [{ data: perfiles, error: e1 }, { data: auth, error: e2 }] = await Promise.all([
      admin.from("perfiles").select("id, email, nombre, rol, activo").order("email").returns<Perfil[]>(),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    if (e1 || e2) throw e1 || e2;
    const porId = new Map(auth.users.map((u) => [u.id, u]));
    filas = (perfiles ?? []).map((p) => {
      const u = porId.get(p.id);
      return {
        ...p,
        ultimoAcceso: u?.last_sign_in_at ?? null,
        pendiente: !u?.last_sign_in_at,
        invitadoEl: u?.invited_at ?? u?.created_at ?? null,
      };
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar usuarios";
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-semibold">Usuarios</h1>
        <p className="text-muted mt-1">
          Invita por correo, gestiona permisos y accesos. Las contraseñas se guardan cifradas: nadie puede verlas,
          pero puedes enviar un enlace de cambio o fijar una temporal.
        </p>
      </div>
      {error ? (
        <p className="card p-4 text-danger text-sm">{error}</p>
      ) : (
        <TablaUsuarios filas={filas} miId={sesion.user.id} />
      )}
    </div>
  );
}
