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
): Promise<
  | { ok: true; data: CrResponsable; reactivated: boolean }
  | { ok: false; message: string }
> {
  try {
    const response = await fetch("/api/responsables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id_sucursal: idSucursal, nombre }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: CrResponsable;
      reactivated?: boolean;
      message?: string;
    };
    if (!response.ok || payload.ok === false || !payload.data) {
      return { ok: false, message: payload.message ?? "No se pudo agregar el responsable." };
    }
    return {
      ok: true,
      data: payload.data,
      reactivated: Boolean(payload.reactivated),
    };
  } catch {
    return { ok: false, message: "No se pudo contactar al servidor." };
  }
}

export async function deleteResponsable(id: string): Promise<boolean> {
  const result = await apiFetch<unknown>("/api/responsables", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
  return result.ok;
}
