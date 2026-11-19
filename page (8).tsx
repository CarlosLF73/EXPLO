import { Car } from "lucide-react";
import { Proximamente } from "@/components/Proximamente";

export default function Page() {
  return (
    <Proximamente
      titulo="Flota"
      icon={Car}
      puntos={["Vehículos por delegación y producción", "Tarjetas SOLRED y su historial por vehículo", "Taller, ITV, kilómetros, multas y siniestros", "Lectura automática de documentos (multas, facturas…)"]}
    />
  );
}
