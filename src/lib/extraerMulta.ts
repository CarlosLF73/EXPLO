/**
 * Lectura de los datos de una multa a partir de texto (correo o PDF).
 * Versión sin IA: busca patrones habituales en las notificaciones españolas.
 * Devuelve solo lo que encuentra; el usuario revisa y completa.
 */
export type DatosMulta = {
  matriculas: string[];          // candidatas, por orden de aparición
  expediente?: string;
  fecha?: string;                // AAAA-MM-DD de la infracción
  hora?: string;                 // HH:MM
  lugar?: string;
  organismo?: string;
  importe?: string;              // "200,00"
  puntos?: string;
  notificacion?: string;         // AAAA-MM-DD
  origen?: "pyramid" | "multas_mediapro" | "dgt" | "renting" | "otro";
  metodo: "patrones" | "ia";
};

const norm = (s: string) => s.replace(/ /g, " ").replace(/[ \t]+/g, " ");

function aISO(d: string, m: string, y: string) {
  const anio = y.length === 2 ? `20${y}` : y;
  const dd = d.padStart(2, "0"), mm = m.padStart(2, "0");
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return undefined;
  return `${anio}-${mm}-${dd}`;
}

const RE_FECHA = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/;
const RE_FECHA_G = new RegExp(RE_FECHA.source, "g");

/** Busca una fecha (y hora) en las ~120 letras siguientes a cada aparición de una etiqueta. */
function fechaTras(texto: string, etiqueta: RegExp) {
  const re = new RegExp(etiqueta.source, "gi");
  for (const m of texto.matchAll(re)) {
    const trozo = texto.slice(m.index!, m.index! + m[0].length + 120);
    const f = RE_FECHA.exec(trozo);
    if (!f) continue;
    const h = /(\d{1,2})[:.h](\d{2})\s*(?:h|horas)?/i.exec(trozo.slice(f.index + f[0].length, f.index + f[0].length + 30));
    return { fecha: aISO(f[1], f[2], f[3]), hora: h ? `${h[1].padStart(2, "0")}:${h[2]}` : undefined };
  }
  return undefined;
}

export function extraerConPatrones(entrada: string): DatosMulta {
  const texto = norm(entrada);
  const r: DatosMulta = { matriculas: [], metodo: "patrones" };

  // Matrículas españolas actuales (1234 BCD) y antiguas (M 1234 AB)
  const vistas = new Set<string>();
  for (const m of texto.matchAll(/\b(\d{4})\s?-?\s?([BCDFGHJKLMNPRSTVWXYZ]{3})\b/g)) {
    const mat = `${m[1]}${m[2]}`;
    if (!vistas.has(mat)) { vistas.add(mat); r.matriculas.push(mat); }
  }

  // Expediente / boletín / nº de denuncia
  const exp = /(?:n[ºo°.]*\s*(?:de\s*)?expediente|expediente\s*n[ºo°.]*|expte\.?|n[ºo°.]*\s*(?:de\s*)?(?:bolet[ií]n|denuncia)|bolet[ií]n)\s*[:#nº°.]*\s*([A-Z0-9][A-Z0-9\/\-.]{4,30})/i.exec(texto);
  if (exp) r.expediente = exp[1].replace(/[.\-\/]$/, "");

  // Fecha de la infracción (o de la denuncia); si no hay etiqueta, la primera fecha del texto
  const fi = fechaTras(texto, /fecha\s*(?:y\s*hora\s*)?(?:de\s*(?:la\s*)?)?(?:infracci[oó]n|denuncia|los\s*hechos|hechos)/i)
    ?? fechaTras(texto, /(?:el\s*d[ií]a|d[ií]a)\s/i);
  if (fi?.fecha) { r.fecha = fi.fecha; r.hora = fi.hora; }
  else {
    const f = RE_FECHA_G.exec(texto); RE_FECHA_G.lastIndex = 0;
    if (f) r.fecha = aISO(f[1], f[2], f[3]);
  }
  if (!r.hora) {
    const h = /\b(?:hora|a\s*las)\s*[:]?\s*(\d{1,2})[:.h](\d{2})/i.exec(texto);
    if (h) r.hora = `${h[1].padStart(2, "0")}:${h[2]}`;
  }

  // Fecha de notificación
  const fn = fechaTras(texto, /(?:fecha\s*de\s*)?notificaci[oó]n|notificad[ao]\s*(?:el)?/i);
  if (fn?.fecha && fn.fecha !== r.fecha) r.notificacion = fn.fecha;

  // Importe: preferir el que va junto a "importe", "sanción" o "multa"
  const imp = /(?:importe|sanci[oó]n|multa|cuant[ií]a)[^\d€]{0,40}(\d{1,4}(?:[.,]\d{2})?)\s*(?:€|eur|euros)/i.exec(texto)
    ?? /(\d{2,4}(?:[.,]\d{2})?)\s*(?:€|euros)/i.exec(texto);
  if (imp) r.importe = imp[1].includes(",") || imp[1].includes(".") ? imp[1].replace(".", ",") : `${imp[1]},00`;

  const pts = /(\d{1,2})\s*puntos/i.exec(texto) ?? /puntos[^\d\n]{0,25}(\d{1,2})\b/i.exec(texto);
  if (pts && +pts[1] <= 15) r.puntos = pts[1];

  // Organismo
  if (/direcci[oó]n\s*general\s*de\s*tr[aá]fico|\bDGT\b|jefatura\s*(?:provincial\s*)?de\s*tr[aá]fico/i.test(texto)) r.organismo = "DGT";
  const ayto = /ayuntamiento\s*de\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\- ]{2,30})/i.exec(texto);
  if (ayto) r.organismo = `Ayuntamiento de ${ayto[1].trim().split(/\s{2,}|\n|,|\.|\s-\s|\s–\s/)[0]}`;
  if (/servei\s*catal[aà]\s*de\s*tr[aà]nsit/i.test(texto)) r.organismo = "Servei Català de Trànsit";
  if (/trafikoa|tr[aá]fico\s*del\s*gobierno\s*vasco/i.test(texto)) r.organismo = "Tráfico Gobierno Vasco";

  // Lugar
  const lug = /(?:lugar|v[ií]a|localizaci[oó]n|emplazamiento)(?:\s*de\s*(?:la\s*)?(?:infracci[oó]n|denuncia))?\s*[:\-]\s*([^\n]{4,90})/i.exec(entrada);
  if (lug) r.lugar = norm(lug[1]).trim().replace(/\s*(fecha|hora|matr[ií]cula).*$/i, "");

  // Quién lo envía
  if (/pyramidconsulting|pyramid\s*consulting/i.test(texto)) r.origen = "pyramid";
  else if (/multas@mediapro/i.test(texto)) r.origen = "multas_mediapro";
  else if (/kinto|vw\s*renting|volkswagen\s*renting/i.test(texto)) r.origen = "renting";
  else if (r.organismo === "DGT") r.origen = "dgt";

  return r;
}
