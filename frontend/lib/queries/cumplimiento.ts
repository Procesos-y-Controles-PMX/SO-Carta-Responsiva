import { supabase } from "../supabase";
import { scopeSucursales } from "../access";
import type { CrResponsable, CrSucursal, CrUsuario } from "../types/db";

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
  user: CrUsuario,
  from: string,
  to: string
): Promise<ComplianceRow[]> {
  if (!supabase) return [];

  const { data: sucursalesData } = await supabase
    .from("cr_sucursales")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  const sucursales = scopeSucursales(
    user,
    (sucursalesData as CrSucursal[] | null) ?? [],
  );
  const branchIds = sucursales.map((sucursal) => sucursal.id);
  if (branchIds.length === 0) return [];

  const [responsablesRes, cartasRes] = await Promise.all([
    supabase
      .from("cr_responsables")
      .select("*")
      .eq("activo", true)
      .in("id_sucursal", branchIds),
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
          ? respCartas.reduce((latest, c) =>
              c.created_at > latest ? c.created_at : latest
            , respCartas[0].created_at)
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
