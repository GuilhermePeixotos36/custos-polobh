-- ============================================================================
-- Cadastros: inativar, excluir e unificar                        (27/11/2026)
--
-- Fornecedores e clientes ganharam tela própria (Cadastros) e, com ela, a
-- limpeza do que já existe: registros duplicados e registros que não se usam
-- mais.
--
--   INATIVAR — o registro fica no cadastro e some das sugestões de
--     preenchimento. É o caminho para quem deixou de ser fornecedor/cliente e
--     tem histórico: nada do que já foi feito muda.
--
--   EXCLUIR — apaga o registro. Projetos, ECs e OS não apontam para o cadastro:
--     cada um guarda uma CÓPIA dos dados, e a ligação é pelo CNPJ/CPF. Por isso,
--     ao excluir um registro EM USO, quem exclui escolhe o registro que fica
--     (UNIFICAR), e as cópias dos documentos ATIVOS passam a ser as dele. O que
--     já foi emitido ou arquivado é histórico e fica como saiu.
--
-- As duas funções são `security definer`: quem cuida do cadastro (permissão
-- `fornecedores.editar`) nem sempre pode editar EC e OS, e a unificação precisa
-- chegar a elas. A permissão é conferida dentro de cada função.
-- ============================================================================

alter table public.fornecedores add column if not exists ativo boolean not null default true;
alter table public.clientes     add column if not exists ativo boolean not null default true;

comment on column public.fornecedores.ativo is 'false = inativo: fica no cadastro, some das sugestões de preenchimento.';
comment on column public.clientes.ativo     is 'false = inativo: fica no cadastro, some das sugestões de preenchimento.';

-- Só os dígitos de um documento.
create or replace function private.so_digitos(v text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(v, ''), '\D', '', 'g');
$$;

-- ----------------------------------------------------------------------------
-- Onde o registro é usado — o que a tela mostra antes de excluir.
-- `ativos` é o que a unificação atualiza; `total` inclui o histórico.
-- ----------------------------------------------------------------------------
create or replace function public.uso_do_cadastro(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_doc text;
  r jsonb;
begin
  if papel_atual() is null then
    raise exception 'Sem permissao para consultar o cadastro';
  end if;

  if p_tipo = 'fornecedor' then
    select private.so_digitos(cnpj) into v_doc from fornecedores where id = p_id;
    select jsonb_build_object(
      'itensEc',      (select count(*) from ec_linhas l where v_doc <> '' and private.so_digitos(l.fornecedor_cnpj) = v_doc),
      'itensEcAtivos',(select count(*) from ec_linhas l join ecs e on e.id = l.ec_id
                        where e.ativa and v_doc <> '' and private.so_digitos(l.fornecedor_cnpj) = v_doc),
      'oss',          (select count(*) from oss o
                        where o.fornecedor->>'id' = p_id::text or (v_doc <> '' and private.so_digitos(o.fornecedor->>'cnpj') = v_doc)),
      'ossAtivas',    (select count(*) from oss o
                        where o.status = 'Ativa'
                          and (o.fornecedor->>'id' = p_id::text or (v_doc <> '' and private.so_digitos(o.fornecedor->>'cnpj') = v_doc)))
    ) into r;
  elsif p_tipo = 'cliente' then
    select jsonb_build_object(
      'projetos',      (select count(*) from projetos p where p.cliente->>'id' = p_id::text),
      'projetosAtivos',(select count(*) from projetos p where p.cliente->>'id' = p_id::text and p.status = 'Ativo'),
      'ecs',           (select count(*) from ecs e where e.cliente_id = p_id or e.cliente->>'id' = p_id::text),
      'ecsAtivas',     (select count(*) from ecs e where e.ativa and (e.cliente_id = p_id or e.cliente->>'id' = p_id::text)),
      'oss',           (select count(*) from oss o where o.cliente->>'id' = p_id::text),
      'ossAtivas',     (select count(*) from oss o where o.status = 'Ativa' and o.cliente->>'id' = p_id::text)
    ) into r;
  else
    raise exception 'Tipo de cadastro desconhecido: %', p_tipo;
  end if;
  return r;
end;
$$;

-- ----------------------------------------------------------------------------
-- Excluir (e, havendo `p_destino`, unificar antes).
-- ----------------------------------------------------------------------------
create or replace function public.excluir_cadastro(p_tipo text, p_id uuid, p_destino uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uso jsonb;
  v_em_uso boolean;
  v_doc text;
  f fornecedores%rowtype;
  d fornecedores%rowtype;
  c clientes%rowtype;
  v_cliente jsonb;
  v_seg_velho text;
  v_seg_novo text;
  n_itens int := 0;
  n_oss int := 0;
  n_ecs int := 0;
  n_projetos int := 0;
begin
  if not tem_permissao('fornecedores', 'editar') then
    raise exception 'Sem permissao para excluir do cadastro';
  end if;
  if p_destino is not null and p_destino = p_id then
    raise exception 'O registro que fica precisa ser outro';
  end if;

  v_uso := uso_do_cadastro(p_tipo, p_id);

  if p_tipo = 'fornecedor' then
    select * into f from fornecedores where id = p_id;
    if not found then raise exception 'Fornecedor nao encontrado'; end if;
    v_em_uso := (v_uso->>'itensEc')::int + (v_uso->>'oss')::int > 0;
    if v_em_uso and p_destino is null then
      raise exception 'Este fornecedor esta em uso: escolha o registro que fica no lugar dele, ou inative-o';
    end if;

    if p_destino is not null then
      select * into d from fornecedores where id = p_destino;
      if not found then raise exception 'O registro que fica nao foi encontrado'; end if;
      v_doc := private.so_digitos(f.cnpj);

      -- Itens das ECs ATIVAS: documento e nome do que fica.
      update ec_linhas l
         set fornecedor_cnpj  = d.cnpj,
             fornecedor_razao = coalesce(nullif(btrim(d.nome_fantasia), ''), d.razao_social)
        from ecs e
       where e.id = l.ec_id and e.ativa
         and v_doc <> '' and private.so_digitos(l.fornecedor_cnpj) = v_doc;
      get diagnostics n_itens = row_count;

      -- OS ATIVAS: a identificação passa a ser a do que fica (dados bancários e
      -- contatos digitados na OS não mudam), e o nome da OS acompanha.
      v_seg_velho := concat_ws(' – ', nullif(btrim(f.nome_fantasia), ''),
                       case when btrim(coalesce(f.razao_social, '')) <> '' then '(' || btrim(f.razao_social) || ')' end);
      v_seg_novo  := concat_ws(' – ', nullif(btrim(d.nome_fantasia), ''),
                       case when btrim(coalesce(d.razao_social, '')) <> '' then '(' || btrim(d.razao_social) || ')' end);
      update oss o
         set fornecedor = o.fornecedor || jsonb_build_object(
               'id', d.id,
               'razaoSocial', d.razao_social,
               'nomeFantasia', coalesce(d.nome_fantasia, ''),
               'cnpj', d.cnpj,
               'perfilTributario', coalesce(d.perfil_tributario, ''),
               'endereco', coalesce(d.endereco, ''),
               'inscricaoEstadual', coalesce(d.inscricao_estadual, ''),
               'inscricaoMunicipal', coalesce(d.inscricao_municipal, ''),
               'cnaes', coalesce(to_jsonb(d.cnaes), '[]'::jsonb)),
             numero = case when v_seg_velho <> '' and v_seg_novo <> '' then replace(o.numero, v_seg_velho, v_seg_novo) else o.numero end
       where o.status = 'Ativa'
         and (o.fornecedor->>'id' = p_id::text or (v_doc <> '' and private.so_digitos(o.fornecedor->>'cnpj') = v_doc));
      get diagnostics n_oss = row_count;
    end if;

    delete from fornecedores where id = p_id;

  elsif p_tipo = 'cliente' then
    select * into c from clientes where id = p_id;
    if not found then raise exception 'Cliente nao encontrado'; end if;
    v_em_uso := (v_uso->>'projetos')::int + (v_uso->>'ecs')::int + (v_uso->>'oss')::int > 0;
    if v_em_uso and p_destino is null then
      raise exception 'Este cliente esta em uso: escolha o registro que fica no lugar dele, ou inative-o';
    end if;

    if p_destino is not null then
      select * into c from clientes where id = p_destino;
      if not found then raise exception 'O registro que fica nao foi encontrado'; end if;
      v_cliente := jsonb_build_object(
        'id', c.id, 'apelido', coalesce(c.apelido, ''), 'nome', coalesce(c.nome, ''),
        'razaoSocial', coalesce(c.razao_social, ''), 'endereco', coalesce(c.endereco, ''),
        'cnpjCpf', coalesce(c.cnpj_cpf, ''),
        'inscricaoEstadual', coalesce(c.inscricao_estadual, ''),
        'inscricaoMunicipal', coalesce(c.inscricao_municipal, ''),
        'representante', coalesce(c.representante, '{}'::jsonb));

      -- Projetos ATIVOS, ECs ATIVAS e OS ATIVAS passam a mostrar o cliente que fica.
      update projetos set cliente = v_cliente where cliente->>'id' = p_id::text and status = 'Ativo';
      get diagnostics n_projetos = row_count;
      update ecs set cliente = v_cliente where ativa and (cliente_id = p_id or cliente->>'id' = p_id::text);
      get diagnostics n_ecs = row_count;
      update oss set cliente = v_cliente where status = 'Ativa' and cliente->>'id' = p_id::text;
      get diagnostics n_oss = row_count;
      -- O vínculo de TODAS as ECs (inclusive as arquivadas) precisa sair do
      -- registro que vai ser apagado; a cópia delas fica como estava.
      update ecs set cliente_id = p_destino where cliente_id = p_id;
    end if;

    delete from clientes where id = p_id;
  else
    raise exception 'Tipo de cadastro desconhecido: %', p_tipo;
  end if;

  return jsonb_build_object('itensEc', n_itens, 'oss', n_oss, 'ecs', n_ecs, 'projetos', n_projetos);
end;
$$;

revoke all on function private.so_digitos(text) from public;
revoke all on function public.uso_do_cadastro(text, uuid) from public, anon;
revoke all on function public.excluir_cadastro(text, uuid, uuid) from public, anon;
grant execute on function public.uso_do_cadastro(text, uuid) to authenticated;
grant execute on function public.excluir_cadastro(text, uuid, uuid) to authenticated;
