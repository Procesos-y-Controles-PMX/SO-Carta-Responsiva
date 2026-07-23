-- Carta Responsiva — normalized unique names for cr_responsables.
-- Safe to run repeatedly in the Supabase SQL editor.
--
-- Prevents duplicates that only differ by case, accents, or whitespace.
-- Near-duplicates with different surnames (e.g. short vs full name) are NOT merged.

create extension if not exists unaccent with schema extensions;

create or replace function public.cr_normalize_person_name(value text)
returns text
language sql
stable
parallel safe
as $$
  select upper(
    trim(
      both from regexp_replace(
        extensions.unaccent(coalesce(value, '')),
        '\s+',
        ' ',
        'g'
      )
    )
  );
$$;

alter table cr_responsables
  add column if not exists nombre_normalizado text;

update cr_responsables
set nombre_normalizado = public.cr_normalize_person_name(nombre)
where nombre_normalizado is distinct from public.cr_normalize_person_name(nombre);

-- Merge exact normalized duplicates: keep survivor (most cartas, then longest name, then oldest).
do $$
declare
  grp record;
  survivor_id uuid;
  loser_ids uuid[];
begin
  for grp in
    select id_sucursal, nombre_normalizado
    from cr_responsables
    where nombre_normalizado is not null and nombre_normalizado <> ''
    group by id_sucursal, nombre_normalizado
    having count(*) > 1
  loop
    select r.id into survivor_id
    from cr_responsables r
    left join cr_cartas c on c.id_responsable = r.id
    where r.id_sucursal = grp.id_sucursal
      and r.nombre_normalizado = grp.nombre_normalizado
    group by r.id, r.nombre, r.created_at
    order by
      count(c.id) desc,
      char_length(r.nombre) desc,
      r.created_at asc
    limit 1;

    select array_agg(r.id) into loser_ids
    from cr_responsables r
    where r.id_sucursal = grp.id_sucursal
      and r.nombre_normalizado = grp.nombre_normalizado
      and r.id <> survivor_id;

    if loser_ids is null or array_length(loser_ids, 1) is null then
      continue;
    end if;

    update cr_cartas
    set id_responsable = survivor_id
    where id_responsable = any (loser_ids);

    delete from cr_responsables
    where id = any (loser_ids);
  end loop;
end $$;

update cr_responsables
set nombre_normalizado = public.cr_normalize_person_name(nombre)
where nombre_normalizado is null or nombre_normalizado = '';

alter table cr_responsables
  alter column nombre_normalizado set not null;

create or replace function public.cr_responsables_set_nombre_normalizado()
returns trigger
language plpgsql
as $$
begin
  new.nombre := upper(
    trim(both from regexp_replace(coalesce(new.nombre, ''), '\s+', ' ', 'g'))
  );
  new.nombre_normalizado := public.cr_normalize_person_name(new.nombre);
  return new;
end;
$$;

drop trigger if exists cr_responsables_nombre_normalizado_trg on cr_responsables;
create trigger cr_responsables_nombre_normalizado_trg
before insert or update of nombre on cr_responsables
for each row
execute function public.cr_responsables_set_nombre_normalizado();

create unique index if not exists cr_responsables_sucursal_nombre_norm_uidx
  on cr_responsables (id_sucursal, nombre_normalizado);

-- Legacy literal unique remains as a secondary guard for identical strings.
-- Normalized index is the real uniqueness rule.

notify pgrst, 'reload schema';
