"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, MapPin, PackageOpen, Plus, Trash2, UserRound } from "lucide-react";
import AnimatedSearchInput from "@/components/common/AnimatedSearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import { useAuth, userCanAccessSucursal } from "@/lib/auth";
import { listCatalogoBySucursal } from "@/lib/queries/catalogo";
import { createCarta, updateCarta } from "@/lib/queries/cartas";
import { listResponsablesBySucursal } from "@/lib/queries/responsables";
import { listSucursales } from "@/lib/queries/sucursales";
import type { CartaLineInput, CrCatalogoItem, CrResponsable, CrSucursal } from "@/lib/types/db";
import {
  money,
  parseDecimalInput,
  QUANTITY_INPUT_DRAFT_RE,
  roundQuantity,
} from "@/lib/utils";

export type CartaFormInitial = {
  id?: string;
  id_sucursal: string;
  id_responsable: string;
  items: CartaLineInput[];
};

type Props = {
  mode: "create" | "edit";
  initial?: CartaFormInitial;
};

type DraftLine = CartaLineInput & { key: string };

function emptyLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    id_catalogo: null,
    codigo: "",
    descripcion: "",
    cantidad: 0,
    unidad_medida: null,
    precio: 0,
  };
}

export default function CartaForm({ mode, initial }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [sucursales, setSucursales] = useState<CrSucursal[]>([]);
  const [responsables, setResponsables] = useState<CrResponsable[]>([]);
  const [catalogo, setCatalogo] = useState<CrCatalogoItem[]>([]);
  const [idSucursal, setIdSucursal] = useState(initial?.id_sucursal ?? "");
  const [idResponsable, setIdResponsable] = useState(initial?.id_responsable ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    initial?.items.map((item) => ({ ...item, key: crypto.randomUUID() })) ?? [emptyLine()]
  );
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listSucursales().then((rows) => {
      const scoped =
        user?.rol === "operador" && user.id_sucursal
          ? rows.filter((s) => s.id === user.id_sucursal)
          : rows;
      setSucursales(scoped);
      if (!idSucursal && scoped[0]) setIdSucursal(scoped[0].id);
    });
  }, [user, idSucursal]);

  useEffect(() => {
    if (!idSucursal) return;
    listResponsablesBySucursal(idSucursal).then(setResponsables);
    listCatalogoBySucursal(idSucursal, productSearch).then(setCatalogo);
  }, [idSucursal, productSearch]);

  const selectedSucursal = useMemo(
    () => sucursales.find((s) => s.id === idSucursal) ?? null,
    [sucursales, idSucursal]
  );

  const validLines = lines.filter(
    (line) => line.codigo.trim() && line.descripcion.trim() && line.cantidad > 0
  );

  const subtotal = validLines.reduce((sum, line) => sum + line.cantidad * line.precio, 0);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  function addProductFromCatalog(item: CrCatalogoItem) {
    setLines((prev) => {
      const existing = prev.find((line) => line.id_catalogo === item.id);
      if (existing) {
        return prev.map((line) =>
          line.id_catalogo === item.id
            ? { ...line, cantidad: roundQuantity(line.cantidad + 1) }
            : line
        );
      }
      return [
        ...prev.filter((line) => line.codigo.trim() || line.descripcion.trim()),
        {
          key: crypto.randomUUID(),
          id_catalogo: item.id,
          codigo: item.codigo,
          descripcion: item.descripcion,
          cantidad: 1,
          unidad_medida: item.unidad_medida,
          precio: item.precio,
        },
      ];
    });
    toast.success(`${item.codigo} agregado`);
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function updateQuantity(key: string, raw: string) {
    if (!QUANTITY_INPUT_DRAFT_RE.test(raw)) return;
    const parsed = parseDecimalInput(raw);
    updateLine(key, { cantidad: parsed !== null ? roundQuantity(parsed) : 0 });
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  }

  async function handleSubmit() {
    if (!user) return;
    if (!idSucursal || !idResponsable) {
      toast.error("Selecciona sucursal y responsable.");
      return;
    }
    if (!userCanAccessSucursal(user, idSucursal)) {
      toast.error("No tienes acceso a esta sucursal.");
      return;
    }
    if (validLines.length === 0) {
      toast.error("Agrega al menos un producto con cantidad.");
      return;
    }

    const responsable = responsables.find((r) => r.id === idResponsable);
    if (!responsable) {
      toast.error("Responsable no válido.");
      return;
    }
    if (!selectedSucursal) {
      toast.error("Sucursal no válida.");
      return;
    }

    setSaving(true);
    const items: CartaLineInput[] = validLines.map(({ key: _k, ...line }) => line);

    if (mode === "create") {
      const carta = await createCarta({
        id_sucursal: idSucursal,
        id_responsable: idResponsable,
        nombre_responsable: responsable.nombre,
        id_usuario: user.id,
        prefijo_folio: selectedSucursal.prefijo_folio,
        items,
      });
      setSaving(false);
      if (!carta) {
        toast.error("No se pudo generar la carta.");
        return;
      }
      toast.success(`Carta ${carta.folio} registrada automáticamente.`);
      try {
        const emailResponse = await fetch(`/api/cartas/${carta.id}/email`, {
          method: "POST",
        });
        const emailResult = (await emailResponse.json()) as {
          sent?: boolean;
          message?: string;
        };
        if (emailResult.sent) {
          toast.success("PDF enviado por correo.");
        } else if (emailResult.message) {
          toast.info(emailResult.message);
        }
      } catch {
        toast.info("Carta registrada. El correo se podrá reenviar después.");
      }
      router.push(`/cartas/${carta.id}/pdf`);
      return;
    }

    if (!initial?.id) {
      setSaving(false);
      return;
    }

    const carta = await updateCarta(initial.id, {
      id_responsable: idResponsable,
      nombre_responsable: responsable.nombre,
      items,
    });
    setSaving(false);
    if (!carta) {
      toast.error("No se pudo actualizar la carta.");
      return;
    }
    toast.success("Carta actualizada.");
    router.push(`/cartas/${carta.id}`);
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-md bg-[#111923] px-5 py-5 text-white shadow-sm sm:px-7">
        <div className="absolute inset-y-0 right-0 w-40 bg-[linear-gradient(135deg,transparent_45%,rgba(237,28,36,.95)_45%,rgba(237,28,36,.95)_52%,transparent_52%)] opacity-50" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-brand">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Mercancía Abordo
            </p>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-tight">
              {mode === "create" ? "Generar carta" : "Editar carta"}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Selecciona al responsable y el material que saldrá de la sucursal.
              El folio y el registro se crean automáticamente.
            </p>
          </div>
        </div>
      </section>

      <section className="card-panel p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Sucursal
            </span>
            <FilterSelect
              value={idSucursal}
              disabled={mode === "edit" || (user?.rol === "operador" && !!user.id_sucursal)}
              icon={MapPin}
              searchable="auto"
              placeholder="Seleccionar sucursal..."
              options={sucursales.map((sucursal) => ({
                value: sucursal.id,
                label: `${sucursal.nombre}${sucursal.codigo_sap ? ` / ${sucursal.codigo_sap}` : ""}`,
              }))}
              onChange={(value) => {
                setIdSucursal(value);
                setIdResponsable("");
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Responsable que recibe el material
            </span>
            <FilterSelect
              value={idResponsable}
              onChange={setIdResponsable}
              icon={UserRound}
              searchable="auto"
              placeholder="Seleccionar responsable..."
              options={responsables.map((responsable) => ({
                value: responsable.id,
                label: responsable.nombre,
              }))}
            />
          </label>
        </div>
      </section>

      <div className="grid min-h-[540px] gap-5 xl:grid-cols-[minmax(320px,0.78fr)_minmax(560px,1.5fr)]">
        <section className="card-panel flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
              Inventario de sucursal
            </p>
            <h3 className="mt-0.5 font-display text-lg font-semibold text-slate-900">
              Buscar material
            </h3>
            <div className="mt-3">
              <AnimatedSearchInput
                value={productSearch}
                onChange={setProductSearch}
                placeholder="SKU o descripción..."
              />
            </div>
          </div>

          <div className="max-h-[520px] flex-1 overflow-y-auto">
            {catalogo.map((item) => (
              <article
                key={item.id}
                className="group border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800">
                      {item.descripcion}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono text-[11px]">{item.codigo}</span>
                      <span>{item.unidad_medida ?? "Sin U.M."}</span>
                      <span className="font-medium text-slate-700">{money(item.precio)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-white text-brand shadow-sm transition-all hover:border-brand hover:bg-brand hover:text-white"
                    onClick={() => addProductFromCatalog(item)}
                    aria-label={`Agregar ${item.descripcion}`}
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
            {catalogo.length === 0 && (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <PackageOpen className="h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-700">No encontramos materiales</p>
                <p className="mt-1 text-xs text-slate-500">
                  {user?.rol === "admin" ? (
                    <Link href="/catalogo" className="font-semibold text-brand hover:underline">
                      Agregar un código al catálogo
                    </Link>
                  ) : (
                    "Solicita el código a administración."
                  )}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="card-panel flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#343d48] px-4 py-3 text-white">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                Salida de material
              </p>
              <h3 className="font-display text-lg font-semibold">Productos seleccionados</h3>
            </div>
            <span className="rounded-sm bg-white/10 px-2.5 py-1 font-mono text-xs">
              {validLines.length} {validLines.length === 1 ? "partida" : "partidas"}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {lines.some((line) => line.codigo) ? (
              <>
                <div className="divide-y divide-slate-100 md:hidden">
                  {lines.filter((line) => line.codigo).map((line) => (
                    <article key={line.key} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug text-slate-800">{line.descripcion}</p>
                          <p className="mt-1 font-mono text-[11px] text-slate-500">
                            {line.codigo} · {line.unidad_medida ?? "Sin U.M."}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-slate-400 active:bg-red-50 active:text-red-600"
                          onClick={() => removeLine(line.key)}
                          aria-label={`Quitar ${line.descripcion}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
                        <label>
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cantidad</span>
                          <input
                            aria-label={`Cantidad de ${line.descripcion}`}
                            inputMode="decimal"
                            className="input-field min-h-11 text-right font-mono"
                            value={line.cantidad > 0 ? String(line.cantidad) : ""}
                            onChange={(event) => updateQuantity(line.key, event.target.value)}
                          />
                        </label>
                        <div className="pb-1 text-right">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400">{money(line.precio)} c/u</p>
                          <p className="text-base font-bold text-slate-900">{money(line.cantidad * line.precio)}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <table className="hidden w-full min-w-[650px] text-left text-sm md:table">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Producto</th>
                    <th className="px-3 py-2.5">SKU / U.M.</th>
                    <th className="px-3 py-2.5">Cantidad</th>
                    <th className="px-3 py-2.5 text-right">Costo</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {lines.filter((line) => line.codigo).map((line) => (
                    <tr key={line.key} className="border-b border-slate-100 align-middle">
                      <td className="max-w-[230px] px-4 py-3 font-medium text-slate-800">
                        {line.descripcion}
                      </td>
                      <td className="px-3 py-3">
                        <span className="block font-mono text-[11px] text-slate-600">{line.codigo}</span>
                        <span className="text-[11px] text-slate-400">{line.unidad_medida ?? "—"}</span>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Cantidad de ${line.descripcion}`}
                          inputMode="decimal"
                          className="input-field w-24 py-2 text-right font-mono"
                          value={line.cantidad > 0 ? String(line.cantidad) : ""}
                          onChange={(event) => updateQuantity(line.key, event.target.value)}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-600">
                        {money(line.precio)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900">
                        {money(line.cantidad * line.precio)}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          className="rounded-sm p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          onClick={() => removeLine(line.key)}
                          aria-label={`Quitar ${line.descripcion}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </>
            ) : (
              <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <PackageOpen className="h-6 w-6 text-slate-400" aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">La carta está vacía</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                  Busca un SKU en el catálogo y usa el botón + para agregarlo a la salida.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
            <div className="ml-auto grid max-w-sm grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-right font-medium text-slate-800">{money(subtotal)}</span>
              <span className="text-slate-500">IVA 16%</span>
              <span className="text-right font-medium text-slate-800">{money(iva)}</span>
              <span className="border-t border-slate-300 pt-2 font-semibold text-slate-900">Total</span>
              <span className="border-t border-slate-300 pt-2 text-right text-lg font-bold text-slate-900">
                {money(total)}
              </span>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link href="/cartas" className="btn-secondary">Cancelar</Link>
              <button
                type="button"
                className="btn-primary gap-2"
                disabled={saving}
                onClick={handleSubmit}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                {saving
                  ? "Generando..."
                  : mode === "create"
                    ? "Generar carta y PDF"
                    : "Guardar y actualizar PDF"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
