// Padrão de Logs — CSV e texto do detalhe. Copie para `src/lib/logs/csv.ts`.
//
// Duas proteções moram aqui, e as duas têm teste (testes.md):
//  1. o CSV neutraliza célula que o Excel leria como fórmula;
//  2. o detalhe do evento vira TEXTO — a tela o mostra num <pre>, nunca como HTML.
import {
  ROTULO_NIVEL, ROTULO_ORIGEM_LOG, ROTULO_RESULTADO, rotuloDaAcao, rotuloDaTela, type ItemLog,
} from "./logsStore";

/**
 * Uma célula do CSV: sempre entre aspas (com `"` dobrada), e o que começa com `=`, `+`, `-`, `@`
 * (ou tabulação/retorno, que o Excel também interpreta) ganha um apóstrofo na frente. Sem isso uma
 * mensagem de erro que o usuário controlou (`=HYPERLINK(...)`) viraria fórmula na planilha do admin.
 */
export function celulaCsv(valor: unknown): string {
  let texto = valor === null || valor === undefined ? "" : typeof valor === "string" ? valor : JSON.stringify(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

// Ponto e vírgula: é o separador que o Excel em português abre direto.
const SEPARADOR = ";";
// A marca de ordem de bytes é o que faz o Excel abrir em UTF-8 e não comer o acento.
const BOM = String.fromCharCode(0xfeff);

const CABECALHO = ["Data/hora", "Usuário", "Ação", "Alvo", "Tela", "Nível", "Resultado", "Origem", "IP", "Mensagem"];

/** dd/mm/aaaa hh:mm:ss no horário de Brasília. */
export function dataHoraBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function csvDosLogs(itens: readonly ItemLog[]): string {
  const linhas = itens.map((i) => [
    dataHoraBr(i.em), i.atorNome ?? "", rotuloDaAcao(i.acao), i.alvoRotulo ?? i.alvoTipo ?? "", rotuloDaTela(i.tela),
    ROTULO_NIVEL[i.nivel] ?? i.nivel, ROTULO_RESULTADO[i.resultado] ?? i.resultado, ROTULO_ORIGEM_LOG[i.origem ?? ""] ?? i.origem ?? "",
    i.ip ?? "", i.mensagem ?? "",
  ]);
  return `${BOM}${[CABECALHO, ...linhas].map((l) => l.map(celulaCsv).join(SEPARADOR)).join("\r\n")}`;
}

/** Nome do arquivo exportado. */
export function nomeDoCsv(aba: string, inicio: string, fim: string): string {
  return `logs-${aba}-${inicio}-a-${fim}.csv`;
}

/** O detalhe como TEXTO para o `<pre>`: JSON com 2 espaços; nunca HTML. */
export function detalheComoTexto(detalhe: unknown): string {
  if (detalhe === null || detalhe === undefined) return "";
  try { return JSON.stringify(detalhe, null, 2); } catch { return String(detalhe); }
}
