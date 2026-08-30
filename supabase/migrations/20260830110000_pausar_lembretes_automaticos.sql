-- ============================================================================
-- Pausa o disparo AUTOMÁTICO de lembretes de cronograma (30/08/2026).
--
-- O app ganhou uma trava de homologação: enquanto `VITE_EMAIL_DESTINO_REAL`
-- estiver desligada, toda mensagem enviada por qualquer tela é desviada para a
-- caixa de teste da equipe (ver src/lib/email/seguranca.ts).
--
-- Essa trava vive no NAVEGADOR, e havia um caminho que não passava por ela:
-- este agendamento, ativo, rodando todo dia às 11:00 UTC (08:00 em Brasília).
-- Ele chama a Edge Function `lembretes-cronograma`, que monta e envia o e-mail
-- do lado do SERVIDOR — direto para o fornecedor, sem o app no meio.
--
-- Ou seja: a trava do app estava completa e mesmo assim sairia e-mail para
-- fornecedor todo dia de manhã. O agendamento fica pausado até a virada.
--
-- Para religar no dia em que o sistema for liberado:
--     select cron.alter_job(<jobid>, active := true);
-- (o jobid sai de `select jobid, jobname from cron.job`)
-- ============================================================================

do $$
declare
  id_job bigint;
begin
  select jobid into id_job from cron.job where jobname = 'lembretes-cronograma';
  if id_job is not null then
    perform cron.alter_job(id_job, active := false);
  end if;
end
$$;
