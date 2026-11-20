import { Wrench } from "lucide-react";
import { FlotaTabs } from "@/components/FlotaTabs";
import { Proximamente } from "@/components/Proximamente";

export default function MantenimientoPage() {
  return (
    <div className="space-y-5">
      <FlotaTabs />
      <Proximamente
        titulo="Mantenimiento de vehículos"
        icon={Wrench}
        puntos={[
          "Plan preventivo por vehículo: revisiones por km o fecha, ITV y neumáticos",
          "Contrato de renting: fecha fin y aviso al acercarse a los km contratados",
          "Averías y citas de taller, bloqueando el coche esos días",
          "Costes, talleres, partes y facturas con lectura automática",
        ]}
      />
    </div>
  );
}
