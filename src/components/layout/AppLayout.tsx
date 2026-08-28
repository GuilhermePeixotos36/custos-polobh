import { Suspense, useCallback, useEffect, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { TopNav } from "./TopNav";
import { Toaster } from "@/components/ui/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/store/auth";
import { usePendencias } from "@/store/pendencias";
import { useEmpresas } from "@/store/empresas";
import { cx } from "@/lib/format";

/** Casca autenticada: sidebar + área de conteúdo. */
export function AppLayout() {
  const usuario = useAuth((s) => s.usuario);
  const carregando = useAuth((s) => s.carregando);
  const carregarPendencias = usePendencias((s) => s.carregar);
  const carregarEmpresas = useEmpresas((s) => s.carregar);
  const { pathname } = useLocation();

  // Mantém as pendências (badges) atualizadas ao navegar entre telas.
  useEffect(() => {
    if (usuario) carregarPendencias();
  }, [usuario, pathname, carregarPendencias]);

  // Carrega as empresas do grupo ao entrar na área autenticada (login).
  useEffect(() => {
    if (usuario) carregarEmpresas();
  }, [usuario, carregarEmpresas]);

  // Aguarda a sessão inicial resolver antes de decidir redirecionar.
  if (carregando) {
    return <div className="min-h-screen grid place-items-center text-ink-3">Carregando…</div>;
  }
  if (!usuario) return <Navigate to="/login" replace />;

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav />
      <div className="flex-1 min-w-0 flex flex-col">
        <Suspense fallback={<div className="flex-1 grid place-items-center text-ink-3 text-sm">Carregando…</div>}>
          <Outlet />
        </Suspense>
      </div>
      <Toaster />
      <ConfirmDialog />
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
  topAction,
  acoes,
  subabas,
  children,
}: {
  breadcrumb?: ReactNode;
  title: string;
  titleAdornment?: ReactNode;
  subtitle?: string;
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
    const publicar = () =>
      document.documentElement.style.setProperty(
        "--altura-cabecalho",
        `${Math.round(node.getBoundingClientRect().height)}px`
      );
    publicar();
    // A altura muda sozinha: os botões quebram para uma segunda linha em tela
    // estreita, e o subtítulo aparece ou some conforme a tela.
    observadorCabecalho = new ResizeObserver(publicar);
    observadorCabecalho.observe(node);
  }, []);

  return (
    <main className="flex-1 px-[40px] py-[30px] max-w-[1720px] w-full mx-auto">
      <div
        ref={medirCabecalho}
        className={cx(
          "sticky top-[var(--altura-topnav)] z-20 -mx-[40px] px-[40px] pt-3 mb-4",
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
            {subtitle && <p className="text-ink-2 text-[15px] mt-2">{subtitle}</p>}
          </div>
          {topAction && <div className="flex items-center gap-2.5 shrink-0">{topAction}</div>}
        </div>
        {acoes && <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">{acoes}</div>}
        {/* Sangra até as bordas para o fio virar a base do cabeçalho inteiro, e
            rola na horizontal quando as guias não cabem na largura da tela. */}
        {subabas && (
          <div className="mt-3 -mx-[40px] px-[40px] border-b border-border overflow-x-auto">{subabas}</div>
        )}
      </div>
      {children}
    </main>
  );
}

/** Um observador por vez: só existe um PageShell montado de cada vez. */
let observadorCabecalho: ResizeObserver | null = null;

/** Item de breadcrumb simples. */
export function Crumb({ children }: { children: ReactNode }) {
  return <span className="text-ink font-bold">{children}</span>;
}
