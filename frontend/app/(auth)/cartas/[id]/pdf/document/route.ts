import { NextResponse } from "next/server";
import { CARTA_SELECT, type CartaWithRelations } from "@/lib/queries/cartas";
import {
  cartaPdfDisposition,
  cartaPdfFilename,
  renderCartaPdfBuffer,
} from "@/lib/pdf/cartaPdf";
import { getServerSessionUser } from "@/lib/server-session";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ message: "Servidor no configurado." }, { status: 500 });
  }

  const { id } = await context.params;
  const { data } = await supabase
    .from("cr_cartas")
    .select(CARTA_SELECT)
    .eq("id", id)
    .single();
  const carta = data as CartaWithRelations | null;

  if (!carta) {
    return NextResponse.json({ message: "Carta no encontrada." }, { status: 404 });
  }
  if (
    user.rol !== "admin" &&
    (carta.id_usuario !== user.id || carta.id_sucursal !== user.id_sucursal)
  ) {
    return NextResponse.json({ message: "Acceso denegado." }, { status: 403 });
  }

  try {
    const origin = new URL(request.url).origin;
    const buffer = await renderCartaPdfBuffer(carta, origin);
    const filename = cartaPdfFilename(carta.folio);
    const download = new URL(request.url).searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": cartaPdfDisposition(filename, !download),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("PDF render error:", err);
    return NextResponse.json({ message: "Error al generar PDF." }, { status: 500 });
  }
}
