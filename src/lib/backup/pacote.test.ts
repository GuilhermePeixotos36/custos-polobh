/**
 * O pacote de back-up: o .zip e o que vai dentro dele.
 *
 * Os módulos testados moram em `supabase/functions/backup/` porque rodam em
 * Deno, dentro da função que gera o back-up. O teste vive aqui, em `src/`,
 * porque é onde a suíte procura — mesmo arranjo dos e-mails de autenticação.
 *
 * Por que testar isto com tanto cuidado: o defeito de um back-up só aparece no
 * dia em que alguém precisa dele de volta, e aí não há conserto. Um .zip que o
 * Windows recusa abrir, uma planilha com acento quebrado ou uma tabela que
 * ficou de fora são falhas silenciosas — passam por "deu certo" no log e só
 * cobram a conta meses depois.
 */
import { describe, expect, it } from "vitest";
import { montarZip, crc32, type ArquivoZip } from "../../../supabase/functions/backup/zip";
import {
  csvDaTabela,
  deveRodarHoje,
  formatarTamanho,
  leiaMe,
  manifesto,
  nomeDeDados,
  nomeDoPacote,
} from "../../../supabase/functions/backup/pacote";

/* -------------------------------------------------------------------------- */
/*                     um leitor de .zip, só para o teste                     */
/* -------------------------------------------------------------------------- */

/**
 * Lê o pacote pelo ÍNDICE do fim do arquivo, que é por onde todo descompactador
 * entra — e não varrendo o corpo, que acharia um arquivo mesmo se o índice
 * estivesse corrompido. Sem isto, o teste provaria menos do que parece.
 */
async function abrirZip(zip: Uint8Array): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  expect(eocd, "o índice final (EOCD) tem de existir").toBeGreaterThanOrEqual(0);

  const quantos = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const saida = new Map<string, Uint8Array>();

  for (let n = 0; n < quantos; n++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50);
    const metodo = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const tamComprimido = dv.getUint32(p + 20, true);
    const tamOriginal = dv.getUint32(p + 24, true);
    const tamNome = dv.getUint16(p + 28, true);
    const tamExtra = dv.getUint16(p + 30, true);
    const tamComentario = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + tamNome));

    // O cabeçalho local tem tamanhos próprios de nome/extra: pular pelo do
    // índice daria no lugar errado assim que houvesse campo extra.
    expect(dv.getUint32(local, true)).toBe(0x04034b50);
    const inicio = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const bruto = zip.subarray(inicio, inicio + tamComprimido);

    const dados = metodo === 8 ? await inflar(bruto) : bruto;

    expect(dados.length, `tamanho de ${nome}`).toBe(tamOriginal);
    expect(crc32(dados), `crc de ${nome}`).toBe(crc);
    saida.set(nome, dados);
    p += 46 + tamNome + tamExtra + tamComentario;
  }
  return saida;
}

/** O inverso do deflate cru — pelo fluxo, e não via Blob/Response (ver zip.ts). */
async function inflar(bruto: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const escritor = ds.writable.getWriter();
  void escritor.write(bruto as BufferSource);
  void escritor.close();
  const partes: Uint8Array[] = [];
  let total = 0;
  const leitor = ds.readable.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value as Uint8Array);
    total += (value as Uint8Array).length;
  }
  const saida = new Uint8Array(total);
  let p = 0;
  for (const parte of partes) {
    saida.set(parte, p);
    p += parte.length;
  }
  return saida;
}

const texto = (s: string) => new TextEncoder().encode(s);
const lerTexto = (b: Uint8Array) => new TextDecoder().decode(b);

/* -------------------------------------------------------------------------- */

describe("o .zip", () => {
  const QUANDO = new Date("2026-09-25T03:00:00Z");

  it("volta com os mesmos arquivos e o mesmo conteúdo", async () => {
    const arquivos: ArquivoZip[] = [
      { nome: "LEIA-ME.txt", dados: texto("Back-up da Pólobh Promoções") },
      { nome: "dados/01-clientes.json", dados: texto(JSON.stringify([{ id: 1, nome: "ACME" }])) },
      { nome: "planilhas/clientes.csv", dados: texto("﻿id;nome\n1;ACME\n") },
    ];
    const lidos = await abrirZip(await montarZip(arquivos, QUANDO));

    expect([...lidos.keys()].sort()).toEqual([
      "LEIA-ME.txt", "dados/01-clientes.json", "planilhas/clientes.csv",
    ]);
    expect(lerTexto(lidos.get("LEIA-ME.txt")!)).toBe("Back-up da Pólobh Promoções");
  });

  // Um back-up é, quase todo, texto repetitivo. Se o deflate não estiver
  // valendo, o pacote de uma base grande estoura o limite do e-mail.
  it("comprime de verdade o que é compressível", async () => {
    const repetido = texto("linha de teste;".repeat(4000));
    const zip = await montarZip([{ nome: "grande.csv", dados: repetido }], QUANDO);
    expect(zip.length).toBeLessThan(repetido.length / 4);
    expect(lerTexto((await abrirZip(zip)).get("grande.csv")!)).toBe(lerTexto(repetido));
  });

  it("aguenta bytes que não são texto (um anexo, um PDF)", async () => {
    const binario = new Uint8Array(5000).map((_, i) => (i * 37) % 256);
    const lidos = await abrirZip(await montarZip([{ nome: "anexos/x/foto.bin", dados: binario }], QUANDO));
    expect(lidos.get("anexos/x/foto.bin")).toEqual(binario);
  });

  it("guarda o nome com acento sem estragá-lo", async () => {
    const lidos = await abrirZip(await montarZip([{ nome: "planilhas/Ação e Produção.csv", dados: texto("ok") }], QUANDO));
    expect([...lidos.keys()]).toEqual(["planilhas/Ação e Produção.csv"]);
  });

  it("pacote sem arquivo nenhum ainda é um .zip válido", async () => {
    expect((await abrirZip(await montarZip([], QUANDO))).size).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */

describe("a planilha de uma tabela", () => {
  // Sem o BOM, o Excel em português lê o UTF-8 como Latin-1 e "Promoções" vira
  // "PromoÃ§Ãµes"; com vírgula no lugar do ';', joga a linha numa coluna só.
  it("sai com BOM e separada por ponto-e-vírgula", () => {
    const csv = csvDaTabela([{ id: 1, nome: "Promoções" }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"1";"Promoções"');
    expect(csv.split("\n")[0]).toBe("﻿id;nome");
  });

  it("protege o texto que tem ponto-e-vírgula, aspas e quebra de linha", () => {
    const csv = csvDaTabela([{ descricao: 'Buffet; 200 pessoas, com "open bar"\ne sobremesa' }]);
    expect(csv).toContain('"Buffet; 200 pessoas, com ""open bar""\ne sobremesa"');
  });

  it("coluna jsonb vira JSON dentro da célula, e não colunas soltas", () => {
    const csv = csvDaTabela([{ id: 1, contrato: { modelo: "Cultural", testemunhas: 2 } }]);
    expect(csv.split("\n")[0]).toBe("﻿id;contrato");
    expect(csv).toContain('"{""modelo"":""Cultural"",""testemunhas"":2}"');
  });

  // O PostgREST omite chaves nulas em algumas linhas. Tirar as colunas da
  // primeira linha faria a planilha perder uma coluna inteira, em silêncio.
  it("usa a união das colunas de todas as linhas", () => {
    const csv = csvDaTabela([{ id: 1 }, { id: 2, observacao: "atenção" }]);
    expect(csv.split("\n")[0]).toBe("﻿id;observacao");
    expect(csv.split("\n")[1]).toBe('"1";');
  });

  // Célula vazia sai VAZIA, e não com a palavra "null" nem com aspas soltas:
  // é o que o Excel entende como "não preenchido".
  it("nulo e indefinido viram célula vazia, não a palavra 'null'", () => {
    const csv = csvDaTabela([{ a: null, b: undefined, c: 0, d: false }]);
    expect(csv.split("\n")[1]).toBe(';;"0";"false"');
  });

  it("tabela vazia não gera cabeçalho falso", () => {
    expect(csvDaTabela([])).toBe("﻿");
  });
});

/* -------------------------------------------------------------------------- */

describe("quando o automático roda", () => {
  const AGORA = new Date("2026-09-25T06:00:00Z");
  const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);

  it("desligado nunca roda, nem na primeira vez", () => {
    expect(deveRodarHoje("desligado", null, AGORA)).toBe(false);
    expect(deveRodarHoje("desligado", diasAtras(90), AGORA)).toBe(false);
  });

  it("sem back-up nenhum, roda", () => {
    expect(deveRodarHoje("semanal", null, AGORA)).toBe(true);
  });

  // O job bate sempre no mesmo horário. Sem a folga, "faz 7 dias" daria 6 dias
  // e 23 horas, e o semanal viraria quinzenal.
  it("a folga de 12 horas impede o semanal de virar quinzenal", () => {
    expect(deveRodarHoje("semanal", new Date(AGORA.getTime() - 7 * 86_400_000 + 3_600_000), AGORA)).toBe(true);
    expect(deveRodarHoje("semanal", diasAtras(6), AGORA)).toBe(false);
  });

  it.each([
    ["diario", 1, true],
    ["diario", 0.2, false],
    ["semanal", 8, true],
    ["semanal", 3, false],
    ["mensal", 31, true],
    ["mensal", 20, false],
  ])("%s com %s dia(s) desde o último: %s", (freq, dias, esperado) => {
    expect(deveRodarHoje(freq as "diario", diasAtras(dias as number), AGORA)).toBe(esperado);
  });

  // Um back-up atrasado é o que se quer; um back-up PULADO, não: se a função
  // ficou fora do ar na segunda, ela roda na terça.
  it("atraso não vira pulo — roda assim que puder", () => {
    expect(deveRodarHoje("semanal", diasAtras(40), AGORA)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */

describe("nomes, ficha e bilhete", () => {
  const QUANDO = new Date("2026-09-25T03:07:00Z");

  it("o nome do pacote ordena sozinho numa pasta", () => {
    expect(nomeDoPacote(QUANDO)).toBe("backup-polobh-2026-09-25-0307.zip");
  });

  // O número é a ORDEM DE RESTAURAÇÃO: quem restaura carrega os arquivos na
  // ordem alfabética dos nomes e acerta as chaves estrangeiras sem pensar.
  it("o arquivo de dados leva a ordem de restauração no nome", () => {
    expect(nomeDeDados(1, "clientes")).toBe("dados/01-clientes.json");
    expect(nomeDeDados(12, "ec_linhas")).toBe("dados/12-ec_linhas.json");
  });

  it.each([[900, "900 B"], [4096, "4 KB"], [3_145_728, "3.0 MB"]])("%s bytes → %s", (b, esperado) => {
    expect(formatarTamanho(b as number)).toBe(esperado);
  });

  const resumo = {
    quando: QUANDO,
    tabelas: [{ nome: "projetos", linhas: 5 }, { nome: "ecs", linhas: 7 }],
    anexos: 3,
    anexosDeFora: [],
    origem: "automatico" as const,
  };

  it("o LEIA-ME diz o que tem, o que não tem e como restaurar", () => {
    const t = leiaMe(resumo);
    expect(t).toContain("projetos — 5 registro(s)");
    expect(t).toContain("12 registro(s)");
    // O mal-entendido que faria alguém achar que tem back-up sem ter.
    expect(t).toContain("NÃO servem para restaurar");
    expect(t).toContain("SENHAS");
    expect(t).toContain("3-2-1");
  });

  it("o que não coube aparece no LEIA-ME, com nome — não some calado", () => {
    const t = leiaMe({ ...resumo, anexosDeFora: ["anexos-chamados/2026/contrato.pdf"] });
    expect(t).toContain("NÃO COUBERAM");
    expect(t).toContain("anexos-chamados/2026/contrato.pdf");
  });

  it("a ficha técnica traz a contagem por tabela", () => {
    const m = manifesto(resumo, [{ nome: "LEIA-ME.txt", bytes: 10 }]);
    expect(m.tabelas).toEqual({ projetos: 5, ecs: 7 });
    expect(m.geradoEm).toBe("2026-09-25T03:07:00.000Z");
    expect(m.origem).toBe("automatico");
  });
});
