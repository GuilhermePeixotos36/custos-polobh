/**
 * A OS ATIVA ACOMPANHA A EC (27/11/2026).
 *
 * A regra da casa: enquanto a OS não foi emitida, ela é da EC — o que muda na
 * estimativa muda nela. Emitida, vira documento: só uma nova versão a altera
 * (ver `osAoSalvarEc`).
 *
 * A primeira metade da regra estava pela metade. Os VALORES já vinham da EC,
 * mas só na hora em que alguém abria a OS (25/11/2026): o que ficava GRAVADO
 * nela continuava velho até o próximo salvamento, e é o gravado que as listas
 * mostram. E o DESCRITIVO, copiado da EC quando a OS nasce, nunca mais era
 * tocado — renomear ou redescrever um item na EC não chegava a lugar nenhum.
 *
 * Aqui a OS ativa é posta em dia no momento em que a EC é salva:
 *   · valores, "não se aplica" e BV de cada item — sempre os da EC (a FORMA
 *     escolhida na OS fica);
 *   · parcela única, faturamento e contrato — seguem o valor novo quando ainda
 *     espelhavam o antigo (`alinharAoValorContratado`);
 *   · descritivo dos serviços, descritivo da nota e do contrato — seguem a EC
 *     ENQUANTO NINGUÉM OS REESCREVEU À MÃO. Texto ajustado na OS é decisão de
 *     quem a montou, e não é desfeito;
 *   · o nome do item no título da OS — segue quando o item é renomeado.
 *
 * O fornecedor não entra: trocar o fornecedor de um item é outra OS, não uma
 * atualização desta.
 */
import type { EcLinha, Os } from "@/data/types";
import { descritivoConsolidado, descritivoFinanceiro, itemDoTituloOs } from "@/domain/calc";
import { alinharAoValorContratado, sincronizarContratacao, valorDaContratacao } from "@/domain/contratacaoOs";
import { osEmitida } from "@/domain/faseOs";

const igual = (a: string | undefined | null, b: string | undefined | null) =>
  (a ?? "").replace(/\s+/g, " ").trim() === (b ?? "").replace(/\s+/g, " ").trim();

/** O texto ainda é o que o sistema escreveu (ou está vazio)? Então pode acompanhar. */
const aindaAutomatico = (atual: string | undefined, ...automaticos: string[]) =>
  !(atual ?? "").trim() || automaticos.some((a) => a.trim() && igual(atual, a));

/**
 * Devolve a OS em dia com a EC — ou a MESMA referência quando não há o que
 * mudar (é assim que quem chama sabe que não precisa gravar).
 *
 * `antes` e `depois` são TODAS as linhas da EC antes e depois da gravação; a
 * função separa as da OS. OS emitida ou arquivada volta intocada.
 */
export function osEmDiaComAEc(os: Os, antes: EcLinha[], depois: EcLinha[]): Os {
  if (os.status !== "Ativa" || osEmitida(os)) return os;
  const daOs = (linhas: EcLinha[]) => linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  const linhasAntes = daOs(antes);
  const linhasDepois = daOs(depois);
  if (!linhasDepois.length) return os;

  // Valores: os da EC, mantendo a forma escolhida; o resto da OS segue o total novo.
  const itens = sincronizarContratacao(os.itens ?? [], linhasDepois, { emitida: false });
  let nova: Os = alinharAoValorContratado({ ...os, itens }, valorDaContratacao(itens));

  // Textos: só os que ainda são os que o sistema escreveu.
  const descritivoVelho = descritivoConsolidado(linhasAntes);
  const descritivoNovo = descritivoConsolidado(linhasDepois);
  const nfVelho = descritivoFinanceiro(linhasAntes) || descritivoVelho;
  const nfNovo = descritivoFinanceiro(linhasDepois) || descritivoNovo;

  // Só há o que acompanhar quando o texto da EC mudou de fato: OS que nunca foi
  // aberta tem esses campos vazios, e preenchê-los aqui gravaria a OS a cada
  // salvamento da EC sem nada ter mudado nela.
  const mudouDescritivo = !igual(descritivoVelho, descritivoNovo);
  const mudouNf = !igual(nfVelho, nfNovo);
  const descritivo = mudouDescritivo && aindaAutomatico(os.descritivo, descritivoVelho) ? descritivoNovo : os.descritivo;
  const descritivoNf =
    mudouNf && (os.financeiro.descritivoNf ?? "").trim() && aindaAutomatico(os.financeiro.descritivoNf, nfVelho, descritivoVelho)
      ? nfNovo
      : os.financeiro.descritivoNf;
  // O do contrato nasce como cópia do da nota — e só existe quando há contrato preenchido.
  const descritivoServicos =
    mudouNf && (os.contrato.descritivoServicos ?? "").trim() && aindaAutomatico(os.contrato.descritivoServicos, os.financeiro.descritivoNf, nfVelho, descritivoVelho)
      ? nfNovo
      : os.contrato.descritivoServicos;

  // Título: o nome do item, quando é ele que identifica a OS (uma OS de um item só).
  const itemVelho = itemDoTituloOs({ linhas: antes }, os.ecLinhaIds);
  const itemNovo = itemDoTituloOs({ linhas: depois }, os.ecLinhaIds);
  const numero =
    itemVelho && itemNovo && itemVelho !== itemNovo && os.numero.includes(` – ${itemVelho} – `)
      ? os.numero.replace(` – ${itemVelho} – `, ` – ${itemNovo} – `)
      : os.numero;

  nova = {
    ...nova,
    numero,
    descritivo,
    financeiro: { ...nova.financeiro, descritivoNf },
    contrato: { ...nova.contrato, descritivoServicos },
  };
  return JSON.stringify(nova) === JSON.stringify(os) ? os : nova;
}
