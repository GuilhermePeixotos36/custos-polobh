-- =====================================================================
-- ENSAIO da migration 20261124120000_logs_padrao.sql — NÃO GRAVA NADA (termina em rollback).
--
-- Esta pasta NÃO é de migrations: nada aqui é aplicado pelo `supabase db push`.
--
-- Como rodar (no dia do merge, antes de aplicar a migration de verdade):
--   1. Abra o SQL Editor do projeto (ou o MCP execute_sql) com ESTE arquivo inteiro.
--   2. No lugar do marcador "COLE AQUI A MIGRATION", cole o conteúdo inteiro de
--      supabase/migrations/20261124120000_logs_padrao.sql.
--   3. Rode tudo de uma vez. O `begin` do topo e o `rollback` do fim desfazem tudo, inclusive o
--      `cron.schedule` da migration.
-- Sem a migration colada as funções não existem, o primeiro select falha e a transação aborta —
-- também sem gravar nada.
--
-- O ator dos testes é o primeiro perfil ATIVO com papel Administrador (passa em pode_ver_logs e
-- em pode_auditar_trilha). Nenhum dado real é escrito em lugar nenhum: o rollback desfaz.
-- =====================================================================
begin;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- COLE AQUI A MIGRATION (supabase/migrations/20261124120000_logs_padrao.sql)
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- Ator: um Administrador ativo.
select set_config('request.jwt.claims', json_build_object(
  'sub', (select p.id::text from public.perfis p where p.papel = 'Admin' and p.ativo order by p.criado_em limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;

-- 7a. Chave proibida some do detalhe (inclusive por "contém" e as da Pólobh); a categoria do corpo
--     é ignorada; ação fora das seis é descartada; a tela perde a query; CPF na mensagem vira ***.
select public.registrar_log(jsonb_build_object(
  'categoria', 'atividade', 'nivel', 'erro', 'acao', 'erro_js', 'resultado', 'falha', 'tela', '/projetos?aba=x#y',
  'mensagem', 'teste' || chr(7) || ' 123.456.789-09',
  'detalhe', jsonb_build_object('senhaNova', 'x', 'cnpjFornecedor', '1', 'banco', 'x',
                                'aninhado', jsonb_build_object('CPF', '1', 'ok', 2))));
select public.registrar_log(jsonb_build_object('categoria', 'acesso', 'acao', 'usuario_criado'));
select public.registrar_log(jsonb_build_object('categoria', 'erro', 'acao', 'Ação Inválida'));
reset role;
select categoria, acao, tela, nivel, resultado, origem, detalhe, mensagem
  from public.log_evento order by id desc limit 3;
-- esperado: 1 linha nova, categoria 'erro' (não 'atividade'), detalhe {"aninhado": {"ok": 2}},
-- tela '/projetos', mensagem 'teste  ***', origem 'app'

-- 7b. Freio: 70 eventos seguidos do mesmo ator; no máximo 60 no último minuto.
set local role authenticated;
select public.registrar_log(jsonb_build_object('categoria', 'atividade', 'acao', 'exportacao')) from generate_series(1, 70);
reset role;
select count(*) as no_ultimo_minuto_esperado_60 from public.log_evento
 where em > now() - interval '1 minute'
   and ator_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;

-- 7c. Falha de login: e-mail mascarado, sem ator.
select public.registrar_falha_de_login('fulano@exemplo.com.br');
select acao, resultado, ator_id, tela, mensagem from public.log_evento where acao = 'login_falhou' order by id desc limit 1;
-- esperado: 'Falha de login: fu***@exemplo.com.br', ator_id nulo, tela '/login'

-- 7d. Só inserção: os dois devem falhar com 42501 (se algum passar, o bloco levanta erro).
do $$ begin
  begin update public.log_evento set mensagem = 'x'; raise exception 'UPDATE passou'; exception when sqlstate '42501' then null; end;
  begin delete from public.log_evento; raise exception 'DELETE passou'; exception when sqlstate '42501' then null; end;
end $$;

-- 7e. Consulta: total e itens no formato do contrato.
set local role authenticated;
select jsonb_pretty(public.consultar_logs(jsonb_build_object('aba', 'erros', 'porPagina', 2)));
-- 7e'. Aba Atividades para o Administrador: auditoriaIncluida = true e itens da audit_log
--      (fonte 'auditoria') junto com as exportações do 7b.
select (r ->> 'total')::int as total, r -> 'auditoriaIncluida' as auditoria_incluida,
       (select count(*) from jsonb_array_elements(r -> 'itens') i where i ->> 'fonte' = 'auditoria') as da_trilha_antiga
  from (select public.consultar_logs(jsonb_build_object('aba', 'atividades', 'porPagina', 200, 'de', (now() - interval '30 days')::text)) as r) x;
-- 7e''. Filtro de tela por prefixo: '/projetos' acha o evento gravado em '/projetos'.
select (public.consultar_logs(jsonb_build_object('aba', 'erros', 'tela', '/projetos', 'telas', jsonb_build_array('/projetos'))) ->> 'total')::int as total_tela_esperado_1;
reset role;

-- 7f. Quem não pode ver os logs não lê: um perfil ativo que não é Administrador e cuja área não
--     tem o recurso `logs` (se não houver nenhum, as linhas abaixo voltam vazias/sem efeito).
select set_config('request.jwt.claims', json_build_object(
  'sub', coalesce((select p.id::text from public.perfis p left join public.areas a on a.id = p.area_id
                    where p.ativo and p.papel <> 'Admin' and not ('logs' = any (coalesce(a.recursos, '{}'::text[])))
                    order by p.criado_em limit 1), '00000000-0000-0000-0000-000000000000'),
  'role', 'authenticated')::text, true);
set local role authenticated;
select count(*) as linhas_visiveis_esperado_0 from public.log_evento;
do $$ begin
  perform public.consultar_logs('{"aba":"erros"}'::jsonb);
  raise exception 'consultar_logs deveria recusar com 42501';
exception when sqlstate '42501' then null;
end $$;
reset role;

-- 7g. Agenda do expurgo criada dentro da transação (desfeita pelo rollback).
select jobname, schedule, active from cron.job where jobname = 'polobh-expurgo-logs';

-- 7h. O expurgo roda sem erro (só apaga o que passou do prazo; aqui não há nada tão antigo).
select private.expurgar_logs();

rollback;
