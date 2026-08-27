import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, Badge, Table, THead, Tr, Td, Input, EmptyState, AvisoErro, ThOrd, useOrdenacao, tomStatusOs } from "@/components/ui";
import { IcSearch } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { brl, cx } from "@/lib/format";
import { ThPendencias, TdPendencias } from "@/components/ColunaPendencias";
import { ThItensOs, TdItensOs } from "@/components/ColunaItensOs";
import { itensDaOs } from "@/domain/os";
import { useMinhasPendencias } from "@/store/pendencias";
import { useAuth } from "@/store/auth";

type Filtro = "ativas" | "encerradas" | "todas";
/** OS encerrada sai da lista de trabalho — continua consultável pelos filtros. */
const ENCERRADAS = ["Cancelada", "Arquivada"];

export function OsList() {
  const navigate = useNavigate();
  const verFinanceiro = useAuth((s) => s.pode("financeiro"));
  const { data, loading, error, reload } = useAsync(() => repo.oss.listar(), [], { oQue: "as OSs" });
  // As ECs entram só para saber QUAIS ITENS cada OS carrega (o "olhinho" da
  // lista). Falha em silêncio: sem elas o atalho some, a lista continua.
  const { data: ecs } = useAsync(() => repo.ecs.listar().catch(() => []), []);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ativas");
  const { porOs } = useMinhasPendencias();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data ?? [])
      // Arquivada e cancelada continuam consultáveis, mas não no meio das ativas:
      // a lista abria com tudo junto e as OSs em andamento se perdiam.
      .filter((o) => (filtro === "todas" ? true : filtro === "ativas" ? !ENCERRADAS.includes(o.status) : ENCERRADAS.includes(o.status)))
      .filter((o) =>
        !q
          ? true
          : [o.numero, o.fornecedor.razaoSocial, o.fornecedor.nomeFantasia, o.fornecedor.cnpj, o.ecNumero, o.modalidade]
              .join(" ")
              .toLowerCase()
              .includes(q)
      );
  }, [data, busca, filtro]);

  /** Itens da EC que cada OS consolida — conteúdo da caixinha do "olhinho". */
  const itensPorOs = useMemo(() => {
    const mapa: Record<string, ReturnType<typeof itensDaOs>> = {};
    for (const o of data ?? []) mapa[o.id] = itensDaOs(o, ecs ?? []);
    return mapa;
  }, [data, ecs]);

  const { ordem, ordenarPor, ordenados: lista } = useOrdenacao(
    filtrados,
    {
      pendencias: (o) => porOs[o.id] ?? 0,
      numero: (o) => o.numero,
      fornecedor: (o) => o.fornecedor.razaoSocial,
      ec: (o) => o.ecNumero,
      modalidade: (o) => o.modalidade,
      valor: (o) => o.orcamento.valorEc,
      status: (o) => o.status,
    },
    { col: "numero", dir: "asc" }
  );

  return (
    <PageShell title="Ordens de Serviço" subtitle="OSs geradas a partir das estimativas, consolidadas por fornecedor.">
      <Card padded={false}>
        <div className="p-4 border-b border-border-soft flex items-center gap-3 flex-wrap">
          <div className="relative max-w-md flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><IcSearch width={16} height={16} /></span>
            <Input
              className="!h-10 pl-9"
              placeholder="Buscar por número, fornecedor, CNPJ, EC…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Filtrar OSs">
            {([["ativas", "Ativas"], ["encerradas", "Arquivadas/Canceladas"], ["todas", "Todas"]] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtro === valor}
                onClick={() => setFiltro(valor)}
                className={cx(
                  "h-8 rounded-pill px-3 text-[12.5px] font-bold transition-colors",
                  filtro === valor ? "bg-primary-soft text-primary-dark" : "text-ink-2 hover:bg-[#F1F2F5] hover:text-ink"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <AvisoErro erro={error} oQue="as OSs" onTentarDeNovo={reload} />
        ) : loading ? (
          <div className="p-8 text-ink-3 text-sm">Carregando…</div>
        ) : lista.length === 0 ? (
          <EmptyState title="Nenhuma OS" hint="Gere OSs a partir das linhas de uma EC." />
        ) : (
          <Table>
            <THead>
              <ThPendencias col="pendencias" ordem={ordem} onSort={ordenarPor} />
              <ThOrd col="numero" ordem={ordem} onSort={ordenarPor}>OS</ThOrd>
              {/* Sem rótulo: é o atalho para ver os itens, não uma coluna de dado. */}
              <ThItensOs />
              <ThOrd col="fornecedor" ordem={ordem} onSort={ordenarPor}>Fornecedor</ThOrd>
              <ThOrd col="ec" ordem={ordem} onSort={ordenarPor}>EC</ThOrd>
              <ThOrd col="modalidade" ordem={ordem} onSort={ordenarPor}>Modalidade</ThOrd>
              {verFinanceiro && <ThOrd col="valor" align="right" ordem={ordem} onSort={ordenarPor}>Valor EC</ThOrd>}
              <ThOrd col="status" align="center" ordem={ordem} onSort={ordenarPor}>Status</ThOrd>
            </THead>
            <tbody>
              {lista.map((o) => (
                <Tr key={o.id} onClick={() => navigate(`/ordens/${o.id}`)}>
                  <TdPendencias n={porOs[o.id] ?? 0} title="Esta OS tem ação pendente" />
                  <Td className="font-bold">{o.numero}</Td>
                  <TdItensOs itens={itensPorOs[o.id] ?? []} />
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
