// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { textoDoPdf, type PdfJs } from "./pdfTexto";

describe("texto do PDF de orçamento", () => {
  it("lê o texto e os valores do PDF", async () => {
    const arquivo = readFileSync(fileURLToPath(new URL("./__fixtures__/orcamento.pdf", import.meta.url)));
    const buf = arquivo.buffer.slice(arquivo.byteOffset, arquivo.byteOffset + arquivo.byteLength);
    const texto = await textoDoPdf(pdfjs as unknown as PdfJs, buf);
    expect(texto).toContain("Coffee break 100 pessoas");
    expect(texto).toContain("R$ 4.500,00");
    expect(texto).toContain("R$ 900,00");
  });
});
