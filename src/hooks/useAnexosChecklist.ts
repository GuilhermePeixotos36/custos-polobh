/**
 * Liga a thread de observações de uma tarefa ao armazenamento de arquivos.
 *
 * Só o check-list usa (ver `domain/anexos`): é a existência desta API que faz o
 * clipe aparecer na caixa de comentário. EC e OS não a recebem e seguem sem
 * anexo nenhum.
 */
import { useMemo } from "react";
import { repo } from "@/data";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import type { ApiAnexos } from "@/components/ObservacoesPopup";
import type { AnexoObservacao } from "@/data/types";

export function useAnexosChecklist(itemId: string): ApiAnexos {
  const nome = useAuth((s) => s.usuario?.nome ?? "");

  return useMemo<ApiAnexos>(
    () => ({
      enviar: (arquivo) => repo.checklists.anexar(itemId, arquivo, nome),

      abrir: (anexo: AnexoObservacao) => {
        /*
         * A aba é aberta AGORA, no clique, e só depois recebe o endereço.
         *
         * O link é assinado na hora e demora um instante para chegar; abrir a
         * aba dentro da promessa faria o navegador tratá-la como pop-up e
         * bloquear — o anexo simplesmente não abriria, sem dizer por quê.
         */
        const janela = window.open("", "_blank", "noopener,noreferrer");
        repo.checklists
          .urlAnexo(anexo.caminho)
          .then((url) => {
            if (janela) janela.location.href = url;
            else window.location.href = url; // aba bloqueada: abre na mesma
          })
          .catch((e) => {
            janela?.close();
            toast(`Não foi possível abrir "${anexo.nome}": ${(e as Error).message}`, "danger");
          });
      },

      /*
       * Apagar o arquivo não segura a tela: o comentário já saiu da lista, e o
       * que resta é faxina do armazenamento. Falhou? Avisa, e fica um arquivo
       * órfão — bem menos grave do que travar a conversa por causa dele.
       */
      remover: (anexos) => {
        if (!anexos.length) return;
        repo.checklists
          .removerAnexos(anexos.map((a) => a.caminho))
          .catch((e) => toast(`Os anexos não puderam ser apagados: ${(e as Error).message}`, "warning"));
      },
    }),
    [itemId, nome]
  );
}
