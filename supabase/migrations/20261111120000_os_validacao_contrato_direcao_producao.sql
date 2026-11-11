-- OS CULTURAL: a Direção de Produção valida o contrato (11/11/2026, pedido da Pólobh)
--
-- "DADOS PARA CONTRATO – PREENCHE PRODUÇÃO E ENCAMINHA PARA DIREÇÃO DE PRODUÇÃO
-- VALIDAR (O ENCAMINHAMENTO GERA PENDÊNCIAS PARA A DIREÇÃO DE PRODUÇÃO)".
--
-- Na OS cultural com contrato o caminho ganha uma etapa:
--   Produção monta → Direção de Produção valida o contrato → Financeiro → Back-office
-- Nas outras OSs nada muda (a etapa é pulada pelo app — ver `domain/faseOs`).
--
-- 1) A fase nova, 'direcao', passa a ser aceita na coluna `oss.fase`.
-- 2) A permissão nova, `oss.validarContrato`, entra na Diretoria Produção
--    (hoje a Marisa) e na Direção. É por ela que a pendência "validar contrato"
--    chega a quem valida — e só a quem valida.

begin;

alter table public.oss drop constraint if exists oss_fase_check;
alter table public.oss
  add constraint oss_fase_check
  check (fase in ('producao', 'direcao', 'financeiro', 'backoffice', 'emitida'));

update public.areas
   set recursos = array_append(recursos, 'oss.validarContrato')
 where nome in ('Diretoria Produção', 'Direção')
   and not ('oss.validarContrato' = any(recursos));

commit;
