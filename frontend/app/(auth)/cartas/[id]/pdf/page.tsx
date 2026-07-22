"use client";


import { Terminal, TypingAnimation, AnimatedSpan } from "@promexma/ui";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

import { canDeleteCartas } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { deleteCarta, getCartaById, type CartaWithRelations, generadoPorLabel } from "@/lib/queries/cartas";
import { cartaPdfFilename } from "@/lib/pdf/cartaPdf";

export default function CartaPdfPreviewPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const [carta, setCarta] = useState<CartaWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCartaById(id, user).then(setCarta);
  }, [id, user]);

  async function handleDelete() {
    if (!user || !carta || !canDeleteCartas(user) || deleting) return;
    const confirmed = window.confirm(
      `¿Eliminar la carta ${carta.folio}? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    const ok = await deleteCarta(carta.id);
    setDeleting(false);
    if (!ok) {
      toast.error("No se pudo eliminar la carta.");
      return;
    }
    toast.success(`Carta ${carta.folio} eliminada.`);
    router.push("/cartas");
  }

  if (!carta) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <Terminal className="mx-auto">
          <TypingAnimation className="text-emerald-400">
            {"> Generando carta responsiva…"}
          </TypingAnimation>
          <AnimatedSpan className="text-slate-300">
            Cargando datos del responsable
          </AnimatedSpan>
          <AnimatedSpan className="text-slate-300">
            Componiendo documento PDF
          </AnimatedSpan>
          <AnimatedSpan className="text-slate-300">
            Aplicando formato Promexma
          </AnimatedSpan>
          <TypingAnimation className="text-slate-500">
            Preparando vista previa…
          </TypingAnimation>
        </Terminal>
      </div>
    );
  }

  const pdfUrl = `/cartas/${id}/pdf/document`;
  const filename = cartaPdfFilename(carta.folio);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Documento generado"
        title={`Carta ${carta.folio}`}
        subtitle={`${carta.nombre_responsable} · ${carta.cr_sucursales?.nombre} · Generado por: ${generadoPorLabel(carta)}`}
        actions={
          <>
          {user && canDeleteCartas(user) ? (
            <button
              type="button"
              className="btn-danger gap-2"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
          ) : null}
          <Link href={`/cartas/${id}`} className="btn-secondary gap-2">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Detalles
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
