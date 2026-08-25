import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccessDayBucket, AccessLogRow, SoAppId } from "@/lib/so-access-apps";

export type { AccessDayBucket, AccessLogRow, SoAppId } from "@/lib/so-access-apps";
export { SO_APP_LABELS } from "@/lib/so-access-apps";

export type AccessMethod = "credentials" | "portal-handoff";

function uuidOrNull(value?: string | null): string | null {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export type AccessLogInput = {
  app: SoAppId;
  userId?: string | null;
  correo: string;
  nombre?: string | null;
  method: AccessMethod;
  ip?: string | null;
  userAgent?: string | null;
};

const MX_TZ = "America/Mexico_City";

export function clientMetaFromRequest(request: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null;
  return { ip, userAgent: request.headers.get("user-agent") };
}

function equipoClient(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL_EQUIPO || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_EQUIPO || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function missingEquipoAccessLogEnv(): string[] {
  const missing: string[] = [];
  if (!(process.env.SUPABASE_URL_EQUIPO || "").trim()) missing.push("SUPABASE_URL_EQUIPO");
  if (!(process.env.SUPABASE_SERVICE_ROLE_EQUIPO || "").trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_EQUIPO");
  }
  return missing;
}

/**
 * Persist a successful login into Equipo Móvil APP_ACCESS_LOG.
 * Never throws — auth must not fail if logging fails.
 */
export async function logSoAccess(input: AccessLogInput): Promise<void> {
  const correo = (input.correo || "").trim();
  if (!correo) return;

  try {
    const supabase = equipoClient();
    if (!supabase) return;

    const payload = {
      USER_ID: uuidOrNull(input.userId),
      CORREO: correo,
      NOMBRE: input.nombre?.trim() || null,
      APP: input.app,
      METHOD: input.method,
      IP: input.ip ?? null,
      USER_AGENT: input.userAgent ?? null,
      CREATED_AT: new Date().toISOString(),
    };

    const { error } = await supabase.from("APP_ACCESS_LOG").insert(payload);
    if (error) {
      const { NOMBRE: _nombre, APP: _app, ...legacy } = payload;
      const retry = await supabase.from("APP_ACCESS_LOG").insert(legacy);
      if (retry.error) {
        console.error("[access-log] insert failed:", retry.error.message);
      }
    }
  } catch (err) {
    console.error(
      "[access-log] unexpected error:",
      err instanceof Error ? err.message : err,
    );
  }
}

function mexicoCityDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MX_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function formatDayLabel(dateKey: string): string {
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

function rangeStartIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - 12 * 60 * 60 * 1000).toISOString();
}

export async function fetchSoAccessLogs(opts: {
  days: number;
  search?: string;
  app?: string;
}): Promise<
  | { ok: true; days: AccessDayBucket[]; total: number; rangeDays: number }
  | { ok: false; message: string }
> {
  const supabase = equipoClient();
  if (!supabase) {
    const missing = missingEquipoAccessLogEnv();
    return {
      ok: false,
      message:
        missing.length > 0
          ? `Faltan variables: ${missing.join(", ")}.`
          : "Logs de acceso no configurados.",
    };
  }

  const days = Number.isFinite(opts.days) ? Math.min(Math.max(opts.days, 1), 90) : 14;
  const search = (opts.search || "").trim();
  const app = (opts.app || "").trim().toLowerCase();

  const fullSelect = "ID, USER_ID, CORREO, NOMBRE, APP, METHOD, IP, USER_AGENT, CREATED_AT";
  const legacySelect = "ID, USER_ID, CORREO, METHOD, IP, USER_AGENT, CREATED_AT";

  const run = (select: string, withAppFilter: boolean) => {
    let query = supabase
      .from("APP_ACCESS_LOG")
      .select(select)
      .gte("CREATED_AT", rangeStartIso(days))
      .order("CREATED_AT", { ascending: false })
      .limit(2000);
    if (search) query = query.ilike("CORREO", `%${search}%`);
    if (withAppFilter && app && app !== "todas") query = query.eq("APP", app);
    return query;
  };

  let { data, error } = await run(fullSelect, true);
  if (error) {
    const fallback = await run(legacySelect, false);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    console.error("[access-logs]", error.message);
    return { ok: false, message: "No se pudieron cargar los logs de acceso." };
  }

  const wantedApp = app && app !== "todas" ? app : null;
  const wantedSearch = search.toLowerCase();
  const rows = ((data || []) as unknown as AccessLogRow[]).filter((row) => {
    const appId = (row.APP || "equipo").toLowerCase();
    if (wantedApp && appId !== wantedApp) return false;
    if (!wantedSearch) return true;
    return `${row.CORREO} ${row.NOMBRE || ""}`.toLowerCase().includes(wantedSearch);
  });
  const byDay = new Map<string, AccessDayBucket>();

  for (const row of rows) {
    const date = mexicoCityDateKey(row.CREATED_AT);
    if (!byDay.has(date)) {
      byDay.set(date, { date, label: formatDayLabel(date), count: 0, entries: [] });
    }
    const bucket = byDay.get(date)!;
    bucket.count += 1;
    bucket.entries.push({ ...row, APP: row.APP || "equipo" });
  }

  const todayKey = mexicoCityDateKey(new Date().toISOString());
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const minDate = new Date(Date.UTC(ty, tm - 1, td - (days - 1)));
  const minKey = minDate.toISOString().slice(0, 10);

  const dayList = Array.from(byDay.values())
    .filter((d) => d.date >= minKey)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    ok: true,
    days: dayList,
    total: dayList.reduce((sum, d) => sum + d.count, 0),
    rangeDays: days,
  };
}
