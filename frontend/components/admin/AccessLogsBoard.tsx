"use client";

import { ChevronDown, ChevronRight, ClipboardList, MapPin, MonitorSmartphone, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SO_APP_LABELS, type AccessDayBucket } from "@/lib/so-access-apps";
import type { AccessInsights } from "@/lib/access-insights";
import AccessInsightsPanel from "@/components/admin/AccessInsightsPanel";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function methodLabel(method: string): string {
  if (method === "portal-handoff") return "Portal";
  if (method === "credentials") return "Login directo";
  return method;
}

function shortUserAgent(ua: string | null): string {
  if (!ua) return "—";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS|Macintosh/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return ua.slice(0, 40) + (ua.length > 40 ? "…" : "");
}

const selectClass =
  "w-full rounded-sm border border-line bg-muted px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export default function AccessLogsBoard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<AccessDayBucket[]>([]);
  const [insights, setInsights] = useState<AccessInsights | null>(null);
  const [rangeDays, setRangeDays] = useState("14");
  const [appFilter, setAppFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        days: rangeDays,
        search,
        app: appFilter,
      });
      const res = await fetch(`/api/admin/access-logs?${params}`, { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        days?: AccessDayBucket[];
        total?: number;
        insights?: AccessInsights;
      };
      if (!res.ok || !data.ok) throw new Error(data.message || "Error al cargar logs");
      const nextDays = data.days || [];
      setDays(nextDays);
      setInsights(data.insights || null);
      if (nextDays.length > 0) {
        setExpanded((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          return { [nextDays[0].date]: true };
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar logs");
      setDays([]);
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, [rangeDays, search, appFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleDays = useMemo(() => {
    const wantedApp = appFilter === "todas" ? null : appFilter;
    const query = searchInput.trim().toLowerCase();
    return days
      .map((day) => {
        const entries = day.entries.filter((entry) => {
          const appId = (entry.APP || "equipo").toLowerCase();
          if (wantedApp && appId !== wantedApp) return false;
          if (!query) return true;
          return `${entry.CORREO} ${entry.NOMBRE || ""} ${entry.UBICACION || ""}`.toLowerCase().includes(query);
        });
        return { ...day, entries, count: entries.length };
      })
      .filter((day) => day.count > 0);
  }, [days, appFilter, searchInput]);

  const total = visibleDays.reduce((sum, day) => sum + day.count, 0);
  const uniqueUsers = new Set(
    visibleDays.flatMap((d) => d.entries.map((e) => e.CORREO.toLowerCase())),
  ).size;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-sm border border-line bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">Accesos</span>
          <p className="mt-1 font-display text-2xl font-semibold text-fg">{loading ? "…" : total}</p>
        </div>
        <div className="rounded-sm border border-line bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">Usuarios únicos</span>
          <p className="mt-1 font-display text-2xl font-semibold text-brand">{loading ? "…" : uniqueUsers}</p>
        </div>
        <div className="col-span-2 rounded-sm border border-line bg-card p-4 md:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">Días con actividad</span>
          <p className="mt-1 font-display text-2xl font-semibold text-fg">{loading ? "…" : visibleDays.length}</p>
        </div>
      </div>

      <div className="rounded-sm border border-line bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
              Buscar por correo o ubicación
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearch(searchInput.trim());
                    setExpanded({});
                  }
                }}
                placeholder="ej. nombre@cemex.com"
                className="w-full rounded-sm border border-line bg-muted py-2 pl-9 pr-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
              Sistema
            </label>
            <select
              value={appFilter}
              onChange={(e) => {
                setAppFilter(e.target.value);
                setExpanded({});
              }}
              className={selectClass}
            >
              <option value="todas">Todas las apps</option>
              <option value="equipo">Equipo Móvil</option>
              <option value="cotizador">Cotizador</option>
              <option value="permisos">Permisos</option>
              <option value="carta-responsiva">Cartas Responsivas</option>
              <option value="conteos">Conteos</option>
            </select>
          </div>
          <div className="w-full md:w-44">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
              Periodo
            </label>
            <select
              value={rangeDays}
              onChange={(e) => {
                setRangeDays(e.target.value);
                setExpanded({});
              }}
              className={selectClass}
            >
              <option value="7">Últimos 7 días</option>
              <option value="14">Últimos 14 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch(searchInput.trim());
              setExpanded({});
            }}
            className="inline-flex min-h-10 items-center justify-center rounded-sm bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            Buscar
          </button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-faint">
          <ClipboardList size={13} />
          Accesos exitosos a las apps de Soporte Operativo (hora Ciudad de México).
        </p>
      </div>

      {!loading && !error ? <AccessInsightsPanel insights={insights} /> : null}

      {loading ? (
        <p className="py-16 text-center text-sm text-fg-subtle">Cargando logs de acceso…</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-500">{error}</p>
      ) : visibleDays.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg-subtle">No hay accesos registrados en este periodo.</p>
      ) : (
        <div className="space-y-3">
          {visibleDays.map((day) => {
            const open = !!expanded[day.date];
            return (
              <div key={day.date} className="overflow-hidden rounded-sm border border-line bg-card">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [day.date]: !prev[day.date] }))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {open ? (
                      <ChevronDown size={16} className="shrink-0 text-fg-faint" />
                    ) : (
                      <ChevronRight size={16} className="shrink-0 text-fg-faint" />
                    )}
                    <span className="truncate font-semibold capitalize text-fg">{day.label}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-muted px-2.5 py-0.5 text-xs font-bold text-fg-strong">
                    {day.count} {day.count === 1 ? "acceso" : "accesos"}
                  </span>
                </button>
                {open ? (
                  <div className="overflow-x-auto border-t border-line-subtle">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-muted text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
                          <th className="px-4 py-2">Hora</th>
                          <th className="px-4 py-2">Usuario</th>
                          <th className="px-4 py-2">Ubicación</th>
                          <th className="px-4 py-2">App</th>
                          <th className="px-4 py-2">Método</th>
                          <th className="px-4 py-2">IP</th>
                          <th className="px-4 py-2">Dispositivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.entries.map((entry) => (
                          <tr key={entry.ID} className="border-t border-line-subtle hover:bg-muted/40">
                            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-fg-muted">
                              {formatTime(entry.CREATED_AT)}
                            </td>
                            <td className="px-4 py-2">
                              <div className="font-medium leading-tight text-fg">
                                {entry.NOMBRE || entry.CORREO}
                              </div>
                              {entry.NOMBRE ? (
                                <div className="text-xs text-fg-faint">{entry.CORREO}</div>
                              ) : null}
                            </td>
                            <td className="px-4 py-2 text-xs text-fg-muted">
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={12} className="shrink-0 text-fg-faint" />
                                {entry.UBICACION || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs font-semibold text-fg-strong">
                              {SO_APP_LABELS[entry.APP] || entry.APP}
                            </td>
                            <td className="px-4 py-2 text-xs text-fg-muted">{methodLabel(entry.METHOD)}</td>
                            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-fg-muted">
                              {entry.IP || "—"}
                            </td>
                            <td className="px-4 py-2 text-xs text-fg-muted" title={entry.USER_AGENT || undefined}>
                              <span className="inline-flex items-center gap-1">
                                <MonitorSmartphone size={12} className="text-fg-faint" />
                                {shortUserAgent(entry.USER_AGENT)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
