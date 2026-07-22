"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, FilePlus2, FileText } from "lucide-react";
import { canDeleteCartas, canGenerateCartas } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { deleteCarta, listCartas, type CartaWithRelations, generadoPorLabel } from "@/lib/queries/cartas";
import { formatDate } from "@/lib/utils";

export default function CartasHistorialPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CartaWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const canGenerate = user ? canGenerateCartas(user) : false;
  const canDelete = user ? canDeleteCartas(user) : false;

  useEffect(() => {
    if (!user) return;
    listCartas(user).then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, [user]);

  async function handleDelete(row: CartaWithRelations) {
    if (!canDelete || deletingId) return;
    const confirmed = window.confirm(
      `¿Eliminar la carta ${row.folio}? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    const ok = await deleteCarta(row.id);
    setDeletingId(null);
    if (!ok) {
      toast.error("No se pudo eliminar la carta.");
      return;
    }
    setRows((prev) => prev.filter((item) => item.id !== row.id));
    toast.success(`Carta ${row.folio} eliminada.`);
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-md bg-[#111923] px-6 py-7 text-white shadow-sm sm:px-8">
        <div className="absolute inset-y-0 right-0 w-52 bg-[linear-gradient(135deg,transparent_40%,rgba(237,28,36,.9)_40%,rgba(237,28,36,.9)_47%,transparent_47%)] opacity-50" />
        <div className="relative max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand">
            Mercancía Abordo
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold uppercase tracking-tight sm:text-4xl">
            Control de cartas responsivas
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
            Registra la salida de material, genera el documento para firma y conserva cada folio
            en un solo lugar.
          </p>
        </div>
      </section>

      {canGenerate ? (
        <Link
          href="/cartas/nueva"
          className="group card-panel flex max-w-xl items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-brand text-white">
            <FilePlus2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
              Acción principal
            </p>
            <h3 className="font-display text-xl font-semibold text-slate-900">Generar carta</h3>
            <p className="text-xs text-slate-500">Selecciona responsable, productos y cantidades.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-brand" />
        </Link>
      ) : null}

      <section className="card-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Registro automático
            </p>
            <h3 className="font-display text-lg font-semibold text-slate-900">Cartas recientes</h3>
          </div>
          <FileText className="h-5 w-5 text-slate-300" aria-hidden="true" />
        </div>
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Cargando...</p>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">Aún no hay cartas registradas</p>
            <p className="mt-1 text-xs text-slate-500">La primera aparecerá aquí al generar su PDF.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((row) => {
                const actionCols = 2 + (canDelete ? 1 : 0);
                return (
                <article key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] font-semibold text-brand">{row.folio}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{row.nombre_responsable}</p>
                      <p className="text-xs text-slate-500">{row.cr_sucursales?.nombre ?? "Sin sucursal"} · {formatDate(row.created_at)}</p>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-600">Generado por:</span>{" "}
                        {generadoPorLabel(row)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      {row.cr_carta_items.length} productos
                    </span>
                  </div>
                  <div
                    className={`mt-3 grid gap-2 ${
                      actionCols >= 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"
                    }`}
                  >
                    <Link href={`/cartas/${row.id}`} className="btn-secondary min-h-11">Detalles</Link>
                    <Link href={`/cartas/${row.id}/pdf`} className="btn-primary min-h-11">Ver PDF</Link>
                    {canDelete ? (
                      <button
                        type="button"
                        className="btn-danger min-h-11"
                        disabled={deletingId === row.id}
                        onClick={() => handleDelete(row)}
                      >
                        {deletingId === row.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    ) : null}
                  </div>
                </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3">Generado por</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Productos</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{row.folio}</td>
                    <td className="px-4 py-3">{row.cr_sucursales?.nombre ?? "—"}</td>
                    <td className="px-4 py-3">{row.nombre_responsable}</td>
                    <td className="px-4 py-3 text-slate-600">{generadoPorLabel(row)}</td>
                    <td className="px-4 py-3">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3">{row.cr_carta_items.length}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/cartas/${row.id}/pdf`}
                        className="mr-3 text-xs font-semibold text-brand hover:underline"
                      >
                        PDF
                      </Link>
                      <Link
                        href={`/cartas/${row.id}`}
                        className="mr-3 text-xs font-semibold text-slate-600 hover:underline"
                      >
                        Detalles
                      </Link>
                      {canDelete ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
                          disabled={deletingId === row.id}
                          onClick={() => handleDelete(row)}
                        >
                          {deletingId === row.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
