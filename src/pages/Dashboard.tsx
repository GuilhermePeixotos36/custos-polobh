import { useNavigate } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import type { ReactNode } from "react";
import { Card, CardTitle, Badge, tomStatusEc, Button } from "@/components/ui";
import { IcPlus, IcDoc, IcClock, IcClipboard, IcTrend } from "@/components/icons";
import { cx } from "@/lib/format";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { calcularTotais } from "@/domain/calc";
import { brl, dataBR } from "@/lib/format";
import { useAuth } from "@/store/auth";
import type { Ec } from "@/data/types";

function ecTotal(ec: Ec) {
  return calcularTotais(ec.linhas, ec.producao).valorTotalBruto;
}

export function Dashboard() {
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const ecs = useAsync(() => repo.ecs.listar(), []);
  const oss = useAsync(() => repo.oss.listar(), []);

  const lista = ecs.data ?? [];
  const ativas = lista.filter((e) => !["Cancelada", "Arquivada"].includes(e.status));
  const aguardando = lista.filter((e) => e.status === "Aguardando");
  const emitidas = (oss.data ?? []).filter((o) => o.status !== "Rascunho");
  const faturamento = lista
    .filter((e) => e.status === "Aprovada")
    .reduce((s, e) => s + ecTotal(e), 0);

  // ECs por mês (gráfico simples)
  const porMes = new Map<string, number>();
  for (const e of lista) {
    const m = new Date(e.criadoEm).toLocaleDateString("pt-BR", { month: "short" });
    porMes.set(m, (porMes.get(m) ?? 0) + 1);
  }
  const meses = [...porMes.entries()];
  const maxMes = Math.max(1, ...meses.map(([, v]) => v));

  const kpis = [
    { label: "ECs ativas", valor: ativas.length, hint: "em andamento", icon: <IcDoc />, tom: "orange" as const },
    { label: "Aguardando aprovação", valor: aguardando.length, hint: "pendentes", icon: <IcClock />, tom: "amber" as const },
    { label: "OSs emitidas", valor: emitidas.length, hint: "fornecedores", icon: <IcClipboard />, tom: "blue" as const },
    ...(pode("financeiro")
      ? [{ label: "Faturamento previsto", valor: brl(faturamento), hint: "ECs aprovadas", icon: <IcTrend />, tom: "green" as const }]
      : []),
  ];

  return (
    <PageShell
      breadcrumb={<Crumb>Dashboard</Crumb>}
      title="Visão geral"
      subtitle="Resumo das estimativas e ordens de serviço da Pólobh."
      topAction={
        pode("ecs.editar") && (
          <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => navigate("/estimativas/nova")}>
            Nova EC
          </Button>
        )
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <CardTitle hint="Quantidade de estimativas criadas por mês">ECs por mês</CardTitle>
          {meses.length === 0 ? (
            <p className="text-ink-3 text-sm">Sem dados.</p>
          ) : (
            <div className="flex items-end gap-4 h-44 pt-4">
              {meses.map(([m, v]) => (
                <div key={m} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      className="w-9 rounded-t-[8px] bg-progress-grad"
                      style={{ height: `${(v / maxMes) * 100}%` }}
                      title={`${v} EC(s)`}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-ink-2 capitalize">{m}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle hint="Últimas estimativas movimentadas">Movimentações recentes</CardTitle>
          <div className="space-y-1">
            {ativas.slice(0, 5).map((e) => (
              <button
                key={e.id}
                onClick={() => navigate(`/estimativas/${e.id}`)}
                className="w-full text-left flex items-center justify-between gap-3 py-2.5 px-2 rounded-[10px] hover:bg-[#FAFAFB]"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-ink truncate">{e.projeto.titulo}</div>
                  <div className="text-[12px] text-ink-2 truncate">
                    {e.cliente.nome} · {dataBR(e.atualizadoEm)}
                  </div>
                </div>
                <Badge tom={tomStatusEc[e.status]}>{e.status}</Badge>
              </button>
            ))}
            {ativas.length === 0 && <p className="text-ink-3 text-sm">Nada por aqui ainda.</p>}
          </div>
        </Card>
      </div>
    </PageShell>
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
