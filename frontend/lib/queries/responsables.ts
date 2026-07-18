import { supabase } from "../supabase";
import type { CrResponsable } from "../types/db";

export async function listResponsablesBySucursal(
  idSucursal: string,
  activoOnly = true
): Promise<CrResponsable[]> {
  if (!supabase) return [];
  let query = supabase
    .from("cr_responsables")
    .select("*")
    .eq("id_sucursal", idSucursal)
    .order("nombre");
  if (activoOnly) query = query.eq("activo", true);
  const { data } = await query;
  return (data as CrResponsable[] | null) ?? [];
}

export async function listAllResponsables(): Promise<
  (CrResponsable & { cr_sucursales: { nombre: string } | null })[]
> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("cr_responsables")
    .select("*, cr_sucursales(nombre)")
    .order("nombre");
  return (data as (CrResponsable & { cr_sucursales: { nombre: string } | null })[] | null) ?? [];
}

export async function createResponsable(
  idSucursal: string,
  nombre: string
): Promise<CrResponsable | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("cr_responsables")
    .insert({ id_sucursal: idSucursal, nombre: nombre.trim(), activo: true })
    .select("*")
    .single();
  if (error) {
    console.error("createResponsable:", error.message);
    return null;
  }
  return data as CrResponsable;
}

export async function toggleResponsableActivo(id: string, activo: boolean): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("cr_responsables").update({ activo }).eq("id", id);
  return !error;
}
