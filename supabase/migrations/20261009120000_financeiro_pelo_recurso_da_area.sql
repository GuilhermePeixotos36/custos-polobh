-- O financeiro passa a valer pelo RECURSO DA ÁREA, não só pelo papel (09/10/2026).
--
-- Back-office e Coordenação Produção têm o recurso `financeiro` na área, mas o
-- papel-base delas é 'Producao'. O banco decidia "quem vê/grava valores" só pelo
-- papel — então:
--   · a view `ec_linhas_visiveis` devolvia NULL nos valores para elas;
--   · `salvar_ec_completa` ignorava os valores que elas digitavam (a EC salva
--     voltava zerada);
--   · `os_financeiro` recusava a gravação (erro ao emitir a OS).
-- A tela já liberava o financeiro por área; o banco agora concorda com ela.
create or replace function public.ve_financeiro()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(papel_atual() in ('Admin', 'Direcao', 'Administrativo'), false)
      or tem_recurso('financeiro')
$$;

grant execute on function public.ve_financeiro() to authenticated;

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
    pedido_compra, status_os, observacao, observacoes, oculto, ordem
   from ec_linhas l
  where papel_atual() is not null;

drop policy if exists os_fin_read on public.os_financeiro;
drop policy if exists os_fin_write on public.os_financeiro;
create policy os_fin_read on public.os_financeiro for select using (ve_financeiro());
create policy os_fin_write on public.os_financeiro for all
  using (ve_financeiro()) with check (ve_financeiro());

-- salvar_ec_completa: a mesma regra, trocando só a linha que decidia pelo papel.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.salvar_ec_completa(uuid,jsonb,jsonb,timestamptz)'::regprocedure);
  d := replace(d, E'v_ve_financeiro := papel_atual() in (\'Admin\',\'Direcao\',\'Administrativo\');', 'v_ve_financeiro := ve_financeiro();');
  if d !~ 've_financeiro\(\)' then raise exception 'substituicao nao aplicada'; end if;
  execute d;
end $$;
