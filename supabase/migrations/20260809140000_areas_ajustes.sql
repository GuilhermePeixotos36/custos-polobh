-- ============================================================================
-- Ajustes nas áreas após a primeira revisão com o Guilherme (09/08/2026):
--   1. A área "Administrador" deixa de existir. O papel Admin é do desenvolvedor,
--      que fica SEM área e enxerga tudo pelo fallback de `pode()` em auth.ts.
--   2. "Administrativo" passa a se chamar "Financeiro" — é a área do financeiro
--      da Pólobh (a que vê só a descrição financeira da EC).
--   3. Sai o conceito de área "de fábrica" (`sistema`) e entra `ativa`: área com
--      usuários vinculados não é excluída, é INATIVADA; área sem ninguém pode ser
--      excluída de vez.
-- ============================================================================

-- 3a. A trava de exclusão some junto com o conceito de área de fábrica.
drop trigger if exists areas_impedir_exclusao_sistema on areas;
drop function if exists impedir_exclusao_area_sistema();

alter table areas add column if not exists ativa boolean not null default true;

comment on column areas.ativa is
  'Área inativa não pode ser atribuída a novos usuários; quem já está nela mantém o acesso.';

-- 2. Renomeia antes de mexer em `sistema`, para o update pegar a linha certa.
update areas set nome = 'Financeiro' where nome = 'Administrativo';

-- 1. Remove a área do Admin — os perfis afetados ficam com area_id nulo
--    (on delete set null) e o papel 'Admin' preservado.
delete from areas where nome = 'Administrador';

alter table areas drop column if exists sistema;
