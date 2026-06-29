import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import { Card, Badge, Table, THead, Th, Tr, Td, Input, EmptyState, tomStatusOs } from "@/components/ui";
import { IcSearch } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { brl } from "@/lib/format";
import { useAuth } from "@/store/auth";

export function OsList() {
  const navigate = useNavigate();
  const verFinanceiro = useAuth((s) => s.pode("financeiro"));
  const { data, loading } = useAsync(() => repo.oss.listar(), []);
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data ?? []).filter((o) =>
      !q ? true : [o.numero, o.fornecedor.razaoSocial, o.ecNumero].join(" ").toLowerCase().includes(q)
    );
  }, [data, busca]);

  return (
    <PageShell breadcrumb={<Crumb>Ordens de Serviço</Crumb>} title="Ordens de Serviço" subtitle="OSs geradas a partir das estimativas, consolidadas por fornecedor.">
      <Card padded={false}>
        <div className="p-4 border-b border-border-soft">
          <div className="relative max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><IcSearch width={16} height={16} /></span>
            <Input className="!h-10 pl-9" placeholder="Buscar por número, fornecedor, EC…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-ink-3 text-sm">Carregando…</div>
        ) : lista.length === 0 ? (
          <EmptyState title="Nenhuma OS" hint="Gere OSs a partir das linhas de uma EC." />
        ) : (
          <Table>
            <THead>
              <Th>OS</Th>
              <Th>Fornecedor</Th>
              <Th>EC</Th>
              <Th>Modalidade</Th>
              {verFinanceiro && <Th align="right">Valor EC</Th>}
              <Th align="center">Status</Th>
            </THead>
            <tbody>
              {lista.map((o) => (
                <Tr key={o.id} onClick={() => navigate(`/ordens/${o.id}`)}>
                  <Td className="font-bold">{o.numero}</Td>
                  <Td>{o.fornecedor.razaoSocial}</Td>
                  <Td className="text-[12.5px] text-ink-2">{o.ecNumero}</Td>
                  <Td>{o.modalidade || "—"}</Td>
                  {verFinanceiro && <Td align="right" className="font-display font-bold">{brl(o.orcamento.valorEc)}</Td>}
                  <Td align="center"><Badge tom={tomStatusOs[o.status]}>{o.status}</Badge></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}
