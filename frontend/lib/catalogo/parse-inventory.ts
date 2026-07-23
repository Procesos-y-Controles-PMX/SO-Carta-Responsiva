export type CatalogImportRow = {
  centro: string;
  codigo: string;
  descripcion: string;
  unidad_medida: string | null;
  precio: number;
};

function clean(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function parseMoney(value: unknown): number {
  if (value == null || value === "") return 0;
  const text = String(value).trim().replace(/[$,"]/g, "");
  const amount = Number(text);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function detectDelimiter(sample: string): string {
  const tab = (sample.match(/\t/g) ?? []).length;
  const comma = (sample.match(/,/g) ?? []).length;
  const semi = (sample.match(/;/g) ?? []).length;
  if (tab >= comma && tab >= semi) return "\t";
  if (semi >= comma) return ";";
  return ",";
}

function decodeInventoryBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  // Strip UTF-8 BOM if present
  const start = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  return new TextDecoder("utf-8").decode(bytes.subarray(start));
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function parseInventoryText(text: string): {
  items: CatalogImportRow[];
  skipped: number;
} {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("El archivo no tiene filas de datos.");
  }

  const delimiter = detectDelimiter(lines.slice(0, 5).join("\n"));
  const headers = parseCsvLine(lines[0], delimiter).map((h) => clean(h));
  const fieldMap = new Map(headers.map((name, index) => [name, index]));

  for (const required of ["Centro", "SKU", "Material"]) {
    if (!fieldMap.has(required)) {
      throw new Error(`Falta la columna "${required}". Columnas: ${headers.join(", ")}`);
    }
  }

  const centroIdx = fieldMap.get("Centro")!;
  const skuIdx = fieldMap.get("SKU")!;
  const materialIdx = fieldMap.get("Material")!;
  const umbIdx = fieldMap.get("UMB");
  const precioIdx = headers.findIndex((name) => name.includes("Precio"));

  const items: CatalogImportRow[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i], delimiter);
    const centro = clean(cells[centroIdx]).toUpperCase();
    const codigo = clean(cells[skuIdx]).toUpperCase();
    const descripcion = clean(cells[materialIdx]);
    if (!centro || !codigo || !descripcion) {
      skipped += 1;
      continue;
    }
    items.push({
      centro,
      codigo,
      descripcion,
      unidad_medida: umbIdx != null ? clean(cells[umbIdx]) || null : null,
      precio: parseMoney(precioIdx >= 0 ? cells[precioIdx] : null),
    });
  }

  return { items, skipped };
}

export async function parseInventoryFile(file: File): Promise<{
  items: CatalogImportRow[];
  skipped: number;
}> {
  const buffer = await file.arrayBuffer();
  return parseInventoryText(decodeInventoryBuffer(buffer));
}
