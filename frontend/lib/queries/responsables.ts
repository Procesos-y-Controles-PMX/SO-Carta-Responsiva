import { apiFetch } from "@/lib/api/client";
import type { CrResponsable } from "@/lib/types/db";

export type ResponsableRow = CrResponsable & {
  cr_sucursales: { id?: string; nombre: string; region?: string | null } | null;
};

export async function listResponsablesBySucursal(
  idSucursal: string,
  _activoOnly = true,
): Promise<CrResponsable[]> {
  const result = await apiFetch<CrResponsable[]>(
    `/api/responsables?sucursal=${encodeURIComponent(idSucursal)}`,
  );
  return result.ok ? result.data : [];
}

export async function listAllResponsables(): Promise<ResponsableRow[]> {
  const result = await apiFetch<ResponsableRow[]>("/api/responsables?all=1");
  return result.ok ? result.data : [];
}

export async function createResponsable(
  idSucursal: string,
  nombre: string,
): Promise<CrResponsable | null> {
  const result = await apiFetch<CrResponsable>("/api/responsables", {
    method: "POST",
    body: JSON.stringify({ id_sucursal: idSucursal, nombre }),
  });
  return result.ok ? result.data : null;
}

export async function deleteResponsable(id: string): Promise<boolean> {
  const result = await apiFetch<unknown>("/api/responsables", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
  return result.ok;
}
