// DESTINO: supabase/functions/_shared/permissaoDoUsuario.ts
//
// Autorização das OUTRAS Edge Functions do app pelas permissões do grupo, no lugar de "o papel é
// admin". Quem chama é o cliente com o JWT do usuário: a RPC `tem_permissao` olha o `auth.uid()`
// dele, então não há como perguntar pela permissão de outra pessoa.
//
// Tolerância de publicação: se a migration dos grupos ainda não foi aplicada, a RPC não existe
// (PGRST202) e a checagem cai na antiga, pelo papel — assim a função pode ser publicada antes ou
// depois do banco. Qualquer OUTRO erro da RPC nega (falha fechada).
//
// Uso numa função (o cliente PRECISA levar o JWT de quem chama, não a service role):
//
//   const cliente = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
//   const { data: { user } } = await cliente.auth.getUser(jwt);
//   if (!user) return json({ error: "Sessão inválida." }, 401);
//   if (!(await temPermissaoDoUsuario(cliente, user.id, "exemplo.cadastros", "editar", ["admin"]))) {
//     return json({ error: "Você não tem permissão para esta ação." }, 403);
//   }
//
// NUNCA escreva escape unicode (barra invertida + u) neste arquivo, nem em comentário.

type ErroDaRpc = { code?: string; message?: string } | null;

/** O mínimo do cliente do Supabase que o helper usa (evita acoplar `_shared` ao pacote npm). */
export interface ClienteDePermissao {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: ErroDaRpc }>;
  // deno-lint-ignore no-explicit-any
  from(tabela: string): any;
}

export const rpcInexistente = (erro: ErroDaRpc): boolean =>
  erro?.code === "PGRST202" || /could not find the function/i.test(erro?.message ?? "");

// Pólobh: o papel antigo mora em `perfis.papel` (lido só se a RPC ainda não existir no banco).
const PAPEL_LEGADO: { tabela: string; colunaPapel: string; colunaStatus: string } | null = {
  tabela: "perfis",
  colunaPapel: "papel",
  colunaStatus: "status",
};

/** Decisão pura: resposta da RPC + (se a RPC não existir) o papel antigo. */
export function decidirPermissao(
  resposta: { data: unknown; error: ErroDaRpc },
  papelLegado: { papel: string | null; status: string | null } | null,
  papeisAceitos: readonly string[],
): boolean {
  if (!resposta.error) return resposta.data === true;
  if (rpcInexistente(resposta.error)) {
    return !!papelLegado && papelLegado.status === "ativo" && papeisAceitos.includes(String(papelLegado.papel));
  }
  return false;
}

/**
 * O usuário do `cliente` pode `acao` em `tela`? `papeisAceitos` só vale na ausência da RPC: são
 * os papéis antigos que passavam por este portão antes dos grupos (ex.: ["admin"]).
 */
export async function temPermissaoDoUsuario(
  cliente: ClienteDePermissao,
  usuarioId: string,
  tela: string,
  acao: string,
  papeisAceitos: readonly string[] = [],
): Promise<boolean> {
  const resposta = await cliente.rpc("tem_permissao", { p_tela: tela, p_acao: acao });
  let legado: { papel: string | null; status: string | null } | null = null;
  if (resposta.error && rpcInexistente(resposta.error) && PAPEL_LEGADO && papeisAceitos.length > 0) {
    const { data } = await cliente.from(PAPEL_LEGADO.tabela)
      .select(`${PAPEL_LEGADO.colunaPapel},${PAPEL_LEGADO.colunaStatus}`).eq("id", usuarioId).maybeSingle();
    const linha = data as Record<string, unknown> | null;
    legado = linha
      ? { papel: (linha[PAPEL_LEGADO.colunaPapel] as string | null) ?? null, status: (linha[PAPEL_LEGADO.colunaStatus] as string | null) ?? null }
      : null;
  }
  return decidirPermissao(resposta, legado, papeisAceitos);
}
