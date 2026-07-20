import type { CrSucursal, CrUsuario, UserRole } from "./types/db";

export const ROLE_LABELS: Record<UserRole, string> = {
  usuario: "Usuario",
  administrador_zona: "Administrador de zona",
  administrador_general: "Administrador general",
};

export function normalizeRegion(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("es-MX");
}

export function isGeneralAdmin(user: CrUsuario): boolean {
  return user.rol === "administrador_general";
}

export function isZoneAdmin(user: CrUsuario): boolean {
  return user.rol === "administrador_zona";
}

export function canViewCompliance(user: CrUsuario): boolean {
  return isGeneralAdmin(user) || isZoneAdmin(user);
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
