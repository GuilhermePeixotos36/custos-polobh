/**
 * Templates de e-mail (texto padrão da Pólobh) por evento.
 * Geram assunto + HTML simples. Sem dependências — fácil de manter por 1 dev.
 */
import type { Ec, Os } from "@/data/types";
import { urlCredenciamento } from "@/lib/links";
import { dataBR } from "@/lib/format";
// Todas as faixas do evento: o e-mail que leva a OS ao fornecedor dizia só o
// primeiro dia (ver `datasDoEvento`).
import { datasDoEvento, horariosDoEvento } from "@/domain/projeto";

export interface AnexoEmail {
  nome: string;
  /** Conteúdo em base64 (sem o prefixo "data:...;base64,"). */
  conteudoBase64: string;
}

export interface MensagemEmail {
  para: { email: string; nome?: string }[];
  assunto: string;
  html: string;
  responderPara?: { email: string; nome?: string };
  /** Anexos (hoje: a planilha Excel referente à ação que disparou o e-mail). */
  anexos?: AnexoEmail[];
}

const REMETENTE_NOME = "Pólobh Eventos";

const h = (valor: unknown): string => String(valor ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const urlHttp = (valor: string): string => {
  try {
    const u = new URL(valor);
    return ["http:", "https:"].includes(u.protocol) ? h(u.toString()) : "#";
  } catch { return "#"; }
};

function wrap(titulo: string, corpoHtml: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#15161A;max-width:560px;margin:0 auto">
    <div style="padding:18px 0;border-bottom:2px solid #F2820D">
      <span style="font-size:20px;font-weight:800;letter-spacing:-.5px">
        <span style="color:#6A6E78">polo</span><span style="color:#E36F0A">bh</span>
      </span>
      <span style="color:#A0A4AC;font-size:12px;margin-left:8px">${REMETENTE_NOME}</span>
    </div>
    <h2 style="font-size:18px;margin:22px 0 12px">${titulo}</h2>
    ${corpoHtml}
    <p style="color:#A0A4AC;font-size:12px;margin-top:28px;border-top:1px solid #EEEFF2;padding-top:12px">
      Mensagem automática do sistema Pólobh — Custos de Eventos.
    </p>
  </div>`;
}

/** OS disparada ao fornecedor. */
export function emailDispararOs(os: Os, ec: Ec): MensagemEmail {
  const corpo = `
    <p>Olá, ${h(os.fornecedor.representante || os.fornecedor.razaoSocial || "fornecedor")}.</p>
    <p>Segue a <b>Ordem de Serviço ${h(os.numero)}</b> referente ao projeto
       <b>${h(ec.projeto.titulo)}</b> (${h(ec.cliente.nome)}).</p>
    <ul style="font-size:14px;line-height:1.6">
      <li><b>Data(s):</b> ${h(datasDoEvento(ec.projeto))}</li>
      <li><b>Horário(s):</b> ${h(horariosDoEvento(ec.projeto))}</li>
      <li><b>Local:</b> ${h(ec.projeto.local)}</li>
      <li><b>Modalidade:</b> ${h(os.modalidade || "—")}</li>
    </ul>
    <p style="font-size:14px"><b>Descritivo:</b><br>${h(os.descritivo || "").replace(/\n/g, "<br>")}</p>
    <p style="font-size:14px">Por favor, confirme o recebimento e realize o credenciamento da equipe pelo link:
       <a href="${urlHttp(urlCredenciamento(os))}">${h(urlCredenciamento(os))}</a>
       ${os.credenciamento.prazoLimite ? `(prazo: ${dataBR(os.credenciamento.prazoLimite)})` : ""}.</p>`;
  return {
    para: os.fornecedor.email ? [{ email: os.fornecedor.email, nome: os.fornecedor.razaoSocial }] : [],
    assunto: `Ordem de Serviço ${os.numero} — ${ec.projeto.titulo}`,
    html: wrap("Nova Ordem de Serviço", corpo),
  };
}

/** Link de credenciamento ao fornecedor. */
export function emailCredenciamento(os: Os, ec: Ec): MensagemEmail {
  const corpo = `
    <p>Olá, ${h(os.fornecedor.razaoSocial || "fornecedor")}.</p>
    <p>Para o projeto <b>${h(ec.projeto.titulo)}</b>, acesse o formulário de credenciamento
       e cadastre os dados de profissionais e veículos da sua equipe:</p>
    <p><a href="${urlHttp(urlCredenciamento(os))}"
        style="display:inline-block;background:#F2820D;color:#2A1602;font-weight:700;
        padding:10px 18px;border-radius:10px;text-decoration:none">Abrir credenciamento</a></p>
    ${os.credenciamento.prazoLimite ? `<p style="font-size:14px"><b>Prazo limite:</b> ${dataBR(os.credenciamento.prazoLimite)}</p>` : ""}`;
  return {
    para: os.fornecedor.email ? [{ email: os.fornecedor.email, nome: os.fornecedor.razaoSocial }] : [],
    assunto: `Credenciamento — ${ec.projeto.titulo} (${os.numero})`,
    html: wrap("Credenciamento da equipe", corpo),
  };
}

/**
 * O CRONOGRAMA ESPECÍFICO do fornecedor.
 *
 * Cada um recebe o SEU — as etapas da OS dele, não o cronograma do evento
 * inteiro. É a diferença entre "o palco monta quinta às 8h" e uma tabela de
 * doze fornecedores em que ele tem de se procurar.
 *
 * A mensagem é texto padrão + dados: o padrão diz o que é e o que se espera de
 * quem recebe; os dados são o evento (onde, quando) e as etapas dele. Ela serve
 * tanto ao envio da aba Cronograma quanto ao lembrete de véspera — é a mesma
 * informação, e manter dois textos faria um deles envelhecer.
 */
export function emailCronogramaDoFornecedor(os: Os, ec: Ec): MensagemEmail {
  const etapas = [...os.cronograma]
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
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
  const p = ec.projeto;
  const contato = [p.produtoraResponsavel, p.telefoneProdutora, p.emailProdutora].filter(Boolean).map(h).join(" · ");

  const corpo = `
    <p>Olá, ${h(os.fornecedor.representante || os.fornecedor.razaoSocial || "fornecedor")}.</p>
    <p>Segue o cronograma da sua equipe para o projeto <b>${h(p.titulo)}</b>, conforme a
       <b>${h(os.numero)}</b>. Confira as etapas abaixo e confirme se há qualquer divergência
       com o que foi combinado.</p>

    <table style="border-collapse:collapse;margin:8px 0 16px">
      <tr><td style="padding:2px 12px 2px 0;color:#6A6E78;font-size:13px">Data(s)</td>
          <td style="padding:2px 0;font-size:13px"><b>${h(datasDoEvento(p))}</b></td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#6A6E78;font-size:13px">Horário(s)</td>
          <td style="padding:2px 0;font-size:13px">${h(horariosDoEvento(p))}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#6A6E78;font-size:13px">Local</td>
          <td style="padding:2px 0;font-size:13px">${h(p.local)}</td></tr>
      ${p.enderecoLocal ? `<tr><td style="padding:2px 12px 2px 0;color:#6A6E78;font-size:13px">Endereço</td>
          <td style="padding:2px 0;font-size:13px">${h(p.enderecoLocal)}</td></tr>` : ""}
    </table>

    <p style="font-size:13px;font-weight:bold;margin-bottom:4px">Cronograma da sua equipe</p>
    <table style="border-collapse:collapse;width:100%;border-top:1px solid #EEEFF2">
      ${etapas || `<tr><td style="padding:8px 0;font-size:13px;color:#A0A4AC">Sem etapas cadastradas nesta OS.</td></tr>`}
    </table>

    ${contato ? `<p style="font-size:13px;margin-top:16px"><b>Produtora responsável:</b> ${contato}</p>` : ""}
    <p style="font-size:14px">Qualquer dúvida, responda este e-mail.</p>`;

  return {
    para: os.fornecedor.email ? [{ email: os.fornecedor.email, nome: os.fornecedor.razaoSocial }] : [],
    assunto: `Cronograma — ${ec.projeto.titulo} (${os.numero})`,
    html: wrap("Cronograma da sua equipe", corpo),
  };
}

/** EC enviada ao cliente para aprovação. */
export function emailEcParaAprovacao(ec: Ec): MensagemEmail {
  const rep = ec.cliente.representante;
  const corpo = `
    <p>Olá, ${h(rep.nome || ec.cliente.nome)}.</p>
    <p>Segue para aprovação a Estimativa de Custos <b>${h(ec.numero)}</b> referente ao projeto
       <b>${h(ec.projeto.titulo)}</b>.</p>
    <p style="font-size:14px">A aprovação pode ser feita por resposta a este e-mail e tem força contratual,
       conforme os termos da proposta. Validade: ${ec.validadeDias} dias.</p>`;
  return {
    para: rep.email ? [{ email: rep.email, nome: rep.nome }] : [],
    assunto: `Estimativa de Custos para aprovação — ${ec.projeto.titulo}`,
    html: wrap("Estimativa de Custos | Proposta Comercial", corpo),
  };
}

/* -------------------------------- Help Desk ------------------------------ */

/** O que a pessoa está pedindo — muda a urgência com que o suporte lê. */
export type TipoChamado = "Erro no sistema" | "Dúvida de uso" | "Sugestão de melhoria" | "Acesso e permissões";

export interface Chamado {
  tipo: TipoChamado;
  assunto: string;
  descricao: string;
  /** Onde a pessoa estava quando abriu o chamado — poupa a primeira pergunta. */
  tela: string;
  autorNome: string;
  autorEmail: string;
  /** Navegador e resolução: metade dos "não funciona aqui" mora nisso. */
  ambiente: string;
}

/**
 * Chamado aberto de dentro do aplicativo.
 *
 * O `responderPara` é o e-mail de quem abriu, e é o detalhe que faz a coisa
 * funcionar: o suporte responde apertando "responder", sem ter de copiar
 * endereço de dentro do corpo da mensagem.
 */
export function emailHelpDesk(c: Chamado, para: string): MensagemEmail {
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:4px 10px 4px 0;color:#6A6E78;font-size:13px;vertical-align:top;white-space:nowrap">${h(rotulo)}</td>
         <td style="padding:4px 0;font-size:13px">${h(valor)}</td></tr>`;
  const corpo = `
    <table style="border-collapse:collapse;margin-bottom:16px">
      ${linha("Tipo", c.tipo)}
      ${linha("Aberto por", `${c.autorNome} <${c.autorEmail}>`)}
      ${linha("Tela", c.tela)}
      ${linha("Ambiente", c.ambiente)}
    </table>
    <p style="font-size:14px;font-weight:bold;margin-bottom:4px">${h(c.assunto)}</p>
    <p style="font-size:14px;white-space:pre-line;background:#FAFAFB;border:1px solid #EEEFF2;border-radius:8px;padding:12px">${h(c.descricao)}</p>`;
  return {
    para: [{ email: para, nome: "Suporte Pólobh" }],
    assunto: `[Help Desk] ${c.tipo} — ${c.assunto}`,
    html: wrap("Chamado aberto no sistema", corpo),
    // Responder vai direto para quem abriu.
    responderPara: c.autorEmail ? { email: c.autorEmail, nome: c.autorNome } : undefined,
  };
}
