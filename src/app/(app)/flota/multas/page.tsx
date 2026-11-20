import { createClient, getSesion } from "@/lib/supabase/server";
import { FlotaTabs } from "@/components/FlotaTabs";
import { ListaMultas, type Multa, type Doc, type Privado, type Contactos, type VehMin, type OpMin } from "./ListaMultas";

export const dynamic = "force-dynamic";

export default async function MultasPage() {
  const sesion = await getSesion();
  const esAdmin = sesion?.perfil?.rol === "admin";
  const supabase = await createClient();

  const [multas, vehiculos, operadores, docs, ajustes, privados] = await Promise.all([
    supabase.from("multas")
      .select(`*, vehiculo:vehiculos(id, codigo, matricula, marca, modelo),
        operador:operadores(id, nombre, apellidos, telefono, telefono_personal, email)`)
      .order("created_at", { ascending: false })
      .returns<Multa[]>(),
    supabase.from("vehiculos").select("id, codigo, matricula, marca, modelo").neq("estado", "baja").order("codigo").returns<VehMin[]>(),
    supabase.from("operadores").select("id, nombre, apellidos, produccion_id, email").eq("activo", true).order("nombre").returns<OpMin[]>(),
    supabase.from("documentos").select("id, entidad_id, tipo, nombre_archivo, storage_path, created_at").eq("entidad", "multa").returns<Doc[]>(),
    supabase.from("ajustes").select("valor").eq("clave", "multas_contactos").maybeSingle<{ valor: Contactos }>(),
    // Solo devuelve filas al administrador (seguridad en la base de datos)
    esAdmin
      ? supabase.from("operador_datos_privados").select("operador_id, dni, dni_caducidad, direccion, comprobado_el, a_revisar, notas").returns<Privado[]>()
      : Promise.resolve({ data: [] as Privado[] }),
  ]);

  const abiertas = (multas.data ?? []).filter((m) => m.estado === "recibida" || m.estado === "identificado").length;

  return (
    <div className="space-y-5">
      <FlotaTabs avisos={{ "/flota/multas": abiertas }} />
      {multas.error ? (
        <p className="card p-4 text-danger text-sm">No se han podido cargar las multas: {multas.error.message}</p>
      ) : (
        <ListaMultas
          multas={multas.data ?? []}
          vehiculos={vehiculos.data ?? []}
          operadores={operadores.data ?? []}
          docs={docs.data ?? []}
          contactos={ajustes.data?.valor ?? { para: [], cc: [] }}
          privados={privados.data ?? []}
          esAdmin={esAdmin}
          miNombre={sesion?.perfil?.nombre ?? ""}
        />
      )}
    </div>
  );
}
