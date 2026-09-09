-- ============================================================================
-- Nova versão de OS: leva a contratação junto, e aceita trocar o fornecedor
--                                                            (10/09/2026)
--
-- Duas coisas, as duas sobre a mesma função.
--
-- 1. A CONTRATAÇÃO ESTAVA FICANDO PARA TRÁS. `oss.itens` nasceu na migração
--    `20260909160000` (o que a OS decidiu pagar, item a item), e a cópia desta
--    função lista as colunas uma a uma — então a coluna nova simplesmente não
--    era copiada. Reemitir uma OS zerava a contratação inteira, calada: os
--    valores, o BV e as justificativas de cada item voltavam para o que a EC
--    estimava. Passa a ser copiada.
--
-- 2. TROCAR O FORNECEDOR DE UMA OS JÁ EMITIDA passa a gerar versão nova.
--    Até aqui a troca era uma edição comum: o mesmo documento, com o mesmo
--    número, passava a falar de outra empresa — e o fornecedor anterior, que
--    já tinha recebido a OS por e-mail, ficava sem registro nenhum de que
--    aquilo fora cancelado. Agora a OS anterior é arquivada (é o que esta
--    função sempre fez com a que dá origem à versão) e a nova nasce com o
--    fornecedor novo, no número seguinte da série.
--
--    O `p_fornecedor` é opcional: sem ele, a cópia mantém o fornecedor da OS
--    de origem, que é o caso de quem só está reemitindo por mudança no evento.
--
-- A assinatura antiga (4 argumentos) sai de cena para não conviver com a nova
-- em chamada ambígua.
-- ============================================================================

drop function if exists gerar_nova_versao_os(uuid, text, jsonb, jsonb);

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

  update oss set status = 'Cancelada', atualizado_em = now() where id = p_os_id;

  return v_nova;
end;
$$;

revoke all on function gerar_nova_versao_os(uuid, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function gerar_nova_versao_os(uuid, text, jsonb, jsonb, jsonb) to authenticated;
