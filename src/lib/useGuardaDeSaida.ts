/**
 * A guarda de saída de um formulário: enquanto `sujo`, conta como formulário aberto com
 * alteração (bloqueio de rota e aviso do navegador ao fechar a aba) e devolve `pedirParaSair`,
 * que sai direto quando limpo e pergunta quando sujo (`guardaDeSaida.ts`).
 *
 * Modal com `JanelaModal` não precisa disto: passe `sujo` (e `novo`) a ela, que guarda ESC,
 * clique fora e o X do `CabecalhoJanela`; o botão "Cancelar" do rodapé usa
 * `sairSeConfirmar(sujo, fechar, { novo })`. O hook é para formulário que não mora num modal.
 */
import { useCallback, useEffect, useRef } from "react";

import { marcarFormularioSujo, sairSeConfirmar, type OpcoesDescarte } from "@/lib/guardaDeSaida";

export function useGuardaDeSaida(sujo: boolean, opcoes: OpcoesDescarte = {}) {
  const atual = useRef({ sujo, opcoes });
  atual.current = { sujo, opcoes };

  useEffect(() => (sujo ? marcarFormularioSujo() : undefined), [sujo]);

  return useCallback(
    (sair: () => void) => sairSeConfirmar(atual.current.sujo, sair, atual.current.opcoes),
    [],
  );
}
