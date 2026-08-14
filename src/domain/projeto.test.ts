import { describe, expect, it } from "vitest";
import {
  camposObrigatoriosProjeto,
  compoeTituloProjeto,
  normalizarProjetoInfo,
  projetoInfoVazio,
  ETAPAS_CRONOGRAMA,
  idBlocoEtapa,
  idBlocoExtra,
  novoBlocoCronograma,
} from "./projeto";
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

describe("cronograma do projeto — blocos livres", () => {
  it("projeto novo já vem com as cinco etapas padrão na ordem", () => {
    const info = projetoInfoVazio();
    expect(info.cronogramaExtras).toEqual([]);
    expect(info.cronogramaOrdem).toEqual(ETAPAS_CRONOGRAMA.map((e) => idBlocoEtapa(e.key)));
  });

  it("projeto legado (sem os campos novos) ganha ordem completa sem perder etapa", () => {
    const info = normalizarProjetoInfo({ titulo: "Antigo", evento: "2026-05-10", horario: "08h às 18h" });
    expect(info.cronogramaExtras).toEqual([]);
    for (const e of ETAPAS_CRONOGRAMA) expect(info.cronogramaOrdem).toContain(idBlocoEtapa(e.key));
    // Data legada continua migrando para o bloco Evento.
    expect(info.cronograma.evento[0].data).toBe("2026-05-10");
  });

  it("preserva blocos livres e a ordem salva", () => {
    const extra = novoBlocoCronograma();
    const ordem = [idBlocoExtra(extra.id), ...ETAPAS_CRONOGRAMA.map((e) => idBlocoEtapa(e.key))];
    const info = normalizarProjetoInfo({ cronogramaExtras: [extra], cronogramaOrdem: ordem });
    expect(info.cronogramaOrdem).toEqual(ordem);
    expect(info.cronogramaExtras[0].titulo).toBe(extra.titulo);
  });

  it("descarta ids órfãos da ordem e acrescenta blocos que faltavam", () => {
    const info = normalizarProjetoInfo({
      cronogramaExtras: [],
      cronogramaOrdem: ["extra:bloco-que-nao-existe", idBlocoEtapa("evento")],
    });
    expect(info.cronogramaOrdem).not.toContain("extra:bloco-que-nao-existe");
    expect(info.cronogramaOrdem[0]).toBe(idBlocoEtapa("evento"));
    expect(info.cronogramaOrdem).toHaveLength(ETAPAS_CRONOGRAMA.length);
  });

  it("respeita um bloco esvaziado por arraste (não recria data em branco)", () => {
    const info = normalizarProjetoInfo({ cronograma: { ensaios: [] } });
    expect(info.cronograma.ensaios).toEqual([]);
  });
});
