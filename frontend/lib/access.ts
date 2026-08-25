import type { CrSucursal, CrUsuario, UserRole } from "./types/db";

export const ROLE_LABELS: Record<UserRole, string> = {
  usuario: "Usuario",
  administrador_zona: "Administrador de zona",
  administrador_general: "Administrador general",
};

/** Only these accounts may act as administrador general (Catálogo, Responsables, delete, all sucursales). */
export const GENERAL_ADMIN_EMAILS = [
  "fernando.corella@ext.cemex.com",
] as const;

const GENERAL_ADMIN_EMAIL_SET = new Set(
  GENERAL_ADMIN_EMAILS.map((email) => email.toLowerCase()),
);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowlistedGeneralAdmin(user: Pick<CrUsuario, "email">): boolean {
  return GENERAL_ADMIN_EMAIL_SET.has(normalizeEmail(user.email));
}

/**
 * Effective role for session/UI/permissions.
 * Allowlisted emails are always general admin; otherwise the DB role is trusted
 * so accounts created from Usuarios can sign in with the role they were given.
 */
export function resolveEffectiveRole(user: Pick<CrUsuario, "email" | "rol">): UserRole {
  if (isAllowlistedGeneralAdmin(user)) return "administrador_general";

  const legacy = user.rol as string;
  if (legacy === "administrador_zona") return "administrador_zona";
  if (legacy === "administrador_general" || legacy === "admin") return "administrador_general";
  if (legacy === "operador") return "usuario";
  return "usuario";
}

export function normalizeAccessUser<T extends CrUsuario>(user: T): T {
  return {
    ...user,
    rol: resolveEffectiveRole(user),
    region: user.region ?? null,
  };
}

export function normalizeRegion(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("es-MX");
}

export function isGeneralAdmin(user: CrUsuario): boolean {
  return resolveEffectiveRole(user) === "administrador_general";
}

export function isZoneAdmin(user: CrUsuario): boolean {
  return resolveEffectiveRole(user) === "administrador_zona";
}

/** Any signed-in user may open Cumplimiento; rows are scoped by sucursal/region. */
export function canViewCompliance(_user: CrUsuario): boolean {
  return true;
}

export function canManageMasterData(user: CrUsuario): boolean {
  return isGeneralAdmin(user);
}

export function canGenerateCartas(user: CrUsuario): boolean {
  return !isZoneAdmin(user);
}

export function canEditCartas(user: CrUsuario): boolean {
  return !isZoneAdmin(user);
}

/** Destructive: only general admins may remove cartas from historial. */
export function canDeleteCartas(user: CrUsuario): boolean {
  return isGeneralAdmin(user);
}

export function userCanAccessSucursal(
  user: CrUsuario,
  sucursal: Pick<CrSucursal, "id" | "region">,
): boolean {
  if (isGeneralAdmin(user)) return true;
  if (isZoneAdmin(user)) {
    return (
      Boolean(user.region) &&
      normalizeRegion(user.region) === normalizeRegion(sucursal.region)
    );
  }
  return user.id_sucursal === sucursal.id;
}

export function scopeSucursales(
  user: CrUsuario,
  sucursales: CrSucursal[],
): CrSucursal[] {
  return sucursales.filter((sucursal) => userCanAccessSucursal(user, sucursal));
}
