/**
 * O que mudou nos dados gerais do evento — e o que fazer com o que já saiu.
 *
 * O evento é vivo: troca de local, muda o número de participantes, adianta um
 * dia. O projeto precisa acompanhar essa realidade. Mas EC e OS são
 * DOCUMENTOS — foram enviados a cliente e fornecedor, e não podem mudar de
 * conteúdo pelas costas de quem os recebeu.
 *
 * A regra, então, é: editar o projeto **nunca** mexe no que já foi emitido. A
 * alteração vale para o que nascer daí em diante, e o que já existe só muda
 * quando alguém decide, item a item — atualizando a EC ainda em aberto ou
 * mandando gerar uma nova versão da OS.
 *
 * Este módulo responde às duas perguntas dessa decisão:
 *   1. o que mudou, em linguagem de documento ("Local: Expominas → Minascentro");
 *   2. como aplicar essas mudanças — e só elas — a um snapshot já gravado.
 *
 * A comparação é feita pelo TEXTO QUE O DOCUMENTO IMPRIME, não pelo dado cru:
 * reordenar faixas do cronograma ou salvar de novo sem mexer em nada gera JSON
 * diferente e papel idêntico — e papel idêntico não é mudança.
 */
import type { Cliente, Ec, Os, ProjetoInfo } from "@/data/types";
import { resumoCronogramaProjeto, sincronizarCamposLegados } from "@/domain/projeto";

export type GrupoMudanca = "Projeto" | "Cliente";

export interface MudancaEvento {
  /** Identificador estável do campo — a tela usa como chave de lista. */
  chave: string;
  grupo: GrupoMudanca;
  label: string;
  /** Como o valor saía no documento antes e como sai depois. */
  antes: string;
  depois: string;
}

/**
 * Um campo observado.
 *
 * `campos` são as chaves que viajam JUNTAS quando a mudança é aplicada: o
 * título do evento é composto por três campos, e as datas do cronograma têm
 * cópias legadas (`evento`, `horario`…) que precisam andar com ele — deixar
 * uma para trás produz um documento que se contradiz.
 */
interface CampoObservado<T> {
  chave: string;
  label: string;
  campos: (keyof T)[];
  descrever: (valor: T) => string;
}

const texto = (v: string | null | undefined) => (v ?? "").trim();

/** Trecho legível de um texto longo — o roteiro inteiro não cabe num comparativo. */
function resumirTexto(v: string, limite = 160): string {
  const limpo = texto(v).replace(/\s+/g, " ");
  return limpo.length > limite ? `${limpo.slice(0, limite)}…` : limpo;
}

/**
 * Campos do projeto que aparecem na EC e na OS impressas (blocos "Dados do
 * Projeto"). O que não sai em documento não entra aqui: mudar algo que ninguém
 * lê no papel não é motivo para propor a reemissão de uma OS.
 */
const CAMPOS_PROJETO: CampoObservado<ProjetoInfo>[] = [
  { chave: "titulo", label: "Título do evento", campos: ["titulo", "clienteAbreviado", "nomeProjeto", "anoProjeto"], descrever: (p) => texto(p.titulo) },
  { chave: "modalidade", label: "Modalidade", campos: ["modalidade"], descrever: (p) => texto(p.modalidade) },
  { chave: "local", label: "Local", campos: ["local"], descrever: (p) => texto(p.local) },
  { chave: "enderecoLocal", label: "Endereço do local", campos: ["enderecoLocal"], descrever: (p) => texto(p.enderecoLocal) },
  {
    chave: "participantes",
    label: "Nº de participantes",
    campos: ["participantes"],
    descrever: (p) => (p.participantes == null ? "" : String(p.participantes)),
  },
  { chave: "produtoraResponsavel", label: "Produtor(a) responsável", campos: ["produtoraResponsavel"], descrever: (p) => texto(p.produtoraResponsavel) },
  { chave: "telefoneProdutora", label: "Telefone da produtora", campos: ["telefoneProdutora"], descrever: (p) => texto(p.telefoneProdutora) },
  { chave: "emailProdutora", label: "E-mail da produtora", campos: ["emailProdutora"], descrever: (p) => texto(p.emailProdutora) },
  // Os três campos que saem na NF (29/09/2026); o texto composto viaja junto.
  { chave: "projetoIncentivado", label: "Nome do projeto incentivado", campos: ["projetoIncentivado"], descrever: (p) => texto(p.projetoIncentivado) },
  { chave: "leiIncentivo", label: "Lei de incentivo à cultura", campos: ["leiIncentivo", "incentivosFiscais"], descrever: (p) => texto(p.leiIncentivo) },
  { chave: "codigoProjetoIncentivado", label: "Código do projeto incentivado", campos: ["codigoProjetoIncentivado", "incentivosFiscais"], descrever: (p) => texto(p.codigoProjetoIncentivado) },
  {
    chave: "cronograma",
    label: "Datas e cronograma",
    // As quatro cópias legadas saem de `sincronizarCamposLegados`, mas viajam
    // junto para o snapshot atualizado nunca ficar com data velha no rodapé.
    campos: ["cronograma", "cronogramaExtras", "cronogramaOrdem", "etapasOcultas", "preEvento", "evento", "posEvento", "horario"],
    descrever: resumoCronogramaProjeto,
  },
  {
    chave: "roteiro",
    label: "Roteiro do evento",
    campos: ["roteiro", "roteiros", "roteirosExtras", "roteirosOcultos", "roteiroOrdem"],
    descrever: (p) => resumirTexto(p.roteiro),
  },
];

/** Campos do cliente que aparecem no bloco "Dados do Cliente" da EC e da OS. */
const CAMPOS_CLIENTE: CampoObservado<Cliente>[] = [
  { chave: "nome", label: "Cliente", campos: ["nome"], descrever: (c) => texto(c.nome) },
  { chave: "razaoSocial", label: "Razão social", campos: ["razaoSocial"], descrever: (c) => texto(c.razaoSocial) },
  { chave: "cnpjCpf", label: "CNPJ/CPF", campos: ["cnpjCpf"], descrever: (c) => texto(c.cnpjCpf) },
  { chave: "endereco", label: "Endereço do cliente", campos: ["endereco"], descrever: (c) => texto(c.endereco) },
  { chave: "inscricaoEstadual", label: "Inscrição estadual", campos: ["inscricaoEstadual"], descrever: (c) => texto(c.inscricaoEstadual) },
  { chave: "inscricaoMunicipal", label: "Inscrição municipal", campos: ["inscricaoMunicipal"], descrever: (c) => texto(c.inscricaoMunicipal) },
  {
    chave: "representante",
    label: "Representante",
    campos: ["representante"],
    descrever: (c) => [c.representante?.nome, c.representante?.cargo, c.representante?.telefones, c.representante?.email].map(texto).filter(Boolean).join(" · "),
  },
];

export interface SnapshotEvento {
  info: ProjetoInfo;
  cliente: Cliente;
}

/**
 * Copia um punhado de campos de um objeto para outro do mesmo tipo.
 *
 * Existe por causa do compilador: `destino[chave] = origem[chave]` só é aceito
 * quando a chave é uma variável de tipo — em linha, o TypeScript vê os dois
 * lados como a união de TODOS os tipos de campo e recusa.
 */
function copiarCampos<T, K extends keyof T>(destino: T, origem: T, chaves: readonly K[]): void {
  for (const chave of chaves) destino[chave] = origem[chave];
}

function compararGrupo<T>(campos: CampoObservado<T>[], grupo: GrupoMudanca, antes: T, depois: T): MudancaEvento[] {
  const out: MudancaEvento[] = [];
  for (const campo of campos) {
    const de = campo.descrever(antes);
    const para = campo.descrever(depois);
    if (de === para) continue;
    out.push({ chave: `${grupo.toLowerCase()}.${campo.chave}`, grupo, label: campo.label, antes: de, depois: para });
  }
  return out;
}

/**
 * O que mudou entre duas versões dos dados gerais do evento, na ordem em que os
 * campos aparecem no documento.
 */
export function mudancasDoEvento(antes: SnapshotEvento, depois: SnapshotEvento): MudancaEvento[] {
  return [
    ...compararGrupo(CAMPOS_PROJETO, "Projeto", antes.info, depois.info),
    ...compararGrupo(CAMPOS_CLIENTE, "Cliente", antes.cliente, depois.cliente),
  ];
}

/**
 * Aplica a um snapshot já gravado (o da EC, o da OS) apenas as mudanças
 * escolhidas — o resto do snapshot fica como está.
 *
 * Isso é o que preserva o que foi digitado DENTRO do documento: a EC pode ter
 * um título ajustado à mão para o cliente, e trocar o local do evento não pode
 * levar esse ajuste embora junto.
 */
export function aplicarMudancasEvento(
  base: SnapshotEvento,
  atual: SnapshotEvento,
  mudancas: MudancaEvento[]
): SnapshotEvento {
  const escolhidas = new Set(mudancas.map((m) => m.chave));
  const info = { ...base.info };
  const cliente = { ...base.cliente };

  for (const campo of CAMPOS_PROJETO) {
    if (escolhidas.has(`projeto.${campo.chave}`)) copiarCampos(info, atual.info, campo.campos);
  }
  for (const campo of CAMPOS_CLIENTE) {
    if (escolhidas.has(`cliente.${campo.chave}`)) copiarCampos(cliente, atual.cliente, campo.campos);
  }
  // As datas legadas do documento saem do cronograma: reconciliadas aqui, o
  // snapshot atualizado nunca fica com "Evento: 05 03 26" e cronograma de abril.
  return { info: sincronizarCamposLegados(info), cliente };
}

/* --------------------- Quem ainda pode receber a mudança ------------------ */

/** EC encerrada é história: não recebe atualização nenhuma. */
const EC_ENCERRADA = ["Cancelada", "Arquivada"];
/** OS encerrada idem — não há o que reemitir a partir dela. */
const OS_ENCERRADA = ["Cancelada", "Arquivada"];

/**
 * ECs do projeto que ainda podem ter os dados do evento atualizados.
 *
 * A regra é a de sempre e continua escrita do mesmo jeito: EC encerrada é
 * história. O que mudou foi só o vocabulário do `status` (ver `domain/ec`) —
 * com dois estados, "Arquivada" é toda EC fora do ar, e 'Cancelada' fica na
 * lista para as linhas antigas que ainda a tenham.
 */
export const ecsAtualizaveis = (ecs: Ec[]): Ec[] => ecs.filter((e) => !EC_ENCERRADA.includes(e.status));

/** OSs que ainda podem ganhar uma nova versão com os dados novos. */
export const ossReemitiveis = (oss: Os[]): Os[] => oss.filter((o) => !OS_ENCERRADA.includes(o.status));
