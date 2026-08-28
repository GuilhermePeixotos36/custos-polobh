import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import {
  Button,
  Field,
  Input,
  TelefoneInput,
  Textarea,
  Select,
  NumberInput,
  Badge,
  tomStatusOs,
  AvisoEmailPendente,
} from "@/components/ui";
import { IcDownload, IcSearch, IcSend, IcChevron, IcSpark, IcLink } from "@/components/icons";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import {
  agruparPorFornecedor,
  descritivoConsolidado,
  numeroOs,
  versaoOs,
  textoObjetoContrato,
  LEI_INCENTIVO_PADRAO,
  FORMA_PAGAMENTO_PADRAO,
  OBS_CONTRATO_PADRAO,
  opcaoEscolhidaDoItem,
  valorItemNaEc,
} from "@/domain/calc";
import { ETAPAS_CRONOGRAMA } from "@/domain/projeto";
import { useEmpresas } from "@/store/empresas";
import { gerarOsExcel } from "@/lib/excel";
import { consultarCnpj } from "@/lib/cnpj";
import { gerarDescritivo } from "@/lib/ai";
import { dispararOsPorEmail, enviarCredenciamento } from "@/lib/email";
import { flags } from "@/lib/flags";
import { brl, cx, dataBR, dataHoraBR, maskCpfCnpjInput } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { usePendencias, useMinhasPendencias } from "@/store/pendencias";
import { useSugestoes } from "@/hooks/useSugestoes";
import { urlCredenciamento } from "@/lib/links";
import { NavegadorPendencias } from "@/components/NavegadorPendencias";
import { idAncoraPendencia } from "@/lib/destaque";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import type {
  DocumentoFiscal,
  Ec,
  EcLinha,
  EmpresaGrupo,
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

/**
 * Status de controle usados nos campos de texto da EC ("Código de Serviço",
 * "Pedido de Compra"). Não são valores reais — não devem vazar para a OS.
 */
const STATUS_CONTROLE_EC = ["pendente", "não se aplica", "nao se aplica"];

/** Id curto para chave de lista (React) — parcelas e etapas do cronograma. */
const novoId = () =>
  globalThis.crypto?.randomUUID?.() ?? `it-${Math.random().toString(36).slice(2)}`;

/** Primeiro valor de verdade da lista (ignora vazios e os status de controle da EC). */
const primeiroPreenchido = (vals: (string | undefined | null)[]): string =>
  vals.find((v) => v && v.trim() && !STATUS_CONTROLE_EC.includes(v.trim().toLowerCase()))?.trim() ?? "";

/**
 * Sugere a modalidade a partir do texto dos itens consolidados e do CNAE.
 * É só uma sugestão exibida ao usuário — a modalidade vai no documento que o
 * fornecedor assina, então nunca é preenchida automaticamente.
 */
function sugerirModalidade(linhas: EcLinha[], f: Fornecedor): Modalidade | "" {
  const texto = [
    ...linhas.map((l) => `${l.grupo} ${l.item} ${l.descricao}`),
    ...(f.cnaes ?? []),
  ]
    .join(" ")
    .toLowerCase();
  if (!texto.trim()) return "";

  const tem = (re: RegExp) => re.test(texto);
  const locacao = tem(/loca(ç|c)(ã|a)o|aluguel|aluga|sonoriza|ilumina|estrutura|palco|tenda|mobili(á|a)rio/);
  const servico = tem(/servi(ç|c)o|opera(ç|c)(ã|a)o|montagem|desmontagem|t(é|e)cnic|equipe|acompanhamento|assessoria|produ(ç|c)(ã|a)o/);
  const produto = tem(/produto|material|impress(ã|a)o|brinde|fornecimento|confec(ç|c)(ã|a)o|comunica(ç|c)(ã|a)o visual/);

  if (locacao && servico) return "Locação + Serviço";
  if (produto && servico) return "Produto + Serviço";
  if (locacao) return "Locação";
  if (produto) return "Produto";
  if (servico) return "Serviço";
  return "";
}

/**
 * Cronograma inicial do fornecedor a partir do cronograma do projeto (EC).
 * Cada faixa preenchida de cada etapa vira uma linha; sem cronograma, cai no Evento.
 */
function cronogramaDoProjeto(ec: Ec): Os["cronograma"] {
  const itens: Os["cronograma"] = [];
  for (const { key, label } of ETAPAS_CRONOGRAMA) {
    if ((ec.projeto.etapasOcultas ?? []).includes(key)) continue;
    for (const f of ec.projeto.cronograma?.[key] ?? []) {
      if (!f.data && !f.inicio && !f.fim) continue;
      itens.push({
        id: novoId(),
        etapa: label,
        data: f.data,
        horario: [f.inicio, f.fim].filter(Boolean).join(" às "),
        atividades: "",
      });
    }
  }
  return itens.length
    ? itens
    : [{ id: novoId(), etapa: "Evento", data: ec.projeto.evento, horario: ec.projeto.horario, atividades: "" }];
}

/**
 * Preenche automaticamente tudo o que já se sabe pelo Projeto/EC.
 * Só toca em campo vazio — nunca sobrescreve o que a equipe digitou. É idempotente,
 * então roda tanto ao criar a OS quanto ao abrir uma já existente.
 */
function aplicarAutoPreenchimento(os: Os, ec: Ec): Os {
  const linhas = ec.linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  const descritivo = os.descritivo || descritivoConsolidado(linhas);

  // Documento fiscal: vem do "Documento PG" já marcado nos itens da EC.
  const docEc = primeiroPreenchido(linhas.map((l) => l.faturaNf));
  const docFiscalEc = (DOCS as string[]).includes(docEc) ? (docEc as DocumentoFiscal) : "";

  // Código de serviço: idem, o que estiver nos itens consolidados.
  const codigoServico = primeiroPreenchido(linhas.map((l) => l.codigoServico));
  // CNAE: só quando o cadastro do fornecedor tem um único — vários exigem escolha.
  const cnaeUnico = os.fornecedor.cnaes?.length === 1 ? os.fornecedor.cnaes[0] : "";

  const descritivoNf = os.financeiro.descritivoNf || descritivo;

  // OSs antigas nasciam com uma única linha "Evento" gerada automaticamente.
  // Ela conta como não-preenchida, para dar lugar ao cronograma real do projeto.
  const so1 = os.cronograma.length === 1 ? os.cronograma[0] : undefined;
  const cronogramaPadraoAntigo =
    !!so1 && so1.etapa === "Evento" && !so1.atividades?.trim() && so1.data === ec.projeto.evento;

  return {
    ...os,
    descritivo,
    // Backfill de id nas etapas/parcelas antigas: dá chave estável para a lista
    // editável (sem isso, remover uma linha do meio rouba o foco da seguinte).
    cronograma: (os.cronograma.length && !cronogramaPadraoAntigo
      ? os.cronograma
      : cronogramaDoProjeto(ec)
    ).map((c) => (c.id ? c : { ...c, id: novoId() })),
    orcamento: {
      ...os.orcamento,
      documentoFiscal: os.orcamento.documentoFiscal || docFiscalEc,
      parcelas: os.orcamento.parcelas.map((p) => (p.id ? p : { ...p, id: novoId() })),
    },
    financeiro: {
      ...os.financeiro,
      descritivoNf,
      codigoServico: os.financeiro.codigoServico || codigoServico,
      cnae: os.financeiro.cnae || cnaeUnico,
      projetoIncentivado:
        os.financeiro.projetoIncentivado || ec.projeto.nomeProjeto || ec.projeto.titulo,
      leiIncentivo: os.financeiro.leiIncentivo || LEI_INCENTIVO_PADRAO,
    },
    contrato: {
      ...os.contrato,
      descritivoServicos: os.contrato.descritivoServicos || descritivoNf,
      formaPagamento: os.contrato.formaPagamento || FORMA_PAGAMENTO_PADRAO,
      observacoesGerais: os.contrato.observacoesGerais || OBS_CONTRATO_PADRAO,
    },
  };
}

export function OsForm() {
  const { id, ecId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const verFinanceiro = pode("financeiro");
  const podeEditar = pode("oss.editar");
  // Empresas do grupo (carregadas no boot) — dados fiscais quando o tomador/contratante é a Pólobh.
  const empresas = useEmpresas((s) => s.empresas);
  const empresaPolobh = empresas.find((e) => e.padrao) ?? empresas[0];

  const { data: osExistente } = useAsync(() => (id ? repo.oss.obter(id) : Promise.resolve(undefined)), [id]);
  const { data: credResp } = useAsync(() => (id ? repo.oss.credenciamentos(id) : Promise.resolve([])), [id]);
  // Usuários do sistema — para atribuir/mencionar em Observações.
  const { data: usuariosData } = useAsync(() => repo.auth.usuarios(), []);
  const usuarios = (usuariosData ?? []).map((u) => u.nome).filter(Boolean);
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

  // edição de OS existente — a EC vem primeiro para o auto-preenchimento já entrar
  // no baseline (a OS abre preenchida sem ficar marcada como alterada).
  useEffect(() => {
    if (id && osExistente) {
      repo.ecs.obter(osExistente.ecId).then((e) => {
        if (!e) return;
        setEcCtx(e);
        iniciar(aplicarAutoPreenchimento(structuredClone(osExistente), e));
      });
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
      repo.oss.porEc(ec.id),
    ]).then(([seq, fornCadastro, ossDaEc]) => {
      const agora = new Date().toISOString();
      const fornecedor = fornCadastro ?? fornecedorVazio(g?.fornecedorRazao, g?.fornecedorCnpj);
      setEcCtx(ec);
      iniciar(aplicarAutoPreenchimento({
        id: "",
        numero: numeroOs(ec, fornecedor, versaoOs(ossDaEc ?? [], ec.id, fornecedor.cnpj, fornecedor.razaoSocial), agora),
        slugCredenciamento: "",
        seq,
        ecId: ec.id,
        ecNumero: ec.numero,
        ecLinhaIds: linhaIds,
        status: "Rascunho",
        fornecedor,
        modalidade: "",
        descritivo: descritivoConsolidado(linhas),
        entrega: "",
        cronograma: [{ etapa: "Evento", data: ec.projeto.evento, horario: ec.projeto.horario, atividades: "" }],
        logistica: { transporteMaterial: "", transporteEquipe: "", hospedagem: "", alimentacao: "", estacionamentoCarga: "", estacionamentoEquipe: "", uniformizacao: "" },
        infraestrutura: { energia: "", internet: "", pontosEletricos: "", estruturas: "", servicosApoio: "", artLaudos: "" },
        observacoes: [],
        // O link só existe depois de salvar: quem o monta é `urlCredenciamento`, a
        // partir do token que o banco gera (ver lib/links).
        credenciamento: { prazoLimite: "", linkFormulario: "" },
        orcamento: { valorEc, valorComBvNf: valorEc, valorSemBvComNf: valorEc, valorSemBvSemNf: valorEc, parcelas: [{ descricao: "Pagamento único", valor: valorEc }], documentoFiscal: "" },
        financeiro: { tomador: "", descritivoNf: "", cnae: "", codigoServico: "", valorUnitario: valorEc, valorTotal: valorEc, descontoNegociado: 0, valorAPagar: valorEc, bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "" },
        contrato: { contratante: "", descritivoServicos: "", informacoesComplementares: "", valorUnitario: valorEc, valorTotal: valorEc, descontoNegociado: 0, valorAPagar: valorEc, dataContrato: "", rubrica: "" },
        criadoEm: agora,
        atualizadoEm: agora,
      }, ec));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ec, id]);

  const sujo = !!os && baseline !== "" && JSON.stringify(os) !== baseline;
  const guard = useUnsavedGuard(sujo);
  // Pendências desta OS — mesma lista que alimenta o badge vermelho dela.
  const { itens: pendenciasDoUsuario } = useMinhasPendencias();
  // Valores já usados nestes campos em outras OSs (ver `domain/sugestoes`).
  const sugestoes = useSugestoes();

  if (!os || !ecCtx) return <PageShell title="Carregando…">{null}</PageShell>;

  // Linhas da EC que esta OS consolida (mesmo fornecedor).
  const linhasConsolidadas = ecCtx.linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  const linkCredenciamento = urlCredenciamento(os);
  // Justificativa do BV é obrigatória quando não há BV ou o percentual é < 15%.
  const bvPrecisaJustif = os.financeiro.bvPercentual < 15;
  const bvJustifFaltando = bvPrecisaJustif && !os.financeiro.bvJustificativa?.trim();

  // Parcelas: a soma tem que fechar com o valor negociado, senão a OS sai errada.
  const somaParcelas = os.orcamento.parcelas.reduce((s, p) => s + (p.valor || 0), 0);
  const refParcelas =
    verFinanceiro && os.financeiro.valorAPagar > 0
      ? { valor: os.financeiro.valorAPagar, rotulo: "valor total a pagar" }
      : { valor: os.orcamento.valorComBvNf, rotulo: "valor com BV e NF" };
  const parcelasDivergem =
    os.orcamento.parcelas.length > 0 &&
    refParcelas.valor > 0 &&
    Math.abs(somaParcelas - refParcelas.valor) > 0.01;

  // Modalidade é obrigatória (vai na OS do fornecedor) e não tem origem confiável
  // na EC — então sugerimos pelo conteúdo dos itens, sem preencher sozinho.
  const modalidadeSugerida = sugerirModalidade(linhasConsolidadas, os.fornecedor);

  // Cronograma do projeto (vindo da EC) — só etapas visíveis e com alguma faixa preenchida.
  const etapasProjeto = ETAPAS_CRONOGRAMA.filter(
    ({ key }) => !(ecCtx.projeto.etapasOcultas ?? []).includes(key)
  )
    .map(({ key, label }) => ({
      key,
      label,
      faixas: (ecCtx.projeto.cronograma?.[key] ?? []).filter((f) => f.data || f.inicio || f.fim),
    }))
    .filter((e) => e.faixas.length > 0);

  const dadosTomador = dadosFiscais(os.financeiro.tomador, ecCtx, empresaPolobh);
  const dadosContratante = dadosFiscais(os.contrato.contratante, ecCtx, empresaPolobh);

  /**
   * O valor negociado no Orçamento é a origem dos valores de Faturamento e
   * Contrato. Propaga para os dois enquanto estiverem espelhados (ou seja,
   * enquanto ninguém os tiver alterado à mão) — assim eles não ficam para trás.
   */
  function setValorNegociado(v: number) {
    setOs((o) => {
      if (!o) return o;
      const anterior = o.orcamento.valorComBvNf;
      const espelhaFin = o.financeiro.valorTotal === anterior;
      const espelhaCt = o.contrato.valorTotal === anterior;
      return {
        ...o,
        orcamento: { ...o.orcamento, valorComBvNf: v },
        financeiro: espelhaFin
          ? { ...o.financeiro, valorUnitario: v, valorTotal: v, valorAPagar: v - o.financeiro.descontoNegociado }
          : o.financeiro,
        contrato: espelhaCt
          ? { ...o.contrato, valorUnitario: v, valorTotal: v, valorAPagar: v - o.contrato.descontoNegociado }
          : o.contrato,
      };
    });
  }

  /** Valor total do Faturamento — replica no Contrato enquanto estiver espelhado. */
  function setValorTotalFinanceiro(v: number) {
    setOs((o) => {
      if (!o) return o;
      const espelhaCt = o.contrato.valorTotal === o.financeiro.valorTotal;
      return {
        ...o,
        financeiro: { ...o.financeiro, valorUnitario: v, valorTotal: v, valorAPagar: v - o.financeiro.descontoNegociado },
        contrato: espelhaCt
          ? { ...o.contrato, valorUnitario: v, valorTotal: v, valorAPagar: v - o.contrato.descontoNegociado }
          : o.contrato,
      };
    });
  }

  const finDessincronizado = verFinanceiro && os.financeiro.valorTotal !== os.orcamento.valorComBvNf;
  const ctDessincronizado = verFinanceiro && os.contrato.valorTotal !== os.financeiro.valorTotal;

  // BV Pólobh — quem negocia com o fornecedor é a Produção, então o bloco precisa
  // continuar acessível a todos os perfis (o salvamento exige a justificativa).
  // Vai dentro de "Dados de Faturamento" para o financeiro e em card próprio para os demais.
  const bvBloco = (
    <>
      <LinhaOs label="BV Pólobh — Percentual">
        <NumberInput value={os.financeiro.bvPercentual} onValue={(v) => updFin({ bvPercentual: v, bvValor: (os.financeiro.valorTotal * v) / 100 })} />
      </LinhaOs>
      <LinhaOs label="BV Pólobh — Valor">
        <Auto v={brl((os.financeiro.valorTotal * os.financeiro.bvPercentual) / 100)} />
      </LinhaOs>
      <LinhaOs label="Justificativa do BV" hint={bvPrecisaJustif ? "(obrigatória)" : "(opcional)"}>
        <Textarea
          value={os.financeiro.bvJustificativa ?? ""}
          onChange={(e) => updFin({ bvJustificativa: e.target.value })}
          placeholder="Registre o motivo quando não houver BV ou for abaixo de 15% (ex.: condição negociada com o fornecedor)."
          className={bvJustifFaltando ? "!border-danger !bg-danger-soft" : ""}
        />
        {bvJustifFaltando && (
          <p className="mt-1 text-[12px] font-semibold text-danger">Obrigatória: o BV está {os.financeiro.bvPercentual <= 0 ? "zerado" : "abaixo de 15%"}.</p>
        )}
      </LinhaOs>
    </>
  );

  const updF = (patch: Partial<Fornecedor>) => setOs((o) => (o ? { ...o, fornecedor: { ...o.fornecedor, ...patch } } : o));
  const updB = (patch: Partial<Fornecedor["dadosBancarios"]>) =>
    setOs((o) => (o ? { ...o, fornecedor: { ...o.fornecedor, dadosBancarios: { ...o.fornecedor.dadosBancarios, ...patch } } } : o));
  const updFin = (patch: Partial<Os["financeiro"]>) => setOs((o) => (o ? { ...o, financeiro: { ...o.financeiro, ...patch } } : o));
  const updOrc = (patch: Partial<Os["orcamento"]>) => setOs((o) => (o ? { ...o, orcamento: { ...o.orcamento, ...patch } } : o));
  const updLog = (patch: Partial<Os["logistica"]>) => setOs((o) => (o ? { ...o, logistica: { ...o.logistica, ...patch } } : o));
  const updInfra = (patch: Partial<Os["infraestrutura"]>) => setOs((o) => (o ? { ...o, infraestrutura: { ...o.infraestrutura, ...patch } } : o));
  const updCt = (patch: Partial<Os["contrato"]>) => setOs((o) => (o ? { ...o, contrato: { ...o.contrato, ...patch } } : o));

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
      // O BV é gravado na própria OS (a Produção negocia), mas depende do
      // `valorTotal`, que mora no bloco restrito. Para quem não vê o financeiro
      // a RLS devolve zero — recalcular aqui gravaria BV = R$ 0,00 por cima do
      // valor real. Nesse caso preservamos o que já está salvo.
      const bvValor = verFinanceiro
        ? (os!.financeiro.valorTotal * os!.financeiro.bvPercentual) / 100
        : os!.financeiro.bvValor;
      // mantém o link de credenciamento coerente com o token da OS (p/ e-mail/impressão)
      const linkCred = urlCredenciamento(os!);
      let salvo = await repo.oss.salvar({
        ...os!,
        status: status === "Disparada" ? os!.status : (status ?? os!.status),
        credenciamento: { ...os!.credenciamento, linkFormulario: linkCred },
        financeiro: { ...os!.financeiro, bvValor },
      });
      iniciar(ecCtx ? aplicarAutoPreenchimento(salvo, ecCtx) : salvo);
      if (status === "Disparada") {
        const r = await dispararOsPorEmail(salvo, ecCtx!);
        if (!r.ok) toast(`OS salva no status anterior; o e-mail não saiu: ${r.motivo}`, "warning");
        else if (r.simulado) toast(`E-mail simulado para ${r.destinatarios.join(", ") || "—"}; a OS não foi marcada como disparada.`, "info");
        else {
          salvo = await repo.oss.salvar({ ...salvo, status: "Disparada" });
          iniciar(ecCtx ? aplicarAutoPreenchimento(salvo, ecCtx) : salvo);
          toast(`OS disparada e e-mail enviado para ${r.destinatarios.join(", ")}.`, "success");
        }
      } else {
        toast("OS salva.", "success");
      }
      usePendencias.getState().carregar(true); // atualiza os badges de pendência
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
          {podeEditar && <Button variant="secondary" size="sm" onClick={() => salvar()} disabled={busy}>Salvar</Button>}
          {podeEditar && <Button size="sm" icon={<IcSend width={15} height={15} />} onClick={() => salvar("Disparada")} disabled={busy}>Disparar OS</Button>}
        </div>
      }
    >
      <AvisoEmailPendente className="mb-4" />

      <div className="space-y-4">
        {/* Cabeçalho do modelo em Excel */}
        <CardOs>
          <Secao>Ordem de Serviço</Secao>
          <LinhaOs label="Número da OS"><Auto v={os.numero} /></LinhaOs>
          <LinhaOs label="Projeto"><Auto v={ecCtx.projeto.titulo} /></LinhaOs>
          <LinhaOs label="Data de emissão"><Auto v={dataBR(os.criadoEm)} /></LinhaOs>
          <LinhaOs label="Status da OS">
            <div className="py-2 flex items-center gap-2 flex-wrap">
              <Badge tom={tomStatusOs[os.status]}>{os.status}</Badge>
              <span className="text-[12.5px] text-ink-3">Consolida {os.ecLinhaIds.length} linha(s) da EC</span>
            </div>
          </LinhaOs>
        </CardOs>

        {/* DADOS DO CLIENTE — automático da EC */}
        <CardOs>
          <Secao>Dados do Cliente</Secao>
          <LinhaOs label="Cliente"><Auto v={ecCtx.cliente.nome} /></LinhaOs>
          <LinhaOs label="Razão Social"><Auto v={ecCtx.cliente.razaoSocial} /></LinhaOs>
          <LinhaOs label="Endereço"><Auto v={ecCtx.cliente.endereco} /></LinhaOs>
          <LinhaOs label="CNPJ/CPF"><Auto v={ecCtx.cliente.cnpjCpf} /></LinhaOs>
          <LinhaOs label="Inscrição Estadual"><Auto v={ecCtx.cliente.inscricaoEstadual} /></LinhaOs>
          <LinhaOs label="Inscrição Municipal"><Auto v={ecCtx.cliente.inscricaoMunicipal} /></LinhaOs>
        </CardOs>

        {/* DADOS DO PROJETO — automático da EC, com o cronograma do projeto */}
        <CardOs>
          <Secao>Dados do Projeto</Secao>
          <LinhaOs label="Título"><Auto v={ecCtx.projeto.titulo} /></LinhaOs>
          <LinhaOs label="Modalidade"><Auto v={ecCtx.projeto.modalidade} /></LinhaOs>
          <LinhaOs label="Incentivos Fiscais"><Auto v={ecCtx.projeto.incentivosFiscais} /></LinhaOs>
          <LinhaOs label="Data"><Auto v={dataBR(ecCtx.projeto.evento)} /></LinhaOs>
          <LinhaOs label="Horário"><Auto v={ecCtx.projeto.horario} /></LinhaOs>
          <LinhaOs label="Local"><Auto v={ecCtx.projeto.local} /></LinhaOs>
          <LinhaOs label="Nº Participantes"><Auto v={ecCtx.projeto.participantes ?? ""} /></LinhaOs>
          <LinhaOs label="Endereço do Local"><Auto v={ecCtx.projeto.enderecoLocal} /></LinhaOs>
          <LinhaOs label="Produtora Responsável"><Auto v={ecCtx.projeto.produtoraResponsavel} /></LinhaOs>
          <LinhaOs label="Telefone"><Auto v={ecCtx.projeto.telefoneProdutora} /></LinhaOs>
          <LinhaOs label="E-mail"><Auto v={ecCtx.projeto.emailProdutora} /></LinhaOs>
          <LinhaOs label="Cronograma do Projeto">
            <div className="py-2 space-y-1">
              {etapasProjeto.length > 0 ? (
                etapasProjeto.map(({ key, label, faixas }) => (
                  <div key={key} className="text-sm text-ink">
                    <span className="font-bold">{label}</span>
                    {" — "}
                    {faixas
                      .map((f) =>
                        [dataBR(f.data), [f.inicio, f.fim].filter(Boolean).join(" às ")]
                          .filter(Boolean)
                          .join(" · ")
                      )
                      .join("  |  ")}
                  </div>
                ))
              ) : (
                <p className="text-[12.5px] text-ink-3">Sem cronograma preenchido no projeto.</p>
              )}
            </div>
          </LinhaOs>
        </CardOs>

        {/* DADOS DO FORNECEDOR */}
        <CardOs>
          <Secao
            acao={
              <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={consultar} disabled={busy || !flags.consultaCnpj}>
                Consultar CNPJ
              </Button>
            }
          >
            Dados do Fornecedor
          </Secao>
          {cnpjMsg && <div className="m-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{cnpjMsg}</div>}
          <LinhaOs label="Fornecedor" hint="(nome fantasia)"><Input formato="titulo" value={os.fornecedor.nomeFantasia ?? ""} onChange={(e) => updF({ nomeFantasia: e.target.value })} /></LinhaOs>
          <LinhaOs label="CNPJ/CPF"><Input value={os.fornecedor.cnpj} onChange={(e) => updF({ cnpj: maskCpfCnpjInput(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" /></LinhaOs>
          <LinhaOs label="Perfil" hint="(MEI / Simples / etc.)"><Input value={os.fornecedor.perfilTributario} onChange={(e) => updF({ perfilTributario: e.target.value })} placeholder="MEI / Simples…" /></LinhaOs>
          <LinhaOs label="Razão Social"><Input formato="titulo-empresa" value={os.fornecedor.razaoSocial} onChange={(e) => updF({ razaoSocial: e.target.value })} /></LinhaOs>
          <LinhaOs label="Endereço"><Input formato="titulo" value={os.fornecedor.endereco} onChange={(e) => updF({ endereco: e.target.value })} /></LinhaOs>
          <LinhaOs label="Inscrição Estadual"><Input value={os.fornecedor.inscricaoEstadual} onChange={(e) => updF({ inscricaoEstadual: e.target.value })} /></LinhaOs>
          <LinhaOs label="Inscrição Municipal"><Input value={os.fornecedor.inscricaoMunicipal} onChange={(e) => updF({ inscricaoMunicipal: e.target.value })} /></LinhaOs>
          <LinhaOs label="Conta PJ / PF">
            <Select value={os.fornecedor.dadosBancarios.tipoConta} onChange={(e) => updB({ tipoConta: e.target.value as Fornecedor["dadosBancarios"]["tipoConta"] })}>
              <option value="">Selecione…</option>
              <option value="PJ">PJ</option>
              <option value="PF">PF</option>
            </Select>
          </LinhaOs>
          <LinhaOs label="Banco"><Input value={os.fornecedor.dadosBancarios.banco} onChange={(e) => updB({ banco: e.target.value })} /></LinhaOs>
          <LinhaOs label="Agência"><Input value={os.fornecedor.dadosBancarios.agencia} onChange={(e) => updB({ agencia: e.target.value })} /></LinhaOs>
          <LinhaOs label="Conta Corrente"><Input value={os.fornecedor.dadosBancarios.conta} onChange={(e) => updB({ conta: e.target.value })} /></LinhaOs>
          <LinhaOs label="Chave Pix"><Input value={os.fornecedor.dadosBancarios.chavePix} onChange={(e) => updB({ chavePix: e.target.value })} /></LinhaOs>
          <LinhaOs label="Representante"><Input formato="titulo" value={os.fornecedor.representante} onChange={(e) => updF({ representante: e.target.value })} /></LinhaOs>
          <LinhaOs label="Telefone"><TelefoneInput value={os.fornecedor.telefone} onChange={(v) => updF({ telefone: v })} /></LinhaOs>
          <LinhaOs label="E-mail"><Input value={os.fornecedor.email} onChange={(e) => updF({ email: e.target.value })} /></LinhaOs>
        </CardOs>

        {/* DETALHAMENTO DA CONTRATAÇÃO */}
        <CardOs>
          <Secao>Detalhamento da Contratação</Secao>
          <LinhaOs label="Modalidade" hint="(obrigatória)">
            <Select
              value={os.modalidade}
              erro={!os.modalidade}
              onChange={(e) => setOs((o) => (o ? { ...o, modalidade: e.target.value as Modalidade } : o))}
            >
              <option value="">Selecione…</option>
              {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
            </Select>
            {!os.modalidade && modalidadeSugerida && (
              <button
                type="button"
                onClick={() => setOs((o) => (o ? { ...o, modalidade: modalidadeSugerida } : o))}
                className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-bold text-primary-dark hover:underline"
              >
                <IcSpark width={13} height={13} /> Sugestão pelos itens: {modalidadeSugerida} — aplicar
              </button>
            )}
            {!os.modalidade && (
              <p className="mt-1 text-[12px] font-semibold text-danger">
                Informe a modalidade — ela vai no documento que o fornecedor recebe.
              </p>
            )}
          </LinhaOs>
          <LinhaOs label="Descritivo" hint="(auto da EC)">
            <Textarea className="min-h-[90px]" value={os.descritivo} onChange={(e) => setOs((o) => (o ? { ...o, descritivo: e.target.value } : o))} />
            {flags.descritivoIA && (
              <button onClick={descricaoIA} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary-dark hover:underline">
                <IcSpark width={14} height={14} /> Gerar com IA
              </button>
            )}
          </LinhaOs>
          <LinhaOs label="Entrega"><Input value={os.entrega} sugestoes={sugestoes.valores.entrega} onChange={(e) => setOs((o) => (o ? { ...o, entrega: e.target.value } : o))} placeholder="Instalação, operação, acompanhamento…" /></LinhaOs>
          <LinhaOs label="Itens da EC" hint={`(${linhasConsolidadas.length} consolidado(s) — origem do descritivo)`}>
            <div className="py-2 space-y-1.5">
              {linhasConsolidadas.map((l) => (
                <div key={l.id} className="text-sm">
                  <span className="font-bold text-ink">{l.item || "—"}</span>
                  <span className="text-[12px] text-ink-3"> · {l.grupo}</span>
                  {verFinanceiro && (
                    <span className="font-display font-bold text-ink"> — {brl(l.valorPolobh + l.valorCliente)}</span>
                  )}
                  {l.descricao && <div className="text-[12px] text-ink-2">{l.descricao}</div>}
                </div>
              ))}
              {verFinanceiro && (
                <div className="text-sm font-display font-bold text-primary-dark pt-1.5 border-t border-border-soft">
                  Total consolidado: {brl(linhasConsolidadas.reduce((s, l) => s + l.valorPolobh + l.valorCliente, 0))}
                </div>
              )}
            </div>
          </LinhaOs>

          {/* Cronograma específico do fornecedor — já vem do cronograma do projeto */}
          <LinhaOs
            label="Cronograma do Fornecedor"
            acao={
              <Button variant="secondary" size="sm" onClick={() => setOs((o) => (o ? { ...o, cronograma: [...o.cronograma, { id: novoId(), etapa: "", data: "", horario: "", atividades: "" }] } : o))}>+ Etapa</Button>
            }
          >
            <div className="py-1.5 space-y-2">
              <div className="grid grid-cols-[150px_130px_1fr_1.5fr_auto] gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3 px-1">
                <span>Data</span><span>Horário</span><span>Etapa</span><span>Descritivo da contratação</span><span />
              </div>
              {os.cronograma.map((c, i) => (
                <div key={c.id ?? i} className="grid grid-cols-[150px_130px_1fr_1.5fr_auto] gap-2 items-center">
                  <Input className="!h-9" type="date" value={c.data} onChange={(e) => setCron(i, { data: e.target.value })} />
                  <Input className="!h-9" placeholder="08h às 18h" value={c.horario} onChange={(e) => setCron(i, { horario: e.target.value })} />
                  <Input className="!h-9" placeholder="Montagem, Ensaio…" value={c.etapa} onChange={(e) => setCron(i, { etapa: e.target.value })} />
                  <Input className="!h-9" placeholder="Descritivo da contratação" value={c.atividades} onChange={(e) => setCron(i, { atividades: e.target.value })} />
                  <button className="text-ink-3 hover:text-danger px-2" onClick={() => setOs((o) => (o ? { ...o, cronograma: o.cronograma.filter((_, j) => j !== i) } : o))}>✕</button>
                </div>
              ))}
              {os.cronograma.length === 0 && <p className="text-[12.5px] text-ink-3 px-1">Nenhuma etapa. Use “+ Etapa” para adicionar.</p>}
            </div>
          </LinhaOs>

          <LinhaOs label="Logística do Fornecedor">
            <div className="py-1.5 grid sm:grid-cols-2 gap-2">
              <Field label="Transporte Material"><Input className="!h-9" sugestoes={sugestoes.valores.transporteMaterial} value={os.logistica.transporteMaterial} onChange={(e) => updLog({ transporteMaterial: e.target.value })} /></Field>
              <Field label="Transporte Equipe"><Input className="!h-9" sugestoes={sugestoes.valores.transporteEquipe} value={os.logistica.transporteEquipe} onChange={(e) => updLog({ transporteEquipe: e.target.value })} /></Field>
              <Field label="Hospedagem Equipe"><Input className="!h-9" sugestoes={sugestoes.valores.hospedagem} value={os.logistica.hospedagem} onChange={(e) => updLog({ hospedagem: e.target.value })} /></Field>
              <Field label="Alimentação Equipe"><Input className="!h-9" sugestoes={sugestoes.valores.alimentacao} value={os.logistica.alimentacao} onChange={(e) => updLog({ alimentacao: e.target.value })} /></Field>
              <Field label="Estacionamento Carga"><Input className="!h-9" sugestoes={sugestoes.valores.estacionamentoCarga} value={os.logistica.estacionamentoCarga} onChange={(e) => updLog({ estacionamentoCarga: e.target.value })} /></Field>
              <Field label="Estacionamento Equipe"><Input className="!h-9" sugestoes={sugestoes.valores.estacionamentoEquipe} value={os.logistica.estacionamentoEquipe} onChange={(e) => updLog({ estacionamentoEquipe: e.target.value })} /></Field>
              <Field label="Uniformização Equipe" className="sm:col-span-2"><Input className="!h-9" sugestoes={sugestoes.valores.uniformizacao} value={os.logistica.uniformizacao} onChange={(e) => updLog({ uniformizacao: e.target.value })} /></Field>
            </div>
          </LinhaOs>

          <LinhaOs label="Infraestrutura">
            <div className="py-1.5 grid sm:grid-cols-2 gap-2">
              <Field label="Energia"><Input className="!h-9" sugestoes={sugestoes.valores.energia} value={os.infraestrutura.energia} onChange={(e) => updInfra({ energia: e.target.value })} /></Field>
              <Field label="Internet"><Input className="!h-9" sugestoes={sugestoes.valores.internet} value={os.infraestrutura.internet} onChange={(e) => updInfra({ internet: e.target.value })} /></Field>
              <Field label="Pontos Elétricos"><Input className="!h-9" sugestoes={sugestoes.valores.pontosEletricos} value={os.infraestrutura.pontosEletricos} onChange={(e) => updInfra({ pontosEletricos: e.target.value })} /></Field>
              <Field label="Estruturas Diversas"><Input className="!h-9" sugestoes={sugestoes.valores.estruturas} value={os.infraestrutura.estruturas} onChange={(e) => updInfra({ estruturas: e.target.value })} /></Field>
              <Field label="Serviços de Apoio"><Input className="!h-9" sugestoes={sugestoes.valores.servicosApoio} value={os.infraestrutura.servicosApoio} onChange={(e) => updInfra({ servicosApoio: e.target.value })} /></Field>
              <Field label="ART, Laudos e Certificações"><Input className="!h-9" sugestoes={sugestoes.valores.artLaudos} value={os.infraestrutura.artLaudos} onChange={(e) => updInfra({ artLaudos: e.target.value })} /></Field>
            </div>
          </LinhaOs>

          <LinhaOs label="Observações Gerais">
            {/* Âncora da OS para o navegador de pendências (as observações da OS
                são pendências como as da EC). */}
            <div className="py-1 -mx-1" id={idAncoraPendencia(os.id)}>
              <ObservacoesThread
                ancora={os.id}
                observacoes={os.observacoes}
                usuarios={usuarios}
                onChange={(observacoes) => setOs((o) => (o ? { ...o, observacoes } : o))}
              />
            </div>
          </LinhaOs>
        </CardOs>

        {/* CREDENCIAMENTO */}
        <div className="space-y-4">
          <CardOs>
            <Secao
              acao={
                <Button variant="soft" size="sm" icon={<IcSend width={15} height={15} />} onClick={enviarLinkCredenciamento} disabled={busy || !os.slugCredenciamento}>
                  Enviar ao fornecedor
                </Button>
              }
            >
              Credenciamento
            </Secao>
            <LinhaOs label="Formulário de Credenciamento" hint="(o fornecedor cadastra equipe e veículos)">
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
            </LinhaOs>
            <LinhaOs label="Prazo Limite">
              <Input type="date" value={os.credenciamento.prazoLimite} onChange={(e) => setOs((o) => (o ? { ...o, credenciamento: { ...o.credenciamento, prazoLimite: e.target.value } } : o))} />
            </LinhaOs>

            {(credResp ?? []).length > 0 && (
              <LinhaOs label="Credenciamentos Recebidos" hint={`(${(credResp ?? []).length})`}>
                <div className="py-2 space-y-3">
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
              </LinhaOs>
            )}
          </CardOs>

          {/* ORÇAMENTO */}
          <CardOs>
            <Secao>Orçamento</Secao>
            {/* Espelho do que a produção escolheu item a item lá na EC — é isto
                que sai na planilha da OS, um bloco por item. Aqui é leitura:
                para mudar, muda-se no item da EC. */}
            <LinhaOs label="Por item (vindo da EC)" hint="(a opção marcada em cada item é a que sai na planilha)">
              <div className="py-1.5 space-y-1.5">
                {linhasConsolidadas.map((l) => {
                  const escolha = opcaoEscolhidaDoItem(l);
                  return (
                    <div key={l.id} className="rounded-btn border border-border-soft bg-[#FAFAFB] px-2.5 py-1.5">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[12.5px] font-bold text-ink">{l.item || l.descricao || "Item"}</span>
                        <span className="text-[11.5px] text-ink-3">
                          Valor na EC: <b className="text-ink-2">{brl(valorItemNaEc(l))}</b>
                        </span>
                      </div>
                      <div className="text-[12px] mt-0.5">
                        {escolha ? (
                          <span className="text-ink-2">
                            <b className="text-primary-dark">{escolha.rotulo}:</b>{" "}
                            {escolha.naoSeAplica ? <i className="text-ink-3">Não se aplica</i> : brl(escolha.valor)}
                          </span>
                        ) : (
                          <span className="text-warning font-semibold">
                            Sem opção de valor escolhida no item da EC.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!linhasConsolidadas.length && (
                  <span className="text-[12.5px] text-ink-3">Esta OS não está ligada a itens da EC.</span>
                )}
              </div>
            </LinhaOs>
            <LinhaOs label="Valor do Item na EC do Projeto" hint="(soma dos itens consolidados)"><Auto v={brl(os.orcamento.valorEc)} /></LinhaOs>
            <LinhaOs label="Valor com BV e NF" hint="(valor negociado — alimenta Faturamento e Contrato)">
              <NumberInput value={os.orcamento.valorComBvNf} onValue={setValorNegociado} />
            </LinhaOs>
            <LinhaOs label="Valor Sem BV e Com Nota Fiscal"><NumberInput value={os.orcamento.valorSemBvComNf} onValue={(v) => updOrc({ valorSemBvComNf: v })} /></LinhaOs>
            <LinhaOs label="Valor Sem BV e Sem NF"><NumberInput value={os.orcamento.valorSemBvSemNf} onValue={(v) => updOrc({ valorSemBvSemNf: v })} /></LinhaOs>

            <LinhaOs
              label="Prazo de Pagamento"
              hint="(parcelas)"
              acao={
                <Button variant="secondary" size="sm" onClick={() => updOrc({ parcelas: [...os.orcamento.parcelas, { id: novoId(), descricao: "", valor: 0 }] })}>+ Parcela</Button>
              }
            >
              <div className="py-1.5 space-y-2">
                {os.orcamento.parcelas.map((pc, i) => (
                  <div key={pc.id ?? i} className="grid grid-cols-[1fr_150px_auto] gap-2 items-center">
                    <Input className="!h-9" placeholder={`Descrição da ${i + 1}ª parcela`} value={pc.descricao} onChange={(e) => updOrc({ parcelas: os.orcamento.parcelas.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })} />
                    <NumberInput className="!h-9" value={pc.valor} onValue={(v) => updOrc({ parcelas: os.orcamento.parcelas.map((x, j) => (j === i ? { ...x, valor: v } : x)) })} />
                    <button className="text-ink-3 hover:text-danger px-2" title="Remover parcela" onClick={() => updOrc({ parcelas: os.orcamento.parcelas.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
                {os.orcamento.parcelas.length === 0 && <p className="text-[12.5px] text-ink-3">Sem parcelas. Use “+ Parcela”.</p>}

                {os.orcamento.parcelas.length > 0 && (
                  <div
                    className={cx(
                      "flex items-center justify-between gap-3 rounded-btn px-3 py-2 text-[12.5px]",
                      parcelasDivergem ? "bg-danger-soft text-danger font-semibold" : "bg-[#FAFAFB] text-ink-2"
                    )}
                  >
                    <span>
                      Soma das parcelas: <b className="font-display">{brl(somaParcelas)}</b>
                    </span>
                    {parcelasDivergem ? (
                      <span>
                        Não fecha com o {refParcelas.rotulo} ({brl(refParcelas.valor)}) — diferença de{" "}
                        {brl(Math.abs(somaParcelas - refParcelas.valor))}.
                      </span>
                    ) : (
                      refParcelas.valor > 0 && <span>Confere com o {refParcelas.rotulo}.</span>
                    )}
                  </div>
                )}
              </div>
            </LinhaOs>

            <LinhaOs label="Documento Fiscal" hint="(auto do “Documento PG” da EC)">
              <Select value={os.orcamento.documentoFiscal} onChange={(e) => updOrc({ documentoFiscal: e.target.value as DocumentoFiscal })}>
                <option value="">Selecione…</option>
                {DOCS.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </LinhaOs>
          </CardOs>
        </div>

        {/* INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO DA PÓLOBH */}
        {verFinanceiro ? (
          <>
          <CardOs className="border-active-border">
            <Secao>Informações a serem preenchidas pelo Financeiro da Pólobh</Secao>
            <SubSecao>Dados Emissão — Recibo Simples | Fatura | Nota Fiscal | Fatura e Nota Fiscal</SubSecao>

            <LinhaOs label="Tomador dos Serviços">
              <Select value={os.financeiro.tomador} onChange={(e) => updFin({ tomador: e.target.value as Os["financeiro"]["tomador"] })}>
                <option value="">Selecione…</option>
                <option value="Polobh">Pólobh</option>
                <option value="Cliente">Cliente</option>
              </Select>
            </LinhaOs>
            {dadosTomador ? (
              <>
                <LinhaOs label="Razão Social"><Auto v={dadosTomador.razaoSocial} /></LinhaOs>
                <LinhaOs label="Endereço"><Auto v={dadosTomador.endereco} /></LinhaOs>
                <LinhaOs label="CNPJ/CPF"><Auto v={dadosTomador.cnpjCpf} /></LinhaOs>
                <LinhaOs label="Inscrição Estadual"><Auto v={dadosTomador.inscricaoEstadual} /></LinhaOs>
                <LinhaOs label="Inscrição Municipal"><Auto v={dadosTomador.inscricaoMunicipal} /></LinhaOs>
              </>
            ) : (
              <LinhaOs label="Dados do Tomador">
                <p className="py-2 text-[12.5px] text-ink-3">Selecione o tomador para carregar os dados fiscais.</p>
              </LinhaOs>
            )}
            <LinhaOs label="Descritivo Nota Fiscal" hint="(auto do descritivo da EC)">
              <Textarea value={os.financeiro.descritivoNf} onChange={(e) => updFin({ descritivoNf: e.target.value })} />
            </LinhaOs>
            <LinhaOs label="Nome do Projeto Incentivado" hint="(auto do projeto)">
              <Input value={os.financeiro.projetoIncentivado ?? ""} onChange={(e) => updFin({ projetoIncentivado: e.target.value })} placeholder="Nome do projeto incentivado" />
            </LinhaOs>
            <LinhaOs label="Lei de Incentivo à Cultura">
              <Input value={os.financeiro.leiIncentivo ?? ""} onChange={(e) => updFin({ leiIncentivo: e.target.value })} placeholder="Ex.: Lei Federal de Incentivo à Cultura (Rouanet)" />
            </LinhaOs>
            <LinhaOs label="Nº do Projeto Incentivado" hint={ecCtx.projeto.incentivosFiscais ? `EC: ${ecCtx.projeto.incentivosFiscais}` : undefined}>
              <Input value={os.financeiro.numeroProjetoIncentivado ?? ""} onChange={(e) => updFin({ numeroProjetoIncentivado: e.target.value })} />
            </LinhaOs>
            <LinhaOs label="CNAE" hint={os.fornecedor.cnaes?.length ? `(${os.fornecedor.cnaes.length} do CNPJ)` : "(consulte o CNPJ)"}>
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
            </LinhaOs>
            <LinhaOs label="Código de Serviço" hint="(auto dos itens da EC)">
              <Input value={os.financeiro.codigoServico} onChange={(e) => updFin({ codigoServico: e.target.value })} />
            </LinhaOs>
            <LinhaOs label="Valor unitário"><NumberInput value={os.financeiro.valorUnitario} onValue={(v) => updFin({ valorUnitario: v })} /></LinhaOs>
            <LinhaOs label="Valor total" hint={finDessincronizado ? undefined : "(espelha o valor negociado no Orçamento)"}>
              <NumberInput value={os.financeiro.valorTotal} onValue={setValorTotalFinanceiro} />
              {finDessincronizado && (
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[12px] text-warning">
                  <span className="font-semibold">
                    Diferente do Orçamento ({brl(os.orcamento.valorComBvNf)}).
                  </span>
                  <button
                    type="button"
                    onClick={() => setValorTotalFinanceiro(os.orcamento.valorComBvNf)}
                    className="font-bold text-primary-dark hover:underline"
                  >
                    Usar o valor do Orçamento
                  </button>
                </div>
              )}
            </LinhaOs>
            <LinhaOs label="Desconto Especial Negociado"><NumberInput value={os.financeiro.descontoNegociado} onValue={(v) => updFin({ descontoNegociado: v, valorAPagar: os.financeiro.valorTotal - v })} /></LinhaOs>
            <LinhaOs label="Valor total a pagar"><Auto v={brl(os.financeiro.valorAPagar)} /></LinhaOs>
            {bvBloco}
            <LinhaOs label="Acerto Financeiro">
              <Textarea value={os.financeiro.acertoFinanceiro} onChange={(e) => updFin({ acertoFinanceiro: e.target.value })} />
            </LinhaOs>

            {/* DADOS PARA CONTRATO */}
            <SubSecao>Dados para Contrato</SubSecao>
            <LinhaOs label="Contratante">
              <Select value={os.contrato.contratante} onChange={(e) => updCt({ contratante: e.target.value as Os["contrato"]["contratante"] })}>
                <option value="">Selecione…</option>
                <option value="Polobh">Pólobh</option>
                <option value="Cliente">Cliente</option>
              </Select>
            </LinhaOs>
            {dadosContratante ? (
              <>
                <LinhaOs label="Razão Social"><Auto v={dadosContratante.razaoSocial} /></LinhaOs>
                <LinhaOs label="Endereço"><Auto v={dadosContratante.endereco} /></LinhaOs>
                <LinhaOs label="CNPJ/CPF"><Auto v={dadosContratante.cnpjCpf} /></LinhaOs>
                <LinhaOs label="Inscrição Estadual"><Auto v={dadosContratante.inscricaoEstadual} /></LinhaOs>
                <LinhaOs label="Inscrição Municipal"><Auto v={dadosContratante.inscricaoMunicipal} /></LinhaOs>
              </>
            ) : (
              <LinhaOs label="Dados do Contratante">
                <p className="py-2 text-[12.5px] text-ink-3">Selecione o contratante para carregar os dados fiscais.</p>
              </LinhaOs>
            )}
            <LinhaOs label="Descritivo dos Serviços e/ou Produtos" hint="(auto do descritivo da NF)">
              {/* Objeto do contrato — montado com os dados de faturamento acima. */}
              <p className="mb-2 text-[13px] text-ink bg-[#FAFAFB] border border-border-soft rounded-btn px-3 py-2.5">
                {textoObjetoContrato(os.financeiro)}
              </p>
              <Textarea value={os.contrato.descritivoServicos} onChange={(e) => updCt({ descritivoServicos: e.target.value })} placeholder="Padrão: vem do Descritivo NF — editável" />
            </LinhaOs>
            <LinhaOs label="Informações Complementares">
              <Textarea value={os.contrato.informacoesComplementares} onChange={(e) => updCt({ informacoesComplementares: e.target.value })} />
            </LinhaOs>
            <LinhaOs label="Valor unitário"><NumberInput value={os.contrato.valorUnitario} onValue={(v) => updCt({ valorUnitario: v })} /></LinhaOs>
            <LinhaOs label="Valor total" hint={ctDessincronizado ? undefined : "(espelha o valor do Faturamento)"}>
              <NumberInput value={os.contrato.valorTotal} onValue={(v) => updCt({ valorUnitario: v, valorTotal: v, valorAPagar: v - os.contrato.descontoNegociado })} />
              {ctDessincronizado && (
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[12px] text-warning">
                  <span className="font-semibold">
                    Diferente do Faturamento ({brl(os.financeiro.valorTotal)}).
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const v = os.financeiro.valorTotal;
                      updCt({ valorUnitario: v, valorTotal: v, valorAPagar: v - os.contrato.descontoNegociado });
                    }}
                    className="font-bold text-primary-dark hover:underline"
                  >
                    Usar o valor do Faturamento
                  </button>
                </div>
              )}
            </LinhaOs>
            <LinhaOs label="Desconto Especial Negociado"><NumberInput value={os.contrato.descontoNegociado} onValue={(v) => updCt({ descontoNegociado: v, valorAPagar: os.contrato.valorTotal - v })} /></LinhaOs>
            <LinhaOs label="Valor total a pagar"><Auto v={brl(os.contrato.valorAPagar)} /></LinhaOs>
            <LinhaOs label="Forma de Pagamento">
              <Input value={os.contrato.formaPagamento ?? ""} onChange={(e) => updCt({ formaPagamento: e.target.value })} placeholder={FORMA_PAGAMENTO_PADRAO} />
            </LinhaOs>
            <LinhaOs label="Observações Gerais">
              <Textarea value={os.contrato.observacoesGerais ?? ""} onChange={(e) => updCt({ observacoesGerais: e.target.value })} />
            </LinhaOs>
            <LinhaOs label="Data do Contrato"><Input type="date" value={os.contrato.dataContrato} onChange={(e) => updCt({ dataContrato: e.target.value })} /></LinhaOs>
            <LinhaOs label="Rubrica"><Input value={os.contrato.rubrica} onChange={(e) => updCt({ rubrica: e.target.value })} /></LinhaOs>
          </CardOs>
          </>
        ) : (
          /* Sem acesso ao financeiro: só o BV, que é negociado pela Produção. */
          <CardOs>
            <Secao>Acerto Financeiro — BV</Secao>
            {bvBloco}
            <p className="p-4 text-sm text-ink-2">Os blocos de faturamento e contrato são restritos ao seu perfil.</p>
          </CardOs>
        )}
      </div>

      {/* Mesma pílula da EC: o número aqui é o do badge desta OS. */}
      <NavegadorPendencias pendencias={pendenciasDoUsuario.filter((p) => p.osId === os.id)} />
    </PageShell>
  );

  function setCron(i: number, patch: Partial<Os["cronograma"][number]>) {
    setOs((o) => (o ? { ...o, cronograma: o.cronograma.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : o));
  }
}

/* ---------------------------------------------------------------------------
 * Layout espelhando o "Modelo Novo" da Pólobh em Excel: faixas de seção e
 * linhas em duas colunas (RÓTULO | VALOR), na mesma ordem da planilha.
 * ------------------------------------------------------------------------- */

/** Bloco/quadro de uma seção — equivale a um trecho da planilha. */
function CardOs({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("bg-surface border border-border rounded-card shadow-card overflow-hidden", className)}>
      {children}
    </div>
  );
}

/**
 * Faixa de seção — cinza das barras do modelo original Pólobh
 * (COR.sectionGray em lib/excel/shared.ts), texto escuro, igual à EC.
 */
function Secao({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="bg-[#C0C0C0] px-4 py-2 flex items-center justify-between gap-3">
      <h3 className="font-display font-bold text-[12.5px] uppercase tracking-[0.05em] text-ink flex-1">
        {children}
      </h3>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}

/** Sub-cabeçalho — cinza claro das barras de grupo da planilha (COR.groupGray). */
function SubSecao({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#D9D9D9] border-y border-border px-4 py-2 text-center font-bold text-[11.5px] uppercase tracking-[0.04em] text-ink">
      {children}
    </div>
  );
}

/** Linha "rótulo | valor" — as duas colunas do modelo em Excel. */
function LinhaOs({
  label,
  hint,
  acao,
  children,
}: {
  label: string;
  hint?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid md:grid-cols-[240px_minmax(0,1fr)] gap-x-4 items-start px-4 py-2 border-b border-border-soft last:border-b-0">
      <div className="md:py-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-[11.5px] font-extrabold uppercase tracking-[0.03em] text-ink-2">{label}</span>
          {hint && <span className="block text-[10.5px] font-semibold text-ink-3">{hint}</span>}
        </div>
        {acao && <div className="shrink-0 md:hidden">{acao}</div>}
      </div>
      <div className="min-w-0 py-1 flex items-start gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        {acao && <div className="shrink-0 hidden md:block pt-1">{acao}</div>}
      </div>
    </div>
  );
}

/** Valor automático (vem do Projeto/EC) — somente leitura. */
function Auto({ v }: { v: string | number | null | undefined }) {
  const txt = v === null || v === undefined || v === "" ? "—" : String(v);
  return <div className="text-sm text-ink font-semibold py-2 whitespace-pre-wrap">{txt}</div>;
}

/**
 * Dados fiscais de quem figura como tomador (faturamento) ou contratante (contrato).
 * "Cliente" vem do cadastro da EC; "Polobh" vem da empresa padrão do grupo (Configurações).
 */
function dadosFiscais(
  quem: "Polobh" | "Cliente" | "",
  ec: Ec,
  empresa: EmpresaGrupo | undefined
): { razaoSocial: string; endereco: string; cnpjCpf: string; inscricaoEstadual: string; inscricaoMunicipal: string } | null {
  if (quem === "Cliente") {
    return {
      razaoSocial: ec.cliente.razaoSocial || ec.cliente.nome,
      endereco: ec.cliente.endereco,
      cnpjCpf: ec.cliente.cnpjCpf,
      inscricaoEstadual: ec.cliente.inscricaoEstadual,
      inscricaoMunicipal: ec.cliente.inscricaoMunicipal,
    };
  }
  if (quem === "Polobh") {
    return {
      razaoSocial: empresa?.razaoSocial ?? "",
      endereco: empresa?.endereco ?? "",
      cnpjCpf: empresa?.cnpj ?? "",
      inscricaoEstadual: empresa?.inscricaoEstadual ?? "",
      inscricaoMunicipal: empresa?.inscricaoMunicipal ?? "",
    };
  }
  return null;
}

