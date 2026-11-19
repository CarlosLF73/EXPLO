import { Users } from "lucide-react";
import { Proximamente } from "@/components/Proximamente";

export default function Page() {
  return (
    <Proximamente
      titulo="Operadores"
      icon={Users}
      puntos={["Listado de operadores por delegación y producción", "Asistencia y disponibilidad diaria", "Análisis de coberturas, horas y productividad"]}
    />
  );
}
