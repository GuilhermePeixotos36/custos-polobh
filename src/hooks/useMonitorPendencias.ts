/**
 * Mantém as pendências frescas SEM depender de alguém navegar.
 *
 * O que existia era só isto: a cada troca de tela, recarrega. Serve para os
 * badges de quem está mexendo no sistema — e não serve para nada quando a aba
 * fica aberta atrás de outra janela, que é justamente a situação em que o aviso
 * do sistema operacional teria valor. A pessoa deixa o Pólobh aberto o dia
 * inteiro numa aba, trabalha em outra coisa, e nesse tempo ninguém navega:
 * a lista de pendências congela no que era quando ela saiu, e o aviso de
 * "pendência nova" nunca acontece.
 *
 * Duas peças resolvem, e as duas são necessárias:
 *
 *  · UM RELÓGIO, que consulta de tempos em tempos mesmo com a aba escondida.
 *    O navegador estrangula temporizadores em aba de segundo plano (o Chrome
 *    reduz a no máximo um disparo por minuto), então o intervalo é folgado o
 *    bastante para atravessar isso sem depender de precisão.
 *
 *  · A VOLTA DA ABA. Quando a pessoa retorna ao Pólobh, ela quer ver o estado
 *    de agora, não o de três minutos atrás — e é o momento em que uma consulta
 *    a mais é mais barata, porque é exatamente quando ela vai olhar.
 *
 * A consulta ficou barata o bastante para isto existir: o painel usa a
 * projeção leve (`repo.ecs.listarPainel`), e o próprio store tem uma janela de
 * silêncio que descarta chamadas em rajada.
 */
import { useEffect } from "react";
import { usePendencias } from "@/store/pendencias";

/**
 * De quanto em quanto tempo consultar. Três minutos é o meio-termo entre
 * "avisa rápido" e "não fica batendo no banco o dia inteiro": com a aba
 * escondida são 20 consultas por hora, de uma listagem que hoje pesa ~13 kB.
 */
const INTERVALO_MS = 3 * 60 * 1000;

export function useMonitorPendencias(ativo: boolean): void {
  const carregar = usePendencias((s) => s.carregar);

  useEffect(() => {
    if (!ativo) return;

    const relogio = window.setInterval(() => void carregar(), INTERVALO_MS);

    // `visibilitychange` cobre voltar para a aba e restaurar a janela
    // minimizada; `focus` cobre o caso em que a aba nunca ficou escondida
    // porque a janela do navegador só estava ATRÁS de outro programa.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void carregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);

    return () => {
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [ativo, carregar]);
}
