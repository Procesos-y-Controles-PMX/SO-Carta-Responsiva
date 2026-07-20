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
