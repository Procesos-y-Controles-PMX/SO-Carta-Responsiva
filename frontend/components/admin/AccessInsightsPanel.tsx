"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Clock, MapPin, Moon, UserX } from "lucide-react";
import type { AccessInsights, FailureEntry, MixSlice } from "@/lib/access-insights";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatLast(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function closenessLabel(value: string | null): string {
  if (value === "typo") return "Casi — probable misclick";
  if (value === "similar") return "Parecida";
  if (value === "unrelated") return "Distinta";
  return "Sin comparar";
}

function closenessClass(value: string | null): string {
  if (value === "typo") return "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300";
  if (value === "similar") return "bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300";
  if (value === "unrelated") return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300";
  return "bg-muted text-fg-muted";
}

function reasonLabel(value: string): string {
  if (value === "unknown_email") return "Correo no existe";
  if (value === "inactive") return "Usuario inactivo";
  if (value === "wrong_password") return "Contraseña";
  if (value === "missing_fields") return "Campos vacíos";
  if (value === "handoff_invalid") return "Handoff inválido";
  return value;
}

function appLabel(id: string): string {
  if (id === "equipo") return "Equipo Móvil";
  if (id === "cotizador") return "Cotizador";
  if (id === "permisos") return "Permisos";
  if (id === "carta-responsiva") return "Cartas Responsivas";
  if (id === "conteos") return "Conteos";
  if (id === "carta-porte") return "Carta Porte";
  return id;
}

function hintLabel(value: string | null): string | null {
  if (value === "mayusculas") return "solo cambió mayúsculas";
  if (value === "espacio") return "espacio de más o de menos";
  if (value === "un_caracter") return "1 o 2 caracteres de diferencia";
  if (value === "parecida") return "estructura parecida";
  if (value === "correo_como_password") return "escribió el correo como contraseña";
  if (value === "hash") return "la cuenta usa contraseña cifrada";
  return null;
}

function MixBars({ title, slices }: { title: string; slices: MixSlice[] }) {
  const max = Math.max(1, ...slices.map((s) => s.count));
  return (
    <div className="p-4 bg-card rounded-xl border border-line shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-fg-faint mb-3">{title}</p>
      {slices.length === 0 ? (
        <p className="text-sm text-fg-faint">Sin datos en este periodo.</p>
      ) : (
        <ul className="space-y-2">
          {slices.slice(0, 8).map((slice) => (
            <li key={slice.id}>
              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                <span className="truncate text-fg-strong font-medium">{slice.label}</span>
                <span className="text-fg-muted tabular-nums">{slice.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.max(6, (slice.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AccessInsightsPanel({ insights }: { insights: AccessInsights | null }) {
  const [openQuiet, setOpenQuiet] = useState<string | null>(null);
  const [openFail, setOpenFail] = useState<string | null>(null);

  const heatMax = useMemo(
    () => Math.max(1, ...(insights?.heatmap.map((c) => c.count) || [1])),
    [insights],
  );
  const heatMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of insights?.heatmap || []) map.set(`${cell.weekday}-${cell.hour}`, cell.count);
    return map;
  }, [insights]);

  if (!insights) return null;

  const quietTotal = insights.quiet.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MixBars title="Mezcla de apps" slices={insights.appMix} />
        <MixBars title="Mezcla por región" slices={insights.regionMix} />
      </div>

      <div className="p-4 bg-card rounded-xl border border-line shadow-sm overflow-x-auto">
        <p className="text-xs font-bold uppercase tracking-wider text-fg-faint mb-1 flex items-center gap-1.5">
          <Clock size={13} /> Horario de uso (Ciudad de México)
        </p>
        <p className="text-[11px] text-fg-faint mb-3">Lunes a domingo, 00–23 h. Más oscuro = más accesos.</p>
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-0.5 mb-1">
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-[9px] text-center text-fg-faint">
                {hour}
              </span>
            ))}
          </div>
          {WEEKDAYS.map((label, weekday) => (
            <div key={label} className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-0.5 mb-0.5">
              <span className="text-[10px] text-fg-muted self-center">{label}</span>
              {Array.from({ length: 24 }, (_, hour) => {
                const count = heatMap.get(`${weekday}-${hour}`) || 0;
                const t = count / heatMax;
                return (
                  <div
                    key={hour}
                    title={`${label} ${String(hour).padStart(2, "0")}:00 · ${count}`}
                    className="h-4 rounded-[2px]"
                    style={{
                      backgroundColor: count === 0 ? "var(--muted, #e8e4de)" : `rgba(185, 28, 28, ${0.15 + t * 0.85})`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-card rounded-xl border border-line shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-fg-faint mb-1 flex items-center gap-1.5">
          <UserX size={13} /> Sin acceso en 30 días
        </p>
        <p className="text-sm text-fg-muted mb-3">
          {quietTotal === 0
            ? "Todos los usuarios activos entraron en los últimos 30 días."
            : `${quietTotal} usuarios activos, agrupados por sucursal.`}
        </p>
        <div className="space-y-2">
          {insights.quiet.map((group) => {
            const open = openQuiet === group.sucursal;
            return (
              <div key={group.sucursal} className="rounded-lg border border-line-subtle overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenQuiet(open ? null : group.sucursal)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-fg">
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {group.sucursal}
                  </span>
                  <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-md">{group.count}</span>
                </button>
                {open ? (
                  <ul className="border-t border-line-subtle divide-y divide-line-subtle">
                    {group.users.map((user) => (
                      <li key={user.correo} className="px-3 py-2 text-sm">
                        <div className="font-medium text-fg">{user.nombre || user.correo}</div>
                        {user.nombre ? <div className="text-xs text-fg-faint">{user.correo}</div> : null}
                        <div className="text-xs text-fg-muted mt-0.5">Último acceso: {formatLast(user.lastLogin)}</div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-card rounded-xl border border-line shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-fg-faint mb-1 flex items-center gap-1.5">
          <Moon size={13} /> Intentos fallidos
        </p>
        <p className="text-xs text-fg-faint mb-3">
          No se guarda la contraseña. “Casi” significa 1–2 caracteres, mayúsculas o un espacio — típico misclick.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {[
            { label: "Fallidos", value: insights.failures.total },
            { label: "Casi (misclick)", value: insights.failures.typo },
            { label: "Parecida", value: insights.failures.similar },
            { label: "Distinta", value: insights.failures.unrelated },
            { label: "Correo inexistente", value: insights.failures.unknownEmail },
            { label: "Inactivo", value: insights.failures.inactive },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg bg-muted px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-fg-faint font-bold">{kpi.label}</div>
              <div className="text-lg font-extrabold text-fg">{kpi.value}</div>
            </div>
          ))}
        </div>
        {insights.failures.days.length === 0 ? (
          <p className="text-sm text-fg-faint">Sin intentos fallidos en este periodo.</p>
        ) : (
          <div className="space-y-2">
            {insights.failures.days.map((day) => {
              const open = openFail === day.date;
              return (
                <div key={day.date} className="rounded-lg border border-line-subtle overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFail(open ? null : day.date)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-fg capitalize">
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {day.label}
                    </span>
                    <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-md">{day.count}</span>
                  </button>
                  {open ? (
                    <div className="overflow-x-auto border-t border-line-subtle">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
                            <th className="px-3 py-2">Hora</th>
                            <th className="px-3 py-2">App</th>
                            <th className="px-3 py-2">Intento</th>
                            <th className="px-3 py-2">Ubicación</th>
                            <th className="px-3 py-2">Cercanía</th>
                            <th className="px-3 py-2">IP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {day.entries.map((entry: FailureEntry) => (
                            <tr key={entry.ID} className="border-t border-line-subtle">
                              <td className="px-3 py-2 font-mono text-xs text-fg-muted whitespace-nowrap">
                                {formatTime(entry.CREATED_AT)}
                              </td>
                              <td className="px-3 py-2 text-xs text-fg-muted whitespace-nowrap">
                                {appLabel(entry.APP)}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-fg">{entry.NOMBRE || entry.CORREO}</div>
                                {entry.NOMBRE ? <div className="text-xs text-fg-faint">{entry.CORREO}</div> : null}
                                <div className="text-xs text-fg-muted">
                                  {reasonLabel(entry.REASON)}
                                  {entry.ATTEMPT_LEN != null ? ` · contraseña de ${entry.ATTEMPT_LEN} caracteres` : ""}
                                  {hintLabel(entry.HINT) ? ` · ${hintLabel(entry.HINT)}` : ""}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs text-fg-muted">
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={12} className="text-fg-faint" />
                                  {entry.UBICACION || "—"}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${closenessClass(entry.CLOSENESS)}`}>
                                  {closenessLabel(entry.CLOSENESS)}
                                  {entry.DISTANCE != null ? ` (${entry.DISTANCE})` : ""}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-fg-muted">{entry.IP || "—"}</td>
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
    </div>
  );
}
