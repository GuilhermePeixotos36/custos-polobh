-- ============================================================================
-- PRAZO DE GUARDA DOS DADOS PESSOAIS (LGPD, 05/11/2026)
--
-- Todo dia o banco apaga o que passou do prazo. Os mesmos prazos estão na
-- política de privacidade (`src/lib/privacidade.ts`): mudou aqui, muda lá.
--
--   credenciamentos (nome, CPF, RG, placas)  180 dias depois do envio
--   audit_log (registro de ações)            2 anos
--   emails (registro de envios)              2 anos
--   vigia_alertas (alertas do vigia)         1 ano
--
-- Roda às 05:13 de Brasília (08:13 UTC), longe dos backups (22h e 03h).
-- ============================================================================

create or replace function aplicar_retencao_de_dados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_cred bigint;
  n_audit bigint;
  n_email bigint;
  n_vigia bigint;
begin
  delete from credenciamentos where enviado_em < now() - interval '180 days';
  get diagnostics n_cred = row_count;
  delete from audit_log where ts < now() - interval '2 years';
  get diagnostics n_audit = row_count;
  delete from emails where criado_em < now() - interval '2 years';
  get diagnostics n_email = row_count;
  delete from vigia_alertas where coalesce(ultimo_alerta_em, primeiro_em) < now() - interval '1 year';
  get diagnostics n_vigia = row_count;
  return jsonb_build_object('credenciamentos', n_cred, 'audit_log', n_audit, 'emails', n_email, 'vigia_alertas', n_vigia);
end;
$$;

revoke all on function aplicar_retencao_de_dados() from public, anon, authenticated;

select cron.unschedule('retencao-de-dados') from cron.job where jobname = 'retencao-de-dados';
select cron.schedule('retencao-de-dados', '13 8 * * *', 'select public.aplicar_retencao_de_dados();');
