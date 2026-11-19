-- =====================================================================
-- EXPLO · Gestión de recursos técnicos LIQUIDMEDIA
-- Migración 0001 · Esquema inicial
-- =====================================================================
-- Principios:
--  * Nada se sobrescribe sin dejar rastro: tablas de relación con
--    "desde/hasta" + tabla `historial` alimentada por triggers.
--  * Las bajas son lógicas (estado/fecha_baja), nunca DELETE.
--  * Renove: cada elemento y equipo pertenece a una `generacion`.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Organización: delegaciones, sedes, producciones
-- ---------------------------------------------------------------------
create table delegaciones (
  id      text primary key,               -- MAD, PVA, GAL, VAL
  nombre  text not null,
  orden   int  not null default 0
);

create table sedes (
  id             text primary key,        -- MAD, BIL, SCQ, LCG, VAL
  delegacion_id  text not null references delegaciones(id),
  nombre         text not null,
  orden          int  not null default 0
);

create table producciones (
  id      text primary key,               -- A3, L6
  nombre  text not null,
  color   text                            -- color de marca en la UI
);

-- Qué producciones se trabajan en cada sede (A Coruña solo L6)
create table sede_producciones (
  sede_id        text references sedes(id),
  produccion_id  text references producciones(id),
  primary key (sede_id, produccion_id)
);

-- ---------------------------------------------------------------------
-- 2. Usuarios de la app (enlazados a auth.users de Supabase)
-- ---------------------------------------------------------------------
create table perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  nombre      text,
  rol         text not null default 'usuario' check (rol in ('admin','usuario')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Personas: operadores de cámara (no acceden a la app)
-- ---------------------------------------------------------------------
create table operadores (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  apellidos      text,
  alias          text,
  telefono       text,
  email          text,
  sede_id        text references sedes(id),
  produccion_id  text references producciones(id),
  activo         boolean not null default true,
  fecha_alta     date,
  fecha_baja     date,
  notas          text,
  legacy_id      text,                     -- id en la app antigua
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table operador_asistencia (
  id           uuid primary key default gen_random_uuid(),
  operador_id  uuid not null references operadores(id),
  fecha        date not null,
  estado       text not null check (estado in ('trabaja','libre','vacaciones','baja','horas_sindicales','otro')),
  horas        numeric(5,2),
  notas        text,
  unique (operador_id, fecha)
);

-- ---------------------------------------------------------------------
-- 4. Catálogo e inventario
-- ---------------------------------------------------------------------
create table proveedores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  tipo      text,                          -- alquiler, renting, compra, taller...
  contacto  text,
  telefono  text,
  email     text,
  notas     text
);

create table categorias (
  id            text primary key,          -- CAMARA, OPTICA, MICRO, ...
  nombre        text not null,
  es_cabecera   boolean not null default false,  -- encabeza un equipo (cámara)
  icono         text,
  orden         int not null default 0
);

create table modelos (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  text not null references categorias(id),
  marca         text,
  modelo        text not null,
  foto_url      text,
  notas         text,
  unique (categoria_id, marca, modelo)
);

-- Generaciones de material (renove)
create table generaciones (
  id           text primary key,           -- G2019, R2026...
  nombre       text not null,
  fecha_inicio date,
  vigente      boolean not null default true,
  color        text,
  notas        text
);

create table elementos (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique,   -- coincide con el QR físico
  num_visible      text,                   -- p.ej. X180.2
  modelo_id        uuid not null references modelos(id),
  numero_serie     text,
  generacion_id    text references generaciones(id),
  propiedad        text not null default 'propio'
                     check (propiedad in ('propio','alquiler','renting','prestamo')),
  proveedor_id     uuid references proveedores(id),
  alquiler_desde   date,
  alquiler_hasta   date,
  coste            numeric(12,2),
  estado           text not null default 'operativo'
                     check (estado in ('operativo','mantenimiento','averiado','custodia','reserva','baja')),
  sede_id          text references sedes(id),
  produccion_id    text references producciones(id),   -- null = material común
  es_comun         boolean not null default false,
  -- desplazamiento temporal a otra sede/producción
  temp_sede_id     text references sedes(id),
  temp_produccion_id text references producciones(id),
  temp_desde       date,
  temp_motivo      text,
  custodia_operador_id uuid references operadores(id),
  seguro           boolean,
  fecha_alta       date default current_date,
  fecha_baja       date,
  motivo_baja      text,
  notas            text,
  legacy_id        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on elementos (sede_id, produccion_id);
create index on elementos (generacion_id);
create index on elementos (estado);

-- Equipos (kits) encabezados por una cámara
create table equipos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,            -- p.ej. "X180.2 L6 Madrid"
  camara_id      uuid references elementos(id),
  sede_id        text not null references sedes(id),
  produccion_id  text not null references producciones(id),
  generacion_id  text references generaciones(id),
  activo         boolean not null default true,
  fecha_alta     date default current_date,
  fecha_baja     date,
  notas          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index equipos_camara_activa on equipos (camara_id) where activo;

-- Composición habitual del equipo, con histórico
create table equipo_elementos (
  id           uuid primary key default gen_random_uuid(),
  equipo_id    uuid not null references equipos(id),
  elemento_id  uuid not null references elementos(id),
  desde        timestamptz not null default now(),
  hasta        timestamptz,
  motivo       text
);
create unique index equipo_elementos_vigente on equipo_elementos (elemento_id) where hasta is null;

-- Mantenimientos / averías / reparaciones
create table mantenimientos (
  id              uuid primary key default gen_random_uuid(),
  elemento_id     uuid references elementos(id),
  equipo_externo  text,                    -- si no está inventariado
  tipo            text not null default 'averia' check (tipo in ('averia','revision','reparacion','limpieza','otro')),
  fecha_entrada   date not null,
  fecha_salida    date,
  proveedor_id    uuid references proveedores(id),
  coste           numeric(12,2),
  descripcion     text,
  resuelto        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Flota de vehículos y tarjetas de combustible
-- ---------------------------------------------------------------------
create table vehiculos (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text unique,
  matricula          text not null unique,
  marca              text,
  modelo             text,
  propiedad          text not null default 'renting' check (propiedad in ('propio','renting','alquiler')),
  proveedor_id       uuid references proveedores(id),   -- KINTO, VWR...
  sede_id            text references sedes(id),
  produccion_id      text references producciones(id),
  estado             text not null default 'operativo' check (estado in ('operativo','taller','inmovilizado','baja')),
  contrato_inicio    date,
  contrato_fin       date,
  km_contrato        int,
  coste_mensual      numeric(10,2),
  telepeaje          text,
  fecha_itv          date,
  fecha_baja         date,
  motivo_baja        text,
  notas              text,
  legacy_id          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table vehiculo_km (
  id           uuid primary key default gen_random_uuid(),
  vehiculo_id  uuid not null references vehiculos(id),
  fecha        date not null default current_date,
  km           int not null,
  origen       text                        -- manual, documento, salida...
);

create table tarjetas_combustible (
  id               uuid primary key default gen_random_uuid(),
  emisor           text not null default 'SOLRED',
  alias            text not null,          -- identificador interno
  ultimos_digitos  text,                   -- solo últimos 4, nunca el número completo
  caducidad        date,
  estado           text not null default 'activa' check (estado in ('activa','bloqueada','baja')),
  notas            text,
  created_at       timestamptz not null default now()
);

create table vehiculo_tarjetas (
  id           uuid primary key default gen_random_uuid(),
  vehiculo_id  uuid not null references vehiculos(id),
  tarjeta_id   uuid not null references tarjetas_combustible(id),
  desde        timestamptz not null default now(),
  hasta        timestamptz,
  motivo       text
);
create unique index vehiculo_tarjetas_vigente on vehiculo_tarjetas (tarjeta_id) where hasta is null;

-- Eventos de vehículo: taller, ITV, multa, siniestro, repostaje...
create table vehiculo_eventos (
  id                   uuid primary key default gen_random_uuid(),
  vehiculo_id          uuid not null references vehiculos(id),
  tipo                 text not null check (tipo in ('taller','revision','itv','neumaticos','incidencia','siniestro','multa','repostaje','otro')),
  fecha                date not null,
  fecha_fin            date,
  km                   int,
  importe              numeric(10,2),
  descripcion          text,
  estado               text not null default 'abierto' check (estado in ('abierto','pendiente','cerrado','anulado')),
  bloquea_vehiculo     boolean not null default false,
  operador_id          uuid references operadores(id),   -- p.ej. conductor en multa
  detalle              jsonb not null default '{}',      -- campos específicos (multa: boletín, plazo...)
  created_at           timestamptz not null default now()
);
create index on vehiculo_eventos (vehiculo_id, fecha desc);

-- ---------------------------------------------------------------------
-- 6. Operativa diaria: salidas a cobertura (el histórico de uso)
-- ---------------------------------------------------------------------
create table salidas (
  id               uuid primary key default gen_random_uuid(),
  fecha            date not null,
  hora_salida      timestamptz,
  hora_regreso     timestamptz,
  estado           text not null default 'activa' check (estado in ('reservada','activa','finalizada','anulada')),
  equipo_id        uuid references equipos(id),
  camara_id        uuid references elementos(id),
  operador_id      uuid references operadores(id),
  operador2_id     uuid references operadores(id),
  vehiculo_id      uuid references vehiculos(id),
  sede_id          text references sedes(id),
  produccion_id    text references producciones(id),
  cobertura        text,
  num_coberturas   int not null default 1,
  viaje            boolean not null default false,
  viaje_id         uuid,
  notas            text,
  -- texto libre heredado de la app antigua cuando no hay id
  operador_nombre_legacy  text,
  operador2_nombre_legacy text,
  legacy_id        text,
  created_by       uuid references perfiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on salidas (fecha);
create index on salidas (camara_id, fecha);
create index on salidas (operador_id, fecha);
create index on salidas (estado);

-- Material adicional que sale con la cobertura (LiveU, WifiCam, común...)
create table salida_elementos (
  salida_id    uuid not null references salidas(id) on delete cascade,
  elemento_id  uuid not null references elementos(id),
  primary key (salida_id, elemento_id)
);

-- ---------------------------------------------------------------------
-- 7. Documentos (multas, facturas, ITV...) con extracción por IA
-- ---------------------------------------------------------------------
create table documentos (
  id                 uuid primary key default gen_random_uuid(),
  storage_path       text not null,
  nombre_archivo     text,
  mime               text,
  tipo               text check (tipo in ('multa','factura','itv','parte_taller','ticket_combustible','contrato','albaran','otro')),
  entidad            text check (entidad in ('vehiculo','elemento','operador','proveedor','tarjeta')),
  entidad_id         uuid,
  evento_id          uuid references vehiculo_eventos(id),
  datos_extraidos    jsonb,
  estado_extraccion  text not null default 'pendiente' check (estado_extraccion in ('pendiente','procesado','confirmado','error')),
  subido_por         uuid references perfiles(id),
  created_at         timestamptz not null default now()
);
create index on documentos (entidad, entidad_id);

-- ---------------------------------------------------------------------
-- 8. Histórico universal (auditoría)
-- ---------------------------------------------------------------------
create table historial (
  id           bigserial primary key,
  tabla        text not null,
  registro_id  text not null,
  accion       text not null,              -- INSERT / UPDATE / DELETE
  antes        jsonb,
  despues      jsonb,
  usuario_id   uuid,
  fecha        timestamptz not null default now()
);
create index on historial (tabla, registro_id, fecha desc);

create or replace function fn_historial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into historial (tabla, registro_id, accion, antes, despues, usuario_id)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', '?'),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

create or replace function fn_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['operadores','elementos','equipos','equipo_elementos','mantenimientos',
                           'vehiculos','tarjetas_combustible','vehiculo_tarjetas','vehiculo_eventos',
                           'salidas','perfiles','documentos'] loop
    execute format('create trigger trg_historial after insert or update or delete on %I
                    for each row execute function fn_historial()', t);
  end loop;
  foreach t in array array['operadores','elementos','equipos','vehiculos','salidas','perfiles'] loop
    execute format('create trigger trg_updated_at before update on %I
                    for each row execute function fn_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9. Alta automática de perfil al crear/invitar un usuario
-- ---------------------------------------------------------------------
create or replace function fn_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre, rol)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    case when lower(new.email) = 'clopezf@mediapro.tv' then 'admin' else 'usuario' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_nuevo_usuario after insert on auth.users
  for each row execute function fn_nuevo_usuario();

-- ---------------------------------------------------------------------
-- 10. Seguridad (RLS): usuarios activos operan; admin gestiona usuarios
-- ---------------------------------------------------------------------
create or replace function es_usuario_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo);
$$;

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'admin');
$$;

do $$
declare t text;
begin
  foreach t in array array['delegaciones','sedes','producciones','sede_producciones','operadores',
                           'operador_asistencia','proveedores','categorias','modelos','generaciones',
                           'elementos','equipos','equipo_elementos','mantenimientos','vehiculos',
                           'vehiculo_km','tarjetas_combustible','vehiculo_tarjetas','vehiculo_eventos',
                           'salidas','salida_elementos','documentos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy lectura on %I for select to authenticated using (es_usuario_activo())', t);
    execute format('create policy alta on %I for insert to authenticated with check (es_usuario_activo())', t);
    execute format('create policy edicion on %I for update to authenticated using (es_usuario_activo()) with check (es_usuario_activo())', t);
    execute format('create policy borrado on %I for delete to authenticated using (es_admin())', t);
  end loop;
end $$;

alter table perfiles enable row level security;
create policy lectura on perfiles for select to authenticated using (id = auth.uid() or es_admin());
create policy edicion_admin on perfiles for update to authenticated using (es_admin()) with check (es_admin());

alter table historial enable row level security;
create policy lectura on historial for select to authenticated using (es_usuario_activo());

-- ---------------------------------------------------------------------
-- 11. Almacenamiento de archivos (privado)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('documentos','documentos', false),
  ('fotos','fotos', false)
on conflict (id) do nothing;

create policy "explo lectura archivos" on storage.objects for select to authenticated
  using (bucket_id in ('documentos','fotos') and es_usuario_activo());
create policy "explo subida archivos" on storage.objects for insert to authenticated
  with check (bucket_id in ('documentos','fotos') and es_usuario_activo());
create policy "explo borrado archivos" on storage.objects for delete to authenticated
  using (bucket_id in ('documentos','fotos') and es_admin());

-- ---------------------------------------------------------------------
-- 12. Vistas para el panel resumen y los análisis
-- ---------------------------------------------------------------------
create or replace view v_resumen_sede_produccion with (security_invoker = true) as
select sp.sede_id, s.nombre as sede, s.delegacion_id, sp.produccion_id,
  (select count(*) from equipos e where e.sede_id = sp.sede_id and e.produccion_id = sp.produccion_id and e.activo) as equipos,
  (select count(*) from equipos e join generaciones g on g.id = e.generacion_id
     where e.sede_id = sp.sede_id and e.produccion_id = sp.produccion_id and e.activo and g.vigente) as equipos_generacion_vigente,
  (select count(*) from elementos el join modelos m on m.id = el.modelo_id join categorias c on c.id = m.categoria_id
     where c.es_cabecera and coalesce(el.temp_sede_id, el.sede_id) = sp.sede_id
       and coalesce(el.temp_produccion_id, el.produccion_id) = sp.produccion_id and el.estado = 'operativo') as camaras_operativas,
  (select count(*) from elementos el join modelos m on m.id = el.modelo_id join categorias c on c.id = m.categoria_id
     where c.es_cabecera and coalesce(el.temp_sede_id, el.sede_id) = sp.sede_id
       and coalesce(el.temp_produccion_id, el.produccion_id) = sp.produccion_id and el.estado in ('mantenimiento','averiado')) as camaras_en_taller,
  (select count(*) from salidas sa where sa.sede_id = sp.sede_id and sa.produccion_id = sp.produccion_id and sa.estado = 'activa') as salidas_activas,
  (select count(*) from vehiculos v where v.sede_id = sp.sede_id and v.produccion_id = sp.produccion_id and v.estado <> 'baja') as vehiculos
from sede_producciones sp join sedes s on s.id = sp.sede_id;

create or replace view v_uso_camaras with (security_invoker = true) as
select sa.camara_id, el.codigo, el.num_visible, date_trunc('month', sa.fecha)::date as mes,
       count(*) as salidas, sum(sa.num_coberturas) as coberturas,
       round(sum(extract(epoch from (coalesce(sa.hora_regreso, sa.hora_salida) - sa.hora_salida)) / 3600)::numeric, 1) as horas
from salidas sa join elementos el on el.id = sa.camara_id
where sa.estado = 'finalizada'
group by 1,2,3,4;

create or replace view v_productividad_operadores with (security_invoker = true) as
select o.id as operador_id, o.nombre, o.apellidos, date_trunc('month', sa.fecha)::date as mes,
       count(*) as salidas, sum(sa.num_coberturas) as coberturas,
       round(sum(extract(epoch from (coalesce(sa.hora_regreso, sa.hora_salida) - sa.hora_salida)) / 3600)::numeric, 1) as horas,
       count(*) filter (where sa.viaje) as viajes
from salidas sa join operadores o on o.id in (sa.operador_id, sa.operador2_id)
where sa.estado = 'finalizada'
group by 1,2,3,4;

-- ---------------------------------------------------------------------
-- 13. Datos base
-- ---------------------------------------------------------------------
insert into delegaciones (id, nombre, orden) values
  ('MAD','Madrid',1), ('PVA','País Vasco',2), ('GAL','Galicia',3), ('VAL','Valencia',4);

insert into sedes (id, delegacion_id, nombre, orden) values
  ('MAD','MAD','Madrid',1), ('BIL','PVA','Bilbao',2),
  ('SCQ','GAL','Santiago de Compostela',3), ('LCG','GAL','A Coruña',4),
  ('VAL','VAL','Valencia',5);

insert into producciones (id, nombre, color) values
  ('A3','Antena 3','#F26A1B'), ('L6','La Sexta','#12A84A');

insert into sede_producciones (sede_id, produccion_id) values
  ('MAD','A3'),('MAD','L6'),('BIL','A3'),('BIL','L6'),
  ('SCQ','A3'),('SCQ','L6'),('LCG','L6'),('VAL','A3'),('VAL','L6');

insert into categorias (id, nombre, es_cabecera, orden) values
  ('CAMARA','Cámara',true,1), ('OPTICA','Óptica',false,2), ('MICRO','Microfonía',false,3),
  ('ILUM','Iluminación',false,4), ('BATERIA','Baterías y alimentación',false,5),
  ('SOPORTE','Trípodes y soportes',false,6), ('TX','Transmisión (LiveU, WifiCam...)',false,7),
  ('GRABACION','Soportes de grabación',false,8), ('MONITOR','Monitorización',false,9),
  ('MALETA','Maletas y transporte',false,10), ('OTROS','Otros',false,99);

insert into generaciones (id, nombre, vigente, color, notas) values
  ('ACTUAL','Material actual (pre-renove)', true, '#8A94A6', 'Material en servicio antes del renove'),
  ('RENOVE','Renove', true, '#2F6FED', 'Material nuevo del renove');
