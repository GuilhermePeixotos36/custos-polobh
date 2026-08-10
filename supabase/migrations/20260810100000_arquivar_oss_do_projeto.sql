-- Arquivar um projeto encerra a cadeia documental inteira: ECs e OSs.
-- A operacao e atomica para evitar projeto parcialmente arquivado caso uma
-- atualizacao falhe no meio do processo.

alter table oss drop constraint if exists oss_status_check;
alter table oss add constraint oss_status_check
  check (status in ('Rascunho', 'Emitida', 'Disparada', 'Cancelada', 'Arquivada'));

create or replace function arquivar_documentos_projeto(p_projeto_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if coalesce(papel_atual(), '') not in ('Admin', 'Direcao', 'Producao', 'Administrativo') then
    raise exception 'Sem permissao para arquivar projeto';
  end if;

  -- Serializa dois arquivamentos concorrentes do mesmo projeto.
  perform pg_advisory_xact_lock(hashtext(p_projeto_id::text));

  update projetos
     set status = 'Arquivado', atualizado_em = now()
   where id = p_projeto_id;

  if not found then
    raise exception 'Projeto nao encontrado';
  end if;

  update oss
     set status = 'Arquivada', atualizado_em = now()
   where ec_id in (select id from ecs where projeto_id = p_projeto_id)
     and status is distinct from 'Arquivada';

  update ecs
     set status = 'Arquivada', ativa = false, atualizado_em = now()
   where projeto_id = p_projeto_id
     and status is distinct from 'Arquivada';
end;
$$;

revoke all on function arquivar_documentos_projeto(uuid) from public, anon;
grant execute on function arquivar_documentos_projeto(uuid) to authenticated;
