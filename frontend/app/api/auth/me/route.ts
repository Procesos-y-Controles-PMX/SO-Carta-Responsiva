import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/server-session";

export async function GET() {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user });
}
