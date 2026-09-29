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
import { telefoneWhatsApp } from "@/domain/envioCronograma";
import type { CredenciamentoResposta, Ec, Os } from "@/data/types";

/** Uma OS na fila, já com o que a tela mostra e o que o disparo precisa decidir. */
export interface NaFila {
  os: Os;
  /** A EC da OS — o e-mail cita o projeto, então sem ela não há o que enviar. */
  ec: Ec | undefined;
  fornecedor: string;
  email: string;
  /** Telefone do cadastro, pronto para o wa.me (só dígitos, com DDI). Vazio sem telefone. */
  whatsapp: string;
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
      whatsapp: telefoneWhatsApp(os.fornecedor.telefone),
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
  return podeEnviar(f) && !f.respondeu;
}

/**
 * O e-mail chega a sair? São os requisitos técnicos, e só eles: link (a OS
 * precisa estar salva), endereço e a EC que o texto cita.
 *
 * Separado de `podeReceberLink` porque a ESCOLHA da pessoa é outra coisa: ao
 * marcar alguém na lista, ela pode estar justamente reenviando a quem já
 * respondeu — o formulário voltou errado, o fornecedor trocou de equipe. Aí
 * "já respondeu" não é motivo para barrar; falta de e-mail é.
 */
export function podeEnviar(f: NaFila): boolean {
  return !!f.link && !!f.email && !!f.ec;
}

/* ------------------- a folha de credenciados, para o portão ---------------- */

export interface PessoaCredenciada {
  fornecedor: string;
  nome: string;
  cpf: string;
  funcao: string;
  /** Campos que o credenciamento pode pedir por evento (15/09/2026). */
  rg: string;
  endereco: string;
  telefone: string;
  aniversario: string;
}

export interface VeiculoCredenciado {
  fornecedor: string;
  modelo: string;
  placa: string;
}

/**
 * O que os fornecedores mandaram, achatado em duas listas: gente e veículos.
 *
 * É o formato em que a informação é USADA — uma folha na portaria, conferida
 * nome a nome. Guardada por OS, como chega, ela obrigaria o porteiro a saber de
 * qual fornecedor é cada pessoa antes de procurá-la.
 *
 * `semResposta` vai junto de propósito: a folha precisa dizer quem ainda não
 * mandou, senão a ausência de um nome vira dúvida na hora de liberar a entrada.
 */
export function credenciadosDaFila(
  fila: NaFila[],
  respostasPorOs: Map<string, CredenciamentoResposta[]>
): { equipe: PessoaCredenciada[]; veiculos: VeiculoCredenciado[]; semResposta: string[] } {
  const equipe: PessoaCredenciada[] = [];
  const veiculos: VeiculoCredenciado[] = [];
  const semResposta: string[] = [];

  for (const f of fila) {
    const respostas = respostasPorOs.get(f.os.id) ?? [];
    if (!respostas.length) {
      semResposta.push(f.fornecedor);
      continue;
    }
    for (const r of respostas) {
      for (const p of r.equipe) {
        if (!p.nome?.trim()) continue;
        equipe.push({
          fornecedor: f.fornecedor,
          nome: p.nome,
          cpf: p.cpf ?? "",
          funcao: p.funcao ?? "",
          rg: p.rg ?? "",
          endereco: p.endereco ?? "",
          telefone: p.telefone ?? "",
          aniversario: p.aniversario ?? "",
        });
      }
      for (const v of r.veiculos) {
        if (!v.modelo?.trim() && !v.placa?.trim()) continue;
        veiculos.push({ fornecedor: f.fornecedor, modelo: v.modelo ?? "", placa: v.placa ?? "" });
      }
    }
  }
  return { equipe, veiculos, semResposta };
}
