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
  tomStatusEc,
  tomStatusOs,
  tomAprovacao,
} from "@/components/ui";
import { IcBack, IcDownload, IcPlus, IcChevron } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { calcularTotais, agruparPorFornecedor, descritivoConsolidado, gastoPorLinhaViaOSs, numeroOs, tituloEc } from "@/domain/calc";
import { RentabilidadeItens } from "@/components/RentabilidadeItens";
import { EcSubGuias, type SubGuiaEc } from "@/components/EcSubGuias";
import { brl, dataBR, onlyDigits } from "@/lib/format";
import { gerarEcExcel } from "@/lib/excel";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { cx } from "@/lib/format";
import type { Ec, EcLinha, Fornecedor, Os } from "@/data/types";

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
  const [subaba, setSubaba] = useState<SubGuiaEc>("ec");
  const [emitindo, setEmitindo] = useState(false);

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

  async function tornarAtiva() {
    // EC arquivada: mantém a antiga intacta e cria uma NOVA versão (número +1, data atual)
    // com os mesmos dados, já ativa. Rascunho não-ativo apenas vira o ativo do projeto.
    if (ec!.status === "Arquivada") {
      if (!(await confirmar({
        titulo: "Reativar gerando uma nova versão?",
        mensagem: "A versão arquivada é preservada. Uma nova versão (número seguinte, data de hoje) é criada com os mesmos dados e passa a ser a ativa do projeto.",
        confirmarTexto: "Gerar nova versão ativa",
      }))) return;
      const nova = await repo.ecs.duplicar(ec!.id);
      await repo.ecs.definirAtiva(nova.id);
      toast(`Nova versão V${String(nova.versao).padStart(2, "0")} criada e ativada.`, "success");
      navigate(`/estimativas/${nova.id}/editar`);
      return;
    }
    if (!(await confirmar({
      titulo: "Tornar esta EC a ativa do projeto?",
      mensagem: "As demais versões do projeto passam a arquivadas. Só uma EC fica ativa por projeto.",
      confirmarTexto: "Tornar ativa",
    }))) return;
    await repo.ecs.definirAtiva(ec!.id);
    toast("EC definida como ativa.", "success");
    navigate(0);
  }

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

  /**
   * Emite as OSs das linhas marcadas como "Emitir"/"Emitir Nova Versão":
   * valida os obrigatórios, agrupa por fornecedor e cria uma OS (rascunho) por fornecedor.
   * Linhas "Emitir Nova Versão" arquivam a OS anterior que as cobre e geram uma OS nova.
   */
  async function emitirOs() {
    setErro("");
    const marcadas = ec!.linhas.filter((l) => l.statusOs === "Emitir" || l.statusOs === "Emitir Nova Versão");
    if (!marcadas.length) {
      toast("Nenhuma linha com status 'Emitir' ou 'Emitir Nova Versão'.", "info");
      return;
    }
    // Obrigatórios apenas na emissão (na EC eles são opcionais).
    const faltas: string[] = [];
    for (const l of marcadas) {
      const f: string[] = [];
      if (!l.fornecedorRazao?.trim()) f.push("Fornecedor");
      if (onlyDigits(l.fornecedorCnpj).length !== 14) f.push("CNPJ");
      if (!l.faturaNf?.trim()) f.push("Documento PG");
      if (!l.codigoServico?.trim()) f.push("Código de Serviço");
      if (!l.pedidoCompra?.trim()) f.push("Pedido de Compra");
      if (f.length) faltas.push(`• ${l.item || "(item sem nome)"}: ${f.join(", ")}`);
    }
    if (faltas.length) {
      setErro(`Complete os campos obrigatórios antes de emitir a OS:\n${faltas.join("\n")}`);
      return;
    }
    if (!(await confirmar({
      titulo: "Emitir OS das linhas marcadas?",
      mensagem: "Será criada uma OS (rascunho) por fornecedor, com os itens consolidados. Itens 'Emitir Nova Versão' arquivam a OS anterior e geram uma nova. Depois é só completar os dados fiscais de cada OS.",
      confirmarTexto: "Emitir OS",
    }))) return;

    setEmitindo(true);
    try {
      const grupos = agruparPorFornecedor(marcadas);
      const idsEmitidos = new Set<string>();
      let criadas = 0;
      for (const g of grupos) {
        const idsG = new Set(g.linhas.map((l) => l.id));
        const temReversao = g.linhas.some((l) => l.statusOs === "Emitir Nova Versão");
        // "Emitir Nova Versão": arquiva as OSs anteriores que cobrem estes itens.
        if (temReversao) {
          for (const o of oss ?? []) {
            if (o.status === "Cancelada") continue;
            if (o.ecLinhaIds.some((lid) => idsG.has(lid))) {
              await repo.oss.salvar({ ...o, status: "Cancelada" });
            }
          }
        }
        const seq = await repo.oss.proximaSeq(ec!.id);
        const fornCadastro = g.fornecedorCnpj ? await repo.fornecedores.porCnpj(g.fornecedorCnpj) : undefined;
        await repo.oss.salvar(montarOsEmissao(ec!, g.linhas, seq, fornCadastro));
        criadas += 1;
        g.linhas.forEach((l) => idsEmitidos.add(l.id));
      }
      // Linhas emitidas deixam de estar pendentes — passam a "OK".
      const linhas = ec!.linhas.map((l) => (idsEmitidos.has(l.id) ? { ...l, statusOs: "OK" as const } : l));
      await repo.ecs.salvar({ ...ec!, linhas });
      toast(`${criadas} OS(s) emitida(s). Complete os dados fiscais de cada uma.`, "success");
      navigate(0);
    } catch (e) {
      toast(`Erro ao emitir OS: ${(e as Error).message}`, "danger");
    } finally {
      setEmitindo(false);
    }
  }

  const estimativaCard = (
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
      {erro && <div className="mx-5 mt-3 text-[13px] text-danger bg-danger-soft rounded-btn px-3 py-2 whitespace-pre-line">{erro}</div>}

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
  );

  const ossCard = (
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
  );

  const rentabilidadeCard = (
    <Card padded={false}>
      <div className="p-5"><CardTitle>Rentabilidade por item</CardTitle></div>
      <RentabilidadeItens linhas={ec.linhas} gastoPorLinha={gastoPorLinha} />
    </Card>
  );

  const totaisCard = t ? (
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
          <span className="font-bold text-ink">Valor Total Bruto (Custo Total do Projeto)</span>
          <span className="font-display font-bold text-primary-dark">{brl(t.valorTotalBruto)}</span>
        </div>
        <Row label="Faturamento Pólobh" v={brl(t.faturamentoPolobh)} strong />
      </dl>
    </Card>
  ) : null;

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
          {pode("oss") && ec.linhas.some((l) => l.statusOs === "Emitir" || l.statusOs === "Emitir Nova Versão") && (
            <Button variant="primary" size="sm" onClick={emitirOs} disabled={emitindo}>
              {emitindo ? "Emitindo…" : "Emitir OS"}
            </Button>
          )}
          {podeEditar && !ec.ativa && (
            <Button variant="primary" size="sm" onClick={tornarAtiva}>
              Tornar EC ativa
            </Button>
          )}
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

      {verFinanceiro && (
        <EcSubGuias atual={subaba} onChange={setSubaba} temResumo temRentabilidade />
      )}

      {verFinanceiro && subaba === "resumo" && (
        <div className="space-y-4 max-w-xl">{totaisCard}</div>
      )}
      {verFinanceiro && subaba === "rentabilidade" && (
        <div className="space-y-4">{rentabilidadeCard}</div>
      )}

      {subaba === "ec" && (
        <div className="space-y-4">
          {estimativaCard}
          {ossCard}

          {/* Cliente/Projeto só em EC avulsa; dentro de um projeto ficam em "Dados Gerais". */}
          {!ec.projetoId && (
            <div className="grid md:grid-cols-2 gap-4">
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
            </div>
          )}

          {podeEditar && (
            <Card>
              <Eyebrow>Ações</Eyebrow>
              <div className="mt-3 flex flex-wrap gap-2">
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

          {/* Totais (Resumo dos Custos) permanece como último bloco da guia geral da EC */}
          {verFinanceiro && totaisCard}
        </div>
      )}
    </PageShell>
  );
}

/** Rótulo curto de uma taxa: "15%" (percentual) ou "valor fixo". */
function rotuloTaxa(cfg: { modo: "percentual" | "fixo"; valor: number }): string {
  return cfg.modo === "fixo"
    ? "valor fixo"
    : `${(cfg.valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function fornecedorVazioEc(razao: string, cnpj: string): Fornecedor {
  return {
    id: "", razaoSocial: razao, nomeFantasia: "", cnpj, perfilTributario: "", endereco: "",
    inscricaoEstadual: "", inscricaoMunicipal: "",
    dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
    representante: "", telefone: "", email: "",
  };
}

/** Constrói a OS (rascunho) consolidando as linhas de um fornecedor — espelha a criação do OsForm. */
function montarOsEmissao(ecAtual: Ec, linhas: EcLinha[], seq: number, fornCadastro?: Fornecedor): Os {
  const agora = new Date().toISOString();
  const valorEc = linhas.reduce((s, l) => s + l.valorPolobh + l.valorCliente, 0);
  const g = agruparPorFornecedor(linhas)[0];
  return {
    id: "",
    numero: numeroOs(ecAtual, seq),
    slugCredenciamento: "",
    seq,
    ecId: ecAtual.id,
    ecNumero: ecAtual.numero,
    ecLinhaIds: linhas.map((l) => l.id),
    status: "Rascunho",
    fornecedor: fornCadastro ?? fornecedorVazioEc(g?.fornecedorRazao ?? "", g?.fornecedorCnpj ?? ""),
    modalidade: "",
    descritivo: descritivoConsolidado(linhas),
    entrega: "",
    cronograma: [{ etapa: "Evento", data: ecAtual.projeto.evento, horario: ecAtual.projeto.horario, atividades: "" }],
    logistica: { transporteMaterial: "", transporteEquipe: "", hospedagem: "", alimentacao: "", estacionamentoCarga: "", estacionamentoEquipe: "", uniformizacao: "" },
    infraestrutura: { energia: "", internet: "", pontosEletricos: "", estruturas: "", servicosApoio: "", artLaudos: "" },
    observacoes: [],
    credenciamento: { prazoLimite: "", linkFormulario: `https://forms.polobh.com.br/cred/${ecAtual.id}-${seq}` },
    orcamento: { valorEc, valorComBvNf: valorEc, valorSemBvComNf: valorEc, valorSemBvSemNf: valorEc, parcelas: [{ descricao: "Pagamento único", valor: valorEc }], documentoFiscal: "" },
    financeiro: { tomador: "", descritivoNf: "", cnae: "", codigoServico: "", valorUnitario: valorEc, valorTotal: valorEc, descontoNegociado: 0, valorAPagar: valorEc, bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "" },
    contrato: { contratante: "", descritivoServicos: "", informacoesComplementares: "", valorUnitario: valorEc, valorTotal: valorEc, descontoNegociado: 0, valorAPagar: valorEc, dataContrato: "", rubrica: "" },
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

function Row({ label, v, strong }: { label: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-2">{label}</span>
      <span className={strong ? "font-display font-bold text-ink" : "font-semibold text-ink"}>{v}</span>
    </div>
  );
}
