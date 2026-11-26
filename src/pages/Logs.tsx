/**
 * LOGS — Atividades, Acessos e Erros (padrão de Logs, 26/11/2026).
 *
 * Só consulta: filtro, página, ordenação e total são feitos no banco (`consultar_logs`), que também
 * confere quem pode ver (`admin.logs` · ver). A trilha antiga (`audit_log`) vem unida na consulta.
 * Tudo o que vem do log é TEXTO: nada de HTML, Markdown ou link.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { SubGuias } from "@/components/layout/SubGuias";
import { Badge, Button, Card, EmptyState, Input, Select, Table, THead, Th, Tr, Td, type Tom } from "@/components/ui";
import { IcDownload, IcFechar, IcSearch } from "@/components/icons";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { baixarArquivo } from "@/lib/logs/baixarArquivo";
import { csvDosLogs, dataHoraBr, detalheComoTexto, nomeDoCsv } from "@/lib/logs/csv";
import {
  ABAS_LOGS, antesEDepois, coletarParaExportar, consultarLogs, filtrosAtivos, filtrosIniciais, hojeISO, addDias,
  limitarPeriodo, LogsIndisponiveis, opcoesDeTela, rotuloDaAcao, rotuloDaTela, ROTULO_NIVEL, ROTULO_ORIGEM_LOG,
  ROTULO_RESULTADO, POR_PAGINA, TETO_EXPORTACAO, type AbaLogs, type FiltrosLogs, type ItemLog, type RespostaDeLogs,
} from "@/lib/logs/logsStore";
import { supabase } from "@/lib/supabaseClient";

const TOM_RESULTADO: Record<string, Tom> = { ok: "success", negado: "warning", falha: "danger" };
const TOM_NIVEL: Record<string, Tom> = { info: "neutral", aviso: "warning", erro: "danger", critico: "danger" };

export function Logs() {
  const podeExportar = useAuth((s) => s.podeAcao)("admin.logs", "exportar");
  const [filtros, setFiltros] = useState<FiltrosLogs>(() => filtrosIniciais(hojeISO()));
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [resposta, setResposta] = useState<RespostaDeLogs>({ total: 0, itens: [] });
  const [carregando, setCarregando] = useState(true);
  const [primeira, setPrimeira] = useState(true);
  const [erro, setErro] = useState("");
  const [indisponivel, setIndisponivel] = useState(false);
  const [aberto, setAberto] = useState<ItemLog | null>(null);
  const [exportando, setExportando] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const pedido = useRef(0);

  useEffect(() => {
    void supabase.from("perfis").select("id, nome").order("nome").then(({ data }) => setUsuarios((data ?? []) as { id: string; nome: string }[]));
  }, []);

  // A busca vale depois de uma pausa na digitação.
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.busca === buscaDigitada ? f : { ...f, busca: buscaDigitada, pagina: 1 })), 400);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const carregar = useCallback(async (f: FiltrosLogs) => {
    const meu = ++pedido.current;
    setCarregando(true);
    try {
      const r = await consultarLogs(f);
      if (meu !== pedido.current) return; // uma consulta mais nova já está a caminho
      setResposta(r);
      setErro("");
    } catch (e) {
      if (meu !== pedido.current) return;
      if (e instanceof LogsIndisponiveis) setIndisponivel(true);
      else setErro(e instanceof Error ? e.message : "Não foi possível carregar os logs.");
    } finally {
      if (meu === pedido.current) {
        setCarregando(false);
        setPrimeira(false);
      }
    }
  }, []);

  useEffect(() => {
    void carregar(filtros);
  }, [filtros, carregar]);

  // Todo filtro volta para a página 1; a troca de página não.
  const mudar = (parcial: Partial<FiltrosLogs>) => setFiltros((f) => ({ ...f, pagina: 1, ...parcial }));
  const periodo = (dias: number) => {
    const fim = hojeISO();
    mudar({ inicio: addDias(fim, -(dias - 1)), fim });
  };
  const paginas = Math.max(1, Math.ceil(resposta.total / POR_PAGINA));
  const telas = useMemo(() => opcoesDeTela(), []);
  const ativos = filtrosAtivos(filtros);

  async function exportar() {
    if (exportando) return;
    setExportando(true);
    try {
      const { itens, total, cortou } = await coletarParaExportar(filtros, consultarLogs);
      const nome = nomeDoCsv(filtros.aba, filtros.inicio, filtros.fim);
      // Exportar a própria trilha é justamente o evento que precisa ficar: o helper o registra.
      baixarArquivo(new Blob([csvDosLogs(itens)], { type: "text/csv;charset=utf-8" }), nome, "Logs (CSV)");
      if (cortou) {
        toast(`Exportação cortada: foram exportadas só as primeiras ${TETO_EXPORTACAO.toLocaleString("pt-BR")} linhas de ${total.toLocaleString("pt-BR")}. Reduza o período ou use filtros para exportar o resto.`, "warning");
      }
    } catch {
      toast("Não foi possível exportar os logs.", "danger");
    } finally {
      setExportando(false);
    }
  }

  if (indisponivel) {
    return (
      <PageShell title="Logs">
        <Card><EmptyState title="Os logs ainda não estão disponíveis neste ambiente (a atualização do banco está pendente)." /></Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Logs"
      subtitle="Atividades, acessos e erros do aplicativo."
      subabas={
        <SubGuias<AbaLogs>
          rotulo="Logs"
          atual={filtros.aba}
          onChange={(aba) => mudar({ aba })}
          abas={ABAS_LOGS.map((a) => ({ key: a.value, label: a.label }))}
        />
      }
    >
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-end gap-2" aria-label="Período dos logs">
              <label className="text-[12px] font-semibold text-ink-2">
                De
                <Input type="date" className="w-[150px]" value={filtros.inicio} max={filtros.fim}
                  onChange={(e) => mudar(limitarPeriodo(e.target.value || filtros.inicio, filtros.fim))} />
              </label>
              <label className="text-[12px] font-semibold text-ink-2">
                Até
                <Input type="date" className="w-[150px]" value={filtros.fim} max={hojeISO()}
                  onChange={(e) => mudar(limitarPeriodo(filtros.inicio, e.target.value || filtros.fim))} />
              </label>
              <div className="flex gap-1 pb-1">
                {[1, 7, 30].map((d) => (
                  <Button key={d} size="sm" variant="secondary" onClick={() => periodo(d)}>{d === 1 ? "Hoje" : `${d} dias`}</Button>
                ))}
              </div>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"><IcSearch width={16} height={16} /></span>
              <Input className="pl-9" aria-label="Buscar nos logs" placeholder="Buscar no texto" value={buscaDigitada} onChange={(e) => setBuscaDigitada(e.target.value)} />
            </div>
            {podeExportar && (
              <Button variant="text" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => void exportar()} disabled={exportando || !resposta.total}>
                {exportando ? "Exportando…" : "Exportar CSV"}
              </Button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            <Select value={filtros.usuarioId} onChange={(e) => mudar({ usuarioId: e.target.value })}>
              <option value="">Todos os usuários</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Select>
            <Select value={filtros.nivel} onChange={(e) => mudar({ nivel: e.target.value })}>
              <option value="">Todos os níveis</option>
              {Object.entries(ROTULO_NIVEL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Select>
            <Select value={filtros.resultado} onChange={(e) => mudar({ resultado: e.target.value })}>
              <option value="">Todos os resultados</option>
              {Object.entries(ROTULO_RESULTADO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Select>
            <Select value={filtros.origem} onChange={(e) => mudar({ origem: e.target.value })}>
              <option value="">Todas as origens</option>
              {Object.entries(ROTULO_ORIGEM_LOG).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Select>
            <Select value={filtros.tela} onChange={(e) => mudar({ tela: e.target.value })}>
              <option value="">Todas as telas</option>
              {telas.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </Select>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {filtros.correlacao && (
              <button type="button" onClick={() => mudar({ correlacao: "" })}><Badge tom="info">Mesma correlação · limpar</Badge></button>
            )}
            {ativos > 0 && (
              <Button size="sm" variant="text" onClick={() => mudar({ usuarioId: "", nivel: "", resultado: "", tela: "", origem: "", correlacao: "" })}>
                Limpar filtros
              </Button>
            )}
            <span className="ml-auto text-[12px] text-ink-3">{resposta.total.toLocaleString("pt-BR")} evento(s)</span>
          </div>
        </Card>

        <Card padded={false}>
          {primeira && carregando ? (
            <div className="p-8 text-center text-ink-3">Carregando logs…</div>
          ) : erro ? (
            <div className="p-8 text-center text-danger font-semibold" role="alert">{erro}</div>
          ) : resposta.itens.length === 0 ? (
            <div className="p-8"><EmptyState title="Nenhum evento neste período e com estes filtros." /></div>
          ) : (
            <div aria-busy={carregando} className={carregando ? "opacity-60" : undefined}>
              <Table>
                <THead>
                  <th
                    className="px-3 py-2 text-left text-[11.5px] font-bold uppercase tracking-wide text-ink-3 whitespace-nowrap cursor-pointer"
                    aria-sort={filtros.ordem === "em_desc" ? "descending" : "ascending"}
                    onClick={() => setFiltros((f) => ({ ...f, pagina: 1, ordem: f.ordem === "em_desc" ? "em_asc" : "em_desc" }))}
                  >
                    Data/hora {filtros.ordem === "em_desc" ? "↓" : "↑"}
                  </th>
                  <Th>Usuário</Th>
                  <Th>Ação</Th>
                  <Th>Alvo / tela</Th>
                  <Th>{filtros.aba === "erros" ? "Nível" : "Resultado"}</Th>
                  <Th>Origem</Th>
                  <Th>IP</Th>
                </THead>
                <tbody>
                  {resposta.itens.map((l) => {
                    const alvo = l.alvoRotulo || rotuloDaTela(l.tela) || l.mensagem || "—";
                    return (
                      <Tr key={l.id} onClick={() => setAberto(l)} className="cursor-pointer">
                        <Td className="whitespace-nowrap text-[12.5px] text-ink-2">
                          <button type="button" className="hover:underline" aria-label={`Abrir o evento de ${dataHoraBr(l.em)}`}
                            onClick={(e) => { e.stopPropagation(); setAberto(l); }}>
                            {dataHoraBr(l.em)}
                          </button>
                        </Td>
                        <Td className="text-[12.5px]">{l.atorNome || "—"}</Td>
                        <Td className="text-[12.5px] font-semibold text-ink">{rotuloDaAcao(l.acao)}</Td>
                        <Td className="text-[12.5px] text-ink-2 max-w-[360px]"><span className="block truncate" title={l.mensagem ?? undefined}>{alvo}</span></Td>
                        <Td>
                          {filtros.aba === "erros"
                            ? <Badge tom={TOM_NIVEL[l.nivel] ?? "neutral"}>{ROTULO_NIVEL[l.nivel] ?? l.nivel}</Badge>
                            : <Badge tom={TOM_RESULTADO[l.resultado] ?? "neutral"}>{ROTULO_RESULTADO[l.resultado] ?? l.resultado}</Badge>}
                        </Td>
                        <Td className="text-[12.5px] text-ink-2">{ROTULO_ORIGEM_LOG[l.origem ?? ""] ?? l.origem ?? "—"}</Td>
                        <Td className="text-[12.5px] text-ink-3">{l.ip || "—"}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
              <nav aria-label="Páginas" className="flex items-center justify-between px-4 py-3 text-[12.5px] text-ink-2">
                <span>{resposta.total.toLocaleString("pt-BR")} evento(s)</span>
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" disabled={filtros.pagina <= 1} onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina - 1 }))}>Página anterior</Button>
                  Página {filtros.pagina} de {paginas}
                  <Button size="sm" variant="secondary" disabled={filtros.pagina >= paginas} onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina + 1 }))}>Próxima página</Button>
                </span>
              </nav>
            </div>
          )}
        </Card>
      </div>
      {aberto && (
        <DetalheLog
          item={aberto}
          onClose={() => setAberto(null)}
          onCorrelacao={aberto.correlacao ? () => { mudar({ correlacao: aberto.correlacao ?? "" }); setAberto(null); } : undefined}
        />
      )}
    </PageShell>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{rotulo}</div>
      <div className="text-[13px] text-ink break-words">{valor || "—"}</div>
    </div>
  );
}

/** Popup "Detalhe do evento". Tudo como texto: o log também é escrito por quem nem entrou. */
function DetalheLog({ item, onClose, onCorrelacao }: { item: ItemLog; onClose: () => void; onCorrelacao?: () => void }) {
  const ad = antesEDepois(item);
  return createPortal(
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-label="Detalhe do evento" className="relative w-full max-w-[640px] bg-surface rounded-card-lg shadow-modal border border-border p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} title="Fechar" className="absolute right-3 top-3 rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5]">
          <IcFechar width={18} height={18} />
        </button>
        <h2 className="font-display text-lg font-bold">Detalhe do evento</h2>
        <p className="text-[13px] text-ink-2 mb-4">{rotuloDaAcao(item.acao)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data e hora" valor={dataHoraBr(item.em)} />
          <Campo rotulo="Usuário" valor={item.atorNome} />
          <Campo rotulo="Ação" valor={rotuloDaAcao(item.acao)} />
          <Campo rotulo="Resultado" valor={ROTULO_RESULTADO[item.resultado] ?? item.resultado} />
          <Campo rotulo="Nível" valor={ROTULO_NIVEL[item.nivel] ?? item.nivel} />
          <Campo rotulo="Origem" valor={ROTULO_ORIGEM_LOG[item.origem ?? ""] ?? item.origem} />
          <Campo rotulo="Tela" valor={rotuloDaTela(item.tela)} />
          <Campo rotulo="Alvo" valor={[item.alvoTipo, item.alvoRotulo || item.alvoId].filter(Boolean).join(" · ")} />
          <Campo rotulo="IP" valor={item.ip} />
        </div>
        {item.mensagem && <div className="mt-4"><Campo rotulo="Mensagem" valor={item.mensagem} /></div>}
        {ad ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div><div className="text-[11px] font-bold uppercase text-ink-3">Antes</div><pre className="mt-1 whitespace-pre-wrap break-words rounded-btn bg-[#F5F6F8] p-2 text-[11.5px]">{detalheComoTexto(ad.antes)}</pre></div>
            <div><div className="text-[11px] font-bold uppercase text-ink-3">Depois</div><pre className="mt-1 whitespace-pre-wrap break-words rounded-btn bg-[#F5F6F8] p-2 text-[11.5px]">{detalheComoTexto(ad.depois)}</pre></div>
          </div>
        ) : item.detalhe ? (
          <div className="mt-4"><div className="text-[11px] font-bold uppercase text-ink-3">Detalhe</div><pre className="mt-1 whitespace-pre-wrap break-words rounded-btn bg-[#F5F6F8] p-2 text-[11.5px]">{detalheComoTexto(item.detalhe)}</pre></div>
        ) : null}
        {item.userAgent && <div className="mt-4"><Campo rotulo="Navegador (user-agent)" valor={item.userAgent} /></div>}
        <div className="mt-5 flex justify-end gap-2">
          {onCorrelacao && <Button variant="secondary" onClick={onCorrelacao}>Ver eventos da mesma correlação</Button>}
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
