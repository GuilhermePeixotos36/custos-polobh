/**
 * Realtime: o app se atualiza quando OUTRA pessoa mexe em alguma coisa.
 *
 * Antes disto, a tela de quem estava com o app aberto só sabia do mundo quando
 * ela mesma navegava ou quando o relógio de 3 minutos batia. Duas pessoas
 * trabalhando no mesmo projeto viam versões diferentes da verdade por minutos
 * — e o aviso de "pendência nova" chegava com esse atraso.
 *
 * Duas decisões que valem mais que o código:
 *
 * 1. O EVENTO É SÓ UM SINAL. O payload do Realtime é ignorado por completo; o
 *    que o app faz é recarregar pelo caminho de sempre, que passa pelas views e
 *    pela RLS. Aplicar o payload direto na tela seria criar uma segunda fonte
 *    de verdade, com regras próprias de quem-vê-o-quê — e é exatamente por aí
 *    que um valor restrito escapa. Aqui, um evento de algo que a pessoa não
 *    pode ler simplesmente não muda nada na tela dela.
 *
 * 2. UMA RAJADA VIRA UMA CONSULTA. Salvar uma EC de trinta itens dispara um
 *    evento por escrita. Sem juntar, seriam trinta recargas da base inteira
 *    para uma única ação de uma pessoa — o Realtime viraria o problema que veio
 *    resolver. O respiro curto agrupa a rajada; o store ainda tem a janela de
 *    silêncio dele por baixo.
 *
 * O relógio de `useMonitorPendencias` CONTINUA existindo, e não é redundância:
 * socket cai, rede oscila, aba dorme. O Realtime é o caminho rápido; o relógio
 * é a garantia de que, mesmo sem ele, a tela não passa do intervalo sem se
 * atualizar.
 */
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePendencias } from "@/store/pendencias";

/**
 * As tabelas que valem como sinal. `ec_linhas` NÃO está aqui de propósito — ver
 * a migração `20260830120000_realtime_publicacao`: a RLS da tabela base não
 * esconde o BV (quem esconde é a view), e publicar mandaria esse valor para o
 * socket de todo mundo. Mudança em linha chega como evento de `ecs`, porque
 * `salvar_ec_completa` atualiza a EC junto.
 */
const TABELAS = ["projetos", "ecs", "oss", "checklists", "checklist_itens", "credenciamentos"] as const;

/** Respiro para agrupar a rajada de eventos de um único salvamento. */
const AGRUPAR_MS = 800;

export function useRealtimePendencias(ativo: boolean): void {
  const carregar = usePendencias((s) => s.carregar);

  useEffect(() => {
    if (!ativo) return;

    let agendado: number | undefined;
    const pedirRecarga = () => {
      window.clearTimeout(agendado);
      // `force`: a mudança acabou de acontecer, e é justamente a janela de
      // silêncio do store que faria esta recarga — a que importa — não sair.
      agendado = window.setTimeout(() => void carregar(true), AGRUPAR_MS);
    };

    /*
     * O Realtime é um ATALHO: se ele não abrir, a tela segue pelo relógio.
     * Por isso nada aqui pode derrubar a tela. O Safari do iPhone recusava o
     * WebSocket ("The operation is insecure") — a política de segurança só
     * liberava `https:` — e o erro subia até a tela de falha, em todas as
     * telas, para quem estava no celular (12/10/2026).
     */
    let canal: ReturnType<typeof supabase.channel> | null = null;
    try {
      canal = supabase.channel("polobh-mudancas");
      for (const table of TABELAS) {
        canal.on("postgres_changes", { event: "*", schema: "public", table }, pedirRecarga);
      }
      canal.subscribe((status) => {
        // Sem isto, o Realtime cair é INVISÍVEL: a tela continua funcionando
        // (o relógio segura), e ninguém descobre que o caminho rápido morreu.
        // O token do socket, por exemplo, expira junto com a sessão.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn(`[realtime] canal ${status} — a tela segue atualizando pelo relógio de 3 min.`);
        }
      });
    } catch (erro) {
      console.warn("[realtime] indisponível neste navegador — a tela segue atualizando pelo relógio.", erro);
    }

    return () => {
      window.clearTimeout(agendado);
      if (canal) {
        try {
          void supabase.removeChannel(canal).catch(() => undefined);
        } catch {
          /* o canal nunca abriu */
        }
      }
    };
  }, [ativo, carregar]);
}
