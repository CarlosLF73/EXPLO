import { createClient, getSesion } from "@/lib/supabase/server";
import { ListaOperadores, type Operador } from "./ListaOperadores";

export const dynamic = "force-dynamic";

export default async function OperadoresPage() {
  const sesion = await getSesion();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operadores")
    .select("id, nombre, apellidos, alias, telefono, telefono_personal, contrato, email, sede_id, produccion_id, activo, notas")
    .order("apellidos")
    .returns<Operador[]>();

  if (error) return <p className="card p-4 text-danger text-sm">No se han podido cargar los operadores: {error.message}</p>;
  return <ListaOperadores operadores={data ?? []} esAdmin={sesion?.perfil?.rol === "admin"} />;
}
