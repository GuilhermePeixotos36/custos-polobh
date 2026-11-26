-- =====================================================================
-- ACESSOS — grupos de permissão, CPF, unicidade, senha provisória      (26/11/2026)
--
-- Padrão "Acessos e Logs" (skill acessos-e-logs), PARTE 1, adaptado ao Pólobh:
--
--   * A tabela de usuários continua sendo `perfis` (id = auth.users.id). Ganha e-mail, status
--     de três estados (pendente / ativo / inativo — `ativo` boolean segue existindo e acompanha),
--     grupo, CPF (só dígitos, único, nunca lido pela sessão: a tela lê `cpf_mascarado`), cargo,
--     setor e a marca de senha provisória.
--   * As ÁREAS viram GRUPOS DE PERMISSÃO (`acesso_grupo`), com as mesmas permissões de hoje
--     (decisão do Guilherme, 26/11): Diretoria Produção, Coordenação Produção, Coordenação
--     Administrativo-Financeira, Back-office e Produção. As quatro áreas sem ninguém não viram
--     grupo. Nenhum grupo é "padrão". A conta GPX Automação (papel Admin) é o Administrador de
--     sistema. Administram Acessos: o Administrador, a Diretoria Produção e a Coordenação
--     Administrativo-Financeira. Veem os logs: o Administrador e a Diretoria Produção.
--   * O PAPEL ANTIGO (`perfis.papel`) não é mais entrada: passa a ser DERIVADO do grupo
--     (`acesso_grupo.papel_base`; o grupo de sistema dá 'Admin'), como já era derivado da área.
--     As 34 policies e as RPCs que leem `papel_atual()` continuam valendo sem mudança.
--   * Os portões por recurso (`tem_recurso`, `recurso_da_area`) mantêm a assinatura e passam a
--     ler a matriz do grupo pelo mapa recurso antigo → (tela, ação) de `private.recurso_legado`.
--     Quem ainda não tem grupo (não deveria existir) cai na regra antiga, pela área.
--   * A tabela `areas` fica, só leitura (sem uso pela tela nova). Mudar a área de alguém NÃO muda
--     mais o grupo (revisão de segurança): o caminho antigo não passa pelas travas de Acessos.
--
-- Reverter: drop dos gatilhos `perfis_*` criados aqui, recriar `perfis_impedir_lockout`, e
-- restaurar `tem_recurso`, `recurso_da_area`, `sincronizar_papel_do_perfil` e `handle_new_user`
-- da migração anterior. Tabelas e colunas novas podem ficar, sem uso.
-- =====================================================================

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- --- Grupos ------------------------------------------------------------------
create table if not exists public.acesso_grupo (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(btrim(nome)) > 0),
  descricao      text not null default '',
  sistema        boolean not null default false,
  ativo          boolean not null default true,
  -- Mantida pelo padrão; no Pólobh nenhum grupo é padrão (decisão de 26/11).
  padrao         boolean not null default false,
  -- O "nível" do papel antigo que quem está no grupo recebe (as policies leem o papel).
  papel_base     text not null default 'Producao'
                 check (papel_base in ('Admin', 'Direcao', 'Producao', 'Administrativo')),
  -- Área de onde o grupo nasceu: o caminho antigo (que muda a área) leva o grupo junto.
  area_origem_id uuid references public.areas (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  -- O nível Admin é só do grupo de sistema (revisão de segurança, 26/11).
  constraint acesso_grupo_admin_so_sistema check (papel_base <> 'Admin' or sistema)
);

create unique index if not exists acesso_grupo_nome_key on public.acesso_grupo (lower(btrim(nome)));
create unique index if not exists acesso_grupo_sistema_key on public.acesso_grupo ((true)) where sistema;
create unique index if not exists acesso_grupo_padrao_key on public.acesso_grupo ((true)) where padrao;
create unique index if not exists acesso_grupo_area_key on public.acesso_grupo (area_origem_id) where area_origem_id is not null;

comment on table public.acesso_grupo is
  'Grupos de permissão. O de sistema libera tudo sem linhas em acesso_grupo_permissao.';

create table if not exists public.acesso_grupo_permissao (
  grupo_id uuid not null references public.acesso_grupo (id) on delete cascade,
  tela     text not null check (tela ~ '^[a-z0-9_.-]+$'),
  acao     text not null check (acao ~ '^[a-z_]+$'),
  primary key (grupo_id, tela, acao)
);

comment on table public.acesso_grupo_permissao is
  'Tela x ação liberadas ao grupo. Quem define o catálogo é o app (src/config/acessos/catalogo.ts).';

-- --- CPF ---------------------------------------------------------------------
create or replace function private.cpf_valido(p_cpf text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_soma  int;
  v_resto int;
  i       int;
begin
  if p_cpf is null or p_cpf !~ '^[0-9]{11}$' or p_cpf = repeat(substr(p_cpf, 1, 1), 11) then
    return false;
  end if;
  v_soma := 0;
  for i in 1..9 loop
    v_soma := v_soma + substr(p_cpf, i, 1)::int * (11 - i);
  end loop;
  v_resto := (v_soma * 10) % 11;
  if v_resto = 10 then v_resto := 0; end if;
  if v_resto <> substr(p_cpf, 10, 1)::int then return false; end if;
  v_soma := 0;
  for i in 1..10 loop
    v_soma := v_soma + substr(p_cpf, i, 1)::int * (12 - i);
  end loop;
  v_resto := (v_soma * 10) % 11;
  if v_resto = 10 then v_resto := 0; end if;
  return v_resto = substr(p_cpf, 11, 1)::int;
end;
$$;

-- --- Perfis: as colunas do padrão --------------------------------------------
alter table public.perfis
  add column if not exists email            text,
  add column if not exists status           text not null default 'pendente'
                                            check (status in ('pendente', 'ativo', 'inativo')),
  add column if not exists grupo_id         uuid references public.acesso_grupo (id) on delete restrict,
  add column if not exists origem           text not null default 'avulso' check (origem in ('colaborador', 'avulso')),
  add column if not exists colaborador_id   uuid,
  add column if not exists cargo            text,
  add column if not exists setor            text,
  add column if not exists cpf              text,
  add column if not exists senha_provisoria boolean not null default false,
  add column if not exists ultimo_acesso    timestamptz;

alter table public.perfis
  add column if not exists cpf_mascarado text generated always as (
    case when cpf is null then null
         else '***.' || substr(cpf, 4, 3) || '.' || substr(cpf, 7, 3) || '-**' end
  ) stored;

alter table public.perfis drop constraint if exists perfis_cpf_valido;
alter table public.perfis add constraint perfis_cpf_valido check (cpf is null or private.cpf_valido(cpf));

-- E-mail vem do Auth (é a âncora da conta); status sai do `ativo` de hoje.
update public.perfis p set email = lower(btrim(a.email)) from auth.users a where a.id = p.id and p.email is null;
update public.perfis p set status = case when p.ativo then 'ativo' else 'inativo' end where p.status = 'pendente';
alter table public.perfis alter column email set not null;

create index if not exists perfis_grupo_id_idx on public.perfis (grupo_id);
create unique index if not exists perfis_colaborador_id_key on public.perfis (colaborador_id) where colaborador_id is not null;

do $$
declare
  v_emails int;
  v_cpfs   int;
begin
  select count(*) into v_emails from (select 1 from public.perfis group by lower(btrim(email)) having count(*) > 1) x;
  select count(*) into v_cpfs from (select 1 from public.perfis where cpf is not null group by cpf having count(*) > 1) x;
  if v_emails > 0 or v_cpfs > 0 then
    raise exception 'Há usuários repetidos: % e-mail(s) e % CPF(s). Resolva antes de criar os índices únicos.', v_emails, v_cpfs;
  end if;
end;
$$;
create unique index if not exists perfis_email_key on public.perfis (lower(btrim(email)));
create unique index if not exists perfis_cpf_key on public.perfis (cpf) where cpf is not null;

comment on column public.perfis.cpf is 'CPF, só dígitos, validado e único. A sessão não lê esta coluna (lê cpf_mascarado). Só as RPCs de acesso e a Edge acessos gravam.';
comment on column public.perfis.senha_provisoria is 'Senha definida pelo administrador: o app pede a troca no próximo acesso. Só a Edge acessos grava.';
comment on column public.perfis.grupo_id is 'Grupo de permissão. Só muda pela RPC definir_acesso_do_usuario ou pela Edge acessos.';
comment on column public.perfis.status is 'pendente (conta sem acesso liberado) | ativo | inativo. A coluna ativo acompanha (ativo = status ''ativo'').';
comment on column public.perfis.papel is 'DERIVADO do grupo (acesso_grupo.papel_base; grupo de sistema = Admin). Saída, não entrada: as policies antigas o leem.';

-- --- Permissões específicas por usuário (padrão; o Pólobh começa sem nenhuma) -----------
create table if not exists public.acesso_usuario_especial (
  usuario_id    uuid not null references public.perfis (id) on delete cascade,
  chave         text not null check (chave ~ '^[a-z][a-z0-9_.]{1,60}$'),
  concedida_por uuid references auth.users (id) on delete set null,
  concedida_em  timestamptz not null default now(),
  primary key (usuario_id, chave)
);

-- --- Consultas ---------------------------------------------------------------
create or replace function private.esta_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfis u where u.id = (select auth.uid()) and u.status = 'ativo');
$$;

create or replace function private.sou_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis u join public.acesso_grupo g on g.id = u.grupo_id
    where u.id = (select auth.uid()) and u.status = 'ativo' and g.sistema
  );
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
      from public.acesso_grupo_permissao p where p.grupo_id = g.id
    ), '[]'::jsonb),
    'especiais', coalesce((
      select jsonb_agg(e.chave order by e.chave)
      from public.acesso_usuario_especial e where e.usuario_id = u.id
    ), '[]'::jsonb)
  )
  from public.perfis u
  join public.acesso_grupo g on g.id = u.grupo_id and g.ativo
  where u.id = (select auth.uid()) and u.status = 'ativo';
$$;

-- --- O mapa recurso antigo → (tela, ação) -------------------------------------------
-- Uma linha por recurso da matriz antiga (src/store/auth.ts, `Recurso`). É o que mantém os
-- portões antigos de pé lendo o grupo. O mesmo mapa está em src/config/acessos/catalogo.ts
-- (`RECURSO_LEGADO`). Recurso novo NÃO entra aqui: tela nova usa `tem_permissao` direto.
create or replace function private.recurso_legado(p_chave text)
returns table (tela text, acao text)
language sql
immutable
set search_path = ''
as $$
  select m.tela, m.acao
  from (values
    ('projetos',               'projetos',     'ver'),
    ('projetos.editar',        'projetos',     'editar'),
    ('ecs',                    'ecs',          'ver'),
    ('ecs.editar',             'ecs',          'editar'),
    ('financeiro',             'ecs',          'valores'),
    ('rentabilidade',          'ecs',          'rentabilidade'),
    ('oss',                    'oss',          'ver'),
    ('oss.editar',             'oss',          'editar'),
    ('oss.emitir',             'oss',          'emitir'),
    ('oss.validarContrato',    'oss',          'validar_contrato'),
    ('oss.etapaFinanceiro',    'oss',          'etapa_financeiro'),
    ('oss.etapaBackoffice',    'oss',          'etapa_backoffice'),
    ('oss.financeiro',         'oss',          'financeiro_ver'),
    ('oss.financeiro.editar',  'oss',          'financeiro_editar'),
    ('checklists',             'checklists',   'ver'),
    ('checklists.editar',      'checklists',   'editar'),
    ('checklists.excluir',     'checklists',   'excluir'),
    ('checklists.padrao',      'checklists',   'lista_padrao'),
    ('cronogramas',            'cronogramas',  'ver'),
    ('fornecedores',           'fornecedores', 'ver'),
    ('fornecedores.editar',    'fornecedores', 'editar'),
    ('configuracoes',          'configuracoes','ver'),
    ('contratos.clausulas',    'configuracoes','clausulas'),
    ('logs',                   'admin.logs',   'ver'),
    ('guia',                   'guia',         'ver')
  ) as m (chave, tela, acao)
  where m.chave = p_chave;
$$;

-- Portões antigos, MESMA assinatura: agora leem o grupo. Sem grupo (não deveria existir depois
-- desta migração), vale a regra de antes, pela área e pelo papel.
create or replace function public.tem_recurso(chave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
             when p.grupo_id is not null then exists (
               select 1 from private.recurso_legado(chave) r
               where public.tem_permissao(r.tela, r.acao))
             when p.papel = 'Admin' then true
             when coalesce(cardinality(a.recursos), 0) > 0 then chave = any(a.recursos)
             else p.papel = 'Direcao' and chave in ('checklists.excluir', 'checklists.padrao')
           end
      from public.perfis p
      left join public.areas a on a.id = p.area_id
     where p.id = (select auth.uid()) and p.ativo
  ), false)
$$;

create or replace function public.recurso_da_area(p_chave text, p_niveis_sem_area text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
             when p.grupo_id is not null then exists (
               select 1 from private.recurso_legado(p_chave) r
               where public.tem_permissao(r.tela, r.acao))
             when p.papel = 'Admin' then true
             when coalesce(cardinality(a.recursos), 0) > 0 then p_chave = any(a.recursos)
             else p.papel = any(p_niveis_sem_area)
           end
      from public.perfis p
      left join public.areas a on a.id = p.area_id
     where p.id = (select auth.uid()) and p.ativo
  ), false)
$$;

-- --- Papel derivado do grupo; status e `ativo` andam juntos -----------------------------
-- Substitui a derivação pela área. Ordem dos gatilhos BEFORE (alfabética):
-- perfis_proteger_campos → perfis_sincronizar_papel → perfis_zz_administrador_presente.
create or replace function public.sincronizar_papel_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A área NÃO move mais ninguém de grupo (revisão de segurança, 26/11): o caminho antigo
  -- (Edge `gerenciar-usuarios`, que roda com a service role) passaria por cima das travas de
  -- Acessos. Grupo só muda pela RPC `definir_acesso_do_usuario` ou pela Edge `acessos`.
  -- `ativo` (caminho antigo) e `status` (padrão) dizem a mesma coisa.
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.ativo := new.status = 'ativo';
  elsif tg_op = 'UPDATE' and new.ativo is distinct from old.ativo then
    new.status := case when new.ativo then 'ativo' else 'inativo' end;
  elsif tg_op = 'INSERT' then
    new.ativo := new.status = 'ativo';
  end if;
  -- O papel é saída: vem do grupo (sistema = Admin); sem grupo, da área, como antes.
  if new.grupo_id is not null then
    select case when g.sistema then 'Admin' else g.papel_base end into new.papel
      from public.acesso_grupo g where g.id = new.grupo_id;
  elsif new.area_id is not null then
    select a.papel_base into new.papel from public.areas a where a.id = new.area_id;
  end if;
  return new;
end
$$;

-- Mudar o nível de um grupo muda o papel de quem está nele.
create or replace function private.propagar_papel_do_grupo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.papel_base is distinct from old.papel_base then
    perform set_config('polobh.acesso_interno', '1', true);
    update public.perfis set grupo_id = grupo_id where grupo_id = new.id;
    perform set_config('polobh.acesso_interno', '', true);
  end if;
  return new;
end;
$$;

drop trigger if exists acesso_grupo_propagar_papel on public.acesso_grupo;
create trigger acesso_grupo_propagar_papel
  after update on public.acesso_grupo
  for each row execute function private.propagar_papel_do_grupo();

-- --- Trava dos campos de acesso em `perfis` ---------------------------------------------
-- A sessão nunca muda grupo, status, ativo, papel, área, origem, e-mail, CPF nem a marca de
-- senha provisória: só as RPCs (sinal interno) e o backend (service role).
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
  -- Gatilho chamado por outro gatilho (propagação do papel, `on delete set null` da área).
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if coalesce(current_setting('polobh.acesso_interno', true), '') = '1' then
    return new;
  end if;
  if new.email is distinct from old.email
     or new.cpf is distinct from old.cpf
     or new.senha_provisoria is distinct from old.senha_provisoria
     or new.status is distinct from old.status
     or new.ativo is distinct from old.ativo
     or new.papel is distinct from old.papel
     or new.area_id is distinct from old.area_id
     or new.grupo_id is distinct from old.grupo_id
     or new.origem is distinct from old.origem
     or new.colaborador_id is distinct from old.colaborador_id then
    raise exception 'Grupo, status, origem, e-mail, CPF e senha do usuário só mudam pela tela de Acessos.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists perfis_proteger_campos on public.perfis;
create trigger perfis_proteger_campos
  before update on public.perfis
  for each row execute function private.proteger_campos_usuario();

-- --- O Administrador de sistema nunca fica sem usuário ativo -------------------------
-- Substitui a trava antiga (`perfis_impedir_lockout`, que exigia Admin OU Direção ativo).
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
    select 1 from public.perfis u where u.grupo_id = v_sistema and u.status = 'ativo' and u.id <> old.id
  ) then
    raise exception 'O grupo Administrador de sistema precisa ter ao menos um usuário ativo.' using errcode = '23514';
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists perfis_impedir_lockout on public.perfis;
drop trigger if exists perfis_administrador_presente on public.perfis;
-- "zz": gatilhos BEFORE rodam em ordem alfabética, e esta trava precisa ver o status e o grupo
-- DEPOIS de `perfis_sincronizar_papel` (que traduz `ativo` em `status`). Revisão de segurança, 26/11.
drop trigger if exists perfis_zz_administrador_presente on public.perfis;
create trigger perfis_zz_administrador_presente
  before update or delete on public.perfis
  for each row execute function private.garantir_administrador();

-- --- Proteção do grupo ---------------------------------------------------------
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
    return old;
  end if;
  if new.sistema is distinct from old.sistema then
    raise exception 'A marca de grupo de sistema não pode ser alterada.' using errcode = '42501';
  end if;
  if new.padrao is distinct from old.padrao
     and coalesce(current_setting('polobh.acesso_interno', true), '') <> '1' then
    raise exception 'A marca de grupo padrão não pode ser alterada.' using errcode = '42501';
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

-- --- Conta nova do Auth nasce PENDENTE, sem grupo -------------------------------------
-- Ajusta o gatilho que já existia (`handle_new_user`): antes ele lia o papel dos metadados da
-- conta — quem criasse a conta escolhia o próprio papel. Agora nasce pendente e não acessa nada
-- até a tela de Acessos liberar (a Edge `acessos` completa a linha no mesmo cadastro).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email, papel, status, ativo)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)),
    lower(btrim(new.email)),
    'Producao',
    'pendente',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- --- RPC: salvar grupo ---------------------------------------------------------
-- p = { id?, nome, descricao?, ativo?, papel_base?, permissoes?: [{tela, acao}] }.
create or replace function public.salvar_grupo_acesso(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_id      uuid;
  v_nome    text := btrim(coalesce(p ->> 'nome', ''));
  v_desc    text := btrim(coalesce(p ->> 'descricao', ''));
  v_papel   text := nullif(btrim(coalesce(p ->> 'papel_base', '')), '');
  v_grupo   public.acesso_grupo;
  v_ativo   boolean;
  v_item    jsonb;
  v_ativos  integer;
  v_excedentes text;
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
  -- O nível "Admin" é só do grupo de sistema.
  if v_papel is not null and v_papel not in ('Direcao', 'Producao', 'Administrativo') then
    raise exception 'Nível inválido.' using errcode = '22023';
  end if;
  -- O NÍVEL também é acesso (as policies antigas leem o papel): quem não é do Administrador só
  -- grava o próprio nível ou o de Produção (revisão de segurança, 26/11).
  if v_papel is not null and not private.posso_conceder_nivel(v_papel) then
    raise exception 'Você só pode usar o seu próprio nível ou o de Produção.' using errcode = '42501';
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

  if p ? 'permissoes' and not private.sou_administrador() then
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

  perform set_config('polobh.acesso_interno', '1', true);

  if v_id is null then
    if not public.tem_permissao('acessos.grupos', 'criar') then
      raise exception 'Você não tem permissão para criar grupos de permissão.' using errcode = '42501';
    end if;
    v_ativo := coalesce((p ->> 'ativo')::boolean, true);
    begin
      insert into public.acesso_grupo (nome, descricao, ativo, papel_base)
      values (v_nome, v_desc, v_ativo, coalesce(v_papel, 'Producao'))
      returning id into v_id;
    exception when unique_violation then
      raise exception 'Já existe um grupo com este nome.' using errcode = '22023';
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
             papel_base = coalesce(v_papel, papel_base)
       where id = v_id;
    exception when unique_violation then
      raise exception 'Já existe um grupo com este nome.' using errcode = '22023';
    end;
  end if;

  if p ? 'permissoes' then
    delete from public.acesso_grupo_permissao where grupo_id = v_id;
    insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
    select distinct v_id, e ->> 'tela', e ->> 'acao'
    from jsonb_array_elements(p -> 'permissoes') as t(e);
  end if;

  perform set_config('polobh.acesso_interno', '', true);
  perform private.registrar_log_interno('atividade', 'info',
    case when p ? 'id' and coalesce(p ->> 'id', '') <> '' then 'grupo_alterado' else 'grupo_criado' end,
    'ok', v_uid, '/acessos', 'Grupo de permissão "' || v_nome || '" salvo', 'grupo', v_id::text, v_nome, null);
  return v_id;
end;
$$;

-- --- Nível (papel antigo) que quem chama pode conceder ---------------------------------
-- O Administrador concede qualquer um; os demais, o próprio nível ou o de Produção (o mais baixo).
create or replace function private.posso_conceder_nivel(p_nivel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.sou_administrador())
      or p_nivel = 'Producao'
      or exists (select 1 from public.perfis u where u.id = (select auth.uid()) and u.status = 'ativo' and u.papel = p_nivel);
$$;
revoke all on function private.posso_conceder_nivel(text) from public;
grant execute on function private.posso_conceder_nivel(text) to authenticated, service_role;

-- --- Grupo que quem chama pode conceder -------------------------------------------
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
      exists (select 1 from public.acesso_grupo g
               where g.id = p_grupo and not g.sistema and private.posso_conceder_nivel(g.papel_base))
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

-- --- Conta do Auth pelo e-mail (só service role) --------------------------------
create or replace function public.usuario_auth_por_email(p_email text)
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;

revoke all on function public.usuario_auth_por_email(text) from public, anon, authenticated;
grant execute on function public.usuario_auth_por_email(text) to service_role;

-- --- Permissões específicas --------------------------------------------------------
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
      and (g.sistema or exists (
        select 1 from public.acesso_usuario_especial e where e.usuario_id = u.id and e.chave = p_chave))
  );
$$;

-- --- RPC: definir o acesso de um usuário ---------------------------------------
create or replace function public.definir_acesso_do_usuario(
  p_usuario uuid,
  p_grupo   uuid,
  p_status  text default null,
  p_nome    text default null,
  p_cargo   text default null,
  p_setor   text default null,
  p_cpf     text default null
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
  v_cpf           text;
  v_acao_log      text;
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
                   or p_nome is not null or p_cargo is not null or p_setor is not null or p_cpf is not null;

  if v_muda_dados and not public.tem_permissao('acessos.usuarios', 'editar') then
    raise exception 'Você não tem permissão para editar usuários.' using errcode = '42501';
  end if;
  if v_alvo.status = 'inativo' and v_muda_dados and not (v_muda_status and p_status = 'ativo') then
    raise exception 'Este usuário está inativo. Ative-o antes de editar.' using errcode = '22023';
  end if;
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
  if ((p_grupo is not null and p_grupo is distinct from v_alvo.grupo_id) or (v_muda_status and p_status = 'ativo'))
     and v_grupo_final is not null
     and not public.posso_conceder_grupo(v_grupo_final) then
    raise exception 'Você só pode atribuir grupos cujas permissões você mesmo tem.' using errcode = '42501';
  end if;
  if v_muda_status and p_status = 'ativo' then
    if v_grupo_final is null then
      raise exception 'Escolha o grupo de permissão para liberar o acesso.' using errcode = '22023';
    end if;
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

  if (p_nome is not null or p_cargo is not null or p_setor is not null) and v_alvo.origem <> 'avulso' then
    raise exception 'Nome, setor e cargo de usuário vindo do cadastro de colaboradores são lidos de lá.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_setor, ''))) > 120 or length(btrim(coalesce(p_cargo, ''))) > 200 then
    raise exception 'Setor (até 120) ou cargo (até 200 caracteres) longo demais.' using errcode = '22023';
  end if;
  v_nome := btrim(coalesce(p_nome, ''));
  if p_nome is not null and v_nome = '' then
    raise exception 'O nome não pode ficar em branco.' using errcode = '22023';
  end if;

  if p_cpf is not null then
    v_cpf := regexp_replace(p_cpf, '[^0-9]', '', 'g');
    if v_cpf = '' then
      raise exception 'O CPF é obrigatório.' using errcode = '22023';
    end if;
    if not private.cpf_valido(v_cpf) then
      raise exception 'CPF inválido. Confira os números.' using errcode = '22023';
    end if;
    if exists (select 1 from public.perfis u where u.cpf = v_cpf and u.id <> p_usuario) then
      raise exception 'Já existe um usuário com este CPF.' using errcode = '23505';
    end if;
  end if;

  perform set_config('polobh.acesso_interno', '1', true);
  update public.perfis u
     set grupo_id = coalesce(p_grupo, u.grupo_id),
         status   = coalesce(p_status, u.status),
         nome     = case when p_nome is null then u.nome else v_nome end,
         cargo    = case when p_cargo is null then u.cargo else nullif(btrim(p_cargo), '') end,
         setor    = case when p_setor is null then u.setor else nullif(btrim(p_setor), '') end,
         cpf      = coalesce(v_cpf, u.cpf)
   where u.id = p_usuario;
  perform set_config('polobh.acesso_interno', '', true);

  v_acao_log := case
    when v_muda_status and p_status = 'inativo' then 'usuario_inativado'
    when v_muda_status and p_status = 'ativo' and v_alvo.status = 'pendente' then 'usuario_liberado'
    when v_muda_status and p_status = 'ativo' then 'usuario_ativado'
    else 'usuario_alterado' end;
  perform private.registrar_log_interno('acesso', 'info', v_acao_log, 'ok', v_uid, '/acessos',
    case v_acao_log
      when 'usuario_inativado' then 'Usuário inativado'
      when 'usuario_liberado' then 'Acesso liberado'
      when 'usuario_ativado' then 'Usuário ativado'
      else 'Acesso do usuário alterado' end,
    'usuario', p_usuario::text, v_alvo.nome,
    case when p_grupo is not null and p_grupo is distinct from v_alvo.grupo_id
         then jsonb_build_object('grupo', v_grupo.nome) end);
end;
$$;

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
    raise exception 'Somente um usuário do grupo Administrador de sistema pode alterar membros desse grupo.' using errcode = '42501';
  end if;
  if v_alvo.status = 'inativo' then
    raise exception 'Este usuário está inativo. Ative-o antes de editar.' using errcode = '22023';
  end if;
  if v_alvo.status = 'pendente' then
    raise exception 'Libere o acesso do usuário antes de marcar permissões específicas.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct btrim(c)), '{}') into v_novas
  from unnest(coalesce(p_chaves, '{}')) as c where btrim(c) <> '';
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
      raise exception 'Você não tem a permissão específica "%", então não pode concedê-la.', v_chave using errcode = '42501';
    end if;
  end loop;
  delete from public.acesso_usuario_especial e where e.usuario_id = p_usuario and not (e.chave = any (v_novas));
  insert into public.acesso_usuario_especial (usuario_id, chave, concedida_por)
  select p_usuario, n, v_uid from unnest(v_novas) as n on conflict do nothing;
end;
$$;

create or replace function public.conferir_duplicidade_de_usuario(p_email text, p_cpf text, p_ignorar uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cpf          text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_email        text := lower(btrim(coalesce(p_email, '')));
  v_status_email text;
  v_status_cpf   text;
begin
  if not (public.tem_permissao('acessos.usuarios', 'criar') or public.tem_permissao('acessos.usuarios', 'editar')) then
    raise exception 'Você não tem permissão para cadastrar usuários.' using errcode = '42501';
  end if;
  if v_email <> '' then
    select u.status into v_status_email from public.perfis u
     where lower(btrim(u.email)) = v_email and u.id is distinct from p_ignorar limit 1;
  end if;
  if v_cpf <> '' then
    select u.status into v_status_cpf from public.perfis u
     where u.cpf = v_cpf and u.id is distinct from p_ignorar limit 1;
  end if;
  return jsonb_build_object(
    'emailEmUso', v_status_email is not null, 'statusDoEmail', v_status_email,
    'cpfEmUso', v_status_cpf is not null, 'statusDoCpf', v_status_cpf);
end;
$$;

-- --- Permissões de execução ---------------------------------------------------
revoke all on function public.tem_permissao(text, text) from public, anon;
revoke all on function public.minhas_permissoes() from public, anon;
revoke all on function public.salvar_grupo_acesso(jsonb) from public, anon;
revoke all on function public.definir_acesso_do_usuario(uuid, uuid, text, text, text, text, text) from public, anon;
revoke all on function public.tem_permissao_especial(text) from public, anon;
revoke all on function public.conferir_duplicidade_de_usuario(text, text, uuid) from public, anon;
revoke all on function public.definir_permissoes_especiais(uuid, text[]) from public, anon;
revoke all on function public.posso_conceder_grupo(uuid) from public, anon;
grant execute on function public.tem_permissao(text, text) to authenticated, service_role;
grant execute on function public.minhas_permissoes() to authenticated, service_role;
grant execute on function public.salvar_grupo_acesso(jsonb) to authenticated, service_role;
grant execute on function public.definir_acesso_do_usuario(uuid, uuid, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.tem_permissao_especial(text) to authenticated, service_role;
grant execute on function public.conferir_duplicidade_de_usuario(text, text, uuid) to authenticated, service_role;
grant execute on function public.definir_permissoes_especiais(uuid, text[]) to authenticated, service_role;
grant execute on function public.posso_conceder_grupo(uuid) to authenticated, service_role;

revoke all on function private.esta_ativo() from public;
revoke all on function private.sou_administrador() from public;
grant execute on function private.esta_ativo() to authenticated, service_role;
grant execute on function private.sou_administrador() to authenticated, service_role;
revoke all on function private.recurso_legado(text) from public;
grant execute on function private.recurso_legado(text) to authenticated, service_role;
revoke all on function private.proteger_campos_usuario() from public;
revoke all on function private.garantir_administrador() from public;
revoke all on function private.proteger_grupo_acesso() from public;
revoke all on function private.proteger_permissao_do_grupo_de_sistema() from public;
revoke all on function private.propagar_papel_do_grupo() from public;
revoke all on function private.cpf_valido(text) from public;
grant execute on function private.cpf_valido(text) to authenticated, service_role;
-- Os portões antigos não precisam ser chamáveis sem login.
revoke execute on function public.ve_financeiro() from anon;

-- --- RLS ---------------------------------------------------------------------
alter table public.acesso_grupo enable row level security;
alter table public.acesso_grupo_permissao enable row level security;
alter table public.acesso_usuario_especial enable row level security;

drop policy if exists acesso_grupo_leitura on public.acesso_grupo;
create policy acesso_grupo_leitura on public.acesso_grupo
  for select to authenticated using ((select private.esta_ativo()));

drop policy if exists acesso_grupo_permissao_leitura on public.acesso_grupo_permissao;
create policy acesso_grupo_permissao_leitura on public.acesso_grupo_permissao
  for select to authenticated using ((select private.esta_ativo()));

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

-- Perfis: a leitura de hoje continua (o app mostra nome e papel da equipe em vários lugares),
-- mas POR COLUNA — a sessão nunca lê `cpf`. Ninguém sem login lê nada. A sessão só grava o
-- próprio `ultimo_acesso` e o próprio telefone.
revoke all on public.perfis from anon;
revoke all on public.perfis from authenticated;
grant select (id, nome, papel, criado_em, telefone, area_id, ativo, email, status, grupo_id, origem,
              colaborador_id, cargo, setor, cpf_mascarado, senha_provisoria, ultimo_acesso)
  on public.perfis to authenticated;
grant update (ultimo_acesso) on public.perfis to authenticated;

drop policy if exists perfis_atualiza_a_si on public.perfis;
create policy perfis_atualiza_a_si on public.perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Áreas: só leitura daqui em diante (a tela nova não as usa; o front antigo, só leitura até o
-- deploy). Ninguém sem login.
revoke all on public.areas from anon;
revoke insert, update, delete, truncate on public.areas from authenticated;

-- --- Dados: grupos de partida e vínculo dos usuários atuais ------------------
do $$
declare
  v_admin uuid;
  r       record;
  v_g     uuid;
begin
  perform set_config('polobh.acesso_interno', '1', true);

  insert into public.acesso_grupo (nome, descricao, sistema, papel_base)
  select 'Administrador de sistema', 'Acesso total, inclusive Acessos e Logs. Grupo de sistema.', true, 'Admin'
  where not exists (select 1 from public.acesso_grupo g where g.sistema)
  returning id into v_admin;
  if v_admin is null then
    select g.id into v_admin from public.acesso_grupo g where g.sistema;
  end if;

  -- Cada área COM USUÁRIO vira um grupo com as mesmas permissões (mapa recurso → tela/ação).
  for r in
    select a.* from public.areas a
     where exists (select 1 from public.perfis p where p.area_id = a.id)
  loop
    insert into public.acesso_grupo (nome, descricao, papel_base, area_origem_id)
    values (r.nome, '', r.papel_base, r.id)
    on conflict do nothing
    returning id into v_g;
    if v_g is null then
      select g.id into v_g from public.acesso_grupo g where g.area_origem_id = r.id;
    end if;
    insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
    select v_g, m.tela, m.acao
      from unnest(coalesce(r.recursos, '{}')) as rec(chave)
      cross join lateral private.recurso_legado(rec.chave) as m
    on conflict do nothing;
    v_g := null;
  end loop;

  -- Decisões de 26/11: Diretoria Produção e Coordenação Administrativo-Financeira administram
  -- Acessos; a Diretoria Produção vê e exporta os logs.
  insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
  select g.id, t.tela, t.acao
    from public.acesso_grupo g
    cross join (values
      ('acessos.usuarios', 'ver'), ('acessos.usuarios', 'criar'), ('acessos.usuarios', 'editar'), ('acessos.usuarios', 'inativar'),
      ('acessos.grupos', 'ver'), ('acessos.grupos', 'criar'), ('acessos.grupos', 'editar'), ('acessos.grupos', 'inativar')
    ) as t (tela, acao)
   where g.nome in ('Diretoria Produção', 'Coordenação Administrativo-Financeira')
  on conflict do nothing;
  insert into public.acesso_grupo_permissao (grupo_id, tela, acao)
  select g.id, t.tela, t.acao
    from public.acesso_grupo g
    cross join (values ('admin.logs', 'ver'), ('admin.logs', 'exportar')) as t (tela, acao)
   where g.nome = 'Diretoria Produção'
  on conflict do nothing;

  -- Quem já usa o app não perde nem ganha acesso: papel Admin → Administrador de sistema; os
  -- demais → o grupo nascido da área deles.
  update public.perfis p set grupo_id = v_admin where p.papel = 'Admin' and p.grupo_id is null;
  update public.perfis p
     set grupo_id = g.id
    from public.acesso_grupo g
   where g.area_origem_id = p.area_id and p.grupo_id is null;

  perform set_config('polobh.acesso_interno', '', true);
end;
$$;

-- Grupo obrigatório para quem está ativo.
alter table public.perfis drop constraint if exists perfis_ativo_tem_grupo;
alter table public.perfis add constraint perfis_ativo_tem_grupo check (status <> 'ativo' or grupo_id is not null);
