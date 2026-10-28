import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));
import { emTopicos } from "./correcaoOrtografica";

describe("Descrição Completa em tópicos", () => {
  it("local sem números vira título em negrito, com os itens dentro", () => {
    const html = "<p>Saguão Prédio</p><p>01 profissional x 01 diária de 04 horas</p><p>Auditório</p><p>01 profissional x 01 diária de 04 horas</p>";
    expect(emTopicos(html)).toBe(
      "<ul><li><strong>Saguão Prédio</strong><ul><li>01 profissional x 01 diária de 04 horas</li></ul></li>" +
        "<li><strong>Auditório</strong><ul><li>01 profissional x 01 diária de 04 horas</li></ul></li></ul>"
    );
  });

  it("linhas comuns viram tópicos simples, inclusive as separadas por <br>", () => {
    expect(emTopicos("<p>Montagem completa<br>Som e luz</p>")).toBe("<ul><li>Montagem completa</li><li>Som e luz</li></ul>");
  });

  it("texto que já tem lista fica como está", () => {
    const html = "<p>Intro</p><ul><li>a</li></ul>";
    expect(emTopicos(html)).toBe(html);
  });

  it("aplicar duas vezes não muda nada", () => {
    const uma = emTopicos("<p>Palco</p><p>02 técnicos</p>");
    expect(emTopicos(uma)).toBe(uma);
  });

  it("texto vazio não vira lista", () => {
    expect(emTopicos("<p></p>")).toBe("<p></p>");
  });
});
