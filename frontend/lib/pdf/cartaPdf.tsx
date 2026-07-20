import { pdf, renderToBuffer } from "@react-pdf/renderer";
import CartaPDFDocument from "./CartaPDFDocument";
import type { CartaWithRelations } from "@/lib/queries/cartas";

export async function renderCartaPdfBuffer(
  carta: CartaWithRelations,
  _origin: string
): Promise<Buffer> {
  return renderToBuffer(<CartaPDFDocument carta={carta} />);
}

export async function renderCartaPdfBlob(
  carta: CartaWithRelations,
  _origin?: string
): Promise<Blob> {
  return pdf(<CartaPDFDocument carta={carta} />).toBlob();
}

export function cartaPdfFilename(folio: string): string {
  const safe = (folio.trim() || "carta").replace(/[^\w.-]+/g, "_");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

export function cartaPdfDisposition(filename: string, inline = false): string {
  const mode = inline ? "inline" : "attachment";
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
