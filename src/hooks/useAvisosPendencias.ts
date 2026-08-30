/**
 * Avisa no sistema operacional quando aparece pendência NOVA para a pessoa.
 *
 * O sino do topo só resolve para quem está olhando para ele. As pendências que
 * mais custam caro são justamente as que nascem enquanto a pessoa está em outra
 * coisa — um comentário cobrando resposta, uma OS a emitir para o evento de
 * amanhã.
 *
 * Três decisões que este arquivo carrega:
 *
 *  · O que já existia NÃO vira aviso. Na primeira carga depois de ligar as
 *    notificações, as pendências abertas entram como marco zero, caladas. Sem
 *    isso, ligar o recurso dispararia quinze notificações de uma vez e a pessoa
 *    desligaria na mesma hora.
 *
 *  · Um aviso por rodada, não um por pendência. Cinco pendências novas viram
 *    "5 novas pendências", com a mesma `tag` — a bandeja do sistema substitui o
 *    aviso anterior em vez de empilhar.
 *
 *  · A memória do que já foi avisado é POR PESSOA e sobrevive ao recarregar a
 *    página (`localStorage`). Trocar de usuário no mesmo navegador não pode
 *    fazer o novo herdar os avisos do anterior, e um F5 não pode reavisar tudo.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/store/auth";
import { useMinhasPendencias } from "@/store/pendencias";
import { rotaDaPendencia } from "@/domain/pendencias";
import { notificar, permissaoAtual } from "@/lib/notificacoes";

/** Chave do que já foi avisado — uma por pessoa. */
const chave = (pessoa: string) => `polobh:pendencias-avisadas:${pessoa}`;

/** Teto do que fica guardado: evita a chave crescer para sempre. */
const MAX_LEMBRADAS = 500;

function lidas(pessoa: string): Set<string> {
  try {
    const cru = localStorage.getItem(chave(pessoa));
    return new Set<string>(cru ? (JSON.parse(cru) as string[]) : []);
  } catch {
    // localStorage bloqueado (janela anônima, política do navegador): o recurso
    // simplesmente não avisa, em vez de quebrar a tela.
    return new Set();
  }
}

function guardar(pessoa: string, ids: Set<string>): void {
  try {
    localStorage.setItem(chave(pessoa), JSON.stringify([...ids].slice(-MAX_LEMBRADAS)));
  } catch {
    /* idem */
  }
}

export function useAvisosPendencias(): void {
  const pessoa = useAuth((s) => s.usuario?.nome) ?? "";
  const { itens } = useMinhasPendencias();
  /** Já registramos o marco zero desta sessão para esta pessoa? */
  const iniciado = useRef("");

  useEffect(() => {
    if (!pessoa || permissaoAtual() !== "concedida") return;

    const atuais = itens.map((p) => p.id);
    const jaAvisadas = lidas(pessoa);

    // Marco zero: primeira carga desta pessoa nesta sessão. Guarda e cala.
    if (iniciado.current !== pessoa) {
      iniciado.current = pessoa;
      // Só entra no marco zero quem a carga já trouxe; a lista vazia do primeiro
      // render (antes de o store carregar) não pode zerar a memória.
      if (!atuais.length) return;
      guardar(pessoa, new Set([...jaAvisadas, ...atuais]));
      return;
    }

    const novas = itens.filter((p) => !jaAvisadas.has(p.id));
    if (!novas.length) return;

    const primeira = novas[0];
    void notificar({
      titulo: novas.length === 1 ? "Nova pendência" : `${novas.length} novas pendências`,
      corpo:
        novas.length === 1
          ? primeira.titulo
          : `${primeira.titulo} — e mais ${novas.length - 1}.`,
      // Uma pendência leva ao lugar dela; várias levam ao painel de projetos.
      url: novas.length === 1 ? rotaDaPendencia(primeira) : "/projetos",
      tag: "polobh-pendencias",
    });

    guardar(pessoa, new Set([...jaAvisadas, ...atuais]));
  }, [pessoa, itens]);
}
