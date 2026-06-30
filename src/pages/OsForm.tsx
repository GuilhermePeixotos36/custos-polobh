import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Card,
  CardTitle,
  Button,
  Field,
  Input,
  Textarea,
  Select,
  NumberInput,
  Eyebrow,
  Badge,
  Table,
  THead,
  Th,
  Tr,
  Td,
  tomStatusOs,
  AvisoEmailPendente,
} from "@/components/ui";
import { IcDownload, IcSearch, IcSend, IcChevron, IcSpark, IcLink } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import {
  agruparPorFornecedor,
  descritivoConsolidado,
  numeroOs,
} from "@/domain/calc";
import { gerarOsExcel } from "@/lib/excel";
import { consultarCnpj } from "@/lib/cnpj";
import { gerarDescritivo } from "@/lib/ai";
import { dispararOsPorEmail, enviarCredenciamento } from "@/lib/email";
import { flags } from "@/lib/flags";
import { brl, dataBR, dataHoraBR, maskCpfCnpjInput, maskTelefone } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import type {
  DocumentoFiscal,
  Ec,
  Fornecedor,
  Modalidade,
  Os,
} from "@/data/types";

const MODALIDADES: Modalidade[] = ["Produto", "Serviço", "Locação", "Produto + Serviço", "Locação + Serviço"];
const DOCS: DocumentoFiscal[] = ["Recibo Simples", "Fatura", "Nota Fiscal", "Fatura e Nota Fiscal"];

const fornecedorVazio = (razao = "", cnpj = ""): Fornecedor => ({
  id: "", razaoSocial: razao, nomeFantasia: "", cnpj, perfilTributario: "", endereco: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
  representante: "", telefone: "", email: "",
});

export function OsForm() {
  const { id, ecId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const verFinanceiro = pode("financeiro");

  const { data: osExistente } = useAsync(() => (id ? repo.oss.obter(id) : Promise.resolve(undefined)), [id]);
  const { data: credResp } = useAsync(() => (id ? repo.oss.credenciamentos(id) : Promise.resolve([])), [id]);
  const { data: ec } = useAsync<Ec | undefined>(
    () => {
      if (ecId) return repo.ecs.obter(ecId);
      return Promise.resolve(undefined);
    },
    [ecId]
  );

  const [os, setOs] = useState<Os | null>(null);
  const [ecCtx, setEcCtx] = useState<Ec | null>(null);
  const [baseline, setBaseline] = useState("");
  const [cnpjMsg, setCnpjMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiadoCred, setCopiadoCred] = useState(false);

  const iniciar = (o: Os) => {
    setOs(o);
    setBaseline(JSON.stringify(o));
  };

  // edição de OS existente
  useEffect(() => {
    if (id && osExistente) {
      iniciar(structuredClone(osExistente));
      repo.ecs.obter(osExistente.ecId).then((e) => e && setEcCtx(e));
    }
  }, [id, osExistente]);

  // criação a partir da EC + linhas selecionadas
  useEffect(() => {
    if (id || !ec) return;
    const linhaIds = (params.get("linhas") ?? "").split(",").filter(Boolean);
    const linhas = ec.linhas.filter((l) => linhaIds.includes(l.id));
    const grupos = agruparPorFornecedor(linhas);
    const g = grupos[0];
    const valorEc = linhas.reduce((s, l) => s + l.valorPolobh + l.valorCliente, 0);

    // Puxa o fornecedor já cadastrado (pelo CNPJ) para pré-preencher tudo,
    // inclusive os CNAEs — sem precisar reconsultar o CNPJ na API.
    Promise.all([
      repo.oss.proximaSeq(ec.id),
      g?.fornecedorCnpj ? repo.fornecedores.porCnpj(g.fornecedorCnpj) : Promise.resolve(undefined),
    ]).then(([seq, fornCadastro]) => {
      const agora = new Date().toISOString();
      setEcCtx(ec);
      iniciar({
        id: "",
        numero: numeroOs(ec, seq),
        slugCredenciamento: "",
        seq,
        ecId: ec.id,
        ecNumero: ec.numero,
        ecLinhaIds: linhaIds,
        status: "Rascunho",
        fornecedor: fornCadastro ?? fornecedorVazio(g?.fornecedorRazao, g?.fornecedorCnpj),
        modalidade: "",
        descritivo: descritivoConsolidado(linhas),
        entrega: "",
        cronograma: [{ etapa: "Evento", data: ec.projeto.evento, horario: ec.projeto.horario, atividades: "" }],
        logistica: { transporteMaterial: "", transporteEquipe: "", hospedagem: "", alimentacao: "", estacionamentoCarga: "", estacionamentoEquipe: "", uniformizacao: "" },
        infraestrutura: { energia: "", internet: "", pontosEletricos: "", estruturas: "", servicosApoio: "", artLaudos: "" },
        observacoes: "",
        credenciamento: { prazoLimite: "", linkFormulario: `https://forms.polobh.com.br/cred/${ec.id}-${seq}` },
        orcamento: { valorEc, valorComBvNf: valorEc, valorSemBvComNf: valorEc, valorSemBvSemNf: valorEc, parcelas: [{ descricao: "Pagamento único", valor: valorEc }], documentoFiscal: "" },
        financeiro: { tomador: "", descritivoNf: "", cnae: "", codigoServico: "", valorUnitario: valorEc, valorTotal: valorEc, descontoNegociado: 0, valorAPagar: valorEc, bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "" },
        criadoEm: agora,
        atualizadoEm: agora,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ec, id]);

  const sujo = !!os && baseline !== "" && JSON.stringify(os) !== baseline;
  const guard = useUnsavedGuard(sujo);

  if (!os || !ecCtx) return <PageShell breadcrumb={<Crumb>OS</Crumb>} title="Carregando…">{null}</PageShell>;

  // Linhas da EC que esta OS consolida (mesmo fornecedor).
  const linhasConsolidadas = ecCtx.linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  const linkCredenciamento = os.slugCredenciamento ? `${location.origin}/credenciamento/${os.slugCredenciamento}` : "";
  // Justificativa do BV é obrigatória quando não há BV ou o percentual é < 15%.
  const bvPrecisaJustif = os.financeiro.bvPercentual < 15;
  const bvJustifFaltando = bvPrecisaJustif && !os.financeiro.bvJustificativa?.trim();

  const updF = (patch: Partial<Fornecedor>) => setOs((o) => (o ? { ...o, fornecedor: { ...o.fornecedor, ...patch } } : o));
  const updB = (patch: Partial<Fornecedor["dadosBancarios"]>) =>
    setOs((o) => (o ? { ...o, fornecedor: { ...o.fornecedor, dadosBancarios: { ...o.fornecedor.dadosBancarios, ...patch } } } : o));
  const updFin = (patch: Partial<Os["financeiro"]>) => setOs((o) => (o ? { ...o, financeiro: { ...o.financeiro, ...patch } } : o));
  const updOrc = (patch: Partial<Os["orcamento"]>) => setOs((o) => (o ? { ...o, orcamento: { ...o.orcamento, ...patch } } : o));

  async function consultar() {
    setCnpjMsg("");
    setBusy(true);
    try {
      const d = await consultarCnpj(os!.fornecedor.cnpj);
      updF({ razaoSocial: d.razaoSocial, nomeFantasia: d.nomeFantasia, endereco: d.endereco, perfilTributario: d.perfilTributario, email: d.email, telefone: d.telefone, cnaes: d.cnaes });
      setCnpjMsg(`Perfil: ${d.perfilTributario}. Dados preenchidos pela BrasilAPI.`);
    } catch (e) {
      setCnpjMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function descricaoIA() {
    setBusy(true);
    try {
      const txt = await gerarDescritivo({ item: "", descricao: os!.descritivo, fornecedor: os!.fornecedor.razaoSocial, modalidade: os!.modalidade });
      setOs((o) => (o ? { ...o, descritivo: txt } : o));
    } finally {
      setBusy(false);
    }
  }

  async function salvar(status?: Os["status"]) {
    // BV fora do padrão (sem BV ou < 15%) exige justificativa — para qualquer perfil.
    if (bvJustifFaltando) {
      toast("Informe a justificativa do BV — obrigatória quando não há BV ou é menor que 15%.", "warning");
      return;
    }
    if (status === "Disparada") {
      const destino = os!.fornecedor.email || "o fornecedor (sem e-mail cadastrado)";
      if (!(await confirmar({
        titulo: "Disparar esta OS ao fornecedor?",
        mensagem: `A OS ${os!.numero} passará para "Disparada" e será enviado um e-mail para ${destino}.`,
        confirmarTexto: "Disparar OS",
      }))) return;
    }
    setBusy(true);
    try {
      const bvValor = (os!.financeiro.valorTotal * os!.financeiro.bvPercentual) / 100;
      // mantém o link de credenciamento coerente com o token da OS (p/ e-mail/impressão)
      const linkCred = os!.slugCredenciamento
        ? `${location.origin}/credenciamento/${os!.slugCredenciamento}`
        : os!.credenciamento.linkFormulario;
      const salvo = await repo.oss.salvar({
        ...os!,
        status: status ?? os!.status,
        credenciamento: { ...os!.credenciamento, linkFormulario: linkCred },
        financeiro: { ...os!.financeiro, bvValor },
      });
      iniciar(salvo);
      if (status === "Disparada") {
        const r = await dispararOsPorEmail(salvo, ecCtx!);
        if (!r.ok) toast(`OS salva, mas o e-mail não saiu: ${r.motivo}`, "warning");
        else if (r.simulado) toast(`OS disparada. E-mail simulado (Brevo não configurado) para ${r.destinatarios.join(", ") || "—"}.`, "info");
        else toast(`OS disparada e e-mail enviado para ${r.destinatarios.join(", ")}.`, "success");
      } else {
        toast("OS salva.", "success");
      }
      guard.liberar();
      navigate(`/ordens/${salvo.id}`);
    } catch (e) {
      toast(`Erro ao salvar a OS: ${(e as Error).message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function enviarLinkCredenciamento() {
    const destino = os!.fornecedor.email || "o fornecedor (sem e-mail cadastrado)";
    if (!(await confirmar({
      titulo: "Enviar credenciamento ao fornecedor?",
      mensagem: `Será enviado um e-mail com o link do formulário para ${destino}.`,
      confirmarTexto: "Enviar",
    }))) return;
    setBusy(true);
    try {
      const r = await enviarCredenciamento(os!, ecCtx!);
      if (!r.ok) toast(`Não foi possível enviar: ${r.motivo}`, "warning");
      else if (r.simulado) toast(`Credenciamento simulado (Brevo não configurado) para ${r.destinatarios.join(", ") || "—"}.`, "info");
      else toast(`Link de credenciamento enviado para ${r.destinatarios.join(", ")}.`, "success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      breadcrumb={
        <>
          <button onClick={() => navigate(`/estimativas/${ecCtx.id}`)} className="hover:text-ink">{ecCtx.numero}</button>
          <IcChevron width={14} height={14} />
          <Crumb>{os.numero}</Crumb>
        </>
      }
      title="Ordem de Serviço"
      subtitle={os.numero}
      topAction={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => gerarOsExcel(os, ecCtx, { incluirFinanceiro: verFinanceiro })}>Baixar Excel</Button>
          <Button variant="secondary" size="sm" onClick={() => os.id ? navigate(`/ordens/${os.id}/imprimir`) : toast("Salve a OS antes de visualizar o PDF.", "info")}>Ver / PDF</Button>
          <Button variant="secondary" size="sm" onClick={() => salvar()} disabled={busy}>Salvar</Button>
          <Button size="sm" icon={<IcSend width={15} height={15} />} onClick={() => salvar("Disparada")} disabled={busy}>Disparar OS</Button>
        </div>
      }
    >
      <div className="flex items-center gap-2 mb-5">
        <Badge tom={tomStatusOs[os.status]}>{os.status}</Badge>
        <span className="text-[12.5px] text-ink-3">Consolida {os.ecLinhaIds.length} linha(s) da EC</span>
      </div>

      <AvisoEmailPendente className="mb-4" />

      <div className="space-y-4">
        {/* Cliente / projeto (auto da EC, read-only) */}
        <Card>
          <CardTitle hint="Preenchido automaticamente a partir da EC (somente leitura)">Cliente & Projeto</CardTitle>
          <div className="grid md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <Leitura label="Cliente" v={ecCtx.cliente.nome} />
            <Leitura label="CNPJ/CPF" v={ecCtx.cliente.cnpjCpf} />
            <Leitura label="Projeto" v={ecCtx.projeto.titulo} />
            <Leitura label="Local" v={ecCtx.projeto.local} />
            <Leitura label="Data do evento" v={`${dataBR(ecCtx.projeto.evento)} · ${ecCtx.projeto.horario}`} />
            <Leitura label="Participantes" v={String(ecCtx.projeto.participantes ?? "")} />
          </div>
        </Card>

        {/* Itens da EC consolidados nesta OS (mesmo fornecedor) */}
        <Card padded={false}>
          <div className="p-5">
            <CardTitle hint="Serviços do mesmo fornecedor reunidos numa única OS">
              Itens consolidados da EC ({linhasConsolidadas.length})
            </CardTitle>
          </div>
          <Table>
            <THead>
              <Th>Grupo</Th>
              <Th>Item / Descrição</Th>
              {verFinanceiro && <Th align="right">Pólobh</Th>}
              {verFinanceiro && <Th align="right">Cliente</Th>}
            </THead>
            <tbody>
              {linhasConsolidadas.map((l) => (
                <Tr key={l.id}>
                  <Td className="text-[12px] text-ink-2">{l.grupo}</Td>
                  <Td>
                    <div className="font-bold text-ink">{l.item || "—"}</div>
                    <div className="text-[12px] text-ink-2">{l.descricao}</div>
                  </Td>
                  {verFinanceiro && <Td align="right" className="font-display font-bold">{brl(l.valorPolobh)}</Td>}
                  {verFinanceiro && <Td align="right" className="font-display font-bold">{brl(l.valorCliente)}</Td>}
                </Tr>
              ))}
              {verFinanceiro && (
                <Tr className="bg-[#FAFAFB]">
                  <Td />
                  <Td className="font-bold text-ink text-right">Total consolidado</Td>
                  <Td align="right" className="font-display font-bold text-primary-dark">
                    {brl(linhasConsolidadas.reduce((s, l) => s + l.valorPolobh, 0))}
                  </Td>
                  <Td align="right" className="font-display font-bold text-primary-dark">
                    {brl(linhasConsolidadas.reduce((s, l) => s + l.valorCliente, 0))}
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </Card>

        {/* Fornecedor */}
        <Card>
          <CardTitle action={
            <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={consultar} disabled={busy || !flags.consultaCnpj}>Consultar CNPJ</Button>
          }>Fornecedor</CardTitle>
          {cnpjMsg && <div className="mb-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{cnpjMsg}</div>}
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="CNPJ/CPF"><Input value={os.fornecedor.cnpj} onChange={(e) => updF({ cnpj: maskCpfCnpjInput(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" /></Field>
            <Field label="Perfil tributário" hint="(auto)"><Input value={os.fornecedor.perfilTributario} onChange={(e) => updF({ perfilTributario: e.target.value })} placeholder="MEI / Simples…" /></Field>
            <Field label="Razão social" className="md:col-span-2"><Input value={os.fornecedor.razaoSocial} onChange={(e) => updF({ razaoSocial: e.target.value })} /></Field>
            <Field label="Endereço" className="md:col-span-2"><Input value={os.fornecedor.endereco} onChange={(e) => updF({ endereco: e.target.value })} /></Field>
            <Field label="Representante"><Input value={os.fornecedor.representante} onChange={(e) => updF({ representante: e.target.value })} /></Field>
            <Field label="Telefone"><Input value={os.fornecedor.telefone} onChange={(e) => updF({ telefone: maskTelefone(e.target.value) })} inputMode="tel" placeholder="(31) 90000-0000" /></Field>
            <Field label="E-mail"><Input value={os.fornecedor.email} onChange={(e) => updF({ email: e.target.value })} /></Field>
            <Field label="Banco"><Input value={os.fornecedor.dadosBancarios.banco} onChange={(e) => updB({ banco: e.target.value })} /></Field>
            <Field label="Agência"><Input value={os.fornecedor.dadosBancarios.agencia} onChange={(e) => updB({ agencia: e.target.value })} /></Field>
            <Field label="Conta"><Input value={os.fornecedor.dadosBancarios.conta} onChange={(e) => updB({ conta: e.target.value })} /></Field>
            <Field label="Chave Pix"><Input value={os.fornecedor.dadosBancarios.chavePix} onChange={(e) => updB({ chavePix: e.target.value })} /></Field>
          </div>
        </Card>

        {/* Detalhamento */}
        <Card>
          <CardTitle>Detalhamento da contratação</CardTitle>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Modalidade">
              <Select value={os.modalidade} onChange={(e) => setOs((o) => (o ? { ...o, modalidade: e.target.value as Modalidade } : o))}>
                <option value="">Selecione…</option>
                {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Entrega"><Input value={os.entrega} onChange={(e) => setOs((o) => (o ? { ...o, entrega: e.target.value } : o))} placeholder="Instalação, operação, acompanhamento…" /></Field>
            <Field label="Descritivo do item" hint="(auto da EC)" className="md:col-span-2">
              <Textarea className="min-h-[90px]" value={os.descritivo} onChange={(e) => setOs((o) => (o ? { ...o, descritivo: e.target.value } : o))} />
              {flags.descritivoIA && (
                <button onClick={descricaoIA} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary-dark hover:underline">
                  <IcSpark width={14} height={14} /> Gerar com IA
                </button>
              )}
            </Field>
            <Field label="Observações" className="md:col-span-2"><Textarea value={os.observacoes} onChange={(e) => setOs((o) => (o ? { ...o, observacoes: e.target.value } : o))} /></Field>
          </div>
        </Card>

        {/* Cronograma específico */}
        <Card padded={false}>
          <div className="p-5 flex items-center justify-between">
            <CardTitle>Cronograma específico do fornecedor</CardTitle>
            <Button variant="secondary" size="sm" onClick={() => setOs((o) => (o ? { ...o, cronograma: [...o.cronograma, { etapa: "", data: "", horario: "", atividades: "" }] } : o))}>+ Etapa</Button>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {os.cronograma.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_120px_1.4fr_auto] gap-2 items-center">
                <Input className="!h-9" placeholder="Etapa (Montagem…)" value={c.etapa} onChange={(e) => setCron(i, { etapa: e.target.value })} />
                <Input className="!h-9" type="date" value={c.data} onChange={(e) => setCron(i, { data: e.target.value })} />
                <Input className="!h-9" placeholder="Horário" value={c.horario} onChange={(e) => setCron(i, { horario: e.target.value })} />
                <Input className="!h-9" placeholder="Atividades" value={c.atividades} onChange={(e) => setCron(i, { atividades: e.target.value })} />
                <button className="text-ink-3 hover:text-danger px-2" onClick={() => setOs((o) => (o ? { ...o, cronograma: o.cronograma.filter((_, j) => j !== i) } : o))}>✕</button>
              </div>
            ))}
          </div>
        </Card>

        {/* Credenciamento + Orçamento */}
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <Card>
            <CardTitle
              hint="O fornecedor abre o link e cadastra equipe e veículos — as respostas aparecem abaixo"
              action={
                <Button variant="soft" size="sm" icon={<IcSend width={15} height={15} />} onClick={enviarLinkCredenciamento} disabled={busy || !os.slugCredenciamento}>
                  Enviar ao fornecedor
                </Button>
              }
            >
              Credenciamento
            </CardTitle>
            <div className="grid gap-4">
              <Field label="Link público do formulário" hint="(envie ao fornecedor)">
                {os.slugCredenciamento ? (
                  <div className="flex gap-2">
                    <Input readOnly value={linkCredenciamento} onFocus={(e) => e.currentTarget.select()} className="!text-[12.5px]" />
                    <Button type="button" variant="secondary" size="sm" icon={<IcLink width={15} height={15} />}
                      onClick={() => { navigator.clipboard?.writeText(linkCredenciamento); setCopiadoCred(true); setTimeout(() => setCopiadoCred(false), 1800); }}>
                      {copiadoCred ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-ink-3 bg-bg rounded-btn px-3 py-2.5">Salve a OS para gerar o link de credenciamento.</p>
                )}
              </Field>
              <Field label="Prazo limite"><Input type="date" value={os.credenciamento.prazoLimite} onChange={(e) => setOs((o) => (o ? { ...o, credenciamento: { ...o.credenciamento, prazoLimite: e.target.value } } : o))} /></Field>
            </div>

            {(credResp ?? []).length > 0 && (
              <div className="mt-4 border-t border-border-soft pt-4">
                <Eyebrow>Credenciamentos recebidos ({(credResp ?? []).length})</Eyebrow>
                <div className="mt-2 space-y-3">
                  {(credResp ?? []).map((c) => (
                    <div key={c.id} className="rounded-btn bg-[#FAFAFB] border border-border-soft p-3">
                      <div className="text-[11.5px] text-ink-3 mb-1.5">Enviado em {dataHoraBR(c.enviadoEm)}</div>
                      {c.equipe.length > 0 && (
                        <div className="text-[12.5px] text-ink mb-1">
                          <b>Equipe:</b> {c.equipe.map((p) => `${p.nome}${p.funcao ? ` (${p.funcao})` : ""}${p.cpf ? ` — ${p.cpf}` : ""}`).join("; ")}
                        </div>
                      )}
                      {c.veiculos.length > 0 && (
                        <div className="text-[12.5px] text-ink">
                          <b>Veículos:</b> {c.veiculos.map((v) => `${v.modelo}${v.placa ? ` — ${v.placa}` : ""}`).join("; ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <Card>
            <CardTitle>Orçamento</CardTitle>
            <div className="grid grid-cols-2 gap-4">
              <Leitura label="Valor do item na EC" v={brl(os.orcamento.valorEc)} />
              <Field label="Documento fiscal">
                <Select value={os.orcamento.documentoFiscal} onChange={(e) => updOrc({ documentoFiscal: e.target.value as DocumentoFiscal })}>
                  <option value="">Selecione…</option>
                  {DOCS.map((d) => <option key={d}>{d}</option>)}
                </Select>
              </Field>
              <Field label="Valor com BV e NF"><NumberInput value={os.orcamento.valorComBvNf} onValue={(v) => updOrc({ valorComBvNf: v })} /></Field>
              <Field label="Valor sem BV e sem NF"><NumberInput value={os.orcamento.valorSemBvSemNf} onValue={(v) => updOrc({ valorSemBvSemNf: v })} /></Field>
            </div>
          </Card>
        </div>

        {/* Acerto Financeiro — BV (a Produção negocia o BV; visível a todos os perfis) */}
        <Card>
          <CardTitle hint="Quem negocia o BV com o fornecedor é a Produção. Justificativa obrigatória quando não há BV ou é abaixo de 15%.">
            Acerto Financeiro — BV
          </CardTitle>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="BV Pólobh (%)">
              <NumberInput value={os.financeiro.bvPercentual} onValue={(v) => updFin({ bvPercentual: v, bvValor: (os.financeiro.valorTotal * v) / 100 })} />
            </Field>
            <Field
              label="Justificativa do BV"
              hint={bvPrecisaJustif ? "(obrigatória)" : "(opcional)"}
              className="md:col-span-2"
            >
              <Textarea
                value={os.financeiro.bvJustificativa ?? ""}
                onChange={(e) => updFin({ bvJustificativa: e.target.value })}
                placeholder="Registre o motivo quando não houver BV ou for abaixo de 15% (ex.: condição negociada com o fornecedor)."
                className={bvJustifFaltando ? "!border-danger" : ""}
              />
              {bvJustifFaltando && (
                <p className="mt-1 text-[12px] font-semibold text-danger">Obrigatória: o BV está {os.financeiro.bvPercentual <= 0 ? "zerado" : "abaixo de 15%"}.</p>
              )}
            </Field>
          </div>
        </Card>

        {/* Financeiro Pólobh (restrito) */}
        {verFinanceiro ? (
          <Card className="border-active-border">
            <CardTitle hint="Bloco restrito — Direção e Administrativo">Financeiro Pólobh</CardTitle>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Tomador">
                <Select value={os.financeiro.tomador} onChange={(e) => updFin({ tomador: e.target.value as Os["financeiro"]["tomador"] })}>
                  <option value="">Selecione…</option>
                  <option value="Polobh">Pólobh</option>
                  <option value="Cliente">Cliente</option>
                </Select>
              </Field>
              <Field label="CNAE" hint={os.fornecedor.cnaes?.length ? `(${os.fornecedor.cnaes.length} do CNPJ)` : "(consulte o CNPJ)"}>
                <Input
                  list="cnae-fornecedor"
                  value={os.financeiro.cnae}
                  onChange={(e) => updFin({ cnae: e.target.value })}
                  placeholder="Selecione ou digite"
                />
                <datalist id="cnae-fornecedor">
                  {(os.fornecedor.cnaes ?? []).map((c, i) => (
                    <option key={i} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Código de serviço"><Input value={os.financeiro.codigoServico} onChange={(e) => updFin({ codigoServico: e.target.value })} /></Field>
              <Field label="Descritivo NF" className="md:col-span-3"><Textarea value={os.financeiro.descritivoNf} onChange={(e) => updFin({ descritivoNf: e.target.value })} /></Field>
              <Field label="Valor total"><NumberInput value={os.financeiro.valorTotal} onValue={(v) => updFin({ valorTotal: v, valorAPagar: v - os.financeiro.descontoNegociado })} /></Field>
              <Field label="Desconto negociado"><NumberInput value={os.financeiro.descontoNegociado} onValue={(v) => updFin({ descontoNegociado: v, valorAPagar: os.financeiro.valorTotal - v })} /></Field>
              <div className="md:col-span-3 grid grid-cols-3 gap-4">
                <Leitura label="Valor a pagar" v={brl(os.financeiro.valorAPagar)} />
                <Leitura label="BV (%)" v={`${os.financeiro.bvPercentual || 0}%`} />
                <Leitura label="BV (valor)" v={brl((os.financeiro.valorTotal * os.financeiro.bvPercentual) / 100)} />
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-ink-2">O bloco financeiro Pólobh é restrito ao seu perfil.</p>
          </Card>
        )}
      </div>
    </PageShell>
  );

  function setCron(i: number, patch: Partial<Os["cronograma"][number]>) {
    setOs((o) => (o ? { ...o, cronograma: o.cronograma.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : o));
  }
}

function Leitura({ label, v }: { label: string; v: string }) {
  return (
    <div className="py-1">
      <Eyebrow>{label}</Eyebrow>
      <div className="text-sm text-ink font-semibold mt-0.5">{v || "—"}</div>
    </div>
  );
}
