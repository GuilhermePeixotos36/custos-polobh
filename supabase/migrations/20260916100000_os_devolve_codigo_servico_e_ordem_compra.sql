-- ============================================================================
-- Código de Serviço e Ordem de Compra nascem na OS e voltam para a EC
--                                                            (15/09/2026)
--
-- O check-list da Pólobh desfez um nó que travava o sistema inteiro. Documento
-- PG, Código de Serviço e Pedido de Compra eram DIGITADOS NA EC e, ao mesmo
-- tempo, exigidos para que a OS pudesse ser emitida — só que quem os conhece é
-- quem emite o faturamento, ou seja, a própria OS. Na prática: item aprovado,
-- fornecedor identificado, e a emissão barrada esperando por um dado que só
-- existiria depois dela. Era a queixa "não estou conseguindo emitir OS's".
--
-- Agora eles são LEITURA na EC e decisão da OS. Esta função é o caminho de
-- volta: quando a OS grava o faturamento, os itens da EC que ela consolida
-- recebem o código de serviço e a ordem de compra.
--
-- Por que uma função, e não um UPDATE da tela:
--
--  · quem preenche o faturamento é o Administrativo, que NÃO edita EC
--    (`ec_linhas_write` pede o papel de quem mexe em estimativa). Pela tela, o
--    UPDATE seria recusado pela RLS — e a EC ficaria para sempre com os campos
--    vazios que ela agora só sabe ler;
--  · `security definer` deixa a função escrever essas DUAS colunas, e só elas.
--    Ninguém ganha permissão de editar EC: ganha a permissão de devolver à EC
--    o que a OS acabou de decidir.
--
-- A função é idempotente e escreve apenas onde há o que escrever: valor vazio
-- não apaga o que já estava lá (uma OS reemitida sem faturamento preenchido não
-- pode zerar o código de serviço que a anterior já tinha devolvido).
-- ============================================================================

create or replace function devolver_dados_fiscais_para_ec(
  p_os_id uuid,
  p_codigo_servico text default null,
  p_ordem_compra text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ec_id uuid;
  v_linhas uuid[];
  v_afetadas integer := 0;
begin
  -- Quem não enxerga a OS não devolve nada: a leitura passa pela RLS normal.
  select ec_id into v_ec_id from oss where id = p_os_id;
  if v_ec_id is null then
    raise exception 'OS não encontrada ou sem acesso: %', p_os_id;
  end if;

  select array_agg(ec_linha_id) into v_linhas
  from os_linhas where os_id = p_os_id and ec_linha_id is not null;

  if v_linhas is null or array_length(v_linhas, 1) is null then
    return 0;
  end if;

  update ec_linhas
     set codigo_servico = coalesce(nullif(trim(coalesce(p_codigo_servico, '')), ''), codigo_servico),
         pedido_compra  = coalesce(nullif(trim(coalesce(p_ordem_compra, '')), ''), pedido_compra)
   where id = any(v_linhas)
     and ec_id = v_ec_id
     -- Nada a fazer quando os dois já estão como a OS diz: evita marcar a EC
     -- como alterada a cada salvamento de OS.
     and (
       coalesce(codigo_servico, '') is distinct from coalesce(nullif(trim(coalesce(p_codigo_servico, '')), ''), coalesce(codigo_servico, ''))
       or coalesce(pedido_compra, '') is distinct from coalesce(nullif(trim(coalesce(p_ordem_compra, '')), ''), coalesce(pedido_compra, ''))
     );

  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end;
$$;

-- `from public, anon`, e não só `from public`: o schema `public` do Supabase
-- concede EXECUTE a `anon` por DEFAULT PRIVILEGES em toda função nova, e essa
-- concessão é do papel — o revoke no pseudo-papel PUBLIC não a alcança. Numa
-- função `security definer`, que passa por cima da RLS, isso é a diferença
-- entre uma RPC interna e um endpoint aberto em /rest/v1/rpc.
revoke all on function devolver_dados_fiscais_para_ec(uuid, text, text) from public, anon;
grant execute on function devolver_dados_fiscais_para_ec(uuid, text, text) to authenticated;

comment on function devolver_dados_fiscais_para_ec(uuid, text, text) is
  'Devolve à EC o Código de Serviço e a Ordem de Compra decididos na OS. Escreve apenas essas duas colunas, apenas nos itens que a OS consolida.';
