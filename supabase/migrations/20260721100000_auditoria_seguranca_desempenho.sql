-- Correções da auditoria de 21/07/2026. Aplicar pelo Supabase CLI antes do novo frontend.

-- Todos os usuários autenticados precisam dos nomes/papéis para atribuição de observações.
drop policy if exists perfis_self_read on perfis;
create policy perfis_self_read on perfis for select using (papel_atual() is not null);

alter table empresas_grupo add column if not exists ordem int default 0;
drop policy if exists empresas_grupo_write on empresas_grupo;
create policy empresas_grupo_write on empresas_grupo for all
  using (papel_atual() in ('Admin','Direcao','Administrativo'))
  with check (papel_atual() in ('Admin','Direcao','Administrativo'));

-- Apenas uma EC ativa por projeto, inclusive sob concorrência.
with duplicadas as (
  select id, row_number() over (partition by projeto_id order by atualizado_em desc nulls last, criado_em desc, id) pos
  from ecs where ativa and projeto_id is not null
)
update ecs set ativa=false where id in (select id from duplicadas where pos>1);
create unique index if not exists ecs_uma_ativa_por_projeto_idx on ecs(projeto_id) where ativa and projeto_id is not null;

-- Reserva idempotente dos lembretes de cronograma.
alter table emails add column if not exists referencia_id text;
alter table emails add column if not exists data_referencia date;
create unique index if not exists emails_lembrete_unico_idx on emails(tipo, referencia_id, data_referencia)
  where tipo='lembrete_cronograma';

-- A funcionalidade de anexos foi removida do produto.
drop policy if exists projeto_anexos_obj_read on storage.objects;
drop policy if exists projeto_anexos_obj_write on storage.objects;
-- O bucket `projeto-anexos` e seus objetos devem ser removidos pelo painel ou
-- pela Storage API. O Supabase bloqueia corretamente exclusões diretas nessas
-- tabelas para não deixar arquivos órfãos no armazenamento físico.
drop table if exists projeto_anexos cascade;

create or replace function salvar_ec_completa(p_ec_id uuid, p_ec jsonb, p_linhas jsonb)
returns uuid language plpgsql set search_path=public as $$
declare v_ec ecs; v_id uuid; v_ids uuid[]; v_linhas jsonb;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  v_ec:=jsonb_populate_record(null::ecs,p_ec);
  if v_ec.projeto_id is not null then perform pg_advisory_xact_lock(hashtext(v_ec.projeto_id::text)); end if;
  if coalesce(v_ec.ativa,false) and v_ec.projeto_id is not null then
    update ecs set ativa=false where projeto_id=v_ec.projeto_id and (p_ec_id is null or id<>p_ec_id);
  end if;
  if p_ec_id is null then
    insert into ecs(numero,projeto_id,template,cliente_id,cliente,cancelada_substituida,projeto,producao,responsavel,
      validade_dias,versao,ativa,status,criado_em,atualizado_em)
    values(v_ec.numero,v_ec.projeto_id,v_ec.template,v_ec.cliente_id,v_ec.cliente,v_ec.cancelada_substituida,
      v_ec.projeto,v_ec.producao,v_ec.responsavel,v_ec.validade_dias,v_ec.versao,v_ec.ativa,v_ec.status,
      coalesce(v_ec.criado_em,now()),coalesce(v_ec.atualizado_em,now())) returning id into v_id;
  else
    update ecs set numero=v_ec.numero,projeto_id=v_ec.projeto_id,template=v_ec.template,cliente_id=v_ec.cliente_id,
      cliente=v_ec.cliente,cancelada_substituida=v_ec.cancelada_substituida,projeto=v_ec.projeto,producao=v_ec.producao,
      responsavel=v_ec.responsavel,validade_dias=v_ec.validade_dias,versao=v_ec.versao,ativa=v_ec.ativa,
      status=v_ec.status,atualizado_em=coalesce(v_ec.atualizado_em,now()) where id=p_ec_id returning id into v_id;
    if v_id is null then raise exception 'EC não encontrada'; end if;
  end if;
  select coalesce(jsonb_agg(x||jsonb_build_object('ec_id',v_id)),'[]'::jsonb),
    coalesce(array_agg((x->>'id')::uuid),'{}') into v_linhas,v_ids from jsonb_array_elements(p_linhas)x;
  if exists(select 1 from ec_linhas where id=any(v_ids) and ec_id<>v_id) then raise exception 'Linha pertence a outra EC'; end if;
  delete from ec_linhas where ec_id=v_id and not(id=any(v_ids));
  insert into ec_linhas select * from jsonb_populate_recordset(null::ec_linhas,v_linhas)
  on conflict(id) do update set ec_id=excluded.ec_id,grupo=excluded.grupo,item=excluded.item,descricao=excluded.descricao,
    descricao_completa=excluded.descricao_completa,valor_polobh=excluded.valor_polobh,valor_cliente=excluded.valor_cliente,
    valor_gasto=excluded.valor_gasto,contrato=excluded.contrato,contrato_status=excluded.contrato_status,
    status_aprovacao=excluded.status_aprovacao,fornecedor_razao=excluded.fornecedor_razao,
    fornecedor_cnpj=excluded.fornecedor_cnpj,fornecedor_contato=excluded.fornecedor_contato,fatura_nf=excluded.fatura_nf,
    codigo_servico=excluded.codigo_servico,pedido_compra=excluded.pedido_compra,status_os=excluded.status_os,
    observacao=excluded.observacao,observacoes=excluded.observacoes,oculto=excluded.oculto,ordem=excluded.ordem;
  return v_id;
end; $$;
revoke all on function salvar_ec_completa(uuid,jsonb,jsonb) from public,anon;
grant execute on function salvar_ec_completa(uuid,jsonb,jsonb) to authenticated;

create or replace function definir_ec_ativa(p_ec_id uuid) returns void language plpgsql set search_path=public as $$
declare v_projeto uuid;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  select projeto_id into v_projeto from ecs where id=p_ec_id;
  if v_projeto is null then raise exception 'EC/projeto não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_projeto::text));
  update ecs set ativa=false where projeto_id=v_projeto and id<>p_ec_id;
  update ecs set ativa=true,status=case when status in('Arquivada','Cancelada') then 'Rascunho' else status end where id=p_ec_id;
end; $$;
revoke all on function definir_ec_ativa(uuid) from public,anon;
grant execute on function definir_ec_ativa(uuid) to authenticated;

create or replace function nova_versao_ec(p_ec_id uuid) returns uuid language plpgsql set search_path=public as $$
declare v_orig ecs; v_id uuid; v_versao int;
begin
  if papel_atual() not in ('Admin','Direcao','Producao') then raise exception 'Sem permissão'; end if;
  select * into v_orig from ecs where id=p_ec_id for update;
  if v_orig.id is null or v_orig.projeto_id is null then raise exception 'EC/projeto não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext(v_orig.projeto_id::text));
  select coalesce(max(versao),0)+1 into v_versao from ecs where projeto_id=v_orig.projeto_id;
  update ecs set ativa=false where projeto_id=v_orig.projeto_id;
  update ecs set cancelada_substituida=true,status='Arquivada',atualizado_em=now() where id=p_ec_id;
  insert into ecs(numero,projeto_id,template,cliente_id,cliente,cancelada_substituida,projeto,producao,responsavel,
    validade_dias,versao,ativa,status,criado_em,atualizado_em)
  values(regexp_replace(v_orig.numero,'V[0-9]+$','V'||lpad(v_versao::text,2,'0')),v_orig.projeto_id,v_orig.template,
    v_orig.cliente_id,v_orig.cliente,true,v_orig.projeto,v_orig.producao,v_orig.responsavel,v_orig.validade_dias,
    v_versao,true,'Rascunho',now(),now()) returning id into v_id;
  insert into ec_linhas(ec_id,grupo,item,descricao,descricao_completa,valor_polobh,valor_cliente,valor_gasto,contrato,
    contrato_status,status_aprovacao,fornecedor_razao,fornecedor_cnpj,fornecedor_contato,fatura_nf,codigo_servico,
    pedido_compra,status_os,observacao,observacoes,oculto,ordem)
  select v_id,grupo,item,descricao,descricao_completa,valor_polobh,valor_cliente,valor_gasto,contrato,contrato_status,
    status_aprovacao,fornecedor_razao,fornecedor_cnpj,fornecedor_contato,fatura_nf,codigo_servico,pedido_compra,
    status_os,observacao,observacoes,oculto,ordem from ec_linhas where ec_id=p_ec_id;
  return v_id;
end; $$;
revoke all on function nova_versao_ec(uuid) from public,anon;
grant execute on function nova_versao_ec(uuid) to authenticated;
