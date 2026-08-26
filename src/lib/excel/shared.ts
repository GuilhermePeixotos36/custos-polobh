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

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function baixar(buffer: ArrayBuffer, nome: string) {
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
export async function salvarComPicker(buffer: ArrayBuffer, nome: string): Promise<"salvo" | "cancelado" | "baixado"> {
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
      return "salvo";
    } catch (e) {
      // Usuário cancelou o diálogo
      if ((e as Error)?.name === "AbortError") return "cancelado";
      // Qualquer outra falha → download normal
      baixar(buffer, nomeArq);
      return "baixado";
    }
  }
  baixar(buffer, nomeArq);
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
 * Estima quantas linhas visuais um texto ocupa numa célula de `largura` colunas
 * (unidade de largura do Excel ≈ 1 caractere), considerando as quebras manuais.
 * É a base do ajuste de altura das linhas: sem isso o texto longo fica cortado,
 * porque o Excel só auto-ajusta a altura de linhas que ele mesmo escreveu.
 */
export function linhasVisuais(texto: string, largura: number): number {
  if (!texto) return 1;
  const porLinha = Math.max(8, Math.floor(largura) - 1);
  return String(texto)
    .split("\n")
    .reduce((n, paragrafo) => n + Math.max(1, Math.ceil(paragrafo.length / porLinha)), 0);
}

/** Altura máxima de linha no Excel (em pontos) — limite real do formato .xlsx. */
export const ALTURA_MAX_LINHA = 409.5;

/** Converte um número de linhas visuais em altura de linha (pontos), com folga. */
export const alturaParaLinhas = (linhas: number, ptPorLinha = 12.6, folga = 4): number =>
  Math.min(ALTURA_MAX_LINHA, Math.max(15, linhas * ptPorLinha + folga));

/** Quantos caracteres cabem numa linha visual de uma célula com `largura` colunas. */
const caracteresPorLinha = (largura: number) => Math.max(8, Math.floor(largura) - 1);

/** Corta o texto no último espaço antes do limite — não parte palavra ao meio. */
function cortarEmPalavra(texto: string, limite: number): { cabe: string; resto: string } {
  if (texto.length <= limite) return { cabe: texto, resto: "" };
  const bruto = texto.slice(0, limite);
  const espaco = bruto.lastIndexOf(" ");
  const corte = espaco > limite * 0.6 ? espaco : limite; // sem espaço útil, corta seco
  return { cabe: texto.slice(0, corte).trimEnd(), resto: texto.slice(corte).trimStart() };
}

/**
 * Quebra um texto (já em parágrafos) em PEDAÇOS que cabem numa célula.
 *
 * A altura de linha do Excel para em 409,5pt: um descritivo longo simplesmente
 * não cabe numa célula só, e o que passa disso some da tela e da impressão. Aqui
 * o texto é dividido em quantas células forem necessárias, cortando por
 * parágrafo — e, quando um parágrafo sozinho é maior que o teto, na última
 * palavra que cabe. Nada é descartado.
 */
export function quebrarPorAltura(
  paragrafos: string[],
  largura: number,
  ptPorLinha = 14,
  folga = 4
): string[] {
  const maxLinhas = Math.max(1, Math.floor((ALTURA_MAX_LINHA - folga) / ptPorLinha));
  const limite = maxLinhas * caracteresPorLinha(largura);
  const out: string[] = [];
  let buffer: string[] = [];
  let acc = 0;
  const fechar = () => {
    if (!buffer.length) return;
    out.push(buffer.join("\n"));
    buffer = [];
    acc = 0;
  };
  for (const paragrafo of paragrafos) {
    let resto = paragrafo;
    // Parágrafo que sozinho estoura a célula: sai em pedaços do tamanho do teto.
    while (linhasVisuais(resto, largura) > maxLinhas) {
      fechar();
      const corte = cortarEmPalavra(resto, limite);
      out.push(corte.cabe);
      resto = corte.resto;
      if (!corte.resto) break;
    }
    if (!resto) continue;
    const visuais = linhasVisuais(resto, largura);
    if (acc + visuais > maxLinhas && buffer.length) fechar();
    buffer.push(resto);
    acc += visuais;
  }
  fechar();
  return out;
}

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
