-- ============================================================================
-- Observações Gerais da OS: campo LIVRE, que sai no documento e no Excel
-- (pedido do Guilherme, 29/08/2026).
--
-- Hoje existe um campo só, chamado "Observações Gerais", que na verdade é a
-- thread de comentários internos (com @menção e responsável, igual à dos itens
-- da EC) — e o gerador de Excel imprimia essa thread no documento que vai ao
-- fornecedor. Ou seja: conversa interna saindo para fora.
--
-- Passam a ser DUAS coisas, cada uma com seu lugar:
--   · `observacoes_gerais` (esta coluna) — texto livre da OS, escrito para o
--     fornecedor ler. Sai no documento impresso, no e-mail e na planilha.
--   · `observacoes` (a que já existe) — thread interna de pendências. NÃO sai
--     em lugar nenhum; é onde a equipe combina o que falta.
--
-- Coluna nova, e não uma chave dentro de um jsonb existente: `observacoes` já
-- é coluna própria em `oss`, e o par das duas fica legível lado a lado.
-- ============================================================================

alter table oss
  add column if not exists observacoes_gerais text not null default '';

comment on column oss.observacoes_gerais is
  'Observações gerais da OS em texto livre, escritas para o fornecedor: saem no documento, no e-mail e na planilha. Não confundir com `observacoes`, que é a thread interna de pendências e não sai em lugar nenhum.';

comment on column oss.observacoes is
  'Thread INTERNA de comentários/pendências da OS (mesmo formato dos itens da EC). Nunca sai em documento, e-mail ou planilha — para isso existe `observacoes_gerais`.';
