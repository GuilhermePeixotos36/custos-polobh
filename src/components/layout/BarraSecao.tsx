/**
 * O SEGUNDO CABEÇALHO — a barra que diz onde se está dentro de uma área.
 *
 * O cabeçalho geral responde "em que parte do aplicativo eu estou". O resto é
 * navegação de DENTRO, e é o que esta barra faz. Ela atravessa rotas: a barra do
 * projeto é a mesma dentro do projeto, da EC e da OS — entrar num documento
 * deixava a pessoa sem nenhuma referência de onde estava. A de Configurações é a
 * mesma nos Logs, que têm rota própria mas pertencem ali.
 *
 * Desde 24/11/2026 ela é a `FolderTabsBar` do design system (aba ativa branca,
 * painel embaixo), e não mais um sublinhado: entra pelo slot `subabas` do
 * `PageShell`, que embrulha o conteúdo da tela no `FolderPanel` e gruda os dois
 * logo abaixo do título — trocar de seção no meio de uma lista longa nunca obriga
 * a voltar ao topo.
 *
 * Cada aba leva `data-subguia={chave}`: é por ele que o tour guiado acha (e
 * clica) a aba certa.
 */
import { useLocation, useNavigate } from "react-router-dom";
import { FolderTabsBar } from "@/components/padrao/FolderTabs";
import { NotifDot } from "@/components/NotifDot";
import { useAuth } from "@/store/auth";
import { NAV_CONFIG, NAV_PROJETO, rotaAbaProjeto } from "@/components/layout/nav";

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
    <FolderTabsBar
      ariaLabel="Seções do projeto"
      value={atual}
      onChange={(aba) => (onAba ? onAba(aba) : navigate(rotaAbaProjeto(projetoId, aba)))}
      options={NAV_PROJETO.map((a) => {
        const desabilitada = !!desabilitadasExceto && a.key !== desabilitadasExceto;
        const n = desabilitada ? 0 : pendencias?.[a.key] ?? 0;
        return {
          value: a.key,
          label: a.label,
          disabled: desabilitada,
          title: desabilitada ? "Salve o projeto para abrir esta seção" : undefined,
          // A bolinha vermelha é "o que é seu" nesta etapa — a mesma conta do sino.
          adorno: n > 0 ? <NotifDot inline n={n} title="Ações pendentes nesta etapa" /> : undefined,
          atributos: { "data-subguia": a.key },
        };
      })}
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
  const visiveis = NAV_CONFIG.filter((s) => !s.recurso || pode(s.recurso) || !!s.ou?.some(pode));
  return (
    <FolderTabsBar
      ariaLabel="Seções das configurações"
      value={atual}
      onChange={(key) => {
        const alvo = visiveis.find((s) => s.key === key);
        if (alvo) navigate(alvo.rota);
      }}
      options={visiveis.map(({ key, label }) => ({ value: key, label, atributos: { "data-subguia": key } }))}
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
