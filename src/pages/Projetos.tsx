import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, Button, Badge, Table, THead, Tr, Td, EmptyState, AvisoErro, ThOrd, useOrdenacao, type Tom } from "@/components/ui";
import { IcPlus, IcSearch } from "@/components/icons";
import { ThPendencias, TdPendencias } from "@/components/ColunaPendencias";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useMinhasPendencias } from "@/store/pendencias";
import { useAuth } from "@/store/auth";
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
  const podeEditar = useAuth((s) => s.pode("projetos.editar"));
  const { porProjeto } = useMinhasPendencias();
  const { data, loading, error, reload } = useAsync(async () => {
    const [projetos, ecs] = await Promise.all([repo.projetos.listar(), repo.ecs.listar()]);
    return { projetos, ecs };
  }, [], { oQue: "os projetos" });
  const [filtro, setFiltro] = useState<FiltroProjeto>("Ativo");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.projetos ?? []).map((p) => ({ ...p, status: statusProjetoAutomatico(p, data?.ecs ?? []) }))
      // "Arquivados" agrupa tudo que não está Ativo (Arquivado/Concluído/Cancelado).
      .filter((p) => filtro === "Todos" || (filtro === "Ativo" ? p.status === "Ativo" : p.status !== "Ativo"))
      .filter((p) => !q || `${p.nome} ${p.cliente?.nome ?? ""}`.toLowerCase().includes(q));
  }, [data, filtro, busca]);

  const { ordem, ordenarPor, ordenados: lista } = useOrdenacao(
    filtrados,
    {
      pendencias: (p) => porProjeto[p.id] ?? 0,
      cliente: (p) => p.cliente?.nome,
      projeto: (p) => p.nome,
      status: (p) => p.status,
    },
    { col: "cliente", dir: "asc" }
  );

  return (
    <PageShell
      title="Projetos"
      topAction={
        podeEditar ? (
          <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => navigate("/projetos/novo")}>
            Novo projeto
          </Button>
        ) : undefined
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
        {error ? (
          <AvisoErro erro={error} oQue="os projetos" onTentarDeNovo={reload} />
        ) : loading ? (
          <div className="p-8 text-ink-3 text-sm">Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="p-8"><EmptyState title="Nenhum projeto" hint="Crie o primeiro projeto para começar." /></div>
        ) : (
          <Table>
            <THead>
              {/* Pendências em coluna própria: os badges ficam alinhados entre si e o
                  nome do projeto começa sempre na mesma posição. */}
              <ThPendencias col="pendencias" ordem={ordem} onSort={ordenarPor} />
              <ThOrd col="cliente" ordem={ordem} onSort={ordenarPor}>Cliente</ThOrd>
              <ThOrd col="projeto" ordem={ordem} onSort={ordenarPor}>Projeto</ThOrd>
              <ThOrd col="status" align="center" ordem={ordem} onSort={ordenarPor}>Status</ThOrd>
            </THead>
            <tbody>
              {lista.map((p) => (
                <Tr key={p.id} onClick={() => navigate(`/projetos/${p.id}`)}>
                  <TdPendencias n={porProjeto[p.id] ?? 0} title={`${porProjeto[p.id] ?? 0} pendência(s) neste projeto`} />
                  <Td className="text-ink font-medium">{p.cliente?.nome || "—"}</Td>
                  {/* Sem thumbnail: as iniciais não informavam nada e saíam quebradas em
                      títulos com travessão ("BM – Convenção…" virava "B–"). */}
                  <Td className="font-bold text-ink">{p.nome || "(sem título)"}</Td>
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
