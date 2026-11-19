import { Camera } from "lucide-react";
import { Proximamente } from "@/components/Proximamente";

export default function Page() {
  return (
    <Proximamente
      titulo="Cámaras y salidas"
      icon={Camera}
      puntos={["Fichas visuales de cada cámara con su estado y su equipo", "Salidas a cobertura: operador, vehículo, hora de salida y regreso", "Relevos, reservas para mañana y desplazamientos entre delegaciones", "Escaneo del QR desde el móvil"]}
    />
  );
}
