import "server-only";

import { hash } from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrUsuarioRow, UserRole } from "@/lib/types/db";

export const USUARIO_SELECT =
  "id, email, nombre_completo, rol, id_sucursal, region, activo, created_at, cr_sucursales(nombre, region)";

export type UsuarioRow = CrUsuarioRow;

const ROLES: UserRole[] = ["usuario", "administrador_zona", "administrador_general"];

export function isUserRole(value: string): value is UserRole {
  return ROLES.includes(value as UserRole);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function sucursalRegion(
  supabase: SupabaseClient,
  idSucursal: string | null,
): Promise<string | null> {
  if (!idSucursal) return null;
  const { data } = await supabase.from("cr_sucursales").select("region").eq("id", idSucursal).maybeSingle();
  return (data?.region as string | null | undefined)?.trim() || null;
}

export function scopeFieldsForRole(
  rol: UserRole,
  idSucursal: string | null | undefined,
  region: string | null | undefined,
  sucursalRegionValue?: string | null,
): { id_sucursal: string | null; region: string | null } | { error: string } {
  if (rol === "administrador_general") {
    return { id_sucursal: null, region: null };
  }
  if (rol === "administrador_zona") {
    const nextRegion = (region ?? "").trim();
    if (!nextRegion) return { error: "Un administrador de zona requiere región." };
    return { id_sucursal: null, region: nextRegion };
  }
  const sucursal = (idSucursal ?? "").trim();
  if (!sucursal) return { error: "Un usuario de sucursal requiere sucursal." };
  return {
    id_sucursal: sucursal,
    region: (sucursalRegionValue ?? region ?? "").trim() || null,
  };
}

export async function listUsuarios(supabase: SupabaseClient): Promise<UsuarioRow[]> {
  const { data, error } = await supabase
    .from("cr_usuarios")
    .select(USUARIO_SELECT)
    .order("activo", { ascending: false })
    .order("email");
  if (error) {
    console.error("listUsuarios:", error.message);
    throw new Error("No se pudieron cargar los usuarios.");
  }
  return ((data as unknown as UsuarioRow[] | null) ?? []);
}

export async function countActiveGeneralAdmins(supabase: SupabaseClient, excludeId?: string): Promise<number> {
  let query = supabase
    .from("cr_usuarios")
    .select("id", { count: "exact", head: true })
    .eq("rol", "administrador_general")
    .eq("activo", true);
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function createUsuario(
  supabase: SupabaseClient,
  payload: {
    email: string;
    nombre_completo?: string;
    rol: UserRole;
    password: string;
    id_sucursal?: string | null;
    region?: string | null;
    activo?: boolean;
  },
): Promise<{ ok: true; data: UsuarioRow } | { ok: false; message: string; status: number }> {
  const email = normalizeEmail(payload.email);
  const password = payload.password.trim();
  if (!email) return { ok: false, message: "El correo es obligatorio.", status: 400 };
  if (password.length < 4) {
    return { ok: false, message: "La contraseña debe tener al menos 4 caracteres.", status: 400 };
  }

  const sucursalId = payload.id_sucursal?.trim() || null;
  const scoped = scopeFieldsForRole(
    payload.rol,
    sucursalId,
    payload.region,
    await sucursalRegion(supabase, sucursalId),
  );
  if ("error" in scoped) return { ok: false, message: scoped.error, status: 400 };

  const password_hash = await hash(password, 10);
  const { data, error } = await supabase
    .from("cr_usuarios")
    .insert({
      email,
      nombre_completo: payload.nombre_completo?.trim() || null,
      rol: payload.rol,
      password_hash,
      activo: payload.activo !== false,
      id_sucursal: scoped.id_sucursal,
      region: scoped.region,
    })
    .select(USUARIO_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Ese correo ya está registrado.", status: 409 };
    console.error("createUsuario:", error.message);
    return { ok: false, message: "No se pudo crear el usuario.", status: 500 };
  }
  return { ok: true, data: data as unknown as UsuarioRow };
}

export async function updateUsuario(
  supabase: SupabaseClient,
  id: string,
  payload: {
    email?: string;
    nombre_completo?: string | null;
    rol?: UserRole;
    password?: string;
    id_sucursal?: string | null;
    region?: string | null;
    activo?: boolean;
  },
): Promise<{ ok: true; data: UsuarioRow } | { ok: false; message: string; status: number }> {
  const patch: Record<string, unknown> = {};
  if (payload.email !== undefined) patch.email = normalizeEmail(payload.email);
  if (payload.nombre_completo !== undefined) {
    patch.nombre_completo = payload.nombre_completo?.trim() || null;
  }
  if (payload.activo !== undefined) patch.activo = payload.activo;

  if (payload.rol !== undefined || payload.id_sucursal !== undefined || payload.region !== undefined) {
    const { data: current, error: currentError } = await supabase
      .from("cr_usuarios")
      .select("rol, id_sucursal, region")
      .eq("id", id)
      .maybeSingle();
    if (currentError || !current) return { ok: false, message: "Usuario no encontrado.", status: 404 };
    const rol = payload.rol ?? (current.rol as UserRole);
    const sucursalId =
      payload.id_sucursal !== undefined ? payload.id_sucursal?.trim() || null : (current.id_sucursal as string | null);
    const scoped = scopeFieldsForRole(
      rol,
      sucursalId,
      payload.region !== undefined ? payload.region : (current.region as string | null),
      await sucursalRegion(supabase, sucursalId),
    );
    if ("error" in scoped) return { ok: false, message: scoped.error, status: 400 };
    patch.rol = rol;
    patch.id_sucursal = scoped.id_sucursal;
    patch.region = scoped.region;
  }

  if (payload.password !== undefined) {
    const password = payload.password.trim();
    if (password) {
      if (password.length < 4) {
        return { ok: false, message: "La contraseña debe tener al menos 4 caracteres.", status: 400 };
      }
      patch.password_hash = await hash(password, 10);
    }
  }

  const { data, error } = await supabase
    .from("cr_usuarios")
    .update(patch)
    .eq("id", id)
    .select(USUARIO_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Ese correo ya está registrado.", status: 409 };
    console.error("updateUsuario:", error.message);
    return { ok: false, message: "No se pudo actualizar el usuario.", status: 500 };
  }
  return { ok: true, data: data as unknown as UsuarioRow };
}

export async function deleteUsuario(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const { error } = await supabase.from("cr_usuarios").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        message: "No se puede borrar: el usuario tiene cartas. Desactívalo en su lugar.",
        status: 409,
      };
    }
    console.error("deleteUsuario:", error.message);
    return { ok: false, message: "No se pudo eliminar el usuario.", status: 500 };
  }
  return { ok: true };
}
