-- ============================================================================
-- Back-up do sistema: o que a casa guarda por conta própria      (25/09/2026)
--
-- POR QUE ISTO EXISTE
--
-- O banco é o Supabase, e o plano gratuito guarda back-up com retenção curta —
-- e dentro da MESMA conta. Isso cobre o acidente comum (alguém apagou um
-- projeto na terça) e não cobre os dois que doem: perder a conta, e descobrir o
-- estrago depois do fim da retenção.
--
-- O jeito de suprir isso sem trocar de plano é tirar uma cópia PARA FORA, com
-- alguma regularidade, e deixar essa cópia na mão de quem é dono do dado. É o
-- que este conjunto faz: um pacote .zip com tudo, que sai por e-mail e/ou vai
-- para uma pasta do Dropbox da Pólobh, no automático e também a qualquer hora
-- em que alguém clicar.
--
-- O QUE MORA AQUI, E POR QUÊ
--
--  · `backups`         — o histórico. Sem ele, "temos back-up" é uma crença.
--                        Com ele, é uma data e um tamanho na tela.
--  · `backup_tabelas()`— a lista de tabelas a copiar, tirada do catálogo do
--                        próprio banco, e NÃO escrita à mão. Lista à mão
--                        envelhece: a tabela nova entra no sistema, ninguém
--                        lembra do back-up, e a falta só aparece no dia da
--                        restauração. Aqui, tabela nova entra sozinha.
--  · `config_app.backup` — a frequência e os destinos, editáveis na tela.
--  · o agendamento     — um job diário que só CHAMA a função. Quem decide se
--                        hoje é dia é a função, lendo a configuração; assim a
--                        Direção troca de semanal para diário sem que ninguém
--                        precise mexer em cron.
-- ============================================================================

-- ------------------------------ o histórico --------------------------------

create table if not exists backups (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  -- 'manual' = alguém clicou; 'automatico' = o agendamento.
  origem text not null check (origem in ('manual', 'automatico')),
  -- Para onde foi de fato (e-mail, dropbox, download). Vazio = só gerado.
  destinos text[] not null default '{}',
  arquivo text,
  tamanho_bytes bigint,
  -- { "projetos": 5, "ecs": 7, ... } — quantas linhas de cada tabela entraram.
  -- É isto que permite olhar um back-up antigo e saber o que ele tem dentro.
  tabelas jsonb not null default '{}'::jsonb,
  anexos int not null default 0,
  status text not null check (status in ('concluido', 'parcial', 'erro')),
  erro text,
  solicitado_por text
);

comment on table backups is
  'Histórico de back-ups do sistema. Escrito pela Edge Function `backup` (chave de serviço); a tela só lê. Ver src/pages/Configuracoes.tsx › Back-up.';

create index if not exists backups_criado_em_idx on backups (criado_em desc);

alter table backups enable row level security;

drop policy if exists backups_read on backups;

-- Ler: quem administra o sistema — mesma régua da tela de Configurações.
-- Não existe policy de escrita de propósito: quem grava é a função, com a
-- chave de serviço, que passa por fora da RLS. Se um dia alguém "consertar"
-- isso criando uma policy de insert, o histórico deixa de ser confiável —
-- passa a ser algo que o cliente pode escrever.
create policy backups_read on backups for select
  using (papel_atual() in ('Admin', 'Direcao', 'Administrativo'));

-- --------------------- a lista de tabelas a copiar --------------------------

/*
 * Quais tabelas o back-up copia, e em que ordem restaurar.
 *
 * A ORDEM importa: restaurar `ec_linhas` antes de `ecs` esbarra na chave
 * estrangeira. O nível sai do catálogo — uma tabela que não aponta para
 * nenhuma outra é nível 0; quem aponta para ela vem depois.
 *
 * Dois cuidados que parecem paranoia e não são:
 *
 *  · a recursão tem teto (`nivel < 20`). Se um dia existir um ciclo de chaves
 *    estrangeiras, sem o teto isto roda para sempre;
 *  · a lista final sai de um LEFT JOIN com TODAS as tabelas do schema. Se uma
 *    tabela não for alcançada pela recursão (é o que acontece dentro de um
 *    ciclo), ela ainda assim aparece, no fim da fila. Uma tabela de fora da
 *    lista é uma tabela que o back-up não copia — e ninguém descobriria isso
 *    antes do dia em que precisasse dela de volta.
 */
create or replace function backup_tabelas()
returns table (tabela text, ordem int)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with recursive dependentes as (
    select c.oid as rel, 0 as nivel
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not exists (
             select 1 from pg_constraint fk
              where fk.conrelid = c.oid and fk.contype = 'f' and fk.confrelid <> c.oid
           )
    union all
    select fk.conrelid, d.nivel + 1
      from dependentes d
      join pg_constraint fk
        on fk.confrelid = d.rel and fk.contype = 'f' and fk.conrelid <> fk.confrelid
     where d.nivel < 20
  ),
  nivel_por_tabela as (
    select rel, max(nivel) as nivel from dependentes group by rel
  ),
  todas as (
    select c.oid as rel, c.relname::text as nome
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  )
  select t.nome, coalesce(np.nivel, 99)::int
    from todas t
    left join nivel_por_tabela np on np.rel = t.rel
   order by coalesce(np.nivel, 99), t.nome;
$function$;

-- Só a função de back-up chama isto, e ela usa a chave de serviço. `public`
-- não basta: o Supabase concede EXECUTE a `anon` e `authenticated` por
-- DEFAULT PRIVILEGES, e revogar só de `public` deixaria a porta aberta.
revoke all on function backup_tabelas() from public, anon, authenticated;
grant execute on function backup_tabelas() to service_role;

-- ------------------------- o inventário de anexos ---------------------------

/*
 * Os arquivos que as pessoas subiram (anexos de tarefa e de chamado).
 *
 * Sai do catálogo do Storage, e não da API de listagem, por um motivo prático:
 * a API lista uma pasta por vez e obriga a varrer a árvore com uma chamada por
 * nível — e basta uma pasta esquecida para o back-up sair sem os arquivos dela,
 * sem erro nenhum. Aqui a lista vem inteira, de uma vez, do lugar onde ela é
 * verdade.
 */
create or replace function backup_anexos()
returns table (balde text, caminho text, tamanho bigint)
language sql
stable
security definer
set search_path to 'storage'
as $function$
  select o.bucket_id::text,
         o.name::text,
         coalesce((o.metadata->>'size')::bigint, 0)
    from storage.objects o
   order by o.bucket_id, o.name;
$function$;

revoke all on function backup_anexos() from public, anon, authenticated;
grant execute on function backup_anexos() to service_role;

-- ---------------------------- a configuração --------------------------------

/*
 * frequencia: 'desligado' | 'diario' | 'semanal' | 'mensal'
 * destinatarios: para quem o e-mail vai (vazio = não manda e-mail)
 * dropbox: se sobe para a pasta do Dropbox (exige os segredos configurados)
 *
 * Começa SEMANAL e sem destinatário: um back-up que ninguém pediu saindo por
 * e-mail para uma caixa errada é vazamento, não é zelo. A Direção preenche o
 * endereço na tela, e é isso que liga o envio.
 */
insert into config_app (chave, valor) values
  ('backup', '{"frequencia":"semanal","destinatarios":[],"dropbox":false}'::jsonb)
on conflict (chave) do nothing;

-- ---------------------------- o agendamento ---------------------------------

/*
 * Um job por DIA, que só bate na função. Quem decide se hoje é dia de back-up
 * é a própria função, lendo `config_app.backup.frequencia` — de propósito:
 * trocar de semanal para diário vira um clique na tela, em vez de uma migração
 * nova mexendo em cron.
 *
 * 06:00 UTC = 03:00 em Brasília. Fora do expediente, e antes de qualquer
 * expediente: se o back-up pesar no banco, que pese com a casa vazia.
 *
 * `timeout_milliseconds` alto porque o padrão do pg_net (5s) é curto demais:
 * montar o pacote e subir para o Dropbox passa disso com folga, e um timeout
 * aqui deixaria o histórico sem resposta mesmo quando o back-up deu certo.
 */
select cron.unschedule('backup-do-sistema')
 where exists (select 1 from cron.job where jobname = 'backup-do-sistema');

select cron.schedule(
  'backup-do-sistema',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://qtubypczpkkrdbvgdziu.supabase.co/functions/v1/backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{"acao":"agendado"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $cron$
);
