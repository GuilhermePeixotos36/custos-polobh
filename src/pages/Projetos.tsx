import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import { Card, Button, Badge, Table, THead, Th, Tr, Td, EmptyState, Avatar, type Tom } from "@/components/ui";
import { IcPlus, IcSearch } from "@/components/icons";
import { NotifDot } from "@/components/NotifDot";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useMinhasPendencias } from "@/store/pendencias";
import { cx } from "@/lib/format";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";
import type { StatusProjeto } from "@/data/types";

const tomStatusProjeto: Record<StatusProjeto, Tom> = {
  Ativo: "success",
  Arquivado: "neutral",
  Concluido: "info",
  Cancelado: "danger",
};

type FiltroProjeto = "Todos" | "Ativo" | "Arquivado";
const FILTROS: { key: FiltroProjeto; label: string }[] = [
  { key: "Todos", label: "Todos" },
  { key: "Ativo", label: "Ativos" },
  { key: "Arquivado", label: "Arquivados" },
];

export function Projetos() {
  const navigate = useNavigate();
  const { porProjeto } = useMinhasPendencias();
  const { data, loading } = useAsync(async () => {
    const [projetos, ecs] = await Promise.all([repo.projetos.listar(), repo.ecs.listar()]);
    return { projetos, ecs };
  }, []);
  const [filtro, setFiltro] = useState<FiltroProjeto>("Ativo");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.projetos ?? []).map((p) => ({ ...p, status: statusProjetoAutomatico(p, data?.ecs ?? []) }))
      // "Arquivados" agrupa tudo que não está Ativo (Arquivado/Concluído/Cancelado).
      .filter((p) => filtro === "Todos" || (filtro === "Ativo" ? p.status === "Ativo" : p.status !== "Ativo"))
      .filter((p) => !q || `${p.nome} ${p.cliente?.nome ?? ""}`.toLowerCase().includes(q));
  }, [data, filtro, busca]);

  return (
    <PageShell
      breadcrumb={<Crumb>Projetos</Crumb>}
      title="Projetos"
      subtitle="Tudo começa por um projeto: cliente, EC, OS, cronograma e fornecedores."
      topAction={
        <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => navigate("/projetos/novo")}>
          Novo projeto
        </Button>
      }
    >
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={cx(
                "h-9 px-3.5 rounded-btn text-[13px] font-bold border-[1.5px] transition-colors",
                filtro === f.key ? "bg-primary-soft border-active-border text-primary-dark" : "bg-surface border-[#D6D9E0] text-ink-2 hover:text-ink"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><IcSearch width={16} height={16} /></span>
          <input
            className="w-full h-10 bg-surface border-[1.5px] border-[#BFC4CE] rounded-btn pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 input-focus"
            placeholder="Buscar projeto ou cliente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <Card padded={false}>
        {loading ? (
          <div className="p-8 text-ink-3 text-sm">Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="p-8"><EmptyState title="Nenhum projeto" hint="Crie o primeiro projeto para começar." /></div>
        ) : (
          <Table>
            <THead>
              <Th>Cliente</Th>
              <Th>Projeto</Th>
              <Th align="center">Status</Th>
            </THead>
            <tbody>
              {lista.map((p) => (
                <Tr key={p.id} onClick={() => navigate(`/projetos/${p.id}`)}>
                  <Td className="text-ink-2">{p.cliente?.nome || "—"}</Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="relative shrink-0">
                        <Avatar nome={p.nome || "P"} size={34} />
                        <NotifDot n={porProjeto[p.id] ?? 0} title={`${porProjeto[p.id] ?? 0} pendência(s) neste projeto`} />
                      </span>
                      <div className="font-bold text-ink">{p.nome || "(sem título)"}</div>
                    </div>
                  </Td>
                  <Td align="center"><Badge tom={tomStatusProjeto[p.status]}>{p.status}</Badge></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}
