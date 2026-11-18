-- ============================================================================
-- A OS tem TRÊS status: Ativa, Emitida e Arquivada              (18/11/2026)
--
-- Pedido do Guilherme. Antes eram quatro — Rascunho, Emitida, Cancelada,
-- Arquivada:
--   · "Rascunho" passa a se chamar "Ativa" (sendo montada, ainda não saiu);
--   · "Cancelada" deixa de existir, junto com o botão "Cancelar OS": a OS que sai
--     de cena é ARQUIVADA. Para trocar de fornecedor ou de condição, usa-se
--     "Gerar Nova Versão OS". As OS hoje canceladas passam a arquivadas.
--
-- O gatilho que devolvia os itens da EC ao CANCELAR uma OS (15/10/2026) sai:
-- não há mais como chegar a 'Cancelada'. O "Arquivar" não devolve itens, como
-- sempre — é o fim de vida normal do documento.
-- ============================================================================

begin;

alter table oss drop constraint if exists oss_status_check;

update oss set status = 'Ativa' where status = 'Rascunho';
update oss set status = 'Arquivada' where status = 'Cancelada';

alter table oss alter column status set default 'Ativa';
alter table oss add constraint oss_status_check
  check (status in ('Ativa', 'Emitida', 'Arquivada'));

drop trigger if exists oss_cancelada_libera_itens on public.oss;
drop function if exists public.liberar_itens_de_os_cancelada();

-- A nova versão nasce ATIVA (era 'Rascunho'). O resto da função é o de
-- 29/09/2026 (`20260930100000_nova_versao_os_arquiva_a_anterior.sql`).
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
  -- OS arquivada nao gera versao nova: nao ha o que reemitir a partir dela.
  if v_status = 'Arquivada' then
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
    coalesce(p_fornecedor, o.fornecedor),
    coalesce(p_projeto, o.projeto),
    coalesce(p_cliente, o.cliente),
    o.modalidade, o.descritivo, o.entrega, o.detalhamento, o.cronograma, o.logistica,
    o.infraestrutura,
    '{"prazoLimite":"","linkFormulario":""}'::jsonb,
    o.orcamento, o.contrato, o.bv,
    o.itens,
    o.observacoes_gerais, o.observacoes,
    'Ativa'
  from oss o
  where o.id = p_os_id
  returning id into v_nova;

  insert into os_linhas (os_id, ec_linha_id)
  select v_nova, ec_linha_id from os_linhas where os_id = p_os_id;

  insert into os_financeiro (os_id, dados, atualizado_em)
  select v_nova, dados, now() from os_financeiro where os_id = p_os_id;

  update oss set status = 'Arquivada', atualizado_em = now() where id = p_os_id;

  return v_nova;
end;
$$;

revoke all on function gerar_nova_versao_os(uuid, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function gerar_nova_versao_os(uuid, text, jsonb, jsonb, jsonb) to authenticated;

commit;
