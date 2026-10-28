/**
 * CANCELAR EDIÇÃO (28/10/2026): toda tela de edição tem uma saída que joga fora
 * o que foi digitado e volta ao que está salvo. Sem alteração, sai direto; com
 * alteração, pergunta antes — o mesmo texto em toda tela.
 */
import { confirmar } from "@/store/confirm";

export async function podeDescartar(sujo: boolean): Promise<boolean> {
  if (!sujo) return true;
  return confirmar({
    titulo: "Cancelar a edição?",
    mensagem: "As alterações feitas desde o último salvamento serão descartadas.",
    confirmarTexto: "Descartar alterações",
    cancelarTexto: "Continuar editando",
    tom: "danger",
  });
}
