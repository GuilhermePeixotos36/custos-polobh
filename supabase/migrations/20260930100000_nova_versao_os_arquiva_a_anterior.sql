-- ============================================================================
-- Nova versão da OS ARQUIVA a anterior                        (29/09/2026)
--
-- Os quatro estados da OS ficam com quatro significados:
--   Rascunho  — sendo montada, ainda não saiu;
--   Emitida   — saiu para o fornecedor;
--   Cancelada — o NEGÓCIO caiu; só por decisão de uma pessoa (botão Cancelar OS);
--   Arquivada — saiu de cena SEM o negócio ter caído: foi substituída por uma
--               nova versão, ou o projeto foi arquivado (automático nos dois casos).
--
-- Antes, gerar nova versão CANCELAVA a anterior, o que misturava os dois fins de
-- vida na lista e nos filtros. A única mudança abaixo é essa linha.
-- ============================================================================

create or replace function gerar_nova_versao_os(
  p_os_id uuid,
  p_numero text,
  p_projeto jsonb,
  p_cliente jsonb,
  p_fornecedor jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ec_id uuid;
  v_status text;
  v_nova uuid;
begin
  if coalesce(papel_atual(), '') not in ('Admin', 'Direcao', 'Producao', 'Administrativo') then
    raise exception 'Sem permissao para gerar nova versao de OS';
  end if;

  select ec_id, status into v_ec_id, v_status from oss where id = p_os_id;
  if v_ec_id is null then
    raise exception 'OS nao encontrada';
  end if;
  -- OS encerrada nao gera versao nova: nao ha o que reemitir a partir dela.
  if v_status in ('Cancelada', 'Arquivada') then
    raise exception 'OS % nao pode gerar nova versao', v_status;
  end if;

  -- Serializa duas reemissoes da mesma OS (a seq abaixo depende disso).
  perform pg_advisory_xact_lock(hashtext(p_os_id::text));

  insert into oss (
    numero, ec_id, seq, fornecedor, projeto, cliente, modalidade, descritivo, entrega,
    detalhamento, cronograma, logistica, infraestrutura, credenciamento, orcamento,
    contrato, bv, itens, observacoes_gerais, observacoes, status
  )
  select
    p_numero,
    o.ec_id,
    coalesce((select max(seq) from oss where ec_id = o.ec_id), 0) + 1,
    -- Fornecedor novo quando a reemissao e por troca dele; senao, o mesmo.
    coalesce(p_fornecedor, o.fornecedor),
    coalesce(p_projeto, o.projeto),
    coalesce(p_cliente, o.cliente),
    o.modalidade, o.descritivo, o.entrega, o.detalhamento, o.cronograma, o.logistica,
    o.infraestrutura,
    -- Credenciamento comeca limpo: o link e o prazo pertencem a OS anterior, e
    -- o token da nova sai do default da coluna.
    '{"prazoLimite":"","linkFormulario":""}'::jsonb,
    o.orcamento, o.contrato, o.bv,
    -- A contratacao item a item acompanha a OS: e o que ela decidiu pagar.
    o.itens,
    o.observacoes_gerais, o.observacoes,
    -- Rascunho, como toda OS recem-emitida: alguem confere antes de disparar.
    'Rascunho'
  from oss o
  where o.id = p_os_id
  returning id into v_nova;

  insert into os_linhas (os_id, ec_linha_id)
  select v_nova, ec_linha_id from os_linhas where os_id = p_os_id;

  insert into os_financeiro (os_id, dados, atualizado_em)
  select v_nova, dados, now() from os_financeiro where os_id = p_os_id;

  -- A versão anterior é ARQUIVADA, e não cancelada (29/09/2026): cancelar é
  -- decisão de gente (o negócio caiu); ser substituída por uma versão nova é o
  -- fim de vida normal do documento, e o histórico continua consultável.
  update oss set status = 'Arquivada', atualizado_em = now() where id = p_os_id;

  return v_nova;
end;
$$;

revoke all on function gerar_nova_versao_os(uuid, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function gerar_nova_versao_os(uuid, text, jsonb, jsonb, jsonb) to authenticated;
