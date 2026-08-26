-- ============================================================================
-- "Não se Aplica" nas opções de valor do item da EC (pedido do Guilherme, 26/08/2026).
--
-- As três formas de cobrar um item — com BV e NF, sem BV com NF, sem BV sem NF —
-- só aceitavam número. Faltava a outra resposta possível: "este item não é
-- cobrado assim". Sem ela, a produção deixava o campo em branco, e a planilha
-- não sabia distinguir "não se aplica" de "ainda não preenchi".
--
-- Guardado como uma LISTA das opções que não se aplicam, e não como três
-- colunas booleanas: é uma coluna só para atravessar a view mascarada, o
-- `salvar_ec_completa` e o `nova_versao_ec` — os três lugares que listam as
-- colunas uma a uma.
--
-- O valor digitado NÃO é apagado ao marcar "não se aplica": quem marcou por
-- engano volta atrás sem perder o que escreveu. Quem decide o que vale é a
-- lista, não o número.
-- ============================================================================

alter table ec_linhas
  add column if not exists valores_nao_aplicaveis jsonb not null default '[]'::jsonb;

comment on column ec_linhas.valores_nao_aplicaveis is
  'Opções de valor que não se aplicam a este item (["comBvNf","semBvComNf","semBvSemNf"]). "Não se aplica" é resposta da produção — diferente de campo em branco e de valor zero.';

-- Lista, não objeto solto: barra um jsonb de outro formato chegando pela RPC.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ec_linhas_valores_nao_aplicaveis_check') then
    alter table ec_linhas add constraint ec_linhas_valores_nao_aplicaveis_check
      check (jsonb_typeof(valores_nao_aplicaveis) = 'array');
  end if;
end $$;

-- 1) ------------------------------------------------- view mascarada (A-03)
-- Recriada do zero (a lista de colunas muda). A nova NÃO é mascarada: ela diz
-- se a pergunta se aplica, não quanto custa — mesmo tratamento de `opcao_valor`.
drop view if exists ec_linhas_visiveis;
create view ec_linhas_visiveis with (security_barrier = true) as
select
  l.id, l.ec_id, l.grupo, l.item, l.descricao, l.descricao_completa,
  case when papel_atual() in ('Admin','Direcao','Administrativo') then l.valor_polobh  end as valor_polobh,
  case when papel_atual() in ('Admin','Direcao','Administrativo') then l.valor_cliente end as valor_cliente,
  case when papel_atual() in ('Admin','Direcao','Administrativo') then l.valor_gasto   end as valor_gasto,
  case when papel_atual() in ('Admin','Direcao','Administrativo') then l.valor_com_bv_nf     end as valor_com_bv_nf,
  case when papel_atual() in ('Admin','Direcao','Administrativo') then l.valor_sem_bv_com_nf end as valor_sem_bv_com_nf,
  case when papel_atual() in ('Admin','Direcao','Administrativo') then l.valor_sem_bv_sem_nf end as valor_sem_bv_sem_nf,
  l.valores_nao_aplicaveis,
  l.opcao_valor,
  l.contrato, l.contrato_status, l.status_aprovacao,
  l.fornecedor_razao, l.fornecedor_cnpj, l.fornecedor_contato,
  l.fatura_nf, l.codigo_servico, l.pedido_compra, l.status_os,
  l.observacao, l.observacoes, l.oculto, l.ordem
from ec_linhas l
where papel_atual() is not null;  -- mesma regra de linha da policy ec_linhas_read

comment on view ec_linhas_visiveis is
  'Linhas da EC com os valores mascarados para quem não tem o recurso financeiro. É por aqui que o app lê; o SELECT direto em ec_linhas é revogado.';

grant select on ec_linhas_visiveis to authenticated;

-- 2) --------------------------------------------- gravação (salvar_ec_completa)
-- O `on conflict do update` lista as colunas uma a uma: sem a nova aqui, ela
-- seria gravada na inserção e ignorada em toda edição seguinte.
create or replace function salvar_ec_completa(
  p_ec_id uuid,
  p_ec jsonb,
  p_linhas jsonb,
  p_esperado_em timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_ec ecs;
  v_id uuid;
  v_ids uuid[];
  v_linhas jsonb;
  v_atual timestamptz;
  v_ve_financeiro boolean;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  v_ve_financeiro := papel_atual() in ('Admin','Direcao','Administrativo');

  v_ec := jsonb_populate_record(null::ecs, p_ec);
  if v_ec.projeto_id is not null then perform pg_advisory_xact_lock(hashtext(v_ec.projeto_id::text)); end if;

  -- Trava otimista (A-01): só para atualização; inserção não tem versão anterior.
  if p_ec_id is not null then
    if p_esperado_em is null then
      raise exception 'EC_VERSAO_NAO_INFORMADA';
    end if;
    select atualizado_em into v_atual from ecs where id = p_ec_id;
    if v_atual is null then raise exception 'EC não encontrada'; end if;
    if date_trunc('milliseconds', v_atual) <> date_trunc('milliseconds', p_esperado_em) then
      raise exception 'EC_CONFLITO_EDICAO';
    end if;
  end if;

  if coalesce(v_ec.ativa, false) and v_ec.projeto_id is not null then
    update ecs set ativa = false where projeto_id = v_ec.projeto_id and (p_ec_id is null or id <> p_ec_id);
  end if;

  if p_ec_id is null then
    insert into ecs (numero, projeto_id, template, cliente_id, cliente, cancelada_substituida, projeto, producao,
      responsavel, validade_dias, versao, ativa, status, criado_em, atualizado_em)
    values (v_ec.numero, v_ec.projeto_id, v_ec.template, v_ec.cliente_id, v_ec.cliente, v_ec.cancelada_substituida,
      v_ec.projeto, v_ec.producao, v_ec.responsavel, v_ec.validade_dias, v_ec.versao, v_ec.ativa, v_ec.status,
      coalesce(v_ec.criado_em, now()), now()) returning id into v_id;
  else
    update ecs set numero=v_ec.numero, projeto_id=v_ec.projeto_id, template=v_ec.template, cliente_id=v_ec.cliente_id,
      cliente=v_ec.cliente, cancelada_substituida=v_ec.cancelada_substituida, projeto=v_ec.projeto,
      producao=v_ec.producao, responsavel=v_ec.responsavel, validade_dias=v_ec.validade_dias, versao=v_ec.versao,
      ativa=v_ec.ativa, status=v_ec.status, atualizado_em=now()
    where id=p_ec_id returning id into v_id;
    if v_id is null then raise exception 'EC não encontrada'; end if;
  end if;

  select coalesce(jsonb_agg(x || jsonb_build_object('ec_id', v_id)), '[]'::jsonb),
         coalesce(array_agg((x->>'id')::uuid), '{}')
    into v_linhas, v_ids from jsonb_array_elements(p_linhas) x;
  if exists(select 1 from ec_linhas where id=any(v_ids) and ec_id<>v_id) then
    raise exception 'Linha pertence a outra EC';
  end if;
  delete from ec_linhas where ec_id=v_id and not (id=any(v_ids));

  insert into ec_linhas
  select * from jsonb_populate_recordset(null::ec_linhas, v_linhas)
  on conflict (id) do update set
    ec_id=excluded.ec_id, grupo=excluded.grupo, item=excluded.item, descricao=excluded.descricao,
    descricao_completa=excluded.descricao_completa,
    -- Valores só são aceitos de quem enxerga o financeiro; os demais mantêm o gravado.
    valor_polobh  = case when v_ve_financeiro then excluded.valor_polobh  else ec_linhas.valor_polobh  end,
    valor_cliente = case when v_ve_financeiro then excluded.valor_cliente else ec_linhas.valor_cliente end,
    valor_gasto   = case when v_ve_financeiro then excluded.valor_gasto   else ec_linhas.valor_gasto   end,
    valor_com_bv_nf     = case when v_ve_financeiro then excluded.valor_com_bv_nf     else ec_linhas.valor_com_bv_nf     end,
    valor_sem_bv_com_nf = case when v_ve_financeiro then excluded.valor_sem_bv_com_nf else ec_linhas.valor_sem_bv_com_nf end,
    valor_sem_bv_sem_nf = case when v_ve_financeiro then excluded.valor_sem_bv_sem_nf else ec_linhas.valor_sem_bv_sem_nf end,
    -- A escolha da opção e o "não se aplica" são decisão de produção, não de
    -- financeiro: todo mundo grava.
    valores_nao_aplicaveis=excluded.valores_nao_aplicaveis,
    opcao_valor=excluded.opcao_valor,
    contrato=excluded.contrato,
    contrato_status=excluded.contrato_status, status_aprovacao=excluded.status_aprovacao,
    fornecedor_razao=excluded.fornecedor_razao, fornecedor_cnpj=excluded.fornecedor_cnpj,
    fornecedor_contato=excluded.fornecedor_contato, fatura_nf=excluded.fatura_nf,
    codigo_servico=excluded.codigo_servico, pedido_compra=excluded.pedido_compra,
    status_os=excluded.status_os, observacao=excluded.observacao, observacoes=excluded.observacoes,
    oculto=excluded.oculto, ordem=excluded.ordem;
  return v_id;
end;
$$;

revoke all on function salvar_ec_completa(uuid, jsonb, jsonb, timestamptz) from public, anon;
grant execute on function salvar_ec_completa(uuid, jsonb, jsonb, timestamptz) to authenticated;

-- 3) ------------------------------------------------ nova versão da EC (cópia)
-- Mesma armadilha: a cópia lista as colunas explicitamente. Sem a nova, gerar
-- uma versão nova apagaria os "não se aplica" de todos os itens.
create or replace function nova_versao_ec(p_ec_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_orig ecs; v_id uuid; v_versao int;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  select * into v_orig from ecs where id = p_ec_id for update;
  if v_orig.id is null or v_orig.projeto_id is null then raise exception 'EC/projeto não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_orig.projeto_id::text));
  select coalesce(max(versao), 0) + 1 into v_versao from ecs where projeto_id = v_orig.projeto_id;
  update ecs set ativa = false where projeto_id = v_orig.projeto_id;
  update ecs set cancelada_substituida = true, status = 'Arquivada', atualizado_em = now() where id = p_ec_id;
  insert into ecs (numero, projeto_id, template, cliente_id, cliente, cancelada_substituida, projeto, producao,
    responsavel, validade_dias, versao, ativa, status, criado_em, atualizado_em)
  values (regexp_replace(v_orig.numero, 'V[0-9]+$', 'V' || lpad(v_versao::text, 2, '0')), v_orig.projeto_id,
    v_orig.template, v_orig.cliente_id, v_orig.cliente, true, v_orig.projeto, v_orig.producao,
    v_orig.responsavel, v_orig.validade_dias, v_versao, true, 'Rascunho', now(), now()) returning id into v_id;
  insert into ec_linhas (ec_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem)
  select v_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem
  from ec_linhas where ec_id = p_ec_id;
  return v_id;
end; $$;

revoke all on function nova_versao_ec(uuid) from public, anon;
grant execute on function nova_versao_ec(uuid) to authenticated;
