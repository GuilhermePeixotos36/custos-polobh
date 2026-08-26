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
import type { Ec, EcLinha, Os } from "@/data/types";
import { dataBR } from "@/lib/format";
import {
  textoObjetoContrato, FORMA_PAGAMENTO_PADRAO, OBS_CONTRATO_PADRAO,
  opcaoEscolhidaDoItem, valorItemNaEc,
} from "@/domain/calc";
import { ETAPAS_CRONOGRAMA } from "@/domain/projeto";
import { urlCredenciamento } from "@/lib/links";
import { COR, fill, FONT_LIGHT, baixar, nomeArquivo, carregarLogo, encaixarLogo } from "./shared";

const moeda = '"R$" #,##0.00';
const PT = 11;
/** Última coluna da faixa de valores — o modelo vai de B até O. */
const FIM = "O";
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

/** Monta o buffer da OS em Excel sem baixar (usado no download normal e no anexo de e-mail). */
export async function criarOsExcelBuffer(
  os: Os,
  ec: Ec,
  opts: { incluirFinanceiro?: boolean; empresaPolobh?: EmpresaEmissora } = {}
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
  const linhaBlocos = (rotulo: string, blocos: [string, string, string, string], o: { semRotulo?: boolean } = {}) => {
    const a = ws.getCell(`A${r}`);
    if (!o.semRotulo) a.value = rotulo;
    estiloRotulo(a);
    const faixas: [string, string][] = [["B", "D"], ["E", "I"], ["J", "L"], ["M", FIM]];
    faixas.forEach(([ini, fim], i) => {
      ws.mergeCells(`${ini}${r}:${fim}${r}`);
      const c = ws.getCell(`${ini}${r}`);
      c.value = blocos[i];
      // A primeira faixa nomeia a etapa: no modelo ela vem em negrito.
      c.font = { name: FONT_LIGHT, bold: i === 0, size: PT, color: { argb: COR.ink } };
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
  linha("Projeto:", ec.projeto.titulo);
  linha("Data de emissão:", dataBR(new Date().toISOString()));
  linha("Status da OS:", os.status);

  /* --------------------------- DADOS DO CLIENTE ------------------------ */
  const cli = ec.cliente;
  secao("DADOS DO CLIENTE");
  linha("Cliente:", cli.nome);
  linha("Razão Social:", cli.razaoSocial);
  linha("Endereço:", cli.endereco);
  linha("CNPJ/CPF:", cli.cnpjCpf);
  linha("Inscrição Estadual:", cli.inscricaoEstadual);
  linha("Inscrição Municipal:", cli.inscricaoMunicipal);

  /* --------------------------- DADOS DO PROJETO ------------------------ */
  const p = ec.projeto;
  secao("DADOS DO PROJETO");
  linha("Título:", p.titulo);
  linha("Modalidade:", p.modalidade);
  linha("Incentivos Fiscais:", p.incentivosFiscais);
  linha("Data:", dataBR(p.evento));
  linha("Horário:", p.horario);
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
  linha("Descritivo:", os.descritivo, { altura: 60 });
  linha("Entrega:", os.entrega, { altura: 40 });

  const cron = [...(os.cronograma ?? [])].sort((a, c) => (a.data || "").localeCompare(c.data || ""));
  const primeiraCronF = r;
  if (!cron.length) {
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

  const lg = os.logistica;
  const logistica: [string, string][] = [
    ["Transporte Material", lg.transporteMaterial],
    ["Transporte Equipe", lg.transporteEquipe],
    ["Hospedagem Equipe", lg.hospedagem],
    ["Alimentação Equipe", lg.alimentacao],
    ["Estacionamento Carga", lg.estacionamentoCarga],
    ["Estacionamento Equipe", lg.estacionamentoEquipe],
    ["Uniformização Equipe", lg.uniformizacao],
  ];
  const primeiraLog = r;
  logistica.forEach(([nome, val], i) =>
    linhaBlocos("Logística do Fornecedor:", [nome, val || "", "", ""], { semRotulo: i > 0 })
  );
  agruparRotulo(primeiraLog, r - 1);

  const inf = os.infraestrutura;
  const infra: [string, string][] = [
    ["Energia", inf.energia],
    ["Internet", inf.internet],
    ["Pontos Elétricos", inf.pontosEletricos],
    ["Estruturas Diversas", inf.estruturas],
    ["Serviços de Apoio", inf.servicosApoio],
    ["ART, Laudos e Certificações", inf.artLaudos],
  ];
  const primeiraInf = r;
  infra.forEach(([nome, val], i) => linhaBlocos("Infraestrutura:", [nome, val || "", "", ""], { semRotulo: i > 0 }));
  agruparRotulo(primeiraInf, r - 1);

  const obsTexto = (os.observacoes ?? [])
    .filter((o) => o.texto.trim())
    .map((o) => `${o.texto}${o.autorNome ? " — " + o.autorNome : ""}${o.resolvida ? " (resolvida)" : ""}`)
    .join("\n");
  linha("Observações Gerais:", obsTexto, { altura: 40 });

  /* ---------------------------- CREDENCIAMENTO ------------------------- */
  secao("CREDENCIAMENTO");
  linha(
    "Favor acessar o link abaixo e preencher o formulário de credenciamento com os dados de todos os profissionais e veículos de sua equipe.",
    urlCredenciamento(os) || "O link é gerado ao salvar a OS.",
    { altura: 42 }
  );
  linha("Prazo Limite para o Credenciamento:", dataBR(os.credenciamento.prazoLimite));

  /* ------------------------------ ORÇAMENTO ---------------------------- */
  // Item a item: o valor do item na EC e, logo abaixo, a opção escolhida para
  // ele. É esta a leitura que a Pólobh faz na hora de pagar o fornecedor.
  const orc = os.orcamento;
  const itens: EcLinha[] = (ec.linhas ?? []).filter((l) => (os.ecLinhaIds ?? []).includes(l.id));
  secao("ORÇAMENTO");
  if (!itens.length) {
    // OS antiga (ou avulsa): cai no consolidado que já existia na própria OS.
    linha("Valor do Item na EC do Projeto:", orc.valorEc, { money: true });
    linha("Valor com BV e NF:", orc.valorComBvNf, { money: true });
    linha("Valor Sem BV e Com Nota Fiscal:", orc.valorSemBvComNf, { money: true });
    linha("Valor Sem BV e Sem NF:", orc.valorSemBvSemNf, { money: true });
  } else {
    for (const item of itens) {
      // Nome do item como faixa, para separar um bloco do outro.
      ws.mergeCells(`A${r}:${FIM}${r}`);
      const cab = ws.getCell(`A${r}`);
      cab.value = item.item || item.descricao || "Item";
      cab.font = { name: FONT_LIGHT, bold: true, size: PT, color: { argb: COR.ink } };
      cab.fill = fill(COR.groupGray);
      cab.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      for (const col of COLS) ws.getCell(`${col}${r}`).border = linhaFina;
      ws.getRow(r).height = 16.5;
      r++;
      linha("Valor do Item na EC do Projeto:", valorItemNaEc(item), { money: true });
      const escolha = opcaoEscolhidaDoItem(item);
      if (escolha) linha(`${escolha.rotulo}:`, escolha.valor, { money: true });
      else linha("Opção de valor:", "A produção ainda não escolheu a forma de cobrança deste item.", { fixo: true });
    }
    // Fechamento do bloco: o que a OS soma das opções escolhidas.
    const somaEscolhida = itens.reduce((s, i) => s + (opcaoEscolhidaDoItem(i)?.valor ?? 0), 0);
    linha("Total das opções escolhidas:", somaEscolhida, { money: true });
  }

  if (!orc.parcelas?.length) {
    linhaBlocos("Prazo de Pagamento:", ["Parcela única", "", "", ""]);
  } else {
    const primeiraParc = r;
    orc.parcelas.forEach((x, i) =>
      linhaBlocos(
        "Prazo de Pagamento:",
        [
          `${i + 1}ª — ${x.descricao || "Parcela"}`,
          `R$ ${(x.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          "",
          "",
        ],
        { semRotulo: i > 0 }
      )
    );
    agruparRotulo(primeiraParc, r - 1);
  }
  linha("Documento Fiscal:", orc.documentoFiscal);

  /* ----------- INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO --------- */
  if (incluirFinanceiro) {
    const fin = os.financeiro;
    secao("INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO DA PÓLOBH", "laranja");
    secao("DADOS EMISSÃO RECIBO SIMPLES | FATURA | NOTA FISCAL | FATURA E NOTA FISCAL");
    const nomePolobh = emp?.nome ? `Pólobh — ${emp.nome}` : "Pólobh";
    // Dados fiscais: do cliente (via EC) ou da empresa do grupo Pólobh (Configurações).
    const tom =
      fin.tomador === "Cliente"
        ? { nome: cli.nome || "Cliente", razao: cli.razaoSocial, end: cli.endereco, doc: cli.cnpjCpf, ie: cli.inscricaoEstadual, im: cli.inscricaoMunicipal }
        : fin.tomador === "Polobh" && emp
          ? { nome: nomePolobh, razao: emp.razaoSocial, end: emp.endereco, doc: emp.cnpj, ie: emp.inscricaoEstadual, im: emp.inscricaoMunicipal }
          : null;
    linha("Tomador dos Serviços:", fin.tomador === "Polobh" ? nomePolobh : fin.tomador === "Cliente" ? "Cliente" : "");
    linha("Cliente ou Pólobh:", tom?.nome ?? "");
    linha("Razão Social:", tom?.razao ?? "");
    linha("Endereço:", tom?.end ?? "");
    linha("CNPJ/CPF:", tom?.doc ?? "");
    linha("Inscrição Estadual:", tom?.ie ?? "");
    linha("Inscrição Municipal:", tom?.im ?? "");

    const primeiraNf = linha("Descritivo Nota Fiscal:", fin.descritivoNf, { altura: 30 });
    linha("", `Dados do Projeto: ${p.titulo}`, { semRotulo: true });
    // Projeto incentivado: campos próprios da OS; OSs antigas caem no texto único da EC.
    linha("", `Nome Projeto Incentivado: ${fin.projetoIncentivado || (p.incentivosFiscais ? p.incentivosFiscais : "")}`, { semRotulo: true });
    linha("", `Lei de Incentivo à Cultura: ${fin.leiIncentivo || ""}`, { semRotulo: true });
    linha("", `Nº Projeto Incentivado: ${fin.numeroProjetoIncentivado || ""}`, { semRotulo: true });
    linha("", `CNAE: ${fin.cnae || ""}`, { semRotulo: true });
    const ultimaNf = linha("", `Código de Serviço: ${fin.codigoServico || ""}`, { semRotulo: true });
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
    agruparRotulo(primeiraVal, rPagarF);

    const rPctF = linha("BV Pólobh:", fin.bvPercentual ?? 0, { numFmt: '0.##"%"', rotuloInterno: "Percentual" });
    const rBvF = linha("", ((fin.valorTotal || 0) * (fin.bvPercentual || 0)) / 100, {
      semRotulo: true, money: true, rotuloInterno: "Valor", formula: `M${rTotF}*M${rPctF}/100`,
    });
    agruparRotulo(rPctF, rBvF);
    linha("Acerto Financeiro:", fin.acertoFinanceiro);

    /* ------------------------- DADOS PARA CONTRATO --------------------- */
    const ct = os.contrato;
    const contr =
      ct.contratante === "Cliente"
        ? { nome: cli.nome || "Cliente", razao: cli.razaoSocial, end: cli.endereco, doc: cli.cnpjCpf, ie: cli.inscricaoEstadual, im: cli.inscricaoMunicipal }
        : ct.contratante === "Polobh" && emp
          ? { nome: nomePolobh, razao: emp.razaoSocial, end: emp.endereco, doc: emp.cnpj, ie: emp.inscricaoEstadual, im: emp.inscricaoMunicipal }
          : null;
    secao("DADOS PARA CONTRATO");
    linha("Contratante:", ct.contratante === "Polobh" ? nomePolobh : ct.contratante === "Cliente" ? "Cliente" : "");
    linha("Cliente ou Pólobh:", contr?.nome ?? "");
    linha("Razão Social:", contr?.razao ?? "");
    linha("Endereço:", contr?.end ?? "");
    linha("CNPJ/CPF:", contr?.doc ?? "");
    linha("Inscrição Estadual:", contr?.ie ?? "");
    linha("Inscrição Municipal:", contr?.im ?? "");

    const primeiraDesc = linha("Descritivo da Contratação:", textoObjetoContrato(fin), { fixo: true, altura: 44 });
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

  ws.pageSetup.printArea = `A1:${FIM}${r - 1}`;

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: buffer as ArrayBuffer, nome: `${nomeArquivo(os.numero)}.xlsx` };
}

export async function gerarOsExcel(
  os: Os,
  ec: Ec,
  opts: { incluirFinanceiro?: boolean; empresaPolobh?: EmpresaEmissora } = {}
): Promise<void> {
  const { buffer, nome } = await criarOsExcelBuffer(os, ec, opts);
  baixar(buffer, nome);
}
