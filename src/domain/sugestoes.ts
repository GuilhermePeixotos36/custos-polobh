/**
 * Sugestões de preenchimento a partir do que a Pólobh já usou.
 *
 * A casa repete muito: o mesmo local, o mesmo endereço, o mesmo fornecedor de
 * energia, o mesmo "Item" de EC, o mesmo texto de hospedagem. Antes, cada campo
 * era digitado de novo em cada projeto — com variações ("Teatro Sesiminas",
 * "teatro sesi minas") que depois estragam relatório e busca.
 *
 * Aqui cada campo de texto livre passa a oferecer o que já foi escrito em
 * OUTROS projetos, ECs e OSs. É sugestão, não trava: dá para digitar qualquer
 * coisa nova, e a lista simplesmente cresce.
 *
 * Ordem: o mais USADO primeiro (repetição é sinal de que é o valor certo da
 * casa), desempatando em ordem alfabética.
 */
import type { Ec, Os, Projeto } from "@/data/types";

/** Campos que oferecem sugestão. A chave é usada pela tela ao pedir a lista. */
export type CampoSugerido =
  // Projeto
  | "local"
  | "enderecoLocal"
  | "nomeProjeto"
  | "clienteApelido"
  | "representante"
  | "horario"
  // EC
  | "itemEc"
  | "grupoEc"
  | "codigoServico"
  | "pedidoCompra"
  // OS
  | "entrega"
  | "transporteMaterial"
  | "transporteEquipe"
  | "hospedagem"
  | "alimentacao"
  | "estacionamentoCarga"
  | "estacionamentoEquipe"
  | "uniformizacao"
  | "energia"
  | "internet"
  | "pontosEletricos"
  | "estruturas"
  | "servicosApoio"
  | "artLaudos";

export type Sugestoes = Record<CampoSugerido, string[]>;

/** Quantos valores no máximo por campo — a lista é um atalho, não um catálogo. */
const LIMITE = 40;
/** Texto muito longo não é "valor repetível": é redação, e polui a lista. */
const TAMANHO_MAX = 120;

const CAMPOS: CampoSugerido[] = [
  "local", "enderecoLocal", "nomeProjeto", "clienteApelido", "representante", "horario",
  "itemEc", "grupoEc", "codigoServico", "pedidoCompra",
  "entrega", "transporteMaterial", "transporteEquipe", "hospedagem", "alimentacao",
  "estacionamentoCarga", "estacionamentoEquipe", "uniformizacao",
  "energia", "internet", "pontosEletricos", "estruturas", "servicosApoio", "artLaudos",
];

/** Uma entrada: a grafia que vai para a tela e quantas vezes ela apareceu. */
interface Contagem {
  texto: string;
  vezes: number;
}
/** Chave normalizada (sem acento, sem caixa) -> contagem. */
type Balde = Map<string, Contagem>;

const vazio = (): Record<CampoSugerido, Balde> =>
  Object.fromEntries(CAMPOS.map((c) => [c, new Map<string, Contagem>()])) as Record<CampoSugerido, Balde>;

const chaveDe = (texto: string): string =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/**
 * Conta mais uma aparição do valor.
 *
 * A contagem é por chave normalizada para que "Teatro SESI" e "teatro sesi"
 * somem — mas o que vai para a tela é a PRIMEIRA grafia vista, e não uma versão
 * descaracterizada.
 */
function contar(balde: Balde, valor: string | undefined | null): void {
  const texto = (valor ?? "").trim();
  if (!texto || texto.length > TAMANHO_MAX) return;
  const chave = chaveDe(texto);
  const atual = balde.get(chave);
  if (atual) atual.vezes += 1;
  else balde.set(chave, { texto, vezes: 1 });
}

const ordenar = (balde: Balde): string[] =>
  [...balde.values()]
    .sort((a, b) => b.vezes - a.vezes || a.texto.localeCompare(b.texto, "pt-BR"))
    .slice(0, LIMITE)
    .map((c) => c.texto);

/**
 * Varre projetos, ECs e OSs e devolve, por campo, os valores já usados.
 *
 * As ECs entram na conta de propósito: cada uma carrega uma cópia dos dados do
 * projeto no momento em que foi feita, então elas cobrem também os projetos que
 * não estão na lista carregada.
 */
export function montarSugestoes(projetos: Projeto[], ecs: Ec[], oss: Os[]): Sugestoes {
  const acc = vazio();

  const doProjetoInfo = (info: Projeto["info"] | undefined) => {
    if (!info) return;
    contar(acc.local, info.local);
    contar(acc.enderecoLocal, info.enderecoLocal);
    contar(acc.nomeProjeto, info.nomeProjeto);
    contar(acc.clienteApelido, info.clienteAbreviado);
    contar(acc.horario, info.horario);
  };

  for (const p of projetos) {
    doProjetoInfo(p.info);
    contar(acc.representante, p.cliente?.representante?.nome);
  }

  for (const ec of ecs) {
    doProjetoInfo(ec.projeto);
    contar(acc.representante, ec.cliente?.representante?.nome);
    for (const linha of ec.linhas ?? []) {
      contar(acc.itemEc, linha.item);
      contar(acc.grupoEc, linha.grupo);
      contar(acc.codigoServico, linha.codigoServico);
      contar(acc.pedidoCompra, linha.pedidoCompra);
    }
  }

  for (const os of oss) {
    contar(acc.entrega, os.entrega);
    for (const [campo, valor] of Object.entries(os.logistica ?? {})) {
      const chave = campo as CampoSugerido;
      if (chave in acc) contar(acc[chave], valor as string);
    }
    for (const [campo, valor] of Object.entries(os.infraestrutura ?? {})) {
      const chave = campo as CampoSugerido;
      if (chave in acc) contar(acc[chave], valor as string);
    }
  }

  return Object.fromEntries(CAMPOS.map((c) => [c, ordenar(acc[c])])) as Sugestoes;
}

/** Sugestões vazias — usado enquanto a carga não terminou. */
export const SUGESTOES_VAZIAS: Sugestoes = Object.fromEntries(CAMPOS.map((c) => [c, [] as string[]])) as Sugestoes;
