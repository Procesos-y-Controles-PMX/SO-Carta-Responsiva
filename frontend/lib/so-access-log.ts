import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccessDayBucket, AccessLogRow, SoAppId } from "@/lib/so-access-apps";
import {
  buildFailureInsights,
  buildMixAndHeatmap,
  buildQuietUsers,
  formatLocation,
  type AccessInsights,
  type FailureEntry,
} from "@/lib/access-insights";

export type { AccessDayBucket, AccessLogRow, SoAppId } from "@/lib/so-access-apps";
export type { AccessInsights } from "@/lib/access-insights";
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

type AccessProfile = { nombre: string | null; ubicacion: string | null };

function rememberProfile(
  map: Map<string, AccessProfile>,
  email: unknown,
  nombre: unknown,
  ubicacion: string | null,
) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return;
  const current = map.get(e) ?? { nombre: null, ubicacion: null };
  const n = String(nombre ?? "").trim();
  if (n && !current.nombre) current.nombre = n;
  if (ubicacion && !current.ubicacion) current.ubicacion = ubicacion;
  map.set(e, current);
}

function cpClient(): SupabaseClient | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function profilesByEmail(equipo: SupabaseClient): Promise<Map<string, AccessProfile>> {
  const map = new Map<string, AccessProfile>();
  const { data: equipoUsers } = await equipo
    .from("APP_USERS")
    .select("CORREO, NOMBRE, REGION, SUCURSAL, CENTRO");
  for (const row of equipoUsers || []) {
    rememberProfile(
      map,
      row.CORREO,
      row.NOMBRE,
      formatLocation(row.REGION, row.SUCURSAL, row.CENTRO),
    );
  }

  const cp = cpClient();
  if (!cp) return map;
  const [carta, cotizador, permisos] = await Promise.all([
    cp.from("cr_usuarios").select("email, nombre_completo, region"),
    cp.from("ctz_usuarios").select("email, nombre_completo"),
    cp.from("perfiles").select("email, nombre_completo"),
  ]);
  for (const row of carta.data || []) {
    rememberProfile(map, row.email, row.nombre_completo, formatLocation(row.region));
  }
  for (const row of cotizador.data || []) rememberProfile(map, row.email, row.nombre_completo, null);
  for (const row of permisos.data || []) rememberProfile(map, row.email, row.nombre_completo, null);
  return map;
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

export type FailedAccessInput = {
  correo: string;
  nombre?: string | null;
  app: SoAppId;
  method?: AccessMethod;
  reason: "unknown_email" | "inactive" | "wrong_password" | "missing_fields" | "handoff_invalid";
  closeness?: string | null;
  distance?: number | null;
  attemptLen?: number | null;
  hint?: string | null;
  region?: string | null;
  sucursal?: string | null;
  centro?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export async function logSoFailedAccess(input: FailedAccessInput): Promise<void> {
  const correo = (input.correo || "").trim().toLowerCase();
  if (!correo && input.reason !== "missing_fields") return;

  try {
    const supabase = equipoClient();
    if (!supabase) return;

    let nombre = input.nombre?.trim() || null;
    let region = input.region?.trim() || null;
    let sucursal = input.sucursal?.trim() || null;
    let centro = input.centro?.trim() || null;

    if (correo && (!nombre || !region)) {
      const { data: named } = await supabase
        .from("APP_USERS")
        .select("NOMBRE, REGION, SUCURSAL, CENTRO")
        .ilike("CORREO", correo)
        .maybeSingle();
      if (named) {
        nombre = nombre || String(named.NOMBRE ?? "").trim() || null;
        region = region || String(named.REGION ?? "").trim() || null;
        sucursal = sucursal || String(named.SUCURSAL ?? "").trim() || null;
        centro = centro || String(named.CENTRO ?? "").trim() || null;
      }
    }

    const { error } = await supabase.from("APP_LOGIN_FAILURE").insert({
      CORREO: correo || "(vacío)",
      NOMBRE: nombre,
      APP: input.app,
      METHOD: input.method || "credentials",
      REASON: input.reason,
      CLOSENESS: input.closeness || null,
      DISTANCE: input.distance ?? null,
      ATTEMPT_LEN: input.attemptLen ?? null,
      HINT: input.hint || null,
      REGION: region,
      SUCURSAL: sucursal,
      CENTRO: centro,
      IP: input.ip ?? null,
      USER_AGENT: input.userAgent ?? null,
      CREATED_AT: new Date().toISOString(),
    });
    if (error) console.error("[access-log] failure insert failed:", error.message);
  } catch (err) {
    console.error(
      "[access-log] failure unexpected error:",
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

async function loadAccessInsights(
  supabase: SupabaseClient,
  entries: AccessLogRow[],
  days: number,
  wantedApp: string | null,
  profiles: Map<string, AccessProfile>,
): Promise<AccessInsights> {
  const mix = buildMixAndHeatmap(
    entries.map((entry) => ({
      APP: entry.APP,
      REGION: (entry.UBICACION || "").split(" · ")[0] || "Sin región",
      CREATED_AT: entry.CREATED_AT,
    })),
  );

  const { data: users } = await supabase
    .from("APP_USERS")
    .select("CORREO, NOMBRE, SUCURSAL, LAST_LOGIN, ACTIVO");
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("APP_ACCESS_LOG")
    .select("CORREO, CREATED_AT")
    .gte("CREATED_AT", since90)
    .order("CREATED_AT", { ascending: false })
    .limit(8000);
  const lastByEmail = new Map<string, string>();
  for (const row of recent || []) {
    const email = String(row.CORREO || "").trim().toLowerCase();
    if (email && !lastByEmail.has(email)) lastByEmail.set(email, row.CREATED_AT);
  }
  const quiet = buildQuietUsers(
    (users || []).map((u) => ({
      correo: String(u.CORREO || ""),
      nombre: u.NOMBRE || null,
      sucursal: u.SUCURSAL || null,
      lastLogin: u.LAST_LOGIN || null,
      activo: u.ACTIVO,
    })),
    lastByEmail,
  );

  let failureRows: FailureEntry[] = [];
  let failQuery = supabase
    .from("APP_LOGIN_FAILURE")
    .select(
      "ID, CORREO, NOMBRE, APP, METHOD, REASON, CLOSENESS, DISTANCE, ATTEMPT_LEN, HINT, REGION, SUCURSAL, CENTRO, IP, USER_AGENT, CREATED_AT",
    )
    .gte("CREATED_AT", rangeStartIso(days))
    .order("CREATED_AT", { ascending: false })
    .limit(2000);
  if (wantedApp) failQuery = failQuery.eq("APP", wantedApp);
  const failRes = await failQuery;
  if (!failRes.error) {
    failureRows = (failRes.data || []).map((row) => {
      const email = String(row.CORREO || "").trim().toLowerCase();
      const profile = profiles.get(email);
      return {
        ID: row.ID,
        CORREO: row.CORREO,
        NOMBRE: row.NOMBRE || profile?.nombre || null,
        APP: row.APP || "equipo",
        METHOD: row.METHOD,
        REASON: row.REASON,
        CLOSENESS: row.CLOSENESS,
        DISTANCE: row.DISTANCE,
        ATTEMPT_LEN: row.ATTEMPT_LEN,
        HINT: row.HINT,
        UBICACION:
          formatLocation(row.REGION, row.SUCURSAL, row.CENTRO) || profile?.ubicacion || null,
        IP: row.IP,
        USER_AGENT: row.USER_AGENT,
        CREATED_AT: row.CREATED_AT,
      };
    });
  }

  return { ...mix, quiet, failures: buildFailureInsights(failureRows) };
}

export async function fetchSoAccessLogs(opts: {
  days: number;
  search?: string;
  app?: string;
}): Promise<
  | { ok: true; days: AccessDayBucket[]; total: number; rangeDays: number; insights: AccessInsights }
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
  const profiles = await profilesByEmail(supabase);
  const byDay = new Map<string, AccessDayBucket>();

  for (const row of (data || []) as unknown as AccessLogRow[]) {
    const appId = (row.APP || "equipo").toLowerCase();
    if (wantedApp && appId !== wantedApp) continue;
    const profile = profiles.get(row.CORREO.trim().toLowerCase());
    const entry: AccessLogRow = {
      ...row,
      APP: row.APP || "equipo",
      NOMBRE: row.NOMBRE?.trim() || profile?.nombre || null,
      UBICACION: profile?.ubicacion || null,
    };
    if (
      wantedSearch &&
      !`${entry.CORREO} ${entry.NOMBRE || ""} ${entry.UBICACION || ""}`.toLowerCase().includes(wantedSearch)
    ) {
      continue;
    }
    const date = mexicoCityDateKey(row.CREATED_AT);
    if (!byDay.has(date)) {
      byDay.set(date, { date, label: formatDayLabel(date), count: 0, entries: [] });
    }
    const bucket = byDay.get(date)!;
    bucket.count += 1;
    bucket.entries.push(entry);
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
    insights: await loadAccessInsights(
      supabase,
      dayList.flatMap((d) => d.entries),
      days,
      wantedApp,
      profiles,
    ),
  };
}
