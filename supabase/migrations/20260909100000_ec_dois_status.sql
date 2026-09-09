-- ============================================================================
-- A EC tem dois estados: Ativa ou Arquivada            (09/09/2026)
--
-- A coluna `ecs.status` era herdeira de um fluxo de aprovação do cliente que
-- não existe mais, e carregava seis valores ('Rascunho', 'Aguardando',
-- 'Aprovada', 'Reprovada', 'Cancelada', 'Arquivada'). A tela lia o PAR
-- (status, ativa), e a mesma EC aparecia ora como "Rascunho", ora como
-- "Arquivada", conforme o caminho pelo qual tinha saído do ar — ninguém
-- conseguia dizer o que cada selo queria dizer.
--
-- Passa a valer o que o dia a dia pergunta: esta é a estimativa que vale, ou
-- não é? Cada projeto tem UMA EC no ar (índice único `ecs_uma_ativa_por_projeto_idx`)
-- e todas as outras são o arquivo do projeto — consultável e, sobretudo,
-- IMPORTÁVEL: é de lá que se puxa uma estimativa de volta.
--
-- Quem manda é a bandeira `ativa`. O `status` continua existindo e passa a
-- ACOMPANHÁ-LA, normalizado por toda função que grava — o app não escolhe mais
-- a palavra. Isso também fecha uma porta: uma aba aberta no bundle anterior,
-- mandando 'Rascunho' no JSON, não consegue mais sujar a coluna.
--
-- 'Cancelada' sai de circulação junto com o resto: uma EC que não vale mais é
-- simplesmente arquivada, e continua consultável e importável como qualquer
-- outra. O botão "Cancelar EC" virou "Arquivar EC".
--
-- A IMPORTAÇÃO passa a entrar NO AR. Antes ela caía como rascunho não-ativo,
-- o que só fazia sentido enquanto "rascunho" era um estado editável; com dois
-- estados, importar para em seguida não poder editar não serviria para nada.
-- A EC que estava valendo no destino vai para o arquivo — e volta por
-- `definir_ec_ativa` quando se quiser.
-- ============================================================================

-- 1) ---------------------------------------- normaliza o que já está gravado
-- Primeiro cai a trava antiga: ela é a do `create table` da baseline
-- (`check (status in ('Rascunho','Aguardando','Aprovada','Reprovada',
-- 'Cancelada','Arquivada'))`, que o Postgres nomeia `ecs_status_check`) e
-- recusaria as duas palavras novas. A trava dos dois estados entra no fim, já
-- com a tabela normalizada.
alter table ecs drop constraint if exists ecs_status_check;
-- O default também sai do vocabulário antigo. Toda inserção passa por uma RPC
-- que declara o status; o default é a rede de segurança, e a rede segura para o
-- lado seguro: fora do ar até que se diga o contrário.
alter table ecs alter column status set default 'Arquivada';

-- Nenhum critério, nenhuma heurística: a bandeira decide. Onde antes era
-- preciso adivinhar se um 'Rascunho' não-ativo tinha ou não estado no ar
-- (migração 20260908120000), agora a pergunta não existe mais.
update ecs set status = case when ativa then 'Ativa' else 'Arquivada' end
 where status is distinct from (case when ativa then 'Ativa' else 'Arquivada' end);

-- 2) ---------------------------------------- quem sai do ar, sai arquivada
create or replace function definir_ec_ativa(p_ec_id uuid)
returns void language plpgsql set search_path = public as $$
declare v_projeto uuid;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  select projeto_id into v_projeto from ecs where id = p_ec_id;
  if v_projeto is null then raise exception 'EC/projeto não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_projeto::text));
  -- Só uma no ar por projeto: o resto é arquivo.
  update ecs set ativa = false, status = 'Arquivada', atualizado_em = now()
   where projeto_id = v_projeto and id <> p_ec_id and (ativa or status <> 'Arquivada');
  update ecs set ativa = true, status = 'Ativa' where id = p_ec_id;
end; $$;

revoke all on function definir_ec_ativa(uuid) from public, anon;
grant execute on function definir_ec_ativa(uuid) to authenticated;

-- 3) ------------------------- o status sai da bandeira, não do que o app manda
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

  -- Esta EC entra no ar: as outras do projeto vão para o arquivo.
  if coalesce(v_ec.ativa, false) and v_ec.projeto_id is not null then
    update ecs set ativa = false, status = 'Arquivada', atualizado_em = now()
     where projeto_id = v_ec.projeto_id and (p_ec_id is null or id <> p_ec_id) and ativa;
  end if;

  -- O STATUS NÃO VEM DO APP: ele é derivado da bandeira. São dois estados (ver
  -- `src/domain/ec.ts`), e deixar o cliente escolher a palavra era o que criava
  -- a divergência — uma aba antiga mandando 'Rascunho', outra 'Aprovada', e a
  -- lista mostrando selos que ninguém sabia ler. Aqui a coluna sempre acompanha
  -- `ativa`, venha o que vier no JSON.
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

-- 4) ------------------------------ importar EC (cópia no banco, já no ar)
-- SECURITY DEFINER pelo mesmo motivo de `salvar_ec_completa`: a cópia precisa
-- ler `ec_linhas` (SELECT direto revogado) para os valores não passarem pela
-- máscara de `ec_linhas_visiveis`. Quem chama continua limitado ao que já podia
-- fazer — criar EC —, e não passa a ENXERGAR nada: a EC nova é relida pela view.
--
-- A ORIGEM pode estar em qualquer estado, e isso é o ponto: a arquivada é a
-- mais copiada, porque é a que já deu certo uma vez.
--
-- `p_ec` é o cabeçalho da EC de DESTINO, montado pelo app (cliente, dados do
-- projeto, taxas): é o projeto de destino que manda no cabeçalho, não a origem.
-- A versão sai daqui, sob o mesmo advisory lock das demais funções — no
-- navegador ela era calculada a partir de uma lista carregada minutos antes, e
-- duas importações ao mesmo tempo nasciam com o mesmo número.
--
-- A cópia começa LIMPA do que era da vida da origem (o que estava emitido,
-- gasto e comentado lá não vale no destino). Para seguir com a mesma
-- negociação, preservando tudo, existe `nova_versao_ec`.
drop function if exists importar_ec(uuid, jsonb, boolean);
create or replace function importar_ec(p_origem uuid, p_ec jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ec ecs; v_orig ecs; v_id uuid; v_versao int;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;

  select * into v_orig from ecs where id = p_origem;
  if v_orig.id is null then raise exception 'EC de origem não encontrada'; end if;

  v_ec := jsonb_populate_record(null::ecs, p_ec);
  if v_ec.projeto_id is null then raise exception 'Projeto de destino não informado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_ec.projeto_id::text));
  select coalesce(max(versao), 0) + 1 into v_versao from ecs where projeto_id = v_ec.projeto_id;

  -- A cópia entra no ar; a que estava valendo aqui vai para o arquivo.
  update ecs set ativa = false, status = 'Arquivada', atualizado_em = now()
   where projeto_id = v_ec.projeto_id and ativa;

  insert into ecs (numero, projeto_id, template, cliente_id, cliente, cancelada_substituida, projeto, producao,
    responsavel, validade_dias, versao, ativa, status, criado_em, atualizado_em)
  values (regexp_replace(v_ec.numero, 'V[0-9]+$', 'V' || lpad(v_versao::text, 2, '0')), v_ec.projeto_id,
    v_ec.template, v_ec.cliente_id, v_ec.cliente, false, v_ec.projeto, v_ec.producao,
    v_ec.responsavel, v_ec.validade_dias, v_versao, true, 'Ativa', now(), now())
  returning id into v_id;

  insert into ec_linhas (ec_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem)
  select v_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, 0,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato, 'Pendente', 'Pendente',
    fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, 'Pendente', '', '[]'::jsonb,
    oculto, ordem
  from ec_linhas where ec_id = p_origem;

  return v_id;
end; $$;

comment on function importar_ec(uuid, jsonb) is
  'Copia uma EC (no ar ou arquivada, deste projeto ou de outro) para um projeto e a põe NO AR ali, arquivando a que estava valendo. A cópia é feita dentro do banco para os valores não passarem pela máscara de ec_linhas_visiveis.';

revoke all on function importar_ec(uuid, jsonb) from public, anon;
grant execute on function importar_ec(uuid, jsonb) to authenticated;

-- 5) --------------------------------------- nova versão: o mesmo vocabulário
-- Só muda a palavra gravada: a nova nasce no ar ('Ativa'), a anterior vai para
-- o arquivo. O resto da função é o de 28/08/2026 (a cópia coluna a coluna).
create or replace function nova_versao_ec(p_ec_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_orig ecs; v_id uuid; v_versao int;
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
  insert into ec_linhas (ec_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem)
  select v_id, grupo, item, descricao, descricao_completa, valor_polobh, valor_cliente, valor_gasto,
    valor_com_bv_nf, valor_sem_bv_com_nf, valor_sem_bv_sem_nf, valores_nao_aplicaveis, opcao_valor, bv,
    contrato, contrato_status, status_aprovacao, fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf,
    codigo_servico, pedido_compra, status_os, observacao, observacoes, oculto, ordem
  from ec_linhas where ec_id = p_ec_id;
  return v_id;
end; $$;

revoke all on function nova_versao_ec(uuid) from public, anon;
grant execute on function nova_versao_ec(uuid) to authenticated;

-- 6) ------------------------------------------------- e a coluna não desanda
-- Toda gravação passa por uma das funções acima, e todas derivam o status da
-- bandeira. A trava existe para o caso que não se prevê: um UPDATE solto no
-- painel do banco reintroduzindo um selo do fluxo antigo.
alter table ecs add constraint ecs_status_check check (status in ('Ativa', 'Arquivada'));

comment on column ecs.status is
  'Acompanha a bandeira `ativa`: Ativa (a estimativa que vale no projeto) ou Arquivada. Derivado — nunca escrito pelo app. Ver src/domain/ec.ts.';
