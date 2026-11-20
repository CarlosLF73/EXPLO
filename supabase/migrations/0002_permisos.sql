-- =====================================================================
-- EXPLO · Migración 0002 · Permisos de acceso a las tablas
-- Los proyectos nuevos de Supabase no conceden permisos automáticamente
-- a los roles de la API. Las reglas RLS (0001) siguen decidiendo qué filas
-- puede ver o tocar cada usuario; esto solo abre la puerta a la tabla.
-- El rol "anon" (sin sesión) NO recibe ningún permiso.
-- =====================================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
