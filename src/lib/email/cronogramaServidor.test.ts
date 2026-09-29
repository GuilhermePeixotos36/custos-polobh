/**
 * A régua do e-mail de cronograma, dos DOIS lados.
 *
 * O módulo testado aqui mora em `supabase/functions/_shared/` porque a Edge
 * Function do lembrete automático precisa dele para deployar — ela roda em
 * Deno, fora do aplicativo. Antes ela mantinha uma cópia à mão do mesmo texto,
 * e foi assim que o lembrete passou a mandar o fornecedor para um evento de UM
 * DIA enquanto o envio manual já dizia todos: duas cópias envelhecem em ritmos
 * diferentes.
 *
 * Este arquivo é o que impede a divergência de voltar. Ele vive em `src/`
 * porque é onde a suíte procura testes, e importa o módulo compartilhado pelo
 * caminho relativo — se alguém puser um `Deno.` lá dentro, ou mudar a regra das
 * datas, quebra aqui.
 */
import { describe, expect, it } from "vitest";
import {
  corpoCronogramaFornecedor,
  textoCronogramaFornecedor,
  datasDoEvento,
  horariosDoEvento,
  type ProjetoJson,
} from "../../../supabase/functions/_shared/cronogramaEmail";

const tresDias: ProjetoJson = {
  titulo: "Convenção Anual",
  local: "Expominas",
  enderecoLocal: "Av. Amazonas, 6200 - Belo Horizonte - MG",
  produtoraResponsavel: "Marisa Andrade",
  telefoneProdutora: "(31) 99999-1234",
  // Os campos legados guardam só a PRIMEIRA faixa — é o que causava o defeito.
  evento: "2026-10-14",
  horario: "08:00 às 18:00",
  cronograma: {
    evento: [
      { data: "2026-10-14", inicio: "08:00", fim: "18:00" },
      { data: "2026-10-15", inicio: "08:00", fim: "18:00" },
      { data: "2026-10-16", inicio: "08:00", fim: "13:00" },
    ],
  },
};

describe("as datas do evento, no servidor", () => {
  it("diz TODOS os dias, e não só o primeiro", () => {
    // O defeito que motivou o módulo: o lembrete lia `projeto.evento` e mandava
    // o fornecedor para um evento de um dia só.
    const datas = datasDoEvento(tresDias);
    expect(datas).toContain("14/10/2026");
    expect(datas).toContain("15/10/2026");
    expect(datas).toContain("16/10/2026");
  });

  it("colapsa dia repetido — manhã e noite são um dia", () => {
    const p: ProjetoJson = {
      cronograma: { evento: [{ data: "2026-10-14", inicio: "08:00" }, { data: "2026-10-14", inicio: "20:00" }] },
    };
    expect(datasDoEvento(p)).toBe("14/10/2026");
  });

  it("colapsa horário repetido — três dias das 9 às 18 leem uma faixa só", () => {
    expect(horariosDoEvento(tresDias)).toBe("08:00 às 18:00  |  08:00 às 13:00");
  });

  it("sem cronograma, cai nos campos legados (projeto antigo)", () => {
    const antigo: ProjetoJson = { evento: "2026-10-14", horario: "08:00 às 18:00" };
    expect(datasDoEvento(antigo)).toBe("14/10/2026");
    expect(horariosDoEvento(antigo)).toBe("08:00 às 18:00");
  });

  it("sem data nenhuma, não inventa nem quebra", () => {
    expect(datasDoEvento({})).toBe("");
    expect(horariosDoEvento({})).toBe("");
  });
});

describe("o corpo da mensagem", () => {
  const etapas = [
    { etapa: "Desmontagem", data: "2026-10-17", horario: "07:00 às 11:00", atividades: "Retirada do equipamento." },
    { etapa: "Montagem do som", data: "2026-10-13", horario: "08:00 às 14:00", atividades: "Descarga e montagem de PA." },
  ];
  const monta = (lembrete?: boolean) =>
    corpoCronogramaFornecedor({
      projeto: tresDias,
      fornecedor: { razaoSocial: "Sonora Ltda", representante: "Paulo Menezes", email: "paulo@sonora.com.br" },
      etapas,
      numeroOs: "OS – ACME – (01)",
      lembrete,
    });

  it("traz o evento inteiro, o local e quem chamar no dia", () => {
    const { html } = monta();
    expect(html).toContain("16/10/2026");
    expect(html).toContain("Expominas");
    expect(html).toContain("Av. Amazonas");
    // Sem o contato, a dúvida da montagem não vira ligação nenhuma.
    expect(html).toContain("Marisa Andrade");
    expect(html).toContain("(31) 99999-1234");
  });

  it("as etapas saem em ordem de data, e não na ordem em que foram cadastradas", () => {
    const { html } = monta();
    expect(html.indexOf("Montagem do som")).toBeLessThan(html.indexOf("Desmontagem"));
  });

  it("cumprimenta o representante, que é quem lê", () => {
    expect(monta().html).toContain("Paulo Menezes");
  });

  it("o lembrete muda a abertura e o assunto — o resto é idêntico", () => {
    const manual = monta(false);
    const automatico = monta(true);
    expect(automatico.assunto).toContain("Lembrete de cronograma");
    expect(manual.assunto).toContain("Cronograma —");
    // Os dados são os mesmos: a informação não pode mudar conforme quem apertou.
    for (const trecho of ["16/10/2026", "Expominas", "Montagem do som", "Marisa Andrade"]) {
      expect(manual.html).toContain(trecho);
      expect(automatico.html).toContain(trecho);
    }
  });

  it("OS sem etapa nenhuma diz isso, em vez de sair com a tabela vazia", () => {
    const { html } = corpoCronogramaFornecedor({
      projeto: tresDias,
      fornecedor: { razaoSocial: "Sonora Ltda" },
      etapas: [],
    });
    expect(html).toContain("Sem etapas cadastradas");
  });

  it("escapa o que veio de fora — nome de fornecedor não vira marcação", () => {
    const { html } = corpoCronogramaFornecedor({
      projeto: { titulo: "Projeto <script>alert(1)</script>" },
      fornecedor: { razaoSocial: "A & B <b>Ltda</b>" },
      etapas: [],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });
});

describe("texto padrão do cronograma (Alerta: Cronograma)", () => {
  it("traz o título, a abertura padrão, os dados do projeto e o cronograma do fornecedor", () => {
    const txt = textoCronogramaFornecedor({
      projeto: { titulo: "Festival X", local: "Expominas" },
      etapas: [{ etapa: "Montagem", data: "2026-10-15", horario: "08:00", atividades: "Palco" }],
      numeroOs: "OS-1",
    });
    expect(txt).toContain("Alerta: Cronograma");
    expect(txt).toContain("Esta é uma mensagem automática gerada pelo sistema de gestão da Pólobh.");
    expect(txt).toContain("confirmação do cronograma das ações que foram confirmadas para a sua empresa");
    expect(txt).toContain("Título: Festival X");
    expect(txt).toContain("Montagem · 15/10/2026 · 08:00 — Palco");
  });
});
