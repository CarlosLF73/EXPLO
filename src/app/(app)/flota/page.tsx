import { createClient } from "@/lib/supabase/server";
import { FlotaTabs } from "@/components/FlotaTabs";
import { ListaFlota, type Vehiculo, type OperadorMin } from "./ListaFlota";

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
      vehiculo_eventos(id, tipo, fecha, descripcion, estado),
      vehiculo_asignaciones(id, desde, hasta, operador:operadores(id, nombre, apellidos))`)
    .order("codigo")
    .returns<Vehiculo[]>();
  const { data: operadores } = await supabase
    .from("operadores").select("id, nombre, apellidos, produccion_id").eq("activo", true).order("nombre")
    .returns<OperadorMin[]>();
  const { count: multasAbiertas } = await supabase
    .from("multas").select("id", { count: "exact", head: true }).in("estado", ["recibida", "identificado"]);

  if (error) return <p className="card p-4 text-danger text-sm">No se han podido cargar los vehículos: {error.message}</p>;
  return (
    <div className="space-y-5">
      <FlotaTabs avisos={{ "/flota/multas": multasAbiertas ?? 0 }} />
      <ListaFlota vehiculos={data ?? []} operadores={operadores ?? []} sedeInicial={sede ?? "todas"} prodInicial={prod ?? "todas"} />
    </div>
  );
}
