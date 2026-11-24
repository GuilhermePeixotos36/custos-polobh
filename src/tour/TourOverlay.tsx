/**
 * A sobreposição do tour: o buraco de luz em cima do elemento e o balão que
 * explica.
 *
 * Duas decisões de desenho que evitam os defeitos clássicos deste tipo de tela:
 *
 *  · O BURACO É UM ELEMENTO SÓ, com uma sombra gigante (`box-shadow` de
 *    9999px). A alternativa comum — quatro retângulos escuros em volta do alvo —
 *    deixa fresta de um pixel nas junções e desalinha em zoom fracionado. Aqui
 *    não há junção: o escuro é a sombra do próprio buraco, e o buraco é o
 *    retângulo medido do elemento.
 *
 *  · NADA DE TRANSIÇÃO no retângulo. Uma animação de posição parece bonita na
 *    troca de passo e atrapalha no resto do tempo: enquanto a página rola, o
 *    contorno fica correndo atrás do botão. Como a medição acontece a cada
 *    quadro (ver `useAlvo`), o buraco anda colado no elemento — e isso vale
 *    mais que o efeito.
 *
 * A sobreposição também BLOQUEIA cliques no app. É o que garante que ninguém
 * saia do tour com um projeto de mentira salvo: durante o passeio, o app é só
 * paisagem.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui";
import { useAuth } from "@/store/auth";
import { cx } from "@/lib/format";
import { posicionarBalao, type Lado } from "./geometria";
import { montarPassos, prepararPasso } from "./passos";
import { useAlvo } from "./useAlvo";
import { useTour } from "./store";

/** Largura do balão; em tela estreita ele encolhe junto com a janela. */
const LARGURA = 380;
const RESPIRO = 12;

export function TourOverlay() {
  const { aberto, indice, contexto, fechar, ir } = useTour();
  const pode = useAuth((s) => s.pode);
  const navigate = useNavigate();
  const local = useLocation();

  const passos = aberto ? montarPassos(contexto, pode) : [];
  const passo = aberto ? passos[Math.min(indice, passos.length - 1)] : undefined;
  const atual = passo ? prepararPasso(passo, contexto) : undefined;

  /* --------- 1. levar a pessoa até a tela do passo --------- */
  useEffect(() => {
    if (!aberto || !atual?.rota) return;
    const agora = `${local.pathname}${local.search}`;
    if (agora !== atual.rota) navigate(atual.rota);
    // Só a troca de passo dispara a navegação: incluir `local` aqui faria o
    // tour brigar com qualquer mudança de URL feita pela própria tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, atual?.id]);

  /* --------- 2. abrir a subguia que guarda o alvo --------- */
  // Algumas seções (Configurações) vivem em estado interno da tela, não na URL:
  // sem clicar na aba, o alvo do passo nunca existe no DOM.
  useEffect(() => {
    if (!aberto || !atual?.abrirAntes) return;
    let vivo = true;
    let tentativas = 0;
    const tentar = () => {
      if (!vivo) return;
      const el = document.querySelector<HTMLElement>(atual.abrirAntes!);
      if (el) {
        if (el.getAttribute("aria-selected") !== "true") el.click();
        return;
      }
      if (tentativas++ < 60) window.setTimeout(tentar, 50);
    };
    tentar();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, atual?.id]);

  /* --------- 3. medir o alvo, quadro a quadro --------- */
  const { rect, procurando } = useAlvo(atual?.alvo, atual?.id ?? "", aberto);

  /* --------- 4. medir o balão, para saber onde ele cabe --------- */
  const balaoRef = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState({ largura: LARGURA, altura: 240 });
  const [medido, setMedido] = useState(false);

  useLayoutEffect(() => setMedido(false), [atual?.id]);

  useLayoutEffect(() => {
    const el = balaoRef.current;
    if (!el || !aberto) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setTamanho((t) =>
        Math.abs(t.largura - r.width) < 0.5 && Math.abs(t.altura - r.height) < 0.5
          ? t
          : { largura: r.width, altura: r.height }
      );
      setMedido(true);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [aberto, atual?.id]);

  /* --------- 5. redesenhar quando a janela muda de tamanho --------- */
  const [, redesenhar] = useState(0);
  useEffect(() => {
    if (!aberto) return;
    const aoRedimensionar = () => redesenhar((n) => n + 1);
    window.addEventListener("resize", aoRedimensionar);
    window.addEventListener("orientationchange", aoRedimensionar);
    return () => {
      window.removeEventListener("resize", aoRedimensionar);
      window.removeEventListener("orientationchange", aoRedimensionar);
    };
  }, [aberto]);

  /* --------- 6. teclado --------- */
  const total = passos.length;
  const avancar = useCallback(() => {
    if (indice >= total - 1) fechar();
    else ir(indice + 1);
  }, [indice, total, fechar, ir]);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        avancar();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        ir(Math.max(0, indice - 1));
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, indice, avancar, fechar, ir]);

  if (!aberto || !atual) return null;

  const janela = { largura: window.innerWidth, altura: window.innerHeight };
  const largura = Math.min(LARGURA, janela.largura - RESPIRO * 2);
  const pos = posicionarBalao({
    alvo: rect,
    balao: { largura, altura: tamanho.altura },
    janela,
    preferida: atual.posicao,
    borda: RESPIRO,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-70"
      // O bloqueio do app é GEOMÉTRICO: esta camada cobre a tela inteira, então
      // todo clique para nela e nada chega ao app atrás — inclusive por cima do
      // elemento iluminado. Não use `stopPropagation` na captura para isso: ela
      // mataria também os cliques nos botões do próprio balão, que são filhos
      // desta div, e o tour ficaria sem Próximo e sem Sair.
      role="dialog"
      aria-modal="true"
      aria-label={`Tour guiado: ${atual.titulo}`}
    >
      {rect && (
        <div
          className="absolute rounded-[10px] pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            // O anel e o escuro na MESMA propriedade: assim não há um segundo
            // elemento para sair do lugar.
            boxShadow: "0 0 0 3px rgba(242,130,13,0.95), 0 0 0 9999px rgba(11,11,13,0.62)",
          }}
        />
      )}
      {/* Sem alvo, o escuro cobre a tela inteira — mesma cor, sem buraco. */}
      {!rect && <div className="absolute inset-0" style={{ background: "rgba(11,11,13,0.62)" }} />}

      <div
        ref={balaoRef}
        className={cx(
          "absolute bg-surface rounded-card shadow-[0_18px_50px_rgba(11,11,13,0.35)] border border-border",
          "flex flex-col"
        )}
        style={{
          top: pos.top,
          left: pos.left,
          width: largura,
          maxHeight: janela.altura - RESPIRO * 2,
          // O primeiro quadro do passo ainda não sabe a altura do texto novo;
          // mostrar já seria um pulo visível.
          opacity: medido ? 1 : 0,
        }}
      >
        {pos.seta !== null && <Seta lado={pos.lado} deslocamento={pos.seta} />}

        <div className="px-4 pt-3.5 pb-2 border-b border-border-soft">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary-dark">
              {atual.capitulo}
            </span>
            <span className="text-[11px] text-ink-3 tabular-nums">
              {indice + 1} / {total}
            </span>
          </div>
          <h2 className="font-display font-bold text-ink text-[17px] leading-tight mt-1">{atual.titulo}</h2>
        </div>

        <div className="px-4 py-3 space-y-2.5 overflow-y-auto">
          {atual.corpo}
          {procurando && <p className="text-[11.5px] text-ink-3">Abrindo a tela…</p>}
        </div>

        <div className="px-4 pb-3.5 pt-1 space-y-2.5">
          <div className="h-1 rounded-pill bg-[#EDEFF3] overflow-hidden">
            <div
              className="h-full bg-primary rounded-pill transition-[width] duration-300"
              style={{ width: `${((indice + 1) / total) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="text" size="sm" onClick={fechar}>
              Sair
            </Button>
            <div className="flex-1" />
            {indice > 0 && (
              <Button variant="secondary" size="sm" onClick={() => ir(indice - 1)}>
                Voltar
              </Button>
            )}
            <Button size="sm" onClick={avancar}>
              {indice >= total - 1 ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * A seta que liga o balão ao elemento. É um quadrado girado 45°, com o mesmo
 * fundo e a mesma borda do balão — duas das quatro arestas ficam escondidas
 * atrás dele, e o que sobra parece uma ponta.
 */
function Seta({ lado, deslocamento }: { lado: Lado; deslocamento: number }) {
  const horizontal = lado === "baixo" || lado === "cima";
  const estilo: React.CSSProperties = {
    position: "absolute",
    width: 12,
    height: 12,
    background: "var(--surface, #fff)",
    borderLeft: "1px solid var(--border)",
    borderTop: "1px solid var(--border)",
    transform: "rotate(45deg)",
  };
  if (horizontal) {
    estilo.left = deslocamento - 6;
    if (lado === "baixo") estilo.top = -7;
    else {
      estilo.bottom = -7;
      estilo.transform = "rotate(225deg)";
    }
  } else {
    estilo.top = deslocamento - 6;
    if (lado === "direita") {
      estilo.left = -7;
      estilo.transform = "rotate(315deg)";
    } else {
      estilo.right = -7;
      estilo.transform = "rotate(135deg)";
    }
  }
  return <span aria-hidden style={estilo} />;
}
