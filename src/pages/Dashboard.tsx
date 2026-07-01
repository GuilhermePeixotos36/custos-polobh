import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import type { ReactNode } from "react";
import { Card, CardTitle, Badge, Button, EmptyState } from "@/components/ui";
import { IcPlus, IcDoc, IcClock, IcFolder, IcChevron } from "@/components/icons";
import { cx } from "@/lib/format";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { dataBR } from "@/lib/format";
import { useAuth } from "@/store/auth";

export function Dashboard() {
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const { data: projetos } = useAsync(() => repo.projetos.listar(), []);
  const { data: ecs } = useAsync(() => repo.ecs.listar(), []);
  const { data: oss } = useAsync(() => repo.oss.listar(), []);

  const listaProj = projetos ?? [];
  const listaEc = ecs ?? [];
  const listaOs = oss ?? [];

  const projetosAtivos = useMemo(() => listaProj.filter((p) => p.status === "Ativo"), [listaProj]);
  const ecsAtivas = useMemo(() => listaEc.filter((e) => !["Cancelada", "Arquivada"].includes(e.status)), [listaEc]);
  const aguardando = useMemo(() => listaEc.filter((e) => e.status === "Aguardando"), [listaEc]);

  // Nº de ECs (não canceladas) por projeto — para achar projetos sem estimativa.
  const ecsPorProjeto = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of listaEc) {
      if (["Cancelada", "Arquivada"].includes(e.status)) continue;
      m.set(e.projetoId, (m.get(e.projetoId) ?? 0) + 1);
    }
    return m;
  }, [listaEc]);

  // ---- Pendências acionáveis ----
  const projetosSemEc = useMemo(
    () => projetosAtivos.filter((p) => !ecsPorProjeto.get(p.id)),
    [projetosAtivos, ecsPorProjeto]
  );
  // ECs com linhas aprovadas p/ emitir OS (statusOs === "Emitir").
  const ecsComOsAEmitir = useMemo(
    () => ecsAtivas.filter((e) => e.linhas.some((l) => l.statusOs === "Emitir")),
    [ecsAtivas]
  );
  const ossRascunho = useMemo(() => listaOs.filter((o) => o.status === "Rascunho"), [listaOs]);

  const totalPendencias = projetosSemEc.length + aguardando.length + ecsComOsAEmitir.length + ossRascunho.length;

  const kpis = [
    { label: "Projetos ativos", valor: projetosAtivos.length, hint: "em andamento", icon: <IcFolder />, tom: "orange" as const },
    { label: "ECs ativas", valor: ecsAtivas.length, hint: "estimativas em curso", icon: <IcDoc />, tom: "blue" as const },
    { label: "Aguardando aprovação", valor: aguardando.length, hint: "ECs no cliente", icon: <IcClock />, tom: "amber" as const },
  ];

  return (
    <PageShell
      breadcrumb={<Crumb>Dashboard</Crumb>}
      title="Visão geral"
      subtitle="Acompanhe os projetos ativos e as pendências da Pólobh."
      topAction={
        pode("projetos") && (
          <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => navigate("/projetos/novo")}>
            Novo projeto
          </Button>
        )
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 items-start">
        {/* Projetos ativos */}
        <Card padded={false}>
          <div className="p-5 flex items-center justify-between">
            <CardTitle hint="Clique para abrir o projeto e suas subguias">Projetos ativos</CardTitle>
            <Button variant="secondary" size="sm" onClick={() => navigate("/projetos")}>Ver todos</Button>
          </div>
          {projetosAtivos.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhum projeto ativo" hint="Crie um projeto para começar." /></div>
          ) : (
            <div className="px-2 pb-2">
              {projetosAtivos.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/projetos/${p.id}`)}
                  className="w-full text-left flex items-center justify-between gap-3 py-3 px-3 rounded-[10px] hover:bg-[#FAFAFB]"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-ink truncate">{p.nome || p.info.titulo || "Projeto"}</div>
                    <div className="text-[12.5px] text-ink-2 truncate">
                      {p.cliente.nome || "Cliente"} · {dataBR(p.atualizadoEm || p.criadoEm)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tom="neutral">{ecsPorProjeto.get(p.id) ?? 0} EC</Badge>
                    <IcChevron width={16} height={16} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Pendências */}
        <Card padded={false}>
          <div className="p-5 flex items-center justify-between">
            <CardTitle hint="O que precisa de ação agora">Pendências</CardTitle>
            {totalPendencias > 0 && <Badge tom="warning">{totalPendencias}</Badge>}
          </div>
          {totalPendencias === 0 ? (
            <div className="p-6"><EmptyState title="Tudo em dia" hint="Nenhuma pendência no momento." /></div>
          ) : (
            <div className="px-2 pb-3 space-y-1">
              {projetosSemEc.map((p) => (
                <Pendencia
                  key={`pj-${p.id}`}
                  tom="orange"
                  titulo={`Projeto sem estimativa: ${p.nome || "Projeto"}`}
                  hint="Crie a primeira EC do projeto."
                  onClick={() => navigate(`/projetos/${p.id}`)}
                />
              ))}
              {aguardando.map((e) => (
                <Pendencia
                  key={`ag-${e.id}`}
                  tom="amber"
                  titulo={`EC aguardando aprovação: ${e.projeto.titulo || e.numero}`}
                  hint="Acompanhe o retorno do cliente."
                  onClick={() => navigate(`/estimativas/${e.id}`)}
                />
              ))}
              {ecsComOsAEmitir.map((e) => (
                <Pendencia
                  key={`os-${e.id}`}
                  tom="blue"
                  titulo={`OS a emitir: ${e.projeto.titulo || e.numero}`}
                  hint="Há itens aprovados marcados para emitir OS."
                  onClick={() => navigate(`/estimativas/${e.id}`)}
                />
              ))}
              {ossRascunho.map((o) => (
                <Pendencia
                  key={`or-${o.id}`}
                  tom="green"
                  titulo={`OS em rascunho: ${o.numero}`}
                  hint={`Finalize e dispare para ${o.fornecedor.razaoSocial || "o fornecedor"}.`}
                  onClick={() => navigate(`/ordens/${o.id}`)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

const tomPend: Record<"orange" | "amber" | "blue" | "green", string> = {
  orange: "bg-primary",
  amber: "bg-amber",
  blue: "bg-info",
  green: "bg-success",
};

function Pendencia({
  tom, titulo, hint, onClick,
}: { tom: "orange" | "amber" | "blue" | "green"; titulo: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 py-2.5 px-3 rounded-[10px] hover:bg-[#FAFAFB]"
    >
      <span className={cx("mt-1.5 h-2 w-2 rounded-full shrink-0", tomPend[tom])} />
      <div className="min-w-0">
        <div className="text-[13.5px] font-bold text-ink truncate">{titulo}</div>
        <div className="text-[12px] text-ink-2 truncate">{hint}</div>
      </div>
    </button>
  );
}

type Tom = "orange" | "amber" | "blue" | "green";

const tomStyles: Record<Tom, { card: string; chip: string; numero: string }> = {
  orange: {
    card: "bg-gradient-to-br from-[#FFF3E4] to-white border-[#F6DEC0]",
    chip: "bg-primary-grad text-[#2A1602]",
    numero: "text-ink",
  },
  amber: {
    card: "bg-gradient-to-br from-[#FBF3DC] to-white border-[#F0E3BB]",
    chip: "bg-[linear-gradient(135deg,#FBD27A,#E8A21C)] text-[#3A2A05]",
    numero: "text-ink",
  },
  blue: {
    card: "bg-gradient-to-br from-[#EBF1FE] to-white border-[#D6E2FB]",
    chip: "bg-[linear-gradient(135deg,#5B8DEF,#1B4FD1)] text-white",
    numero: "text-ink",
  },
  green: {
    card: "bg-gradient-to-br from-[#E6F6EE] to-white border-[#CDEAD9]",
    chip: "bg-[linear-gradient(135deg,#3FBE86,#0E7C50)] text-white",
    numero: "text-success",
  },
};

function KpiCard({
  label,
  valor,
  hint,
  icon,
  tom,
}: {
  label: string;
  valor: ReactNode;
  hint: string;
  icon: ReactNode;
  tom: Tom;
}) {
  const s = tomStyles[tom];
  return (
    <div
      className={cx(
        "rounded-card-lg border p-5 shadow-card flex flex-col gap-4 transition-shadow hover:shadow-[0_14px_30px_-16px_rgba(16,30,66,.28)]",
        s.card
      )}
    >
      <div className={cx("h-11 w-11 rounded-[13px] grid place-items-center shrink-0 shadow-sm", s.chip)}>
        {icon}
      </div>
      <div>
        <div className="text-[12.5px] font-bold text-ink-2">{label}</div>
        <div className={cx("font-display font-bold mt-1 tracking-[-1px] text-[clamp(22px,3vw,32px)] leading-none", s.numero)}>
          {valor}
        </div>
        <div className="text-[12px] mt-1.5 text-ink-3">{hint}</div>
      </div>
    </div>
  );
}
