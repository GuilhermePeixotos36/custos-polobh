-- ============================================================================
-- A nova versão da EC LEVA AS OS JUNTO                           (25/11/2026)
--
-- Caso que motivou: a Viviane corrigiu o valor de dois serviços do Quebra Nozes
-- na EC V02, e as OS não mudaram. Elas continuavam penduradas na V01, que
-- estava arquivada: a nova versão copiava os itens com ids novos e deixava as
-- OS para trás. A OS lê os valores do item da EC a que está ligada, então
-- nenhuma correção na versão nova chegava a ela.
--
-- Agora, ao gerar a versão nova (pelas duas funções), as OS que não estão
-- arquivadas passam para a versão nova:
--   · `oss.ec_id` aponta para a versão nova;
--   · `os_linhas` troca cada item pelo correspondente copiado;
--   · a contratação gravada na OS (`oss.itens[].ecLinhaId`) também.
-- A OS arquivada fica onde está: é histórico. O `atualizado_em` anda, para uma
-- aba aberta com a OS antiga receber "alguém salvou antes" em vez de gravar os
-- itens velhos por cima.
--
-- No fim, o reparo das OS que já tinham ficado para trás.
-- ============================================================================

begin;

create or replace function levar_oss_para_nova_versao_ec(p_de uuid, p_para uuid, p_mapa jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update os_linhas ol
     set ec_linha_id = (p_mapa->>ol.ec_linha_id::text)::uuid
    from oss o
   where o.id = ol.os_id
     and o.ec_id = p_de
     and o.status <> 'Arquivada'
     and p_mapa ? ol.ec_linha_id::text;

  update oss o
     set ec_id = p_para,
         itens = case
           when jsonb_typeof(o.itens) = 'array' then coalesce((
             select jsonb_agg(
                      case when p_mapa ? (e->>'ecLinhaId')
                           then jsonb_set(e, '{ecLinhaId}', to_jsonb(p_mapa->>(e->>'ecLinhaId')))
                           else e end
                      order by ord)
               from jsonb_array_elements(o.itens) with ordinality as t(e, ord)
           ), '[]'::jsonb)
           else o.itens end,
         atualizado_em = now()
   where o.ec_id = p_de
     and o.status <> 'Arquivada';
end;
$$;

revoke all on function levar_oss_para_nova_versao_ec(uuid, uuid, jsonb) from public, anon, authenticated;

-- As duas funções de nova versão: o corpo é o de antes, com o mapa de itens e
-- a chamada acima. `nova_versao_ec` passa a usar o mapa também (antes os ids
-- novos vinham do default da tabela).

create or replace function nova_versao_ec(p_ec_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_orig ecs; v_id uuid; v_versao int; v_mapa jsonb;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  select * into v_orig from ecs where id = p_ec_id for update;
  if v_orig.id is null or v_orig.projeto_id is null then raise exception 'EC/projeto não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_orig.projeto_id::text));
  select coalesce(max(versao), 0) + 1 into v_versao from ecs where projeto_id = v_orig.projeto_id;
  update ecs set ativa = false, status = 'Arquivada', atualizado_em = now()
   where projeto_id = v_orig.projeto_id and (ativa or id = p_ec_id);
  update ecs set cancelada_substituida = true where id = p_ec_id;
  insert into ecs (numero, projeto_id, template, cliente_id, cliente, cancelada_substituida, projeto, producao,
    responsavel, validade_dias, versao, ativa, status, criado_em, atualizado_em)
  values (regexp_replace(v_orig.numero, 'V[0-9]+$', 'V' || lpad(v_versao::text, 2, '0')), v_orig.projeto_id,
    v_orig.template, v_orig.cliente_id, v_orig.cliente, true, v_orig.projeto, v_orig.producao,
    v_orig.responsavel, v_orig.validade_dias, v_versao, true, 'Ativa', now(), now()) returning id into v_id;

  select coalesce(jsonb_object_agg(id::text, gen_random_uuid()::text), '{}'::jsonb) into v_mapa
    from ec_linhas where ec_id = p_ec_id;

  insert into ec_linhas (id, ec_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem, divisao)
  select (v_mapa->>l.id::text)::uuid, v_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem, divisao
  from ec_linhas l where ec_id = p_ec_id;

  perform levar_oss_para_nova_versao_ec(p_ec_id, v_id, v_mapa);
  return v_id;
end;
$$;

create or replace function nova_versao_ec_com_mapa(p_ec_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_orig ecs; v_id uuid; v_versao int; v_mapa jsonb;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  select * into v_orig from ecs where id = p_ec_id for update;
  if v_orig.id is null or v_orig.projeto_id is null then raise exception 'EC/projeto não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_orig.projeto_id::text));
  select coalesce(max(versao), 0) + 1 into v_versao from ecs where projeto_id = v_orig.projeto_id;
  update ecs set ativa = false, status = 'Arquivada', atualizado_em = now()
   where projeto_id = v_orig.projeto_id and (ativa or id = p_ec_id);
  update ecs set cancelada_substituida = true where id = p_ec_id;
  insert into ecs (numero, projeto_id, template, cliente_id, cliente, cancelada_substituida, projeto, producao,
    responsavel, validade_dias, versao, ativa, status, criado_em, atualizado_em)
  values (regexp_replace(v_orig.numero, 'V[0-9]+$', 'V' || lpad(v_versao::text, 2, '0')), v_orig.projeto_id,
    v_orig.template, v_orig.cliente_id, v_orig.cliente, true, v_orig.projeto, v_orig.producao,
    v_orig.responsavel, v_orig.validade_dias, v_versao, true, 'Ativa', now(), now()) returning id into v_id;

  select coalesce(jsonb_object_agg(id::text, gen_random_uuid()::text), '{}'::jsonb) into v_mapa
    from ec_linhas where ec_id = p_ec_id;

  insert into ec_linhas (id, ec_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem, divisao)
  select (v_mapa->>l.id::text)::uuid, v_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem, divisao
  from ec_linhas l where ec_id = p_ec_id;

  perform levar_oss_para_nova_versao_ec(p_ec_id, v_id, v_mapa);
  return jsonb_build_object('id', v_id, 'mapa', v_mapa);
end;
$$;

-- ----------------------------------------------------------------------------
-- REPARO: OS vivas (Ativa/Emitida) penduradas numa versão arquivada passam
-- para a versão ativa do projeto. Cada item é casado pelo grupo + nome + CPF/
-- CNPJ do fornecedor; não sendo único, pelo grupo + nome + posição + divisão.
-- A OS só muda se TODOS os itens dela casarem — senão fica como está.
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    with alvo as (
      select o.id os_id, o.ec_id de, a.id para, l.id velho, l.grupo, l.item, l.ordem, l.divisao, l.fornecedor_cnpj
        from oss o
        join ecs e on e.id = o.ec_id and not e.ativa
        join ecs a on a.projeto_id = e.projeto_id and a.ativa
        join os_linhas ol on ol.os_id = o.id
        join ec_linhas l on l.id = ol.ec_linha_id
       where o.status <> 'Arquivada'
    ), casado as (
      select alvo.*, coalesce(
        (select min(n.id::text) from ec_linhas n
          where n.ec_id = alvo.para and n.grupo = alvo.grupo and n.item = alvo.item
            and coalesce(n.fornecedor_cnpj, '') = coalesce(alvo.fornecedor_cnpj, '')
         having count(*) = 1),
        (select min(n.id::text) from ec_linhas n
          where n.ec_id = alvo.para and n.grupo = alvo.grupo and n.item = alvo.item
            and n.ordem = alvo.ordem and coalesce(n.divisao, '') = coalesce(alvo.divisao, '')
         having count(*) = 1)
      ) novo
      from alvo
    )
    select os_id, de, para, jsonb_object_agg(velho::text, novo) mapa
      from casado
     group by os_id, de, para
    having bool_and(novo is not null)
  loop
    update os_linhas ol set ec_linha_id = (r.mapa->>ol.ec_linha_id::text)::uuid
     where ol.os_id = r.os_id and r.mapa ? ol.ec_linha_id::text;
    update oss o
       set ec_id = r.para,
           itens = case
             when jsonb_typeof(o.itens) = 'array' then coalesce((
               select jsonb_agg(
                        case when r.mapa ? (e->>'ecLinhaId')
                             then jsonb_set(e, '{ecLinhaId}', to_jsonb(r.mapa->>(e->>'ecLinhaId')))
                             else e end
                        order by ord)
                 from jsonb_array_elements(o.itens) with ordinality as t(e, ord)
             ), '[]'::jsonb)
             else o.itens end,
           atualizado_em = now()
     where o.id = r.os_id;
  end loop;
end;
$$;

commit;
