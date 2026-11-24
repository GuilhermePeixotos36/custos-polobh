/**
 * Cabeçalho de coluna com ORDENAR + FILTRO (decisão do dono do app, 24/11/2026).
 *
 * Cada `<th>` continua sendo o do `CabecalhoOrdenavel` — o botão de ordenar com a seta neutra no
 * cursor, a seta que gira, os dois estados, o vazio no fim, o `aria-sort` — e ganha, ao lado, um
 * funil que abre a lista dos valores daquela coluna com caixas de marcação, como o filtro do
 * Excel. A regra (o que conta como filtro ligado, o que o painel oferece) mora em
 * `filtrosColuna.ts`, com teste; aqui só o desenho.
 *
 * O estado dos filtros é da TELA, não do cabeçalho: é ela que soma os filtros de coluna no
 * contador do botão "Filtros" da `BarraFiltros`, limpa tudo no "Limpar filtros" e decide o vazio
 * por filtro. O cabeçalho recebe e devolve o mapa (`filtros` / `onFiltros`).
 *
 * Só ganha funil a coluna que tem extrator em `valoresFiltro` — Ações e colunas de controle
 * ficam como estão.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Filter, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { useFecharComEsc } from "@/lib/modalEsc";
import { usePresenca } from "@/lib/presenca";
import { CabecalhoOrdenavel, type ColunaCabecalho, type ColunaOpcional } from "./CabecalhoOrdenavel";
import type { ColunaOrdenavel, EstadoOrdenacao } from "./ordenacaoTabela";
import {
  FILTROS_DE_COLUNA_VAZIOS, VALOR_VAZIO, alternarValor, colunaFiltrada, desmarcarVisiveis, filtrosDeColunaAtivos,
  marcadosDaColuna, marcarVisiveis, opcoesDaColuna, type ExtratoresDeFiltro, type FiltrosDeColuna,
} from "./filtrosColuna";

/**
 * A coluna como a lista a declara: a do cabeçalho ordenável e, para o filtro, como escrever o
 * valor no painel — a data chega em ISO e sai "09 11 26"; o código chega 12 e sai "#12".
 */
export type ColunaDeLista = ColunaCabecalho & {
  formatarFiltro?: (valor: string) => string;
};

/** Acima do modal mais alto do app (10030), como o `PainelSuspenso` e o `ComboBox`. */
const CAMADA = 10040;
const LARGURA = 272;
const MARGEM = 8;
/** A partir de quantos valores o painel ganha busca: até aqui a lista cabe no olho. */
const BUSCA_A_PARTIR_DE = 8;

/**
 * O estado dos filtros de coluna de uma lista. `chave` entra no `resetKey` da paginação, como a
 * `chaveOrdem`: mudou o filtro, a página 4 já não quer dizer nada.
 */
export function useFiltrosDeColuna(inicial: FiltrosDeColuna = FILTROS_DE_COLUNA_VAZIOS) {
  const [filtros, setFiltros] = useState<FiltrosDeColuna>(inicial);
  return {
    filtros,
    setFiltros,
    ativos: filtrosDeColunaAtivos(filtros),
    limpar: () => setFiltros(FILTROS_DE_COLUNA_VAZIOS),
    chave: JSON.stringify(filtros),
  };
}

export function CabecalhoDeColuna<T>({
  colunas, ordem, onOrdenar, itens, valoresFiltro, filtros, onFiltros, grudado, className,
}: {
  colunas: readonly (ColunaDeLista | false | null | undefined)[];
  ordem: EstadoOrdenacao;
  onOrdenar: (coluna: ColunaOrdenavel) => void;
  /**
   * As linhas de onde saem os valores do painel — as da lista ANTES dos filtros de coluna (já
   * com a busca e as pílulas aplicadas): o painel conta sobre elas, cruzando com os filtros das
   * outras colunas.
   */
  itens?: readonly T[];
  valoresFiltro?: ExtratoresDeFiltro<T>;
  filtros?: FiltrosDeColuna;
  onFiltros?: (filtros: FiltrosDeColuna) => void;
  grudado?: boolean;
  className?: string;
}) {
  const podeFiltrar = Boolean(itens && valoresFiltro && filtros && onFiltros);
  return (
    <CabecalhoOrdenavel
      colunas={colunas as readonly ColunaOpcional[]}
      ordem={ordem}
      onOrdenar={onOrdenar}
      grudado={grudado}
      className={className}
      acessorio={podeFiltrar ? (coluna) => {
        const chave = coluna.chave;
        if (!chave || !valoresFiltro?.[chave]) return null;
        return (
          <FiltroDaColuna
            coluna={coluna as ColunaDeLista}
            chave={chave}
            itens={itens!}
            extratores={valoresFiltro}
            filtros={filtros!}
            onFiltros={onFiltros!}
          />
        );
      } : undefined}
    />
  );
}

/** O funil de uma coluna e o painel que ele abre. */
function FiltroDaColuna<T>({ coluna, chave, itens, extratores, filtros, onFiltros }: {
  coluna: ColunaDeLista;
  chave: string;
  itens: readonly T[];
  extratores: ExtratoresDeFiltro<T>;
  filtros: FiltrosDeColuna;
  onFiltros: (filtros: FiltrosDeColuna) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLElement>(null);
  const idPainel = `${useId()}-filtro`;
  const { montado, saindo } = usePresenca(aberto);
  const ligado = colunaFiltrada(filtros, chave);

  function fechar() {
    setAberto(false);
    setBusca("");
    botao.current?.focus();
  }
  useFecharComEsc(fechar, aberto);

  // Os valores só são contados com o painel aberto: são N linhas × M colunas a cada tecla da busca
  // da lista, e o painel fechado não mostra nenhum deles.
  const opcoes = useMemo(
    () => (aberto ? opcoesDaColuna(itens, chave, filtros, extratores, coluna.tipo ?? "texto") : []),
    [aberto, itens, chave, filtros, extratores, coluna.tipo],
  );
  const todos = useMemo(() => opcoes.map((o) => o.valor), [opcoes]);
  const marcados = useMemo(() => new Set(marcadosDaColuna(filtros, chave, todos)), [filtros, chave, todos]);
  const rotuloDe = (valor: string) =>
    valor === VALOR_VAZIO ? "(vazio)" : coluna.formatarFiltro ? coluna.formatarFiltro(valor) : valor;
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = termo
    ? opcoes.filter((o) => rotuloDe(o.valor).toLocaleLowerCase("pt-BR").includes(termo))
    : opcoes;
  const valoresVisiveis = visiveis.map((o) => o.valor);
  const comBusca = opcoes.length > BUSCA_A_PARTIR_DE;

  // Pendurado no `body`, posicionado pelo funil — a tabela rola de lado no celular e a célula
  // cortaria o painel. Alinhado pela esquerda do funil, sem sair da janela.
  useLayoutEffect(() => {
    if (!aberto) return;
    function posicionar() {
      const area = botao.current?.getBoundingClientRect();
      if (!area) return;
      const largura = Math.min(LARGURA, window.innerWidth - MARGEM * 2);
      setPosicao({
        left: Math.min(Math.max(MARGEM, area.left), window.innerWidth - largura - MARGEM),
        top: area.bottom + 6,
        maxHeight: Math.max(200, Math.min(420, window.innerHeight - area.bottom - MARGEM * 3)),
      });
    }
    posicionar();
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function aoApontar(evento: PointerEvent) {
      const alvo = evento.target as Node;
      if (botao.current?.contains(alvo) || painel.current?.contains(alvo)) return;
      setAberto(false);
      setBusca("");
    }
    document.addEventListener("pointerdown", aoApontar, true);
    return () => document.removeEventListener("pointerdown", aoApontar, true);
  }, [aberto]);

  // Abriu: o foco vai para dentro (a busca, ou a primeira caixa), senão o Tab seguinte sairia do
  // cabeçalho para a primeira linha da tabela e o painel ficaria para trás.
  useEffect(() => {
    if (!aberto || !posicao) return;
    const alvo = painel.current?.querySelector<HTMLElement>("input");
    alvo?.focus();
    // Só na abertura: a posição muda na rolagem, e o foco não pode pular de volta para a busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, posicao !== null]);

  const rotuloBotao = `Filtrar por ${coluna.rotulo}`;

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-label={rotuloBotao}
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        aria-haspopup="dialog"
        title={ligado ? `${rotuloBotao} (filtro ligado)` : rotuloBotao}
        // Sobre o cabeçalho grafite: desligado, o funil é contorno discreto que acende no cursor;
        // ligado, preenchido sobre o laranja, que se acha de longe numa fileira de colunas.
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-navy-foreground",
          ligado
            ? "bg-brand text-primary-foreground"
            : "text-navy-foreground/60 hover:bg-navy-foreground/15 hover:text-navy-foreground",
          aberto && !ligado && "bg-navy-foreground/15 text-navy-foreground",
        )}
      >
        <Filter aria-hidden className={cn("h-3.5 w-3.5", ligado && "fill-current")} />
      </button>

      {montado && posicao
        ? createPortal(
            <section
              ref={painel}
              id={idPainel}
              role="dialog"
              aria-label={rotuloBotao}
              aria-hidden={saindo || undefined}
              inert={saindo ? "" : undefined}
              style={{ position: "fixed", left: posicao.left, top: posicao.top, width: Math.min(LARGURA, window.innerWidth - MARGEM * 2), maxHeight: posicao.maxHeight, zIndex: CAMADA }}
              className={cn(
                saindo ? "saida-popover" : "entrada-popover",
                // O texto do cabeçalho é claro e caixa normal; o painel volta ao texto do corpo.
                "flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left text-sm font-normal text-foreground shadow-(--sombra-flutuante)",
              )}
            >
              <header className="shrink-0 border-b border-border px-3 py-2.5">
                <h2 className="text-sm font-semibold text-navy">{rotuloBotao}</h2>
              </header>

              {comBusca && (
                <div className="relative shrink-0 px-3 pt-2.5">
                  <Search aria-hidden className="pointer-events-none absolute left-5 top-1/2 mt-1 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar valor"
                    aria-label={`Buscar valor de ${coluna.rotulo}`}
                    className="h-8 w-full rounded-full border border-input bg-card pl-7 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground hover:border-brand/50 focus:border-brand focus:ring-2 focus:ring-brand/15"
                  />
                </div>
              )}

              <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-xs">
                <button
                  type="button"
                  onClick={() => onFiltros(marcarVisiveis(filtros, chave, valoresVisiveis, todos))}
                  className="rounded-sm font-semibold text-brand-forte hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => onFiltros(desmarcarVisiveis(filtros, chave, valoresVisiveis, todos))}
                  className="rounded-sm font-semibold text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  Limpar
                </button>
              </div>

              <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border py-1">
                {visiveis.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-muted-foreground">
                    {opcoes.length === 0 ? "Nenhum valor nesta coluna." : "Nenhum valor com essa busca."}
                  </li>
                ) : (
                  visiveis.map((o) => (
                    <li key={o.valor}>
                      <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/60">
                        <input
                          type="checkbox"
                          checked={marcados.has(o.valor)}
                          onChange={() => onFiltros(alternarValor(filtros, chave, o.valor, todos))}
                          className="h-4 w-4 shrink-0 rounded border-input accent-brand"
                        />
                        <span className={cn("min-w-0 flex-1 truncate", o.valor === VALOR_VAZIO && "italic text-muted-foreground")}>
                          {rotuloDe(o.valor)}
                        </span>
                        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{o.quantidade}</span>
                      </label>
                    </li>
                  ))
                )}
              </ul>

              {ligado && marcados.size === 0 && (
                <p className="shrink-0 border-t border-border px-3 py-2 text-2xs text-muted-foreground">
                  Nenhum valor marcado: a lista fica vazia.
                </p>
              )}
            </section>,
            document.body,
          )
        : null}
    </>
  );
}
