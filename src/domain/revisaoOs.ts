/**
 * O que mudou nesta OS desde a última vez que ela foi salva — o "Revisar" da OS
 * (29/09/2026), irmão do `revisarEc`: o botão mostra a conferência antes de
 * gravar. Devolve o MESMO formato (`RevisaoEc`), para as duas telas usarem o
 * mesmo modal.
 *
 * Os campos de cabeçalho vão em `gerais`; a contratação vai item a item.
 */
import type { Os } from "@/data/types";
import type { MudancaCampoEc, MudancaItemEc, RevisaoEc } from "@/domain/revisaoEc";
import { brl } from "@/lib/format";
import { htmlParaLinhas } from "@/lib/htmlTexto";

const texto = (v: string | null | undefined) => (v ?? "").trim();
const resumir = (v: string, limite = 140) => {
  const limpo = texto(v).replace(/\s+/g, " ");
  return limpo.length > limite ? `${limpo.slice(0, limite)}…` : limpo;
};
const dinheiro = (v: number | null | undefined) => brl(v ?? 0);

const CAMPOS_GERAIS: { label: string; ler: (o: Os) => string }[] = [
  { label: "Modalidade", ler: (o) => texto(o.modalidade) },
  { label: "Descritivo", ler: (o) => resumir(o.descritivo) },
  { label: "Fornecedor", ler: (o) => texto(o.fornecedor?.nomeFantasia) },
  { label: "CNPJ/CPF do fornecedor", ler: (o) => texto(o.fornecedor?.cnpj) },
  { label: "Razão social do fornecedor", ler: (o) => texto(o.fornecedor?.razaoSocial) },
  { label: "Inscrição estadual do fornecedor", ler: (o) => texto(o.fornecedor?.inscricaoEstadual) },
  { label: "Inscrição municipal do fornecedor", ler: (o) => texto(o.fornecedor?.inscricaoMunicipal) },
  { label: "Dados bancários", ler: (o) => [o.fornecedor?.dadosBancarios?.banco, o.fornecedor?.dadosBancarios?.agencia, o.fornecedor?.dadosBancarios?.conta, o.fornecedor?.dadosBancarios?.chavePix].map(texto).filter(Boolean).join(" · ") },
  { label: "Representante do fornecedor", ler: (o) => [o.fornecedor?.representante, o.fornecedor?.telefone, o.fornecedor?.email].map(texto).filter(Boolean).join(" · ") },
  { label: "Prazo de pagamento (parcelas)", ler: (o) => (o.orcamento?.parcelas ?? []).map((p) => `${texto(p.descricao) || "parcela"}: ${dinheiro(p.valor)}`).join(" | ") },
  { label: "Documento fiscal", ler: (o) => texto(o.orcamento?.documentoFiscal) },
  { label: "Tomador da nota", ler: (o) => texto(o.financeiro?.tomador) },
  { label: "Descritivo da NF", ler: (o) => resumir(o.financeiro?.descritivoNf ?? "") },
  { label: "Nome do projeto incentivado", ler: (o) => texto(o.financeiro?.projetoIncentivado) },
  { label: "Lei de incentivo à cultura", ler: (o) => texto(o.financeiro?.leiIncentivo) },
  { label: "Código do projeto incentivado", ler: (o) => texto(o.financeiro?.codigoProjetoIncentivado) },
  { label: "Valor a pagar", ler: (o) => dinheiro(o.financeiro?.valorAPagar) },
  { label: "Forma de pagamento", ler: (o) => resumir(o.financeiro?.formaPagamento ?? "") },
  { label: "Cronograma", ler: (o) => (o.cronograma ?? []).map((c) => [c.etapa, c.data, c.horario].map(texto).filter(Boolean).join(" ")).join(" | ") },
  { label: "Observações gerais", ler: (o) => resumir(htmlParaLinhas(o.observacoesGerais ?? "").join(" ")) },
];

const ITEM_CAMPOS: { label: string; ler: (i: Os["itens"][number]) => string }[] = [
  { label: "Valor com BV e NF", ler: (i) => (i.comBvNf?.naoSeAplica ? "não se aplica" : dinheiro(i.comBvNf?.valor)) },
  { label: "BV", ler: (i) => (i.bv?.modo === "fixo" ? dinheiro(i.bv?.valor) : `${i.bv?.valor ?? 0}%`) },
  { label: "Valor sem BV e com NF", ler: (i) => (i.semBvComNf?.naoSeAplica ? "não se aplica" : dinheiro(i.semBvComNf?.valor)) },
  { label: "Valor sem BV e sem NF", ler: (i) => (i.semBvSemNf?.naoSeAplica ? "não se aplica" : dinheiro(i.semBvSemNf?.valor)) },
  { label: "Justificativa (com BV)", ler: (i) => resumir(i.comBvNf?.justificativaBv ?? "") },
  { label: "Justificativa (sem BV, com NF)", ler: (i) => resumir(i.semBvComNf?.justificativaBv ?? "") },
  { label: "Justificativa (sem BV, sem NF)", ler: (i) => resumir(i.semBvSemNf?.justificativaBv ?? "") },
];

export function revisarOs(antes: Os | null | undefined, depois: Os, nomeDoItem: (ecLinhaId: string) => string): RevisaoEc {
  if (!antes) return { itens: [], gerais: [], total: 0 };
  const gerais: MudancaCampoEc[] = [];
  for (const c of CAMPOS_GERAIS) {
    const a = c.ler(antes);
    const d = c.ler(depois);
    if (a !== d) gerais.push({ label: c.label, antes: a, depois: d });
  }
  const itens: MudancaItemEc[] = [];
  const anteriores = new Map((antes.itens ?? []).map((i) => [i.ecLinhaId, i]));
  for (const item of depois.itens ?? []) {
    const anterior = anteriores.get(item.ecLinhaId);
    if (!anterior) continue;
    const campos: MudancaCampoEc[] = [];
    for (const c of ITEM_CAMPOS) {
      const a = c.ler(anterior);
      const d = c.ler(item);
      if (a !== d) campos.push({ label: c.label, antes: a, depois: d });
    }
    if (campos.length) {
      itens.push({ chave: item.ecLinhaId, tipo: "alterado", titulo: nomeDoItem(item.ecLinhaId), grupo: "", campos });
    }
  }
  return { itens, gerais, total: gerais.length + itens.length };
}
