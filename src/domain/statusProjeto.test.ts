import { describe, expect, it } from "vitest";
import { eventoEncerradoHaDias, statusProjetoAutomatico } from "./statusProjeto";
import type { Ec, Projeto } from "@/data/types";

const HOJE = new Date("2026-09-15T12:00:00");

const projeto = (evento: string[] = []): Projeto =>
  ({
    id: "p1",
    nome: "Festival",
    info: { cronograma: { evento: evento.map((data) => ({ data })) } },
  }) as unknown as Projeto;

const ec = (p: Partial<Ec>): Ec => ({ id: "e1", projetoId: "p1", ativa: true, status: "Ativa", ...p }) as Ec;

describe("statusProjetoAutomatico — dois estados, como a EC", () => {
  it("projeto sem EC nenhuma está no ar", () => {
    expect(statusProjetoAutomatico(projeto(), [])).toBe("Ativo");
  });

  it("com uma EC valendo, está no ar", () => {
    expect(statusProjetoAutomatico(projeto(), [ec({ ativa: true })])).toBe("Ativo");
  });

  it("sem nenhuma EC no ar, está no arquivo", () => {
    expect(statusProjetoAutomatico(projeto(), [ec({ ativa: false, status: "Arquivada" })])).toBe("Arquivado");
  });

  it("EC 'Cancelada' é dado antigo e conta como arquivada", () => {
    expect(statusProjetoAutomatico(projeto(), [ec({ ativa: false, status: "Cancelada" })])).toBe("Arquivado");
  });

  // O selo "Concluído" saiu em 15/09/2026: ele descrevia o calendário, não o
  // trabalho — e encerrava as pendências sozinho na virada da data do evento,
  // justamente quando ainda há nota, acerto e pagamento pendurados.
  it("evento que já passou NÃO arquiva o projeto sozinho", () => {
    const passado = projeto(["2026-08-01"]);
    expect(statusProjetoAutomatico(passado, [ec({ ativa: true })])).toBe("Ativo");
  });
});

describe("eventoEncerradoHaDias", () => {
  it("devolve null enquanto o evento não terminou", () => {
    expect(eventoEncerradoHaDias(projeto(["2026-09-20"]), HOJE)).toBeNull();
    expect(eventoEncerradoHaDias(projeto(["2026-09-15"]), HOJE)).toBeNull();
  });

  it("conta os dias desde o ÚLTIMO dia do evento", () => {
    expect(eventoEncerradoHaDias(projeto(["2026-09-01", "2026-09-10"]), HOJE)).toBe(5);
  });

  it("projeto sem data de evento não cobra nada", () => {
    expect(eventoEncerradoHaDias(projeto(), HOJE)).toBeNull();
  });
});
