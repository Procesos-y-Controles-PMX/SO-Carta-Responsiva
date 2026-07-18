import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { createSupabaseServerClient, missingSupabaseServerEnv } from "@/lib/supabase-server";
import { attachServerSession } from "@/lib/server-session";
import type { CrUsuario } from "@/lib/types/db";

type LoginCandidate = CrUsuario & {
  password_hash?: string | null;
  /** Temporary compatibility for databases not yet migrated. */
  password?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = normalizeEmail(body.email ?? "");
    const password = (body.password ?? "").trim();

    if (!email || !password) {
      return NextResponse.json({ ok: false, message: "Credenciales requeridas." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    if (!supabase) {
      const missing = missingSupabaseServerEnv();
      return NextResponse.json(
        {
          ok: false,
          message:
            missing.length > 0
              ? `Faltan variables en el servidor: ${missing.join(", ")}.`
              : "Servidor sin configuración de base de datos.",
        },
        { status: 500 }
      );
    }

    const { data: candidates, error } = await supabase
      .from("cr_usuarios")
      .select("*")
      .ilike("email", email);

    if (error) {
      console.error("Login query error:", error.message);
      return NextResponse.json(
        { ok: false, message: "Credenciales inválidas o usuario inactivo." },
        { status: 401 }
      );
    }

    let data: LoginCandidate | undefined;
    for (const row of (candidates ?? []) as LoginCandidate[]) {
      const hashMatches =
        typeof row.password_hash === "string" &&
        (await compare(password, row.password_hash));
      const legacyMatches =
        !row.password_hash &&
        process.env.NODE_ENV !== "production" &&
        String(row.password ?? "").trim() === password;
      if (row.activo === true && (hashMatches || legacyMatches)) {
        data = row;
        break;
      }
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, message: "Credenciales inválidas o usuario inactivo." },
        { status: 401 }
      );
    }

    const {
      password_hash: _passwordHash,
      password: _legacyPassword,
      ...user
    } = data;
    const adminUser = {
      ...(user as CrUsuario),
      rol: "admin" as const,
      nombre_completo: null,
    };
    const response = NextResponse.json({ ok: true, user: adminUser });
    await attachServerSession(response, adminUser);
    return response;
  } catch (err) {
    console.error("Login route error:", err);
    return NextResponse.json({ ok: false, message: "Error al iniciar sesión." }, { status: 500 });
  }
}
