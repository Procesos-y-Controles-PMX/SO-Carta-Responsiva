import { apiFetch } from "@/lib/api/client";
import type { CrSucursal } from "@/lib/types/db";

export async function listSucursales(_activoOnly = true): Promise<CrSucursal[]> {
  const result = await apiFetch<CrSucursal[]>("/api/sucursales");
  return result.ok ? result.data : [];
}

export async function createSucursal(
  payload: Pick<CrSucursal, "nombre" | "prefijo_folio" | "region">,
): Promise<CrSucursal | null> {
  const result = await apiFetch<CrSucursal>("/api/sucursales", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.ok ? result.data : null;
}
