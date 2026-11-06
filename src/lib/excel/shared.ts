import ExcelJS from "exceljs";

/** Paleta Pólobh em ARGB (ExcelJS usa AARRGGBB). */
export const COR = {
  black: "FF0B0B0D",
  ink: "FF15161A",
  white: "FFFFFFFF",
  primary: "FFF2820D",
  amber: "FFFBB040",
  soft: "FFFDF1E3",
  border: "FFE7E8EC",
  borderSoft: "FFEEEFF2",
  zebra: "FFFAFAFB",
  ink2: "FF6A6E78",
  // Cinzas do padrão da EC original Pólobh (no lugar das barras pretas).
  headerGray: "FF595959", // cabeçalhos (título geral e cabeçalho da tabela) — texto branco
  groupGray: "FFD9D9D9",  // barras de nome de grupo — texto escuro em destaque
  gridLine: "FFBFBFBF",   // linhas da grade (mais visível que a borda suave)
  // Medidas nos modelos oficiais de 2026 ("EC - Projetos Culturais/Corporativos
  // - Modelo 2026 ... .xlsx"). Os dois arquivos usam exatamente a mesma paleta;
  // ela substitui a do modelo antigo de 2022 (cinza C0C0C0 / azul 99CCFF).
  sectionGray: "FFD9D9D9", // barras CLIENTE / PROJETO / nome do grupo (branco -15%)
  rotuloGray: "FFF2F2F2",  // fundo da coluna de rótulos nas linhas "RÓTULO | VALOR" da OS
  gold: "FFFFC000",        // destaque ESTIMATIVA DE CUSTOS e Valor Total Bruto
  // Destaque das colunas de documentação no cabeçalho: laranja da marca a 60%
  // de clareamento (accent2 #E97132 + tint 0,6). Só o cabeçalho é pintado —
  // nos modelos de 2026 as linhas de dados ficam sem preenchimento.
  destaqueCabecalho: "FFF6C6AD",
};

/**
 * Realces por CONTEÚDO da célula — os três estilos do "Realçar Regras das
 * Células" do Excel, que os modelos de 2026 usam em centenas de regras de
 * formatação condicional sobre a faixa de status e documentação.
 *
 * Vão como formatação condicional de verdade (e não como preenchimento fixo)
 * justamente para acompanharem a edição: se a pessoa mudar "Pendente" para "OK"
 * na planilha baixada, a cor muda junto, como acontece no modelo.
 */
export const REALCE = {
  vermelho: { fonte: "FF9C0006", fundo: "FFFFC7CE" },
  verde: { fonte: "FF006100", fundo: "FFC6EFCE" },
  ambar: { fonte: "FF9C5700", fundo: "FFFFEB9C" },
} as const;

/** Regra de realce por texto contido, no formato que o ExcelJS espera. */
export function regraRealce(
  texto: string,
  realce: { fonte: string; fundo: string },
  priority: number
): ExcelJS.ConditionalFormattingRule {
  return {
    type: "containsText",
    operator: "containsText",
    text: texto,
    priority,
    style: {
      font: { color: { argb: realce.fonte } },
      fill: { type: "pattern", pattern: "solid", bgColor: { argb: realce.fundo } },
    },
  } as ExcelJS.ConditionalFormattingRule;
}

/**
 * Regra de realce por VALOR: pinta a célula quando o número é maior que zero.
 *
 * Mesmo estilo do "Emitir"/"Em andamento" (amarelo claro com texto escuro), pelo
 * mesmo motivo: a célula preenchida é dinheiro já comprometido, e a planilha
 * inteira passa a ser lida de relance — o que tem valor salta, o que está zerado
 * some no branco. Vai como formatação condicional para acompanhar a edição.
 */
export function regraValorPreenchido(
  realce: { fonte: string; fundo: string },
  priority: number
): ExcelJS.ConditionalFormattingRule {
  return {
    type: "cellIs",
    operator: "greaterThan",
    formulae: ["0"],
    priority,
    style: {
      font: { color: { argb: realce.fonte } },
      fill: { type: "pattern", pattern: "solid", bgColor: { argb: realce.fundo } },
    },
  } as ExcelJS.ConditionalFormattingRule;
}

/** Fontes da EC original da Pólobh (Excel usa fonte substituta automaticamente se não instalada). */
export const FONT_BOLD = "Futura PT Bold";
export const FONT_LIGHT = "Futura PT Light";

export const fill = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

export const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COR.border } },
  left: { style: "thin", color: { argb: COR.border } },
  bottom: { style: "thin", color: { argb: COR.border } },
  right: { style: "thin", color: { argb: COR.border } },
};

/** Grade visível (separa colunas e linhas) — usada na OS. */
export const grade: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COR.gridLine } },
  left: { style: "thin", color: { argb: COR.gridLine } },
  bottom: { style: "thin", color: { argb: COR.gridLine } },
  right: { style: "thin", color: { argb: COR.gridLine } },
};

/**
 * Grade da EC: borda fina na cor automática, sem `color` declarada.
 * É o que os modelos de 2026 usam (`<color indexed="64"/>` = automática); a
 * grade cinza-clara deixava a planilha visivelmente mais "lavada" que o modelo.
 */
export const gradeAuto: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

/** Cópia para o Dropbox do projeto. Import sob demanda: só carrega o cliente do banco quando há projeto. */
function arquivarCopia(projetoId: string | undefined, nome: string, buffer: ArrayBuffer) {
  if (!projetoId) return;
  void import("@/lib/arquivarDocumento").then((m) => m.arquivarCopia(projetoId, nome, buffer)).catch(() => {});
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function baixar(buffer: ArrayBuffer, nome: string, projetoId?: string) {
  arquivarCopia(projetoId, nome, buffer);
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome.endsWith(".xlsx") ? nome : `${nome}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Salva com o seletor de pasta do sistema (File System Access API) — abre o
 * diálogo do Windows Explorer para o usuário escolher a pasta/nome. Quando o
 * navegador não suporta (ex.: Firefox), cai no download normal.
 * Retorna "salvo" | "cancelado" | "baixado".
 */
export async function salvarComPicker(buffer: ArrayBuffer, nome: string, projetoId?: string): Promise<"salvo" | "cancelado" | "baixado"> {
  const nomeArq = nome.endsWith(".xlsx") ? nome : `${nome}.xlsx`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: nomeArq,
        types: [{ description: "Planilha Excel", accept: { [XLSX_MIME]: [".xlsx"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([buffer], { type: XLSX_MIME }));
      await writable.close();
      arquivarCopia(projetoId, nomeArq, buffer);
      return "salvo";
    } catch (e) {
      // Usuário cancelou o diálogo
      if ((e as Error)?.name === "AbortError") return "cancelado";
      // Qualquer outra falha → download normal
      baixar(buffer, nomeArq, projetoId);
      return "baixado";
    }
  }
  baixar(buffer, nomeArq, projetoId);
  return "baixado";
}

/** Nome de arquivo seguro a partir do número do documento. */
export const nomeArquivo = (s: string) =>
  s.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();

/**
 * Logo com as dimensões REAIS do arquivo — sem elas a imagem sai esticada.
 * O conteúdo vai como `Uint8Array`, o único formato que o ExcelJS aceita tanto
 * no navegador quanto no Node (onde rodam os testes).
 */
export interface LogoPolobh {
  buffer: Uint8Array;
  largura: number;
  altura: number;
}

/** Lê largura/altura do cabeçalho IHDR de um PNG (bytes 16..23). */
function dimensoesPng(bytes: Uint8Array): { largura: number; altura: number } | null {
  if (bytes.byteLength < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Assinatura PNG: 89 50 4E 47 0D 0A 1A 0A.
  const assinatura = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < assinatura.length; i++) if (view.getUint8(i) !== assinatura[i]) return null;
  return { largura: view.getUint32(16), altura: view.getUint32(20) };
}

/**
 * Carrega o logo (public/polobh-logo.png) já com as dimensões do arquivo.
 *
 * As medidas vêm do próprio PNG justamente para o desenho nunca ser distorcido:
 * trocar o arquivo por outra versão do logo (proporção diferente, com ou sem
 * slogan) passa a funcionar sozinho, sem mexer no código.
 */
export async function carregarLogo(): Promise<LogoPolobh | null> {
  try {
    const r = await fetch("/polobh-logo.png");
    if (!r.ok) return null;
    const buffer = new Uint8Array(await r.arrayBuffer());
    const dim = dimensoesPng(buffer);
    if (!dim) return null;
    return { buffer, ...dim };
  } catch {
    return null;
  }
}

/**
 * Escala o logo para caber numa caixa, preservando a proporção original.
 * Devolve as medidas em pixels que o ExcelJS espera em `ext`.
 */
export function encaixarLogo(logo: LogoPolobh, caixa: { largura: number; altura: number }) {
  const escala = Math.min(caixa.largura / logo.largura, caixa.altura / logo.altura);
  return { width: Math.round(logo.largura * escala), height: Math.round(logo.altura * escala) };
}

/**
 * Largura aproximada de cada caractere em UNIDADES DE COLUNA do Excel (1
 * unidade ≈ a largura do "0" da fonte padrão, ~7px), para um corpo de 11pt.
 *
 * CALIBRAGEM (06/11/2026, a altura ficava desproporcional): a conta antiga
 * tratava toda letra como 1 unidade e cortava cada parágrafo em pedaços de
 * tamanho fixo. Mas "i", "l", "t" e o espaço ocupam metade disso, e quase todo
 * texto de EC é minúsculo — a planilha ganhava linhas a mais, e o item ficava
 * com um vão branco embaixo. Agora a conta quebra por PALAVRA, como o Excel, e
 * soma a largura real de cada letra.
 */
const LARGURA_CHAR: Record<string, number> = (() => {
  const t: Record<string, number> = {};
  const grupo = (chars: string, w: number) => { for (const c of chars) t[c] = w; };
  grupo("iljI|!.,:;'´`", 0.45);
  grupo("ftr()[]\"-", 0.6);
  grupo(" ", 0.5);
  grupo("sz*", 0.8);
  grupo("ckvxyJ", 0.92);
  grupo("abdeghnopquáàâãéêíóôõúç0123456789$•◦", 1.05);
  grupo("EFLPS", 1.1);
  grupo("ABKRTUVXYZÁÉÍÓÚ", 1.3);
  grupo("CDGHNOQÇÔÕ", 1.55);
  grupo("mw%@", 1.5);
  grupo("MW", 1.8);
  return t;
})();
const larguraChar = (c: string) => LARGURA_CHAR[c] ?? 1;

/** Margem interna da célula (as duas laterais), em unidades de coluna. */
const MARGEM_CELULA = 0.8;

/**
 * Estima quantas linhas visuais um texto ocupa numa célula de `largura` colunas,
 * considerando as quebras manuais e quebrando por palavra, como o Excel faz.
 * É a base do ajuste de altura das linhas: sem isso o texto longo fica cortado,
 * porque o Excel só auto-ajusta a altura de linhas que ele mesmo escreveu.
 * `escala` corrige a largura das letras quando o corpo não é 11pt (ou é negrito).
 */
export function linhasVisuais(texto: string, largura: number, escala = 1): number {
  if (!texto) return 1;
  const util = Math.max(6, largura - MARGEM_CELULA);
  return String(texto)
    .split("\n")
    .reduce((n, paragrafo) => n + linhasDoParagrafo(paragrafo, util, escala), 0);
}

function linhasDoParagrafo(paragrafo: string, util: number, escala: number): number {
  if (!paragrafo.trim()) return 1;
  let linhas = 1;
  let ocupado = 0;
  const espaco = larguraChar(" ") * escala;
  for (const palavra of paragrafo.split(/ +/)) {
    if (!palavra) continue;
    let w = 0;
    for (const c of palavra) w += larguraChar(c) * escala;
    const comEspaco = ocupado > 0 ? ocupado + espaco + w : w;
    if (comEspaco <= util) {
      ocupado = comEspaco;
      continue;
    }
    if (ocupado > 0) {
      linhas++;
      ocupado = 0;
    }
    // Palavra maior que a linha inteira: o Excel a parte onde couber.
    while (w > util) {
      linhas++;
      w -= util;
    }
    ocupado = w;
  }
  return linhas;
}

/** Altura máxima de linha no Excel (em pontos) — limite real do formato .xlsx. */
export const ALTURA_MAX_LINHA = 409.5;

/** Converte um número de linhas visuais em altura de linha (pontos), com folga. */
export const alturaParaLinhas = (linhas: number, ptPorLinha = 12.6, folga = 4): number =>
  Math.min(ALTURA_MAX_LINHA, Math.max(15, linhas * ptPorLinha + folga));

/**
 * Largura de coluna (unidades do Excel) necessária para o maior parágrafo do
 * texto, entre um piso e um teto.
 *
 * É o "ajuste automático de coluna" que o Excel só faz quando a pessoa manda:
 * as larguras do modelo entram como PISO, e uma coluna só cresce quando o
 * conteúdo real não caberia nela — assim ninguém precisa arrastar a borda da
 * coluna para ler um CNPJ ou um valor.
 */
export function larguraParaTexto(texto: string, min: number, max: number): number {
  if (!texto) return min;
  const maior = String(texto)
    .split("\n")
    .reduce((n, linha) => Math.max(n, linha.length), 0);
  return Math.min(max, Math.max(min, maior + 2));
}
