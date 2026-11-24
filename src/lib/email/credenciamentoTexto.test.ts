import { describe, expect, it } from "vitest";
import { textoWhatsAppCredenciamento } from "./templates";

const ec = { projeto: { titulo: "Festival X", local: "Expominas", cronograma: {}, etapasOcultas: [] } } as never;
const os = (prazoLimite?: string) =>
  ({
    numero: "OS-1",
    slugCredenciamento: "abc",
    projeto: { titulo: "Festival X", local: "Expominas", cronograma: {}, etapasOcultas: [] },
    fornecedor: { razaoSocial: "Som Ltda", email: "a@b.com" },
    credenciamento: { prazoLimite },
  }) as never;

describe("texto padrão do credenciamento", () => {
  it("WhatsApp: título, abertura, dados do projeto, link e prazo lançado do credenciamento", () => {
    const t = textoWhatsAppCredenciamento(os("2026-10-10"), ec);
    expect(t).toContain("Esta é uma mensagem automática do sistema de gestão da Pólobh.");
    expect(t).toContain("Festival X");
    expect(t).toContain("*Alerta: Credenciamento da Equipe*");
    expect(t).toContain("Formulário de credenciamento:");
    expect(t).toContain("Prazo para envio:* 10 10 26");
  });
});
