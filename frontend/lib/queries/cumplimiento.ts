import { apiFetch } from "@/lib/api/client";
import type { CrUsuario } from "@/lib/types/db";

export type ComplianceRow = {
  sucursal: import("@/lib/types/db").CrSucursal;
  responsables: Array<
    import("@/lib/types/db").CrResponsable & {
      cartasEnPeriodo: number;
      ultimaCarta: string | null;
    }
  >;
  cartasSucursalEnPeriodo: number;
};

export async function getComplianceReport(
  _user: CrUsuario,
  from: string,
  to: string,
): Promise<ComplianceRow[]> {
  const params = new URLSearchParams({ from, to });
  const result = await apiFetch<ComplianceRow[]>(`/api/cumplimiento?${params}`);
  return result.ok ? result.data : [];
}

export type SucursalSinCarta = {
  sucursal: import("@/lib/types/db").CrSucursal;
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
