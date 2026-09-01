import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import {
  Card,
  CardTitle,
  Badge,
  Button,
  Field,
  Input,
  Textarea,
  NumberInput,
  CurrencyInput,
  Select,
} from "@/components/ui";
import { IcDownload, IcSearch, IcBack } from "@/components/icons";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useResponsaveis } from "@/hooks/useResponsaveis";
import {
  calcularTotais,
  gastoPorLinhaViaOSs,
  numeroEc,
  tituloEc,
  producaoZerada,
  honorariosPadrao,
  encargosPadrao,
  limitarPercentual,
  rotuloTaxa,
  ROTULO_HONORARIOS_PADRAO,
  ROTULO_ENCARGOS_PADRAO,
} from "@/domain/calc";
import { itensDoTemplate } from "@/domain/ecTemplates";
import { motivoBloqueioEc, situacaoEc, ROTULO_SITUACAO_EC, TOM_SITUACAO_EC } from "@/domain/ec";
import { projetoInfoVazio } from "@/domain/projeto";
import { gerarEcExcel } from "@/lib/excel";
import { consultarCnpj } from "@/lib/cnpj";
import { corrigirMaiusculas, corrigirMaiusculasHtml } from "@/lib/correcaoOrtografica";
import { useAuth } from "@/store/auth";
import { RentabilidadeItens } from "@/components/RentabilidadeItens";
import { EcGrupos } from "@/components/EcGrupos";
import { NavegadorPendencias } from "@/components/NavegadorPendencias";
import { pendenciasDaTela } from "@/domain/pendencias";
import { bvVazio } from "@/domain/calc";
import { contatoDeTexto, mesclarContatos } from "@/domain/fornecedor";
import { useMinhasPendencias } from "@/store/pendencias";
import { useSugestoes } from "@/hooks/useSugestoes";
import { EcSubGuias, type SubGuiaEc } from "@/components/EcSubGuias";
import { flags } from "@/lib/flags";
import { toast } from "@/store/toast";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { brl, cx, maskCpfCnpjInput, onlyDigits } from "@/lib/format";
import type {
  Cliente,
  ContatoFornecedor,
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
  valorComBvNf: 0,
  valorSemBvComNf: 0,
  valorSemBvSemNf: 0,
  valoresNaoAplicaveis: [],
  opcaoValor: "",
  bv: bvVazio(),
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
  apelido: "",
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
  const [mostrarSalvo, setMostrarSalvo] = useState(false);
  const [subaba, setSubaba] = useState<SubGuiaEc>("ec");
  // Fornecedores registrados — alimentam a lista suspensa por CNPJ na tabela de custos.
  const { data: fornData, reload: reloadForn } = useAsync(() => repo.fornecedores.listar(), []);
  const fornecedores = fornData ?? [];
  // Usuários do sistema — para atribuir observações dos itens.
  const { data: usuariosData } = useAsync(() => repo.auth.usuarios(), []);
  const usuarios = (usuariosData ?? []).map((u) => u.nome).filter(Boolean);
  const produtoresResponsaveis = useResponsaveis(usuariosData);
  // OS's desta EC — alimentam automaticamente o "Gasto" da rentabilidade por item.
  const { data: ossData } = useAsync(() => (id ? repo.oss.porEc(id) : Promise.resolve([])), [id]);
  const { itens: minhasPendencias } = useMinhasPendencias();
  // Valores já usados nestes campos em outras ECs (ver `domain/sugestoes`).
  const sugestoes = useSugestoes();

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
  // Pendências que se resolvem NESTA tela: as observações dos itens e os status
  // a emitir. O que a EC contabiliza mas mora na OS fica de fora — a pílula anda
  // em roda e não pode sair da tela no meio da volta (ver `pendenciasDaTela`).
  const pendenciasDaEc = useMemo(
    () => pendenciasDaTela(minhasPendencias, { ecId: id ?? "" }),
    [minhasPendencias, id]
  );
  /** Quantas pendências o usuário tem em cada linha — vira o badge do item. */
  const pendenciasPorLinha = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const p of pendenciasDaEc) {
      if (p.ancora) mapa[p.ancora] = (mapa[p.ancora] ?? 0) + 1;
    }
    return mapa;
  }, [pendenciasDaEc]);

  const sujo = !!ec && baseline !== "" && JSON.stringify(ec) !== baseline;
  useUnsavedGuard(sujo);

  if (!ec || !t) {
    return <PageShell title="Carregando…">{null}</PageShell>;
  }

  // Trava de edição: só o que já foi FINALIZADO fica preservado (arquivada ou
  // cancelada). Rascunho é sempre editável, ativo ou não — é nele que nascem a
  // importação e a duplicação, e antes elas caíam aqui sem nunca ter sido abertas.
  // Ver `domain/ec`.
  const bloqueio = motivoBloqueioEc(ec);
  if (editando && bloqueio) {
    return (
      <PageShell title="Edição bloqueada">
        <Card>
          <CardTitle>Esta EC não pode mais ser editada</CardTitle>
          <p className="mt-2 text-sm text-ink-2">
            A EC <b>{tituloEc(ec)}</b> {bloqueio}. ECs finalizadas ficam
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

  /**
   * Ao salvar a EC, garante o cadastro de cada fornecedor citado e acumula os
   * contatos.
   *
   * O campo da EC é uma linha de texto solta ("Maria (31) 99999-0000"), então
   * ela é separada em nome/telefone/e-mail antes de entrar na agenda do
   * fornecedor — e um contato de mesmo nome COMPLETA o que já existe em vez de
   * virar uma segunda Maria (ver `mesclarContatos`).
   */
  async function acumularFornecedores(linhas: EcLinha[]) {
    const porCnpj = new Map<string, { cnpjRaw: string; razao: string; contatos: ContatoFornecedor[] }>();
    for (const l of linhas) {
      const d = onlyDigits(l.fornecedorCnpj);
      if (d.length !== 14) continue;
      if (!porCnpj.has(d)) porCnpj.set(d, { cnpjRaw: l.fornecedorCnpj, razao: l.fornecedorRazao, contatos: [] });
      const e = porCnpj.get(d)!;
      if (!e.razao && l.fornecedorRazao) e.razao = l.fornecedorRazao;
      const c = contatoDeTexto(l.fornecedorContato);
      if (c) e.contatos = mesclarContatos(e.contatos, [c]);
    }
    for (const [digits, info] of porCnpj) {
      const existente = fornecedores.find((f) => onlyDigits(f.cnpj) === digits);
      if (existente) {
        const atuais = existente.contatos ?? [];
        const juntos = mesclarContatos(atuais, info.contatos);
        // Só grava se mudou de fato: sem isto, salvar a mesma EC duas vezes
        // reescreveria todos os fornecedores dela sem nenhum motivo.
        if (JSON.stringify(juntos) !== JSON.stringify(atuais)) {
          await repo.fornecedores.salvar({ ...existente, contatos: juntos });
        }
      } else {
        await repo.fornecedores.salvar(fornecedorNovo({ cnpj: info.cnpjRaw, razaoSocial: info.razao, contatos: info.contatos }));
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

  /** Revisar (sem IA): padroniza formatação dos textos — maiúsculas de início de frase e espaçamento. */
  function revisar() {
    setEc((e) =>
      e
        ? {
            ...e,
            linhas: e.linhas.map((linha) => ({
              ...linha,
              item: corrigirMaiusculas(linha.item),
              descricao: corrigirMaiusculas(linha.descricao),
              descricaoCompleta: corrigirMaiusculasHtml(linha.descricaoCompleta),
            })),
          }
        : e
    );
    toast("Textos padronizados (maiúsculas e espaçamento). Confira e salve.", "info");
  }

  /**
   * Salvar (rápido): apenas persiste a EC. Sem IA e sem exportar Excel (use os botões de Excel).
   * Ao concluir, o botão mostra "Salvo" (esmaecido) por um instante e o usuário é levado
   * para a tela de visualização da EC.
   */
  async function salvar(): Promise<boolean> {
    setSalvando(true);
    try {
      const salvo = await repo.ecs.salvar({
        ...ec!,
        numero,
        responsavel: ec!.responsavel || ec!.projeto.produtoraResponsavel,
      });
      setEc(salvo);
      // Registra/atualiza os fornecedores citados e acumula seus contatos.
      await acumularFornecedores(ec!.linhas).catch(() => {});
      setBaseline(JSON.stringify(salvo));
      setSalvando(false);
      setMostrarSalvo(true);
      setTimeout(() => navigate(`/estimativas/${salvo.id}`), 700);
      return true;
    } catch (e) {
      toast(`Erro ao salvar: ${(e as Error).message}`, "danger");
      setSalvando(false);
      return false;
    }
  }

  const rentabilidadeCard = verFinanceiro ? (
    <Card padded={false}>
      <div className="p-5"><CardTitle>Rentabilidade por item</CardTitle></div>
      <RentabilidadeItens linhas={ec.linhas} gastoPorLinha={gastoPorLinha} />
    </Card>
  ) : null;

  const resumoCard = (
    <Card padded={false}>
      <div className="p-5 pb-3"><CardTitle>Resumo dos Custos</CardTitle></div>
      <ResumoCustos
        t={t}
        honorarios={ec.honorarios}
        encargos={ec.encargos}
        honorariosRotulo={ec.honorariosRotulo}
        encargosRotulo={ec.encargosRotulo}
        onHonorarios={(honorarios) => upd({ honorarios })}
        onEncargos={(encargos) => upd({ encargos })}
        onHonorariosRotulo={(honorariosRotulo) => upd({ honorariosRotulo })}
        onEncargosRotulo={(encargosRotulo) => upd({ encargosRotulo })}
      />
    </Card>
  );

  const voltarUrl = ec.projetoId ? `/projetos/${ec.projetoId}?aba=ec` : "/projetos";
  // Mesma leitura do EcDetail e da lista do projeto (ver `domain/ec`): um rascunho
  // que não é a versão ativa é "Rascunho", e não "Arquivada".
  const situacao = situacaoEc(ec);
  const statusBadge = <Badge tom={TOM_SITUACAO_EC[situacao]}>{ROTULO_SITUACAO_EC[situacao]}</Badge>;

  return (
    <PageShell
      title={tituloEc({ ...ec, numero })}
      titleAdornment={statusBadge}
      // As ações grudam junto com o título (ver PageShell): em EC longa, elas
      // continuam à mão enquanto se rola a lista de itens.
      acoes={
        <>
          <button onClick={() => navigate(voltarUrl)} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink font-semibold shrink-0">
            <IcBack width={16} height={16} /> Voltar ao projeto
          </button>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => gerarEcExcel({ ...ec, numero }, { modelo: "financeiro" })}>
              Excel Financeiro
            </Button>
            <Button variant="secondary" size="sm" icon={<IcDownload width={16} height={16} />} onClick={() => gerarEcExcel({ ...ec, numero }, { modelo: "completa" })}>
              Excel Completa
            </Button>
            <Button variant="secondary" size="sm" onClick={revisar} disabled={salvando} title="Padroniza a formatação dos textos (sem IA)">
              Revisar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(editando ? `/estimativas/${ec.id}` : voltarUrl)}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void salvar()} disabled={salvando || mostrarSalvo}>
              {salvando ? "Salvando…" : mostrarSalvo ? "Salvo" : "Salvar"}
            </Button>
          </div>
        </>
      }
      // Grudam com o cabeçalho: trocar de subaba no meio da lista de itens não
      // pode obrigar a voltar ao topo.
      subabas={<EcSubGuias atual={subaba} onChange={setSubaba} temResumo={verFinanceiro} temRentabilidade={verFinanceiro} />}
    >
      {/* Pílula flutuante que salta entre as pendências desta EC. */}
      {subaba === "ec" && <NavegadorPendencias pendencias={pendenciasDaEc} />}

      {verFinanceiro && subaba === "resumo" && <div className="space-y-4">{resumoCard}</div>}
      {verFinanceiro && subaba === "rentabilidade" && <div className="space-y-4">{rentabilidadeCard}</div>}

      {subaba === "ec" && (
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
            <Field label="Cliente (nome)"><Input formato="titulo" sugestoes={sugestoes.valores.clienteNome} value={ec.cliente.nome} onChange={(e) => updCli({ nome: e.target.value })} /></Field>
            <Field label="Razão Social" className="md:col-span-2"><Input formato="titulo-empresa" sugestoes={sugestoes.valores.clienteRazaoSocial} value={ec.cliente.razaoSocial} onChange={(e) => updCli({ razaoSocial: e.target.value })} /></Field>
            <Field label="Endereço" className="md:col-span-2"><Input formato="titulo" sugestoes={sugestoes.valores.clienteEndereco} value={ec.cliente.endereco} onChange={(e) => updCli({ endereco: e.target.value })} /></Field>
            <Field label="Inscrição Estadual"><Input value={ec.cliente.inscricaoEstadual} onChange={(e) => updCli({ inscricaoEstadual: e.target.value })} /></Field>
            <Field label="Inscrição Municipal"><Input value={ec.cliente.inscricaoMunicipal} onChange={(e) => updCli({ inscricaoMunicipal: e.target.value })} /></Field>
            <Field label="Representante"><Input formato="titulo" sugestoes={sugestoes.valores.representante} value={ec.cliente.representante.nome} onChange={(e) => updCli({ representante: { ...ec.cliente.representante, nome: e.target.value } })} /></Field>
            <Field label="E-mail do representante"><Input sugestoes={sugestoes.valores.representanteEmail} value={ec.cliente.representante.email} onChange={(e) => updCli({ representante: { ...ec.cliente.representante, email: e.target.value } })} /></Field>
          </div>
        </Card>

        {/* Projeto */}
        <Card>
          <CardTitle>Projeto</CardTitle>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Título do evento" className="md:col-span-2"><Input sugestoes={sugestoes.valores.nomeProjeto} value={ec.projeto.titulo} onChange={(e) => updProj({ titulo: e.target.value })} /></Field>
            <Field label="Local"><Input formato="titulo" sugestoes={sugestoes.valores.local} value={ec.projeto.local} onChange={(e) => updProj({ local: e.target.value })} /></Field>
            <Field label="Endereço do local"><Input formato="titulo" sugestoes={sugestoes.valores.enderecoLocal} value={ec.projeto.enderecoLocal} onChange={(e) => updProj({ enderecoLocal: e.target.value })} /></Field>
            <Field label="Nº de participantes"><Input type="number" value={ec.projeto.participantes ?? ""} onChange={(e) => updProj({ participantes: e.target.value ? Number(e.target.value) : null })} /></Field>
            {/* Seletor, não texto livre: este nome é quem recebe as pendências do projeto. */}
            <Field label="Produtora responsável">
              <Select value={ec.projeto.produtoraResponsavel} onChange={(e) => updProj({ produtoraResponsavel: e.target.value })}>
                <option value="">Selecione…</option>
                {produtoresResponsaveis.map((u) => <option key={u.id} value={u.nome}>{u.nome}</option>)}
              </Select>
            </Field>
            <Field label="Pré-evento"><Input type="date" value={ec.projeto.preEvento} onChange={(e) => updProj({ preEvento: e.target.value })} /></Field>
            <Field label="Evento"><Input type="date" value={ec.projeto.evento} onChange={(e) => updProj({ evento: e.target.value })} /></Field>
            <Field label="Pós-evento"><Input type="date" value={ec.projeto.posEvento} onChange={(e) => updProj({ posEvento: e.target.value })} /></Field>
            <Field label="Horário"><Input sugestoes={sugestoes.valores.horario} value={ec.projeto.horario} onChange={(e) => updProj({ horario: e.target.value })} placeholder="08h às 18h" /></Field>
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
              verFinanceiro={verFinanceiro}
              fornecedores={fornecedores}
              usuarios={usuarios}
              sugestoes={sugestoes}
              pendenciasPorLinha={pendenciasPorLinha}
              onValidarFornecedor={validarFornecedor}
            />
          </div>
        </Card>

        {/* Totais (Resumo dos Custos) permanece como último bloco da guia geral da EC — só financeiro */}
        {verFinanceiro && resumoCard}
      </div>
      )}
    </PageShell>
  );
}

/**
 * Editor de uma taxa: alterna entre percentual (%) e valor fixo (R$).
 *
 * No modo percentual o valor é travado em 0–100,00% (não existe taxa de 150%) e,
 * quando `comMinimo`, aparece o campo de taxa mínima: o sistema cobra o maior
 * entre o percentual e esse piso.
 */
function TaxaEditor({ cfg, onChange, comMinimo = false }: { cfg: TaxaConfig; onChange: (c: TaxaConfig) => void; comMinimo?: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <Select
        className="!h-8 !w-[68px] !px-2 !text-[12px]"
        value={cfg.modo}
        onChange={(e) => {
          const modo = e.target.value as TaxaConfig["modo"];
          onChange({ ...cfg, modo, valor: cfg.modo === modo ? cfg.valor : 0 });
        }}
      >
        <option value="percentual">%</option>
        <option value="fixo">R$</option>
      </Select>
      {cfg.modo === "percentual" ? (
        <>
          <div className="relative">
            <NumberInput
              className="!h-8 !w-24 !px-2 !pr-6 !text-[12px] text-right"
              min={0}
              max={100}
              step={0.01}
              value={Math.round(limitarPercentual(cfg.valor || 0) * 10000) / 100}
              onValue={(v) => onChange({ ...cfg, modo: "percentual", valor: limitarPercentual((v || 0) / 100) })}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-ink-3">%</span>
          </div>
          {comMinimo && (
            <label className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-3">
              mín.
              <CurrencyInput
                className="!h-8 !w-28 !px-2 !text-[12px]"
                value={cfg.minimo || 0}
                onValue={(v) => onChange({ ...cfg, minimo: v })}
                title="Taxa mínima: quando o percentual render menos que este valor, cobra-se o mínimo"
              />
            </label>
          )}
        </>
      ) : (
        <CurrencyInput className="!h-8 !w-32 !px-2 !text-[12px]" value={cfg.valor || 0} onValue={(v) => onChange({ ...cfg, modo: "fixo", valor: v })} />
      )}
    </div>
  );
}

/** Tabela "Resumo dos Custos" (Pólobh × Cliente), espelhando a EC original. */
function ResumoCustos({
  t,
  honorarios,
  encargos,
  honorariosRotulo,
  encargosRotulo,
  onHonorarios,
  onEncargos,
  onHonorariosRotulo,
  onEncargosRotulo,
}: {
  t: EcTotais;
  honorarios: TaxaConfig;
  encargos: TaxaConfig;
  honorariosRotulo?: string;
  encargosRotulo?: string;
  onHonorarios: (c: TaxaConfig) => void;
  onEncargos: (c: TaxaConfig) => void;
  onHonorariosRotulo: (v: string) => void;
  onEncargosRotulo: (v: string) => void;
}) {
  const rotuloClasse =
    "font-semibold text-ink bg-transparent outline-none border-b border-dashed border-transparent hover:border-border focus:border-primary-dark min-w-0 flex-1 mr-2";
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
                <input className={rotuloClasse} value={honorariosRotulo ?? ""} placeholder={ROTULO_HONORARIOS_PADRAO} onChange={(e) => onHonorariosRotulo(e.target.value)} title="Rótulo editável — aparece também na planilha" />
                <TaxaEditor cfg={honorarios} onChange={onHonorarios} comMinimo />
              </div>
              <p className="mt-1 text-[11.5px] text-ink-3">{rotuloTaxa(honorarios, t.honorariosMinimoAplicado)}</p>
            </td>
            <td className="px-4 py-2.5 text-right font-display font-bold text-ink whitespace-nowrap">{brl(t.honorariosPolobh)}</td>
            <td className="px-4 py-2.5 text-right font-display font-bold text-ink whitespace-nowrap">{brl(t.honorariosCliente)}</td>
          </tr>
          <tr className="border-b border-border-soft">
            <td className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <input className={rotuloClasse} value={encargosRotulo ?? ""} placeholder={ROTULO_ENCARGOS_PADRAO} onChange={(e) => onEncargosRotulo(e.target.value)} title="Rótulo editável — aparece também na planilha" />
                <TaxaEditor cfg={encargos} onChange={onEncargos} />
              </div>
            </td>
            <td className="px-4 py-2.5 text-right font-display font-bold text-ink whitespace-nowrap">{brl(t.encargos)}</td>
            <td className="px-4 py-2.5 text-right text-ink-3">—</td>
          </tr>
          <ResumoLinha desc="Sub-total" polobh={t.subTotalPolobh} cliente={subTotalCliente} strong />
          <tr className="bg-primary-soft">
            <td className="px-4 py-3 font-bold text-ink">Valor Total Bruto (Custo Total do Projeto)</td>
            <td className="px-4 py-3 text-right font-display font-bold text-primary-dark whitespace-nowrap" colSpan={2}>{brl(t.valorTotalBruto)}</td>
          </tr>
          <tr>
            <td className="px-4 pt-3 pb-1 text-[11.5px] font-bold italic text-ink-3" colSpan={3}>Sendo:</td>
          </tr>
          <ResumoLinha desc="Faturamento Pólobh — NF Pólobh × Cliente" polobh={t.faturamentoPolobh} colSpanValor />
          <ResumoLinha desc="Faturamento Terceiros — NF's Terceiros × Cliente" polobh={t.faturamentoTerceiros} colSpanValor />
        </tbody>
      </table>
    </div>
  );
}

function ResumoLinha({
  desc,
  polobh,
  cliente,
  strong,
  colSpanValor,
}: {
  desc: string;
  polobh: number;
  cliente?: number;
  strong?: boolean;
  /** Valor único mesclando as duas colunas (Pólobh+Cliente) — alinha à direita com o Valor Total Bruto. */
  colSpanValor?: boolean;
}) {
  return (
    <tr className="border-b border-border-soft">
      <td className={cx("px-4 py-2.5", strong ? "font-bold text-ink" : "font-semibold text-ink")}>{desc}</td>
      {colSpanValor ? (
        <td className="px-4 py-2.5 text-right whitespace-nowrap font-display font-bold text-ink" colSpan={2}>{brl(polobh)}</td>
      ) : (
        <>
          <td className="px-4 py-2.5 text-right whitespace-nowrap font-display font-bold text-ink">{brl(polobh)}</td>
          <td className="px-4 py-2.5 text-right whitespace-nowrap font-display font-bold text-ink">{cliente === undefined ? "" : brl(cliente)}</td>
        </>
      )}
    </tr>
  );
}
