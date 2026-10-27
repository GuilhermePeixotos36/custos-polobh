/**
 * Geração da OS em Excel seguindo o "Modelo Novo" da Pólobh
 * ("Planilha de formatação de OS - Modelo Novo (5) em 13 06 26.xlsx").
 *
 * O modelo é uma folha de rótulo + valor: a coluna A é o rótulo e o valor ocupa
 * a faixa B:O, com sub-colunas nas linhas de cronograma (etapa · data · horário
 * · atividades). Cores, fontes e alturas foram medidas no arquivo original —
 * barras de seção em cinza 15%, faixa laranja clara nas duas barras do
 * financeiro, Futura PT Light em negrito nos rótulos.
 *
 * A coluna "OBSERVAÇÕES" do modelo (P) NÃO é exportada: lá ela só explica de
 * onde cada campo vem ("informação vem automaticamente da EC", "preenchida pela
 * equipe"). Ela foi o roteiro para montar este gerador — tudo o que ela manda
 * puxar do sistema é puxado aqui.
 *
 * ORÇAMENTO é o único bloco que foge do modelo de propósito, a pedido do
 * Guilherme (26/08/2026): como a OS consolida vários itens da EC e cada um é
 * negociado do seu jeito, o bloco sai ITEM A ITEM — o valor do item na EC e,
 * logo abaixo, a opção de cobrança escolhida para ele (ver `opcaoEscolhidaDoItem`).
 */
import ExcelJS from "exceljs";
import type { Ec, EcLinha, EmpresaGrupo, Os } from "@/data/types";
import { dataBR } from "@/lib/format";
import {
  textoObjetoContrato, FORMA_PAGAMENTO_PADRAO, OBS_CONTRATO_PADRAO,
} from "@/domain/calc";
import { bvDaContratacao, COLUNAS_CONTRATACAO, resumoContratacao, sincronizarContratacao } from "@/domain/contratacaoOs";
import { datasDoEvento, ETAPAS_CRONOGRAMA, horariosDoEvento } from "@/domain/projeto";
import { itensParaDocumento, temContrato, CAMPOS_LOGISTICA, CAMPOS_INFRAESTRUTURA, osIncentivada } from "@/domain/os";
import { calcularAcerto } from "@/domain/acertoFinanceiro";
import { dadosDoTomador, RETENCOES_PADRAO } from "@/domain/tomadorOs";
import { COR, fill, FONT_LIGHT, baixar, nomeArquivo, carregarLogo, encaixarLogo, linhasVisuais, alturaParaLinhas } from "./shared";

const moeda = '"R$" #,##0.00';
/** Dinheiro em TEXTO — as faixas mescladas de `linhaBlocos` não aceitam numFmt. */
const dinheiro = (v: number) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const PT = 11;
/** Última coluna da faixa de valores — o modelo vai de B até O. */
const FIM = "O";
/** Largura útil da faixa de valor (B:O, 14 colunas de 6,5) — base do cálculo de altura. */
const LARGURA_VALOR = 14 * 6.5;
const COLS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O"];

/** Borda fina embaixo, como nas linhas de dado do modelo. */
const linhaFina: Partial<ExcelJS.Borders> = { bottom: { style: "thin" } };
/** Moldura grossa das barras de seção. */
const molduraSecao: Partial<ExcelJS.Borders> = {
  top: { style: "medium" }, bottom: { style: "medium" },
  left: { style: "medium" }, right: { style: "medium" },
};

/** Dados fiscais da empresa do grupo Pólobh (configurados em Configurações). */
export interface EmpresaEmissora {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
}

/**
 * A empresa emissora, no formato do cadastro — para a planilha poder usar a
 * mesma resolução de tomador do resto do sistema quando só recebe a padrão.
 */
const empresaComoGrupo = (e: EmpresaEmissora): EmpresaGrupo => ({
  id: "Polobh", nome: e.nome, razaoSocial: e.razaoSocial, cnpj: e.cnpj, endereco: e.endereco,
  inscricaoEstadual: e.inscricaoEstadual, inscricaoMunicipal: e.inscricaoMunicipal,
  padrao: true, ordem: 0,
});

/** Monta o buffer da OS em Excel sem baixar (usado no download normal e no anexo de e-mail). */
export async function criarOsExcelBuffer(
  os: Os,
  ec: Ec,
  opts: { incluirFinanceiro?: boolean; empresaPolobh?: EmpresaEmissora; empresas?: EmpresaGrupo[] } = {}
): Promise<{ buffer: ArrayBuffer; nome: string }> {
  const incluirFinanceiro = opts.incluirFinanceiro ?? true;
  const emp = opts.empresaPolobh;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("OS", {
    pageSetup: {
      paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });
  // Larguras do modelo: rótulo largo em A, faixa de valores repartida em B:O.
  ws.getColumn(1).width = 31.125;
  for (let c = 2; c <= 15; c++) ws.getColumn(c).width = 6.5;

  let r = 1;

  /* ------------------------------ helpers ------------------------------ */

  /** Barra de seção (cinza 15%, moldura grossa), como DADOS DO CLIENTE. */
  const secao = (txt: string, tom: "cinza" | "laranja" = "cinza") => {
    ws.mergeCells(`A${r}:${FIM}${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = txt;
    c.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    c.fill = fill(tom === "cinza" ? COR.sectionGray : COR.destaqueCabecalho);
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    for (const col of COLS) ws.getCell(`${col}${r}`).border = molduraSecao;
    ws.getRow(r).height = 24;
    r++;
  };

  /** Aplica o estilo de rótulo do modelo: negrito, sem preenchimento, filete embaixo. */
  const estiloRotulo = (cel: ExcelJS.Cell) => {
    cel.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
    cel.alignment = { vertical: "middle", wrapText: true };
    cel.border = linhaFina;
  };

  /** Estilo do conteúdo preenchido pelo sistema (regular, alinhado à esquerda). */
  const estiloValor = (cel: ExcelJS.Cell, o: { fixo?: boolean } = {}) => {
    cel.font = { name: FONT_LIGHT, size: PT, italic: !!o.fixo, color: { argb: COR.ink } };
    cel.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cel.border = linhaFina;
  };

  interface OpcoesLinha {
    /** Formata como dinheiro (R$ #.##0,00). */
    money?: boolean;
    /** Texto fixo do modelo (sai em itálico, para não parecer dado preenchido). */
    fixo?: boolean;
    /** Fórmula viva — recalcula se a planilha for editada no Excel. */
    formula?: string;
    numFmt?: string;
    /** Altura da linha, quando o modelo pede mais espaço (blocos de texto). */
    altura?: number;
    /** Omite o rótulo: usado nas linhas seguintes de um rótulo agrupado. */
    semRotulo?: boolean;
    /**
     * Nome do campo DENTRO da faixa de valores (B:L), com o número empurrado
     * para a direita (M:O). É o desenho das linhas de "Valor" do modelo: o
     * rótulo agrupado em A diz "Valor", e cada linha se identifica por dentro
     * ("Valor unitário:", "Valor total:"…).
     */
    rotuloInterno?: string;
  }

  /** Linha rótulo | valor: A = rótulo, B:O = valor. Devolve o número da linha. */
  const linha = (rotulo: string, valor: string | number | null | undefined, o: OpcoesLinha = {}): number => {
    const atual = r;
    const a = ws.getCell(`A${atual}`);
    if (!o.semRotulo) a.value = rotulo;
    estiloRotulo(a);
    if (o.rotuloInterno) {
      ws.mergeCells(`B${atual}:L${atual}`);
      const nome = ws.getCell(`B${atual}`);
      nome.value = `${o.rotuloInterno}:`;
      nome.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
      nome.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      ws.mergeCells(`M${atual}:${FIM}${atual}`);
    } else {
      ws.mergeCells(`B${atual}:${FIM}${atual}`);
    }
    // Com rótulo interno o número vai para a faixa da direita (M:O).
    const b = ws.getCell(`${o.rotuloInterno ? "M" : "B"}${atual}`);
    b.value = o.formula
      ? ({ formula: o.formula, result: typeof valor === "number" ? valor : undefined } as ExcelJS.CellValue)
      : ((valor ?? "") as ExcelJS.CellValue);
    estiloValor(b, o);
    if (o.rotuloInterno) b.alignment = { vertical: "middle", horizontal: "right" };
    for (const col of COLS.slice(1)) ws.getCell(`${col}${atual}`).border = linhaFina;
    if (o.money && typeof valor === "number") b.numFmt = moeda;
    if (o.numFmt) b.numFmt = o.numFmt;
    if (o.altura) ws.getRow(atual).height = o.altura;
    r++;
    return atual;
  };

  /**
   * Linha repartida em blocos, como as do cronograma no modelo:
   * A = rótulo | B:D | E:I | J:L | M:O.
   */
  const linhaBlocos = (
    rotulo: string,
    blocos: [string, string, string, string],
    o: { semRotulo?: boolean; forte?: boolean } = {}
  ) => {
    const a = ws.getCell(`A${r}`);
    if (!o.semRotulo) a.value = rotulo;
    estiloRotulo(a);
    const faixas: [string, string][] = [["B", "D"], ["E", "I"], ["J", "L"], ["M", FIM]];
    faixas.forEach(([ini, fim], i) => {
      ws.mergeCells(`${ini}${r}:${fim}${r}`);
      const c = ws.getCell(`${ini}${r}`);
      c.value = blocos[i];
      // A primeira faixa nomeia a etapa: no modelo ela vem em negrito. `forte`
      // põe a linha inteira em negrito — é a linha de totais da tabela.
      c.font = { name: FONT_LIGHT, bold: o.forte || i === 0, size: PT, color: { argb: COR.ink } };
      c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    });
    for (const col of COLS.slice(1)) ws.getCell(`${col}${r}`).border = linhaFina;
    r++;
  };

  /** Junta o rótulo de um bloco de N linhas numa célula só (mescla vertical em A). */
  const agruparRotulo = (primeira: number, ultima: number) => {
    if (ultima > primeira) {
      ws.mergeCells(`A${primeira}:A${ultima}`);
      ws.getCell(`A${primeira}`).alignment = { vertical: "top", wrapText: true };
    }
  };

  /* ------------------------------ cabeçalho ---------------------------- */
  // O modelo começa direto em DADOS DO CLIENTE; a faixa de marca é a mesma
  // solução da EC — sem ela a planilha sai sem dizer de que OS se trata.
  ws.mergeCells(`A${r}:${FIM}${r + 1}`);
  const tit = ws.getCell(`A${r}`);
  tit.value = "        Ordem de Serviço";
  tit.font = { name: FONT_LIGHT, size: 16, bold: true, color: { argb: COR.white } };
  tit.alignment = { vertical: "middle", horizontal: "center" };
  for (const col of COLS) {
    ws.getCell(`${col}${r}`).fill = fill(COR.headerGray);
    ws.getCell(`${col}${r + 1}`).fill = fill(COR.headerGray);
  }
  ws.getRow(r).height = 26;
  ws.getRow(r + 1).height = 26;
  const logo = await carregarLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo.buffer as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(id, { tl: { col: 0.15, row: r - 0.9 }, ext: encaixarLogo(logo, { largura: 230, altura: 62 }) });
  }
  r += 2;
  linha("Número da OS:", os.numero);
  linha("Projeto:", os.projeto.titulo);
  linha("Data de emissão:", dataBR(new Date().toISOString()));
  linha("Status da OS:", os.status);

  /* --------------------------- DADOS DO CLIENTE ------------------------ */
  // Cliente e evento saem do SNAPSHOT da OS: a planilha reimpressa hoje é a
  // mesma que o fornecedor recebeu na emissão (ver `Os.projeto`).
  const cli = os.cliente;
  secao("DADOS DO CLIENTE");
  linha("Cliente:", cli.nome);
  linha("Razão Social:", cli.razaoSocial);
  linha("Endereço:", cli.endereco);
  linha("CNPJ/CPF:", cli.cnpjCpf);
  linha("Inscrição Estadual:", cli.inscricaoEstadual);
  linha("Inscrição Municipal:", cli.inscricaoMunicipal);

  /* --------------------------- DADOS DO PROJETO ------------------------ */
  const p = os.projeto;
  const incentivada = osIncentivada(os);
  secao("DADOS DO PROJETO");
  linha("Título:", p.titulo);
  linha("Modalidade:", p.modalidade);
  if (incentivada) linha("Incentivos Fiscais:", p.incentivosFiscais);
  // Todas as faixas do evento (ver `datasDoEvento`): a planilha é o que o
  // fornecedor recebe, e ela mostrava só o primeiro dia.
  linha("Data(s):", datasDoEvento(p));
  linha("Horário(s):", horariosDoEvento(p));
  linha("Local:", p.local);
  linha("Nº Participantes:", p.participantes ?? "");
  linha("Endereço do Local:", p.enderecoLocal);
  linha("Produtora Responsável:", p.produtoraResponsavel);
  linha("Telefone:", p.telefoneProdutora);
  linha("E-mail:", p.emailProdutora);

  // Cronograma do PROJETO: as cinco etapas padrão, com as datas e horários que
  // a equipe preencheu em Dados Gerais (uma linha por faixa cadastrada).
  const primeiraCron = r;
  let escreveuCron = false;
  for (const etapa of ETAPAS_CRONOGRAMA) {
    if (p.etapasOcultas?.includes(etapa.key)) continue;
    const faixas = p.cronograma?.[etapa.key] ?? [];
    if (!faixas.length) {
      linhaBlocos("Cronograma:", [etapa.label, "", "", ""], { semRotulo: escreveuCron });
      escreveuCron = true;
      continue;
    }
    for (const f of faixas) {
      const horario = [f.inicio, f.fim].filter(Boolean).join(" às ");
      linhaBlocos("Cronograma:", [etapa.label, dataBR(f.data), horario, ""], { semRotulo: escreveuCron });
      escreveuCron = true;
    }
  }
  // Blocos livres criados pela equipe entram na sequência, com o título deles.
  for (const bloco of p.cronogramaExtras ?? []) {
    for (const f of bloco.faixas ?? []) {
      const horario = [f.inicio, f.fim].filter(Boolean).join(" às ");
      linhaBlocos("Cronograma:", [bloco.titulo, dataBR(f.data), horario, ""], { semRotulo: escreveuCron });
      escreveuCron = true;
    }
  }
  if (escreveuCron) agruparRotulo(primeiraCron, r - 1);

  /* -------------------------- DADOS DO FORNECEDOR ---------------------- */
  const f = os.fornecedor;
  const bnc = f.dadosBancarios;
  secao("DADOS DO FORNECEDOR");
  linha("Fornecedor:", f.nomeFantasia || f.razaoSocial);
  linha("CNPJ/CPF:", f.cnpj);
  linha("Perfil:", f.perfilTributario);
  linha("Razão Social:", f.razaoSocial);
  linha("Endereço:", f.endereco);
  linha("Inscrição Estadual:", f.inscricaoEstadual);
  linha("Inscrição Municipal:", f.inscricaoMunicipal);
  const primeiraBanco = linha("Dados Bancários:", `Conta ${bnc.tipoConta || "—"}`);
  linha("", bnc.banco ? `Banco: ${bnc.banco}` : "Banco:", { semRotulo: true });
  linha("", bnc.agencia ? `Agência: ${bnc.agencia}` : "Agência:", { semRotulo: true });
  linha("", bnc.conta ? `Conta Corrente: ${bnc.conta}` : "Conta Corrente:", { semRotulo: true });
  const ultimaBanco = linha("", bnc.chavePix ? `Chave Pix: ${bnc.chavePix}` : "Chave Pix:", { semRotulo: true });
  agruparRotulo(primeiraBanco, ultimaBanco);
  linha("Representante:", f.representante);
  linha("Telefone:", f.telefone);
  linha("E-mail:", f.email);

  /* --------------------- DETALHAMENTO DA CONTRATAÇÃO ------------------- */
  secao("DETALHAMENTO DA CONTRATAÇÃO");
  linha("Modalidade:", os.modalidade);
  // O descritivo traz o texto do financeiro E o detalhamento da produção de cada
  // item consolidado (ver `descritivoConsolidado`): pode passar de dez linhas, e
  // com altura fixa o fornecedor recebia a OS com o serviço cortado ao meio.
  linha("Descritivo:", os.descritivo, {
    altura: Math.max(60, alturaParaLinhas(linhasVisuais(os.descritivo, LARGURA_VALOR))),
  });
  // "Entrega" saiu em 15/09/2026: repetia, em texto livre, o que o cronograma
  // abaixo já diz linha a linha e com data.

  const cron = os.cronogramaNaoSeAplica
    ? []
    : [...(os.cronograma ?? [])].sort((a, c) => (a.data || "").localeCompare(c.data || ""));
  const primeiraCronF = r;
  if (os.cronogramaNaoSeAplica) {
    linhaBlocos("Cronograma Específico do Fornecedor:", ["Não se aplica", "", "", ""]);
  } else if (!cron.length) {
    linhaBlocos("Cronograma Específico do Fornecedor:", ["—", "", "", ""]);
  } else {
    cron.forEach((c, i) =>
      linhaBlocos(
        "Cronograma Específico do Fornecedor:",
        [c.etapa || "Etapa", dataBR(c.data), c.horario || "", c.atividades || ""],
        { semRotulo: i > 0 }
      )
    );
  }
  agruparRotulo(primeiraCronF, r - 1);

  // Item marcado como "não se aplica" não vira linha na planilha (ver
  // `itensParaDocumento`); com nada aplicável, a seção inteira fica de fora.
  const logistica = itensParaDocumento(os.logistica, CAMPOS_LOGISTICA);
  if (logistica.length) {
    const primeiraLog = r;
    logistica.forEach(({ rotulo, valor }, i) =>
      linhaBlocos("Logística do Fornecedor:", [rotulo, valor || "", "", ""], { semRotulo: i > 0 })
    );
    agruparRotulo(primeiraLog, r - 1);
  }

  const infra = itensParaDocumento(os.infraestrutura, CAMPOS_INFRAESTRUTURA);
  if (infra.length) {
    const primeiraInf = r;
    infra.forEach(({ rotulo, valor }, i) =>
      linhaBlocos("Infraestrutura:", [rotulo, valor || "", "", ""], { semRotulo: i > 0 })
    );
    agruparRotulo(primeiraInf, r - 1);
  }

  // GRUPOS criados nesta OS, depois dos dois fixos (15/09/2026).
  for (const grupo of os.gruposExtras ?? []) {
    if (grupo.naoSeAplica) continue;
    const itens = grupo.itens.filter((i) => !i.naoSeAplica);
    if (!itens.length) continue;
    const primeira = r;
    itens.forEach(({ rotulo, valor }, i) =>
      linhaBlocos(`${grupo.nome || "Outros"}:`, [rotulo, valor || "", "", ""], { semRotulo: i > 0 })
    );
    agruparRotulo(primeira, r - 1);
  }

  // Só o campo LIVRE. A thread de `os.observacoes` é conversa interna da equipe
  // e saía impressa aqui — no documento que o fornecedor recebe.
  if (os.observacoesGeraisNaoSeAplica) {
    linha("Observações Gerais:", "Não se aplica", { altura: 20 });
  } else {
    linha("Observações Gerais:", os.observacoesGerais ?? "", {
      altura: Math.max(40, alturaParaLinhas(linhasVisuais(os.observacoesGerais ?? "", LARGURA_VALOR))),
    });
  }

  // O CREDENCIAMENTO saiu da OS (29/08/2026): virou subaba do Projeto, e o link
  // chega ao fornecedor por e-mail, disparado de lá para todos de uma vez.

  /* -------------------------- RESUMO DOS CUSTOS ------------------------ */
  // A tabela do que foi CONTRATADO: os itens da EC e, para cada um, o valor
  // definido no Detalhamento da Contratação. As formas que não foram usadas em
  // item nenhum não viram coluna — uma coluna inteira vazia não é informação
  // numa planilha que o fornecedor confere linha a linha.
  const orc = os.orcamento;
  const itens: EcLinha[] = (ec.linhas ?? []).filter((l) => (os.ecLinhaIds ?? []).includes(l.id));
  // `sincronizarContratacao` e não `os.itens` cru: OS gravada antes desta
  // revisão não tem contratação nenhuma, e sem isso a planilha sairia com a
  // tabela vazia. Item sem decisão vale o que a EC levantou — é dela que os
  // valores vêm, e é ela que a OS confirma ou renegocia.
  const resumo = resumoContratacao(sincronizarContratacao(os.itens ?? [], itens), itens);
  const colunas = COLUNAS_CONTRATACAO.filter((c) => resumo.colunas[c.chave]);
  secao("RESUMO DOS CUSTOS");

  if (!itens.length) {
    // OS antiga (ou avulsa): cai no consolidado que já existia na própria OS.
    linha("Valor com BV e NF:", orc.valorComBvNf, { money: true });
    linha("Valor Sem BV e Com Nota Fiscal:", orc.valorSemBvComNf, { money: true });
    linha("Valor Sem BV e Sem NF:", orc.valorSemBvSemNf, { money: true });
  } else {
    /** Célula vazia é "não se aplica" — resposta da produção, diferente de R$ 0,00. */
    const cel = (v: number | null) => (v === null ? "Não se aplica" : dinheiro(v));
    /** `linhaBlocos` tem quatro faixas fixas; as colunas que não saem ficam vazias. */
    const quatro = (item: string, valores: string[]): [string, string, string, string] =>
      [item, valores[0] ?? "", valores[1] ?? "", valores[2] ?? ""];
    const primeira = r;
    linhaBlocos(
      "Resumo dos Custos:",
      // "VALOR " + rótulo curto é o cabeçalho do modelo, palavra por palavra.
      quatro("ITEM", colunas.map((c) => `VALOR ${c.curto.toUpperCase()}`)),
      { forte: true }
    );
    for (const l of resumo.linhas) {
      linhaBlocos("", quatro(l.item, colunas.map((c) => cel(l[c.chave]))), { semRotulo: true });
    }
    linhaBlocos(
      "",
      quatro("TOTAL POR FORMA DE COBRANÇA", colunas.map((c) => dinheiro(resumo.totais[c.chave]))),
      { semRotulo: true, forte: true }
    );
    agruparRotulo(primeira, r - 1);
  }

  /* ------- Fechamento: o que vira nota fiscal e como se paga ----------- */
  // A emissão fala só das duas colunas COM nota; o "sem nota" sai separado,
  // para os dois não se lerem como um total só. Cada linha aparece quando há o
  // que dizer nela — OS sem nada faturado não anuncia um total de R$ 0,00.
  if (resumo.totalComNota > 0)
    linha("Total a Faturar — Com BV e NF + Sem BV e Com NF:", resumo.totalComNota, { money: true });
  if (resumo.totalSemNota > 0)
    linha("Total Sem Nota Fiscal — Sem BV e Sem NF:", resumo.totalSemNota, { money: true });
  linha("Documento Fiscal:", orc.documentoFiscal);

  const banco = os.fornecedor?.dadosBancarios;
  linhaBlocos("Dados para Pagamento:", [
    banco?.tipoConta ? `Conta ${banco.tipoConta}` : "Conta",
    banco?.banco || "",
    [banco?.agencia && `Ag. ${banco.agencia}`, banco?.conta && `C/C ${banco.conta}`].filter(Boolean).join("  ·  "),
    banco?.chavePix ? `Pix: ${banco.chavePix}` : "",
  ]);

  if (!orc.parcelas?.length) {
    linhaBlocos("Prazo de Pagamento:", ["Parcela única", "", "", ""]);
  } else {
    const primeiraParc = r;
    orc.parcelas.forEach((x, i) =>
      linhaBlocos(
        "Prazo de Pagamento:",
        [`${i + 1}ª — ${x.descricao || "Parcela"}`, dinheiro(x.valor || 0), "", ""],
        { semRotulo: i > 0 }
      )
    );
    agruparRotulo(primeiraParc, r - 1);
  }

  /* ----------- INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO --------- */
  if (incluirFinanceiro) {
    const fin = os.financeiro;
    secao("INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO DA PÓLOBH", "laranja");
    secao("DADOS EMISSÃO RECIBO SIMPLES | FATURA | NOTA FISCAL | FATURA E NOTA FISCAL");
    /*
     * Quem é o tomador vem do DOMÍNIO (15/09/2026).
     *
     * Esta era a quarta cópia da mesma regra — tela, OS impressa, contrato e
     * aqui —, e as quatro só conheciam "Pólobh" e "Cliente". Com MF e "Outro"
     * entrando, manter quatro cópias era garantir que uma delas ficasse para
     * trás. A lista de empresas chega por `opts.empresas`; sem ela, o valor
     * legado "Polobh" ainda resolve pela `empresaPolobh` de sempre.
     */
    const tom = dadosDoTomador(fin.tomador, {
      cliente: cli,
      empresas: opts.empresas ?? (emp ? [empresaComoGrupo(emp)] : []),
      avulso: fin.tomadorAvulso,
    });
    linha("Tomador dos Serviços:", tom?.rotulo ?? "");
    linha("Razão Social:", tom?.razaoSocial ?? "");
    linha("Endereço:", tom?.endereco ?? "");
    linha("CNPJ/CPF:", tom?.cnpjCpf ?? "");
    linha("Inscrição Estadual:", tom?.inscricaoEstadual ?? "");
    linha("Inscrição Municipal:", tom?.inscricaoMunicipal ?? "");

    const primeiraNf = linha("Descritivo Nota Fiscal:", fin.descritivoNf, { altura: 30 });
    linha("", `Dados do Projeto: ${p.titulo}`, { semRotulo: true });
    // Projeto incentivado: campos próprios da OS; OSs antigas caem no texto único da EC.
    // Só em projeto incentivado (cultural): corporativo não tem lei de incentivo.
    if (incentivada) {
      linha("", `Nome Projeto Incentivado: ${fin.projetoIncentivado || (p.incentivosFiscais ? p.incentivosFiscais : "")}`, { semRotulo: true });
      // A lei já vem com o número do projeto na mesma string — uma linha só.
      linha("", `Lei de Incentivo à Cultura: ${fin.leiIncentivo || p.incentivosFiscais || ""}`, { semRotulo: true });
    }
    const ultimaNf = linha("", `CNAE: ${fin.cnae || ""}`, { semRotulo: true });
    agruparRotulo(primeiraNf, ultimaNf);

    const primeiraVal = linha("Valor:", fin.valorUnitario, { money: true, rotuloInterno: "Valor unitário" });
    const rTotF = linha("", fin.valorTotal, { semRotulo: true, money: true, rotuloInterno: "Valor total" });
    const rDescF = linha("", fin.descontoNegociado, {
      semRotulo: true, money: true, rotuloInterno: "Desconto Especial Negociado",
    });
    // Fórmulas vivas: apontam para M, que é onde o número fica nestas linhas.
    const rPagarF = linha("", (fin.valorTotal || 0) - (fin.descontoNegociado || 0), {
      semRotulo: true, money: true, rotuloInterno: "Valor total a pagar", formula: `M${rTotF}-M${rDescF}`,
    });
    // O bloco de emissão TERMINA aqui, no valor a pagar: BV e acerto não são
    // dado de nota fiscal, e foram para a seção "Acertos Financeiros" no fim.
    agruparRotulo(primeiraVal, rPagarF);

    // Os VALORES sobem e os dois códigos descem (15/09/2026): é pelos valores
    // que se confere a nota, e os códigos são o último dado a se saber — o de
    // serviço e a ordem de compra nascem aqui e voltam para os itens da EC.
    linha("Forma de Pagamento:", fin.formaPagamento || "");
    linha("Código de Serviço:", fin.codigoServico || "");
    linha("Ordem de Compra:", fin.ordemCompra || "");

    // RETENÇÕES FISCAIS: o aviso que evita o retrabalho mais caro da OS. Com
    // altura própria, porque é um parágrafo — e é para ser lido.
    const textoRetencoes = fin.retencoesNaoSeAplica ? "Não se aplica" : fin.retencoes || RETENCOES_PADRAO;
    linha("Retenções Fiscais:", textoRetencoes, {
      altura: Math.max(40, alturaParaLinhas(linhasVisuais(textoRetencoes, LARGURA_VALOR))),
    });

    /* ------------------------- DADOS PARA CONTRATO --------------------- */
    // Sai da planilha inteiro quando a EC não pediu contrato para nenhum item
    // desta OS: descrever com valores e data um contrato que não existe é pior
    // do que não falar dele.
    const ct = os.contrato;
    if (temContrato(os, itens)) {
    // Mesma resolução do tomador, uma cópia a menos (ver acima).
    const contr = dadosDoTomador(ct.contratante, {
      cliente: cli,
      empresas: opts.empresas ?? (emp ? [empresaComoGrupo(emp)] : []),
    });
    secao("DADOS PARA CONTRATO");
    linha("Contratante:", contr?.rotulo ?? "");
    linha("Razão Social:", contr?.razaoSocial ?? "");
    linha("Endereço:", contr?.endereco ?? "");
    linha("CNPJ/CPF:", contr?.cnpjCpf ?? "");
    linha("Inscrição Estadual:", contr?.inscricaoEstadual ?? "");
    linha("Inscrição Municipal:", contr?.inscricaoMunicipal ?? "");

    const primeiraDesc = linha("Descritivo da Contratação:", textoObjetoContrato(fin, incentivada), { fixo: true, altura: 44 });
    linha("", `DESCRITIVO DOS SERVIÇOS E/OU PRODUTOS:\n${ct.descritivoServicos || fin.descritivoNf || os.descritivo}`, {
      semRotulo: true, altura: 44,
    });
    const ultimaDesc = linha("", ct.informacoesComplementares, { semRotulo: true });
    agruparRotulo(primeiraDesc, ultimaDesc);

    const primeiraValC = linha("Valor:", ct.valorUnitario, { money: true, rotuloInterno: "Valor unitário" });
    const rTotC = linha("", ct.valorTotal, { semRotulo: true, money: true, rotuloInterno: "Valor total" });
    const rDescC = linha("", ct.descontoNegociado, {
      semRotulo: true, money: true, rotuloInterno: "Desconto Especial Negociado",
    });
    const rPagarC = linha("", (ct.valorTotal || 0) - (ct.descontoNegociado || 0), {
      semRotulo: true, money: true, rotuloInterno: "Valor total a pagar", formula: `M${rTotC}-M${rDescC}`,
    });
    agruparRotulo(primeiraValC, rPagarC);

    // Editáveis na OS; o texto padrão do modelo entra só quando o campo está vazio.
    linha("Forma de Pagamento:", ct.formaPagamento || FORMA_PAGAMENTO_PADRAO, { fixo: !ct.formaPagamento });
    linha("Observações Gerais:", ct.observacoesGerais || OBS_CONTRATO_PADRAO, { fixo: !ct.observacoesGerais });
    linha("Data do Contrato:", dataBR(ct.dataContrato));
    linha("Rubrica:", ct.rubrica);
    }

    /* ------------------------ ACERTOS FINANCEIROS ---------------------- */
    // O que a Pólobh acerta por dentro — BV e as observações do acerto. Fica no
    // fim, depois de emissão e contrato, porque é consequência dos dois.
    secao("ACERTOS FINANCEIROS");
    // Os dois campos de BV saíram em 15/09/2026 (ele é combinado item a item, no
    // Detalhamento) e entrou a conta da devolução — ver `domain/acertoFinanceiro`.
    if (fin.acertoNaoSeAplica ?? true) {
      linha("Acerto Financeiro:", "Não se aplica");
    } else {
      const acerto = calcularAcerto(fin, os.orcamento, bvDaContratacao(os.itens ?? []).valor);
      linha("Valor original dos serviços:", acerto.valorOriginal, { money: true });
      linha("BV sobre o valor original:", acerto.bvSobreOriginal, { money: true });
      linha("Valor da NF:", acerto.valorNf, { money: true });
      linha("Valor do acréscimo:", acerto.acrescimo, { money: true });
      linha(`Encargos sobre o acréscimo (${acerto.encargosPercentual}%):`, acerto.encargosSobreAcrescimo, { money: true });
      linha("Valor devolução Pólobh:", acerto.devolucaoPolobh, { money: true });
    }
    linha("Observações:", fin.acertoFinanceiro);
  }

  ws.pageSetup.printArea = `A1:${FIM}${r - 1}`;

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: buffer as ArrayBuffer, nome: `${nomeArquivo(os.numero)}.xlsx` };
}

export async function gerarOsExcel(
  os: Os,
  ec: Ec,
  opts: { incluirFinanceiro?: boolean; empresaPolobh?: EmpresaEmissora; empresas?: EmpresaGrupo[] } = {}
): Promise<void> {
  const { buffer, nome } = await criarOsExcelBuffer(os, ec, opts);
  baixar(buffer, nome, ec.projetoId);
}
