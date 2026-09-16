/**
 * A conversa geral da EC — o "corredor" da estimativa.
 *
 * A EC já tinha conversa por ITEM: o acerto de um custo, com a pessoa certa.
 * Faltava o lugar de falar do evento inteiro — "@Marisa o cliente cortou o
 * coffee break" — antes de o assunto virar item de ninguém. É daqui que a
 * equipe se distribui: cada um pega o que é seu e vai tratar dentro do item.
 *
 * Grava sozinha, na hora, por caminho próprio (`repo.ecs.salvarObservacoes`):
 * comentar não é editar a estimativa. Uma mensagem não entra na trava de edição
 * de quem está mexendo nos custos, e um formulário aberto há meia hora não
 * sobrescreve o que foi dito nesse meio tempo.
 */
import { useEffect, useState } from "react";
import { CardConversa } from "@/components/CardConversa";
import { repo } from "@/data";
import { toast } from "@/store/toast";
import { usePendencias, useMinhasPendencias } from "@/store/pendencias";
import { ancoraObservacoesGeraisEc } from "@/domain/pendencias";
import type { Observacao } from "@/data/types";

export function ObservacoesGeraisEc({
  ecId,
  observacoes,
  usuarios,
}: {
  ecId: string;
  observacoes: Observacao[];
  usuarios: string[];
}) {
  const [lista, setLista] = useState<Observacao[]>(observacoes);
  const recarregarPendencias = usePendencias((s) => s.carregar);
  const { itens } = useMinhasPendencias();
  const minhas = itens.filter((p) => p.tipo === "ec.observacaoGeral" && p.ecId === ecId).length;

  // A EC pode chegar depois (a tela carrega em duas etapas) ou ser recarregada.
  useEffect(() => setLista(observacoes), [observacoes]);

  async function gravar(novas: Observacao[]) {
    const anteriores = lista;
    setLista(novas); // otimista: a conversa não pode ficar esperando o servidor
    try {
      setLista(await repo.ecs.salvarObservacoes(ecId, novas));
      // A bolinha de quem ficou com a vez acende (ou apaga) na hora.
      recarregarPendencias();
    } catch (e) {
      setLista(anteriores);
      toast(`Não foi possível salvar a observação: ${(e as Error).message}`, "danger");
    }
  }

  return (
    <CardConversa
      ancora={ancoraObservacoesGeraisEc(ecId)}
      observacoes={lista}
      usuarios={usuarios}
      minhas={minhas}
      onChange={gravar}
    />
  );
}
