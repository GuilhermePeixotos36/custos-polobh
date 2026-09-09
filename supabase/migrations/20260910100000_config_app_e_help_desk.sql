-- ============================================================================
-- Configurações do aplicativo, e o endereço do Help Desk    (10/09/2026)
--
-- Até aqui não havia ONDE guardar um ajuste do sistema. A tela de Configurações
-- tinha campos que não gravavam em lugar nenhum (o prazo de retenção, por
-- exemplo, vivia em `useState` e sumia ao trocar de aba), e qualquer ajuste novo
-- ou virava coluna numa tabela que não é dele, ou virava variável de ambiente —
-- que só quem publica consegue mudar.
--
-- Esta tabela é o lugar: uma chave, um valor em jsonb. Poucas linhas, lidas por
-- todo mundo que está logado e escritas só por quem administra o sistema.
--
-- A primeira chave é a do HELP DESK, o quinto botão do cabeçalho: para onde vai
-- o chamado que alguém abre de dentro do aplicativo. Começa apontando para o
-- suporte técnico que hoje mantém o sistema, e passa a ser editável em
-- Configurações › Geral sem precisar de deploy.
-- ============================================================================

create table if not exists config_app (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz default now()
);

comment on table config_app is
  'Ajustes do aplicativo (chave -> valor jsonb). Leitura para qualquer autenticado; escrita só para Admin/Direção. Ver src/store/configApp.ts.';

alter table config_app enable row level security;

drop policy if exists config_app_read on config_app;
drop policy if exists config_app_write on config_app;

-- Ler: qualquer pessoa logada. O endereço do suporte precisa chegar à tela de
-- quem abre o chamado, e quem abre chamado é justamente quem tem menos acesso.
create policy config_app_read on config_app for select using (papel_atual() is not null);

-- Escrever: quem administra. Mesma régua de `empresas_grupo`.
create policy config_app_write on config_app for all
  using (papel_atual() in ('Admin','Direcao'))
  with check (papel_atual() in ('Admin','Direcao'));

insert into config_app (chave, valor) values
  ('helpdesk', '{"email":"gpxautomacao@outlook.com","assinatura":"Suporte técnico do sistema Pólobh"}'::jsonb)
on conflict (chave) do nothing;
