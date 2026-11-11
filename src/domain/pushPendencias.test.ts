/**
 * Push com o navegador fechado (11/11/2026): quem está com o app aberto calcula
 * as pendências DOS OUTROS. O recorte tem de ser o do sino de cada um — com o
 * nome e as permissões da pessoa avisada, nunca as de quem calculou.
 */
import { describe, expect, it } from "vitest";
import type { Pendencia } from "./pendencias";
import { avisosParaPush, chaveEnvio, podeDaPessoa, type PessoaComPush } from "./pushPendencias";

const PADRAO: Record<string, string[]> = {
  Direcao: ["projetos", "oss.validarContrato"],
  Administrativo: ["projetos", "oss.etapaFinanceiro"],
  Producao: ["projetos"],
};
const padrao = (papel: string) => PADRAO[papel] ?? [];

const etapa = (fase: string, recurso: string): Pendencia =>
  ({
    id: `os.fase:os1:${fase}`,
    tipo: "os.fase",
    titulo: `Etapa ${fase}`,
    recursoResponsavel: recurso,
    recurso: "projetos",
    projetoId: "p1",
    aba: "os",
    osId: "os1",
  }) as Pendencia;

const comentario: Pendencia = {
  id: "ec.observacao:ec1:o1",
  tipo: "ec.observacao",
  titulo: "Comentário na EC (01)",
  pessoas: ["Bárbara Souza"],
  recurso: "projetos",
  projetoId: "p1",
  aba: "ec",
  ecId: "ec1",
} as Pendencia;

const doProdutor: Pendencia = {
  id: "os.emitir:os2",
  tipo: "os.emitir",
  titulo: "Concluir e enviar a OS",
  responsavelProjeto: "Emanuelle",
  recurso: "projetos",
  projetoId: "p1",
  aba: "os",
  osId: "os2",
} as Pendencia;

const pessoas: PessoaComPush[] = [
  { id: "u-marisa", nome: "Marisa", papel: "Direcao", recursos: ["projetos", "oss.validarContrato"] },
  { id: "u-tiago", nome: "Tiago", papel: "Administrativo", recursos: ["projetos", "oss.etapaFinanceiro"] },
  { id: "u-barbara", nome: "Barbara Souza", papel: "Producao", recursos: null },
  { id: "u-emanuelle", nome: "Emanuelle", papel: "Producao", recursos: [] },
];

const itens = [etapa("direcao", "oss.validarContrato"), etapa("financeiro", "oss.etapaFinanceiro"), comentario, doProdutor];

describe("avisosParaPush", () => {
  it("cada pessoa recebe exatamente o que o sino dela mostra", () => {
    const avisos = avisosParaPush(itens, pessoas, padrao, new Set());
    const por = Object.fromEntries(avisos.map((a) => [a.userId, a.pendencias.map((p) => p.id)]));
    expect(por).toEqual({
      "u-marisa": ["os.fase:os1:direcao"],
      "u-tiago": ["os.fase:os1:financeiro"],
      // o nome casa sem acento e sem diferença de maiúscula, como no sino
      "u-barbara": ["ec.observacao:ec1:o1"],
      "u-emanuelle": ["os.emitir:os2"],
    });
  });

  it("leva ao lugar da pendência", () => {
    const [aviso] = avisosParaPush([comentario], pessoas, padrao, new Set());
    expect(aviso.pendencias[0].url).toBe("/estimativas/ec1");
  });

  it("não reenvia o que este app já mandou nesta sessão", () => {
    const ja = new Set([chaveEnvio("u-marisa", "os.fase:os1:direcao")]);
    const avisos = avisosParaPush(itens, pessoas, padrao, ja);
    expect(avisos.find((a) => a.userId === "u-marisa")).toBeUndefined();
    expect(avisos.find((a) => a.userId === "u-tiago")?.pendencias).toHaveLength(1);
  });

  it("pessoa sem pendência não entra na lista", () => {
    expect(avisosParaPush([doProdutor], pessoas, padrao, new Set()).map((a) => a.userId)).toEqual(["u-emanuelle"]);
  });
});

describe("podeDaPessoa", () => {
  it("a área manda; sem área (ou área vazia) vale o padrão do papel", () => {
    expect(podeDaPessoa({ papel: "Producao", recursos: ["oss.etapaBackoffice"] }, padrao)("oss.etapaBackoffice")).toBe(true);
    expect(podeDaPessoa({ papel: "Direcao", recursos: [] }, padrao)("oss.validarContrato")).toBe(true);
    expect(podeDaPessoa({ papel: "Producao", recursos: null }, padrao)("oss.validarContrato")).toBe(false);
    expect(podeDaPessoa({ papel: "Desconhecido", recursos: null }, padrao)("projetos")).toBe(false);
  });
});
