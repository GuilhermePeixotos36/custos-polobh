-- ============================================================================
-- Nomes de cliente em CAIXA ALTA (apontado pela Marisa na tela de Projetos).
--
-- Causa: `consultarCnpj` devolvia o payload da BrasilAPI cru, e a API entrega
-- tudo em maiúsculas. Como esses campos entram no formulário por código (e não
-- por digitação), escapavam do formatador de blur do <Input formato="titulo">.
-- A correção de origem está em src/lib/cnpj.ts; aqui ficam os registros que já
-- tinham sido gravados antes dela.
--
-- Os valores abaixo são exatamente o que `tituloProprio()` produz — foram
-- calculados rodando a própria função do app, não escritos à mão. O endereço é
-- a única exceção: UF e "CEP:" precisam continuar em maiúsculas, o que a versão
-- nova de `montarEndereco` já garante daqui para a frente.
-- ============================================================================

-- Apelido do cliente (tituloProprio)
create or replace function _fix_nome_cliente(v text) returns text
language sql immutable as $$
  select case v
    when 'BANCO MERCANTIL'        then 'Banco Mercantil'
    when 'CONSTRUTORA PATRIMÔNIO' then 'Construtora Patrimônio'
    when 'POLOBH PROMOCOES'       then 'Polobh Promocoes'
    else v end
$$;

-- Razão social (tituloProprio com preservarSiglas: LTDA, SA, S/A ficam maiúsculos)
create or replace function _fix_razao_cliente(v text) returns text
language sql immutable as $$
  select case v
    when 'BANCO MERCANTIL DO BRASIL SA'                  then 'Banco Mercantil do Brasil SA'
    when 'BANCO MERCANTIL DO BRASIL S/A'                 then 'Banco Mercantil do Brasil S/A'
    when 'PATRIMÔNIO CONSTRUÇÕES E EMPREENDIMENTOS LTDA' then 'Patrimônio Construções e Empreendimentos LTDA'
    when 'POLOBH PROMOCOES LTDA'                         then 'Polobh Promocoes LTDA'
    else v end
$$;

create or replace function _fix_end_cliente(v text) returns text
language sql immutable as $$
  select case v
    when 'DO CONTORNO, 5800 - ANDAR 11 12 13 14 E 15 - SAVASSI - BELO HORIZONTE - MG - CEP: 30110042'
      then 'Do Contorno, 5800 - Andar 11 12 13 14 e 15 - Savassi - Belo Horizonte - MG - CEP: 30110042'
    else v end
$$;

update clientes set
  nome         = _fix_nome_cliente(nome),
  razao_social = _fix_razao_cliente(razao_social),
  endereco     = _fix_end_cliente(endereco);

-- Snapshot do cliente dentro do projeto.
update projetos set cliente = cliente || jsonb_build_object(
  'nome',        _fix_nome_cliente(cliente->>'nome'),
  'razaoSocial', _fix_razao_cliente(cliente->>'razaoSocial'),
  'endereco',    _fix_end_cliente(cliente->>'endereco')
) where cliente is not null;

-- Snapshot do cliente dentro da EC (precisa acompanhar, senão a EC mostraria
-- um nome diferente do projeto).
update ecs set cliente = cliente || jsonb_build_object(
  'nome',        _fix_nome_cliente(cliente->>'nome'),
  'razaoSocial', _fix_razao_cliente(cliente->>'razaoSocial'),
  'endereco',    _fix_end_cliente(cliente->>'endereco')
) where cliente is not null;

drop function _fix_nome_cliente(text);
drop function _fix_razao_cliente(text);
drop function _fix_end_cliente(text);
