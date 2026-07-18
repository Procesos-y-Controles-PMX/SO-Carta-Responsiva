-- Carta Responsiva (Market Abordo) — Supabase schema
-- Prefix: cr_*
-- Run in Supabase SQL editor after review.

create extension if not exists "pgcrypto";

create table if not exists cr_sucursales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  codigo_sap text unique,
  prefijo_folio text not null,
  region text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cr_usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  nombre_completo text,
  rol text not null check (rol in ('admin', 'operador')),
  id_sucursal uuid references cr_sucursales (id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cr_responsables (
  id uuid primary key default gen_random_uuid(),
  id_sucursal uuid not null references cr_sucursales (id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id_sucursal, nombre)
);

create table if not exists cr_catalogo (
  id uuid primary key default gen_random_uuid(),
  id_sucursal uuid not null references cr_sucursales (id) on delete cascade,
  codigo text not null,
  descripcion text not null,
  unidad_medida text,
  precio numeric(12, 2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id_sucursal, codigo)
);

create table if not exists cr_cartas (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  id_sucursal uuid not null references cr_sucursales (id),
  id_responsable uuid references cr_responsables (id) on delete set null,
  nombre_responsable text not null,
  id_usuario uuid not null references cr_usuarios (id),
  terminos_snapshot text not null,
  subtotal numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  email_enviado boolean not null default false,
  email_enviado_at timestamptz,
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cr_carta_items (
  id uuid primary key default gen_random_uuid(),
  id_carta uuid not null references cr_cartas (id) on delete cascade,
  id_catalogo uuid references cr_catalogo (id) on delete set null,
  codigo text not null,
  descripcion text not null,
  cantidad numeric(12, 3) not null,
  unidad_medida text,
  precio numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists cr_cartas_sucursal_created_idx on cr_cartas (id_sucursal, created_at desc);
create index if not exists cr_cartas_folio_idx on cr_cartas (folio);
create index if not exists cr_catalogo_sucursal_codigo_idx on cr_catalogo (id_sucursal, codigo);
create index if not exists cr_responsables_sucursal_idx on cr_responsables (id_sucursal);

-- Idempotent migration for databases created from an earlier draft.
alter table cr_sucursales add column if not exists codigo_sap text;
alter table cr_usuarios add column if not exists password_hash text;
alter table cr_cartas add column if not exists terminos_snapshot text;
alter table cr_cartas add column if not exists subtotal numeric(14, 2) not null default 0;
alter table cr_cartas add column if not exists iva numeric(14, 2) not null default 0;
alter table cr_cartas add column if not exists total numeric(14, 2) not null default 0;
alter table cr_cartas add column if not exists email_enviado boolean not null default false;
alter table cr_cartas add column if not exists email_enviado_at timestamptz;
alter table cr_cartas add column if not exists email_error text;

-- Migrate and remove the deprecated plaintext password column when present.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cr_usuarios'
      and column_name = 'password'
  ) then
    execute 'update cr_usuarios
      set password_hash = extensions.crypt(password, extensions.gen_salt(''bf''))
      where password_hash is null and password is not null';
    execute 'alter table cr_usuarios drop column password';
  end if;
end $$;

-- Sample seed (optional — remove in production)
insert into cr_sucursales (nombre, codigo_sap, prefijo_folio, region)
values
  ('Mérida', 'E300', 'MER', 'Sureste'),
  ('Cancún', 'E301', 'CAN', 'Sureste')
on conflict (nombre) do nothing;

insert into cr_responsables (id_sucursal, nombre)
select s.id, r.nombre
from cr_sucursales s
cross join (values ('Alex'), ('Alejandro')) as r(nombre)
where s.nombre = 'Mérida'
on conflict do nothing;

insert into cr_catalogo (id_sucursal, codigo, descripcion, unidad_medida, precio)
select s.id, c.codigo, c.descripcion, c.um, c.precio
from cr_sucursales s
cross join (
  values
    ('AGB001', 'Agro y blanco 5T', 'SACO', 125.50),
    ('CUB001', 'Cubeta plástica', 'PZA', 45.00)
) as c(codigo, descripcion, um, precio)
where s.nombre = 'Mérida'
on conflict do nothing;

insert into cr_usuarios (email, password_hash, nombre_completo, rol)
values
  ('admin@promexma.com', extensions.crypt('changeme', extensions.gen_salt('bf')), null, 'admin'),
  ('operador.merida@promexma.com', extensions.crypt('changeme', extensions.gen_salt('bf')), null, 'admin')
on conflict (email) do nothing;

update cr_usuarios u
set id_sucursal = s.id
from cr_sucursales s
where u.email = 'operador.merida@promexma.com' and s.nombre = 'Mérida';
