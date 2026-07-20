import { NextResponse } from "next/server";
import { canEditCartas, userCanAccessSucursal } from "@/lib/access";
import { badRequest, forbidden, requireAuth } from "@/lib/api/require-auth";
import { getCartaById, getSucursalById, updateCarta } from "@/lib/server/queries";
import type { CartaLineInput } from "@/lib/types/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const carta = await getCartaById(auth.ctx.supabase, id, auth.ctx.user);
  if (!carta) {
    return NextResponse.json({ ok: false, message: "Carta no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: carta });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canEditCartas(auth.ctx.user)) return forbidden("Tu acceso es únicamente de consulta.");

  const { id } = await context.params;
  const existing = await getCartaById(auth.ctx.supabase, id, auth.ctx.user);
  if (!existing) {
    return NextResponse.json({ ok: false, message: "Carta no encontrada." }, { status: 404 });
  }

  const body = (await request.json()) as {
    id_responsable?: string | null;
    nombre_responsable?: string;
    items?: CartaLineInput[];
  };

  if (!body.nombre_responsable?.trim() || !body.items?.length) {
    return badRequest("Responsable e items son requeridos.");
  }

  const sucursal = await getSucursalById(auth.ctx.supabase, existing.id_sucursal);
  if (!sucursal || !userCanAccessSucursal(auth.ctx.user, sucursal)) return forbidden();

  const carta = await updateCarta(auth.ctx.supabase, id, {
    id_responsable: body.id_responsable ?? null,
    nombre_responsable: body.nombre_responsable.trim(),
    iva_porcentaje: Number(sucursal.iva_porcentaje) || 16,
    items: body.items,
  });

  if (!carta) {
    return NextResponse.json(
      { ok: false, message: "No se pudo actualizar la carta." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: carta });
}
