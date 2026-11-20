/**
 * Genera el PDF de comunicación de una multa:
 *  - "identificacion": identificación del conductor para Pyramid / Multas (con DNI y dirección)
 *  - "conductor": aviso al conductor de que debe pagarla
 * Se ejecuta en el navegador (jsPDF se carga solo cuando hace falta).
 */
export type DatosPdfMulta = {
  tipo: "identificacion" | "conductor";
  expediente: string | null;
  organismo: string | null;
  matricula: string;
  vehiculo: string | null;
  fechaInfraccion: string;
  lugar: string | null;
  importe: string;
  puntos: number | null;
  conductor: { nombre: string; dni?: string | null; direccion?: string | null };
  firmante: string;
  destinatarios?: string;
};

export async function generarPdfMulta(d: DatosPdfMulta): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 20;
  const ancho = 210 - M * 2;
  let y = 22;

  // Franja de marca (A3 / La Sexta)
  doc.setFillColor(232, 93, 12); doc.rect(0, 0, 105, 4, "F");
  doc.setFillColor(18, 151, 74); doc.rect(105, 0, 105, 4, "F");

  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(93, 104, 120);
  doc.text("LIQUIDMEDIA · EXPLOTACIÓN", M, y);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }), 210 - M, y, { align: "right" });

  y += 14;
  doc.setTextColor(22, 32, 44); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(d.tipo === "identificacion" ? "Identificación del conductor" : "Comunicación de multa al conductor", M, y);
  y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(93, 104, 120);
  doc.text(`Expediente ${d.expediente ?? "sin número"} · Vehículo ${d.matricula}`, M, y);
  if (d.destinatarios) { y += 5; doc.text(`Para: ${d.destinatarios}`, M, y); }

  const bloque = (titulo: string, filas: [string, string][]) => {
    y += 12;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(47, 111, 237);
    doc.text(titulo.toUpperCase(), M, y);
    y += 2.5; doc.setDrawColor(221, 226, 234); doc.line(M, y, 210 - M, y);
    doc.setFontSize(11);
    for (const [k, v] of filas) {
      y += 7.5;
      doc.setFont("helvetica", "normal"); doc.setTextColor(93, 104, 120); doc.text(k, M, y);
      doc.setFont("helvetica", "bold"); doc.setTextColor(22, 32, 44);
      const lineas = doc.splitTextToSize(v || "—", ancho - 50);
      doc.text(lineas, M + 50, y);
      y += (lineas.length - 1) * 5.5;
    }
  };

  bloque("Datos de la multa", [
    ["Expediente", d.expediente ?? "—"],
    ["Organismo", d.organismo ?? "—"],
    ["Vehículo", `${d.matricula}${d.vehiculo ? ` · ${d.vehiculo}` : ""}`],
    ["Fecha y hora", d.fechaInfraccion],
    ["Lugar", d.lugar ?? "—"],
    ["Importe", `${d.importe}${d.puntos ? ` · ${d.puntos} puntos` : ""}`],
  ]);

  bloque(d.tipo === "identificacion" ? "Conductor responsable" : "Conductor", d.tipo === "identificacion"
    ? [["Nombre", d.conductor.nombre], ["DNI / NIE", d.conductor.dni ?? "—"], ["Dirección", d.conductor.direccion ?? "—"]]
    : [["Nombre", d.conductor.nombre]]);

  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(22, 32, 44);
  const texto = d.tipo === "identificacion"
    ? "Por medio del presente documento se identifica a la persona arriba indicada como conductora del vehículo en la fecha y hora de la infracción, a los efectos oportunos."
    : "Se comunica la multa arriba indicada al conductor del vehículo en el momento de la infracción, para que proceda a su pago y entregue el justificante. Si se abona dentro del plazo de pronto pago indicado en la notificación, suele aplicarse un 50 % de descuento.";
  const lineas = doc.splitTextToSize(texto, ancho);
  doc.text(lineas, M, y);
  y += lineas.length * 5.5 + 26;

  // Firmas
  const col = ancho / 2;
  doc.setDrawColor(150, 160, 175);
  doc.line(M, y, M + col - 10, y);
  doc.setFontSize(10); doc.setTextColor(93, 104, 120);
  doc.text("Comunica", M, y + 5);
  doc.setTextColor(22, 32, 44); doc.text(d.firmante || " ", M, y + 10);
  if (d.tipo === "conductor") {
    doc.line(M + col + 10, y, 210 - M, y);
    doc.setTextColor(93, 104, 120); doc.text("Recibí (conductor)", M + col + 10, y + 5);
    doc.setTextColor(22, 32, 44); doc.text(d.conductor.nombre, M + col + 10, y + 10);
  }

  doc.setFontSize(8); doc.setTextColor(150, 160, 175);
  doc.text("Documento generado con EXPLO · contiene datos personales: uso exclusivo para la tramitación de esta multa.", 105, 287, { align: "center" });

  return doc.output("blob");
}
