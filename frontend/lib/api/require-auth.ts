import "server-only";

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/server-session";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { CrUsuario } from "@/lib/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthContext = {
  user: CrUsuario;
  supabase: SupabaseClient;
};

export async function requireAuth(): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const user = await getServerSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 }),
    };
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Servidor sin configuración de base de datos." },
        { status: 500 },
      ),
    };
  }

  return { ok: true, ctx: { user, supabase } };
}

export function forbidden(message = "Acceso denegado."): NextResponse {
  return NextResponse.json({ ok: false, message }, { status: 403 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}
