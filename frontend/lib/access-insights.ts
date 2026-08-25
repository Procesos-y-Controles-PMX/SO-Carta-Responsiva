import { SO_APP_LABELS } from "./so-access-apps";

const MX_TZ = "America/Mexico_City";
const QUIET_DAYS = 30;

export type QuietUser = {
  correo: string;
  nombre: string | null;
  lastLogin: string | null;
};

export type QuietSucursal = {
  sucursal: string;
  count: number;
  users: QuietUser[];
};

export type MixSlice = { id: string; label: string; count: number };

export type HeatCell = { weekday: number; hour: number; count: number };

export type FailureEntry = {
  ID: string;
  CORREO: string;
  NOMBRE: string | null;
  APP: string;
  METHOD: string;
  REASON: string;
  CLOSENESS: string | null;
  DISTANCE: number | null;
  ATTEMPT_LEN: number | null;
  HINT: string | null;
  UBICACION: string | null;
  IP: string | null;
  USER_AGENT: string | null;
  CREATED_AT: string;
};

export type FailureDay = {
  date: string;
  label: string;
  count: number;
  entries: FailureEntry[];
};

export type AccessInsights = {
  appMix: MixSlice[];
  regionMix: MixSlice[];
  heatmap: HeatCell[];
  quiet: QuietSucursal[];
  failures: {
    total: number;
    typo: number;
    similar: number;
    unrelated: number;
    unknownEmail: number;
    inactive: number;
    days: FailureDay[];
  };
};

export function mexicoCityDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MX_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 18, 0, 0));
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: MX_TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(utcNoon);
}

function mexicoCityHour(iso: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: MX_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return Number.parseInt(hour, 10);
}

/** 0 = lunes … 6 = domingo */
function mexicoCityWeekday(iso: string): number {
  const key = mexicoCityDateKey(iso);
  const [y, m, d] = key.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 18, 0, 0));
  return (utcNoon.getUTCDay() + 6) % 7;
}

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function emptyInsights(): AccessInsights {
  return {
    appMix: [],
    regionMix: [],
    heatmap: [],
    quiet: [],
    failures: {
      total: 0,
      typo: 0,
      similar: 0,
      unrelated: 0,
      unknownEmail: 0,
      inactive: 0,
      days: [],
    },
  };
}

export function formatLocation(...parts: unknown[]): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const value = String(part ?? "").trim();
    if (!value) continue;
    const key = value.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.length ? out.join(" · ") : null;
}

export function buildMixAndHeatmap(
  entries: Array<{ APP?: string | null; REGION?: string | null; CREATED_AT: string }>,
): Pick<AccessInsights, "appMix" | "regionMix" | "heatmap"> {
  const apps = new Map<string, number>();
  const regions = new Map<string, number>();
  const heat = new Map<string, number>();

  for (const entry of entries) {
    const appId = (entry.APP || "equipo").toLowerCase();
    apps.set(appId, (apps.get(appId) || 0) + 1);
    const region = (entry.REGION || "Sin región").trim() || "Sin región";
    regions.set(region, (regions.get(region) || 0) + 1);
    const key = `${mexicoCityWeekday(entry.CREATED_AT)}-${mexicoCityHour(entry.CREATED_AT)}`;
    heat.set(key, (heat.get(key) || 0) + 1);
  }

  const appMix = Array.from(apps.entries())
    .map(([id, count]) => ({ id, label: SO_APP_LABELS[id] || id, count }))
    .sort((a, b) => b.count - a.count);

  const regionMix = Array.from(regions.entries())
    .map(([id, count]) => ({ id, label: id, count }))
    .sort((a, b) => b.count - a.count);

  const heatmap: HeatCell[] = [];
  for (const [key, count] of heat.entries()) {
    const [weekday, hour] = key.split("-").map(Number);
    heatmap.push({ weekday, hour, count });
  }

  return { appMix, regionMix, heatmap };
}

export function buildQuietUsers(
  users: Array<{
    correo: string;
    nombre: string | null;
    sucursal: string | null;
    lastLogin: string | null;
    activo?: string | boolean | null;
  }>,
  lastAccessByEmail: Map<string, string>,
): QuietSucursal[] {
  const cutoff = cutoffIso(QUIET_DAYS);
  const groups = new Map<string, QuietUser[]>();

  for (const user of users) {
    const activo = user.activo;
    if (activo === false || String(activo || "SI").toUpperCase() === "NO") continue;
    const email = user.correo.trim().toLowerCase();
    if (!email) continue;
    const last = lastAccessByEmail.get(email) || user.lastLogin;
    if (last && last >= cutoff) continue;
    const sucursal = (user.sucursal || "").trim() || "Sin sucursal";
    const list = groups.get(sucursal) || [];
    list.push({
      correo: email,
      nombre: user.nombre,
      lastLogin: last || null,
    });
    groups.set(sucursal, list);
  }

  return Array.from(groups.entries())
    .map(([sucursal, list]) => ({
      sucursal,
      count: list.length,
      users: list.sort((a, b) => (a.lastLogin || "").localeCompare(b.lastLogin || "")),
    }))
    .sort((a, b) => b.count - a.count || a.sucursal.localeCompare(b.sucursal, "es"));
}

export function buildFailureInsights(rows: FailureEntry[]): AccessInsights["failures"] {
  const byDay = new Map<string, FailureDay>();
  let typo = 0;
  let similar = 0;
  let unrelated = 0;
  let unknownEmail = 0;
  let inactive = 0;

  for (const row of rows) {
    if (row.CLOSENESS === "typo") typo += 1;
    else if (row.CLOSENESS === "similar") similar += 1;
    else if (row.CLOSENESS === "unrelated") unrelated += 1;
    if (row.REASON === "unknown_email") unknownEmail += 1;
    if (row.REASON === "inactive") inactive += 1;

    const date = mexicoCityDateKey(row.CREATED_AT);
    if (!byDay.has(date)) {
      byDay.set(date, { date, label: formatDayLabel(date), count: 0, entries: [] });
    }
    const bucket = byDay.get(date)!;
    bucket.count += 1;
    bucket.entries.push(row);
  }

  return {
    total: rows.length,
    typo,
    similar,
    unrelated,
    unknownEmail,
    inactive,
    days: Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date)),
  };
}
