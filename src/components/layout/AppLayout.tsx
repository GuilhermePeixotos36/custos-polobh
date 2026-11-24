import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CascaDoApp } from "./casca/CascaDoApp";
import { ITENS_DE_NAVEGACAO } from "@/config/navegacao";
import { SinoPendencias } from "@/components/SinoPendencias";
import { MinhaContaModal } from "@/components/MinhaContaModal";
import { useMinhasPendencias } from "@/store/pendencias";
import { abrirSuporte } from "@/store/suporte";
import { ROTULO_PAPEL } from "@/store/auth";
import { Toaster } from "@/components/ui/Toaster";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/store/auth";
import { usePendencias } from "@/store/pendencias";
import { useAvisosPendencias } from "@/hooks/useAvisosPendencias";
import { usePushPendencias } from "@/hooks/usePushPendencias";
import { useAbrirDoAviso } from "@/hooks/useAbrirDoAviso";
import { useMonitorPendencias } from "@/hooks/useMonitorPendencias";
import { useRealtimePendencias } from "@/hooks/useRealtimePendencias";
import { useEmpresas } from "@/store/empresas";
import { ProvedorRecolher } from "./Recolher";
import { TourOverlay } from "@/tour/TourOverlay";
import { PainelSuporte } from "@/components/suporte/PainelSuporte";
import { ConviteAvisos } from "@/components/ConviteAvisos";
import { cx } from "@/lib/format";
import { useVersaoDoApp } from "@/hooks/useVersaoDoApp";

/**
 * Casca autenticada (design system LSPRO, 24/11/2026): barra lateral clara no computador — marca,
 * itens, sino de pendências e a conta no rodapé — e menu inferior no celular. O topo de antes
 * (`TopNav`) saiu: no computador não há cabeçalho; o título de cada tela é o do `PageShell`.
 */
export function AppLayout() {
  const usuario = useAuth((s) => s.usuario);
  const carregando = useAuth((s) => s.carregando);
  const pode = useAuth((s) => s.pode);
  const sair = useAuth((s) => s.sair);
  const navigate = useNavigate();
  const { porRecurso } = useMinhasPendencias();
  const [minhaConta, setMinhaConta] = useState(false);

  // A lista do menu já filtrada pelo que a pessoa pode ver, com o contador de pendências e o
  // clique do Help Desk (que abre o painel em vez de navegar).
  const itens = useMemo(
    () =>
      ITENS_DE_NAVEGACAO.filter((i) => !i.recurso || pode(i.recurso) || !!i.ou?.some(pode)).map((i) => ({
        ...i,
        contador: i.pendencias && i.recurso ? porRecurso[i.recurso] ?? 0 : undefined,
        aoClicar: i.painel === "suporte" ? () => abrirSuporte() : undefined,
      })),
    [pode, porRecurso]
  );
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
  useAbrirDoAviso(!!usuario);

  // Aguarda a sessão inicial resolver antes de decidir redirecionar.
  if (carregando) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  }
  if (!usuario) return <Navigate to="/login" replace />;

  return (
    <CascaDoApp
      marca="/icone-aviso.png"
      nomeDoApp="Pólobh"
      itens={itens}
      caminho={pathname}
      pessoa={{
        nome: usuario.nome,
        grupo: usuario.areaNome ?? ROTULO_PAPEL[usuario.papel],
        email: usuario.email,
        formaDeEntrada: "E-mail e senha",
      }}
      onSair={async () => {
        await sair();
        navigate("/login");
      }}
      // A troca de senha pela própria pessoa continua (decisão de 24/11/2026, exceção ao padrão de Acessos).
      onAlterarSenha={() => setMinhaConta(true)}
      // Tudo o que é cobrado da pessoa, em qualquer projeto — ver SinoPendencias.
      extraDoRodape={(recolhida) => <div className={cx("flex", recolhida ? "justify-center" : "justify-start")}><SinoPendencias /></div>}
      extraDoTopoMovel={<SinoPendencias />}
      // O PageShell de cada tela cuida do recuo e da largura máxima.
      telaCheia
      faixaDoTopo={
        /* Deploy novo publicado com a aba aberta: todos passam a ver o mesmo aplicativo assim
           que clicam (ver `useVersaoDoApp`). */
        versaoNova ? (
          <div className="no-print flex items-center justify-center gap-3 flex-wrap bg-navy text-navy-foreground px-4 py-2 text-sm font-semibold">
            <span>Há uma versão nova do aplicativo. Atualize para usar a mais recente.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-brand text-primary-foreground px-3 py-1 text-xs font-semibold hover:bg-brand-vivid"
            >
              Atualizar agora
            </button>
          </div>
        ) : undefined
      }
      antesDoConteudo={<ConviteAvisos />}
    >
      <div className="flex min-h-full flex-col">
        <Suspense fallback={<div className="flex-1 grid place-items-center text-muted-foreground text-sm">Carregando…</div>}>
          <Outlet />
        </Suspense>
      </div>
      <Toaster />
      <ConfirmDialog />
      {/* O tour atravessa várias rotas: a sobreposição precisa viver AQUI, na casca. */}
      <TourOverlay />
      {/* O Help Desk é um painel sobre a tela: abre de qualquer lugar sem tirar ninguém do lugar. */}
      <PainelSuporte />
      {minhaConta && <MinhaContaModal onClose={() => setMinhaConta(false)} />}
    </CascaDoApp>
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
    {/* <div>, não <main>: o <main> é o da casca (um só por página). */}
    <div className="flex-1 px-(--gutter) pb-5 md:pb-6 max-w-[1600px] w-full mx-auto">
      <div
        ref={medirCabecalho}
        className={cx(
          "cabecalho-pagina md:sticky top-(--altura-topnav) z-20 -mx-(--gutter) px-(--gutter) pt-4 mb-4",
          // Fundo da página quase cheio: o conteúdo que passa por baixo não atravessa o título.
          "bg-background/95 backdrop-blur-[6px]",
          // Quem fecha o bloco embaixo é o fio da barra de subguias, quando ela
          // existe: dois fios colados viravam uma faixa dupla.
          subabas ? "pb-0" : "pb-3 border-b border-border"
        )}
      >
        {breadcrumb && (
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground font-medium min-w-0">
            {breadcrumb}
          </div>
        )}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[26px] font-bold tracking-tight text-foreground leading-tight">
                {title}
              </h1>
              {titleAdornment}
            </div>
            {legenda}
            {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
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
          <div data-tour="subguias" className="mt-3 -mx-(--gutter) px-(--gutter) border-b border-border overflow-x-auto">{subabas}</div>
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
    </div>
    </ProvedorRecolher>
  );
}

/** Um observador por vez: só existe um PageShell montado de cada vez. */
let observadorCabecalho: ResizeObserver | null = null;

/** Item de breadcrumb simples. */
export function Crumb({ children }: { children: ReactNode }) {
  return <span className="text-foreground font-semibold">{children}</span>;
}
