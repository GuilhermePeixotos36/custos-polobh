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
import { IcBack, IcCopy, IcDownload, IcPlus, IcChevron, IcSend } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { calcularTotais, agruparPorFornecedor } from "@/domain/calc";
import { brl, dataBR } from "@/lib/format";
import { gerarEcExcel } from "@/lib/excel";
import { enviarEcParaAprovacao } from "@/lib/email";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";

export function EcDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const { data: ec, loading } = useAsync(() => repo.ecs.obter(id), [id]);
  const { data: oss } = useAsync(() => repo.oss.porEc(id), [id]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");

  const t = useMemo(
    () => (ec ? calcularTotais(ec.linhas, ec.producao) : null),
    [ec]
  );

  if (loading) return <PageShell breadcrumb={<Crumb>EC</Crumb>} title="Carregando…">{null}</PageShell>;
  if (!ec) return <PageShell breadcrumb={<Crumb>EC</Crumb>} title="EC não encontrada">{null}</PageShell>;

  const verFinanceiro = pode("financeiro");
  const podeEditar = pode("ecs.editar");

  const toggle = (lid: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(lid) ? n.delete(lid) : n.add(lid);
      return n;
    });

  const linhasSel = ec.linhas.filter((l) => sel.has(l.id));
  const grupos = agruparPorFornecedor(linhasSel);
  const multiFornecedor = grupos.length > 1;

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
          <button onClick={() => navigate("/estimativas")} className="hover:text-ink">Estimativas</button>
          <IcChevron width={14} height={14} />
          <Crumb>{ec.numero}</Crumb>
        </>
      }
      title={ec.projeto.titulo}
      subtitle={`${ec.cliente.nome} · ${ec.numero}`}
      topAction={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => gerarEcExcel(ec)}>
            Gerar Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/estimativas/${ec.id}/imprimir`)}>
            Ver / PDF
          </Button>
          {podeEditar && (
            <Button size="sm" onClick={() => navigate(`/estimativas/${ec.id}/editar`)}>
              Editar EC
            </Button>
          )}
        </div>
      }
    >
      <button onClick={() => navigate("/estimativas")} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink mb-4 font-semibold">
        <IcBack width={16} height={16} /> Voltar
      </button>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Badge tom={tomStatusEc[ec.status]}>{ec.status}</Badge>
        <Badge tom="neutral">Versão V{String(ec.versao).padStart(2, "0")}</Badge>
        {ec.canceladaSubstituida && <Badge tom="warning">Cancela e substitui anteriores</Badge>}
        <span className="text-[12.5px] text-ink-3">Validade {ec.validadeDias} dias</span>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        {/* Coluna principal: tabela de custos */}
        <div className="space-y-4">
          <Card padded={false}>
            <div className="p-5 flex items-center justify-between gap-3 border-b border-border-soft">
              <CardTitle hint="Selecione linhas do mesmo fornecedor para gerar uma OS consolidada">
                Linhas de custo
              </CardTitle>
              <Button
                size="sm"
                icon={<IcPlus width={16} height={16} />}
                onClick={gerarOs}
                disabled={!pode("oss")}
              >
                Gerar OS ({linhasSel.length})
              </Button>
            </div>
            {erro && <div className="mx-5 mt-3 text-[13px] text-danger bg-danger-soft rounded-btn px-3 py-2">{erro}</div>}
            <Table>
              <THead>
                <Th></Th>
                <Th>Item / Descrição</Th>
                <Th>Fornecedor</Th>
                {verFinanceiro && <Th align="right">Pólobh</Th>}
                {verFinanceiro && <Th align="right">Cliente</Th>}
                <Th align="center">Aprov.</Th>
                <Th align="center">OS</Th>
              </THead>
              <tbody>
                {ec.linhas.map((l) => (
                  <Tr key={l.id}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={sel.has(l.id)}
                        onChange={() => toggle(l.id)}
                        className="h-4 w-4 accent-[#F2820D]"
                      />
                    </Td>
                    <Td>
                      <div className="font-bold text-ink">{l.item || "—"}</div>
                      <div className="text-[12px] text-ink-2">{l.descricao}</div>
                      <div className="text-[11px] text-ink-3 mt-0.5">{l.grupo}</div>
                    </Td>
                    <Td className="text-[12.5px]">{l.fornecedorRazao || "—"}</Td>
                    {verFinanceiro && <Td align="right" className="font-display font-bold">{brl(l.valorPolobh)}</Td>}
                    {verFinanceiro && <Td align="right" className="font-display font-bold">{brl(l.valorCliente)}</Td>}
                    <Td align="center"><Badge tom={tomAprovacao[l.statusAprovacao]}>{l.statusAprovacao}</Badge></Td>
                    <Td align="center"><Badge tom={tomAprovacao[l.statusOs]}>{l.statusOs}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            {multiFornecedor && (
              <div className="m-5 mt-3 text-[12.5px] text-warning bg-warning-soft rounded-btn px-3 py-2">
                A seleção tem {grupos.length} fornecedores. Uma OS consolida linhas de um único fornecedor.
              </div>
            )}
          </Card>

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
                <Row label="Honorários Pólobh (15%)" v={brl(t.honorariosPolobh)} />
                <Row label="Encargos (16,33%)" v={brl(t.encargos)} />
                <Row label="Sub-total Pólobh" v={brl(t.subTotalPolobh)} strong />
                <Row label="Faturamento terceiros" v={brl(t.faturamentoTerceiros)} />
                <Row label="Honorários cliente (15%)" v={brl(t.honorariosCliente)} />
                <div className="h-px bg-border-soft my-1" />
                <div className="flex items-center justify-between bg-primary-soft rounded-btn px-3 py-2.5">
                  <span className="font-bold text-ink">Valor total bruto</span>
                  <span className="font-display font-bold text-primary-dark">{brl(t.valorTotalBruto)}</span>
                </div>
                <Row label="Faturamento Pólobh" v={brl(t.faturamentoPolobh)} />
              </dl>
            </Card>
          )}

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

          {podeEditar && (
            <Card>
              <Eyebrow>Ações</Eyebrow>
              <div className="mt-3 grid gap-2">
                <Button variant="primary" size="sm" icon={<IcSend width={16} height={16} />}
                  onClick={async () => {
                    const destino = ec.cliente.representante.email || ec.cliente.nome;
                    if (!(await confirmar({
                      titulo: "Enviar EC para aprovação?",
                      mensagem: `A EC será marcada como "Aguardando" e um e-mail será enviado para ${destino}.`,
                      confirmarTexto: "Enviar",
                    }))) return;
                    await repo.ecs.salvar({ ...ec, status: "Aguardando" });
                    const r = await enviarEcParaAprovacao(ec);
                    if (!r.ok) toast(`EC marcada como aguardando, mas o e-mail não saiu: ${r.motivo}`, "warning");
                    else if (r.simulado) toast(`E-mail de aprovação simulado (Brevo não configurado) para ${r.destinatarios.join(", ") || "—"}.`, "info");
                    else toast(`EC enviada para aprovação de ${r.destinatarios.join(", ")}.`, "success");
                  }}>
                  Enviar ao cliente para aprovação
                </Button>
                <Button variant="secondary" size="sm" icon={<IcCopy width={16} height={16} />}
                  onClick={async () => {
                    if (!(await confirmar({
                      titulo: "Duplicar esta EC?",
                      mensagem: "Será criada uma nova EC (V01, Rascunho) com os mesmos dados, para você editar.",
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
                      titulo: `Gerar a versão V${String(ec.versao + 1).padStart(2, "0")}?`,
                      mensagem: "Uma nova versão será criada e levará a frase \"cancela e substitui todas as anteriores\".",
                      confirmarTexto: "Gerar nova versão",
                    }))) return;
                    const n = await repo.ecs.novaVersao(ec.id);
                    toast(`Nova versão V${String(n.versao).padStart(2, "0")} criada (cancela e substitui).`, "success");
                    navigate(`/estimativas/${n.id}/editar`);
                  }}>
                  Gerar nova versão (V{String(ec.versao + 1).padStart(2, "0")})
                </Button>
                {!["Arquivada", "Cancelada"].includes(ec.status) && (
                  <Button variant="secondary" size="sm"
                    onClick={async () => {
                      if (!(await confirmar({
                        titulo: "Arquivar esta EC?",
                        mensagem: "A EC sai da lista ativa, mas continua consultável e pode ser duplicada. Arquivar ≠ apagar.",
                        confirmarTexto: "Arquivar",
                      }))) return;
                      await repo.ecs.salvar({ ...ec, status: "Arquivada" });
                      toast("EC arquivada (continua consultável).", "info");
                      navigate("/estimativas");
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
                      navigate("/estimativas");
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

function Row({ label, v, strong }: { label: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-2">{label}</span>
      <span className={strong ? "font-display font-bold text-ink" : "font-semibold text-ink"}>{v}</span>
    </div>
  );
}
