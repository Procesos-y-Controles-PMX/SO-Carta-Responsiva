import { pdf, renderToBuffer } from "@react-pdf/renderer";
import CartaPDFDocument from "./CartaPDFDocument";
import type { CartaWithRelations } from "@/lib/queries/cartas";

const PDF_LOGO_PATH = "/construrama_promexma.png";

function pdfLogoUrl(origin?: string): string {
  const base = origin || (typeof window === "undefined" ? "" : window.location.origin);
  return base
    ? `${base}${PDF_LOGO_PATH}`
    : "https://dummyimage.com/880x120/ffffff/0f1a2e&text=Construrama+Promexma";
}

export async function renderCartaPdfBuffer(
  carta: CartaWithRelations,
  origin: string
): Promise<Buffer> {
  const logoSrc = pdfLogoUrl(origin);
  return renderToBuffer(<CartaPDFDocument carta={carta} logoSrc={logoSrc} />);
}

export async function renderCartaPdfBlob(
  carta: CartaWithRelations,
  origin?: string
): Promise<Blob> {
  const logoSrc = pdfLogoUrl(origin);
  return pdf(<CartaPDFDocument carta={carta} logoSrc={logoSrc} />).toBlob();
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
