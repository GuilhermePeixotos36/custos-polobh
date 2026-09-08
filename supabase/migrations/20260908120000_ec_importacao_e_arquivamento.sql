-- ============================================================================
-- Importação de EC e arquivamento da versão substituída   (08/09/2026)
--
-- Duas correções no painel de ECs do projeto, ambas na mesma área.
--
-- 1) A EC SUBSTITUÍDA FICAVA COM "RASCUNHO"
--    `definir_ec_ativa` e `salvar_ec_completa` tiravam a bandeira `ativa` das
--    demais ECs do projeto, mas não mexiam no `status`. Como a tela lê o PAR
--    (status, ativa) — ver `src/domain/ec.ts` —, uma EC que era a ativa e foi
--    substituída continuava com status 'Rascunho' e aparecia na lista como
--    "Rascunho", não como "Arquivada". A própria confirmação da tela ("as
--    demais versões passam a arquivadas") prometia o que o banco não fazia.
--    Agora quem SAI do ar sai arquivada. 'Rascunho' fica sendo o que nunca
--    entrou no ar: a cópia e a importação, que nascem `ativa = false`.
--
-- 2) IMPORTAR EC PERDIA OS VALORES DE QUEM NÃO VÊ O FINANCEIRO
--    A importação (e a cópia de uma arquivada, em "Reativar gerando uma nova
--    versão") era feita no navegador: lia a EC de origem pela view mascarada
--    `ec_linhas_visiveis` e gravava o que tinha lido. Para Produção — que pode
--    criar EC mas não enxerga valores — a view devolve NULL nos campos de
--    dinheiro, e o `mapLinha` do app os converte em 0: a EC nova nascia com
--    todos os custos zerados, em silêncio. A proteção existente
--    (`salvar_ec_completa` só aceita valores de quem vê o financeiro) não
--    alcançava este caso, porque ali as linhas são INSERIDAS, e a proteção
--    mora no `on conflict do update`.
--    `importar_ec` faz a cópia DENTRO do banco, lendo `ec_linhas` direto: os
--    valores atravessam intactos qualquer que seja o papel de quem importa, e
--    ninguém passa a ver o que não via (a leitura de volta continua pela view).
--
--    A origem pode estar em QUALQUER estado — ativa, rascunho, arquivada ou
--    cancelada. Importar é copiar uma estrutura de custos que já deu certo; a
--    EC de origem não é tocada, e a cópia entra como rascunho não-ativo, sem
--    derrubar a EC ativa do projeto de destino.
-- ============================================================================

-- 1) ------------------------------------------ quem sai do ar, sai arquivada
create or replace function definir_ec_ativa(p_ec_id uuid)
returns void language plpgsql set search_path = public as $$
declare v_projeto uuid;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  select projeto_id into v_projeto from ecs where id = p_ec_id;
  if v_projeto is null then raise exception 'EC/projeto não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_projeto::text));
  -- A que estava no ar foi substituída por esta: arquiva (era só `ativa=false`,
  -- e o status 'Rascunho' ficava para trás mentindo na lista).
  update ecs set status = 'Arquivada', atualizado_em = now()
   where projeto_id = v_projeto and id <> p_ec_id and ativa and status not in ('Arquivada','Cancelada');
  update ecs set ativa = false where projeto_id = v_projeto and id <> p_ec_id;
  -- A que entra volta a ser rascunho quando estava arquivada/cancelada: ela
  -- precisa ser editável de novo, e é essa a leitura de `domain/ec`.
  update ecs set ativa = true,
                 status = case when status in ('Arquivada','Cancelada') then 'Rascunho' else status end
   where id = p_ec_id;
end; $$;

revoke all on function definir_ec_ativa(uuid) from public, anon;
grant execute on function definir_ec_ativa(uuid) to authenticated;

-- 2) ------------------- mesma regra na gravação (EC nova nasce como a ativa)
-- Recriada por inteiro a partir da versão de 28/08/2026 (`bv`): a função lista
-- coluna a coluna e não pode ser remendada por partes (ver README).
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
  -- Padrões das colunas que o app pode não conhecer ainda (ver README).
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

  -- Esta EC entra no ar: a que estava no ar SAI ARQUIVADA, e não apenas
  -- "não ativa". Só tirar a bandeira deixava a versão anterior com status
  -- 'Rascunho', e a tela — que lê status + ativa (ver `domain/ec`) — mostrava
  -- "Rascunho" numa EC que já tinha sido substituída. Rascunho passa a ser o
  -- que de fato nunca entrou no ar: a cópia e a importação.
  if coalesce(v_ec.ativa, false) and v_ec.projeto_id is not null then
    update ecs set status = 'Arquivada', atualizado_em = now()
     where projeto_id = v_ec.projeto_id
       and (p_ec_id is null or id <> p_ec_id)
       and ativa
       and status not in ('Arquivada', 'Cancelada');
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
    -- O BV é dinheiro: mesma regra dos valores. Quem lê a EC sem o financeiro
    -- recebe `bv` mascarado (null) da view, e gravaria null por cima do combinado.
    bv = case when v_ve_financeiro then excluded.bv else ec_linhas.bv end,
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

-- 3) ------------------------------------------- importar EC (cópia no banco)
-- SECURITY DEFINER pelo mesmo motivo de `salvar_ec_completa`: a cópia precisa
-- ler `ec_linhas` (SELECT direto revogado) para os valores não passarem pela
-- máscara. Quem chama continua limitado ao que já podia fazer — criar EC —, e
-- não passa a ENXERGAR nada: a EC nova é relida pela view, como sempre.
--
-- `p_ec` é o cabeçalho da EC de DESTINO, montado pelo app (cliente, dados do
-- projeto, taxas): é o projeto de destino que manda no cabeçalho, não a origem.
-- A versão sai daqui, sob o mesmo advisory lock das demais funções — no
-- navegador ela era calculada a partir de uma lista carregada minutos antes, e
-- duas importações ao mesmo tempo nasciam com o mesmo número.
--
-- `p_zerar`: a IMPORTAÇÃO começa limpa (o que estava emitido/comentado na
-- origem não vale no projeto novo); a CÓPIA para gerar uma versão seguinte
-- preserva, que ali é a mesma negociação seguindo adiante.
create or replace function importar_ec(p_origem uuid, p_ec jsonb, p_zerar boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ec ecs; v_orig ecs; v_id uuid; v_versao int;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;

  select * into v_orig from ecs where id = p_origem;
  if v_orig.id is null then raise exception 'EC de origem não encontrada'; end if;
  -- De propósito SEM filtro de status: ativa, rascunho, arquivada e cancelada
  -- podem ser importadas. O que se copia é a estrutura de custos, e uma EC
  -- arquivada é justamente a que já deu certo uma vez.

  v_ec := jsonb_populate_record(null::ecs, p_ec);
  if v_ec.projeto_id is null then raise exception 'Projeto de destino não informado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_ec.projeto_id::text));
  select coalesce(max(versao), 0) + 1 into v_versao from ecs where projeto_id = v_ec.projeto_id;

  insert into ecs (numero, projeto_id, template, cliente_id, cliente, cancelada_substituida, projeto, producao,
    responsavel, validade_dias, versao, ativa, status, criado_em, atualizado_em)
  values (regexp_replace(v_ec.numero, 'V[0-9]+$', 'V' || lpad(v_versao::text, 2, '0')), v_ec.projeto_id,
    v_ec.template, v_ec.cliente_id, v_ec.cliente, false, v_ec.projeto, v_ec.producao,
    v_ec.responsavel, v_ec.validade_dias, v_versao, false, 'Rascunho', now(), now())
  returning id into v_id;

  insert into ec_linhas (ec_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem)
  select v_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente,
    case when p_zerar then 0 else valor_gasto end,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato,
    case when p_zerar then 'Pendente' else contrato_status end,
    case when p_zerar then 'Pendente' else status_aprovacao end,
    fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra,
    case when p_zerar then 'Pendente' else status_os end,
    case when p_zerar then '' else observacao end,
    case when p_zerar then '[]'::jsonb else observacoes end,
    oculto, ordem
  from ec_linhas where ec_id = p_origem;

  return v_id;
end; $$;

comment on function importar_ec(uuid, jsonb, boolean) is
  'Copia uma EC de QUALQUER status (ativa, rascunho, arquivada ou cancelada) para um projeto, como rascunho não-ativo. A cópia é feita dentro do banco para os valores não passarem pela máscara de ec_linhas_visiveis.';

revoke all on function importar_ec(uuid, jsonb, boolean) from public, anon;
grant execute on function importar_ec(uuid, jsonb, boolean) to authenticated;

-- 4) --------------------------------- acerto do que já está gravado errado
-- As ECs que perderam o ar antes desta migração ficaram com 'Rascunho'. Não há
-- registro de "esta já foi a ativa", então o corte é por data, e é conservador:
-- só entra a EC criada ANTES da que hoje está no ar no mesmo projeto. Uma cópia
-- ou importação nasce sempre DEPOIS da EC ativa que ela não derrubou, então
-- rascunho de verdade não é tocado; projeto sem nenhuma EC ativa fica como está.
update ecs velha
   set status = 'Arquivada', atualizado_em = now()
 where velha.status = 'Rascunho'
   and not velha.ativa
   and exists (
     select 1 from ecs no_ar
      where no_ar.projeto_id = velha.projeto_id
        and no_ar.ativa
        and no_ar.criado_em > velha.criado_em
   );
