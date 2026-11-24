/**
 * A lista de ECs dentro do projeto (sub-aba "EC"), no padrão de listas (24/11/2026).
 *
 * Saiu da `ProjetoDetail` para a tela do projeto só dizer ONDE a lista fica: o estado dela (busca,
 * pílula, filtros de coluna, ordem) é só dela, e a tela do projeto já tem estado demais.
 *
 * Colunas pedidas pelo dono do app: além do título e do status, **ID** (o número curto, #12),
 * **Versão** e **Data**. A Data é a do registro daquela versão (`criado_em`) — a mesma que o título
 * escreve no fim ("… (06) em 09 11 26"), porque `tituloEc` lê o mesmo campo.
 */
import { useDeferredValue, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";

import { Badge, Button, Table, Td, Tr } from "@/components/ui";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { FilterPills } from "@/components/padrao/FilterPills";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { CabecalhoDeColuna, useFiltrosDeColuna, type ColunaDeLista } from "@/components/padrao/CabecalhoDeColuna";
import { useOrdenacao } from "@/components/padrao/CabecalhoOrdenavel";
import { ordenarPorColuna, type ValorOrdenavel } from "@/components/padrao/ordenacaoTabela";
import { diaDoCarimbo, filtrarPorColunas, type ExtratoresDeFiltro } from "@/components/padrao/filtrosColuna";
import { SeloPendencias, filtroPendencias, formatarFiltroData, formatarFiltroId, textoId } from "./celulas";
import { tituloEc } from "@/domain/calc";
import { situacaoEc, ROTULO_SITUACAO_EC, TOM_SITUACAO_EC } from "@/domain/ec";
import { idAncoraPendencia } from "@/lib/destaque";
import { cx, dataBR } from "@/lib/format";
import type { Ec } from "@/data/types";

type FiltroEc = "todas" | "ativas" | "arquivadas";
const FILTROS: { value: FiltroEc; label: string }[] = [
  { value: "todas", label: "Todas" },
  // Sempre uma só: a estimativa que vale hoje (ver `domain/ec`).
  { value: "ativas", label: "Ativa" },
  // Todo o resto do projeto — versões anteriores e o que foi tirado do ar. É deste arquivo que
  // se importa de volta.
  { value: "arquivadas", label: "Arquivadas" },
];

const COLUNAS: ColunaDeLista[] = [
  { rotulo: "ID", chave: "id", tipo: "numero", classe: "whitespace-nowrap", formatarFiltro: formatarFiltroId },
  { rotulo: "Título da EC", chave: "titulo", tipo: "natural" },
  { rotulo: "Versão", chave: "versao", tipo: "numero", classe: "text-center", formatarFiltro: (v) => v.padStart(2, "0") },
  { rotulo: "Data", chave: "data", tipo: "data", classe: "whitespace-nowrap", formatarFiltro: formatarFiltroData },
  { rotulo: "Status", chave: "status", tipo: "texto", classe: "text-center" },
  { rotulo: "Pendências", chave: "pendencias", tipo: "numero", classe: "text-center" },
];

/** Desempate estável: versão mais nova primeiro, depois o id. */
const desempate = (a: Ec, b: Ec) => b.versao - a.versao || a.id.localeCompare(b.id);

export function ListaEcsDoProjeto({ ecs, porEc, onAbrir }: {
  /** As ECs DESTE projeto, todas as versões. */
  ecs: readonly Ec[];
  /** Pendências minhas por EC (`useMinhasPendencias`). */
  porEc: Record<string, number>;
  onAbrir: (ec: Ec) => void;
}) {
  const [filtro, setFiltro] = useState<FiltroEc>("todas");
  const [busca, setBusca] = useState("");
  const buscaAdiada = useDeferredValue(busca);
  const filtrosColuna = useFiltrosDeColuna();
  // Registro datado: a versão mais recente primeiro — que, na prática, é a que está no ar.
  const { ordem, ordenarPor } = useOrdenacao({ chave: "data", sentido: "desc" });

  const valoresOrdem: Record<string, (e: Ec) => ValorOrdenavel> = {
    id: (e) => e.codigo,
    titulo: (e) => tituloEc(e),
    versao: (e) => e.versao,
    data: (e) => e.criadoEm,
    status: (e) => ROTULO_SITUACAO_EC[situacaoEc(e)],
    pendencias: (e) => porEc[e.id] || null,
  };
  const valoresFiltro: ExtratoresDeFiltro<Ec> = {
    id: (e) => e.codigo,
    titulo: (e) => tituloEc(e),
    versao: (e) => e.versao,
    data: (e) => diaDoCarimbo(e.criadoEm),
    status: (e) => ROTULO_SITUACAO_EC[situacaoEc(e)],
    pendencias: (e) => filtroPendencias(porEc[e.id] ?? 0),
  };

  const base = useMemo(() => {
    const q = buscaAdiada.trim().toLowerCase();
    return ecs
      .filter((ec) => filtro === "todas" || (filtro === "ativas" ? ec.ativa : !ec.ativa))
      .filter((ec) => !q || `${ec.codigo != null ? `#${ec.codigo} ${ec.codigo}` : ""} ${tituloEc(ec)} ${ec.numero}`.toLowerCase().includes(q));
  }, [ecs, filtro, buscaAdiada]);

  const lista = ordenarPorColuna(filtrarPorColunas(base, filtrosColuna.filtros, valoresFiltro), COLUNAS, ordem, valoresOrdem, desempate);

  function limparTudo() {
    setBusca("");
    setFiltro("todas");
    filtrosColuna.limpar();
  }

  if (ecs.length === 0) {
    return <EstadoVazio semCartao icone={FileText} titulo="Nenhuma EC" descricao="Crie a primeira EC deste projeto." />;
  }

  return (
    <>
      <BarraFiltros
        busca={busca}
        onBusca={setBusca}
        placeholderBusca="ID ou título da EC"
        rotuloBusca="Buscar EC por ID ou título"
        contagem={`${lista.length} EC(s)`}
        acoes={<FilterPills value={filtro} options={FILTROS} onChange={setFiltro} ariaLabel="Filtrar estimativas" />}
        filtrosDeColuna={filtrosColuna.ativos}
        onLimpar={filtrosColuna.limpar}
        className="border-b border-border-soft movel:[&_input]:h-10"
      />
      {lista.length === 0 ? (
        <EstadoVazio
          semCartao
          icone={Search}
          titulo="Nenhuma EC encontrada."
          descricao="Nenhuma estimativa com essa situação, esses filtros ou essa busca."
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
            {lista.map((e) => (
              // O `id` é o endereço da linha para o navegador de pendências: na subguia EC a
              // pílula pisca a linha, e o detalhe (comentário, campo a emitir) fica para a tela da EC.
              <Tr key={e.id} id={idAncoraPendencia(e.id)} onClick={() => onAbrir(e)}>
                <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{textoId(e.codigo)}</Td>
                <Td>
                  {/* Botão de verdade: a linha abre pelo teclado também. */}
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); onAbrir(e); }}
                    className={cx(
                      "rounded-sm text-left font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                      e.ativa ? "text-brand-forte" : "text-ink",
                    )}
                  >
                    {tituloEc(e)}
                  </button>
                </Td>
                <Td align="center" className="tabular-nums">{String(e.versao).padStart(2, "0")}</Td>
                <Td className="whitespace-nowrap tabular-nums">{dataBR(e.criadoEm) || "—"}</Td>
                {/* Dois estados, e só: no ar ou no arquivo (ver `domain/ec`). */}
                <Td align="center">
                  <Badge tom={TOM_SITUACAO_EC[situacaoEc(e)]}>{ROTULO_SITUACAO_EC[situacaoEc(e)]}</Badge>
                </Td>
                <Td align="center"><SeloPendencias n={porEc[e.id] ?? 0} rotulo="ação(ões) pendente(s) sua(s) nesta EC" /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
