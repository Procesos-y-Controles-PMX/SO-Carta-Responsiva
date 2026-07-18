export const MODULE_ORDER: readonly string[] = [
  "/cartas",
  "/cartas/nueva",
  "/catalogo",
  "/responsables",
  "/cumplimiento",
];

export function moduleIndexForPath(pathname: string): number {
  let bestIndex = -1;
  let bestLen = -1;
  MODULE_ORDER.forEach((href, index) => {
    if (
      (pathname === href || pathname.startsWith(`${href}/`)) &&
      href.length > bestLen
    ) {
      bestIndex = index;
      bestLen = href.length;
    }
  });
  return bestIndex;
}
