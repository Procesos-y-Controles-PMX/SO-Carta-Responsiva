-- Carta Responsiva — three-role access and branch manager data.
-- Safe to run repeatedly in the Supabase SQL editor.

alter table cr_sucursales add column if not exists estado text;
alter table cr_sucursales add column if not exists gerente_nombre text;
alter table cr_sucursales add column if not exists gerente_celular text;
alter table cr_sucursales add column if not exists gerente_email text;

alter table cr_usuarios add column if not exists region text;
alter table cr_usuarios drop constraint if exists cr_usuarios_rol_check;

update cr_usuarios
set rol = 'administrador_general'
where rol = 'admin';

update cr_usuarios
set rol = 'usuario'
where rol = 'operador';

alter table cr_usuarios add constraint cr_usuarios_rol_check
  check (rol in ('usuario', 'administrador_zona', 'administrador_general'));

create unique index if not exists cr_sucursales_codigo_sap_uidx
  on cr_sucursales (codigo_sap)
  where codigo_sap is not null;

notify pgrst, 'reload schema';
