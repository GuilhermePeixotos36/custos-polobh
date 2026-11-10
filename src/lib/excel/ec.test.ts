import { beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { criarEcExcelBuffer } from "./ec";
import { encaixarLogo, larguraParaTexto, linhasVisuais } from "./shared";
import { honorariosPadrao, encargosPadrao, producaoZerada,
  bvVazio,
} from "@/domain/calc";
import type { Ec, EcLinha } from "@/data/types";
import { projetoInfoVazio } from "@/domain/projeto";

/** O gerador busca a logo por fetch("/polobh-logo.png"); em teste servimos o arquivo real. */
beforeAll(() => {
  const png = readFileSync(resolve(process.cwd(), "public/polobh-logo.png"));
  globalThis.fetch = (async () => ({
    ok: true,
    arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
  })) as unknown as typeof fetch;
});

const linha = (p: Partial<EcLinha>): EcLinha => ({
  id: "l1", grupo: "PRODUÇÃO", item: "Item", descricao: "", descricaoCompleta: "",
  valorPolobh: 0, valorCliente: 0, valorGasto: 0,
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [], bv: bvVazio(),
  statusAprovacao: "Pendente",
  fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "", faturaNf: "",
  codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
  observacao: "", observacoes: [], oculto: false, ordem: 0, ...p,
});

const ecBase = (linhas: EcLinha[]): Ec => ({
  id: "ec1", numero: "EC – Teste – V01", slugPublico: "", versao: 1, status: "Rascunho",
  projetoId: "p1", template: "Cultural", clienteId: "c1",
  cliente: {
    id: "c1", apelido: "ACME", nome: "ACME", razaoSocial: "ACME LTDA", endereco: "Rua X, 100",
    cnpjCpf: "12.345.678/0001-95", inscricaoEstadual: "", inscricaoMunicipal: "",
    representante: { nome: "Fulano", cargo: "Diretor", telefones: "(31) 99999-0000", email: "f@acme.com" },
  },
  projeto: { ...projetoInfoVazio(), titulo: "Convenção 2026", local: "Teatro" },
  observacoes: [],
  linhas, producao: producaoZerada(), honorarios: honorariosPadrao(), encargos: encargosPadrao(),
  responsavel: "Marisa", validadeDias: 30, criadoEm: "2026-02-22", atualizadoEm: "2026-02-22", ativa: true,
});

async function abrir(ec: Ec, modelo: "completa" | "financeiro" = "completa") {
  const { buffer, nome } = await criarEcExcelBuffer(ec, modelo);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return { ws: wb.getWorksheet("EC")!, wb, nome };
}

describe("Excel da EC", () => {
  it("usa apenas 'Estimativa de Custos | Proposta Comercial' como título", async () => {
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]));
    expect(ws.getCell("B1").value).toBe("Estimativa de Custos | Proposta Comercial");
    // O título da EC continua disponível, na linha de identificação (procurada
    // pelo rótulo, não por posição fixa — o cabeçalho pode ganhar/perder linhas).
    let identificacao = "";
    ws.eachRow((row) => {
      if (String(row.getCell("A").value ?? "").startsWith("Número EC")) identificacao = String(row.getCell("B").value ?? "");
    });
    expect(identificacao).toContain("Convenção 2026");
  });

  it("embute a logo preservando a proporção do arquivo", async () => {
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]));
    const imagens = ws.getImages();
    expect(imagens).toHaveLength(1);
    // `ext` existe no anchor gravado, mas não está no tipo público do ExcelJS.
    const { width, height } = (imagens[0].range as unknown as { ext: { width: number; height: number } }).ext;
    const png = readFileSync(resolve(process.cwd(), "public/polobh-logo.png"));
    const proporcaoArquivo = png.readUInt32BE(16) / png.readUInt32BE(20);
    expect(width / height).toBeCloseTo(proporcaoArquivo, 1);
  });

  it("dá altura às linhas com texto longo, para não cortar conteúdo", async () => {
    const descricaoLonga = "Contratação de serviços de buffet, sendo: ".repeat(12);
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", descricao: descricaoLonga, valorPolobh: 1000 })]));
    let alturaDoItem = 0;
    ws.eachRow((row) => {
      if (String(row.getCell("A").value ?? "") === "Buffet") alturaDoItem = Number(row.height ?? 0);
    });
    expect(alturaDoItem).toBeGreaterThan(30);
  });

  it("não escreve barras nas datas automáticas", async () => {
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]));
    const textos: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "string") textos.push(c.value); }));
    const comData = textos.filter((t) => /\d{2}\s\d{2}\s\d{2}/.test(t));
    expect(comData.length).toBeGreaterThan(0);
    expect(textos.some((t) => /\d{2}\/\d{2}\/\d{2}/.test(t))).toBe(false);
  });

  it("mostra a taxa mínima no rótulo quando ela é a que vale", async () => {
    const ec = ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]);
    ec.honorarios = { modo: "percentual", valor: 0.15, minimo: 5000 };
    const { ws } = await abrir(ec);
    const textos: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "string") textos.push(c.value); }));
    expect(textos.some((t) => t.includes("taxa mínima") && t.includes("mínimo aplicado"))).toBe(true);
  });

  it("item com dois fornecedores sai como UMA linha nos dois modelos, com a soma e a descrição do principal", async () => {
    const partes = [
      linha({
        id: "p1", item: "Equipe", descricao: "Contratação de equipe de produção, sendo:",
        valorPolobh: 750, divisao: "div-p1", ordem: 0, statusOs: "OK",
        fornecedorRazao: "Barbara Duarte Miranda", fornecedorCnpj: "106.886.796-50",
      }),
      linha({
        id: "p2", item: "Equipe", descricao: "Contratação de equipe de produção, sendo:",
        valorPolobh: 750, divisao: "div-p1", ordem: 1, statusOs: "OK",
        fornecedorRazao: "Dedicato Turismo LTDA", fornecedorCnpj: "18.190.388/0001-04",
      }),
    ];
    for (const modelo of ["completa", "financeiro"] as const) {
      const { ws } = await abrir(ecBase(partes), modelo);
      const linhasDoItem: number[] = [];
      ws.eachRow((row, i) => { if (String(row.getCell("A").value ?? "") === "Equipe") linhasDoItem.push(i); });
      expect(`${modelo}:${linhasDoItem.length}`).toBe(`${modelo}:1`);
      expect(ws.getCell(`C${linhasDoItem[0]}`).value).toBe(1500);
      if (modelo === "completa") {
        expect(ws.getCell(`F${linhasDoItem[0]}`).value).toBe("Barbara Duarte Miranda\nDedicato Turismo LTDA");
        expect(ws.getCell(`G${linhasDoItem[0]}`).value).toBe("106.886.796-50\n18.190.388/0001-04");
        expect(ws.getCell(`K${linhasDoItem[0]}`).value).toBe("OK");
      }
    }
  });

  it("gera o modelo financeiro sem quebrar", async () => {
    const { ws, nome } = await abrir(ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]), "financeiro");
    expect(ws.rowCount).toBeGreaterThan(10);
    expect(nome).toBeTruthy();
  });
});

describe("helpers de layout do Excel", () => {
  it("o modelo financeiro também traz a descrição completa, logo abaixo do resumo", async () => {
    const { ws } = await abrir(ecBase([linha({
      item: "Promotores", descricao: "Contratação de Equipe Promotores, sendo:",
      descricaoCompleta: "<ul><li><strong>Saguão Prédio</strong><ul><li>01 profissional x 01 diária de 04 horas</li></ul></li></ul>",
      valorPolobh: 988,
    })]), "financeiro");
    const celulas: string[] = [];
    let negritos: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => {
      const v = c.value as { richText?: { text: string; font?: { bold?: boolean } }[] } | string | null;
      if (v && typeof v === "object" && v.richText) {
        celulas.push(v.richText.map((t) => t.text).join(""));
        negritos = negritos.concat(v.richText.filter((t) => t.font?.bold).map((t) => t.text));
      } else celulas.push(String(v ?? ""));
    }));
    const descritivo = celulas.find((t) => t.includes("Contratação de Equipe Promotores"));
    expect(descritivo).toContain("Saguão Prédio");
    expect(descritivo).toContain("01 profissional x 01 diária de 04 horas");
    expect(descritivo!.indexOf("Contratação")).toBeLessThan(descritivo!.indexOf("Saguão"));
    // O negrito da tela chega à planilha (06/11/2026).
    expect(negritos).toEqual(["Saguão Prédio"]);
  });

  it("encaixarLogo respeita a proporção e a caixa", () => {
    const ext = encaixarLogo({ buffer: new Uint8Array(0), largura: 523, altura: 190 }, { largura: 170, altura: 54 });
    expect(ext.height).toBeLessThanOrEqual(54);
    expect(ext.width).toBeLessThanOrEqual(170);
    expect(ext.width / ext.height).toBeCloseTo(523 / 190, 1);
  });

  it("linhasVisuais conta quebras manuais e estouro de largura", () => {
    expect(linhasVisuais("", 20)).toBe(1);
    expect(linhasVisuais("a\nb\nc", 20)).toBe(3);
    expect(linhasVisuais("x".repeat(60), 20)).toBeGreaterThan(2);
  });

  it("larguraParaTexto respeita o piso e o teto", () => {
    expect(larguraParaTexto("", 12, 30)).toBe(12);
    expect(larguraParaTexto("abc", 12, 30)).toBe(12);          // cabe no piso
    expect(larguraParaTexto("x".repeat(20), 12, 30)).toBe(22); // cresce com folga
    expect(larguraParaTexto("x".repeat(90), 12, 30)).toBe(30); // trava no teto
    // Mede o maior PARÁGRAFO, não o texto inteiro.
    expect(larguraParaTexto("curto\n" + "y".repeat(20), 12, 30)).toBe(22);
  });
});

/**
 * Trava a formatação medida célula a célula nos modelos oficiais de 2026
 * ("EC - Projetos Culturais/Corporativos - Modelo 2026 ... .xlsx", em
 * reference/, idênticos entre si no desenho). Se alguém "arrumar" um
 * alinhamento ou uma cor por gosto, o teste avisa que saiu do modelo.
 */
describe("fidelidade aos modelos de 2026 da Pólobh", () => {
  /** Acha a linha do cabeçalho da tabela pelo rótulo, não por posição fixa. */
  async function tabela(linhas = [linha({ item: "Buffet", descricao: "Coffee", valorPolobh: 1000, valorCliente: 500 })]) {
    const { ws } = await abrir(ecBase(linhas));
    let hr = 0;
    ws.eachRow((row, i) => {
      if (String(row.getCell("A").value ?? "") === "Item") hr = i;
    });
    return { ws, hr };
  }

  /** Alinhamento por coluna, igual no cabeçalho e nas linhas de item. */
  const ALINHAMENTO: Record<string, string> = {
    A: "left", B: "left", C: "distributed", D: "distributed", E: "center", F: "center",
    G: "center", H: "center", I: "center", J: "center", K: "center", L: "center",
  };
  const COLUNAS = "ABCDEFGHIJKL".split("");

  it("tem as 12 colunas do modelo, com os rótulos e larguras da planilha", async () => {
    const { ws, hr } = await tabela();
    expect(hr).toBeGreaterThan(0);
    const rotulos = ["Item", "Descrição", "Pólobh", "Cliente", "Status Aprovação",
      "Fornecedor\n(Razão Social)", "Fornecedor\n(CNPJ)", "Fatura ou\nNota Fiscal",
      "Código Serviço", "Pedido de Compra", "OS", "Contrato"];
    COLUNAS.forEach((col, i) => expect(ws.getCell(`${col}${hr}`).value).toBe(rotulos[i]));
    // Não existe coluna "Observação" — ela era só uma nota de apoio no modelo.
    expect(ws.getCell(`M${hr}`).value).toBeFalsy();
    // As larguras do modelo são o PISO: uma coluna pode crescer para caber o
    // conteúdo (ver o teste do ajuste automático), nunca encolher.
    const larguras = [29.75, 72.875, 15.625, 15.625, 14.75, 12.25, 10.125, 9.5, 13.5, 16.125, 12.875, 12.875];
    COLUNAS.forEach((_, i) => expect(ws.getColumn(i + 1).width).toBeGreaterThanOrEqual(larguras[i]));
    // A e B são as que quebram texto — elas ficam exatamente no modelo.
    expect(ws.getColumn(1).width).toBe(29.75);
    expect(ws.getColumn(2).width).toBe(72.875);
  });

  it("cabeçalho: alinhamento do modelo e destaque só em E–J", async () => {
    const { ws, hr } = await tabela();
    for (const [col, h] of Object.entries(ALINHAMENTO)) {
      expect(`${col}=${ws.getCell(`${col}${hr}`).alignment?.horizontal}`).toBe(`${col}=${h}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cor = (ref: string) => (ws.getCell(ref).fill as any)?.fgColor?.argb;
    for (const col of ["E", "F", "G", "H", "I", "J"]) expect(cor(`${col}${hr}`)).toBe("FFF6C6AD");
    for (const col of ["A", "B", "C", "D", "K", "L"]) expect(cor(`${col}${hr}`)).toBeUndefined();
    // Altura pelo rótulo mais alto — nunca menos que os 30pt do modelo.
    expect(ws.getRow(hr).height).toBeGreaterThanOrEqual(30);
  });

  it("linha de item: alinhamento, altura de 16,5pt e sem preenchimento fixo", async () => {
    const { ws, hr } = await tabela();
    const ir = hr + 2; // cabeçalho, barra do grupo, primeiro item
    for (const [col, h] of Object.entries(ALINHAMENTO)) {
      expect(`${col}=${ws.getCell(`${col}${ir}`).alignment?.horizontal}`).toBe(`${col}=${h}`);
    }
    expect(ws.getRow(ir).height).toBe(16.5);
    // A cor da faixa de status vem da formatação condicional, nunca de fill fixo.
    for (const col of COLUNAS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((ws.getCell(`${col}${ir}`).fill as any)?.fgColor?.argb).toBeUndefined();
    }
    // Corpo 11 em tudo (o "Item" continua em negrito, mas não maior).
    expect(ws.getCell(`A${ir}`).font?.size).toBe(11);
    expect(ws.getCell(`A${ir}`).font?.bold).toBe(true);
    expect(ws.getCell(`B${ir}`).font?.size).toBe(11);
  });

  it("cores e alturas das faixas vêm do modelo", async () => {
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", valorPolobh: 1000 })]));
    let faixaOuro = 0;
    let faixaGrupo = 0;
    ws.eachRow((row, i) => {
      const v = String(row.getCell("A").value ?? "");
      if (v === "ESTIMATIVA DE CUSTOS") faixaOuro = i;
      if (v === "PRODUÇÃO") faixaGrupo = i;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cor = (ref: string) => (ws.getCell(ref).fill as any)?.fgColor?.argb;
    expect(cor(`A${faixaOuro}`)).toBe("FFFFC000"); // âmbar do modelo
    expect(ws.getRow(faixaOuro).height).toBe(15);
    expect(cor(`A${faixaGrupo}`)).toBe("FFD9D9D9"); // cinza das barras de grupo
    expect(ws.getRow(faixaGrupo).height).toBe(16.5);
  });

  it("realça os status por conteúdo, como as regras condicionais do modelo", async () => {
    const { ws, hr } = await tabela([
      linha({ id: "a", item: "Cachê", statusAprovacao: "OK", statusOs: "Emitir Nova Versão" }),
      linha({ id: "b", item: "Teatro" }),
    ]);
    // `conditionalFormattings` existe em runtime, mas não nos tipos do ExcelJS.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cf = (ws as any).conditionalFormattings as { ref: string; rules: unknown[] }[];
    // Cobre a faixa E:L só das linhas de item (a barra do grupo fica de fora).
    const status = cf.find((x) => x.ref === `E${hr + 2}:L${hr + 3}`)!;
    expect(status).toBeDefined();
    // Ao reabrir, o texto da regra fica dentro da fórmula SEARCH("...").
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regras = (status.rules as any[]).map((x) => ({
      texto: String(x.formulae?.[0] ?? "").match(/SEARCH\("([^"]+)"/)?.[1] ?? "",
      cor: x.style?.fill?.bgColor?.argb,
      priority: x.priority,
    }));
    const porTexto = Object.fromEntries(regras.map((x) => [x.texto, x.cor]));
    expect(porTexto["Pendente"]).toBe("FFFFC7CE"); // vermelho
    expect(porTexto["OK"]).toBe("FFC6EFCE");       // verde
    expect(porTexto["Emitir"]).toBe("FFFFEB9C");   // âmbar (pega "Emitir Nova Versão" também)
    expect(porTexto["Não se Aplica"]).toBe("FFC6EFCE");
    // "Nota Fiscal" tem de vencer "Fatura" para "Fatura e Nota Fiscal" sair verde.
    const iNf = regras.findIndex((x) => x.texto === "Nota Fiscal");
    const iFat = regras.findIndex((x) => x.texto === "Fatura");
    expect(regras[iNf].priority).toBeLessThan(regras[iFat].priority);
  });

  it("pinta de amarelo claro as células de valor preenchidas (> 0)", async () => {
    const { ws, hr } = await tabela([
      linha({ id: "a", item: "Cachê", valorPolobh: 1000 }),
      linha({ id: "b", item: "Teatro" }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cf = (ws as any).conditionalFormattings as { ref: string; rules: unknown[] }[];
    const valores = cf.find((x) => x.ref === `C${hr + 2}:D${hr + 3}`);
    expect(valores).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regra = (valores!.rules as any[])[0];
    expect(regra.operator).toBe("greaterThan");
    expect(regra.formulae?.[0]).toBe("0");
    expect(regra.style?.fill?.bgColor?.argb).toBe("FFFFEB9C"); // mesmo amarelo do "Emitir"
  });

  it("não leva as observações do item para a planilha — elas são internas", async () => {
    const { ws } = await abrir(ecBase([
      linha({
        item: "Buffet", descricao: "Coffee", valorPolobh: 1000,
        observacoes: [{ id: "o1", texto: "Confirmar cardápio com a Ana", autorId: "", autorNome: "Marisa", criadoEm: "", responsavelNome: "", resolvida: false, respostas: [] }],
      }),
    ]));
    const textos: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "string") textos.push(c.value); }));
    expect(textos.join(" | ")).not.toContain("Confirmar cardápio");
    expect(textos.join(" | ")).not.toContain("Observações:");
  });

  it("descrição e descrição completa ficam na MESMA célula da coluna B", async () => {
    const { ws, hr } = await tabela([
      linha({
        id: "a", item: "Buffet", descricao: "Coffee break para 300 pessoas",
        descricaoCompleta: "<p>Serviço completo</p><ul><li>Bebidas</li><li>Salgados</li></ul>",
        valorPolobh: 1000,
        observacoes: [{ id: "o1", texto: "Confirmar cardápio", autorId: "", autorNome: "Ana", criadoEm: "", responsavelNome: "", resolvida: false, respostas: [] }],
      }),
    ]);
    const inicio = hr + 2; // cabeçalho, barra do grupo, item
    const descritivo = String(ws.getCell(`B${inicio}`).value);
    expect(descritivo).toContain("Coffee break para 300 pessoas");
    expect(descritivo).toContain("Serviço completo");
    expect(descritivo).toContain("• Bebidas");
    // Cabendo numa linha só, não há nada para mesclar — o item ocupa uma linha.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merges: string[] = (ws.model as any).merges ?? [];
    expect(merges.some((m) => m.startsWith(`A${inicio}:A`))).toBe(false);
    expect(Number(ws.getRow(inicio).height)).toBeGreaterThan(16.5);
  });

  it("item que não cabe numa linha ganha linhas — e TODAS as colunas mesclam junto", async () => {
    // Descritivo maior que os 409,5pt de uma linha: o bloco precisa crescer.
    const { ws, hr } = await tabela([
      linha({
        id: "a", item: "Estrutura", descricao: "Resumo",
        descricaoCompleta: `<p>${"Fornecimento de estrutura metálica, ".repeat(200)}</p>`,
      }),
    ]);
    const inicio = hr + 2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merges: string[] = (ws.model as any).merges ?? [];
    const bloco = merges.filter((m) => m.startsWith(`A${inicio}:A`));
    expect(bloco).toHaveLength(1);
    const fim = Number(bloco[0].split(":A")[1]);
    expect(fim).toBeGreaterThan(inicio);
    // O nome do item acompanha as linhas da descrição, na coluna dele; a coluna
    // B mescla junto, para o descritivo ficar inteiro numa célula só.
    for (const col of "ABCDEFGHIJKL") expect(merges).toContain(`${col}${inicio}:${col}${fim}`);
    // Nenhuma LINHA passa do teto do Excel — a célula mesclada, sim.
    for (let i = inicio; i <= fim; i++) expect(Number(ws.getRow(i).height)).toBeLessThanOrEqual(409.5);
  });

  it("fecha o item com moldura nos quatro lados", async () => {
    const { ws, hr } = await tabela([
      linha({ id: "a", item: "Buffet", descricao: "Coffee", descricaoCompleta: "<p>Detalhe</p>" }),
    ]);
    const inicio = hr + 2;
    for (const ref of [`A${inicio}`, `B${inicio}`, `E${inicio}`, `L${inicio}`]) {
      expect(ws.getCell(ref).border?.top?.style).toBe("medium");
      expect(ws.getCell(ref).border?.bottom?.style).toBe("medium");
    }
    expect(ws.getCell(`A${inicio}`).border?.left?.style).toBe("medium");
    expect(ws.getCell(`L${inicio}`).border?.right?.style).toBe("medium");
    // Por dentro do bloco a grade continua fina.
    expect(ws.getCell(`E${inicio}`).border?.left?.style).toBe("thin");
  });

  it("descritivo enorme continua INTEIRO numa célula, e o bloco cresce para caber", async () => {
    const gigante = "Fornecimento de estrutura, ".repeat(900);
    const { ws, hr } = await tabela([
      linha({ id: "a", item: "Estrutura", descricao: "Resumo", descricaoCompleta: `<p>${gigante}</p>` }),
    ]);
    const inicio = hr + 2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merges: string[] = (ws.model as any).merges ?? [];
    const fim = Number(merges.find((m) => m.startsWith(`A${inicio}:A`))!.split(":A")[1]);
    expect(fim - inicio).toBeGreaterThan(1); // precisou de várias linhas
    // Nada de repartir o texto: ele está inteiro na célula mesclada.
    expect(String(ws.getCell(`B${inicio}`).value)).toContain(gigante.trim());
    let somaAlturas = 0;
    for (let i = inicio; i <= fim; i++) {
      expect(Number(ws.getRow(i).height)).toBeLessThanOrEqual(409.5);
      somaAlturas += Number(ws.getRow(i).height);
    }
    // A célula mesclada vale a soma das linhas — é assim que ela passa do teto.
    expect(somaAlturas).toBeGreaterThan(409.5);
  });

  it("corpo 11 em toda a planilha — só o título do documento é maior", async () => {
    const { ws } = await abrir(ecBase([linha({ item: "Buffet", descricao: "Coffee", valorPolobh: 1000 })]));
    const tamanhos = new Set<number>();
    ws.eachRow((row) => row.eachCell((c) => { if (c.font?.size) tamanhos.add(c.font.size); }));
    expect([...tamanhos].filter((t) => t !== 16)).toEqual([11]);
    expect(ws.getCell("B1").font?.size).toBe(16);
  });

  it("alarga a coluna quando o conteúdo não caberia na largura do modelo", async () => {
    const curta = await tabela([linha({ id: "a", item: "Som", fornecedorRazao: "AB" })]);
    const longa = await tabela([
      linha({ id: "a", item: "Som", fornecedorRazao: "Sonorização e Iluminação Cênica Ltda" }),
    ]);
    const largura = (t: { ws: ExcelJS.Worksheet }) => Number(t.ws.getColumn("F").width);
    // Nunca abaixo do modelo, e maior quando o conteúdo pede.
    expect(largura(curta)).toBeGreaterThanOrEqual(12.25);
    expect(largura(longa)).toBeGreaterThan(largura(curta));
  });

  it("realça valores também no modelo financeiro (que não tem faixa de status)", async () => {
    const { buffer } = await criarEcExcelBuffer(ecBase([linha({ item: "Cachê", valorPolobh: 500 })]), "financeiro");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cf = (wb.getWorksheet("EC") as any).conditionalFormattings as { ref: string; rules: unknown[] }[];
    expect(cf).toHaveLength(1);
    expect(cf[0].ref).toMatch(/^C\d+:D\d+$/);
  });
});
