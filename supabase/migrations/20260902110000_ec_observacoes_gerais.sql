-- ============================================================================
-- Conversa GERAL da EC.
--
-- A EC ja tinha observacoes por ITEM: o acerto de um custo, com a pessoa certa.
-- Faltava o corredor — onde alguem escreve "@Marisa o cliente cortou o coffee
-- break" e a equipe combina o que fazer, antes de o assunto virar item.
--
-- Fica FORA de `salvar_ec_completa` de proposito: comentar nao e editar a
-- estimativa. Assim uma conversa nao esbarra na trava de edicao de quem esta
-- mexendo nos custos, nem o formulario aberto ha meia hora sobrescreve as
-- mensagens que chegaram nesse meio tempo.
-- ============================================================================

alter table ecs add column if not exists observacoes jsonb not null default '[]'::jsonb;

comment on column ecs.observacoes is
  'Conversa geral da EC (mesmo formato das observacoes de item). Interna: nunca sai em documento, e-mail ou planilha. Gravada so por salvar_observacoes_ec.';

-- ----------------------------------------------------------------------------
-- Quem ve a EC pode conversar nela.
--
-- A escrita direta em `ecs` e de Admin/Direcao/Producao (policy `ecs_write`),
-- mas comentar nao e editar: o Administrativo tambem participa da conversa.
-- Dai a funcao `security definer`, que grava SO a coluna da conversa e exige
-- apenas um perfil valido — o mesmo criterio da leitura da EC.
--
-- `atualizado_em` NAO e tocado: ele e a trava otimista da edicao da EC (ver
-- `salvar_ec_completa`), e uma mensagem nova nao pode invalidar o formulario
-- que outra pessoa tem aberto.
-- ----------------------------------------------------------------------------
create or replace function salvar_observacoes_ec(p_ec_id uuid, p_observacoes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_observacoes jsonb;
begin
  if papel_atual() is null then
    raise exception 'Sem permissao para comentar na EC';
  end if;
  if jsonb_typeof(p_observacoes) is distinct from 'array' then
    raise exception 'Observacoes devem ser uma lista';
  end if;

  update ecs set observacoes = p_observacoes
   where id = p_ec_id
   returning observacoes into v_observacoes;

  if v_observacoes is null then
    raise exception 'EC nao encontrada';
  end if;
  return v_observacoes;
end;
$$;

revoke all on function salvar_observacoes_ec(uuid, jsonb) from public, anon;
grant execute on function salvar_observacoes_ec(uuid, jsonb) to authenticated;
