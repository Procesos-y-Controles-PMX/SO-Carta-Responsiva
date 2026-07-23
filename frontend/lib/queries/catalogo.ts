import { apiFetch } from "@/lib/api/client";
import type { CrCatalogoItem } from "@/lib/types/db";

export async function listCatalogoBySucursal(
  idSucursal: string,
  search = "",
  activoOnly = true,
): Promise<CrCatalogoItem[]> {
  const params = new URLSearchParams({
    sucursal: idSucursal,
    search,
    activo: activoOnly ? "1" : "0",
  });
  const result = await apiFetch<CrCatalogoItem[]>(`/api/catalogo?${params}`);
  return result.ok ? result.data : [];
}

export async function createCatalogoItem(payload: {
  id_sucursal: string;
  codigo: string;
  descripcion: string;
  unidad_medida: string | null;
  precio: number;
}): Promise<CrCatalogoItem | null> {
  const result = await apiFetch<CrCatalogoItem>("/api/catalogo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.ok ? result.data : null;
}

export async function updateCatalogoItem(
  id: string,
  payload: {
    codigo: string;
    descripcion: string;
    unidad_medida: string | null;
    precio: number;
    activo: boolean;
  },
): Promise<CrCatalogoItem | null> {
  const result = await apiFetch<CrCatalogoItem>("/api/catalogo", {
    method: "PATCH",
    body: JSON.stringify({ id, ...payload }),
  });
  return result.ok ? result.data : null;
}

export type CatalogImportResult = {
  upserted: number;
  created: number;
  updated: number;
  reactivated: number;
  deactivated: number;
  duplicatesCollapsed: number;
  branches: number;
  skippedCentros: string[];
  parsed: number;
  skippedRows: number;
};

export async function importCatalogoFile(
  file: File,
  deactivateMissing = true,
): Promise<{ ok: true; data: CatalogImportResult } | { ok: false; message: string }> {
  const body = new FormData();
  body.append("file", file);
  body.append("deactivateMissing", deactivateMissing ? "1" : "0");

  try {
    const response = await fetch("/api/catalogo/import", {
      method: "POST",
      body,
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: CatalogImportResult;
      message?: string;
    };
    if (!response.ok || payload.ok === false || !payload.data) {
      return { ok: false, message: payload.message ?? "No se pudo importar el catálogo." };
    }
    return { ok: true, data: payload.data };
  } catch {
    return { ok: false, message: "No se pudo contactar al servidor." };
  }
}
