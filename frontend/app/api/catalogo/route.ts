import { NextResponse } from "next/server";
import { canManageMasterData, userCanAccessSucursal } from "@/lib/access";
import { badRequest, forbidden, requireAuth } from "@/lib/api/require-auth";
import {
  isAllowedUnidadMedida,
  normalizeUnidadMedida,
} from "@/lib/catalogoUnits";
import {
  createCatalogoItem,
  getSucursalById,
  listCatalogoBySucursal,
  updateCatalogoItem,
} from "@/lib/server/queries";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const idSucursal = searchParams.get("sucursal");
  const search = searchParams.get("search") ?? "";
  const activoOnly = searchParams.get("activo") !== "0";

  if (!idSucursal) return badRequest("Parámetro sucursal requerido.");
  const sucursal = await getSucursalById(auth.ctx.supabase, idSucursal);
  if (!sucursal || !userCanAccessSucursal(auth.ctx.user, sucursal)) return forbidden();

  const rows = await listCatalogoBySucursal(auth.ctx.supabase, idSucursal, search, activoOnly);
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const body = (await request.json()) as {
    id_sucursal?: string;
    codigo?: string;
    descripcion?: string;
    unidad_medida?: string | null;
    precio?: number;
  };

  if (!body.id_sucursal || !body.codigo?.trim() || !body.descripcion?.trim() || body.precio == null) {
    return badRequest("Completa todos los campos del catálogo.");
  }

  const unidad = normalizeUnidadMedida(body.unidad_medida);
  if (!isAllowedUnidadMedida(unidad)) {
    return badRequest("Unidad de medida no válida.");
  }

  const created = await createCatalogoItem(auth.ctx.supabase, {
    id_sucursal: body.id_sucursal,
    codigo: body.codigo,
    descripcion: body.descripcion,
    unidad_medida: unidad,
    precio: Number(body.precio),
  });
  if (!created) {
    return NextResponse.json(
      { ok: false, message: "No se pudo agregar el producto." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: created });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const body = (await request.json()) as {
    id?: string;
    codigo?: string;
    descripcion?: string;
    unidad_medida?: string | null;
    precio?: number;
    activo?: boolean;
  };

  if (
    !body.id ||
    !body.codigo?.trim() ||
    !body.descripcion?.trim() ||
    body.precio == null ||
    typeof body.activo !== "boolean"
  ) {
    return badRequest("id, código, descripción, precio y activo son requeridos.");
  }

  // Allow legacy U.M. codes already stored; new picks still come from the UI list.
  const unidad = normalizeUnidadMedida(body.unidad_medida);

  const updated = await updateCatalogoItem(auth.ctx.supabase, body.id, {
    codigo: body.codigo,
    descripcion: body.descripcion,
    unidad_medida: unidad,
    precio: Number(body.precio),
    activo: body.activo,
  });
  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "No se pudo actualizar el producto (¿código duplicado?)." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: updated });
}
