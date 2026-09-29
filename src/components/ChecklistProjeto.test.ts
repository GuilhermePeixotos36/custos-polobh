import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Fora do teste: tudo o que fala com o banco.
vi.mock("@/hooks/useAnexosChecklist", () => ({ useAnexosChecklist: () => undefined }));
vi.mock("@/hooks/useSugestoes", () => ({ useSugestoes: () => ({ valores: { tituloTarefa: [] } }) }));
vi.mock("@/components/ObservacoesPopup", () => ({ ObservacoesThread: () => null }));
vi.mock("@/store/auth", () => ({ useAuth: (sel: (s: unknown) => unknown) => sel({ usuario: { nome: "Ana" } }) }));

import { ChecklistProjeto } from "./ChecklistProjeto";
import type { Checklist, ItemChecklist } from "@/data/types";

const t = (id: string, etapa: string, ordem: number, extra: Partial<ItemChecklist> = {}): ItemChecklist => ({
  id, checklistId: "c", origemModeloItemId: "", titulo: `Tarefa ${id}`, descricao: "", etapa, status: "Pendente",
  dataLimite: "2000-01-01", dataManual: false, concluidoEm: "", concluidoPor: "", responsavel: "Ana", observacoes: [],
  oculto: false, ordem, ...extra,
});

const checklist = (itens: ItemChecklist[]): Checklist => ({
  id: "c", projetoId: "p", modalidade: "Cultural", modeloId: "m", itens, criadoEm: "", atualizadoEm: "",
});

const tela = (itens: ItemChecklist[], podeEditar = true) =>
  renderToStaticMarkup(
    createElement(ChecklistProjeto, {
      checklist: checklist(itens),
      usuarios: ["Ana"],
      podeEditar,
      onSalvarItem: () => {},
      onCriarItem: async () => {},
      onRemoverItem: () => {},
      onSalvarVarios: () => {},
      onRemoverVarios: () => {},
    })
  );

describe("tela do check-list", () => {
  it("mostra as colunas Tarefa, Responsável, Data Prevista, Data de Conclusão e Status", () => {
    const html = tela([t("a", "PRÉ", 0), t("b", "PRÉ", 1, { status: "Concluído", oculto: false })]);
    for (const coluna of ["Tarefa", "Responsável", "Data Prevista", "Data de Conclusão", "Status"]) expect(html).toContain(coluna);
  });

  it("status: Atrasado quando o prazo passou, Concluído quando encerrada", () => {
    const html = tela([t("a", "PRÉ", 0), t("b", "PRÉ", 1, { status: "Concluído" })]);
    expect(html).toContain("Atrasado");
    expect(html).toContain("Concluído");
  });

  it("quem pode editar vê o lote, a alça e as setas; quem só consulta, não", () => {
    const edita = tela([t("a", "PRÉ", 0)]);
    expect(edita).toContain("Selecionar todas");
    expect(edita).toContain("Arrastar a tarefa");
    const le = tela([t("a", "PRÉ", 0)], false);
    expect(le).not.toContain("Selecionar todas");
    expect(le).not.toContain("Arrastar a tarefa");
  });
});
