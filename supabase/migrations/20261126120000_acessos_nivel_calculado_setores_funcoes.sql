-- =====================================================================
-- ACESSOS — nível calculado, cadastro de Setor e Função, senha redefinida   (26/11/2026)
--
-- Pedidos do Guilherme depois da primeira versão da tela de Acessos:
--
-- 1. O "Nível (papel no banco)" sai da tela. O que o grupo pode está nas marcações dele; o nível
--    que as regras antigas do banco ainda leem (`perfis.papel`) passa a ser CALCULADO pelas
--    marcações, sempre que o grupo é salvo:
--      · Administrador de sistema ............................. Admin
--      · não edita Projetos nem Estimativas de Custo ........... Administrativo (Financeiro)
--      · edita e administra (Acessos, Configurações ou Logs) ... Direcao
--      · os demais ............................................. Producao
--    Conferido antes de aplicar: dá o mesmo nível de hoje nos 6 grupos. A regra só cresce com as
--    marcações, então quem não é Administrador — e só concede o que tem — nunca chega a um nível
--    acima do seu.
-- 2. Cadastro de SETOR e de FUNÇÃO (cargo): a tela do usuário escolhe de uma lista, sem digitação
--    livre (evita "Produção" e "producao" como dois setores). Nome único sem diferenciar caixa nem
--    acento nas pontas; nunca se exclui, inativa. Já nascem com os setores e funções da casa, e a
--    equipe atual recebe o seu.
-- 3. "Esqueceu a senha?" volta a mandar o link por e-mail (decisão do Guilherme). Quem define a
--    senha pelo link escolheu ela mesma: `marcar_minha_senha_definitiva` tira a marca de provisória.
-- =====================================================================

-- --- 1. Nível calculado ----------------------------------------------------------------
create or replace function private.nivel_do_grupo(p_grupo uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when g.sistema then 'Admin'
    when not exists (
      select 1 from public.acesso_grupo_permissao p
       where p.grupo_id = g.id and p.acao = 'editar' and p.tela in ('projetos', 'ecs')
    ) then 'Administrativo'
    when exists (
      select 1 from public.acesso_grupo_permissao p
       where p.grupo_id = g.id and p.tela in ('acessos.usuarios', 'acessos.grupos', 'configuracoes', 'admin.logs')
    ) then 'Direcao'
    else 'Producao'
  end
  from public.acesso_grupo g where g.id = p_grupo;
$$;
revoke all on function private.nivel_do_grupo(uuid) from public;

create or replace function public.salvar_grupo_acesso(p jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_id uuid;
  v_nome text := btrim(coalesce(p ->> 'nome', '')); v_desc text := btrim(coalesce(p ->> 'descricao', ''));
  v_grupo public.acesso_grupo; v_ativo boolean; v_item jsonb; v_ativos integer; v_excedentes text; v_nivel text;
begin
  if v_uid is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Dados do grupo inválidos.' using errcode = '22023'; end if;
  if coalesce(p ->> 'id', '') <> '' then
    if (p ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Identificador de grupo inválido.' using errcode = '22023';
    end if;
    v_id := (p ->> 'id')::uuid;
  end if;
  if length(v_nome) < 2 or length(v_nome) > 80 then raise exception 'Informe o nome do grupo (de 2 a 80 caracteres).' using errcode = '22023'; end if;
  if length(v_desc) > 500 then raise exception 'A descrição do grupo passa de 500 caracteres.' using errcode = '22023'; end if;
  if p ? 'ativo' and jsonb_typeof(p -> 'ativo') <> 'boolean' then raise exception 'O campo "ativo" deve ser verdadeiro ou falso.' using errcode = '22023'; end if;
  if p ? 'permissoes' then
    if jsonb_typeof(p -> 'permissoes') <> 'array' then raise exception 'As permissões devem ser uma lista de tela e ação.' using errcode = '22023'; end if;
    if jsonb_array_length(p -> 'permissoes') > 1000 then raise exception 'Permissões demais para um grupo.' using errcode = '22023'; end if;
    for v_item in select e from jsonb_array_elements(p -> 'permissoes') as t(e) loop
      if jsonb_typeof(v_item) <> 'object'
         or jsonb_typeof(v_item -> 'tela') <> 'string' or (v_item ->> 'tela') !~ '^[a-z0-9_.-]+$'
         or jsonb_typeof(v_item -> 'acao') <> 'string' or (v_item ->> 'acao') !~ '^[a-z_]+$' then
        raise exception 'Permissão inválida: cada item precisa de tela e ação.' using errcode = '22023';
      end if;
    end loop;
  end if;
  if p ? 'permissoes' and not private.sou_administrador() then
    select string_agg(distinct (t.e ->> 'tela') || ' · ' || (t.e ->> 'acao'), ', ') into v_excedentes
      from jsonb_array_elements(p -> 'permissoes') as t(e)
     where not exists (
       select 1 from public.perfis u
       join public.acesso_grupo gc on gc.id = u.grupo_id and gc.ativo
       join public.acesso_grupo_permissao minha on minha.grupo_id = gc.id
       where u.id = v_uid and u.status = 'ativo' and minha.tela = t.e ->> 'tela' and minha.acao = t.e ->> 'acao');
    if v_excedentes is not null then
      raise exception 'Você só pode conceder permissões que você mesmo tem. Fora do seu acesso: %', v_excedentes using errcode = '42501';
    end if;
  end if;
  perform set_config('polobh.acesso_interno', '1', true);
  if v_id is null then
    if not public.tem_permissao('acessos.grupos', 'criar') then raise exception 'Você não tem permissão para criar grupos de permissão.' using errcode = '42501'; end if;
    v_ativo := coalesce((p ->> 'ativo')::boolean, true);
    begin
      insert into public.acesso_grupo (nome, descricao, ativo) values (v_nome, v_desc, v_ativo) returning id into v_id;
    exception when unique_violation then raise exception 'Já existe um grupo com este nome.' using errcode = '22023';
    end;
  else
    if not public.tem_permissao('acessos.grupos', 'editar') then raise exception 'Você não tem permissão para editar grupos de permissão.' using errcode = '42501'; end if;
    select * into v_grupo from public.acesso_grupo g where g.id = v_id for update;
    if not found then raise exception 'Grupo não encontrado.' using errcode = '22023'; end if;
    if v_grupo.sistema then raise exception 'O grupo Administrador de sistema não pode ser alterado.' using errcode = '42501'; end if;
    if exists (select 1 from public.perfis u where u.id = v_uid and u.grupo_id = v_id) then
      raise exception 'Você não pode alterar o grupo ao qual pertence.' using errcode = '42501';
    end if;
    v_ativo := coalesce((p ->> 'ativo')::boolean, v_grupo.ativo);
    if v_grupo.ativo and not v_ativo then
      if not public.tem_permissao('acessos.grupos', 'inativar') then raise exception 'Você não tem permissão para inativar grupos de permissão.' using errcode = '42501'; end if;
      select count(*) into v_ativos from public.perfis u where u.grupo_id = v_id and u.status = 'ativo';
      if v_ativos > 0 then raise exception 'O grupo tem % usuário(s) ativo(s). Mude o grupo deles antes de inativar.', v_ativos using errcode = '22023'; end if;
    end if;
    begin
      update public.acesso_grupo set nome = v_nome, descricao = v_desc, ativo = v_ativo where id = v_id;
    exception when unique_violation then raise exception 'Já existe um grupo com este nome.' using errcode = '22023';
    end;
  end if;
  if p ? 'permissoes' then
    delete from public.acesso_grupo_permissao where grupo_id = v_id;
    insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
    select distinct v_id, e ->> 'tela', e ->> 'acao' from jsonb_array_elements(p -> 'permissoes') as t(e);
  end if;
  -- O nível sai das marcações (o gatilho `acesso_grupo_propagar_papel` leva o papel a quem está no grupo).
  v_nivel := private.nivel_do_grupo(v_id);
  update public.acesso_grupo set papel_base = v_nivel where id = v_id and papel_base is distinct from v_nivel;
  perform set_config('polobh.acesso_interno', '', true);
  perform private.registrar_log_interno('atividade', 'info',
    case when p ? 'id' and coalesce(p ->> 'id', '') <> '' then 'grupo_alterado' else 'grupo_criado' end,
    'ok', v_uid, '/acessos', 'Grupo de permissão "' || v_nome || '" salvo', 'grupo', v_id::text, v_nome, null);
  return v_id;
end; $$;

-- Os grupos que já existem passam pelo cálculo (conferido: nenhum muda).
do $$
begin
  perform set_config('polobh.acesso_interno', '1', true);
  update public.acesso_grupo g set papel_base = private.nivel_do_grupo(g.id)
   where not g.sistema and g.papel_base is distinct from private.nivel_do_grupo(g.id);
  perform set_config('polobh.acesso_interno', '', true);
end; $$;

-- --- 2. Setores e funções ------------------------------------------------------------------
create table if not exists public.acesso_setor (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (length(btrim(nome)) between 2 and 120),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists acesso_setor_nome_key on public.acesso_setor (lower(btrim(nome)));

create table if not exists public.acesso_funcao (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (length(btrim(nome)) between 2 and 200),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists acesso_funcao_nome_key on public.acesso_funcao (lower(btrim(nome)));

comment on table public.acesso_setor is 'Setores da casa. O cadastro do usuário escolhe daqui (perfis.setor guarda o nome). Nunca se exclui: inativa.';
comment on table public.acesso_funcao is 'Funções/cargos da casa. O cadastro do usuário escolhe daqui (perfis.cargo guarda o nome). Nunca se exclui: inativa.';

alter table public.acesso_setor enable row level security;
alter table public.acesso_funcao enable row level security;
revoke all on public.acesso_setor, public.acesso_funcao from anon;
revoke delete, truncate on public.acesso_setor, public.acesso_funcao from authenticated;
grant select, insert, update on public.acesso_setor, public.acesso_funcao to authenticated;

drop policy if exists acesso_setor_leitura on public.acesso_setor;
create policy acesso_setor_leitura on public.acesso_setor for select to authenticated using ((select private.esta_ativo()));
drop policy if exists acesso_setor_escrita on public.acesso_setor;
create policy acesso_setor_escrita on public.acesso_setor for insert to authenticated
  with check ((select public.tem_permissao('acessos.usuarios', 'editar')));
drop policy if exists acesso_setor_alteracao on public.acesso_setor;
create policy acesso_setor_alteracao on public.acesso_setor for update to authenticated
  using ((select public.tem_permissao('acessos.usuarios', 'editar')))
  with check ((select public.tem_permissao('acessos.usuarios', 'editar')));

drop policy if exists acesso_funcao_leitura on public.acesso_funcao;
create policy acesso_funcao_leitura on public.acesso_funcao for select to authenticated using ((select private.esta_ativo()));
drop policy if exists acesso_funcao_escrita on public.acesso_funcao;
create policy acesso_funcao_escrita on public.acesso_funcao for insert to authenticated
  with check ((select public.tem_permissao('acessos.usuarios', 'editar')));
drop policy if exists acesso_funcao_alteracao on public.acesso_funcao;
create policy acesso_funcao_alteracao on public.acesso_funcao for update to authenticated
  using ((select public.tem_permissao('acessos.usuarios', 'editar')))
  with check ((select public.tem_permissao('acessos.usuarios', 'editar')));

insert into public.acesso_setor (nome) values
  ('Diretoria'), ('Produção'), ('Administrativo-Financeiro'), ('Back-office'), ('Tecnologia')
on conflict do nothing;
insert into public.acesso_funcao (nome) values
  ('Diretoria de Produção'), ('Coordenação de Produção'), ('Coordenação Administrativo-Financeira'),
  ('Back-office'), ('Produção'), ('Desenvolvimento')
on conflict do nothing;

-- A equipe atual recebe setor e função pelo grupo em que está (setor e cargo não são campos
-- travados: a migração grava direto).
update public.perfis p set
  setor = coalesce(p.setor, case g.nome
    when 'Administrador de sistema' then 'Tecnologia'
    when 'Diretoria Produção' then 'Diretoria'
    when 'Coordenação Produção' then 'Produção'
    when 'Coordenação Administrativo-Financeira' then 'Administrativo-Financeiro'
    when 'Back-office' then 'Back-office'
    when 'Produção' then 'Produção' end),
  cargo = coalesce(p.cargo, case g.nome
    when 'Administrador de sistema' then 'Desenvolvimento'
    when 'Diretoria Produção' then 'Diretoria de Produção'
    when 'Coordenação Produção' then 'Coordenação de Produção'
    when 'Coordenação Administrativo-Financeira' then 'Coordenação Administrativo-Financeira'
    when 'Back-office' then 'Back-office'
    when 'Produção' then 'Produção' end)
from public.acesso_grupo g
where g.id = p.grupo_id;

-- --- 3. Senha definida pela própria pessoa (link do e-mail) ---------------------------------
create or replace function public.marcar_minha_senha_definitiva()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return; end if;
  perform set_config('polobh.acesso_interno', '1', true);
  update public.perfis set senha_provisoria = false where id = (select auth.uid()) and senha_provisoria;
  perform set_config('polobh.acesso_interno', '', true);
end;
$$;
revoke all on function public.marcar_minha_senha_definitiva() from public, anon;
grant execute on function public.marcar_minha_senha_definitiva() to authenticated;
