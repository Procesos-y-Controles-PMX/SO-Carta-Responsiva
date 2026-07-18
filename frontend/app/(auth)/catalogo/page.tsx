"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, PackagePlus } from "lucide-react";
import AnimatedSearchInput from "@/components/common/AnimatedSearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { createCatalogoItem, listCatalogoBySucursal } from "@/lib/queries/catalogo";
import { listSucursales } from "@/lib/queries/sucursales";
import type { CrCatalogoItem, CrSucursal } from "@/lib/types/db";
import { money, parseDecimalInput } from "@/lib/utils";

export default function CatalogoPage() {
  const { user } = useAuth();
  const [sucursales, setSucursales] = useState<CrSucursal[]>([]);
  const [idSucursal, setIdSucursal] = useState("");
  const [items, setItems] = useState<CrCatalogoItem[]>([]);
  const [search, setSearch] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [unidad, setUnidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.rol !== "admin") return;
    listSucursales().then((rows) => {
      setSucursales(rows);
      if (rows[0]) setIdSucursal(rows[0].id);
    });
  }, [user]);

  useEffect(() => {
    if (!idSucursal) return;
    listCatalogoBySucursal(idSucursal, search, false).then(setItems);
  }, [idSucursal, search]);

  if (user?.rol !== "admin") {
    return <p className="text-sm text-slate-500">Acceso restringido a administradores.</p>;
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const precioNum = parseDecimalInput(precio);
    if (!idSucursal || !codigo.trim() || !descripcion.trim() || precioNum === null) {
      toast.error("Completa todos los campos.");
      return;
    }
    setLoading(true);
    const created = await createCatalogoItem({
      id_sucursal: idSucursal,
      codigo,
      descripcion,
      unidad_medida: unidad.trim() || null,
      precio: precioNum,
    });
    setLoading(false);
    if (!created) {
      toast.error("No se pudo agregar el código (¿duplicado?).");
      return;
    }
    toast.success(`${created.codigo} agregado al catálogo.`);
    setCodigo("");
    setDescripcion("");
    setUnidad("");
    setPrecio("");
    listCatalogoBySucursal(idSucursal, search, false).then(setItems);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Catálogo por sucursal"
        subtitle="Agrega códigos manualmente cuando no estén en inventario."
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

      <form onSubmit={handleAdd} className="card-panel space-y-4 p-5">
        <h3 className="text-sm font-semibold text-slate-900">Agregar código</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="input-field"
            placeholder="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            required
          />
          <input
            className="input-field sm:col-span-2"
            placeholder="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
          <input
            className="input-field"
            placeholder="U.M."
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
          />
          <input
            className="input-field"
            placeholder="Precio"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full gap-2 sm:w-auto" disabled={loading}>
          <PackagePlus className="h-4 w-4" aria-hidden="true" />
          {loading ? "Guardando..." : "Agregar al catálogo"}
        </button>
      </form>

      <div className="card-panel overflow-hidden">
        <div className="divide-y divide-slate-100 md:hidden">
          {items.map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.descripcion}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">{item.codigo} · {item.unidad_medida ?? "Sin U.M."}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.activo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {item.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              <p className="mt-3 text-right text-base font-bold text-slate-900">{money(item.precio)}</p>
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
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{item.codigo}</td>
                <td className="px-4 py-3">{item.descripcion}</td>
                <td className="px-4 py-3">{item.unidad_medida ?? "—"}</td>
                <td className="px-4 py-3">{money(item.precio)}</td>
                <td className="px-4 py-3">{item.activo ? "Activo" : "Inactivo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
