-- ============================================================================
-- VIGIA DO BANCO (05/11/2026)
--
-- A cada 30 minutos o banco se confere e, se algo estiver fora do normal,
-- a função `vigia-banco` manda um e-mail (Brevo) para quem administra o app.
--
-- O que conta como anomalia está em `vigia_banco_checar`. Cada anomalia tem uma
-- CHAVE; a mesma chave só volta a ser avisada depois de 24 h (se continuar),
-- para o alerta não virar spam.
--
-- Agendar (uma vez, depois de publicar a função; o e-mail e o segredo não
-- ficam neste arquivo):
--     select agendar_vigia_banco('<URL da função>', '<CRON_SECRET>', '<e-mail>');
-- Pausar:  select cron.unschedule('vigia-banco');
-- ============================================================================

create table if not exists vigia_alertas (
  chave text primary key,
  primeiro_em timestamptz not null default now(),
  ultimo_alerta_em timestamptz,
  detalhe text
);
alter table vigia_alertas enable row level security;

create table if not exists vigia_estado (
  id int primary key default 1 check (id = 1),
  ultima_execucao timestamptz,
  deadlocks bigint
);
alter table vigia_estado enable row level security;
insert into vigia_estado (id, ultima_execucao, deadlocks)
values (1, now() - interval '30 minutes', (select coalesce(sum(deadlocks), 0) from pg_stat_database))
on conflict (id) do nothing;

/** Lista as anomalias de agora: [{chave, gravidade, titulo, detalhe}]. Só leitura. */
create or replace function vigia_banco_checar(p_desde timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r jsonb := '[]'::jsonb;
  v_max int;
  v_con int;
  v_tam bigint;
  v_dead bigint;
  v_dead_antes bigint;
  x record;
begin
  -- 1. Conexões perto do limite.
  select setting::int into v_max from pg_settings where name = 'max_connections';
  select count(*) into v_con from pg_stat_activity;
  if v_con > v_max * 0.8 then
    r := r || jsonb_build_object('chave', 'conexoes', 'gravidade', 'alta',
      'titulo', 'Conexões do banco perto do limite',
      'detalhe', format('%s de %s conexões em uso. O app pode ficar lento ou recusar acessos.', v_con, v_max));
  end if;

  -- 2. Tamanho do banco (o plano gratuito vai até 500 MB).
  v_tam := pg_database_size(current_database());
  if v_tam > 400 * 1024 * 1024 then
    r := r || jsonb_build_object('chave', 'tamanho', 'gravidade', 'media',
      'titulo', 'Banco de dados ficando cheio',
      'detalhe', format('O banco ocupa %s.', pg_size_pretty(v_tam)));
  end if;

  -- 3. Deadlocks (duas gravações travando uma à outra) desde a última conferência.
  select coalesce(sum(deadlocks), 0) into v_dead from pg_stat_database;
  select deadlocks into v_dead_antes from vigia_estado where id = 1;
  if v_dead > coalesce(v_dead_antes, v_dead) then
    r := r || jsonb_build_object('chave', 'deadlock:' || v_dead, 'gravidade', 'media',
      'titulo', 'Gravações travadas no banco (deadlock)',
      'detalhe', format('%s novo(s) deadlock(s). Algum salvamento pode ter falhado com erro.', v_dead - v_dead_antes));
  end if;
  update vigia_estado set deadlocks = v_dead where id = 1;

  -- 4. Consultas lentas feitas pelo app (média acima de 0,5 s).
  for x in
    select s.queryid, s.calls, round(s.mean_exec_time::numeric) ms, left(regexp_replace(s.query, '\s+', ' ', 'g'), 300) q
    from pg_stat_statements s join pg_roles ro on ro.oid = s.userid
    where ro.rolname in ('authenticator', 'authenticated', 'anon', 'service_role')
      and s.calls > 20 and s.mean_exec_time > 500
      -- Consultas internas do Supabase (cache de esquema, fusos) não são do app.
      and s.query !~* '(pg_timezone_names|pg_catalog\.|information_schema\.|pg_namespace|pg_class)'
    order by s.mean_exec_time desc limit 5
  loop
    r := r || jsonb_build_object('chave', 'lento:' || x.queryid, 'gravidade', 'media',
      'titulo', 'Consulta lenta no app',
      'detalhe', format('Média de %s ms em %s chamadas: %s', x.ms, x.calls, x.q));
  end loop;

  -- 5. Tarefas agendadas que falharam (backups, lembretes).
  for x in
    select j.jobname, count(*) n, max(d.return_message) msg
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where d.start_time > p_desde and d.status = 'failed'
    group by j.jobname
  loop
    r := r || jsonb_build_object('chave', 'cron:' || x.jobname, 'gravidade', 'alta',
      'titulo', 'Tarefa agendada falhou: ' || x.jobname,
      'detalhe', format('%s falha(s). Mensagem: %s', x.n, left(coalesce(x.msg, ''), 300)));
  end loop;

  -- 6. Chamadas automáticas às funções da nuvem com erro.
  for x in
    select status_code, count(*) n, max(left(coalesce(error_msg, content::text, ''), 300)) msg
    from net._http_response
    where created > p_desde and (status_code is null or status_code >= 400)
    group by status_code
  loop
    r := r || jsonb_build_object('chave', 'http:' || coalesce(x.status_code::text, 'sem-resposta'), 'gravidade', 'alta',
      'titulo', 'Função automática respondeu com erro',
      'detalhe', format('%s chamada(s) com status %s. %s', x.n, coalesce(x.status_code::text, 'sem resposta'), x.msg));
  end loop;

  -- 7. Backups: falhou, ou nenhum backup concluído nas últimas 26 h.
  for x in select status, left(coalesce(erro, ''), 300) erro, criado_em from backups where criado_em > p_desde and status <> 'concluido' loop
    r := r || jsonb_build_object('chave', 'backup-falhou:' || x.criado_em, 'gravidade', 'alta',
      'titulo', 'Backup do sistema falhou',
      'detalhe', format('Status %s. %s', x.status, x.erro));
  end loop;
  if not exists (select 1 from backups where status = 'concluido' and criado_em > now() - interval '26 hours') then
    r := r || jsonb_build_object('chave', 'backup-atrasado', 'gravidade', 'alta',
      'titulo', 'Nenhum backup nas últimas 26 horas',
      'detalhe', 'O backup diário não foi concluído. Os dados mais recentes estão sem cópia de segurança.');
  end if;

  -- 8. E-mails do app que não saíram.
  for x in select count(*) n, max(left(coalesce(erro, ''), 300)) erro from emails where criado_em > p_desde and status <> 'enviado' having count(*) > 0 loop
    r := r || jsonb_build_object('chave', 'emails:' || date_trunc('hour', now()), 'gravidade', 'media',
      'titulo', 'E-mails do app não foram enviados',
      'detalhe', format('%s e-mail(s) com falha. Último erro: %s', x.n, x.erro));
  end loop;

  -- 9. Erros registrados pelo próprio app.
  for x in select count(*) n, max(left(mensagem, 300)) msg from audit_log where ts > p_desde and lower(nivel) in ('erro', 'error') having count(*) > 0 loop
    r := r || jsonb_build_object('chave', 'app-erro:' || date_trunc('hour', now()), 'gravidade', 'media',
      'titulo', 'Erros registrados pelo app',
      'detalhe', format('%s erro(s). Exemplo: %s', x.n, x.msg));
  end loop;

  -- 10. Segurança: tabela sem regra de acesso (RLS) desligada.
  for x in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity loop
    r := r || jsonb_build_object('chave', 'rls:' || x.relname, 'gravidade', 'alta',
      'titulo', 'Tabela sem proteção de acesso: ' || x.relname,
      'detalhe', 'A tabela está sem RLS: qualquer pessoa logada (ou não) pode ler e alterar os dados dela.');
  end loop;

  -- 11. Segurança: conta criada fora do app (sem perfil).
  for x in
    select u.email from auth.users u
    where u.created_at > p_desde - interval '10 minutes' and u.created_at < now() - interval '10 minutes'
      and not exists (select 1 from perfis p where p.id = u.id)
  loop
    r := r || jsonb_build_object('chave', 'conta-sem-perfil:' || x.email, 'gravidade', 'alta',
      'titulo', 'Conta criada fora do app',
      'detalhe', format('A conta %s foi criada sem perfil no app. Se ninguém da equipe a criou, pode ser tentativa de acesso.', x.email));
  end loop;

  -- 12. Dados: mais de uma EC ativa no mesmo projeto.
  for x in
    select projeto_id, count(*) n from ecs
    where ativa and not coalesce(cancelada_substituida, false) and projeto_id is not null
    group by projeto_id having count(*) > 1
  loop
    r := r || jsonb_build_object('chave', 'ec-ativa-dupla:' || x.projeto_id, 'gravidade', 'baixa',
      'titulo', 'Projeto com mais de uma EC ativa',
      'detalhe', format('O projeto %s tem %s ECs marcadas como ativas.', x.projeto_id, x.n));
  end loop;

  return r;
end;
$$;

/**
 * Roda a conferência e devolve SÓ o que deve ser avisado agora: anomalia nova,
 * ou repetida há mais de 24 h. Registra o aviso.
 */
create or replace function vigia_banco_rodar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desde timestamptz;
  v_todas jsonb;
  v_avisar jsonb := '[]'::jsonb;
  a jsonb;
begin
  select coalesce(ultima_execucao, now() - interval '30 minutes') into v_desde from vigia_estado where id = 1;
  v_todas := vigia_banco_checar(v_desde);
  update vigia_estado set ultima_execucao = now() where id = 1;
  for a in select * from jsonb_array_elements(v_todas) loop
    if not exists (
      select 1 from vigia_alertas where chave = a->>'chave' and ultimo_alerta_em > now() - interval '24 hours'
    ) then
      v_avisar := v_avisar || a;
      insert into vigia_alertas (chave, ultimo_alerta_em, detalhe) values (a->>'chave', now(), a->>'detalhe')
      on conflict (chave) do update set ultimo_alerta_em = now(), detalhe = excluded.detalhe;
    end if;
  end loop;
  return v_avisar;
end;
$$;

create or replace function agendar_vigia_banco(p_url text, p_segredo text, p_email text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_url is null or p_segredo is null or p_email is null then
    raise exception 'Informe a URL da função, o segredo e o e-mail';
  end if;
  perform cron.unschedule('vigia-banco') from cron.job where jobname = 'vigia-banco';
  select cron.schedule(
    'vigia-banco',
    '*/30 * * * *',
    format(
      $job$select net.http_post(url := %L, headers := jsonb_build_object('x-cron-secret', %L, 'Content-Type', 'application/json'), body := jsonb_build_object('para', %L), timeout_milliseconds := 30000);$job$,
      p_url, p_segredo, p_email
    )
  ) into v_id;
  return v_id;
end;
$$;

revoke all on function vigia_banco_checar(timestamptz) from public, anon, authenticated;
revoke all on function vigia_banco_rodar() from public, anon, authenticated;
revoke all on function agendar_vigia_banco(text, text, text) from public, anon, authenticated;
grant execute on function vigia_banco_rodar() to service_role;
