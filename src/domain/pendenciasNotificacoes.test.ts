/**
 * Pendências que chegavam a quem não podia resolvê-las (revisão de 11/11/2026).
 *
 *  1. "Emitir OS X" ia ao Produtor Responsável em TODA OS em rascunho, em
 *     qualquer etapa — inclusive com a OS já no Financeiro, na Direção ou no
 *     Back-office, onde a Produção não edita nem emite. E, para quem é produtor
 *     E emissor (Coordenação Produção), ela travava a própria emissão: a trava
 *     "não emitir com pendência aberta" contava a pendência que a emissão resolve.
 *  2. "Emitir Contrato: item" seguia cobrando a Produção depois que a OS do item
 *     já existia — o contrato passa a ser feito DENTRO da OS, no fluxo dela.
 */
import { describe, expect, it } from "vitest";
import { calcularPendencias } from "./pendencias";
import { projetoInfoVazio } from "./projeto";
import { bvVazio, encargosPadrao, honorariosPadrao, producaoZerada } from "./calc";
import type { Cliente, Ec, EcLinha, Os, Projeto } from "@/data/types";

const cliente: Cliente = {
  id: "c1", apelido: "ACME", nome: "ACME", razaoSocial: "ACME LTDA", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "", representante: { nome: "", cargo: "", telefones: "", email: "" },
};
const projeto: Projeto = {
  id: "p1", nome: "Convenção", cliente,
  info: { ...projetoInfoVazio(), titulo: "Convenção", produtoraResponsavel: "Bruno" },
  docsUrl: "https://www.dropbox.com/scl/fo/abc/xyz", status: "Ativo", criadoEm: "", atualizadoEm: "",
};
const linha = (p: Partial<EcLinha>): EcLinha => ({
  id: "l1", grupo: "PRODUÇÃO", item: "Som", descricao: "", descricaoCompleta: "",
  valorPolobh: 1000, valorCliente: 0, valorGasto: 0,
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [], bv: bvVazio(),
  statusAprovacao: "OK", fornecedorRazao: "Som & Luz", fornecedorCnpj: "12.345.678/0001-95", fornecedorContato: "",
  faturaNf: "", codigoServico: "", pedidoCompra: "", statusOs: "OK", contratoStatus: "Emitir",
  observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
});
const ec = (linhas: EcLinha[]): Ec => ({
  id: "ec1", numero: "EC – ACME – V01", slugPublico: "", versao: 1, status: "Rascunho",
  projetoId: "p1", template: "", clienteId: "c1", cliente,
  projeto: { ...projetoInfoVazio(), titulo: "Convenção" }, observacoes: [], linhas,
  producao: producaoZerada(), honorarios: honorariosPadrao(), encargos: encargosPadrao(),
  responsavel: "", validadeDias: 30, criadoEm: "", atualizadoEm: "", ativa: true,
});
const os = (p: Partial<Os>): Os =>
  ({
    id: "os1", numero: "OS (01)", ecId: "ec1", ecLinhaIds: ["l1"], status: "Rascunho", fase: "producao",
    fornecedor: { razaoSocial: "Som & Luz", cnpj: "12.345.678/0001-95" }, observacoes: [], cronograma: [],
    credenciamento: { prazoLimite: "", linkFormulario: "" }, ...p,
  }) as unknown as Os;

const tipos = (oss: Os[], linhas = [linha({})]) =>
  calcularPendencias([projeto], [ec(linhas)], oss, ["Bruno"], [], [], "2026-11-11").map((p) => p.tipo);

describe("Emitir OS: só enquanto a OS está com a Produção", () => {
  it("com a Produção, cobra o produtor (é ele quem precisa concluir e enviar)", () => {
    expect(tipos([os({ fase: "producao" })])).toContain("os.emitir");
  });

  it.each(["direcao", "financeiro", "backoffice"] as const)("na etapa %s, não cobra a Produção", (fase) => {
    const t = tipos([os({ fase })]);
    expect(t).not.toContain("os.emitir");
    // Quem cobra a etapa é a passagem de bastão, endereçada a quem responde por ela.
    expect(t).toContain("os.fase");
  });
});

describe("Emitir Contrato: some quando a OS do item já existe", () => {
  it("sem OS ainda, cobra o produtor", () => {
    expect(tipos([], [linha({ statusOs: "Emitir", contratoStatus: "Emitir" })])).toContain("ec.emitir");
  });

  it("com a OS do item criada, o contrato segue dentro dela", () => {
    expect(tipos([os({ fase: "financeiro" })])).not.toContain("ec.emitir");
  });

  it("OS cancelada não conta: o contrato volta a ser cobrado", () => {
    expect(tipos([os({ status: "Cancelada" })])).toContain("ec.emitir");
  });
});
