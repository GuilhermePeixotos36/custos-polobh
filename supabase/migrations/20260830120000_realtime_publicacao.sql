-- ============================================================================
-- Realtime: publica as tabelas que servem de SINAL para o app se atualizar
-- sozinho (pedido do Guilherme, 30/08/2026).
--
-- A publicação `supabase_realtime` existia vazia — ou seja, o Realtime estava
-- efetivamente desligado. Aqui ele é ligado para as tabelas certas, e a lista
-- é deliberadamente CURTA. Duas regras guiaram a escolha:
--
-- 1) O QUE NÃO ENTRA, e por quê.
--
--    `ec_linhas` fica de fora de propósito. O Realtime publica da TABELA BASE
--    e aplica a RLS DELA — e a RLS de `ec_linhas` libera SELECT para qualquer
--    autenticado (`papel_atual() is not null`). Quem esconde o BV da Produção
--    é a VIEW `ec_linhas_visiveis`, e view não entra nesse caminho. Publicar a
--    tabela mandaria o `bv` de cada item para o socket de todo mundo, incluindo
--    quem o sistema faz questão de não mostrar. Seria um vazamento silencioso:
--    a tela continuaria mascarando e o dado estaria no navegador.
--
--    Não faz falta: `salvar_ec_completa` atualiza a linha da EC em `ecs`
--    (inclusive `atualizado_em`), então QUALQUER mudança numa linha — troca de
--    status, comentário novo, valor — já chega como evento de `ecs`.
--
--    Pelo mesmo motivo ficam de fora `os_linhas` (acompanha `oss`) e
--    `audit_log` (ruído puro: uma linha por ação de todo mundo).
--
-- 2) O QUE O APP FAZ COM O EVENTO.
--
--    Nada além de "vá buscar de novo". O payload do Realtime é ignorado; o app
--    recarrega pelo caminho normal, que passa pelas views e pela RLS. Assim o
--    Realtime nunca vira uma segunda fonte de verdade com regras próprias — e
--    um evento de tabela que a pessoa não pode ler simplesmente não muda nada
--    na tela dela.
--
-- REPLICA IDENTITY fica no padrão (chave primária). O app não lê o conteúdo do
-- evento, então não há motivo para pagar o custo de `full` no WAL.
-- ============================================================================

alter publication supabase_realtime add table
  projetos,
  ecs,
  oss,
  checklists,
  checklist_itens,
  credenciamentos;
