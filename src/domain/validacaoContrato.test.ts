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
  "Coordenação Adm.-Financeira (Tiago)": ["projetos", "ecs", "oss", "oss.editar", "oss.emitir", "financeiro"],
};

const pendenciaDaEtapa = (fase: "direcao" | "financeiro"): Pendencia => ({
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

  it("depois de validada, a pendência passa ao Financeiro (e a Marisa, que vê o financeiro, segue vendo)", () => {
    expect(quemRecebe(pendenciaDaEtapa("financeiro"))).toEqual([
      "Diretoria Produção (Marisa)",
      "Coordenação Adm.-Financeira (Tiago)",
    ]);
  });

});
