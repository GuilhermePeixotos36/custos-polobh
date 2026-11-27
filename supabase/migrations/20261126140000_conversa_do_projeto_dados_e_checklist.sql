-- ============================================================================
-- Conversa do projeto: as abas Dados Gerais e Check-list passam a gravar.
--
-- Em 15/09/2026 a tela ganhou o card de Observações nas abas "dados" e
-- "checklist" (ver ABAS_COM_CONVERSA em src/data/types.ts), mas a lista de abas
-- aceitas por `salvar_conversa_projeto` ficou a de 10/09: ec, os, fornecedores,
-- cronograma e credenciamento. Resultado: nessas duas abas toda observação
-- voltava com "Aba checklist nao tem conversa" e nada era salvo.
--
-- A função é a mesma; só a lista de abas cresce. "ec" e "os" continuam aceitas
-- para não recusar conversa antiga gravada com essas chaves.
-- ============================================================================
create or replace function salvar_conversa_projeto(
  p_projeto_id uuid,
  p_aba text,
  p_observacoes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversas jsonb;
begin
  if papel_atual() is null then
    raise exception 'Sem permissao para comentar no projeto';
  end if;
  if jsonb_typeof(p_observacoes) is distinct from 'array' then
    raise exception 'Observacoes devem ser uma lista';
  end if;
  -- Aba fechada: a chave vira caminho de jsonb, e chave livre encheria a coluna
  -- de lixo que nenhuma tela leria.
  if p_aba not in ('dados', 'checklist', 'ec', 'os', 'fornecedores', 'cronograma', 'credenciamento') then
    raise exception 'Aba % nao tem conversa', p_aba;
  end if;

  update projetos
     set conversas = jsonb_set(coalesce(conversas, '{}'::jsonb), array[p_aba], p_observacoes, true)
   where id = p_projeto_id
   returning conversas into v_conversas;

  if v_conversas is null then
    raise exception 'Projeto nao encontrado';
  end if;
  return v_conversas;
end;
$$;

revoke all on function salvar_conversa_projeto(uuid, text, jsonb) from public, anon;
grant execute on function salvar_conversa_projeto(uuid, text, jsonb) to authenticated;
