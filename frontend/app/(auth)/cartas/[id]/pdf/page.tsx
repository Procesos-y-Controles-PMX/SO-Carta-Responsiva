"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, ExternalLink, Pencil } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { getCartaById, type CartaWithRelations } from "@/lib/queries/cartas";
import { cartaPdfFilename } from "@/lib/pdf/cartaPdf";

export default function CartaPdfPreviewPage() {
  const params = useParams();
  const id = params.id as string;
  const [carta, setCarta] = useState<CartaWithRelations | null>(null);

  useEffect(() => {
    getCartaById(id).then(setCarta);
  }, [id]);

  if (!carta) {
    return <p className="text-sm text-slate-500">Cargando PDF...</p>;
  }

  const pdfUrl = `/cartas/${id}/pdf/document`;
  const filename = cartaPdfFilename(carta.folio);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Documento generado"
        title={`Carta ${carta.folio}`}
        subtitle={`${carta.nombre_responsable} · ${carta.cr_sucursales?.nombre}`}
        actions={
          <>
          <Link href={`/cartas/${id}`} className="btn-secondary gap-2">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar carta
          </Link>
          <a href={`${pdfUrl}?download=1`} download={filename} className="btn-primary gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            Descargar PDF
          </a>
          </>
        }
      />

      <div className="card-panel p-4 text-center md:hidden">
        <p className="text-sm font-semibold text-slate-800">El PDF está listo</p>
        <p className="mt-1 text-xs text-slate-500">Ábrelo en una pestaña para verlo con mayor claridad en tu teléfono.</p>
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary mt-4 w-full gap-2">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Abrir PDF
        </a>
      </div>

      <div className="card-panel hidden overflow-hidden md:block">
        <iframe
          title={`Vista previa ${carta.folio}`}
          src={pdfUrl}
          className="h-[80vh] w-full border-0"
        />
      </div>
    </div>
  );
}
