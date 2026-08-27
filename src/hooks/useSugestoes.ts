/**
 * Sugestões de preenchimento para os campos de texto livre.
 *
 * Lê as listas que a store de pendências já carregou (projetos, ECs e OSs) e
 * devolve, por campo, o que a casa já usou — ver `domain/sugestoes`. Nenhuma
 * consulta nova: são exatamente os mesmos dados dos badges.
 *
 * O resultado é memorizado no módulo, e não por componente: uma EC longa tem
 * dezenas de campos pedindo a mesma lista, e recalcular a varredura em cada um
 * deles seria desperdício puro.
 */
import { useEffect, useMemo } from "react";
import { usePendencias } from "@/store/pendencias";
import { montarSugestoes, SUGESTOES_VAZIAS, type Sugestoes } from "@/domain/sugestoes";
import type { Ec, Os, Projeto } from "@/data/types";

let cache: { projetos: Projeto[]; ecs: Ec[]; oss: Os[]; valor: Sugestoes } | null = null;

function sugestoesDe(projetos: Projeto[], ecs: Ec[], oss: Os[]): Sugestoes {
  if (cache && cache.projetos === projetos && cache.ecs === ecs && cache.oss === oss) return cache.valor;
  const valor = projetos.length || ecs.length || oss.length
    ? montarSugestoes(projetos, ecs, oss)
    : SUGESTOES_VAZIAS;
  cache = { projetos, ecs, oss, valor };
  return valor;
}

export function useSugestoes(): Sugestoes {
  const projetos = usePendencias((s) => s.projetos);
  const ecs = usePendencias((s) => s.ecs);
  const oss = usePendencias((s) => s.oss);
  const carregar = usePendencias((s) => s.carregar);

  // A store tem trava de rajada própria: chamar aqui só garante que a tela que
  // depende das sugestões não fique sem dado se o carregamento inicial falhou.
  useEffect(() => {
    void carregar();
  }, [carregar]);

  return useMemo(() => sugestoesDe(projetos, ecs, oss), [projetos, ecs, oss]);
}
