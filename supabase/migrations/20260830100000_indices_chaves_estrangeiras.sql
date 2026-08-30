-- ============================================================================
-- Índices nas chaves estrangeiras quentes (revisão de fechamento, 30/08/2026).
--
-- O app monta quase toda tela com um JOIN de pai para filho:
--
--     select * from ecs        + linhas:ec_linhas(*)     -> ec_linhas.ec_id
--     select * from oss  where ec_id = ...               -> oss.ec_id
--
-- e nenhuma dessas colunas tinha índice. Com a base de hoje (140 linhas de EC)
-- o Postgres varre a tabela inteira e ninguém percebe. Com um ano de operação
-- — algumas centenas de ECs, alguns milhares de linhas — a varredura passa a
-- acontecer a cada abertura de projeto, de lista de OS e a cada recarga do
-- painel de pendências. É o tipo de lentidão que aparece devagar e que ninguém
-- consegue atribuir a uma tela específica.
--
-- Índice de FK não é preciosismo: sem ele, além da leitura lenta, todo DELETE
-- ou UPDATE na tabela PAI precisa varrer a filha para checar a integridade.
--
-- `concurrently` fica de fora de propósito: ele não roda dentro de transação, e
-- a migração é aplicada como um bloco só. Nas tabelas atuais a criação é
-- instantânea.
-- ============================================================================

-- Os dois que o app usa em toda navegação.
create index if not exists ec_linhas_ec_id_idx on ec_linhas (ec_id);
create index if not exists oss_ec_id_idx on oss (ec_id);

-- Os demais aparecem em telas específicas, mas o custo de manter é o mesmo.
create index if not exists os_linhas_ec_linha_id_idx on os_linhas (ec_linha_id);
create index if not exists ecs_cliente_id_idx on ecs (cliente_id);
create index if not exists checklists_modelo_id_idx on checklists (modelo_id);
create index if not exists audit_log_user_id_idx on audit_log (user_id);

comment on index ec_linhas_ec_id_idx is
  'Cobre a FK ec_linhas -> ecs. É o join de toda listagem de EC; sem ele o Postgres varre ec_linhas inteira a cada EC lida.';
