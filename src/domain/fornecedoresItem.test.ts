import { describe, expect, it } from "vitest";
import { agruparVinculados, chaveDoPrincipal, definirValorVinculado, desvincular, novoVinculado, valorTotalDoItem, vinculadosDe } from "./fornecedoresItem";
import { juntarDivisoes } from "./divisaoEc";
import { bvVazio } from "./calc";
import type { EcLinha } from "@/data/types";

const linha = (p: Partial<EcLinha>): EcLinha =>
  ({
    id: "p", grupo: "EQUIPE PRODUÇÃO", item: "Despesas operacionais", descricao: "Motoboy, cartório, Correios", descricaoCompleta: "",
    valorPolobh: 600, valorCliente: 0, valorGasto: 0, valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0,
    valoresNaoAplicaveis: [], bv: bvVazio(), statusAprovacao: "OK", fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "",
    faturaNf: "", codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Não se Aplica",
    observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
  }) as EcLinha;

describe("vários fornecedores no mesmo item", () => {
  it("vincular cria uma parte sem fornecedor, com valor zero, que herda nome e aprovação", () => {
    const { principal, vinculado } = novoVinculado(linha({}), linha({ id: "n1", item: "", statusAprovacao: "Pendente" }));
    expect(principal.divisao).toBe(chaveDoPrincipal(principal));
    expect(vinculado.divisao).toBe(principal.divisao);
    expect(vinculado.item).toBe("Despesas operacionais");
    expect(vinculado.statusAprovacao).toBe("OK");
    expect(vinculado.valorPolobh).toBe(0);
  });

  it("o valor do fornecedor sai do principal; a soma nunca passa do item", () => {
    const { principal, vinculado } = novoVinculado(linha({}), linha({ id: "n1" }));
    const a = definirValorVinculado(principal, vinculado, 150, "semBvSemNf");
    expect(a.principal.valorPolobh).toBe(450);
    expect(a.vinculado.valorPolobh).toBe(150);
    expect(a.vinculado.valorSemBvSemNf).toBe(150);
    expect(a.excedeu).toBe(false);

    const b = definirValorVinculado(a.principal, a.vinculado, 900);
    expect(b.excedeu).toBe(true);
    expect(b.vinculado.valorPolobh).toBe(600);
    expect(b.principal.valorPolobh).toBe(0);
    expect(valorTotalDoItem(b.principal, [b.vinculado])).toBe(600);
  });

  it("formas do principal não passam do saldo dele", () => {
    const { principal, vinculado } = novoVinculado(linha({ valorSemBvComNf: 600 }), linha({ id: "n1" }));
    const r = definirValorVinculado(principal, vinculado, 200);
    expect(r.principal.valorSemBvComNf).toBe(400);
  });

  it("desvincular devolve o valor ao principal", () => {
    expect(desvincular(linha({ valorPolobh: 450 }), linha({ id: "n1", valorPolobh: 150 })).valorPolobh).toBe(600);
  });

  it("para o cliente continua um item só, com o mesmo total", () => {
    const { principal, vinculado } = novoVinculado(linha({}), linha({ id: "n1" }));
    const r = definirValorVinculado(principal, vinculado, 150);
    const doc = juntarDivisoes([r.principal, r.vinculado]);
    expect(doc).toHaveLength(1);
    expect(doc[0].valorPolobh).toBe(600);
    expect(vinculadosDe(r.principal, [r.principal, r.vinculado]).map((v) => v.id)).toEqual(["n1"]);
  });

  it("vinculados ficam sempre logo abaixo do principal, mesmo depois de arrastar ou mudar de grupo", () => {
    const p = linha({ id: "p", divisao: "div-p" });
    const v = linha({ id: "v", divisao: "div-p" });
    const x = linha({ id: "x" });
    const r = agruparVinculados([
      { nome: "A", itens: [v, x] },
      { nome: "B", itens: [p] },
    ]);
    expect(r[0].itens.map((l) => l.id)).toEqual(["x"]);
    expect(r[1].itens.map((l) => l.id)).toEqual(["p", "v"]);
    expect(r[1].itens[1].grupo).toBe("B");
  });

  it("versão nova (ids novos): o primeiro assume e a chave é refeita para ele", () => {
    const r = agruparVinculados([{ nome: "A", itens: [linha({ id: "p2", divisao: "div-p" }), linha({ id: "v2", divisao: "div-p" })] }]);
    expect(r[0].itens.map((l) => l.divisao)).toEqual(["div-p2", "div-p2"]);
  });
});
