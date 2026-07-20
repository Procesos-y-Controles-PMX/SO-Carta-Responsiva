import { NextResponse } from "next/server";
import { canViewCompliance } from "@/lib/access";
import { badRequest, forbidden, requireAuth } from "@/lib/api/require-auth";
import { getComplianceReport } from "@/lib/server/queries";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canViewCompliance(auth.ctx.user)) return forbidden();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return badRequest("Parámetros from y to son requeridos.");

  const rows = await getComplianceReport(auth.ctx.supabase, auth.ctx.user, from, to);
  return NextResponse.json({ ok: true, data: rows });
}
