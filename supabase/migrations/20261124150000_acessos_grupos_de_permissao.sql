-- ACESSOS — GRUPOS DE PERMISSÃO (padrão de Acessos do Grupo LSPRO, PARTE 1) — 24/11/2026
--
-- O que muda para quem usa: as abas "Áreas e permissões" e "Usuários" saem de Configurações e
-- viram a tela /acessos (sub-abas Usuários e Grupos de permissão). A ÁREA vira GRUPO DE
-- PERMISSÃO, com uma matriz tela × ação (src/config/acessos/catalogo.ts) no lugar da lista solta
-- de recursos. Ninguém perde nem ganha acesso na virada: cada área vira um grupo com o MESMO id,
-- o mesmo nome, o mesmo nível e exatamente as mesmas permissões — e a migration confere isso no
-- fim (bloco 10) e desiste se algo não bater.
--
-- ADAPTAÇÕES do padrão decididas pelo dono do app (24/11/2026), que mexem em regras
-- "inegociáveis" e por isso ficam registradas aqui e no catálogo:
--   * sem Microsoft 365 / SSO / Graph: login só por e-mail e senha. Não há `ms_object_id`,
--     `entradas_dos_usuarios()` nem identidade azure; a Edge `acessos` sempre cria com senha;
--   * sem lista de colaboradores de outro app (DPRH): não há `origem`, `colaborador_id` nem o
--     espelho `colaboradores_dp`. Todo usuário é cadastrado aqui (nome, e-mail, setor, cargo);
--   * a recuperação de senha pela própria pessoa CONTINUA (rota /nova-senha e "Esqueci minha
--     senha"): nada disso mora no banco, então esta migration não toca no assunto.
--
-- COMO O BANCO ANTIGO CONTINUA VALENDO (Tempo 2 de migracao-de-app-existente.md). As policies do
-- app decidem por `papel_atual()` (Admin, Direcao, Producao, Administrativo) e por
-- `tem_recurso()` / `recurso_da_area()` (recursos da área). Nenhuma policy é reescrita:
--   * o PAPEL passa a ser derivado do grupo (grupo de sistema → 'Admin'; os demais → o "nível no
--     banco" do grupo, `papel_legado`, que é o `papel_base` da área de origem). O nível continua
--     existindo porque as policies distinguem quatro papéis, não "escreve × só lê";
--   * a tabela `areas` vira ESPELHO do grupo (mesmo id, nome, nível e os recursos traduzidos da
--     matriz pelo mapa do bloco 1). Quem ainda lê a área — push de pendências, Produtor
--     Responsável, a casca — continua lendo a mesma coisa. Ninguém mais grava em `areas`: só os
--     gatilhos deste arquivo;
--   * `perfis.area_id` acompanha o grupo (o de sistema não tem área, como o Administrador hoje);
--   * `tem_recurso` e `recurso_da_area` (mesma assinatura) passam a ler o GRUPO de quem tem
--     grupo — sem a regra antiga de "área sem recurso cai no padrão do papel", que daria a um
--     grupo sem nenhuma permissão o padrão inteiro do nível.
--
-- STATUS. `perfis.ativo` (booleano lido por `papel_atual()` e por várias policies) fica, e ganha
-- a irmã `perfis.status` (pendente / ativo / inativo), sincronizadas por gatilho. Pendente = a
-- conta apareceu no Auth sem passar pela tela de Acessos (convite antigo, painel do Supabase):
-- nasce sem grupo e sem acesso. Antes desta migration o gatilho de cadastro dava 'Producao' ATIVO
-- a qualquer conta nova — e lia o papel do `raw_user_meta_data`, que quem se cadastra controla.
--
-- ESCRITA POR TELA (PARTE 2 do padrão, Fase 6) NÃO está aqui: até ela entrar, o banco separa o
-- que o NÍVEL separa (as policies de sempre) e o que `tem_recurso` separa; a matriz decide o
-- resto só na tela. Ver docs/acessos.md (pendências e o rascunho do mapa tabela → telas).
--
-- ORDEM DE PUBLICAÇÃO: este banco → Edge `acessos` (nova) e `gerenciar-usuarios` (atualizada) →
-- front. O front desta branch roda contra o banco antigo em modo de compatibilidade.
--
-- REVERTER (resumo): `drop trigger` de perfis_a_sincronizar_status, perfis_proteger_campos,
-- perfis_z_grupo_padrao, perfis_zz_espelhar_grupo, perfis_administrador_presente,
-- acesso_grupo_proteger, acesso_grupo_espelhar_area, acesso_grupo_permissao_proteger,
-- acesso_grupo_permissao_espelhar_area; recriar `perfis_impedir_lockout` e a policy `areas_write`
-- (definições em 20260924*/20260809*); voltar `handle_new_user`, `tem_recurso` e
-- `recurso_da_area` às versões anteriores; devolver os grants de escrita em `areas`. Tabelas e
-- colunas novas podem ficar, sem uso.
--
-- ENSAIO (antes de aplicar de verdade): ver o bloco "ENSAIO" no fim deste arquivo.

begin;

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 1. Mapa recurso antigo → (tela, ação) do catálogo
-- ---------------------------------------------------------------------------------------------
-- Um recurso, uma permissão — nos dois sentidos. É ele que traduz as áreas em grupos (bloco 10),
-- mantém `areas.recursos` espelhado e deixa `tem_recurso` ler o grupo. O mesmo mapa mora no
-- front (`RECURSO_POR_PERMISSAO`, src/config/acessos/catalogo.ts) e um teste confere que os dois
-- são iguais (src/lib/acessos/mapaRecursos.test.ts lê ESTE arquivo). Chave se acrescenta, nunca
-- se renomeia.
create table if not exists private.acesso_recurso_legado (
  recurso text primary key,
  tela    text not null,
  acao    text not null,
  unique (tela, acao)
);

comment on table private.acesso_recurso_legado is
  'Recurso antigo (store/auth.ts) <-> tela e ação do catálogo de Acessos. Mesmo conteúdo de RECURSO_POR_PERMISSAO no front.';

insert into private.acesso_recurso_legado (recurso, tela, acao) values
  -- MAPA-RECURSOS-INICIO (o teste lê as linhas entre os dois marcadores)
  ('projetos', 'projetos.projetos', 'ver'),
  ('projetos.editar', 'projetos.projetos', 'editar'),
  ('checklists', 'projetos.checklists', 'ver'),
  ('checklists.editar', 'projetos.checklists', 'editar'),
  ('checklists.excluir', 'projetos.checklists', 'excluir'),
  ('checklists.padrao', 'projetos.checklists', 'lista_padrao'),
  ('cronogramas', 'projetos.cronogramas', 'ver'),
  ('ecs', 'estimativas.ec', 'ver'),
  ('ecs.editar', 'estimativas.ec', 'editar'),
  ('financeiro', 'estimativas.ec', 'ver_valores'),
  ('rentabilidade', 'estimativas.ec', 'ver_rentabilidade'),
  ('oss', 'ordens.os', 'ver'),
  ('oss.editar', 'ordens.os', 'editar'),
  ('oss.validarContrato', 'ordens.os', 'validar_contrato'),
  ('oss.emitir', 'ordens.os', 'emitir'),
  ('oss.etapaFinanceiro', 'ordens.os', 'etapa_financeiro'),
  ('oss.etapaBackoffice', 'ordens.os', 'etapa_backoffice'),
  ('contratos.clausulas', 'ordens.os', 'clausulas'),
  ('oss.financeiro', 'ordens.financeiro', 'ver'),
  ('oss.financeiro.editar', 'ordens.financeiro', 'editar'),
  ('fornecedores', 'cadastros.fornecedores', 'ver'),
  ('fornecedores.editar', 'cadastros.fornecedores', 'editar'),
  ('guia', 'ajuda.guia', 'ver'),
  ('configuracoes', 'admin.configuracoes', 'ver'),
  ('logs', 'admin.logs', 'ver'),
  ('acessos.usuarios', 'acessos.usuarios', 'ver'),
  ('acessos.grupos', 'acessos.grupos', 'ver')
  -- MAPA-RECURSOS-FIM
on conflict (recurso) do update set tela = excluded.tela, acao = excluded.acao;

revoke all on private.acesso_recurso_legado from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Grupos e permissões
-- ---------------------------------------------------------------------------------------------
create table if not exists public.acesso_grupo (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(btrim(nome)) > 0),
  descricao     text not null default '',
  -- Grupo de sistema (Administrador de sistema): tudo liberado, não se renomeia nem se inativa.
  sistema       boolean not null default false,
  ativo         boolean not null default true,
  -- Grupo que recebe quem fica ativo sem grupo por um caminho antigo. Um só; não se inativa.
  padrao        boolean not null default false,
  -- Nível no banco (adaptação Pólobh): o papel que as policies antigas leem, derivado para quem
  -- está no grupo. O de sistema não tem (vira 'Admin').
  papel_legado  text check (papel_legado in ('Direcao', 'Producao', 'Administrativo')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint acesso_grupo_nivel_obrigatorio check (sistema or papel_legado is not null)
);

create unique index if not exists acesso_grupo_nome_key on public.acesso_grupo (lower(btrim(nome)));
create unique index if not exists acesso_grupo_sistema_key on public.acesso_grupo ((true)) where sistema;
create unique index if not exists acesso_grupo_padrao_key on public.acesso_grupo ((true)) where padrao;

comment on table public.acesso_grupo is
  'Grupos de permissão (antigas áreas; o id do grupo é o id da área espelhada). O de sistema libera tudo sem linhas em acesso_grupo_permissao.';
comment on column public.acesso_grupo.papel_legado is
  'Nível no banco: o papel (Direcao/Producao/Administrativo) que quem está no grupo recebe em perfis.papel, lido pelas policies antigas.';

create table if not exists public.acesso_grupo_permissao (
  grupo_id uuid not null references public.acesso_grupo (id) on delete cascade,
  tela     text not null check (tela ~ '^[a-z0-9_.-]+$'),
  acao     text not null check (acao ~ '^[a-z_]+$'),
  primary key (grupo_id, tela, acao)
);

comment on table public.acesso_grupo_permissao is
  'Tela x ação liberadas ao grupo. O banco não conhece o catálogo: quem o define é o app (src/config/acessos/catalogo.ts).';

-- ---------------------------------------------------------------------------------------------
-- 3. Usuário (perfis): grupo, status, setor e cargo
-- ---------------------------------------------------------------------------------------------
alter table public.perfis
  add column if not exists grupo_id uuid references public.acesso_grupo (id) on delete restrict,
  add column if not exists status   text,
  add column if not exists cargo    text,
  add column if not exists setor    text;

update public.perfis set status = case when ativo then 'ativo' else 'inativo' end where status is null;
alter table public.perfis alter column status set default 'pendente';
alter table public.perfis alter column status set not null;
alter table public.perfis drop constraint if exists perfis_status_check;
alter table public.perfis add constraint perfis_status_check check (status in ('pendente', 'ativo', 'inativo'));

create index if not exists perfis_grupo_id_idx on public.perfis (grupo_id);

comment on column public.perfis.grupo_id is 'Grupo de permissão. Só muda pela RPC definir_acesso_do_usuario ou pela Edge acessos.';
comment on column public.perfis.status is 'pendente (conta sem cadastro em Acessos, sem acesso) / ativo / inativo. Sincronizado com perfis.ativo por gatilho.';
comment on column public.perfis.setor is 'Setor da pessoa, texto livre do app (sem lista de colaboradores de outro app).';
comment on column public.perfis.cargo is 'Cargo/função da pessoa, texto livre do app.';

-- Permissões específicas por usuário (v2.1 do padrão). A Pólobh não tem nenhuma hoje
-- (`PERMISSOES_ESPECIAIS` vazio): o que era "permissão especial" na área virou ação extra da
-- tela, porque vale para o time inteiro. A tabela existe para o banco ficar igual em todo app.
create table if not exists public.acesso_usuario_especial (
  usuario_id    uuid not null references public.perfis (id) on delete cascade,
  chave         text not null check (chave ~ '^[a-z][a-z0-9_.]{1,60}$'),
  concedida_por uuid references auth.users (id) on delete set null,
  concedida_em  timestamptz not null default now(),
  primary key (usuario_id, chave)
);

comment on table public.acesso_usuario_especial is
  'Permissões específicas ligadas a um usuário. Só mudam pela RPC definir_permissoes_especiais. A chave vem de PERMISSOES_ESPECIAIS (catalogo.ts).';

-- ---------------------------------------------------------------------------------------------
-- 4. Funções de consulta
-- ---------------------------------------------------------------------------------------------
create or replace function private.esta_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfis u where u.id = (select auth.uid()) and u.status = 'ativo');
$$;

/* Quem chama é usuário ativo do grupo de sistema (Administrador de sistema). */
create or replace function private.sou_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis u
    join public.acesso_grupo g on g.id = u.grupo_id
    where u.id = (select auth.uid()) and u.status = 'ativo' and g.sistema
  );
$$;

/*
 * O nível `p_alvo` está contido no `p_meu`? As policies antigas dão à Direção tudo o que dão à
 * Produção e ao Administrativo (Direcao aparece em toda lista de papel), e Produção e
 * Administrativo não se contêm (um grava EC, o outro lê back-up e e-mails). Usado para "quem não
 * é do Administrador nunca concede mais do que tem" também no nível.
 */
create or replace function private.nivel_contido(p_alvo text, p_meu text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_alvo is not null and p_meu is not null and (p_alvo = p_meu or p_meu = 'Direcao');
$$;

create or replace function public.tem_permissao(p_tela text, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis u
    join public.acesso_grupo g on g.id = u.grupo_id and g.ativo
    where u.id = (select auth.uid())
      and u.status = 'ativo'
      and (
        g.sistema
        or exists (
          select 1 from public.acesso_grupo_permissao p
          where p.grupo_id = g.id and p.tela = p_tela and p.acao = p_acao
        )
      )
  );
$$;

-- { grupo: {id, nome, sistema}, permissoes: [{tela, acao}], especiais: [chave] }; null sem
-- usuário ativo e com grupo ativo.
create or replace function public.minhas_permissoes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'grupo', jsonb_build_object('id', g.id, 'nome', g.nome, 'sistema', g.sistema),
    'permissoes', coalesce((
      select jsonb_agg(jsonb_build_object('tela', p.tela, 'acao', p.acao) order by p.tela, p.acao)
      from public.acesso_grupo_permissao p
      where p.grupo_id = g.id
    ), '[]'::jsonb),
    'especiais', coalesce((
      select jsonb_agg(e.chave order by e.chave)
      from public.acesso_usuario_especial e
      where e.usuario_id = u.id
    ), '[]'::jsonb)
  )
  from public.perfis u
  join public.acesso_grupo g on g.id = u.grupo_id and g.ativo
  where u.id = (select auth.uid())
    and u.status = 'ativo';
$$;

create or replace function public.tem_permissao_especial(p_chave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis u
    join public.acesso_grupo g on g.id = u.grupo_id and g.ativo
    where u.id = (select auth.uid())
      and u.status = 'ativo'
      and (
        g.sistema
        or exists (select 1 from public.acesso_usuario_especial e where e.usuario_id = u.id and e.chave = p_chave)
      )
  );
$$;

-- "Quem não é do Administrador nunca concede mais do que ele próprio tem." O Administrador
-- concede qualquer grupo; os demais, só grupo que não é de sistema, cujas permissões estão TODAS
-- nas do próprio grupo e cujo nível no banco está contido no dele. Usada pela RPC
-- `definir_acesso_do_usuario` e pela Edge `acessos` (com o JWT de quem chama).
create or replace function public.posso_conceder_grupo(p_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_grupo is null then false
    when (select private.sou_administrador()) then exists (select 1 from public.acesso_grupo g where g.id = p_grupo)
    else
      exists (
        select 1
        from public.acesso_grupo alvo
        join public.perfis u on u.id = (select auth.uid()) and u.status = 'ativo'
        join public.acesso_grupo meu on meu.id = u.grupo_id and meu.ativo
        where alvo.id = p_grupo and not alvo.sistema
          and private.nivel_contido(alvo.papel_legado, meu.papel_legado)
      )
      and not exists (
        select 1
        from public.acesso_grupo_permissao alvo
        where alvo.grupo_id = p_grupo
          and not exists (
            select 1
            from public.perfis u
            join public.acesso_grupo gc on gc.id = u.grupo_id and gc.ativo
            join public.acesso_grupo_permissao minha on minha.grupo_id = gc.id
            where u.id = (select auth.uid()) and u.status = 'ativo'
              and minha.tela = alvo.tela and minha.acao = alvo.acao
          )
      )
  end;
$$;

-- Conta do Auth pelo e-mail (só service role): a Edge `acessos` procura a conta existente no
-- Auth, que é quem diz de quem é o e-mail.
create or replace function public.usuario_auth_por_email(p_email text)
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
  limit 1;
$$;

-- E-mail (login) e último acesso de cada usuário, lidos do Auth — `perfis` não guarda e-mail, e
-- é melhor assim: o Auth é a única fonte, e ninguém troca o próprio e-mail na tabela do app para
-- "herdar" a linha de outra pessoa. Só quem vê usuários recebe linhas. (No padrão, este papel é
-- de `entradas_dos_usuarios()`; sem Microsoft, o que a tela precisa é e-mail e último acesso.)
create or replace function public.contas_dos_usuarios()
returns table (id uuid, email text, ultimo_acesso timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, a.email::text, a.last_sign_in_at
  from public.perfis u
  join auth.users a on a.id = u.id
  where (select public.tem_permissao('acessos.usuarios', 'ver'));
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Gatilhos de `perfis`
-- ---------------------------------------------------------------------------------------------
-- Os gatilhos BEFORE do mesmo evento rodam em ordem alfabética do nome:
--   perfis_a_sincronizar_status → perfis_administrador_presente → perfis_proteger_campos →
--   perfis_sincronizar_papel (antigo: papel pela área) → perfis_z_grupo_padrao →
--   perfis_zz_espelhar_grupo (área e papel pelo grupo; é o último e o que vale).

-- 5a. `status` ↔ `ativo`. O status manda; quem ainda grava só `ativo` (caminho antigo) arrasta o
--     status junto.
create or replace function private.sincronizar_status_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := coalesce(new.status, case when new.ativo then 'ativo' else 'pendente' end);
    new.ativo := new.status = 'ativo';
  elsif new.status is distinct from old.status then
    new.ativo := new.status = 'ativo';
  elsif new.ativo is distinct from old.ativo then
    new.status := case when new.ativo then 'ativo' else 'inativo' end;
  end if;
  return new;
end;
$$;

drop trigger if exists perfis_a_sincronizar_status on public.perfis;
create trigger perfis_a_sincronizar_status
  before insert or update on public.perfis
  for each row execute function private.sincronizar_status_do_perfil();

-- 5b. A sessão nunca muda grupo, status, papel ou área por conta própria (hoje nem tem policy de
--     escrita em `perfis`; isto é a segunda tranca): só as RPCs (sinal interno) e o backend.
create or replace function private.proteger_campos_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null and (select auth.role()) = 'service_role' then
    return new;
  end if;
  if coalesce(current_setting('polobh.acesso_interno', true), '') = '1' then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.ativo is distinct from old.ativo
     or new.grupo_id is distinct from old.grupo_id
     or new.papel is distinct from old.papel
     or new.area_id is distinct from old.area_id then
    raise exception 'Grupo, status e nível do usuário só mudam pela tela de Acessos.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists perfis_proteger_campos on public.perfis;
create trigger perfis_proteger_campos
  before update on public.perfis
  for each row execute function private.proteger_campos_usuario();

-- 5c. Ativo sem grupo recebe o grupo padrão (rede de segurança para caminho antigo).
create or replace function private.atribuir_grupo_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.grupo_id is null and new.status = 'ativo' then
    select g.id into new.grupo_id from public.acesso_grupo g where g.padrao and g.ativo;
  end if;
  return new;
end;
$$;

drop trigger if exists perfis_z_grupo_padrao on public.perfis;
create trigger perfis_z_grupo_padrao
  before insert or update on public.perfis
  for each row execute function private.atribuir_grupo_padrao();

-- 5d. Área e papel acompanham o grupo. Grupo de sistema: sem área e papel 'Admin' (como o
--     Administrador de hoje); os demais: área = o espelho do grupo (mesmo id) e papel = o nível.
create or replace function private.espelhar_grupo_no_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo public.acesso_grupo;
begin
  if new.grupo_id is null then
    return new;
  end if;
  select * into v_grupo from public.acesso_grupo g where g.id = new.grupo_id;
  if not found then
    return new;
  end if;
  if v_grupo.sistema then
    new.area_id := null;
    new.papel := 'Admin';
  else
    new.area_id := v_grupo.id;
    new.papel := v_grupo.papel_legado;
  end if;
  return new;
end;
$$;

drop trigger if exists perfis_zz_espelhar_grupo on public.perfis;
create trigger perfis_zz_espelhar_grupo
  before insert or update on public.perfis
  for each row execute function private.espelhar_grupo_no_perfil();

-- 5e. O Administrador de sistema nunca fica sem usuário ativo. Substitui a trava antiga
--     `perfis_impedir_lockout` ("última conta Admin/Direção"): quem reverte agora é quem está no
--     grupo de sistema (ou tem Acessos · Usuários · editar), e "ninguém altera o próprio acesso"
--     é conferido nas RPCs e na Edge.
create or replace function private.garantir_administrador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sistema uuid;
begin
  select g.id into v_sistema from public.acesso_grupo g where g.sistema;
  if v_sistema is null or old.grupo_id is distinct from v_sistema or old.status <> 'ativo' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.status = 'ativo' and new.grupo_id = v_sistema then
    return new;
  end if;
  perform 1 from public.acesso_grupo g where g.id = v_sistema for update;
  if not exists (
    select 1 from public.perfis u
    where u.grupo_id = v_sistema and u.status = 'ativo' and u.id <> old.id
  ) then
    raise exception 'O grupo Administrador de sistema precisa ter ao menos um usuário ativo.'
      using errcode = '23514';
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists perfis_administrador_presente on public.perfis;
create trigger perfis_administrador_presente
  before update or delete on public.perfis
  for each row execute function private.garantir_administrador();

drop trigger if exists perfis_impedir_lockout on public.perfis;

-- 5f. Conta nova no Auth nasce PENDENTE, sem grupo e sem acesso. Antes: 'Producao' ativo, com o
--     papel lido do metadado que o próprio cadastro informa. Quem dá grupo e ativa é a Edge
--     `acessos` (cadastro pela tela) ou a RPC (liberar acesso).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into perfis (id, nome, papel, status, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    -- Só para cumprir o NOT NULL: pendente não acessa nada (`papel_atual()` exige ativo), e o
    -- papel de verdade vem do grupo quando a conta for liberada.
    'Producao',
    'pendente',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Gatilhos de grupo: proteção e espelho em `areas`
-- ---------------------------------------------------------------------------------------------
create or replace function private.proteger_grupo_acesso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ativos integer;
begin
  if tg_op = 'DELETE' then
    if old.sistema then
      raise exception 'O grupo Administrador de sistema não pode ser excluído.' using errcode = '42501';
    end if;
    if old.padrao then
      raise exception 'O grupo padrão não pode ser excluído.' using errcode = '42501';
    end if;
    return old;
  end if;

  if new.sistema is distinct from old.sistema then
    raise exception 'A marca de grupo de sistema não pode ser alterada.' using errcode = '42501';
  end if;
  if new.padrao is distinct from old.padrao
     and coalesce(current_setting('polobh.acesso_interno', true), '') <> '1' then
    raise exception 'A marca de grupo padrão não pode ser alterada.' using errcode = '42501';
  end if;
  if old.padrao and old.ativo and not new.ativo then
    raise exception 'O grupo padrão não pode ser inativado: ele recebe quem fica ativo sem grupo.' using errcode = '23514';
  end if;
  if old.sistema and (new.nome is distinct from old.nome or new.ativo is distinct from old.ativo) then
    raise exception 'O grupo Administrador de sistema não se renomeia nem se inativa.' using errcode = '42501';
  end if;
  if old.ativo and not new.ativo then
    select count(*) into v_ativos from public.perfis u where u.grupo_id = new.id and u.status = 'ativo';
    if v_ativos > 0 then
      raise exception 'O grupo tem % usuário(s) ativo(s). Mude o grupo deles antes de inativar.', v_ativos
        using errcode = '23514';
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists acesso_grupo_proteger on public.acesso_grupo;
create trigger acesso_grupo_proteger
  before update or delete on public.acesso_grupo
  for each row execute function private.proteger_grupo_acesso();

create or replace function private.proteger_permissao_do_grupo_de_sistema()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := case tg_op when 'INSERT' then new.grupo_id else old.grupo_id end;
begin
  if coalesce(current_setting('polobh.acesso_interno', true), '') <> '1'
     and exists (select 1 from public.acesso_grupo g where g.id = v_id and g.sistema) then
    raise exception 'O grupo Administrador de sistema não se altera.' using errcode = '42501';
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists acesso_grupo_permissao_proteger on public.acesso_grupo_permissao;
create trigger acesso_grupo_permissao_proteger
  before insert or update or delete on public.acesso_grupo_permissao
  for each row execute function private.proteger_permissao_do_grupo_de_sistema();

-- O espelho: a linha de `areas` com o id do grupo recebe nome, nível, situação e os recursos
-- traduzidos da matriz. O grupo de sistema não tem área (o Administrador de hoje também não).
-- Mudar o nível propaga para `perfis.papel` pelo gatilho antigo `areas_propagar_papel_base`.
create or replace function private.espelhar_grupo_na_area(p_grupo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo    public.acesso_grupo;
  v_recursos text[];
  v_sinal    text;
begin
  select * into v_grupo from public.acesso_grupo g where g.id = p_grupo;
  if not found or v_grupo.sistema then
    return;
  end if;
  select coalesce(array_agg(m.recurso order by m.recurso), '{}')
    into v_recursos
    from private.acesso_recurso_legado m
    join public.acesso_grupo_permissao p on p.tela = m.tela and p.acao = m.acao
   where p.grupo_id = p_grupo;
  -- O espelho escreve em `perfis` (papel, pelo gatilho antigo da área): passa pelo sinal interno
  -- e devolve o sinal como estava, para não deixar a transação inteira liberada.
  v_sinal := coalesce(current_setting('polobh.acesso_interno', true), '');
  perform set_config('polobh.acesso_interno', '1', true);
  insert into public.areas (id, nome, papel_base, recursos, ativa)
  values (v_grupo.id, v_grupo.nome, v_grupo.papel_legado, v_recursos, v_grupo.ativo)
  on conflict (id) do update
    set nome = excluded.nome, papel_base = excluded.papel_base,
        recursos = excluded.recursos, ativa = excluded.ativa;
  perform set_config('polobh.acesso_interno', v_sinal, true);
end;
$$;

create or replace function private.espelhar_grupo_gatilho()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'acesso_grupo' then
    perform private.espelhar_grupo_na_area(new.id);
    return new;
  end if;
  perform private.espelhar_grupo_na_area(case tg_op when 'DELETE' then old.grupo_id else new.grupo_id end);
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists acesso_grupo_espelhar_area on public.acesso_grupo;
create trigger acesso_grupo_espelhar_area
  after insert or update on public.acesso_grupo
  for each row execute function private.espelhar_grupo_gatilho();

drop trigger if exists acesso_grupo_permissao_espelhar_area on public.acesso_grupo_permissao;
create trigger acesso_grupo_permissao_espelhar_area
  after insert or update or delete on public.acesso_grupo_permissao
  for each row execute function private.espelhar_grupo_gatilho();

-- ---------------------------------------------------------------------------------------------
-- 7. Portões antigos lendo o grupo (mesma assinatura, volatilidade e grants)
-- ---------------------------------------------------------------------------------------------
-- Quem tem grupo responde pelo grupo (sistema = tudo); sem grupo (pendente antigo, inativo sem
-- área), vale a regra de antes — e `p.ativo` continua exigido, então pendente e inativo não
-- passam em nenhum dos dois caminhos.
create or replace function public.tem_recurso(chave text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select case
             when p.grupo_id is not null then
               coalesce(g.ativo, false) and (
                 coalesce(g.sistema, false)
                 or exists (
                   select 1
                   from private.acesso_recurso_legado m
                   join public.acesso_grupo_permissao gp on gp.tela = m.tela and gp.acao = m.acao
                   where m.recurso = chave and gp.grupo_id = p.grupo_id
                 )
               )
             when p.papel = 'Admin' then true
             when coalesce(cardinality(a.recursos), 0) > 0 then chave = any(a.recursos)
             else p.papel = 'Direcao' and chave in ('checklists.excluir', 'checklists.padrao')
           end
      from perfis p
      left join areas a on a.id = p.area_id
      left join public.acesso_grupo g on g.id = p.grupo_id
     where p.id = auth.uid() and p.ativo
  ), false)
$$;

create or replace function public.recurso_da_area(p_chave text, p_niveis_sem_area text[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select case
             when p.grupo_id is not null then
               coalesce(g.ativo, false) and (
                 coalesce(g.sistema, false)
                 or exists (
                   select 1
                   from private.acesso_recurso_legado m
                   join public.acesso_grupo_permissao gp on gp.tela = m.tela and gp.acao = m.acao
                   where m.recurso = p_chave and gp.grupo_id = p.grupo_id
                 )
               )
             when p.papel = 'Admin' then true
             when coalesce(cardinality(a.recursos), 0) > 0 then p_chave = any(a.recursos)
             else p.papel = any(p_niveis_sem_area)
           end
      from perfis p
      left join areas a on a.id = p.area_id
      left join public.acesso_grupo g on g.id = p.grupo_id
     where p.id = auth.uid() and p.ativo
  ), false)
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. RPCs de escrita
-- ---------------------------------------------------------------------------------------------
-- 8a. Salvar grupo. p = { id?, nome, descricao?, ativo?, papel?, permissoes?: [{tela, acao}] }.
--     `papel` é o nível no banco (obrigatório no grupo novo). `permissoes` ausente numa edição
--     mantém as atuais.
create or replace function public.salvar_grupo_acesso(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_id         uuid;
  v_nome       text := btrim(coalesce(p ->> 'nome', ''));
  v_desc       text := btrim(coalesce(p ->> 'descricao', ''));
  v_papel      text := nullif(btrim(coalesce(p ->> 'papel', '')), '');
  v_grupo      public.acesso_grupo;
  v_ativo      boolean;
  v_item       jsonb;
  v_ativos     integer;
  v_excedentes text;
  v_meu_nivel  text;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Dados do grupo inválidos.' using errcode = '22023';
  end if;

  if coalesce(p ->> 'id', '') <> '' then
    if (p ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Identificador de grupo inválido.' using errcode = '22023';
    end if;
    v_id := (p ->> 'id')::uuid;
  end if;

  if length(v_nome) < 2 or length(v_nome) > 80 then
    raise exception 'Informe o nome do grupo (de 2 a 80 caracteres).' using errcode = '22023';
  end if;
  if length(v_desc) > 500 then
    raise exception 'A descrição do grupo passa de 500 caracteres.' using errcode = '22023';
  end if;
  if p ? 'ativo' and jsonb_typeof(p -> 'ativo') <> 'boolean' then
    raise exception 'O campo "ativo" deve ser verdadeiro ou falso.' using errcode = '22023';
  end if;
  if v_papel is not null and v_papel not in ('Direcao', 'Producao', 'Administrativo') then
    raise exception 'Nível no banco inválido.' using errcode = '22023';
  end if;

  if p ? 'permissoes' then
    if jsonb_typeof(p -> 'permissoes') <> 'array' then
      raise exception 'As permissões devem ser uma lista de tela e ação.' using errcode = '22023';
    end if;
    if jsonb_array_length(p -> 'permissoes') > 1000 then
      raise exception 'Permissões demais para um grupo.' using errcode = '22023';
    end if;
    for v_item in select e from jsonb_array_elements(p -> 'permissoes') as t(e) loop
      if jsonb_typeof(v_item) <> 'object'
         or jsonb_typeof(v_item -> 'tela') <> 'string' or (v_item ->> 'tela') !~ '^[a-z0-9_.-]+$'
         or jsonb_typeof(v_item -> 'acao') <> 'string' or (v_item ->> 'acao') !~ '^[a-z_]+$' then
        raise exception 'Permissão inválida: cada item precisa de tela e ação.' using errcode = '22023';
      end if;
    end loop;
  end if;

  -- Quem não é do Administrador só grava permissões que ele próprio tem, e só um nível contido
  -- no dele (senão montaria um grupo maior que o dele e poria alguém nele).
  if not private.sou_administrador() then
    if p ? 'permissoes' then
      select string_agg(distinct (t.e ->> 'tela') || ' · ' || (t.e ->> 'acao'), ', ')
        into v_excedentes
        from jsonb_array_elements(p -> 'permissoes') as t(e)
       where not exists (
         select 1
         from public.perfis u
         join public.acesso_grupo gc on gc.id = u.grupo_id and gc.ativo
         join public.acesso_grupo_permissao minha on minha.grupo_id = gc.id
         where u.id = v_uid and u.status = 'ativo'
           and minha.tela = t.e ->> 'tela' and minha.acao = t.e ->> 'acao'
       );
      if v_excedentes is not null then
        raise exception 'Você só pode conceder permissões que você mesmo tem. Fora do seu acesso: %', v_excedentes
          using errcode = '42501';
      end if;
    end if;
    if v_papel is not null then
      select g.papel_legado into v_meu_nivel
        from public.perfis u join public.acesso_grupo g on g.id = u.grupo_id
       where u.id = v_uid and u.status = 'ativo';
      if not private.nivel_contido(v_papel, v_meu_nivel) then
        raise exception 'Você só pode dar a um grupo um nível no banco contido no seu.' using errcode = '42501';
      end if;
    end if;
  end if;

  perform set_config('polobh.acesso_interno', '1', true);

  if v_id is null then
    if not public.tem_permissao('acessos.grupos', 'criar') then
      raise exception 'Você não tem permissão para criar grupos de permissão.' using errcode = '42501';
    end if;
    if v_papel is null then
      raise exception 'Escolha o nível no banco do grupo.' using errcode = '22023';
    end if;
    v_ativo := coalesce((p ->> 'ativo')::boolean, true);
    begin
      insert into public.acesso_grupo (nome, descricao, ativo, papel_legado)
      values (v_nome, v_desc, v_ativo, v_papel)
      returning id into v_id;
    exception when unique_violation then
      raise exception 'Já existe um grupo (ou área antiga) com este nome.' using errcode = '22023';
    end;
  else
    if not public.tem_permissao('acessos.grupos', 'editar') then
      raise exception 'Você não tem permissão para editar grupos de permissão.' using errcode = '42501';
    end if;
    select * into v_grupo from public.acesso_grupo g where g.id = v_id for update;
    if not found then
      raise exception 'Grupo não encontrado.' using errcode = '22023';
    end if;
    if v_grupo.sistema then
      raise exception 'O grupo Administrador de sistema não pode ser alterado.' using errcode = '42501';
    end if;
    if exists (select 1 from public.perfis u where u.id = v_uid and u.grupo_id = v_id) then
      raise exception 'Você não pode alterar o grupo ao qual pertence.' using errcode = '42501';
    end if;

    v_ativo := coalesce((p ->> 'ativo')::boolean, v_grupo.ativo);
    if v_grupo.ativo and not v_ativo then
      if not public.tem_permissao('acessos.grupos', 'inativar') then
        raise exception 'Você não tem permissão para inativar grupos de permissão.' using errcode = '42501';
      end if;
      select count(*) into v_ativos from public.perfis u where u.grupo_id = v_id and u.status = 'ativo';
      if v_ativos > 0 then
        raise exception 'O grupo tem % usuário(s) ativo(s). Mude o grupo deles antes de inativar.', v_ativos
          using errcode = '22023';
      end if;
    end if;

    begin
      update public.acesso_grupo
         set nome = v_nome, descricao = v_desc, ativo = v_ativo,
             papel_legado = coalesce(v_papel, papel_legado)
       where id = v_id;
    exception when unique_violation then
      raise exception 'Já existe um grupo (ou área antiga) com este nome.' using errcode = '22023';
    end;
  end if;

  if p ? 'permissoes' then
    delete from public.acesso_grupo_permissao where grupo_id = v_id;
    insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
    select distinct v_id, e ->> 'tela', e ->> 'acao'
    from jsonb_array_elements(p -> 'permissoes') as t(e);
  end if;

  perform set_config('polobh.acesso_interno', '', true);
  return v_id;
end;
$$;

-- 8b. Definir o acesso de um usuário. null = não muda. Grupo, nome, setor, cargo e telefone
--     pedem `acessos.usuarios`·editar; status 'inativo' pede ·inativar; 'ativo' (reativar ou
--     liberar pendente) pede ·editar e grupo ativo. Ninguém mexe em si mesmo e só o
--     Administrador põe, tira ou altera alguém do Administrador. '' = apagar setor/cargo/telefone.
create or replace function public.definir_acesso_do_usuario(
  p_usuario  uuid,
  p_grupo    uuid,
  p_status   text default null,
  p_nome     text default null,
  p_cargo    text default null,
  p_setor    text default null,
  p_telefone text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid           uuid := (select auth.uid());
  v_alvo          public.perfis;
  v_grupo         public.acesso_grupo;
  v_grupo_final   uuid;
  v_sou_admin     boolean;
  v_muda_status   boolean;
  v_muda_dados    boolean;
  v_mexe_no_admin boolean;
  v_nome          text;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if p_usuario is null then
    raise exception 'Informe o usuário.' using errcode = '22023';
  end if;
  if p_usuario = v_uid then
    raise exception 'Você não pode alterar o seu próprio acesso.' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('ativo', 'inativo') then
    raise exception 'Status inválido: use "ativo" ou "inativo".' using errcode = '22023';
  end if;

  select * into v_alvo from public.perfis u where u.id = p_usuario for update;
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = '22023';
  end if;

  v_muda_status := p_status is not null and p_status is distinct from v_alvo.status;
  v_muda_dados  := (p_grupo is not null and p_grupo is distinct from v_alvo.grupo_id)
                   or p_nome is not null or p_cargo is not null or p_setor is not null or p_telefone is not null;

  if v_muda_dados and not public.tem_permissao('acessos.usuarios', 'editar') then
    raise exception 'Você não tem permissão para editar usuários.' using errcode = '42501';
  end if;
  -- Inativo não se edita: primeiro ativa (a mesma chamada pode ativar E trocar o grupo).
  if v_alvo.status = 'inativo' and v_muda_dados and not (v_muda_status and p_status = 'ativo') then
    raise exception 'Este usuário está inativo. Ative-o antes de editar.' using errcode = '22023';
  end if;
  -- E inativar não edita: o inativo não "nasce" alterado.
  if v_muda_status and p_status = 'inativo' and v_muda_dados then
    raise exception 'Inativar não altera os dados do usuário: salve a edição antes de inativar.' using errcode = '22023';
  end if;
  if v_muda_status and p_status = 'inativo' and not public.tem_permissao('acessos.usuarios', 'inativar') then
    raise exception 'Você não tem permissão para inativar usuários.' using errcode = '42501';
  end if;
  if v_muda_status and p_status = 'ativo' and not public.tem_permissao('acessos.usuarios', 'editar') then
    raise exception 'Você não tem permissão para ativar usuários.' using errcode = '42501';
  end if;

  v_grupo_final := coalesce(p_grupo, v_alvo.grupo_id);
  if v_grupo_final is not null then
    select * into v_grupo from public.acesso_grupo g where g.id = v_grupo_final;
    if not found then
      raise exception 'Grupo não encontrado.' using errcode = '22023';
    end if;
  end if;
  if p_grupo is not null and p_grupo is distinct from v_alvo.grupo_id and not v_grupo.ativo then
    raise exception 'O grupo escolhido está inativo.' using errcode = '22023';
  end if;
  if ((p_grupo is not null and p_grupo is distinct from v_alvo.grupo_id)
      or (v_muda_status and p_status = 'ativo'))
     and v_grupo_final is not null
     and not public.posso_conceder_grupo(v_grupo_final) then
    raise exception 'Você só pode atribuir grupos cujas permissões você mesmo tem.' using errcode = '42501';
  end if;
  if v_muda_status and p_status = 'ativo' then
    if v_grupo_final is null then
      raise exception 'Escolha o grupo de permissão para liberar o acesso.' using errcode = '22023';
    end if;
    -- Reativar não devolve o que quem reativa não concederia.
    if exists (
      select 1 from public.acesso_usuario_especial e
      where e.usuario_id = v_alvo.id and not public.tem_permissao_especial(e.chave)
    ) then
      raise exception 'Este usuário tem permissões específicas que você não tem. Só quem as tem (ou um Administrador de sistema) pode ativá-lo.'
        using errcode = '42501';
    end if;
    if not v_grupo.ativo then
      raise exception 'O grupo do usuário está inativo. Escolha outro grupo.' using errcode = '22023';
    end if;
  end if;

  v_sou_admin := private.sou_administrador();
  v_mexe_no_admin := (v_grupo_final is not null and v_grupo.sistema and (p_grupo is not null or v_muda_status))
                     or (v_alvo.grupo_id is not null
                         and exists (select 1 from public.acesso_grupo g where g.id = v_alvo.grupo_id and g.sistema)
                         and (v_muda_dados or v_muda_status));
  if v_mexe_no_admin and not v_sou_admin then
    raise exception 'Somente um usuário do grupo Administrador de sistema pode incluir, alterar ou inativar membros desse grupo.'
      using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_setor, ''))) > 120 or length(btrim(coalesce(p_cargo, ''))) > 200
     or length(btrim(coalesce(p_telefone, ''))) > 40 then
    raise exception 'Setor (até 120), cargo (até 200) ou telefone (até 40 caracteres) longo demais.' using errcode = '22023';
  end if;
  v_nome := btrim(coalesce(p_nome, ''));
  if p_nome is not null and (v_nome = '' or length(v_nome) > 200) then
    raise exception 'Informe o nome (até 200 caracteres).' using errcode = '22023';
  end if;

  perform set_config('polobh.acesso_interno', '1', true);

  update public.perfis u
     set grupo_id = coalesce(p_grupo, u.grupo_id),
         status   = coalesce(p_status, u.status),
         nome     = case when p_nome is null then u.nome else v_nome end,
         cargo    = case when p_cargo is null then u.cargo else nullif(btrim(p_cargo), '') end,
         setor    = case when p_setor is null then u.setor else nullif(btrim(p_setor), '') end,
         telefone = case when p_telefone is null then u.telefone else btrim(p_telefone) end
   where u.id = p_usuario;

  perform set_config('polobh.acesso_interno', '', true);
end;
$$;

-- 8c. Permissões específicas: troca o conjunto inteiro (`p_chaves` = como deve ficar).
create or replace function public.definir_permissoes_especiais(p_usuario uuid, p_chaves text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_alvo   public.perfis;
  v_novas  text[];
  v_chave  text;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if p_usuario is null then
    raise exception 'Informe o usuário.' using errcode = '22023';
  end if;
  if p_usuario = v_uid then
    raise exception 'Você não pode alterar o seu próprio acesso.' using errcode = '42501';
  end if;
  if not public.tem_permissao('acessos.usuarios', 'editar') then
    raise exception 'Você não tem permissão para editar usuários.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_chaves), 0) > 200 then
    raise exception 'Permissões específicas demais.' using errcode = '22023';
  end if;

  select * into v_alvo from public.perfis u where u.id = p_usuario for update;
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = '22023';
  end if;
  if exists (select 1 from public.acesso_grupo g where g.id = v_alvo.grupo_id and g.sistema)
     and not private.sou_administrador() then
    raise exception 'Somente um usuário do grupo Administrador de sistema pode alterar membros desse grupo.'
      using errcode = '42501';
  end if;
  if v_alvo.status = 'inativo' then
    raise exception 'Este usuário está inativo. Ative-o antes de editar.' using errcode = '22023';
  end if;
  if v_alvo.status = 'pendente' then
    raise exception 'Libere o acesso do usuário antes de marcar permissões específicas.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct btrim(c)), '{}') into v_novas
  from unnest(coalesce(p_chaves, '{}')) as c
  where btrim(c) <> '';
  foreach v_chave in array v_novas loop
    if v_chave !~ '^[a-z][a-z0-9_.]{1,60}$' then
      raise exception 'Permissão específica inválida: %.', v_chave using errcode = '22023';
    end if;
  end loop;

  for v_chave in
    select n from unnest(v_novas) as n
    except
    select e.chave from public.acesso_usuario_especial e where e.usuario_id = p_usuario
  loop
    if not public.tem_permissao_especial(v_chave) then
      raise exception 'Você não tem a permissão específica "%", então não pode concedê-la.', v_chave
        using errcode = '42501';
    end if;
  end loop;

  delete from public.acesso_usuario_especial e
   where e.usuario_id = p_usuario and not (e.chave = any (v_novas));
  insert into public.acesso_usuario_especial (usuario_id, chave, concedida_por)
  select p_usuario, n, v_uid from unnest(v_novas) as n
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 9. Permissões de execução, RLS e grants
-- ---------------------------------------------------------------------------------------------
revoke all on function public.tem_permissao(text, text) from public, anon;
revoke all on function public.minhas_permissoes() from public, anon;
revoke all on function public.salvar_grupo_acesso(jsonb) from public, anon;
revoke all on function public.definir_acesso_do_usuario(uuid, uuid, text, text, text, text, text) from public, anon;
revoke all on function public.tem_permissao_especial(text) from public, anon;
revoke all on function public.definir_permissoes_especiais(uuid, text[]) from public, anon;
revoke all on function public.posso_conceder_grupo(uuid) from public, anon;
revoke all on function public.contas_dos_usuarios() from public, anon;
revoke all on function public.usuario_auth_por_email(text) from public, anon, authenticated;

grant execute on function public.tem_permissao(text, text) to authenticated, service_role;
grant execute on function public.minhas_permissoes() to authenticated, service_role;
grant execute on function public.salvar_grupo_acesso(jsonb) to authenticated, service_role;
grant execute on function public.definir_acesso_do_usuario(uuid, uuid, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.tem_permissao_especial(text) to authenticated, service_role;
grant execute on function public.definir_permissoes_especiais(uuid, text[]) to authenticated, service_role;
grant execute on function public.posso_conceder_grupo(uuid) to authenticated, service_role;
grant execute on function public.contas_dos_usuarios() to authenticated, service_role;
grant execute on function public.usuario_auth_por_email(text) to service_role;

revoke all on function private.esta_ativo() from public;
revoke all on function private.sou_administrador() from public;
grant execute on function private.esta_ativo() to authenticated, service_role;
grant execute on function private.sou_administrador() to authenticated, service_role;
-- As internas não precisam de EXECUTE de ninguém (chamadas por funções security definer).
revoke all on function private.nivel_contido(text, text) from public;
revoke all on function private.espelhar_grupo_na_area(uuid) from public;
revoke all on function private.espelhar_grupo_gatilho() from public;
revoke all on function private.sincronizar_status_do_perfil() from public;
revoke all on function private.proteger_campos_usuario() from public;
revoke all on function private.atribuir_grupo_padrao() from public;
revoke all on function private.espelhar_grupo_no_perfil() from public;
revoke all on function private.garantir_administrador() from public;
revoke all on function private.proteger_grupo_acesso() from public;
revoke all on function private.proteger_permissao_do_grupo_de_sistema() from public;

alter table public.acesso_grupo enable row level security;
alter table public.acesso_grupo_permissao enable row level security;
alter table public.acesso_usuario_especial enable row level security;

-- Grupos e permissões: leitura para usuário ativo; escrita só pelas RPCs (sem policy de escrita).
drop policy if exists acesso_grupo_leitura on public.acesso_grupo;
create policy acesso_grupo_leitura on public.acesso_grupo
  for select to authenticated
  using ((select private.esta_ativo()));

drop policy if exists acesso_grupo_permissao_leitura on public.acesso_grupo_permissao;
create policy acesso_grupo_permissao_leitura on public.acesso_grupo_permissao
  for select to authenticated
  using ((select private.esta_ativo()));

revoke all on public.acesso_grupo, public.acesso_grupo_permissao from anon;
revoke insert, update, delete, truncate on public.acesso_grupo, public.acesso_grupo_permissao from authenticated;
grant select on public.acesso_grupo, public.acesso_grupo_permissao to authenticated;

drop policy if exists acesso_usuario_especial_leitura on public.acesso_usuario_especial;
create policy acesso_usuario_especial_leitura on public.acesso_usuario_especial
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.tem_permissao('acessos.usuarios', 'ver')));
revoke all on public.acesso_usuario_especial from anon;
revoke insert, update, delete, truncate on public.acesso_usuario_especial from authenticated;
grant select on public.acesso_usuario_especial to authenticated;

-- `perfis`: a leitura fica como estava (cada um a própria linha; usuário ativo, todas). Nunca
-- houve policy de escrita para a sessão — quem gravava era a Edge `gerenciar-usuarios` com a
-- service role —, então tirar o grant de escrita não muda nada para ninguém: só fecha a porta
-- que a policy já fechava.
revoke insert, update, delete, truncate on public.perfis from anon, authenticated;

-- `areas` vira espelho: ninguém grava, só os gatilhos do bloco 6. A policy antiga de escrita
-- (Admin/Direção/Administrativo) sai junto, para ninguém achar que ainda vale.
drop policy if exists areas_write on public.areas;
revoke insert, update, delete, truncate on public.areas from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 10. Dados: grupos de partida a partir das áreas, e os usuários atuais
-- ---------------------------------------------------------------------------------------------
-- Fotografia de antes, para a conferência do fim: os recursos de cada área e o papel de cada
-- pessoa. A tradução área → grupo → área espelhada tem de devolver exatamente o mesmo.
create temp table _acessos_areas_antes on commit drop as
  select id, nome, array(select distinct x from unnest(recursos) x order by x) as recursos from public.areas;
create temp table _acessos_perfis_antes on commit drop as
  select id, papel, ativo from public.perfis;

do $$
declare
  v_admin       uuid;
  v_padrao      uuid;
  v_divergencia text;
begin
  perform set_config('polobh.acesso_interno', '1', true);

  -- Sem nenhum Administrador ativo, ninguém abre a tela de Acessos depois da virada: desiste.
  if not exists (select 1 from public.perfis where papel = 'Admin' and ativo) then
    raise exception 'Nenhum usuário ativo com papel Admin: o grupo Administrador de sistema nasceria vazio.';
  end if;
  -- Usuário ativo sem área e sem ser Admin hoje vale pelo padrão do papel, que não tem grupo
  -- equivalente: desiste e pede para alguém pôr a pessoa numa área antes.
  if exists (select 1 from public.perfis where ativo and papel <> 'Admin' and area_id is null) then
    raise exception 'Há usuário ativo sem área (e que não é Admin). Ponha-o numa área antes de aplicar.';
  end if;
  -- Área com usuário ativo e sem nenhum recurso hoje cai no padrão do papel; o grupo dela
  -- nasceria sem permissão nenhuma. Desiste.
  if exists (
    select 1 from public.areas a
    where coalesce(cardinality(a.recursos), 0) = 0
      and exists (select 1 from public.perfis p where p.area_id = a.id and p.ativo)
  ) then
    raise exception 'Há área com usuário ativo e sem nenhum recurso marcado. Marque os recursos dela antes de aplicar.';
  end if;

  -- Administrador de sistema. Sem linhas de permissão: `sistema` libera tudo.
  insert into public.acesso_grupo (nome, descricao, sistema)
  select 'Administrador de sistema', 'Acesso total, inclusive Acessos. Grupo de sistema.', true
  where not exists (select 1 from public.acesso_grupo g where g.sistema)
  returning id into v_admin;
  if v_admin is null then
    select g.id into v_admin from public.acesso_grupo g where g.sistema;
  end if;

  -- Um grupo por área, com o MESMO id (é o que mantém `perfis.area_id` e o espelho de pé).
  insert into public.acesso_grupo (id, nome, descricao, ativo, papel_legado)
  select a.id, a.nome, '', a.ativa, a.papel_base
  from public.areas a
  where a.papel_base in ('Direcao', 'Producao', 'Administrativo')
  on conflict (id) do nothing;

  -- As permissões: cada recurso da área vira a sua tela × ação; e o Ver de toda tela que ganhou
  -- outra ação (regra do Ver — com os dados de 24/11/2026 não acrescenta nada; a conferência do
  -- fim acusaria se acrescentasse).
  insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
  -- (Da FOTOGRAFIA de antes: o espelho já reescreveu `areas.recursos` ao criar cada grupo.)
  select distinct a.id, m.tela, m.acao
  from _acessos_areas_antes a
  cross join lateral unnest(a.recursos) as r(recurso)
  join private.acesso_recurso_legado m on m.recurso = r.recurso
  where exists (select 1 from public.acesso_grupo g where g.id = a.id and not g.sistema)
  on conflict do nothing;

  insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
  select distinct p.grupo_id, p.tela, 'ver'
  from public.acesso_grupo_permissao p
  where p.acao <> 'ver'
  on conflict do nothing;

  -- Quem administrava usuários e áreas (recurso `configuracoes`) ganha as telas de Acessos —
  -- e inativar usuário só se o nível é Direção, como na Edge antiga (`QUEM_ATIVA`). Com os
  -- dados de 24/11/2026 isso vale para as áreas "Direção" e "Financeiro", hoje sem ninguém.
  insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
  select a.id, t.tela, t.acao
  from _acessos_areas_antes a
  cross join (values
    ('acessos.usuarios', 'ver'), ('acessos.usuarios', 'criar'), ('acessos.usuarios', 'editar'),
    ('acessos.grupos', 'ver'), ('acessos.grupos', 'criar'), ('acessos.grupos', 'editar'), ('acessos.grupos', 'inativar')
  ) as t (tela, acao)
  where 'configuracoes' = any (a.recursos)
    and exists (select 1 from public.acesso_grupo g where g.id = a.id)
  on conflict do nothing;

  insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
  select a.id, 'acessos.usuarios', 'inativar'
  from _acessos_areas_antes a
  join public.areas ar on ar.id = a.id
  where 'configuracoes' = any (a.recursos) and ar.papel_base = 'Direcao'
    and exists (select 1 from public.acesso_grupo g where g.id = a.id)
  on conflict do nothing;

  -- Grupo padrão: o da área com mais usuários ativos (com os dados de 24/11/2026, "Produção").
  if not exists (select 1 from public.acesso_grupo g where g.padrao) then
    select g.id into v_padrao
      from public.acesso_grupo g
      left join public.perfis p on p.area_id = g.id and p.ativo
     where not g.sistema and g.ativo
     group by g.id, g.nome
     order by count(p.id) desc, g.nome
     limit 1;
    update public.acesso_grupo set padrao = true where id = v_padrao;
  end if;

  -- Usuários: o Admin vai para o grupo de sistema; os demais, para o grupo da própria área.
  update public.perfis u
     set grupo_id = case when u.papel = 'Admin' then v_admin else u.area_id end
   where u.grupo_id is null
     and (u.papel = 'Admin' or u.area_id is not null);

  perform set_config('polobh.acesso_interno', '', true);

  -- CONFERÊNCIA (desiste se não bater): ninguém perdeu nem ganhou acesso.
  -- (a) Os recursos de cada área, devolvidos pelo espelho, são os mesmos de antes (fora as
  --     telas de Acessos, que são novas e só entram onde havia `configuracoes`).
  select string_agg(b.nome, ', ') into v_divergencia
    from _acessos_areas_antes b
    join public.areas a on a.id = b.id
   where array(select distinct x from unnest(a.recursos) x where x not like 'acessos.%' order by x)
         is distinct from b.recursos;
  if v_divergencia is not null then
    raise exception 'A tradução área → grupo mudaria os recursos de: %. Nada foi aplicado.', v_divergencia;
  end if;
  -- (b) O papel de cada pessoa continua o mesmo, e a situação (ativo/inativo) também.
  select string_agg(p.id::text, ', ') into v_divergencia
    from _acessos_perfis_antes b
    join public.perfis p on p.id = b.id
   where p.papel is distinct from b.papel or p.ativo is distinct from b.ativo;
  if v_divergencia is not null then
    raise exception 'O papel ou a situação mudaria para os perfis: %. Nada foi aplicado.', v_divergencia;
  end if;
  -- (c) Todo ativo tem grupo.
  if exists (select 1 from public.perfis where status = 'ativo' and grupo_id is null) then
    raise exception 'Sobrou usuário ativo sem grupo. Nada foi aplicado.';
  end if;
end;
$$;

-- Grupo é obrigatório para quem está ativo.
alter table public.perfis drop constraint if exists perfis_ativo_tem_grupo;
alter table public.perfis add constraint perfis_ativo_tem_grupo check (status <> 'ativo' or grupo_id is not null);

-- --- ENSAIO (antes de aplicar de verdade; nada fica gravado) ---------------------------------
-- Rode este arquivo inteiro no SQL Editor com o bloco abaixo DESCOMENTADO (no lugar do `commit;`
-- do fim). Ele termina em `raise exception`, a transação cai e nada fica gravado — a mensagem
-- de erro É o resultado do ensaio. Esperado: ativos sem grupo=0, administradores ativos>=1,
-- grupo padrão=1, grupos=10 (9 áreas + sistema), e a contagem papel × grupo igual à de antes
-- (Admin→Administrador de sistema 1; Administrativo→Coordenação Administrativo-Financeira 1;
-- Direcao→Diretoria Produção 1; Producao→Back-office 1, Coordenação Produção 1, Produção 3).
--
-- do $ensaio$
-- declare v_sem_grupo int; v_admins int; v_padrao int; v_grupos int; v_mapa text;
-- begin
--   select count(*) into v_sem_grupo from public.perfis where status = 'ativo' and grupo_id is null;
--   select count(*) into v_admins from public.perfis u join public.acesso_grupo g on g.id = u.grupo_id
--    where g.sistema and u.status = 'ativo';
--   select count(*) into v_padrao from public.acesso_grupo where padrao and ativo;
--   select count(*) into v_grupos from public.acesso_grupo;
--   select string_agg(format('%s→%s: %s', papel, grupo, n), '; ' order by papel, grupo) into v_mapa
--     from (select u.papel, g.nome as grupo, count(*) as n
--             from public.perfis u left join public.acesso_grupo g on g.id = u.grupo_id
--            where u.status = 'ativo' group by 1, 2) t;
--   raise exception 'ENSAIO: ativos sem grupo=%, administradores ativos=%, grupo padrão=%, grupos=% | %',
--     v_sem_grupo, v_admins, v_padrao, v_grupos, v_mapa;
-- end;
-- $ensaio$;
-- rollback;

commit;

-- --- CONFERÊNCIA DEPOIS DE APLICAR (só leitura) -----------------------------------------------
-- 1. Todo usuário ativo tem grupo (esperado: 0 linhas).
--    select id, status from public.perfis where status = 'ativo' and grupo_id is null;
-- 2. Usuários por papel × grupo (tem de bater com a contagem papel × área de antes).
--    select u.papel, g.nome as grupo, u.status, count(*) from public.perfis u
--      left join public.acesso_grupo g on g.id = u.grupo_id group by 1, 2, 3 order by 1, 2, 3;
-- 3. O Administrador tem usuário ativo (esperado: >= 1).
--    select count(*) from public.perfis u join public.acesso_grupo g on g.id = u.grupo_id
--     where g.sistema and u.status = 'ativo';
-- 4. Um grupo padrão, ativo (esperado: 1 linha).
--    select id, nome, ativo from public.acesso_grupo where padrao;
-- 5. Espelho em dia: cada grupo (fora o de sistema) tem a área com o mesmo id, nome e nível.
--    select g.nome, a.nome, g.papel_legado, a.papel_base from public.acesso_grupo g
--      left join public.areas a on a.id = g.id where not g.sistema
--       and (a.id is null or a.nome <> g.nome or a.papel_base <> g.papel_legado);   -- esperado: 0
-- 6. Ensaio como um usuário (termina em rollback):
--    begin;
--      select set_config('request.jwt.claims', json_build_object(
--        'sub', (select u.id from public.perfis u join public.acesso_grupo g on g.id = u.grupo_id
--                where g.sistema and u.status = 'ativo' limit 1),
--        'role', 'authenticated')::text, true);
--      set local role authenticated;
--      select public.tem_permissao('acessos.usuarios', 'criar') as cria_usuario,   -- true p/ admin
--             public.minhas_permissoes() -> 'grupo' as grupo, public.tem_recurso('logs') as logs;
--      reset role;
--    rollback;
