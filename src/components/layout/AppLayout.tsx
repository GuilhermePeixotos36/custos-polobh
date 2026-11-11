import { Suspense, useCallback, useEffect, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { TopNav } from "./TopNav";
import { Toaster } from "@/components/ui/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/store/auth";
import { usePendencias } from "@/store/pendencias";
import { useAvisosPendencias } from "@/hooks/useAvisosPendencias";
import { usePushPendencias } from "@/hooks/usePushPendencias";
import { useMonitorPendencias } from "@/hooks/useMonitorPendencias";
import { useRealtimePendencias } from "@/hooks/useRealtimePendencias";
import { useEmpresas } from "@/store/empresas";
import { ProvedorRecolher } from "./Recolher";
import { TourOverlay } from "@/tour/TourOverlay";
import { PainelSuporte } from "@/components/suporte/PainelSuporte";
import { cx } from "@/lib/format";
import { useVersaoDoApp } from "@/hooks/useVersaoDoApp";

/** Casca autenticada: sidebar + área de conteúdo. */
export function AppLayout() {
  const usuario = useAuth((s) => s.usuario);
  const carregando = useAuth((s) => s.carregando);
  const carregarPendencias = usePendencias((s) => s.carregar);
  const carregarEmpresas = useEmpresas((s) => s.carregar);
  const { pathname } = useLocation();
  const versaoNova = useVersaoDoApp();

  // Mantém as pendências (badges) atualizadas ao navegar entre telas.
  useEffect(() => {
    if (usuario) carregarPendencias();
  }, [usuario, pathname, carregarPendencias]);

  // Carrega as empresas do grupo ao entrar na área autenticada (login).
  useEffect(() => {
    if (usuario) carregarEmpresas();
  }, [usuario, carregarEmpresas]);

  // Duas camadas, e as duas precisam existir: o Realtime avisa na hora quando
  // outra pessoa mexe em algo, e o relógio garante a atualização quando o
  // socket cai, a rede oscila ou a aba dorme.
  useRealtimePendencias(!!usuario);
  useMonitorPendencias(!!usuario);

  // Avisos do sistema operacional para pendência nova (ver o hook).
  useAvisosPendencias();
  usePushPendencias();

  // Aguarda a sessão inicial resolver antes de decidir redirecionar.
  if (carregando) {
    return <div className="min-h-screen grid place-items-center text-ink-3">Carregando…</div>;
  }
  if (!usuario) return <Navigate to="/login" replace />;

  return (
    <div className="flex flex-col min-h-screen pb-[calc(var(--altura-nav-celular)+env(safe-area-inset-bottom))] md:pb-0">
      {/* Deploy novo publicado com a aba aberta: todos os perfis passam a ver o
          mesmo aplicativo assim que clicam (ver `useVersaoDoApp`). */}
      {versaoNova && (
        <div className="no-print flex items-center justify-center gap-3 flex-wrap bg-primary text-white px-4 py-2 text-[13px] font-bold">
          <span>Há uma versão nova do aplicativo. Atualize para usar a mais recente.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-btn bg-white text-primary-dark px-3 py-1 text-[12.5px] font-extrabold hover:bg-primary-soft"
          >
            Atualizar agora
          </button>
        </div>
      )}
      <TopNav />
      <div className="flex-1 min-w-0 flex flex-col">
        <Suspense fallback={<div className="flex-1 grid place-items-center text-ink-3 text-sm">Carregando…</div>}>
          <Outlet />
        </Suspense>
      </div>
      <Toaster />
      <ConfirmDialog />
      {/* O tour atravessa várias rotas: a sobreposição precisa viver AQUI, na
          casca, senão ela morreria na primeira troca de tela. */}
      <TourOverlay />
      {/* O Help Desk é um painel sobre a tela, e pelo mesmo motivo mora aqui:
          ele abre de qualquer lugar do aplicativo sem tirar ninguém do lugar. */}
      <PainelSuporte />
    </div>
  );
}

/**
 * Cabeçalho de página + área de conteúdo padronizada.
 *
 * O cabeçalho fica GRUDADO logo abaixo da barra de navegação: em tela longa —
 * uma EC com dezenas de itens, um check-list inteiro — rolar fazia sumir o
 * título e, pior, os botões de ação da página, e era preciso voltar ao topo só
 * para salvar ou baixar. Agora ele acompanha a rolagem, e o conteúdo passa por
 * baixo.
 *
 * Quem tem uma fileira de ações própria (Voltar, Salvar, Excel…) passa por
 * `acoes`, para ela grudar junto em vez de rolar embora. As subabas da tela
 * (EC · Resumo dos Custos · Rentabilidade, as guias do projeto…) entram por
 * `subabas` e grudam no mesmo bloco: trocar de subaba no meio de uma lista
 * longa não pode exigir voltar ao topo.
 *
 * A altura real é publicada em `--altura-cabecalho`: outros elementos grudados
 * dentro da página (a barra de seleção de itens da EC, por exemplo) se
 * posicionam abaixo dela sem chutar medida.
 */
export function PageShell({
  breadcrumb,
  title,
  titleAdornment,
  subtitle,
  legenda,
  topAction,
  acoes,
  subabas,
  children,
}: {
  breadcrumb?: ReactNode;
  title: string;
  titleAdornment?: ReactNode;
  subtitle?: string;
  /** Linha pequena logo abaixo do título (ver `LegendaProjeto`). */
  legenda?: ReactNode;
  topAction?: ReactNode;
  /** Fileira de ações da página — gruda junto com o título. */
  acoes?: ReactNode;
  /** Barra de subguias da tela (`<SubGuias />`) — gruda logo abaixo das ações. */
  subabas?: ReactNode;
  children: ReactNode;
}) {
  const medirCabecalho = useCallback((node: HTMLDivElement | null) => {
    observadorCabecalho?.disconnect();
    observadorCabecalho = null;
    if (!node) {
      document.documentElement.style.setProperty("--altura-cabecalho", "0px");
      return;
    }
    // No celular o cabeçalho NÃO gruda (ver a classe abaixo): ele ocupava
    // metade da tela o tempo todo. Sem grude, quem se posiciona "abaixo do
    // cabeçalho" deve contar só a barra do topo.
    const publicar = () =>
      document.documentElement.style.setProperty(
        "--altura-cabecalho",
        window.matchMedia("(min-width: 768px)").matches
          ? `${Math.round(node.getBoundingClientRect().height)}px`
          : "0px"
      );
    publicar();
    // A altura muda sozinha: os botões quebram para uma segunda linha em tela
    // estreita, e o subtítulo aparece ou some conforme a tela.
    observadorCabecalho = new ResizeObserver(publicar);
    observadorCabecalho.observe(node);
  }, []);

  return (
    <ProvedorRecolher>
    <main className="flex-1 px-[var(--gutter)] py-5 md:py-[30px] max-w-[1720px] w-full mx-auto">
      <div
        ref={medirCabecalho}
        className={cx(
          "cabecalho-pagina md:sticky top-[var(--altura-topnav)] z-20 -mx-[var(--gutter)] px-[var(--gutter)] pt-3 mb-4",
          // Translúcido com desfoque: encosta no degradê do fundo sem virar uma
          // faixa chapada, e o conteúdo que passa por baixo continua legível.
          "bg-bg/90 backdrop-blur-[6px]",
          // Quem fecha o bloco embaixo é o fio da barra de subguias, quando ela
          // existe: dois fios colados viravam uma faixa dupla.
          subabas ? "pb-0" : "pb-3 border-b border-border-soft"
        )}
      >
        {breadcrumb && (
          <div className="mb-2 flex items-center gap-2 text-sm text-ink-2 font-semibold min-w-0">
            {breadcrumb}
          </div>
        )}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display font-bold text-[30px] tracking-[-0.7px] text-ink leading-none">
                {title}
              </h1>
              {titleAdornment}
            </div>
            {legenda}
            {subtitle && <p className="text-ink-2 text-[15px] mt-2">{subtitle}</p>}
          </div>
          {/* O "Recolher tudo" saiu daqui (28/10/2026): cada bloco abre e fecha
              pela seta do próprio cabeçalho. */}
          <div data-tour="acoes-tela" className="flex items-center gap-2.5 flex-wrap min-w-0 max-w-full md:shrink-0">
            {topAction}
          </div>
        </div>
        {acoes && <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">{acoes}</div>}
        {/* Sangra até as bordas para o fio virar a base do cabeçalho inteiro, e
            rola na horizontal quando as guias não cabem na largura da tela. */}
        {subabas && (
          <div data-tour="subguias" className="mt-3 -mx-[var(--gutter)] px-[var(--gutter)] border-b border-border overflow-x-auto">{subabas}</div>
        )}
      </div>
      {children}
      {/* Espaço para a PÍLULA DE PENDÊNCIAS (15/09/2026).
          Ela é fixa no canto inferior direito e tapava a última linha do que
          estivesse embaixo — a queixa veio do Resumo de Custos, onde o que ficava
          coberto era justamente um total. A folga sai da altura real da pílula
          (`--altura-pilula`, medida por ResizeObserver) e é ZERO nas telas que
          não têm pílula, então nenhuma página ganha um rodapé vazio. */}
      <div aria-hidden className="no-print" style={{ height: "calc(var(--altura-pilula, 0px) + 1.5rem)" }} />
    </main>
    </ProvedorRecolher>
  );
}

/** Um observador por vez: só existe um PageShell montado de cada vez. */
let observadorCabecalho: ResizeObserver | null = null;

/** Item de breadcrumb simples. */
export function Crumb({ children }: { children: ReactNode }) {
  return <span className="text-ink font-bold">{children}</span>;
}
