import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave de servicio: SOLO en el servidor y SOLO tras comprobar
 * que quien llama es administrador. Nunca se envía al navegador.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta la variable SUPABASE_SERVICE_ROLE_KEY");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
