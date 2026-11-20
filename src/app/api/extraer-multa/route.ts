import { NextResponse, type NextRequest } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { extraerConPatrones, type DatosMulta } from "@/lib/extraerMulta";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Lee los datos de una multa a partir de un PDF y/o el texto de un correo.
 * - Con ANTHROPIC_API_KEY configurada en Vercel: usa IA (Claude).
 * - Sin ella: extrae el texto y busca patrones.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const form = await req.formData();
  const texto = String(form.get("texto") ?? "").slice(0, 30_000);
  const archivo = form.get("archivo") as File | null;
  if (!texto.trim() && !archivo) return NextResponse.json({ error: "No hay nada que leer" }, { status: 400 });
  if (archivo && archivo.size > 8 * 1024 * 1024) return NextResponse.json({ error: "El archivo pasa de 8 MB" }, { status: 413 });

  const bytes = archivo ? new Uint8Array(await archivo.arrayBuffer()) : null;
  const esPdf = !!archivo && (archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf"));

  // 1) Con IA, si hay clave
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const datos = await extraerConIA(texto, bytes && archivo ? { bytes, mime: esPdf ? "application/pdf" : archivo.type } : null);
      return NextResponse.json(datos);
    } catch (e) {
      console.error("extraer-multa IA:", e);
      // si falla, seguimos con la lectura por patrones
    }
  }

  // 2) Sin IA: texto del PDF + texto del correo
  let textoPdf = "";
  if (bytes && esPdf) {
    try {
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      textoPdf = Array.isArray(text) ? text.join("\n") : text;
    } catch (e) {
      console.error("extraer-multa PDF:", e);
    }
  }
  const total = [texto, textoPdf].filter(Boolean).join("\n\n");
  const datos = extraerConPatrones(total);
  return NextResponse.json({
    ...datos,
    aviso: bytes && esPdf && !textoPdf.trim()
      ? "El PDF parece una imagen escaneada y no tiene texto: sin IA no se puede leer. Rellena los datos a mano."
      : undefined,
  });
}

async function extraerConIA(texto: string, doc: { bytes: Uint8Array; mime: string } | null): Promise<DatosMulta> {
  const contenido: unknown[] = [];
  if (doc) {
    const b64 = Buffer.from(doc.bytes).toString("base64");
    contenido.push(doc.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: doc.mime, data: b64 } });
  }
  contenido.push({
    type: "text",
    text: `${texto ? `Texto del correo recibido:\n"""\n${texto}\n"""\n\n` : ""}Extrae los datos de esta multa de tráfico española.
Responde SOLO con un objeto JSON con estas claves (omite las que no aparezcan, no inventes nada):
{"matriculas": ["1234ABC"], "expediente": "...", "fecha": "AAAA-MM-DD (de la infracción)", "hora": "HH:MM",
 "lugar": "...", "organismo": "DGT | Ayuntamiento de ... | ...", "importe": "200,00", "puntos": "2",
 "notificacion": "AAAA-MM-DD (fecha de notificación o de recepción)",
 "origen": "pyramid | multas_mediapro | dgt | renting | otro (quién la envía)"}`,
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 800,
      messages: [{ role: "user", content: contenido }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const salida: string = json.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
  const objeto = JSON.parse(salida.slice(salida.indexOf("{"), salida.lastIndexOf("}") + 1));
  return {
    ...objeto,
    matriculas: (objeto.matriculas ?? []).map((m: string) => m.replace(/[\s-]/g, "").toUpperCase()),
    metodo: "ia",
  };
}
