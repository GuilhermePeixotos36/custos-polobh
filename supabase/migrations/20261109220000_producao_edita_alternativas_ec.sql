-- Produção edita fornecedor e alternativas de custo na EC (pedido da Pólobh, 09/11/2026)
--
-- A área "Produção" preenche CNPJ/CPF, Razão social e as 3 alternativas de custo
-- (com BV e NF / sem BV com NF / sem BV sem NF) + BV, mas:
--   * não tinha `ecs.editar` (sem botão de editar a EC);
--   * não tem `financeiro` nem nível Direção/Administrativo, então `ve_financeiro()`
--     mascarava as alternativas na view e o `salvar_ec_completa` ignorava o que ela gravava.
--
-- Regra nova: as 3 alternativas e o BV ficam visíveis/graváveis para quem vê o
-- financeiro OU edita a EC (`ve_alternativas_custo()`). Valor Pólobh, valor cliente,
-- valor gasto e rentabilidade continuam só com `ve_financeiro()`.
-- Documento PG, Código de Serviço e Pedido de Compra continuam vindo da OS.
--
-- Aplicada em produção (POLOBH) em 09/11/2026 pelo SQL Editor.

begin;

-- 1) Área Produção volta a editar EC (matriz do README: Produção edita EC)
update areas
   set recursos = array_append(recursos, 'ecs.editar')
 where nome = 'Produção'
   and not ('ecs.editar' = any(recursos));

-- 2) Quem pode ver e gravar as 3 alternativas de custo e o BV
create or replace function public.ve_alternativas_custo()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select ve_financeiro() or tem_recurso('ecs.editar')
$$;

revoke all on function public.ve_alternativas_custo() from public, anon;
grant execute on function public.ve_alternativas_custo() to authenticated;

-- 3) View: alternativas e BV pela regra nova; rentabilidade continua só com financeiro.
--    Preserva as opções da view (ex.: security_invoker), que o replace poderia zerar.
do $do$
declare
  v_opts text[];
begin
  select reloptions into v_opts from pg_class where oid = 'public.ec_linhas_visiveis'::regclass;

  execute $v$
    create or replace view public.ec_linhas_visiveis as
    select id, ec_id, grupo, item, descricao, descricao_completa,
      case when (select ve_financeiro()) then valor_polobh  else null::numeric end as valor_polobh,
      case when (select ve_financeiro()) then valor_cliente else null::numeric end as valor_cliente,
      case when (select ve_financeiro()) then valor_gasto   else null::numeric end as valor_gasto,
      case when (select ve_alternativas_custo()) then valor_com_bv_nf     else null::numeric end as valor_com_bv_nf,
      case when (select ve_alternativas_custo()) then valor_sem_bv_com_nf else null::numeric end as valor_sem_bv_com_nf,
      case when (select ve_alternativas_custo()) then valor_sem_bv_sem_nf else null::numeric end as valor_sem_bv_sem_nf,
      case when (select ve_alternativas_custo()) then bv else null::jsonb end as bv,
      valores_nao_aplicaveis, opcao_valor, contrato, contrato_status, status_aprovacao,
      fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf, codigo_servico,
      pedido_compra, status_os, observacao, observacoes, oculto, ordem, divisao
    from ec_linhas l
    where (select papel_atual()) is not null
  $v$;

  if v_opts is not null then
    execute format('alter view public.ec_linhas_visiveis set (%s)', array_to_string(v_opts, ', '));
  end if;
end
$do$;

-- 4) Gravação da EC: mesma função de antes, só troca a proteção das alternativas e do BV
create or replace function public.salvar_ec_completa(p_ec_id uuid, p_ec jsonb, p_linhas jsonb, p_esperado_em timestamp with time zone default null::timestamp with time zone)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ec ecs;
  v_id uuid;
  v_ids uuid[];
  v_linhas jsonb;
  v_atual timestamptz;
  v_ve_financeiro boolean;
  v_ve_alternativas boolean;
  v_padroes constant jsonb := jsonb_build_object(
    'valor_gasto', 0,
    'valor_com_bv_nf', 0,
    'valor_sem_bv_com_nf', 0,
    'valor_sem_bv_sem_nf', 0,
    'valores_nao_aplicaveis', '[]'::jsonb,
    'opcao_valor', '',
    'bv', '{"modo":"percentual","valor":0,"justificativa":""}'::jsonb,
    'contrato_status', 'Pendente',
    'fornecedor_contato', '',
    'observacoes', '[]'::jsonb,
    'oculto', false
  );
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  v_ve_financeiro := ve_financeiro();
  v_ve_alternativas := ve_alternativas_custo();

  v_ec := jsonb_populate_record(null::ecs, p_ec);
  if v_ec.projeto_id is not null then perform pg_advisory_xact_lock(hashtext(v_ec.projeto_id::text)); end if;

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

  -- Esta EC entra no ar: as outras do projeto vão para o arquivo.
  if coalesce(v_ec.ativa, false) and v_ec.projeto_id is not null then
    update ecs set ativa = false, status = 'Arquivada', atualizado_em = now()
     where projeto_id = v_ec.projeto_id and (p_ec_id is null or id <> p_ec_id) and ativa;
  end if;

  -- O STATUS NÃO VEM DO APP: é derivado da bandeira.
  v_ec.status := case when coalesce(v_ec.ativa, false) then 'Ativa' else 'Arquivada' end;

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
    valor_polobh  = case when v_ve_financeiro then excluded.valor_polobh  else ec_linhas.valor_polobh  end,
    valor_cliente = case when v_ve_financeiro then excluded.valor_cliente else ec_linhas.valor_cliente end,
    valor_gasto   = case when v_ve_financeiro then excluded.valor_gasto   else ec_linhas.valor_gasto   end,
    valor_com_bv_nf     = case when v_ve_alternativas then excluded.valor_com_bv_nf     else ec_linhas.valor_com_bv_nf     end,
    valor_sem_bv_com_nf = case when v_ve_alternativas then excluded.valor_sem_bv_com_nf else ec_linhas.valor_sem_bv_com_nf end,
    valor_sem_bv_sem_nf = case when v_ve_alternativas then excluded.valor_sem_bv_sem_nf else ec_linhas.valor_sem_bv_sem_nf end,
    bv = case when v_ve_alternativas then excluded.bv else ec_linhas.bv end,
    valores_nao_aplicaveis=excluded.valores_nao_aplicaveis,
    opcao_valor=excluded.opcao_valor,
    contrato=excluded.contrato,
    contrato_status=excluded.contrato_status, status_aprovacao=excluded.status_aprovacao,
    fornecedor_razao=excluded.fornecedor_razao, fornecedor_cnpj=excluded.fornecedor_cnpj,
    fornecedor_contato=excluded.fornecedor_contato, fatura_nf=excluded.fatura_nf,
    codigo_servico=excluded.codigo_servico, pedido_compra=excluded.pedido_compra,
    status_os=excluded.status_os, observacao=excluded.observacao, observacoes=excluded.observacoes,
    oculto=excluded.oculto, ordem=excluded.ordem, divisao=excluded.divisao;
  return v_id;
end;
$function$;

commit;
