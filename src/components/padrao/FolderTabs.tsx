import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type FolderTabOption<T extends string> = {
  value: T;
  label: string;
  badge?: string | number;
  disabled?: boolean;
};

/**
 * Conteúdo da aba: a superfície branca em que a aba ativa emenda.
 *
 * A regra é uma só — a aba ativa é branca, então o que vem logo embaixo dela é sempre
 * branco. Por isso o painel é ele mesmo a superfície (fundo, borda e sombra de card), e não
 * depende de o conteúdo trazer um card como primeiro filho. Já existiu um modo "solto" em que
 * filtros e grades de cards ficavam direto no cinza da página: a aba branca emendava em nada
 * e parecia um papel boiando. Filtros, grades e cards moram DENTRO do painel; os cards
 * internos perdem a sombra (`.painel-pasta .card-surface`, em styles.css) e ficam só com a
 * borda — card flutuando sobre card é hierarquia que não existe.
 *
 * `border-t-0`: a linha de cima é o chão da barra das abas, que já foi desenhado lá e some
 * sob a aba ativa. Uma segunda borda aqui atravessaria por baixo dela.
 *
 * `semRecuo` é para quando o próprio conteúdo já é o miolo de um card, com faixas de ponta a
 * ponta (cabeçalho de filtros com divisória, tabela sangrada). A cor é a mesma; só some o
 * respiro, e quem usa não põe outro `card-surface` por dentro.
 *
 * A troca de aba ganha um fade curto no conteúdo que entra — mora em `.painel-pasta > *`
 * (styles.css), e não aqui, porque o painel não sabe qual aba está ativa; quem remonta ao trocar
 * é o filho.
 */
export function FolderPanel({ children, className, semRecuo = false }: {
  children: ReactNode;
  className?: string;
  semRecuo?: boolean;
}) {
  return (
    <div className={cn(
      "painel-pasta rounded-b-xl border border-t-0 border-border bg-card shadow-(--sombra-superficie)",
      semRecuo ? "overflow-hidden" : "p-4",
      className,
    )}>
      {children}
    </div>
  );
}

export type FolderTabsProps<T extends string> = {
  value: T;
  options: readonly FolderTabOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
};

/**
 * A barra em que as abas se apoiam — o topo do painel da seção, sempre seguido de um
 * `FolderPanel`. Os dois juntos são uma pasta só: a barra cinza com as abas, o painel branco
 * embaixo, e a aba ativa, branca, abrindo passagem entre os dois.
 *
 * Sem `border-b`: o chão das abas é desenhado pela própria fileira (ver `FolderTabs`), que é
 * onde a aba ativa consegue apagá-lo. Borda na barra passaria por baixo da aba ativa.
 */
export function FolderTabsBar<T extends string>({ className, ...abas }: FolderTabsProps<T>) {
  return (
    <div className={cn("barra-abas rounded-t-xl border border-b-0 border-border bg-muted/35 pt-3", className)}>
      <FolderTabs {...abas} className="px-4 pt-0" />
    </div>
  );
}

/**
 * A fileira de abas, com o próprio chão.
 *
 * O chão é uma sombra interna de 1px, e não `border-b`, por causa do `overflow-x-auto`: com
 * borda, a aba teria de descer 1px (`-mb-px`) para cobri-la e o overflow cortaria exatamente
 * esse pixel — a linha voltaria a aparecer sob a aba ativa. A sombra é pintada no fundo da
 * fileira, dentro da caixa, e a aba ativa (branca, borda de baixo branca, `z-10`) passa por
 * cima dela. Resultado: a linha corre sob as inativas e some sob a ativa, que emenda no que
 * vem embaixo.
 *
 * Isso também vale fora da barra (modais): o que vier logo abaixo da fileira precisa ser
 * branco, pela mesma regra do `FolderPanel`.
 *
 * Quando as abas não cabem, a fileira rola na horizontal, mas sem barra de rolagem: a barra
 * cinza grossa embaixo das abas parecia um defeito do cabeçalho, e só quem tem trackpad
 * conseguia usá-la sem mirar. No lugar dela, um `>` discreto na ponta direita (e o `<` na
 * esquerda depois de rolar) avança uma "página" de abas. As setas ficam FORA do
 * `role="tablist"` — a lista de abas só pode ter abas — e fora da ordem do Tab: o teclado já
 * alcança cada aba, e a aba focada é trazida para a vista (`onFocus`).
 */
export function FolderTabs<T extends string>({ value, options, onChange, ariaLabel = "Seções", className }: FolderTabsProps<T>) {
  const fileiraRef = useRef<HTMLDivElement>(null);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(false);

  // 1px de folga nas duas pontas: com zoom do navegador o `scrollLeft` vem fracionado e o fim
  // da rolagem pode parar em 0.5 do limite — sem a folga, a seta nunca sumiria.
  const medir = useCallback(() => {
    const fileira = fileiraRef.current;
    if (!fileira) return;
    const { scrollLeft, scrollWidth, clientWidth } = fileira;
    setPodeVoltar(scrollLeft > 1);
    setPodeAvancar(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  // Tela redimensionada, sidebar recolhida, badge que cresceu: qualquer um muda o que cabe, e
  // nenhum deles dispara `scroll`. Observa a fileira (largura visível) e as abas (largura do
  // conteúdo).
  useEffect(() => {
    const fileira = fileiraRef.current;
    if (!fileira) return;
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(fileira);
    for (const aba of Array.from(fileira.children)) observador.observe(aba);
    return () => observador.disconnect();
  }, [medir, options]);

  // A aba ativa sempre à vista, ao abrir a tela e a cada troca. A primeira vez vai seca: a tela
  // acabou de montar, e deslizar ali seria a fileira "correndo" sozinha diante da pessoa.
  const primeiraVez = useRef(true);
  useLayoutEffect(() => {
    const ativa = fileiraRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (ativa) trazerParaVista(ativa, primeiraVez.current ? "auto" : comportamentoRolagem());
    primeiraVez.current = false;
  }, [value]);

  function trazerParaVista(aba: HTMLElement, behavior: ScrollBehavior) {
    const fileira = fileiraRef.current;
    if (!fileira || fileira.scrollWidth <= fileira.clientWidth + 1) return;
    const caixa = fileira.getBoundingClientRect();
    const alvo = aba.getBoundingClientRect();
    // A margem é a largura da seta: parar a aba colada na borda a deixaria debaixo do degradê,
    // e a seta cobriria justamente a emenda da aba ativa com o painel. Nas pontas da fileira o
    // navegador limita a rolagem a 0 e ao máximo, então a primeira e a última aba não sobram.
    let delta = 0;
    if (alvo.left < caixa.left + LARGURA_SETA) delta = alvo.left - caixa.left - LARGURA_SETA;
    else if (alvo.right > caixa.right - LARGURA_SETA) delta = alvo.right - caixa.right + LARGURA_SETA;
    if (delta !== 0) rolar(fileira, delta, behavior);
  }

  // Uma "página": a largura visível menos o que as duas setas cobrem. A aba que estava cortada
  // sob a seta da direita reaparece inteira logo depois da seta da esquerda — a pessoa não perde
  // o fio de onde estava.
  function paginar(sentido: 1 | -1) {
    const fileira = fileiraRef.current;
    if (!fileira) return;
    const pagina = Math.max(fileira.clientWidth - 2 * LARGURA_SETA, fileira.clientWidth / 2);
    rolar(fileira, sentido * pagina, comportamentoRolagem());
  }

  const seta = "flex h-full w-7 items-center justify-center text-muted-foreground/60 transition-colors duration-(--duracao-rapida) ease-saida hover:text-navy";

  return (
    <div className="relative min-w-0 shrink-0">
      {/* Sem padding horizontal por padrão: quem monta as abas dentro de um container com recuo
          passa o `px` próprio pela `className`, e a linha do chão continua de ponta a ponta. */}
      <div ref={fileiraRef} onScroll={medir} className={cn("fileira-abas flex items-end gap-1 overflow-x-auto pt-1 shadow-[inset_0_-1px_0_var(--color-border)]", className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onFocus={(evento: FocusEvent<HTMLButtonElement>) => trazerParaVista(evento.currentTarget, comportamentoRolagem())}
            className={cn(
              "relative whitespace-nowrap rounded-t-lg border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "z-10 border-border border-b-card bg-card text-brand-forte shadow-[0_-2px_7px_rgb(13_43_94/0.04)]"
                : "border-transparent border-b-border bg-muted/55 text-muted-foreground hover:bg-muted hover:text-navy",
            )}
          >
            {option.label}
            {option.badge !== undefined && (
              // `key` no número: a contagem que muda (pendência resolvida, filtro) troca com fade, e o
              // olho registra que ela não é mais a mesma. Só opacidade — o selo é inline no rótulo.
              <span key={option.badge} className={cn("valor-troca ml-1.5 rounded-full px-1.5 py-0.5 text-2xs font-bold tabular-nums", active ? "bg-brand/10 text-brand-forte" : "bg-background/80 text-muted-foreground")}>{option.badge}</span>
            )}
          </button>
        );
      })}
      </div>
      {/* O degradê termina 1px acima do fundo (`bottom-px`) para não apagar o chão da fileira,
          e não recebe clique: só a seta é alvo, o resto deixa passar para a aba embaixo. */}
      {podeVoltar && (
        <div className="seta-abas seta-abas-esquerda entrada-fade pointer-events-none absolute left-0 top-0 bottom-px flex w-12 justify-start">
          <button type="button" tabIndex={-1} aria-label="Mostrar abas anteriores" onClick={() => paginar(-1)} className={cn(seta, "pointer-events-auto")}>
            <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}
      {podeAvancar && (
        <div className="seta-abas seta-abas-direita entrada-fade pointer-events-none absolute right-0 top-0 bottom-px flex w-12 justify-end">
          <button type="button" tabIndex={-1} aria-label="Mostrar mais abas" onClick={() => paginar(1)} className={cn(seta, "pointer-events-auto")}>
            <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/** Largura da seta com o degradê (`w-12`), usada também como margem ao trazer uma aba para a vista. */
const LARGURA_SETA = 48;

function comportamentoRolagem(): ScrollBehavior {
  const reduzir = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return reduzir ? "auto" : "smooth";
}

function rolar(fileira: HTMLElement, delta: number, behavior: ScrollBehavior) {
  if (typeof fileira.scrollBy === "function") fileira.scrollBy({ left: delta, behavior });
  else fileira.scrollLeft += delta;
}
