/**
 * A fila do envio de cronogramas.
 *
 * O cronograma de cada fornecedor está na OS dele. Ele vai ao fornecedor pelo
 * WhatsApp, com o texto padrão pronto — o sistema não manda e-mail a
 * fornecedor (23/11/2026).
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
  /** A EC da OS — o texto cita projeto, data e local, então sem ela não há texto. */
  ec: Ec | undefined;
  fornecedor: string;
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
      whatsapp: telefoneWhatsApp(os.fornecedor.telefone),
      etapas: (os.cronograma ?? []).filter((c) => c.data || c.horario || c.atividades?.trim()).length,
    }))
    .sort((a, b) => a.fornecedor.localeCompare(b.fornecedor, "pt-BR"));
}
