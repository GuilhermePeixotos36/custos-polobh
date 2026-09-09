import type {
  BlocoCronogramaExtra,
  CronogramaProjeto,
  Cliente,
  EtapaCronogramaProjeto,
  FaixaCronogramaProjeto,
  ProjetoInfo,
  RoteirosProjeto,
  RoteiroExtraProjeto,
} from "@/data/types";
import { documentoFiscalValido } from "@/lib/cnpj";
import { dataBR } from "@/lib/format";

export const ROTEIROS_PADRAO = ["preEvento", "evento", "posEvento"] as const;

export const ETAPAS_CRONOGRAMA: ReadonlyArray<{ key: EtapaCronogramaProjeto; label: string }> = [
  { key: "montagem", label: "Montagem" },
  { key: "alinhamentos", label: "Alinhamentos Técnicos / Testes" },
  { key: "ensaios", label: "Ensaios / Passagem de Som" },
  { key: "evento", label: "Evento" },
  { key: "desmontagem", label: "Desmontagem" },
] as const;

/**
 * Identificador do bloco na ordenação do cronograma. As cinco etapas padrão
 * usam o prefixo `etapa:` (a chave é fixa e alimenta os campos legados);
 * os blocos criados pelo usuário usam `extra:` + id próprio.
 */
export const idBlocoEtapa = (key: EtapaCronogramaProjeto) => `etapa:${key}`;
export const idBlocoExtra = (id: string) => `extra:${id}`;

const novoId = (prefixo: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function novaFaixaCronograma(): FaixaCronogramaProjeto {
  return { id: novoId("cron"), data: "", inicio: "", fim: "" };
}

export function novoBlocoCronograma(): BlocoCronogramaExtra {
  return { id: novoId("bloco"), titulo: "Novo bloco", faixas: [novaFaixaCronograma()] };
}

/** Ordem inicial dos blocos: as cinco etapas padrão, na sequência natural do evento. */
export const cronogramaOrdemPadrao = (): string[] => ETAPAS_CRONOGRAMA.map((e) => idBlocoEtapa(e.key));

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

export function novoRoteiroExtra(): RoteiroExtraProjeto {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `roteiro-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    titulo: "Nova etapa",
    conteudo: "",
  };
}

export function projetoInfoVazio(): ProjetoInfo {
  return {
    titulo: "",
    clienteAbreviado: "",
    nomeProjeto: "",
    anoProjeto: "",
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
    cronogramaExtras: [],
    cronogramaOrdem: cronogramaOrdemPadrao(),
    etapasOcultas: [],
    roteiros: roteirosProjetoVazio(),
    roteirosOcultos: [],
    roteirosExtras: [],
    roteiroOrdem: [...ROTEIROS_PADRAO],
  };
}

function normalizarFaixas(valor: unknown, dataLegada = "", horarioLegado = ""): FaixaCronogramaProjeto[] {
  // Um array (mesmo vazio) significa que o projeto já foi salvo no formato atual:
  // respeitamos o vazio, senão um bloco esvaziado por arraste renasceria com uma
  // data em branco a cada recarga. Só dados legados (sem o array) caem no fallback.
  if (Array.isArray(valor)) {
    return valor.map((item) => {
      const faixa = (item ?? {}) as Partial<FaixaCronogramaProjeto>;
      return { ...novaFaixaCronograma(), ...faixa, id: faixa.id || novaFaixaCronograma().id };
    });
  }
  const [inicio = "", fim = ""] = horarioLegado.split(/\s+(?:às|as|a)\s+/i);
  return [{ ...novaFaixaCronograma(), data: dataLegada, inicio, fim }];
}

/** Título do projeto sempre montado a partir das 3 partes (mantém em sincronia telas, prints e exportações). */
export function compoeTituloProjeto(clienteAbreviado: string, nomeProjeto: string, anoProjeto: string): string {
  return [clienteAbreviado, nomeProjeto, anoProjeto].filter((parte) => parte.trim()).join(" – ");
}

/**
 * Projetos antigos só têm o título em texto livre (sem cliente/nome/ano separados).
 * Tenta extrair automaticamente: ano = último token de 4 dígitos plausível (19xx/20xx);
 * o restante, se tiver um separador (-, –, |, :, •), vira cliente + nome; sem separador,
 * fica tudo em "nome" e o cliente é deixado em branco para revisão manual.
 */
function migrarTituloLegado(titulo: string): Pick<ProjetoInfo, "clienteAbreviado" | "nomeProjeto" | "anoProjeto"> {
  const t = (titulo || "").trim();
  if (!t) return { clienteAbreviado: "", nomeProjeto: "", anoProjeto: "" };
  const anos = t.match(/(?:19|20)\d{2}(?!\d)/g);
  const anoProjeto = anos ? anos[anos.length - 1] : "";
  const semAno = anoProjeto
    ? t.replace(new RegExp(`\\s*[-–—:|•]?\\s*${anoProjeto}\\s*[-–—:|•]?\\s*$`), "").trim()
    : t;
  const partes = semAno.split(/\s*[-–—:|•]\s*/).filter(Boolean);
  if (partes.length >= 2) {
    return { clienteAbreviado: partes[0], nomeProjeto: partes.slice(1).join(" – "), anoProjeto };
  }
  return { clienteAbreviado: "", nomeProjeto: semAno, anoProjeto };
}

export function normalizarProjetoInfo(valor: unknown): ProjetoInfo {
  const base = projetoInfoVazio();
  const raw = (valor && typeof valor === "object" ? valor : {}) as Partial<ProjetoInfo>;
  const cron = (raw.cronograma ?? {}) as Partial<CronogramaProjeto>;
  const semCamposNovos = !raw.clienteAbreviado && !raw.nomeProjeto && !raw.anoProjeto;
  const migrado = semCamposNovos && raw.titulo ? migrarTituloLegado(raw.titulo) : null;
  const roteirosExtras = Array.isArray(raw.roteirosExtras)
    ? raw.roteirosExtras
      .filter((item) => !!item && typeof item === "object")
      .map((item) => {
        const parcial = item as Partial<RoteiroExtraProjeto>;
        return { ...novoRoteiroExtra(), ...parcial, id: parcial.id || novoRoteiroExtra().id, titulo: parcial.titulo ?? "Nova etapa", conteudo: parcial.conteudo ?? "" };
      })
    : [];
  const idsRoteiro = new Set([...ROTEIROS_PADRAO, ...roteirosExtras.map((item) => item.id)]);
  const roteiroOrdem = Array.isArray(raw.roteiroOrdem)
    ? [...raw.roteiroOrdem.filter((id): id is string => typeof id === "string" && idsRoteiro.has(id)), ...[...idsRoteiro].filter((id) => !raw.roteiroOrdem!.includes(id))]
    : [...ROTEIROS_PADRAO, ...roteirosExtras.map((item) => item.id)];

  const cronogramaExtras: BlocoCronogramaExtra[] = Array.isArray(raw.cronogramaExtras)
    ? raw.cronogramaExtras
      .filter((item) => !!item && typeof item === "object")
      .map((item) => {
        const parcial = item as Partial<BlocoCronogramaExtra>;
        return {
          id: parcial.id || novoBlocoCronograma().id,
          titulo: parcial.titulo ?? "Novo bloco",
          faixas: normalizarFaixas(parcial.faixas),
        };
      })
    : [];
  const idsCronograma = new Set([
    ...ETAPAS_CRONOGRAMA.map((e) => idBlocoEtapa(e.key)),
    ...cronogramaExtras.map((b) => idBlocoExtra(b.id)),
  ]);
  // Ordem salva primeiro (descartando ids órfãos), e o que faltar entra no fim —
  // assim um bloco novo nunca some por não constar da ordem gravada.
  const cronogramaOrdem = Array.isArray(raw.cronogramaOrdem)
    ? [
      ...raw.cronogramaOrdem.filter((id): id is string => typeof id === "string" && idsCronograma.has(id)),
      ...[...idsCronograma].filter((id) => !raw.cronogramaOrdem!.includes(id)),
    ]
    : [...idsCronograma];

  return {
    ...base,
    ...raw,
    ...(migrado ?? {}),
    modalidade: raw.modalidade === "Cultural" || raw.modalidade === "Corporativo" ? raw.modalidade : "",
    cronograma: {
      montagem: normalizarFaixas(cron.montagem, raw.preEvento),
      alinhamentos: normalizarFaixas(cron.alinhamentos),
      ensaios: normalizarFaixas(cron.ensaios),
      evento: normalizarFaixas(cron.evento, raw.evento, raw.horario),
      desmontagem: normalizarFaixas(cron.desmontagem, raw.posEvento),
    },
    cronogramaExtras,
    cronogramaOrdem,
    roteiros: { ...base.roteiros, ...(raw.roteiros ?? {}), evento: raw.roteiros?.evento || raw.roteiro || "" },
    roteirosExtras,
    roteiroOrdem,
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

/* ------------------- Datas e horários do EVENTO, todos eles ---------------- */

/**
 * Separador entre as várias datas/horários do evento. O mesmo do cronograma
 * impresso: são valores lado a lado, não uma frase.
 */
const SEPARADOR_FAIXAS = "  |  ";

/** Faixas do evento que têm alguma coisa preenchida, na ordem cadastrada. */
const faixasDoEvento = (info: ProjetoInfo): FaixaCronogramaProjeto[] =>
  (info.cronograma?.evento ?? []).filter((f) => f.data || f.inicio || f.fim);

/**
 * TODAS as datas do evento, na ordem em que foram cadastradas.
 *
 * O evento de três dias é o caso comum da casa, e os campos `evento`/`horario`
 * de `ProjetoInfo` só guardam a PRIMEIRA faixa — eles são o resquício de quando
 * o cronograma era um par de campos soltos (ver `sincronizarCamposLegados`).
 * Documento que lê só esses campos manda o fornecedor para um evento de um dia
 * só; daí estas duas funções, que leem o cronograma inteiro e caem nos campos
 * legados apenas quando não há cronograma (OS antiga, cujo snapshot foi tirado
 * antes de o cronograma existir).
 *
 * Datas repetidas são colapsadas: duas faixas no mesmo dia (manhã e noite) são
 * um dia só para quem lê "Data(s)".
 */
export function datasDoEvento(info: ProjetoInfo): string {
  const datas = faixasDoEvento(info).map((f) => f.data).filter(Boolean);
  const unicas = [...new Set(datas)];
  if (!unicas.length) return info.evento ? dataBR(info.evento) : "";
  return unicas.map(dataBR).join(SEPARADOR_FAIXAS);
}

/**
 * TODOS os horários do evento, na ordem das faixas.
 *
 * Horários idênticos são colapsados: o evento de três dias das 9h às 18h lê
 * "09:00 às 18:00", e não a mesma faixa três vezes. Quando os dias têm horários
 * diferentes, todos aparecem — na mesma ordem das datas acima.
 */
export function horariosDoEvento(info: ProjetoInfo): string {
  const horarios = faixasDoEvento(info)
    .map((f) => [f.inicio, f.fim].filter(Boolean).join(" às "))
    .filter(Boolean);
  const unicos = [...new Set(horarios)];
  if (!unicos.length) return info.horario ?? "";
  return unicos.join(SEPARADOR_FAIXAS);
}

/**
 * Cronograma do evento em texto, uma etapa por linha — é ASSIM que ele sai na
 * OS impressa. Mora aqui porque quem compara duas versões do projeto
 * (`domain/mudancasEvento`) precisa comparar exatamente o que o documento
 * mostra: se a linha impressa não mudou, nada mudou para quem lê o papel.
 */
export function resumoCronogramaProjeto(info: ProjetoInfo): string {
  const linhas: string[] = [];
  for (const { key, label } of ETAPAS_CRONOGRAMA) {
    if ((info.etapasOcultas ?? []).includes(key)) continue;
    const faixas = (info.cronograma?.[key] ?? []).filter((f) => f.data || f.inicio || f.fim);
    if (!faixas.length) continue;
    const detalhe = faixas
      .map((f) => [dataBR(f.data), [f.inicio, f.fim].filter(Boolean).join(" às ")].filter(Boolean).join(" · "))
      .join("  |  ");
    linhas.push(`${label}: ${detalhe}`);
  }
  return linhas.join("\n");
}

export interface CampoObrigatorioProjeto {
  chave: string;
  label: string;
}

/** Campos mínimos para criar/salvar um projeto, compartilhados entre criação e edição. */
export function camposObrigatoriosProjeto(info: ProjetoInfo, cliente: Cliente): CampoObrigatorioProjeto[] {
  const faltando: CampoObrigatorioProjeto[] = [];
  if (!info.clienteAbreviado.trim()) faltando.push({ chave: "clienteAbreviado", label: "Cliente (apelido)" });
  if (!info.nomeProjeto.trim()) faltando.push({ chave: "nomeProjeto", label: "Nome do projeto" });
  if (!/^(19\d{2}|20\d{2}|2100)$/.test(info.anoProjeto.trim())) faltando.push({ chave: "anoProjeto", label: "Ano (1900 a 2100)" });
  if (!cliente.nome.trim()) faltando.push({ chave: "clienteNome", label: "Cliente (nome)" });
  if (!documentoFiscalValido(cliente.cnpjCpf)) faltando.push({ chave: "cnpjCpf", label: "CNPJ/CPF válido" });
  if (!info.modalidade) faltando.push({ chave: "modalidade", label: "Modalidade" });
  if (!info.local.trim()) faltando.push({ chave: "local", label: "Local" });
  if (!info.cronograma.evento.some((faixa) => faixa.data.trim())) faltando.push({ chave: "cronogramaEvento", label: "Data do evento (cronograma)" });
  return faltando;
}
