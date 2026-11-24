/**
 * A busca da caixa combinada (ver `src/components/ui/ComboBox.tsx`).
 *
 * Mora fora do componente porque é a única parte com regra de negócio — quem procura
 * "jose" tem que achar "José", quem digita a empresa tem que achar pelo detalhe — e porque
 * o aparato de teste do repo é só o vitest em Node: sem DOM, a lógica testável precisa ser
 * função pura.
 */

export type OpcaoCombo = {
  valor: string;
  rotulo: string;
  /** Linha secundária (empresa, matrícula, setor). Também é procurada. */
  detalhe?: string;
};

/**
 * Sem acento, sem caixa, espaços colapsados.
 *
 * O cadastro tem "JOSÉ", "José" e "Jose" escritos pela mão de três pessoas diferentes ao longo
 * de anos; comparar o texto cru faria a busca depender de qual delas digitou o nome.
 */
export const normalizarBusca = (valor: string): string =>
  valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Quantas opções são efetivamente montadas na tela.
 *
 * O seletor de colaborador tem centenas de opções e o filtro roda a cada tecla. O custo não é
 * comparar as strings — é o React criar e reconciliar centenas de nós entre um caractere e o
 * seguinte. Renderizar só o começo da lista mantém a digitação fluida sem trazer virtualização
 * (e uma dependência) para dentro do repo.
 */
export const LIMITE_RENDERIZADO = 50;

export type ResultadoFiltro = {
  /** As opções que vão para a tela — no máximo `limite`. */
  visiveis: OpcaoCombo[];
  /** Quantas casaram no total, inclusive as que ficaram de fora do corte. */
  total: number;
};

/**
 * Filtra por rótulo e detalhe, termo a termo.
 *
 * Cada palavra digitada precisa aparecer em algum lugar da opção, em qualquer ordem: "silva
 * lspro" acha "João Silva" da "LS PRO" mesmo com o sobrenome e a empresa em campos distintos —
 * é assim que as pessoas procuram quando o nome é comum e a empresa é o que distingue.
 *
 * O que começa pelo termo vem primeiro. Procurando "ana", "Ana Paula" tem que estar acima de
 * "Mariana", senão o corte de 50 esconde exatamente quem se procurava.
 */
export function filtrarOpcoes(
  opcoes: readonly OpcaoCombo[],
  busca: string,
  limite = LIMITE_RENDERIZADO,
): ResultadoFiltro {
  const termos = normalizarBusca(busca).split(" ").filter(Boolean);
  if (termos.length === 0) {
    return { visiveis: opcoes.slice(0, limite), total: opcoes.length };
  }

  const comecam: OpcaoCombo[] = [];
  const contem: OpcaoCombo[] = [];
  for (const opcao of opcoes) {
    const rotulo = normalizarBusca(opcao.rotulo);
    const alvo = opcao.detalhe ? `${rotulo} ${normalizarBusca(opcao.detalhe)}` : rotulo;
    if (!termos.every((termo) => alvo.includes(termo))) continue;
    if (rotulo.startsWith(termos[0])) comecam.push(opcao);
    else contem.push(opcao);
  }

  const total = comecam.length + contem.length;
  return { visiveis: comecam.concat(contem).slice(0, limite), total };
}

/**
 * Para onde a seta leva o destaque. Dá a volta nas pontas — chegar ao fim da lista e continuar
 * apertando a seta para baixo é como se navega uma lista curta sem olhar para a tela.
 */
export function proximoDestaque(atual: number, quantidade: number, passo: number): number {
  if (quantidade <= 0) return -1;
  if (atual < 0) return passo > 0 ? 0 : quantidade - 1;
  return (atual + passo + quantidade) % quantidade;
}
