import { readFile } from "node:fs/promises";

const [sucursalesPath, responsablesPath] = process.argv.slice(2);
const dryRun = process.argv.includes("--dry-run");

if (!sucursalesPath || !responsablesPath) {
  console.error(
    "Uso: node scripts/import-master-data.mjs <sucursales.csv> <responsables.csv> [--dry-run]",
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);

  const [headers, ...values] = rows;
  return values.map((valuesRow) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), valuesRow[index] ?? ""]),
    ),
  );
}

function clean(value) {
  return String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
}

function responsibleName(value) {
  return clean(value).toLocaleUpperCase("es-MX");
}

function identity(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-MX");
}

async function request(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${path}: ${await response.text()}`);
  }

  const responseBody = await response.text();
  return responseBody ? JSON.parse(responseBody) : null;
}

const sucursalesCsv = parseCsv(await readFile(sucursalesPath, "utf8"));
const responsablesCsv = parseCsv(await readFile(responsablesPath, "utf8"));

const sucursales = sucursalesCsv.map((row) => ({
  nombre: clean(row.Sucursal),
  codigo_sap: clean(row.Centro).toLocaleUpperCase("es-MX"),
  prefijo_folio: clean(row.Centro).toLocaleUpperCase("es-MX"),
  region: clean(row.Region) || null,
  iva_porcentaje: Number(clean(row.IVA)) || 16,
  ciudad: clean(row.Ciudad) || null,
  direccion: clean(row.Direccion) || null,
}));

const invalidSucursales = sucursales.filter(
  (sucursal) => !sucursal.nombre || !sucursal.codigo_sap,
);
const duplicateCenters = sucursales.filter(
  (sucursal, index) =>
    sucursales.findIndex((item) => item.codigo_sap === sucursal.codigo_sap) !==
    index,
);

if (invalidSucursales.length || duplicateCenters.length) {
  console.error("El archivo de sucursales contiene filas inválidas o duplicadas.");
  console.error({ invalidSucursales, duplicateCenters });
  process.exit(1);
}

const knownCenters = new Set(sucursales.map((sucursal) => sucursal.codigo_sap));
const seenResponsables = new Set();
const responsables = [];
const unmatched = [];
let duplicatesRemoved = 0;

for (const row of responsablesCsv) {
  const codigoSap = clean(row.Centro).toLocaleUpperCase("es-MX");
  const nombre = responsibleName(row.Nombre);

  if (!codigoSap || !nombre) continue;
  if (!knownCenters.has(codigoSap)) {
    unmatched.push({ codigo_sap: codigoSap, nombre });
    continue;
  }

  const key = `${codigoSap}:${identity(nombre)}`;
  if (seenResponsables.has(key)) {
    duplicatesRemoved += 1;
    continue;
  }

  seenResponsables.add(key);
  responsables.push({ codigo_sap: codigoSap, nombre });
}

console.log(`Sucursales válidas: ${sucursales.length}`);
console.log(`Responsables válidos: ${responsables.length}`);
console.log(`Duplicados eliminados: ${duplicatesRemoved}`);
console.log(`Responsables sin sucursal: ${unmatched.length}`);
for (const item of unmatched) {
  console.log(`  - ${item.codigo_sap}: ${item.nombre}`);
}

if (dryRun) process.exit(0);

const storedSucursales = await request(
  "cr_sucursales?on_conflict=nombre&select=id,codigo_sap",
  {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(sucursales),
  },
);

const branchIdByCenter = new Map(
  storedSucursales.map((sucursal) => [sucursal.codigo_sap, sucursal.id]),
);
const branchIds = [...branchIdByCenter.values()];

await request(
  `cr_responsables?id_sucursal=in.(${branchIds.join(",")})`,
  {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ activo: false }),
  },
);

const existing = await request(
  `cr_responsables?id_sucursal=in.(${branchIds.join(",")})&select=id,id_sucursal,nombre`,
);
const existingByKey = new Map(
  existing.map((item) => [
    `${item.id_sucursal}:${identity(item.nombre)}`,
    item,
  ]),
);
const inserts = [];
let reactivated = 0;

for (const responsable of responsables) {
  const branchId = branchIdByCenter.get(responsable.codigo_sap);
  const existingItem = existingByKey.get(
    `${branchId}:${identity(responsable.nombre)}`,
  );

  if (existingItem) {
    await request(`cr_responsables?id=eq.${existingItem.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ nombre: responsable.nombre, activo: true }),
    });
    reactivated += 1;
  } else {
    inserts.push({
      id_sucursal: branchId,
      nombre: responsable.nombre,
      activo: true,
    });
  }
}

for (let index = 0; index < inserts.length; index += 200) {
  await request("cr_responsables", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(inserts.slice(index, index + 200)),
  });
}

console.log(`Sucursales sincronizadas: ${storedSucursales.length}`);
console.log(`Responsables reactivados: ${reactivated}`);
console.log(`Responsables insertados: ${inserts.length}`);
