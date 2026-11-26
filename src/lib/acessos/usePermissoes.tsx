//
// Permissões do grupo do usuário logado, carregadas uma vez por sessão. Alimenta o menu, o
// seletor de módulo, a guarda de rota, a faixa "Somente leitura" e os botões das telas.
//
// Segurança de verdade é RLS; isto é conveniência de tela.
//
// Agnóstico de design: não desenha nada. O carregador e as mensagens são do app hospedeiro
// (`AguardarPermissoes` recebe o que mostrar enquanto carrega).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { carregarMinhasPermissoes, MigracaoAusente } from "./acessosStore";
import {
  moduloVisivel as moduloVisivelDe, pode as podeDe, podeVerRota as podeVerRotaDe, somenteLeitura as somenteLeituraDe,
  type Permissao,
} from "./permissoes";

export type GrupoDoUsuario = { id: string; nome: string; sistema: boolean };

type Valor = {
  carregando: boolean;
  grupo: GrupoDoUsuario | null;
  /** O banco ainda não tem a migration dos grupos: vale o comportamento antigo do app. */
  legado: boolean;
  pode: (tela: string, acao: string) => boolean;
  podeVerRota: (rota?: string) => boolean;
  somenteLeitura: (rota?: string) => boolean;
  moduloVisivel: (moduloId: string) => boolean;
  /** (v2.1) Permissão específica do usuário (catálogo `PERMISSOES_ESPECIAIS`). Grupo de sistema: todas. */
  temEspecial: (chave: string) => boolean;
  recarregar: () => Promise<void>;
};

const Contexto = createContext<Valor | null>(null);

export function PermissoesProvider({ usuarioId, permissoesLegadas, children }: {
  /** Id do usuário logado (do hook de autenticação do app). Mudou, recarrega. */
  usuarioId: string | undefined;
  /**
   * Modo de compatibilidade: as permissões equivalentes ao papel ANTIGO do usuário, usadas só
   * enquanto a RPC `minhas_permissoes` não existe no banco (migration ainda não aplicada). É o
   * que deixa o front subir antes do banco sem trancar ninguém.
   * ADAPTAR: app existente passa `() => permissoesDoPapelAntigo(papel)` — por exemplo, admin =
   * `todasAsPermissoes()`, os demais = tudo menos o módulo "admin". App novo não passa nada:
   * sem a RPC, ninguém tem permissão.
   */
  permissoesLegadas?: () => Permissao[];
  children: ReactNode;
}) {
  const [carregando, setCarregando] = useState(true);
  const [grupo, setGrupo] = useState<GrupoDoUsuario | null>(null);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [especiais, setEspeciais] = useState<ReadonlySet<string>>(new Set());
  const [legado, setLegado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const dados = await carregarMinhasPermissoes();
      setLegado(false);
      setGrupo(dados?.grupo ?? null);
      setPermissoes(dados?.permissoes ?? []);
      setEspeciais(new Set(dados?.especiais ?? []));
    } catch (erro) {
      if (erro instanceof MigracaoAusente) {
        setLegado(true);
        setGrupo(null);
        setPermissoes(permissoesLegadas ? permissoesLegadas() : []);
        setEspeciais(new Set());
      } else {
        // Falha de rede não pode virar acesso total: sem permissão até recarregar.
        console.error("Falha ao carregar as permissões do grupo", erro);
        setLegado(false);
        setGrupo(null);
        setPermissoes([]);
        setEspeciais(new Set());
      }
    } finally {
      setCarregando(false);
    }
    // `permissoesLegadas` fora das dependências de propósito: função nova a cada render do pai
    // recarregaria em laço. Ela só é lida no momento da falha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!usuarioId) return;
    setCarregando(true);
    void carregar();
  }, [usuarioId, carregar]);

  const valor = useMemo<Valor>(() => ({
    carregando,
    grupo,
    legado,
    pode: (tela, acao) => podeDe(permissoes, tela, acao),
    podeVerRota: (rota) => podeVerRotaDe(permissoes, rota),
    somenteLeitura: (rota) => somenteLeituraDe(permissoes, rota),
    moduloVisivel: (moduloId) => moduloVisivelDe(permissoes, moduloId),
    temEspecial: (chave) => grupo?.sistema === true || especiais.has(chave),
    recarregar: carregar,
  }), [carregando, grupo, legado, permissoes, especiais, carregar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePermissoes(): Valor {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("usePermissoes precisa estar dentro de PermissoesProvider.");
  return valor;
}

/**
 * Segura o app até as permissões chegarem: sem isto a tela piscaria "somente leitura" ou
 * "sem permissão". `carregador` é o indicador de carregamento do design system do app, com o
 * texto "Conferindo suas permissões…".
 */
export function AguardarPermissoes({ carregador, children }: { carregador: ReactNode; children: ReactNode }) {
  const { carregando } = usePermissoes();
  return <>{carregando ? carregador : children}</>;
}

// --- Como ligar no app (ADAPTAR ao roteador e ao layout do app) ---------------------------------
//
// 1. No layout autenticado (depois de saber que há sessão e que o usuário está ATIVO):
//
//      <PermissoesProvider usuarioId={usuario?.id}>
//        <AguardarPermissoes carregador={<Carregador mensagem="Conferindo suas permissões…" />}>
//          <LayoutDoApp><Outlet /></LayoutDoApp>
//        </AguardarPermissoes>
//      </PermissoesProvider>
//
// 2. No layout, com a rota atual (só o pathname, sem a busca):
//
//      const { carregando, grupo, podeVerRota, somenteLeitura } = usePermissoes();
//      const acessoNegado = !carregando && !podeVerRota(pathname);
//      const soLeitura = !acessoNegado && somenteLeitura(pathname);
//
//      acessoNegado -> no lugar da tela: "Seu grupo não tem permissão para acessar esta tela."
//      soLeitura    -> faixa discreta no topo, role="status":
//                      "Somente leitura: seu grupo pode ver esta tela, mas não alterar."
//
// 3. No menu: cada item só aparece se `podeVerRota(item.rota)`; módulo só aparece se
//    `moduloVisivel(modulo.id)`. O rótulo sob o nome do usuário é `grupo.nome` (não o papel antigo).
//
// 4. Nas telas: todo `ehAdmin`/`podeEscrever` vira `pode("<tela>", "criar" | "editar" | "inativar")`
//    ou a ação extra. Botão sem a permissão SOME (não fica desabilitado sem explicação).
//
// 5. (v2.1) O que depende de uma permissão específica do usuário: `temEspecial("<chave>")` na tela
//    e `tem_permissao_especial('<chave>')` no banco/Edge (a tela sozinha não protege nada).
