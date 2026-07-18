import { supabase } from "../supabase";
import type { CrCatalogoItem } from "../types/db";

export async function listCatalogoBySucursal(
  idSucursal: string,
  search = "",
  activoOnly = true
): Promise<CrCatalogoItem[]> {
  if (!supabase) return [];
  let query = supabase
    .from("cr_catalogo")
    .select("*")
    .eq("id_sucursal", idSucursal)
    .order("codigo");
  if (activoOnly) query = query.eq("activo", true);
  if (search.trim()) {
    const term = search.trim();
    query = query.or(`codigo.ilike.%${term}%,descripcion.ilike.%${term}%`);
  }
  const { data } = await query;
  return (data as CrCatalogoItem[] | null) ?? [];
}

export async function createCatalogoItem(payload: {
  id_sucursal: string;
  codigo: string;
  descripcion: string;
  unidad_medida: string | null;
  precio: number;
}): Promise<CrCatalogoItem | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("cr_catalogo")
    .insert({
      ...payload,
      codigo: payload.codigo.trim().toUpperCase(),
      descripcion: payload.descripcion.trim(),
      activo: true,
    })
    .select("*")
    .single();
  if (error) {
    console.error("createCatalogoItem:", error.message);
    return null;
  }
  return data as CrCatalogoItem;
}

export async function updateCatalogoItem(
  id: string,
  patch: Partial<Pick<CrCatalogoItem, "descripcion" | "unidad_medida" | "precio" | "activo">>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("cr_catalogo").update(patch).eq("id", id);
  return !error;
}

export async function getCatalogoItemById(id: string): Promise<CrCatalogoItem | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("cr_catalogo").select("*").eq("id", id).single();
  return (data as CrCatalogoItem | null) ?? null;
}
