import { NextResponse } from "next/server";
import { canManageMasterData } from "@/lib/access";
import { badRequest, forbidden, requireAuth } from "@/lib/api/require-auth";
import {
  countActiveGeneralAdmins,
  createUsuario,
  deleteUsuario,
  isUserRole,
  listUsuarios,
  updateUsuario,
} from "@/lib/server/usuarios";
import type { UserRole } from "@/lib/types/db";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  try {
    const rows = await listUsuarios(auth.ctx.supabase);
    return NextResponse.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, message: "No se pudieron cargar los usuarios." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const body = (await request.json()) as {
    email?: string;
    nombre_completo?: string;
    rol?: string;
    password?: string;
    id_sucursal?: string | null;
    region?: string | null;
    activo?: boolean;
  };
  if (!body.email?.trim() || !body.password?.trim() || !body.rol) {
    return badRequest("Correo, contraseña y rol son requeridos.");
  }
  if (!isUserRole(body.rol)) return badRequest("Rol inválido.");

  const result = await createUsuario(auth.ctx.supabase, {
    email: body.email,
    nombre_completo: body.nombre_completo,
    rol: body.rol,
    password: body.password,
    id_sucursal: body.id_sucursal,
    region: body.region,
    activo: body.activo,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const body = (await request.json()) as {
    id?: string;
    email?: string;
    nombre_completo?: string | null;
    rol?: string;
    password?: string;
    id_sucursal?: string | null;
    region?: string | null;
    activo?: boolean;
  };
  if (!body.id) return badRequest("id es requerido.");
  if (body.id === auth.ctx.user.id) {
    return NextResponse.json(
      { ok: false, message: "No puedes modificar tu propia cuenta desde aquí." },
      { status: 400 },
    );
  }
  if (body.rol && !isUserRole(body.rol)) return badRequest("Rol inválido.");

  const nextRol = body.rol as UserRole | undefined;
  const nextActivo = body.activo;
  const demoting =
    (nextRol && nextRol !== "administrador_general") || nextActivo === false;
  if (demoting) {
    const others = await countActiveGeneralAdmins(auth.ctx.supabase, body.id);
    const { data: target } = await auth.ctx.supabase
      .from("cr_usuarios")
      .select("rol, activo")
      .eq("id", body.id)
      .maybeSingle();
    if (target?.rol === "administrador_general" && target.activo && others === 0) {
      return NextResponse.json(
        { ok: false, message: "Debe quedar al menos un administrador general activo." },
        { status: 400 },
      );
    }
  }

  const result = await updateUsuario(auth.ctx.supabase, body.id, {
    email: body.email,
    nombre_completo: body.nombre_completo,
    rol: nextRol,
    password: body.password,
    id_sucursal: body.id_sucursal,
    region: body.region,
    activo: body.activo,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true, data: result.data });
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const body = (await request.json()) as { id?: string };
  if (!body.id) return badRequest("id es requerido.");
  if (body.id === auth.ctx.user.id) {
    return NextResponse.json(
      { ok: false, message: "No puedes borrar tu propia cuenta." },
      { status: 400 },
    );
  }

  const { data: target } = await auth.ctx.supabase
    .from("cr_usuarios")
    .select("rol, activo")
    .eq("id", body.id)
    .maybeSingle();
  if (target?.rol === "administrador_general" && target.activo) {
    const others = await countActiveGeneralAdmins(auth.ctx.supabase, body.id);
    if (others === 0) {
      return NextResponse.json(
        { ok: false, message: "Debe quedar al menos un administrador general activo." },
        { status: 400 },
      );
    }
  }

  const result = await deleteUsuario(auth.ctx.supabase, body.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
