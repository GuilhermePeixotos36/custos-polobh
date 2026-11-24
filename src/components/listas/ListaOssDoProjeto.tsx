/**
 * A lista de OSs dentro do projeto (sub-aba "OS"), no padrão de listas (24/11/2026).
 *
 * Mesmo motivo da `ListaEcsDoProjeto`: o estado da lista é só dela. Colunas pedidas pelo dono do
 * app: **ID**, nome, **Status**, **Fornecedor** e **Data** (o registro da OS, `criado_em`), mais
 * as pendências como coluna normal. Os itens da OS não têm mais coluna sem rótulo: o "olhinho"
 * mora no canto direito da célula do nome.
 */
import { useDeferredValue, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";

import { Badge, Button, Table, Td, Tr, tomStatusOs } from "@/components/ui";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { FilterPills } from "@/components/padrao/FilterPills";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { CabecalhoDeColuna, useFiltrosDeColuna, type ColunaDeLista } from "@/components/padrao/CabecalhoDeColuna";
import { useOrdenacao } from "@/components/padrao/CabecalhoOrdenavel";
import { ordenarPorColuna, type ValorOrdenavel } from "@/components/padrao/ordenacaoTabela";
import { diaDoCarimbo, filtrarPorColunas, type ExtratoresDeFiltro } from "@/components/padrao/filtrosColuna";
import { BotaoItensOs } from "@/components/ColunaItensOs";
import { SeloPendencias, filtroPendencias, formatarFiltroData, formatarFiltroId, textoId } from "./celulas";
import { nomeCurtoFornecedor } from "@/domain/fornecedor";
import { itensDaOs } from "@/domain/os";
import { idAncoraPendencia } from "@/lib/destaque";
import { dataBR } from "@/lib/format";
import type { Ec, Os, StatusOsDoc } from "@/data/types";

/**
 * Os mesmos filtros da lista de ECs (15/09/2026): a lista de OSs de um projeto cresce a cada
 * versão reemitida, e o que se procura quase sempre é "as que ainda não saíram" ou "a que foi
 * arquivada".
 */
type FiltroOs = "todas" | StatusOsDoc;
const FILTROS: { value: FiltroOs; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "Ativa", label: "Ativa" },
  { value: "Emitida", label: "Emitida" },
  { value: "Arquivada", label: "Arquivada" },
];

const COLUNAS: ColunaDeLista[] = [
  { rotulo: "ID", chave: "id", tipo: "numero", classe: "whitespace-nowrap", formatarFiltro: formatarFiltroId },
  { rotulo: "OS", chave: "numero", tipo: "natural" },
  { rotulo: "Status", chave: "status", tipo: "texto", classe: "text-center" },
  { rotulo: "Fornecedor", chave: "fornecedor", tipo: "texto" },
  { rotulo: "Data", chave: "data", tipo: "data", classe: "whitespace-nowrap", formatarFiltro: formatarFiltroData },
  { rotulo: "Pendências", chave: "pendencias", tipo: "numero", classe: "text-center" },
];

/** Desempate estável: ID mais novo primeiro, depois o número e o id. */
const desempate = (a: Os, b: Os) =>
  (b.codigo ?? 0) - (a.codigo ?? 0) || a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }) || a.id.localeCompare(b.id);

export function ListaOssDoProjeto({ oss, ecs, porOs, onAbrir }: {
  /** As OSs DESTE projeto (de todas as versões da EC). */
  oss: readonly Os[];
  /** Todas as ECs carregadas — só para saber quais itens cada OS consolida. */
  ecs: readonly Ec[];
  porOs: Record<string, number>;
  onAbrir: (os: Os) => void;
}) {
  const [filtro, setFiltro] = useState<FiltroOs>("todas");
  const [busca, setBusca] = useState("");
  const buscaAdiada = useDeferredValue(busca);
  const filtrosColuna = useFiltrosDeColuna();
  // Registro datado: o mais recente primeiro.
  const { ordem, ordenarPor } = useOrdenacao({ chave: "data", sentido: "desc" });

  /**
   * Itens da EC que cada OS consolida — o conteúdo da caixinha do "olhinho". Calculado uma vez
   * para todas, e não por linha: a busca é na lista inteira de ECs.
   */
  const itensPorOs = useMemo(() => {
    const mapa: Record<string, ReturnType<typeof itensDaOs>> = {};
    for (const o of oss) mapa[o.id] = itensDaOs(o, [...ecs]);
    return mapa;
  }, [oss, ecs]);

  const valoresOrdem: Record<string, (o: Os) => ValorOrdenavel> = {
    id: (o) => o.codigo,
    numero: (o) => o.numero,
    status: (o) => o.status,
    fornecedor: (o) => nomeCurtoFornecedor(o.fornecedor),
    data: (o) => o.criadoEm,
    pendencias: (o) => porOs[o.id] || null,
  };
  const valoresFiltro: ExtratoresDeFiltro<Os> = {
    id: (o) => o.codigo,
    numero: (o) => o.numero,
    status: (o) => o.status,
    fornecedor: (o) => nomeCurtoFornecedor(o.fornecedor),
    data: (o) => diaDoCarimbo(o.criadoEm),
    pendencias: (o) => filtroPendencias(porOs[o.id] ?? 0),
  };

  const base = useMemo(() => {
    const q = buscaAdiada.trim().toLowerCase();
    return oss
      .filter((o) => filtro === "todas" || o.status === filtro)
      .filter((o) => !q || [o.codigo != null ? `#${o.codigo} ${o.codigo}` : "", o.numero, o.fornecedor.razaoSocial, o.fornecedor.nomeFantasia, o.fornecedor.cnpj]
        .join(" ").toLowerCase().includes(q));
  }, [oss, filtro, buscaAdiada]);

  const lista = ordenarPorColuna(filtrarPorColunas(base, filtrosColuna.filtros, valoresFiltro), COLUNAS, ordem, valoresOrdem, desempate);

  function limparTudo() {
    setBusca("");
    setFiltro("todas");
    filtrosColuna.limpar();
  }

  if (oss.length === 0) {
    return <EstadoVazio semCartao icone={FileText} titulo="Nenhuma OS" descricao="Gere OSs a partir das ECs do projeto." />;
  }

  return (
    <>
      <BarraFiltros
        busca={busca}
        onBusca={setBusca}
        placeholderBusca="ID, número ou fornecedor"
        rotuloBusca="Buscar OS por ID, número ou fornecedor"
        contagem={`${lista.length} OS(s)`}
        acoes={<FilterPills value={filtro} options={FILTROS} onChange={setFiltro} ariaLabel="Filtrar ordens de serviço" />}
        filtrosDeColuna={filtrosColuna.ativos}
        onLimpar={filtrosColuna.limpar}
        className="border-b border-border-soft movel:[&_input]:h-10"
      />
      {lista.length === 0 ? (
        <EstadoVazio
          semCartao
          icone={Search}
          titulo="Nenhuma OS encontrada."
          descricao="Nenhuma ordem de serviço com essa situação, esses filtros ou essa busca."
          acao={<Button variant="secondary" onClick={limparTudo}>Limpar filtros</Button>}
        />
      ) : (
        <Table>
          <CabecalhoDeColuna
            colunas={COLUNAS}
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
              <Tr key={o.id} id={idAncoraPendencia(o.id)} onClick={() => onAbrir(o)}>
                <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{textoId(o.codigo)}</Td>
                <Td>
                  <span className="flex items-center justify-between gap-2">
                    {/* Botão de verdade: a linha abre pelo teclado também. */}
                    <button
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); onAbrir(o); }}
                      className="rounded-sm text-left font-bold hover:text-brand-forte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {o.numero}
                    </button>
                    <BotaoItensOs itens={itensPorOs[o.id] ?? []} />
                  </span>
                </Td>
                <Td align="center"><Badge tom={tomStatusOs[o.status]}>{o.status}</Badge></Td>
                <Td>{nomeCurtoFornecedor(o.fornecedor) || "—"}</Td>
                <Td className="whitespace-nowrap tabular-nums">{dataBR(o.criadoEm) || "—"}</Td>
                <Td align="center"><SeloPendencias n={porOs[o.id] ?? 0} rotulo="ação(ões) pendente(s) sua(s) nesta OS" /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
