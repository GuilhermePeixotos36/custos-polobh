import type {
  CronogramaProjeto,
  EtapaCronogramaProjeto,
  FaixaCronogramaProjeto,
  ProjetoInfo,
  RoteirosProjeto,
} from "@/data/types";

export const ETAPAS_CRONOGRAMA: ReadonlyArray<{ key: EtapaCronogramaProjeto; label: string }> = [
  { key: "montagem", label: "Montagem" },
  { key: "alinhamentos", label: "Alinhamentos Técnicos / Testes" },
  { key: "ensaios", label: "Ensaios / Passagem de Som" },
  { key: "evento", label: "Evento" },
  { key: "desmontagem", label: "Desmontagem" },
] as const;

export function novaFaixaCronograma(): FaixaCronogramaProjeto {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `cron-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    data: "",
    inicio: "",
    fim: "",
  };
}

export function cronogramaProjetoVazio(): CronogramaProjeto {
  return {
    montagem: [novaFaixaCronograma()],
    alinhamentos: [novaFaixaCronograma()],
    ensaios: [novaFaixaCronograma()],
    evento: [novaFaixaCronograma()],
    desmontagem: [novaFaixaCronograma()],
  };
}

export const roteirosProjetoVazio = (): RoteirosProjeto => ({ preEvento: "", evento: "", posEvento: "" });

export function projetoInfoVazio(): ProjetoInfo {
  return {
    titulo: "",
    modalidade: "",
    local: "",
    enderecoLocal: "",
    participantes: null,
    produtoraResponsavel: "",
    telefoneProdutora: "",
    emailProdutora: "",
    preEvento: "",
    evento: "",
    posEvento: "",
    horario: "",
    roteiro: "",
    incentivosFiscais: "",
    cronograma: cronogramaProjetoVazio(),
    roteiros: roteirosProjetoVazio(),
  };
}

function normalizarFaixas(valor: unknown, dataLegada = "", horarioLegado = ""): FaixaCronogramaProjeto[] {
  if (Array.isArray(valor) && valor.length) {
    return valor.map((item) => {
      const faixa = (item ?? {}) as Partial<FaixaCronogramaProjeto>;
      return { ...novaFaixaCronograma(), ...faixa, id: faixa.id || novaFaixaCronograma().id };
    });
  }
  const [inicio = "", fim = ""] = horarioLegado.split(/\s+(?:às|as|a)\s+/i);
  return [{ ...novaFaixaCronograma(), data: dataLegada, inicio, fim }];
}

export function normalizarProjetoInfo(valor: unknown): ProjetoInfo {
  const base = projetoInfoVazio();
  const raw = (valor && typeof valor === "object" ? valor : {}) as Partial<ProjetoInfo>;
  const cron = (raw.cronograma ?? {}) as Partial<CronogramaProjeto>;
  return {
    ...base,
    ...raw,
    modalidade: raw.modalidade === "Cultural" || raw.modalidade === "Corporativo" ? raw.modalidade : "",
    cronograma: {
      montagem: normalizarFaixas(cron.montagem, raw.preEvento),
      alinhamentos: normalizarFaixas(cron.alinhamentos),
      ensaios: normalizarFaixas(cron.ensaios),
      evento: normalizarFaixas(cron.evento, raw.evento, raw.horario),
      desmontagem: normalizarFaixas(cron.desmontagem, raw.posEvento),
    },
    roteiros: { ...base.roteiros, ...(raw.roteiros ?? {}), evento: raw.roteiros?.evento || raw.roteiro || "" },
  };
}

function textoHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

/** Mantém os campos legados usados nos documentos e nas OSs enquanto a migração é gradual. */
export function sincronizarCamposLegados(info: ProjetoInfo): ProjetoInfo {
  const normalizado = normalizarProjetoInfo(info);
  const primeira = (etapa: EtapaCronogramaProjeto) =>
    normalizado.cronograma[etapa].find((faixa) => faixa.data || faixa.inicio || faixa.fim) ?? normalizado.cronograma[etapa][0];
  const evento = primeira("evento");
  return {
    ...normalizado,
    preEvento: primeira("montagem")?.data ?? "",
    evento: evento?.data ?? "",
    posEvento: primeira("desmontagem")?.data ?? "",
    horario: [evento?.inicio, evento?.fim].filter(Boolean).join(" às "),
    roteiro: textoHtml(normalizado.roteiros.evento),
  };
}
