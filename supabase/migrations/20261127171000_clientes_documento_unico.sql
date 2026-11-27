-- ============================================================================
-- Clientes: um cadastro por CPF/CNPJ                             (27/11/2026)
--
-- A mesma trava que os fornecedores já têm (`fornecedores_documento_unico`): o
-- banco recusa um segundo cliente com o mesmo documento, não importa por onde
-- ele entre (tela Cadastros, botão "+", criação pelo projeto).
--
-- APLICAR SÓ DEPOIS de unificar os clientes que hoje repetem o documento
-- (Cadastros › Clientes › Excluir, escolhendo o registro que fica): com
-- duplicidade na tabela, o índice não pode ser criado e esta migration falha —
-- de propósito, sem apagar nada sozinha.
-- ============================================================================
create unique index if not exists clientes_documento_unico
  on public.clientes ((regexp_replace(coalesce(cnpj_cpf, ''), '\D', '', 'g')))
  where regexp_replace(coalesce(cnpj_cpf, ''), '\D', '', 'g') <> '';
