import { describe, expect, it } from "vitest";
import { emailCredenciamento, textoWhatsAppCredenciamento } from "./templates";

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
  it("e-mail: título, abertura, dados do projeto, link e prazo lançado do credenciamento", () => {
    const m = emailCredenciamento(os("2026-10-10"), ec);
    expect(m.assunto).toContain("Alerta: Credenciamento da Equipe");
    expect(m.html).toContain("Esta é uma mensagem automática do sistema de gestão da Pólobh.");
    expect(m.html).toContain("garantir o acesso dos integrantes ao evento");
    expect(m.html).toContain("Festival X");
    expect(m.html).toContain("Prazo para envio:</b> 10 10 26");
  });

  it("WhatsApp: mesmo texto, com o link e o prazo", () => {
    const t = textoWhatsAppCredenciamento(os("2026-10-10"), ec);
    expect(t).toContain("*Alerta: Credenciamento da Equipe*");
    expect(t).toContain("Formulário de credenciamento:");
    expect(t).toContain("Prazo para envio:* 10 10 26");
  });
});
