import { NextResponse } from "next/server";
import { canManageMasterData, userCanAccessSucursal } from "@/lib/access";
import { badRequest, forbidden, requireAuth } from "@/lib/api/require-auth";
import {
  createResponsable,
  getSucursalById,
  listAllResponsables,
  listResponsablesBySucursal,
  toggleResponsableActivo,
} from "@/lib/server/queries";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const idSucursal = searchParams.get("sucursal");
  const all = searchParams.get("all") === "1";

  if (all) {
    if (!canManageMasterData(auth.ctx.user)) return forbidden();
    const rows = await listAllResponsables(auth.ctx.supabase);
    return NextResponse.json({ ok: true, data: rows });
  }

  if (!idSucursal) return badRequest("Parámetro sucursal requerido.");
  const sucursal = await getSucursalById(auth.ctx.supabase, idSucursal);
  if (!sucursal || !userCanAccessSucursal(auth.ctx.user, sucursal)) return forbidden();

  const rows = await listResponsablesBySucursal(auth.ctx.supabase, idSucursal);
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

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const body = (await request.json()) as { id?: string; activo?: boolean };
  if (!body.id || typeof body.activo !== "boolean") {
    return badRequest("id y activo son requeridos.");
  }

  const ok = await toggleResponsableActivo(auth.ctx.supabase, body.id, body.activo);
  if (!ok) {
    return NextResponse.json(
      { ok: false, message: "No se pudo actualizar el responsable." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
