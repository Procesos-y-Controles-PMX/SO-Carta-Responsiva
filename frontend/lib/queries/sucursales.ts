import { supabase } from "../supabase";
import type { CrSucursal } from "../types/db";

export async function listSucursales(activoOnly = true): Promise<CrSucursal[]> {
  if (!supabase) return [];
  let query = supabase.from("cr_sucursales").select("*").order("nombre");
  if (activoOnly) query = query.eq("activo", true);
  const { data } = await query;
  return (data as CrSucursal[] | null) ?? [];
}

export async function getSucursalById(id: string): Promise<CrSucursal | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("cr_sucursales").select("*").eq("id", id).single();
  return (data as CrSucursal | null) ?? null;
}

export async function createSucursal(
  payload: Pick<CrSucursal, "nombre" | "prefijo_folio" | "region">
): Promise<CrSucursal | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("cr_sucursales")
    .insert({ ...payload, activo: true })
    .select("*")
    .single();
  if (error) {
    console.error("createSucursal:", error.message);
    return null;
  }
  return data as CrSucursal;
}
