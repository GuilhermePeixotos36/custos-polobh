import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Card,
  Badge,
  Button,
  Table,
  THead,
  Th,
  Tr,
  Td,
  Input,
  EmptyState,
  tomStatusEc,
} from "@/components/ui";
import { IcPlus, IcSearch } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { calcularTotais } from "@/domain/calc";
import { brl, cx, dataBR } from "@/lib/format";
import { useAuth } from "@/store/auth";
import type { StatusEc } from "@/data/types";

const STATUS: (StatusEc | "Todas")[] = [
  "Todas",
  "Rascunho",
  "Aguardando",
  "Aprovada",
  "Reprovada",
  "Cancelada",
  "Arquivada",
];

export function EcList() {
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const { data, loading } = useAsync(() => repo.ecs.listar(), []);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<(typeof STATUS)[number]>("Todas");

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data ?? [])
      .filter((e) => (filtro === "Todas" ? true : e.status === filtro))
      .filter((e) =>
        !q
          ? true
          : [e.numero, e.cliente.nome, e.projeto.titulo, e.responsavel]
              .join(" ")
              .toLowerCase()
              .includes(q)
      )
      .sort((a, b) => +new Date(b.atualizadoEm) - +new Date(a.atualizadoEm));
  }, [data, busca, filtro]);

  return (
    <PageShell
      breadcrumb={<Crumb>Estimativas (EC)</Crumb>}
      title="Estimativas de Custo"
      subtitle="Crie, edite, duplique e acompanhe as ECs."
      topAction={
        pode("ecs.editar") && (
          <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => navigate("/estimativas/nova")}>
            Nova EC
          </Button>
        )
      }
    >
      <Card padded={false}>
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-border-soft">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
              <IcSearch width={16} height={16} />
            </span>
            <Input
              className="!h-10 pl-9"
              placeholder="Buscar por número, cliente, evento, responsável…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS.map((s) => (
              <button
                key={s}
                onClick={() => setFiltro(s)}
                className={cx(
                  "h-9 px-3 rounded-pill text-[12.5px] font-bold border transition-colors",
                  filtro === s
                    ? "bg-primary-soft border-active-border text-primary-dark"
                    : "bg-surface border-border text-ink-2 hover:text-ink"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-ink-3 text-sm">Carregando…</div>
        ) : lista.length === 0 ? (
          <EmptyState
            title="Nenhuma EC encontrada"
            hint="Ajuste a busca/filtros ou crie uma nova estimativa."
          />
        ) : (
          <Table>
            <THead>
              <Th>Número / Evento</Th>
              <Th>Cliente</Th>
              <Th>Responsável</Th>
              <Th align="center">Versão</Th>
              <Th align="right">Valor total</Th>
              <Th align="center">Status</Th>
            </THead>
            <tbody>
              {lista.map((e) => {
                const t = calcularTotais(e.linhas, e.producao);
                return (
                  <Tr key={e.id} onClick={() => navigate(`/estimativas/${e.id}`)}>
                    <Td>
                      <div className="font-bold text-ink">{e.projeto.titulo}</div>
                      <div className="text-[12px] text-ink-2">{e.numero}</div>
                    </Td>
                    <Td>{e.cliente.nome}</Td>
                    <Td>{e.responsavel}</Td>
                    <Td align="center">
                      <span className="font-bold">V{String(e.versao).padStart(2, "0")}</span>
                    </Td>
                    <Td align="right" className="font-display font-bold">
                      {brl(t.valorTotalBruto)}
                    </Td>
                    <Td align="center">
                      <Badge tom={tomStatusEc[e.status]}>{e.status}</Badge>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="text-[12px] text-ink-3 mt-3">
        {lista.length} estimativa(s) · atualizado em {dataBR(new Date().toISOString())}
      </p>
    </PageShell>
  );
}
