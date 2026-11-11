/**
 * Liga o Web Push ao app aberto (11/11/2026).
 *
 *  1. Ao entrar, com as pendências e as permissões já carregadas, garante que
 *     ESTE aparelho está inscrito em nome de quem entrou (se a pessoa já deu a
 *     permissão de notificações). As pendências atuais vão junto: são o marco
 *     zero — o que já existia não vira aviso.
 *  2. A cada carga das pendências (tempo real, via `useRealtimePendencias`),
 *     repassa ao servidor as pendências de TODOS que têm aparelho inscrito. É
 *     isso que faz o aviso chegar ao celular da Marisa quando a Bárbara envia a
 *     OS para a Direção, com o app da Marisa fechado.
 */
import { useEffect, useRef } from "react";
import { PERMISSOES, useAuth } from "@/store/auth";
import type { Papel } from "@/data/types";
import { usePendencias, useMinhasPendencias } from "@/store/pendencias";
import { esquecerPessoasComPush, repassarPendencias, sincronizarInscricao } from "@/lib/push";

const padraoDoPapel = (papel: string) => PERMISSOES[papel as Papel] ?? [];

export function usePushPendencias(): void {
  const pessoa = useAuth((s) => s.usuario?.id) ?? "";
  const autenticando = useAuth((s) => s.carregando);
  const carregado = usePendencias((s) => s.ultimoLoad > 0);
  const todas = usePendencias((s) => s.itens);
  const { itens: minhas } = useMinhasPendencias();
  /** Para quem este aparelho já foi sincronizado nesta sessão. */
  const sincronizado = useRef("");
  const pronto = !!pessoa && carregado && !autenticando;

  // 1. Inscrição deste aparelho (uma vez por pessoa por sessão).
  useEffect(() => {
    if (!pronto || sincronizado.current === pessoa) return;
    sincronizado.current = pessoa;
    sincronizarInscricao(minhas.map((p) => p.id))
      .then((ok) => {
        if (!ok) return;
        esquecerPessoasComPush();
        void repassarPendencias(usePendencias.getState().itens, padraoDoPapel);
      })
      .catch((e) => console.warn("[push] inscrição indisponível:", (e as Error).message));
    // `minhas` entra só na primeira vez — é o marco zero, não um gatilho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, pessoa]);

  // 2. Repasse a cada carga.
  useEffect(() => {
    if (!pronto) return;
    void repassarPendencias(todas, padraoDoPapel);
  }, [pronto, todas]);
}
