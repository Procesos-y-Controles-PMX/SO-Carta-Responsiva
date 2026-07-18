# Carta Responsiva

Aplicación web para generar cartas responsivas (Mercancía Abordo) en el ecosistema SO Portal.

## Stack

- Next.js + TypeScript + Tailwind + Supabase JS
- PDF: `@react-pdf/renderer`
- Auth: SO Portal handoff (`app=carta-responsiva`) o login local

## Arranque

```bash
cd carta-responsiva/frontend
npm install
npm run dev
```

App en **http://localhost:3002**

## Variables de entorno

En `carta-responsiva/frontend/.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORTAL_HANDOFF_SECRET` (producción con portal)
- `NEXT_PUBLIC_PORTAL_URL` (opcional — redirige login al portal)

## Base de datos

Ejecutar [`../db/carta-responsiva-schema.sql`](../db/carta-responsiva-schema.sql) en Supabase.

## Rutas

| Ruta | Rol | Descripción |
|------|-----|-------------|
| `/cartas` | todos | Historial de cartas |
| `/cartas/nueva` | todos | Crear carta + PDF |
| `/cartas/[id]` | todos | Editar carta |
| `/cartas/[id]/pdf` | todos | Vista previa PDF |
| `/catalogo` | admin | Catálogo por sucursal |
| `/responsables` | admin | Responsables por sucursal |
| `/cumplimiento` | admin | Quién generó / quién no |

## Documentación

- [Product brief](../docs/carta-responsiva-brief.md)
- [Data requests](../docs/carta-responsiva-data-requests.md)
