/**
 * "Gerar Nova Versão EC" — o gesto é o mesmo na leitura e na edição da EC.
 *
 * O alerta é o da Pólobh: a versão atual é arquivada automaticamente. (Em projeto
 * ativo a EC não se arquiva sozinha — sai do ar só quando outra a substitui.)
 * A nova versão nasce da EC GRAVADA; na edição, o que ainda não foi salvo não
 * entra, e o aviso diz isso.
 */
import { repo } from "@/data";
import { confirmar } from "@/store/confirm";
import { toast } from "@/store/toast";
import type { Ec } from "@/data/types";

export async function gerarNovaVersaoEc(ec: Ec, opts: { alteracoesNaoSalvas?: boolean } = {}): Promise<Ec | null> {
  const ok = await confirmar({
    titulo: "Gerar nova versão desta EC?",
    mensagem:
      "Ao gerar uma nova versão da EC, a versão atual será arquivada automaticamente." +
      (opts.alteracoesNaoSalvas ? " As alterações que você ainda não salvou não entram na nova versão." : ""),
    confirmarTexto: "Gerar nova versão",
  });
  if (!ok) return null;
  const nova = await repo.ecs.novaVersao(ec.id);
  toast(`Nova versão V${String(nova.versao).padStart(2, "0")} criada. A anterior foi arquivada.`, "success");
  return nova;
}
