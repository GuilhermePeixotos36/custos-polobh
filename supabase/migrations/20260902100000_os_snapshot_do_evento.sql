-- ============================================================================
-- A OS emitida vira um documento imutavel.
--
-- Ate aqui a OS lia os dados gerais do evento (bloco "Dados do Projeto" e
-- "Dados do Cliente") direto da EC. Editar o projeto ou a EC reescrevia, em
-- silencio, um papel que ja estava na mao do fornecedor.
--
-- Agora cada OS guarda a sua propria foto desses dados na emissao. Mudou o
-- evento? Gera-se uma NOVA VERSAO da OS; a anterior continua contando a
-- historia que contava.
-- ============================================================================

alter table oss add column if not exists projeto jsonb;
alter table oss add column if not exists cliente jsonb;

comment on column oss.projeto is
  'Dados gerais do evento como estavam na emissao desta OS. Congelado: so uma nova versao da OS o substitui.';
comment on column oss.cliente is
  'Bloco "Dados do Cliente" da OS, congelado na emissao pelo mesmo motivo de oss.projeto.';

-- Backfill: as OSs que ja existem passam a valer pelo que a EC diz HOJE, que e
-- exatamente o que elas imprimiam ate agora. Dai em diante ficam congeladas.
update oss o
   set projeto = e.projeto,
       cliente = e.cliente
  from ecs e
 where o.ec_id = e.id
   and o.projeto is null;

-- ----------------------------------------------------------------------------
-- Nova versao de uma OS.
--
-- Copia a OS inteira para uma linha nova (com o snapshot do evento atualizado),
-- arrasta os vinculos com as linhas da EC e o financeiro, e cancela a anterior.
--
-- E `security definer` por causa de os_financeiro: a tabela e restrita a
-- Admin/Direcao/Administrativo, entao a Producao — que pode emitir OS — nao
-- consegue copiar o financeiro pelo cliente sem apagar o que nao ve. Aqui a
-- copia acontece dentro do servidor, sem o financeiro passar pela tela de
-- quem nao tem acesso a ele.
-- ----------------------------------------------------------------------------
create or replace function gerar_nova_versao_os(
  p_os_id uuid,
  p_numero text,
  p_projeto jsonb,
  p_cliente jsonb
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
    contrato, bv, observacoes_gerais, observacoes, status
  )
  select
    p_numero,
    o.ec_id,
    coalesce((select max(seq) from oss where ec_id = o.ec_id), 0) + 1,
    o.fornecedor,
    coalesce(p_projeto, o.projeto),
    coalesce(p_cliente, o.cliente),
    o.modalidade, o.descritivo, o.entrega, o.detalhamento, o.cronograma, o.logistica,
    o.infraestrutura,
    -- Credenciamento comeca limpo: o link e o prazo pertencem a OS anterior, e
    -- o token da nova sai do default da coluna.
    '{"prazoLimite":"","linkFormulario":""}'::jsonb,
    o.orcamento, o.contrato, o.bv, o.observacoes_gerais, o.observacoes,
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

revoke all on function gerar_nova_versao_os(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function gerar_nova_versao_os(uuid, text, jsonb, jsonb) to authenticated;
