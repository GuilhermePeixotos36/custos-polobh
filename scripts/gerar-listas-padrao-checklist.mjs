/**
 * Gera a migração SQL das LISTAS PADRÃO do check-list a partir das planilhas
 * que a Pólobh mantém (reference/Check-List Projetos …xlsx).
 *
 *   node scripts/gerar-listas-padrao-checklist.mjs > supabase/migrations/<data>_checklist_listas_padrao_polobh.sql
 *
 * Por que um script e não SQL escrito à mão: a lista tem ~190 tarefas e muda
 * quando a Pólobh revisa a planilha. Regerar é um comando; conferir 190 linhas
 * de JSON à mão é como se perde uma tarefa.
 *
 * Como o texto do "Prazo" da planilha vira regra (ver `ModoPrazoChecklist`):
 *   "Segunda-Feira da Nª semana anterior ao evento"  → semanas-antes (adaptável)
 *   "Segunda-Feira da Nª semana após o evento"       → semanas-apos
 *   "Nº. Dia útil após desmontagem"                  → dias-uteis-apos
 *   "Conforme dados Gerais …"                        → cronograma (data de trabalho)
 */
import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const LISTAS = [
  {
    modalidade: "Cultural",
    nome: "Projetos Culturais",
    prefixo: "cul",
    arquivo: "reference/Check-List Projetos Culturais - 01 10 26.xlsx",
    etapas: {
      1: "CONTRATAÇÃO ARTÍSTICA", 2: "TEATRO", 3: "ABERTURA DO PROJETO", 4: "PRÉ-DIVULGAÇÃO",
      5: "PEÇAS DE DIVULGAÇÃO", 6: "AÇÃO SOCIAL E CORTESIAS", 7: "REPASSE E APRESENTAÇÃO DO PROJETO",
      8: "REVISÃO E APROVAÇÃO DA EC", 9: "ALINHAMENTOS E CONTRATAÇÕES", 10: "EMISSÃO DE OS'S E PAGAMENTOS",
      11: "SEMANA DO EVENTO", 12: "EVENTO", 13: "FECHAMENTO COM O TEATRO", 14: "ENCERRAMENTO PÓS-EVENTO",
      15: "PRESTAÇÃO DE CONTAS — PRODUÇÃO", 16: "FATURAMENTO E RENTABILIDADE", 17: "PRESTAÇÃO DE CONTAS — DIVULGAÇÃO",
    },
  },
  {
    modalidade: "Corporativo",
    nome: "Projetos Corporativos",
    prefixo: "cor",
    arquivo: "reference/Check-List Projetos Corporativos - 01 10 26.xlsx",
    etapas: {
      1: "ABERTURA DO PROJETO", 2: "REPASSE E APRESENTAÇÃO DO PROJETO", 3: "REVISÃO E APROVAÇÃO DA EC",
      4: "ALINHAMENTOS E CONTRATAÇÕES", 5: "EMISSÃO DE OS'S E PAGAMENTOS", 6: "SEMANA DO EVENTO",
      7: "EVENTO", 8: "ENCERRAMENTO PÓS-EVENTO", 9: "FATURAMENTO E RENTABILIDADE",
    },
  },
];

/** Erros de digitação óbvios da planilha — o resto do texto é mantido como está. */
const CORRECOES = [
  [/Drobpbox/g, "Dropbox"],
  [/Formenecdores/g, "Fornecedores"],
  [/Cliclo/g, "Ciclo"],
  [/opreação/g, "operação"],
  [/Caterubg Teatri/g, "Catering Teatro"],
  [/Mercandising/g, "Merchandising"],
  [/Telefones Uteis/g, "Telefones Úteis"],
];

const ORDINAIS = {
  segunda: 2, terceira: 3, quarta: 4, quinta: 5, sexta: 6, "sétima": 7, oitava: 8, nona: 9,
  "décima": 10, "décima primeira": 11,
};

const limpar = (t) => CORRECOES.reduce((acc, [de, para]) => acc.replace(de, para), String(t ?? "")).replace(/\t/g, " ");

function texto(celula) {
  const v = celula?.value;
  if (v == null) return "";
  if (typeof v === "object" && v.richText) return v.richText.map((r) => r.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v);
}

/** O título é a primeira linha; as seguintes (passos numerados) viram a descrição. */
function tituloEDescricao(bruto) {
  const linhas = limpar(bruto).split("\n").map((l) => l.trim()).filter(Boolean);
  const titulo = (linhas[0] ?? "").replace(/:$/, "").replace(/\s+/g, " ").trim();
  return { titulo, descricao: linhas.slice(1).join("\n") };
}

function funcoesDe(bruto) {
  return limpar(bruto)
    .split("\n")
    .map((l) => l.replace(/^[•\s]+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Itens da seção "Evento" que a lista manda puxar do cronograma (data de trabalho). */
function regraDoCronograma(titulo) {
  const t = titulo.toLowerCase();
  if (t.startsWith("montagem")) return { modo: "cronograma", etapa: "montagem", ponta: "ultima" };
  if (t.startsWith("desmontagem")) return { modo: "cronograma", etapa: "desmontagem", ponta: "ultima" };
  if (t.startsWith("reunião alinhamento equipe")) {
    return { modo: "cronograma", etapa: "alinhamentos", ou: "evento", ponta: "primeira" };
  }
  return { modo: "cronograma", etapa: "evento", ponta: "ultima" }; // Evento · Operação evento / entrega
}

function regraDoPrazo(prazo, titulo) {
  const p = prazo.trim().toLowerCase();
  if (p.startsWith("conforme dados gerais")) return regraDoCronograma(titulo);
  let m = p.match(/^(\d+)o\.? dia útil após desmontagem/);
  if (m) return { modo: "dias-uteis-apos", base: "desmontagem", diasUteis: Number(m[1]) };
  m = p.match(/^segunda-feira da (?:(.+?) )?semana (anterior|após)/);
  if (m) {
    const n = m[1] ? ORDINAIS[m[1]] : 1;
    if (!n) throw new Error(`Ordinal desconhecido em "${prazo}"`);
    return m[2] === "anterior"
      ? { modo: "semanas-antes", semanas: n }
      : { modo: "semanas-apos", base: "evento", semanas: n };
  }
  throw new Error(`Prazo não reconhecido: "${prazo}" (${titulo})`);
}

async function lerLista(def) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(raiz, def.arquivo));
  const ws = wb.worksheets[0];
  const itens = [];
  let etapaNum = 0;
  let naEtapa = 0;
  ws.eachRow((row) => {
    const a = texto(row.getCell(1)).trim();
    if (!a) return;
    const cab = a.match(/^Etapa (\d+)/i);
    if (cab) {
      etapaNum = Number(cab[1]);
      naEtapa = 0;
      return;
    }
    const { titulo, descricao } = tituloEDescricao(a);
    const prazo = regraDoPrazo(texto(row.getCell(3)), titulo);
    naEtapa += 1;
    const nome = def.etapas[etapaNum];
    if (!nome) throw new Error(`Etapa ${etapaNum} sem nome em ${def.modalidade}`);
    itens.push({
      id: `${def.prefixo}-${String(etapaNum).padStart(2, "0")}-${String(naEtapa).padStart(2, "0")}`,
      titulo,
      descricao,
      etapa: `ETAPA ${etapaNum} · ${nome}`,
      prazo,
      responsavelPadrao: "",
      funcoes: funcoesDe(texto(row.getCell(2))),
      ordem: 0,
      _etapaNum: etapaNum,
    });
  });
  // Dentro da etapa do EVENTO a planilha lista "Evento" antes de "Montagem".
  // A tela lê melhor na ordem em que as coisas acontecem.
  const ordemDoEvento = ["montagem", "reunião alinhamento", "evento", "operação", "desmontagem"];
  const posicao = (t) => {
    const i = ordemDoEvento.findIndex((k) => t.toLowerCase().startsWith(k));
    return i < 0 ? 99 : i;
  };
  const etapaEvento = Number(Object.entries(def.etapas).find(([, n]) => n === "EVENTO")?.[0]);
  const grupoEvento = itens.filter((i) => i._etapaNum === etapaEvento).sort((x, y) => posicao(x.titulo) - posicao(y.titulo));
  const final = [];
  for (const i of itens) {
    if (i._etapaNum === etapaEvento) {
      if (grupoEvento.length) final.push(...grupoEvento.splice(0));
    } else final.push(i);
  }
  return final.map(({ _etapaNum, ...i }, ordem) => ({ ...i, ordem }));
}

const sqlTexto = (t) => `'${t.replace(/'/g, "''")}'`;

async function main() {
  const partes = [
    `-- ============================================================================
-- Listas padrão do check-list da Pólobh — Culturais e Corporativos   (01/10/2026)
--
-- GERADO por scripts/gerar-listas-padrao-checklist.mjs a partir das planilhas em
-- reference/ ("Check-List Projetos Culturais/Corporativos - 01 10 26.xlsx").
-- Não edite à mão: ajuste a planilha (ou o script) e gere de novo. A lista
-- também pode ser editada pela Coordenação em Configurações › Check-list.
--
-- SUBSTITUI as listas provisórias das sementes iniciais. Os check-lists já
-- gerados não são tocados — as tarefas deles seguem como estão; no projeto, o
-- aviso "trazer para este projeto" é que oferece as novas, se alguém quiser.
-- As tarefas de agora têm ids próprios ("cul-…", "cor-…"), então não colidem com
-- as provisórias ("mi-…").
--
-- Prazos: ver ModoPrazoChecklist em src/data/types.ts. As tarefas "semanas
-- antes do evento" se adaptam à janela entre a criação do projeto e o evento.
-- ============================================================================
`,
  ];
  for (const def of LISTAS) {
    const itens = await lerLista(def);
    partes.push(`
insert into checklist_modelos (modalidade, nome, itens, atualizado_em)
values (${sqlTexto(def.modalidade)}, ${sqlTexto(def.nome)}, $json$${JSON.stringify(itens, null, 1)}$json$::jsonb, now())
on conflict (modalidade) do update
  set nome = excluded.nome,
      itens = excluded.itens,
      atualizado_em = now();
`);
    process.stderr.write(`${def.modalidade}: ${itens.length} tarefas\n`);
  }
  process.stdout.write(partes.join(""));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
