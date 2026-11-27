import { describe, expect, it } from "vitest";
import { osEmDiaComAEc } from "./osAcompanhaEc";
import { bvVazio, descritivoConsolidado } from "./calc";
import { itemDaLinhaEc, valorDaContratacao } from "./contratacaoOs";
import type { EcLinha, Os } from "@/data/types";

const linha = (p: Partial<EcLinha>): EcLinha =>
  ({
    id: "l1", grupo: "SOM", item: "Sonorização", descricao: "Som do evento", descricaoCompleta: "",
    valorPolobh: 1500, valorCliente: 0, valorGasto: 0,
    valorComBvNf: 0, valorSemBvComNf: 1000, valorSemBvSemNf: 0,
    valoresNaoAplicaveis: [], bv: bvVazio(),
    statusAprovacao: "OK", fornecedorRazao: "Som Teste Ltda", fornecedorCnpj: "", fornecedorContato: "",
    faturaNf: "", codigoServico: "", pedidoCompra: "", statusOs: "OK", contratoStatus: "Pendente",
    observacao: "", observacoes: [], oculto: false, ordem: 0,
    ...p,
  }) as EcLinha;

/** Uma OS como ela nasce da EC: valores, descritivo e título tirados das linhas. */
const osDe = (linhas: EcLinha[], extra: Partial<Os> = {}): Os => {
  const itens = linhas.map(itemDaLinhaEc).map((i) => ({ ...i, forma: "semBvComNf" as const }));
  const valor = valorDaContratacao(itens);
  return {
    id: "os1", numero: `Projeto X – ${linhas.length === 1 ? linhas[0].item : "Diversos"} – Som Teste – OS (01) em 27 11 26`,
    status: "Ativa", fase: "producao", ecLinhaIds: linhas.map((l) => l.id), itens,
    descritivo: descritivoConsolidado(linhas),
    orcamento: { valorEc: 1500, valorComBvNf: valor, valorSemBvComNf: valor, valorSemBvSemNf: valor, parcelas: [{ descricao: "Pagamento único", valor }], documentoFiscal: "", valorContratado: valor },
    financeiro: { descritivoNf: "", valorUnitario: valor, valorTotal: valor, descontoNegociado: 0, valorAPagar: valor },
    contrato: { descritivoServicos: "", valorUnitario: valor, valorTotal: valor, descontoNegociado: 0, valorAPagar: valor },
    ...extra,
  } as unknown as Os;
};

describe("a OS ativa acompanha a EC", () => {
  it("valor do item muda na EC: a OS gravada passa a valer o novo, mantendo a forma escolhida", () => {
    const antes = [linha({})];
    const depois = [linha({ valorSemBvComNf: 1300 })];
    const nova = osEmDiaComAEc(osDe(antes), antes, depois);
    expect(nova.itens![0].semBvComNf.valor).toBe(1300);
    expect(nova.itens![0].forma).toBe("semBvComNf");
    expect(valorDaContratacao(nova.itens!)).toBe(1300);
    expect(nova.orcamento.parcelas[0].valor).toBe(1300);
    expect(nova.financeiro.valorTotal).toBe(1300);
  });

  it("item renomeado e redescrito: descritivo e título seguem a EC", () => {
    const antes = [linha({})];
    const depois = [linha({ item: "Sonorização e Luz", descricao: "Som e luz do evento" })];
    const nova = osEmDiaComAEc(osDe(antes), antes, depois);
    expect(nova.descritivo).toBe(descritivoConsolidado(depois));
    expect(nova.numero).toBe("Projeto X – Sonorização e Luz – Som Teste – OS (01) em 27 11 26");
  });

  it("descritivo reescrito à mão na OS não é desfeito", () => {
    const antes = [linha({})];
    const depois = [linha({ descricao: "Som e luz do evento" })];
    const os = osDe(antes, { descritivo: "Texto que a produção escreveu na OS" });
    expect(osEmDiaComAEc(os, antes, depois).descritivo).toBe("Texto que a produção escreveu na OS");
  });

  it("nada mudou nos itens da OS: devolve a mesma OS, sem nada para gravar", () => {
    const antes = [linha({}), linha({ id: "l2", item: "Outro" })];
    const depois = [linha({}), linha({ id: "l2", item: "Outro", valorSemBvComNf: 999 })];
    const os = osDe([antes[0]]);
    expect(osEmDiaComAEc(os, antes, depois)).toBe(os);
  });

  it("OS emitida ou arquivada não é tocada: só nova versão a altera", () => {
    const antes = [linha({})];
    const depois = [linha({ valorSemBvComNf: 1300 })];
    const emitida = osDe(antes, { status: "Emitida", fase: "emitida" });
    const arquivada = osDe(antes, { status: "Arquivada" });
    expect(osEmDiaComAEc(emitida, antes, depois)).toBe(emitida);
    expect(osEmDiaComAEc(arquivada, antes, depois)).toBe(arquivada);
  });
});
