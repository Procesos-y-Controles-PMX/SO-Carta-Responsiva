import { NextResponse } from "next/server";
import { canManageMasterData, userCanAccessSucursal } from "@/lib/access";
import { badRequest, forbidden, requireAuth } from "@/lib/api/require-auth";
import {
  createResponsable,
  deleteResponsable,
  getSucursalById,
  listAllResponsables,
  listResponsablesBySucursal,
} from "@/lib/server/queries";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const idSucursal = searchParams.get("sucursal");
  const all = searchParams.get("all") === "1";

  if (all) {
    const rows = await listAllResponsables(auth.ctx.supabase, auth.ctx.user);
    return NextResponse.json({ ok: true, data: rows });
  }

  if (!idSucursal) return badRequest("Parámetro sucursal requerido.");
  const sucursal = await getSucursalById(auth.ctx.supabase, idSucursal);
  if (!sucursal || !userCanAccessSucursal(auth.ctx.user, sucursal)) return forbidden();

  const rows = await listResponsablesBySucursal(auth.ctx.supabase, idSucursal, false);
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const body = (await request.json()) as { id_sucursal?: string; nombre?: string };
  if (!body.id_sucursal || !body.nombre?.trim()) {
    return badRequest("Sucursal y nombre son requeridos.");
  }

  const created = await createResponsable(auth.ctx.supabase, body.id_sucursal, body.nombre);
  if (!created) {
    return NextResponse.json(
      { ok: false, message: "No se pudo agregar el responsable." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: created });
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const body = (await request.json()) as { id?: string };
  if (!body.id) return badRequest("id es requerido.");

  const ok = await deleteResponsable(auth.ctx.supabase, body.id);
  if (!ok) {
    return NextResponse.json(
      { ok: false, message: "No se pudo eliminar el responsable." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
