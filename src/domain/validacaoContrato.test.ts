/**
 * O fluxo novo da OS cultural com contrato (11/11/2026), testado de ponta a ponta
 * na regra: a passagem para a Direção de Produção vira pendência SÓ de quem
 * valida contrato — a Marisa —, e não da Produção nem do Financeiro.
 */
import { describe, expect, it } from "vitest";
import { agregarPendencias, type Pendencia } from "./pendencias";
import { ESPERANDO_FASE, RECURSO_DA_FASE } from "./faseOs";
import type { Recurso } from "@/store/auth";

/** Os recursos de cada área como estão no banco hoje (Configurações › Áreas). */
const AREAS: Record<string, Recurso[]> = {
  "Diretoria Produção (Marisa)": ["projetos", "ecs", "oss", "oss.emitir", "oss.validarContrato", "financeiro"],
  "Produção (Barbara)": ["projetos", "ecs", "ecs.editar", "oss", "oss.editar"],
  "Coordenação Adm.-Financeira (Tiago)": ["projetos", "ecs", "oss", "oss.editar", "oss.emitir", "financeiro", "oss.etapaFinanceiro"],
  "Coordenação Produção (Carol)": ["projetos", "ecs", "oss", "oss.editar", "oss.emitir", "financeiro"],
  "Back-office (Viviane)": ["projetos", "ecs", "oss", "oss.editar", "oss.emitir", "financeiro", "oss.etapaBackoffice"],
};

const pendenciaDaEtapa = (fase: "direcao" | "financeiro" | "backoffice"): Pendencia => ({
  id: `os.fase:os1:${fase}`,
  tipo: "os.fase",
  titulo: `${ESPERANDO_FASE[fase]} (OS teste)`,
  recursoResponsavel: RECURSO_DA_FASE[fase],
  recurso: "projetos",
  projetoId: "p1",
  aba: "os",
  osId: "os1",
} as Pendencia);

const quemRecebe = (p: Pendencia) =>
  Object.entries(AREAS)
    .filter(([pessoa, recursos]) => agregarPendencias([p], pessoa, (r) => recursos.includes(r)).total === 1)
    .map(([pessoa]) => pessoa);

describe("OS cultural com contrato: Produção → Direção de Produção → Financeiro", () => {
  it("enviar para a Direção gera pendência só para a Marisa", () => {
    expect(quemRecebe(pendenciaDaEtapa("direcao"))).toEqual(["Diretoria Produção (Marisa)"]);
  });

  it("depois de validada, a pendência passa SÓ ao Financeiro — não à Carol nem à Marisa, que também veem valores", () => {
    expect(quemRecebe(pendenciaDaEtapa("financeiro"))).toEqual(["Coordenação Adm.-Financeira (Tiago)"]);
  });

  it("a etapa do Back-office cobra só o Back-office", () => {
    expect(quemRecebe(pendenciaDaEtapa("backoffice"))).toEqual(["Back-office (Viviane)"]);
  });

});

describe("projeto incentivado no bloco Dados para Contrato", async () => {
  const { incentivoDoContrato } = await import("./os");
  const base = {
    projeto: { projetoIncentivado: "Prêmio Jornalista", codigoProjetoIncentivado: "PRONAC 26 1234", leiIncentivo: "Lei Rouanet", incentivosFiscais: "" },
    financeiro: {},
    contrato: {},
  } as unknown as Parameters<typeof incentivoDoContrato>[0];

  it("nasce dos Dados Gerais do projeto", () => {
    expect(incentivoDoContrato(base)).toEqual({
      projetoIncentivado: "Prêmio Jornalista",
      codigoProjetoIncentivado: "PRONAC 26 1234",
      leiIncentivo: "Lei Rouanet",
    });
  });

  it("sem correção manual, os Dados Gerais do projeto vencem o que a OS gravou ao nascer", () => {
    const velho = { ...base, contrato: { projetoIncentivado: "Nome provisório", leiIncentivo: "Lei padrão" } } as typeof base;
    expect(incentivoDoContrato(velho)).toEqual({
      projetoIncentivado: "Prêmio Jornalista",
      codigoProjetoIncentivado: "PRONAC 26 1234",
      leiIncentivo: "Lei Rouanet",
    });
  });

  it("OS não emitida: a correção à mão no contrato não vale mais — só os Dados Gerais (18/11/2026)", () => {
    const corrigido = { ...base, contrato: { codigoProjetoIncentivado: "PRONAC 26 9999", incentivoManual: true } } as typeof base;
    expect(incentivoDoContrato(corrigido).codigoProjetoIncentivado).toBe("PRONAC 26 1234");
    expect(incentivoDoContrato(corrigido).projetoIncentivado).toBe("Prêmio Jornalista");
  });

  it("OS emitida: segue como saiu, com a correção à mão de antes", () => {
    const emitida = { ...base, status: "Emitida", fase: "emitida", contrato: { codigoProjetoIncentivado: "PRONAC 26 9999", incentivoManual: true } } as typeof base;
    expect(incentivoDoContrato(emitida).codigoProjetoIncentivado).toBe("PRONAC 26 9999");
  });
});

describe("projeto incentivado na nota (Faturamento, PDF e planilha)", async () => {
  const { incentivoDaNota, incentivoFaltando, incentivoDosDadosGerais } = await import("./os");
  const projeto = { projetoIncentivado: "Festival", codigoProjetoIncentivado: "PRONAC 26 1234", leiIncentivo: "Lei Rouanet", incentivosFiscais: "" };
  const gravado = { projetoIncentivado: "Nome antigo", codigoProjetoIncentivado: "PRONAC 00 0000", leiIncentivo: "Lei padrão" };

  it("OS não emitida: o que está nos Dados Gerais, e não o que a OS gravou ao nascer", () => {
    const os = { projeto, financeiro: gravado, status: "Ativa", fase: "financeiro" } as unknown as Parameters<typeof incentivoDaNota>[0];
    expect(incentivoDaNota(os)).toEqual({ projetoIncentivado: "Festival", codigoProjetoIncentivado: "PRONAC 26 1234", leiIncentivo: "Lei Rouanet" });
  });

  it("OS emitida: o que saiu nela", () => {
    const os = { projeto, financeiro: gravado, status: "Emitida", fase: "emitida" } as unknown as Parameters<typeof incentivoDaNota>[0];
    expect(incentivoDaNota(os)).toEqual(gravado);
  });

  it("OS emitida sem o faturamento gravado: a foto do projeto na emissão", () => {
    const os = { projeto, financeiro: {}, status: "Emitida", fase: "emitida" } as unknown as Parameters<typeof incentivoDaNota>[0];
    expect(incentivoDaNota(os)).toEqual({ projetoIncentivado: "Festival", codigoProjetoIncentivado: "PRONAC 26 1234", leiIncentivo: "Lei Rouanet" });
  });

  it("projeto antigo cai no texto único na Lei e aponta o que falta", () => {
    const d = incentivoDosDadosGerais({ projetoIncentivado: "", codigoProjetoIncentivado: "", leiIncentivo: "", incentivosFiscais: "Rouanet — PRONAC 1" });
    expect(d.leiIncentivo).toBe("Rouanet — PRONAC 1");
    expect(incentivoFaltando(d)).toEqual(["Nome do Projeto Incentivado", "Código do Projeto Incentivado"]);
  });
});
