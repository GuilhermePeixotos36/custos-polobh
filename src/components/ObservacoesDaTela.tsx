/**
 * As OBSERVAÇÕES DA TELA — um balão no canto do cabeçalho que abre a conversa numa gaveta.
 *
 * Toda tela do sistema tem duas camadas de conversa: a do DETALHE, presa ao item ("este buffet
 * está caro"), e a do CONJUNTO, que fala do documento ou da etapa inteira ("o cliente cortou o
 * coffee break"). A do conjunto morava num cartão no alto da tela — título, texto explicativo,
 * letra miúda e a thread —, e ocupava o primeiro palmo de toda aba, de toda EC e de toda OS,
 * inclusive para quem só queria ver a lista. "Ocupa um espaço gigantesco e está muito feio"
 * (dono do app, 24/11/2026). Agora o que fica na tela é um botão de altura fixa no canto
 * superior direito do cabeçalho: o ícone, quantas observações há e, em vermelho, quantas são
 * SUAS. A conversa inteira — ler, escrever, @mencionar, responder, resolver — abre ao lado.
 *
 * GAVETA, e não popover. Escrever uma observação é olhar a tela enquanto escreve ("falta o Pix
 * do fornecedor"): a gaveta não tem véu nem fecha no clique fora, então a página continua
 * rolável e legível atrás dela. Fecha no X e no ESC, e devolve o foco ao botão.
 *
 * A thread fica SEMPRE montada (só escondida com `hidden` quando a gaveta está fechada), e isso
 * é o que mantém o navegador de pendências funcionando:
 *  · a âncora DOM (`ancoraDom`, o `id` que a pílula procura) existe o tempo todo, então o
 *    contorno vermelho e a contagem continuam achando o lugar;
 *  · quando a pílula (ou o sininho) salta para uma observação desta conversa, a gaveta ouve o
 *    salto (`aoFocarPendencia`) e se abre DE FORMA SÍNCRONA (`flushSync`), antes de o destaque
 *    — que é agendado — procurar o elemento: assim a rolagem e o pisca acontecem com a
 *    gaveta já visível. Quem pisca o comentário exato continua sendo a própria thread;
 *  · o salto que veio de OUTRA tela fica guardado (`focoPendencia`) até a thread montar; a
 *    gaveta espia esse recado no primeiro render (`haAlvoPendente`) e já nasce aberta.
 *
 * Quem grava é quem chama, como no antigo cartão de conversa (CardConversa, removido em 24/11/2026): a EC e as abas do projeto gravam na
 * hora, por caminho próprio (comentar não é editar o documento); a OS acumula no formulário e
 * vai junto do "Salvar".
 */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { MessageSquare } from "lucide-react";

import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { NotifDot } from "@/components/NotifDot";
import { aoFocarPendencia, haAlvoPendente } from "@/lib/focoPendencia";
import { useFecharComEsc } from "@/lib/modalEsc";
import { cn } from "@/lib/utils";
import type { Observacao } from "@/data/types";

/**
 * O TÍTULO e o TEXTO são os mesmos em toda etapa do sistema (pedido de 15/09/2026): EC, OS,
 * check-list, cronograma, credenciamento, fornecedores e dados gerais. Cada tela passava a sua
 * variação, e o que era a mesma ferramenta parecia cinco coisas diferentes.
 */
export const TITULO_CONVERSA = "Observações";
export const TEXTO_CONVERSA =
  "Neste campo a equipe da Pólobh registra suas observações e pendências sobre esta etapa do trabalho.";

export function ObservacoesDaTela({
  ancora,
  ancoraDom,
  observacoes,
  usuarios,
  minhas,
  onChange,
  contexto,
}: {
  /** Chave da conversa para o sistema de pendências (ver `domain/pendencias`). */
  ancora: string;
  /**
   * `id` no DOM que a pílula de pendências procura, quando a âncora da pendência É esta
   * conversa (abas do projeto, conversa geral da EC). Na OS a âncora é a própria OS — a mesma
   * de "concluir e enviar" —, e ela fica na faixa de etapas da tela, não aqui: senão um salto
   * para "enviar a OS" abriria a gaveta de conversa.
   */
  ancoraDom?: string;
  observacoes: Observacao[];
  usuarios: string[];
  /** Quantas pendências desta conversa são de quem está olhando. */
  minhas: number;
  onChange: (observacoes: Observacao[]) => void;
  /** De que etapa é esta conversa ("Check-list", "OS 0123") — vai sob o título da gaveta. */
  contexto?: string;
}) {
  // Nasce aberta quando o sininho deixou um salto para esta conversa (ver o comentário do topo).
  const [aberta, setAberta] = useState(() => haAlvoPendente(ancora));
  const botao = useRef<HTMLButtonElement>(null);
  const gaveta = useRef<HTMLElement>(null);
  const idGaveta = `${useId()}-observacoes`;
  const idTitulo = `${idGaveta}-titulo`;

  const validas = observacoes.filter((o) => o.texto.trim());
  const n = validas.length;
  const abertas = validas.filter((o) => !o.resolvida).length;

  function fechar() {
    setAberta(false);
    botao.current?.focus();
  }
  useFecharComEsc(fechar, aberta);

  // Abrir leva o foco para a gaveta: quem usa teclado não precisa caçá-la no fim da página.
  useEffect(() => {
    if (aberta) gaveta.current?.focus({ preventScroll: true });
  }, [aberta]);

  // O salto da pílula / do sininho para uma observação desta conversa abre a gaveta. Devolve
  // `false` de propósito: quem ATENDE o salto (abre a lista, pisca o comentário) é a thread.
  useEffect(
    () =>
      aoFocarPendencia((alvo) => {
        if (alvo.ancora !== ancora) return false;
        if (alvo.observacaoId || ancoraDom) flushSync(() => setAberta(true));
        return false;
      }),
    [ancora, ancoraDom]
  );

  const tom = minhas > 0 ? "perigo" : abertas > 0 ? "marca" : "neutro";
  const resumo = [
    n === 0 ? "nenhuma observação" : `${n} ${n === 1 ? "observação" : "observações"}`,
    abertas > 0 ? `${abertas} em aberto` : "",
    minhas > 0 ? `${minhas} ${minhas === 1 ? "pendência sua" : "pendências suas"}` : "",
  ].filter(Boolean).join(", ");

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => (aberta ? fechar() : setAberta(true))}
        aria-expanded={aberta}
        aria-controls={idGaveta}
        aria-label={`Observações: ${resumo}`}
        title={`Observações da equipe — ${resumo}`}
        className={cn(
          "relative inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
          tom === "perigo" && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
          tom === "marca" && "border-brand/25 bg-brand-soft/60 text-brand-forte hover:bg-brand-soft",
          tom === "neutro" && "border-input bg-card text-foreground hover:bg-muted",
        )}
      >
        <MessageSquare aria-hidden className="h-4 w-4" />
        <span className="max-sm:sr-only">Observações</span>
        {n > 0 && (
          <span
            // `key`: o número que muda troca com movimento, e o olho percebe que não é o mesmo.
            key={n}
            className={cn(
              "contagem-troca inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-bold tabular-nums",
              tom === "perigo" ? "bg-destructive text-white" : tom === "marca" ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {n}
          </span>
        )}
        {/* O que é SEU fica fora do balão fechado: a bolinha vermelha é a mesma do resto do app. */}
        <NotifDot n={minhas} title={`${minhas} pendência(s) sua(s) nesta conversa`} />
      </button>

      {createPortal(
        <aside
          ref={gaveta}
          id={idGaveta}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-labelledby={idTitulo}
          // Fechada, ela só some (`hidden`): a thread e a âncora continuam no DOM — ver o topo.
          hidden={!aberta}
          className={cn(
            "painel-suporte no-print fixed inset-y-0 right-0 z-60 w-full flex-col border-l border-border bg-card shadow-(--sombra-flutuante) outline-none sm:w-[440px]",
            aberta ? "flex" : "hidden",
          )}
        >
          <CabecalhoJanela
            icone={MessageSquare}
            tituloId={idTitulo}
            titulo={TITULO_CONVERSA}
            subtitulo={contexto}
            onFechar={fechar}
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <p className="text-xs text-muted-foreground">{TEXTO_CONVERSA}</p>
            {/* A garantia de que isto é interno fica, em letra miúda: é o que faz a equipe
                escrever à vontade. */}
            <p className="mt-1 text-2xs text-muted-foreground">
              Não sai em documento, e-mail nem planilha — quem é @mencionado fica com a pendência.
            </p>
            <div id={ancoraDom} className="mt-3 rounded-md">
              <ObservacoesThread
                abertaDeInicio
                className="border-t-0! px-0! py-0!"
                ancora={ancora}
                observacoes={observacoes}
                usuarios={usuarios}
                onChange={onChange}
              />
            </div>
          </div>
        </aside>,
        document.body,
      )}
    </>
  );
}
