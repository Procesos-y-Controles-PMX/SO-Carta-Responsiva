import { MERCANCIA_ABORDO_TERMS } from "../carta/terms";
import { generarFolio } from "../folio";
import { supabase } from "../supabase";
import type { CartaLineInput, CrCarta, CrCartaItem, CrUsuario } from "../types/db";
import { roundToDecimals } from "../utils";

export type CartaWithRelations = CrCarta & {
  cr_sucursales: {
    nombre: string;
    codigo_sap: string | null;
    prefijo_folio: string;
    region: string | null;
  } | null;
  cr_usuarios: { email: string; nombre_completo: string | null } | null;
  cr_carta_items: CrCartaItem[];
};

export const CARTA_SELECT = `
  *,
  cr_sucursales(nombre, codigo_sap, prefijo_folio, region),
  cr_usuarios(email, nombre_completo),
  cr_carta_items(*)
`;

export async function listCartas(
  user: CrUsuario,
  options?: { idSucursal?: string; from?: string; to?: string }
): Promise<CartaWithRelations[]> {
  if (!supabase) return [];

  let query = supabase
    .from("cr_cartas")
    .select(CARTA_SELECT)
    .order("created_at", { ascending: false });

  if (user.rol === "operador" && user.id_sucursal) {
    query = query.eq("id_sucursal", user.id_sucursal);
  } else if (options?.idSucursal) {
    query = query.eq("id_sucursal", options.idSucursal);
  }

  if (options?.from) query = query.gte("created_at", options.from);
  if (options?.to) query = query.lte("created_at", options.to);

  const { data } = await query;
  return (data as CartaWithRelations[] | null) ?? [];
}

export async function getCartaById(id: string): Promise<CartaWithRelations | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("cr_cartas").select(CARTA_SELECT).eq("id", id).single();
  return (data as CartaWithRelations | null) ?? null;
}

export type CreateCartaPayload = {
  id_sucursal: string;
  id_responsable: string | null;
  nombre_responsable: string;
  id_usuario: string;
  prefijo_folio: string;
  items: CartaLineInput[];
};

export type UpdateCartaPayload = {
  id_responsable: string | null;
  nombre_responsable: string;
  items: CartaLineInput[];
};

async function insertCartaItems(idCarta: string, items: CartaLineInput[]): Promise<boolean> {
  if (!supabase || items.length === 0) return false;
  const rows = items.map((item) => ({
    id_carta: idCarta,
    id_catalogo: item.id_catalogo,
    codigo: item.codigo,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    unidad_medida: item.unidad_medida,
    precio: item.precio,
  }));
  const { error } = await supabase.from("cr_carta_items").insert(rows);
  return !error;
}

export async function createCarta(payload: CreateCartaPayload): Promise<CartaWithRelations | null> {
  if (!supabase || payload.items.length === 0) return null;

  const folio = generarFolio(payload.prefijo_folio);
  const now = new Date().toISOString();
  const subtotal = roundToDecimals(
    payload.items.reduce((sum, item) => sum + item.cantidad * item.precio, 0)
  );
  const iva = roundToDecimals(subtotal * 0.16);
  const total = roundToDecimals(subtotal + iva);

  const { data: carta, error } = await supabase
    .from("cr_cartas")
    .insert({
      folio,
      id_sucursal: payload.id_sucursal,
      id_responsable: payload.id_responsable,
      nombre_responsable: payload.nombre_responsable,
      id_usuario: payload.id_usuario,
      terminos_snapshot: MERCANCIA_ABORDO_TERMS,
      subtotal,
      iva,
      total,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !carta) {
    console.error("createCarta:", error?.message);
    return null;
  }

  const itemsOk = await insertCartaItems(carta.id as string, payload.items);
  if (!itemsOk) {
    await supabase.from("cr_cartas").delete().eq("id", carta.id);
    return null;
  }

  return getCartaById(carta.id as string);
}

export async function updateCarta(
  id: string,
  payload: UpdateCartaPayload
): Promise<CartaWithRelations | null> {
  if (!supabase || payload.items.length === 0) return null;
  const subtotal = roundToDecimals(
    payload.items.reduce((sum, item) => sum + item.cantidad * item.precio, 0)
  );
  const iva = roundToDecimals(subtotal * 0.16);
  const total = roundToDecimals(subtotal + iva);

  const { error: updateError } = await supabase
    .from("cr_cartas")
    .update({
      id_responsable: payload.id_responsable,
      nombre_responsable: payload.nombre_responsable,
      terminos_snapshot: MERCANCIA_ABORDO_TERMS,
      subtotal,
      iva,
      total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("updateCarta:", updateError.message);
    return null;
  }

  const { error: deleteError } = await supabase.from("cr_carta_items").delete().eq("id_carta", id);
  if (deleteError) return null;

  const itemsOk = await insertCartaItems(id, payload.items);
  if (!itemsOk) return null;

  return getCartaById(id);
}
