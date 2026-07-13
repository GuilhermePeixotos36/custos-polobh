import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Card, CardTitle, Button, Field, Input, Textarea, Select, Badge,
  Table, THead, Th, Tr, Td, EmptyState, tomStatusOs, type Tom,
} from "@/components/ui";
import { IcChevron, IcPlus, IcBack, IcDownload, IcSearch, IcTrash } from "@/components/icons";
import { RichTextField } from "@/components/RichTextField";
import { TimelineConsolidada, type ItemConsolidado } from "@/components/Timeline";
import { NotifDot } from "@/components/NotifDot";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useMinhasPendencias } from "@/store/pendencias";
import { gerarCronogramaExcel } from "@/lib/excel";
import { consultarCnpj } from "@/lib/cnpj";
import { tituloEc } from "@/domain/calc";
import { ETAPAS_CRONOGRAMA, novaFaixaCronograma, projetoInfoVazio, sincronizarCamposLegados } from "@/domain/projeto";
import { flags } from "@/lib/flags";
import { cx, dataBR, maskCpfCnpjInput, maskTelefone } from "@/lib/format";
import { toast } from "@/store/toast";
import { corrigirRoteirosProjeto } from "@/lib/correcaoOrtografica";
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

  const [p, setP] = useState<Projeto>(projetoVazio());
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [salvando, setSalvando] = useState(false);
  const [tplNova, setTplNova] = useState<"Corporativo" | "Cultural" | "">("Corporativo");
  const [filtroEc, setFiltroEc] = useState<"todas" | "ativas" | "arquivadas">("todas");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState("");

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

  const upd = (patch: Partial<Projeto>) => setP((x) => ({ ...x, ...patch }));
  const updCli = (patch: Partial<Cliente>) => setP((x) => ({ ...x, cliente: { ...x.cliente, ...patch } }));
  const updInfo = (patch: Partial<ProjetoInfo>) => setP((x) => ({ ...x, info: { ...x.info, ...patch }, nome: patch.titulo ?? x.nome }));
  const updCronograma = (etapa: EtapaCronogramaProjeto, faixas: FaixaCronogramaProjeto[]) =>
    updInfo({ cronograma: { ...p.info.cronograma, [etapa]: faixas } });
  const updFaixa = (etapa: EtapaCronogramaProjeto, idFaixa: string, patch: Partial<FaixaCronogramaProjeto>) =>
    updCronograma(etapa, p.info.cronograma[etapa].map((faixa) => faixa.id === idFaixa ? { ...faixa, ...patch } : faixa));

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

  async function salvar() {
    setSalvando(true);
    try {
      const revisao = await corrigirRoteirosProjeto(p.info.roteiros);
      const info = sincronizarCamposLegados({ ...p.info, roteiros: revisao.roteiros });
      const salvo = await repo.projetos.salvar({ ...p, info, nome: info.titulo || p.nome || "Projeto" });
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
      titleAdornment={!novo ? <Badge tom={tomStatusProjeto[p.status]}>{p.status}</Badge> : undefined}
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
          <div className="grid xl:grid-cols-2 gap-4 items-start">
            <Card>
              <CardTitle action={
                <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={consultarCnpjCliente} disabled={cnpjLoading || !flags.consultaCnpj}>
                  {cnpjLoading ? "Consultando…" : "Consultar CNPJ"}
                </Button>
              }>Cliente</CardTitle>
              {cnpjMsg && <div className="mb-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{cnpjMsg}</div>}
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="CNPJ/CPF"><Input value={p.cliente.cnpjCpf} inputMode="numeric" onChange={(e) => updCli({ cnpjCpf: maskCpfCnpjInput(e.target.value) })} placeholder="00.000.000/0000-00" /></Field>
                <Field label="Cliente (nome)"><Input value={p.cliente.nome} onChange={(e) => updCli({ nome: e.target.value })} /></Field>
                <Field label="Razão Social" className="sm:col-span-2"><Input value={p.cliente.razaoSocial} onChange={(e) => updCli({ razaoSocial: e.target.value })} /></Field>
                <Field label="Endereço" className="sm:col-span-2"><Input value={p.cliente.endereco} onChange={(e) => updCli({ endereco: e.target.value })} /></Field>
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
                <Field label="Representante"><Input value={p.cliente.representante.nome} onChange={(e) => updCli({ representante: { ...p.cliente.representante, nome: e.target.value } })} /></Field>
                <Field label="Telefone do representante"><Input value={p.cliente.representante.telefones} inputMode="tel" onChange={(e) => updCli({ representante: { ...p.cliente.representante, telefones: maskTelefone(e.target.value) } })} /></Field>
                <Field label="E-mail do representante"><Input value={p.cliente.representante.email} onChange={(e) => updCli({ representante: { ...p.cliente.representante, email: e.target.value } })} /></Field>
              </div>
            </Card>

            <Card>
              <CardTitle>Status do projeto</CardTitle>
              <div className="max-w-sm">
                <Field label="Status">
                  <Select value={p.status} onChange={(e) => upd({ status: e.target.value as StatusProjeto })}>
                    <option value="Ativo">Ativo</option>
                    <option value="Concluido">Concluído</option>
                    <option value="Arquivado">Arquivado</option>
                    <option value="Cancelado">Cancelado</option>
                  </Select>
                </Field>
              </div>
            </Card>
          </div>

          <Card>
            <CardTitle>Informações do projeto</CardTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Título do projeto" className="lg:col-span-3"><Input value={p.info.titulo} onChange={(e) => updInfo({ titulo: e.target.value })} /></Field>
              <Field label="Modalidade">
                <Select value={p.info.modalidade} onChange={(e) => updInfo({ modalidade: e.target.value as ProjetoInfo["modalidade"] })}>
                  <option value="">Selecione</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Corporativo">Corporativo</option>
                </Select>
              </Field>
              <Field label="Local"><Input value={p.info.local} onChange={(e) => updInfo({ local: e.target.value })} /></Field>
              <Field label="Endereço do local"><Input value={p.info.enderecoLocal} onChange={(e) => updInfo({ enderecoLocal: e.target.value })} /></Field>
              <Field label="Nº de participantes"><Input type="number" value={p.info.participantes ?? ""} onChange={(e) => updInfo({ participantes: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Nome da produtora responsável"><Input value={p.info.produtoraResponsavel} onChange={(e) => updInfo({ produtoraResponsavel: e.target.value })} /></Field>
              <Field label="Telefone da produtora responsável"><Input value={p.info.telefoneProdutora} inputMode="tel" onChange={(e) => updInfo({ telefoneProdutora: maskTelefone(e.target.value) })} /></Field>
              <Field label="E-mail da produtora responsável"><Input type="email" value={p.info.emailProdutora} onChange={(e) => updInfo({ emailProdutora: e.target.value })} /></Field>
              <Field label="Incentivos Fiscais" className="sm:col-span-2 lg:col-span-3"><Textarea value={p.info.incentivosFiscais} onChange={(e) => updInfo({ incentivosFiscais: e.target.value })} /></Field>
            </div>
          </Card>

          <Card>
            <CardTitle hint="Cada etapa pode ter uma ou mais datas, com horários de início e fim.">Cronograma</CardTitle>
            <div className="space-y-5">
              {ETAPAS_CRONOGRAMA.map(({ key, label }) => (
                <section key={key} aria-labelledby={`cronograma-${key}`} className="rounded-btn border border-border-soft p-3 sm:p-4">
                  <h3 id={`cronograma-${key}`} className="mb-3 text-sm font-bold text-ink">{label}</h3>
                  <div className="space-y-2">
                    {p.info.cronograma[key].map((faixa) => (
                      <div key={faixa.id} className="grid grid-cols-1 sm:grid-cols-[minmax(150px,1fr)_minmax(120px,.7fr)_minmax(120px,.7fr)_auto] gap-2 items-end">
                        <Field label="Data"><Input type="date" value={faixa.data} onChange={(e) => updFaixa(key, faixa.id, { data: e.target.value })} /></Field>
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
                </section>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle hint="Os textos aceitam parágrafos, negrito e listas. A revisão ortográfica é aplicada ao salvar.">Roteiro</CardTitle>
            <div className="grid lg:grid-cols-3 gap-4">
              <Field label="Pré Evento"><RichTextField value={p.info.roteiros.preEvento} onChange={(preEvento) => updInfo({ roteiros: { ...p.info.roteiros, preEvento } })} placeholder="Descreva o roteiro de pré-evento…" /></Field>
              <Field label="Evento"><RichTextField value={p.info.roteiros.evento} onChange={(evento) => updInfo({ roteiros: { ...p.info.roteiros, evento } })} placeholder="Descreva o roteiro do evento…" /></Field>
              <Field label="Pós Evento"><RichTextField value={p.info.roteiros.posEvento} onChange={(posEvento) => updInfo({ roteiros: { ...p.info.roteiros, posEvento } })} placeholder="Descreva o roteiro de pós-evento…" /></Field>
            </div>
          </Card>
        </div>
      )}

      {aba === "ec" && (
        <Card padded={false}>
          <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
            <CardTitle hint="Estimativas de custo deste projeto (incluindo versões)">Estimativas (EC)</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-ink-3 font-semibold">Modelo</span>
              <Select className="!h-9 !w-40 !text-[13px]" value={tplNova} onChange={(e) => setTplNova(e.target.value as typeof tplNova)}>
                <option value="Corporativo">Corporativo</option>
                <option value="Cultural">Cultural</option>
                <option value="">Em branco</option>
              </Select>
              <Button size="sm" icon={<IcPlus width={16} height={16} />} onClick={() => navigate(`/estimativas/nova?projeto=${id}${tplNova ? `&template=${tplNova}` : ""}`)}>Nova EC</Button>
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
