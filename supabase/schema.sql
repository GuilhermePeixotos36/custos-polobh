-- ============================================================================
-- Pólobh — Schema Supabase (Postgres). Aplicar quando for plugar o backend.
-- Inclui tabelas, RLS habilitada e policies por papel (perfis.papel).
--
-- COMO PROVISIONAR UM AMBIENTE NOVO
--   1. Rode este arquivo (baseline).
--   2. Rode tudo em supabase/migrations/ em ordem de nome.
--
-- As migrações são as donas de qualquer mudança posterior a 21/07/2026 — elas
-- redefinem objetos daqui (por exemplo `salvar_ec_completa`, que ganhou trava
-- otimista e guarda de valores). Nada deve ser aplicado direto no painel do
-- Supabase sem virar migração: foi assim que a coluna `perfis.telefone` e a
-- função `gerenciar-usuarios` ficaram só em produção, fora do repositório.
-- ============================================================================

-- Perfis de usuário (liga ao auth.users do Supabase)
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  papel text check (papel in ('Admin','Direcao','Producao','Administrativo')) not null,
  telefone text not null default '', -- contato do usuário (produtora responsável)
  criado_em timestamptz default now()
);

-- Helper criado antes de qualquer policy que o utiliza.
create or replace function papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid()
$$;

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

-- Empresas do grupo Pólobh (Pólobh Promoções Eireli / MF Promoções Eireli).
-- Preenchem os dados fiscais da OS quando tomador/contratante = Pólobh.
-- Configuradas na tela Configurações. `padrao` marca a empresa usada na emissão.
create table if not exists empresas_grupo (
  id text primary key,               -- 'polobh' | 'mf'
  nome text not null,
  razao_social text default '',
  cnpj text default '',
  endereco text default '',
  inscricao_estadual text default '',
  inscricao_municipal text default '',
  padrao boolean not null default false,
  ordem int default 0,
  atualizado_em timestamptz default now()
);
alter table empresas_grupo add column if not exists ordem int default 0;

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
drop policy if exists projetos_read on projetos;
create policy projetos_read on projetos for select using (papel_atual() is not null);
drop policy if exists projetos_write on projetos;
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
  ativa boolean not null default true, -- apenas uma EC ativa por projeto (as demais ficam arquivadas)
  status text check (status in ('Rascunho','Aguardando','Aprovada','Reprovada','Cancelada','Arquivada')) default 'Rascunho',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists ec_linhas (
  id uuid primary key default gen_random_uuid(),
  ec_id uuid references ecs(id) on delete cascade,
  grupo text,
  item text,
  descricao text,                     -- Descrição Financeiro (resumida)
  descricao_completa text default '', -- Descrição Completa (rich-text HTML, bullets/negrito)
  valor_polobh numeric default 0,
  valor_cliente numeric default 0,
  valor_gasto numeric default 0,      -- gasto até a data (rentabilidade por item)
  contrato text default '',           -- referência de contrato (modelos da Marisa)
  contrato_status text default 'Pendente', -- contrato pendente ou não (Pendente|OK)
  status_aprovacao text default 'Pendente',
  fornecedor_razao text,
  fornecedor_cnpj text,
  fornecedor_contato text not null default '', -- contato informado na linha (acumula no fornecedor)
  fatura_nf text,
  codigo_servico text,
  pedido_compra text,
  status_os text default 'Pendente',
  observacao text,                    -- legado (texto único); migrado p/ observacoes
  observacoes jsonb not null default '[]'::jsonb, -- [{texto, pessoa}] comentários do item
  oculto boolean not null default false, -- item ocultado da EC (some da visão e do Excel; reexibível)
  ordem int
);

-- Corrige bases antigas com mais de uma EC ativa e garante a regra no banco.
with duplicadas as (
  select id, row_number() over (partition by projeto_id order by atualizado_em desc nulls last, criado_em desc, id) as pos
  from ecs where ativa and projeto_id is not null
)
update ecs set ativa = false where id in (select id from duplicadas where pos > 1);
create unique index if not exists ecs_uma_ativa_por_projeto_idx on ecs (projeto_id) where ativa and projeto_id is not null;

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
  contrato jsonb,   -- bloco "Dados para Contrato" do modelo de OS
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

-- Os nomes e papéis são necessários para atribuir observações; e-mail não é exposto por esta tabela.
drop policy if exists perfis_self_read on perfis;
create policy perfis_self_read on perfis for select
  using (papel_atual() is not null);

-- Leitura geral para qualquer usuário autenticado com perfil
drop policy if exists clientes_read on clientes;
drop policy if exists fornecedores_read on fornecedores;
drop policy if exists ecs_read on ecs;
drop policy if exists ec_linhas_read on ec_linhas;
drop policy if exists oss_read on oss;
drop policy if exists os_linhas_read on os_linhas;
create policy clientes_read     on clientes     for select using (papel_atual() is not null);
create policy fornecedores_read on fornecedores for select using (papel_atual() is not null);
create policy ecs_read          on ecs          for select using (papel_atual() is not null);
create policy ec_linhas_read    on ec_linhas    for select using (papel_atual() is not null);
create policy oss_read          on oss          for select using (papel_atual() is not null);
create policy os_linhas_read    on os_linhas    for select using (papel_atual() is not null);

-- Escrita de EC: Admin, Direção e Produção
drop policy if exists ecs_write on ecs;
drop policy if exists ec_linhas_write on ec_linhas;
create policy ecs_write on ecs for all
  using (papel_atual() in ('Admin','Direcao','Producao'))
  with check (papel_atual() in ('Admin','Direcao','Producao'));
create policy ec_linhas_write on ec_linhas for all
  using (papel_atual() in ('Admin','Direcao','Producao'))
  with check (papel_atual() in ('Admin','Direcao','Producao'));

-- Salva cabeçalho e todas as linhas em uma única transação/RPC.
create or replace function salvar_ec_completa(p_ec_id uuid, p_ec jsonb, p_linhas jsonb)
returns uuid language plpgsql set search_path = public as $$
declare
  v_ec ecs;
  v_id uuid;
  v_ids uuid[];
  v_linhas jsonb;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  v_ec := jsonb_populate_record(null::ecs, p_ec);
  if v_ec.projeto_id is not null then perform pg_advisory_xact_lock(hashtext(v_ec.projeto_id::text)); end if;

  if coalesce(v_ec.ativa, false) and v_ec.projeto_id is not null then
    update ecs set ativa = false where projeto_id = v_ec.projeto_id and (p_ec_id is null or id <> p_ec_id);
  end if;

  if p_ec_id is null then
    insert into ecs (numero, projeto_id, template, cliente_id, cliente, cancelada_substituida, projeto, producao,
      responsavel, validade_dias, versao, ativa, status, criado_em, atualizado_em)
    values (v_ec.numero, v_ec.projeto_id, v_ec.template, v_ec.cliente_id, v_ec.cliente, v_ec.cancelada_substituida,
      v_ec.projeto, v_ec.producao, v_ec.responsavel, v_ec.validade_dias, v_ec.versao, v_ec.ativa, v_ec.status,
      coalesce(v_ec.criado_em, now()), coalesce(v_ec.atualizado_em, now())) returning id into v_id;
  else
    update ecs set numero=v_ec.numero, projeto_id=v_ec.projeto_id, template=v_ec.template, cliente_id=v_ec.cliente_id,
      cliente=v_ec.cliente, cancelada_substituida=v_ec.cancelada_substituida, projeto=v_ec.projeto,
      producao=v_ec.producao, responsavel=v_ec.responsavel, validade_dias=v_ec.validade_dias, versao=v_ec.versao,
      ativa=v_ec.ativa, status=v_ec.status, atualizado_em=coalesce(v_ec.atualizado_em, now())
    where id=p_ec_id returning id into v_id;
    if v_id is null then raise exception 'EC não encontrada'; end if;
  end if;

  select coalesce(jsonb_agg(x || jsonb_build_object('ec_id', v_id)), '[]'::jsonb),
         coalesce(array_agg((x->>'id')::uuid), '{}')
    into v_linhas, v_ids from jsonb_array_elements(p_linhas) x;
  if exists(select 1 from ec_linhas where id=any(v_ids) and ec_id<>v_id) then
    raise exception 'Linha pertence a outra EC';
  end if;
  delete from ec_linhas where ec_id=v_id and not (id=any(v_ids));

  insert into ec_linhas
  select * from jsonb_populate_recordset(null::ec_linhas, v_linhas)
  on conflict (id) do update set
    ec_id=excluded.ec_id, grupo=excluded.grupo, item=excluded.item, descricao=excluded.descricao,
    descricao_completa=excluded.descricao_completa, valor_polobh=excluded.valor_polobh,
    valor_cliente=excluded.valor_cliente, valor_gasto=excluded.valor_gasto, contrato=excluded.contrato,
    contrato_status=excluded.contrato_status, status_aprovacao=excluded.status_aprovacao,
    fornecedor_razao=excluded.fornecedor_razao, fornecedor_cnpj=excluded.fornecedor_cnpj,
    fornecedor_contato=excluded.fornecedor_contato, fatura_nf=excluded.fatura_nf,
    codigo_servico=excluded.codigo_servico, pedido_compra=excluded.pedido_compra,
    status_os=excluded.status_os, observacao=excluded.observacao, observacoes=excluded.observacoes,
    oculto=excluded.oculto, ordem=excluded.ordem;
  return v_id;
end;
$$;
revoke all on function salvar_ec_completa(uuid, jsonb, jsonb) from public, anon;
grant execute on function salvar_ec_completa(uuid, jsonb, jsonb) to authenticated;

create or replace function definir_ec_ativa(p_ec_id uuid)
returns void language plpgsql set search_path=public as $$
declare v_projeto uuid;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  select projeto_id into v_projeto from ecs where id=p_ec_id;
  if v_projeto is null then raise exception 'EC/projeto não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_projeto::text));
  update ecs set ativa=false where projeto_id=v_projeto and id<>p_ec_id;
  update ecs set ativa=true, status=case when status in ('Arquivada','Cancelada') then 'Rascunho' else status end where id=p_ec_id;
end; $$;
revoke all on function definir_ec_ativa(uuid) from public, anon;
grant execute on function definir_ec_ativa(uuid) to authenticated;

create or replace function nova_versao_ec(p_ec_id uuid)
returns uuid language plpgsql set search_path=public as $$
declare v_orig ecs; v_id uuid; v_versao int;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  select * into v_orig from ecs where id=p_ec_id for update;
  if v_orig.id is null or v_orig.projeto_id is null then raise exception 'EC/projeto não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_orig.projeto_id::text));
  select coalesce(max(versao),0)+1 into v_versao from ecs where projeto_id=v_orig.projeto_id;
  update ecs set ativa=false where projeto_id=v_orig.projeto_id;
  update ecs set cancelada_substituida=true, status='Arquivada', atualizado_em=now() where id=p_ec_id;
  insert into ecs (numero, projeto_id, template, cliente_id, cliente, cancelada_substituida, projeto, producao,
    responsavel, validade_dias, versao, ativa, status, criado_em, atualizado_em)
  values (regexp_replace(v_orig.numero, 'V[0-9]+$', 'V'||lpad(v_versao::text,2,'0')), v_orig.projeto_id,
    v_orig.template, v_orig.cliente_id, v_orig.cliente, true, v_orig.projeto, v_orig.producao,
    v_orig.responsavel, v_orig.validade_dias, v_versao, true, 'Rascunho', now(), now()) returning id into v_id;
  insert into ec_linhas (ec_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem)
  select v_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto, contrato,
    contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem from ec_linhas where ec_id=p_ec_id;
  return v_id;
end; $$;
revoke all on function nova_versao_ec(uuid) from public, anon;
grant execute on function nova_versao_ec(uuid) to authenticated;

-- Escrita de OS: Admin, Direção, Produção e Administrativo
drop policy if exists oss_write on oss;
drop policy if exists os_linhas_write on os_linhas;
create policy oss_write on oss for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));
create policy os_linhas_write on os_linhas for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));

-- Cadastros (clientes/fornecedores): Admin, Direção, Produção e Administrativo
drop policy if exists clientes_write on clientes;
drop policy if exists fornecedores_write on fornecedores;
create policy clientes_write on clientes for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));
create policy fornecedores_write on fornecedores for all
  using (papel_atual() in ('Admin','Direcao','Producao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Producao','Administrativo'));

-- Empresas do grupo: leitura para qualquer autenticado (usadas na emissão da OS);
-- escrita Direção/Admin/Administrativo (espelha a permissão da tela Configurações).
alter table empresas_grupo enable row level security;
drop policy if exists empresas_grupo_read on empresas_grupo;
drop policy if exists empresas_grupo_write on empresas_grupo;
create policy empresas_grupo_read on empresas_grupo for select using (papel_atual() is not null);
create policy empresas_grupo_write on empresas_grupo for all
  using (papel_atual() in ('Admin','Direcao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Administrativo'));

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
drop policy if exists os_fin_read on os_financeiro;
drop policy if exists os_fin_write on os_financeiro;
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
drop policy if exists cred_read on credenciamentos;
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
  referencia_id text,
  data_referencia date,
  criado_em timestamptz default now()
);
alter table emails enable row level security;
create unique index if not exists emails_lembrete_unico_idx on emails (tipo, referencia_id, data_referencia)
  where tipo = 'lembrete_cronograma';
drop policy if exists emails_read on emails;
create policy emails_read on emails for select using (papel_atual() in ('Admin','Direcao','Administrativo'));
-- escrita só pela service role (Edge Functions) — sem policy de insert para usuários.

insert into empresas_grupo (id, nome, padrao, ordem) values
  ('polobh', 'Pólobh Promoções Eireli', true, 0),
  ('mf', 'MF Promoções Eireli', false, 1)
on conflict (id) do nothing;

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
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert to authenticated with check (auth.uid() is not null);
-- Apenas Admin lê a trilha.
drop policy if exists audit_read on audit_log;
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
--     headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
--   );
--   $$
-- );
