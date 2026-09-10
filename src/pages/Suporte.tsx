/**
 * `/suporte` não é mais uma tela — é uma PORTA para o painel.
 *
 * O Help Desk virou um painel sobre a tela em que a pessoa está (ver
 * `components/suporte/PainelSuporte`): pedir ajuda no meio de um trabalho não
 * pode custar abandonar o trabalho, nem perder de vista o que se quer
 * descrever. Com isso, a tela cheia deixou de existir.
 *
 * A rota fica, e por um motivo concreto: o e-mail que avisa a resposta do
 * suporte leva um botão apontando para cá, e link já enviado precisa continuar
 * valendo. Quem chega por ele cai no Calendário — a primeira tela do aplicativo
 * — com o painel já aberto em "Meus chamados", que é o que veio ver.
 */
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useSuporte } from "@/store/suporte";

export function Suporte() {
  const abrir = useSuporte((s) => s.abrir);

  useEffect(() => {
    // "meus": quem chega por link de e-mail vem acompanhar o que já pediu. A
    // tela de origem fica vazia de propósito — não houve tela, houve um link.
    abrir("meus", "");
  }, [abrir]);

  return <Navigate to="/calendario" replace />;
}
