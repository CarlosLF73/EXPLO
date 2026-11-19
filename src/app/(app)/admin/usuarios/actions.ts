"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesion } from "@/lib/supabase/server";

export type Resultado = { ok: boolean; mensaje: string };

/** Comprueba que quien llama es administrador activo. */
async function exigirAdmin() {
  const sesion = await getSesion();
  if (!sesion?.perfil || sesion.perfil.rol !== "admin" || !sesion.perfil.activo) {
    throw new Error("Solo el administrador puede hacer esto.");
  }
  return sesion;
}

async function urlBase() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function fallo(e: unknown): Resultado {
  return { ok: false, mensaje: e instanceof Error ? e.message : "Error inesperado." };
}

export async function invitarUsuario(email: string, nombre: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    const correo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { ok: false, mensaje: "El correo no es válido." };
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(correo, {
      data: { nombre: nombre.trim() || undefined },
      redirectTo: `${await urlBase()}/auth/aceptar?next=${encodeURIComponent("/cuenta/password?bienvenida=1")}`,
    });
    if (error) {
      return {
        ok: false,
        mensaje: error.message.includes("already")
          ? "Ese correo ya tiene usuario."
          : `No se ha podido enviar la invitación: ${error.message}`,
      };
    }
    revalidatePath("/admin/usuarios");
    return { ok: true, mensaje: `Invitación enviada a ${correo}.` };
  } catch (e) {
    return fallo(e);
  }
}

export async function cambiarRol(id: string, rol: "admin" | "usuario"): Promise<Resultado> {
  try {
    const { user } = await exigirAdmin();
    if (id === user.id && rol !== "admin") return { ok: false, mensaje: "No puedes quitarte a ti mismo el rol de administrador." };
    const { error } = await createAdminClient().from("perfiles").update({ rol }).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/usuarios");
    return { ok: true, mensaje: "Rol actualizado." };
  } catch (e) {
    return fallo(e);
  }
}

export async function cambiarActivo(id: string, activo: boolean): Promise<Resultado> {
  try {
    const { user } = await exigirAdmin();
    if (id === user.id && !activo) return { ok: false, mensaje: "No puedes desactivarte a ti mismo." };
    const admin = createAdminClient();
    const { error } = await admin.from("perfiles").update({ activo }).eq("id", id);
    if (error) throw error;
    // Además bloquea/desbloquea el acceso en el sistema de autenticación
    await admin.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : "876000h" });
    revalidatePath("/admin/usuarios");
    return { ok: true, mensaje: activo ? "Usuario reactivado." : "Usuario desactivado: ya no puede entrar." };
  } catch (e) {
    return fallo(e);
  }
}

export async function enviarRecuperacion(email: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    const { error } = await createAdminClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${await urlBase()}/auth/aceptar?next=${encodeURIComponent("/cuenta/password")}`,
    });
    if (error) throw error;
    return { ok: true, mensaje: `Enlace para crear nueva contraseña enviado a ${email}.` };
  } catch (e) {
    return fallo(e);
  }
}

export async function fijarPasswordTemporal(id: string, password: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    if (password.length < 8) return { ok: false, mensaje: "La contraseña debe tener al menos 8 caracteres." };
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
    if (error) throw error;
    return { ok: true, mensaje: "Contraseña temporal fijada. Comunícasela al usuario y pídele que la cambie al entrar." };
  } catch (e) {
    return fallo(e);
  }
}
