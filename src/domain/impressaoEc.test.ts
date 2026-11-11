import { describe, expect, it } from "vitest";
import { impressaoDigitalEc } from "./impressaoEc";
import { projetoInfoVazio } from "./projeto";
import { bvVazio, encargosPadrao, honorariosPadrao, producaoZerada } from "./calc";
import type { Ec, EcLinha } from "@/data/types";

const linha = (p: Partial<EcLinha> = {}): EcLinha => ({
  id: "l1", grupo: "PRODUÇÃO", item: "Som", descricao: "Sonorização", descricaoCompleta: "<p>PA</p>",
  valorPolobh: 1000, valorCliente: 1200, valorGasto: 0, valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0,
  valoresNaoAplicaveis: [], bv: bvVazio(), statusAprovacao: "OK", fornecedorRazao: "", fornecedorCnpj: "",
  fornecedorContato: "", faturaNf: "", codigoServico: "", pedidoCompra: "", statusOs: "Pendente",
  contratoStatus: "Pendente", observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
});
const ec = (p: Partial<Ec> = {}): Ec => ({
  id: "ec1", numero: "EC – ACME – V01", slugPublico: "x", versao: 1, status: "Rascunho", projetoId: "p1",
  template: "", clienteId: "c1",
  cliente: { id: "c1", apelido: "ACME", nome: "ACME", razaoSocial: "", endereco: "", cnpjCpf: "", inscricaoEstadual: "", inscricaoMunicipal: "", representante: { nome: "", cargo: "", telefones: "", email: "" } },
  projeto: { ...projetoInfoVazio(), titulo: "Convenção" }, observacoes: [], linhas: [linha()],
  producao: producaoZerada(), honorarios: honorariosPadrao(), encargos: encargosPadrao(),
  responsavel: "", validadeDias: 30, criadoEm: "2026-11-01", atualizadoEm: "2026-11-01T10:00:00Z", ativa: true, ...p,
});

describe("impressão digital da EC (o que vai para a pasta)", () => {
  it("não muda com o que não é conteúdo: data de alteração, ativa, status, conversa", () => {
    const base = impressaoDigitalEc(ec());
    expect(impressaoDigitalEc(ec({ atualizadoEm: "2026-11-11T09:00:00Z", ativa: false, status: "Aprovada" as Ec["status"] }))).toBe(base);
    expect(impressaoDigitalEc(ec({ observacoes: [{ id: "o", texto: "oi" } as Ec["observacoes"][number]] }))).toBe(base);
    expect(impressaoDigitalEc(ec({ linhas: [linha({ observacoes: [{ id: "o", texto: "oi" } as EcLinha["observacoes"][number]] })] }))).toBe(base);
  });

  it("muda quando o conteúdo do documento muda", () => {
    const base = impressaoDigitalEc(ec());
    expect(impressaoDigitalEc(ec({ linhas: [linha({ valorCliente: 1300 })] }))).not.toBe(base);
    expect(impressaoDigitalEc(ec({ linhas: [linha({ descricaoCompleta: "<p>PA e retorno</p>" })] }))).not.toBe(base);
    expect(impressaoDigitalEc(ec({ projeto: { ...projetoInfoVazio(), titulo: "Convenção 2027" } }))).not.toBe(base);
  });
});
