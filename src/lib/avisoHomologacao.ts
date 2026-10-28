/**
 * AVISO DE HOMOLOGAÇÃO SÓ NA HORA DO ENVIO (28/10/2026).
 *
 * Antes, uma faixa amarela "Sistema em homologação" ficava fixa no alto da OS,
 * do cronograma e do credenciamento — atrapalhava a leitura de quem só abria a
 * tela. Agora o aviso aparece só quando a pessoa clica num botão que manda
 * e-mail:
 *  - disparo ainda DESLIGADO (OS e cronograma): um aviso e nada é enviado;
 *  - envio LIGADO mas ainda desviado: a confirmação do envio ganha uma linha
 *    dizendo que o e-mail vai para a caixa de teste da equipe.
 * Depois da virada (destino real liberado), nada disso aparece.
 */
import { flags } from "@/lib/flags";
import { confirmar } from "@/store/confirm";

/** Linha extra para a confirmação do envio — vazia quando o e-mail já vai ao destinatário real. */
export function notaCaixaDeTeste(): string {
  if (flags.emailDestinoReal) return "";
  return "\n\nSistema em homologação: o e-mail não chega ao destinatário. Ele vai para a caixa de teste da equipe, com o destinatário original no assunto.";
}

/**
 * Disparos que ainda estão desligados (OS e cronograma ao fornecedor). Mostra o
 * aviso e devolve `true` quando o envio deve parar aqui.
 */
export async function disparoBloqueado(oQue: "a OS" | "o cronograma"): Promise<boolean> {
  if (flags.disparoFornecedor) return false;
  await confirmar({
    titulo: "Envio ainda desativado",
    mensagem: `O sistema está em homologação: o envio d${oQue.slice(0, 1) === "a" ? "a" : "o"} ${oQue.slice(2)} por e-mail ao fornecedor fica desativado até a virada. Nada foi enviado.`,
    confirmarTexto: "Entendi",
    somenteOk: true,
  });
  return true;
}
