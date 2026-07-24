"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileText } from "lucide-react";
import CartaForm, { type CartaFormInitial } from "@/components/carta/CartaForm";
import { canEditCartas } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { getCartaById, type CartaWithRelations, generadoPorLabel } from "@/lib/queries/cartas";
import { formatDate, money } from "@/lib/utils";

export default function DetallesCartaPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [carta, setCarta] = useState<CartaWithRelations | null>(null);
  const [initial, setInitial] = useState<CartaFormInitial | null>(null);
  const [notFound, setNotFound] = useState(false);
  const canEdit = user ? canEditCartas(user) : false;

  useEffect(() => {
    if (!user) return;
    getCartaById(id, user).then((row) => {
      if (!row) {
        setNotFound(true);
        return;
      }
      setCarta(row);
      setInitial({
        id: row.id,
        folio: row.folio,
        generadoPor: generadoPorLabel(row),
        createdAt: row.created_at,
        id_sucursal: row.id_sucursal,
        id_responsable: row.id_responsable ?? "",
        items: row.cr_carta_items.map((item) => ({
          id_catalogo: item.id_catalogo,
          codigo: item.codigo,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida,
          precio: item.precio,
        })),
      });
    });
  }, [id, user]);

  if (notFound) {
    return <p className="text-sm text-fg-subtle">No se encontró la carta.</p>;
  }

  if (!carta || !initial) {
    return <p className="text-sm text-fg-subtle">Cargando carta...</p>;
  }

  if (canEdit) {
    return <CartaForm mode="edit" initial={initial} />;
  }

  const ivaPct = Number(carta.cr_sucursales?.iva_porcentaje) || 16;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-md bg-[#0d1117] px-5 py-5 text-white shadow-sm sm:px-7">
        <div className="absolute inset-y-0 right-0 w-40 bg-[linear-gradient(135deg,transparent_45%,rgba(237,28,36,.95)_45%,rgba(237,28,36,.95)_52%,transparent_52%)] opacity-50" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-brand">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-faint">
              Material a bordo
            </p>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-tight">
              Detalles de la carta
            </h2>
            <p className="mt-1 font-mono text-sm text-fg-faint">{carta.folio}</p>
            <p className="mt-3 inline-flex items-center rounded-sm border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-fg-faint">
              <span className="font-semibold text-fg-faint">Generado por:</span>
              <span className="ml-1.5 font-medium text-white">{generadoPorLabel(carta)}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="card-panel grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Sucursal</p>
          <p className="mt-1 text-sm font-semibold text-fg">
            {carta.cr_sucursales?.nombre ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Responsable</p>
          <p className="mt-1 text-sm font-semibold text-fg">{carta.nombre_responsable}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Fecha</p>
          <p className="mt-1 text-sm font-semibold text-fg">{formatDate(carta.created_at)}</p>
        </div>
      </section>

      <section className="card-panel overflow-hidden">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold text-fg">Productos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-fg-subtle">
              <tr>
                <th className="px-4 py-2.5">Código</th>
                <th className="px-4 py-2.5">Descripción</th>
                <th className="px-4 py-2.5 text-right">Cant.</th>
                <th className="px-4 py-2.5 text-right">Precio</th>
                <th className="px-4 py-2.5 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {carta.cr_carta_items.map((item) => (
                <tr key={item.id} className="border-t border-line-subtle">
                  <td className="px-4 py-2.5 font-mono text-xs">{item.codigo}</td>
                  <td className="px-4 py-2.5">{item.descripcion}</td>
                  <td className="px-4 py-2.5 text-right">{item.cantidad}</td>
                  <td className="px-4 py-2.5 text-right">{money(Number(item.precio))}</td>
                  <td className="px-4 py-2.5 text-right">
                    {money(Number(item.cantidad) * Number(item.precio))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line bg-muted/80 px-4 py-3 text-sm sm:px-5">
          <div className="ml-auto grid max-w-xs grid-cols-2 gap-x-6 gap-y-1">
            <span className="text-fg-subtle">Subtotal</span>
            <span className="text-right font-medium">{money(Number(carta.subtotal))}</span>
            <span className="text-fg-subtle">IVA {ivaPct}%</span>
            <span className="text-right font-medium">{money(Number(carta.iva))}</span>
            <span className="font-semibold text-fg">Total</span>
            <span className="text-right font-bold text-fg">{money(Number(carta.total))}</span>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/cartas" className="btn-secondary">Volver al historial</Link>
        <Link href={`/cartas/${id}/pdf`} className="btn-primary">Ver PDF</Link>
      </div>
    </div>
  );
}
