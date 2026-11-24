import { useDeferredValue, useMemo, useState } from "react";
import { valorDaContratacao } from "@/domain/contratacaoOs";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Card, Badge, Button, Table, Tr, Td, AvisoErro, tomStatusOs } from "@/components/ui";
import { FileText, Search } from "lucide-react";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { FilterPills } from "@/components/padrao/FilterPills";
import { EsqueletoTabela } from "@/components/padrao/EsqueletoTabela";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { CabecalhoDeColuna, useFiltrosDeColuna, type ColunaDeLista } from "@/components/padrao/CabecalhoDeColuna";
import { useOrdenacao } from "@/components/padrao/CabecalhoOrdenavel";
import { ordenarPorColuna, type ValorOrdenavel } from "@/components/padrao/ordenacaoTabela";
import { diaDoCarimbo, filtrarPorColunas, type ExtratoresDeFiltro } from "@/components/padrao/filtrosColuna";
import { SeloPendencias, filtroPendencias, formatarFiltroData, formatarFiltroId, textoId } from "@/components/listas/celulas";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { brl, dataBR } from "@/lib/format";
import { BotaoItensOs } from "@/components/ColunaItensOs";
import { itensDaOs } from "@/domain/os";
import { useMinhasPendencias } from "@/store/pendencias";
import { useAuth } from "@/store/auth";
import { rotuloNumeroEc } from "@/domain/calc";
import type { Os } from "@/data/types";

/** Os mesmos filtros da lista de ECs e da aba OS do projeto (29/09/2026). */
type Filtro = "todas" | "Ativa" | "Emitida" | "Arquivada";
const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "Ativa", label: "Ativa" },
  { value: "Emitida", label: "Emitida" },
  { value: "Arquivada", label: "Arquivada" },
];

/** Desempate estável: o ID simples (mais novo primeiro), depois o número e o id. */
const desempate = (a: Os, b: Os) =>
  (b.codigo ?? 0) - (a.codigo ?? 0) || a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }) || a.id.localeCompare(b.id);

export function OsList() {
  const navigate = useNavigate();
  const verFinanceiro = useAuth((s) => s.pode("financeiro"));
  const { data, loading, error, reload } = useAsync(() => repo.oss.listar(), [], { oQue: "as OSs" });
  // As ECs entram só para saber QUAIS ITENS cada OS carrega (o "olhinho" da
  // lista). Falha em silêncio: sem elas o atalho some, a lista continua.
  const { data: ecs } = useAsync(() => repo.ecs.listar().catch(() => []), []);
  const [busca, setBusca] = useState("");
  const buscaAdiada = useDeferredValue(busca);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const filtrosColuna = useFiltrosDeColuna();
  // Registro datado: o mais recente primeiro (padrão das listas, 24/11/2026).
  const { ordem, ordenarPor } = useOrdenacao({ chave: "data", sentido: "desc" });
  const { porOs } = useMinhasPendencias();

  /** Itens da EC que cada OS consolida — conteúdo da caixinha do "olhinho". */
  const itensPorOs = useMemo(() => {
    const mapa: Record<string, ReturnType<typeof itensDaOs>> = {};
    for (const o of data ?? []) mapa[o.id] = itensDaOs(o, ecs ?? []);
    return mapa;
  }, [data, ecs]);

  /**
   * Colunas (24/11/2026): ID, nome, Status, Fornecedor e Data, mais o que a lista geral já tinha
   * (EC, Modalidade, Valor). Os itens não têm mais coluna própria sem rótulo: o "olhinho" foi
   * para o canto direito da célula do nome.
   */
  const colunas: (ColunaDeLista | false)[] = [
    { rotulo: "ID", chave: "id", tipo: "numero", classe: "whitespace-nowrap", formatarFiltro: formatarFiltroId },
    { rotulo: "OS", chave: "numero", tipo: "natural" },
    { rotulo: "Status", chave: "status", tipo: "texto", classe: "text-center" },
    { rotulo: "Fornecedor", chave: "fornecedor", tipo: "texto" },
    { rotulo: "EC", chave: "ec", tipo: "natural" },
    { rotulo: "Modalidade", chave: "modalidade", tipo: "texto" },
    verFinanceiro && { rotulo: "Valor OS", chave: "valor", tipo: "numero", classe: "text-right", formatarFiltro: (v) => brl(Number(v)) },
    { rotulo: "Data", chave: "data", tipo: "data", classe: "whitespace-nowrap", formatarFiltro: formatarFiltroData },
    { rotulo: "Pendências", chave: "pendencias", tipo: "numero", classe: "text-center" },
  ];

  const valoresOrdem: Record<string, (o: Os) => ValorOrdenavel> = {
    id: (o) => o.codigo,
    numero: (o) => o.numero,
    status: (o) => o.status,
    fornecedor: (o) => o.fornecedor.razaoSocial,
    ec: (o) => rotuloNumeroEc(o.ecNumero),
    modalidade: (o) => o.modalidade,
    valor: (o) => valorDaContratacao(o.itens ?? []) || null,
    data: (o) => o.criadoEm,
    pendencias: (o) => porOs[o.id] || null,
  };
  const valoresFiltro: ExtratoresDeFiltro<Os> = {
    id: (o) => o.codigo,
    numero: (o) => o.numero,
    status: (o) => o.status,
    fornecedor: (o) => o.fornecedor.razaoSocial,
    ec: (o) => rotuloNumeroEc(o.ecNumero),
    modalidade: (o) => o.modalidade,
    // O valor cru na chave e em reais no rótulo; "a definir" (zero) é o vazio.
    valor: (o) => valorDaContratacao(o.itens ?? []) || null,
    data: (o) => diaDoCarimbo(o.criadoEm),
    pendencias: (o) => filtroPendencias(porOs[o.id] ?? 0),
  };

  /** A lista depois da busca e das pílulas — é dela que o painel de cada coluna tira os valores. */
  const base = useMemo(() => {
    const q = buscaAdiada.trim().toLowerCase();
    return (data ?? [])
      .filter((o) => filtro === "todas" || o.status === filtro)
      .filter((o) =>
        !q
          ? true
          : [o.codigo != null ? `#${o.codigo} ${o.codigo}` : "", o.numero, o.fornecedor.razaoSocial, o.fornecedor.nomeFantasia, o.fornecedor.cnpj, o.ecNumero, rotuloNumeroEc(o.ecNumero), o.modalidade]
              .join(" ")
              .toLowerCase()
              .includes(q)
      );
  }, [data, buscaAdiada, filtro]);

  const lista = ordenarPorColuna(filtrarPorColunas(base, filtrosColuna.filtros, valoresFiltro), colunas, ordem, valoresOrdem, desempate);

  function limparTudo() {
    setBusca("");
    setFiltro("todas");
    filtrosColuna.limpar();
  }

  return (
    <PageShell title="Ordens de Serviço" subtitle="OSs geradas a partir das estimativas, consolidadas por fornecedor.">
      <Card padded={false}>
        {/* Barra de filtros do padrão (24/11/2026): situação em pílulas, contagem e busca; os
            filtros de coluna somam no contador do botão "Filtros". */}
        <BarraFiltros
          busca={busca}
          onBusca={setBusca}
          placeholderBusca="Buscar por ID, número, fornecedor, CNPJ, EC…"
          larguraBusca="w-80"
          contagem={loading || error ? undefined : `${lista.length} OS(s)`}
          acoes={<FilterPills value={filtro} options={FILTROS} onChange={setFiltro} ariaLabel="Filtrar OSs" />}
          filtrosDeColuna={filtrosColuna.ativos}
          onLimpar={filtrosColuna.limpar}
          className="border-b border-border-soft movel:[&_input]:h-10"
        />
        {error ? (
          <AvisoErro erro={error} oQue="as OSs" onTentarDeNovo={reload} />
        ) : loading ? (
          <EsqueletoTabela
            colunas={colunas.filter((c): c is ColunaDeLista => Boolean(c)).map((c) => c.rotulo)}
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
              descricao="Nenhuma OS com essa situação, esses filtros ou essa busca."
              acao={<Button variant="secondary" onClick={limparTudo}>Limpar filtros</Button>}
            />
          )
        ) : (
          <Table>
            <CabecalhoDeColuna
              colunas={colunas}
              ordem={ordem}
              onOrdenar={ordenarPor}
              itens={base}
              valoresFiltro={valoresFiltro}
              filtros={filtrosColuna.filtros}
              onFiltros={filtrosColuna.setFiltros}
              grudado
            />
            <tbody>
              {lista.map((o) => (
                <Tr key={o.id} onClick={() => navigate(`/ordens/${o.id}`)}>
                  <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{textoId(o.codigo)}</Td>
                  <Td>
                    <span className="flex items-center justify-between gap-2">
                      {/* Botão de verdade: a linha abre pelo teclado também. */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/ordens/${o.id}`); }}
                        className="rounded-sm text-left font-bold hover:text-brand-forte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                      >
                        {o.numero}
                      </button>
                      <BotaoItensOs itens={itensPorOs[o.id] ?? []} />
                    </span>
                  </Td>
                  <Td align="center"><Badge tom={tomStatusOs[o.status]}>{o.status}</Badge></Td>
                  <Td>{o.fornecedor.razaoSocial}</Td>
                  <Td className="text-xs text-ink-2">{rotuloNumeroEc(o.ecNumero)}</Td>
                  <Td>{o.modalidade || "—"}</Td>
                  {verFinanceiro && <Td align="right" className="font-bold">{valorDaContratacao(o.itens ?? []) ? brl(valorDaContratacao(o.itens ?? [])) : "a definir"}</Td>}
                  <Td className="whitespace-nowrap tabular-nums">{dataBR(o.criadoEm) || "—"}</Td>
                  <Td align="center"><SeloPendencias n={porOs[o.id] ?? 0} rotulo="ação(ões) pendente(s) nesta OS" /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}
