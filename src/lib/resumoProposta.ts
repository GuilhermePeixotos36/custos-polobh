/**
 * Resumo da Proposta por IA (OpenRouter via Edge Function `resumo-proposta`).
 * Prepara os anexos no cliente (imagens/PDF viram data URL; Excel vira texto) e
 * chama a função, que sintetiza um descritivo em tópicos com os valores.
 * A chave da IA fica só no servidor — aqui nunca.
 */
import { supabase } from "@/lib/supabaseClient";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export interface ResumoResultado {
  ok: boolean;
  resumo?: string;
  erro?: string;
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

/**
 * Converte as páginas do PDF em imagens PNG no navegador (até `maxPaginas`).
 * O OpenRouter exige saldo mínimo na conta para requisições que mandam o
 * arquivo em si — como imagem, a leitura usa a visão do modelo normalmente,
 * sem essa exigência (e sem custo de OCR).
 */
async function pdfParaImagens(file: File, maxPaginas = 4): Promise<{ mime: string; dataUrl: string }[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buf = await file.arrayBuffer();
  // disableWorker: evita depender do Web Worker (observamos instabilidade de
  // comunicação com ele neste bundler); PDFs de orçamento são pequenos
  // (1-4 páginas), então rodar no thread principal não pesa perceptivelmente.
  // Não está no .d.ts desta versão, mas é lido em runtime pela lib.
  const opts = { data: buf, disableWorker: true } as Parameters<typeof pdfjsLib.getDocument>[0];
  const pdf = await pdfjsLib.getDocument(opts).promise;
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

    for (const f of entrada.files) {
      if (IMG_RE.test(f.type)) {
        imagens.push({ mime: f.type, dataUrl: await fileParaDataUrl(f) });
      } else if (isPdf(f)) {
        // PDF vira imagem (uma por página) no navegador — evita a exigência de
        // saldo mínimo do OpenRouter para requisições que mandam o arquivo.
        const paginas = await pdfParaImagens(f).catch(() => []);
        imagens.push(...paginas);
      } else if (isExcel(f)) {
        const t = await excelParaTexto(f).catch(() => "");
        if (t) textos.push(`Planilha ${f.name}:\n${t}`);
      } else {
        // texto simples e outros: tenta ler como texto
        const t = await f.text().catch(() => "");
        if (t) textos.push(`${f.name}:\n${t}`);
      }
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
    return r?.ok ? { ok: true, resumo: r.resumo } : { ok: false, erro: r?.erro || "Falha ao resumir." };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
