/**
 * Tela Logs: abas, filtros, lista, detalhe e exportação (padrão LSPRO, 24/11/2026; contrato em
 * `telas.md` da skill `logs-padrao-lspro`, peças do design system do app).
 *
 * Recebe a consulta por prop (`consultar`) para poder ser montada sem banco. Tudo o que filtra,
 * pagina e ordena vai para o banco; a tela só guarda os filtros e mostra o que voltou. Não tem
 * editar, excluir, alerta nem atualização automática: o log é só de inserção e é consulta.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ScrollText, Search } from "lucide-react";
import { AvisoEmLinha } from "@/components/padrao/AvisoEmLinha";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { ComboBox } from "@/components/padrao/ComboBox";
import { EsqueletoTabela } from "@/components/padrao/EsqueletoTabela";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { FilterPills, filterControlClass } from "@/components/padrao/FilterPills";
import { FolderPanel, FolderTabsBar } from "@/components/padrao/FolderTabs";
import { Presenca } from "@/components/padrao/JanelaModal";
import { Selo } from "@/components/padrao/Selo";
import { Button } from "@/components/padrao/button";
import { cn } from "@/lib/utils";
import { baixarArquivo } from "@/lib/download";
import { csvDosLogs, nomeDoCsv } from "@/lib/logs/csv";
import {
  ABAS_LOGS, LogsIndisponiveis, ROTULO_NIVEL, ROTULO_ORIGEM_LOG, ROTULO_RESULTADO, TETO_EXPORTACAO,
  addDias, coletarParaExportar, filtrosAtivos, filtrosIniciais, hojeISO, limitarPeriodo, opcoesDeTela, periodoPadrao,
  semFiltrosDoPainel, type AbaLogs, type Consultar, type FiltrosLogs, type ItemLog, type RespostaDeLogs,
} from "@/lib/logs/logsStore";
import { confirmar } from "@/store/confirm";
import { DetalheLog } from "./DetalheLog";
import { TabelaLogs } from "./TabelaLogs";

const COLUNAS_ESQUELETO = ["Data/hora", "Usuário", "Ação", "Alvo / tela", "Resultado", "Origem", "IP"];

type Atalho = "1" | "7" | "30" | "";
const ATALHOS: { value: Atalho; label: string }[] = [
  { value: "1", label: "1 dia" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
];

export function TelaLogs({ consultar, podeExportar, carregarUsuarios, hoje: hojeProp }: {
  consultar: Consultar;
  /** Sem ela o botão "Exportar CSV" não aparece. */
  podeExportar: boolean;
  /** Usuários do filtro (id → nome). Sem ele, o filtro de usuário não aparece. */
  carregarUsuarios?: () => Promise<{ valor: string; rotulo: string }[]>;
  /** Hoje (aaaa-mm-dd); o teste fixa. */
  hoje?: string;
}) {
  const hoje = useMemo(() => hojeProp ?? hojeISO(), [hojeProp]);
  const [filtros, setFiltros] = useState<FiltrosLogs>(() => filtrosIniciais(hoje));
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [resposta, setResposta] = useState<RespostaDeLogs | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [indisponivel, setIndisponivel] = useState(false);
  const [aberto, setAberto] = useState<ItemLog | null>(null);
  const [exportando, setExportando] = useState(false);
  const [usuarios, setUsuarios] = useState<{ valor: string; rotulo: string }[]>([]);
  const pedido = useRef(0);

  useEffect(() => {
    if (!carregarUsuarios) return;
    let vivo = true;
    void carregarUsuarios().then((lista) => { if (vivo) setUsuarios(lista); });
    return () => { vivo = false; };
  }, [carregarUsuarios]);

  // A busca vale depois de uma pausa de 400 ms na digitação, e volta para a página 1.
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.busca === buscaDigitada ? f : { ...f, busca: buscaDigitada, pagina: 1 })), 400);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const carregar = useCallback(async (f: FiltrosLogs) => {
    const meu = ++pedido.current;
    setCarregando(true);
    try {
      const r = await consultar(f);
      if (meu !== pedido.current) return; // uma consulta mais nova já está a caminho
      setResposta(r);
      setErro("");
    } catch (e) {
      if (meu !== pedido.current) return;
      if (e instanceof LogsIndisponiveis) setIndisponivel(true);
      else setErro(e instanceof Error ? e.message : "Não foi possível carregar os logs.");
    } finally {
      if (meu === pedido.current) setCarregando(false);
    }
  }, [consultar]);

  useEffect(() => { void carregar(filtros); }, [filtros, carregar]);

  // Todo filtro volta para a página 1; a troca de página não.
  const mudar = (parcial: Partial<FiltrosLogs>) => setFiltros((f) => ({ ...f, pagina: 1, ...parcial }));

  function mudarPeriodo(inicio: string, fim: string) {
    const fimValido = !fim || fim > hoje ? hoje : fim;
    const inicioValido = !inicio || inicio > fimValido ? fimValido : inicio;
    mudar(limitarPeriodo(inicioValido, fimValido));
  }

  const atalho: Atalho = (["1", "7", "30"] as const).find((d) => {
    const p = periodoPadrao(hoje, Number(d));
    return p.inicio === filtros.inicio && p.fim === filtros.fim;
  }) ?? "";

  async function exportar() {
    if (exportando) return;
    setExportando(true);
    try {
      const { itens, total, cortou } = await coletarParaExportar(filtros, consultar);
      const nome = nomeDoCsv(filtros.aba, filtros.inicio, filtros.fim);
      // Exportar a própria trilha é justamente o evento que precisa ficar: o `baixarArquivo` o registra.
      baixarArquivo(nome, new Blob([csvDosLogs(itens)], { type: "text/csv;charset=utf-8" }), {
        detalhe: { aba: filtros.aba, linhas: itens.length, total },
      });
      if (cortou) {
        await confirmar({
          titulo: "Exportação cortada",
          mensagem: `Foram exportadas só as primeiras ${TETO_EXPORTACAO.toLocaleString("pt-BR")} linhas de ${total.toLocaleString("pt-BR")}. Reduza o período ou use filtros para exportar o resto.`,
          somenteOk: true,
          confirmarTexto: "Entendi",
        });
      }
    } catch {
      await confirmar({ titulo: "Não foi possível concluir", mensagem: "Não foi possível exportar os logs.", somenteOk: true, confirmarTexto: "Fechar" });
    } finally {
      setExportando(false);
    }
  }

  if (indisponivel) {
    return (
      <EstadoVazio
        icone={ScrollText}
        titulo="Os logs ainda não estão disponíveis neste ambiente (a atualização do banco está pendente)."
      />
    );
  }

  const total = resposta?.total ?? 0;
  const itens = resposta?.itens ?? [];
  const primeiraCarga = carregando && resposta === null;
  const ativos = filtrosAtivos(filtros);
  const comFiltro = ativos > 0 || filtros.busca.trim() !== "";
  const opcoesTela = opcoesDeTela();

  const limparTudo = () => {
    setBuscaDigitada("");
    setFiltros((f) => ({ ...semFiltrosDoPainel(f), busca: "", ...periodoPadrao(hoje) }));
  };

  const periodo = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período dos logs">
      <input
        type="date"
        aria-label="Início do período"
        value={filtros.inicio}
        max={filtros.fim}
        min={addDias(filtros.fim, -89)}
        onChange={(e) => mudarPeriodo(e.target.value, filtros.fim)}
        className={cn(filterControlClass, "tabular-nums")}
      />
      <span className="text-xs text-muted-foreground">a</span>
      <input
        type="date"
        aria-label="Fim do período"
        value={filtros.fim}
        min={filtros.inicio}
        max={hoje}
        onChange={(e) => mudarPeriodo(filtros.inicio, e.target.value)}
        className={cn(filterControlClass, "tabular-nums")}
      />
      <FilterPills<Atalho>
        ariaLabel="Atalhos de período"
        value={atalho}
        options={ATALHOS}
        onChange={(d) => d && mudar(periodoPadrao(hoje, Number(d)))}
      />
    </div>
  );

  return (
    <div>
      <FolderTabsBar<AbaLogs>
        value={filtros.aba}
        options={ABAS_LOGS}
        onChange={(aba) => mudar({ aba })}
        ariaLabel="Logs"
      />
      <FolderPanel semRecuo>
        <BarraFiltros
          busca={buscaDigitada}
          onBusca={setBuscaDigitada}
          placeholderBusca="Buscar no texto"
          rotuloBusca="Buscar nos logs"
          ativos={ativos}
          onLimpar={() => setFiltros((f) => semFiltrosDoPainel(f))}
          contagem={primeiraCarga || erro ? undefined : `${total} evento(s)`}
          className="movel:[&_button]:h-10 movel:[&_input]:h-10 movel:[&_select]:h-10"
          acoes={
            <>
              {periodo}
              {filtros.correlacao && (
                <button type="button" onClick={() => mudar({ correlacao: "" })} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                  <Selo tom="marca">Mesma correlação · limpar</Selo>
                </button>
              )}
              {podeExportar && (
                <Button variant="outline" size="sm" onClick={() => void exportar()} disabled={exportando || total === 0 || primeiraCarga}>
                  <Download aria-hidden /> {exportando ? "Exportando…" : "Exportar CSV"}
                </Button>
              )}
            </>
          }
        >
          {carregarUsuarios && (
            <ComboBox
              valor={filtros.usuarioId}
              opcoes={[{ valor: "", rotulo: "Todos os usuários" }, ...usuarios]}
              onChange={(usuarioId) => mudar({ usuarioId })}
              placeholder="Todos os usuários"
              aria-label="Filtrar por usuário"
              className="w-60 [&_input]:rounded-full"
            />
          )}
          <select aria-label="Filtrar por nível" value={filtros.nivel} onChange={(e) => mudar({ nivel: e.target.value })} className={filterControlClass}>
            <option value="">Todos os níveis</option>
            {Object.entries(ROTULO_NIVEL).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
          <select aria-label="Filtrar por resultado" value={filtros.resultado} onChange={(e) => mudar({ resultado: e.target.value })} className={filterControlClass}>
            <option value="">Todos os resultados</option>
            {Object.entries(ROTULO_RESULTADO).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
          <select aria-label="Filtrar por origem" value={filtros.origem} onChange={(e) => mudar({ origem: e.target.value })} className={filterControlClass}>
            <option value="">Todas as origens</option>
            {Object.entries(ROTULO_ORIGEM_LOG).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
          <ComboBox
            valor={filtros.tela}
            opcoes={[{ valor: "", rotulo: "Todas as telas" }, ...opcoesTela]}
            onChange={(tela) => mudar({ tela })}
            placeholder="Todas as telas"
            aria-label="Filtrar por tela"
            className="w-56 [&_input]:rounded-full"
          />
        </BarraFiltros>

        {resposta?.reserva && (
          <AvisoEmLinha tom="info" className="mx-4 mb-3">
            Os logs novos ainda não estão disponíveis neste ambiente (a atualização do banco está pendente). Por enquanto, a lista
            mostra a trilha de auditoria anterior.
          </AvisoEmLinha>
        )}
        {filtros.aba === "atividades" && resposta?.auditoriaIncluida === false && (
          <p className="mx-4 mb-3 text-xs text-muted-foreground">
            As alterações de cadastro (antes/depois) só aparecem para quem tem a permissão de Auditoria (hoje, o perfil Administrador).
          </p>
        )}

        {erro ? (
          <div className="px-4 pb-4">
            <AvisoEmLinha tom="erro">{erro}</AvisoEmLinha>
          </div>
        ) : primeiraCarga ? (
          <EsqueletoTabela colunas={COLUNAS_ESQUELETO} rotulo="Carregando logs…" />
        ) : itens.length === 0 ? (
          <EstadoVazio
            semCartao
            icone={comFiltro ? Search : ScrollText}
            titulo="Nenhum evento neste período e com estes filtros."
            acao={comFiltro ? <Button variant="outline" onClick={limparTudo}>Limpar filtros</Button> : undefined}
          />
        ) : (
          <TabelaLogs
            aba={filtros.aba}
            itens={itens}
            total={total}
            pagina={filtros.pagina}
            ordem={filtros.ordem}
            recarregando={carregando}
            onAbrir={setAberto}
            onAlternarOrdem={() => mudar({ ordem: filtros.ordem === "em_desc" ? "em_asc" : "em_desc" })}
            onPagina={(pagina) => setFiltros((f) => ({ ...f, pagina }))}
          />
        )}
      </FolderPanel>

      <Presenca valor={aberto}>
        {(item) => (
          <DetalheLog
            item={item}
            onFechar={() => setAberto(null)}
            onMesmaCorrelacao={(correlacao) => { setAberto(null); mudar({ correlacao }); }}
          />
        )}
      </Presenca>
    </div>
  );
}
