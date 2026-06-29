import { useMemo, useState } from "react";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import { Card, CardTitle, Button, Select, Badge, EmptyState, tomStatusOs } from "@/components/ui";
import { IcLink, IcCalendar } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { dataBR } from "@/lib/format";
import { Timeline } from "@/components/Timeline";

export function Cronogramas() {
  const { data: ecs } = useAsync(() => repo.ecs.listar(), []);
  const { data: oss } = useAsync(() => repo.oss.listar(), []);
  const [ecId, setEcId] = useState<string>("");
  const [copiado, setCopiado] = useState(false);

  const ecSel = (ecs ?? []).find((e) => e.id === ecId) ?? (ecs ?? [])[0];
  const ossDoProjeto = useMemo(
    () => (oss ?? []).filter((o) => o.ecId === ecSel?.id),
    [oss, ecSel]
  );

  const linkPublico = ecSel?.slugPublico ? `${location.origin}/cronograma/${ecSel.slugPublico}` : "";

  return (
    <PageShell
      breadcrumb={<Crumb>Cronogramas</Crumb>}
      title="Cronogramas consolidados"
      subtitle="Linha do tempo do projeto por fornecedor, com link público para envio."
      topAction={
        <div className="flex items-center gap-2">
          <Select className="!h-9 !w-auto min-w-[220px]" value={ecSel?.id ?? ""} onChange={(e) => setEcId(e.target.value)}>
            {(ecs ?? []).map((e) => <option key={e.id} value={e.id}>{e.projeto.titulo}</option>)}
          </Select>
          <Button
            size="sm"
            variant="secondary"
            icon={<IcLink width={15} height={15} />}
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
              Link público (sem login): <span className="text-primary-dark font-semibold">{linkPublico}</span>
            </div>
          </Card>

          {ossDoProjeto.length === 0 ? (
            <Card><EmptyState title="Nenhuma OS com cronograma" hint="Gere OSs para este projeto para montar a linha do tempo." /></Card>
          ) : (
            ossDoProjeto.map((o) => (
              <Card key={o.id}>
                <CardTitle action={<Badge tom={tomStatusOs[o.status]}>{o.status}</Badge>}>
                  {o.fornecedor.razaoSocial || "Fornecedor"} · {o.numero}
                </CardTitle>
                <Timeline itens={o.cronograma} />
              </Card>
            ))
          )}
        </div>
      )}
    </PageShell>
  );
}
