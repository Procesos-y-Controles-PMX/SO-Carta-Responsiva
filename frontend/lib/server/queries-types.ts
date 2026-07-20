import type { CrCarta, CrCartaItem } from "@/lib/types/db";

/** Shared client/server type for cartas with joins (no server-only import). */
export type CartaWithRelations = CrCarta & {
  cr_sucursales: {
    id: string;
    nombre: string;
    codigo_sap: string | null;
    prefijo_folio: string;
    region: string | null;
    iva_porcentaje: number;
    ciudad: string | null;
    direccion: string | null;
  } | null;
  cr_usuarios: { email: string; nombre_completo: string | null } | null;
  cr_carta_items: CrCartaItem[];
};
