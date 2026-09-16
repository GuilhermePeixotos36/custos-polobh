/**
 * Quais itens da EC cada OS carrega.
 *
 * A OS consolida VÁRIAS linhas da EC do mesmo fornecedor — é isso que ela é —,
 * mas a lista de OSs só mostrava número, fornecedor e status. Para saber o que
 * tinha dentro de cada uma era preciso abrir uma a uma.
 *
 * O vínculo já existe no dado (`os.ecLinhaIds`); aqui ele vira nome de item,
 * na ordem em que os itens aparecem na EC — a mesma ordem da planilha, para
 * quem lê os dois lados não precisar reconciliar nada.
 */
import type { CampoInfraestrutura, CampoLogistica, Ec, EcLinha, Fornecedor, Os, StatusOs } from "@/data/types";

export interface ItemDaOs {
  id: string;
  grupo: string;
  item: string;
}

/**
 * Itens da EC consolidados nesta OS.
 *
 * Devolve lista vazia quando a EC não está entre as carregadas ou quando os
 * vínculos não batem — a tela some com o indicador em vez de mostrar caixa
 * vazia. Item sem nome aparece pelo grupo, e só em último caso como "(item sem
 * nome)": sumir com ele daria a impressão de que a OS tem menos do que tem.
 */
export function itensDaOs(os: Pick<Os, "ecId" | "ecLinhaIds">, ecs: Ec[]): ItemDaOs[] {
  const ids = new Set(os.ecLinhaIds ?? []);
  if (!ids.size) return [];
  const ec = ecs.find((e) => e.id === os.ecId);
  if (!ec) return [];
  return [...ec.linhas]
    .filter((l) => ids.has(l.id))
    .sort((a, b) => a.ordem - b.ordem)
    .map((l) => ({
      id: l.id,
      grupo: l.grupo?.trim() ?? "",
      item: l.item?.trim() || l.descricao?.trim() || "(item sem nome)",
    }));
}

/* ------------- Blocos com a resposta "Não se aplica" (OS) ---------------- */

/**
 * Logística e Infraestrutura são o mesmo desenho: uma lista fixa de itens de
 * texto que o fornecedor precisa saber, e cada um podendo ser respondido com
 * "não se aplica" — caso em que ele NÃO sai no documento impresso, no que vai
 * por e-mail nem na planilha.
 *
 * As duas listas, com os rótulos, existiam em triplicata: uma cópia na tela,
 * uma no documento e uma na planilha. Foram juntadas aqui, e as três saídas
 * passam por `itensVisiveis`. Com as cópias soltas, bastava uma delas esquecer
 * de filtrar para o item sumir da tela e continuar no papel que o fornecedor
 * recebe — que é justamente o erro que este recurso não pode cometer.
 */
type BlocoOpcional = { naoAplicaveis?: string[] };
/**
 * O campo válido para um bloco sai do PRÓPRIO bloco. É o que faz
 * `naoSeAplica(os.logistica, "energia")` ser erro de tipo: "energia" é de
 * Infraestrutura, e o compilador sabe disso sem ninguém repetir a lista.
 */
type CampoDoBloco<B> = B extends { naoAplicaveis?: (infer C)[] } ? C : never;

/** Itens de Logística do Fornecedor, na ordem em que aparecem. */
export const CAMPOS_LOGISTICA = [
  { campo: "transporteMaterial", rotulo: "Transporte Material" },
  { campo: "transporteEquipe", rotulo: "Transporte Equipe" },
  { campo: "hospedagem", rotulo: "Hospedagem Equipe" },
  { campo: "alimentacao", rotulo: "Alimentação Equipe" },
  { campo: "estacionamentoCarga", rotulo: "Estacionamento Carga" },
  { campo: "estacionamentoEquipe", rotulo: "Estacionamento Equipe" },
  { campo: "uniformizacao", rotulo: "Uniformização Equipe" },
] as const satisfies readonly { campo: CampoLogistica; rotulo: string }[];

/** Itens de Infraestrutura, na ordem em que aparecem. */
export const CAMPOS_INFRAESTRUTURA = [
  { campo: "energia", rotulo: "Energia" },
  { campo: "internet", rotulo: "Internet" },
  { campo: "pontosEletricos", rotulo: "Pontos Elétricos" },
  { campo: "estruturas", rotulo: "Estruturas Diversas" },
  { campo: "servicosApoio", rotulo: "Serviços de Apoio" },
  { campo: "artLaudos", rotulo: "ART, Laudos e Certificações" },
] as const satisfies readonly { campo: CampoInfraestrutura; rotulo: string }[];

/** Este item foi marcado como "não se aplica" nesta OS? */
export function naoSeAplica<B extends BlocoOpcional>(bloco: B | undefined, campo: CampoDoBloco<B>): boolean {
  return !!bloco?.naoAplicaveis?.includes(campo as string);
}

/**
 * Os itens que ENTRAM no documento e na planilha.
 *
 * O que não se aplica some — é o pedido. Item VAZIO continua saindo, com a
 * linha em branco para o fornecedor preencher: vazio é pergunta em aberto, e
 * escondê-la seria dar por respondida uma coisa que ninguém respondeu.
 */
export function itensVisiveis<C extends string>(
  // `Record`, e não `Partial<Record>`: o bloco precisa TER os campos da lista.
  // Com Partial, passar `os.logistica` junto de `CAMPOS_INFRAESTRUTURA` seria
  // aceito e devolveria seis linhas vazias, sem ninguém reclamar.
  bloco: (Record<C, string> & BlocoOpcional) | undefined,
  campos: readonly { campo: C; rotulo: string }[]
): { campo: C; rotulo: string; valor: string }[] {
  const fora = new Set<string>(bloco?.naoAplicaveis ?? []);
  return campos
    .filter(({ campo }) => !fora.has(campo))
    .map(({ campo, rotulo }) => ({ campo, rotulo, valor: bloco?.[campo] ?? "" }));
}

/**
 * Marca/desmarca um item como "não se aplica".
 *
 * Não mexe no valor digitado: quem marcou por engano desmarca e encontra o que
 * tinha escrito, exatamente como nas opções de valor do item da EC.
 */
export function alternarNaoSeAplica<B extends BlocoOpcional>(bloco: B, campo: CampoDoBloco<B>): B {
  const atuais: string[] = bloco.naoAplicaveis ?? [];
  const alvo = campo as string;
  return {
    ...bloco,
    naoAplicaveis: atuais.includes(alvo) ? atuais.filter((c) => c !== alvo) : [...atuais, alvo],
  };
}

/* ----------------------- Contrato: entra ou não entra ---------------------- */

/**
 * Status de Contrato que significam "vai haver contrato" — os mesmos dois que
 * pedem emissão na EC.
 */
const CONTRATO_A_EMITIR: StatusOs[] = ["Emitir", "Emitir Nova Versão"];

/**
 * Esta OS tem contrato?
 *
 * Quem decide é a EC, item a item, na coluna Contrato: "Emitir" ou "Emitir
 * Nova Versão" querem contrato; "Não se Aplica" não quer. Antes o bloco "Dados
 * para Contrato" saía em TODA OS — inclusive nas de fornecedor que só emite
 * nota —, e ali ele não é campo em branco à toa: é um contrato inexistente
 * descrito com valores, forma de pagamento e data, no documento que vai para o
 * fornecedor.
 *
 * A segunda condição é o que impede o dado de sumir: uma OS cujo contrato a
 * equipe já escreveu continua mostrando o bloco mesmo que alguém mexa no
 * status da linha na EC depois.
 */
export function temContrato(os: Pick<Os, "contrato">, linhas: Pick<EcLinha, "contratoStatus">[]): boolean {
  return linhas.some((l) => CONTRATO_A_EMITIR.includes(l.contratoStatus)) || contratoPreenchido(os.contrato);
}

/**
 * A equipe já pôs a mão neste contrato?
 *
 * Olha SÓ os dois campos que o sistema nunca preenche sozinho — informações
 * complementares e rubrica. Os outros (contratante, descritivo, valores, forma
 * de pagamento, observações, data) entram automaticamente em toda OS com
 * contrato, então usá-los aqui faria "tem contrato" responder sempre que sim,
 * inclusive depois de alguém marcar "Não se Aplica" na EC.
 */
export function contratoPreenchido(ct: Os["contrato"]): boolean {
  return !!(ct.informacoesComplementares?.trim() || ct.rubrica?.trim());
}

/* ---------------------- troca de fornecedor numa OS ---------------------- */

/**
 * Duas OS falam do MESMO fornecedor?
 *
 * O CNPJ manda quando existe dos dois lados — é o que identifica a empresa. Sem
 * ele (pessoa física, cadastro incompleto), compara a razão social pela régua
 * frouxa: sem acento, sem caixa, sem espaço sobrando. É a mesma comparação de
 * `versaoOs`, e tem de ser: as duas respondem à pergunta "é o mesmo fornecedor
 * desta OS?", e discordar faria a versão pular ou repetir.
 */
export function mesmoFornecedor(
  a: Pick<Fornecedor, "cnpj" | "razaoSocial"> | undefined,
  b: Pick<Fornecedor, "cnpj" | "razaoSocial"> | undefined
): boolean {
  const digitos = (s?: string) => (s ?? "").replace(/\D/g, "");
  const chave = (s?: string) =>
    (s ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  const cnpjA = digitos(a?.cnpj);
  const cnpjB = digitos(b?.cnpj);
  if (cnpjA && cnpjB) return cnpjA === cnpjB;
  return chave(a?.razaoSocial) === chave(b?.razaoSocial);
}

/**
 * Uma OS que já SAIU da casa. É o que separa corrigir de reemitir.
 *
 * Rascunho é papel de trabalho: mexer nele não tem consequência para ninguém de
 * fora. Emitida é documento — ele existe do lado do fornecedor, e
 * trocar quem ele contrata sem trocar o número deixaria duas empresas
 * diferentes com a mesma OS na mão.
 */
export const osJaEmitida = (os: Pick<Os, "status">): boolean =>
  os.status === "Emitida";

/**
 * Trocar o fornecedor desta OS exige gerar uma versão nova?
 *
 * Sim quando ela já saiu da casa e o fornecedor de fato mudou. Em rascunho,
 * não: ali a troca é correção de quem ainda está montando o documento —
 * inclusive porque a OS nasce com o fornecedor que a EC apontou, e o primeiro
 * ajuste costuma ser exatamente esse.
 */
export function exigeNovaVersaoPorFornecedor(
  os: Pick<Os, "status">,
  original: Pick<Fornecedor, "cnpj" | "razaoSocial"> | undefined,
  atual: Pick<Fornecedor, "cnpj" | "razaoSocial"> | undefined
): boolean {
  if (!osJaEmitida(os)) return false;
  // Fornecedor apagado no meio da edição não é troca: é campo em branco.
  if (!(atual?.cnpj ?? "").trim() && !(atual?.razaoSocial ?? "").trim()) return false;
  return !mesmoFornecedor(original, atual);
}
