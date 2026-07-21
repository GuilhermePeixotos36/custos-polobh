import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Card,
  CardTitle,
  Button,
  Field,
  Input,
  Textarea,
  NumberInput,
  CurrencyInput,
  Select,
  Eyebrow,
} from "@/components/ui";
import { IcDownload, IcSearch, IcChevron } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import {
  calcularTotais,
  gastoPorLinhaViaOSs,
  numeroEc,
  tituloEc,
  producaoZerada,
  honorariosPadrao,
  encargosPadrao,
} from "@/domain/calc";
import { itensDoTemplate } from "@/domain/ecTemplates";
import { projetoInfoVazio } from "@/domain/projeto";
import { escolherDestinoEcExcel, gerarEcExcel, salvarEcExcelNoDestino, type DestinoEcExcel } from "@/lib/excel";
import { consultarCnpj } from "@/lib/cnpj";
import { corrigirDescricoes, corrigirLinhaEc } from "@/lib/correcaoOrtografica";
import { useAuth } from "@/store/auth";
import { RentabilidadeItens } from "@/components/RentabilidadeItens";
import { EcGrupos } from "@/components/EcGrupos";
import { flags } from "@/lib/flags";
import { toast } from "@/store/toast";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { brl, cx, maskCpfCnpjInput, onlyDigits } from "@/lib/format";
import type {
  Cliente,
  Ec,
  EcLinha,
  Fornecedor,
  ProjetoInfo,
  TaxaConfig,
} from "@/data/types";
import type { EcTotais } from "@/domain/calc";

const novaLinha = (ordem: number): EcLinha => ({
  id: `nl-${Date.now()}-${ordem}-${Math.random().toString(36).slice(2, 6)}`,
  grupo: "GERAL",
  item: "",
  descricao: "",
  descricaoCompleta: "",
  valorPolobh: 0,
  valorCliente: 0,
  valorGasto: 0,
  statusAprovacao: "Pendente",
  fornecedorRazao: "",
  fornecedorCnpj: "",
  fornecedorContato: "",
  faturaNf: "",
  codigoServico: "",
  pedidoCompra: "",
  statusOs: "Pendente",
  contratoStatus: "Pendente",
  observacao: "",
  observacoes: [],
  oculto: false,
  ordem,
});

/** Monta um Fornecedor completo a partir dos campos conhecidos (resto vazio). */
const fornecedorNovo = (p: Partial<Fornecedor>): Fornecedor => ({
  id: "",
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  perfilTributario: "",
  endereco: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  dadosBancarios: { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
  representante: "",
  telefone: "",
  email: "",
  cnaes: [],
  contatos: [],
  ...p,
});

const clienteVazio = (): Cliente => ({
  id: "",
  nome: "",
  razaoSocial: "",
  endereco: "",
  cnpjCpf: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  representante: { nome: "", cargo: "", telefones: "", email: "" },
});

const projetoVazio = projetoInfoVazio;

export function EcForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editando = Boolean(id);
  const { data: existente } = useAsync(() => (id ? repo.ecs.obter(id) : Promise.resolve(undefined)), [id]);

  const verFinanceiro = useAuth((s) => s.pode("financeiro"));
  const [ec, setEc] = useState<Ec | null>(null);
  const [baseline, setBaseline] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Fornecedores registrados — alimentam a lista suspensa por CNPJ na tabela de custos.
  const { data: fornData, reload: reloadForn } = useAsync(() => repo.fornecedores.listar(), []);
  const fornecedores = fornData ?? [];
  // Usuários do sistema — para atribuir observações dos itens.
  const { data: usuariosData } = useAsync(() => repo.auth.usuarios(), []);
  const usuarios = (usuariosData ?? []).map((u) => u.nome).filter(Boolean);
  // OS's desta EC — alimentam automaticamente o "Gasto" da rentabilidade por item.
  const { data: ossData } = useAsync(() => (id ? repo.oss.porEc(id) : Promise.resolve([])), [id]);

  // inicia o formulário e registra a "foto" base para detectar alterações
  const iniciar = (e: Ec) => {
    setEc(e);
    setBaseline(JSON.stringify(e));
  };

  useEffect(() => {
    if (editando) {
      if (existente) iniciar(structuredClone(existente));
    } else if (!ec) {
      const agora = new Date().toISOString();
      const projetoId = params.get("projeto") ?? "";
      const template = (params.get("template") ?? "") as Ec["template"];
      // Pré-preenche as linhas com o modelo escolhido (Corporativo/Cultural).
      const itensTpl = itensDoTemplate(template);
      const linhasIniciais: EcLinha[] = itensTpl.length
        ? itensTpl.map((it, i) => ({
            ...novaLinha(i),
            grupo: it.grupo,
            item: it.item,
            descricao: it.descricao,
          }))
        : [novaLinha(0)];
      const montar = (cliente: Cliente, projeto: ReturnType<typeof projetoVazio>) =>
        iniciar({
          id: "",
          numero: numeroEc(cliente.nome || "Novo Cliente", projeto.titulo || "Novo Projeto", 1),
          slugPublico: "",
          projetoId,
          template,
          versao: 1,
          status: "Rascunho",
          ativa: true,
          clienteId: "",
          cliente,
          projeto,
          linhas: linhasIniciais,
          producao: producaoZerada(),
          honorarios: honorariosPadrao(),
          encargos: encargosPadrao(),
          responsavel: projeto.produtoraResponsavel || "",
          validadeDias: 30,
          criadoEm: agora,
          atualizadoEm: agora,
        });
      // Nova EC dentro de um Projeto: herda Cliente + infos do projeto.
      if (projetoId) {
        repo.projetos.obter(projetoId).then((pr) =>
          montar(pr?.cliente ?? clienteVazio(), pr?.info ?? projetoVazio())
        );
      } else {
        montar(clienteVazio(), projetoVazio());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existente, editando]);

  const t = useMemo(
    () => (ec ? calcularTotais(ec.linhas, ec.producao, ec.honorarios, ec.encargos) : null),
    [ec]
  );
  const gastoPorLinha = useMemo(
    () => (ec ? gastoPorLinhaViaOSs(ec.linhas, ossData ?? []) : {}),
    [ec, ossData]
  );

  const sujo = !!ec && baseline !== "" && JSON.stringify(ec) !== baseline;
  const guard = useUnsavedGuard(sujo);

  if (!ec || !t) {
    return <PageShell breadcrumb={<Crumb>EC</Crumb>} title="Carregando…">{null}</PageShell>;
  }

  // Trava de edição: uma EC só é editável enquanto Rascunho. Depois de finalizada
  // (enviada/aprovada/arquivada), gera-se uma nova versão a partir do detalhe.
  if (editando && ec.status !== "Rascunho") {
    return (
      <PageShell breadcrumb={<Crumb>EC</Crumb>} title="Edição bloqueada">
        <Card>
          <CardTitle>Esta EC não pode mais ser editada</CardTitle>
          <p className="mt-2 text-sm text-ink-2">
            A EC <b>{ec.numero}</b> está com status <b>{ec.status}</b>. ECs finalizadas ficam
            preservadas — para alterar algo, gere uma nova versão (02, 03…) a partir do detalhe,
            que arquiva esta e abre uma cópia em Rascunho.
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => navigate(`/estimativas/${ec.id}`)}>Ver EC / gerar nova versão</Button>
          </div>
        </Card>
      </PageShell>
    );
  }

  const upd = (patch: Partial<Ec>) => setEc((e) => (e ? { ...e, ...patch } : e));
  const updCli = (patch: Partial<Cliente>) =>
    setEc((e) => (e ? { ...e, cliente: { ...e.cliente, ...patch } } : e));
  const updProj = (patch: Partial<ProjetoInfo>) =>
    setEc((e) => (e ? { ...e, projeto: { ...e.projeto, ...patch } } : e));

  const numero = numeroEc(ec.cliente.nome || "Cliente", ec.projeto.titulo || "Projeto", ec.versao);
  const temProjeto = Boolean(ec.projetoId);

  /** Valida o CNPJ na Receita e registra o fornecedor no sistema (chamado pela tabela de custos). */
  async function validarFornecedor(cnpj: string): Promise<string | null> {
    try {
      const d = await consultarCnpj(cnpj);
      await repo.fornecedores.salvar(fornecedorNovo({ cnpj: d.cnpj, razaoSocial: d.razaoSocial, nomeFantasia: d.nomeFantasia, endereco: d.endereco, perfilTributario: d.perfilTributario, telefone: d.telefone, email: d.email, inscricaoEstadual: d.inscricaoEstadual, inscricaoMunicipal: d.inscricaoMunicipal, cnaes: d.cnaes }));
      await reloadForn();
      const nome = d.nomeFantasia || d.razaoSocial;
      toast(`Fornecedor ${nome} registrado no sistema.`, "success");
      return nome;
    } catch (e) {
      toast((e as Error).message, "danger");
      return null;
    }
  }

  /** Ao salvar a EC, garante o cadastro de cada fornecedor citado e acumula os contatos. */
  async function acumularFornecedores(linhas: EcLinha[]) {
    const porCnpj = new Map<string, { cnpjRaw: string; razao: string; contatos: Set<string> }>();
    for (const l of linhas) {
      const d = onlyDigits(l.fornecedorCnpj);
      if (d.length !== 14) continue;
      if (!porCnpj.has(d)) porCnpj.set(d, { cnpjRaw: l.fornecedorCnpj, razao: l.fornecedorRazao, contatos: new Set() });
      const e = porCnpj.get(d)!;
      if (!e.razao && l.fornecedorRazao) e.razao = l.fornecedorRazao;
      const c = l.fornecedorContato.trim();
      if (c) e.contatos.add(c);
    }
    for (const [digits, info] of porCnpj) {
      const existente = fornecedores.find((f) => onlyDigits(f.cnpj) === digits);
      if (existente) {
        const atuais = new Set(existente.contatos ?? []);
        const antes = atuais.size;
        info.contatos.forEach((c) => atuais.add(c));
        if (atuais.size !== antes) await repo.fornecedores.salvar({ ...existente, contatos: [...atuais] });
      } else {
        await repo.fornecedores.salvar(fornecedorNovo({ cnpj: info.cnpjRaw, razaoSocial: info.razao, contatos: [...info.contatos] }));
      }
    }
  }

  async function consultar() {
    setCnpjMsg("");
    setCnpjLoading(true);
    try {
      const d = await consultarCnpj(ec!.cliente.cnpjCpf);
      updCli({
        nome: d.nomeFantasia || d.razaoSocial,
        razaoSocial: d.razaoSocial,
        endereco: d.endereco,
        inscricaoEstadual: d.inscricaoEstadual || ec!.cliente.inscricaoEstadual,
        inscricaoMunicipal: d.inscricaoMunicipal || ec!.cliente.inscricaoMunicipal,
      });
      setCnpjMsg("Dados preenchidos pelas fontes cadastrais e fiscais integradas.");
    } catch (e) {
      setCnpjMsg((e as Error).message);
    } finally {
      setCnpjLoading(false);
    }
  }

  async function salvar(linhaId?: string): Promise<boolean> {
    // O salvamento geral revisa todos os textos e exporta o Excel; o botão do item
    // revisa apenas aquela linha e persiste sem abrir o seletor de arquivo.
    const exportarExcel = !linhaId;
    let destino: DestinoEcExcel | null = null;
    if (exportarExcel) {
      // Abre o Explorer já no clique (preserva a ativação do gesto do usuário).
      destino = await escolherDestinoEcExcel({ ...ec!, numero }, "completa");
      if (!destino) {
        toast("Salvamento cancelado: escolha um local para a versão Excel da EC.", "warning");
        return false;
      }
    }
    setSalvando(true);
    try {
      let linhasRevisadas: EcLinha[];
      let revisaoCompleta: boolean;
      if (linhaId) {
        const revisao = await corrigirLinhaEc(ec!.linhas.find((linha) => linha.id === linhaId) ?? ec!.linhas[0]);
        linhasRevisadas = ec!.linhas.map((linha) => linha.id === linhaId ? revisao.linha : linha);
        revisaoCompleta = revisao.revisaoCompleta;
      } else {
        const revisao = await corrigirDescricoes(ec!.linhas);
        linhasRevisadas = revisao.linhas;
        revisaoCompleta = revisao.revisaoCompleta;
      }
      const ecRevisada = { ...ec!, linhas: linhasRevisadas };
      setEc(ecRevisada);
      const salvo = await repo.ecs.salvar({
        ...ecRevisada,
        numero,
        responsavel: ecRevisada.responsavel || ecRevisada.projeto.produtoraResponsavel,
      });
      setEc(salvo);
      // Registra/atualiza os fornecedores citados e acumula seus contatos.
      await acumularFornecedores(ecRevisada.linhas).catch(() => {});
      setBaseline(JSON.stringify(salvo));
      if (!revisaoCompleta) {
        toast("Maiúsculas corrigidas; a revisão ortográfica online estava indisponível.", "info");
      }
      if (exportarExcel && destino) {
        const st = await salvarEcExcelNoDestino(salvo, destino, "completa");
        toast(st === "salvo" ? "EC salva e exportada para Excel." : "EC salva; o Excel foi baixado.", "success");
        guard.liberar();
        navigate(`/estimativas/${salvo.id}`);
      } else {
        // Item revisado e salvo — permanece na edição para continuar o trabalho.
        toast("Item revisado e salvo.", "success");
      }
      return true;
    } catch (e) {
      toast(`Erro ao salvar: ${(e as Error).message}`, "danger");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PageShell
      breadcrumb={
        <>
          <button onClick={() => navigate(ec.projetoId ? `/projetos/${ec.projetoId}?aba=ec` : "/projetos")} className="hover:text-ink">{ec.projeto.titulo || "Projeto"}</button>
          <IcChevron width={14} height={14} />
          <Crumb>{editando ? "Editar EC" : "Nova EC"}</Crumb>
        </>
      }
      title={editando ? "Editar Estimativa" : "Nova Estimativa"}
      topAction={
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => gerarEcExcel({ ...ec, numero }, { modelo: "financeiro" })}>
            Excel Financeiro
          </Button>
          <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => gerarEcExcel({ ...ec, numero }, { modelo: "completa" })}>
            Excel Completa
          </Button>
          <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      {/* Banner título automático */}
      <div className="mb-5 rounded-card bg-black text-white px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <Eyebrow><span className="text-white/50">Título automático da EC</span></Eyebrow>
          <div className="font-display font-bold text-lg tracking-tight mt-1 break-words">{tituloEc({ ...ec, numero })}</div>
          <div className="text-white/40 text-[12px] mt-0.5">{numero}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!ec.ativa && <span className="text-[11px] font-extrabold uppercase bg-white/10 text-white/70 rounded-pill px-2 py-1">Arquivada</span>}
          <span className="text-white/60 text-[13px]">Versão</span>
          <span className="font-display font-bold text-amber text-lg">V{String(ec.versao).padStart(2, "0")}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Cliente e Projeto só aparecem em EC avulsa; dentro de um Projeto os dados
            ficam na aba "Dados Gerais" e não são reeditados aqui. */}
        {!temProjeto && (
        <>
        {/* Cliente */}
        <Card>
          <CardTitle action={
            <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={consultar} disabled={cnpjLoading || !flags.consultaCnpj}>
              {cnpjLoading ? "Consultando…" : "Consultar CNPJ"}
            </Button>
          }>Cliente</CardTitle>
          {cnpjMsg && <div className="mb-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{cnpjMsg}</div>}
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="CNPJ/CPF"><Input value={ec.cliente.cnpjCpf} onChange={(e) => updCli({ cnpjCpf: maskCpfCnpjInput(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" /></Field>
            <Field label="Cliente (nome)"><Input formato="titulo" value={ec.cliente.nome} onChange={(e) => updCli({ nome: e.target.value })} /></Field>
            <Field label="Razão Social" className="md:col-span-2"><Input formato="titulo-empresa" value={ec.cliente.razaoSocial} onChange={(e) => updCli({ razaoSocial: e.target.value })} /></Field>
            <Field label="Endereço" className="md:col-span-2"><Input formato="titulo" value={ec.cliente.endereco} onChange={(e) => updCli({ endereco: e.target.value })} /></Field>
            <Field label="Inscrição Estadual"><Input value={ec.cliente.inscricaoEstadual} onChange={(e) => updCli({ inscricaoEstadual: e.target.value })} /></Field>
            <Field label="Inscrição Municipal"><Input value={ec.cliente.inscricaoMunicipal} onChange={(e) => updCli({ inscricaoMunicipal: e.target.value })} /></Field>
            <Field label="Representante"><Input formato="titulo" value={ec.cliente.representante.nome} onChange={(e) => updCli({ representante: { ...ec.cliente.representante, nome: e.target.value } })} /></Field>
            <Field label="E-mail do representante"><Input value={ec.cliente.representante.email} onChange={(e) => updCli({ representante: { ...ec.cliente.representante, email: e.target.value } })} /></Field>
          </div>
        </Card>

        {/* Projeto */}
        <Card>
          <CardTitle>Projeto</CardTitle>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Título do evento" className="md:col-span-2"><Input value={ec.projeto.titulo} onChange={(e) => updProj({ titulo: e.target.value })} /></Field>
            <Field label="Local"><Input formato="titulo" value={ec.projeto.local} onChange={(e) => updProj({ local: e.target.value })} /></Field>
            <Field label="Endereço do local"><Input formato="titulo" value={ec.projeto.enderecoLocal} onChange={(e) => updProj({ enderecoLocal: e.target.value })} /></Field>
            <Field label="Nº de participantes"><Input type="number" value={ec.projeto.participantes ?? ""} onChange={(e) => updProj({ participantes: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Produtora responsável"><Input formato="titulo" value={ec.projeto.produtoraResponsavel} onChange={(e) => updProj({ produtoraResponsavel: e.target.value })} /></Field>
            <Field label="Pré-evento"><Input type="date" value={ec.projeto.preEvento} onChange={(e) => updProj({ preEvento: e.target.value })} /></Field>
            <Field label="Evento"><Input type="date" value={ec.projeto.evento} onChange={(e) => updProj({ evento: e.target.value })} /></Field>
            <Field label="Pós-evento"><Input type="date" value={ec.projeto.posEvento} onChange={(e) => updProj({ posEvento: e.target.value })} /></Field>
            <Field label="Horário"><Input value={ec.projeto.horario} onChange={(e) => updProj({ horario: e.target.value })} placeholder="08h às 18h" /></Field>
            <Field label="Roteiro" className="md:col-span-2"><Textarea value={ec.projeto.roteiro} onChange={(e) => updProj({ roteiro: e.target.value })} /></Field>
          </div>
        </Card>
        </>
        )}

        {/* Estimativa de custos — grupos e itens com arrastar/soltar e colapso */}
        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardTitle hint="Arraste pela alça para reordenar grupos e itens (inclusive entre grupos). Clique na seta para expandir/retrair.">
              Estimativa de custos
            </CardTitle>
          </div>
          <div className="px-5 pb-5">
            <EcGrupos
              linhas={ec.linhas}
              onChange={(linhas) => upd({ linhas })}
              verFinanceiro
              fornecedores={fornecedores}
              usuarios={usuarios}
              onValidarFornecedor={validarFornecedor}
              onRevisarESalvar={(linhaId) => salvar(linhaId)}
            />
          </div>
        </Card>

        {/* Rentabilidade por item (restrito ao financeiro) */}
        {verFinanceiro && (
          <Card padded={false}>
            <div className="p-5">
              <CardTitle hint="O gasto vem automaticamente do valor a pagar das OS's (rateado por item). Não precisa digitar.">
                Rentabilidade por item
              </CardTitle>
            </div>
            <RentabilidadeItens linhas={ec.linhas} gastoPorLinha={gastoPorLinha} />
          </Card>
        )}

        {/* Resumo dos Custos — no rodapé da EC, como nas ECs originais da Pólobh */}
        <Card padded={false}>
          <div className="p-5 pb-3"><CardTitle hint="Os percentuais de Honorários e Encargos são editáveis (percentual ou valor fixo).">Resumo dos Custos</CardTitle></div>
          <ResumoCustos
            t={t}
            honorarios={ec.honorarios}
            encargos={ec.encargos}
            onHonorarios={(honorarios) => upd({ honorarios })}
            onEncargos={(encargos) => upd({ encargos })}
          />
        </Card>
      </div>
    </PageShell>
  );
}

/** Editor de uma taxa: alterna entre percentual (%) e valor fixo (R$). */
function TaxaEditor({ cfg, onChange }: { cfg: TaxaConfig; onChange: (c: TaxaConfig) => void }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Select
        className="!h-8 !w-[68px] !px-2 !text-[12px]"
        value={cfg.modo}
        onChange={(e) => onChange({ modo: e.target.value as TaxaConfig["modo"], valor: cfg.modo === (e.target.value as TaxaConfig["modo"]) ? cfg.valor : 0 })}
      >
        <option value="percentual">%</option>
        <option value="fixo">R$</option>
      </Select>
      {cfg.modo === "percentual" ? (
        <div className="relative">
          <NumberInput
            className="!h-8 !w-24 !px-2 !pr-6 !text-[12px] text-right"
            value={Math.round((cfg.valor || 0) * 10000) / 100}
            onValue={(v) => onChange({ modo: "percentual", valor: (v || 0) / 100 })}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-ink-3">%</span>
        </div>
      ) : (
        <CurrencyInput className="!h-8 !w-32 !px-2 !text-[12px]" value={cfg.valor || 0} onValue={(v) => onChange({ modo: "fixo", valor: v })} />
      )}
    </div>
  );
}

/** Tabela "Resumo dos Custos" (Pólobh × Cliente), espelhando a EC original. */
function ResumoCustos({
  t,
  honorarios,
  encargos,
  onHonorarios,
  onEncargos,
}: {
  t: EcTotais;
  honorarios: TaxaConfig;
  encargos: TaxaConfig;
  onHonorarios: (c: TaxaConfig) => void;
  onEncargos: (c: TaxaConfig) => void;
}) {
  const subTotalCliente = Math.round((t.somaCliente + t.honorariosCliente) * 100) / 100;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-t border-border">
        <thead>
          <tr className="text-left bg-[#FAFAFB] border-b border-border">
            <th className="px-4 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Descrição</th>
            <th className="px-4 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Pólobh</th>
            <th className="px-4 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Cliente</th>
          </tr>
        </thead>
        <tbody>
          <ResumoLinha desc="Soma dos fornecedores" polobh={t.somaFornecedores} cliente={t.somaCliente} />
          <tr className="border-b border-border-soft">
            <td className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="font-semibold text-ink">Honorários Pólobh (Organização e Planejamento)</span>
                <TaxaEditor cfg={honorarios} onChange={onHonorarios} />
              </div>
            </td>
            <td className="px-4 py-2.5 text-right font-display font-bold text-ink whitespace-nowrap">{brl(t.honorariosPolobh)}</td>
            <td className="px-4 py-2.5 text-right font-semibold text-ink whitespace-nowrap">{brl(t.honorariosCliente)}</td>
          </tr>
          <tr className="border-b border-border-soft">
            <td className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="font-semibold text-ink">Encargos (sobre serviços de terceiros)</span>
                <TaxaEditor cfg={encargos} onChange={onEncargos} />
              </div>
            </td>
            <td className="px-4 py-2.5 text-right font-display font-bold text-ink whitespace-nowrap">{brl(t.encargos)}</td>
            <td className="px-4 py-2.5 text-right text-ink-3">—</td>
          </tr>
          <ResumoLinha desc="Sub-total" polobh={t.subTotalPolobh} cliente={subTotalCliente} strong />
          <tr className="bg-primary-soft">
            <td className="px-4 py-3 font-bold text-ink">Valor total bruto — custo total do projeto</td>
            <td className="px-4 py-3 text-right font-display font-bold text-primary-dark whitespace-nowrap" colSpan={2}>{brl(t.valorTotalBruto)}</td>
          </tr>
          <tr>
            <td className="px-4 pt-3 pb-1 text-[11.5px] font-bold italic text-ink-3" colSpan={3}>Sendo:</td>
          </tr>
          <ResumoLinha desc="Faturamento Pólobh — NF Pólobh × Cliente" polobh={t.faturamentoPolobh} />
          <ResumoLinha desc="Faturamento Terceiros — NF's Terceiros × Cliente" polobh={t.faturamentoTerceiros} />
        </tbody>
      </table>
    </div>
  );
}

function ResumoLinha({ desc, polobh, cliente, strong }: { desc: string; polobh: number; cliente?: number; strong?: boolean }) {
  return (
    <tr className="border-b border-border-soft">
      <td className={cx("px-4 py-2.5", strong ? "font-bold text-ink" : "font-semibold text-ink")}>{desc}</td>
      <td className={cx("px-4 py-2.5 text-right whitespace-nowrap font-display", strong ? "font-bold text-ink" : "font-bold text-ink")}>{brl(polobh)}</td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap text-ink-2">{cliente === undefined ? "" : brl(cliente)}</td>
    </tr>
  );
}
