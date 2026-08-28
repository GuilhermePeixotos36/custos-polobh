/**
 * A memória dos campos: o que a casa já escreveu volta como sugestão.
 *
 * A Pólobh repete muito — o mesmo local, o mesmo endereço, a mesma etapa de
 * cronograma, o mesmo texto de hospedagem, o mesmo código de serviço. Digitado
 * de novo a cada projeto, isso vira variação ("Teatro Sesiminas", "teatro sesi
 * minas") que depois estraga relatório e busca.
 *
 * Aqui cada campo de texto livre passa a oferecer o que JÁ FOI ESCRITO no
 * sistema — por qualquer pessoa, em qualquer projeto, EC, OS ou check-list. É
 * sugestão, não trava: dá para digitar coisa nova, e a lista cresce sozinha.
 *
 * Ordem: o mais USADO primeiro (repetição é sinal de que é o valor certo da
 * casa), desempatando em ordem alfabética.
 *
 * ── COMO ACRESCENTAR UM CAMPO ──────────────────────────────────────────────
 * Uma linha no `CATALOGO` abaixo, e `sugestoes={sugestoes.valores.<chave>}` no
 * `<Input>` da tela. Só isso. O tipo `CampoSugerido`, a lista de campos e a
 * varredura saem todos da mesma tabela — antes eram quatro lugares para editar
 * em dois arquivos, e foi por isso que a memória cobria 29 campos de mais de
 * cem.
 *
 * ── O QUE NÃO ENTRA ────────────────────────────────────────────────────────
 * Campo que IDENTIFICA uma entidade específica: CNPJ, Inscrição Estadual e
 * Municipal, agência, conta corrente, chave Pix. Oferecer a conta bancária de
 * um fornecedor enquanto se preenche a de outro não é memória, é risco de pagar
 * a pessoa errada. Esses dados têm memória melhor no cadastro do fornecedor e
 * do cliente, que preenche o registro INTEIRO de uma vez a partir do CNPJ.
 */
import type { Checklist, Cliente, Ec, EcLinha, ItemChecklist, Os, Projeto, ProjetoInfo } from "@/data/types";

/** Tudo o que o sistema já gravou — a matéria-prima da memória dos campos. */
export interface BaseSugestoes {
  projetos: Projeto[];
  ecs: Ec[];
  oss: Os[];
  checklists: Checklist[];
}

/** Onde um campo vai buscar o que já foi escrito nele. */
type Coletor = (base: BaseSugestoes) => (string | null | undefined)[];

/* ----------------------- de onde cada campo colhe ------------------------ */

/**
 * Bloco "Informações do Projeto" — lido no projeto E na cópia que cada EC
 * carrega. As ECs entram de propósito: cada uma guarda o retrato do projeto no
 * momento em que foi feita, então cobrem também projeto que saiu da lista.
 */
const infosDeProjeto = (b: BaseSugestoes): ProjetoInfo[] => [
  ...b.projetos.map((p) => p.info),
  ...b.ecs.map((e) => e.projeto),
];
const doProjeto = (ler: (i: ProjetoInfo) => string | null | undefined): Coletor => (b) =>
  infosDeProjeto(b).map(ler);

/** Cadastro do cliente — mesma dupla origem (projeto + cópia na EC). */
const clientes = (b: BaseSugestoes): Cliente[] => [
  ...b.projetos.map((p) => p.cliente),
  ...b.ecs.map((e) => e.cliente),
];
const doCliente = (ler: (c: Cliente | undefined) => string | null | undefined): Coletor => (b) =>
  clientes(b).map(ler);

const daLinhaEc = (ler: (l: EcLinha) => string | null | undefined): Coletor => (b) =>
  b.ecs.flatMap((e) => (e.linhas ?? []).map(ler));

const daOs = (ler: (o: Os) => string | null | undefined): Coletor => (b) => b.oss.map(ler);

/** Para o que mora numa LISTA dentro da OS (cronograma, parcelas). */
const deCadaOs = (ler: (o: Os) => (string | null | undefined)[]): Coletor => (b) => b.oss.flatMap(ler);

const daTarefa = (ler: (t: ItemChecklist) => string | null | undefined): Coletor => (b) =>
  b.checklists.flatMap((c) => (c.itens ?? []).map(ler));

/** Junta fontes diferentes sob a mesma chave — o mesmo vocabulário em dois lugares. */
const juntando = (...coletores: Coletor[]): Coletor => (b) => coletores.flatMap((c) => c(b));

/* ------------------------------ o catálogo ------------------------------- */

/**
 * Uma entrada por campo. A chave é o nome pelo qual a tela pede a lista.
 *
 * Chaves compartilhadas são de propósito: "Código de Serviço" é o mesmo
 * vocabulário no item da EC e no financeiro da OS, e a etapa do cronograma é a
 * mesma palavra no projeto e na OS. Quem escreve num lugar ajuda quem escreve
 * no outro.
 */
const CATALOGO = {
  /* -- Projeto ---------------------------------------------------------- */
  local: doProjeto((i) => i.local),
  enderecoLocal: doProjeto((i) => i.enderecoLocal),
  nomeProjeto: doProjeto((i) => i.nomeProjeto),
  clienteApelido: doProjeto((i) => i.clienteAbreviado),
  anoProjeto: doProjeto((i) => i.anoProjeto),
  incentivosFiscais: doProjeto((i) => i.incentivosFiscais),
  produtoraResponsavel: doProjeto((i) => i.produtoraResponsavel),
  telefoneProdutora: doProjeto((i) => i.telefoneProdutora),
  emailProdutora: doProjeto((i) => i.emailProdutora),
  // Horário do evento e horário de etapa de cronograma são a mesma escrita
  // ("08h às 18h") — quem preenche um alimenta o outro.
  horario: juntando(
    doProjeto((i) => i.horario),
    deCadaOs((o) => (o.cronograma ?? []).map((c) => c.horario))
  ),

  /* -- Cliente ---------------------------------------------------------- */
  clienteNome: doCliente((c) => c?.nome),
  clienteRazaoSocial: doCliente((c) => c?.razaoSocial),
  clienteEndereco: doCliente((c) => c?.endereco),
  representante: doCliente((c) => c?.representante?.nome),
  representanteTelefone: doCliente((c) => c?.representante?.telefones),
  representanteEmail: doCliente((c) => c?.representante?.email),

  /* -- Blocos livres que a pessoa nomeia -------------------------------- */
  // Etapa de cronograma: os blocos extras do projeto e as etapas da OS.
  etapaCronograma: juntando(
    (b) => infosDeProjeto(b).flatMap((i) => (i.cronogramaExtras ?? []).map((x) => x.titulo)),
    deCadaOs((o) => (o.cronograma ?? []).map((c) => c.etapa))
  ),
  atividadesCronograma: deCadaOs((o) => (o.cronograma ?? []).map((c) => c.atividades)),
  tituloRoteiro: (b) => infosDeProjeto(b).flatMap((i) => (i.roteirosExtras ?? []).map((x) => x.titulo)),

  /* -- Item da EC ------------------------------------------------------- */
  itemEc: daLinhaEc((l) => l.item),
  grupoEc: daLinhaEc((l) => l.grupo),
  pedidoCompra: daLinhaEc((l) => l.pedidoCompra),
  // Item da EC e financeiro da OS falam o mesmo código ("03.01").
  codigoServico: juntando(
    daLinhaEc((l) => l.codigoServico),
    daOs((o) => o.financeiro?.codigoServico)
  ),

  /* -- OS: contratação -------------------------------------------------- */
  entrega: daOs((o) => o.entrega),
  // O banco se repete entre fornecedores diferentes ("Banco do Brasil (001)").
  // Agência, conta e Pix NÃO entram: identificam um fornecedor só.
  bancoFornecedor: daOs((o) => o.fornecedor?.dadosBancarios?.banco),

  /* -- OS: logística e infraestrutura ----------------------------------- */
  transporteMaterial: daOs((o) => o.logistica?.transporteMaterial),
  transporteEquipe: daOs((o) => o.logistica?.transporteEquipe),
  hospedagem: daOs((o) => o.logistica?.hospedagem),
  alimentacao: daOs((o) => o.logistica?.alimentacao),
  estacionamentoCarga: daOs((o) => o.logistica?.estacionamentoCarga),
  estacionamentoEquipe: daOs((o) => o.logistica?.estacionamentoEquipe),
  uniformizacao: daOs((o) => o.logistica?.uniformizacao),
  energia: daOs((o) => o.infraestrutura?.energia),
  internet: daOs((o) => o.infraestrutura?.internet),
  pontosEletricos: daOs((o) => o.infraestrutura?.pontosEletricos),
  estruturas: daOs((o) => o.infraestrutura?.estruturas),
  servicosApoio: daOs((o) => o.infraestrutura?.servicosApoio),
  artLaudos: daOs((o) => o.infraestrutura?.artLaudos),

  /* -- OS: orçamento, financeiro e contrato ----------------------------- */
  descricaoParcela: deCadaOs((o) => (o.orcamento?.parcelas ?? []).map((p) => p.descricao)),
  projetoIncentivado: daOs((o) => o.financeiro?.projetoIncentivado),
  leiIncentivo: daOs((o) => o.financeiro?.leiIncentivo),
  numeroProjetoIncentivado: daOs((o) => o.financeiro?.numeroProjetoIncentivado),
  cnae: daOs((o) => o.financeiro?.cnae),
  acertoFinanceiro: daOs((o) => o.financeiro?.acertoFinanceiro),
  bvJustificativa: daOs((o) => o.financeiro?.bvJustificativa),
  formaPagamento: daOs((o) => o.contrato?.formaPagamento),
  observacoesContrato: daOs((o) => o.contrato?.observacoesGerais),
  informacoesComplementares: daOs((o) => o.contrato?.informacoesComplementares),
  rubrica: daOs((o) => o.contrato?.rubrica),

  /* -- Check-list ------------------------------------------------------- */
  tituloTarefa: daTarefa((t) => t.titulo),
  etapaTarefa: daTarefa((t) => t.etapa),
} satisfies Record<string, Coletor>;

/** Campos que oferecem sugestão — sai do próprio catálogo, sem lista paralela. */
export type CampoSugerido = keyof typeof CATALOGO;

const CAMPOS = Object.keys(CATALOGO) as CampoSugerido[];

/* ------------------------ campos que andam juntos ------------------------ */

/**
 * Pares pai → filho: escolher o pai preenche o filho com o valor que já foi
 * usado junto com ele. Escolher "Teatro Sesiminas" no Local traz o endereço;
 * escolher a produtora responsável traz telefone e e-mail dela.
 *
 * A co-ocorrência sai de ler os dois campos NO MESMO REGISTRO — por isso pai e
 * filho precisam colher da mesma fonte (os dois `doProjeto`, ou os dois
 * `doCliente`). Fontes diferentes devolvem listas de tamanhos diferentes e o
 * emparelhamento não significaria nada; `paresConsistentes` cobre isso no teste.
 */
export const PARES: ReadonlyArray<{ pai: CampoSugerido; filho: CampoSugerido }> = [
  { pai: "local", filho: "enderecoLocal" },
  { pai: "produtoraResponsavel", filho: "telefoneProdutora" },
  { pai: "produtoraResponsavel", filho: "emailProdutora" },
  { pai: "representante", filho: "representanteTelefone" },
  { pai: "representante", filho: "representanteEmail" },
  { pai: "clienteNome", filho: "clienteRazaoSocial" },
  { pai: "clienteNome", filho: "clienteEndereco" },
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

const chaveDe = (texto: string): string =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

const limpo = (valor: string | null | undefined): string => {
  const texto = (valor ?? "").trim();
  return texto && texto.length <= TAMANHO_MAX ? texto : "";
};

/**
 * Os valores de um campo, do mais usado para o menos usado.
 *
 * A contagem é por chave normalizada, para que "Teatro SESI" e "teatro sesi"
 * somem — mas o que vai para a tela é a PRIMEIRA grafia vista, e não uma versão
 * descaracterizada.
 */
function ordenarPorUso(valores: (string | null | undefined)[]): string[] {
  const balde = new Map<string, { texto: string; vezes: number }>();
  for (const valor of valores) {
    const texto = limpo(valor);
    if (!texto) continue;
    const chave = chaveDe(texto);
    const atual = balde.get(chave);
    if (atual) atual.vezes += 1;
    else balde.set(chave, { texto, vezes: 1 });
  }
  return [...balde.values()]
    .sort((a, b) => b.vezes - a.vezes || a.texto.localeCompare(b.texto, "pt-BR"))
    .slice(0, LIMITE)
    .map((c) => c.texto);
}

/**
 * Para cada valor do pai, o valor do filho que mais apareceu ao lado dele.
 *
 * As duas listas vêm da mesma fonte e na mesma ordem, então a posição `i` de
 * uma é o mesmo registro da posição `i` da outra — é daí que sai a
 * co-ocorrência, sem precisar de uma segunda varredura.
 */
function emparelhar(pais: (string | null | undefined)[], filhos: (string | null | undefined)[]): Record<string, string> {
  const contagem = new Map<string, Map<string, number>>();
  for (let i = 0; i < pais.length; i++) {
    const pai = limpo(pais[i]);
    const filho = limpo(filhos[i]);
    if (!pai || !filho) continue;
    const chave = chaveDe(pai);
    const porValor = contagem.get(chave) ?? new Map<string, number>();
    porValor.set(filho, (porValor.get(filho) ?? 0) + 1);
    contagem.set(chave, porValor);
  }
  const out: Record<string, string> = {};
  for (const [chave, porValor] of contagem) {
    const melhor = [...porValor.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0];
    if (melhor) out[chave] = melhor[0];
  }
  return out;
}

/** Varre tudo o que o sistema gravou e devolve, por campo, os valores já usados. */
export function montarSugestoes(base: BaseSugestoes): Sugestoes {
  const colhido = new Map<CampoSugerido, (string | null | undefined)[]>(
    CAMPOS.map((campo) => [campo, CATALOGO[campo](base)])
  );
  return {
    valores: Object.fromEntries(
      CAMPOS.map((campo) => [campo, ordenarPorUso(colhido.get(campo)!)])
    ) as Record<CampoSugerido, string[]>,
    vinculos: Object.fromEntries(
      PARES.map((par) => [chavePar(par.pai, par.filho), emparelhar(colhido.get(par.pai)!, colhido.get(par.filho)!)])
    ),
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

/**
 * Todo par colhe pai e filho da mesma fonte? É a condição para o emparelhamento
 * por posição significar alguma coisa. Existe para o teste conferir — um par
 * escrito errado devolveria vínculos aleatórios em silêncio.
 */
export function paresConsistentes(base: BaseSugestoes): boolean {
  return PARES.every((par) => CATALOGO[par.pai](base).length === CATALOGO[par.filho](base).length);
}

/** Sugestões vazias — usado enquanto a carga não terminou. */
export const SUGESTOES_VAZIAS: Sugestoes = {
  valores: Object.fromEntries(CAMPOS.map((c) => [c, [] as string[]])) as Record<CampoSugerido, string[]>,
  vinculos: Object.fromEntries(PARES.map((p) => [chavePar(p.pai, p.filho), {}])),
};
