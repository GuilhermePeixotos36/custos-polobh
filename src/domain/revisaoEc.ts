/**
 * O que mudou nesta EC desde a última vez que ela foi salva.
 *
 * Pedido de 15/09/2026: *"ao clicar no Revisar, o sistema pode mostrar o que foi
 * alterado para conferência antes de salvar?"*. Até então "Revisar" fazia outra
 * coisa — padronizava a formatação dos textos —, e quem editava uma EC de
 * quarenta itens salvava no escuro: não havia como conferir, antes de gravar, o
 * que a sessão inteira tinha mexido.
 *
 * As duas coisas viraram uma só e nesta ordem: primeiro a formatação é
 * padronizada, depois o comparativo mostra o resultado. Assim o que se confere
 * é exatamente o que vai ser gravado — inclusive as correções que o próprio
 * botão acabou de fazer, que antes entravam sem ninguém ver.
 *
 * A comparação é por ITEM, e não campo a campo do formulário inteiro: é assim
 * que quem trabalha na EC pensa ("o buffet mudou de preço"), e é o que cabe numa
 * tela. Item novo, item removido e item movido de grupo aparecem como tal.
 *
 * Irmã de `domain/mudancasEvento`, com uma diferença de propósito: lá se compara
 * o que o DOCUMENTO IMPRIME, para decidir se vale reemitir um papel já entregue;
 * aqui se compara o que a EC GUARDA, porque o objetivo é conferir o próprio
 * trabalho antes de gravá-lo.
 */
import type { Ec, EcLinha } from "@/data/types";
import { brl } from "@/lib/format";
import { htmlParaLinhas } from "@/lib/htmlTexto";

export type TipoMudancaEc = "incluido" | "removido" | "alterado";

export interface MudancaCampoEc {
  label: string;
  antes: string;
  depois: string;
}

export interface MudancaItemEc {
  /** Chave estável para a lista da tela. */
  chave: string;
  tipo: TipoMudancaEc;
  /** Como o item se chama, para a pessoa reconhecê-lo. */
  titulo: string;
  grupo: string;
  /** Vazio quando o item inteiro entrou ou saiu — aí o título já diz tudo. */
  campos: MudancaCampoEc[];
}

export interface RevisaoEc {
  itens: MudancaItemEc[];
  /** Mudanças fora dos itens (cabeçalho da EC, observações gerais). */
  gerais: MudancaCampoEc[];
  total: number;
}

const texto = (v: string | null | undefined) => (v ?? "").trim();

/** Trecho legível de um texto longo — um descritivo inteiro não cabe no comparativo. */
function resumir(v: string, limite = 140): string {
  const limpo = texto(v).replace(/\s+/g, " ");
  return limpo.length > limite ? `${limpo.slice(0, limite)}…` : limpo;
}

/** Descritivos são HTML: comparar a marcação acusaria mudança onde o texto é o mesmo. */
const semHtml = (v: string | null | undefined) => resumir(htmlParaLinhas(v ?? "").join(" "));

const dinheiro = (v: number | null | undefined) => brl(v ?? 0);

/**
 * Campos do item que entram na conferência.
 *
 * Ficam de fora os que a própria gravação preenche (`id`, ordem) e os que não
 * são decisão de quem edita — mostrar "atualizado em" mudando seria ruído em
 * toda revisão.
 */
const CAMPOS_ITEM: { label: string; ler: (l: EcLinha) => string }[] = [
  { label: "Grupo", ler: (l) => texto(l.grupo) },
  { label: "Item", ler: (l) => texto(l.item) },
  { label: "Descrição", ler: (l) => semHtml(l.descricao) },
  { label: "Descrição completa", ler: (l) => semHtml(l.descricaoCompleta) },
  { label: "Valor Pólobh", ler: (l) => dinheiro(l.valorPolobh) },
  { label: "Valor cliente", ler: (l) => dinheiro(l.valorCliente) },
  { label: "Aprovação", ler: (l) => texto(l.statusAprovacao) },
  { label: "OS", ler: (l) => texto(l.statusOs) },
  { label: "Contrato", ler: (l) => texto(l.contratoStatus) },
  { label: "Fornecedor", ler: (l) => texto(l.fornecedorRazao) },
  { label: "CPF/CNPJ do fornecedor", ler: (l) => texto(l.fornecedorCnpj) },
  { label: "Documento PG", ler: (l) => texto(l.faturaNf) },
  { label: "Valor com BV e NF", ler: (l) => dinheiro(l.valorComBvNf) },
  { label: "Valor sem BV e com NF", ler: (l) => dinheiro(l.valorSemBvComNf) },
  { label: "Valor sem BV e sem NF", ler: (l) => dinheiro(l.valorSemBvSemNf) },
  { label: "BV", ler: (l) => (l.bv?.modo === "fixo" ? dinheiro(l.bv?.valor) : `${l.bv?.valor ?? 0}%`) },
  { label: "Justificativa do BV", ler: (l) => resumir(texto(l.bv?.justificativa)) },
  { label: "Formas que não se aplicam", ler: (l) => [...(l.valoresNaoAplicaveis ?? [])].sort().join(", ") },
  { label: "Oculto", ler: (l) => (l.oculto ? "sim" : "não") },
];

/** Campos da EC que não pertencem a item nenhum. */
const CAMPOS_GERAIS: { label: string; ler: (e: Ec) => string }[] = [
  { label: "Responsável", ler: (e) => texto(e.responsavel) },
  { label: "Cliente", ler: (e) => texto(e.cliente?.razaoSocial) },
  { label: "CNPJ do cliente", ler: (e) => texto(e.cliente?.cnpjCpf) },
];

const nomeDoItem = (l: EcLinha) => texto(l.item) || semHtml(l.descricao) || "(item sem nome)";

/**
 * Compara a EC em edição com a última versão gravada.
 *
 * O casamento das linhas é pelo `id`, que é criado no navegador quando o item
 * nasce e sobrevive à gravação — é o que permite dizer "este item mudou de
 * grupo" em vez de "um item sumiu de um grupo e apareceu em outro".
 */
export function revisarEc(antes: Ec | null | undefined, depois: Ec): RevisaoEc {
  const itens: MudancaItemEc[] = [];
  const gerais: MudancaCampoEc[] = [];

  // EC que ainda não foi gravada não tem com o que ser comparada: tudo nela é
  // novo, e listar quarenta inclusões não ajuda ninguém a conferir nada.
  if (!antes) return { itens: [], gerais: [], total: 0 };

  for (const campo of CAMPOS_GERAIS) {
    const a = campo.ler(antes);
    const d = campo.ler(depois);
    if (a !== d) gerais.push({ label: campo.label, antes: a, depois: d });
  }

  const linhasAntes = new Map((antes.linhas ?? []).map((l) => [l.id, l]));
  const vistos = new Set<string>();

  for (const linha of depois.linhas ?? []) {
    vistos.add(linha.id);
    const anterior = linhasAntes.get(linha.id);
    if (!anterior) {
      itens.push({
        chave: linha.id,
        tipo: "incluido",
        titulo: nomeDoItem(linha),
        grupo: texto(linha.grupo),
        campos: [],
      });
      continue;
    }
    const campos: MudancaCampoEc[] = [];
    for (const campo of CAMPOS_ITEM) {
      const a = campo.ler(anterior);
      const d = campo.ler(linha);
      if (a !== d) campos.push({ label: campo.label, antes: a, depois: d });
    }
    if (campos.length) {
      itens.push({
        chave: linha.id,
        tipo: "alterado",
        titulo: nomeDoItem(linha),
        grupo: texto(linha.grupo),
        campos,
      });
    }
  }

  for (const [id, linha] of linhasAntes) {
    if (vistos.has(id)) continue;
    itens.push({
      chave: id,
      tipo: "removido",
      titulo: nomeDoItem(linha),
      grupo: texto(linha.grupo),
      campos: [],
    });
  }

  return { itens, gerais, total: gerais.length + itens.length };
}
