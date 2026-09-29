/**
 * A fila do envio de cronogramas.
 *
 * O cronograma de cada fornecedor já existia — está na OS dele, e o sistema já
 * sabia montar o e-mail (ver `lib/email/templates`, lembrete de cronograma).
 * O que não existia era o COMANDO: mandar era uma OS de cada vez, o que na
 * véspera de um evento com dez fornecedores ninguém faz.
 *
 * A linha é por OS, e não por fornecedor como na folha de Dados Úteis: o que
 * se envia aqui é o cronograma DAQUELE contrato — o mesmo fornecedor pode ter
 * duas OSs com montagens em dias diferentes, e juntá-las mandaria a cada um
 * horários que não são dele.
 */
import type { Ec, Os } from "@/data/types";
import { nomeCurtoFornecedor } from "@/domain/fornecedor";

/** OS encerrada não tem cronograma a cumprir. */
const ENCERRADA = ["Cancelada", "Arquivada"];

export interface NaFilaCronograma {
  os: Os;
  /** A EC da OS — o e-mail cita projeto, data e local, então sem ela não há texto. */
  ec: Ec | undefined;
  fornecedor: string;
  email: string;
  /** Telefone do cadastro — só dígitos, com DDI 55 quando faltar. Vazio sem telefone. */
  whatsapp: string;
  /** Quantas etapas o cronograma da OS tem — zero significa nada a contar. */
  etapas: number;
}

/** Só dígitos, com DDI: é o que o link do WhatsApp (wa.me) exige. */
export function telefoneWhatsApp(tel?: string): string {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.length <= 11 ? `55${d}` : d;
}

/**
 * A fila do projeto, em ordem alfabética de fornecedor — é assim que se procura
 * alguém numa lista, e não pela ordem em que as OSs foram criadas.
 */
export function filaDeCronograma(oss: Os[], ecs: Ec[]): NaFilaCronograma[] {
  return oss
    .filter((o) => !ENCERRADA.includes(o.status))
    .map((os) => ({
      os,
      ec: ecs.find((e) => e.id === os.ecId),
      fornecedor: nomeCurtoFornecedor(os.fornecedor) || "Fornecedor",
      email: os.fornecedor.email?.trim() ?? "",
      whatsapp: telefoneWhatsApp(os.fornecedor.telefone),
      etapas: (os.cronograma ?? []).filter((c) => c.data || c.horario || c.atividades?.trim()).length,
    }))
    .sort((a, b) => a.fornecedor.localeCompare(b.fornecedor, "pt-BR"));
}

/**
 * O e-mail chega a sair? Requisitos técnicos: endereço e a EC que o texto cita.
 *
 * Ter etapas NÃO entra aqui de propósito. Marcar alguém na lista é uma escolha,
 * e mandar um cronograma ainda vazio pode ser exatamente o que se quer — avisar
 * que o dele está para sair. Quem decide é quem marcou.
 */
export function podeEnviarCronograma(f: NaFilaCronograma): boolean {
  return !!f.ec && !!f.email;
}

/**
 * Entra no "enviar a todos"? Aí sim precisa ter cronograma: um disparo em lote
 * que manda folhas vazias para metade dos fornecedores queima o aviso.
 */
export function temCronogramaParaEnviar(f: NaFilaCronograma): boolean {
  return podeEnviarCronograma(f) && f.etapas > 0;
}
