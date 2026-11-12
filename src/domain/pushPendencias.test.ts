/**
 * Push com o navegador fechado (11/11/2026): quem está com o app aberto calcula
 * as pendências DOS OUTROS. O recorte tem de ser o do sino de cada um — com o
 * nome e as permissões da pessoa avisada, nunca as de quem calculou.
 */
import { describe, expect, it } from "vitest";
import type { Pendencia } from "./pendencias";
import { avisosParaPush, chaveEnvio, chavePendencia, podeDaPessoa, type PessoaComPush } from "./pushPendencias";

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
      // conversa: a chave leva a marca da última mensagem (ver `chavePendencia`)
      "u-barbara": [chavePendencia(comentario)],
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

describe("a chave do aviso (conversa que volta, OS devolvida)", () => {
  const thread = (resumo: string): Pendencia =>
    ({ ...comentario, titulo: `Observação para Bárbara Souza em Palco: ${resumo}` }) as Pendencia;

  it("a MESMA thread com outra última mensagem é um aviso novo", () => {
    expect(chavePendencia(thread("pode confirmar?"))).not.toBe(chavePendencia(thread("e o prazo?")));
    expect(chavePendencia(thread("pode confirmar?"))).toBe(chavePendencia(thread("pode confirmar?")));
  });

  it("a bola que volta para a pessoa avisa de novo; a que não mudou, não", () => {
    const primeira = avisosParaPush([thread("pode confirmar?")], pessoas, padrao, new Set());
    const ja = new Set(primeira.flatMap((a) => a.pendencias.map((p) => chaveEnvio(a.userId, p.id))));
    // nada mudou na thread: silêncio
    expect(avisosParaPush([thread("pode confirmar?")], pessoas, padrao, ja)).toEqual([]);
    // ela respondeu, a outra perguntou de novo: a vez voltou
    const de_novo = avisosParaPush([thread("e o prazo?")], pessoas, padrao, ja);
    expect(de_novo.map((a) => a.userId)).toEqual(["u-barbara"]);
  });

  it("OS devolvida e reenviada para a mesma etapa avisa de novo (marca da etapa)", () => {
    const naEtapa = (faseEm: string) => ({ ...etapa("direcao", "oss.validarContrato"), versao: faseEm }) as Pendencia;
    expect(chavePendencia(naEtapa("2026-11-12T10:00:00Z"))).not.toBe(chavePendencia(naEtapa("2026-11-12T15:00:00Z")));
    const ja = new Set(
      avisosParaPush([naEtapa("2026-11-12T10:00:00Z")], pessoas, padrao, new Set()).flatMap((a) =>
        a.pendencias.map((p) => chaveEnvio(a.userId, p.id)),
      ),
    );
    expect(avisosParaPush([naEtapa("2026-11-12T10:00:00Z")], pessoas, padrao, ja)).toEqual([]);
    expect(avisosParaPush([naEtapa("2026-11-12T15:00:00Z")], pessoas, padrao, ja).map((a) => a.userId)).toEqual(["u-marisa"]);
  });

  it("o resto das pendências segue pelo id, sem marca", () => {
    expect(chavePendencia(doProdutor)).toBe("os.emitir:os2");
    expect(chavePendencia(etapa("financeiro", "oss.etapaFinanceiro"))).toBe("os.fase:os1:financeiro");
  });
});
