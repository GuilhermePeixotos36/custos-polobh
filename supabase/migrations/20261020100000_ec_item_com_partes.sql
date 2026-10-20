-- ITEM COM PARTES (20/10/2026): um serviço da EC atendido por mais de um
-- fornecedor. Cada parte é uma linha (com seu fornecedor e sua OS); `divisao`
-- é a chave que as junta (ver `src/domain/divisaoEc.ts`).
alter table public.ec_linhas add column if not exists divisao text;

-- A view de leitura passa a expor a chave (coluna nova no fim, como o
-- CREATE OR REPLACE VIEW exige).
create or replace view public.ec_linhas_visiveis as
 select id, ec_id, grupo, item, descricao, descricao_completa,
    case when ve_financeiro() then valor_polobh else null::numeric end as valor_polobh,
    case when ve_financeiro() then valor_cliente else null::numeric end as valor_cliente,
    case when ve_financeiro() then valor_gasto else null::numeric end as valor_gasto,
    case when ve_financeiro() then valor_com_bv_nf else null::numeric end as valor_com_bv_nf,
    case when ve_financeiro() then valor_sem_bv_com_nf else null::numeric end as valor_sem_bv_com_nf,
    case when ve_financeiro() then valor_sem_bv_sem_nf else null::numeric end as valor_sem_bv_sem_nf,
    case when ve_financeiro() then bv else null::jsonb end as bv,
    valores_nao_aplicaveis, opcao_valor, contrato, contrato_status, status_aprovacao,
    fornecedor_razao, fornecedor_cnpj, fornecedor_contato, fatura_nf, codigo_servico,
    pedido_compra, status_os, observacao, observacoes, oculto, ordem, divisao
   from ec_linhas l
  where papel_atual() is not null;

-- Salvar a EC grava a chave; nova versão e importação a copiam (as linhas
-- ganham ids novos, e a chave em texto continua juntando as mesmas partes).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.salvar_ec_completa(uuid,jsonb,jsonb,timestamptz)'::regprocedure);
  if d !~ 'divisao=excluded.divisao' then
    d := replace(d, 'oculto=excluded.oculto, ordem=excluded.ordem;', 'oculto=excluded.oculto, ordem=excluded.ordem, divisao=excluded.divisao;');
    if d !~ 'divisao=excluded.divisao' then raise exception 'salvar_ec_completa: trecho não encontrado'; end if;
    execute d;
  end if;

  d := pg_get_functiondef('public.nova_versao_ec(uuid)'::regprocedure);
  if d !~ 'oculto, ordem, divisao' then
    d := replace(d, 'observacoes, oculto, ordem)', 'observacoes, oculto, ordem, divisao)');
    d := replace(d, 'observacoes, oculto, ordem' || chr(10) || '  from ec_linhas', 'observacoes, oculto, ordem, divisao' || chr(10) || '  from ec_linhas');
    if d !~ 'oculto, ordem, divisao\)' or d !~ 'ordem, divisao\s+from ec_linhas' then raise exception 'nova_versao_ec: trecho não encontrado'; end if;
    execute d;
  end if;

  d := pg_get_functiondef('public.importar_ec(uuid,jsonb)'::regprocedure);
  if d !~ 'oculto, ordem, divisao' then
    d := replace(d, 'observacoes, oculto, ordem)', 'observacoes, oculto, ordem, divisao)');
    d := replace(d, '    oculto, ordem' || chr(10) || '  from ec_linhas', '    oculto, ordem, divisao' || chr(10) || '  from ec_linhas');
    if d !~ 'oculto, ordem, divisao\)' or d !~ 'ordem, divisao\s+from ec_linhas' then raise exception 'importar_ec: trecho não encontrado'; end if;
    execute d;
  end if;
end $$;
