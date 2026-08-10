-- ============================================================================
-- Áreas (grupos de permissão cadastráveis) — pedido da Marisa, 09/08/2026:
-- "terá uma área onde cadastraremos as áreas e marcaremos quais telas pode
--  ver, editar e etc. Quando um usuário é cadastrado deve ser atribuído a uma
--  dessas áreas."
--
-- Modelo adotado (híbrido, decidido em 09/08/2026):
--   * `areas.recursos` — o que a área enxerga/edita NA INTERFACE. Livre, editável
--     em Configurações → Áreas.
--   * `areas.papel_base` — o nível de segurança NO BANCO. Continua sendo um dos
--     4 papéis originais, porque toda a RLS (inclusive o mascaramento de
--     valor_polobh/valor_cliente/valor_gasto em `ec_linhas_visiveis`) é escrita
--     em cima de `papel_atual()`. Assim dá para criar quantas áreas se quiser
--     sem reescrever ~30 policies.
--   * `perfis.papel` passa a ser DERIVADO da área (trigger abaixo) — ninguém
--     precisa mantê-lo à mão, e ele nunca diverge do papel_base da área.
-- ============================================================================

create table if not exists areas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  -- Nível de segurança de dados herdado (governa a RLS via perfis.papel).
  papel_base text not null check (papel_base in ('Admin','Direcao','Producao','Administrativo')),
  -- Telas/recursos liberados na interface (chaves do tipo `Recurso` em src/store/auth.ts).
  recursos   text[] not null default '{}',
  -- Áreas de fábrica: podem ser editadas, mas não excluídas (evita deixar o sistema sem acesso).
  sistema    boolean not null default false,
  criado_em  timestamptz not null default now()
);

comment on table areas is
  'Grupos de permissão cadastráveis. `recursos` controla as telas na interface; '
  '`papel_base` controla a RLS no banco (via perfis.papel, mantido em sincronia por trigger).';

alter table perfis
  add column if not exists area_id uuid references areas(id) on delete set null;

comment on column perfis.area_id is
  'Área do usuário. Define as telas na interface e, via trigger, o `papel` usado pela RLS.';

/* ------------------------- Áreas de fábrica (seed) ------------------------ */
-- Espelham exatamente a matriz que estava chumbada em src/store/auth.ts, para
-- que nada mude de comportamento ao aplicar esta migração.

insert into areas (nome, papel_base, recursos, sistema) values
  ('Administrador', 'Admin', array[
     'projetos','projetos.editar','ecs','ecs.editar','oss','oss.editar',
     'cronogramas','fornecedores','fornecedores.editar',
     'financeiro','configuracoes','logs','guia'], true),
  ('Direção', 'Direcao', array[
     'projetos','projetos.editar','ecs','ecs.editar','oss','oss.editar',
     'cronogramas','fornecedores','fornecedores.editar',
     'financeiro','configuracoes','guia'], true),
  ('Produção', 'Producao', array[
     'projetos','projetos.editar','ecs','ecs.editar','oss','oss.editar',
     'cronogramas','fornecedores','fornecedores.editar',
     'guia'], true),
  ('Administrativo', 'Administrativo', array[
     'projetos','ecs','oss','oss.editar','cronogramas','fornecedores','fornecedores.editar',
     'financeiro','configuracoes','guia'], true)
on conflict (nome) do nothing;

-- Liga cada perfil existente à área de fábrica correspondente ao papel dele.
update perfis p
   set area_id = a.id
  from areas a
 where a.sistema
   and a.papel_base = p.papel
   and p.area_id is null;

/* ---------------------- Sincronia área -> perfis.papel -------------------- */

create or replace function sincronizar_papel_do_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Com área definida, o papel é sempre o papel_base dela (fonte única).
  if new.area_id is not null then
    select papel_base into new.papel from areas where id = new.area_id;
  end if;
  return new;
end $$;

drop trigger if exists perfis_sincronizar_papel on perfis;
create trigger perfis_sincronizar_papel
  before insert or update on perfis
  for each row execute function sincronizar_papel_do_perfil();

-- Se o nível base da área mudar, todos os usuários dela acompanham.
create or replace function propagar_papel_base_da_area() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.papel_base is distinct from old.papel_base then
    update perfis set papel = new.papel_base where area_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists areas_propagar_papel_base on areas;
create trigger areas_propagar_papel_base
  after update on areas
  for each row execute function propagar_papel_base_da_area();

-- Área de fábrica não pode ser excluída (o sistema ficaria sem porta de entrada).
create or replace function impedir_exclusao_area_sistema() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.sistema then
    raise exception 'A área "%" é padrão do sistema e não pode ser excluída.', old.nome;
  end if;
  return old;
end $$;

drop trigger if exists areas_impedir_exclusao_sistema on areas;
create trigger areas_impedir_exclusao_sistema
  before delete on areas
  for each row execute function impedir_exclusao_area_sistema();

/* --------------------------------- RLS ----------------------------------- */
-- Leitura: qualquer usuário autenticado (o app precisa saber o que a própria
-- área libera). Escrita: mesmo grupo que já administra "configuracoes".

alter table areas enable row level security;

drop policy if exists areas_read on areas;
create policy areas_read on areas for select
  using (papel_atual() is not null);

drop policy if exists areas_write on areas;
create policy areas_write on areas for all
  using (papel_atual() in ('Admin','Direcao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Administrativo'));

grant select on areas to authenticated;
grant insert, update, delete on areas to authenticated;

-- Funções de gatilho não são para ser chamadas via /rest/v1/rpc (o linter do
-- Supabase acusa `security definer` exposto se ficarem com EXECUTE público).
revoke all on function sincronizar_papel_do_perfil() from public, anon, authenticated;
revoke all on function propagar_papel_base_da_area() from public, anon, authenticated;
revoke all on function impedir_exclusao_area_sistema() from public, anon, authenticated;

create index if not exists perfis_area_idx on perfis (area_id);
