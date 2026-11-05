-- DESEMPENHO (05/11/2026): a permissão é calculada UMA vez por consulta.
--
-- `papel_atual()`, `ve_financeiro()` e `tem_recurso()` são SECURITY DEFINER e,
-- por isso, o Postgres não consegue reaproveitar o resultado: dentro de uma
-- regra de acesso (RLS) ou de um CASE na view, cada chamada rodava de novo para
-- CADA linha. A view `ec_linhas_visiveis` chamava `ve_financeiro()` sete vezes
-- por linha — ler todas as ECs custava ~120 ms só nisso.
--
-- Com `(select função())` o Postgres calcula uma vez e reaproveita (InitPlan).
-- As regras continuam exatamente as mesmas; só deixam de ser recalculadas.
-- Medido: a mesma leitura caiu de ~119 ms para ~3 ms.

create or replace view public.ec_linhas_visiveis as
 SELECT id,
    ec_id,
    grupo,
    item,
    descricao,
    descricao_completa,
    CASE WHEN (select ve_financeiro()) THEN valor_polobh ELSE NULL::numeric END AS valor_polobh,
    CASE WHEN (select ve_financeiro()) THEN valor_cliente ELSE NULL::numeric END AS valor_cliente,
    CASE WHEN (select ve_financeiro()) THEN valor_gasto ELSE NULL::numeric END AS valor_gasto,
    CASE WHEN (select ve_financeiro()) THEN valor_com_bv_nf ELSE NULL::numeric END AS valor_com_bv_nf,
    CASE WHEN (select ve_financeiro()) THEN valor_sem_bv_com_nf ELSE NULL::numeric END AS valor_sem_bv_com_nf,
    CASE WHEN (select ve_financeiro()) THEN valor_sem_bv_sem_nf ELSE NULL::numeric END AS valor_sem_bv_sem_nf,
    CASE WHEN (select ve_financeiro()) THEN bv ELSE NULL::jsonb END AS bv,
    valores_nao_aplicaveis,
    opcao_valor,
    contrato,
    contrato_status,
    status_aprovacao,
    fornecedor_razao,
    fornecedor_cnpj,
    fornecedor_contato,
    fatura_nf,
    codigo_servico,
    pedido_compra,
    status_os,
    observacao,
    observacoes,
    oculto,
    ordem,
    divisao
   FROM ec_linhas l
  WHERE ((select papel_atual()) IS NOT NULL);

alter policy areas_read on public.areas using (((select papel_atual()) IS NOT NULL));
alter policy areas_write on public.areas using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Administrativo'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Administrativo'::text])));
alter policy audit_insert on public.audit_log with check (((user_id = (select auth.uid())) AND (select perfil_ativo())));
alter policy audit_read on public.audit_log using (((select papel_atual()) = 'Admin'::text));
alter policy backups_read on public.backups using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Administrativo'::text])));
alter policy chamados_insert on public.chamados with check (((aberto_por = (select auth.uid())) AND (select perfil_ativo())));
alter policy chamados_read on public.chamados using ((((aberto_por = (select auth.uid())) AND (select perfil_ativo())) OR (select e_suporte())));
alter policy chamados_update on public.chamados using ((select e_suporte())) with check ((select e_suporte()));
alter policy checklist_itens_delete_restrito on public.checklist_itens using ((select tem_recurso('checklists.excluir'::text)));
alter policy checklist_itens_read on public.checklist_itens using (((select papel_atual()) IS NOT NULL));
alter policy checklist_itens_write on public.checklist_itens using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text])));
alter policy checklist_modelos_read on public.checklist_modelos using (((select papel_atual()) IS NOT NULL));
alter policy checklist_modelos_write on public.checklist_modelos using ((select tem_recurso('checklists.padrao'::text))) with check ((select tem_recurso('checklists.padrao'::text)));
alter policy checklists_delete_restrito on public.checklists using ((select tem_recurso('checklists.excluir'::text)));
alter policy checklists_read on public.checklists using (((select papel_atual()) IS NOT NULL));
alter policy checklists_write on public.checklists using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text])));
alter policy clientes_read on public.clientes using (((select papel_atual()) IS NOT NULL));
alter policy clientes_write on public.clientes using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text])));
alter policy config_app_feriados_write on public.config_app using (((chave = ANY (ARRAY['feriados'::text, 'feriados_responsavel'::text])) AND ((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Administrativo'::text])))) with check (((chave = ANY (ARRAY['feriados'::text, 'feriados_responsavel'::text])) AND ((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Administrativo'::text]))));
alter policy config_app_read on public.config_app using (((select papel_atual()) IS NOT NULL));
alter policy config_app_write on public.config_app using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text])));
alter policy cred_read on public.credenciamentos using (((select papel_atual()) IS NOT NULL));
alter policy ec_linhas_read on public.ec_linhas using (((select papel_atual()) IS NOT NULL));
alter policy ec_linhas_write on public.ec_linhas using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text])));
alter policy ecs_read on public.ecs using (((select papel_atual()) IS NOT NULL));
alter policy ecs_write on public.ecs using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text])));
alter policy edicoes_abertas_read on public.edicoes_abertas using (((select papel_atual()) IS NOT NULL));
alter policy emails_read on public.emails using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Administrativo'::text])));
alter policy empresas_grupo_read on public.empresas_grupo using (((select papel_atual()) IS NOT NULL));
alter policy empresas_grupo_write on public.empresas_grupo using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Administrativo'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Administrativo'::text])));
alter policy fornecedores_read on public.fornecedores using (((select papel_atual()) IS NOT NULL));
alter policy fornecedores_write on public.fornecedores using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text])));
alter policy os_fin_read on public.os_financeiro using ((select ve_financeiro()));
alter policy os_fin_write on public.os_financeiro using ((select ve_financeiro())) with check ((select ve_financeiro()));
alter policy os_linhas_read on public.os_linhas using (((select papel_atual()) IS NOT NULL));
alter policy os_linhas_write on public.os_linhas using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text])));
alter policy oss_read on public.oss using (((select papel_atual()) IS NOT NULL));
alter policy oss_write on public.oss using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text])));
alter policy perfis_read_autenticados on public.perfis using ((((select papel_atual()) IS NOT NULL) OR (id = (select auth.uid()))));
alter policy projetos_read on public.projetos using (((select papel_atual()) IS NOT NULL));
alter policy projetos_write on public.projetos using (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text]))) with check (((select papel_atual()) = ANY (ARRAY['Admin'::text, 'Direcao'::text, 'Producao'::text, 'Administrativo'::text])));
