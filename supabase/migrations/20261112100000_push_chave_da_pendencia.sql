-- WEB PUSH, parte 3 (12/11/2026): a chave do aviso deixa de ser só o id.
--
-- Problema: `push_enviadas` lembrava a pendência pelo `id`, e o `id` de uma
-- conversa é o da thread. A Bárbara pergunta à Marisa, a Marisa responde, a
-- Bárbara pergunta de novo — mesma thread, mesma pendência da Marisa, mas o
-- aviso só saía na primeira vez. O mesmo valia para a OS devolvida pela Direção
-- e reenviada pela Produção.
--
-- Agora o app manda a CHAVE: `id#marca` (a última mensagem da conversa, ou a hora
-- em que a OS entrou na etapa). A chave muda a cada vez nova, e cada vez nova
-- avisa. Esta função só ganha uma coisa: o que já estava registrado na forma
-- antiga (`id`, sem "#") é herdado pela chave nova SEM avisar — senão toda
-- pendência aberta hoje viraria "nova" no primeiro repasse depois da mudança.

begin;

create or replace function public.registrar_push(p_user uuid, p_ids text[])
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
  -- O que já foi avisado e ainda está aberto: renova o "visto".
  update public.push_enviadas
     set visto_em = now()
   where user_id = p_user and pendencia_id = any(p_ids);

  -- Migração: chave nova cujo id já constava na forma antiga → herda o registro,
  -- e o registro antigo sai (a chave nova passa a ser a lembrança dela).
  insert into public.push_enviadas (user_id, pendencia_id)
  select p_user, x
    from unnest(p_ids) as x
   where position('#' in x) > 0
     and exists (
       select 1 from public.push_enviadas e
        where e.user_id = p_user and e.pendencia_id = split_part(x, '#', 1)
     )
  on conflict do nothing;

  delete from public.push_enviadas e
   where e.user_id = p_user
     and e.pendencia_id in (
       select split_part(x, '#', 1) from unnest(p_ids) as x where position('#' in x) > 0
     );

  -- O que é novo de verdade.
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
