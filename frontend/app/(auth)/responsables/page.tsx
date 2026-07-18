"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, UserPlus } from "lucide-react";
import FilterSelect from "@/components/common/FilterSelect";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import {
  createResponsable,
  listAllResponsables,
  toggleResponsableActivo,
} from "@/lib/queries/responsables";
import { listSucursales } from "@/lib/queries/sucursales";
import type { CrResponsable, CrSucursal } from "@/lib/types/db";

type ResponsableRow = CrResponsable & { cr_sucursales: { nombre: string } | null };

export default function ResponsablesPage() {
  const { user } = useAuth();
  const [sucursales, setSucursales] = useState<CrSucursal[]>([]);
  const [rows, setRows] = useState<ResponsableRow[]>([]);
  const [idSucursal, setIdSucursal] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);

  function reload() {
    listAllResponsables().then(setRows);
  }

  useEffect(() => {
    if (user?.rol !== "admin") return;
    listSucursales().then((data) => {
      setSucursales(data);
      if (data[0]) setIdSucursal(data[0].id);
    });
    reload();
  }, [user]);

  if (user?.rol !== "admin") {
    return <p className="text-sm text-slate-500">Acceso restringido a administradores.</p>;
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!idSucursal || !nombre.trim()) {
      toast.error("Completa sucursal y nombre.");
      return;
    }
    setLoading(true);
    const created = await createResponsable(idSucursal, nombre);
    setLoading(false);
    if (!created) {
      toast.error("No se pudo agregar el responsable.");
      return;
    }
    toast.success(`${created.nombre} agregado.`);
    setNombre("");
    reload();
  }

  async function handleToggle(id: string, activo: boolean) {
    const ok = await toggleResponsableActivo(id, !activo);
    if (!ok) {
      toast.error("No se pudo actualizar.");
      return;
    }
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Responsables"
        subtitle="Personas que pueden aparecer en la carta por sucursal."
      />

      <form onSubmit={handleAdd} className="card-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
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

      <div className="card-panel overflow-hidden">
        <div className="divide-y divide-slate-100 md:hidden">
          {rows.map((row) => (
            <article key={row.id} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                {row.nombre.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{row.nombre}</p>
                <p className="text-xs text-slate-500">{row.cr_sucursales?.nombre ?? "Sin sucursal"} · {row.activo ? "Activo" : "Inactivo"}</p>
              </div>
              <button
                type="button"
                className="min-h-10 rounded-sm px-2 text-xs font-semibold text-slate-600 active:bg-slate-100"
                onClick={() => handleToggle(row.id, row.activo)}
              >
                {row.activo ? "Desactivar" : "Activar"}
              </button>
            </article>
          ))}
        </div>
        <table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{row.cr_sucursales?.nombre ?? "—"}</td>
                <td className="px-4 py-3">{row.nombre}</td>
                <td className="px-4 py-3">{row.activo ? "Activo" : "Inactivo"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-600 hover:underline"
                    onClick={() => handleToggle(row.id, row.activo)}
                  >
                    {row.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
