/**
 * Templates de e-mail (texto padrão da Pólobh) por evento.
 * Geram assunto + HTML simples. Sem dependências — fácil de manter por 1 dev.
 */
import type { Ec, Os } from "@/data/types";
import { dataBR } from "@/lib/format";

export interface MensagemEmail {
  para: { email: string; nome?: string }[];
  assunto: string;
  html: string;
  responderPara?: { email: string; nome?: string };
}

const REMETENTE_NOME = "Pólobh Eventos";

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
    <p>Olá, ${os.fornecedor.representante || os.fornecedor.razaoSocial || "fornecedor"}.</p>
    <p>Segue a <b>Ordem de Serviço ${os.numero}</b> referente ao projeto
       <b>${ec.projeto.titulo}</b> (${ec.cliente.nome}).</p>
    <ul style="font-size:14px;line-height:1.6">
      <li><b>Evento:</b> ${dataBR(ec.projeto.evento)} · ${ec.projeto.horario}</li>
      <li><b>Local:</b> ${ec.projeto.local}</li>
      <li><b>Modalidade:</b> ${os.modalidade || "—"}</li>
    </ul>
    <p style="font-size:14px"><b>Descritivo:</b><br>${(os.descritivo || "").replace(/\n/g, "<br>")}</p>
    <p style="font-size:14px">Por favor, confirme o recebimento e realize o credenciamento da equipe pelo link:
       <a href="${os.credenciamento.linkFormulario}">${os.credenciamento.linkFormulario}</a>
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
    <p>Olá, ${os.fornecedor.razaoSocial || "fornecedor"}.</p>
    <p>Para o projeto <b>${ec.projeto.titulo}</b>, acesse o formulário de credenciamento
       e cadastre os dados de profissionais e veículos da sua equipe:</p>
    <p><a href="${os.credenciamento.linkFormulario}"
        style="display:inline-block;background:#F2820D;color:#2A1602;font-weight:700;
        padding:10px 18px;border-radius:10px;text-decoration:none">Abrir credenciamento</a></p>
    ${os.credenciamento.prazoLimite ? `<p style="font-size:14px"><b>Prazo limite:</b> ${dataBR(os.credenciamento.prazoLimite)}</p>` : ""}`;
  return {
    para: os.fornecedor.email ? [{ email: os.fornecedor.email, nome: os.fornecedor.razaoSocial }] : [],
    assunto: `Credenciamento — ${ec.projeto.titulo} (${os.numero})`,
    html: wrap("Credenciamento da equipe", corpo),
  };
}

/** Lembrete de cronograma — 2 dias úteis antes do evento. */
export function emailLembreteCronograma(os: Os, ec: Ec): MensagemEmail {
  const etapas = [...os.cronograma]
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
    .map((c) => `<li><b>${c.etapa || "Etapa"}:</b> ${dataBR(c.data)} ${c.horario} — ${c.atividades}</li>`)
    .join("");
  const corpo = `
    <p>Olá, ${os.fornecedor.razaoSocial || "fornecedor"}.</p>
    <p>Lembrete do cronograma do projeto <b>${ec.projeto.titulo}</b>, que acontece em
       <b>${dataBR(ec.projeto.evento)}</b> no local <b>${ec.projeto.local}</b>.</p>
    <ul style="font-size:14px;line-height:1.6">${etapas || "<li>Sem etapas cadastradas.</li>"}</ul>
    <p style="font-size:14px">Qualquer dúvida, responda este e-mail.</p>`;
  return {
    para: os.fornecedor.email ? [{ email: os.fornecedor.email, nome: os.fornecedor.razaoSocial }] : [],
    assunto: `Lembrete de cronograma — ${ec.projeto.titulo}`,
    html: wrap("Lembrete de cronograma", corpo),
  };
}

/** EC enviada ao cliente para aprovação. */
export function emailEcParaAprovacao(ec: Ec): MensagemEmail {
  const rep = ec.cliente.representante;
  const corpo = `
    <p>Olá, ${rep.nome || ec.cliente.nome}.</p>
    <p>Segue para aprovação a Estimativa de Custos <b>${ec.numero}</b> referente ao projeto
       <b>${ec.projeto.titulo}</b>.</p>
    <p style="font-size:14px">A aprovação pode ser feita por resposta a este e-mail e tem força contratual,
       conforme os termos da proposta. Validade: ${ec.validadeDias} dias.</p>`;
  return {
    para: rep.email ? [{ email: rep.email, nome: rep.nome }] : [],
    assunto: `Estimativa de Custos para aprovação — ${ec.projeto.titulo}`,
    html: wrap("Estimativa de Custos | Proposta Comercial", corpo),
  };
}
