-- Carta Responsiva — migration after Power App audit (2026-07-17)
-- Safe to run once on a database created from the original cr_* draft.

create extension if not exists "pgcrypto";

alter table cr_sucursales add column if not exists codigo_sap text;

update cr_sucursales set codigo_sap = 'E300' where nombre = 'Mérida' and codigo_sap is null;
update cr_sucursales set codigo_sap = 'E301' where nombre = 'Cancún' and codigo_sap is null;

alter table cr_usuarios add column if not exists password_hash text;

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

alter table cr_cartas add column if not exists terminos_snapshot text;
alter table cr_cartas add column if not exists subtotal numeric(14, 2) not null default 0;
alter table cr_cartas add column if not exists iva numeric(14, 2) not null default 0;
alter table cr_cartas add column if not exists total numeric(14, 2) not null default 0;
alter table cr_cartas add column if not exists email_enviado boolean not null default false;
alter table cr_cartas add column if not exists email_enviado_at timestamptz;
alter table cr_cartas add column if not exists email_error text;

update cr_cartas c
set
  subtotal = totals.subtotal,
  iva = round(totals.subtotal * 0.16, 2),
  total = totals.subtotal + round(totals.subtotal * 0.16, 2)
from (
  select id_carta, round(sum(cantidad * precio), 2) as subtotal
  from cr_carta_items
  group by id_carta
) totals
where c.id = totals.id_carta
  and c.subtotal = 0;

update cr_cartas
set terminos_snapshot = concat_ws(
  E'\n',
  'Estos productos me han sido entregados con el fin de venderlos entre mis clientes como parte del esquema de "Venta de Material a Bordo".',
  'Al cerrar una venta tengo el compromiso de confirmarlo a mi respectiva sucursal, así como entregar los documentos comprobantes (remisión manual, recibo de caja) y efectivo recibido en el mismo día que se realice.',
  'Los productos no vendidos serán regresados a la sucursal a más tardar el viernes de esta semana.'
)
where terminos_snapshot is null;

alter table cr_cartas alter column terminos_snapshot set not null;
