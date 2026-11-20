-- =====================================================================
-- EXPLO · Migración 0005 · Multas: cómo se comunicó (correo, PDF o a mano)
-- =====================================================================
alter table multas add column if not exists medio_comunicacion text
  check (medio_comunicacion in ('correo','pdf','manual'));
alter table multas add column if not exists nota_comunicacion text;

-- Documentos: admitir el PDF de comunicación generado por la app
alter table documentos drop constraint if exists documentos_tipo_check;
alter table documentos add constraint documentos_tipo_check
  check (tipo in ('multa','justificante_pago','comunicacion','factura','itv','parte_taller','ticket_combustible','contrato','albaran','otro'));
