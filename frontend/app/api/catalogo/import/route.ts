import { NextResponse } from "next/server";
import { canManageMasterData } from "@/lib/access";
import { badRequest, forbidden, requireAuth } from "@/lib/api/require-auth";
import { parseInventoryFile } from "@/lib/catalogo/parse-inventory";
import { replaceCatalogFromImport } from "@/lib/server/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!canManageMasterData(auth.ctx.user)) return forbidden();

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return badRequest("Selecciona un archivo de inventario.");
  }

  const deactivateMissing = form.get("deactivateMissing") === "1";

  try {
    const { items, skipped } = await parseInventoryFile(file);
    if (items.length === 0) {
      return badRequest("No se encontraron productos válidos en el archivo.");
    }

    const result = await replaceCatalogFromImport(auth.ctx.supabase, items, {
      deactivateMissing,
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...result,
        parsed: items.length,
        skippedRows: skipped,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo importar el archivo.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
