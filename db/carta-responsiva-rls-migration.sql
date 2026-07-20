-- Carta Responsiva — lock down cr_* tables from browser (anon/authenticated).
-- Next.js APIs use the service role key, which bypasses RLS.
-- Safe to run repeatedly in the Supabase SQL editor.

alter table cr_sucursales enable row level security;
alter table cr_usuarios enable row level security;
alter table cr_responsables enable row level security;
alter table cr_catalogo enable row level security;
alter table cr_cartas enable row level security;
alter table cr_carta_items enable row level security;

-- Drop any prior permissive policies if they exist (idempotent).
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename like 'cr_%'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- No policies for anon / authenticated → PostgREST returns zero rows for browser keys.
-- Service role continues to bypass RLS for authenticated Next.js API routes.

notify pgrst, 'reload schema';
