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
 *
 * Além da lista por campo, o módulo guarda os VÍNCULOS entre campos que sempre
 * andam juntos (ver `PARES`): escolher "Teatro Sesiminas" no Local traz o
 * endereço que foi usado com ele; escolher a produtora responsável traz o
 * telefone e o e-mail dela. É o mesmo princípio das sugestões — o que a casa já
 * fez —, só que puxando o campo filho junto com o pai.
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
  | "representanteTelefone"
  | "representanteEmail"
  | "produtoraResponsavel"
  | "telefoneProdutora"
  | "emailProdutora"
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

/**
 * Campos que andam juntos: escolher o PAI preenche o FILHO com o valor que já
 * foi usado junto com ele. Para acrescentar um vínculo novo, basta somar um par
 * aqui — a coleta e a consulta seguem funcionando sozinhas.
 */
export const PARES: ReadonlyArray<{ pai: CampoSugerido; filho: CampoSugerido }> = [
  { pai: "local", filho: "enderecoLocal" },
  { pai: "produtoraResponsavel", filho: "telefoneProdutora" },
  { pai: "produtoraResponsavel", filho: "emailProdutora" },
  { pai: "representante", filho: "representanteTelefone" },
  { pai: "representante", filho: "representanteEmail" },
] as const;

/** Chave de um par no mapa de vínculos ("local>enderecoLocal"). */
const chavePar = (pai: CampoSugerido, filho: CampoSugerido) => `${pai}>${filho}`;

export interface Sugestoes {
  /** Valores já usados em cada campo, do mais usado para o menos usado. */
  valores: Record<CampoSugerido, string[]>;
  /** par -> valor do pai (normalizado) -> valor do filho que mais apareceu com ele. */
  vinculos: Record<string, Record<string, string>>;
}

/** Quantos valores no máximo por campo — a lista é um atalho, não um catálogo. */
const LIMITE = 40;
/** Texto muito longo não é "valor repetível": é redação, e polui a lista. */
const TAMANHO_MAX = 120;

const CAMPOS: CampoSugerido[] = [
  "local", "enderecoLocal", "nomeProjeto", "clienteApelido",
  "representante", "representanteTelefone", "representanteEmail",
  "produtoraResponsavel", "telefoneProdutora", "emailProdutora", "horario",
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

/** Registro de um par pai->filho: quantas vezes cada valor do filho apareceu. */
type BaldeVinculo = Map<string, Map<string, number>>;

const contarVinculo = (balde: BaldeVinculo, pai: string | undefined | null, filho: string | undefined | null) => {
  const p = (pai ?? "").trim();
  const f = (filho ?? "").trim();
  if (!p || !f || f.length > TAMANHO_MAX) return;
  const chave = chaveDe(p);
  const porValor = balde.get(chave) ?? new Map<string, number>();
  porValor.set(f, (porValor.get(f) ?? 0) + 1);
  balde.set(chave, porValor);
};

/** Resolve cada valor do pai para o valor do filho que mais apareceu com ele. */
const resolverVinculo = (balde: BaldeVinculo): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [chave, porValor] of balde) {
    const melhor = [...porValor.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0];
    if (melhor) out[chave] = melhor[0];
  }
  return out;
};

/**
 * Varre projetos, ECs e OSs e devolve, por campo, os valores já usados — e os
 * vínculos entre os campos que andam juntos.
 *
 * As ECs entram na conta de propósito: cada uma carrega uma cópia dos dados do
 * projeto no momento em que foi feita, então elas cobrem também os projetos que
 * não estão na lista carregada.
 */
export function montarSugestoes(projetos: Projeto[], ecs: Ec[], oss: Os[]): Sugestoes {
  const acc = vazio();
  const baldes = new Map<string, BaldeVinculo>(PARES.map((p) => [chavePar(p.pai, p.filho), new Map()]));
  const vincular = (pai: CampoSugerido, filho: CampoSugerido, valorPai?: string | null, valorFilho?: string | null) =>
    contarVinculo(baldes.get(chavePar(pai, filho))!, valorPai, valorFilho);

  const doProjetoInfo = (info: Projeto["info"] | undefined) => {
    if (!info) return;
    contar(acc.local, info.local);
    contar(acc.enderecoLocal, info.enderecoLocal);
    contar(acc.nomeProjeto, info.nomeProjeto);
    contar(acc.clienteApelido, info.clienteAbreviado);
    contar(acc.horario, info.horario);
    contar(acc.produtoraResponsavel, info.produtoraResponsavel);
    contar(acc.telefoneProdutora, info.telefoneProdutora);
    contar(acc.emailProdutora, info.emailProdutora);
    // O endereço do local pertence ao local; o contato pertence à produtora.
    vincular("local", "enderecoLocal", info.local, info.enderecoLocal);
    vincular("produtoraResponsavel", "telefoneProdutora", info.produtoraResponsavel, info.telefoneProdutora);
    vincular("produtoraResponsavel", "emailProdutora", info.produtoraResponsavel, info.emailProdutora);
  };

  const doCliente = (cliente: Projeto["cliente"] | undefined) => {
    const rep = cliente?.representante;
    if (!rep) return;
    contar(acc.representante, rep.nome);
    contar(acc.representanteTelefone, rep.telefones);
    contar(acc.representanteEmail, rep.email);
    vincular("representante", "representanteTelefone", rep.nome, rep.telefones);
    vincular("representante", "representanteEmail", rep.nome, rep.email);
  };

  for (const p of projetos) {
    doProjetoInfo(p.info);
    doCliente(p.cliente);
  }

  for (const ec of ecs) {
    doProjetoInfo(ec.projeto);
    doCliente(ec.cliente);
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

  return {
    valores: Object.fromEntries(CAMPOS.map((c) => [c, ordenar(acc[c])])) as Record<CampoSugerido, string[]>,
    vinculos: Object.fromEntries([...baldes].map(([chave, balde]) => [chave, resolverVinculo(balde)])),
  };
}

/**
 * O que preencher nos campos FILHOS quando o pai recebe `valorPai`.
 *
 * Devolve só o que a casa já usou junto com aquele valor — nada é inventado. A
 * tela decide se aplica (ver `ProjetoDetail`: preenche o filho vazio ou o que
 * tinha vindo do vínculo anterior, e nunca por cima do que a pessoa digitou).
 */
export function filhosDe(sugestoes: Sugestoes, pai: CampoSugerido, valorPai: string): Partial<Record<CampoSugerido, string>> {
  const chave = chaveDe((valorPai ?? "").trim());
  if (!chave) return {};
  const out: Partial<Record<CampoSugerido, string>> = {};
  for (const par of PARES) {
    if (par.pai !== pai) continue;
    const valor = sugestoes.vinculos[chavePar(par.pai, par.filho)]?.[chave];
    if (valor) out[par.filho] = valor;
  }
  return out;
}

/** Sugestões vazias — usado enquanto a carga não terminou. */
export const SUGESTOES_VAZIAS: Sugestoes = {
  valores: Object.fromEntries(CAMPOS.map((c) => [c, [] as string[]])) as Record<CampoSugerido, string[]>,
  vinculos: Object.fromEntries(PARES.map((p) => [chavePar(p.pai, p.filho), {}])),
};
