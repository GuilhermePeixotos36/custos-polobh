// Tela de Logs montada (jsdom, sem biblioteca de teste: react-dom + act). Só o que só quebra
// montado: aba, detalhe como TEXTO, correlação, botão de exportar por permissão e os avisos.
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));

import { TelaLogs } from "./TelaLogs";
import { LogsIndisponiveis, type Consultar, type FiltrosLogs, type ItemLog, type RespostaDeLogs } from "@/lib/logs/logsStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const evento: ItemLog = {
  id: "log:1", fonte: "log", em: "2026-03-10T15:04:05Z", categoria: "erro", nivel: "erro", acao: "erro_js", resultado: "falha",
  atorId: null, atorNome: "Pessoa Teste", alvoTipo: null, alvoId: null, alvoRotulo: null, tela: "/projetos", origem: "app",
  mensagem: "quebrou", detalhe: { x: "<b>negrito</b>" }, ip: null, userAgent: null,
  correlacao: "11111111-2222-3333-4444-555555555555",
};

let raiz: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  raiz = createRoot(host);
});

afterEach(() => {
  act(() => raiz.unmount());
  host.remove();
  document.body.innerHTML = "";
});

async function montar(consultar: Consultar, podeExportar = false) {
  await act(async () => {
    raiz.render(createElement(TelaLogs, { consultar, podeExportar, hoje: "2026-03-10" }));
  });
  // A consulta é assíncrona: deixa as promessas resolverem.
  await act(async () => { await Promise.resolve(); });
}

function falso(resposta: RespostaDeLogs = { total: 1, itens: [evento] }) {
  const chamadas: FiltrosLogs[] = [];
  const consultar: Consultar = async (f) => { chamadas.push(f); return resposta; };
  return { consultar, chamadas };
}

const botaoPorTexto = (texto: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === texto || b.getAttribute("aria-label") === texto);

describe("TelaLogs", () => {
  it("abre em Atividades com os últimos 7 dias; trocar para Erros consulta a aba erros", async () => {
    const { consultar, chamadas } = falso();
    await montar(consultar);
    expect(chamadas[0]).toMatchObject({ aba: "atividades", inicio: "2026-03-04", fim: "2026-03-10", pagina: 1 });
    await act(async () => { botaoPorTexto("Erros")!.click(); });
    expect(chamadas.at(-1)?.aba).toBe("erros");
  });

  it("o detalhe mostra o JSON como texto, sem interpretar HTML", async () => {
    await montar(falso().consultar);
    const abrir = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith("Abrir o evento de"));
    expect(abrir).toBeDefined();
    await act(async () => { abrir!.click(); });
    const popup = document.querySelector('[role="dialog"]');
    expect(popup).not.toBeNull();
    expect(popup!.textContent).toContain("<b>negrito</b>");
    expect(popup!.querySelector("b")).toBeNull();
  });

  it("'Ver eventos da mesma correlação' refaz a consulta com a correlação", async () => {
    const { consultar, chamadas } = falso();
    await montar(consultar);
    await act(async () => { document.querySelector("tbody tr")!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await act(async () => { botaoPorTexto("Ver eventos da mesma correlação")!.click(); });
    expect(chamadas.at(-1)?.correlacao).toBe(evento.correlacao);
  });

  it("'Exportar CSV' só existe com a permissão de exportar", async () => {
    await montar(falso().consultar, false);
    expect(botaoPorTexto("Exportar CSV")).toBeUndefined();
    act(() => raiz.unmount());
    raiz = createRoot(host);
    await montar(falso().consultar, true);
    expect(botaoPorTexto("Exportar CSV")).toBeDefined();
  });

  it("avisa quando a trilha antiga ficou de fora (auditoriaIncluida false) e quando a resposta é a reserva", async () => {
    await montar(falso({ total: 1, itens: [evento], auditoriaIncluida: false }).consultar);
    expect(document.body.textContent).toContain("só aparecem para quem tem a permissão de Auditoria");
    act(() => raiz.unmount());
    raiz = createRoot(host);
    await montar(falso({ total: 1, itens: [evento], reserva: true }).consultar);
    expect(document.body.textContent).toContain("a lista mostra a trilha de auditoria anterior");
    expect(document.body.textContent).not.toContain("só aparecem para quem tem a permissão de Auditoria");
  });

  it("sem a função no banco: mensagem de logs indisponíveis", async () => {
    await montar(async () => { throw new LogsIndisponiveis(); });
    expect(document.body.textContent).toContain("Os logs ainda não estão disponíveis neste ambiente (a atualização do banco está pendente).");
  });
});
