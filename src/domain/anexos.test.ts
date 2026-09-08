import { describe, expect, it } from "vitest";
import {
  ACCEPT_ANEXOS,
  MAXIMO_ANEXOS_POR_COMENTARIO,
  MIMES_ACEITOS,
  TAMANHO_MAXIMO_ANEXO,
  caminhoAnexo,
  extensaoDe,
  iconeAnexo,
  motivoRecusaAnexo,
  nomeSeguroAnexo,
  tamanhoLegivel,
  tipoDoAnexo,
} from "./anexos";

const arquivo = (name: string, size = 1024, type = "") => ({ name, size, type });

describe("o que pode subir", () => {
  it("aceita o que a produção usa", () => {
    for (const nome of ["planta.pdf", "foto.JPG", "buffet.xlsx", "contrato.docx", "lista.csv"]) {
      expect(motivoRecusaAnexo(arquivo(nome))).toBeNull();
    }
  });

  it("recusa o que o navegador executaria", () => {
    for (const nome of ["pagina.html", "logo.svg", "script.js", "app.exe"]) {
      expect(motivoRecusaAnexo(arquivo(nome))).toContain("não é um tipo aceito");
    }
  });

  it("recusa arquivo sem extensão", () => {
    expect(motivoRecusaAnexo(arquivo("orcamento"))).toContain("não é um tipo aceito");
  });

  it("recusa acima do limite, dizendo o tamanho e o teto", () => {
    const motivo = motivoRecusaAnexo(arquivo("video.pdf", TAMANHO_MAXIMO_ANEXO + 1));
    expect(motivo).toContain("5 MB");
    expect(motivo).toContain("o limite é");
  });

  it("aceita exatamente no limite", () => {
    expect(motivoRecusaAnexo(arquivo("grande.pdf", TAMANHO_MAXIMO_ANEXO))).toBeNull();
  });

  it("recusa arquivo vazio", () => {
    expect(motivoRecusaAnexo(arquivo("vazio.pdf", 0))).toContain("está vazio");
  });

  it("para no teto de arquivos por comentário", () => {
    expect(motivoRecusaAnexo(arquivo("ok.pdf"), MAXIMO_ANEXOS_POR_COMENTARIO - 1)).toBeNull();
    expect(motivoRecusaAnexo(arquivo("ok.pdf"), MAXIMO_ANEXOS_POR_COMENTARIO)).toContain("até 5 arquivos");
  });
});

describe("tipo do arquivo", () => {
  it("respeita o que o navegador informou", () => {
    expect(tipoDoAnexo(arquivo("foto.jpg", 1, "image/jpeg"))).toBe("image/jpeg");
  });

  it("deduz pela extensão quando o celular manda sem tipo", () => {
    expect(tipoDoAnexo(arquivo("foto.heic", 1, ""))).toBe("image/heic");
    expect(tipoDoAnexo(arquivo("plan.xlsx", 1, "application/octet-stream")))
      .toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("todo tipo deduzido está na lista que o bucket aceita", () => {
    for (const ext of ["jpg", "pdf", "xlsx", "csv", "txt"]) {
      expect(MIMES_ACEITOS).toContain(tipoDoAnexo(arquivo(`x.${ext}`)));
    }
  });

  it("o accept do seletor cobre as mesmas extensões", () => {
    expect(ACCEPT_ANEXOS).toContain(".pdf");
    expect(ACCEPT_ANEXOS).toContain(".xlsx");
    expect(ACCEPT_ANEXOS).not.toContain(".svg");
  });
});

describe("nome e caminho no bucket", () => {
  it("tira acento, espaço e barra do nome do arquivo", () => {
    expect(nomeSeguroAnexo("Orçamento Final /2026.pdf")).toBe("Orcamento-Final-2026.pdf");
  });

  it("não deixa o nome vazio nem começando por ponto", () => {
    expect(nomeSeguroAnexo("...")).toBe("arquivo");
    expect(nomeSeguroAnexo("")).toBe("arquivo");
  });

  it("não deixa subir de pasta", () => {
    const nome = nomeSeguroAnexo("../../etc/passwd");
    expect(nome).not.toContain("/");
    expect(nome).not.toContain("..");
  });

  it("guarda uma pasta por tarefa", () => {
    expect(caminhoAnexo("tarefa-1", "abc", "Planta do Local.pdf")).toBe("tarefa-1/abc-Planta-do-Local.pdf");
  });

  it("lê a extensão sem se confundir com ponto no meio", () => {
    expect(extensaoDe("Relatório v1.2.final.PDF")).toBe("pdf");
    expect(extensaoDe("semponto")).toBe("");
  });
});

describe("apresentação", () => {
  it("tamanho como a pessoa lê", () => {
    expect(tamanhoLegivel(512)).toBe("512 B");
    expect(tamanhoLegivel(1024 * 820)).toBe("820 KB");
    expect(tamanhoLegivel(1024 * 1024 * 1.44)).toBe("1,4 MB");
  });

  it("cada família de arquivo tem seu ícone", () => {
    expect(iconeAnexo("foto.png")).toBe("🖼️");
    expect(iconeAnexo("orcamento.pdf")).toBe("📕");
    expect(iconeAnexo("buffet.xlsx")).toBe("📊");
    expect(iconeAnexo("contrato.docx")).toBe("📄");
  });
});
