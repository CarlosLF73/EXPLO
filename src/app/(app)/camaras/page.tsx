import { createClient } from "@/lib/supabase/server";
import { ListaCamaras, type Camara } from "./ListaCamaras";

export const dynamic = "force-dynamic";

export default async function CamarasPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string; prod?: string }>;
}) {
  const { sede, prod } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("elementos")
    .select(`id, codigo, num_visible, numero_serie, propiedad, estado, sede_id, produccion_id,
      temp_sede_id, temp_produccion_id, temp_motivo, generacion_id, fecha_alta, fecha_baja, notas,
      modelo:modelos!inner(modelo, categoria_id),
      proveedor:proveedores(nombre),
      equipos(id, nombre, activo)`)
    .eq("modelo.categoria_id", "CAMARA")
    .order("codigo")
    .returns<Camara[]>();

  if (error) return <p className="card p-4 text-danger text-sm">No se han podido cargar las cámaras: {error.message}</p>;
  return <ListaCamaras camaras={data ?? []} sedeInicial={sede ?? "todas"} prodInicial={prod ?? "todas"} />;
}
