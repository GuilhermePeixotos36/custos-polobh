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
import { usePendencias } from "@/store/pendencias";
import { decidirAvisos, MAX_LEMBRADAS } from "@/domain/avisosPendencias";

/** Chave do que já foi avisado — uma por pessoa. */
const chave = (pessoa: string) => `polobh:pendencias-avisadas:${pessoa}`;

function lidas(pessoa: string): string[] {
  try {
    const cru = localStorage.getItem(chave(pessoa));
    return cru ? (JSON.parse(cru) as string[]) : [];
  } catch {
    // localStorage bloqueado (janela anônima, política do navegador): o recurso
    // simplesmente não avisa, em vez de quebrar a tela.
    return [];
  }
}

function guardar(pessoa: string, ids: string[]): void {
  try {
    localStorage.setItem(chave(pessoa), JSON.stringify(ids.slice(0, MAX_LEMBRADAS)));
  } catch {
    /* idem */
  }
}

export function useAvisosPendencias(): void {
  const pessoa = useAuth((s) => s.usuario?.nome) ?? "";
  /**
   * Só decide com os dados PRONTOS (11/11/2026): as pendências carregadas e as
   * permissões da área já lidas. Antes o marco zero era marcado no primeiro
   * render, com a lista ainda vazia — e a primeira carga de verdade, logo depois,
   * virava "N novas pendências". E com as permissões ainda no padrão do papel,
   * as pendências de etapa (que dependem da área) apareciam "novas" quando a
   * área terminava de carregar.
   */
  const carregado = usePendencias((s) => s.ultimoLoad > 0);
  const autenticando = useAuth((s) => s.carregando);
  const { itens } = useMinhasPendencias();
  /** Já registramos o marco zero desta sessão para esta pessoa? */
  const iniciado = useRef("");

  useEffect(() => {
    if (!pessoa || !carregado || autenticando || permissaoAtual() !== "concedida") return;

    const primeiraCarga = iniciado.current !== pessoa;
    iniciado.current = pessoa;
    const { novas: idsNovos, memoria } = decidirAvisos({
      jaAvisadas: lidas(pessoa),
      atuais: itens.map((p) => p.id),
      primeiraCarga,
    });
    guardar(pessoa, memoria);
    if (!idsNovos.length) return;

    const ids = new Set(idsNovos);
    const novas = itens.filter((p) => ids.has(p.id));
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
  }, [pessoa, itens, carregado, autenticando]);
}
