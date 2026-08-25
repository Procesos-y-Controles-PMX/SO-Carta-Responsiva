import { apiFetch } from "@/lib/api/client";
import type { CrUsuarioRow, UserRole } from "@/lib/types/db";

export type UsuarioRow = CrUsuarioRow;

export type UsuarioPayload = {
  email: string;
  nombre_completo: string;
  rol: UserRole;
  password?: string;
  id_sucursal: string | null;
  region: string | null;
  activo: boolean;
};

export async function listUsuarios(): Promise<UsuarioRow[]> {
  const result = await apiFetch<UsuarioRow[]>("/api/admin/usuarios");
  return result.ok ? result.data : [];
}

export async function createUsuario(payload: UsuarioPayload): Promise<{ ok: true; data: UsuarioRow } | { ok: false; message: string }> {
  const result = await apiFetch<UsuarioRow>("/api/admin/usuarios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
}

export async function updateUsuario(
  id: string,
  payload: Partial<UsuarioPayload>,
): Promise<{ ok: true; data: UsuarioRow } | { ok: false; message: string }> {
  const result = await apiFetch<UsuarioRow>("/api/admin/usuarios", {
    method: "PUT",
    body: JSON.stringify({ id, ...payload }),
  });
  return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
}

export async function deleteUsuario(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await apiFetch<unknown>("/api/admin/usuarios", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}
