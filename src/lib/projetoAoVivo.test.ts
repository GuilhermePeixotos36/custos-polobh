import { describe, expect, it, vi } from "vitest";

vi.mock("@/data", () => ({ repo: {} }));

import type { Ec, Os } from "@/data/types";
import { osComDadosAtuais } from "./projetoAoVivo";

const viva = { cliente: { nome: "Cliente Novo", razaoSocial: "Novo S.A." }, projeto: { titulo: "Projeto Hoje" } } as unknown as Ec;
const os = (p: Partial<Os>) =>
  ({ cliente: { nome: "Cliente Velho" }, projeto: { titulo: "Projeto Antigo" }, status: "Rascunho", ...p }) as unknown as Os;

describe("osComDadosAtuais", () => {
  it("OS ainda não emitida sai com o cliente e o projeto do cadastro de agora", () => {
    const r = osComDadosAtuais(os({}), viva);
    expect(r.cliente.nome).toBe("Cliente Novo");
    expect(r.projeto.titulo).toBe("Projeto Hoje");
  });

  it("OS emitida fica com a foto de quando foi emitida", () => {
    const r = osComDadosAtuais(os({ status: "Emitida", fase: "emitida" } as Partial<Os>), viva);
    expect(r.cliente.nome).toBe("Cliente Velho");
    expect(r.projeto.titulo).toBe("Projeto Antigo");
  });

  it("OS emitida completa o projeto incentivado EM BRANCO com os Dados Gerais de agora", () => {
    const vivaInc = {
      ...viva,
      projeto: { titulo: "Projeto Hoje", projetoIncentivado: "Festival Hoje", codigoProjetoIncentivado: "PRONAC 26 1234", leiIncentivo: "Lei Rouanet" },
    } as unknown as Ec;
    const emitida = os({
      status: "Emitida", fase: "emitida",
      projeto: { titulo: "Projeto Antigo", projetoIncentivado: "Festival da Emissão", codigoProjetoIncentivado: "", leiIncentivo: "" },
    } as unknown as Partial<Os>);
    const r = osComDadosAtuais(emitida, vivaInc);
    // O que a emissão gravou continua; só o vazio é completado.
    expect(r.projeto.projetoIncentivado).toBe("Festival da Emissão");
    expect(r.projeto.codigoProjetoIncentivado).toBe("PRONAC 26 1234");
    expect(r.projeto.leiIncentivo).toBe("Lei Rouanet");
    expect(r.projeto.titulo).toBe("Projeto Antigo");
    expect(r.cliente.nome).toBe("Cliente Velho");
  });
});
