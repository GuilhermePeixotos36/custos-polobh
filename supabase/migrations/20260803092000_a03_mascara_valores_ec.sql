-- A-03 — Protege de verdade os valores financeiros da EC.
--
-- Antes: `ec_linhas_read` liberava SELECT para qualquer papel autenticado, e é lá
-- que moram valor_polobh / valor_cliente / valor_gasto. A interface escondia os
-- valores da Produção, mas quem tivesse um login de Produção lia tudo direto
-- pela API — a restrição era só cosmética.
--
-- Agora:
--   1. As duas RPCs que mexem em ec_linhas viram SECURITY DEFINER. Ambas já
--      validam papel_atual() na primeira linha, então continuam seguras, e
--      passam a funcionar mesmo sem SELECT direto na tabela.
--   2. `salvar_ec_completa` preserva os valores gravados quando quem salva não
--      enxerga o financeiro. Sem isso a máscara viraria perda de dados: a
--      Produção leria 0 e gravaria 0 por cima do valor real.
--   3. Uma view mascarada devolve NULL nas colunas de valor para quem não tem o
--      recurso "financeiro"; o SELECT direto na tabela é revogado.
--
-- Quem enxerga o financeiro: Admin, Direção e Administrativo — igual à matriz
-- PERMISSOES em src/store/auth.ts e à RLS de os_financeiro.
--
-- AVISOS DO LINTER DO SUPABASE — esperados neste desenho:
--   * "security_definer_view" em ec_linhas_visiveis: é o ponto da solução. A
--     view roda como dona justamente porque o chamador não tem mais SELECT na
--     tabela. Ela replica no WHERE a regra de linha da policy `ec_linhas_read`.
--     ATENÇÃO: se algum dia `ec_linhas` ganhar restrição por linha (ex.: "só os
--     projetos do usuário"), essa regra precisa ser repetida aqui — a view não
--     herda RLS automaticamente.
--   * "authenticated_security_definer_function_executable" em
--     salvar_ec_completa e nova_versao_ec: intencional. As duas são o caminho
--     de escrita e validam papel_atual() na primeira linha.

-- 1) ---------------------------------------------------------------- RPCs
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

alter function nova_versao_ec(uuid) security definer;

revoke all on function salvar_ec_completa(uuid, jsonb, jsonb, timestamptz) from public, anon;
grant execute on function salvar_ec_completa(uuid, jsonb, jsonb, timestamptz) to authenticated;

-- 2) ------------------------------------------------------------ view mascarada
create or replace view ec_linhas_visiveis with (security_barrier = true) as
select
  l.id, l.ec_id, l.grupo, l.item, l.descricao, l.descricao_completa,
  case when papel_atual() in ('Admin','Direcao','Administrativo') then l.valor_polobh  end as valor_polobh,
  case when papel_atual() in ('Admin','Direcao','Administrativo') then l.valor_cliente end as valor_cliente,
  case when papel_atual() in ('Admin','Direcao','Administrativo') then l.valor_gasto   end as valor_gasto,
  l.contrato, l.contrato_status, l.status_aprovacao,
  l.fornecedor_razao, l.fornecedor_cnpj, l.fornecedor_contato,
  l.fatura_nf, l.codigo_servico, l.pedido_compra, l.status_os,
  l.observacao, l.observacoes, l.oculto, l.ordem
from ec_linhas l
where papel_atual() is not null;  -- mesma regra de linha da policy ec_linhas_read

comment on view ec_linhas_visiveis is
  'Linhas da EC com os valores mascarados para quem não tem o recurso financeiro. É por aqui que o app lê; o SELECT direto em ec_linhas é revogado.';

-- 3) ------------------------------------------------- fecha o acesso direto
revoke select on ec_linhas from authenticated, anon;
grant select on ec_linhas_visiveis to authenticated;
