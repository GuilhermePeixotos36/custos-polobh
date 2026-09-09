-- ============================================================================
-- `tocar_checklist` deixa de ser chamável de fora        (09/09/2026)
--
-- Ela é a função do TRIGGER `checklist_itens_tocar`: toda gravação de item
-- carimba `checklists.atualizado_em`, para a tela saber que a lista mudou
-- (migração `20260823100000`). Nunca foi para ser chamada por ninguém — só
-- pelo trigger.
--
-- Mas ela nasceu com o EXECUTE que o Postgres dá a PUBLIC por padrão, mais os
-- grants que o Supabase distribui no schema `public`, e o resultado é que
-- qualquer um — inclusive `anon`, SEM LOGIN — podia chamá-la em
-- `/rest/v1/rpc/tocar_checklist`. Sendo `security definer`, ela roda com os
-- poderes de quem a criou. Foi o que o linter do Supabase apontou
-- (0028_anon_security_definer_function_executable).
--
-- REVOGAR NÃO DESLIGA O TRIGGER. O Postgres chama a função de trigger pela
-- máquina de triggers, que não consulta o EXECUTE de quem fez o INSERT — o
-- privilégio só vale para a chamada direta. Conferido num Postgres à parte: com
-- o EXECUTE revogado, `perform tocar()` é recusado por privilégio insuficiente
-- e o `INSERT` na tabela filha continua carimbando a lista.
--
-- O revoke em PUBLIC é o que de fato fecha a porta: revogar só de `anon`
-- deixaria a permissão herdada de PUBLIC de pé, e a função seguiria acessível.
-- `service_role` fica de fora de propósito: é o papel de servidor, não é
-- alcançável pelo navegador, e o linter não o aponta.
-- ============================================================================

revoke all on function tocar_checklist() from public, anon, authenticated;

comment on function tocar_checklist() is
  'Função do trigger checklist_itens_tocar — carimba checklists.atualizado_em a cada gravação de item. Não é chamável de fora: o EXECUTE foi revogado de PUBLIC/anon/authenticated, e o trigger não depende dele.';
