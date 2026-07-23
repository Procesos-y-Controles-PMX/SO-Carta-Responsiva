"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPin, UserPlus } from "lucide-react";
import FilterSelect from "@/components/common/FilterSelect";
import PageHeader from "@/components/ui/PageHeader";
import { canManageMasterData } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import {
  createResponsable,
  deleteResponsable,
  listAllResponsables,
  type ResponsableRow,
} from "@/lib/queries/responsables";
import { listSucursales } from "@/lib/queries/sucursales";
import type { CrSucursal } from "@/lib/types/db";

export default function ResponsablesPage() {
  const { user } = useAuth();
  const canEdit = Boolean(user && canManageMasterData(user));
  const [sucursales, setSucursales] = useState<CrSucursal[]>([]);
  const [rows, setRows] = useState<ResponsableRow[]>([]);
  const [idSucursal, setIdSucursal] = useState("");
  const [filterSucursal, setFilterSucursal] = useState("all");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);

  function reload() {
    listAllResponsables().then(setRows);
  }

  useEffect(() => {
    if (!user) return;
    listSucursales().then((data) => {
      setSucursales(data);
      if (data[0]) setIdSucursal(data[0].id);
    });
    reload();
  }, [user]);

  const filteredRows = useMemo(() => {
    if (filterSucursal === "all") return rows;
    return rows.filter((row) => row.id_sucursal === filterSucursal);
  }, [rows, filterSucursal]);

  if (!user) {
    return <p className="text-sm text-slate-500">Inicia sesión para consultar responsables.</p>;
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    if (!idSucursal || !nombre.trim()) {
      toast.error("Completa sucursal y nombre.");
      return;
    }
    setLoading(true);
    const created = await createResponsable(idSucursal, nombre);
    setLoading(false);
    if (!created.ok) {
      toast.error(created.message);
      return;
    }
    toast.success(
      created.reactivated
        ? `${created.data.nombre} reactivado.`
        : `${created.data.nombre} agregado.`,
    );
    setNombre("");
    reload();
  }

  async function handleDelete(id: string, nombreRow: string) {
    if (!canEdit) return;
    if (!window.confirm(`¿Eliminar a ${nombreRow}? Esta acción no se puede deshacer.`)) return;
    const ok = await deleteResponsable(id);
    if (!ok) {
      toast.error("No se pudo eliminar.");
      return;
    }
    toast.success(`${nombreRow} eliminado.`);
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={canEdit ? "Administración" : "Consulta"}
        title="Responsables"
        subtitle={
          canEdit
            ? "Personas que pueden aparecer en la carta por sucursal."
            : "Consulta los responsables disponibles por sucursal."
        }
      />

      <div className="card-panel p-5">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Filtrar por sucursal
        </label>
        <FilterSelect
          value={filterSucursal}
          onChange={setFilterSucursal}
          icon={MapPin}
          searchable="auto"
          options={[
            { value: "all", label: "Todas las sucursales" },
            ...sucursales.map((sucursal) => ({
              value: sucursal.id,
              label: `${sucursal.nombre}${sucursal.codigo_sap ? ` / ${sucursal.codigo_sap}` : ""}`,
            })),
          ]}
        />
      </div>

      {canEdit ? (
        <form
          onSubmit={handleAdd}
          className="card-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
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
          <div className="flex-[2]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Nombre del responsable
            </label>
            <input
              className="input-field"
              placeholder="Ej. Alejandro"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full gap-2 sm:w-auto" disabled={loading}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Agregar
          </button>
        </form>
      ) : null}

      <div className="card-panel overflow-hidden">
        <div className="divide-y divide-slate-100 md:hidden">
          {filteredRows.map((row) => (
            <article key={row.id} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                {row.nombre
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{row.nombre}</p>
                <p className="text-xs text-slate-500">
                  {row.cr_sucursales?.nombre ?? "Sin sucursal"}
                  {row.activo ? "" : " · Inactivo"}
                </p>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className="min-h-10 rounded-sm px-2 text-xs font-semibold text-brand active:bg-red-50"
                  onClick={() => handleDelete(row.id, row.nombre)}
                >
                  Eliminar
                </button>
              ) : null}
            </article>
          ))}
          {filteredRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No hay responsables para el filtro seleccionado.
            </p>
          ) : null}
        </div>
        <table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Estado</th>
              {canEdit ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{row.cr_sucursales?.nombre ?? "—"}</td>
                <td className="px-4 py-3">{row.nombre}</td>
                <td className="px-4 py-3">{row.activo ? "Activo" : "Inactivo"}</td>
                {canEdit ? (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand hover:underline"
                      onClick={() => handleDelete(row.id, row.nombre)}
                    >
                      Eliminar
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 4 : 3}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No hay responsables para el filtro seleccionado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
