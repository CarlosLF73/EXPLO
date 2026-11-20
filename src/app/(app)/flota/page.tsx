import { createClient } from "@/lib/supabase/server";
import { ListaFlota, type Vehiculo } from "./ListaFlota";

export const dynamic = "force-dynamic";

export default async function FlotaPage({ searchParams }: { searchParams: Promise<{ sede?: string; prod?: string }> }) {
  const { sede, prod } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select(`id, codigo, matricula, marca, modelo, propiedad, estado, sede_id, produccion_id, coste_mensual, telepeaje, notas,
      proveedor:proveedores(nombre),
      vehiculo_km(km, fecha),
      vehiculo_tarjetas(hasta, tarjeta:tarjetas_combustible(alias, emisor, ultimos_digitos, estado)),
      vehiculo_eventos(id, tipo, fecha, descripcion, estado)`)
    .order("codigo")
    .returns<Vehiculo[]>();

  if (error) return <p className="card p-4 text-danger text-sm">No se han podido cargar los vehículos: {error.message}</p>;
  return <ListaFlota vehiculos={data ?? []} sedeInicial={sede ?? "todas"} prodInicial={prod ?? "todas"} />;
}
