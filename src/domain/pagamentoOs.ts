/**
 * O PAGAMENTO NO BLOCO DE FATURAMENTO DA OS (27/11/2026).
 *
 * O bloco "Resumo dos Custos" saiu da OS, e o que dele interessava a quem emite
 * e a quem recebe foi para os Dados para Faturamento: o documento fiscal, a
 * forma de pagamento (por onde o fornecedor recebe) e o prazo de pagamento.
 * Aqui ficam as regras que a tela e o documento compartilham.
 */
import type { DocumentoFiscal, Os } from "@/data/types";
import { brl, dataBR } from "@/lib/format";

export const MEIOS_PAGAMENTO = ["Dados bancários", "Cartão de crédito", "Boleto bancário"] as const;
export type MeioPagamento = (typeof MEIOS_PAGAMENTO)[number];

/** Os documentos que se escolhem no faturamento. */
export const DOCUMENTOS_DO_FATURAMENTO: DocumentoFiscal[] = ["Nota Fiscal", "Fatura", "Recibo Simples"];

type Bancarios = Os["fornecedor"]["dadosBancarios"];
const temBancarios = (b: Bancarios | undefined): boolean =>
  !!b && [b.banco, b.agencia, b.conta, b.chavePix].some((v) => (v ?? "").trim());

/**
 * A forma de pagamento da OS. OS gravada antes deste campo não o tem: se ela já
 * traz os dados bancários do fornecedor, é por eles que se paga.
 */
export function meioDePagamento(os: Pick<Os, "financeiro" | "fornecedor">): MeioPagamento | "" {
  const escolhido = os.financeiro?.meioPagamento;
  if (escolhido) return escolhido;
  return temBancarios(os.fornecedor?.dadosBancarios) ? "Dados bancários" : "";
}

/** O prazo de pagamento escrito na OS; nas antigas, o texto que morava em "forma de pagamento". */
export function prazoDePagamento(os: Pick<Os, "financeiro">): string {
  return (os.financeiro?.prazoPagamento ?? os.financeiro?.formaPagamento ?? "").trim();
}

/** Os dados da conta, uma informação por linha — é como saem no documento. */
export function linhasDosBancarios(b: Bancarios): string[] {
  return [
    b.tipoConta && `Tipo de conta: ${b.tipoConta}`,
    b.banco && `Banco: ${b.banco}`,
    b.agencia && `Agência: ${b.agencia}`,
    b.conta && `Conta corrente: ${b.conta}`,
    b.chavePix && `Chave Pix: ${b.chavePix}`,
  ].filter((x): x is string => !!x);
}

/**
 * O prazo como vai ao documento: o texto livre e, quando a Produção combinou
 * parcelas no Detalhamento da Contratação, as parcelas logo abaixo.
 */
export function prazoParaDocumento(os: Pick<Os, "financeiro" | "orcamento">): string {
  const parcelas = (os.orcamento?.parcelas ?? []).map(
    (x, i) => `${i + 1}ª — ${x.descricao || "Parcela"}${x.data ? ` — pagamento em ${dataBR(x.data)}` : ""}: ${brl(x.valor)}`
  );
  return [prazoDePagamento(os), ...parcelas].filter(Boolean).join("\n");
}
