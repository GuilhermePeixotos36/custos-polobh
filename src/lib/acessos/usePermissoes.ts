/**
 * Permissões do grupo de quem está logado, no formato do padrão de Acessos: `pode(tela, acao)`,
 * `podeVerRota`, `somenteLeitura`, `moduloVisivel`, `temEspecial`.
 *
 * No padrão é um provider; aqui é um gancho sobre o store de autenticação (`useAuth`), que já
 * carrega perfil e permissões juntos no login. Assim não há dois carregamentos nem duas fontes: o
 * `useAuth().pode("oss.editar")` que o app inteiro usa e o `pode("ordens.os", "editar")` da tela
 * de Acessos leem a mesma lista.
 *
 * Segurança de verdade é RLS e as RPCs; isto é conveniência de tela.
 */
import { useMemo } from "react";
import { useAuth } from "@/store/auth";
import {
  moduloVisivel as moduloVisivelDe, pode as podeDe, podeVerRota as podeVerRotaDe, somenteLeitura as somenteLeituraDe,
} from "./permissoes";

export function usePermissoes() {
  const carregando = useAuth((s) => s.carregando);
  const grupo = useAuth((s) => s.grupo);
  const legado = useAuth((s) => s.legado);
  const permissoes = useAuth((s) => s.permissoes);
  const especiais = useAuth((s) => s.especiais);
  const recarregar = useAuth((s) => s.recarregarPermissoes);

  return useMemo(() => {
    const conjunto = new Set(especiais);
    return {
      carregando,
      grupo,
      /** O banco ainda não tem a migration dos grupos: vale o comportamento antigo do app. */
      legado,
      permissoes,
      pode: (tela: string, acao: string) => podeDe(permissoes, tela, acao),
      podeVerRota: (rota?: string) => podeVerRotaDe(permissoes, rota),
      somenteLeitura: (rota?: string) => somenteLeituraDe(permissoes, rota),
      moduloVisivel: (moduloId: string) => moduloVisivelDe(permissoes, moduloId),
      /** Permissão específica do usuário. Grupo de sistema: todas. */
      temEspecial: (chave: string) => grupo?.sistema === true || conjunto.has(chave),
      recarregar,
    };
  }, [carregando, grupo, legado, permissoes, especiais, recarregar]);
}
