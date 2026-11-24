import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { LIMITE_RENDERIZADO, filtrarOpcoes, proximoDestaque, type OpcaoCombo } from "@/lib/comboFiltro";

export type { OpcaoCombo } from "@/lib/comboFiltro";

/**
 * Caixa combinada: um `<select>` que se pesquisa digitando.
 *
 * O app inteiro usa `<select>` nativo, e nos seletores de colaborador e de gestor isso são
 * centenas de opções: quem procura alguém tem que rolar a lista inteira, porque o `<select>`
 * só casa o começo do texto e só enquanto as teclas vêm rápido. Aqui a busca é por qualquer
 * pedaço do rótulo ou do detalhe, sem acento e sem caixa (ver `src/lib/comboFiltro.ts`).
 *
 * Fechado, o campo tem a mesma altura, borda e foco dos `<select>` do repo, de propósito: ele
 * vai aparecer lado a lado com eles em formulários que não serão convertidos de uma vez.
 */

/**
 * Acima do modal mais alto do app.
 *
 * O modal mais alto NÃO é 9996: o app chega a 10030 (o de horas da folha), e há 10020 em
 * parcelamentos e importação de consignado, ambos abertos por dentro de outro modal em 10000.
 * A lista sai por portal no `body`, então a comparação é direta com esses valores — com 9999 ela
 * sumia atrás da sobreposição justamente nos formulários empilhados, que são onde mais se erra
 * de digitação. Ao subir modal novo acima disto, este número sobe junto.
 */
const CAMADA = 10040;
const ALTURA_MAXIMA = 288;
const MARGEM = 8;

type Props = {
  valor: string;
  opcoes: readonly OpcaoCombo[];
  onChange: (valor: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  disabled?: boolean;
  /** Texto quando a busca não acha nada. */
  vazio?: string;
  className?: string;
  /**
   * Quantas opções entram na lista (padrão `LIMITE_RENDERIZADO`). Lista que a pessoa precisa
   * ver inteira, em ordem, sem digitar — a escolha de quem ganha acesso — passa um limite maior.
   */
  limite?: number;
};

export function ComboBox({
  valor,
  opcoes,
  onChange,
  placeholder = "Selecione",
  "aria-label": rotuloAcessivel,
  disabled = false,
  vazio = "Nenhuma opção encontrada",
  className,
  limite = LIMITE_RENDERIZADO,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [destaque, setDestaque] = useState(0);
  const [posicao, setPosicao] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  const campo = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const idBase = useId();
  const idLista = `${idBase}-lista`;
  const idOpcao = (indice: number) => `${idBase}-opcao-${indice}`;

  const selecionada = useMemo(() => opcoes.find((opcao) => opcao.valor === valor), [opcoes, valor]);
  const { visiveis, total } = useMemo(() => filtrarOpcoes(opcoes, aberto ? busca : "", limite), [opcoes, busca, aberto, limite]);
  const ocultas = total - visiveis.length;

  function abrir() {
    if (disabled || aberto) return;
    setBusca("");
    // Abrir já apontando para a opção atual: quem abre para conferir o que está escolhido não
    // deveria ter que procurar de novo.
    // Fora do corte de renderização a opção atual nem está na tela; o destaque volta ao topo.
    const atual = valor ? opcoes.findIndex((opcao) => opcao.valor === valor) : -1;
    setDestaque(atual >= 0 && atual < limite ? atual : 0);
    setAberto(true);
  }

  /** Fecha sem mexer no valor — é o que o ESC, o Tab e o clique fora fazem. */
  function fechar() {
    setAberto(false);
    setBusca("");
  }

  function escolher(opcao: OpcaoCombo | undefined) {
    if (!opcao) return;
    onChange(opcao.valor);
    fechar();
  }

  // Posição fixa calculada a partir do campo, com a lista pendurada no `body`: os formulários
  // do app vivem dentro de modais e drawers com `overflow-y-auto`, e uma lista no fluxo era
  // cortada na borda deles. O recálculo escuta a rolagem em captura para pegar também a do
  // contêiner interno, não só a da janela.
  useLayoutEffect(() => {
    if (!aberto) return;
    function posicionar() {
      const area = campo.current?.getBoundingClientRect();
      if (!area) return;
      const abaixo = window.innerHeight - area.bottom - MARGEM;
      const acima = area.top - MARGEM;
      const paraCima = abaixo < 180 && acima > abaixo;
      const altura = Math.min(ALTURA_MAXIMA, paraCima ? acima : abaixo);
      const nova = {
        left: Math.min(Math.max(MARGEM, area.left), Math.max(MARGEM, window.innerWidth - area.width - MARGEM)),
        top: paraCima ? area.top - altura - 4 : area.bottom + 4,
        width: area.width,
        maxHeight: altura,
      };
      // Posição igual devolve o mesmo objeto: rolar outra coisa da tela (a página atrás do modal)
      // não pode repintar a lista inteira a cada evento de rolagem.
      setPosicao((atual) => atual
        && atual.left === nova.left && atual.top === nova.top
        && atual.width === nova.width && atual.maxHeight === nova.maxHeight ? atual : nova);
    }
    // A rolagem dispara dezenas de eventos por quadro; recalcular em cada um só gasta. Um cálculo
    // por quadro é o que a tela consegue mostrar — a lista acompanha o campo sem ficar para trás.
    // A primeira posição continua síncrona: a lista não pode nascer num quadro sem lugar.
    let quadro = 0;
    function agendar() {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(posicionar);
    }
    posicionar();
    window.addEventListener("scroll", agendar, true);
    window.addEventListener("resize", agendar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("scroll", agendar, true);
      window.removeEventListener("resize", agendar);
    };
  }, [aberto, visiveis.length]);

  // Clique fora fecha. `pointerdown` e não `click` para fechar antes que o alvo do clique se
  // mova por causa do fechamento.
  useEffect(() => {
    if (!aberto) return;
    function aoApontar(evento: PointerEvent) {
      const alvo = evento.target as Node;
      if (campo.current?.contains(alvo) || lista.current?.contains(alvo)) return;
      fechar();
    }
    document.addEventListener("pointerdown", aoApontar, true);
    return () => document.removeEventListener("pointerdown", aoApontar, true);
  }, [aberto]);

  // A opção destacada sempre visível: navegar de seta por 50 linhas não pode levar o destaque
  // para fora da área que rola.
  useEffect(() => {
    if (!aberto) return;
    lista.current?.querySelector<HTMLElement>(`#${CSS.escape(idOpcao(destaque))}`)?.scrollIntoView({ block: "nearest" });
  }, [aberto, destaque, visiveis]);

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    switch (evento.key) {
      case "ArrowDown":
      case "ArrowUp": {
        evento.preventDefault();
        if (!aberto) return abrir();
        setDestaque((atual) => proximoDestaque(atual, visiveis.length, evento.key === "ArrowDown" ? 1 : -1));
        return;
      }
      case "Home":
      case "End": {
        if (!aberto) return;
        evento.preventDefault();
        setDestaque(evento.key === "Home" ? 0 : visiveis.length - 1);
        return;
      }
      case "Enter": {
        if (!aberto) return; // Sem lista aberta o Enter é do formulário, não nosso.
        evento.preventDefault();
        escolher(visiveis[destaque]);
        return;
      }
      case "Escape": {
        if (!aberto) return;
        // Trava o ESC aqui: `useFecharComEsc` ouve no documento e fecharia o modal inteiro
        // junto com a lista (ele respeita `defaultPrevented`).
        evento.preventDefault();
        evento.stopPropagation();
        fechar();
        return;
      }
      case "Tab": {
        if (aberto) fechar(); // Tab sai do campo sem escolher — o valor anterior fica.
        return;
      }
      default:
        return;
    }
  }

  return (
    <div ref={campo} className={cn("relative", className)}>
      <input
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={aberto && visiveis[destaque] ? idOpcao(destaque) : undefined}
        aria-label={rotuloAcessivel}
        disabled={disabled}
        autoComplete="off"
        placeholder={selecionada ? selecionada.rotulo : placeholder}
        value={aberto ? busca : (selecionada?.rotulo ?? "")}
        onChange={(evento) => {
          if (!aberto) abrir();
          setBusca(evento.target.value);
          setDestaque(0);
        }}
        onFocus={abrir}
        onClick={abrir}
        onKeyDown={aoTeclar}
        className={cn(
          "h-9 w-full cursor-pointer rounded-md border border-input bg-card pl-3 pr-8 text-sm text-navy outline-none transition-colors placeholder:text-muted-foreground focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          aberto && "ring-1 ring-ring",
        )}
      />
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform",
          aberto && "rotate-180",
        )}
      />

      {aberto && posicao
        ? createPortal(
            <div
              ref={lista}
              style={{ left: posicao.left, top: posicao.top, width: posicao.width, maxHeight: posicao.maxHeight, zIndex: CAMADA }}
              className="entrada-fade fixed flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-(--sombra-flutuante)"
            >
            <ul
              id={idLista}
              role="listbox"
              aria-label={rotuloAcessivel}
              className="flex-1 overflow-y-auto overscroll-contain py-1"
            >
              {visiveis.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">{vazio}</li>
              ) : (
                visiveis.map((opcao, indice) => {
                  const escolhida = opcao.valor === valor;
                  return (
                    <li
                      key={opcao.valor}
                      id={idOpcao(indice)}
                      role="option"
                      aria-selected={escolhida}
                      // `onMouseDown` e não `onClick`: o clique tira o foco do campo antes do
                      // `click` chegar, e a opção some com o fechamento no meio do caminho.
                      onMouseDown={(evento) => {
                        evento.preventDefault();
                        escolher(opcao);
                      }}
                      onMouseEnter={() => setDestaque(indice)}
                      className={cn(
                        "cursor-pointer px-3 py-1.5 text-sm",
                        indice === destaque ? "bg-brand/10 text-navy" : "text-navy",
                        escolhida && "font-semibold",
                      )}
                    >
                      <span className="block truncate">{opcao.rotulo}</span>
                      {opcao.detalhe ? (
                        <span className="block truncate text-xs text-muted-foreground">{opcao.detalhe}</span>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
            {ocultas > 0 ? (
              <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
                mais {ocultas} — refine a busca
              </p>
            ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
