/**
 * O CONTEÚDO DA OS COMO DOCUMENTO (27/11/2026) — o que vai escrito, em que ordem.
 *
 * A OS tem dois desenhos do mesmo papel: a visualização em tela
 * (`components/print/OsDocumento`) e o arquivo PDF que vai para a pasta do
 * projeto quando ela é emitida (`lib/pdf/os`). Para os dois nunca divergirem, o
 * conteúdo é decidido AQUI, uma vez, e cada um só desenha os blocos que recebe.
 *
 * As regras do que entra e do que fica de fora (item "não se aplica", colunas
 * sem valor, bloco do Financeiro só para quem pode ver) são as que a
 * visualização já tinha — vieram para cá sem mudar.
 */
import type { Ec, EmpresaGrupo, Os } from "@/data/types";
import { brl, dataBR } from "@/lib/format";
import { itensParaDocumento, CAMPOS_LOGISTICA, CAMPOS_INFRAESTRUTURA, osIncentivada, incentivoDaNota } from "@/domain/os";
import { bvDaContratacao, sincronizarContratacao, valorDaContratacao } from "@/domain/contratacaoOs";
import { calcularAcerto, percentualDoBv } from "@/domain/acertoFinanceiro";
import { datasDoEvento, etapasDoCronogramaProjeto, horariosDoEvento } from "@/domain/projeto";
import { dadosDoTomador, RETENCOES_PADRAO } from "@/domain/tomadorOs";
import { osEmitida } from "@/domain/faseOs";
import { linhasDosBancarios, meioDePagamento, prazoParaDocumento } from "@/domain/pagamentoOs";

export interface ColunaTabelaOs {
  titulo: string;
  /** Fração da largura (0–1); sem ela, a coluna divide o que sobra. */
  largura?: number;
  direita?: boolean;
}

export type BlocoOs =
  | { t: "secao"; titulo: string }
  | { t: "lv"; label: string; valor: string }
  /**
   * Linha "rótulo | lista": grupos com título em negrito e, embaixo, tópicos de
   * duas colunas alinhadas (data e horário). É o cronograma do projeto — antes
   * saía tudo numa linha só, com as datas misturadas (27/11/2026).
   */
  | { t: "lista"; label: string; grupos: { titulo: string; itens: { a: string; b: string }[] }[] }
  | {
      t: "tabela";
      /** "escuro": cabeçalho grafite (cronograma); "claro": cabeçalho cinza (custos). */
      estilo: "escuro" | "claro";
      colunas: ColunaTabelaOs[];
      linhas: string[][];
      /** Texto quando não há linha nenhuma. */
      vazio?: string;
      rodape?: string[];
      /** A primeira coluna sai em destaque (a etapa do cronograma). */
      primeiraEmDestaque?: boolean;
    }
  | { t: "destaque"; titulo: string; texto: string };

export interface OsDocumentoModelo {
  blocos: BlocoOs[];
  /** Quem assina do lado do fornecedor. */
  assinaturaFornecedor: string;
}

const txt = (v: string | number | null | undefined): string => (v === null || v === undefined ? "" : String(v));

export function montarOsDocumento(
  os: Os,
  ec: Ec,
  opts: { restrito?: boolean; empresas?: EmpresaGrupo[] } = {}
): OsDocumentoModelo {
  // Cliente e dados do evento saem da OS: a foto da emissão, ou — enquanto ela
  // não é emitida — o cadastro de agora (ver `osComDadosAtuais`). Da EC vêm só
  // os itens consolidados, para o Detalhamento da Contratação.
  const cli = os.cliente;
  const p = os.projeto;
  const incentivada = osIncentivada(os);
  const f = os.fornecedor;
  const b = f.dadosBancarios;
  const consolidadas = ec.linhas.filter((l) => os.ecLinhaIds.includes(l.id));
  // Os itens fixos E os criados nesta OS, na ordem da tela (15/09/2026).
  const logistica = itensParaDocumento(os.logistica, CAMPOS_LOGISTICA);
  const infraestrutura = itensParaDocumento(os.infraestrutura, CAMPOS_INFRAESTRUTURA);
  // Os itens "em dia com a EC" servem ao acerto financeiro (27/11/2026).
  const itensEmDia = sincronizarContratacao(os.itens ?? [], consolidadas, { emitida: osEmitida(os) });
  const tomador = dadosDoTomador(os.financeiro.tomador, {
    cliente: cli,
    empresas: opts.empresas ?? [],
    avulso: os.financeiro.tomadorAvulso,
  });
  const acerto = calcularAcerto(os.financeiro, os.orcamento, bvDaContratacao(itensEmDia).valor, valorDaContratacao(itensEmDia));
  /** "R$ 300,00 (15%)" — o percentual só aparece quando há BV e valor original. */
  const pctBv = percentualDoBv(acerto);
  const bvComPercentual =
    brl(acerto.bvSobreOriginal) +
    (pctBv === null ? "" : ` (${pctBv.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`);
  const incentivo = incentivada ? incentivoDaNota(os) : null;
  const itensEmLinhas = (itens: { rotulo: string; valor: string }[]) =>
    itens.map(({ rotulo, valor }) => `${rotulo}: ${valor || "____"}`).join("\n");

  const blocos: BlocoOs[] = [];
  const lv = (label: string, valor: string | number | null | undefined) => blocos.push({ t: "lv", label, valor: txt(valor) });
  const secao = (titulo: string) => blocos.push({ t: "secao", titulo });

  // Só "OS" (18/11/2026): o número completo já diz o que é.
  lv("OS", os.numero);
  lv("Projeto", p.titulo);
  lv("Data de emissão", dataBR(os.criadoEm));
  // O status voltou ao cabeçalho do PDF (27/11/2026).
  lv("Status", os.status);

  secao("Dados do Cliente");
  lv("Cliente", cli.nome);
  lv("Razão Social", cli.razaoSocial);
  lv("Endereço", cli.endereco);
  lv("CNPJ/CPF", cli.cnpjCpf);
  lv("Inscrição Estadual", cli.inscricaoEstadual);
  lv("Inscrição Municipal", cli.inscricaoMunicipal);

  secao("Dados do Projeto");
  lv("Título", p.titulo);
  lv("Modalidade", p.modalidade);
  // Os três dados do projeto incentivado, como nos Dados Gerais (23/11/2026).
  if (incentivo) {
    lv("Nome do Projeto Incentivado", incentivo.projetoIncentivado);
    lv("Código do Projeto Incentivado", incentivo.codigoProjetoIncentivado);
    lv("Lei de Incentivo à Cultura", incentivo.leiIncentivo);
  }
  // Todas as faixas do evento, e não só a primeira.
  lv("Data(s)", datasDoEvento(p));
  lv("Horário(s)", horariosDoEvento(p));
  lv("Local", p.local);
  lv("Nº Participantes", p.participantes ?? "");
  lv("Endereço do Local", p.enderecoLocal);
  lv("Produtora Responsável", p.produtoraResponsavel);
  lv("Telefone", p.telefoneProdutora);
  lv("E-mail", p.emailProdutora);
  // Uma etapa embaixo da outra, com as datas e os horários em tópicos alinhados.
  const etapasDoProjeto = etapasDoCronogramaProjeto(p);
  if (etapasDoProjeto.length) {
    blocos.push({
      t: "lista",
      label: "Cronograma do Projeto",
      grupos: etapasDoProjeto.map((e) => ({ titulo: e.etapa, itens: e.faixas.map((f) => ({ a: f.data, b: f.horario })) })),
    });
  } else lv("Cronograma do Projeto", "");

  secao("Dados do Fornecedor");
  lv("Fornecedor", f.nomeFantasia || f.razaoSocial);
  lv("CNPJ/CPF", f.cnpj);
  lv("Perfil (MEI / Simples / etc.)", f.perfilTributario);
  lv("Razão Social", f.razaoSocial);
  lv("Endereço", f.endereco);
  lv("Inscrição Estadual", f.inscricaoEstadual);
  lv("Inscrição Municipal", f.inscricaoMunicipal);
  // Os dados bancários foram para os Dados para Faturamento, com a forma de pagamento (27/11/2026).
  lv("Representante", f.representante);
  lv("Telefone", f.telefone);
  lv("E-mail", f.email);

  // O bloco "Itens Consolidados da EC" saiu do PDF (18/11/2026).
  secao("Detalhamento da Contratação");
  lv("Modalidade", os.modalidade);
  lv("Descritivo", os.descritivo);
  // Item "não se aplica" nem aparece; bloco inteiro fora quando nada se aplica.
  if (logistica.length > 0) lv("Logística do Fornecedor", itensEmLinhas(logistica));
  if (infraestrutura.length > 0) lv("Infraestrutura", itensEmLinhas(infraestrutura));
  // GRUPOS criados nesta OS, depois dos dois fixos (15/09/2026).
  for (const g of os.gruposExtras ?? []) {
    if (g.naoSeAplica || !g.itens.some((i) => !i.naoSeAplica)) continue;
    lv(g.nome || "Outros", itensEmLinhas(g.itens.filter((i) => !i.naoSeAplica)));
  }
  // Só o campo LIVRE: a thread de observações é conversa interna da equipe.
  if (!os.observacoesGeraisNaoSeAplica) lv("Observações Gerais", os.observacoesGerais);

  // Cronograma "não se aplica" não vira tabela vazia para o fornecedor (15/09/2026).
  if (!os.cronogramaNaoSeAplica) {
    secao("Cronograma Específico do Fornecedor");
    blocos.push({
      t: "tabela",
      estilo: "escuro",
      colunas: [{ titulo: "Etapa", largura: 0.26 }, { titulo: "Data", largura: 0.18 }, { titulo: "Horário", largura: 0.16 }, { titulo: "Atividades" }],
      linhas: [...os.cronograma]
        .sort((a, c) => (a.data || "").localeCompare(c.data || ""))
        .map((c) => [txt(c.etapa), dataBR(c.data), txt(c.horario), txt(c.atividades)]),
      vazio: "Sem etapas cadastradas.",
      primeiraEmDestaque: true,
    });
  }

  // O CREDENCIAMENTO saiu da OS (29/08/2026): virou subaba do Projeto.

  // O bloco "Resumo dos Custos" saiu da OS (27/11/2026). O documento fiscal, a
  // forma de pagamento e o prazo foram para os Dados para Faturamento.

  if (opts.restrito) {
    secao("Dados Emissão Faturamento");
    lv("Tomador dos Serviços", tomador?.rotulo ?? "");
    lv("Razão Social", tomador?.razaoSocial ?? "");
    lv("Endereço", tomador?.endereco ?? "");
    lv("CNPJ/CPF", tomador?.cnpjCpf ?? "");
    lv("Inscrição Estadual", tomador?.inscricaoEstadual ?? "");
    lv("Inscrição Municipal", tomador?.inscricaoMunicipal ?? "");
    lv("Descritivo Nota Fiscal", os.financeiro.descritivoNf);
    // Só em projeto incentivado (cultural): corporativo não tem lei de incentivo.
    if (incentivo) {
      lv("Nome do Projeto Incentivado", incentivo.projetoIncentivado);
      lv("Código do Projeto Incentivado", incentivo.codigoProjetoIncentivado);
      lv("Lei de Incentivo à Cultura", incentivo.leiIncentivo);
    }
    lv("CNAE", os.financeiro.cnae);
    // Os VALORES sobem e os dois códigos descem (15/09/2026).
    lv("Valor unitário", brl(os.financeiro.valorUnitario));
    lv("Valor total", brl(os.financeiro.valorTotal));
    lv("Desconto Especial Negociado", brl(os.financeiro.descontoNegociado));
    lv("Valor total a pagar", brl(os.financeiro.valorAPagar));
    lv("Documento Fiscal", os.orcamento.documentoFiscal);
    const meio = meioDePagamento(os);
    lv("Forma de Pagamento", meio);
    // Só com "Dados bancários" a conta do fornecedor sai no papel.
    if (meio === "Dados bancários") lv("Dados Bancários", linhasDosBancarios(b).join("\n"));
    lv("Prazo de Pagamento", prazoParaDocumento(os));
    lv("Código de Serviço", os.financeiro.codigoServico);
    lv("Ordem de Compra", os.financeiro.ordemCompra ?? "");

    // RETENÇÕES FISCAIS em destaque: o aviso que evita o retrabalho mais caro da OS.
    blocos.push({
      t: "destaque",
      titulo: "Retenções Fiscais",
      texto: os.financeiro.retencoesNaoSeAplica ? "Não se aplica" : os.financeiro.retencoes || RETENCOES_PADRAO,
    });

    // "Dados para Contrato" saiu do PDF da OS (18/11/2026): o contrato tem documento próprio.
    // ACERTOS FINANCEIROS (15/09/2026). Sem "Não se aplica" (24/11/2026): sai sempre.
    secao("Acertos Financeiros");
    lv("Valor original dos serviços", brl(acerto.valorOriginal));
    lv("BV sobre o valor original", bvComPercentual);
    lv("Valor da NF", brl(acerto.valorNf));
    lv("Valor do acréscimo", brl(acerto.acrescimo));
    lv(`Encargos sobre o acréscimo (${acerto.encargosPercentual}%)`, brl(acerto.encargosSobreAcrescimo));
    lv("Valor devolução Pólobh", brl(acerto.devolucaoPolobh));
    lv("Observações", os.financeiro.acertoFinanceiro);
  }

  return { blocos, assinaturaFornecedor: f.razaoSocial || "Fornecedor" };
}
