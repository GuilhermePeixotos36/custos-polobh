/**
 * Ponte entre o navegador de pendências (a pílula do canto inferior direito) e a
 * thread de observações do item.
 *
 * Achar o item já não bastava: a pendência é um comentário específico, muitas
 * vezes dentro de uma thread retraída com outros dez. Ao saltar para ela, o
 * navegador avisa por aqui; a thread daquele item se abre sozinha e o comentário
 * exato pisca em vermelho, com o mesmo destaque do resto do sistema.
 *
 * É um aviso solto (publish/subscribe) em vez de props porque quem salta (a
 * pílula, fixa na tela) e quem abre (a thread, lá no meio da lista) não têm
 * nenhum parentesco na árvore de componentes.
 */
import { destacarElemento, idAncoraPendencia, idCampoPendencia, idComentario } from "@/lib/destaque";

export interface AlvoPendencia {
  /** Item que contém a pendência (linha da EC, tarefa do check-list, OS). */
  ancora: string;
  /** Observação exata, quando a pendência é um comentário. */
  observacaoId?: string;
  /** Campos de status do item, quando a pendência é "emitir OS/Contrato". */
  campos?: string[];
}

/** Devolve `true` quando a thread é a dona daquela âncora e já tratou o salto. */
type Ouvinte = (alvo: AlvoPendencia) => boolean;
const ouvintes = new Set<Ouvinte>();

/**
 * Salto que ninguém atendeu ainda — o item está em OUTRA tela (a pendência de
 * uma EC vista a partir do projeto, por exemplo). Fica guardado até a tela de
 * destino montar e a thread daquele item se apresentar. A validade curta evita
 * que um salto abandonado acorde sozinho meia hora depois.
 */
let pendente: (AlvoPendencia & { em: number }) | null = null;
const VALIDADE_MS = 20000;

/** Inscreve uma thread para ouvir os saltos. Devolve a função de cancelar. */
export function aoFocarPendencia(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * Faz latejar o que a pendência é: sempre o item, e — quando a pendência é um
 * status a emitir — também os campos OS/Contrato dentro dele.
 *
 * Só o item leva a câmera. Os campos piscam onde estão (`rolar: false`): são
 * dois, lado a lado na mesma linha, e três rolagens disputando o mesmo clique
 * deixavam a tela dando solavanco.
 *
 * Fica separado de `focarPendencia` porque o salto vindo de OUTRA tela só é
 * atendido quando a tela de destino monta (ver `alvoPendente`): lá o destaque
 * precisa ser refeito, sem reabrir a distribuição do alvo.
 */
export function destacarAlvo(alvo: AlvoPendencia): void {
  destacarElemento(idAncoraPendencia(alvo.ancora), "pendencia");
  for (const campo of alvo.campos ?? []) {
    destacarElemento(idCampoPendencia(alvo.ancora, campo), "pendencia", { rolar: false });
  }
}

/** Rola até o item, faz o card latejar e avisa a thread para abrir no comentário. */
export function focarPendencia(alvo: AlvoPendencia): void {
  destacarAlvo(alvo);
  let atendido = false;
  for (const ouvinte of [...ouvintes]) if (ouvinte(alvo)) atendido = true;
  // Ninguém desta tela é dono do item: guarda para a tela de destino consumir.
  pendente = atendido ? null : { ...alvo, em: Date.now() };
}

/**
 * A thread de `ancora` acabou de montar: pergunta se o salto guardado era para
 * ela. Consome o alvo (só a primeira que perguntar é atendida).
 */
export function alvoPendente(ancora: string): AlvoPendencia | null {
  if (!pendente || pendente.ancora !== ancora) return null;
  const { observacaoId, campos, em } = pendente;
  pendente = null;
  return Date.now() - em > VALIDADE_MS ? null : { ancora, observacaoId, campos };
}

/** Destaca o comentário dentro da thread já aberta (usado pela própria thread). */
export function destacarComentario(observacaoId: string): void {
  destacarElemento(idComentario(observacaoId), "pendencia");
}
