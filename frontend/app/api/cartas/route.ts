import { NextResponse } from "next/server";
import {
  canEditCartas,
  canGenerateCartas,
  userCanAccessSucursal,
} from "@/lib/access";
import { badRequest, forbidden, requireAuth } from "@/lib/api/require-auth";
import {
  createCarta,
  getSucursalById,
  listCartas,
  type CreateCartaPayload,
} from "@/lib/server/queries";
import type { CartaLineInput } from "@/lib/types/db";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const idSucursal = searchParams.get("sucursal") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const rows = await listCartas(auth.ctx.supabase, auth.ctx.user, {
    idSucursal,
    from,
    to,
  });
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canGenerateCartas(auth.ctx.user)) return forbidden("Tu acceso es únicamente de consulta.");

  const body = (await request.json()) as {
    id_sucursal?: string;
    id_responsable?: string | null;
    nombre_responsable?: string;
    items?: CartaLineInput[];
  };

  if (!body.id_sucursal || !body.nombre_responsable?.trim() || !body.items?.length) {
    return badRequest("Sucursal, responsable e items son requeridos.");
  }

  const sucursal = await getSucursalById(auth.ctx.supabase, body.id_sucursal);
  if (!sucursal || !userCanAccessSucursal(auth.ctx.user, sucursal)) return forbidden();

  const payload: CreateCartaPayload = {
    id_sucursal: body.id_sucursal,
    id_responsable: body.id_responsable ?? null,
    nombre_responsable: body.nombre_responsable.trim(),
    id_usuario: auth.ctx.user.id,
    prefijo_folio: sucursal.prefijo_folio,
    iva_porcentaje: Number(sucursal.iva_porcentaje) || 16,
    items: body.items,
  };

  if (!canEditCartas(auth.ctx.user)) return forbidden();

  const carta = await createCarta(auth.ctx.supabase, payload);
  if (!carta) {
    return NextResponse.json({ ok: false, message: "No se pudo generar la carta." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: carta });
}
