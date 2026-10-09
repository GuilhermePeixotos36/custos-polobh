/**
 * Aviso de "sair sem salvar" para formulários que não têm um "salvo" para
 * comparar — modais e cartões que abrem com um valor e o editam no lugar.
 *
 * Tira uma foto do valor no instante em que ele passa a existir (formulário
 * aberto) e considera "sujo" qualquer diferença depois dela. `null`/`undefined`
 * é o formulário fechado: a foto é descartada e nada é cobrado.
 *
 * Por baixo é o `useUnsavedGuard`: navegação interna pede confirmação, e
 * recarregar (F5) ou fechar a aba dispara o aviso nativo do navegador.
 */
import { useRef } from "react";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

export function useAvisoDeSaida(valor: unknown | null | undefined, ativo = true) {
  const foto = useRef<string | null>(null);
  const atual = valor == null ? null : JSON.stringify(valor);
  if (atual === null) foto.current = null;
  else if (foto.current === null) foto.current = atual;
  const sujo = ativo && atual !== null && atual !== foto.current;
  return useUnsavedGuard(sujo);
}
