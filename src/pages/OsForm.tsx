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
  AvisoHomologacaoEmail,
  MOTIVO_DISPARO_DESLIGADO,
} from "@/components/ui";
import { IcDownload, IcSearch, IcSend, IcChevron, IcSpark } from "@/components/icons";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import {
  agruparPorFornecedor,
  descritivoConsolidado,
  bvConsolidado,
  resumoDeCustos,
  BV_PADRAO_PERCENTUAL,
  numeroOs,
  versaoOs,
  textoObjetoContrato,
  LEI_INCENTIVO_PADRAO,
  FORMA_PAGAMENTO_PADRAO,
  OBS_CONTRATO_PADRAO,
} from "@/domain/calc";
import { ETAPAS_CRONOGRAMA } from "@/domain/projeto";
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
import { pendenciasDaTela } from "@/domain/pendencias";
import { CAMPOS_LOGISTICA, CAMPOS_INFRAESTRUTURA, alternarNaoSeAplica, naoSeAplica, temContrato } from "@/domain/os";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import type { ResumoCustos } from "@/domain/calc";
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
  const bvJustificativa = os.financeiro.bvJustificativa || bvEc.justificativa;

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
      // Tomador: quem contrata o fornecedor é a Pólobh — é ela que emite a OS e
      // recebe a nota. Deixar em branco só obrigava a escolher a única resposta
      // óbvia antes de os dados fiscais aparecerem; segue trocável para Cliente
      // quando o faturamento vai direto para ele.
      tomador: os.financeiro.tomador || "Polobh",
      codigoServico: os.financeiro.codigoServico || codigoServico,
      cnae: os.financeiro.cnae || cnaeUnico,
      projetoIncentivado:
        os.financeiro.projetoIncentivado || ec.projeto.nomeProjeto || ec.projeto.titulo,
      // Lei COM o número do projeto: é assim que o Projeto já guarda
      // ("Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234").
      leiIncentivo: os.financeiro.leiIncentivo || ec.projeto.incentivosFiscais || LEI_INCENTIVO_PADRAO,
      bvPercentual,
      bvValor,
      bvJustificativa,
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

  /** Resumo dos Custos: cada item e as três formas de cobrá-lo, com os totais. */
  const resumo = resumoDeCustos(linhasConsolidadas);

  /** O BV combinado nos itens desta OS — a origem do que está nos campos abaixo. */
  const bvDaEc = bvConsolidado(linhasConsolidadas);
  // Justificativa do BV é obrigatória quando não há BV ou o percentual é < 15%.
  const bvPrecisaJustif = os.financeiro.bvPercentual < BV_PADRAO_PERCENTUAL;
  const bvJustifFaltando = bvPrecisaJustif && !os.financeiro.bvJustificativa?.trim();
  /**
   * O BV daqui nasce do Resumo dos Custos e segue editável. Quando alguém o
   * altera, ou quando os itens da EC mudam depois, os dois divergem — e sem
   * dizer isso o campo passaria a mentir sobre o que foi combinado.
   */
  const bvDivergeDaEc = bvDaEc.percentual > 0 && Math.abs(os.financeiro.bvPercentual - bvDaEc.percentual) >= 0.01;

  /** Para abrir o bloco certo quando um aviso precisa levar a pessoa a um campo. */
  const recolher = useAcoesRecolher();

  /** Esta OS tem contrato? Quem decide é a coluna Contrato dos itens, na EC. */
  const haContrato = temContrato(os, linhasConsolidadas);

  /** Empresa emissora não cadastrada: os dados da nota sairiam em branco calados. */
  const faltaCadastroTomador = os.financeiro.tomador === "Polobh" && !empresaPolobh;
  /** A lei de incentivo da OS ficou diferente do que o Projeto guarda. */
  const leiDivergeDaEc =
    !!ecCtx.projeto.incentivosFiscais && (os.financeiro.leiIncentivo ?? "") !== ecCtx.projeto.incentivosFiscais;

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
  //
  // Os três campos já nascem preenchidos pelo que foi combinado ITEM A ITEM na
  // EC (ver `bvConsolidado`): aqui é o lugar de conferir e ajustar, não de
  // lembrar de cabeça o que se negociou semanas atrás.
  const bvBloco = (
    <>
      <LinhaOs
        label="BV Pólobh — Percentual"
        hint={bvDaEc.valor > 0 ? `(do Resumo dos Custos: ${bvDaEc.percentual}% · ${brl(bvDaEc.valor)})` : "(do Resumo dos Custos)"}
      >
        <NumberInput value={os.financeiro.bvPercentual} onValue={(v) => updFin({ bvPercentual: v, bvValor: (os.financeiro.valorTotal * v) / 100 })} />
        {bvDivergeDaEc && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[12px] text-warning">
            <span className="font-semibold">Diferente do combinado nos itens ({bvDaEc.percentual}%).</span>
            <button
              type="button"
              onClick={() => updFin({ bvPercentual: bvDaEc.percentual, bvValor: (os.financeiro.valorTotal * bvDaEc.percentual) / 100 })}
              className="font-bold text-primary-dark hover:underline"
            >
              Usar o BV do Resumo dos Custos
            </button>
          </div>
        )}
      </LinhaOs>
      <LinhaOs label="BV Pólobh — Valor">
        <Auto v={brl((os.financeiro.valorTotal * os.financeiro.bvPercentual) / 100)} />
      </LinhaOs>
      <LinhaOs label="Justificativa do BV" hint={bvPrecisaJustif ? "(obrigatória)" : "(opcional)"} id={TRAVA_BV}>
        <Textarea
          value={os.financeiro.bvJustificativa ?? ""}
          onChange={(e) => updFin({ bvJustificativa: e.target.value })}
          placeholder="Registre o motivo quando não houver BV ou for abaixo de 15% (ex.: condição negociada com o fornecedor)."
          className={bvJustifFaltando ? "!border-danger !bg-danger-soft" : ""}
        />
        <TextosJaUsados
          valor={os.financeiro.bvJustificativa ?? ""}
          opcoes={sugestoes.valores.bvJustificativa}
          onEscolher={(bvJustificativa) => updFin({ bvJustificativa })}
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

  async function salvar(status?: Os["status"]) {
    // BV fora do padrão (sem BV ou < 15%) exige justificativa — para qualquer perfil.
    //
    // O aviso sozinho não bastava: numa tela de quinze blocos, ler "falta a
    // justificativa" e ter de caçar o campo é o mesmo trabalho de antes. O
    // aviso agora LEVA até ele — rola, pisca em vermelho e põe o cursor.
    if (bvJustifFaltando) {
      toast("Informe a justificativa do BV — obrigatória quando não há BV ou é menor que 15%.", "warning");
      // O bloco pode estar recolhido — abrir antes, senão a rolagem vai parar
      // num título fechado e o campo continuará escondido.
      recolher?.expandir(idSecao(SECAO_ACERTOS));
      destacarCampo(TRAVA_BV);
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
        {/* Cabeçalho do modelo em Excel */}
        <CardOs secao="Ordem de Serviço">
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
        <CardOs secao="Dados do Cliente">
          <LinhaOs label="Cliente"><Auto v={ecCtx.cliente.nome} /></LinhaOs>
          <LinhaOs label="Razão Social"><Auto v={ecCtx.cliente.razaoSocial} /></LinhaOs>
          <LinhaOs label="Endereço"><Auto v={ecCtx.cliente.endereco} /></LinhaOs>
          <LinhaOs label="CNPJ/CPF"><Auto v={ecCtx.cliente.cnpjCpf} /></LinhaOs>
          <LinhaOs label="Inscrição Estadual"><Auto v={ecCtx.cliente.inscricaoEstadual} /></LinhaOs>
          <LinhaOs label="Inscrição Municipal"><Auto v={ecCtx.cliente.inscricaoMunicipal} /></LinhaOs>
        </CardOs>

        {/* DADOS DO PROJETO — automático da EC, com o cronograma do projeto */}
        <CardOs secao="Dados do Projeto">
          <LinhaOs label="Título"><Auto v={ecCtx.projeto.titulo} /></LinhaOs>
          <LinhaOs label="Modalidade"><Auto v={ecCtx.projeto.modalidade} /></LinhaOs>
          <LinhaOs label="Incentivos Fiscais"><Auto v={ecCtx.projeto.incentivosFiscais} /></LinhaOs>
          <LinhaOs label="Data"><Auto v={dataBR(ecCtx.projeto.evento)} /></LinhaOs>
          <LinhaOs label="Horário"><Auto v={ecCtx.projeto.horario} /></LinhaOs>
          {/* Endereço logo abaixo do Local: os dois são a mesma informação, e com
              o Nº de Participantes no meio a leitura quebrava. */}
          <LinhaOs label="Local"><Auto v={ecCtx.projeto.local} /></LinhaOs>
          <LinhaOs label="Endereço do Local"><Auto v={ecCtx.projeto.enderecoLocal} /></LinhaOs>
          <LinhaOs label="Nº Participantes"><Auto v={ecCtx.projeto.participantes ?? ""} /></LinhaOs>
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
        <CardOs
          secao="Dados do Fornecedor"
          acaoSecao={
            <Button variant="soft" size="sm" icon={<IcSearch width={15} height={15} />} onClick={consultar} disabled={busy || !flags.consultaCnpj}>
              Consultar CNPJ
            </Button>
          }
        >
          {cnpjMsg && <div className="m-3 text-[12.5px] text-info bg-info-soft rounded-btn px-3 py-2">{cnpjMsg}</div>}
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
        <CardOs secao="Detalhamento da Contratação">
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
          <LinhaOs label="Entrega"><Input value={os.entrega} onChange={(e) => setOs((o) => (o ? { ...o, entrega: e.target.value } : o))} placeholder="Instalação, operação, acompanhamento…" /></LinhaOs>
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
        </CardOs>

        {/* COMENTÁRIOS INTERNOS — não saem em documento, e-mail ou planilha */}
        <CardOs secao="Comentários Internos">
          <LinhaOs
            label="Pendências e combinados"
            hint="(só a equipe vê — @menção cobra alguém)"
          >
            {/* Âncora da OS para o navegador de pendências (os comentários da OS
                são pendências como os dos itens da EC). */}
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

        {/* O CREDENCIAMENTO saiu daqui (29/08/2026): virou subaba do Projeto, onde
            se vê a fila inteira e se dispara para todos os fornecedores de uma
            vez. O link continua sendo o desta OS — o que mudou foi o comando. */}
        <div className="space-y-4">
          {/* RESUMO DOS CUSTOS */}
          <CardOs secao="Resumo dos Custos">
            {/* As três formas de cobrar cada item, lado a lado — o que a produção
                preencheu lá na EC. Aqui é leitura: para mudar, muda-se no item.
                As colunas são CENÁRIOS alternativos, não parcelas de um total:
                por isso os totais não se somam entre si. */}
            <LinhaOs label="Por item (vindo da EC)" hint="(as três formas, item a item)">
              <TabelaResumoCustos resumo={resumo} />
            </LinhaOs>
            {/* Os números acima são o que a EC registrou; os de baixo são o que
                foi NEGOCIADO com o fornecedor, e é deles que vivem o Faturamento
                e o Contrato. Separados para não se lerem como repetição. */}
            <SubSecao>Valores negociados</SubSecao>
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
          <CardOs className="border-active-border" secao="Informações a serem preenchidas pelo Financeiro da Pólobh">
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
                    <p className="py-2 text-[12.5px] font-semibold text-warning">
                      A empresa emissora da Pólobh ainda não está cadastrada — os dados da nota saem em branco.
                      Cadastre em Configurações › Empresas do Grupo.
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
              hint={leiDivergeDaEc ? `EC: ${ecCtx.projeto.incentivosFiscais}` : "(lei e nº do projeto)"}
            >
              <Input value={os.financeiro.leiIncentivo ?? ""} sugestoes={sugestoes.valores.leiIncentivo} onChange={(e) => updFin({ leiIncentivo: e.target.value })} placeholder="Ex.: Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234" />
              {leiDivergeDaEc && (
                <button
                  type="button"
                  onClick={() => updFin({ leiIncentivo: ecCtx.projeto.incentivosFiscais })}
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
            {/* O bloco de emissão TERMINA aqui: o que vem depois do valor a
                pagar (BV, acerto) não é dado de nota — foi para "Acertos
                Financeiros", grupo próprio no fim da tela. */}
            <LinhaOs label="Valor total a pagar"><Auto v={brl(os.financeiro.valorAPagar)} /></LinhaOs>

            {/* DADOS PARA CONTRATO — só entra quando a EC pede contrato.
                Marcado "Não se Aplica" lá, o grupo inteiro não existe aqui: não
                é campo em branco à toa, é um contrato inexistente descrito com
                valores, forma de pagamento e data no documento do fornecedor. */}
            {!haContrato ? (
              <>
                <SubSecao>Dados para Contrato</SubSecao>
                <p className="px-4 py-3 text-[12.5px] text-ink-2">
                  Nenhum item desta OS pede contrato. Para incluí-lo, marque <b>Emitir</b> ou{" "}
                  <b>Emitir Nova Versão</b> na coluna <b>Contrato</b> dos itens, na EC.
                </p>
              </>
            ) : (
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

      {/* Mesma pílula da EC: as pendências desta OS que têm onde ser achadas.
          O cronograma vazio é cobrado no sininho — ele não mora num item. */}
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

/** Âncora da justificativa do BV — o único campo que hoje trava o salvamento. */
const TRAVA_BV = idCampoTrava("bv-justificativa");
/** Bloco onde ela mora — o aviso precisa abri-lo antes de rolar até lá. */
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
function TabelaResumoCustos({ resumo }: { resumo: ResumoCustos }) {
  if (!resumo.linhas.length) {
    return <p className="py-2 text-[12.5px] text-ink-3">Esta OS não está ligada a itens da EC.</p>;
  }
  const celula = (v: number | null) =>
    v === null ? <i className="text-ink-3 font-normal">Não se aplica</i> : brl(v);

  return (
    <div className="py-1.5 overflow-x-auto">
      <table className="w-full text-[12.5px] border-collapse">
        <thead>
          <tr className="text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-3">
            <th className="text-left font-extrabold pb-1.5 pr-2">Item</th>
            <th className="text-right font-extrabold pb-1.5 px-2 whitespace-nowrap">Com BV e NF</th>
            <th className="text-right font-extrabold pb-1.5 px-2 whitespace-nowrap">Sem BV e Com NF</th>
            <th className="text-right font-extrabold pb-1.5 pl-2 whitespace-nowrap">Sem BV e Sem NF</th>
          </tr>
        </thead>
        <tbody>
          {resumo.linhas.map((l) => (
            <tr key={l.id} className="border-t border-border-soft">
              <td className="py-1.5 pr-2 font-semibold text-ink">{l.item}</td>
              <td className="py-1.5 px-2 text-right font-display text-ink">{celula(l.comBvNf)}</td>
              <td className="py-1.5 px-2 text-right font-display text-ink">{celula(l.semBvComNf)}</td>
              <td className="py-1.5 pl-2 text-right font-display text-ink">{celula(l.semBvSemNf)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-bold text-ink">
            <td className="py-1.5 pr-2">Total por forma de cobrança</td>
            <td className="py-1.5 px-2 text-right font-display">{brl(resumo.totais.comBvNf)}</td>
            <td className="py-1.5 px-2 text-right font-display">{brl(resumo.totais.semBvComNf)}</td>
            <td className="py-1.5 pl-2 text-right font-display">{brl(resumo.totais.semBvSemNf)}</td>
          </tr>
        </tfoot>
      </table>
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

