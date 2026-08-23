/**
 * Geração da OS em Excel seguindo o "Modelo Novo" da Pólobh.
 * Layout em 2 colunas: RÓTULO | VALOR. As informações vêm automaticamente da EC
 * ou do que a equipe preencheu na criação da OS. (A coluna de "Observações" do
 * modelo servia só de guia para montar este gerador e NÃO é exportada.)
 */
import ExcelJS from "exceljs";
import type { Ec, Os } from "@/data/types";
import { dataBR } from "@/lib/format";
import { textoObjetoContrato, FORMA_PAGAMENTO_PADRAO, OBS_CONTRATO_PADRAO } from "@/domain/calc";
import { COR, fill, grade, baixar, nomeArquivo, carregarLogo, encaixarLogo } from "./shared";

const moeda = '"R$" #,##0.00';

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
  ws.getColumn(1).width = 34; // Rótulo
  ws.getColumn(2).width = 92; // Valor

  let r = 1;

  /* ------------------------------ helpers ------------------------------ */
  const secao = (txt: string) => {
    ws.mergeCells(`A${r}:B${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = txt;
    // Cinza das barras de seção do modelo original Pólobh (mesmo usado na EC),
    // com texto escuro. Tela e PDF seguem exatamente estas cores.
    c.font = { bold: true, size: 11, color: { argb: COR.ink } };
    c.fill = fill(COR.sectionGray);
    c.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(r).height = 22;
    r++;
  };

  const sub = (txt: string) => {
    ws.mergeCells(`A${r}:B${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = txt;
    c.font = { bold: true, size: 10, color: { argb: COR.ink } };
    c.fill = fill(COR.groupGray);
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = grade;
    r++;
  };

  const linha = (
    label: string,
    valor: string | number | null | undefined,
    o: { money?: boolean; fixo?: boolean; formula?: string; numFmt?: string } = {}
  ) => {
    const a = ws.getCell(`A${r}`);
    a.value = label;
    a.font = { bold: true, size: 10 };
    a.fill = fill(COR.rotuloGray);
    a.alignment = { vertical: "top", wrapText: true };
    a.border = grade;
    const b = ws.getCell(`B${r}`);
    b.value = o.formula
      ? ({ formula: o.formula, result: typeof valor === "number" ? valor : undefined } as ExcelJS.CellValue)
      : ((valor ?? "") as ExcelJS.CellValue);
    b.font = { size: 10, italic: !!o.fixo, color: { argb: COR.ink } };
    b.alignment = { wrapText: true, vertical: "top" };
    b.border = grade;
    if (o.money && typeof valor === "number") {
      b.numFmt = moeda;
      b.alignment = { vertical: "top", horizontal: "left" };
    }
    if (o.numFmt) b.numFmt = o.numFmt;
    r++;
  };

  /* ------------------------------ cabeçalho ---------------------------- */
  ws.mergeCells(`A${r}:B${r + 1}`);
  const tit = ws.getCell(`A${r}`);
  tit.value = "        Ordem de Serviço";
  tit.font = { name: "Calibri", size: 16, bold: true, color: { argb: COR.white } };
  tit.alignment = { vertical: "middle", horizontal: "center" };
  ["A", "B"].forEach((c) => {
    ws.getCell(`${c}${r}`).fill = fill(COR.headerGray);
    ws.getCell(`${c}${r + 1}`).fill = fill(COR.headerGray);
  });
  ws.getRow(r).height = 26;
  ws.getRow(r + 1).height = 26;
  const logo = await carregarLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo.buffer as unknown as ExcelJS.Buffer, extension: "png" });
    // Escala pela proporção real do PNG — tamanho fixo achatava a logo.
    // A caixa acompanha a faixa do cabeçalho (2 linhas de 26pt ≈ 69px) e a
    // largura da coluna de rótulos (34 unidades ≈ 243px), para a logo não sair
    // miúda como saía na caixa de 150x50.
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
  linha("Incentivos Fiscais:", p.incentivosFiscais);
  linha("Data:", dataBR(p.evento));
  linha("Horário:", p.horario);
  linha("Local:", p.local);
  linha("Nº Participantes:", p.participantes ?? "");
  linha("Endereço do Local:", p.enderecoLocal);
  linha("Produtora Responsável:", p.produtoraResponsavel);
  linha("Telefone:", p.telefoneProdutora);
  linha("E-mail:", p.emailProdutora);

  /* -------------------------- DADOS DO FORNECEDOR ---------------------- */
  const f = os.fornecedor;
  const bnc = f.dadosBancarios;
  secao("DADOS DO FORNECEDOR");
  linha("Fornecedor:", f.nomeFantasia || f.razaoSocial);
  linha("CNPJ/CPF:", f.cnpj);
  linha("Perfil (MEI / Simples / etc.):", f.perfilTributario);
  linha("Razão Social:", f.razaoSocial);
  linha("Endereço:", f.endereco);
  linha("Inscrição Estadual:", f.inscricaoEstadual);
  linha("Inscrição Municipal:", f.inscricaoMunicipal);
  linha("Conta PJ / PF:", bnc.tipoConta);
  linha("Banco:", bnc.banco);
  linha("Agência:", bnc.agencia);
  linha("Conta Corrente:", bnc.conta);
  linha("Chave Pix:", bnc.chavePix);
  linha("Representante:", f.representante);
  linha("Telefone:", f.telefone);
  linha("E-mail:", f.email);

  /* --------------------- DETALHAMENTO DA CONTRATAÇÃO ------------------- */
  secao("DETALHAMENTO DA CONTRATAÇÃO");
  linha("Modalidade:", os.modalidade);
  linha("Descritivo:", os.descritivo);
  linha("Entrega:", os.entrega);
  const cron = [...os.cronograma].sort((a, c) => (a.data || "").localeCompare(c.data || ""));
  if (cron.length === 0) {
    linha("Cronograma do Fornecedor:", "Sem etapas cadastradas.", { fixo: true });
  } else {
    cron.forEach((c, i) =>
      linha(
        i === 0 ? "Cronograma do Fornecedor:" : "",
        `${c.etapa || "Etapa"}  —  ${dataBR(c.data)}${c.horario ? "  ·  " + c.horario : ""}${c.atividades ? "  ·  " + c.atividades : ""}`
      )
    );
  }
  const lg = os.logistica;
  ([
    ["Transporte Material", lg.transporteMaterial],
    ["Transporte Equipe", lg.transporteEquipe],
    ["Hospedagem Equipe", lg.hospedagem],
    ["Alimentação Equipe", lg.alimentacao],
    ["Estacionamento Carga", lg.estacionamentoCarga],
    ["Estacionamento Equipe", lg.estacionamentoEquipe],
    ["Uniformização Equipe", lg.uniformizacao],
  ] as [string, string][]).forEach(([nome, val], i) =>
    linha(i === 0 ? "Logística do Fornecedor:" : "", `${nome}: ${val || "____"}`)
  );
  const inf = os.infraestrutura;
  ([
    ["Energia", inf.energia],
    ["Internet", inf.internet],
    ["Pontos Elétricos", inf.pontosEletricos],
    ["Estruturas Diversas", inf.estruturas],
    ["Serviços de Apoio", inf.servicosApoio],
    ["ART, Laudos e Certificações", inf.artLaudos],
  ] as [string, string][]).forEach(([nome, val], i) =>
    linha(i === 0 ? "Infraestrutura:" : "", `${nome}: ${val || "____"}`)
  );
  const obsTexto = (os.observacoes ?? [])
    .filter((o) => o.texto.trim())
    .map((o) => `${o.texto}${o.autorNome ? " — " + o.autorNome : ""}${o.resolvida ? " (resolvida)" : ""}`)
    .join("\n");
  linha("Observações Gerais:", obsTexto);

  /* ---------------------------- CREDENCIAMENTO ------------------------- */
  secao("CREDENCIAMENTO");
  linha("Formulário de Credenciamento:", os.credenciamento.linkFormulario || "Link gerado ao salvar/disparar a OS");
  linha("Prazo Limite:", dataBR(os.credenciamento.prazoLimite));

  /* ------------------------------ ORÇAMENTO ---------------------------- */
  const orc = os.orcamento;
  secao("ORÇAMENTO");
  linha("Valor do Item na EC do Projeto:", orc.valorEc, { money: true });
  linha("Valor com BV e NF:", orc.valorComBvNf, { money: true });
  linha("Valor Sem BV e Com Nota Fiscal:", orc.valorSemBvComNf, { money: true });
  linha("Valor Sem BV e Sem NF:", orc.valorSemBvSemNf, { money: true });
  if (orc.parcelas.length === 0) {
    linha("Prazo de Pagamento (parcelas):", "____");
  } else {
    orc.parcelas.forEach((x, i) =>
      linha(
        i === 0 ? "Prazo de Pagamento (parcelas):" : "",
        `${i + 1}ª — ${x.descricao || "Parcela"}: R$ ${(x.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      )
    );
  }
  linha("Documento Fiscal:", orc.documentoFiscal);

  /* ----------- INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO --------- */
  if (incluirFinanceiro) {
    const fin = os.financeiro;
    secao("INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO DA PÓLOBH");
    sub("DADOS EMISSÃO — RECIBO SIMPLES | FATURA | NOTA FISCAL | FATURA E NOTA FISCAL");
    const tomadorLabel =
      fin.tomador === "Polobh"
        ? emp?.nome
          ? `Pólobh — ${emp.nome}`
          : "Pólobh"
        : fin.tomador === "Cliente"
          ? "Cliente"
          : "";
    linha("Tomador dos Serviços:", tomadorLabel);
    // dados fiscais: do cliente (via EC) ou da empresa do grupo Pólobh (Configurações)
    const tom =
      fin.tomador === "Cliente"
        ? { razao: cli.razaoSocial, end: cli.endereco, doc: cli.cnpjCpf, ie: cli.inscricaoEstadual, im: cli.inscricaoMunicipal }
        : fin.tomador === "Polobh" && emp
          ? { razao: emp.razaoSocial, end: emp.endereco, doc: emp.cnpj, ie: emp.inscricaoEstadual, im: emp.inscricaoMunicipal }
          : null;
    linha("Razão Social:", tom?.razao ?? "");
    linha("Endereço:", tom?.end ?? "");
    linha("CNPJ/CPF:", tom?.doc ?? "");
    linha("Inscrição Estadual:", tom?.ie ?? "");
    linha("Inscrição Municipal:", tom?.im ?? "");
    linha("Descritivo Nota Fiscal:", fin.descritivoNf);
    // Projeto incentivado: usa os campos da OS; OSs antigas caem no texto único da EC.
    if (fin.projetoIncentivado || fin.leiIncentivo || fin.numeroProjetoIncentivado) {
      linha("Nome do Projeto Incentivado:", fin.projetoIncentivado);
      linha("Lei de Incentivo à Cultura:", fin.leiIncentivo);
      linha("Nº do Projeto Incentivado:", fin.numeroProjetoIncentivado);
    } else if (p.incentivosFiscais) {
      linha("Nome do Projeto Incentivado / Lei / Nº:", p.incentivosFiscais);
    }
    linha("CNAE:", fin.cnae);
    linha("Código de Serviço:", fin.codigoServico);
    linha("Valor unitário:", fin.valorUnitario, { money: true });
    const rTotF = r;
    linha("Valor total:", fin.valorTotal, { money: true });
    const rDescF = r;
    linha("Desconto Especial Negociado:", fin.descontoNegociado, { money: true });
    // fórmulas vivas: recalculam se a planilha for editada no Excel
    linha("Valor total a pagar:", (fin.valorTotal || 0) - (fin.descontoNegociado || 0), {
      money: true, formula: `B${rTotF}-B${rDescF}`,
    });
    const rPctF = r;
    linha("BV Pólobh — Percentual:", fin.bvPercentual ?? 0, { numFmt: '0.##"%"' });
    linha("BV Pólobh — Valor:", ((fin.valorTotal || 0) * (fin.bvPercentual || 0)) / 100, {
      money: true, formula: `B${rTotF}*B${rPctF}/100`,
    });
    linha("Acerto Financeiro:", fin.acertoFinanceiro);

    /* ------------------------- DADOS PARA CONTRATO --------------------- */
    const ct = os.contrato;
    const contr =
      ct.contratante === "Cliente"
        ? { razao: cli.razaoSocial, end: cli.endereco, doc: cli.cnpjCpf, ie: cli.inscricaoEstadual, im: cli.inscricaoMunicipal }
        : ct.contratante === "Polobh" && emp
          ? { razao: emp.razaoSocial, end: emp.endereco, doc: emp.cnpj, ie: emp.inscricaoEstadual, im: emp.inscricaoMunicipal }
          : null;
    sub("DADOS PARA CONTRATO");
    linha(
      "Contratante:",
      ct.contratante === "Polobh" ? (emp?.nome ? `Pólobh — ${emp.nome}` : "Pólobh") : ct.contratante === "Cliente" ? "Cliente" : ""
    );
    linha("Razão Social:", contr?.razao ?? "");
    linha("Endereço:", contr?.end ?? "");
    linha("CNPJ/CPF:", contr?.doc ?? "");
    linha("Inscrição Estadual:", contr?.ie ?? "");
    linha("Inscrição Municipal:", contr?.im ?? "");
    linha("Objeto do Contrato:", textoObjetoContrato(fin), { fixo: true });
    linha("Descritivo dos Serviços e/ou Produtos:", ct.descritivoServicos || fin.descritivoNf || os.descritivo);
    linha("Informações Complementares:", ct.informacoesComplementares);
    linha("Valor unitário:", ct.valorUnitario, { money: true });
    const rTotC = r;
    linha("Valor total:", ct.valorTotal, { money: true });
    const rDescC = r;
    linha("Desconto Especial Negociado:", ct.descontoNegociado, { money: true });
    linha("Valor total a pagar:", (ct.valorTotal || 0) - (ct.descontoNegociado || 0), {
      money: true, formula: `B${rTotC}-B${rDescC}`,
    });
    // Editáveis na OS; o texto padrão do modelo entra só quando o campo está vazio.
    linha("Forma de Pagamento:", ct.formaPagamento || FORMA_PAGAMENTO_PADRAO, { fixo: !ct.formaPagamento });
    linha("Observações Gerais:", ct.observacoesGerais || OBS_CONTRATO_PADRAO, { fixo: !ct.observacoesGerais });
    linha("Data do Contrato:", dataBR(ct.dataContrato));
    linha("Rubrica:", ct.rubrica);
  }

  ws.pageSetup.printArea = `A1:B${r - 1}`;

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
