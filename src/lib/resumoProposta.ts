/**
 * Resumo da Proposta por IA (OpenRouter via Edge Function `resumo-proposta`).
 * Prepara os anexos no cliente (imagens/PDF viram data URL; Excel vira texto) e
 * chama a função, que sintetiza um descritivo em tópicos com os valores.
 * A chave da IA fica só no servidor — aqui nunca.
 */
import { supabase } from "@/lib/supabaseClient";
import { textoDoPdf } from "@/lib/pdfTexto";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ConsumoIa } from "@/domain/consumoIa";

export interface ResumoResultado {
  ok: boolean;
  resumo?: string;
  erro?: string;
  /** Tokens e custo da leitura (05/11/2026). */
  consumo?: ConsumoIa;
}

const IMG_RE = /^image\/(png|jpe?g|webp|gif|bmp)$/i;
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isExcel = (f: File) =>
  /sheet|excel|spreadsheet/i.test(f.type) || /\.(xlsx|xls|csv)$/i.test(f.name);

function fileParaDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
    r.readAsDataURL(file);
  });
}

/** PDF com menos texto do que isto é tratado como escaneado: vai como imagem. */
const TEXTO_MINIMO_PDF = 80;

/**
 * Converte as páginas do PDF em imagens PNG no navegador (até `maxPaginas`) —
 * o caminho do PDF escaneado. O OpenRouter exige saldo mínimo na conta para
 * requisições que mandam o arquivo em si; como imagem, a leitura usa a visão do
 * modelo normalmente.
 */
async function pdfParaImagens(pdfjsLib: typeof import("pdfjs-dist"), dados: ArrayBuffer, maxPaginas = 4) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(dados) }).promise;
  const imagens: { mime: string; dataUrl: string }[] = [];
  const n = Math.min(pdf.numPages, maxPaginas);
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    imagens.push({ mime: "image/png", dataUrl: canvas.toDataURL("image/png") });
  }
  return imagens;
}

/** Lê um PDF: texto quando ele tem, imagens quando é escaneado. Falha com o motivo. */
async function lerPdf(file: File): Promise<{ texto: string; imagens: { mime: string; dataUrl: string }[] }> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const dados = await file.arrayBuffer();
  const texto = await textoDoPdf(pdfjsLib, dados).catch(() => "");
  if (texto.length >= TEXTO_MINIMO_PDF) return { texto, imagens: [] };
  return { texto: "", imagens: await pdfParaImagens(pdfjsLib, dados) };
}

/** Extrai o texto de uma planilha (Excel/CSV) usando ExcelJS (já é dependência). */
async function excelParaTexto(file: File): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const buf = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    return new TextDecoder().decode(new Uint8Array(buf));
  }
  await wb.xlsx.load(buf);
  const linhas: string[] = [];
  wb.eachSheet((ws) => {
    ws.eachRow((row) => {
      const cels = (row.values as unknown[])
        .slice(1)
        .map((v) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)))
        .filter(Boolean);
      if (cels.length) linhas.push(cels.join(" | "));
    });
  });
  return linhas.join("\n");
}

/**
 * Sintetiza o(s) orçamento(s) anexado(s) e/ou um link em um descritivo em tópicos.
 */
export async function resumirProposta(entrada: { files: File[]; link?: string }): Promise<ResumoResultado> {
  try {
    const imagens: { mime: string; dataUrl: string }[] = [];
    const textos: string[] = [];
    const erros: string[] = [];

    for (const f of entrada.files) {
      if (IMG_RE.test(f.type)) {
        imagens.push({ mime: f.type, dataUrl: await fileParaDataUrl(f) });
      } else if (isPdf(f)) {
        try {
          const pdf = await lerPdf(f);
          if (pdf.texto) textos.push(`PDF ${f.name}:\n${pdf.texto}`);
          imagens.push(...pdf.imagens);
          if (!pdf.texto && !pdf.imagens.length) erros.push(`O PDF "${f.name}" não tem páginas legíveis.`);
        } catch (e) {
          // Antes o erro era engolido e a IA recebia nada — a pessoa via só
          // "Nenhum orçamento foi enviado", sem saber qual arquivo falhou.
          erros.push(`Não consegui ler o PDF "${f.name}" (${(e as Error).message}).`);
        }
      } else if (isExcel(f)) {
        const t = await excelParaTexto(f).catch(() => "");
        if (t) textos.push(`Planilha ${f.name}:\n${t}`);
      } else {
        // texto simples e outros: tenta ler como texto
        const t = await f.text().catch(() => "");
        if (t) textos.push(`${f.name}:\n${t}`);
      }
    }

    // Nada utilizável saiu dos arquivos e não há link: diz por quê, em vez de
    // mandar uma requisição vazia para a IA.
    if (!imagens.length && !textos.length && !entrada.link?.trim()) {
      return { ok: false, erro: erros.join(" ") || "Não consegui ler nenhum dos arquivos enviados." };
    }

    const { data, error } = await supabase.functions.invoke("resumo-proposta", {
      body: { imagens, textos, link: entrada.link?.trim() || undefined },
    });
    if (error) {
      // A função devolve JSON de erro com status != 2xx → vem em error.context
      let msg = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const j = await ctx.json();
          if (j?.erro) msg = j.erro;
        }
      } catch {
        /* ignora */
      }
      return { ok: false, erro: msg };
    }
    const r = data as ResumoResultado;
    return r?.ok ? { ok: true, resumo: r.resumo, consumo: r.consumo } : { ok: false, erro: r?.erro || "Falha ao resumir." };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
