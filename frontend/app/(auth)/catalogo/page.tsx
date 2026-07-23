"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, PackagePlus, Pencil, Ruler, Save, Upload, X } from "lucide-react";
import AnimatedSearchInput from "@/components/common/AnimatedSearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import PageHeader from "@/components/ui/PageHeader";
import { canManageMasterData } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { unidadMedidaSelectOptions } from "@/lib/catalogoUnits";
import {
  createCatalogoItem,
  importCatalogoFile,
  listCatalogoBySucursal,
  updateCatalogoItem,
} from "@/lib/queries/catalogo";
import { listSucursales } from "@/lib/queries/sucursales";
import type { CrCatalogoItem, CrSucursal } from "@/lib/types/db";
import { money, parseDecimalInput } from "@/lib/utils";

export default function CatalogoPage() {
  const { user } = useAuth();
  const canEdit = Boolean(user && canManageMasterData(user));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sucursales, setSucursales] = useState<CrSucursal[]>([]);
  const [idSucursal, setIdSucursal] = useState("");
  const [items, setItems] = useState<CrCatalogoItem[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [unidad, setUnidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [activo, setActivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deactivateMissing, setDeactivateMissing] = useState(true);

  const unidadOptions = useMemo(() => unidadMedidaSelectOptions(unidad), [unidad]);
  const editingItem = editingId ? items.find((item) => item.id === editingId) ?? null : null;

  function reload() {
    if (!idSucursal) return;
    listCatalogoBySucursal(idSucursal, search, false).then(setItems);
  }

  function resetForm() {
    setEditingId(null);
    setCodigo("");
    setDescripcion("");
    setUnidad("");
    setPrecio("");
    setActivo(true);
  }

  function startEdit(item: CrCatalogoItem) {
    if (!canEdit) return;
    setEditingId(item.id);
    setCodigo(item.codigo);
    setDescripcion(item.descripcion);
    setUnidad(item.unidad_medida ?? "");
    setPrecio(String(item.precio));
    setActivo(item.activo);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (!user) return;
    listSucursales().then((rows) => {
      setSucursales(rows);
      if (rows[0]) setIdSucursal(rows[0].id);
    });
  }, [user]);

  useEffect(() => {
    if (!idSucursal) return;
    resetForm();
  }, [idSucursal]);

  useEffect(() => {
    if (!idSucursal) return;
    listCatalogoBySucursal(idSucursal, search, false).then(setItems);
  }, [idSucursal, search]);

  if (!user) {
    return <p className="text-sm text-slate-500">Inicia sesión para consultar el catálogo.</p>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    const precioNum = parseDecimalInput(precio);
    if (!idSucursal || !codigo.trim() || !descripcion.trim() || precioNum === null) {
      toast.error("Completa código, descripción y precio.");
      return;
    }
    if (!unidad) {
      toast.error("Selecciona una unidad de medida.");
      return;
    }

    setLoading(true);
    if (editingId) {
      const updated = await updateCatalogoItem(editingId, {
        codigo,
        descripcion,
        unidad_medida: unidad,
        precio: precioNum,
        activo,
      });
      setLoading(false);
      if (!updated) {
        toast.error("No se pudo actualizar (¿código duplicado?).");
        return;
      }
      toast.success(`${updated.codigo} actualizado.`);
      resetForm();
      reload();
      return;
    }

    const created = await createCatalogoItem({
      id_sucursal: idSucursal,
      codigo,
      descripcion,
      unidad_medida: unidad,
      precio: precioNum,
    });
    setLoading(false);
    if (!created) {
      toast.error("No se pudo agregar el código (¿duplicado?).");
      return;
    }
    toast.success(`${created.codigo} agregado al catálogo.`);
    resetForm();
    reload();
  }

  async function handleToggleActivo(item: CrCatalogoItem) {
    if (!canEdit) return;
    const updated = await updateCatalogoItem(item.id, {
      codigo: item.codigo,
      descripcion: item.descripcion,
      unidad_medida: item.unidad_medida,
      precio: Number(item.precio),
      activo: !item.activo,
    });
    if (!updated) {
      toast.error("No se pudo actualizar el estado.");
      return;
    }
    toast.success(`${updated.codigo} ahora está ${updated.activo ? "activo" : "inactivo"}.`);
    if (editingId === item.id) setActivo(updated.activo);
    reload();
  }

  async function handleImport(file: File | null) {
    if (!canEdit || !file) return;
    setImporting(true);
    const result = await importCatalogoFile(file, deactivateMissing);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    const { data } = result;
    toast.success(
      `Catálogo: ${data.created} nuevos · ${data.updated} actualizados` +
        (data.reactivated ? ` · ${data.reactivated} reactivados` : "") +
        (data.deactivated ? ` · ${data.deactivated} desactivados` : "") +
        ` · ${data.branches} sucursales.`,
    );
    if (data.duplicatesCollapsed > 0) {
      toast.message(
        `${data.duplicatesCollapsed} filas duplicadas en el archivo (mismo Centro+SKU); se usó la última.`,
      );
    }
    if (data.skippedCentros.length > 0) {
      toast.message(
        `Centros sin sucursal mapeada: ${data.skippedCentros.slice(0, 8).join(", ")}${
          data.skippedCentros.length > 8 ? "…" : ""
        }`,
      );
    }
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={canEdit ? "Administración" : "Consulta"}
        title="Catálogo por sucursal"
        subtitle={
          canEdit
            ? "Edita códigos o sube un archivo de inventario para reemplazar el catálogo."
            : "Consulta los productos disponibles por sucursal."
        }
      />

      <div className="card-panel p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sucursal
            </label>
            <FilterSelect
              value={idSucursal}
              onChange={setIdSucursal}
              icon={MapPin}
              searchable="auto"
              options={sucursales.map((sucursal) => ({
                value: sucursal.id,
                label: `${sucursal.nombre}${sucursal.codigo_sap ? ` / ${sucursal.codigo_sap}` : ""}`,
              }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Buscar
            </label>
            <AnimatedSearchInput
              placeholder="Código o descripción..."
              value={search}
              onChange={setSearch}
            />
          </div>
        </div>
      </div>

      {canEdit ? (
        <div className="card-panel space-y-4 p-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Reemplazar catálogo desde archivo</h3>
            <p className="mt-1 text-xs text-slate-500">
              Export SAP (TSV/CSV/.XLS) con columnas Centro, SKU, Material, UMB y Precio. Por cada
              sucursal (Centro) + código (SKU): si ya existe se actualiza precio/descripción/U.M. y
              se reactiva; si es nuevo se crea. Filas repetidas en el archivo se colapsan (gana la
              última). Otras sucursales no tocadas no se modifican.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              checked={deactivateMissing}
              onChange={(e) => setDeactivateMissing(e.target.checked)}
            />
            En sucursales del archivo, desactivar códigos que no vengan en esta carga
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.csv,.tsv,.txt,text/csv,text/tab-separated-values"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="btn-primary gap-2"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {importing ? "Importando..." : "Subir archivo de productos"}
            </button>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <form onSubmit={handleSubmit} className="card-panel space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingItem ? `Editar ${editingItem.codigo}` : "Agregar código"}
            </h3>
            {editingItem ? (
              <button type="button" className="btn-secondary gap-1.5 text-xs" onClick={resetForm}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Cancelar edición
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className="input-field"
              placeholder="Código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
            />
            <input
              className="input-field sm:col-span-2 lg:col-span-2"
              placeholder="Descripción"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
            />
            <FilterSelect
              value={unidad}
              onChange={setUnidad}
              icon={Ruler}
              searchable="auto"
              placeholder="U.M."
              options={unidadOptions}
            />
            <input
              className="input-field"
              placeholder="Precio"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
            />
            {editingItem ? (
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                />
                Activo en el catálogo de la sucursal
              </label>
            ) : null}
          </div>
          <button type="submit" className="btn-primary w-full gap-2 sm:w-auto" disabled={loading}>
            {editingItem ? (
              <Save className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
            )}
            {loading
              ? "Guardando..."
              : editingItem
                ? "Guardar cambios"
                : "Agregar al catálogo"}
          </button>
        </form>
      ) : null}

      <div className="card-panel overflow-hidden">
        <div className="divide-y divide-slate-100 md:hidden">
          {items.map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.descripcion}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {item.codigo} · {item.unidad_medida ?? "Sin U.M."}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                    item.activo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              <p className="mt-3 text-right text-base font-bold text-slate-900">{money(item.precio)}</p>
              {canEdit ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary min-h-11 flex-1 gap-1.5"
                    onClick={() => startEdit(item)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary min-h-11 flex-1"
                    onClick={() => handleToggleActivo(item)}
                  >
                    {item.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">U.M.</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Estado</th>
              {canEdit ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`border-t border-slate-100 ${editingId === item.id ? "bg-red-50/40" : ""}`}
              >
                <td className="px-4 py-3 font-mono text-xs">{item.codigo}</td>
                <td className="px-4 py-3">{item.descripcion}</td>
                <td className="px-4 py-3">{item.unidad_medida ?? "—"}</td>
                <td className="px-4 py-3">{money(item.precio)}</td>
                <td className="px-4 py-3">{item.activo ? "Activo" : "Inactivo"}</td>
                {canEdit ? (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="mr-3 text-xs font-semibold text-slate-600 hover:underline"
                      onClick={() => startEdit(item)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand hover:underline"
                      onClick={() => handleToggleActivo(item)}
                    >
                      {item.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
