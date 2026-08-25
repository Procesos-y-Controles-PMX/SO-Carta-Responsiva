export type AccessMethod = "credentials" | "portal-handoff";

export type SoAppId =
  | "equipo"
  | "cotizador"
  | "permisos"
  | "carta-responsiva"
  | "conteos"
  | "carta-porte";

export const SO_APP_LABELS: Record<string, string> = {
  equipo: "Equipo Móvil",
  cotizador: "Cotizador",
  permisos: "Permisos",
  "carta-responsiva": "Cartas Responsivas",
  conteos: "Conteos",
  "carta-porte": "Carta Porte",
};

export type AccessLogRow = {
  ID: string;
  USER_ID: string | null;
  CORREO: string;
  NOMBRE: string | null;
  APP: string;
  METHOD: string;
  IP: string | null;
  USER_AGENT: string | null;
  CREATED_AT: string;
  UBICACION?: string | null;
  REGION?: string | null;
};

export type AccessDayBucket = {
  date: string;
  label: string;
  count: number;
  entries: AccessLogRow[];
};
