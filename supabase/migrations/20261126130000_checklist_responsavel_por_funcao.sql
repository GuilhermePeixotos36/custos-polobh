-- =====================================================================
-- CHECK-LIST — a tarefa vai para a FUNÇÃO, e o app acha a pessoa   (26/11/2026)
--
-- A lista padrão dizia o responsável só como texto ("Direção de Produção", "Back-Office"…) e a
-- tarefa nascia sem dono. Agora a função da lista é uma do cadastro de Funções (Acessos ›
-- Funções), e o app resolve a pessoa:
--   · "Produção" → o produtor do projeto (Dados Gerais › Produtora Responsável);
--   · as demais → quem tem aquele cargo no cadastro de usuários.
--
-- 1. Os nomes antigos da lista viram os do cadastro (e "Produção Responsável" vira "Produção").
-- 2. "Assistente Financeiro" entra no cadastro de Funções (a lista usa; ninguém tem ainda).
-- 3. `responsaveis_por_funcao()`: cargo → nome dos usuários ativos, para o app resolver a pessoa
--    na hora de gerar o check-list (a RLS de `perfis` não mostra o cargo dos outros).
-- 4. As tarefas ABERTAS e sem responsável dos projetos ativos recebem a pessoa da função.
-- =====================================================================

insert into public.acesso_funcao (nome) values ('Assistente Financeiro') on conflict do nothing;

create or replace function private.funcao_do_cadastro(p text)
returns text language sql immutable set search_path = '' as $$
  select case btrim(p)
    when 'Direção de Produção' then 'Diretoria de Produção'
    when 'Coordenação Administrativo-Financeiro' then 'Coordenação Administrativo-Financeira'
    when 'Back-Office' then 'Back-office'
    when 'Produção Responsável' then 'Produção'
    else btrim(p) end;
$$;

create or replace function private.funcoes_do_cadastro(p jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(f order by o), '[]'::jsonb)
  from (
    select private.funcao_do_cadastro(e) f, min(n) o
    from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality t(e, n)
    where btrim(e) <> ''
    group by 1
  ) x;
$$;

-- 1. Lista padrão e tarefas já geradas
update public.checklist_modelos m set itens = (
  select coalesce(jsonb_agg(
    case when i ? 'funcoes' then jsonb_set(i, '{funcoes}', private.funcoes_do_cadastro(i -> 'funcoes')) else i end
    order by n), '[]'::jsonb)
  from jsonb_array_elements(m.itens) with ordinality t(i, n)
);

update public.checklist_itens set funcoes = private.funcoes_do_cadastro(funcoes)
 where funcoes is not null and funcoes <> private.funcoes_do_cadastro(funcoes);

-- 3. Cargo → pessoas (só nomes de usuários ativos com cargo)
create or replace function public.responsaveis_por_funcao()
returns table (funcao text, nome text)
language sql stable security definer set search_path = '' as $$
  select p.cargo, p.nome from public.perfis p
   where (select private.esta_ativo()) and p.status = 'ativo'
     and coalesce(btrim(p.cargo), '') <> '' and coalesce(btrim(p.nome), '') <> ''
   order by p.cargo, p.nome;
$$;
revoke all on function public.responsaveis_por_funcao() from public, anon;
grant execute on function public.responsaveis_por_funcao() to authenticated;

-- 4. Tarefas abertas sem dono nos projetos ativos
with alvo as (
  select ci.id,
         ci.funcoes ->> 0 as f,
         regexp_replace(coalesce(pr.projeto ->> 'produtoraResponsavel', ''), '\s*\(.*?\)\s*', '', 'g') as produtor
    from public.checklist_itens ci
    join public.checklists c on c.id = ci.checklist_id
    join public.projetos pr on pr.id = c.projeto_id
   where coalesce(ci.responsavel, '') = ''
     and ci.status not in ('Concluído', 'Não se aplica')
     and pr.status <> 'Arquivado'
), resolvido as (
  select a.id,
         case when a.f = 'Produção' then
                coalesce((select u.nome from public.perfis u where lower(u.nome) = lower(btrim(a.produtor)) limit 1), btrim(a.produtor))
              else (select min(u.nome) from public.perfis u where u.cargo = a.f and u.status = 'ativo') end as quem
    from alvo a
)
update public.checklist_itens ci set responsavel = r.quem
  from resolvido r
 where r.id = ci.id and coalesce(r.quem, '') <> '';
