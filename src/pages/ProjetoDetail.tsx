import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Card, CardTitle, Button, Field, Input, Label, TelefoneInput, Textarea, Select, Badge,
  Table, THead, Th, Tr, Td, EmptyState, tomStatusOs, type Tom,
} from "@/components/ui";
import { IcChevron, IcPlus, IcBack, IcDownload, IcSearch, IcTrash, IcEye, IcEyeOff } from "@/components/icons";
import { RichTextField } from "@/components/RichTextField";
import { TimelineConsolidada, type ItemConsolidado } from "@/components/Timeline";
import { NotifDot } from "@/components/NotifDot";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useMinhasPendencias } from "@/store/pendencias";
import { gerarCronogramaExcel } from "@/lib/excel";
import { consultarCnpj, documentoFiscalValido } from "@/lib/cnpj";
import { tituloEc } from "@/domain/calc";
import { ETAPAS_CRONOGRAMA, compoeTituloProjeto, novaFaixaCronograma, projetoInfoVazio, sincronizarCamposLegados } from "@/domain/projeto";
import { flags } from "@/lib/flags";
import { cx, dataBR, maskCpfCnpjInput, maskDoc, onlyDigits } from "@/lib/format";
import { toast } from "@/store/toast";
import { corrigirRoteirosProjeto } from "@/lib/correcaoOrtografica";
import { statusProjetoAutomatico } from "@/domain/statusProjeto";
import type { Cliente, EtapaCronogramaProjeto, FaixaCronogramaProjeto, Projeto, ProjetoInfo, StatusProjeto } from "@/data/types";

const tomStatusProjeto: Record<StatusProjeto, Tom> = {
  Ativo: "success", Arquivado: "neutral", Concluido: "info", Cancelado: "danger",
};

const clienteVazio = (): Cliente => ({
  id: "", nome: "", razaoSocial: "", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  representante: { nome: "", cargo: "", telefones: "", email: "" },
});
const projetoVazio = (): Projeto => ({
  id: "", nome: "", cliente: clienteVazio(), info: projetoInfoVazio(),
  docsUrl: "", status: "Ativo", criadoEm: "", atualizadoEm: "",
});

type Aba = "dados" | "ec" | "os" | "cronograma" | "fornecedores";
const ABAS: { key: Aba; label: string }[] = [
  { key: "dados", label: "Dados Gerais" },
  { key: "ec", label: "EC" },
  { key: "os", label: "OS" },
  { key: "cronograma", label: "Cronograma" },
  { key: "fornecedores", label: "Fornecedores" },
];

export function ProjetoDetail() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const novo = id === "novo";
  const abaParam = params.get("aba");
  const abaInicial: Aba = ABAS.some((a) => a.key === abaParam) ? (abaParam as Aba) : "dados";
  const { porAba, porOs, porEc } = useMinhasPendencias();

  const { data: existente, loading } = useAsync(() => (novo ? Promise.resolve(undefined) : repo.projetos.obter(id)), [id]);
  const { data: ecsAll } = useAsync(() => repo.ecs.listar(), []);
  const { data: ossAll } = useAsync(() => repo.oss.listar(), []);
  const { data: clientesAll } = useAsync(() => repo.clientes.listar(), []);

  const [p, setP] = useState<Projeto>(projetoVazio());
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [salvando, setSalvando] = useState(false);
  const [filtroEc, setFiltroEc] = useState<"todas" | "ativas" | "arquivadas">("todas");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState("");
  const [cnpjFoco, setCnpjFoco] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  useEffect(() => {
    if (novo) setP(projetoVazio());
    else if (existente) setP(structuredClone(existente));
  }, [existente, novo]);

  const ecsDoProjeto = useMemo(
    () =>
      (ecsAll ?? [])
        .filter((e) => e.projetoId === id)
        .sort((a, b) => Number(b.ativa) - Number(a.ativa) || b.versao - a.versao),
    [ecsAll, id]
  );
  const ecsFiltradas = useMemo(
    () => ecsDoProjeto.filter((ec) => filtroEc === "todas" || (filtroEc === "ativas" ? ec.ativa : !ec.ativa)),
    [ecsDoProjeto, filtroEc]
  );
  const ecIds = useMemo(() => new Set(ecsDoProjeto.map((e) => e.id)), [ecsDoProjeto]);
  const ossDoProjeto = useMemo(() => (ossAll ?? []).filter((o) => ecIds.has(o.ecId)), [ossAll, ecIds]);
  const statusExibido = useMemo(() => statusProjetoAutomatico(p, ecsDoProjeto), [p, ecsDoProjeto]);

  const etapas = useMemo<ItemConsolidado[]>(
    () => ossDoProjeto.flatMap((o) => o.cronograma.map((c) => ({ ...c, fornecedor: o.fornecedor.razaoSocial || "Fornecedor" }))),
    [ossDoProjeto]
  );
  const fornecedores = useMemo(() => {
    const m = new Map<string, { razao: string; cnpj: string; email: string }>();
    for (const o of ossDoProjeto) {
      const f = o.fornecedor;
      const chave = f.cnpj || f.razaoSocial;
      if (chave && !m.has(chave)) m.set(chave, { razao: f.razaoSocial, cnpj: f.cnpj, email: f.email });
    }
    return [...m.values()];
  }, [ossDoProjeto]);

  // Linhas do cronograma (uma por etapa da OS, com Data e Horário próprios).
  // Se ainda não houver etapas cadastradas nas OSs, cai para as contratações da EC.
  const linhasCronograma = useMemo(() => {
    const doOs = etapas
      .filter((e) => e.data || e.horario || e.etapa || e.atividades)
      .map((e) => ({
        data: dataBR(e.data),
        horario: e.horario || "",
        fornecedor: e.fornecedor || "",
        descritivo: [e.etapa, e.atividades].filter(Boolean).join(" — "),
        produtor: "",
      }));
    if (doOs.length) {
      return doOs.sort((a, b) => (a.data || "").localeCompare(b.data || "") || a.horario.localeCompare(b.horario));
    }
    // Fallback: contratações da EC (sem data/horário — a equipe preenche).
    const ecLinhas = ecsDoProjeto.filter((e) => e.status !== "Cancelada").flatMap((e) => e.linhas);
    const comForn = ecLinhas.filter((l) => l.fornecedorRazao.trim());
    const base = comForn.length ? comForn : ecLinhas.filter((l) => l.item || l.descricao);
    return base.map((l) => ({
      data: "",
      horario: "",
      fornecedor: l.fornecedorRazao,
      descritivo: [l.item, l.descricao].filter(Boolean).join(" — "),
      produtor: "",
    }));
  }, [etapas, ecsDoProjeto]);

  async function baixarCronograma() {
    const info = p.info;
    const data = info.preEvento && info.posEvento
      ? `${dataBR(info.preEvento)} a ${dataBR(info.posEvento)}`
      : dataBR(info.evento);
    try {
      await gerarCronogramaExcel({
        cliente: p.cliente.nome,
        titulo: info.titulo,
        modalidade: info.modalidade,
        data,
        horario: info.horario,
        local: info.local,
        enderecoLocal: info.enderecoLocal,
        itens: linhasCronograma,
        nomeArquivo: `Cronograma - ${p.nome || info.titulo || "Projeto"}`,
      });
      toast("Cronograma exportado para Excel.", "success");
    } catch (e) {
      toast(`Erro ao gerar o cronograma: ${(e as Error).message}`, "danger");
    }
  }

  const updCli = (patch: Partial<Cliente>) => setP((x) => ({ ...x, cliente: { ...x.cliente, ...patch } }));

  // Autocomplete de cliente pelo CNPJ/CPF: sugere cadastros já arquivados cujo
  // número começa com o que foi digitado (ex.: digitar "0" já filtra os que começam com 0).
  const cnpjDigitado = onlyDigits(p.cliente.cnpjCpf);
  const sugestoesCliente = useMemo(() => {
    if (!cnpjDigitado) return [];
    return (clientesAll ?? [])
      .filter((c) => {
        const d = onlyDigits(c.cnpjCpf);
        return d.startsWith(cnpjDigitado) && d !== cnpjDigitado;
      })
      .slice(0, 8);
  }, [clientesAll, cnpjDigitado]);

  function selecionarClienteArquivado(c: Cliente) {
    updCli(c);
    setCnpjFoco(false);
    setCnpjMsg("");
  }
  const updInfo = (patch: Partial<ProjetoInfo>) => setP((x) => ({ ...x, info: { ...x.info, ...patch }, nome: patch.titulo ?? x.nome }));
  const updTituloParte = (patch: Partial<Pick<ProjetoInfo, "clienteAbreviado" | "nomeProjeto" | "anoProjeto">>) => {
    const clienteAbreviado = patch.clienteAbreviado ?? p.info.clienteAbreviado;
    const nomeProjeto = patch.nomeProjeto ?? p.info.nomeProjeto;
    const anoProjeto = patch.anoProjeto ?? p.info.anoProjeto;
    updInfo({ ...patch, titulo: compoeTituloProjeto(clienteAbreviado, nomeProjeto, anoProjeto) });
  };
  const updCronograma = (etapa: EtapaCronogramaProjeto, faixas: FaixaCronogramaProjeto[]) =>
    updInfo({ cronograma: { ...p.info.cronograma, [etapa]: faixas } });
  const updFaixa = (etapa: EtapaCronogramaProjeto, idFaixa: string, patch: Partial<FaixaCronogramaProjeto>) =>
    updCronograma(etapa, p.info.cronograma[etapa].map((faixa) => faixa.id === idFaixa ? { ...faixa, ...patch } : faixa));
  const toggleEtapaOculta = (etapa: EtapaCronogramaProjeto) =>
    updInfo({
      etapasOcultas: p.info.etapasOcultas.includes(etapa)
        ? p.info.etapasOcultas.filter((e) => e !== etapa)
        : [...p.info.etapasOcultas, etapa],
    });
  const toggleRoteiroOculto = (secao: keyof ProjetoInfo["roteiros"]) =>
    updInfo({
      roteirosOcultos: p.info.roteirosOcultos.includes(secao)
        ? p.info.roteirosOcultos.filter((s) => s !== secao)
        : [...p.info.roteirosOcultos, secao],
    });

  async function consultarCnpjCliente() {
    setCnpjMsg("");
    setCnpjLoading(true);
    try {
      const d = await consultarCnpj(p.cliente.cnpjCpf);
      updCli({
        nome: p.cliente.nome || d.nomeFantasia || d.razaoSocial,
        razaoSocial: d.razaoSocial,
        endereco: d.endereco,
        inscricaoEstadual: d.inscricaoEstadual || p.cliente.inscricaoEstadual,
        inscricaoMunicipal: d.inscricaoMunicipal || p.cliente.inscricaoMunicipal,
      });
      const preenchidas = [d.inscricaoEstadual && "IE", d.inscricaoMunicipal && "IM"].filter(Boolean).join(" e ");
      setCnpjMsg(preenchidas
        ? `Dados cadastrais e ${preenchidas} preenchidos automaticamente.`
        : "Dados cadastrais preenchidos. IE/IM não foram encontradas nas fontes integradas e permanecem editáveis.");
    } catch (e) {
      setCnpjMsg((e as Error).message);
    } finally {
      setCnpjLoading(false);
    }
  }

  /** Arquiva os dados do cliente no cadastro central (deduplicado por CNPJ/CPF) para reaproveitar em projetos futuros. */
  async function arquivarCliente(cliente: Cliente): Promise<Cliente> {
    const digitos = onlyDigits(cliente.cnpjCpf);
    if (!digitos) return cliente;
    const existenteArquivado = (clientesAll ?? []).find((c) => onlyDigits(c.cnpjCpf) === digitos);
    try {
      return await repo.clientes.salvar({ ...cliente, id: existenteArquivado?.id || "" });
    } catch (erro) {
      throw new Error(`Não foi possível arquivar os dados do cliente: ${(erro as Error).message}`);
    }
  }

  const camposObrigatoriosFaltando = (): { chave: string; label: string }[] => {
    const faltando: { chave: string; label: string }[] = [];
    if (!p.info.clienteAbreviado.trim()) faltando.push({ chave: "clienteAbreviado", label: "Cliente (abreviação)" });
    if (!p.info.nomeProjeto.trim()) faltando.push({ chave: "nomeProjeto", label: "Nome do projeto" });
    if (!/^(19\d{2}|20\d{2}|2100)$/.test(p.info.anoProjeto.trim())) faltando.push({ chave: "anoProjeto", label: "Ano (1900 a 2100)" });
    if (!p.cliente.nome.trim()) faltando.push({ chave: "clienteNome", label: "Cliente (nome)" });
    if (!documentoFiscalValido(p.cliente.cnpjCpf)) faltando.push({ chave: "cnpjCpf", label: "CNPJ/CPF válido" });
    if (!p.info.modalidade) faltando.push({ chave: "modalidade", label: "Modalidade" });
    if (!p.info.local.trim()) faltando.push({ chave: "local", label: "Local" });
    if (!p.info.cronograma.evento.some((f) => f.data.trim())) faltando.push({ chave: "cronogramaEvento", label: "Data do evento (cronograma)" });
    return faltando;
  };

  // Derivado a cada render: assim que um campo apontado é corrigido, o destaque
  // vermelho some sozinho — não precisa tentar salvar de novo para "limpar".
  const faltandoAtual = camposObrigatoriosFaltando();
  const chavesComErro = new Set(tentouSalvar ? faltandoAtual.map((f) => f.chave) : []);

  async function salvar() {
    const faltando = camposObrigatoriosFaltando();
    if (faltando.length) {
      setTentouSalvar(true);
      toast(`Preencha os campos obrigatórios: ${faltando.map((f) => f.label).join(", ")}.`, "danger");
      return;
    }
    setSalvando(true);
    try {
      const revisao = await corrigirRoteirosProjeto(p.info.roteiros);
      const info = sincronizarCamposLegados({ ...p.info, roteiros: revisao.roteiros });
      const cliente = await arquivarCliente(p.cliente);
      const salvo = await repo.projetos.salvar({ ...p, cliente, info, nome: info.titulo || p.nome || "Projeto" });
      setP(salvo);
      toast(revisao.revisaoCompleta
        ? "Projeto salvo e roteiros revisados automaticamente."
        : "Projeto salvo. A correção básica foi aplicada; a revisão por IA está indisponível no momento.", "success");
      navigate(`/projetos/${salvo.id}`);
    } catch (e) {
      toast(`Erro ao salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <PageShell breadcrumb={<Crumb>Projeto</Crumb>} title="Carregando…">{null}</PageShell>;
  if (!novo && !existente) return <PageShell breadcrumb={<Crumb>Projeto</Crumb>} title="Projeto não encontrado">{null}</PageShell>;

  return (
    <PageShell
      breadcrumb={
        <>
          <button onClick={() => navigate("/projetos")} className="hover:text-ink">Projetos</button>
          <IcChevron width={14} height={14} />
          <Crumb>{novo ? "Novo projeto" : p.nome || "Projeto"}</Crumb>
        </>
      }
      title={novo ? "Novo projeto" : p.nome || "Projeto"}
      titleAdornment={!novo ? <Badge tom={tomStatusProjeto[statusExibido]}>{statusExibido}</Badge> : undefined}
      topAction={
        (aba === "dados" || novo) && (
          <Button size="sm" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar projeto"}</Button>
        )
      }
    >
      <button onClick={() => navigate("/projetos")} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink mb-4 font-semibold">
        <IcBack width={16} height={16} /> Voltar
      </button>

      {/* Subguias */}
      <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto">
        {ABAS.map((a) => {
          const bloqueada = novo && a.key !== "dados";
          return (
            <button
              key={a.key}
              disabled={bloqueada}
              onClick={() => setAba(a.key)}
              className={cx(
                "px-4 h-10 text-[13.5px] font-bold whitespace-nowrap border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5",
                bloqueada ? "text-ink-3/40 cursor-not-allowed border-transparent"
                  : aba === a.key ? "text-primary-dark border-primary" : "text-ink-2 hover:text-ink border-transparent"
              )}
            >
              {a.label}
              <NotifDot inline n={novo ? 0 : porAba[`${id}:${a.key}`] ?? 0} title="Ações pendentes nesta etapa" />
            </button>
          );
        })}
      </div>

      {aba === "dados" && (
        <div className="space-y-4">
          <Card>
              <CardTitle action={
                <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={consultarCnpjCliente} disabled={cnpjLoading || !flags.consultaCnpj}>
                  {cnpjLoading ? "Consultando…" : "Consultar CNPJ"}
                </Button>
              }>Cliente</CardTitle>
              {cnpjMsg && <div className="mb-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{cnpjMsg}</div>}
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="CNPJ/CPF">
                  <div className="relative">
                    <Input
                      value={p.cliente.cnpjCpf}
                      inputMode="numeric"
                      autoComplete="off"
                      erro={chavesComErro.has("cnpjCpf")}
                      onChange={(e) => updCli({ cnpjCpf: maskCpfCnpjInput(e.target.value) })}
                      onFocus={() => setCnpjFoco(true)}
                      onBlur={() => setTimeout(() => setCnpjFoco(false), 150)}
                      placeholder="00.000.000/0000-00"
                    />
                    {cnpjFoco && sugestoesCliente.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-btn border border-border-soft bg-surface shadow-lg">
                        {sugestoesCliente.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3.5 py-2 text-sm hover:bg-bg border-b border-border-soft last:border-b-0"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selecionarClienteArquivado(c)}
                          >
                            <div className="font-bold text-ink">{maskDoc(c.cnpjCpf)}</div>
                            <div className="text-ink-2 text-[12.5px]">{c.nome || c.razaoSocial}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Cliente (nome)"><Input formato="titulo" erro={chavesComErro.has("clienteNome")} value={p.cliente.nome} onChange={(e) => updCli({ nome: e.target.value })} /></Field>
                <Field label="Razão Social" className="sm:col-span-2"><Input formato="titulo-empresa" value={p.cliente.razaoSocial} onChange={(e) => updCli({ razaoSocial: e.target.value })} /></Field>
                <Field label="Endereço" className="sm:col-span-2"><Input formato="titulo" value={p.cliente.endereco} onChange={(e) => updCli({ endereco: e.target.value })} /></Field>
                <Field label="Inscrição Estadual"><Input value={p.cliente.inscricaoEstadual} onChange={(e) => updCli({ inscricaoEstadual: e.target.value })} /></Field>
                <Field label="Inscrição Municipal">
                  <div className="flex gap-2">
                    <Input value={p.cliente.inscricaoMunicipal} onChange={(e) => updCli({ inscricaoMunicipal: e.target.value })} />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      title="Consultar Inscrição Municipal no portal da Prefeitura de Belo Horizonte"
                      aria-label="Consultar Inscrição Municipal na Prefeitura de Belo Horizonte"
                      icon={<IcSearch width={15} height={15} />}
                      onClick={() => window.open("https://mobiliarioonline.pbh.gov.br/mobiliario-cadastro-publico/f/t/emiteficwebsel", "_blank", "noopener,noreferrer")}
                    >
                      Consultar na PBH
                    </Button>
                  </div>
                </Field>
                <Field label="Representante"><Input formato="titulo" value={p.cliente.representante.nome} onChange={(e) => updCli({ representante: { ...p.cliente.representante, nome: e.target.value } })} /></Field>
                <Field label="Telefone do representante"><TelefoneInput value={p.cliente.representante.telefones} onChange={(v) => updCli({ representante: { ...p.cliente.representante, telefones: v } })} /></Field>
                <Field label="E-mail do representante"><Input value={p.cliente.representante.email} onChange={(e) => updCli({ representante: { ...p.cliente.representante, email: e.target.value } })} /></Field>
              </div>
          </Card>

          <Card>
            <CardTitle>Informações do projeto</CardTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Cliente (abreviação)"><Input erro={chavesComErro.has("clienteAbreviado")} value={p.info.clienteAbreviado} onChange={(e) => updTituloParte({ clienteAbreviado: e.target.value })} placeholder="Ex.: ACME" /></Field>
              <Field label="Nome do projeto"><Input formato="titulo" erro={chavesComErro.has("nomeProjeto")} value={p.info.nomeProjeto} onChange={(e) => updTituloParte({ nomeProjeto: e.target.value })} /></Field>
              <Field label="Ano"><Input erro={chavesComErro.has("anoProjeto")} value={p.info.anoProjeto} inputMode="numeric" onChange={(e) => updTituloParte({ anoProjeto: onlyDigits(e.target.value).slice(0, 4) })} placeholder="2026" /></Field>
              <Field label="Modalidade">
                <Select erro={chavesComErro.has("modalidade")} value={p.info.modalidade} onChange={(e) => updInfo({ modalidade: e.target.value as ProjetoInfo["modalidade"] })}>
                  <option value="">Selecione</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Corporativo">Corporativo</option>
                </Select>
              </Field>
              <Field label="Local"><Input formato="titulo" erro={chavesComErro.has("local")} value={p.info.local} onChange={(e) => updInfo({ local: e.target.value })} /></Field>
              <Field label="Endereço do local"><Input formato="titulo" value={p.info.enderecoLocal} onChange={(e) => updInfo({ enderecoLocal: e.target.value })} /></Field>
              <Field label="Nº de participantes"><Input type="number" value={p.info.participantes ?? ""} onChange={(e) => updInfo({ participantes: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Nome da produtora responsável"><Input formato="titulo" value={p.info.produtoraResponsavel} onChange={(e) => updInfo({ produtoraResponsavel: e.target.value })} /></Field>
              <Field label="Telefone da produtora responsável"><TelefoneInput value={p.info.telefoneProdutora} onChange={(v) => updInfo({ telefoneProdutora: v })} /></Field>
              <Field label="E-mail da produtora responsável"><Input type="email" value={p.info.emailProdutora} onChange={(e) => updInfo({ emailProdutora: e.target.value })} /></Field>
              {p.info.modalidade === "Cultural" && (
                <Field label="Incentivos Fiscais" className="sm:col-span-2 lg:col-span-3"><Textarea value={p.info.incentivosFiscais} onChange={(e) => updInfo({ incentivosFiscais: e.target.value })} /></Field>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle hint="Cada etapa pode ter uma ou mais datas, com horários de início e fim.">Cronograma</CardTitle>
            <div className="space-y-5">
              {ETAPAS_CRONOGRAMA.map(({ key, label }) => {
                const oculta = p.info.etapasOcultas.includes(key);
                return (
                  <section key={key} aria-labelledby={`cronograma-${key}`} className="rounded-btn border border-border-soft p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 id={`cronograma-${key}`} className="text-sm font-bold text-ink">{label}</h3>
                      <Button
                        type="button"
                        variant="text"
                        size="sm"
                        aria-label={oculta ? `Reexibir ${label}` : `Ocultar ${label}`}
                        title={oculta ? "Reexibir etapa" : "Ocultar etapa"}
                        icon={oculta ? <IcEye width={15} height={15} /> : <IcEyeOff width={15} height={15} />}
                        onClick={() => toggleEtapaOculta(key)}
                      >
                        {oculta ? "Reexibir" : "Ocultar"}
                      </Button>
                    </div>
                    {!oculta && (
                      <div className="space-y-2">
                        {p.info.cronograma[key].map((faixa) => (
                          <div key={faixa.id} className="grid grid-cols-1 sm:grid-cols-[minmax(150px,1fr)_minmax(120px,.7fr)_minmax(120px,.7fr)_auto] gap-2 items-end">
                            <Field label="Data"><Input type="date" erro={key === "evento" && chavesComErro.has("cronogramaEvento") && !faixa.data.trim()} value={faixa.data} onChange={(e) => updFaixa(key, faixa.id, { data: e.target.value })} /></Field>
                            <Field label="Início"><Input type="time" value={faixa.inicio} onChange={(e) => updFaixa(key, faixa.id, { inicio: e.target.value })} /></Field>
                            <Field label="Fim"><Input type="time" value={faixa.fim} onChange={(e) => updFaixa(key, faixa.id, { fim: e.target.value })} /></Field>
                            <div className="flex gap-1 pb-0.5">
                              <Button type="button" variant="soft" size="sm" aria-label={`Adicionar data em ${label}`} icon={<IcPlus width={15} height={15} />} onClick={() => updCronograma(key, [...p.info.cronograma[key], novaFaixaCronograma()])}>Adicionar</Button>
                              {p.info.cronograma[key].length > 1 && (
                                <Button type="button" variant="text" size="sm" aria-label={`Excluir data de ${label}`} icon={<IcTrash width={15} height={15} />} onClick={() => updCronograma(key, p.info.cronograma[key].filter((item) => item.id !== faixa.id))} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardTitle hint="Os textos aceitam parágrafos, negrito e listas. A revisão ortográfica é aplicada ao salvar.">Roteiro</CardTitle>
            <div className="space-y-4">
              {([
                { key: "preEvento", label: "Pré Evento", placeholder: "Descreva o roteiro de pré-evento…" },
                { key: "evento", label: "Evento", placeholder: "Descreva o roteiro do evento…" },
                { key: "posEvento", label: "Pós Evento", placeholder: "Descreva o roteiro de pós-evento…" },
              ] as const).map(({ key, label, placeholder }) => {
                const oculto = p.info.roteirosOcultos.includes(key);
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Label>{label}</Label>
                      <Button
                        type="button"
                        variant="text"
                        size="sm"
                        aria-label={oculto ? `Reexibir ${label}` : `Ocultar ${label}`}
                        title={oculto ? "Reexibir seção" : "Ocultar seção"}
                        icon={oculto ? <IcEye width={15} height={15} /> : <IcEyeOff width={15} height={15} />}
                        onClick={() => toggleRoteiroOculto(key)}
                      >
                        {oculto ? "Reexibir" : "Ocultar"}
                      </Button>
                    </div>
                    {!oculto && (
                      <RichTextField
                        className="[&_[contenteditable]]:min-h-[220px]"
                        value={p.info.roteiros[key]}
                        onChange={(v) => updInfo({ roteiros: { ...p.info.roteiros, [key]: v } })}
                        placeholder={placeholder}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {aba === "ec" && (
        <Card padded={false}>
          <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
            <CardTitle hint="Estimativas de custo deste projeto (incluindo versões)">Estimativas (EC)</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                icon={<IcPlus width={16} height={16} />}
                title={p.info.modalidade ? `Usa o modelo ${p.info.modalidade} (definido em Dados Gerais)` : "Defina a Modalidade em Dados Gerais para carregar um modelo automaticamente"}
                onClick={() => navigate(`/estimativas/nova?projeto=${id}${p.info.modalidade ? `&template=${p.info.modalidade}` : ""}`)}
              >
                Nova EC
              </Button>
              <Button
                size="sm"
                variant="text"
                onClick={() => navigate(`/estimativas/nova?projeto=${id}`)}
              >
                EC em branco
              </Button>
            </div>
          </div>
          <div className="px-5 pb-4 flex items-center gap-1 border-b border-border-soft" role="group" aria-label="Filtrar estimativas">
            {([
              ["todas", "Todas"],
              ["ativas", "Ativas"],
              ["arquivadas", "Arquivadas"],
            ] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtroEc === valor}
                onClick={() => setFiltroEc(valor)}
                className={cx(
                  "h-8 rounded-pill px-3 text-[12.5px] font-bold transition-colors",
                  filtroEc === valor ? "bg-primary-soft text-primary-dark" : "text-ink-2 hover:bg-[#F1F2F5] hover:text-ink"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {ecsDoProjeto.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma EC" hint="Crie a primeira EC deste projeto." /></div>
          ) : ecsFiltradas.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma EC neste filtro" hint="Selecione outro filtro para visualizar as demais estimativas." /></div>
          ) : (
            <Table>
              <THead><Th>Título da EC</Th><Th align="center">Status</Th></THead>
              <tbody>
                {ecsFiltradas.map((e) => (
                  <Tr key={e.id} onClick={() => navigate(`/estimativas/${e.id}`)}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <NotifDot inline n={porEc[e.id] ?? 0} title="Ações pendentes nesta EC" />
                        <div>
                          <div className={cx("font-bold", e.ativa ? "text-primary-dark" : "text-ink")}>{tituloEc(e)}</div>
                          <div className="text-[12px] text-ink-3">{e.numero}</div>
                        </div>
                      </div>
                    </Td>
                    <Td align="center"><Badge tom={e.ativa ? "success" : "neutral"}>{e.ativa ? "Ativa" : "Arquivada"}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {aba === "os" && (
        <Card padded={false}>
          <div className="p-5"><CardTitle hint="Ordens de serviço geradas a partir das ECs deste projeto">Ordens de Serviço</CardTitle></div>
          {ossDoProjeto.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhuma OS" hint="Gere OSs a partir das ECs do projeto." /></div>
          ) : (
            <Table>
              <THead><Th>OS</Th><Th>Fornecedor</Th><Th align="center">Status</Th></THead>
              <tbody>
                {ossDoProjeto.map((o) => (
                  <Tr key={o.id} onClick={() => navigate(`/ordens/${o.id}`)}>
                    <Td className="font-bold">
                      <span className="inline-flex items-center gap-2">
                        <NotifDot inline n={porOs[o.id] ?? 0} title="Esta OS tem ação pendente" />
                        {o.numero}
                      </span>
                    </Td>
                    <Td>{o.fornecedor.razaoSocial || "—"}</Td>
                    <Td align="center"><Badge tom={tomStatusOs[o.status]}>{o.status}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {aba === "cronograma" && (
        <Card>
          <CardTitle
            hint="Linha do tempo consolidada. Baixe o Excel no modelo Pólobh (cabeçalho automático da EC; datas/horários/produtor em branco para a equipe)."
            action={
              <Button size="sm" variant="secondary" icon={<IcDownload width={16} height={16} />} onClick={baixarCronograma}>
                Baixar Excel
              </Button>
            }
          >
            Cronograma consolidado
          </CardTitle>
          <TimelineConsolidada itens={etapas} />
        </Card>
      )}

      {aba === "fornecedores" && (
        <Card padded={false}>
          <div className="p-5"><CardTitle hint="Fornecedores presentes nas OSs deste projeto">Fornecedores do projeto</CardTitle></div>
          {fornecedores.length === 0 ? (
            <div className="p-6"><EmptyState title="Nenhum fornecedor" hint="Aparecem aqui os fornecedores das OSs do projeto." /></div>
          ) : (
            <Table>
              <THead><Th>Fornecedor</Th><Th>CNPJ</Th><Th>Contato</Th></THead>
              <tbody>
                {fornecedores.map((f, i) => (
                  <Tr key={i}>
                    <Td className="font-bold text-ink">{f.razao || "—"}</Td>
                    <Td className="text-[12.5px]">{f.cnpj || "—"}</Td>
                    <Td className="text-[12.5px]">{f.email || "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </PageShell>
  );
}
