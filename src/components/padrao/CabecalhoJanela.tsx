/**
 * A faixa navy no topo de todo modal do app.
 *
 * Cada janela desenhava o próprio cabeçalho — umas brancas com `border-b`, outras navy, cada uma
 * com uma altura, um tamanho de título e um botão de fechar diferente —, e o usuário pediu que
 * todas tivessem o mesmo cabeçalho azul-escuro. Centralizar aqui é o que impede a deriva de
 * voltar: a faixa é a separação entre título e corpo, então não leva borda embaixo.
 *
 * Vai como primeiro filho do painel da `JanelaModal`, que precisa de `overflow-hidden` para a
 * faixa acompanhar o canto arredondado. Abas (`FolderTabs`) e filtros ficam FORA dela, logo
 * abaixo: a aba ativa é branca e precisa emendar em superfície branca, não no navy.
 */
import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePedirParaSairDaJanela } from "@/components/padrao/JanelaModal";

/** Selo legível sobre o navy — o `bg-*-100` de fundo claro some na faixa escura. */
export const SELO_NA_FAIXA = "inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white";

/** Botão de ação secundária dentro da faixa (imprimir, voltar, baixar). */
// Contornado e com fundo leve (nov/2026, pedido do usuário: os botões soltos no navy pareciam
// texto e se emendavam uns nos outros). Todos com a mesma altura e borda, para a fileira ler
// como um grupo; o de perigo tem tom próprio em vez do vermelho cheio, que gritava na faixa.
export const BOTAO_NA_FAIXA =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/20 bg-white/[0.06] px-3 text-xs font-semibold text-white/90 transition-colors hover:border-white/40 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-40";

/** Ação destrutiva na faixa navy (Excluir): contorno e texto avermelhados, cheio só no hover. */
export const BOTAO_PERIGO_NA_FAIXA =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-destructive-foreground/40 bg-destructive/25 px-3 text-xs font-semibold text-destructive-foreground transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Botão só de ícone na faixa: quadrado, SEM o `px-3` do `BOTAO_NA_FAIXA`. Somar `px-0` por cima
 * não funcionava — as duas classes de padding brigavam pela ordem do CSS, o `px-3` vencia e o
 * ícone encolhia para 6 px dentro de um botão de 32 (caso do "Atualizar da Secullum", nov/2026).
 */
export const BOTAO_ICONE_NA_FAIXA =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/[0.06] text-white/90 transition-colors hover:border-white/40 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-40";

type Props = {
  titulo: ReactNode;
  /** Linha de contexto sob o título (colaborador, período, explicação curta). */
  subtitulo?: ReactNode;
  /** Rótulo pequeno em caixa-alta acima do título (a área do app, por exemplo). */
  sobretitulo?: ReactNode;
  icone?: LucideIcon;
  /** `id` do título, para o `rotuloId` da `JanelaModal`. */
  tituloId?: string;
  /** Sem ele não há botão de fechar — para a janela que só fecha pelos botões do rodapé. */
  onFechar?: () => void;
  /** Gravando ou lendo arquivo: o "Fechar" fica no lugar, mas não responde. */
  fecharDesabilitado?: boolean;
  /** Botões à direita, antes do "Fechar". Use `BOTAO_NA_FAIXA` para ficarem legíveis no navy. */
  acoes?: ReactNode;
  /** Antes do ícone — o "Voltar" de um assistente em passos. */
  antes?: ReactNode;
  /** Selos e detalhes sob o subtítulo. Use `SELO_NA_FAIXA`. */
  children?: ReactNode;
  className?: string;
};

export function CabecalhoJanela({
  titulo, subtitulo, sobretitulo, icone: Icone, tituloId, onFechar, fecharDesabilitado, acoes, antes, children, className,
}: Props) {
  // Dentro de uma `JanelaModal` com formulário sujo, o X pergunta como o ESC e o clique fora.
  const pedirParaSair = usePedirParaSairDaJanela();
  const fechar = onFechar && pedirParaSair ? () => { void pedirParaSair(onFechar); } : onFechar;
  return (
    <div className={cn("flex min-h-16 shrink-0 items-center justify-between gap-3 bg-navy px-5 py-3 text-white", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {antes}
        {Icone && (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
            <Icone className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {sobretitulo && <p className="text-[11px] font-medium text-white/65">{sobretitulo}</p>}
          <h2 id={tituloId} className="truncate text-[1.0625rem] font-bold tracking-[-0.01em] text-white">{titulo}</h2>
          {subtitulo && <p className="text-xs text-white/70">{subtitulo}</p>}
          {children}
        </div>
      </div>
      {(acoes || onFechar) && (
        <div className="flex shrink-0 items-center gap-2">
          {acoes}
          {onFechar && (
            <button
              type="button"
              onClick={fechar}
              disabled={fecharDesabilitado}
              aria-label="Fechar"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
