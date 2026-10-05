-- ============================================================================
-- Backup automático diário, às 22h00 (Brasília)              (29/09/2026)
--
-- O agendamento precisa da URL da função e do segredo, que não devem morar num
-- arquivo versionado. Por isso esta migração cria só a FUNÇÃO que agenda; quem
-- administra o projeto a chama uma vez, depois de publicar a função e os segredos:
--
--     select agendar_backup_diario(
--       'https://<PROJECT_REF>.functions.supabase.co/backup-diario',
--       '<CRON_SECRET>');
--
-- 22h00 em Brasília = 01:00 UTC (o Brasil não tem horário de verão desde 2019).
-- Chamar de novo troca o agendamento (não duplica). Para pausar:
--     select cron.unschedule('backup-diario');
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function agendar_backup_diario(p_url text, p_segredo text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_url is null or p_segredo is null then
    raise exception 'Informe a URL da função e o segredo';
  end if;
  perform cron.unschedule('backup-diario') from cron.job where jobname = 'backup-diario';
  select cron.schedule(
    'backup-diario',
    '0 1 * * *',
    format(
      $job$select net.http_post(url := %L, headers := jsonb_build_object('x-cron-secret', %L, 'Content-Type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 60000);$job$,
      p_url, p_segredo
    )
  ) into v_id;
  return v_id;
end;
$$;

revoke all on function agendar_backup_diario(text, text) from public, anon, authenticated;
