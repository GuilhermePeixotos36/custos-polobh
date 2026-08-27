-- ============================================================================
-- `salvar_ec_completa` passa a preencher os campos novos da linha da EC quando
-- o app que chamou não os enviou.
--
-- O problema, visto em produção em 27/08/2026:
--   "null value in column valores_nao_aplicaveis of relation ec_linhas
--    violates not-null constraint"
--
-- A coluna nasceu `not null default '[]'`, mas o DEFAULT não salva ninguém aqui:
-- a função monta as linhas com `jsonb_populate_recordset(null::ec_linhas, ...)`
-- e insere com `select *`. Chave ausente no JSON vira NULL na coluna, e o INSERT
-- passa esse NULL explicitamente — o default só valeria se a coluna ficasse
-- FORA da lista de colunas do insert.
--
-- Ou seja: bastava uma aba aberta com o bundle anterior à migração (ou um
-- deploy ainda não propagado) para toda gravação de EC falhar. Migração de
-- banco e deploy do app nunca sobem no mesmo instante — a função é que tem de
-- aguentar o cliente antigo, e não o contrário.
--
-- A correção preenche os padrões ANTES de popular o registro. As chaves que o
-- app mandou vencem os padrões; chaves com `null` explícito no topo do objeto
-- são descartadas (sem mexer no que está aninhado, como as observações).
-- ============================================================================

-- Se alguma linha ficou com NULL antes desta correção, normaliza.
update ec_linhas set valores_nao_aplicaveis = '[]'::jsonb where valores_nao_aplicaveis is null;

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
  -- Padrões das colunas que o app pode não conhecer ainda (ver cabeçalho).
  v_padroes constant jsonb := jsonb_build_object(
    'valor_gasto', 0,
    'valor_com_bv_nf', 0,
    'valor_sem_bv_com_nf', 0,
    'valor_sem_bv_sem_nf', 0,
    'valores_nao_aplicaveis', '[]'::jsonb,
    'opcao_valor', '',
    'contrato_status', 'Pendente',
    'fornecedor_contato', '',
    'observacoes', '[]'::jsonb,
    'oculto', false
  );
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

  -- Padrões primeiro, o que o app mandou por cima, e o ec_id por último.
  -- `jsonb_object_agg ... where valor <> 'null'` derruba as chaves de topo que
  -- vierem nulas — o `||` sozinho deixaria o NULL passar por cima do padrão.
  select coalesce(jsonb_agg(
           v_padroes
             || coalesce((select jsonb_object_agg(k, v) from jsonb_each(x) as e(k, v) where v <> 'null'::jsonb), '{}'::jsonb)
             || jsonb_build_object('ec_id', v_id)
         ), '[]'::jsonb),
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
