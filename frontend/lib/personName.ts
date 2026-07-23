/** Collapse whitespace; trim. */
export function cleanPersonName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Canonical uniqueness key for responsables: clean → strip accents → uppercase.
 * Matches scripts/import-access-workbook.py `normalized()` and import-master-data `identity()`.
 */
export function normalizePersonName(value: string): string {
  const cleaned = cleanPersonName(value);
  const decomposed = cleaned.normalize("NFD");
  const withoutDiacritics = decomposed.replace(/\p{M}/gu, "");
  return withoutDiacritics.toLocaleUpperCase("es-MX");
}

/** Display/storage form for new writes (aligned with SAP workbook imports). */
export function canonicalizePersonName(value: string): string {
  return normalizePersonName(value);
}
