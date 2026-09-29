/**
 * A matriz dos sete perfis, conferida contra o que o check-list pediu.
 *
 * O cadastro das áreas é uma migração SQL, e não código — quem manda nas
 * permissões do dia a dia é a tabela `areas`, editável em Configurações. Mas a
 * matriz que ENTRA nela veio escrita, perfil por perfil, no check-list de
 * 15/09/2026, e um erro de digitação ali é alguém sem acesso na segunda-feira
 * ou, pior, alguém vendo a margem da casa.
 *
 * Então o teste lê a própria migração e confere as quatro regras do documento.
 * Ler o arquivo em vez de repetir a matriz aqui é de propósito: uma cópia em
 * TypeScript passaria a divergir do que está no banco no dia em que alguém
 * corrigisse só um dos dois.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260922100000_os_sete_perfis_da_polobh.sql"),
  "utf8"
);

/** Os `recursos` de cada área da migração, por nome. */
function recursosPorArea(): Record<string, string[]> {
  const fora: Record<string, string[]> = {};
  const re = /\('([^']+)',\s*'(?:Admin|Direcao|Producao|Administrativo)',\s*array\[([\s\S]*?)\]/g;
  for (let m = re.exec(SQL); m; m = re.exec(SQL)) {
    fora[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return fora;
}

const areas = recursosPorArea();
const SETE = [
  "Diretoria Produção",
  "Direção Administrativo-Financeira",
  "Coordenação Produção",
  "Coordenação Administrativo-Financeira",
  "Assistência Administrativo-Financeira",
  "Produção",
  "Back-office",
];

const tem = (perfil: string, recurso: string) => areas[perfil]?.includes(recurso) ?? false;

describe("as sete áreas da Pólobh", () => {
  it("existem, com os nomes do check-list", () => {
    for (const nome of SETE) expect(areas[nome], nome).toBeDefined();
  });

  it("todo perfil enxerga projeto, EC, OS e o guia", () => {
    for (const nome of SETE) {
      for (const r of ["projetos", "ecs", "oss", "guia"]) expect(tem(nome, r), `${nome} · ${r}`).toBe(true);
    }
  });
});

// "Uma EC só poderá ser criada, editada, substituída pelos seguintes perfis…"
describe("quem edita EC", () => {
  const podem = ["Diretoria Produção", "Coordenação Produção", "Produção", "Back-office"];
  const naoPodem = [
    "Direção Administrativo-Financeira",
    "Coordenação Administrativo-Financeira",
    "Assistência Administrativo-Financeira",
  ];

  it.each(podem)("%s edita", (p) => expect(tem(p, "ecs.editar")).toBe(true));
  it.each(naoPodem)("%s não edita", (p) => expect(tem(p, "ecs.editar")).toBe(false));
});

// "Esta aba só poderá ser visualizada pelos seguintes perfis…"
describe("quem vê a rentabilidade", () => {
  const podem = [
    "Diretoria Produção",
    "Direção Administrativo-Financeira",
    "Coordenação Produção",
    "Coordenação Administrativo-Financeira",
  ];
  const naoPodem = ["Assistência Administrativo-Financeira", "Produção", "Back-office"];

  it.each(podem)("%s vê", (p) => expect(tem(p, "rentabilidade")).toBe(true));
  it.each(naoPodem)("%s não vê", (p) => expect(tem(p, "rentabilidade")).toBe(false));
});

// "Até esta etapa da OS só terão permissão para edição os seguintes perfis…"
describe("quem monta a OS, até o envio para o financeiro", () => {
  const podem = [
    "Diretoria Produção",
    "Coordenação Produção",
    "Coordenação Administrativo-Financeira",
    "Produção",
    "Back-office",
  ];

  it.each(podem)("%s monta", (p) => expect(tem(p, "oss.editar")).toBe(true));

  it("a Assistência Administrativo-Financeira não monta", () => {
    expect(tem("Assistência Administrativo-Financeira", "oss.editar")).toBe(false);
  });
});

// "A partir desta etapa da OS só terão permissão para edição os seguintes…"
describe("quem conclui e emite a OS", () => {
  const podem = [
    "Diretoria Produção",
    "Coordenação Produção",
    "Coordenação Administrativo-Financeira",
    "Back-office",
  ];
  const naoPodem = ["Produção", "Assistência Administrativo-Financeira"];

  it.each(podem)("%s conclui o faturamento", (p) => expect(tem(p, "financeiro")).toBe(true));
  it.each(podem)("%s pode emitir", (p) => expect(tem(p, "oss.emitir")).toBe(true));

  // É o ponto do pedido: a Produção monta a OS e para aí. Sem `financeiro` os
  // blocos de faturamento não abrem, e sem `oss.emitir` o botão não aparece.
  it.each(naoPodem)("%s não conclui nem emite", (p) => {
    expect(tem(p, "financeiro")).toBe(false);
    expect(tem(p, "oss.emitir")).toBe(false);
  });
});
