import { useCallback, useEffect, useRef, useState } from "react";
import { repo } from "@/data";
import {
  INTERVALO_SINAL_MS,
  avisoDePosse,
  posseAtiva,
  type PosseDeEdicao,
} from "@/domain/travaEdicao";

/**
 * Segura a posse de um documento enquanto a pessoa o edita.
 *
 * O ciclo é simples e o que o torna confiável são as saídas: toma a posse ao
 * entrar em modo de edição, dá sinal de vida a cada 30 segundos, e LARGA ao
 * sair — ao trocar de tela, ao fechar a aba, ao sair do modo de edição.
 *
 * As três saídas precisam existir juntas. Só o `useEffect` de desmontagem não
 * cobre fechar a aba nem recarregar a página, e nesses casos a posse ficaria
 * presa até caducar — noventa segundos em que a colega vê "está editando" de
 * alguém que já foi embora. Por isso também o `pagehide`, que é o único evento
 * em que dá para confiar no celular: o `beforeunload` não dispara no iOS quando
 * o app vai para segundo plano.
 *
 * `travado` é o que a tela usa para virar leitura. Ele começa FALSO e só vira
 * verdadeiro quando o banco responde que a posse é de outra pessoa — nunca
 * antes: travar por um instante enquanto a resposta não chega faria o formulário
 * piscar em toda abertura.
 */
export interface TravaEdicao {
  /** Outra pessoa está com o documento: a tela precisa ficar em leitura. */
  travado: boolean;
  /** O texto pronto para o aviso — vazio quando não há o que dizer. */
  aviso: string;
  /** A posse caducou (sem sinal): dá para assumir. */
  podeAssumir: boolean;
  /** Tenta tomar a posse de novo — o botão "Assumir a edição". */
  tentarDeNovo: () => void;
  /** Largar antes de sair, quando a tela sabe que terminou (ao salvar). */
  liberar: () => Promise<void>;
}

export function useTravaEdicao(documento: string, ativo: boolean): TravaEdicao {
  const [posse, setPosse] = useState<PosseDeEdicao | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // Guardado em ref porque quem larga é a limpeza do efeito e o `pagehide` —
  // os dois rodam quando o estado já não vale mais.
  const meuRef = useRef(false);

  const liberar = useCallback(async () => {
    if (!meuRef.current) return;
    meuRef.current = false;
    await repo.travaEdicao.fechar(documento).catch(() => {});
  }, [documento]);

  useEffect(() => {
    if (!documento) {
      setPosse(null);
      return;
    }
    let vivo = true;

    /*
     * QUEM SÓ OLHA também consulta — uma vez, sem tomar posse.
     *
     * Sem isto, a pessoa só descobriria que a OS está com a colega DEPOIS de
     * clicar em "Editar": a tela abriria, o aviso apareceria e ela voltaria
     * para leitura. Com a consulta, o botão já nasce desligado e com o motivo
     * no `title`. É `quem_edita`, e não `abrir_edicao`, de propósito: consultar
     * não pode ter o efeito colateral de tomar o que só se queria olhar.
     *
     * Uma leitura, e não um relógio: quem está lendo um documento não precisa
     * de uma consulta a cada trinta segundos para descobrir que ele foi tomado.
     */
    if (!ativo) {
      void repo.travaEdicao
        .quem(documento)
        .then((atual) => { if (vivo) setPosse(atual); })
        .catch(() => { if (vivo) setPosse(null); });
      return () => { vivo = false; };
    }

    const bater = async () => {
      try {
        const atual = await repo.travaEdicao.abrir(documento);
        if (!vivo) return;
        meuRef.current = atual.meu;
        setPosse(atual);
      } catch {
        /*
         * Sem resposta do banco, NÃO trava: a rede caiu, e prender o documento
         * de quem está trabalhando por causa disso seria transformar uma falha
         * de rede em trabalho perdido. A trava otimista continua embaixo — se
         * duas pessoas de fato editarem, o segundo salvamento é recusado.
         */
        if (vivo) setPosse(null);
      }
    };

    void bater();
    const relogio = setInterval(bater, INTERVALO_SINAL_MS);

    // `pagehide` cobre fechar a aba, recarregar e o app ir para segundo plano
    // no celular — onde `beforeunload` não dispara. O envio precisa ser
    // síncrono-ish: a promessa não é aguardada, e é o que dá para fazer aqui.
    const aoSair = () => void liberar();
    globalThis.addEventListener?.("pagehide", aoSair);

    return () => {
      vivo = false;
      clearInterval(relogio);
      globalThis.removeEventListener?.("pagehide", aoSair);
      void liberar();
    };
  }, [documento, ativo, tentativa, liberar]);

  const deOutro = Boolean(posse && !posse.meu);
  return {
    travado: deOutro && posseAtiva(posse),
    aviso: avisoDePosse(posse),
    podeAssumir: deOutro && !posseAtiva(posse),
    tentarDeNovo: () => setTentativa((n) => n + 1),
    liberar,
  };
}
