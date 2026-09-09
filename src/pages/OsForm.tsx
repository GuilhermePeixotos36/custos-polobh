import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import { BarraProjeto } from "@/components/layout/BarraSecao";
import {
  Button,
  Field,
  Input,
  TelefoneInput,
  Textarea,
  Select,
  NumberInput,
  CurrencyInput,
  AutoTextarea,
  Badge,
  tomStatusOs,
  AvisoEmailPendente,
  AvisoHomologacaoEmail,
  MOTIVO_DISPARO_DESLIGADO,
} from "@/components/ui";
import { IcDownload, IcSearch, IcSend, IcChevron, IcSpark } from "@/components/icons";
import { CardConversa } from "@/components/CardConversa";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import {
  agruparPorFornecedor,
  descritivoConsolidado,
  bvConsolidado,
  BV_PADRAO_PERCENTUAL,
  limitarBvPercentual,
  numeroOs,
  versaoOs,
  textoObjetoContrato,
  LEI_INCENTIVO_PADRAO,
  FORMA_PAGAMENTO_PADRAO,
  OBS_CONTRATO_PADRAO,
} from "@/domain/calc";
import { datasDoEvento, ETAPAS_CRONOGRAMA, horariosDoEvento } from "@/domain/projeto";
import { doCadastro, opcoesPerfilTributario, semVazios } from "@/domain/fornecedor";
import { useEmpresas } from "@/store/empresas";
import { consultarCnpj } from "@/lib/cnpj";
import { gerarDescritivo } from "@/lib/ai";
import { dispararOsPorEmail } from "@/lib/email";
import { flags } from "@/lib/flags";
import { brl, cx, dataBR, maskCpfCnpjInput } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { usePendencias, useMinhasPendencias } from "@/store/pendencias";
import { useSugestoes } from "@/hooks/useSugestoes";
import { urlCredenciamento } from "@/lib/links";
import { NavegadorPendencias } from "@/components/NavegadorPendencias";
import { ListaArrastavel, ItemArrastavel } from "@/components/ListaArrastavel";
import { MoverSetas, moverNaLista } from "@/components/MoverSetas";
import { InscricaoMunicipalInput } from "@/components/InscricaoMunicipalInput";
import { TextosJaUsados } from "@/components/TextosJaUsados";
import { destacarCampo, idAncoraPendencia, idCampoTrava } from "@/lib/destaque";
import { Chevron, idSecao, useAcoesRecolher, useSecaoRecolhivel } from "@/components/layout/Recolher";
import { ancoraCronogramaOs, pendenciasDaTela } from "@/domain/pendencias";
import {
  bvDaContratacao,
  bvDoItem,
  COLUNAS_CONTRATACAO,
  exigeJustificativa,
  itemDaLinhaEc,
  justificativasFaltando,
  resumoContratacao,
  sincronizarContratacao,
} from "@/domain/contratacaoOs";
import {
  CAMPOS_LOGISTICA, CAMPOS_INFRAESTRUTURA, alternarNaoSeAplica, exigeNovaVersaoPorFornecedor,
  naoSeAplica, temContrato,
} from "@/domain/os";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import type { ResumoContratacao } from "@/domain/contratacaoOs";
import type {
  ItemContratacaoOs,
  DocumentoFiscal,
  Ec,
  EcLinha,
  EmpresaGrupo,
  Fornecedor,
  Modalidade,
  Os,
  ProjetoInfo,
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

  return {
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
      documentoFiscal: os.orcamento.documentoFiscal || docFiscalEc,
      parcelas: os.orcamento.parcelas.map((p) => (p.id ? p : { ...p, id: novoId() })),
    },
    financeiro: {
      ...os.financeiro,
      descritivoNf,
      // Tomador: quem contrata o fornecedor é a Pólobh — é ela que emite a OS e
      // recebe a nota. Deixar em branco só obrigava a escolher a única resposta
      // óbvia antes de os dados fiscais aparecerem; segue trocável para Cliente
      // quando o faturamento vai direto para ele.
      tomador: os.financeiro.tomador || "Polobh",
      codigoServico: os.financeiro.codigoServico || codigoServico,
      cnae: os.financeiro.cnae || cnaeUnico,
      projetoIncentivado:
        os.financeiro.projetoIncentivado || os.projeto.nomeProjeto || os.projeto.titulo,
      // Lei COM o número do projeto: é assim que o Projeto já guarda
      // ("Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234").
      leiIncentivo: os.financeiro.leiIncentivo || os.projeto.incentivosFiscais || LEI_INCENTIVO_PADRAO,
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
          // Quem contrata o fornecedor é a Pólobh, mesma resposta do tomador.
          contratante: os.contrato.contratante || "Polobh",
          descritivoServicos: os.contrato.descritivoServicos || descritivoNf,
          formaPagamento: os.contrato.formaPagamento || FORMA_PAGAMENTO_PADRAO,
          observacoesGerais: os.contrato.observacoesGerais || OBS_CONTRATO_PADRAO,
          // A data do contrato é a da emissão da OS, não a de hoje: abrir a OS
          // três meses depois não pode reescrever quando ela foi feita.
          dataContrato: os.contrato.dataContrato || (os.criadoEm || new Date().toISOString()).slice(0, 10),
        }
      : os.contrato,
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
        // A contratação nasce com o que a EC levantou para cada item.
        itens: ec.linhas.filter((l) => linhaIds.includes(l.id)).map(itemDaLinhaEc),
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
  /** Quantos itens de cada bloco ficam fora do documento — some no rótulo dele. */
  const foraDoDocumento = (n: number) => (n ? `(${n} fora do documento)` : undefined);
  const naoAplicaveisLogistica = os.logistica.naoAplicaveis?.length ?? 0;
  const naoAplicaveisInfra = os.infraestrutura.naoAplicaveis?.length ?? 0;

  /** Ordem atual do cronograma, pelas chaves que o arraste manipula. */
  const idsCronograma = os.cronograma.map(idDaEtapa);

  /** Resumo dos Custos: o que a contratação decidiu, item a item, com os totais. */
  const resumo = resumoContratacao(os.itens, linhasConsolidadas);

  /** O BV desta contratação — a soma do que foi fechado item a item. */
  const bvContratado = bvDaContratacao(os.itens);

  /**
   * Muda uma forma de cobrança de um item — e leva o total junto.
   *
   * Os três totais do Pagamento ao Fornecedor são a soma do que se definiu item
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
      const anterior = o.orcamento.valorComBvNf;
      const espelhaFin = o.financeiro.valorTotal === anterior;
      const espelhaCt = o.contrato.valorTotal === anterior;
      const v = totais.comBvNf;
      return {
        ...o,
        itens,
        orcamento: {
          ...o.orcamento,
          valorComBvNf: v,
          valorSemBvComNf: totais.semBvComNf,
          valorSemBvSemNf: totais.semBvSemNf,
        },
        financeiro: espelhaFin
          ? { ...o.financeiro, valorUnitario: v, valorTotal: v, valorAPagar: v - o.financeiro.descontoNegociado }
          : o.financeiro,
        contrato: espelhaCt
          ? { ...o.contrato, valorUnitario: v, valorTotal: v, valorAPagar: v - o.contrato.descontoNegociado }
          : o.contrato,
      };
    });
  /**
   * O que impede o salvamento, hoje: a justificativa do BV de uma forma que
   * VALE num item e sai fora do padrão da casa.
   *
   * Ela era UMA, da OS inteira, e morava em Acertos Financeiros — herança de
   * quando a OS tinha um BV só. Com a contratação item a item, cada forma
   * responde por si (ver `domain/contratacaoOs`), e uma justificativa única não
   * saberia dizer de qual item falava. Saiu de lá e virou esta lista: cada
   * entrada é um item + uma forma, e cada uma tem endereço próprio na tela,
   * para o aviso poder LEVAR até ela em vez de só apontar.
   */
  const nomeDoItem = new Map(
    linhasConsolidadas.map((l) => [l.id, l.item?.trim() || l.descricao?.trim() || "item sem nome"])
  );
  const travas = (os.itens ?? []).flatMap((item) =>
    justificativasFaltando(item).map((opcao) => ({
      campo: TRAVA_JUSTIF(item.ecLinhaId, opcao),
      item: nomeDoItem.get(item.ecLinhaId) ?? "item",
      forma: COLUNAS_CONTRATACAO.find((c) => c.chave === opcao)?.longo ?? opcao,
    }))
  );
  /**
   * O BV daqui nasce do Resumo dos Custos e segue editável. Quando alguém o
   * altera, ou quando os itens da EC mudam depois, os dois divergem — e sem
   * dizer isso o campo passaria a mentir sobre o que foi combinado.
   */
  const bvDiverge = bvContratado.percentual > 0 && Math.abs(os.financeiro.bvPercentual - bvContratado.percentual) >= 0.01;

  /** Para abrir o bloco certo quando um aviso precisa levar a pessoa a um campo. */
  const recolher = useAcoesRecolher();

  /** Esta OS tem contrato? Quem decide é a coluna Contrato dos itens, na EC. */
  const haContrato = temContrato(os, linhasConsolidadas);

  /** Trocar o fornecedor de uma OS já emitida arquiva esta e abre a seguinte. */
  const trocouFornecedor = exigeNovaVersaoPorFornecedor(os, fornecedorGravado.current, os.fornecedor);

  /** Empresa emissora não cadastrada: os dados da nota sairiam em branco calados. */
  const faltaCadastroTomador = os.financeiro.tomador === "Polobh" && !empresaPolobh;
  /** A lei de incentivo da OS ficou diferente do que o Projeto guarda. */
  const leiDivergeDaEc =
    !!os.projeto.incentivosFiscais && (os.financeiro.leiIncentivo ?? "") !== os.projeto.incentivosFiscais;

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

  const dadosTomador = dadosFiscais(os.financeiro.tomador, ecCtx, empresaPolobh);
  const dadosContratante = dadosFiscais(os.contrato.contratante, ecCtx, empresaPolobh);

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
  // Os três campos já nascem preenchidos pelo BV combinado ITEM A ITEM no
  // Detalhamento da Contratação (ver `bvDaContratacao`): aqui é o lugar de
  // conferir e ajustar, não de lembrar de cabeça o que se negociou semanas atrás.
  const bvBloco = (
    <>
      <LinhaOs
        label="BV Pólobh"
        hint={bvContratado.valor > 0 ? `(do Detalhamento da Contratação: ${bvContratado.percentual}% · ${brl(bvContratado.valor)})` : "(do Detalhamento da Contratação)"}
      >
        <NumberInput value={os.financeiro.bvPercentual} onValue={(v) => updFin({ bvPercentual: v, bvValor: (os.financeiro.valorTotal * v) / 100 })} />
        {bvDiverge && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[12px] text-warning">
            <span className="font-semibold">Diferente do combinado nos itens ({bvContratado.percentual}%).</span>
            <button
              type="button"
              onClick={() => updFin({ bvPercentual: bvContratado.percentual, bvValor: (os.financeiro.valorTotal * bvContratado.percentual) / 100 })}
              className="font-bold text-primary-dark hover:underline"
            >
              Usar o BV da Contratação
            </button>
          </div>
        )}
      </LinhaOs>
      <LinhaOs label="BV Pólobh — Valor">
        <Auto v={brl((os.financeiro.valorTotal * os.financeiro.bvPercentual) / 100)} />
      </LinhaOs>
      {/* A JUSTIFICATIVA do BV saiu daqui (09/09/2026): ela é uma por FORMA, em
          cada item do Detalhamento da Contratação, que é onde o BV é combinado.
          Uma justificativa só, da OS inteira, não sabia dizer de qual item
          falava — e era a única coisa que este bloco cobrava. */}
      {travas.length > 0 && (
        <LinhaOs label="">
          <div className="py-2 text-[12.5px] text-warning font-semibold">
            {travas.length === 1
              ? "Falta a justificativa do BV em 1 item — "
              : `Faltam ${travas.length} justificativas do BV — `}
            <button
              type="button"
              onClick={() => {
                recolher?.expandir(idSecao(SECAO_DETALHAMENTO));
                destacarCampo(travas[0].campo);
              }}
              className="font-bold text-primary-dark hover:underline"
            >
              ir até {travas.length === 1 ? "ela" : "a primeira"}
            </button>
            .
          </div>
        </LinhaOs>
      )}
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
      const numero = numeroOs(ecCtx!, os!.fornecedor, versao);
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

  async function salvar(status?: Os["status"]) {
    // O que trava o salvamento LEVA até o campo, não apenas avisa: numa tela de
    // quinze blocos, ler "falta a justificativa" e ter de caçar onde é o mesmo
    // trabalho de antes. A tela rola até lá, o campo pisca em vermelho e já
    // recebe o cursor — e o aviso diz de qual item e de qual forma se trata,
    // porque agora há uma justificativa por forma, em cada item.
    if (travas.length) {
      const [primeira] = travas;
      toast(
        travas.length === 1
          ? `Falta a justificativa do BV em "${primeira.item}" (${primeira.forma}).`
          : `Faltam ${travas.length} justificativas do BV — a primeira em "${primeira.item}" (${primeira.forma}).`,
        "warning"
      );
      // O bloco pode estar recolhido — abrir antes, senão a rolagem para num
      // título fechado e o campo continua escondido.
      recolher?.expandir(idSecao(SECAO_DETALHAMENTO));
      destacarCampo(primeira.campo);
      return;
    }
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
      // O segundo cabeçalho do projeto: a OS é uma página interna dele, e sem
      // esta barra quem entrava aqui perdia toda a referência de onde estava.
      subabas={ecCtx.projetoId ? <BarraProjeto projetoId={ecCtx.projetoId} atual="os" /> : undefined}
      topAction={
        <div className="flex gap-2">
          {/* Uma ação só para o documento: antes eram duas (Excel e "Ver / PDF"),
              e a do PDF ainda pedia um segundo clique depois de abrir a tela.
              O Excel da OS saiu — o documento do fornecedor é o PDF. */}
          <Button
            data-tour="baixar-pdf"
            variant="secondary"
            size="sm"
            icon={<IcDownload width={16} height={16} />}
            onClick={() => os.id ? navigate(`/ordens/${os.id}/imprimir?auto=1`) : toast("Salve a OS antes de baixar o PDF.", "info")}
          >
            Baixar PDF
          </Button>
          {podeEditar && <Button variant="secondary" size="sm" onClick={() => salvar()} disabled={busy}>Salvar</Button>}
          {podeEditar && (
            <Button
              size="sm"
              icon={<IcSend width={15} height={15} />}
              onClick={() => salvar("Disparada")}
              disabled={busy || !flags.disparoFornecedor}
              title={flags.disparoFornecedor ? "Salva a OS e envia ao fornecedor" : MOTIVO_DISPARO_DESLIGADO}
            >
              Disparar OS
            </Button>
          )}
        </div>
      }
    >
      <AvisoEmailPendente className="mb-4" />
      <AvisoHomologacaoEmail className="mb-4" />

      <div className="space-y-4">
        {/* A CONVERSA vem primeiro (pedido de 09/09/2026), e com o mesmo rótulo
            da EC: quem abre uma OS costuma abrir por causa do que foi dito nela
            — "o fornecedor mudou o valor", "falta o Pix" —, e no fim da tela
            isso ficava atrás de quinze blocos. Não sai em documento, e-mail nem
            planilha: é o corredor da equipe. */}
        <CardConversa
          ancora={os.id}
          ancoraDom={idAncoraPendencia(os.id)}
          hint="Só a equipe vê. Combine aqui o que esta OS tem de pendente — quem é @mencionado fica com a pendência."
          observacoes={os.observacoes}
          usuarios={usuarios}
          minhas={pendenciasDoUsuario.filter((x) => x.tipo === "os.observacao" && x.osId === os.id).length}
          onChange={(observacoes) => setOs((o) => (o ? { ...o, observacoes } : o))}
        />

        {/* Cabeçalho do modelo em Excel */}
        <CardOs secao="Ordem de Serviço">
          <LinhaOs label="Número da OS"><Auto v={os.numero} /></LinhaOs>
          <LinhaOs label="Projeto"><Auto v={os.projeto.titulo} /></LinhaOs>
          <LinhaOs label="Data de emissão"><Auto v={dataBR(os.criadoEm)} /></LinhaOs>
          <LinhaOs label="Status da OS">
            <div className="py-2 flex items-center gap-2 flex-wrap">
              <Badge tom={tomStatusOs[os.status]}>{os.status}</Badge>
              <span className="text-[12.5px] text-ink-3">Consolida {os.ecLinhaIds.length} linha(s) da EC</span>
            </div>
          </LinhaOs>
        </CardOs>

        {/* DADOS DO CLIENTE — automático da EC */}
        <CardOs secao="Dados do Cliente">
          <LinhaOs label="Cliente"><Auto v={os.cliente.nome} /></LinhaOs>
          <LinhaOs label="Razão Social"><Auto v={os.cliente.razaoSocial} /></LinhaOs>
          <LinhaOs label="Endereço"><Auto v={os.cliente.endereco} /></LinhaOs>
          <LinhaOs label="CNPJ/CPF"><Auto v={os.cliente.cnpjCpf} /></LinhaOs>
          <LinhaOs label="Inscrição Estadual"><Auto v={os.cliente.inscricaoEstadual} /></LinhaOs>
          <LinhaOs label="Inscrição Municipal"><Auto v={os.cliente.inscricaoMunicipal} /></LinhaOs>
        </CardOs>

        {/* DADOS DO PROJETO — automático da EC, com o cronograma do projeto */}
        <CardOs secao="Dados do Projeto">
          <LinhaOs label="Título"><Auto v={os.projeto.titulo} /></LinhaOs>
          <LinhaOs label="Modalidade"><Auto v={os.projeto.modalidade} /></LinhaOs>
          <LinhaOs label="Incentivos Fiscais"><Auto v={os.projeto.incentivosFiscais} /></LinhaOs>
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
          <LinhaOs label="Banco"><Input value={os.fornecedor.dadosBancarios.banco} sugestoes={sugestoes.valores.bancoFornecedor} onChange={(e) => updB({ banco: e.target.value })} /></LinhaOs>
          <LinhaOs label="Agência"><Input value={os.fornecedor.dadosBancarios.agencia} onChange={(e) => updB({ agencia: e.target.value })} /></LinhaOs>
          <LinhaOs label="Conta Corrente"><Input value={os.fornecedor.dadosBancarios.conta} onChange={(e) => updB({ conta: e.target.value })} /></LinhaOs>
          <LinhaOs label="Chave Pix"><Input value={os.fornecedor.dadosBancarios.chavePix} onChange={(e) => updB({ chavePix: e.target.value })} /></LinhaOs>
          <LinhaOs label="Representante"><Input formato="titulo" value={os.fornecedor.representante} onChange={(e) => updF({ representante: e.target.value })} /></LinhaOs>
          <LinhaOs label="Telefone"><TelefoneInput value={os.fornecedor.telefone} onChange={(v) => updF({ telefone: v })} /></LinhaOs>
          <LinhaOs label="E-mail"><Input value={os.fornecedor.email} onChange={(e) => updF({ email: e.target.value })} /></LinhaOs>
        </CardOs>

        {/* DETALHAMENTO DA CONTRATAÇÃO */}
        <CardOs secao={SECAO_DETALHAMENTO}>
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

          {/* A DEFINIÇÃO da contratação, item a item. A EC levanta o preço de
              cada forma; aqui se fecha qual vale, por quanto e com que BV — é
              esta OS que vira contrato com o fornecedor. Os valores já chegam
              preenchidos da EC e seguem editáveis. Só quem enxerga o financeiro
              vê e mexe (mesma regra do resto dos valores). */}
          {verFinanceiro && (
            <LinhaOs
              label="Formas de pagamento"
              hint="(vêm da EC — defina aqui o que vale para cada item)"
            >
              <div className="py-1.5 space-y-2">
                {os.itens.map((i) => {
                  const l = linhasConsolidadas.find((x) => x.id === i.ecLinhaId);
                  return (
                    <ItemContratacao
                      key={i.ecLinhaId}
                      item={i}
                      nome={l?.item?.trim() || l?.descricao?.trim() || "(item sem nome)"}
                      grupo={l?.grupo ?? ""}
                      descricao={l?.descricao ?? ""}
                      onUpd={(patch) => updItem(i.ecLinhaId, patch)}
                    />
                  );
                })}
                {!os.itens.length && (
                  <p className="text-[12.5px] text-ink-3">Esta OS não está ligada a itens da EC.</p>
                )}
              </div>
            </LinhaOs>
          )}

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
        </CardOs>

        {/* RESUMO DA CONTRATAÇÃO — o que o fornecedor precisa fazer e receber:
            entrega, cronograma, logística, infraestrutura, recados e, no fim, a
            tabela do que foi definido no bloco de cima. Estava tudo num card só
            com o Detalhamento, e o formulário virava uma coluna sem fim em que
            "o que se contrata" e "como se executa" se misturavam. */}
        <CardOs secao="Resumo da Contratação">
          <LinhaOs label="Entrega"><Input value={os.entrega} onChange={(e) => setOs((o) => (o ? { ...o, entrega: e.target.value } : o))} placeholder="Instalação, operação, acompanhamento…" /></LinhaOs>
          {/* Cronograma específico do fornecedor — já vem do cronograma do projeto.
              O `id` é o endereço da pendência "cronograma não preenchido": ela é
              cobrada na etapa da OS e se resolve aqui, então a pílula pisca este
              bloco (antes ela contava no badge e não tinha o que achar). */}
          <LinhaOs
            id={idAncoraPendencia(ancoraCronogramaOs(os.id))}
            label="Cronograma do Fornecedor"
            acao={
              <Button variant="secondary" size="sm" onClick={() => setOs((o) => (o ? { ...o, cronograma: [...o.cronograma, { id: novoId(), etapa: "", data: "", horario: "", atividades: "" }] } : o))}>+ Etapa</Button>
            }
          >
            {/* No celular a tabela rola na horizontal em vez de espremer sete
                colunas; `overflow-x-auto` só abaixo de md, para não criar
                container de rolagem onde não precisa (ver ui/Table). */}
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
          </LinhaOs>

          <LinhaOs label="Logística do Fornecedor" hint={foraDoDocumento(naoAplicaveisLogistica)}>
            <div className="py-1.5 grid sm:grid-cols-2 gap-2">
              {CAMPOS_LOGISTICA.map(({ campo, rotulo }) => (
                <CampoOpcionalOs
                  key={campo}
                  rotulo={rotulo}
                  valor={os.logistica[campo]}
                  sugestoes={sugestoes.valores[campo]}
                  naoSeAplica={naoSeAplica(os.logistica, campo)}
                  className={campo === "uniformizacao" ? "sm:col-span-2" : undefined}
                  onValor={(v) => updLog({ [campo]: v } as Partial<Os["logistica"]>)}
                  onAlternar={() => setOs((o) => (o ? { ...o, logistica: alternarNaoSeAplica(o.logistica, campo) } : o))}
                />
              ))}
            </div>
          </LinhaOs>

          <LinhaOs label="Infraestrutura" hint={foraDoDocumento(naoAplicaveisInfra)}>
            <div className="py-1.5 grid sm:grid-cols-2 gap-2">
              {CAMPOS_INFRAESTRUTURA.map(({ campo, rotulo }) => (
                <CampoOpcionalOs
                  key={campo}
                  rotulo={rotulo}
                  valor={os.infraestrutura[campo]}
                  sugestoes={sugestoes.valores[campo]}
                  naoSeAplica={naoSeAplica(os.infraestrutura, campo)}
                  onValor={(v) => updInfra({ [campo]: v } as Partial<Os["infraestrutura"]>)}
                  onAlternar={() => setOs((o) => (o ? { ...o, infraestrutura: alternarNaoSeAplica(o.infraestrutura, campo) } : o))}
                />
              ))}
            </div>
          </LinhaOs>

          {/* Texto livre, escrito PARA O FORNECEDOR: sai no documento, no e-mail
              e na planilha. A conversa interna da equipe fica no card próprio,
              logo abaixo — eram a mesma coisa, e a thread interna acabava
              impressa no documento que o fornecedor recebe. */}
          <LinhaOs label="Observações Gerais" hint="(sai no documento e na planilha)">
            <Textarea
              className="min-h-[90px]"
              value={os.observacoesGerais}
              onChange={(e) => setOs((o) => (o ? { ...o, observacoesGerais: e.target.value } : o))}
              placeholder="O que o fornecedor precisa saber e não coube nos outros campos."
            />
          </LinhaOs>

          {/* A tabela do que foi definido lá em cima, item a item. Fecha o bloco
              porque é o que o fornecedor confere por último — e é ela que sai no
              PDF e na planilha, com as colunas vazias omitidas. */}
          {verFinanceiro && (
            <LinhaOs label="Resumo dos Custos" hint="(o que foi definido no Detalhamento)">
              <TabelaResumoCustos resumo={resumo} />
            </LinhaOs>
          )}
        </CardOs>

        {/* O CREDENCIAMENTO saiu daqui (29/08/2026): virou subaba do Projeto, onde
            se vê a fila inteira e se dispara para todos os fornecedores de uma
            vez. O link continua sendo o desta OS — o que mudou foi o comando. */}
        <div className="space-y-4">
          {/* PAGAMENTO — parcelas e documento fiscal, sobre o que a contratação
              definiu. A tabela em si fica no Resumo da Contratação, junto do
              resto do que o fornecedor recebe. */}
          <CardOs secao="Pagamento ao Fornecedor">
            <LinhaOs label="Valor do Item na EC do Projeto" hint="(soma dos itens consolidados)"><Auto v={brl(os.orcamento.valorEc)} /></LinhaOs>
            {/* Os três totais são o que foi definido item a item, em Detalhamento
                da Contratação — não são digitáveis aqui. Eram, e havia duas
                verdades sobre o mesmo número: o que a produção fechou no item e
                o que alguém escreveu na OS inteira. É deste "com BV e NF" que
                vivem o Faturamento e o Contrato. */}
            <LinhaOs label="Valor com BV e NF" hint="(total definido no Detalhamento — alimenta Faturamento e Contrato)">
              <Auto v={brl(resumo.totais.comBvNf)} />
            </LinhaOs>
            <LinhaOs label="Valor Sem BV e Com Nota Fiscal" hint="(total definido no Detalhamento)"><Auto v={brl(resumo.totais.semBvComNf)} /></LinhaOs>
            <LinhaOs label="Valor Sem BV e Sem NF" hint="(total definido no Detalhamento)"><Auto v={brl(resumo.totais.semBvSemNf)} /></LinhaOs>

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
                    <Input className="!h-9" placeholder={`Descrição da ${i + 1}ª parcela`} sugestoes={sugestoes.valores.descricaoParcela} value={pc.descricao} onChange={(e) => updOrc({ parcelas: os.orcamento.parcelas.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })} />
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
          <CardOs className="border-active-border" secao="Dados Nota Fiscal, Fatura, etc...">
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
            <LinhaOs label="Nome do Projeto Incentivado" hint="(auto do projeto)">
              <Input value={os.financeiro.projetoIncentivado ?? ""} sugestoes={sugestoes.valores.projetoIncentivado} onChange={(e) => updFin({ projetoIncentivado: e.target.value })} placeholder="Nome do projeto incentivado" />
            </LinhaOs>
            {/* Um campo só, com a lei E o número: é a forma como o dado existe no
                mundo ("Rouanet — PRONAC 26 1234") e como o Projeto já o guarda.
                Separado em dois, obrigava a redigitar aqui o que a EC sabia. */}
            <LinhaOs
              label="Lei de Incentivo à Cultura"
              hint={leiDivergeDaEc ? `Projeto: ${os.projeto.incentivosFiscais}` : "(lei e nº do projeto)"}
            >
              <Input value={os.financeiro.leiIncentivo ?? ""} sugestoes={sugestoes.valores.leiIncentivo} onChange={(e) => updFin({ leiIncentivo: e.target.value })} placeholder="Ex.: Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234" />
              {leiDivergeDaEc && (
                <button
                  type="button"
                  onClick={() => updFin({ leiIncentivo: os.projeto.incentivosFiscais })}
                  className="mt-1.5 text-[12px] font-bold text-primary-dark hover:underline"
                >
                  Usar o que está no Projeto
                </button>
              )}
            </LinhaOs>
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
            <LinhaOs label="Código de Serviço" hint="(auto dos itens da EC)">
              <Input value={os.financeiro.codigoServico} sugestoes={sugestoes.valores.codigoServico} onChange={(e) => updFin({ codigoServico: e.target.value })} />
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
            <LinhaOs label="Contratante" hint="(auto — quem contrata o fornecedor)">
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
            <LinhaOs label="Informações Complementares" hint="(preencher)">
              <Textarea value={os.contrato.informacoesComplementares} onChange={(e) => updCt({ informacoesComplementares: e.target.value })} placeholder="O que este contrato tem de particular e não está no descritivo." />
              <TextosJaUsados valor={os.contrato.informacoesComplementares} opcoes={sugestoes.valores.informacoesComplementares} onEscolher={(informacoesComplementares) => updCt({ informacoesComplementares })} />
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
            <LinhaOs label="Forma de Pagamento" hint="(padrão do modelo — editável)">
              <Input value={os.contrato.formaPagamento ?? ""} sugestoes={sugestoes.valores.formaPagamento} onChange={(e) => updCt({ formaPagamento: e.target.value })} placeholder={FORMA_PAGAMENTO_PADRAO} />
            </LinhaOs>
            <LinhaOs label="Observações Gerais" hint="(padrão do modelo — editável)">
              <Textarea value={os.contrato.observacoesGerais ?? ""} onChange={(e) => updCt({ observacoesGerais: e.target.value })} />
              <TextosJaUsados valor={os.contrato.observacoesGerais ?? ""} opcoes={sugestoes.valores.observacoesContrato} onEscolher={(observacoesGerais) => updCt({ observacoesGerais })} />
            </LinhaOs>
            <LinhaOs label="Data do Contrato" hint="(auto — data da emissão da OS)"><Input type="date" value={os.contrato.dataContrato} onChange={(e) => updCt({ dataContrato: e.target.value })} /></LinhaOs>
            <LinhaOs label="Rubrica" hint="(preencher)"><Input value={os.contrato.rubrica} sugestoes={sugestoes.valores.rubrica} onChange={(e) => updCt({ rubrica: e.target.value })} placeholder="Iniciais de quem responde pelo contrato" /></LinhaOs>
            </>
            )}
          </CardOs>
          </>
        ) : (
          <CardOs secao="Faturamento e Contrato">
            <p className="p-4 text-sm text-ink-2">Os blocos de faturamento e contrato são restritos ao seu perfil.</p>
          </CardOs>
        )}

        {/* ACERTOS FINANCEIROS — o que a Pólobh acerta por dentro.
            Fica FORA do bloco restrito de propósito: quem negocia o BV com o
            fornecedor é a Produção, então este grupo aparece para todo perfil.
            O salvamento continua exigindo a justificativa quando o BV foge do
            padrão, para qualquer um. */}
        <CardOs secao={SECAO_ACERTOS}>
          {bvBloco}
          <LinhaOs label="Observações">
            <Textarea
              value={os.financeiro.acertoFinanceiro}
              onChange={(e) => updFin({ acertoFinanceiro: e.target.value })}
              placeholder="O que ficou combinado no acerto (compensações, adiantamentos, retenções…)."
            />
            <TextosJaUsados valor={os.financeiro.acertoFinanceiro} opcoes={sugestoes.valores.acertoFinanceiro} onEscolher={(acertoFinanceiro) => updFin({ acertoFinanceiro })} />
          </LinhaOs>
        </CardOs>
      </div>

      {/* Mesma pílula da EC, e o mesmo número do badge da linha desta OS na
          listagem: tudo o que se resolve aqui dentro — comentários, "emitir OS"
          e o cronograma vazio, que agora tem endereço no próprio bloco. */}
      <NavegadorPendencias pendencias={pendenciasDaTela(pendenciasDoUsuario, { osId: os.id })} />
    </PageShell>
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
const TRAVA_JUSTIF = (ecLinhaId: string, opcao: string) => idCampoTrava(`bv-justificativa-${ecLinhaId}-${opcao}`);
/** Blocos que o aviso precisa abrir antes de rolar até o campo. */
const SECAO_DETALHAMENTO = "Detalhamento da Contratação";
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
function CardOs({
  className,
  secao,
  acaoSecao,
  children,
}: {
  className?: string;
  /** Título da faixa — é ele que identifica o bloco no recolher/expandir. */
  secao: string;
  acaoSecao?: ReactNode;
  children: ReactNode;
}) {
  const { recolhida, alternar } = useSecaoRecolhivel(idSecao(secao));
  return (
    <div className={cx("bg-surface border border-border rounded-card shadow-card overflow-hidden", className)}>
      <div className="bg-[#C0C0C0] px-4 py-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!recolhida}
          className="flex items-center gap-2 flex-1 min-w-0 text-left text-ink hover:opacity-80 transition-opacity"
        >
          <Chevron aberta={!recolhida} />
          <h3 className="font-display font-bold text-[12.5px] uppercase tracking-[0.05em] text-ink">{secao}</h3>
        </button>
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
  children,
}: {
  label: string;
  hint?: string;
  acao?: ReactNode;
  /** Âncora do destaque — usada quando este campo trava o salvamento. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="grid md:grid-cols-[240px_minmax(0,1fr)] gap-x-4 items-start px-4 py-2 border-b border-border-soft last:border-b-0">
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
function CampoOpcionalOs({
  rotulo,
  valor,
  sugestoes,
  naoSeAplica,
  className,
  onValor,
  onAlternar,
}: {
  rotulo: string;
  valor: string;
  sugestoes: string[];
  naoSeAplica: boolean;
  className?: string;
  onValor: (v: string) => void;
  onAlternar: () => void;
}) {
  return (
    // Sem dica no rótulo: "não entra no documento" quebrava o nome em duas
    // linhas e desalinhava as colunas do bloco. Quem diz isso é a caixa cinza,
    // o contador no cabeçalho e a dica do botão.
    <Field label={rotulo} className={className}>
      {naoSeAplica ? (
        <div className="h-9 flex items-center rounded-btn border border-border-soft bg-[#F1F2F5] px-2.5 text-[12.5px] font-bold text-ink-3">
          Não se aplica
        </div>
      ) : (
        <Input className="!h-9" sugestoes={sugestoes} value={valor} onChange={(e) => onValor(e.target.value)} />
      )}
      <button
        type="button"
        onClick={onAlternar}
        className="mt-1 text-[10.5px] font-bold text-ink-3 hover:text-primary-dark input-focus rounded"
        title={naoSeAplica ? "Voltar a informar este item" : "Este item não se aplica — some do documento e da planilha"}
      >
        {naoSeAplica ? "Informar" : "Não se aplica"}
      </button>
    </Field>
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
 * A DEFINIÇÃO da contratação de um item: qual forma vale, por quanto, e por quê.
 *
 * Os valores chegam prontos da EC e seguem editáveis — a EC levanta o preço, a
 * OS fecha a condição, e o número que fecha nem sempre é o que foi estimado. O
 * BV mora dentro da forma "com BV e NF" (nas outras não existe, por definição) e
 * a justificativa é UMA POR FORMA: aqui as três convivem, e cada uma responde
 * por si (ver `domain/contratacaoOs`).
 */
function ItemContratacao({
  item,
  nome,
  grupo,
  descricao,
  onUpd,
}: {
  item: ItemContratacaoOs;
  nome: string;
  grupo: string;
  descricao: string;
  onUpd: (patch: Partial<ItemContratacaoOs>) => void;
}) {
  const bv = bvDoItem(item);
  const abaixoDoPadrao = bv.base > 0 && bv.percentual < BV_PADRAO_PERCENTUAL;

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
          const exigida = exigeJustificativa(item, chave);
          const escrita = (opcao.justificativaBv ?? "").trim();
          const faltando = exigida && !escrita;
          const mudar = (patch: Partial<typeof opcao>) => onUpd({ [chave]: { ...opcao, ...patch } } as Partial<ItemContratacaoOs>);

          return (
            <div key={chave} className="rounded-btn border border-border-soft bg-[#FCFCFD] px-2 py-1.5">
              <span className="block text-[11px] font-bold leading-tight text-ink-2 mb-1">{longo}</span>

              {/* Ou o valor, ou "Não se aplica" — as duas respostas possíveis. */}
              {opcao.naoSeAplica ? (
                <div className="h-8 flex items-center rounded-btn border border-border-soft bg-[#F1F2F5] px-2 text-[12.5px] font-bold text-ink-3">
                  Não se aplica
                </div>
              ) : (
                <CurrencyInput
                  className="!h-8 !px-2 !text-[12.5px]"
                  value={opcao.valor}
                  onValue={(valor) => mudar({ valor })}
                  aria-label={`${longo} de ${nome}`}
                />
              )}
              <button
                type="button"
                onClick={() => mudar({ naoSeAplica: !opcao.naoSeAplica })}
                className="mt-1 text-[10.5px] font-bold text-ink-3 hover:text-primary-dark input-focus rounded"
                title={opcao.naoSeAplica ? "Voltar a informar um valor" : "Este item não é pago desta forma"}
              >
                {opcao.naoSeAplica ? "Informar valor" : "Não se aplica"}
              </button>

              {/* O BV só existe na cobrança COM BV, e só enquanto ela vale. */}
              {chave === "comBvNf" && !opcao.naoSeAplica && (
                <div className="mt-2 pt-2 border-t border-border-soft space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-ink-3">BV</span>
                    <div className="flex rounded-btn border border-border-soft overflow-hidden">
                      {(["percentual", "fixo"] as const).map((modo) => (
                        <button
                          key={modo}
                          type="button"
                          onClick={() => onUpd({ bv: { ...item.bv, modo } })}
                          className={cx(
                            "px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                            item.bv.modo === modo ? "bg-primary text-white" : "bg-surface text-ink-3 hover:text-ink"
                          )}
                        >
                          {modo === "percentual" ? "%" : "R$"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {item.bv.modo === "percentual" ? (
                    <NumberInput
                      className="!h-8 !px-2 !text-[12.5px]"
                      value={item.bv.valor}
                      onValue={(valor) => onUpd({ bv: { ...item.bv, valor: limitarBvPercentual(valor) } })}
                      aria-label={`Percentual do BV de ${nome}`}
                    />
                  ) : (
                    <CurrencyInput
                      className="!h-8 !px-2 !text-[12.5px]"
                      value={item.bv.valor}
                      onValue={(valor) => onUpd({ bv: { ...item.bv, valor } })}
                      aria-label={`Valor fixo do BV de ${nome}`}
                    />
                  )}
                  {/* O outro lado da conta, sempre à vista. */}
                  <p className={cx("text-[10.5px] font-semibold", abaixoDoPadrao ? "text-warning" : "text-ink-3")}>
                    {item.bv.modo === "percentual" ? brl(bv.valor) : `${bv.percentual.toLocaleString("pt-BR")}%`}
                    {abaixoDoPadrao && ` · abaixo de ${BV_PADRAO_PERCENTUAL}%`}
                  </p>
                </div>
              )}

              {/* Justificativa por forma: some quando a forma não vale ou o BV
                  está no padrão, e fica se já houver texto escrito. */}
              {(exigida || escrita) && (
                <div className="mt-2 pt-2 border-t border-border-soft" id={TRAVA_JUSTIF(item.ecLinhaId, chave)}>
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.05em] text-ink-3 mb-1">
                    Justificativa do BV {exigida && <span className="text-danger">*</span>}
                  </span>
                  <AutoTextarea
                    className={cx("!text-[12px]", faltando && "!border-danger !bg-danger-soft")}
                    rows={2}
                    value={opcao.justificativaBv ?? ""}
                    onChange={(e) => mudar({ justificativaBv: e.target.value })}
                    placeholder={
                      chave === "comBvNf"
                        ? "Por que o BV ficou abaixo de 15%."
                        : "Por que este item é pago sem BV."
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
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

