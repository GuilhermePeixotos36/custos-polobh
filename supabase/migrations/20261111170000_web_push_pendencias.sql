-- WEB PUSH: aviso de pendência com o navegador FECHADO (11/11/2026)
--
-- Até aqui o aviso do sistema operacional saía do próprio app aberto. Com o
-- navegador fechado não havia quem avisasse. Agora:
--
--  · cada aparelho que liga as notificações guarda aqui a sua INSCRIÇÃO de push
--    (o endereço que o Google/Apple/Mozilla dão ao navegador);
--  · qualquer app aberto da equipe calcula as pendências de quem tem inscrição
--    (todo mundo enxerga os mesmos dados) e chama a função `push-pendencias`;
--  · a função grava em `push_enviadas` o que já foi avisado — a chave
--    (pessoa, pendência) garante que dez apps abertos não viram dez avisos — e
--    manda o push só do que é novo.
--
-- As pendências continuam calculadas num lugar só (`domain/pendencias`): o
-- servidor não sabe o que é pendência, só entrega e não repete.

begin;

create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);
create index if not exists push_inscricoes_user_idx on public.push_inscricoes(user_id);

alter table public.push_inscricoes enable row level security;

-- Cada pessoa vê, cria e apaga só as inscrições dos PRÓPRIOS aparelhos.
drop policy if exists push_inscricoes_proprias on public.push_inscricoes;
create policy push_inscricoes_proprias on public.push_inscricoes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select papel_atual()) is not null);

-- O que já virou aviso. Só a função (chave de serviço) lê e escreve.
create table if not exists public.push_enviadas (
  user_id uuid not null references auth.users(id) on delete cascade,
  pendencia_id text not null,
  enviado_em timestamptz not null default now(),
  -- Atualizado sempre que a pendência ainda aparece aberta: a limpeza só tira
  -- o que sumiu de verdade, e a pendência que segue aberta não é reavisada.
  visto_em timestamptz not null default now(),
  primary key (user_id, pendencia_id)
);
alter table public.push_enviadas enable row level security;
-- (sem política: nenhum usuário acessa direto)

-- Quem tem pelo menos um aparelho inscrito — é para essas pessoas que o app
-- aberto calcula as pendências. Devolve só o id: nome, papel e área o app já lê
-- de `perfis` e `areas`.
create or replace function public.usuarios_com_push()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct i.user_id
    from public.push_inscricoes i
    join public.perfis p on p.id = i.user_id
   where coalesce(p.ativo, true)
     and (select papel_atual()) is not null;
$$;
revoke all on function public.usuarios_com_push() from public, anon;
grant execute on function public.usuarios_com_push() to authenticated;

-- Limpeza: avisos de pendências que não aparecem há 45 dias.
create or replace function public.limpar_push_enviadas()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_enviadas where visto_em < now() - interval '45 days';
$$;
revoke all on function public.limpar_push_enviadas() from public, anon, authenticated;

select cron.unschedule('limpar-push-enviadas')
 where exists (select 1 from cron.job where jobname = 'limpar-push-enviadas');
select cron.schedule('limpar-push-enviadas', '27 7 * * *', 'select public.limpar_push_enviadas();');

commit;
