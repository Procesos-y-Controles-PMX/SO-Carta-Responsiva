import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isGeneralAdmin,
  normalizeRegion,
  scopeSucursales,
  userCanAccessSucursal,
} from "@/lib/access";
import { MERCANCIA_ABORDO_TERMS } from "@/lib/carta/terms";
import { generarFolio } from "@/lib/folio";
import { canonicalizePersonName } from "@/lib/personName";
import type { CartaWithRelations } from "@/lib/server/queries-types";
import type {
  CartaLineInput,
  CrCatalogoItem,
  CrResponsable,
  CrSucursal,
  CrUsuario,
} from "@/lib/types/db";
import { roundToDecimals } from "@/lib/utils";

export type { CartaWithRelations };

export const CARTA_SELECT = `
  *,
  cr_sucursales(id, nombre, codigo_sap, prefijo_folio, region, iva_porcentaje, ciudad, direccion),
  cr_usuarios(email, nombre_completo),
  cr_carta_items(*)
`;

export async function listSucursalesForUser(
  supabase: SupabaseClient,
  user: CrUsuario,
  activoOnly = true,
): Promise<CrSucursal[]> {
  let query = supabase.from("cr_sucursales").select("*").order("nombre");
  if (activoOnly) query = query.eq("activo", true);
  const { data } = await query;
  return scopeSucursales(user, (data as CrSucursal[] | null) ?? []);
}

export async function getSucursalById(
  supabase: SupabaseClient,
  id: string,
): Promise<CrSucursal | null> {
  const { data } = await supabase.from("cr_sucursales").select("*").eq("id", id).single();
  return (data as CrSucursal | null) ?? null;
}

export async function createSucursal(
  supabase: SupabaseClient,
  payload: Pick<CrSucursal, "nombre" | "prefijo_folio" | "region">,
): Promise<CrSucursal | null> {
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

export async function listResponsablesBySucursal(
  supabase: SupabaseClient,
  idSucursal: string,
  activoOnly = true,
): Promise<CrResponsable[]> {
  let query = supabase
    .from("cr_responsables")
    .select("*")
    .eq("id_sucursal", idSucursal)
    .order("nombre");
  if (activoOnly) query = query.eq("activo", true);
  const { data } = await query;
  return (data as CrResponsable[] | null) ?? [];
}

export type ResponsableRow = CrResponsable & {
  cr_sucursales: { id?: string; nombre: string; region?: string | null } | null;
};

export async function listAllResponsables(
  supabase: SupabaseClient,
  user?: CrUsuario,
): Promise<ResponsableRow[]> {
  const { data } = await supabase
    .from("cr_responsables")
    .select("*, cr_sucursales(id, nombre, region)")
    .order("nombre");
  const rows = (data as ResponsableRow[] | null) ?? [];
  if (!user || isGeneralAdmin(user)) return rows;

  const allowed = new Set(
    (await listSucursalesForUser(supabase, user)).map((s) => s.id),
  );
  return rows.filter((row) => allowed.has(row.id_sucursal));
}

export async function deleteResponsable(
  supabase: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { error } = await supabase.from("cr_responsables").delete().eq("id", id);
  if (error) {
    console.error("deleteResponsable:", error.message);
    return false;
  }
  return true;
}

export async function createResponsable(
  supabase: SupabaseClient,
  idSucursal: string,
  nombre: string,
): Promise<
  | { ok: true; data: CrResponsable; reactivated: boolean }
  | { ok: false; conflict: true; message: string }
  | { ok: false; conflict: false; message: string }
> {
  const canonical = canonicalizePersonName(nombre);
  if (!canonical) {
    return { ok: false, conflict: false, message: "El nombre es requerido." };
  }

  const { data: existing } = await supabase
    .from("cr_responsables")
    .select("*")
    .eq("id_sucursal", idSucursal)
    .eq("nombre_normalizado", canonical)
    .maybeSingle();

  if (existing) {
    const row = existing as CrResponsable;
    if (row.activo) {
      return {
        ok: false,
        conflict: true,
        message: "Ya existe un responsable con ese nombre en la sucursal.",
      };
    }
    const { data: reactivated, error } = await supabase
      .from("cr_responsables")
      .update({ nombre: canonical, activo: true })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error || !reactivated) {
      console.error("createResponsable reactivate:", error?.message);
      return { ok: false, conflict: false, message: "No se pudo reactivar el responsable." };
    }
    return { ok: true, data: reactivated as CrResponsable, reactivated: true };
  }

  const { data, error } = await supabase
    .from("cr_responsables")
    .insert({
      id_sucursal: idSucursal,
      nombre: canonical,
      nombre_normalizado: canonical,
      activo: true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createResponsable:", error.message);
    if (error.code === "23505") {
      return {
        ok: false,
        conflict: true,
        message: "Ya existe un responsable con ese nombre en la sucursal.",
      };
    }
    return { ok: false, conflict: false, message: "No se pudo agregar el responsable." };
  }
  return { ok: true, data: data as CrResponsable, reactivated: false };
}

export async function toggleResponsableActivo(
  supabase: SupabaseClient,
  id: string,
  activo: boolean,
): Promise<boolean> {
  const { error } = await supabase.from("cr_responsables").update({ activo }).eq("id", id);
  return !error;
}

export async function listCatalogoBySucursal(
  supabase: SupabaseClient,
  idSucursal: string,
  search = "",
  activoOnly = true,
): Promise<CrCatalogoItem[]> {
  let query = supabase.from("cr_catalogo").select("*").eq("id_sucursal", idSucursal).order("codigo");
  if (activoOnly) query = query.eq("activo", true);
  if (search.trim()) {
    const term = search.trim();
    query = query.or(`codigo.ilike.%${term}%,descripcion.ilike.%${term}%`);
  }
  const { data } = await query;
  return (data as CrCatalogoItem[] | null) ?? [];
}

export async function createCatalogoItem(
  supabase: SupabaseClient,
  payload: {
    id_sucursal: string;
    codigo: string;
    descripcion: string;
    unidad_medida: string | null;
    precio: number;
  },
): Promise<CrCatalogoItem | null> {
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
  supabase: SupabaseClient,
  id: string,
  payload: {
    codigo: string;
    descripcion: string;
    unidad_medida: string | null;
    precio: number;
    activo: boolean;
  },
): Promise<CrCatalogoItem | null> {
  const { data, error } = await supabase
    .from("cr_catalogo")
    .update({
      codigo: payload.codigo.trim().toUpperCase(),
      descripcion: payload.descripcion.trim(),
      unidad_medida: payload.unidad_medida,
      precio: payload.precio,
      activo: payload.activo,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("updateCatalogoItem:", error.message);
    return null;
  }
  return data as CrCatalogoItem;
}

export async function replaceCatalogFromImport(
  supabase: SupabaseClient,
  items: Array<{
    centro: string;
    codigo: string;
    descripcion: string;
    unidad_medida: string | null;
    precio: number;
  }>,
  options?: { deactivateMissing?: boolean },
): Promise<{
  upserted: number;
  created: number;
  updated: number;
  reactivated: number;
  deactivated: number;
  duplicatesCollapsed: number;
  branches: number;
  skippedCentros: string[];
}> {
  const { data: branches } = await supabase
    .from("cr_sucursales")
    .select("id, nombre, codigo_sap")
    .eq("activo", true);
  const branchByCentro = new Map<string, { id: string; nombre: string }>();
  for (const branch of (branches as CrSucursal[] | null) ?? []) {
    const centro = (branch.codigo_sap ?? "").trim().toUpperCase();
    if (centro) branchByCentro.set(centro, { id: branch.id, nombre: branch.nombre });
  }

  // Collapse repeats in the file: same Centro+SKU keeps the last row.
  const deduped = new Map<string, (typeof items)[number]>();
  let duplicatesCollapsed = 0;
  for (const item of items) {
    const key = `${item.centro}|${item.codigo}`;
    if (deduped.has(key)) duplicatesCollapsed += 1;
    deduped.set(key, item);
  }
  const uniqueItems = [...deduped.values()];

  const byCentro = new Map<string, typeof uniqueItems>();
  for (const item of uniqueItems) {
    const list = byCentro.get(item.centro) ?? [];
    list.push(item);
    byCentro.set(item.centro, list);
  }

  const skippedCentros = [...byCentro.keys()].filter((c) => !branchByCentro.has(c)).sort();
  const matchedBranchIds = new Set<string>();
  const importedKeys = new Set<string>();
  const payloadByBranch = new Map<
    string,
    Array<{
      id_sucursal: string;
      codigo: string;
      descripcion: string;
      unidad_medida: string | null;
      precio: number;
      activo: boolean;
    }>
  >();

  for (const [centro, centroItems] of byCentro) {
    const branch = branchByCentro.get(centro);
    if (!branch) continue;
    matchedBranchIds.add(branch.id);
    const payload = centroItems.map((item) => {
      importedKeys.add(`${branch.id}:${item.codigo}`);
      return {
        id_sucursal: branch.id,
        codigo: item.codigo,
        descripcion: item.descripcion,
        unidad_medida: item.unidad_medida,
        precio: item.precio,
        activo: true,
      };
    });
    const existing = payloadByBranch.get(branch.id) ?? [];
    existing.push(...payload);
    payloadByBranch.set(branch.id, existing);
  }

  // Existing rows for matched branches — drives created vs updated vs reactivated.
  const existingByKey = new Map<string, { id: string; activo: boolean }>();
  if (matchedBranchIds.size > 0) {
    const { data: existing } = await supabase
      .from("cr_catalogo")
      .select("id, id_sucursal, codigo, activo")
      .in("id_sucursal", [...matchedBranchIds]);
    for (const row of (existing as CrCatalogoItem[] | null) ?? []) {
      existingByKey.set(`${row.id_sucursal}:${row.codigo}`, {
        id: row.id,
        activo: row.activo,
      });
    }
  }

  let upserted = 0;
  let created = 0;
  let updated = 0;
  let reactivated = 0;

  for (const [, payload] of payloadByBranch) {
    for (const row of payload) {
      const prev = existingByKey.get(`${row.id_sucursal}:${row.codigo}`);
      if (!prev) created += 1;
      else if (!prev.activo) reactivated += 1;
      else updated += 1;
    }

    for (let i = 0; i < payload.length; i += 500) {
      const batch = payload.slice(i, i + 500);
      const { error } = await supabase.from("cr_catalogo").upsert(batch, {
        onConflict: "id_sucursal,codigo",
        ignoreDuplicates: false,
      });
      if (error) {
        console.error("replaceCatalogFromImport upsert:", error.message);
        throw new Error(error.message);
      }
      upserted += batch.length;
    }
  }

  let deactivated = 0;
  if (options?.deactivateMissing && matchedBranchIds.size > 0) {
    const toDeactivate = [...existingByKey.entries()]
      .filter(([key, row]) => row.activo && !importedKeys.has(key))
      .map(([, row]) => row.id);
    for (let i = 0; i < toDeactivate.length; i += 500) {
      const batch = toDeactivate.slice(i, i + 500);
      const { error } = await supabase
        .from("cr_catalogo")
        .update({ activo: false })
        .in("id", batch);
      if (error) {
        console.error("replaceCatalogFromImport deactivate:", error.message);
        throw new Error(error.message);
      }
      deactivated += batch.length;
    }
  }

  return {
    upserted,
    created,
    updated,
    reactivated,
    deactivated,
    duplicatesCollapsed,
    branches: matchedBranchIds.size,
    skippedCentros,
  };
}

export async function listCartas(
  supabase: SupabaseClient,
  user: CrUsuario,
  options?: { idSucursal?: string; from?: string; to?: string },
): Promise<CartaWithRelations[]> {
  let query = supabase
    .from("cr_cartas")
    .select(CARTA_SELECT)
    .order("created_at", { ascending: false });

  if (!isGeneralAdmin(user)) {
    if (user.rol === "usuario") {
      if (!user.id_sucursal) return [];
      query = query.eq("id_sucursal", user.id_sucursal);
    } else {
      const { data: branches } = await supabase
        .from("cr_sucursales")
        .select("id, region")
        .eq("activo", true);
      const branchIds = (branches ?? [])
        .filter((branch) => normalizeRegion(branch.region) === normalizeRegion(user.region))
        .map((branch) => branch.id);
      if (branchIds.length === 0) return [];
      query = query.in("id_sucursal", branchIds);
    }
  } else if (options?.idSucursal) {
    query = query.eq("id_sucursal", options.idSucursal);
  }

  if (options?.from) query = query.gte("created_at", options.from);
  if (options?.to) query = query.lte("created_at", options.to);

  const { data } = await query;
  return (data as CartaWithRelations[] | null) ?? [];
}

export async function getCartaById(
  supabase: SupabaseClient,
  id: string,
  user?: CrUsuario,
): Promise<CartaWithRelations | null> {
  const { data } = await supabase.from("cr_cartas").select(CARTA_SELECT).eq("id", id).single();
  const carta = (data as CartaWithRelations | null) ?? null;
  if (
    !carta ||
    (user &&
      !userCanAccessSucursal(user, {
        id: carta.id_sucursal,
        region: carta.cr_sucursales?.region ?? null,
      }))
  ) {
    return null;
  }
  return carta;
}

export type CreateCartaPayload = {
  id_sucursal: string;
  id_responsable: string | null;
  nombre_responsable: string;
  id_usuario: string;
  prefijo_folio: string;
  iva_porcentaje: number;
  items: CartaLineInput[];
};

export type UpdateCartaPayload = {
  id_responsable: string | null;
  nombre_responsable: string;
  iva_porcentaje: number;
  items: CartaLineInput[];
};

async function insertCartaItems(
  supabase: SupabaseClient,
  idCarta: string,
  items: CartaLineInput[],
): Promise<boolean> {
  if (items.length === 0) return false;
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

export async function createCarta(
  supabase: SupabaseClient,
  payload: CreateCartaPayload,
): Promise<CartaWithRelations | null> {
  if (payload.items.length === 0) return null;

  const folio = generarFolio(payload.prefijo_folio);
  const now = new Date().toISOString();
  const subtotal = roundToDecimals(
    payload.items.reduce((sum, item) => sum + item.cantidad * item.precio, 0),
  );
  const iva = roundToDecimals(subtotal * (payload.iva_porcentaje / 100));
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

  const itemsOk = await insertCartaItems(supabase, carta.id as string, payload.items);
  if (!itemsOk) {
    await supabase.from("cr_cartas").delete().eq("id", carta.id);
    return null;
  }

  return getCartaById(supabase, carta.id as string);
}

export async function updateCarta(
  supabase: SupabaseClient,
  id: string,
  payload: UpdateCartaPayload,
): Promise<CartaWithRelations | null> {
  if (payload.items.length === 0) return null;
  const subtotal = roundToDecimals(
    payload.items.reduce((sum, item) => sum + item.cantidad * item.precio, 0),
  );
  const iva = roundToDecimals(subtotal * (payload.iva_porcentaje / 100));
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

  const itemsOk = await insertCartaItems(supabase, id, payload.items);
  if (!itemsOk) return null;

  return getCartaById(supabase, id);
}

export async function deleteCarta(
  supabase: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { error: itemsError } = await supabase
    .from("cr_carta_items")
    .delete()
    .eq("id_carta", id);
  if (itemsError) {
    console.error("deleteCarta items:", itemsError.message);
    return false;
  }

  const { error } = await supabase.from("cr_cartas").delete().eq("id", id);
  if (error) {
    console.error("deleteCarta:", error.message);
    return false;
  }
  return true;
}

export type ComplianceRow = {
  sucursal: CrSucursal;
  responsables: Array<
    CrResponsable & {
      cartasEnPeriodo: number;
      ultimaCarta: string | null;
    }
  >;
  cartasSucursalEnPeriodo: number;
};

export async function getComplianceReport(
  supabase: SupabaseClient,
  user: CrUsuario,
  from: string,
  to: string,
): Promise<ComplianceRow[]> {
  const { data: sucursalesData } = await supabase
    .from("cr_sucursales")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  const sucursales = scopeSucursales(user, (sucursalesData as CrSucursal[] | null) ?? []);
  const branchIds = sucursales.map((sucursal) => sucursal.id);
  if (branchIds.length === 0) return [];

  const [responsablesRes, cartasRes] = await Promise.all([
    supabase.from("cr_responsables").select("*").eq("activo", true).in("id_sucursal", branchIds),
    supabase
      .from("cr_cartas")
      .select("id, id_sucursal, id_responsable, created_at")
      .in("id_sucursal", branchIds)
      .gte("created_at", from)
      .lte("created_at", to),
  ]);

  const responsables = (responsablesRes.data as CrResponsable[] | null) ?? [];
  const cartas =
    (cartasRes.data as Array<{
      id: string;
      id_sucursal: string;
      id_responsable: string | null;
      created_at: string;
    }> | null) ?? [];

  return sucursales.map((sucursal) => {
    const sucursalCartas = cartas.filter((c) => c.id_sucursal === sucursal.id);
    const sucursalResponsables = responsables.filter((r) => r.id_sucursal === sucursal.id);

    const responsablesWithStats = sucursalResponsables.map((resp) => {
      const respCartas = sucursalCartas.filter((c) => c.id_responsable === resp.id);
      const ultima =
        respCartas.length > 0
          ? respCartas.reduce(
              (latest, c) => (c.created_at > latest ? c.created_at : latest),
              respCartas[0].created_at,
            )
          : null;
      return {
        ...resp,
        cartasEnPeriodo: respCartas.length,
        ultimaCarta: ultima,
      };
    });

    return {
      sucursal,
      responsables: responsablesWithStats,
      cartasSucursalEnPeriodo: sucursalCartas.length,
    };
  });
}

export type SucursalSinCarta = {
  sucursal: CrSucursal;
  cartasEnPeriodo: number;
};

export function sucursalesSinCarta(rows: ComplianceRow[]): SucursalSinCarta[] {
  return rows
    .filter((row) => row.cartasSucursalEnPeriodo === 0)
    .map((row) => ({
      sucursal: row.sucursal,
      cartasEnPeriodo: 0,
    }));
}

export function responsablesSinCarta(rows: ComplianceRow[]): Array<{
  sucursalNombre: string;
  responsableNombre: string;
}> {
  const result: Array<{ sucursalNombre: string; responsableNombre: string }> = [];
  for (const row of rows) {
    for (const resp of row.responsables) {
      if (resp.cartasEnPeriodo === 0) {
        result.push({
          sucursalNombre: row.sucursal.nombre,
          responsableNombre: resp.nombre,
        });
      }
    }
  }
  return result;
}
