import { describe, expect, it } from "vitest";
import { camposObrigatoriosProjeto, compoeTituloProjeto, normalizarProjetoInfo, projetoInfoVazio } from "./projeto";
import type { Cliente } from "@/data/types";

const clienteValido = (): Cliente => ({
  id: "cliente-1", apelido: "ACME", nome: "ACME Eventos", razaoSocial: "ACME Eventos Ltda.",
  endereco: "Rua A", cnpjCpf: "11.444.777/0001-61", inscricaoEstadual: "", inscricaoMunicipal: "",
  representante: { nome: "Representante", cargo: "", telefones: "", email: "" },
});

describe("projetoInfo", () => {
  it("compõe o nome exclusivamente com apelido, nome do projeto e ano", () => {
    expect(compoeTituloProjeto("ACME", "Convenção", "2026")).toBe("ACME – Convenção – 2026");
    expect(compoeTituloProjeto("ACME", "", "2026")).toBe("ACME – 2026");
  });

  it("mantém os roteiros padrão e normaliza itens extras ordenáveis", () => {
    const info = normalizarProjetoInfo({
      ...projetoInfoVazio(),
      roteirosExtras: [{ id: "extra-1", titulo: "Credenciamento", conteudo: "Recepção" }],
      roteiroOrdem: ["evento", "extra-1"],
    });

    expect(info.roteirosExtras).toEqual([{ id: "extra-1", titulo: "Credenciamento", conteudo: "Recepção" }]);
    expect(info.roteiroOrdem).toEqual(["evento", "extra-1", "preEvento", "posEvento"]);
  });

  it("bloqueia o salvamento e identifica cada campo obrigatório pendente", () => {
    const faltando = camposObrigatoriosProjeto(projetoInfoVazio(), { ...clienteValido(), nome: "", cnpjCpf: "" });
    expect(faltando.map((campo) => campo.chave)).toEqual([
      "clienteAbreviado", "nomeProjeto", "anoProjeto", "clienteNome", "cnpjCpf", "modalidade", "local", "cronogramaEvento",
    ]);
  });

  it("aceita o projeto quando todos os campos obrigatórios estão preenchidos", () => {
    const info = projetoInfoVazio();
    info.clienteAbreviado = "ACME";
    info.nomeProjeto = "Convenção";
    info.anoProjeto = "2026";
    info.modalidade = "Corporativo";
    info.local = "Centro de Convenções";
    info.cronograma.evento[0].data = "2026-10-01";
    expect(camposObrigatoriosProjeto(info, clienteValido())).toEqual([]);
  });
});
