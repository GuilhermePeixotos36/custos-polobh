/**
 * O SEGUNDO CABEÇALHO — a barra que diz onde se está dentro de uma área.
 *
 * O cabeçalho geral tem cinco botões e responde "em que parte do aplicativo eu
 * estou". Ele não cabe mais do que isso, e não deveria: o resto é navegação de
 * DENTRO, e é o que esta barra faz.
 *
 * Ela atravessa rotas, e é essa a diferença para `SubGuias` (que troca estado
 * de uma tela só). A barra do projeto é a mesma dentro do projeto, da EC e da
 * OS — entrar num documento deixava a pessoa sem nenhuma referência de onde
 * estava, e voltar exigia caçar o botão "Voltar" certo. A de Configurações é a
 * mesma em Agenda, Fornecedores e Logs, que têm rota própria mas pertencem ali.
 *
 * Ela entra pelo slot `subabas` do `PageShell`, então gruda logo abaixo do
 * título e das ações — trocar de seção no meio de uma lista longa nunca obriga
 * a voltar ao topo.
 */
import { useLocation, useNavigate } from "react-router-dom";
import { SubGuias } from "@/components/layout/SubGuias";
import { useAuth } from "@/store/auth";
import { NAV_CONFIG, NAV_PROJETO, rotaAbaProjeto, type SecaoNav } from "@/components/layout/nav";

/**
 * A barra do PROJETO. `atual` é a aba acesa; `pendencias` traz o contador de
 * cada uma, quando a tela souber calculá-lo (só o próprio projeto sabe).
 *
 * `onAba` existe para a tela que já trata a troca por dentro (o ProjetoDetail,
 * que guarda a aba em estado): sem ele, a barra navega — que é o que a EC e a
 * OS precisam, porque para elas trocar de aba é sair do documento.
 */
export function BarraProjeto({
  projetoId,
  atual,
  pendencias,
  desabilitadasExceto,
  onAba,
}: {
  projetoId: string;
  atual: string;
  /** Pendências por chave de aba. */
  pendencias?: Record<string, number>;
  /** Projeto ainda não salvo: só esta aba faz sentido. */
  desabilitadasExceto?: string;
  onAba?: (aba: string) => void;
}) {
  const navigate = useNavigate();
  return (
    <SubGuias
      rotulo="Seções do projeto"
      atual={atual}
      onChange={(aba) => (onAba ? onAba(aba) : navigate(rotaAbaProjeto(projetoId, aba)))}
      abas={NAV_PROJETO.map((a) => ({
        ...a,
        desabilitada: !!desabilitadasExceto && a.key !== desabilitadasExceto,
        pendencias: pendencias?.[a.key] ?? 0,
      }))}
    />
  );
}

/**
 * A barra de CONFIGURAÇÕES: as seções da própria tela, mais os Logs, que têm
 * rota própria — para quem usa, é tudo a mesma barra.
 *
 * Cada seção respeita a permissão que já governava a tela: quem não pode ver
 * Logs continua não vendo o botão.
 */
export function BarraConfiguracoes({ atual }: { atual: string }) {
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const visiveis = NAV_CONFIG.filter((s) => !s.recurso || pode(s.recurso));
  return (
    <SubGuias
      rotulo="Seções das configurações"
      atual={atual}
      onChange={(key) => {
        const alvo = visiveis.find((s) => s.key === key);
        if (alvo) navigate(alvo.rota);
      }}
      abas={visiveis.map(({ key, label }): SecaoNav & { key: string; label: string } => ({ key, label }))}
    />
  );
}

/** Qual seção de Configurações a rota atual acende. */
export function useSecaoConfig(padrao = "geral"): string {
  const { pathname, search } = useLocation();
  const porRota = NAV_CONFIG.find((s) => s.rota === pathname);
  if (porRota) return porRota.key;
  const aba = new URLSearchParams(search).get("aba");
  return NAV_CONFIG.some((s) => s.key === aba) ? (aba as string) : padrao;
}
