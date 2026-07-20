import { NextResponse } from "next/server";
import { canManageMasterData } from "@/lib/access";
import { badRequest, forbidden, requireAuth } from "@/lib/api/require-auth";
import { createSucursal, listSucursalesForUser } from "@/lib/server/queries";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const rows = await listSucursalesForUser(auth.ctx.supabase, auth.ctx.user);
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const body = (await request.json()) as {
    nombre?: string;
    prefijo_folio?: string;
    region?: string | null;
  };
  if (!body.nombre?.trim() || !body.prefijo_folio?.trim()) {
    return badRequest("Nombre y prefijo de folio son requeridos.");
  }

  const created = await createSucursal(auth.ctx.supabase, {
    nombre: body.nombre.trim(),
    prefijo_folio: body.prefijo_folio.trim(),
    region: body.region?.trim() || null,
  });
  if (!created) {
    return NextResponse.json({ ok: false, message: "No se pudo crear la sucursal." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: created });
}
