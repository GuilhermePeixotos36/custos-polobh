-- SEGURANÇA (05/11/2026): a view `ec_linhas_visiveis` é só para LEITURA.
--
-- Ela roda com as permissões do dono (para mascarar os valores), e o Postgres
-- deixa gravar através de views simples. Com os privilégios padrão do Supabase,
-- qualquer pessoa logada — mesmo sem permissão de editar a EC — conseguia
-- alterar ou apagar linhas por ela, passando por cima da RLS de `ec_linhas`.
-- O app grava só pela RPC `salvar_ec_completa`; aqui fica só o SELECT.
revoke insert, update, delete, truncate, references, trigger on public.ec_linhas_visiveis from anon, authenticated;
revoke all on public.ec_linhas_visiveis from anon;
-- Sem login não há o que ver (a view já filtra), mas também não há por que chamar.
revoke execute on function public.ve_financeiro() from anon;
