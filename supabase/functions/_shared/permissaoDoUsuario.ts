// Autorização das OUTRAS Edge Functions pelas permissões do grupo (padrão de Acessos LSPRO), no
// lugar de "o papel é X". Quem chama é o cliente com o JWT do usuário: a RPC `tem_permissao` olha
// o `auth.uid()` dele, então não há como perguntar pela permissão de outra pessoa.
//
// Tolerância de publicação: se a migration dos grupos ainda não foi aplicada, a RPC não existe
// (PGRST202) e a checagem cai na antiga, pelo papel — assim a função pode ser publicada antes ou
// depois do banco. Qualquer OUTRO erro da RPC nega (falha fechada).
//
// Uso (o cliente PRECISA levar o JWT de quem chama, não a service role):
//
//   const cliente = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
//   const { data: { user } } = await cliente.auth.getUser(jwt);
//   if (!user) return json({ error: "Sessão inválida." }, 401);
//   if (!(await temPermissaoDoUsuario(cliente, user.id, "admin.configuracoes", "ver", ["Admin"]))) { ... 403 }
//
// As funções que ainda autorizam por `autorizar(req, papeis)` (_shared/auth.ts) continuam
// valendo depois da migration, porque o papel passou a ser derivado do grupo. Converter cada uma
// para cá é trabalho listado em docs/acessos.md (limites conhecidos).
//
// NUNCA escreva escape unicode (barra invertida + u) neste arquivo, nem em comentário.

type ErroDaRpc = { code?: string; message?: string } | null;

/** O mínimo do cliente do Supabase que o helper usa (evita acoplar `_shared` ao pacote). */
export interface ClienteDePermissao {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: ErroDaRpc }>;
  // deno-lint-ignore no-explicit-any
  from(tabela: string): any;
}

export const rpcInexistente = (erro: ErroDaRpc): boolean =>
  erro?.code === "PGRST202" || /could not find the function/i.test(erro?.message ?? "");

/** Decisão pura: resposta da RPC + (se a RPC não existir) o papel antigo, lido de `perfis`. */
export function decidirPermissao(
  resposta: { data: unknown; error: ErroDaRpc },
  papelLegado: { papel: string | null; ativo: boolean | null } | null,
  papeisAceitos: readonly string[],
): boolean {
  if (!resposta.error) return resposta.data === true;
  if (rpcInexistente(resposta.error)) {
    return !!papelLegado && papelLegado.ativo === true && papeisAceitos.includes(String(papelLegado.papel));
  }
  return false;
}

/**
 * O usuário do `cliente` pode `acao` em `tela`? `papeisAceitos` só vale na ausência da RPC: são
 * os papéis antigos que passavam por este portão antes dos grupos (ex.: ["Admin", "Direcao"]).
 */
export async function temPermissaoDoUsuario(
  cliente: ClienteDePermissao,
  usuarioId: string,
  tela: string,
  acao: string,
  papeisAceitos: readonly string[] = [],
): Promise<boolean> {
  const resposta = await cliente.rpc("tem_permissao", { p_tela: tela, p_acao: acao });
  let legado: { papel: string | null; ativo: boolean | null } | null = null;
  if (resposta.error && rpcInexistente(resposta.error) && papeisAceitos.length > 0) {
    const { data } = await cliente.from("perfis").select("papel, ativo").eq("id", usuarioId).maybeSingle();
    const linha = data as { papel?: string | null; ativo?: boolean | null } | null;
    legado = linha ? { papel: linha.papel ?? null, ativo: linha.ativo ?? null } : null;
  }
  return decidirPermissao(resposta, legado, papeisAceitos);
}
