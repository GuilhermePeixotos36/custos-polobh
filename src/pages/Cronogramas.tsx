import { nomeCurtoFornecedor } from "@/domain/fornecedor";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, CardTitle, Button, Select, Badge, EmptyState, tomStatusOs } from "@/components/ui";
import { IcLink, IcCalendar } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { dataBR } from "@/lib/format";
import { Timeline, TimelineConsolidada, type ItemConsolidado } from "@/components/Timeline";
import { urlCronogramaPublico } from "@/lib/links";
import { EnvioCronograma } from "@/components/EnvioCronograma";
import type { Ec } from "@/data/types";

/** EC encerrada não representa mais o projeto no seletor. */
const EC_ENCERRADA = ["Cancelada", "Arquivada"];

/** OS encerrada não entra na linha do tempo — o cronograma é do que vai acontecer. */
const OS_ENCERRADA = ["Cancelada", "Arquivada"];

export function Cronogramas() {
  const { data: ecs } = useAsync(() => repo.ecs.listar(), []);
  const { data: oss } = useAsync(() => repo.oss.listar(), []);
  const [ecId, setEcId] = useState<string>("");
  const [copiado, setCopiado] = useState(false);

  /**
   * O seletor é por PROJETO, não por EC.
   *
   * Listar todas as ECs punha o mesmo projeto várias vezes na lista, com o
   * mesmo rótulo (o título do projeto) — uma por versão, indistinguíveis —, e
   * ainda misturava EC cancelada e arquivada. Aqui cada projeto aparece uma
   * vez, representado pela EC ativa (ou a mais recente).
   */
  const opcoes = useMemo(() => {
    const porProjeto = new Map<string, Ec>();
    for (const e of ecs ?? []) {
      if (EC_ENCERRADA.includes(e.status)) continue;
      const chave = e.projetoId || e.id;
      const atual = porProjeto.get(chave);
      if (!atual || Number(e.ativa) - Number(atual.ativa) > 0 || (e.ativa === atual.ativa && e.versao > atual.versao)) {
        porProjeto.set(chave, e);
      }
    }
    return [...porProjeto.values()].sort((a, b) =>
      (a.projeto.titulo || a.numero).localeCompare(b.projeto.titulo || b.numero, "pt-BR")
    );
  }, [ecs]);

  const ecSel = opcoes.find((e) => e.id === ecId) ?? opcoes[0];
  /**
   * Todas as OSs do PROJETO, não só as da EC selecionada: uma OS emitida a
   * partir de uma versão anterior continua valendo para o evento, e sumia da
   * linha do tempo assim que a EC ganhava uma versão nova.
   */
  const ossDoProjeto = useMemo(() => {
    if (!ecSel) return [];
    const idsDoProjeto = new Set(
      (ecs ?? []).filter((e) => (ecSel.projetoId ? e.projetoId === ecSel.projetoId : e.id === ecSel.id)).map((e) => e.id)
    );
    return (oss ?? []).filter((o) => idsDoProjeto.has(o.ecId) && !OS_ENCERRADA.includes(o.status));
  }, [oss, ecs, ecSel]);

  // todas as etapas de todos os fornecedores, com o nome do fornecedor em cada uma
  const etapasConsolidadas = useMemo<ItemConsolidado[]>(
    () =>
      ossDoProjeto.flatMap((o) =>
        o.cronograma.map((c) => ({ ...c, fornecedor: nomeCurtoFornecedor(o.fornecedor) || "Fornecedor" }))
      ),
    [ossDoProjeto]
  );

  const linkPublico = ecSel ? urlCronogramaPublico(ecSel) : "";

  return (
    <PageShell
      title="Cronogramas consolidados"
      subtitle="Linha do tempo do projeto por fornecedor, com link público para envio."
      topAction={
        <div className="flex items-center gap-2 flex-wrap max-w-full">
          <Select className="h-9! w-auto! min-w-0 max-w-full sm:min-w-[220px]" value={ecSel?.id ?? ""} onChange={(e) => setEcId(e.target.value)}>
            {opcoes.map((e) => (
              <option key={e.id} value={e.id}>{e.projeto.titulo || e.numero}</option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="secondary"
            icon={<IcLink width={15} height={15} />}
            // Sem token gerado não há link: copiar string vazia dava a impressão
            // de que tinha funcionado.
            disabled={!linkPublico}
            title={linkPublico ? "Copiar o link público do cronograma" : "O link é gerado quando a EC é salva"}
            onClick={() => { navigator.clipboard?.writeText(linkPublico); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }}
          >
            {copiado ? "Copiado!" : "Copiar link público"}
          </Button>
        </div>
      }
    >
      {!ecSel ? (
        <Card><EmptyState title="Sem projetos" /></Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-primary"><IcCalendar /></span>
              <div>
                <h3 className="font-display font-bold text-ink">{ecSel.projeto.titulo}</h3>
                <p className="text-[12.5px] text-ink-2">{ecSel.cliente.nome} · Evento em {dataBR(ecSel.projeto.evento)}</p>
              </div>
            </div>
            <div className="mt-3 text-[12.5px] bg-bg rounded-btn px-3 py-2 text-ink-2 break-all">
              {linkPublico ? (
                <>Link público (sem login): <span className="text-primary-dark font-semibold">{linkPublico}</span></>
              ) : (
                <>Salve este projeto/EC para gerar o link público do cronograma.</>
              )}
            </div>
          </Card>

          {ossDoProjeto.length === 0 ? (
            <Card><EmptyState title="Nenhuma OS com cronograma" hint="Gere OSs para este projeto para montar a linha do tempo." /></Card>
          ) : (
            <>
              {/* Linha do tempo consolidada (todos os fornecedores) */}
              <Card>
                <CardTitle hint="Todas as etapas de todos os fornecedores em ordem cronológica">
                  Linha do tempo consolidada
                </CardTitle>
                <TimelineConsolidada itens={etapasConsolidadas} />
              </Card>

              {/* Disparo dos cronogramas — cada fornecedor recebe o seu. */}
              <EnvioCronograma oss={ossDoProjeto} ecs={ecs ?? []} />

              {/* Detalhe por fornecedor */}
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-ink-3 px-1 pt-1">Por fornecedor</div>
              {ossDoProjeto.map((o) => (
                <Card key={o.id}>
                  <CardTitle action={<Badge tom={tomStatusOs[o.status]}>{o.status}</Badge>}>
                    {nomeCurtoFornecedor(o.fornecedor) || "Fornecedor"} · {o.numero}
                  </CardTitle>
                  <Timeline itens={o.cronograma} />
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </PageShell>
  );
}
