-- =====================================================================
-- EXPLO · Migración 0004
--  · Datos privados de operadores (DNI, dirección): SOLO administrador
--  · Adjudicación de vehículos (con histórico)
--  · Gestión de multas
--  · Ajustes (contactos de multas)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Datos privados del operador (solo admin, historial propio)
-- ---------------------------------------------------------------------
create table if not exists operador_datos_privados (
  operador_id    uuid primary key references operadores(id) on delete cascade,
  dni            text,
  dni_caducidad  date,
  direccion      text,
  comprobado_el  date,
  a_revisar      boolean not null default false,
  notas          text,
  updated_at     timestamptz not null default now()
);

create table if not exists historial_privado (
  id           bigserial primary key,
  registro_id  text not null,
  accion       text not null,
  antes        jsonb,
  despues      jsonb,
  usuario_id   uuid,
  fecha        timestamptz not null default now()
);

create or replace function fn_historial_privado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into historial_privado (registro_id, accion, antes, despues, usuario_id)
  values (coalesce((case when tg_op='DELETE' then old.operador_id else new.operador_id end)::text,'?'), tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end $$;

drop trigger if exists trg_historial_privado on operador_datos_privados;
create trigger trg_historial_privado after insert or update or delete on operador_datos_privados
  for each row execute function fn_historial_privado();
drop trigger if exists trg_updated_at on operador_datos_privados;
create trigger trg_updated_at before update on operador_datos_privados
  for each row execute function fn_updated_at();

alter table operador_datos_privados enable row level security;
create policy solo_admin on operador_datos_privados for all to authenticated using (es_admin()) with check (es_admin());
alter table historial_privado enable row level security;
create policy solo_admin on historial_privado for select to authenticated using (es_admin());

grant select, insert, update, delete on operador_datos_privados to authenticated;
grant select on historial_privado to authenticated;
grant all on operador_datos_privados, historial_privado to service_role;
grant usage, select on sequence historial_privado_id_seq to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Adjudicación de vehículos (a operador o a equipo), con histórico
-- ---------------------------------------------------------------------
create table if not exists vehiculo_asignaciones (
  id           uuid primary key default gen_random_uuid(),
  vehiculo_id  uuid not null references vehiculos(id),
  operador_id  uuid references operadores(id),
  equipo_id    uuid references equipos(id),
  desde        date not null default current_date,
  hasta        date,
  notas        text,
  created_at   timestamptz not null default now(),
  check (operador_id is not null or equipo_id is not null)
);
create unique index if not exists vehiculo_asignacion_vigente on vehiculo_asignaciones (vehiculo_id) where hasta is null;

-- ---------------------------------------------------------------------
-- 3. Multas
-- ---------------------------------------------------------------------
create table if not exists multas (
  id                    uuid primary key default gen_random_uuid(),
  vehiculo_id           uuid references vehiculos(id),
  matricula             text,
  fecha_infraccion      timestamptz,
  lugar                 text,
  organismo             text,
  expediente            text,
  importe               numeric(10,2),
  puntos                int,
  fecha_notificacion    date,
  plazo_identificacion  date,
  origen                text check (origen in ('pyramid','multas_mediapro','dgt','renting','otro')),
  estado                text not null default 'recibida'
                          check (estado in ('recibida','identificado','comunicada','pagada','cerrada','anulada')),
  via                   text check (via in ('identificacion','paga_conductor')),
  operador_id           uuid references operadores(id),
  conductor_origen      text check (conductor_origen in ('salida','adjudicacion','manual')),
  fecha_identificado    date,
  fecha_comunicada      date,
  fecha_pago            date,
  fecha_cierre          date,
  notas                 text,
  created_by            uuid references perfiles(id) default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists multas_estado on multas (estado);
create index if not exists multas_vehiculo on multas (vehiculo_id, fecha_infraccion);

-- documentos: admitir multas y justificantes
alter table documentos drop constraint if exists documentos_entidad_check;
alter table documentos add constraint documentos_entidad_check
  check (entidad in ('vehiculo','elemento','operador','proveedor','tarjeta','multa'));
alter table documentos drop constraint if exists documentos_tipo_check;
alter table documentos add constraint documentos_tipo_check
  check (tipo in ('multa','justificante_pago','factura','itv','parte_taller','ticket_combustible','contrato','albaran','otro'));

-- ---------------------------------------------------------------------
-- 4. Ajustes generales (p. ej. contactos de multas)
-- ---------------------------------------------------------------------
create table if not exists ajustes (
  clave       text primary key,
  valor       jsonb not null,
  updated_at  timestamptz not null default now()
);
insert into ajustes (clave, valor) values ('multas_contactos', '{
  "para": ["c.crespo@pyramidconsulting.es", "multas@mediapro.tv"],
  "cc":   ["ktsenkova@mediapro.tv", "amonteroa@mediapro.tv"]
}'::jsonb) on conflict (clave) do nothing;

-- RLS, permisos, historial y updated_at de las tablas nuevas
do $$
declare t text;
begin
  foreach t in array array['vehiculo_asignaciones','multas','ajustes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists lectura on %I', t);
    execute format('drop policy if exists alta on %I', t);
    execute format('drop policy if exists edicion on %I', t);
    execute format('drop policy if exists borrado on %I', t);
    execute format('create policy lectura on %I for select to authenticated using (es_usuario_activo())', t);
    execute format('create policy alta on %I for insert to authenticated with check (es_usuario_activo())', t);
    execute format('create policy edicion on %I for update to authenticated using (es_usuario_activo()) with check (es_usuario_activo())', t);
    execute format('create policy borrado on %I for delete to authenticated using (es_admin())', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant all on %I to service_role', t);
  end loop;
  foreach t in array array['vehiculo_asignaciones','multas'] loop
    execute format('drop trigger if exists trg_historial on %I', t);
    execute format('create trigger trg_historial after insert or update or delete on %I for each row execute function fn_historial()', t);
  end loop;
end $$;
drop trigger if exists trg_updated_at on multas;
create trigger trg_updated_at before update on multas for each row execute function fn_updated_at();

-- ---------------------------------------------------------------------
-- 5. ¿Quién conducía? 1º salida con ese coche a esa hora; 2º adjudicación vigente ese día
-- ---------------------------------------------------------------------
create or replace function conductor_probable(p_vehiculo uuid, p_momento timestamptz)
returns table (operador_id uuid, origen text)
language sql stable security invoker set search_path = public as $$
  (select coalesce(s.operador_id, s.operador2_id), 'salida'
     from salidas s
    where s.vehiculo_id = p_vehiculo and s.estado <> 'anulada'
      and s.hora_salida <= p_momento
      and coalesce(s.hora_regreso, s.hora_salida + interval '16 hours') >= p_momento
      and coalesce(s.operador_id, s.operador2_id) is not null
    order by s.hora_salida desc limit 1)
  union all
  (select a.operador_id, 'adjudicacion'
     from vehiculo_asignaciones a
    where a.vehiculo_id = p_vehiculo and a.operador_id is not null
      and a.desde <= (p_momento at time zone 'Europe/Madrid')::date
      and (a.hasta is null or a.hasta >= (p_momento at time zone 'Europe/Madrid')::date)
    order by a.desde desc limit 1)
  limit 1;
$$;
grant execute on function conductor_probable(uuid, timestamptz) to authenticated;
