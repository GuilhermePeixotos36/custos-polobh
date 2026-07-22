import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Card,
  CardTitle,
  Badge,
  Button,
  Table,
  THead,
  Th,
  Tr,
  Td,
  EmptyState,
  Eyebrow,
  AvisoEmailPendente,
  tomStatusEc,
  tomStatusOs,
  tomAprovacao,
} from "@/components/ui";
import { IcBack, IcCopy, IcDownload, IcPlus, IcChevron, IcSend } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { calcularTotais, agruparPorFornecedor, gastoPorLinhaViaOSs, tituloEc } from "@/domain/calc";
import { RentabilidadeItens } from "@/components/RentabilidadeItens";
import { brl, dataBR } from "@/lib/format";
import { gerarEcExcel } from "@/lib/excel";
import { enviarEcParaAprovacao } from "@/lib/email";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx } from "@/lib/format";
import type { EcLinha } from "@/data/types";

/** Agrupa as linhas por grupo preservando a ordem de aparição (visão de leitura). */
function agruparLinhas(linhas: EcLinha[]): { nome: string; itens: EcLinha[] }[] {
  const ordem: string[] = [];
  const map = new Map<string, EcLinha[]>();
  for (const l of linhas) {
    const g = l.grupo || "GERAL";
    if (!map.has(g)) { map.set(g, []); ordem.push(g); }
    map.get(g)!.push(l);
  }
  return ordem.map((nome) => ({ nome, itens: map.get(nome)! }));
}

export function EcDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const { data: ec, loading } = useAsync(() => repo.ecs.obter(id), [id]);
  const { data: oss } = useAsync(() => repo.oss.porEc(id), [id]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  const t = useMemo(
    () => (ec ? calcularTotais(ec.linhas, ec.producao, ec.honorarios, ec.encargos) : null),
    [ec]
  );
  const gastoPorLinha = useMemo(
    () => (ec ? gastoPorLinhaViaOSs(ec.linhas, oss ?? []) : {}),
    [ec, oss]
  );

  if (loading) return <PageShell title="Carregando…">{null}</PageShell>;
  if (!ec) return <PageShell title="EC não encontrada">{null}</PageShell>;

  const verFinanceiro = pode("financeiro");
  const podeEditar = pode("ecs.editar");
  // A EC vive dentro do projeto: voltar/breadcrumb apontam para a subguia EC do projeto.
  const voltarUrl = ec.projetoId ? `/projetos/${ec.projetoId}?aba=ec` : "/projetos";

  const toggle = (lid: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(lid) ? n.delete(lid) : n.add(lid);
      return n;
    });

  const linhasSel = ec.linhas.filter((l) => sel.has(l.id));
  const grupos = agruparPorFornecedor(linhasSel);
  const multiFornecedor = grupos.length > 1;

  const gruposLinha = agruparLinhas(ec.linhas);
  const toggleGrupo = (n: string) =>
    setRecolhidos((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const selecionarGrupo = (itens: EcLinha[], marcar: boolean) =>
    setSel((s) => { const x = new Set(s); itens.forEach((l) => (marcar ? x.add(l.id) : x.delete(l.id))); return x; });

  async function gerarOs() {
    setErro("");
    if (linhasSel.length === 0) {
      setErro("Selecione ao menos uma linha da EC.");
      return;
    }
    if (multiFornecedor) {
      setErro("Selecione linhas de um único fornecedor por OS. Há mais de um fornecedor na seleção.");
      return;
    }
    const linhaIds = linhasSel.map((l) => l.id).join(",");
    navigate(`/estimativas/${ec!.id}/os/nova?linhas=${encodeURIComponent(linhaIds)}`);
  }

  return (
    <PageShell
      breadcrumb={
        <>
          <button onClick={() => navigate(voltarUrl)} className="hover:text-ink">{ec.projeto.titulo || "Projeto"}</button>
          <IcChevron width={14} height={14} />
          <Crumb>{ec.numero}</Crumb>
        </>
      }
      title={tituloEc(ec)}
      subtitle={ec.numero}
      topAction={
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => gerarEcExcel(ec, { modelo: "financeiro" })}>
            Excel Financeiro
          </Button>
          <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => gerarEcExcel(ec, { modelo: "completa" })}>
            Excel Completa
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/estimativas/${ec.id}/imprimir`)}>
            Ver / PDF
          </Button>
          {podeEditar && ec.status === "Rascunho" && (
            <Button size="sm" onClick={() => navigate(`/estimativas/${ec.id}/editar`)}>
              Editar EC
            </Button>
          )}
        </div>
      }
    >
      <button onClick={() => navigate(voltarUrl)} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink mb-4 font-semibold">
        <IcBack width={16} height={16} /> Voltar ao projeto
      </button>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {ec.ativa ? <Badge tom="success">EC ativa</Badge> : <Badge tom="neutral">Arquivada (não ativa)</Badge>}
        <Badge tom={tomStatusEc[ec.status]}>{ec.status}</Badge>
        <Badge tom="neutral">Versão V{String(ec.versao).padStart(2, "0")}</Badge>
        {ec.canceladaSubstituida && <Badge tom="warning">Cancela e substitui anteriores</Badge>}
        <span className="text-[12.5px] text-ink-3">Validade {ec.validadeDias} dias</span>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        {/* Coluna principal: tabela de custos */}
        <div className="space-y-4">
          <Card padded={false}>
            <div className="p-5 flex items-center justify-between gap-3 border-b border-border-soft flex-wrap">
              <CardTitle hint="Mesma organização por grupos da criação. Selecione linhas de um mesmo fornecedor para gerar a OS.">
                Estimativa de custos
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 text-[12px] font-bold text-ink-2">
                  <button onClick={() => setRecolhidos(new Set())} className="hover:text-ink">Expandir</button>
                  <span className="text-border">|</span>
                  <button onClick={() => setRecolhidos(new Set(gruposLinha.map((g) => g.nome)))} className="hover:text-ink">Retrair</button>
                </div>
                <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={gerarOs} disabled={!pode("oss")}>
                  Gerar OS ({linhasSel.length})
                </Button>
              </div>
            </div>
            {erro && <div className="mx-5 mt-3 text-[13px] text-danger bg-danger-soft rounded-btn px-3 py-2">{erro}</div>}

            <div className="p-3 space-y-2">
              {gruposLinha.map((g) => {
                const aberto = !recolhidos.has(g.nome);
                const subtotal = g.itens.reduce((s, l) => s + l.valorPolobh + l.valorCliente, 0);
                const selNoGrupo = g.itens.filter((l) => sel.has(l.id)).length;
                const todosSel = selNoGrupo === g.itens.length && g.itens.length > 0;
                return (
                  <div key={g.nome} className="rounded-card border border-border overflow-hidden">
                    {/* Cabeçalho do grupo */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-[#FAFAFB]">
                      <input
                        type="checkbox"
                        checked={todosSel}
                        ref={(el) => { if (el) el.indeterminate = selNoGrupo > 0 && !todosSel; }}
                        onChange={(e) => selecionarGrupo(g.itens, e.target.checked)}
                        className="h-4 w-4 accent-[#F2820D] shrink-0"
                        title="Selecionar todas as linhas do grupo"
                      />
                      <button onClick={() => toggleGrupo(g.nome)} className="text-ink-2 hover:text-ink shrink-0">
                        <IcChevron width={18} height={18} className={cx("transition-transform", aberto && "rotate-90")} />
                      </button>
                      <button onClick={() => toggleGrupo(g.nome)} className="font-display font-bold text-ink text-[14px] text-left flex-1 uppercase">
                        {g.nome}
                      </button>
                      <span className="shrink-0 text-[11px] font-bold text-ink-3 bg-[#EFF0F3] rounded-pill px-2 py-0.5">
                        {g.itens.length} {g.itens.length === 1 ? "item" : "itens"}
                      </span>
                      {verFinanceiro && subtotal > 0 && (
                        <span className="shrink-0 text-[13px] font-display font-bold text-ink-2">{brl(subtotal)}</span>
                      )}
                    </div>

                    {/* Itens do grupo */}
                    {aberto && (
                      <div className="divide-y divide-border-soft">
                        {g.itens.map((l) => (
                          <label key={l.id} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-[#FCFCFD]">
                            <input
                              type="checkbox"
                              checked={sel.has(l.id)}
                              onChange={() => toggle(l.id)}
                              className="h-4 w-4 accent-[#F2820D] mt-1 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-ink text-[13.5px]">{l.item || "—"}</div>
                              {l.descricao && <div className="text-[12.5px] text-ink-2 whitespace-pre-wrap">{l.descricao}</div>}
                              <div className="text-[11px] text-ink-3 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>Fornecedor: {l.fornecedorRazao || "—"}</span>
                              </div>
                            </div>
                            {verFinanceiro && (
                              <div className="shrink-0 text-right w-24">
                                <div className="font-display font-bold text-ink text-[13px]">{brl(l.valorPolobh)}</div>
                                <div className="text-[11px] text-ink-3">Cli. {brl(l.valorCliente)}</div>
                              </div>
                            )}
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <Badge tom={tomAprovacao[l.statusAprovacao]}>{l.statusAprovacao}</Badge>
                              <Badge tom={tomAprovacao[l.statusOs]}>OS {l.statusOs}</Badge>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {multiFornecedor && (
              <div className="mx-5 mb-5 text-[12.5px] text-warning bg-warning-soft rounded-btn px-3 py-2">
                A seleção tem {grupos.length} fornecedores. Uma OS consolida linhas de um único fornecedor.
              </div>
            )}
          </Card>

          {/* Rentabilidade por item (restrito ao financeiro) */}
          {verFinanceiro && (
            <Card padded={false}>
              <div className="p-5"><CardTitle hint="A = estimado na EC · B = gasto (valor a pagar das OS's, rateado) · C = (A−B)/A">Rentabilidade por item</CardTitle></div>
              <RentabilidadeItens linhas={ec.linhas} gastoPorLinha={gastoPorLinha} />
            </Card>
          )}

          {/* OSs vinculadas */}
          <Card padded={false}>
            <div className="p-5"><CardTitle>Ordens de Serviço vinculadas</CardTitle></div>
            {(oss ?? []).length === 0 ? (
              <EmptyState title="Nenhuma OS gerada" hint="Selecione linhas acima e gere a primeira OS." />
            ) : (
              <Table>
                <THead>
                  <Th>OS</Th>
                  <Th>Fornecedor</Th>
                  <Th align="center">Itens</Th>
                  {verFinanceiro && <Th align="right">Valor EC</Th>}
                  <Th align="center">Status</Th>
                </THead>
                <tbody>
                  {(oss ?? []).map((o) => (
                    <Tr key={o.id} onClick={() => navigate(`/ordens/${o.id}`)}>
                      <Td className="font-bold">{o.numero}</Td>
                      <Td>{o.fornecedor.razaoSocial}</Td>
                      <Td align="center">
                        <Badge tom={o.ecLinhaIds.length > 1 ? "info" : "neutral"}>
                          {o.ecLinhaIds.length > 1 ? `${o.ecLinhaIds.length} consolidados` : "1 item"}
                        </Badge>
                      </Td>
                      {verFinanceiro && <Td align="right" className="font-display font-bold">{brl(o.orcamento.valorEc)}</Td>}
                      <Td align="center"><Badge tom={tomStatusOs[o.status]}>{o.status}</Badge></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          {/* Totais — oculto para Produção */}
          {verFinanceiro && t && (
            <Card>
              <CardTitle>Totais</CardTitle>
              <dl className="space-y-2 text-sm">
                <Row label="Soma fornecedores" v={brl(t.somaFornecedores)} />
                <Row label={`Honorários Pólobh (${rotuloTaxa(ec.honorarios)})`} v={brl(t.honorariosPolobh)} />
                <Row label={`Encargos (${rotuloTaxa(ec.encargos)})`} v={brl(t.encargos)} />
                <Row label="Sub-total Pólobh" v={brl(t.subTotalPolobh)} strong />
                <Row label="Faturamento terceiros" v={brl(t.faturamentoTerceiros)} />
                <Row label={`Honorários cliente (${rotuloTaxa(ec.honorarios)})`} v={brl(t.honorariosCliente)} />
                <div className="h-px bg-border-soft my-1" />
                <div className="flex items-center justify-between bg-primary-soft rounded-btn px-3 py-2.5">
                  <span className="font-bold text-ink">Valor total bruto</span>
                  <span className="font-display font-bold text-primary-dark">{brl(t.valorTotalBruto)}</span>
                </div>
                <Row label="Faturamento Pólobh" v={brl(t.faturamentoPolobh)} />
              </dl>
            </Card>
          )}

          {/* Cliente/Projeto só em EC avulsa; dentro de um projeto ficam em "Dados Gerais". */}
          {!ec.projetoId && (
            <>
              <Card>
                <Eyebrow>Cliente</Eyebrow>
                <div className="mt-2 space-y-1.5 text-sm">
                  <p className="font-bold text-ink">{ec.cliente.razaoSocial}</p>
                  <p className="text-ink-2">{ec.cliente.cnpjCpf}</p>
                  <p className="text-ink-2">{ec.cliente.endereco}</p>
                  <p className="text-ink-2">{ec.cliente.representante.nome} · {ec.cliente.representante.email}</p>
                </div>
              </Card>

              <Card>
                <Eyebrow>Projeto</Eyebrow>
                <div className="mt-2 space-y-1.5 text-sm">
                  <p className="text-ink-2"><b className="text-ink">Local:</b> {ec.projeto.local}</p>
                  <p className="text-ink-2"><b className="text-ink">Participantes:</b> {ec.projeto.participantes}</p>
                  <p className="text-ink-2"><b className="text-ink">Evento:</b> {dataBR(ec.projeto.evento)} · {ec.projeto.horario}</p>
                  <p className="text-ink-2"><b className="text-ink">Responsável:</b> {ec.responsavel}</p>
                </div>
              </Card>
            </>
          )}

          {podeEditar && (
            <Card>
              <Eyebrow>Ações</Eyebrow>
              <AvisoEmailPendente className="mt-3" />
              <div className="mt-3 grid gap-2">
                {!ec.ativa && (
                  <Button variant="primary" size="sm"
                    onClick={async () => {
                      if (!(await confirmar({
                        titulo: "Tornar esta EC a ativa do projeto?",
                        mensagem: "As demais versões do projeto passam a arquivadas. Só uma EC fica ativa por projeto.",
                        confirmarTexto: "Tornar ativa",
                      }))) return;
                      await repo.ecs.definirAtiva(ec.id);
                      toast("EC definida como ativa.", "success");
                      navigate(0);
                    }}>
                    Tornar esta EC a ativa
                  </Button>
                )}
                <Button variant="primary" size="sm" icon={<IcSend width={16} height={16} />}
                  disabled={busy}
                  onClick={async () => {
                    const destino = ec.cliente.representante.email;
                    if (!destino) { toast("Cadastre o e-mail do representante do cliente antes de enviar.", "warning"); return; }
                    if (!(await confirmar({
                      titulo: "Enviar EC para aprovação?",
                      mensagem: `A EC será marcada como "Aguardando" e um e-mail será enviado para ${destino}.`,
                      confirmarTexto: "Enviar",
                    }))) return;
                    setBusy(true);
                    try {
                      const r = await enviarEcParaAprovacao(ec);
                      if (!r.ok) { toast(`O e-mail não saiu e a EC permaneceu no status atual: ${r.motivo}`, "warning"); return; }
                      if (r.simulado) { toast(`Envio simulado para ${r.destinatarios.join(", ") || "—"}; o status não foi alterado.`, "info"); return; }
                      await repo.ecs.salvar({ ...ec, status: "Aguardando" });
                      toast(`EC enviada para aprovação de ${r.destinatarios.join(", ")}.`, "success");
                      navigate(0);
                    } catch (e) {
                      toast(`Não foi possível concluir o envio: ${(e as Error).message}`, "danger");
                    } finally { setBusy(false); }
                  }}>
                  Enviar ao cliente para aprovação
                </Button>
                <Button variant="secondary" size="sm" icon={<IcCopy width={16} height={16} />}
                  onClick={async () => {
                    if (!(await confirmar({
                      titulo: "Duplicar esta EC?",
                      mensagem: "Será criada uma nova EC, na próxima versão disponível e em Rascunho, com os mesmos dados para você editar.",
                      confirmarTexto: "Duplicar",
                    }))) return;
                    const n = await repo.ecs.duplicar(ec.id);
                    toast("EC duplicada.", "success");
                    navigate(`/estimativas/${n.id}/editar`);
                  }}>
                  Duplicar EC
                </Button>
                <Button variant="secondary" size="sm"
                  onClick={async () => {
                    if (!(await confirmar({
                      titulo: "Gerar a próxima versão desta EC?",
                      mensagem: "Uma nova versão será criada e levará a frase \"cancela e substitui todas as anteriores\".",
                      confirmarTexto: "Gerar nova versão",
                    }))) return;
                    const n = await repo.ecs.novaVersao(ec.id);
                    toast(`Nova versão V${String(n.versao).padStart(2, "0")} criada (cancela e substitui).`, "success");
                    navigate(`/estimativas/${n.id}/editar`);
                  }}>
                  Gerar nova versão
                </Button>
                {!["Arquivada", "Cancelada"].includes(ec.status) && (
                  <Button variant="secondary" size="sm"
                    onClick={async () => {
                      if (!(await confirmar({
                        titulo: "Arquivar esta EC?",
                        mensagem: "A EC sai da lista ativa, mas continua consultável e pode ser duplicada. Arquivar ≠ apagar.",
                        confirmarTexto: "Arquivar",
                      }))) return;
                      await repo.ecs.salvar({ ...ec, status: "Arquivada", ativa: false });
                      toast("EC arquivada (continua consultável).", "info");
                      navigate(voltarUrl);
                    }}>
                    Arquivar EC
                  </Button>
                )}
                {ec.status !== "Cancelada" && (
                  <Button variant="danger" size="sm"
                    onClick={async () => {
                      if (!(await confirmar({
                        titulo: "Cancelar esta EC?",
                        mensagem: `A EC ${ec.numero} passará para o status "Cancelada". Você ainda poderá consultá-la.`,
                        confirmarTexto: "Cancelar EC",
                        cancelarTexto: "Voltar",
                        tom: "danger",
                      }))) return;
                      await repo.ecs.salvar({ ...ec, status: "Cancelada" });
                      toast("EC cancelada.", "warning");
                      navigate(voltarUrl);
                    }}>
                    Cancelar EC
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}

/** Rótulo curto de uma taxa: "15%" (percentual) ou "valor fixo". */
function rotuloTaxa(cfg: { modo: "percentual" | "fixo"; valor: number }): string {
  return cfg.modo === "fixo"
    ? "valor fixo"
    : `${(cfg.valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function Row({ label, v, strong }: { label: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-2">{label}</span>
      <span className={strong ? "font-display font-bold text-ink" : "font-semibold text-ink"}>{v}</span>
    </div>
  );
}
