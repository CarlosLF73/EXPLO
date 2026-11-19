import { Boxes } from "lucide-react";
import { Proximamente } from "@/components/Proximamente";

export default function Page() {
  return (
    <Proximamente
      titulo="Inventario"
      icon={Boxes}
      puntos={["Todo el material: cámaras, ópticas, microfonía, iluminación, transmisión…", "Altas, bajas y traslados con histórico completo", "Material propio, de alquiler y de renting", "Separación clara entre material actual y renove"]}
    />
  );
}
