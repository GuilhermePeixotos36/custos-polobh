import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { celulaCsv, csvDosLogs, detalheComoTexto, nomeDoCsv } from "./csv";
import type { ItemLog } from "./logsStore";

const item: ItemLog = {
  id: "log:1", fonte: "log", em: "2026-03-10T15:04:05Z", categoria: "atividade", nivel: "info", acao: "exportacao",
  resultado: "ok", atorNome: "Pessoa Teste", atorId: null, alvoTipo: null, alvoId: null, alvoRotulo: null,
  tela: "/projetos", origem: "app", mensagem: "=HYPERLINK(\"http://x\")", detalhe: null, ip: "203.0.113.9",
  userAgent: null, correlacao: null,
};

describe("CSV", () => {
  it("aspas dobradas, ponto e vírgula e quebra de linha ficam dentro da célula", () => {
    expect(celulaCsv('a "b"; c\nd')).toBe('"a ""b""; c\nd"');
  });

  it("neutraliza o que o Excel leria como fórmula", () => {
    for (const inicio of ["=", "+", "-", "@", "\t", "\r"]) {
      expect(celulaCsv(`${inicio}HYPERLINK("http://x")`).startsWith(`"'${inicio}`)).toBe(true);
    }
    expect(celulaCsv("texto comum")).toBe('"texto comum"');
  });

  it("gera a marca de ordem de bytes, o cabeçalho e uma linha por evento", () => {
    const csv = csvDosLogs([item]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const linhas = csv.slice(1).split("\r\n");
    expect(linhas[0]).toBe('"Data/hora";"Usuário";"Ação";"Alvo";"Tela";"Nível";"Resultado";"Origem";"IP";"Mensagem"');
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toContain('"Exportação"');
    expect(linhas[1]).toContain('"Projetos"');
    expect(linhas[1]).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("nome do arquivo", () => {
    expect(nomeDoCsv("erros", "2026-03-04", "2026-03-10")).toBe("logs-erros-2026-03-04-a-2026-03-10.csv");
  });
});

describe("detalhe", () => {
  it("vira texto com 2 espaços; HTML fica como texto", () => {
    expect(detalheComoTexto({ a: "<img src=x onerror=alert(1)>" })).toBe('{\n  "a": "<img src=x onerror=alert(1)>"\n}');
    expect(detalheComoTexto(null)).toBe("");
  });
});
