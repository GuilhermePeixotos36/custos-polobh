import { useMemo, useState } from "react";
import { valorDaContratacao } from "@/domain/contratacaoOs";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, Badge, Button, Table, THead, Tr, Td, AvisoErro, ThOrd, useOrdenacao, tomStatusOs } from "@/components/ui";
import { FileText, Search } from "lucide-react";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { FilterPills } from "@/components/padrao/FilterPills";
import { EsqueletoTabela } from "@/components/padrao/EsqueletoTabela";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { brl } from "@/lib/format";
import { ThPendencias, TdPendencias } from "@/components/ColunaPendencias";
import { ThItensOs, TdItensOs } from "@/components/ColunaItensOs";
import { itensDaOs } from "@/domain/os";
import { useMinhasPendencias } from "@/store/pendencias";
import { useAuth } from "@/store/auth";
import { rotuloNumeroEc } from "@/domain/calc";

/** Os mesmos filtros da lista de ECs e da aba OS do projeto (29/09/2026). */
type Filtro = "todas" | "Ativa" | "Emitida" | "Arquivada";
const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "Ativa", label: "Ativa" },
  { value: "Emitida", label: "Emitida" },
  { value: "Arquivada", label: "Arquivada" },
];

export function OsList() {
  const navigate = useNavigate();
  const verFinanceiro = useAuth((s) => s.pode("financeiro"));
  const { data, loading, error, reload } = useAsync(() => repo.oss.listar(), [], { oQue: "as OSs" });
  // As ECs entram só para saber QUAIS ITENS cada OS carrega (o "olhinho" da
  // lista). Falha em silêncio: sem elas o atalho some, a lista continua.
  const { data: ecs } = useAsync(() => repo.ecs.listar().catch(() => []), []);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const { porOs } = useMinhasPendencias();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data ?? [])
      .filter((o) => filtro === "todas" || o.status === filtro)
      .filter((o) =>
        !q
          ? true
          : [o.numero, o.fornecedor.razaoSocial, o.fornecedor.nomeFantasia, o.fornecedor.cnpj, o.ecNumero, rotuloNumeroEc(o.ecNumero), o.modalidade]
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
      valor: (o) => valorDaContratacao(o.itens ?? []),
      status: (o) => o.status,
    },
    { col: "numero", dir: "asc" }
  );

  return (
    <PageShell title="Ordens de Serviço" subtitle="OSs geradas a partir das estimativas, consolidadas por fornecedor.">
      <Card padded={false}>
        {/* Barra de filtros do padrão (24/11/2026): situação em pílulas, contagem e busca. */}
        <BarraFiltros
          busca={busca}
          onBusca={setBusca}
          placeholderBusca="Buscar por número, fornecedor, CNPJ, EC…"
          larguraBusca="w-80"
          contagem={loading || error ? undefined : `${lista.length} OS(s)`}
          acoes={<FilterPills value={filtro} options={FILTROS} onChange={setFiltro} ariaLabel="Filtrar OSs" />}
          className="border-b border-border-soft movel:[&_input]:h-10"
        />
        {error ? (
          <AvisoErro erro={error} oQue="as OSs" onTentarDeNovo={reload} />
        ) : loading ? (
          <EsqueletoTabela
            colunas={["", "OS", "", "Fornecedor", "EC", "Modalidade", ...(verFinanceiro ? ["Valor OS"] : []), "Status"]}
            rotulo="Carregando as OSs…"
          />
        ) : lista.length === 0 ? (
          (data?.length ?? 0) === 0 ? (
            <EstadoVazio semCartao icone={FileText} titulo="Nenhuma OS" descricao="Gere OSs a partir das linhas de uma EC." />
          ) : (
            <EstadoVazio
              semCartao
              icone={Search}
              titulo="Nenhuma OS encontrada."
              descricao="Nenhuma OS com essa situação ou essa busca."
              acao={<Button variant="secondary" onClick={() => { setBusca(""); setFiltro("todas"); }}>Limpar filtros</Button>}
            />
          )
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
              {verFinanceiro && <ThOrd col="valor" align="right" ordem={ordem} onSort={ordenarPor}>Valor OS</ThOrd>}
              <ThOrd col="status" align="center" ordem={ordem} onSort={ordenarPor}>Status</ThOrd>
            </THead>
            <tbody>
              {lista.map((o) => (
                <Tr key={o.id} onClick={() => navigate(`/ordens/${o.id}`)}>
                  <TdPendencias n={porOs[o.id] ?? 0} title="Esta OS tem ação pendente" />
                  <Td className="font-bold">{o.numero}</Td>
                  <TdItensOs itens={itensPorOs[o.id] ?? []} />
                  <Td>{o.fornecedor.razaoSocial}</Td>
                  <Td className="text-xs text-ink-2">{rotuloNumeroEc(o.ecNumero)}</Td>
                  <Td>{o.modalidade || "—"}</Td>
                  {verFinanceiro && <Td align="right" className="font-bold">{valorDaContratacao(o.itens ?? []) ? brl(valorDaContratacao(o.itens ?? [])) : "a definir"}</Td>}
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
