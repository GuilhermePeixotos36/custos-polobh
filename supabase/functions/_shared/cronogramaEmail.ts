/**
 * O e-mail de cronograma do fornecedor — a versão do SERVIDOR.
 *
 * Existe porque o lembrete automático (`lembretes-cronograma`) roda em Deno,
 * fora do aplicativo, e escrevia o seu próprio corpo de mensagem à mão. Duas
 * cópias do mesmo texto envelhecem em ritmos diferentes, e foi o que aconteceu:
 * a do app aprendeu a dizer TODAS as datas do evento (`datasDoEvento`), e a
 * daqui continuou mandando o fornecedor para um evento de um dia só, porque lia
 * `projeto.evento` — que guarda apenas a PRIMEIRA faixa do cronograma.
 *
 * Este arquivo é a régua única do lado do servidor. Ele é TypeScript puro, sem
 * `Deno.` e sem importar nada do `src/`, por dois motivos: a Edge Function
 * precisa dele para deployar, e a suíte de testes do app precisa dele para
 * conferir que a regra continua a mesma (`src/lib/email/cronogramaServidor.test.ts`).
 *
 * Ele trabalha sobre as LINHAS CRUAS do banco (o jsonb `projeto`, o jsonb
 * `cronograma` da OS), e não sobre os objetos de domínio: quem chama é uma
 * função que leu do Postgres direto, sem passar pelos mapeadores do app.
 */

/** Uma faixa de horário de uma etapa do cronograma do projeto. */
export interface FaixaJson {
  data?: string;
  inicio?: string;
  fim?: string;
}

/** O jsonb `projetos.projeto` / `ecs.projeto`, no que interessa aqui. */
export interface ProjetoJson {
  titulo?: string;
  modalidade?: string;
  projetoIncentivado?: string;
  leiIncentivo?: string;
  incentivosFiscais?: string;
  codigoProjetoIncentivado?: string;
  participantes?: number | null;
  local?: string;
  enderecoLocal?: string;
  produtoraResponsavel?: string;
  telefoneProdutora?: string;
  emailProdutora?: string;
  /** Campos legados: a PRIMEIRA faixa do evento. Só valem sem cronograma. */
  evento?: string;
  horario?: string;
  cronograma?: { evento?: FaixaJson[] } & Record<string, FaixaJson[] | undefined>;
}

/** Uma etapa do cronograma DO FORNECEDOR, dentro da OS. */
export interface EtapaOsJson {
  etapa?: string;
  data?: string;
  horario?: string;
  atividades?: string;
}

export interface FornecedorJson {
  razaoSocial?: string;
  nomeFantasia?: string;
  representante?: string;
  email?: string;
}

/** Separador entre as várias datas/horários — o mesmo do app. */
const SEPARADOR = "  |  ";

export const dataBR = (s?: string): string =>
  s ? new Date(`${s}T00:00:00`).toLocaleDateString("pt-BR") : "";

export const escapar = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Faixas do evento que têm alguma coisa preenchida, na ordem cadastrada. */
const faixasDoEvento = (p: ProjetoJson): FaixaJson[] =>
  (p.cronograma?.evento ?? []).filter((f) => f?.data || f?.inicio || f?.fim);

/**
 * TODAS as datas do evento — a correção que motivou este arquivo.
 *
 * Datas repetidas colapsam: duas faixas no mesmo dia (manhã e noite) são um dia
 * só para quem lê "Data(s)". Sem cronograma, cai no campo legado — é o caso de
 * projeto anterior ao cronograma por faixas.
 */
export function datasDoEvento(p: ProjetoJson): string {
  const unicas = [...new Set(faixasDoEvento(p).map((f) => f.data).filter(Boolean) as string[])];
  if (!unicas.length) return p.evento ? dataBR(p.evento) : "";
  return unicas.map(dataBR).join(SEPARADOR);
}

/**
 * TODOS os horários do evento. Horários idênticos colapsam: três dias das 9h às
 * 18h leem "09:00 às 18:00", e não a mesma faixa três vezes.
 */
export function horariosDoEvento(p: ProjetoJson): string {
  const horarios = faixasDoEvento(p)
    .map((f) => [f.inicio, f.fim].filter(Boolean).join(" às "))
    .filter(Boolean);
  const unicos = [...new Set(horarios)];
  if (!unicos.length) return p.horario ?? "";
  return unicos.join(SEPARADOR);
}

/** A moldura da marca — a mesma do `wrap` de `src/lib/email/templates.ts`. */
function moldura(titulo: string, corpo: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#15161A;max-width:560px;margin:0 auto">
    <div style="padding:18px 0;border-bottom:2px solid #F2820D">
      <span style="font-size:20px;font-weight:800;letter-spacing:-.5px">
        <span style="color:#6A6E78">polo</span><span style="color:#E36F0A">bh</span>
      </span>
      <span style="color:#A0A4AC;font-size:12px;margin-left:8px">Pólobh Promoções</span>
    </div>
    <h2 style="font-size:18px;margin:22px 0 12px">${titulo}</h2>
    ${corpo}
    <p style="color:#A0A4AC;font-size:12px;margin-top:28px;border-top:1px solid #EEEFF2;padding-top:12px">
      Mensagem automática do sistema Pólobh — Gestão de Projetos.
    </p>
  </div>`;
}

/** Uma etapa do cronograma do PROJETO (Pré-evento, Montagem…), já formatada. */
export interface EtapaProjetoTexto {
  label: string;
  faixas: string;
}

/**
 * "Dados do Projeto", com os mesmos campos e a mesma ordem do módulo de mesmo
 * nome na OS (29/09/2026). Campo vazio não vira linha.
 */
export function linhasDadosDoProjeto(p: ProjetoJson, etapasProjeto: EtapaProjetoTexto[] = []): [string, string][] {
  const linhas: [string, string][] = [
    ["Título", p.titulo ?? ""],
    ["Modalidade", p.modalidade ?? ""],
    ["Nome do Projeto Incentivado", p.projetoIncentivado ?? ""],
    ["Lei de Incentivo à Cultura", p.leiIncentivo || p.incentivosFiscais || ""],
    ["Código do Projeto Incentivado", p.codigoProjetoIncentivado ?? ""],
    ["Data(s)", datasDoEvento(p)],
    ["Horário(s)", horariosDoEvento(p)],
    ["Local", p.local ?? ""],
    ["Endereço do Local", p.enderecoLocal ?? ""],
    ["Nº Participantes", p.participantes != null ? String(p.participantes) : ""],
    ["Produtora Responsável", p.produtoraResponsavel ?? ""],
    ["Telefone", p.telefoneProdutora ?? ""],
    ["E-mail", p.emailProdutora ?? ""],
    ...etapasProjeto.map((e): [string, string] => [e.label, e.faixas]),
  ];
  return linhas.filter(([, v]) => String(v).trim());
}

const ABERTURA_PADRAO = [
  "Esta é uma mensagem automática gerada pelo sistema de gestão da Pólobh.",
  "Veja abaixo a confirmação do cronograma das ações que foram confirmadas para a sua empresa.",
];

/**
 * O MESMO texto em mensagem simples (WhatsApp): título, abertura padrão, Dados
 * do Projeto e o cronograma completo do fornecedor.
 */
export function textoCronogramaFornecedor(opcoes: {
  projeto: ProjetoJson;
  etapas: EtapaOsJson[];
  numeroOs?: string;
  etapasProjeto?: EtapaProjetoTexto[];
}): string {
  const { projeto: p, etapas, numeroOs, etapasProjeto } = opcoes;
  const dados = linhasDadosDoProjeto(p, etapasProjeto).map(([k, v]) => `${k}: ${v}`);
  const cron = [...etapas]
    .sort((a, b) => (a?.data || "").localeCompare(b?.data || ""))
    .map((c) => `• ${[c.etapa || "Etapa", dataBR(c.data), c.horario].filter(Boolean).join(" · ")}${c.atividades ? ` — ${c.atividades}` : ""}`);
  return [
    "*Alerta: Cronograma*",
    "",
    ...ABERTURA_PADRAO,
    "",
    "*Dados do Projeto*",
    ...dados,
    "",
    `*Cronograma${numeroOs ? ` — ${numeroOs}` : ""}*`,
    ...(cron.length ? cron : ["Sem etapas cadastradas nesta OS."]),
  ].join("\n");
}

export interface CorpoCronograma {
  assunto: string;
  html: string;
}

/**
 * O cronograma específico do fornecedor: texto padrão + dados do evento + as
 * etapas DELE. Mesmo conteúdo do envio manual pela aba Cronograma — é a mesma
 * informação, e ela não pode mudar conforme quem apertou o botão.
 *
 * `lembrete` só troca a primeira frase: o disparo automático acontece dois dias
 * úteis antes e precisa dizer isso; o envio manual acontece quando a produção
 * quiser. O resto é idêntico de propósito.
 */
export function corpoCronogramaFornecedor(opcoes: {
  projeto: ProjetoJson;
  fornecedor: FornecedorJson;
  etapas: EtapaOsJson[];
  numeroOs?: string;
  lembrete?: boolean;
  etapasProjeto?: EtapaProjetoTexto[];
}): CorpoCronograma {
  const { projeto: p, fornecedor: f, etapas, numeroOs, lembrete, etapasProjeto } = opcoes;
  const h = escapar;

  const linhas = [...etapas]
    .sort((a, b) => (a?.data || "").localeCompare(b?.data || ""))
    .map(
      (c) => `<tr>
        <td style="padding:6px 12px 6px 0;font-size:13px;font-weight:bold;vertical-align:top;white-space:nowrap">${h(c.etapa || "Etapa")}</td>
        <td style="padding:6px 12px 6px 0;font-size:13px;vertical-align:top;white-space:nowrap">${h(dataBR(c.data))}</td>
        <td style="padding:6px 12px 6px 0;font-size:13px;vertical-align:top;white-space:nowrap">${h(c.horario)}</td>
        <td style="padding:6px 0;font-size:13px;vertical-align:top">${h(c.atividades)}</td>
      </tr>`
    )
    .join("");

  // Quem chamar no dia. Sem isto, a dúvida da montagem vira ligação para quem
  // estiver com o telefone à mão — ou não vira ligação nenhuma.
  const contato = [p.produtoraResponsavel, p.telefoneProdutora, p.emailProdutora]
    .filter(Boolean)
    .map(h)
    .join(" · ");

  const abertura = lembrete
    ? `<p>Seu evento é logo, e este é o lembrete do cronograma da sua equipe para o projeto
       <b>${h(p.titulo)}</b>${numeroOs ? `, conforme a <b>${h(numeroOs)}</b>` : ""}.</p>`
    : ABERTURA_PADRAO.map((t) => `<p>${h(t)}</p>`).join("");

  const corpo = `
    <p>Olá, ${h(f.representante || f.razaoSocial || "fornecedor")}.</p>
    ${abertura}

    <p style="font-size:13px;font-weight:bold;margin-bottom:4px">Dados do Projeto</p>
    <table style="border-collapse:collapse;margin:4px 0 16px">
      ${linhasDadosDoProjeto(p, etapasProjeto)
        .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#6A6E78;font-size:13px;vertical-align:top">${h(k)}</td>
          <td style="padding:2px 0;font-size:13px">${h(v)}</td></tr>`)
        .join("")}
    </table>

    <p style="font-size:13px;font-weight:bold;margin-bottom:4px">Cronograma${numeroOs ? ` — ${h(numeroOs)}` : ""}</p>
    <table style="border-collapse:collapse;width:100%;border-top:1px solid #EEEFF2">
      ${linhas || `<tr><td style="padding:8px 0;font-size:13px;color:#A0A4AC">Sem etapas cadastradas nesta OS.</td></tr>`}
    </table>

    ${contato && lembrete ? `<p style="font-size:13px;margin-top:16px"><b>Produtora responsável:</b> ${contato}</p>` : ""}
    <p style="font-size:14px">Qualquer dúvida, responda este e-mail.</p>`;

  return {
    assunto: lembrete
      ? `Lembrete de cronograma — ${p.titulo ?? ""}`
      : `Alerta: Cronograma — ${p.titulo ?? ""}${numeroOs ? ` (${numeroOs})` : ""}`,
    html: moldura(lembrete ? "Lembrete de cronograma" : "Alerta: Cronograma", corpo),
  };
}
