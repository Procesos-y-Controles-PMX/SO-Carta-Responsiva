"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter } from "lucide-react";
import AnimatedSearchInput from "@/components/common/AnimatedSearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import PageHeader from "@/components/ui/PageHeader";
import { canViewCompliance } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import {
  getComplianceReport,
  responsablesSinCarta,
  sucursalesSinCarta,
  type ComplianceRow,
} from "@/lib/queries/cumplimiento";
import { endOfMonth, formatDate, startOfMonth } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "ok";

function toIsoStart(date: Date): string {
  return date.toISOString();
}

function monthInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function matchesSearch(haystack: string, query: string): boolean {
  return haystack.toLocaleLowerCase("es-MX").includes(query);
}

export default function CumplimientoPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(monthInputValue(new Date()));
  const [rows, setRows] = useState<ComplianceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [region, setRegion] = useState("all");

  const range = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const from = startOfMonth(new Date(y, m - 1, 1));
    const to = endOfMonth(new Date(y, m - 1, 1));
    return { from: toIsoStart(from), to: toIsoStart(to) };
  }, [month]);

  useEffect(() => {
    if (!user || !canViewCompliance(user)) return;
    setLoading(true);
    getComplianceReport(user, range.from, range.to).then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, [user, range.from, range.to]);

  const regionOptions = useMemo(() => {
    const regions = Array.from(
      new Set(
        rows
          .map((row) => row.sucursal.region?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, "es"));
    return [
      { value: "all", label: "Todas las regiones" },
      ...regions.map((value) => ({ value, label: value })),
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    return rows.filter((row) => {
      if (region !== "all" && (row.sucursal.region?.trim() ?? "") !== region) {
        return false;
      }
      if (status === "pending" && row.cartasSucursalEnPeriodo > 0) return false;
      if (status === "ok" && row.cartasSucursalEnPeriodo === 0) return false;
      if (!query) return true;
      if (matchesSearch(row.sucursal.nombre, query)) return true;
      if (matchesSearch(row.sucursal.codigo_sap ?? "", query)) return true;
      return row.responsables.some((resp) => matchesSearch(resp.nombre, query));
    });
  }, [rows, search, status, region]);

  const filteredResponsables = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    return rows.flatMap((row) => {
      if (region !== "all" && (row.sucursal.region?.trim() ?? "") !== region) {
        return [];
      }
      return row.responsables
        .filter((resp) => {
          if (status === "pending" && resp.cartasEnPeriodo > 0) return false;
          if (status === "ok" && resp.cartasEnPeriodo === 0) return false;
          if (!query) return true;
          return (
            matchesSearch(resp.nombre, query) ||
            matchesSearch(row.sucursal.nombre, query) ||
            matchesSearch(row.sucursal.codigo_sap ?? "", query)
          );
        })
        .map((resp) => ({ row, resp }));
    });
  }, [rows, search, status, region]);

  const sinSucursal = sucursalesSinCarta(rows);
  const sinResponsable = responsablesSinCarta(rows);
  const totalCartas = rows.reduce((sum, r) => sum + r.cartasSucursalEnPeriodo, 0);

  if (!user || !canViewCompliance(user)) {
    return <p className="text-sm text-slate-500">Acceso restringido a administradores.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supervisión"
        title="Cumplimiento"
        subtitle="Consulta quién generó cartas en el periodo y detecta sucursales pendientes."
        actions={
          <label className="block w-full sm:w-52">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Periodo
            </span>
            <input
              type="month"
              className="input-field"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-panel border-l-2 border-l-steel p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Cartas generadas</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalCartas}</p>
        </div>
        <div className="card-panel border-l-2 border-l-brand p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Sucursales sin carta</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{sinSucursal.length}</p>
        </div>
        <div className="card-panel border-l-2 border-l-amber-500 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Responsables sin carta</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{sinResponsable.length}</p>
        </div>
      </div>

      <div className="card-panel p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Buscar
            </label>
            <AnimatedSearchInput
              placeholder="Sucursal, centro o responsable..."
              value={search}
              onChange={setSearch}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estado
            </label>
            <FilterSelect
              value={status}
              onChange={(value) => setStatus(value as StatusFilter)}
              icon={Filter}
              searchable={false}
              options={[
                { value: "all", label: "Todos" },
                { value: "pending", label: "Sin carta" },
                { value: "ok", label: "Con carta" },
              ]}
            />
          </div>
          {regionOptions.length > 1 ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Región
              </label>
              <FilterSelect
                value={region}
                onChange={setRegion}
                searchable="auto"
                options={regionOptions}
              />
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando reporte...</p>
      ) : (
        <>
          <div className="card-panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Por sucursal</h3>
              <p className="text-xs text-slate-500">
                {filteredRows.length} de {rows.length}
              </p>
            </div>
            {filteredRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No hay sucursales que coincidan con los filtros.
              </p>
            ) : (
              <>
                <div className="divide-y divide-slate-100 md:hidden">
                  {filteredRows.map((row) => (
                    <article key={row.sucursal.id} className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{row.sucursal.nombre}</p>
                        <p className="text-xs text-slate-500">{row.cartasSucursalEnPeriodo} cartas en el periodo</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${row.cartasSucursalEnPeriodo === 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {row.cartasSucursalEnPeriodo === 0 ? "Pendiente" : "Cumple"}
                      </span>
                    </article>
                  ))}
                </div>
                <table className="hidden w-full text-left text-sm md:table">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Sucursal</th>
                      <th className="px-4 py-3">Cartas en periodo</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.sucursal.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">{row.sucursal.nombre}</td>
                        <td className="px-4 py-3">{row.cartasSucursalEnPeriodo}</td>
                        <td className="px-4 py-3">
                          {row.cartasSucursalEnPeriodo === 0 ? (
                            <span className="font-medium text-red-600">Sin carta</span>
                          ) : (
                            <span className="text-emerald-700">Con carta</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="card-panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Por responsable</h3>
              <p className="text-xs text-slate-500">{filteredResponsables.length} resultados</p>
            </div>
            {filteredResponsables.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No hay responsables que coincidan con los filtros.
              </p>
            ) : (
              <>
                <div className="divide-y divide-slate-100 md:hidden">
                  {filteredResponsables.map(({ row, resp }) => (
                    <article key={resp.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{resp.nombre}</p>
                          <p className="text-xs text-slate-500">{row.sucursal.nombre}</p>
                        </div>
                        <span className={`text-sm font-bold ${resp.cartasEnPeriodo === 0 ? "text-red-600" : "text-slate-900"}`}>
                          {resp.cartasEnPeriodo}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Última carta: {resp.ultimaCarta ? formatDate(resp.ultimaCarta) : "Sin registro"}
                      </p>
                    </article>
                  ))}
                </div>
                <table className="hidden w-full text-left text-sm md:table">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Sucursal</th>
                      <th className="px-4 py-3">Responsable</th>
                      <th className="px-4 py-3">Cartas</th>
                      <th className="px-4 py-3">Última carta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResponsables.map(({ row, resp }) => (
                      <tr key={resp.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">{row.sucursal.nombre}</td>
                        <td className="px-4 py-3">{resp.nombre}</td>
                        <td className="px-4 py-3">
                          {resp.cartasEnPeriodo === 0 ? (
                            <span className="font-medium text-red-600">0</span>
                          ) : (
                            resp.cartasEnPeriodo
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {resp.ultimaCarta ? formatDate(resp.ultimaCarta) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
