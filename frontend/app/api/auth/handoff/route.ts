import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { normalizeAccessUser } from "@/lib/access";
import { attachServerSession } from "@/lib/server-session";
import type { CrUsuario } from "@/lib/types/db";

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token?: string };
    if (!token) {
      return NextResponse.json({ ok: false, message: "Token requerido." }, { status: 400 });
    }

    const secret = (process.env.PORTAL_HANDOFF_SECRET ?? "").trim();
    if (!secret) {
      return NextResponse.json(
        { ok: false, message: "Handoff no configurado en el servidor." },
        { status: 500 }
      );
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "so-portal",
    });

    if (payload.app !== "carta-responsiva") {
      return NextResponse.json({ ok: false, message: "Token de otra aplicación." }, { status: 401 });
    }

    const rawUser = (payload.session as { user?: CrUsuario } | undefined)?.user;
    if (!rawUser?.id || !rawUser?.email) {
      return NextResponse.json({ ok: false, message: "Token inválido." }, { status: 401 });
    }

    const user = normalizeAccessUser(rawUser);
    const response = NextResponse.json({ ok: true, user });
    await attachServerSession(response, user);
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Token inválido o expirado. Inicia sesión de nuevo." },
      { status: 401 }
    );
  }
}
