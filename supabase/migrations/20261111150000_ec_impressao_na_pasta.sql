-- "Salvar na pasta" compara o CONTEÚDO da EC, não a data (11/11/2026)
--
-- O app decidia "a EC mudou desde que foi para a pasta?" por `atualizado_em >
-- baixada_em`. Mas `definir_ec_ativa`, `arquivar_documentos_projeto` e outras
-- funções também mexem em `atualizado_em` sem mudar o documento, e o próximo
-- "Salvar na pasta" criava uma versão nova sem edição nenhuma.
--
-- Agora, ao ir para a pasta, a EC guarda uma impressão digital do conteúdo
-- (`baixada_hash`, calculada no app — ver `domain/impressaoEc`). Sem ela (EC
-- arquivada antes desta mudança), o app segue comparando as datas.

alter table public.ecs add column if not exists baixada_hash text;

drop function if exists public.marcar_ec_baixada(uuid);

create or replace function public.marcar_ec_baixada(p_ec_id uuid, p_hash text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  -- A data marca a PRIMEIRA ida à pasta; a impressão também — é o conteúdo
  -- daquela versão como ela foi para lá.
  update ecs
     set baixada_em = coalesce(baixada_em, now()),
         baixada_hash = coalesce(baixada_hash, p_hash)
   where id = p_ec_id;
end; $function$;

revoke all on function public.marcar_ec_baixada(uuid, text) from public, anon;
grant execute on function public.marcar_ec_baixada(uuid, text) to authenticated, service_role;
