/** Allowed U.M. values for catálogo (SAP-style codes used in Promexma). */
export const UNIDAD_MEDIDA_OPTIONS = [
  { value: "PZA", label: "PZA — Pieza" },
  { value: "SACO", label: "SACO — Saco" },
  { value: "TN", label: "TN — Tonelada" },
  { value: "KG", label: "KG — Kilogramo" },
  { value: "M", label: "M — Metro" },
  { value: "M2", label: "M2 — Metro cuadrado" },
  { value: "M3", label: "M3 — Metro cúbico" },
  { value: "LT", label: "LT — Litro" },
  { value: "CUB", label: "CUB — Cubeta" },
  { value: "CJ", label: "CJ — Caja" },
  { value: "ROL", label: "ROL — Rollo" },
] as const;

export type UnidadMedidaCode = (typeof UNIDAD_MEDIDA_OPTIONS)[number]["value"];

const ALLOWED = new Set<string>(UNIDAD_MEDIDA_OPTIONS.map((o) => o.value));

export function isAllowedUnidadMedida(value: string | null | undefined): boolean {
  if (value == null || value.trim() === "") return true;
  return ALLOWED.has(value.trim().toUpperCase());
}

export function normalizeUnidadMedida(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toUpperCase() ?? "";
  return trimmed || null;
}

/** Options for a select; includes legacy values so existing rows stay editable. */
export function unidadMedidaSelectOptions(current?: string | null) {
  const options = UNIDAD_MEDIDA_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  const legacy = normalizeUnidadMedida(current);
  if (legacy && !ALLOWED.has(legacy)) {
    options.unshift({ value: legacy, label: `${legacy} — (actual)` });
  }
  return options;
}
