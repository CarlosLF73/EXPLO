-- =====================================================================
-- EXPLO · Migración 0003 · Operadores: tipo de contrato y teléfono personal
-- contrato: p.ej. 'FDI' (vacío = plantilla habitual)
-- telefono_personal: solo cuando no hay teléfono de empresa
-- =====================================================================

alter table operadores add column if not exists contrato text;
alter table operadores add column if not exists telefono_personal text;
