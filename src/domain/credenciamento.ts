/**
 * A fila do credenciamento de um projeto.
 *
 * Credenciar é tarefa do EVENTO — a pergunta é "quem ainda falta?", e ela não
 * cabia dentro de uma OS só. Aqui a lista dos fornecedores do projeto vira uma
 * fila com o estado de cada um, pronta para a tela mostrar e para o disparo em
 * lote decidir quem entra.
 *
 * O LINK continua sendo um por OS, e tem de ser: é o `slugCredenciamento` dela
 * que diz ao formulário público qual fornecedor está respondendo. O que mudou
 * de lugar é o comando, não o dado.
 */
import { urlCredenciamento } from "@/lib/links";
import type { Ec, Os } from "@/data/types";

/** Uma OS na fila, já com o que a tela mostra e o que o disparo precisa decidir. */
export interface NaFila {
  os: Os;
  /** A EC da OS — o e-mail cita o projeto, então sem ela não há o que enviar. */
  ec: Ec | undefined;
  fornecedor: string;
  email: string;
  /** Vazio enquanto a OS não foi salva: o token do link nasce no banco. */
  link: string;
  respondeu: boolean;
}

/** OS encerrada não credencia mais ninguém. */
const ENCERRADA = ["Cancelada", "Arquivada"];

/**
 * A fila do projeto, em ordem alfabética de fornecedor — é assim que se procura
 * alguém numa lista de oito, e não pela ordem em que as OSs foram criadas.
 */
export function filaDeCredenciamento(oss: Os[], ecs: Ec[], responderam: string[]): NaFila[] {
  const respondidas = new Set(responderam);
  return oss
    .filter((o) => !ENCERRADA.includes(o.status))
    .map((os) => ({
      os,
      ec: ecs.find((e) => e.id === os.ecId),
      fornecedor:
        os.fornecedor.apelido || os.fornecedor.nomeFantasia || os.fornecedor.razaoSocial || "Fornecedor",
      email: os.fornecedor.email?.trim() ?? "",
      link: urlCredenciamento(os),
      respondeu: respondidas.has(os.id),
    }))
    .sort((a, b) => a.fornecedor.localeCompare(b.fornecedor, "pt-BR"));
}

/**
 * Entra no disparo em lote? Precisa de link, de e-mail, da EC e ainda não ter
 * respondido.
 *
 * Quem já respondeu fica de fora de propósito: reenviar o formulário a quem já
 * preencheu é ruído, e o "Enviar a todos" existe justamente para alcançar os
 * que faltam.
 */
export function podeReceberLink(f: NaFila): boolean {
  return !!f.link && !!f.email && !!f.ec && !f.respondeu;
}
