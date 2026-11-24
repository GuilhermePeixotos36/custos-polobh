import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { revelarLinhasEmCascata } from "./animacaoLista";
import { sentidoInicial, type ColunaOrdenavel, type EstadoOrdenacao, type SentidoOrdenacao } from "./ordenacaoTabela";

export type { ColunaOrdenavel, EstadoOrdenacao };

/**
 * A coluna como o CABEÇALHO precisa dela: a regra de comparação (`ColunaOrdenavel`, que é o que
 * `ordenarPorColuna` lê) mais o que só existe na tela.
 *
 * `classe` é por coluna, e não do cabeçalho inteiro, porque é o alinhamento que muda de uma para
 * a outra: dinheiro e contagem vão `text-right` sobre o número alinhado à direita, o ponto vai
 * `text-center`, e a lista de colaboradores ainda prende `#` e `Colaborador` à esquerda com
 * `celula-congelada` e `divisor-congelado`. Uma classe única para todas deixaria o rótulo de
 * "Líquido" na ponta esquerda de uma coluna de valores à direita e soltaria as colunas presas na
 * rolagem horizontal.
 */
export type ColunaCabecalho = ColunaOrdenavel & {
  /** Classes do `<th>` desta coluna — alinhamento, largura, congelamento. */
  classe?: string;
  /**
   * Explicação da coluna que NÃO ordena. Na que ordena o `title` já é "Ordenar por…", e duas
   * dicas no mesmo lugar só disputariam o cursor.
   */
  dica?: string;
  /**
   * O que se DESENHA quando o rótulo inteiro não cabe — "Hig." para "Higienizados".
   *
   * Existe para a matriz que tem mais colunas do que largura: seis contagens seguidas com rótulo
   * inteiro custavam mais que os próprios números, e empurravam a tabela para a rolagem já em
   * 1280px. A abreviação é só tinta: o `rotulo` continua sendo o nome acessível (o leitor de tela
   * não pode ouvir "hig ponto") e a dica "Ordenar por Higienizados" mostra o nome no cursor.
   */
  rotuloCurto?: string;
  /**
   * O `<th>` que é um CONTROLE, e não um rótulo — a caixa de "selecionar todos" da folha de ponto.
   * Quem tem conteúdo próprio não ordena (não há dado por trás de "está marcado", e ordenar por
   * isso embaralharia a lista debaixo da mão de quem está marcando) e usa o `rotulo` só como
   * identificação, sem desenhá-lo.
   */
  conteudo?: ReactNode;
};

/**
 * Cabeçalho ordenável das listas em matriz.
 *
 * A grade inteira continua sendo da classe `lista-matriz` (`src/styles.css`) — aqui não se
 * declara divisória nenhuma, só o que o clique acrescenta ao `<th>`. O cabeçalho é navy cheio com
 * texto branco (também da `lista-matriz`): cheio porque, translúcido, o conteúdo aparece por baixo
 * ao rolar. Por isso o cursor clareia o rótulo para o azul claro, o anel de foco é branco e a seta
 * herda a cor do texto — azul corporativo ou navy sobre navy não se veem.
 *
 * O ordenável é um `<button>` dentro do `<th>`, e não um `onClick` no `<th>`: é o botão que
 * chega pelo Tab, responde ao Enter e ao Espaço e ganha anel de foco de graça. O `aria-sort`
 * fica no `<th>`, que é onde o leitor de tela procura por ele.
 */
/**
 * Estado da ordenação de UMA tabela.
 *
 * Só dois estados por coluna, crescente e decrescente — não há terceiro clique que volta ao
 * padrão. O padrão de cada tabela é uma coluna como qualquer outra (data nas movimentações, item
 * no estoque), então ele está sempre a um clique de distância pelo próprio cabeçalho; um terceiro
 * estado acrescentaria um clique cujo efeito é invisível justamente quando a pessoa clica na
 * coluna padrão — e um ciclo de três em cima de um controle que a tela inteira usa para alternar
 * entre dois.
 *
 * `chaveOrdem` entra no `resetKey` da `PaginatedList`: reordenar muda a lista inteira, e ficar na
 * página 4 de uma lista que acabou de ser reordenada é ficar num lugar que já não quer dizer nada.
 */
export function useOrdenacao(padrao: EstadoOrdenacao) {
  const [ordem, setOrdem] = useState<EstadoOrdenacao>(padrao);
  function ordenarPor(coluna: ColunaOrdenavel) {
    const chave = coluna.chave;
    if (!chave) return;
    setOrdem((atual) => atual.chave === chave
      ? { chave, sentido: atual.sentido === "asc" ? "desc" : "asc" }
      : { chave, sentido: sentidoInicial(coluna.tipo ?? "texto") });
  }
  return { ordem, ordenarPor, chaveOrdem: `${ordem.chave}|${ordem.sentido}` };
}

/**
 * Coluna que pode não existir naquela tela — a folha mensal troca de colunas entre validação e
 * consolidado. A lista aceita o buraco (`false`, `null`, `undefined`) para a tela poder escrever
 * `validacao && { … }` em linha, em vez de montar o array com `concat` e conversão de tipo.
 */
export type ColunaOpcional = ColunaCabecalho | false | null | undefined;

const ehColuna = (coluna: ColunaOpcional): coluna is ColunaCabecalho => Boolean(coluna);

export function CabecalhoOrdenavel({ colunas, ordem, onOrdenar, className }: {
  colunas: readonly ColunaOpcional[];
  ordem: EstadoOrdenacao;
  onOrdenar: (coluna: ColunaOrdenavel) => void;
  /**
   * Classes do `<thead>` — é onde mora o `sticky top-0` e o `z` de cada tela, porque a altura do
   * que está acima da tabela e a pilha de camadas são da tela, não do cabeçalho. O `bg-navy`
   * vem de série e não precisa ser repetido.
   */
  className?: string;
}) {
  const cabecalho = useRef<HTMLTableSectionElement>(null);
  const chaveOrdem = `${ordem.chave}|${ordem.sentido}`;
  const chaveAnterior = useRef(chaveOrdem);

  // A cascata sai daqui, e não de cada tela, porque o cabeçalho é o único que sabe que a ordem
  // mudou — e mudar a ordem é o único motivo de animar. Busca, filtro e recarga de dados também
  // trocam as linhas, mas animar a cada tecla digitada seria piscar a lista debaixo do dedo.
  // `useLayoutEffect`: roda depois de o React ter reordenado o `<tbody>` e antes da pintura,
  // então a primeira imagem da ordem nova já sai com as linhas apagadas, sem um quadro cheio.
  useLayoutEffect(() => {
    if (chaveAnterior.current === chaveOrdem) return;
    chaveAnterior.current = chaveOrdem;
    const tabela = cabecalho.current?.parentElement;
    if (tabela instanceof HTMLTableElement) revelarLinhasEmCascata(tabela.tBodies[0]);
  }, [chaveOrdem]);

  return (
    <thead ref={cabecalho} className={cn("bg-navy", className)}>
      {/* Rótulo em caixa normal, 12px (redesign "Crachá"): em CAIXA ALTA espaçada de 11px o
          cabeçalho pesava mais que o dado, e sobre o índigo cheio o rótulo não precisa gritar. */}
      <tr className="text-left text-xs text-navy-foreground">
        {colunas.filter(ehColuna).map((coluna, indice) => (
          <ThOrdenavel
            key={coluna.chave ?? coluna.rotulo ?? indice}
            coluna={coluna}
            ordem={ordem}
            onOrdenar={onOrdenar}
          />
        ))}
      </tr>
    </thead>
  );
}

/**
 * Uma célula do cabeçalho. Fica aqui dentro, sem `export`: o cabeçalho é a única porta de entrada
 * — duas formas de montar a mesma fileira de `<th>` divergiriam na primeira mudança.
 */
function ThOrdenavel({ coluna, ordem, onOrdenar }: {
  coluna: ColunaCabecalho;
  ordem: EstadoOrdenacao;
  onOrdenar: (coluna: ColunaOrdenavel) => void;
}) {
  // Sem `chave` não há dado por trás da coluna (Ações, Recibo); com `conteudo` o `<th>` já é um
  // controle. Nos dois casos não há botão nem `aria-sort` para anunciar.
  const ordenavel = Boolean(coluna.chave) && coluna.conteudo === undefined;
  const ativa = ordenavel && coluna.chave === ordem.chave;
  // Abreviado, o rótulo sai em duas camadas: a curta para o olho e a inteira para o leitor de
  // tela. `aria-label` no botão faria o mesmo, mas deixaria o `<th>` (que é o que o leitor anuncia
  // ao andar pelas células) com o nome curto.
  const rotulo = coluna.rotuloCurto
    ? <><span aria-hidden="true">{coluna.rotuloCurto}</span><span className="sr-only">{coluna.rotulo}</span></>
    : coluna.rotulo;
  // Coluna de número vai à direita, e a seta passa para a ESQUERDA do rótulo: depois dele, ela
  // empurrava o texto 18px para dentro e o rótulo deixava de terminar onde terminam os números.
  const direita = /\btext-right\b/.test(coluna.classe ?? "");
  return (
    <th
      scope="col"
      title={ordenavel ? undefined : coluna.dica ?? (coluna.rotuloCurto ? coluna.rotulo : undefined)}
      className={cn("px-4 py-3 font-semibold", coluna.classe)}
      aria-sort={ordenavel ? (ativa ? (ordem.sentido === "asc" ? "ascending" : "descending") : "none") : undefined}
    >
      {ordenavel
        ? (
          <button
            type="button"
            onClick={() => onOrdenar(coluna)}
            className={cn("group inline-flex items-center gap-1 rounded-sm outline-none hover:text-brand-soft focus-visible:ring-2 focus-visible:ring-navy-foreground", direita && "flex-row-reverse")}
            title={`Ordenar por ${coluna.rotulo}`}
          >
            {rotulo}
            {/* Coluna inativa aponta para onde o PRIMEIRO clique vai ordenar: assim a seta que
                aparece ao ativar já está virada certa e não gira enquanto surge. */}
            <IndicadorOrdem ativa={ativa} sentido={ativa ? ordem.sentido : sentidoInicial(coluna.tipo ?? "texto")} />
          </button>
        )
        : coluna.conteudo ?? rotulo}
    </th>
  );
}

/**
 * A seta ocupa o mesmo espaço sempre.
 *
 * Aparecer e sumir mudaria a largura do cabeçalho a cada clique e a matriz inteira dançaria
 * debaixo do cursor. A coluna inativa desenha o mesmo ícone transparente, que só ganha cor no
 * cursor e no foco — o lugar já está reservado, o que muda é a tinta.
 *
 * Os dois ícones moram sempre montados, empilhados na mesma célula (`.indicador-ordem`, em
 * styles.css): ativar a coluna cruza o neutro com a seta, e alternar o sentido GIRA a seta em vez
 * de trocar um ícone por outro. O giro diz "é a mesma ordem, ao contrário" — a troca seca de
 * ArrowUp por ArrowDown parecia outro controle.
 */
function IndicadorOrdem({ ativa, sentido }: { ativa: boolean; sentido: SentidoOrdenacao }) {
  return (
    <span aria-hidden className="indicador-ordem" data-ativa={ativa} data-sentido={sentido}>
      <ChevronsUpDown className="indicador-ordem-neutro h-3.5 w-3.5" />
      <ArrowUp className="indicador-ordem-seta h-3.5 w-3.5" />
    </span>
  );
}
