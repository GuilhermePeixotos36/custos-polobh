/**
 * O que cada pessoa com aparelho inscrito deve receber por PUSH (11/11/2026).
 *
 * O push é o aviso que chega com o navegador fechado. Quem manda é qualquer app
 * aberto da equipe — todos enxergam os mesmos dados — e o servidor só entrega e
 * não repete (`push-pendencias`). Por isso o recorte aqui TEM de ser o mesmo do
 * sino de cada pessoa: é `agregarPendencias`, com o nome e as permissões DELA,
 * não as de quem está com o app aberto. Senão a Viviane receberia no celular
 * uma pendência que o sino dela não mostra — a notificação fantasma.
 */
import { agregarPendencias, rotaDaPendencia, type Pendencia } from "@/domain/pendencias";
import type { Recurso } from "@/store/auth";

export interface PessoaComPush {
  id: string;
  nome: string;
  papel: string;
  /** Recursos da área; null/vazio = vale o padrão do papel (igual a `pode()`). */
  recursos: string[] | null;
}

export interface PendenciaPush {
  id: string;
  titulo: string;
  url: string;
}

export interface AvisoPush {
  userId: string;
  pendencias: PendenciaPush[];
}

/** A mesma regra de `useAuth.pode`, para uma pessoa que não é quem está logado. */
export function podeDaPessoa(
  pessoa: Pick<PessoaComPush, "papel" | "recursos">,
  padraoDoPapel: (papel: string) => readonly string[],
): (r: Recurso) => boolean {
  const daArea = pessoa.recursos;
  if (daArea && daArea.length) return (r) => daArea.includes(r);
  const padrao = padraoDoPapel(pessoa.papel) ?? [];
  return (r) => padrao.includes(r);
}

/** Pendências que são uma CONVERSA: o `id` é da thread, e a thread anda. */
const ehConversa = (tipo: string) => tipo.includes("observacao") || tipo === "projeto.conversa";

/** Hash curto e estável (cyrb53) — só para distinguir uma mensagem de outra. */
function impressao(texto: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * A identidade do AVISO de uma pendência (12/11/2026) — o que decide "isto já foi
 * avisado a esta pessoa?".
 *
 * O `id` sozinho não serve: ele identifica a pendência, e a mesma pendência pode
 * voltar a ser da pessoa de verdade, por exemplo:
 *  · uma conversa vai e volta — a Bárbara pergunta à Marisa, a Marisa responde,
 *    a Bárbara pergunta de novo: é a MESMA thread (mesmo `id`) e a bola está de
 *    novo com a Marisa. Sem distinguir, só a primeira mensagem avisava, e as
 *    seguintes ficavam mudas para sempre;
 *  · a OS é devolvida pela Direção e a Produção a envia outra vez: mesmo
 *    `os.fase:…:direcao`, mas é trabalho novo para a Direção.
 *
 * Conversa: a chave carrega a última mensagem (está no título). OS em etapa: a
 * hora em que ela entrou na etapa (`versao`). O resto segue pelo `id`.
 */
export function chavePendencia(p: Pick<Pendencia, "id" | "tipo" | "titulo" | "versao">): string {
  const versao = p.versao || (ehConversa(p.tipo) ? impressao(p.titulo) : "");
  return versao ? `${p.id}#${versao}` : p.id;
}

/** Chave da memória de "já mandei ao servidor" desta sessão. */
export const chaveEnvio = (userId: string, pendenciaId: string) => `${userId}|${pendenciaId}`;

/**
 * Monta o que mandar ao servidor: para cada pessoa, as pendências dela que este
 * app ainda não mandou nesta sessão. O servidor é quem decide o que é novo de
 * verdade; a memória daqui só evita reenviar a lista inteira a cada recarga.
 */
export function avisosParaPush(
  itens: Pendencia[],
  pessoas: PessoaComPush[],
  padraoDoPapel: (papel: string) => readonly string[],
  jaEnviadas: ReadonlySet<string>,
): AvisoPush[] {
  const avisos: AvisoPush[] = [];
  for (const p of pessoas) {
    if (!p.nome?.trim()) continue;
    const { itens: dela } = agregarPendencias(itens, p.nome, podeDaPessoa(p, padraoDoPapel));
    const faltam = dela
      .map((x) => ({ id: chavePendencia(x), titulo: x.titulo, url: rotaDaPendencia(x) }))
      .filter((x) => !jaEnviadas.has(chaveEnvio(p.id, x.id)));
    if (faltam.length) avisos.push({ userId: p.id, pendencias: faltam });
  }
  return avisos;
}
