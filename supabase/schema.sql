-- ============================================================================
-- Pólobh — Schema Supabase (Postgres). Aplicar quando for plugar o backend.
-- Inclui tabelas, RLS habilitada e policies por papel (perfis.papel).
-- ============================================================================

-- Perfis de usuário (liga ao auth.users do Supabase)
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  papel text check (papel in ('Admin','Direcao','Producao','Administrativo')) not null,
  criado_em timestamptz default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  razao_social text,
  endereco text,
  cnpj_cpf text,
  inscricao_estadual text,
  inscricao_municipal text,
  representante jsonb,
  criado_em timestamptz default now()
);

create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text,
  cnpj text,
  perfil_tributario text,
  endereco text,
  inscricao_estadual text,
  inscricao_municipal text,
  dados_bancarios jsonb,
  contato jsonb,
  cnaes jsonb,
  contatos jsonb not null default '[]'::jsonb, -- contatos acumulados a partir das ECs
  criado_em timestamptz default now()
);

-- Projeto: container de tudo (hierarquia project-centric). Dono das ECs.
create table if not exists projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  cliente jsonb,
  projeto jsonb,   -- infos do projeto (título, modalidade, datas, local, roteiro...)
  docs_url text default '',
  status text not null default 'Ativo' check (status in ('Ativo','Arquivado','Concluido','Cancelado')),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
alter table projetos enable row level security;
create policy projetos_read on projetos for select using (papel_atual() is not null);
create policy projetos_write on projetos for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));

create table if not exists ecs (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  slug_publico text unique default encode(gen_random_bytes(9), 'hex'), -- link público do cronograma
  projeto_id uuid references projetos(id), -- Projeto a que a EC pertence
  template text,                           -- 'Corporativo' | 'Cultural'
  cliente_id uuid references clientes(id),
  cliente jsonb,            -- snapshot embutido do cliente (o app edita inline)
  cancelada_substituida boolean default false,
  projeto jsonb not null,
  producao jsonb not null,
  responsavel text,
  validade_dias int default 30,
  versao int not null default 1,
  status text check (status in ('Rascunho','Aguardando','Aprovada','Reprovada','Cancelada','Arquivada')) default 'Rascunho',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists ec_linhas (
  id uuid primary key default gen_random_uuid(),
  ec_id uuid references ecs(id) on delete cascade,
  grupo text,
  item text,
  descricao text,
  valor_polobh numeric default 0,
  valor_cliente numeric default 0,
  valor_gasto numeric default 0,      -- gasto até a data (rentabilidade por item)
  contrato text default '',           -- referência de contrato (modelos da Marisa)
  status_aprovacao text default 'Pendente',
  fornecedor_razao text,
  fornecedor_cnpj text,
  fornecedor_contato text not null default '', -- contato informado na linha (acumula no fornecedor)
  fatura_nf text,
  codigo_servico text,
  pedido_compra text,
  status_os text default 'Pendente',
  observacao text,
  ordem int
);

create table if not exists oss (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  slug_credenciamento text unique default encode(gen_random_bytes(9), 'hex'), -- token do link público de credenciamento
  ec_id uuid references ecs(id),
  seq int not null,
  fornecedor jsonb not null,
  modalidade text,
  descritivo text,
  entrega text,
  detalhamento jsonb,
  cronograma jsonb,
  logistica jsonb,
  infraestrutura jsonb,
  credenciamento jsonb,
  orcamento jsonb,
  -- financeiro NÃO fica aqui (vazaria p/ qualquer autenticado via RLS de leitura).
  -- Vai em os_financeiro, com RLS restrita por papel. Ver abaixo.
  -- BV fica aqui (editável pela Produção via oss_write); o resto do financeiro não.
  bv jsonb not null default '{"percentual":0,"valor":0,"justificativa":""}'::jsonb,
  observacoes text,
  status text check (status in ('Rascunho','Emitida','Disparada','Cancelada')) default 'Rascunho',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Vínculo OS <-> linhas da EC consolidadas
create table if not exists os_linhas (
  os_id uuid references oss(id) on delete cascade,
  ec_linha_id uuid references ec_linhas(id) on delete cascade,
  primary key (os_id, ec_linha_id)
);

-- ----------------------------------------------------------------------------
-- Helper: papel do usuário autenticado
-- ----------------------------------------------------------------------------
create or replace function papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- Criação automática de perfil ao cadastrar usuário no Supabase Auth.
-- O papel vem de raw_user_meta_data->>'papel' (default 'Producao').
-- ----------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'papel', 'Producao')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Endurecimento: funções SECURITY DEFINER não devem ser RPC públicas.
revoke all on function handle_new_user() from public, anon, authenticated;
revoke all on function papel_atual() from anon;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table perfis        enable row level security;
alter table clientes      enable row level security;
alter table fornecedores  enable row level security;
alter table ecs           enable row level security;
alter table ec_linhas     enable row level security;
alter table oss           enable row level security;
alter table os_linhas     enable row level security;

-- Perfis: cada um lê o próprio; Direção e Admin leem todos
create policy perfis_self_read on perfis for select
  using (id = auth.uid() or papel_atual() in ('Direcao','Admin'));

-- Leitura geral para qualquer usuário autenticado com perfil
create policy clientes_read     on clientes     for select using (papel_atual() is not null);
create policy fornecedores_read on fornecedores for select using (papel_atual() is not null);
create policy ecs_read          on ecs          for select using (papel_atual() is not null);
create policy ec_linhas_read    on ec_linhas    for select using (papel_atual() is not null);
create policy oss_read          on oss          for select using (papel_atual() is not null);
create policy os_linhas_read    on os_linhas    for select using (papel_atual() is not null);

-- Escrita de EC: Admin, Direção e Produção
create policy ecs_write on ecs for all
  using (papel_atual() in ('Admin','Direcao','Producao'))
  with check (papel_atual() in ('Admin','Direcao','Producao'));
create policy ec_linhas_write on ec_linhas for all
  using (papel_atual() in ('Admin','Direcao','Producao'))
  with check (papel_atual() in ('Admin','Direcao','Producao'));

-- Escrita de OS: Admin, Direção, Produção e Administrativo
create policy oss_write on oss for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));
create policy os_linhas_write on os_linhas for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));

-- Cadastros (clientes/fornecedores): Admin, Direção, Produção e Administrativo
create policy clientes_write on clientes for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));
create policy fornecedores_write on fornecedores for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));

-- OBS.: o cronograma público (sem login) é servido pela Edge Function
-- `cronograma-publico` (service role, verify_jwt=false), que devolve apenas os
-- campos do cronograma a partir de ecs.slug_publico — nunca expõe as tabelas ao anon.

-- ============================================================================
-- Financeiro da OS — tabela separada, restrita por papel (fix BOLA).
-- Mantê-lo em oss vazaria BV/valores p/ qualquer autenticado via oss_read.
-- ============================================================================
create table if not exists os_financeiro (
  os_id uuid primary key references oss(id) on delete cascade,
  dados jsonb not null,
  atualizado_em timestamptz default now()
);
alter table os_financeiro enable row level security;
create policy os_fin_read on os_financeiro for select
  using (papel_atual() in ('Admin','Direcao','Administrativo'));
create policy os_fin_write on os_financeiro for all
  using (papel_atual() in ('Admin','Direcao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Administrativo'));

-- ============================================================================
-- Credenciamento: respostas enviadas pelos fornecedores no formulário público
-- (via Edge Function `credenciamento`). Equipe interna lê; escrita só service role.
-- ============================================================================
create table if not exists credenciamentos (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references oss(id) on delete cascade,
  equipe jsonb not null default '[]'::jsonb,    -- [{nome, cpf, funcao}]
  veiculos jsonb not null default '[]'::jsonb,  -- [{modelo, placa}]
  enviado_em timestamptz default now()
);
create index if not exists credenciamentos_os_idx on credenciamentos (os_id);
alter table credenciamentos enable row level security;
create policy cred_read on credenciamentos for select using (papel_atual() is not null);
-- Sem policy de insert para usuários: o envio público passa pela Edge Function
-- (service role), que valida o token e o prazo antes de gravar.

-- ============================================================================
-- E-mails (Brevo) — log/outbox dos envios automáticos
-- ============================================================================
create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  tipo text,                       -- disparar_os | credenciamento | lembrete_cronograma | ec_aprovacao
  assunto text,
  destinatarios jsonb,             -- array de e-mails
  provider_id text,                -- messageId devolvido pelo Brevo
  status text default 'enviado',   -- enviado | erro
  erro text,
  criado_em timestamptz default now()
);
alter table emails enable row level security;
create policy emails_read on emails for select using (papel_atual() in ('Admin','Direcao','Administrativo'));
-- escrita só pela service role (Edge Functions) — sem policy de insert para usuários.

-- ============================================================================
-- Trilha de auditoria (logs do sistema) — visível só ao perfil Admin
-- ============================================================================
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  nivel text not null default 'info' check (nivel in ('info','aviso','erro')),
  categoria text not null,
  acao text not null,
  mensagem text not null,
  usuario text,
  papel text,
  user_id uuid references auth.users(id) on delete set null,
  alvo_id text
);
create index if not exists audit_log_ts_idx on audit_log (ts desc);

alter table audit_log enable row level security;
-- Usuário autenticado registra eventos (append-only).
create policy audit_insert on audit_log for insert to authenticated with check (auth.uid() is not null);
-- Apenas Admin lê a trilha.
create policy audit_read on audit_log for select using (papel_atual() = 'Admin');
-- Sem policies de update/delete: a trilha é imutável pelos usuários.

-- ----------------------------------------------------------------------------
-- Agendamento do lembrete de cronograma (2 dias úteis antes do evento).
-- Requer as extensões pg_cron e pg_net habilitadas no projeto Supabase.
-- Ajuste <PROJECT_REF> e a chave. Roda todo dia útil às 09:00 (UTC-3 ≈ 12:00 UTC).
-- ----------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule(
--   'lembretes-cronograma',
--   '0 12 * * 1-5',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.functions.supabase.co/lembretes-cronograma',
--     headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
--   );
--   $$
-- );
