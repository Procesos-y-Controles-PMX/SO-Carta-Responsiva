import { NextResponse } from "next/server";
import { cartaPdfFilename, renderCartaPdfBuffer } from "@/lib/pdf/cartaPdf";
import type { CartaWithRelations } from "@/lib/queries/cartas";
import { getServerSessionUser } from "@/lib/server-session";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = { params: Promise<{ id: string }> };

const CARTA_SELECT = `
  *,
  cr_sucursales(nombre, codigo_sap, prefijo_folio, region),
  cr_usuarios(email, nombre_completo),
  cr_carta_items(*)
`;

export async function POST(request: Request, context: RouteContext) {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Servidor sin configuración de base de datos." },
      { status: 500 }
    );
  }

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("cr_cartas")
    .select(CARTA_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Carta no encontrada." }, { status: 404 });
  }

  const carta = data as CartaWithRelations;
  if (
    user.rol !== "admin" &&
    (carta.id_usuario !== user.id || carta.id_sucursal !== user.id_sucursal)
  ) {
    return NextResponse.json({ ok: false, message: "Acceso denegado." }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CARTA_EMAIL_FROM?.trim();
  const configuredRecipients = (process.env.CARTA_EMAIL_RECIPIENTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!apiKey || !from) {
    return NextResponse.json({
      ok: true,
      sent: false,
      message: "Carta registrada. El correo no está configurado.",
    });
  }

  const creatorEmail = carta.cr_usuarios?.email?.trim();
  const recipients = [...new Set([creatorEmail, ...configuredRecipients].filter(Boolean))] as string[];
  if (recipients.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: false,
      message: "Carta registrada. No hay destinatarios configurados.",
    });
  }

  try {
    const origin = new URL(request.url).origin;
    const pdf = await renderCartaPdfBuffer(carta, origin);
    const filename = `CARTA-${carta.folio}.pdf`;
    const date = new Date(carta.created_at).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: `CARTA RESPONSIVA ${carta.folio}`,
        text: `Se adjunta la carta responsiva generada el ${date} con el folio ${carta.folio}.`,
        attachments: [
          {
            filename: filename || cartaPdfFilename(carta.folio),
            content: pdf.toString("base64"),
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      await supabase
        .from("cr_cartas")
        .update({ email_error: detail.slice(0, 1000) })
        .eq("id", carta.id);
      return NextResponse.json(
        {
          ok: false,
          sent: false,
          message: "La carta se registró, pero no se pudo enviar el correo.",
        },
        { status: 502 }
      );
    }

    await supabase
      .from("cr_cartas")
      .update({
        email_enviado: true,
        email_enviado_at: new Date().toISOString(),
        email_error: null,
      })
      .eq("id", carta.id);

    return NextResponse.json({ ok: true, sent: true });
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : "Error desconocido";
    await supabase
      .from("cr_cartas")
      .update({ email_error: message.slice(0, 1000) })
      .eq("id", carta.id);
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        message: "La carta se registró, pero no se pudo enviar el correo.",
      },
      { status: 500 }
    );
  }
}
