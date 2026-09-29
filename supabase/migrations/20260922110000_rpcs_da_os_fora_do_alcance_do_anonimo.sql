/*
 * As duas RPC novas da OS estavam ao alcance de quem não fez login (22/09/2026)
 *
 * Descoberto ao aplicar as migrações no banco de produção: o linter de segurança
 * do Supabase apontou `devolver_dados_fiscais_para_ec` e
 * `marcar_itens_da_os_como_emitidos` como executáveis pelo papel `anon`.
 *
 * A causa é uma pegadinha do `revoke`. O schema `public` do Supabase tem DEFAULT
 * PRIVILEGES que concedem EXECUTE a `anon` e `authenticated` em toda função
 * criada ali. Essa concessão pertence ao PAPEL, e não ao pseudo-papel PUBLIC —
 * então `revoke all ... from public`, que é o que as duas migrações escreveram,
 * não a alcança. O resto deste banco sempre escreveu `from public, anon`; estas
 * duas escaparam da convenção.
 *
 * O risco era concreto, e não teórico: as duas são `security definer`, ou seja,
 * passam por cima da RLS de propósito (é para isso que existem — quem emite o
 * faturamento não tem escrita em `ec_linhas`). Pelo endpoint /rest/v1/rpc, sem
 * login, bastaria um uuid de OS para fechar itens de EC como emitidos.
 *
 * As duas migrações de origem foram corrigidas no repositório também, para que
 * um banco novo já nasça certo.
 */
revoke all on function devolver_dados_fiscais_para_ec(uuid, text, text) from public, anon;
revoke all on function marcar_itens_da_os_como_emitidos(uuid) from public, anon;

grant execute on function devolver_dados_fiscais_para_ec(uuid, text, text) to authenticated;
grant execute on function marcar_itens_da_os_como_emitidos(uuid) to authenticated;
