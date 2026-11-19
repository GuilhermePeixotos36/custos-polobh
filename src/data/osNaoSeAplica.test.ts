/**
 * O "Não se aplica" do cronograma e das Observações Gerais precisa SOBREVIVER
 * ao banco (19/11/2026). A tabela `oss` não tem coluna para nenhum dos dois:
 * eles viajam dentro do jsonb de logística. Sem isso, a marcação some ao
 * salvar e o bloco volta no PDF da OS — foi o que a Carol viu.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { mapOs, osRow } from "./supabase";
import type { Os } from "./types";

const os = (p: Partial<Os> = {}): Os =>
  ({
    id: "os-1", numero: "OS 1", ecId: "ec-1", seq: 1, status: "Ativa",
    fornecedor: { nome: "Fornecedor", documento: "" },
    projeto: {}, cliente: {},
    descritivo: "", entrega: "", observacoesGerais: "levar extintor",
    cronograma: [{ id: "c1", etapa: "Montagem", data: "", horario: "", atividades: "montar" }],
    logistica: {
      transporteMaterial: "", transporteEquipe: "", hospedagem: "", alimentacao: "",
      estacionamentoCarga: "", estacionamentoEquipe: "", uniformizacao: "",
    },
    gruposExtras: [],
    infraestrutura: { energia: "", internet: "", pontosEletricos: "", estruturas: "", servicosApoio: "", artLaudos: "" },
    credenciamento: { prazoLimite: "", linkFormulario: "" },
    financeiro: {},
    ecLinhaIds: [],
    ...p,
  }) as unknown as Os;

/** Grava e relê, como o banco faria com a linha. */
const idaEVolta = (o: Os) => mapOs({ ...osRow(o), id: o.id, os_linhas: [], os_financeiro: [] });

describe('"Não se aplica" da OS no banco', () => {
  it("guarda e devolve o do cronograma e o das Observações Gerais", () => {
    const lida = idaEVolta(os({ cronogramaNaoSeAplica: true, observacoesGeraisNaoSeAplica: true }));
    expect(lida.cronogramaNaoSeAplica).toBe(true);
    expect(lida.observacoesGeraisNaoSeAplica).toBe(true);
  });

  it("não inventa a marcação quando ela está desligada", () => {
    const lida = idaEVolta(os());
    expect(lida.cronogramaNaoSeAplica).toBeUndefined();
    expect(lida.observacoesGeraisNaoSeAplica).toBeUndefined();
  });

  it("não deixa as marcações vazarem para os campos de logística", () => {
    const lida = idaEVolta(os({ cronogramaNaoSeAplica: true, observacoesGeraisNaoSeAplica: true }));
    expect(Object.keys(lida.logistica)).not.toContain("cronogramaNaoSeAplica");
    expect(Object.keys(lida.logistica)).not.toContain("observacoesGeraisNaoSeAplica");
  });
});
