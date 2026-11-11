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
      .filter((x) => !jaEnviadas.has(chaveEnvio(p.id, x.id)))
      .map((x) => ({ id: x.id, titulo: x.titulo, url: rotaDaPendencia(x) }));
    if (faltam.length) avisos.push({ userId: p.id, pendencias: faltam });
  }
  return avisos;
}
