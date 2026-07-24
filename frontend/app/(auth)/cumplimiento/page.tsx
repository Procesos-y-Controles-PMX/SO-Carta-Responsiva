"use client";

import { startTransition, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CalendarRange, Filter, MapPin } from "lucide-react";
import AnimatedSearchInput from "@/components/common/AnimatedSearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import PageHeader from "@/components/ui/PageHeader";
import { canViewCompliance, isGeneralAdmin, isZoneAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import {
  getComplianceReport,
  responsablesSinCarta,
  sucursalesSinCarta,
  type ComplianceRow,
} from "@/lib/queries/cumplimiento";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  formatDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInputValue,
} from "@/lib/utils";

type StatusFilter = "all" | "pending" | "ok";
type PeriodPreset = "day" | "week" | "month" | "custom";

function toIsoStart(date: Date): string {
  return date.toISOString();
}

function matchesSearch(haystack: string, query: string): boolean {
  return haystack.toLocaleLowerCase("es-MX").includes(query);
}

function subscribeMd(onChange: () => void) {
  const media = window.matchMedia("(min-width: 768px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeMd,
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

function rangeForPreset(preset: PeriodPreset, anchor: Date, customFrom: string, customTo: string) {
  if (preset === "day") {
    return { from: startOfDay(anchor), to: endOfDay(anchor) };
  }
  if (preset === "week") {
    return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
  }
  if (preset === "month") {
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }
  const fromDate = customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)) : startOfMonth(anchor);
  const toDate = customTo ? endOfDay(new Date(`${customTo}T00:00:00`)) : endOfMonth(anchor);
  return {
    from: fromDate <= toDate ? fromDate : toDate,
    to: fromDate <= toDate ? toDate : fromDate,
  };
}

export default function CumplimientoPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [anchorDate, setAnchorDate] = useState(() => toDateInputValue(new Date()));
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(startOfMonth(new Date())));
  const [customTo, setCustomTo] = useState(() => toDateInputValue(endOfMonth(new Date())));
  const [rows, setRows] = useState<ComplianceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [region, setRegion] = useState("all");
  const [sucursalId, setSucursalId] = useState("all");
  const [showResponsables, setShowResponsables] = useState(false);

  const range = useMemo(() => {
    const anchor = new Date(`${anchorDate}T00:00:00`);
    const { from, to } = rangeForPreset(preset, anchor, customFrom, customTo);
    return { from: toIsoStart(from), to: toIsoStart(to) };
  }, [preset, anchorDate, customFrom, customTo]);

  useEffect(() => {
    if (!user || !canViewCompliance(user)) return;
    setLoading(true);
    setShowResponsables(false);
    getComplianceReport(user, range.from, range.to).then((data) => {
      startTransition(() => {
        setRows(data);
        setLoading(false);
      });
    });
  }, [user, range.from, range.to]);

  useEffect(() => {
    if (loading || rows.length === 0) return;
    const id = window.setTimeout(() => setShowResponsables(true), 0);
    return () => window.clearTimeout(id);
  }, [loading, rows]);

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

  const sucursalOptions = useMemo(() => {
    const scoped = rows.filter((row) => {
      if (region === "all") return true;
      return (row.sucursal.region?.trim() ?? "") === region;
    });
    return [
      { value: "all", label: "Todas las sucursales" },
      ...scoped
        .map((row) => ({
          value: row.sucursal.id,
          label: `${row.sucursal.nombre}${row.sucursal.codigo_sap ? ` / ${row.sucursal.codigo_sap}` : ""}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    ];
  }, [rows, region]);

  useEffect(() => {
    if (sucursalId === "all") return;
    if (!sucursalOptions.some((option) => option.value === sucursalId)) {
      setSucursalId("all");
    }
  }, [sucursalOptions, sucursalId]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    return rows.filter((row) => {
      if (region !== "all" && (row.sucursal.region?.trim() ?? "") !== region) {
        return false;
      }
      if (sucursalId !== "all" && row.sucursal.id !== sucursalId) return false;
      if (status === "pending" && row.cartasSucursalEnPeriodo > 0) return false;
      if (status === "ok" && row.cartasSucursalEnPeriodo === 0) return false;
      if (!query) return true;
      if (matchesSearch(row.sucursal.nombre, query)) return true;
      if (matchesSearch(row.sucursal.codigo_sap ?? "", query)) return true;
      return row.responsables.some((resp) => matchesSearch(resp.nombre, query));
    });
  }, [rows, search, status, region, sucursalId]);

  const filteredResponsables = useMemo(() => {
    if (!showResponsables) return [];
    const query = search.trim().toLocaleLowerCase("es-MX");
    return rows.flatMap((row) => {
      if (region !== "all" && (row.sucursal.region?.trim() ?? "") !== region) {
        return [];
      }
      if (sucursalId !== "all" && row.sucursal.id !== sucursalId) return [];
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
  }, [rows, search, status, region, sucursalId, showResponsables]);

  const sinSucursal = useMemo(() => sucursalesSinCarta(filteredRows), [filteredRows]);
  const sinResponsable = useMemo(
    () => responsablesSinCarta(filteredRows),
    [filteredRows],
  );
  const totalCartas = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.cartasSucursalEnPeriodo, 0),
    [filteredRows],
  );

  if (!user || !canViewCompliance(user)) {
    return <p className="text-sm text-fg-subtle">Inicia sesión para consultar el cumplimiento.</p>;
  }

  const branchScoped = !isGeneralAdmin(user) && !isZoneAdmin(user);
  const subtitle = branchScoped
    ? "Consulta el cumplimiento de cartas de tu sucursal en el periodo seleccionado."
    : "Consulta quién generó cartas en el periodo y detecta sucursales pendientes.";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supervisión"
        title="Cumplimiento"
        subtitle={subtitle}
      />

      <div className="card-panel space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Periodo
            </label>
            <FilterSelect
              value={preset}
              onChange={(value) => setPreset(value as PeriodPreset)}
              icon={CalendarRange}
              searchable={false}
              options={[
                { value: "day", label: "Día" },
                { value: "week", label: "Semana" },
                { value: "month", label: "Mes" },
                { value: "custom", label: "Rango personalizado" },
              ]}
            />
          </div>
          {preset === "custom" ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Desde
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Hasta
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </div>
            </>
          ) : preset === "month" ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                Mes
              </label>
              <input
                type="month"
                className="input-field"
                value={anchorDate.slice(0, 7)}
                onChange={(event) => {
                  const [y, m] = event.target.value.split("-").map(Number);
                  if (!y || !m) return;
                  setAnchorDate(toDateInputValue(new Date(y, m - 1, 1)));
                }}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                {preset === "day" ? "Día" : "Día de la semana"}
              </label>
              <input
                type="date"
                className="input-field"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-panel border-l-2 border-l-steel p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-subtle">Cartas generadas</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{totalCartas}</p>
        </div>
        <div className="card-panel border-l-2 border-l-brand p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-subtle">Sucursales sin carta</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{sinSucursal.length}</p>
        </div>
        <div className="card-panel border-l-2 border-l-amber-500 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-subtle">Responsables sin carta</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{sinResponsable.length}</p>
        </div>
      </div>

      <div className="card-panel p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Buscar
            </label>
            <AnimatedSearchInput
              placeholder="Sucursal, centro o responsable..."
              value={search}
              onChange={setSearch}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
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
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
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
          {sucursalOptions.length > 1 ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                Sucursal
              </label>
              <FilterSelect
                value={sucursalId}
                onChange={setSucursalId}
                icon={MapPin}
                searchable="auto"
                options={sucursalOptions}
              />
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-fg-subtle">Cargando reporte...</p>
      ) : (
        <>
          <div className="card-panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
              <h3 className="text-sm font-semibold text-fg">Por sucursal</h3>
              <p className="text-xs text-fg-subtle">
                {filteredRows.length} de {rows.length}
              </p>
            </div>
            {filteredRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-fg-subtle">
                No hay sucursales que coincidan con los filtros.
              </p>
            ) : isDesktop ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-fg-subtle">
                  <tr>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Cartas en periodo</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.sucursal.id} className="border-t border-line-subtle">
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
            ) : (
              <div className="divide-y divide-line-subtle">
                {filteredRows.map((row) => (
                  <article key={row.sucursal.id} className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-semibold text-fg">{row.sucursal.nombre}</p>
                      <p className="text-xs text-fg-subtle">{row.cartasSucursalEnPeriodo} cartas en el periodo</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${row.cartasSucursalEnPeriodo === 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {row.cartasSucursalEnPeriodo === 0 ? "Pendiente" : "Cumple"}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="card-panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
              <h3 className="text-sm font-semibold text-fg">Por responsable</h3>
              <p className="text-xs text-fg-subtle">
                {showResponsables ? `${filteredResponsables.length} resultados` : "Cargando..."}
              </p>
            </div>
            {!showResponsables ? (
              <p className="px-5 py-8 text-center text-sm text-fg-subtle">Preparando detalle por responsable...</p>
            ) : filteredResponsables.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-fg-subtle">
                No hay responsables que coincidan con los filtros.
              </p>
            ) : isDesktop ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-fg-subtle">
                  <tr>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Cartas</th>
                    <th className="px-4 py-3">Última carta</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResponsables.map(({ row, resp }) => (
                    <tr key={resp.id} className="border-t border-line-subtle">
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
            ) : (
              <div className="divide-y divide-line-subtle">
                {filteredResponsables.map(({ row, resp }) => (
                  <article key={resp.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-fg">{resp.nombre}</p>
                        <p className="text-xs text-fg-subtle">{row.sucursal.nombre}</p>
                      </div>
                      <span className={`text-sm font-bold ${resp.cartasEnPeriodo === 0 ? "text-red-600" : "text-fg"}`}>
                        {resp.cartasEnPeriodo}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-fg-subtle">
                      Última carta: {resp.ultimaCarta ? formatDate(resp.ultimaCarta) : "Sin registro"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
