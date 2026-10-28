import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { comDadosAtuaisDoProjeto } from "@/lib/projetoAoVivo";
import { LegendaProjeto } from "@/components/layout/LegendaProjeto";
import { PageShell } from "@/components/layout/AppLayout";
import { BarraProjeto } from "@/components/layout/BarraSecao";
import {
  Button,
  Input,
  TelefoneInput,
  Textarea,
  Select,
  NumberInput,
  Badge,
  tomStatusOs,
  AvisoEmailPendente,
  AvisoHomologacaoEmail,
  MOTIVO_DISPARO_DESLIGADO,
  CarregandoTela,
  MarcaObrigatorio,
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
  StepperSeparator,
} from "@/components/ui";
import { IcCheck, IcCopy, IcDoc, IcEye, IcPencil, IcSearch, IcSend, IcSpark, IcCadeado } from "@/components/icons";
import { CardConversa } from "@/components/CardConversa";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import {
  agruparPorFornecedor,
  descritivoConsolidado,
  descritivoFinanceiro,
  bvConsolidado,
  numeroOs,
  versaoOs,
  textoObjetoContrato,
  LEI_INCENTIVO_PADRAO,
  FORMA_PAGAMENTO_PADRAO,
  OBS_CONTRATO_PADRAO,
} from "@/domain/calc";
import { datasDoEvento, ETAPAS_CRONOGRAMA, horariosDoEvento } from "@/domain/projeto";
import { bancariosDoHistorico, bancariosVazios, comPerfilPeloDocumento, doCadastro, opcoesPerfilTributario, semVazios } from "@/domain/fornecedor";
import { listarBancos } from "@/lib/bancos";
import { useEmpresas } from "@/store/empresas";
import { consultarCnpj } from "@/lib/cnpj";
import { gerarDescritivo } from "@/lib/ai";
import { dispararOsPorEmail } from "@/lib/email";
import { arquivarOsNoProjeto } from "@/lib/excel";
import { flags } from "@/lib/flags";
import { brl, cx, dataBR, maskCpfCnpjInput } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { usePendencias, useMinhasPendencias } from "@/store/pendencias";
import { useSugestoes } from "@/hooks/useSugestoes";
import { urlCredenciamento } from "@/lib/links";
import { calcularAcerto } from "@/domain/acertoFinanceiro";
import { clausulasPadrao, modeloDoContrato, type ChaveClausula, type ModeloContrato } from "@/domain/contratoModelo";
import { baixarContrato } from "@/lib/docx";
import { dadosDoTomador, opcoesDeTomador, RETENCOES_PADRAO, TOMADOR_OUTRO } from "@/domain/tomadorOs";
import { editaFinanceiro, vezDoBloco, type AreaOs, FASES_OS, editaProducao, ESPERANDO_FASE, faseAnterior, faseDaOs, osEmitida, ROTULO_FASE, type FaseOs } from "@/domain/faseOs";
import { RevisaoEcModal } from "@/components/RevisaoEcModal";
import { revisarOs } from "@/domain/revisaoOs";
import type { RevisaoEc } from "@/domain/revisaoEc";
import { ListaArrastavel, ItemArrastavel } from "@/components/ListaArrastavel";
import { MoverSetas, moverNaLista } from "@/components/MoverSetas";
import { InscricaoMunicipalInput } from "@/components/InscricaoMunicipalInput";
import { TextosJaUsados } from "@/components/TextosJaUsados";
import { destacarElemento, idAncoraPendencia, idBlocoGrupoExtra } from "@/lib/destaque";
import { Chevron, idSecao, useSecaoRecolhivel } from "@/components/layout/Recolher";
import { ancoraCronogramaOs, pendenciasDaTela } from "@/domain/pendencias";
import {
  bvDaContratacao,
  bvDoItem,
  formaDoItem,
  documentoFiscalDaContratacao,
  valorDaContratacao,
  acompanharValorDaOs,
  COLUNAS_CONTRATACAO,
  itemDaLinhaEc,
  resumoContratacao,
  problemasDaContratacao,
  sincronizarContratacao,
} from "@/domain/contratacaoOs";
import {
  CAMPOS_LOGISTICA, CAMPOS_INFRAESTRUTURA, exigeNovaVersaoPorFornecedor, osIncentivada,
  itensDoBloco, temContrato,
} from "@/domain/os";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import type { ResumoContratacao } from "@/domain/contratacaoOs";
import type {
  GrupoExtraOs,
  TomadorAvulso,
  ItemExtraOs,
  ItemContratacaoOs,
  DocumentoFiscal,
  Ec,
  EcLinha,
  Fornecedor,
  Modalidade,
  Os,
  ProjetoInfo,
} from "@/data/types";
import {
  avisarFalhaRevisao, lembrarRevisados, pendentesDeRevisao, perguntarRevisao, revisarPendentes, somenteMaiusculas,
} from "@/lib/revisaoInterativa";
import { aplicarNaOs, camposDaOs } from "@/domain/revisaoTexto";
import { chaveDocumento } from "@/domain/travaEdicao";
import { useTravaEdicao } from "@/hooks/useTravaEdicao";
import { AvisoTravaEdicao } from "@/components/AvisoTravaEdicao";

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
 * Cronograma inicial do fornecedor a partir do cronograma do evento.
 * Cada faixa preenchida de cada etapa vira uma linha; sem cronograma, cai no Evento.
 */
function cronogramaDoProjeto(projeto: ProjetoInfo): Os["cronograma"] {
  const itens: Os["cronograma"] = [];
  for (const { key, label } of ETAPAS_CRONOGRAMA) {
    if ((projeto.etapasOcultas ?? []).includes(key)) continue;
    for (const f of projeto.cronograma?.[key] ?? []) {
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
    : [{ id: novoId(), etapa: "Evento", data: projeto.evento, horario: projeto.horario, atividades: "" }];
}

/**
 * Preenche automaticamente tudo o que já se sabe pelo Projeto/EC.
 * Só toca em campo vazio — nunca sobrescreve o que a equipe digitou. É idempotente,
 * então roda tanto ao criar a OS quanto ao abrir uma já existente.
 */
function aplicarAutoPreenchimento(osOriginal: Os, ec: Ec): Os {
  // Fornecedor com CPF: perfil "Pessoa Física (Recibo Simples)" quando ainda está vazio.
  const os = { ...osOriginal, fornecedor: comPerfilPeloDocumento(osOriginal.fornecedor) };
  const incentivada = osIncentivada(os);
  const linhas = ec.linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  const descritivo = os.descritivo || descritivoConsolidado(linhas);

  // Documento fiscal: vem do "Documento PG" já marcado nos itens da EC.
  const docEc = primeiroPreenchido(linhas.map((l) => l.faturaNf));
  const docFiscalEc = (DOCS as string[]).includes(docEc) ? (docEc as DocumentoFiscal) : "";

  // Código de serviço e ordem de compra: o que já estiver nos itens
  // consolidados. Desde 15/09/2026 os dois são decididos AQUI e devolvidos à
  // EC — este auto-preenchimento é o que faz a OS reaberta (e a EC que já
  // recebeu a devolução) continuarem dizendo a mesma coisa.
  const codigoServico = primeiroPreenchido(linhas.map((l) => l.codigoServico));
  const ordemCompra = primeiroPreenchido(linhas.map((l) => l.pedidoCompra));
  // CNAE: só quando o cadastro do fornecedor tem um único — vários exigem escolha.
  const cnaeUnico = os.fornecedor.cnaes?.length === 1 ? os.fornecedor.cnaes[0] : "";

  const descritivoNf = os.financeiro.descritivoNf || descritivoFinanceiro(linhas) || descritivo;

  /**
   * BV: vem pronto do que foi combinado item a item na EC.
   *
   * Somar os valores em reais é o único jeito exato quando os itens saíram com
   * BVs diferentes — o percentual é recomposto sobre o total. Só preenche o que
   * está zerado/vazio, como todo o resto deste auto-preenchimento: OS antiga
   * com BV ajustado à mão não é desfeita.
   */
  const bvEc = bvConsolidado(linhas);
  const bvPercentual = os.financeiro.bvPercentual || bvEc.percentual;
  const bvValor = os.financeiro.bvValor || bvEc.valor;

  /**
   * A contratação acompanha os itens que a OS consolida: o que já foi negociado
   * fica, o que entrou agora chega com os valores da EC, e o que saiu some. É
   * também por aqui que uma OS gravada antes da contratação por item ganha os
   * seus (ver `sincronizarContratacao`).
   */
  const itensContratacao = sincronizarContratacao(os.itens ?? [], linhas);
  const totaisContratacao = resumoContratacao(itensContratacao, linhas).totais;

  // OSs antigas nasciam com uma única linha "Evento" gerada automaticamente.
  // Ela conta como não-preenchida, para dar lugar ao cronograma real do projeto.
  const so1 = os.cronograma.length === 1 ? os.cronograma[0] : undefined;
  const cronogramaPadraoAntigo =
    !!so1 && so1.etapa === "Evento" && !so1.atividades?.trim() && so1.data === os.projeto.evento;

  const preenchida: Os = {
    ...os,
    descritivo,
    // A contratação acompanha os itens que a OS consolida: o que já foi
    // negociado fica, o que entrou agora chega com os valores da EC, e o que
    // saiu some. É também por aqui que uma OS gravada antes da contratação por
    // item ganha os seus (ver `sincronizarContratacao`).
    itens: itensContratacao,
    // Backfill de id nas etapas/parcelas antigas: dá chave estável para a lista
    // editável (sem isso, remover uma linha do meio rouba o foco da seguinte).
    cronograma: (os.cronograma.length && !cronogramaPadraoAntigo
      ? os.cronograma
      : cronogramaDoProjeto(os.projeto)
    ).map((c) => (c.id ? c : { ...c, id: novoId() })),
    orcamento: {
      ...os.orcamento,
      // Os três totais são a soma do que a contratação definiu item a item.
      valorComBvNf: totaisContratacao.comBvNf,
      valorSemBvComNf: totaisContratacao.semBvComNf,
      valorSemBvSemNf: totaisContratacao.semBvSemNf,
      // A forma de pagamento escolhida decide o documento (21/10/2026); sem
      // forma ainda, vale o que já estava ou o "Documento PG" da EC.
      documentoFiscal: documentoFiscalDaContratacao(itensContratacao) || os.orcamento.documentoFiscal || docFiscalEc,
      parcelas: os.orcamento.parcelas.map((p) => (p.id ? p : { ...p, id: novoId() })),
    },
    financeiro: {
      ...os.financeiro,
      ordemCompra: os.financeiro.ordemCompra || ordemCompra,
      descritivoNf,
      // Tomador: quem contrata o fornecedor é a Pólobh — é ela que emite a OS e
      // recebe a nota. Deixar em branco só obrigava a escolher a única resposta
      // óbvia antes de os dados fiscais aparecerem; segue trocável para Cliente
      // quando o faturamento vai direto para ele.
      tomador: os.financeiro.tomador || "Polobh",
      codigoServico: os.financeiro.codigoServico || codigoServico,
      cnae: os.financeiro.cnae || cnaeUnico,
      // Projeto incentivado só em OS de projeto cultural (27/10/2026): no
      // corporativo esses campos não são preenchidos nem aparecem.
      projetoIncentivado: incentivada
        ? os.financeiro.projetoIncentivado || os.projeto.projetoIncentivado || os.projeto.nomeProjeto || os.projeto.titulo
        : os.financeiro.projetoIncentivado,
      // O código vem do Projeto (Dados Gerais) quando a OS ainda não tem o seu.
      codigoProjetoIncentivado: incentivada
        ? os.financeiro.codigoProjetoIncentivado || os.projeto.codigoProjetoIncentivado || ""
        : os.financeiro.codigoProjetoIncentivado,
      // Lei COM o número do projeto: é assim que o Projeto já guarda
      // ("Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234").
      leiIncentivo: incentivada
        ? os.financeiro.leiIncentivo || os.projeto.leiIncentivo || os.projeto.incentivosFiscais || LEI_INCENTIVO_PADRAO
        : os.financeiro.leiIncentivo,
      // Como o fornecedor recebe: o mesmo padrão do modelo que o contrato usa.
      // O bloco de emissão fecha neste par (valor a pagar + forma), e nascer
      // vazio obrigava a redigitar em toda OS a resposta de sempre.
      formaPagamento: os.financeiro.formaPagamento || FORMA_PAGAMENTO_PADRAO,
      bvPercentual,
      bvValor,
      // `bvJustificativa` não é mais preenchida: a justificativa é uma por
      // FORMA, dentro de cada item (ver `domain/contratacaoOs`). O que já foi
      // escrito nas OS antigas continua gravado, intacto.
    },
    // Contrato: só se preenche o que existe. Sem contrato pedido na EC, os
    // padrões do modelo não entram — senão a OS nasce descrevendo com valores,
    // forma de pagamento e data um contrato que ninguém vai fazer.
    contrato: temContrato(os, linhas)
      ? {
          ...os.contrato,
          // O CONTRATANTE fica em branco de propósito: em branco ele SEGUE o
          // tomador do faturamento, que é o que os dois modelos de contrato
          // mandam fazer ("CONTRATANTE – Razão Social do Tomador"). Antes ele
          // nascia "Polobh", e a OS faturada pela MF ou pelo cliente saía com
          // um contratante que ninguém tinha escolhido — e que estava errado.
          descritivoServicos: os.contrato.descritivoServicos || descritivoNf,
          formaPagamento: os.contrato.formaPagamento || FORMA_PAGAMENTO_PADRAO,
          observacoesGerais: os.contrato.observacoesGerais || OBS_CONTRATO_PADRAO,
          // A data do contrato é a da emissão da OS, não a de hoje: abrir a OS
          // três meses depois não pode reescrever quando ela foi feita.
          dataContrato: os.contrato.dataContrato || (os.criadoEm || new Date().toISOString()).slice(0, 10),
        }
      : os.contrato,
  };
  // OS nascida com o valor do item na EC (preço ao cliente) no Faturamento, no
  // Contrato e no prazo de pagamento passa a valer o que se paga ao fornecedor.
  // Emitida não muda sozinha: aquela já foi para o fornecedor.
  return osEmitida(os)
    ? preenchida
    : acompanharValorDaOs(preenchida, [os.orcamento.valorEc], valorDaContratacao(itensContratacao));
}

const ID_FORMAS_PAGAMENTO = "os-formas-pagamento";

export function OsForm() {
  const { id, ecId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const pode = useAuth((s) => s.pode);
  const verFinanceiro = pode("financeiro");
  const podeEditar = pode("oss.editar");
  const podeEmitir = pode("oss.emitir");
  /**
   * MODO LEITURA (15/09/2026). A OS abria sempre em edição, e qualquer pessoa
   * que a abrisse para conferir estava, tecnicamente, editando um documento que
   * já foi para o fornecedor. Agora ela abre travada e o botão "Editar OS"
   * libera — como nos Dados Gerais do projeto e na EC.
   *
   * OS nova nasce em edição: não há o que conferir num documento em branco.
   */
  const [editando, setEditando] = useState(!id);
  /** O comparativo do "Revisar" (aberto no modal). */
  const [revisao, setRevisao] = useState<RevisaoEc | null>(null);

  /**
   * TRAVA DE PRESENÇA (25/09/2026). Quem entra em edição toma o documento; quem
   * chegar depois fica em leitura até o primeiro sair, ou até a posse caducar
   * por falta de sinal.
   *
   * É a leitura literal do pedido da Pólobh — "não pode PERMITIR que seja
   * editado, substituído, arquivado, cancelado ou emitido se outro usuário
   * estiver com ele aberto em modo de edição". A trava otimista do salvamento
   * continua embaixo desta e faz outro trabalho: ela pega o que escapa (a posse
   * que caducou por engano, a edição por outro caminho), mas só avisa DEPOIS do
   * trabalho feito. Esta avisa antes da primeira letra.
   */
  const trava = useTravaEdicao(id ? chaveDocumento("os", id) : "", editando);

  /*
   * Perdeu a disputa: a tela volta para leitura sozinha. Sem isto, a pessoa
   * seguiria digitando num formulário cujo salvamento seria recusado — que é
   * exatamente o trabalho perdido que a trava existe para evitar.
   */
  useEffect(() => {
    if (trava.travado && editando) {
      setEditando(false);
      toast(trava.aviso, "warning");
    }
  }, [trava.travado, trava.aviso, editando]);
  // Empresas do grupo (carregadas no boot) — dados fiscais quando o tomador/contratante é a Pólobh.
  const empresas = useEmpresas((s) => s.empresas);
  const empresaPolobh = empresas.find((e) => e.padrao) ?? empresas[0];

  const { data: osExistente } = useAsync(() => (id ? repo.oss.obter(id) : Promise.resolve(undefined)), [id]);
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
  /** "Revisar" em andamento (a IA leva alguns segundos). */
  const [revisando, setRevisando] = useState(false);
  /** Textos já revisados nesta edição (id → texto final): o "Salvar" não pergunta de novo. */
  const [jaRevisados, setJaRevisados] = useState<Map<string, string>>(() => new Map());

  /**
   * O fornecedor COMO ELE ESTAVA quando a tela abriu (ou logo depois de salvar).
   *
   * É a única forma de saber que ele foi trocado: o formulário edita
   * `os.fornecedor` no lugar, e sem esta foto não haveria com o que comparar na
   * hora de salvar. Ver `exigeNovaVersaoPorFornecedor`.
   */
  const fornecedorGravado = useRef<Fornecedor | undefined>(undefined);

  const iniciar = (o: Os) => {
    setOs(o);
    setBaseline(JSON.stringify(o));
    fornecedorGravado.current = structuredClone(o.fornecedor);
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
    // `valorEc` fica gravado (é o preço ao cliente, para a rentabilidade), mas a
    // OS nasce valendo o que se paga ao FORNECEDOR (ver `valorDaContratacao`).
    const valorEc = linhas.reduce((s, l) => s + l.valorPolobh + l.valorCliente, 0);
    const itens = linhas.map(itemDaLinhaEc);
    const valorOs = valorDaContratacao(itens);

    // Puxa o fornecedor já cadastrado (pelo CNPJ) para pré-preencher tudo,
    // inclusive os CNAEs — sem precisar reconsultar o CNPJ na API.
    Promise.all([
      repo.oss.proximaSeq(ec.id),
      g?.fornecedorCnpj ? repo.fornecedores.porCnpj(g.fornecedorCnpj) : Promise.resolve(undefined),
      repo.oss.porEc(ec.id),
      // A OS nova nasce com os dados gerais de HOJE do projeto (ver `projetoAoVivo`).
      comDadosAtuaisDoProjeto(ec),
    ]).then(([seq, fornCadastro, ossDaEc, ecOriginal]) => {
      const ec = ecOriginal;
      const agora = new Date().toISOString();
      const fornecedor = fornCadastro ?? fornecedorVazio(g?.fornecedorRazao, g?.fornecedorCnpj);
      setEcCtx(ec);
      iniciar(aplicarAutoPreenchimento({
        id: "",
        numero: numeroOs(ec, fornecedor, versaoOs(ossDaEc ?? [], ec.id, fornecedor.cnpj, fornecedor.razaoSocial), agora, linhaIds),
        slugCredenciamento: "",
        seq,
        ecId: ec.id,
        ecNumero: ec.numero,
        ecLinhaIds: linhaIds,
        // A contratação nasce com o que a EC levantou para cada item.
        itens,
        status: "Rascunho",
        fornecedor,
        // Foto dos dados gerais do evento: a partir daqui esta OS não muda mais
        // sozinha, nem se o projeto ou a EC forem editados (ver `Os.projeto`).
        projeto: ec.projeto,
        cliente: ec.cliente,
        modalidade: "",
        descritivo: descritivoConsolidado(linhas),
        entrega: "",
        // Todas as faixas de todas as etapas, e não uma linha "Evento" com a
        // primeira data: um evento de três dias chegava ao fornecedor como se
        // fosse de um. A OS já sabia montar isso (`cronogramaDoProjeto`) — mas
        // só depois, ao reabrir, por um remendo que reconhecia a linha padrão
        // antiga e a substituía. Agora ela nasce certa.
        cronograma: cronogramaDoProjeto(ec.projeto),
        logistica: { transporteMaterial: "", transporteEquipe: "", hospedagem: "", alimentacao: "", estacionamentoCarga: "", estacionamentoEquipe: "", uniformizacao: "" },
        infraestrutura: { energia: "", internet: "", pontosEletricos: "", estruturas: "", servicosApoio: "", artLaudos: "" },
        observacoesGerais: "",
        observacoes: [],
        // O link só existe depois de salvar: quem o monta é `urlCredenciamento`, a
        // partir do token que o banco gera (ver lib/links).
        credenciamento: { prazoLimite: "", linkFormulario: "" },
        orcamento: { valorEc, valorComBvNf: valorOs, valorSemBvComNf: valorOs, valorSemBvSemNf: valorOs, parcelas: [{ descricao: "Pagamento único", valor: valorOs }], documentoFiscal: documentoFiscalDaContratacao(itens) },
        financeiro: { tomador: "", descritivoNf: "", cnae: "", codigoServico: "", valorUnitario: valorOs, valorTotal: valorOs, descontoNegociado: 0, valorAPagar: valorOs, bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "" },
        contrato: { contratante: "", descritivoServicos: "", informacoesComplementares: "", valorUnitario: valorOs, valorTotal: valorOs, descontoNegociado: 0, valorAPagar: valorOs, dataContrato: "", rubrica: "" },
        criadoEm: agora,
        atualizadoEm: agora,
      }, ec));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ec, id]);

  const sujo = !!os && baseline !== "" && JSON.stringify(os) !== baseline;
  const guard = useUnsavedGuard(sujo);

  /**
   * O que está ABERTO agora — o cruzamento da permissão da pessoa com a fase do
   * documento (ver `domain/faseOs`).
   *
   * A permissão diz o que a pessoa pode fazer; a fase diz o que a OS aceita
   * neste momento. É assim que "a partir desta etapa a Produção não edita mais"
   * se cumpre sem depender de os sete perfis da Pólobh já estarem cadastrados:
   * os blocos da produção fecham quando a OS passa para o financeiro, e os do
   * financeiro só abrem quando ela chega lá.
   */
  const fase = os ? faseDaOs(os) : "producao";
  /**
   * BACK-OFFICE CORRIGE TUDO (28/10/2026, pedido da Viviane): quem emite a OS
   * (`oss.emitir`) precisa acertar qualquer campo para aprovar e emitir — os
   * blocos da Produção e do Financeiro ficam abertos a ele até a emissão.
   */
  const backofficeCorrige = editando && podeEmitir && os != null && !osEmitida(os);
  const mexeProducao = (editando && podeEditar && os != null && editaProducao(os)) || backofficeCorrige;
  const mexeFinanceiro = (editando && verFinanceiro && os != null && editaFinanceiro(os)) || (backofficeCorrige && verFinanceiro);
  const emitida = os != null && osEmitida(os);
  // Pendências desta OS — mesma lista que alimenta o badge vermelho dela.
  const { itens: pendenciasDoUsuario } = useMinhasPendencias();
  /** O que se resolve DENTRO desta OS — a mesma lista da pílula do canto. */
  const pendenciasDaOs = useMemo(
    () => (os ? pendenciasDaTela(pendenciasDoUsuario, { osId: os.id }) : []),
    [pendenciasDoUsuario, os]
  );
  // Valores já usados nestes campos em outras OSs (ver `domain/sugestoes`).
  const sugestoes = useSugestoes();

  // Lista de bancos (BrasilAPI) para o autocompletar do campo Banco.
  const [bancos, setBancos] = useState<string[]>([]);
  useEffect(() => {
    let vivo = true;
    void listarBancos().then((l) => vivo && setBancos(l));
    return () => { vivo = false; };
  }, []);

  /**
   * Fornecedor com histórico: os dados bancários da última OS dele entram
   * sozinhos, enquanto os da OS atual estiverem em branco — quem já informou
   * não é sobrescrito, e a tela diz de que OS o dado veio.
   */
  const ossDoHistorico = usePendencias((s) => s.oss);
  const [bancoDaOs, setBancoDaOs] = useState("");
  const cnpjDaOs = os?.fornecedor.cnpj ?? "";
  useEffect(() => {
    if (!editando || !os || !bancariosVazios(os.fornecedor.dadosBancarios)) return;
    const h = bancariosDoHistorico(ossDoHistorico, cnpjDaOs, os.id);
    if (!h) return;
    setOs((o) =>
      o && bancariosVazios(o.fornecedor.dadosBancarios)
        ? { ...o, fornecedor: { ...o.fornecedor, dadosBancarios: { ...o.fornecedor.dadosBancarios, ...h.dados } } }
        : o
    );
    setBancoDaOs(h.deOs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, cnpjDaOs, ossDoHistorico]);

  if (!os || !ecCtx) return <PageShell title="Carregando…">{null}</PageShell>;

  // Linhas da EC que esta OS consolida (mesmo fornecedor).
  const linhasConsolidadas = ecCtx.linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  /** Ordem atual do cronograma, pelas chaves que o arraste manipula. */
  const idsCronograma = os.cronograma.map(idDaEtapa);

  /** Resumo dos Custos: o que a contratação decidiu, item a item, com os totais. */
  const resumo = resumoContratacao(os.itens, linhasConsolidadas);
  /** O que trava a emissão na contratação: forma sem escolher, sem valor, ou misturada. */
  // O cronograma vazio é cobrado na subguia Cronograma do projeto, mas a
  // emissão continua travada por ele: a âncora é a do bloco desta tela.
  const pendenciasAbertasDaOs = [
    ...pendenciasDaOs.filter((p) => p.tipo !== "os.fase"),
    ...pendenciasDoUsuario.filter((p) => p.tipo === "os.cronograma" && p.osId === os.id),
  ];
  /** Rola até o campo da pendência e o faz latejar. */
  const irParaPendencia = (p: (typeof pendenciasDaOs)[number]) => {
    if (p.ancora) destacarElemento(idAncoraPendencia(p.ancora), "pendencia");
  };
  const problemasContratacao = problemasDaContratacao(os.itens, (id) => {
    const l = linhasConsolidadas.find((x) => x.id === id);
    return l?.item?.trim() || l?.descricao?.trim() || "(item sem nome)";
  });

  /** O BV desta contratação — a soma do que foi fechado item a item. */
  const bvContratado = bvDaContratacao(os.itens);

  /**
   * Muda uma forma de cobrança de um item — e leva o total junto.
   *
   * Os três totais do Resumo dos Custos são a soma do que se definiu item
   * a item, e é do "com BV e NF" que vivem o Faturamento e o Contrato. Eles
   * acompanham enquanto estiverem espelhados, isto é, enquanto ninguém os tiver
   * ajustado à mão — quem ajustou tinha um motivo, e não se desfaz isso por
   * baixo.
   */
  const updItem = (ecLinhaId: string, patch: Partial<ItemContratacaoOs>) =>
    setOs((o) => {
      if (!o) return o;
      const itens = o.itens.map((i) => (i.ecLinhaId === ecLinhaId ? { ...i, ...patch } : i));
      const { totais } = resumoContratacao(itens, linhasConsolidadas);
      const v = resumoContratacao(itens, linhasConsolidadas).contratado;
      const atualizada: Os = {
        ...o,
        itens,
        orcamento: {
          ...o.orcamento,
          valorComBvNf: v,
          valorSemBvComNf: totais.semBvComNf,
          valorSemBvSemNf: totais.semBvSemNf,
          documentoFiscal: documentoFiscalDaContratacao(itens) || o.orcamento.documentoFiscal,
        },
      };
      // Faturamento, Contrato e parcela única acompanham enquanto espelharem o
      // valor de antes — quem ajustou à mão tinha um motivo.
      return acompanharValorDaOs(
        atualizada,
        [valorDaContratacao(o.itens), o.orcamento.valorComBvNf],
        valorDaContratacao(itens)
      );
    });
  /** O documento que a forma de pagamento escolhida exige ("" = ainda sem forma). */
  const docDaForma = documentoFiscalDaContratacao(os.itens ?? []);
  /** Esta OS tem contrato? Quem decide é a coluna Contrato dos itens, na EC. */
  const haContrato = temContrato(os, linhasConsolidadas);

  /** Trocar o fornecedor de uma OS já emitida arquiva esta e abre a seguinte. */
  const trocouFornecedor = exigeNovaVersaoPorFornecedor(os, fornecedorGravado.current, os.fornecedor);

  /** Empresa emissora não cadastrada: os dados da nota sairiam em branco calados. */
  const faltaCadastroTomador = os.financeiro.tomador === "Polobh" && !empresaPolobh;

  // Parcelas: a soma tem que fechar com o valor negociado, senão a OS sai errada.
  const somaParcelas = os.orcamento.parcelas.reduce((s, p) => s + (p.valor || 0), 0);
  const refParcelas =
    verFinanceiro && os.financeiro.valorAPagar > 0
      ? { valor: os.financeiro.valorAPagar, rotulo: "valor total a pagar" }
      : { valor: os.orcamento.valorComBvNf, rotulo: "valor com BV e NF" };
  /** O que ainda não foi distribuído em parcelas (nunca negativo). */
  const saldoParcelas = Math.max(0, refParcelas.valor - somaParcelas);
  /** Teto de uma parcela: o valor de referência menos o que as OUTRAS já usam. */
  const tetoDaParcela = (i: number) =>
    refParcelas.valor > 0
      ? Math.max(0, refParcelas.valor - (somaParcelas - (os.orcamento.parcelas[i]?.valor || 0)))
      : Infinity;
  const parcelasDivergem =
    os.orcamento.parcelas.length > 0 &&
    refParcelas.valor > 0 &&
    Math.abs(somaParcelas - refParcelas.valor) > 0.01;

  // Modalidade é obrigatória (vai na OS do fornecedor) e não tem origem confiável
  // na EC — então sugerimos pelo conteúdo dos itens, sem preencher sozinho.
  const modalidadeSugerida = sugerirModalidade(linhasConsolidadas, os.fornecedor);

  /**
   * O descritivo que a EC produziria AGORA. O campo é editável e nasce
   * preenchido, então não dá para sobrescrevê-lo sozinho — mas a EC continua
   * sendo mexida depois que a OS nasce (a Descrição Completa costuma ser escrita
   * justamente aí), e sem isso a OS ficava com o texto do dia em que foi criada.
   * Quando os dois divergem, aparece o atalho para trazer o atual.
   */
  const descritivoDaEc = descritivoConsolidado(linhasConsolidadas);

  // Cronograma do projeto (vindo da EC) — só etapas visíveis e com alguma faixa preenchida.
  const etapasProjeto = ETAPAS_CRONOGRAMA.filter(
    ({ key }) => !(os.projeto.etapasOcultas ?? []).includes(key)
  )
    .map(({ key, label }) => ({
      key,
      label,
      faixas: (os.projeto.cronograma?.[key] ?? []).filter((f) => f.data || f.inicio || f.fim),
    }))
    .filter((e) => e.faixas.length > 0);

  // A regra de "quem é o tomador" mora no domínio desde 15/09/2026, quando ele
  // ganhou MF e "Outro" (ver `domain/tomadorOs`): eram três cópias da mesma
  // resposta — aqui, na OS impressa e no contrato.
  const dadosTomador = dadosDoTomador(os.financeiro.tomador, {
    cliente: ecCtx.cliente,
    empresas,
    avulso: os.financeiro.tomadorAvulso,
  });
  /*
   * O CONTRATANTE do contrato é o TOMADOR do serviço — é o que o bloco de
   * assinaturas dos dois modelos diz ("CONTRATANTE – Razão Social do Tomador").
   * Por isso, em branco, ele segue o tomador do faturamento em vez de exigir
   * que a mesma pergunta seja respondida duas vezes na mesma OS. Escolher aqui
   * continua possível, para o caso raro em que quem paga o fornecedor não é
   * quem recebe a nota.
   */
  const quemContrata = os.contrato.contratante || os.financeiro.tomador;
  const dadosContratante = dadosDoTomador(quemContrata, {
    cliente: ecCtx.cliente,
    empresas,
    avulso: os.financeiro.tomadorAvulso,
  });

  /**
   * O código do projeto sugerido a partir da lei — o que vem depois do travessão
   * em "Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234". É
   * sugestão, com um clique para aceitar, e não preenchimento automático: um
   * texto sem travessão daria um código errado, e código de incentivo errado
   * num contrato é prestação de contas rejeitada.
   */
  const codigoSugerido = (os.financeiro.leiIncentivo ?? "").split(/\s[—–-]\s/).slice(1).join(" - ").trim();

  /** Qual dos dois modelos vale aqui: o escolhido, ou o da modalidade do projeto. */
  const modeloContrato: ModeloContrato = os.contrato.modelo || modeloDoContrato(os.projeto.modalidade);
  const clausulas = clausulasPadrao(modeloContrato);
  const updClausula = (chave: ChaveClausula, texto: string) =>
    updCt({ clausulas: { ...(os.contrato.clausulas ?? {}), [chave]: texto } });

  const clienteDoProjeto = ecCtx.cliente;
  async function baixarOContrato() {
    try {
      await baixarContrato(
        { ...os!, contrato: { ...os!.contrato, contratante: quemContrata } },
        { cliente: clienteDoProjeto, empresas }
      );
    } catch (e) {
      toast(`Não foi possível gerar o contrato: ${(e as Error).message}`, "danger");
    }
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
  //
  /* O BLOCO DE BV saiu dos Acertos Financeiros (15/09/2026): ele é combinado
     item a item, no Detalhamento da Contratação, e aqui era a mesma soma
     repetida num lugar onde ninguém a ajustava. O acerto que ficou é outro —
     quanto o fornecedor devolve à Pólobh (ver `domain/acertoFinanceiro`). */

  /** A conta do acerto — tudo calculado, menos o percentual de encargos. */
  const acerto = calcularAcerto(os.financeiro, os.orcamento, bvContratado.valor);

  const updF = (patch: Partial<Fornecedor>) =>
    setOs((o) => (o ? { ...o, fornecedor: comPerfilPeloDocumento({ ...o.fornecedor, ...patch }) } : o));
  const updB = (patch: Partial<Fornecedor["dadosBancarios"]>) =>
    setOs((o) => (o ? { ...o, fornecedor: { ...o.fornecedor, dadosBancarios: { ...o.fornecedor.dadosBancarios, ...patch } } } : o));
  const updFin = (patch: Partial<Os["financeiro"]>) => setOs((o) => (o ? { ...o, financeiro: { ...o.financeiro, ...patch } } : o));
  const updOrc = (patch: Partial<Os["orcamento"]>) => setOs((o) => (o ? { ...o, orcamento: { ...o.orcamento, ...patch } } : o));
  const updLog = (patch: Partial<Os["logistica"]>) => setOs((o) => (o ? { ...o, logistica: { ...o.logistica, ...patch } } : o));
  const updInfra = (patch: Partial<Os["infraestrutura"]>) => setOs((o) => (o ? { ...o, infraestrutura: { ...o.infraestrutura, ...patch } } : o));
  const updCt = (patch: Partial<Os["contrato"]>) => setOs((o) => (o ? { ...o, contrato: { ...o.contrato, ...patch } } : o));

  /**
   * Consulta do CNPJ: o CADASTRO da casa primeiro, a Receita depois.
   *
   * Antes ia direto à BrasilAPI, e isso desfazia memória: Inscrição Estadual e
   * Municipal, dados bancários e representante não existem em fonte pública —
   * alguém da casa digitou aquilo uma vez, e a consulta seguinte sobrescrevia o
   * registro com o que a API tinha (menos). Agora o fornecedor já cadastrado
   * devolve tudo o que a casa sabe dele, e a API só completa o que faltar.
   *
   * Nenhum dos dois apaga campo: valor vazio na fonte deixa o que está na tela.
   */
  async function consultar() {
    setCnpjMsg("");
    setBusy(true);
    try {
      const cnpj = os!.fornecedor.cnpj;
      const cadastrado = await repo.fornecedores.porCnpj(cnpj).catch(() => undefined);
      if (cadastrado) updF(doCadastro(cadastrado));

      // Já cadastrado E com o essencial preenchido: não há o que buscar fora.
      //
      // Os CNAEs contam como essencial. O cadastro da casa é ANTERIOR a eles,
      // então o fornecedor já cadastrado caía aqui e voltava sem atividade
      // nenhuma — e a lista de CNAE da nota ficava vazia para sempre, por mais
      // vezes que se consultasse o CNPJ. É o que dava a impressão de que a
      // busca por cartão CNPJ não trazia as opções certas: ela não era feita.
      const completo =
        !!cadastrado?.razaoSocial &&
        !!cadastrado?.endereco &&
        !!cadastrado?.perfilTributario &&
        !!cadastrado?.cnaes?.length;
      if (completo) {
        setCnpjMsg(`Dados vindos do cadastro do fornecedor (${cadastrado.razaoSocial}). Perfil: ${cadastrado.perfilTributario}.`);
        return;
      }

      const d = await consultarCnpj(cnpj);
      updF(semVazios({
        razaoSocial: d.razaoSocial, nomeFantasia: d.nomeFantasia, endereco: d.endereco,
        perfilTributario: d.perfilTributario, email: d.email, telefone: d.telefone,
        // A pesquisa não achou IE: "Isenta" (29/09/2026); o que já estava escrito vence.
        inscricaoEstadual: d.inscricaoEstadual || os!.fornecedor.inscricaoEstadual || "Isenta",
      }));
      if (d.cnaes?.length) {
        updF({ cnaes: d.cnaes });
        // Devolve ao cadastro o que a Receita disse: a próxima OS deste
        // fornecedor já abre com as atividades certas, sem nova consulta.
        if (cadastrado && !cadastrado.cnaes?.length) {
          await repo.fornecedores.salvar({ ...cadastrado, cnaes: d.cnaes }).catch(() => undefined);
        }
      }
      setCnpjMsg(
        cadastrado
          ? `Cadastro do fornecedor completado com os dados públicos. Perfil: ${d.perfilTributario}.`
          : `Perfil: ${d.perfilTributario}. Dados preenchidos pela BrasilAPI.`
      );
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

  /**
   * Arquiva esta OS e abre a versão seguinte com o fornecedor novo.
   *
   * O trabalho pesado é do servidor (`gerar_nova_versao_os`): ele copia tudo —
   * inclusive a contratação item a item e o financeiro, que a Produção não
   * enxerga —, cancela a anterior e devolve a nova. Aqui só se decide o número
   * da versão e se pede a autorização.
   *
   * O que a pessoa digitou ANTES de trocar o fornecedor é salvo primeiro, com o
   * fornecedor antigo: a OS arquivada tem de ficar no histórico exatamente como
   * ela era, e o resto do trabalho segue para a versão nova pela cópia.
   */
  async function trocarFornecedorComNovaVersao() {
    const anterior = fornecedorGravado.current;
    const nome = os!.fornecedor.nomeFantasia || os!.fornecedor.razaoSocial || "o novo fornecedor";
    const nomeAntigo = anterior?.nomeFantasia || anterior?.razaoSocial || "o fornecedor anterior";
    if (!(await confirmar({
      titulo: "Trocar o fornecedor gera uma nova versão desta OS. Confirma?",
      mensagem:
        `A ${os!.numero} está ${os!.status.toLowerCase()} em nome de ${nomeAntigo}. ` +
        `Ela será ARQUIVADA como está, e uma nova versão será criada em nome de ${nome}, ` +
        "com todo o conteúdo desta — itens, valores, cronograma e contratação — em rascunho.",
      confirmarTexto: "Arquivar e gerar nova versão",
    }))) return;

    setBusy(true);
    try {
      // A versão da série deste fornecedor nesta EC, para o número sair certo.
      const todas = await repo.oss.porEc(ecCtx!.id);
      const versao = versaoOs(todas, ecCtx!.id, os!.fornecedor.cnpj, os!.fornecedor.razaoSocial);
      const numero = numeroOs(ecCtx!, os!.fornecedor, versao, undefined, os!.ecLinhaIds);
      const nova = await repo.oss.gerarNovaVersao(
        // A anterior vai para o arquivo como ela era: com o fornecedor de antes.
        { ...os!, fornecedor: anterior ?? os!.fornecedor },
        { numero, fornecedor: os!.fornecedor }
      );
      toast(`OS ${os!.numero} arquivada. Nova versão ${nova.numero} criada em rascunho.`, "success");
      usePendencias.getState().carregar(true);
      guard.liberar();
      navigate(`/ordens/${nova.id}`);
    } catch (e) {
      toast(`Não foi possível gerar a nova versão: ${(e as Error).message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  /**
   * NADA impede o salvamento de uma OS (10/09/2026).
   *
   * Houve aqui uma trava: sem a justificativa do BV de uma forma fora do padrão,
   * a OS não salvava. Ela foi desfeita a pedido da Pólobh, e o motivo é bom —
   * quem está montando o documento raramente tem todas as respostas na mesma
   * sessão, e uma trava dessas transforma "ainda não sei" em "não posso
   * guardar o que já sei". A justificativa continua no Detalhamento, como nota
   * opcional de quem quiser registrar o combinado.
   *
   * O que sobrou de trava neste formulário é de outra natureza e continua: a
   * troca de fornecedor de uma OS já emitida, que não bloqueia — desvia para
   * uma nova versão.
   */
  async function salvar(status?: Os["status"], patch?: Partial<Os>, opcoes?: { disparar?: boolean }) {
    /**
     * TROCA DE FORNECEDOR numa OS que já saiu da casa: não é edição, é outro
     * contrato. A OS anterior existe do lado do primeiro fornecedor — deixar
     * duas empresas com o mesmo número na mão é o que a versão nova evita.
     *
     * Em rascunho isto não acontece (ver `exigeNovaVersaoPorFornecedor`): ali a
     * troca é correção de quem ainda está montando o documento.
     */
    if (exigeNovaVersaoPorFornecedor(os!, fornecedorGravado.current, os!.fornecedor)) {
      await trocarFornecedorComNovaVersao();
      return;
    }
    if (opcoes?.disparar) {
      const destino = os!.fornecedor.email || "o fornecedor (sem e-mail cadastrado)";
      if (!(await confirmar({
        titulo: "Enviar esta OS ao fornecedor?",
        mensagem: `A OS ${os!.numero} será enviada por e-mail para ${destino}. O envio fica registrado na OS.`,
        confirmarTexto: "Enviar OS",
      }))) return;
    }
    // Textos alterados ainda não revisados: pergunta antes de gravar (28/10/2026).
    const gravadaParaRevisao = baseline ? (JSON.parse(baseline) as Os) : null;
    const comPatchParaRevisao = { ...os!, ...patch };
    const pendentes = pendentesDeRevisao(
      camposDaOs(comPatchParaRevisao),
      camposDaOs(gravadaParaRevisao ?? comPatchParaRevisao),
      jaRevisados,
    );
    const querRevisao = pendentes.length > 0 && (await perguntarRevisao(pendentes.length));
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

      /*
       * REVISÃO DE TEXTO. A OS é o documento que SAI DA CASA — vai por e-mail
       * para o fornecedor, impressa e em planilha. Desde 28/10/2026 a revisão
       * por IA é perguntada (acima) e vai só o que mudou desde a última gravação
       * e ainda não foi revisado. O que está marcado como "não se aplica" fica
       * de fora — não sai no documento. Sem revisão, vale só a regra de
       * maiúsculas.
       */
      let revisada = comPatchParaRevisao;
      if (querRevisao) {
        const { textos, falhou } = await revisarPendentes(pendentes);
        revisada = aplicarNaOs(comPatchParaRevisao, textos);
        if (falhou) await avisarFalhaRevisao();
      } else if (pendentes.length) {
        revisada = aplicarNaOs(comPatchParaRevisao, somenteMaiusculas(pendentes));
      }

      let salvo = await repo.oss.salvar({
        ...revisada,
        // A fase muda junto com o carimbo de quando ela mudou — é o que a tela
        // mostra em "com o financeiro desde…".
        faseEm: patch?.fase && patch.fase !== os!.fase ? new Date().toISOString() : os!.faseEm,
        status: status ?? os!.status,
        credenciamento: { ...os!.credenciamento, linkFormulario: linkCred },
        financeiro: { ...os!.financeiro, bvValor },
      });
      iniciar(ecCtx ? aplicarAutoPreenchimento(salvo, ecCtx) : salvo);
      if (opcoes?.disparar) {
        const r = await dispararOsPorEmail(salvo, ecCtx!);
        if (!r.ok) toast(`OS salva; o e-mail não saiu: ${r.motivo}`, "warning");
        else if (r.simulado) toast(`E-mail simulado para ${r.destinatarios.join(", ") || "—"}; o envio não foi registrado.`, "info");
        else {
          // O CARIMBO só é gravado quando o e-mail saiu de verdade
          // (15/09/2026): é ele que destrava as cobranças de cronograma e
          // credenciamento, que só fazem sentido com o fornecedor de posse do
          // documento. Registrar um envio que falhou cobraria resposta de quem
          // não recebeu nada.
          salvo = await repo.oss.salvar({ ...salvo, disparadaEm: new Date().toISOString() });
          iniciar(ecCtx ? aplicarAutoPreenchimento(salvo, ecCtx) : salvo);
          toast(`OS enviada por e-mail para ${r.destinatarios.join(", ")}.`, "success");
        }
      } else {
        toast("OS salva.", "success");
      }
      usePendencias.getState().carregar(true); // atualiza os badges de pendência
      guard.liberar();
      // Salvou: volta para a tela de visualização. Antes só a URL era
      // "navegada" — como é a mesma rota da edição, a pessoa continuava no
      // formulário aberto.
      setEditando(false);
      window.scrollTo({ top: 0 });
      navigate(`/ordens/${salvo.id}`);
    } catch (e) {
      toast(`Erro ao salvar a OS: ${(e as Error).message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  /* ------------------- Revisar, nova versão, cancelar, arquivar -------------------- */

  /** OS que já saiu de cena (cancelada ou arquivada): não se mexe mais nela. */
  const encerradaDoc = os != null && (os.status === "Cancelada" || os.status === "Arquivada");

  /** O nome do item da EC, para a conferência falar de "Buffet" e não de um id. */
  const nomeDoItemEc = (ecLinhaId: string) => {
    const l = linhasConsolidadas.find((x) => x.id === ecLinhaId);
    return l?.item?.trim() || l?.descricao?.trim() || "(item sem nome)";
  };

  /**
   * Revisar: manda à IA SÓ os textos alterados ainda não revisados (28/10/2026)
   * e abre o comparativo do que mudou desde o último salvamento.
   */
  async function revisar() {
    const gravada = baseline ? (JSON.parse(baseline) as Os) : null;
    const pendentes = pendentesDeRevisao(camposDaOs(os!), camposDaOs(gravada ?? os!), jaRevisados);
    setRevisando(true);
    const { textos, falhou } = await revisarPendentes(pendentes);
    setRevisando(false);
    const corrigida = aplicarNaOs(os!, textos);
    setOs(corrigida);
    if (falhou) await avisarFalhaRevisao();
    else setJaRevisados(lembrarRevisados(jaRevisados, pendentes, textos));
    setRevisao(revisarOs(gravada, corrigida, nomeDoItemEc));
  }

  /**
   * GERAR NOVA VERSÃO da OS. A versão atual é ARQUIVADA automaticamente (é o
   * servidor que faz — `gerar_nova_versao_os`) e a nova nasce rascunho, já com
   * os dados gerais de HOJE do projeto. O que ainda não foi salvo aqui não entra.
   */
  async function gerarNovaVersaoOs() {
    if (!(await confirmar({
      titulo: "Gerar nova versão desta OS?",
      mensagem:
        "Ao gerar uma nova versão da OS, a versão atual será arquivada automaticamente." +
        (sujo ? " As alterações que você ainda não salvou não entram na nova versão." : ""),
      confirmarTexto: "Gerar nova versão",
    }))) return;
    setBusy(true);
    try {
      const viva = await comDadosAtuaisDoProjeto(ecCtx!);
      const todas = await repo.oss.porEc(ecCtx!.id);
      const versao = versaoOs(todas, ecCtx!.id, os!.fornecedor.cnpj, os!.fornecedor.razaoSocial);
      const numero = numeroOs(viva, os!.fornecedor, versao, undefined, os!.ecLinhaIds);
      const nova = await repo.oss.gerarNovaVersao(os!, { numero, projeto: viva.projeto, cliente: viva.cliente });
      toast(`Nova versão ${nova.numero} criada em rascunho. A anterior foi arquivada.`, "success");
      usePendencias.getState().carregar(true);
      guard.liberar();
      navigate(`/ordens/${nova.id}`);
    } catch (e) {
      toast(`Não foi possível gerar a nova versão: ${(e as Error).message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  /**
   * CANCELAR ou ARQUIVAR a OS — gestos de gente, com confirmação.
   *
   * Cancelada = o negócio caiu. Arquivada = saiu de cena sem o negócio ter
   * caído (o sistema também arquiva sozinho: nova versão, projeto arquivado).
   * Grava a OS COMO ESTÁ NO BANCO, só com o status trocado: edição pendente não
   * vai junto por acidente.
   */
  async function encerrarOs(novo: "Cancelada" | "Arquivada") {
    const cancelando = novo === "Cancelada";
    if (!(await confirmar({
      titulo: cancelando ? "Cancelar esta OS?" : "Arquivar esta OS?",
      mensagem: cancelando
        ? `A ${os!.numero} fica Cancelada — o negócio com o fornecedor não segue. Ela continua consultável, mas não pode mais ser editada nem gerar nova versão.`
        : `A ${os!.numero} vai para o arquivo do projeto. Ela continua consultável, mas não pode mais ser editada nem gerar nova versão.`,
      confirmarTexto: cancelando ? "Cancelar OS" : "Arquivar OS",
      cancelarTexto: "Voltar",
      tom: "danger",
    }))) return;
    setBusy(true);
    try {
      const gravada = baseline ? (JSON.parse(baseline) as Os) : os!;
      await repo.oss.salvar({ ...gravada, status: novo });
      toast(cancelando ? "OS cancelada." : "OS arquivada.", "success");
      usePendencias.getState().carregar(true);
      guard.liberar();
      navigate(`/ordens/${os!.id}`, { replace: true });
      navigate(0);
    } catch (e) {
      toast(`Não foi possível ${cancelando ? "cancelar" : "arquivar"} a OS: ${(e as Error).message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- Grupos criados nesta OS (além de Logística e Infra) ------ */

  const adicionarGrupoExtra = () => {
    const novo = { id: novoId(), nome: "Novo grupo", itens: [] as ItemExtraOs[] };
    setOs((o) => (o ? { ...o, gruposExtras: [...(o.gruposExtras ?? []), novo] } : o));
    // O grupo nasce fora do campo de visão numa OS longa — a mesma régua dos
    // itens da EC e dos blocos do cronograma.
    destacarElemento(idBlocoGrupoExtra(novo.id), "novo");
  };

  const atualizarGrupoExtra = (id: string, patch: Partial<GrupoExtraOs>) =>
    setOs((o) =>
      o ? { ...o, gruposExtras: (o.gruposExtras ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g)) } : o
    );

  const removerGrupoExtra = async (id: string) => {
    const grupo = (os?.gruposExtras ?? []).find((g) => g.id === id);
    if (grupo?.itens.length && !(await confirmar({
      titulo: `Excluir o grupo "${grupo.nome}"?`,
      mensagem: `Os ${grupo.itens.length} item(ns) dele saem da OS.`,
      confirmarTexto: "Excluir grupo",
    }))) return;
    setOs((o) => (o ? { ...o, gruposExtras: (o.gruposExtras ?? []).filter((g) => g.id !== id) } : o));
  };

  /**
   * Passa o bastão: grava a OS e a manda para a fase seguinte.
   *
   * A pendência de quem recebe nasce da própria fase (ver `os.fase`, em
   * `domain/pendencias`) — não há um "avisar fulano" à parte que possa ficar
   * para trás quando alguém devolve a OS.
   */
  async function avancarFase(destino: FaseOs, pergunta: { titulo: string; mensagem: string; confirmar: string }) {
    if (!(await confirmar({ titulo: pergunta.titulo, mensagem: pergunta.mensagem, confirmarTexto: pergunta.confirmar }))) return;
    await salvar(undefined, { fase: destino });
    setEditando(false);
  }

  /** Devolve a OS para a etapa anterior — acontece, e precisa ser explícito. */
  async function devolverFase() {
    const anterior = faseAnterior(fase);
    if (!anterior) return;
    if (!(await confirmar({
      titulo: "Devolver esta OS para a etapa anterior?",
      mensagem: `A OS volta para "${ROTULO_FASE[anterior]}" e a pendência passa para quem responde por aquela etapa.`,
      confirmarTexto: "Devolver",
    }))) return;
    await salvar(undefined, { fase: anterior });
  }

  /**
   * EMITIR a OS — o fim do ciclo EC → OS → EC.
   *
   * Duas coisas acontecem juntas, e é isso que fecha o circuito: a OS vira
   * "Emitida" e os itens da EC que ela consolida passam de "Emitir" para "OK"
   * (RPC `marcar_itens_da_os_como_emitidos`; pela tela não daria, porque quem
   * emite não tem escrita em `ec_linhas`).
   *
   * Antes disso, a trava do check-list: *"o sistema não pode permitir que uma OS
   * seja emitida se existir alguma pendência a ela relacionada"*. Note que ela é
   * de EMISSÃO, e não de salvamento — salvar segue livre, como ficou combinado
   * em 10/09: quem monta o documento raramente tem todas as respostas na mesma
   * sessão.
   */
  async function emitirOs() {
    const abertas = pendenciasAbertasDaOs;
    if (abertas.length) {
      irParaPendencia(abertas[0]);
      toast(
        `Esta OS tem ${abertas.length} pendência(s) em aberto (${abertas.slice(0, 2).map((p) => p.titulo).join("; ")}${abertas.length > 2 ? "…" : ""}). Resolva-as antes de emitir.`,
        "danger"
      );
      return;
    }
    // A contratação precisa estar fechada: forma escolhida em todo item, com
    // valor, e a mesma forma na OS inteira.
    if (problemasContratacao.length) {
      destacarElemento(ID_FORMAS_PAGAMENTO, "pendencia");
      toast(`Falta fechar a contratação: ${problemasContratacao[0]}${problemasContratacao.length > 1 ? ` (+${problemasContratacao.length - 1})` : ""}`, "danger");
      return;
    }
    if (!(await confirmar({
      titulo: `Emitir a OS ${os!.numero}?`,
      mensagem: "A OS passa a Emitida e os itens da EC que ela consolida ficam com a OS em OK. Depois disso, o que mudar exige uma nova versão.",
      confirmarTexto: "Emitir OS",
    }))) return;
    await salvar("Emitida", { fase: "emitida" });
    try {
      await repo.oss.fecharItensNaEc(os!.id);
    } catch (e) {
      toast(`A OS foi emitida, mas os itens da EC não foram fechados: ${(e as Error).message}`, "warning");
    }
    setEditando(false);
  }

  return (
    <FaseDaOsCtx.Provider value={encerradaDoc ? null : fase}>
    <PageShell
      breadcrumb={
        <button onClick={() => navigate(`/estimativas/${ecCtx.id}`)} className="hover:text-ink">{ecCtx.numero}</button>
      }
      // O NÚMERO é o título, como na EC. Ele aparecia três vezes no mesmo bloco
      // — na trilha, no subtítulo e implícito no título genérico "Ordem de
      // Serviço" —, gastando uma linha do cabeçalho grudado para repetir. Que
      // documento é este, a barra do projeto já diz: a aba OS está acesa.
      title={os.numero}
      titleAdornment={<Badge tom={tomStatusOs[os.status]}>{os.status}</Badge>}
      legenda={<LegendaProjeto info={os.projeto ?? ecCtx.projeto} projetoId={ecCtx.projetoId} />}
      // O segundo cabeçalho do projeto: a OS é uma página interna dele, e sem
      // esta barra quem entrava aqui perdia toda a referência de onde estava.
      subabas={ecCtx.projetoId ? <BarraProjeto projetoId={ecCtx.projetoId} atual="os" /> : undefined}
      topAction={
        /*
         * O MENU DA OS, como o da EC (15/09/2026).
         *
         * Eram quatro comandos soltos — Recolher, Baixar PDF, Salvar, Disparar —
         * numa tela que estava sempre em edição. Agora ele acompanha o estado do
         * documento: em leitura, oferece abrir a edição e o PDF; em edição,
         * Revisar e Salvar; e, quando a fase muda de mãos, o botão que passa o
         * bastão, que é o comando principal daquele momento.
         *
         * "Disparar OS" continua existindo, e só depois de emitida: mandar ao
         * fornecedor um documento que ainda está sendo montado é o que a fase
         * veio impedir.
         */
        <div className="flex gap-2 flex-wrap">
          {/* A ORDEM é a do menu da EC (29/09/2026): Editar OS (ou, em edição,
              Revisar + Salvar) · Gerar Nova Versão · Cancelar · Arquivar · PDF.
              "Recolher/Expandir os itens" nasce sozinho ao lado, no cabeçalho. */}
          {!editando && (podeEditar || verFinanceiro) && !emitida && !encerradaDoc && (
            <Button
              size="sm"
              icon={<IcPencil width={15} height={15} />}
              // Travado por outra pessoa: o botão fica desligado com o motivo à
              // mão, em vez de abrir a edição e recusar o salvamento no fim.
              disabled={trava.travado}
              title={trava.travado ? trava.aviso : undefined}
              onClick={() => setEditando(true)}
            >
              Editar OS
            </Button>
          )}

          {/* Aguarde no meio da tela enquanto salva, revisa ou muda de etapa. */}
          {busy && <CarregandoTela texto="Salvando…" />}
          {revisando && <CarregandoTela texto="Revisando os textos…" />}

          {/* EDIÇÃO: um botão para cada função. Revisar mostra o que mudou antes
              de gravar; Salvar grava. */}
          {editando && (
            <>
              <Button variant="secondary" size="sm" onClick={() => void revisar()} disabled={busy || revisando} title="Corrige a ortografia dos textos alterados (IA) e mostra o que mudou desde o último salvamento">
                {revisando ? "Revisando…" : "Revisar"}
              </Button>
              <Button size="sm" onClick={() => void salvar()} disabled={busy}>
                {busy ? "Salvando…" : "Salvar"}
              </Button>
            </>
          )}

          {os.id && podeEditar && !encerradaDoc && (
            <Button variant="secondary" size="sm" icon={<IcCopy width={15} height={15} />} disabled={busy} onClick={() => void gerarNovaVersaoOs()}>
              Gerar Nova Versão OS
            </Button>
          )}
          {os.id && (podeEditar || verFinanceiro) && !encerradaDoc && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void encerrarOs("Cancelada")}>
              Cancelar OS
            </Button>
          )}
          {os.id && (podeEditar || verFinanceiro) && os.status !== "Arquivada" && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void encerrarOs("Arquivada")}>
              Arquivar OS
            </Button>
          )}

          <Button
            data-tour="baixar-pdf"
            variant="secondary"
            size="sm"
            icon={<IcEye width={16} height={16} />}
            onClick={() => {
              if (!os.id) return toast("Salve a OS antes de baixar o PDF.", "info");
              void arquivarOsNoProjeto(os, ecCtx);
              navigate(`/ordens/${os.id}/imprimir?auto=1`);
            }}
          >
            OS PDF
          </Button>

          {/* CONTRATO EM WORD (16/09/2026) — o documento que o fornecedor
              assina, nos modelos Corporativo e Cultural da casa. Só aparece
              quando a EC pediu contrato. */}
          {haContrato && (
            <Button
              variant="secondary"
              size="sm"
              icon={<IcDoc width={15} height={15} />}
              onClick={() => void baixarOContrato()}
            >
              Contrato Word
            </Button>
          )}

          {/* A PASSAGEM DE BASTÃO — o comando principal de cada fase. */}
          {podeEditar && fase === "producao" && os.id && !encerradaDoc && (
            <Button
              size="sm"
              icon={<IcSend width={15} height={15} />}
              disabled={busy}
              onClick={() => void avancarFase("financeiro", {
                titulo: "Enviar esta OS para a conclusão do Financeiro?",
                mensagem: "Os blocos da produção passam a leitura e a OS vira pendência da Coordenação Administrativo-Financeira. Você pode receber a OS de volta, se precisar.",
                confirmar: "Enviar ao Financeiro",
              })}
            >
              Enviar OS para Conclusão Financeiro
            </Button>
          )}
          {verFinanceiro && fase === "financeiro" && !encerradaDoc && (
            <Button
              size="sm"
              icon={<IcSend width={15} height={15} />}
              disabled={busy}
              onClick={() => void avancarFase("backoffice", {
                titulo: "Enviar esta OS para emissão pelo Back-office?",
                mensagem: "A OS vira pendência do Back-office, que a emite. Emissão e faturamento continuam editáveis até a emissão.",
                confirmar: "Enviar ao Back-office",
              })}
            >
              Enviar OS para Emissão Back-Office
            </Button>
          )}
          {/* A emissão é do BACK-OFFICE, e pede a chave dela (`oss.emitir`).
              Com `oss.editar`, quem monta a OS — a Produção — emitiria o
              documento que a fase acabou de tirar das mãos dela. */}
          {podeEmitir && fase === "backoffice" && !encerradaDoc && (
            <Button size="sm" icon={<IcCheck width={15} height={15} />} disabled={busy} onClick={() => void emitirOs()}>
              Emitir OS
            </Button>
          )}
          {fase !== "producao" && !emitida && !encerradaDoc && (podeEditar || verFinanceiro) && (
            <Button variant="text" size="sm" disabled={busy} onClick={() => void devolverFase()}>
              Devolver à etapa anterior
            </Button>
          )}

          {/* O e-mail ao fornecedor é o último passo, e só do que já saiu. */}
          {emitida && podeEditar && (
            <Button
              variant="secondary"
              size="sm"
              icon={<IcSend width={15} height={15} />}
              onClick={() => void salvar(undefined, undefined, { disparar: true })}
              disabled={busy || !flags.disparoFornecedor}
              title={flags.disparoFornecedor ? "Envia a OS emitida ao fornecedor" : MOTIVO_DISPARO_DESLIGADO}
            >
              Disparar OS
            </Button>
          )}
        </div>
      }
    >
      <AvisoTravaEdicao trava={trava} />
      <AvisoEmailPendente className="mb-4" />
      <AvisoHomologacaoEmail className="mb-4" />

      {/* ONDE A OS ESTÁ (28/10/2026): a linha do tempo das quatro etapas, no
          alto — antes era uma faixa de texto aqui e o bloco "Status OS" no fim
          da tela. A etapa atual tem uma aura girando; as concluídas, um check.
          Embaixo, o que a etapa espera (sem isso os campos em cinza pareceriam
          defeito) e as pendências que travam a emissão, que levam ao campo. */}
      <section
        aria-label="Etapa da OS"
        className={cx(
          "mb-4 rounded-card border px-4 pt-4 pb-3 shadow-card",
          emitida ? "border-success/40 bg-success-soft/40" : "border-border-soft bg-surface"
        )}
      >
        <Stepper value={encerradaDoc ? -1 : FASES_OS.indexOf(fase)}>
          {FASES_OS.map((f, i) => (
            <StepperItem key={f} step={i} completed={emitida && !encerradaDoc} className="relative flex-1 !flex-col">
              <StepperTrigger asChild className="flex-col gap-2 text-center">
                <StepperIndicator />
                <div className="space-y-0.5 px-1">
                  <StepperTitle>{TITULO_ETAPA_OS[f]}</StepperTitle>
                  <StepperDescription className="max-sm:hidden">{DESCRICAO_ETAPA_OS[f]}</StepperDescription>
                </div>
              </StepperTrigger>
              {i < FASES_OS.length - 1 && (
                <StepperSeparator className="absolute top-4 left-[calc(50%+1.5rem)] right-[calc(-50%+1.5rem)] -order-1 m-0 -translate-y-1/2 !w-auto !flex-none" />
              )}
            </StepperItem>
          ))}
        </Stepper>
        <div className="mt-3 pt-2.5 border-t border-border-soft flex items-center gap-x-3 gap-y-1 flex-wrap text-[12.5px] text-ink-2">
          <span>{ESPERANDO_FASE[fase]}</span>
          {os.faseEm && <span className="text-ink-3">desde {dataBR(os.faseEm)}</span>}
          {!editando && !emitida && !encerradaDoc && (podeEditar || verFinanceiro) && (
            <span className="ml-auto text-ink-3">Modo leitura</span>
          )}
        </div>
        {!emitida && !encerradaDoc && (problemasContratacao.length > 0 || pendenciasAbertasDaOs.length > 0) && (
          <ul className="mt-2 space-y-0.5 text-[12.5px]">
            {problemasContratacao.map((m) => (
              <li key={m}>
                <button type="button" className="text-left text-danger font-bold hover:underline" onClick={() => destacarElemento(ID_FORMAS_PAGAMENTO, "pendencia")}>{m}</button>
              </li>
            ))}
            {pendenciasAbertasDaOs.map((p) => (
              <li key={p.id}>
                <button type="button" className="text-left text-danger font-bold hover:underline" onClick={() => irParaPendencia(p)}>{p.titulo}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-4">
        {/* A CONVERSA vem primeiro (pedido de 09/09/2026), e com o mesmo rótulo
            da EC: quem abre uma OS costuma abrir por causa do que foi dito nela
            — "o fornecedor mudou o valor", "falta o Pix" —, e no fim da tela
            isso ficava atrás de quinze blocos. Não sai em documento, e-mail nem
            planilha: é o corredor da equipe. */}
        <CardConversa
          ancora={os.id}
          ancoraDom={idAncoraPendencia(os.id)}
          observacoes={os.observacoes}
          usuarios={usuarios}
          minhas={pendenciasDoUsuario.filter((x) => x.tipo === "os.observacao" && x.osId === os.id).length}
          onChange={(observacoes) => setOs((o) => (o ? { ...o, observacoes } : o))}
        />

        {/* OS BLOCOS DA PRODUÇÃO ficam em leitura assim que a OS passa adiante.
            `fieldset disabled` trava input, select, textarea e botão de uma vez,
            sem cada campo precisar saber da fase — o mesmo recurso da aba Dados
            Gerais do projeto. Não é aviso: é o valor não mudando embaixo de quem
            já o usou para emitir a nota. */}
        <fieldset disabled={!mexeProducao} className="space-y-4 min-w-0 disabled:opacity-100">

        {/* Cabeçalho do modelo em Excel */}
        <CardOs secao="Ordem de Serviço" area="Produção">
          <LinhaOs label="Número da OS"><Auto v={os.numero} /></LinhaOs>
          <LinhaOs label="Projeto"><Auto v={os.projeto.titulo} /></LinhaOs>
          <LinhaOs label="Data de emissão"><Auto v={dataBR(os.criadoEm)} /></LinhaOs>
          {/* A linha "Status da OS" saiu daqui (15/09/2026): o selo já está no
              cabeçalho da página, ao lado do número, e na listagem. Dentro do
              documento ele gastava uma linha para repetir o que a tela inteira
              diz — e status não é conteúdo de ordem de serviço. */}
          <LinhaOs label="Itens consolidados"><Auto v={`${os.ecLinhaIds.length} linha(s) da EC`} /></LinhaOs>
        </CardOs>

        {/* DADOS DO CLIENTE — automático da EC */}
        <CardOs secao="Dados do Cliente" area="Produção">
          <LinhaOs label="Cliente"><Auto v={os.cliente.nome} /></LinhaOs>
          <LinhaOs label="Razão Social"><Auto v={os.cliente.razaoSocial} /></LinhaOs>
          <LinhaOs label="Endereço"><Auto v={os.cliente.endereco} /></LinhaOs>
          <LinhaOs label="CNPJ/CPF"><Auto v={os.cliente.cnpjCpf} /></LinhaOs>
          <LinhaOs label="Inscrição Estadual"><Auto v={os.cliente.inscricaoEstadual} /></LinhaOs>
          <LinhaOs label="Inscrição Municipal"><Auto v={os.cliente.inscricaoMunicipal} /></LinhaOs>
        </CardOs>

        {/* DADOS DO PROJETO — automático da EC, com o cronograma do projeto */}
        <CardOs secao="Dados do Projeto" area="Produção">
          <LinhaOs label="Título"><Auto v={os.projeto.titulo} /></LinhaOs>
          <LinhaOs label="Modalidade"><Auto v={os.projeto.modalidade} /></LinhaOs>
          {/* Os campos que aparecem na NF, no lugar do antigo "Incentivos Fiscais"
              (29/09/2026) — automáticos dos Dados Gerais do projeto. Projeto
              anterior a eles cai no texto único de antes. */}
          {osIncentivada(os) && (
            <LinhaOs label="Código do Projeto Incentivado"><Auto v={os.projeto.codigoProjetoIncentivado} /></LinhaOs>
          )}
          {/* Plural no rótulo porque o evento de vários dias é o caso comum, e
              porque aqui saem TODAS as faixas do cronograma — não só a primeira,
              que é o que os campos legados `evento`/`horario` guardam. */}
          <LinhaOs label="Data(s)"><Auto v={datasDoEvento(os.projeto)} /></LinhaOs>
          <LinhaOs label="Horário(s)"><Auto v={horariosDoEvento(os.projeto)} /></LinhaOs>
          {/* Endereço logo abaixo do Local: os dois são a mesma informação, e com
              o Nº de Participantes no meio a leitura quebrava. */}
          <LinhaOs label="Local"><Auto v={os.projeto.local} /></LinhaOs>
          <LinhaOs label="Endereço do Local"><Auto v={os.projeto.enderecoLocal} /></LinhaOs>
          <LinhaOs label="Nº Participantes"><Auto v={os.projeto.participantes ?? ""} /></LinhaOs>
          <LinhaOs label="Produtora Responsável"><Auto v={os.projeto.produtoraResponsavel} /></LinhaOs>
          <LinhaOs label="Telefone"><Auto v={os.projeto.telefoneProdutora} /></LinhaOs>
          <LinhaOs label="E-mail"><Auto v={os.projeto.emailProdutora} /></LinhaOs>
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
        <CardOs
          secao="Dados do Fornecedor"
          area="Produção"
          acaoSecao={
            <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={consultar} disabled={busy || !flags.consultaCnpj}>
              Consultar CNPJ
            </Button>
          }
        >
          {cnpjMsg && <div className="m-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{cnpjMsg}</div>}
          {/* O aviso vem ANTES do "Salvar", e não como surpresa depois dele: a
              troca não é uma edição, e quem está mexendo precisa saber disso
              enquanto ainda pode desfazer. */}
          {trocouFornecedor && (
            <div className="m-3 text-[12.5px] font-semibold text-warning bg-warning-soft rounded-btn px-3 py-2">
              Esta OS está {os.status.toLowerCase()} em nome de{" "}
              {fornecedorGravado.current?.nomeFantasia || fornecedorGravado.current?.razaoSocial || "outro fornecedor"}.
              Ao salvar, ela será arquivada e uma nova versão será criada com o fornecedor novo.
            </div>
          )}
          <LinhaOs label="Fornecedor" hint="(nome fantasia)"><Input formato="titulo" value={os.fornecedor.nomeFantasia ?? ""} onChange={(e) => updF({ nomeFantasia: e.target.value })} /></LinhaOs>
          <LinhaOs label="CNPJ/CPF"><Input value={os.fornecedor.cnpj} onChange={(e) => updF({ cnpj: maskCpfCnpjInput(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" /></LinhaOs>
          <LinhaOs label="Perfil" hint="(regime tributário)">
            <Select value={os.fornecedor.perfilTributario} onChange={(e) => updF({ perfilTributario: e.target.value })}>
              <option value="">Selecione…</option>
              {opcoesPerfilTributario(os.fornecedor.perfilTributario).map((perfil) => (
                <option key={perfil}>{perfil}</option>
              ))}
            </Select>
          </LinhaOs>
          <LinhaOs label="Razão Social"><Input formato="titulo-empresa" value={os.fornecedor.razaoSocial} onChange={(e) => updF({ razaoSocial: e.target.value })} /></LinhaOs>
          <LinhaOs label="Endereço"><Input formato="titulo" value={os.fornecedor.endereco} onChange={(e) => updF({ endereco: e.target.value })} /></LinhaOs>
          <LinhaOs label="Inscrição Estadual"><Input value={os.fornecedor.inscricaoEstadual} onChange={(e) => updF({ inscricaoEstadual: e.target.value })} /></LinhaOs>
          <LinhaOs label="Inscrição Municipal">
            <InscricaoMunicipalInput
              value={os.fornecedor.inscricaoMunicipal}
              onChange={(inscricaoMunicipal) => updF({ inscricaoMunicipal })}
            />
          </LinhaOs>
          <LinhaOs label="Conta PJ / PF">
            <Select value={os.fornecedor.dadosBancarios.tipoConta} onChange={(e) => updB({ tipoConta: e.target.value as Fornecedor["dadosBancarios"]["tipoConta"] })}>
              <option value="">Selecione…</option>
              <option value="PJ">PJ</option>
              <option value="PF">PF</option>
            </Select>
          </LinhaOs>
          <LinhaOs label="Banco" hint={bancoDaOs ? `(dados da ${bancoDaOs}, usada antes por este fornecedor)` : undefined}><Input value={os.fornecedor.dadosBancarios.banco} sugestoes={[...new Set([...bancos, ...sugestoes.valores.bancoFornecedor])]} onChange={(e) => updB({ banco: e.target.value })} /></LinhaOs>
          <LinhaOs label="Agência"><Input value={os.fornecedor.dadosBancarios.agencia} onChange={(e) => updB({ agencia: e.target.value })} /></LinhaOs>
          <LinhaOs label="Conta Corrente"><Input value={os.fornecedor.dadosBancarios.conta} onChange={(e) => updB({ conta: e.target.value })} /></LinhaOs>
          <LinhaOs label="Chave Pix"><Input value={os.fornecedor.dadosBancarios.chavePix} onChange={(e) => updB({ chavePix: e.target.value })} /></LinhaOs>
          <LinhaOs label="Representante"><Input formato="titulo" value={os.fornecedor.representante} onChange={(e) => updF({ representante: e.target.value })} /></LinhaOs>
          <LinhaOs label="Telefone" obrigatorio><TelefoneInput value={os.fornecedor.telefone} onChange={(v) => updF({ telefone: v })} /></LinhaOs>
          <LinhaOs label="E-mail" obrigatorio><Input value={os.fornecedor.email} onChange={(e) => updF({ email: e.target.value })} /></LinhaOs>
        </CardOs>

        {/* O bloco de cima é da PRODUÇÃO; o Detalhamento tem partes dela e uma do
            FINANCEIRO (a escolha da forma de pagamento), e um `fieldset`
            desabilitado não se reabre por dentro — então a trava da produção é
            fechada aqui e reaberta em volta de cada parte que é dela. */}
        </fieldset>

        {/* DETALHAMENTO DA CONTRATAÇÃO */}
        <CardOs secao={SECAO_DETALHAMENTO} area="Produção">
          <fieldset disabled={!mexeProducao} className="min-w-0 border-0 p-0 m-0 disabled:opacity-100">
          <LinhaOs label="Modalidade" obrigatorio>
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
          <LinhaOs label="Itens da EC" hint={`(${linhasConsolidadas.length} consolidado(s) — origem do descritivo)`}>
            <div className="py-2 space-y-1.5">
              {linhasConsolidadas.map((l) => (
                <div key={l.id} className="text-sm">
                  <span className="font-bold text-ink">{l.item || "—"}</span>
                  <span className="text-[12px] text-ink-3"> · {l.grupo}</span>
                  {l.descricao && <div className="text-[12px] text-ink-2">{l.descricao}</div>}
                </div>
              ))}
            </div>
          </LinhaOs>

          </fieldset>

          {/* A DEFINIÇÃO da contratação, item a item. A EC levanta o preço de
              cada forma; aqui se fecha qual vale, por quanto e com que BV — é
              esta OS que vira contrato com o fornecedor. Os valores já chegam
              preenchidos da EC e seguem editáveis. Só quem enxerga o financeiro
              vê e mexe (mesma regra do resto dos valores). */}
          {verFinanceiro && (
            <fieldset disabled={!mexeFinanceiro} className="min-w-0 border-0 p-0 m-0 disabled:opacity-100">
            <LinhaOs
              label="Formas de pagamento"
              obrigatorio
              hint="(valores e BV vêm da EC — o Financeiro escolhe UMA forma por item)"
            >
              <div id={ID_FORMAS_PAGAMENTO} className="py-1.5 space-y-2">
                {/* Dentro do Detalhamento (da Produção), esta linha é do Financeiro. */}
                <EtiquetaArea area="Financeiro" />
                {problemasContratacao.length > 0 && (
                  <div className="rounded-btn bg-warning-soft px-3 py-2 text-[12.5px] text-ink">
                    <p className="font-bold text-warning">Falta resolver antes de emitir:</p>
                    <ul className="list-disc pl-5 mt-0.5">
                      {problemasContratacao.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                )}
                {os.itens.map((i) => {
                  const l = linhasConsolidadas.find((x) => x.id === i.ecLinhaId);
                  return (
                    <ItemContratacao
                      key={i.ecLinhaId}
                      item={i}
                      nome={l?.item?.trim() || l?.descricao?.trim() || "(item sem nome)"}
                      grupo={l?.grupo ?? ""}
                      descricao={l?.descricao ?? ""}
                      podeEscolher={mexeFinanceiro}
                      onUpd={(patch) => updItem(i.ecLinhaId, patch)}
                    />
                  );
                })}
                {!os.itens.length && (
                  <p className="text-[12.5px] text-ink-3">Esta OS não está ligada a itens da EC.</p>
                )}
              </div>
            </LinhaOs>
            </fieldset>
          )}

          <fieldset disabled={!mexeProducao} className="min-w-0 border-0 p-0 m-0 disabled:opacity-100">
          <LinhaOs label="Descritivo" hint="(auto da EC)">
            <Textarea className="min-h-[140px]" value={os.descritivo} onChange={(e) => setOs((o) => (o ? { ...o, descritivo: e.target.value } : o))} />
            {descritivoDaEc && descritivoDaEc !== os.descritivo && (
              <button
                type="button"
                onClick={() => setOs((o) => (o ? { ...o, descritivo: descritivoDaEc } : o))}
                className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-bold text-primary-dark hover:underline"
                title="Substitui o texto acima pelo descritivo atual dos itens da EC (financeiro + detalhado)"
              >
                <IcSpark width={13} height={13} /> A EC mudou desde que esta OS nasceu — trazer o descritivo atual
              </button>
            )}
            {flags.descritivoIA && (
              <button onClick={descricaoIA} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-primary-dark hover:underline">
                <IcSpark width={14} height={14} /> Gerar com IA
              </button>
            )}
          </LinhaOs>
          {/* Sem memória de preenchimento, por decisão: a entrega é específica de
              cada contratação, e oferecer a de outra OS convidava a repetir o
              que não vale para esta. */}

          </fieldset>
          {/* PRAZO DE PAGAMENTO (28/10/2026): virou uma linha do Detalhamento
              da Contratação — os dois são da Produção, que negocia com o
              fornecedor quando ele recebe. Cada parcela tem a sua data. A FORMA
              de pagamento segue com o Financeiro, em Dados Emissão Faturamento. */}
          <fieldset disabled={!mexeProducao} className="min-w-0 border-0 p-0 m-0 disabled:opacity-100">
            <LinhaOs
              label="Prazo de pagamento"
              hint="(parcelas: descrição, data de pagamento e valor)"
              acao={
                <Button variant="secondary" size="sm" onClick={() => updOrc({ parcelas: [...os.orcamento.parcelas, { id: novoId(), descricao: "", valor: saldoParcelas }] })}>+ Parcela</Button>
              }
            >
              <div className="py-1.5 space-y-2">
                {os.orcamento.parcelas.map((pc, i) => (
                  <div key={pc.id ?? i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_150px_150px_auto] gap-2 items-center">
                    <Input className="!h-9 min-w-0 col-span-3 sm:col-span-1" placeholder={`Descrição da ${i + 1}ª parcela`} sugestoes={sugestoes.valores.descricaoParcela} value={pc.descricao} onChange={(e) => updOrc({ parcelas: os.orcamento.parcelas.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })} />
                    <Input
                      className="!h-9 min-w-0"
                      type="date"
                      title="Data de pagamento"
                      aria-label={`Data de pagamento da ${i + 1}ª parcela`}
                      value={pc.data ?? ""}
                      onChange={(e) => updOrc({ parcelas: os.orcamento.parcelas.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)) })}
                    />
                    <NumberInput className="!h-9 min-w-0" value={pc.valor} title={refParcelas.valor > 0 ? `Até ${brl(tetoDaParcela(i))} (saldo disponível)` : undefined} onValue={(v) => updOrc({ parcelas: os.orcamento.parcelas.map((x, j) => (j === i ? { ...x, valor: Math.min(v, tetoDaParcela(i)) } : x)) })} />
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
                      {refParcelas.valor > 0 && <> · saldo a distribuir: <b className="font-display">{brl(saldoParcelas)}</b></>}
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
          </fieldset>
        </CardOs>

        <fieldset disabled={!mexeProducao} className="space-y-4 min-w-0 disabled:opacity-100">

        {/* RESUMO DA CONTRATAÇÃO — o que o fornecedor precisa fazer e receber:
            entrega, cronograma, logística, infraestrutura, recados e, no fim, a
            tabela do que foi definido no bloco de cima. Estava tudo num card só
            com o Detalhamento, e o formulário virava uma coluna sem fim em que
            "o que se contrata" e "como se executa" se misturavam. */}
        {/* O NOME diz o que o bloco tem dentro (15/09/2026). "Resumo da
            Contratação" prometia um resumo dos valores — que fica no
            Detalhamento — e entregava cronograma, logística e infraestrutura.
            A "Entrega" saiu junto: era um campo de texto livre que repetia o
            que o cronograma já diz, linha a linha e com data. */}
        <CardOs secao="Cronograma | Logística | Infraestrutura" area="Produção">
          {/* Cronograma específico do fornecedor — já vem do cronograma do projeto.
              O `id` é o endereço da pendência "cronograma não preenchido": ela é
              cobrada na etapa da OS e se resolve aqui, então a pílula pisca este
              bloco (antes ela contava no badge e não tinha o que achar). */}
          <LinhaOs
            id={idAncoraPendencia(ancoraCronogramaOs(os.id))}
            label="Cronograma do Fornecedor"
            acao={
              <div className="flex items-center gap-2">
                {/* O cronograma inteiro pode não se aplicar (15/09/2026): numa OS
                    de locação sem montagem no local, a tabela vazia fazia o
                    fornecedor procurar o que preencher. É resposta, não ausência. */}
                <button
                  type="button"
                  onClick={() => setOs((o) => (o ? { ...o, cronogramaNaoSeAplica: !o.cronogramaNaoSeAplica } : o))}
                  className="text-[10.5px] font-bold text-ink-3 hover:text-primary-dark input-focus rounded px-1"
                  title={os.cronogramaNaoSeAplica ? "Voltar a preencher o cronograma" : "Esta OS não tem cronograma — o bloco some do documento"}
                >
                  {os.cronogramaNaoSeAplica ? "Informar cronograma" : "Não se aplica"}
                </button>
                {!os.cronogramaNaoSeAplica && (
                  <Button variant="secondary" size="sm" onClick={() => setOs((o) => (o ? { ...o, cronograma: [...o.cronograma, { id: novoId(), etapa: "", data: "", horario: "", atividades: "" }] } : o))}>+ Etapa</Button>
                )}
              </div>
            }
          >
            {/* No celular a tabela rola na horizontal em vez de espremer sete
                colunas; `overflow-x-auto` só abaixo de md, para não criar
                container de rolagem onde não precisa (ver ui/Table). */}
            {os.cronogramaNaoSeAplica ? (
              <div className="py-2 text-[12.5px] font-bold text-ink-3">Não se aplica — o cronograma não sai nesta OS.</div>
            ) : (
            <div className="py-1.5 overflow-x-auto md:overflow-visible">
              {/* Duas colunas vazias na frente: a alça de arraste e as setas. */}
              <div className={cx(GRADE_CRONOGRAMA, "mb-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3 px-1")}>
                <span /><span />
                <span>Data</span><span>Horário</span><span>Etapa</span><span>Descritivo da contratação</span><span />
              </div>
              {/* Arraste para saltos grandes, setas para uma posição por vez — o
                  mesmo par do cronograma do projeto e dos itens da EC. */}
              <ListaArrastavel ids={idsCronograma} onReordenar={reordenarCronograma} className="space-y-2">
                {os.cronograma.map((c, i) => {
                  const rotulo = `a etapa ${c.etapa?.trim() || i + 1}`;
                  return (
                    <ItemArrastavel key={idDaEtapa(c, i)} id={idDaEtapa(c, i)} className={cx(GRADE_CRONOGRAMA, "items-center")}>
                      {(alca) => (
                        <>
                          <span className="flex items-center justify-center">{alca}</span>
                          <MoverSetas
                            rotulo={rotulo}
                            podeSubir={i > 0}
                            podeDescer={i < os.cronograma.length - 1}
                            onSubir={() => moverCronograma(i, -1)}
                            onDescer={() => moverCronograma(i, 1)}
                          />
                          <Input className="!h-9" type="date" value={c.data} onChange={(e) => setCron(i, { data: e.target.value })} />
                          <Input className="!h-9" placeholder="08h às 18h" sugestoes={sugestoes.valores.horario} value={c.horario} onChange={(e) => setCron(i, { horario: e.target.value })} />
                          <Input className="!h-9" placeholder="Montagem, Ensaio…" sugestoes={sugestoes.valores.etapaCronograma} value={c.etapa} onChange={(e) => setCron(i, { etapa: e.target.value })} />
                          <Input className="!h-9" placeholder="Descritivo da contratação" sugestoes={sugestoes.valores.atividadesCronograma} value={c.atividades} onChange={(e) => setCron(i, { atividades: e.target.value })} />
                          <button
                            type="button"
                            className="text-ink-3 hover:text-danger px-2"
                            aria-label={`Excluir ${rotulo}`}
                            title="Excluir etapa"
                            onClick={() => removerEtapaCronograma(i)}
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </ItemArrastavel>
                  );
                })}
              </ListaArrastavel>
              {os.cronograma.length === 0 && <p className="text-[12.5px] text-ink-3 px-1">Nenhuma etapa. Use “+ Etapa” para adicionar.</p>}
            </div>
            )}
          </LinhaOs>

          {/* LOGÍSTICA e INFRAESTRUTURA, um item por linha (15/09/2026).
              Lado a lado, o rótulo e o campo disputavam a mesma largura e os
              itens de nome longo quebravam em duas linhas, desalinhando a
              coluna vizinha. Cada um na sua linha também é o que dá lugar às
              setas e ao "não se aplica" sem espremer nada.
              Os dois blocos aceitam ITEM NOVO, criado nesta OS: a lista fixa
              cobre o que se repete em toda OS, e o que é daquele evento
              ("gerador de 180 kVA") não tinha onde ser escrito. */}
          <BlocoDeItens
            titulo="Logística do Fornecedor"
            campos={CAMPOS_LOGISTICA}
            bloco={os.logistica}
            valorDe={(campo) => os.logistica[campo] ?? ""}
            sugestoes={sugestoes.valores}
            onBloco={(patch) => setOs((o) => (o ? { ...o, logistica: { ...o.logistica, ...patch } } : o))}
            onCampo={(campo, valor) => updLog({ [campo]: valor } as Partial<Os["logistica"]>)}
          />

          <BlocoDeItens
            titulo="Infraestrutura"
            campos={CAMPOS_INFRAESTRUTURA}
            bloco={os.infraestrutura}
            valorDe={(campo) => os.infraestrutura[campo] ?? ""}
            sugestoes={sugestoes.valores}
            onBloco={(patch) => setOs((o) => (o ? { ...o, infraestrutura: { ...o.infraestrutura, ...patch } } : o))}
            onCampo={(campo, valor) => updInfra({ [campo]: valor } as Partial<Os["infraestrutura"]>)}
          />

          {/* GRUPOS CRIADOS NESTA OS — "Segurança", "Limpeza". Entram depois dos
              dois fixos, na ordem em que foram criados. */}
          {(os.gruposExtras ?? []).map((grupo) => (
            <BlocoDeItens
              key={grupo.id}
              titulo={grupo.nome}
              tituloEditavel
              campos={[] as readonly { campo: string; rotulo: string }[]}
              ancoraDom={idBlocoGrupoExtra(grupo.id)}
              bloco={{ extras: grupo.itens, ordem: grupo.ordem }}
              valorDe={() => ""}
              sugestoes={sugestoes.valores}
              onTitulo={(nome) => atualizarGrupoExtra(grupo.id, { nome })}
              onExcluir={() => void removerGrupoExtra(grupo.id)}
              onBloco={(patch) => atualizarGrupoExtra(grupo.id, {
                ...(patch.extras ? { itens: patch.extras } : {}),
                ...(patch.ordem ? { ordem: patch.ordem } : {}),
              })}
              onCampo={() => {}}
            />
          ))}

          <LinhaOs label="">
            <button
              type="button"
              onClick={adicionarGrupoExtra}
              className="py-1.5 text-[12.5px] font-bold text-primary-dark hover:underline input-focus rounded"
            >
              + Novo grupo (além de Logística e Infraestrutura)
            </button>
          </LinhaOs>

        </CardOs>

        {/* OBSERVAÇÕES GERAIS em módulo PRÓPRIO (15/09/2026).
            Elas moravam dentro do bloco de cronograma e logística, e ali pareciam
            observação daquelas listas — quando são o recado da OS inteira, o
            último parágrafo que o fornecedor lê. Texto livre, escrito PARA ELE:
            sai no documento, no e-mail e na planilha. A conversa interna da
            equipe continua no card do topo. */}
        <CardOs
          secao="Observações Gerais"
          area="Produção"
          acaoSecao={
            <button
              type="button"
              onClick={() => setOs((o) => (o ? { ...o, observacoesGeraisNaoSeAplica: !o.observacoesGeraisNaoSeAplica } : o))}
              className="text-[10.5px] font-bold text-ink-2 hover:text-primary-dark input-focus rounded px-1"
              title={os.observacoesGeraisNaoSeAplica ? "Voltar a escrever observações" : "Esta OS não tem observações — o bloco some do documento"}
            >
              {os.observacoesGeraisNaoSeAplica ? "Informar" : "Não se aplica"}
            </button>
          }
        >
          <LinhaOs label="Observações Gerais" hint="(sai no documento e na planilha)">
            {os.observacoesGeraisNaoSeAplica ? (
              <div className="py-2 text-[12.5px] font-bold text-ink-3">Não se aplica — não saem nesta OS.</div>
            ) : (
              <Textarea
                className="min-h-[90px]"
                value={os.observacoesGerais}
                onChange={(e) => setOs((o) => (o ? { ...o, observacoesGerais: e.target.value } : o))}
                placeholder="O que o fornecedor precisa saber e não coube nos outros campos."
              />
            )}
          </LinhaOs>
        </CardOs>


        {/* O CREDENCIAMENTO saiu daqui (29/08/2026): virou subaba do Projeto, onde
            se vê a fila inteira e se dispara para todos os fornecedores de uma
            vez. O link continua sendo o desta OS — o que mudou foi o comando.
            O "Pagamento ao Fornecedor" saiu daqui em 16/09/2026: virou o
            "Resumo dos Custos" — hoje um módulo próprio, logo abaixo. */}
        </fieldset>

        {/* O BOTÃO QUE PASSA O BASTÃO, logo depois das Observações Gerais
            (29/09/2026): quem monta a OS chega ao fim do formulário e o comando
            está ali, sem voltar ao topo. Gera a pendência da Coordenação
            Administrativo-Financeira, como o do cabeçalho. */}
        {podeEditar && fase === "producao" && os.id && !encerradaDoc && (
          <div className="flex justify-end">
            <Button
              icon={<IcSend width={15} height={15} />}
              disabled={busy}
              onClick={() => void avancarFase("financeiro", {
                titulo: "Enviar esta OS para a conclusão do Financeiro?",
                mensagem: "Os blocos da produção passam a leitura e a OS vira pendência da Coordenação Administrativo-Financeira. Você pode receber a OS de volta, se precisar.",
                confirmar: "Enviar ao Financeiro",
              })}
            >
              Enviar OS para Conclusão Financeiro
            </Button>
          </div>
        )}

        {/* RESUMO DOS CUSTOS em módulo próprio, depois da parte da produção
            (22/10/2026). É preenchido pelo Financeiro (prazo de pagamento,
            documento fiscal), então fica abaixo do botão que passa a OS a ele
            e só abre na fase dele. Quem vê não mudou: segue aberto a quem abre
            a OS; só a tabela item a item é restrita ao financeiro. */}
        <fieldset disabled={!mexeFinanceiro} className="min-w-0 border-0 p-0 m-0 disabled:opacity-100">
        <CardOs secao="Resumo dos Custos" area="Financeiro">

            {/* Sem o valor do item na EC (21/10/2026): aquele é o preço ao
                cliente. O valor da OS é o que se paga ao fornecedor. */}
            {/* Os totais saem da forma que cada item ADOTOU (29/09/2026): não são
                digitáveis aqui, e alimentam o Faturamento e o Contrato. */}
            <LinhaOs label="Valor Total Contratado" hint="(soma da forma adotada em cada item)"><Auto v={brl(resumo.contratado)} /></LinhaOs>
            <LinhaOs label="Valor Total do BV" hint="(só dos itens com BV e NF)"><Auto v={brl(resumo.bvTotal)} /></LinhaOs>
            <LinhaOs label="Valor Líquido" hint="(contratado menos o BV)"><Auto v={brl(resumo.liquido)} /></LinhaOs>

            {/* O prazo é negociado pela Produção (linha "Prazo de pagamento" do Detalhamento da Contratação,
                acima); aqui o Financeiro só o confere. */}
            <LinhaOs label="Prazo de Pagamento" hint="(negociado pela Produção)">
              <div className="py-1.5 text-[13px] text-ink space-y-0.5">
                {os.orcamento.parcelas.length === 0 ? (
                  <span className="text-ink-3">Sem parcelas informadas.</span>
                ) : (
                  os.orcamento.parcelas.map((pc, i) => (
                    <div key={pc.id ?? i}>
                      {i + 1}ª — {pc.descricao || "Parcela"}
                      {pc.data ? ` · ${dataBR(pc.data)}` : " · sem data"}: <b className="font-display">{brl(pc.valor)}</b>
                    </div>
                  ))
                )}
                {parcelasDivergem && (
                  <p className="text-danger font-semibold">
                    Não fecha com o {refParcelas.rotulo} ({brl(refParcelas.valor)}) — diferença de {brl(Math.abs(somaParcelas - refParcelas.valor))}.
                  </p>
                )}
              </div>
            </LinhaOs>

            {docDaForma ? (
              <LinhaOs label="Documento Fiscal" hint="(segue a forma de pagamento: com NF → Nota Fiscal, sem NF → Fatura)">
                <Auto v={docDaForma} />
              </LinhaOs>
            ) : (
              <LinhaOs label="Documento Fiscal" hint="(definido pela forma de pagamento; enquanto não há forma, escolha aqui)">
                <Select value={os.orcamento.documentoFiscal} onChange={(e) => updOrc({ documentoFiscal: e.target.value as DocumentoFiscal })}>
                  <option value="">Selecione…</option>
                  {DOCS.map((d) => <option key={d}>{d}</option>)}
                </Select>
              </LinhaOs>
            )}
            {verFinanceiro && (
            <LinhaOs label="Definido item a item" hint="(o que sai no PDF e na planilha)">
              <TabelaResumoCustos resumo={resumo} />
            </LinhaOs>
          )}
        </CardOs>
        </fieldset>

        {/* OS BLOCOS DO FINANCEIRO só abrem na fase dele (e seguem abertos no
            back-office, que ainda corrige um código de serviço na hora de
            emitir). Emitida, nada mais se edita: o que muda vira nova versão. */}
        <fieldset disabled={!mexeFinanceiro} className="space-y-4 min-w-0 disabled:opacity-100">

        {/* INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO DA PÓLOBH */}
        {verFinanceiro ? (
          <>
          {/* O nome do módulo é o que ele faz (15/09/2026), e o subtítulo saiu:
              ele listava os quatro documentos possíveis — que é a pergunta do
              campo "Documento PG", não um título. */}
          <CardOs className="border-active-border" secao="Dados Emissão Faturamento" area="Financeiro">
            <LinhaOs label="Tomador dos Serviços">
              {/* Pólobh, MF, Cliente ou Outro. As empresas do grupo vêm do
                  cadastro (Configurações › Empresas do Grupo): a MF já existia
                  lá e não tinha como ser escolhida aqui — quem faturava por ela
                  corrigia a razão social à mão, dentro do documento, toda vez. */}
              <Select value={os.financeiro.tomador} onChange={(e) => updFin({ tomador: e.target.value })}>
                <option value="">Selecione…</option>
                {opcoesDeTomador(empresas).map((o) => (
                  <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                ))}
              </Select>
            </LinhaOs>
            {os.financeiro.tomador === TOMADOR_OUTRO ? (
              <TomadorAvulsoCampos
                dados={os.financeiro.tomadorAvulso}
                onDados={(tomadorAvulso) => updFin({ tomadorAvulso })}
              />
            ) : dadosTomador ? (
              <>
                <LinhaOs label="Razão Social"><Auto v={dadosTomador.razaoSocial} /></LinhaOs>
                <LinhaOs label="Endereço"><Auto v={dadosTomador.endereco} /></LinhaOs>
                <LinhaOs label="CNPJ/CPF"><Auto v={dadosTomador.cnpjCpf} /></LinhaOs>
                <LinhaOs label="Inscrição Estadual"><Auto v={dadosTomador.inscricaoEstadual} /></LinhaOs>
                <LinhaOs label="Inscrição Municipal"><Auto v={dadosTomador.inscricaoMunicipal} /></LinhaOs>
                {faltaCadastroTomador && (
                  <LinhaOs label="">
                    <p className="py-2 text-[12.5px] font-semibold text-danger">
                      A empresa emissora da Pólobh ainda não está cadastrada — os dados da nota saem em branco.{" "}
                      <Link to="/configuracoes?aba=empresas" className="underline text-primary-dark">
                        Cadastrar em Configurações › Empresas do Grupo
                      </Link>
                    </p>
                  </LinhaOs>
                )}
              </>
            ) : (
              <LinhaOs label="Dados do Tomador">
                <p className="py-2 text-[12.5px] text-ink-3">Selecione o tomador para carregar os dados fiscais.</p>
              </LinhaOs>
            )}
            <LinhaOs label="Descritivo Nota Fiscal" hint="(auto do descritivo da EC)">
              <Textarea value={os.financeiro.descritivoNf} onChange={(e) => updFin({ descritivoNf: e.target.value })} />
            </LinhaOs>
            {/* CÓDIGO DO PROJETO INCENTIVADO, sozinho (16/09/2026).
                O campo acima guarda a lei E o número juntos, porque é assim que
                eles aparecem na nota e é assim que o Projeto os guarda. Mas o
                contrato Cultural cita os dois em lugares diferentes da Cláusula
                Primeira — "no âmbito da LEI, sob o CÓDIGO" —, e partir a string
                na hora de gerar o Word seria adivinhar onde a lei acaba. Então
                o código também existe à parte, e nasce sugerido do que vier
                depois do travessão. Só o contrato Cultural o usa. */}
            {(modeloContrato === "Cultural" || !!os.financeiro.codigoProjetoIncentivado) && (
              <LinhaOs label="Código do Projeto Incentivado" hint="(vai para a Cláusula Primeira do contrato)">
                <Input
                  value={os.financeiro.codigoProjetoIncentivado ?? ""}
                  sugestoes={sugestoes.valores.codigoProjetoIncentivado}
                  onChange={(e) => updFin({ codigoProjetoIncentivado: e.target.value })}
                  placeholder="Ex.: PRONAC 26 1234"
                />
                {!os.financeiro.codigoProjetoIncentivado && codigoSugerido && (
                  <button
                    type="button"
                    onClick={() => updFin({ codigoProjetoIncentivado: codigoSugerido })}
                    className="mt-1.5 text-[12px] font-bold text-primary-dark hover:underline"
                  >
                    Usar “{codigoSugerido}”, da lei acima
                  </button>
                )}
              </LinhaOs>
            )}
            <LinhaOs
              label="CNAE"
              hint={os.fornecedor.cnaes?.length ? `(${os.fornecedor.cnaes.length} do cartão CNPJ)` : "(consulte o CNPJ do fornecedor)"}
            >
              <CnaeDoFornecedor
                valor={os.financeiro.cnae}
                doCnpj={os.fornecedor.cnaes ?? []}
                jaUsados={sugestoes.valores.cnae}
                onValor={(cnae) => updFin({ cnae })}
              />
            </LinhaOs>
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
            {/* O bloco de emissão TERMINA aqui, no par valor + forma: o que
                vem depois (BV, acerto) não é dado de nota — foi para "Acertos
                Financeiros", grupo próprio no fim da tela.
                A forma de pagamento DESTE bloco acompanha a nota, e existe
                sempre; a do bloco de contrato é cláusula contratual, e só
                existe quando há contrato. São dois campos de propósito. */}
            <LinhaOs label="Valor total a pagar"><Auto v={brl(os.financeiro.valorAPagar)} /></LinhaOs>
            <LinhaOs label="Forma de Pagamento" hint="(como o fornecedor recebe — editável)">
              <Input
                value={os.financeiro.formaPagamento ?? ""}
                sugestoes={sugestoes.valores.formaPagamento}
                onChange={(e) => updFin({ formaPagamento: e.target.value })}
                placeholder={FORMA_PAGAMENTO_PADRAO}
              />
            </LinhaOs>

            {/* CÓDIGO DE SERVIÇO e ORDEM DE COMPRA fecham o bloco (15/09/2026):
                os valores subiram, porque é por eles que se confere a nota, e
                estes dois desceram porque são o último dado a se saber.
                Eles NASCEM AQUI e voltam preenchidos para os itens da EC válida
                (ver a RPC `devolver_dados_fiscais_para_ec`): na EC os dois são
                leitura. Antes o "Pedido de Compra" era digitado lá, a OS nem o
                conhecia, e a EC ainda esperava por ele para deixar a OS nascer. */}
            <LinhaOs label="Código de Serviço" hint="(vai para os itens da EC)">
              <Input value={os.financeiro.codigoServico} sugestoes={sugestoes.valores.codigoServico} onChange={(e) => updFin({ codigoServico: e.target.value })} />
            </LinhaOs>
            <LinhaOs label="Ordem de Compra" hint="(vai para os itens da EC)">
              <Input value={os.financeiro.ordemCompra ?? ""} sugestoes={sugestoes.valores.pedidoCompra} onChange={(e) => updFin({ ordemCompra: e.target.value })} placeholder="Ex.: PC-2026-119" />
            </LinhaOs>

            {/* RETENÇÕES FISCAIS (15/09/2026) — texto padrão da casa, em box de
                cor própria, porque é o aviso que evita o retrabalho mais caro
                da OS: o fornecedor que emite a nota sem reter o ISSQN devolve
                dinheiro depois, e cobrar essa correção é sempre pior do que o
                aviso. "Não se aplica" é resposta; o campo em branco não. */}
            <LinhaOs
              label="Retenções Fiscais"
              acao={
                <button
                  type="button"
                  onClick={() => updFin({ retencoesNaoSeAplica: !os.financeiro.retencoesNaoSeAplica })}
                  className="text-[10.5px] font-bold text-ink-3 hover:text-primary-dark input-focus rounded px-1"
                >
                  {os.financeiro.retencoesNaoSeAplica ? "Usar o texto padrão" : "Não se aplica"}
                </button>
              }
            >
              {os.financeiro.retencoesNaoSeAplica ? (
                <div className="py-2 text-[12.5px] font-bold text-ink-3">Não se aplica</div>
              ) : (
                <>
                  <Textarea
                    className="min-h-[86px] !bg-warning-soft !border-warning/50"
                    value={os.financeiro.retencoes ?? RETENCOES_PADRAO}
                    onChange={(e) => updFin({ retencoes: e.target.value })}
                  />
                  {(os.financeiro.retencoes ?? RETENCOES_PADRAO) !== RETENCOES_PADRAO && (
                    <button
                      type="button"
                      onClick={() => updFin({ retencoes: RETENCOES_PADRAO })}
                      className="mt-1 text-[12px] font-bold text-primary-dark hover:underline"
                    >
                      Voltar ao texto padrão
                    </button>
                  )}
                </>
              )}
            </LinhaOs>

            {/* DADOS PARA CONTRATO — só existe quando a EC pediu "Emitir" ou
                "Emitir Nova Versão" na coluna Contrato de algum item.
                "Não se aplica" lá significa que não há contrato, e um grupo
                vazio na tela não é neutro: ele descreve um contrato inexistente
                com valores, forma de pagamento e data, e é isso que sai no
                documento do fornecedor. Então o grupo inteiro não aparece — nem
                como aviso (revisão de 09/09/2026). */}
            {haContrato && (
            <>
            <SubSecao>Dados para Contrato</SubSecao>

            {/* MODELO — Corporativo ou Cultural, os dois .docx que a Pólobh
                mandou em 16/09/2026. A modalidade do projeto já responde isso
                na quase totalidade dos casos, e é ela que vale enquanto
                ninguém escolher: o seletor existe para o projeto corporativo
                com um item incentivado, que é raro e existe. */}
            <LinhaOs label="Modelo do Contrato" hint={`(o projeto é ${os.projeto.modalidade || "sem modalidade"})`}>
              <Select
                value={os.contrato.modelo ?? ""}
                onChange={(e) => updCt({ modelo: (e.target.value || undefined) as ModeloContrato | undefined })}
              >
                <option value="">Pela modalidade do projeto — {modeloContrato}</option>
                <option value="Corporativo">Corporativo</option>
                <option value="Cultural">Cultural</option>
              </Select>
              {modeloContrato === "Cultural" && (
                <p className="mt-1.5 text-[12px] text-ink-2">
                  O modelo Cultural nomeia o projeto incentivado, a lei e o código na Cláusula Primeira —
                  os três vêm do bloco de faturamento, acima.
                </p>
              )}
            </LinhaOs>

            {/* CONTRATANTE = TOMADOR. O modelo é explícito no bloco de
                assinaturas ("CONTRATANTE – Razão Social do Tomador"), então o
                padrão é seguir o que já foi respondido no faturamento, e não
                perguntar de novo. */}
            <LinhaOs label="Contratante" hint="(quem contrata o fornecedor — por padrão, o tomador da nota)">
              <Select value={os.contrato.contratante} onChange={(e) => updCt({ contratante: e.target.value })}>
                <option value="">
                  Mesmo do faturamento{dadosTomador ? ` — ${dadosTomador.rotulo}` : ""}
                </option>
                {opcoesDeTomador(empresas).map((o) => (
                  <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                ))}
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
                {textoObjetoContrato(os.financeiro, osIncentivada(os))}
              </p>
              <Textarea value={os.contrato.descritivoServicos} onChange={(e) => updCt({ descritivoServicos: e.target.value })} placeholder="Padrão: vem do Descritivo NF — editável" />
            </LinhaOs>
            <LinhaOs label="Informações Complementares" hint="(preencher)">
              <Textarea value={os.contrato.informacoesComplementares} onChange={(e) => updCt({ informacoesComplementares: e.target.value })} placeholder="O que este contrato tem de particular e não está no descritivo." />
              <TextosJaUsados valor={os.contrato.informacoesComplementares} opcoes={sugestoes.valores.informacoesComplementares} onEscolher={(informacoesComplementares) => updCt({ informacoesComplementares })} />
            </LinhaOs>
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
            <LinhaOs label="Forma de Pagamento" hint="(padrão do modelo — editável)">
              <Input value={os.contrato.formaPagamento ?? ""} sugestoes={sugestoes.valores.formaPagamento} onChange={(e) => updCt({ formaPagamento: e.target.value })} placeholder={FORMA_PAGAMENTO_PADRAO} />
            </LinhaOs>
            <LinhaOs label="Observações Gerais" hint="(padrão do modelo — editável)">
              <Textarea value={os.contrato.observacoesGerais ?? ""} onChange={(e) => updCt({ observacoesGerais: e.target.value })} />
              <TextosJaUsados valor={os.contrato.observacoesGerais ?? ""} opcoes={sugestoes.valores.observacoesContrato} onEscolher={(observacoesGerais) => updCt({ observacoesGerais })} />
            </LinhaOs>
            <LinhaOs label="Data do Contrato" hint="(auto — data da emissão da OS)"><Input type="date" value={os.contrato.dataContrato} onChange={(e) => updCt({ dataContrato: e.target.value })} /></LinhaOs>
            <LinhaOs label="Rubrica" hint="(preencher)"><Input value={os.contrato.rubrica} sugestoes={sugestoes.valores.rubrica} onChange={(e) => updCt({ rubrica: e.target.value })} placeholder="Iniciais de quem responde pelo contrato" /></LinhaOs>

            {/* AS SETE CLÁUSULAS. Nos dois modelos, cada uma traz à margem a
                anotação "Manter este campo editável" — é o texto da casa, e ele
                sai do padrão quando o negócio pede. Cada campo nasce com o texto
                do modelo e só é gravado quando muda: assim, corrigir o padrão
                mais tarde vale para os contratos que ainda não foram assinados.
                A Cláusula Primeira é a exceção — o que se escreve aqui é a
                abertura; o descritivo e os valores logo abaixo dela são montados
                com os dados da OS, e é por isso que o rótulo diz isso. */}
            <SubSecao>Cláusulas do Contrato — modelo {modeloContrato}</SubSecao>
            {clausulas.map((c) => {
              const escrito = os.contrato.clausulas?.[c.chave];
              const mudou = !!escrito && escrito.trim() !== c.padrao;
              return (
                <LinhaOs
                  key={c.chave}
                  label={c.titulo}
                  hint={c.chave === "objeto" ? "(a abertura — o objeto e os valores entram abaixo dela, da OS)" : "(texto do modelo — editável)"}
                  acao={
                    mudou ? (
                      <button
                        type="button"
                        onClick={() => updClausula(c.chave, c.padrao)}
                        className="text-[10.5px] font-bold text-ink-3 hover:text-primary-dark input-focus rounded px-1"
                      >
                        Voltar ao texto do modelo
                      </button>
                    ) : undefined
                  }
                >
                  <Textarea
                    className="min-h-[92px]"
                    value={escrito ?? c.padrao}
                    onChange={(e) => updClausula(c.chave, e.target.value)}
                  />
                </LinhaOs>
              );
            })}

            <SubSecao>Assinatura</SubSecao>
            <LinhaOs label="Cidade" hint="(onde se assina)">
              <Input
                formato="titulo"
                value={os.contrato.cidade ?? ""}
                onChange={(e) => updCt({ cidade: e.target.value })}
                placeholder="Belo Horizonte"
              />
            </LinhaOs>
            {/* As duas testemunhas do modelo. Ficam em branco no documento
                quando ninguém as informa — é assim que o contrato sai hoje, para
                ser assinado à mão, e é assim que ele continua saindo. */}
            {([1, 2] as const).map((n) => {
              const campo = n === 1 ? "testemunha1" : "testemunha2";
              const t = os.contrato[campo] ?? { nome: "", cpf: "" };
              return (
                <LinhaOs key={campo} label={`Testemunha ${n}`} hint="(nome e CPF — em branco, assina à mão)">
                  <div className="flex gap-2 flex-wrap">
                    <Input
                      className="flex-1 min-w-[180px]"
                      formato="titulo"
                      value={t.nome}
                      onChange={(e) => updCt({ [campo]: { ...t, nome: e.target.value } })}
                      placeholder="Nome"
                    />
                    <Input
                      className="w-[170px]"
                      value={t.cpf}
                      onChange={(e) => updCt({ [campo]: { ...t, cpf: maskCpfCnpjInput(e.target.value) } })}
                      placeholder="CPF"
                      inputMode="numeric"
                    />
                  </div>
                </LinhaOs>
              );
            })}
            </>
            )}
          </CardOs>
          </>
        ) : (
          <CardOs secao="Faturamento e Contrato" area="Financeiro">
            <p className="p-4 text-sm text-ink-2">Os blocos de faturamento e contrato são restritos ao seu perfil.</p>
          </CardOs>
        )}
        </fieldset>

        <fieldset disabled={!mexeFinanceiro} className="space-y-4 min-w-0 disabled:opacity-100">

        {/* ACERTOS FINANCEIROS — o que a Pólobh acerta por dentro.
            Fica FORA do bloco restrito de propósito: quem negocia o BV com o
            fornecedor é a Produção, então este grupo aparece para todo perfil.
            O salvamento continua exigindo a justificativa quando o BV foge do
            padrão, para qualquer um. */}
        {/* ACERTOS FINANCEIROS, redesenhado em 15/09/2026.
            Saíram os dois campos de BV — ele é combinado item a item, no
            Detalhamento, e aqui era só a soma repetida — e entrou a conta que
            se fazia na calculadora, por OS, sem ficar registrada em lugar
            nenhum: quanto o fornecedor devolve à Pólobh. Ver
            `domain/acertoFinanceiro`; "Não se aplica" é o padrão, e é resposta. */}
        <CardOs
          secao={SECAO_ACERTOS}
          area="Financeiro"
          acaoSecao={
            <button
              type="button"
              onClick={() => updFin({ acertoNaoSeAplica: !(os.financeiro.acertoNaoSeAplica ?? true) })}
              className="text-[10.5px] font-bold text-ink-2 hover:text-primary-dark input-focus rounded px-1"
            >
              {(os.financeiro.acertoNaoSeAplica ?? true) ? "Lançar acerto" : "Não se aplica"}
            </button>
          }
        >
          {(os.financeiro.acertoNaoSeAplica ?? true) ? (
            <LinhaOs label="Acerto Financeiro">
              <div className="py-2 text-[12.5px] font-bold text-ink-3">Não se aplica</div>
            </LinhaOs>
          ) : (
            <>
              <LinhaOs label="Valor original dos serviços" hint="(do Detalhamento da Contratação)">
                <Auto v={brl(acerto.valorOriginal)} />
              </LinhaOs>
              <LinhaOs label="BV sobre o valor original" hint="(combinado item a item)">
                <Auto v={brl(acerto.bvSobreOriginal)} />
              </LinhaOs>
              <LinhaOs label="Valor da NF" hint="(do bloco de emissão)">
                <Auto v={brl(acerto.valorNf)} />
              </LinhaOs>
              <LinhaOs label="Valor do acréscimo" hint="(valor da NF menos o valor original)">
                <Auto v={brl(acerto.acrescimo)} />
              </LinhaOs>
              <LinhaOs label="Encargos sobre o acréscimo" hint="(percentual editável)">
                <div className="flex items-center gap-2 flex-wrap">
                  <NumberInput
                    className="!w-24"
                    value={acerto.encargosPercentual}
                    onValue={(v) => updFin({ encargosAcrescimoPercentual: v })}
                    aria-label="Percentual de encargos sobre o acréscimo"
                  />
                  <span className="text-[12.5px] text-ink-3">% ·</span>
                  <span className="font-display font-bold text-ink">{brl(acerto.encargosSobreAcrescimo)}</span>
                </div>
              </LinhaOs>
              <LinhaOs
                label="Valor devolução Pólobh"
                hint="(BV + acréscimo − encargos sobre o acréscimo)"
              >
                <div className="py-1 font-display font-bold text-[15px] text-ink">{brl(acerto.devolucaoPolobh)}</div>
              </LinhaOs>
            </>
          )}
          <LinhaOs label="Observações">
            <Textarea
              value={os.financeiro.acertoFinanceiro}
              onChange={(e) => updFin({ acertoFinanceiro: e.target.value })}
              placeholder="O que ficou combinado no acerto (compensações, adiantamentos, retenções…)."
            />
            <TextosJaUsados valor={os.financeiro.acertoFinanceiro} opcoes={sugestoes.valores.acertoFinanceiro} onEscolher={(acertoFinanceiro) => updFin({ acertoFinanceiro })} />
          </LinhaOs>
        </CardOs>
        </fieldset>

        {/* O BOTÃO DO BACK-OFFICE, logo depois dos Acertos Financeiros
            (28/10/2026; antes ficava entre o Contrato e os Acertos): é o fim da
            parte do Financeiro. Fora do fieldset, que trava tudo em leitura.
            Gera a pendência do Back-office, como o do cabeçalho. */}
        {verFinanceiro && fase === "financeiro" && (
          <div className="flex justify-end">
            <Button
              icon={<IcSend width={15} height={15} />}
              disabled={busy}
              onClick={() => void avancarFase("backoffice", {
                titulo: "Enviar esta OS para emissão pelo Back-office?",
                mensagem: "A OS vira pendência do Back-office, que a emite. Emissão e faturamento continuam editáveis até a emissão.",
                confirmar: "Enviar ao Back-office",
              })}
            >
              Enviar OS para Emissão Back-Office
            </Button>
          </div>
        )}

      </div>

      {/* Sem a pílula flutuante de pendências nesta tela (29/09/2026): as
          pendências da OS se resolvem nos próprios blocos e na conversa do alto. */}
      {revisao && (
        <RevisaoEcModal
          documento="OS"
          revisao={revisao}
          salvando={busy}
          onVoltar={() => setRevisao(null)}
          onSalvar={() => {
            setRevisao(null);
            void salvar();
          }}
        />
      )}
    </PageShell>
    </FaseDaOsCtx.Provider>
  );

  function setCron(i: number, patch: Partial<Os["cronograma"][number]>) {
    setOs((o) => (o ? { ...o, cronograma: o.cronograma.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : o));
  }

  function removerEtapaCronograma(i: number) {
    setOs((o) => (o ? { ...o, cronograma: o.cronograma.filter((_, j) => j !== i) } : o));
  }

  /** Setas: uma posição por vez. A lista é plana, então não há bloco vizinho para atravessar. */
  function moverCronograma(i: number, direcao: -1 | 1) {
    setOs((o) => (o ? { ...o, cronograma: moverNaLista(o.cronograma, i, direcao) } : o));
  }

  /** Arraste: o `ListaArrastavel` devolve a ordem nova dos ids; o resto segue por eles. */
  function reordenarCronograma(ids: string[]) {
    setOs((o) => {
      if (!o) return o;
      const porId = new Map(o.cronograma.map((c, i) => [idDaEtapa(c, i), c]));
      const ordenado = ids.map((id) => porId.get(id)).filter((c): c is Os["cronograma"][number] => !!c);
      // Só aceita a reordenação que preserva a lista inteira: id que não bateu
      // significaria etapa sumindo do cronograma, e nenhum arraste faz isso.
      return ordenado.length === o.cronograma.length ? { ...o, cronograma: ordenado } : o;
    });
  }
}

/**
 * Âncora da justificativa do BV de UMA forma de UM item — o que hoje trava o
 * salvamento. Há uma por par (item, forma), porque é assim que a justificativa
 * existe desde que o BV passou a ser combinado item a item.
 */
/** Blocos que o aviso precisa abrir antes de rolar até o campo. */
const SECAO_DETALHAMENTO = "Detalhamento da Contratação";
/** Os nomes curtos das etapas na linha do tempo do alto da OS. */
const TITULO_ETAPA_OS: Record<FaseOs, string> = {
  producao: "Produção",
  financeiro: "Financeiro",
  backoffice: "Back-office",
  emitida: "Emitida",
};
const DESCRICAO_ETAPA_OS: Record<FaseOs, string> = {
  producao: "Monta a OS",
  financeiro: "Pagamento e faturamento",
  backoffice: "Revisa e emite",
  emitida: "OS concluída",
};
const SECAO_ACERTOS = "Acertos Financeiros";

/** Colunas do cronograma do fornecedor — cabeçalho e linhas usam a MESMA grade. */
/**
 * Colunas do cronograma do fornecedor — cabeçalho e linhas usam a MESMA grade.
 *
 * As sete colunas somam bem mais que a largura de um celular, e empilhá-las
 * quebraria o alinhamento entre o cabeçalho e as linhas — que é o que faz a
 * tabela ser legível. Então no celular ela ROLA na horizontal, com uma largura
 * mínima que preserva a grade; o container da rolagem é o `div` de fora (ver
 * onde `GRADE_CRONOGRAMA` é usado).
 */
const GRADE_CRONOGRAMA =
  "grid grid-cols-[auto_auto_150px_130px_1fr_1.5fr_auto] gap-2 min-w-[860px] md:min-w-0";

/**
 * Chave estável da etapa. O `id` é preenchido no carregamento da OS (ver
 * `aplicarAutoPreenchimento`); o índice fica só como rede para o caso de uma
 * etapa nova aparecer antes disso — sem chave, o arraste não teria o que mover.
 */
const idDaEtapa = (c: Os["cronograma"][number], i: number) => c.id ?? `etapa-${i}`;

/* ---------------------------------------------------------------------------
 * Layout espelhando o "Modelo Novo" da Pólobh em Excel: faixas de seção e
 * linhas em duas colunas (RÓTULO | VALOR), na mesma ordem da planilha.
 * ------------------------------------------------------------------------- */

/**
 * Bloco/quadro de uma seção — equivale a um trecho da planilha, e RECOLHE.
 *
 * A OS aberta é uma folha de quinze blocos; quem entra para conferir um deles
 * rolava por todos os outros. A faixa cinza (a mesma barra de seção do modelo
 * em Excel) virou o botão que abre e fecha o bloco, e com tudo fechado a tela
 * é o sumário da OS. A ação da seção, quando existe, fica fora do botão: quem
 * clica em "Consultar CNPJ" não quer fechar o bloco.
 */
/**
 * QUEM PREENCHE cada bloco da OS (27/10/2026): a etiqueta no cabeçalho diz de
 * qual área é o bloco — Produção monta, Financeiro conclui, Back-office emite.
 * Cada área tem a sua cor, para o bloco ser reconhecido de relance.
 */
const COR_AREA: Record<AreaOs, string> = {
  "Produção": "bg-[#E3F0FF] text-[#1D4E89] border-[#B9D5F5]",
  "Financeiro": "bg-[#E6F6EC] text-[#1E6B3A] border-[#BFE3CC]",
  "Back-office": "bg-[#F3E8FF] text-[#5B2C83] border-[#DCC5F2]",
};

/** Contorno e faixa do bloco quando é a vez da área dele. */
const DESTAQUE_AREA: Record<AreaOs, { borda: string; faixa: string }> = {
  "Produção": { borda: "border-[#4A90D9] ring-2 ring-[#4A90D9]/25", faixa: "bg-[#CFE3FA]" },
  "Financeiro": { borda: "border-[#3FA36B] ring-2 ring-[#3FA36B]/25", faixa: "bg-[#CDEBD8]" },
  "Back-office": { borda: "border-[#8A5CC2] ring-2 ring-[#8A5CC2]/25", faixa: "bg-[#E6D6F7]" },
};

/** A etapa em que a OS está — os blocos se destacam conforme ela (ver `vezDoBloco`). */
const FaseDaOsCtx = createContext<FaseOs | null>(null);

function EtiquetaArea({ area, sufixo }: { area: AreaOs; sufixo?: string }) {
  const fase = useContext(FaseDaOsCtx);
  const situacao = fase ? vezDoBloco(area, fase) : null;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        title={`Bloco preenchido por: ${area}`}
        className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.04em] whitespace-nowrap", COR_AREA[area])}
      >
        Preenche: {area}{sufixo ? ` ${sufixo}` : ""}
      </span>
      {situacao && (
        situacao.vez ? (
          <span className="inline-flex items-center rounded-full bg-ink text-white px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.04em] whitespace-nowrap">
            É a vez deste bloco
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-2 whitespace-nowrap">
            <IcCadeado width={12} height={12} /> {situacao.aviso}
          </span>
        )
      )}
    </span>
  );
}

function CardOs({
  className,
  secao,
  area,
  acaoSecao,
  children,
}: {
  className?: string;
  /** Área que preenche o bloco — vira a etiqueta "Preenche: …" no cabeçalho. */
  area?: AreaOs;
  /** Título da faixa — é ele que identifica o bloco no recolher/expandir. */
  secao: string;
  acaoSecao?: ReactNode;
  children: ReactNode;
}) {
  const { recolhida, alternar } = useSecaoRecolhivel(idSecao(secao));
  const fase = useContext(FaseDaOsCtx);
  const destaque = area && fase && vezDoBloco(area, fase).vez ? DESTAQUE_AREA[area] : null;
  return (
    <div className={cx("bg-surface border border-border rounded-card shadow-card overflow-hidden [&_input:not([type=checkbox]):not([type=radio])]:!h-8 [&_select]:!h-8 [&_input]:!py-0 [&_select]:!py-0", className, destaque?.borda)}>
      <div className={cx(destaque ? destaque.faixa : "bg-[#C0C0C0]", "px-4 py-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1")}>
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!recolhida}
          className="flex items-center gap-2 flex-1 min-w-[min(100%,15rem)] text-left text-ink hover:opacity-80 transition-opacity"
        >
          <Chevron aberta={!recolhida} />
          <h3 className="font-display font-bold text-[12.5px] uppercase tracking-[0.05em] text-ink">{secao}</h3>
        </button>
        {area && <EtiquetaArea area={area} />}
        {acaoSecao && <div className="shrink-0">{acaoSecao}</div>}
      </div>
      {!recolhida && children}
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
  id,
  obrigatorio,
  children,
}: {
  label: string;
  hint?: string;
  /** Marca o rótulo com * vermelho (exigido para emitir a OS). */
  obrigatorio?: boolean;
  acao?: ReactNode;
  /** Âncora do destaque — usada quando este campo trava o salvamento. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="grid md:grid-cols-[240px_minmax(0,1fr)] gap-x-4 items-start px-4 py-0 border-b border-border-soft last:border-b-0">
      <div className="md:py-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-[11.5px] font-extrabold uppercase tracking-[0.03em] text-ink-2">{label}{obrigatorio && <MarcaObrigatorio title="Obrigatório para emitir a OS" />}</span>
          {hint && <span className="block text-[10.5px] font-semibold text-ink-3">{hint}</span>}
        </div>
        {acao && <div className="shrink-0 md:hidden">{acao}</div>}
      </div>
      <div className="min-w-0 py-px flex items-start gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        {acao && <div className="shrink-0 hidden md:block pt-0.5">{acao}</div>}
      </div>
    </div>
  );
}

/**
 * Item de Logística ou de Infraestrutura, com a resposta "Não se aplica".
 *
 * Mesma interação das opções de valor do item da EC, e pelo mesmo motivo: ou a
 * pessoa escreve o combinado, ou responde que aquilo não vale para esta OS. O
 * que não se aplica some do documento e da planilha (ver `itensVisiveis`) —
 * então a tela precisa deixar isso explícito, e não parecer um campo apagado.
 *
 * O texto digitado NÃO é apagado ao marcar: quem marcou por engano volta atrás
 * sem perder o que escreveu.
 */
/**
 * Os dados de um tomador que não está em cadastro nenhum (15/09/2026).
 *
 * "Acrescentar aqui as API's para preenchimento automático dos dados a partir
 * do Número do CNPJ e Lupa para pesquisa da Inscrição Municipal no Site da PBH"
 * — check-list da Pólobh. As duas coisas já existiam no sistema (a consulta de
 * CNPJ do cliente e do fornecedor, e a lupa da Inscrição Municipal); o que
 * faltava era o lugar onde usá-las.
 *
 * A consulta preenche o que a Receita devolve e NÃO apaga o que já estava
 * escrito: quem corrigiu um endereço à mão não o perde por clicar na lupa
 * depois.
 */
function TomadorAvulsoCampos({
  dados,
  onDados,
}: {
  dados: TomadorAvulso | undefined;
  onDados: (d: TomadorAvulso) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");
  const atual: TomadorAvulso = dados ?? {
    razaoSocial: "", endereco: "", cnpjCpf: "", inscricaoEstadual: "", inscricaoMunicipal: "",
  };
  const mudar = (patch: Partial<TomadorAvulso>) => onDados({ ...atual, ...patch });

  async function consultar() {
    const cnpj = atual.cnpjCpf.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      setAviso("Informe o CNPJ completo para consultar.");
      return;
    }
    setBuscando(true);
    setAviso("");
    try {
      const d = await consultarCnpj(cnpj);
      mudar({
        razaoSocial: atual.razaoSocial || d.razaoSocial,
        endereco: atual.endereco || d.endereco,
        inscricaoEstadual: atual.inscricaoEstadual || d.inscricaoEstadual || "Isenta",
        inscricaoMunicipal: atual.inscricaoMunicipal || d.inscricaoMunicipal,
      });
      setAviso("Dados preenchidos pelas fontes cadastrais e fiscais integradas.");
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <LinhaOs
        label="CNPJ/CPF"
        acao={
          <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={() => void consultar()} disabled={buscando || !flags.consultaCnpj}>
            {buscando ? "Consultando…" : "Consultar CNPJ"}
          </Button>
        }
      >
        <Input value={atual.cnpjCpf} inputMode="numeric" placeholder="00.000.000/0000-00" onChange={(e) => mudar({ cnpjCpf: maskCpfCnpjInput(e.target.value) })} />
        {aviso && <p className="mt-1 text-[12px] text-info">{aviso}</p>}
      </LinhaOs>
      <LinhaOs label="Razão Social">
        <Input formato="titulo-empresa" value={atual.razaoSocial} onChange={(e) => mudar({ razaoSocial: e.target.value })} />
      </LinhaOs>
      <LinhaOs label="Endereço">
        <Input formato="titulo" value={atual.endereco} onChange={(e) => mudar({ endereco: e.target.value })} />
      </LinhaOs>
      <LinhaOs label="Inscrição Estadual">
        <Input value={atual.inscricaoEstadual} onChange={(e) => mudar({ inscricaoEstadual: e.target.value })} />
      </LinhaOs>
      <LinhaOs label="Inscrição Municipal">
        <InscricaoMunicipalInput value={atual.inscricaoMunicipal} onChange={(inscricaoMunicipal) => mudar({ inscricaoMunicipal })} />
      </LinhaOs>
    </>
  );
}

/**
 * Um bloco de itens da OS — Logística, Infraestrutura ou um grupo criado aqui.
 *
 * Três coisas mudaram em 15/09/2026, e as três vêm do mesmo pedido:
 *
 *  · UM ITEM POR LINHA. Lado a lado, o rótulo e o campo disputavam a mesma
 *    largura, e os de nome longo ("Estacionamento Equipe") quebravam em duas
 *    linhas desalinhando a coluna vizinha. Em linha própria também sobra lugar
 *    para as setas e para o "não se aplica" sem espremer nada.
 *  · ITEM NOVO, criado nesta OS. A lista fixa cobre o que se repete em toda OS;
 *    o que é daquele evento ("gerador de 180 kVA", "balsa para a ilha") não
 *    tinha onde ser escrito senão nas Observações Gerais, onde o fornecedor não
 *    procura.
 *  · ORDEM. Fixos e criados convivem na mesma lista e se movem com as setas —
 *    o mesmo par arraste/setas do cronograma e dos itens da EC, aqui só com as
 *    setas: a lista é curta e o arraste pediria uma alça em cada linha.
 *
 * O bloco INTEIRO pode não se aplicar (é o caso de um grupo criado e depois
 * dispensado), e aí some do documento como qualquer item marcado.
 */
function BlocoDeItens<C extends string>({
  titulo,
  tituloEditavel,
  campos,
  bloco,
  valorDe,
  sugestoes,
  onBloco,
  onCampo,
  onTitulo,
  onExcluir,
  ancoraDom,
}: {
  titulo: string;
  tituloEditavel?: boolean;
  campos: readonly { campo: C; rotulo: string }[];
  bloco: { naoAplicaveis?: readonly C[]; extras?: ItemExtraOs[]; ordem?: string[] } | undefined;
  /** O valor de cada campo fixo do bloco. */
  valorDe: (campo: C) => string;
  sugestoes: Record<string, string[]>;
  /** Metadados do bloco: o que não se aplica, os itens criados aqui e a ordem. */
  onBloco: (patch: { naoAplicaveis?: C[]; extras?: ItemExtraOs[]; ordem?: string[] }) => void;
  /** O valor de um item FIXO — o único patch que depende do tipo do bloco. */
  onCampo: (campo: C, valor: string) => void;
  onTitulo?: (nome: string) => void;
  onExcluir?: () => void;
  ancoraDom?: string;
}) {
  const itens = itensDoBloco(bloco, campos, valorDe);
  const fora: readonly C[] = bloco?.naoAplicaveis ?? [];
  const extras = bloco?.extras ?? [];

  /** A ordem atual, escrita por extenso — é o que as setas reescrevem. */
  const ordemAtual = itens.map((i) => i.chave);

  const mover = (indice: number, direcao: -1 | 1) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= ordemAtual.length) return;
    const nova = [...ordemAtual];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    onBloco({ ordem: nova });
  };

  const alternar = (chave: C, extra: boolean) => {
    if (extra) {
      onBloco({ extras: extras.map((e) => (e.id === chave ? { ...e, naoSeAplica: !e.naoSeAplica } : e)) });
      return;
    }
    onBloco({
      naoAplicaveis: fora.includes(chave) ? fora.filter((c) => c !== chave) : [...fora, chave],
    });
  };

  const escrever = (chave: C, extra: boolean, valor: string) => {
    if (extra) onBloco({ extras: extras.map((e) => (e.id === chave ? { ...e, valor } : e)) });
    else onCampo(chave, valor);
  };

  const adicionarItem = () => {
    const novo: ItemExtraOs = { id: novoId(), rotulo: "", valor: "" };
    onBloco({ extras: [...extras, novo], ordem: [...ordemAtual, novo.id] });
  };

  const naoAplicaveisVisiveis = itens.filter((i) => i.naoSeAplica).length;

  return (
    <LinhaOs
      id={ancoraDom}
      label={titulo}
      hint={naoAplicaveisVisiveis ? `(${naoAplicaveisVisiveis} fora do documento)` : undefined}
      acao={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={adicionarItem}>+ Item</Button>
          {onExcluir && (
            <button
              type="button"
              onClick={onExcluir}
              className="text-ink-3 hover:text-danger px-1.5"
              title={`Excluir o grupo ${titulo}`}
              aria-label={`Excluir o grupo ${titulo}`}
            >
              ✕
            </button>
          )}
        </div>
      }
    >
      {tituloEditavel && onTitulo && (
        <Input
          className="!h-9 mb-2 font-bold"
          formato="grupo"
          value={titulo}
          onChange={(e) => onTitulo(e.target.value)}
          placeholder="Nome do grupo (ex.: Segurança)"
          aria-label="Nome do grupo"
        />
      )}
      <div className="py-1 space-y-1.5">
        {itens.map((item, i) => {
          const extraDoItem = extras.find((e) => e.id === item.chave);
          return (
            <div key={item.chave} className="grid grid-cols-[auto_minmax(0,13rem)_minmax(0,1fr)_auto] items-center gap-2">
              <MoverSetas
                rotulo={item.rotulo || "o item"}
                podeSubir={i > 0}
                podeDescer={i < itens.length - 1}
                onSubir={() => mover(i, -1)}
                onDescer={() => mover(i, 1)}
              />
              {/* O rótulo do item fixo é da casa e não se edita; o do item
                  criado aqui é justamente o que quem cria precisa escrever. */}
              {item.extra ? (
                <Input
                  className="!h-9 !text-[12.5px]"
                  formato="item"
                  value={extraDoItem?.rotulo ?? ""}
                  onChange={(e) => onBloco({ extras: extras.map((x) => (x.id === item.chave ? { ...x, rotulo: e.target.value } : x)) })}
                  placeholder="Nome do item"
                  aria-label="Nome do item"
                />
              ) : (
                <span className="text-[11.5px] font-extrabold uppercase tracking-[0.03em] text-ink-2 truncate" title={item.rotulo}>
                  {item.rotulo}
                </span>
              )}
              {item.naoSeAplica ? (
                <div className="h-9 flex items-center rounded-btn border border-border-soft bg-[#F1F2F5] px-2.5 text-[12.5px] font-bold text-ink-3">
                  Não se aplica
                </div>
              ) : (
                <Input
                  className="!h-9"
                  sugestoes={sugestoes[item.chave] ?? []}
                  value={item.valor}
                  onChange={(e) => escrever(item.chave as C, item.extra, e.target.value)}
                  aria-label={item.rotulo || "Valor do item"}
                />
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => alternar(item.chave as C, item.extra)}
                  className="text-[10.5px] font-bold text-ink-3 hover:text-primary-dark input-focus rounded px-1"
                  title={item.naoSeAplica ? "Voltar a informar este item" : "Este item não se aplica — some do documento e da planilha"}
                >
                  {item.naoSeAplica ? "Informar" : "Não se aplica"}
                </button>
                {item.extra && (
                  <button
                    type="button"
                    onClick={() => onBloco({ extras: extras.filter((e) => e.id !== item.chave) })}
                    className="text-ink-3 hover:text-danger px-1"
                    title="Excluir este item"
                    aria-label={`Excluir ${item.rotulo || "o item"}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {itens.length === 0 && (
          <p className="text-[12.5px] text-ink-3 px-1">Nenhum item. Use “+ Item” para acrescentar.</p>
        )}
      </div>
    </LinhaOs>
  );
}


/**
 * Tabela do Resumo dos Custos: o item e as três formas de cobrá-lo.
 *
 * As colunas são CENÁRIOS alternativos para o mesmo item — a soma de uma
 * responde "quanto sairia se tudo fosse cobrado assim". Por isso a linha de
 * totais não fecha uma conta entre elas, e a de baixo separa o que gera nota
 * fiscal (as duas colunas "com NF") do que não gera.
 *
 * Célula vazia é "não se aplica", e é diferente de R$ 0,00: uma é resposta da
 * produção, a outra é um valor.
 */
/**
 * A tabela de formas de pagamento de UM item, SÓ LEITURA (29/09/2026).
 *
 * Valores, BV e justificativas são os da EC — quem os muda é a EC, e a OS não
 * os reescreve. O que se faz aqui é ESCOLHER qual das três formas vale para o
 * item (o Financeiro, na sua fase); o Resumo dos Custos acompanha a escolha.
 * A forma sem valor não pode ser escolhida, e a OS não mistura formas (ver
 * `problemasDaContratacao`).
 */
function ItemContratacao({
  item,
  nome,
  grupo,
  descricao,
  podeEscolher,
  onUpd,
}: {
  item: ItemContratacaoOs;
  nome: string;
  grupo: string;
  descricao: string;
  podeEscolher: boolean;
  onUpd: (patch: Partial<ItemContratacaoOs>) => void;
}) {
  const bv = bvDoItem(item);
  const adotada = formaDoItem(item);

  return (
    <div className="rounded-card border border-border-soft bg-surface p-3">
      <div className="mb-2">
        <span className="text-[13px] font-bold text-ink">{nome}</span>
        <span className="text-[11.5px] text-ink-3"> · {grupo}</span>
        {descricao && <div className="text-[12px] text-ink-2">{descricao}</div>}
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        {COLUNAS_CONTRATACAO.map(({ chave, longo }) => {
          const opcao = item[chave];
          const temValor = !opcao.naoSeAplica && (Number(opcao.valor) || 0) > 0;
          const escolhida = adotada === chave;
          const justificativa = (opcao.justificativaBv ?? "").trim();
          return (
            <label
              key={chave}
              className={cx(
                "block rounded-btn border-[1.5px] px-2 py-1.5",
                escolhida ? "border-active-border bg-primary-soft/40" : "border-border-soft bg-[#FCFCFD]",
                temValor && podeEscolher ? "cursor-pointer" : "cursor-default"
              )}
            >
              <span className="flex items-start gap-1.5">
                <input
                  type="radio"
                  name={`forma-${item.ecLinhaId}`}
                  checked={escolhida}
                  disabled={!podeEscolher || !temValor}
                  onChange={() => onUpd({ forma: chave })}
                  className="mt-0.5 h-3.5 w-3.5 accent-[#F2820D] shrink-0"
                />
                <span className="text-[11px] font-bold leading-tight text-ink-2">{longo}</span>
              </span>
              <span className={cx("mt-1 block text-[13px] font-display font-bold", temValor ? "text-ink" : "text-ink-3")}>
                {opcao.naoSeAplica ? "Não se aplica" : brl(opcao.valor)}
              </span>
              {chave === "comBvNf" && temValor && (
                <span className="block text-[11px] font-semibold text-ink-3">
                  BV {item.bv.modo === "percentual" ? `${item.bv.valor}%` : brl(item.bv.valor)}
                  {escolhida && ` · ${brl(bv.valor)}`}
                </span>
              )}
              {justificativa && (
                <span className="mt-1 block text-[11.5px] text-ink-2 whitespace-pre-wrap">
                  <span className="font-bold text-ink-3">Justificativa do BV: </span>
                  {justificativa}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {!adotada && (
        <p className="mt-1.5 text-[11.5px] font-bold text-warning">Escolha a forma de pagamento deste item.</p>
      )}
    </div>
  );
}

/**
 * Resumo dos Custos — o que a contratação decidiu, item a item.
 *
 * Só entram as colunas que têm algum valor: é esta tabela que vai ao fornecedor
 * (documento e planilha), e uma coluna inteira zerada não é informação, é ruído
 * numa tabela que ele confere linha a linha (ver `resumoContratacao`).
 */
function TabelaResumoCustos({ resumo }: { resumo: ResumoContratacao }) {
  if (!resumo.linhas.length) {
    return <p className="py-2 text-[12.5px] text-ink-3">Esta OS não está ligada a itens da EC.</p>;
  }
  const colunas = COLUNAS_CONTRATACAO.filter((c) => resumo.colunas[c.chave]);
  if (!colunas.length) {
    return (
      <p className="py-2 text-[12.5px] text-ink-3">
        Nenhum valor definido ainda — preencha as formas de cobrança em <b>Detalhamento da Contratação</b>.
      </p>
    );
  }
  const celula = (v: number | null) =>
    v === null ? <i className="text-ink-3 font-normal">Não se aplica</i> : brl(v);

  return (
    <div className="py-1.5 overflow-x-auto">
      <table className="w-full text-[12.5px] border-collapse">
        <thead>
          <tr className="text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3">
            <th className="text-left font-extrabold pb-1.5 pr-2">Item</th>
            {colunas.map((c) => (
              <th key={c.chave} className="text-right font-extrabold pb-1.5 px-2 whitespace-nowrap">{c.curto}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resumo.linhas.map((l) => (
            <tr key={l.ecLinhaId} className="border-t border-border-soft">
              <td className="py-1.5 pr-2 font-semibold text-ink">{l.item}</td>
              {colunas.map((c) => (
                <td key={c.chave} className="py-1.5 px-2 text-right font-display text-ink">{celula(l[c.chave])}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-bold text-ink">
            <td className="py-1.5 pr-2">Total por forma de cobrança</td>
            {colunas.map((c) => (
              <td key={c.chave} className="py-1.5 px-2 text-right font-display">{brl(resumo.totais[c.chave])}</td>
            ))}
          </tr>
        </tfoot>
      </table>
      {/* O que gera nota e o que não gera, separados: são bases diferentes, e
          somá-las daria um total que não existe em lugar nenhum. */}
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12px] border-t border-border-soft pt-2">
        <span className="text-ink-2">
          Total a faturar <span className="text-ink-3">(com nota fiscal)</span>:{" "}
          <b className="font-display text-ink">{brl(resumo.totalComNota)}</b>
        </span>
        {resumo.totalSemNota > 0 && (
          <span className="text-ink-2">
            Sem nota fiscal: <b className="font-display text-ink">{brl(resumo.totalSemNota)}</b>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * CNAE da nota: as atividades DESTE CNPJ, e não uma lista geral.
 *
 * Antes era um campo de texto com `datalist`, misturando os CNAEs do cartão
 * CNPJ do fornecedor com todos os que a casa já digitou em qualquer OS. Como o
 * `datalist` só filtra enquanto se digita, e ninguém sabe de cor o código, na
 * prática a lista não ajudava — e ainda oferecia o CNAE de OUTRA empresa como
 * se fosse deste fornecedor, que é o erro que a nota não pode ter.
 *
 * Com o cartão CNPJ consultado, isto vira uma lista fechada das atividades
 * daquele CNPJ (a principal primeiro, como a Receita devolve), com escape para
 * digitar — o cartão pode estar desatualizado, e o financeiro precisa poder
 * corrigir. Sem consulta feita, volta a ser texto livre com a memória da casa.
 */
function CnaeDoFornecedor({
  valor,
  doCnpj,
  jaUsados,
  onValor,
}: {
  valor: string;
  doCnpj: string[];
  jaUsados: string[];
  onValor: (v: string) => void;
}) {
  const [digitando, setDigitando] = useState(false);
  const OUTRO = "__outro__";
  // Valor gravado que não está no cartão (CNAE antigo, ou digitado à mão) entra
  // como opção: `select` com valor fora das opções aparece vazio, e salvar
  // depois disso apagaria o dado sem ninguém ver.
  const opcoes = valor && !doCnpj.includes(valor) ? [valor, ...doCnpj] : doCnpj;

  if (!doCnpj.length || digitando) {
    return (
      <>
        <Input
          value={valor}
          sugestoes={jaUsados}
          onChange={(e) => onValor(e.target.value)}
          placeholder="Ex.: 9001-9/06 - Atividades de sonorização e de iluminação"
        />
        {doCnpj.length > 0 && (
          <button type="button" onClick={() => setDigitando(false)} className="mt-1.5 text-[12px] font-bold text-primary-dark hover:underline">
            Voltar às atividades do CNPJ
          </button>
        )}
      </>
    );
  }
  return (
    <Select
      value={valor}
      onChange={(e) => {
        if (e.target.value === OUTRO) {
          setDigitando(true);
          return;
        }
        onValor(e.target.value);
      }}
    >
      <option value="">Selecione…</option>
      {opcoes.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
      <option value={OUTRO}>Outro (digitar)…</option>
    </Select>
  );
}

/** Valor automático (vem do Projeto/EC) — somente leitura. */
function Auto({ v }: { v: string | number | null | undefined }) {
  const txt = v === null || v === undefined || v === "" ? "—" : String(v);
  return <div className="text-[13px] text-ink font-semibold py-0.5 whitespace-pre-wrap leading-snug">{txt}</div>;
}


