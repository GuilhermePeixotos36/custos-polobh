-- WEB PUSH, parte 2 (11/11/2026): a chave do servidor e o registro atômico.
--
-- 1) `push_config` guarda o par de chaves VAPID, gerado pela própria função
--    `push-pendencias` na primeira vez que roda. A chave privada nunca sai do
--    servidor: nenhuma política dá acesso a ela, só a chave de serviço lê.
-- 2) `registrar_push` decide, numa transação só, o que é NOVO para a pessoa:
--    renova o "visto" do que já foi avisado e devolve apenas o que entrou agora.
--    Dois apps chamando ao mesmo tempo não geram aviso duplicado — a chave
--    primária de `push_enviadas` resolve a corrida.

begin;

create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  vapid_publica text not null,
  vapid_privada text not null,
  criado_em timestamptz not null default now()
);
alter table public.push_config enable row level security;
-- (sem política: só a chave de serviço)

create or replace function public.registrar_push(p_user uuid, p_ids text[])
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_enviadas
     set visto_em = now()
   where user_id = p_user and pendencia_id = any(p_ids);
  return query
    insert into public.push_enviadas (user_id, pendencia_id)
    select p_user, x from unnest(p_ids) as x
    on conflict do nothing
    returning pendencia_id;
end;
$$;
revoke all on function public.registrar_push(uuid, text[]) from public, anon, authenticated;
grant execute on function public.registrar_push(uuid, text[]) to service_role;

commit;
