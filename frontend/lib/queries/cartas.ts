import { apiFetch } from "@/lib/api/client";
import type { CartaWithRelations } from "@/lib/server/queries-types";
import type { CartaLineInput, CrUsuario } from "@/lib/types/db";

export type { CartaWithRelations };

export async function listCartas(
  _user?: CrUsuario,
  options?: { idSucursal?: string; from?: string; to?: string },
): Promise<CartaWithRelations[]> {
  const params = new URLSearchParams();
  if (options?.idSucursal) params.set("sucursal", options.idSucursal);
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  const qs = params.toString();
  const result = await apiFetch<CartaWithRelations[]>(`/api/cartas${qs ? `?${qs}` : ""}`);
  return result.ok ? result.data : [];
}

export async function getCartaById(
  id: string,
  _user?: CrUsuario,
): Promise<CartaWithRelations | null> {
  const result = await apiFetch<CartaWithRelations>(`/api/cartas/${encodeURIComponent(id)}`);
  return result.ok ? result.data : null;
}

export type CreateCartaClientPayload = {
  id_sucursal: string;
  id_responsable: string | null;
  nombre_responsable: string;
  items: CartaLineInput[];
};

export type UpdateCartaClientPayload = {
  id_responsable: string | null;
  nombre_responsable: string;
  items: CartaLineInput[];
};

export async function createCarta(
  payload: CreateCartaClientPayload,
): Promise<CartaWithRelations | null> {
  const result = await apiFetch<CartaWithRelations>("/api/cartas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.ok ? result.data : null;
}

export async function updateCarta(
  id: string,
  payload: UpdateCartaClientPayload,
): Promise<CartaWithRelations | null> {
  const result = await apiFetch<CartaWithRelations>(`/api/cartas/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return result.ok ? result.data : null;
}

export async function deleteCarta(id: string): Promise<boolean> {
  const result = await apiFetch<{ id: string }>(`/api/cartas/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return result.ok;
}
