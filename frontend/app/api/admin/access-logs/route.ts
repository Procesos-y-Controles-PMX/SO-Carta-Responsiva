import { NextResponse } from "next/server";
import { isGeneralAdmin } from "@/lib/access";
import { getServerSessionUser } from "@/lib/server-session";
import { fetchSoAccessLogs } from "@/lib/so-access-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getServerSessionUser();
  if (!user || !isGeneralAdmin(user)) {
    return NextResponse.json({ ok: false, message: "Acceso no autorizado." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const daysRaw = parseInt(searchParams.get("days") || "14", 10);
    const result = await fetchSoAccessLogs({
      days: Number.isFinite(daysRaw) ? daysRaw : 14,
      search: searchParams.get("search") || "",
      app: searchParams.get("app") || "todas",
    });
    const status = result.ok ? 200 : 500;
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error("[access-logs]", err);
    return NextResponse.json(
      { ok: false, message: "No se pudieron cargar los logs de acceso." },
      { status: 500 },
    );
  }
}
