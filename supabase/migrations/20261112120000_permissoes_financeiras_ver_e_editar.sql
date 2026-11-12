-- PERMISSÕES FINANCEIRAS: VER e EDITAR separados, e o banco obedecendo a área (12/11/2026)
--
-- Pedido do Guilherme: a Produção passa a preencher todos os campos da OS,
-- inclusive os blocos financeiros, e as permissões de uma área precisam deixar
-- configurar isso com liberdade — ver e editar, bloco a bloco.
--
-- O que havia: uma chave só ("financeiro") decidia, ao mesmo tempo, os valores e
-- o BV da EC, os blocos financeiros da OS e a edição deles — e o banco ainda
-- liberava `ve_financeiro()` pelo NÍVEL (Direção/Administrativo) mesmo quando a
-- área não marcava o bloco: a tela escondia, o banco entregava.
--
-- Agora:
--   · `oss.financeiro`         → VER os blocos financeiros da OS (`os_financeiro`);
--   · `oss.financeiro.editar`  → GRAVAR esses blocos;
--   · `financeiro`             → valores e BV da EC, como sempre;
--   · todas valem pela ÁREA da pessoa (a mesma régua de `tem_recurso`); o nível
--     (papel) só serve de padrão para quem ainda não tem área marcada.

begin;

-- 1. Quem já tinha o bloco financeiro continua com tudo: as áreas que marcavam
--    `financeiro` ganham ver e editar dos blocos da OS. A Produção, que passa a
--    preencher a OS inteira, também.
update public.areas
   set recursos = array(select distinct x from unnest(recursos || array['oss.financeiro', 'oss.financeiro.editar']) as x)
 where 'financeiro' = any(recursos)
    or nome = 'Produção';

-- 2. A régua única: o recurso da ÁREA; sem área marcada, o padrão do nível.
create or replace function public.recurso_da_area(p_chave text, p_niveis_sem_area text[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select case
             when p.papel = 'Admin' then true
             when coalesce(cardinality(a.recursos), 0) > 0 then p_chave = any(a.recursos)
             else p.papel = any(p_niveis_sem_area)
           end
      from perfis p
      left join areas a on a.id = p.area_id
     where p.id = auth.uid() and p.ativo
  ), false)
$$;
revoke all on function public.recurso_da_area(text, text[]) from public, anon;
grant execute on function public.recurso_da_area(text, text[]) to authenticated;

-- 3. Valores e BV da EC: agora pela área (antes o nível Direção/Administrativo
--    bastava, mesmo com a área sem marcar o bloco).
create or replace function public.ve_financeiro()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.recurso_da_area('financeiro', array['Direcao', 'Administrativo'])
$$;

-- 4. Blocos financeiros da OS: ver e editar.
create or replace function public.ve_financeiro_os()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.recurso_da_area('oss.financeiro', array['Direcao', 'Administrativo'])
$$;
create or replace function public.edita_financeiro_os()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.recurso_da_area('oss.financeiro.editar', array['Direcao', 'Administrativo'])
$$;
revoke all on function public.ve_financeiro_os() from public, anon;
revoke all on function public.edita_financeiro_os() from public, anon;
grant execute on function public.ve_financeiro_os() to authenticated;
grant execute on function public.edita_financeiro_os() to authenticated;

-- 5. `os_financeiro`: ler pelo "ver", gravar pelo "editar" — uma política por
--    comando, para quem só edita (sem ver) não ganhar leitura de carona.
drop policy if exists os_fin_read on public.os_financeiro;
drop policy if exists os_fin_write on public.os_financeiro;
create policy os_fin_read on public.os_financeiro for select
  using ((select ve_financeiro_os()));
create policy os_fin_insert on public.os_financeiro for insert
  with check ((select edita_financeiro_os()));
create policy os_fin_update on public.os_financeiro for update
  using ((select edita_financeiro_os())) with check ((select edita_financeiro_os()));
create policy os_fin_delete on public.os_financeiro for delete
  using ((select edita_financeiro_os()));

commit;
