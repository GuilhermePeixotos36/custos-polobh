/**
 * ATIVAR e INATIVAR um usuário — quem pode, e sobre quem.
 *
 * Inativar não é apagar, e a diferença é o motivo de isto existir. Apagar o
 * login leva junto o vínculo com tudo o que a pessoa fez: a trilha de auditoria
 * fica sem dono, e um dia alguém precisa saber quem lançou aquela EC. Férias,
 * afastamento, saída da casa — nenhum desses casos é "apagar".
 *
 * O BLOQUEIO DE VERDADE é no banco: `papel_atual()` devolve nulo para quem está
 * inativo, e com isso toda a RLS recusa, inclusive numa sessão já aberta (ver a
 * migração `20260924120000`). O que está aqui é a régua de QUEM PODE MEXER, e
 * ela vale nos dois lados — na tela, para não oferecer um botão que vai falhar,
 * e na Edge Function, que é onde a decisão é tomada de fato.
 */
import type { Papel } from "@/data/types";

/**
 * Os papéis que ativam e inativam alguém.
 *
 * "Só devs e admin/diretoria", no pedido de 24/09/2026. `Admin` é a conta de
 * desenvolvimento; `Direcao` é a diretoria. O Administrativo-Financeiro fica de
 * fora de propósito: ele administra o cadastro (nome, telefone, área), mas
 * cortar o acesso de alguém é decisão de quem responde pela casa.
 */
export const PAPEIS_QUE_ATIVAM: Papel[] = ["Admin", "Direcao"];

export const podeAtivarUsuarios = (papel: Papel | undefined): boolean =>
  !!papel && PAPEIS_QUE_ATIVAM.includes(papel);

/** O alvo, no que importa para esta decisão. */
export interface AlvoDaMudanca {
  id: string;
  papel: Papel;
  ativo: boolean;
}

export interface QuemMuda {
  id: string;
  papel: Papel;
}

/**
 * Por que esta mudança NÃO pode acontecer — ou `null` quando pode.
 *
 * Devolve o motivo em texto, e não um booleano, porque um botão que não
 * funciona sem dizer por quê é pior do que um botão ausente: a pessoa tenta de
 * novo, acha que é falha do sistema, e abre chamado.
 *
 * As duas travas existem contra o mesmo acidente — ficar sem ninguém capaz de
 * reverter. Elas também estão no banco, como gatilho: aqui é para a tela
 * explicar; lá é para ser verdade.
 */
export function motivoParaNaoMudar(
  quem: QuemMuda,
  alvo: AlvoDaMudanca,
  ativosQuePodemAtivar: number
): string | null {
  if (!podeAtivarUsuarios(quem.papel)) {
    return "Apenas a Direção e o Administrador ativam ou inativam usuários.";
  }
  // Reativar nunca tranca ninguém do lado de fora: as travas abaixo só valem
  // para o caminho que tira acesso.
  if (!alvo.ativo) return null;

  if (alvo.id === quem.id) {
    return "Você não pode inativar a sua própria conta.";
  }
  if (PAPEIS_QUE_ATIVAM.includes(alvo.papel) && ativosQuePodemAtivar <= 1) {
    return "Esta é a última conta capaz de ativar e inativar usuários — inativá-la deixaria o sistema sem ninguém para reverter.";
  }
  return null;
}

/** Quantas contas ativas ainda poderiam reativar alguém. */
export const quantosPodemAtivar = (usuarios: { papel: Papel; ativo?: boolean }[]): number =>
  usuarios.filter((u) => (u.ativo ?? true) && PAPEIS_QUE_ATIVAM.includes(u.papel)).length;
