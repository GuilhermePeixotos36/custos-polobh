/**
 * A memória dos campos, pronta para a tela usar.
 *
 * Lê as listas que a store de pendências já carregou (projetos, ECs, OSs e
 * check-lists) e devolve, por campo, o que a casa já escreveu — ver
 * `domain/sugestoes`. Nenhuma consulta nova: são exatamente os mesmos dados dos
 * badges.
 *
 * O resultado é memorizado no módulo, e não por componente: uma EC longa tem
 * dezenas de campos pedindo a mesma lista, e recalcular a varredura em cada um
 * deles seria desperdício puro.
 */
import { useEffect, useMemo } from "react";
import { usePendencias } from "@/store/pendencias";
import { montarSugestoes, SUGESTOES_VAZIAS, type BaseSugestoes, type Sugestoes } from "@/domain/sugestoes";

let cache: { base: BaseSugestoes; valor: Sugestoes } | null = null;

function sugestoesDe(base: BaseSugestoes): Sugestoes {
  const igual =
    cache &&
    cache.base.projetos === base.projetos &&
    cache.base.ecs === base.ecs &&
    cache.base.oss === base.oss &&
    cache.base.checklists === base.checklists;
  if (igual) return cache!.valor;
  const vazia = !base.projetos.length && !base.ecs.length && !base.oss.length && !base.checklists.length;
  const valor = vazia ? SUGESTOES_VAZIAS : montarSugestoes(base);
  cache = { base, valor };
  return valor;
}

export function useSugestoes(): Sugestoes {
  const projetos = usePendencias((s) => s.projetos);
  const ecs = usePendencias((s) => s.ecs);
  const oss = usePendencias((s) => s.oss);
  const checklists = usePendencias((s) => s.checklists);
  const carregar = usePendencias((s) => s.carregar);

  // A store tem trava de rajada própria: chamar aqui só garante que a tela que
  // depende das sugestões não fique sem dado se o carregamento inicial falhou.
  useEffect(() => {
    void carregar();
  }, [carregar]);

  return useMemo(
    () => sugestoesDe({ projetos, ecs, oss, checklists }),
    [projetos, ecs, oss, checklists]
  );
}
