/**
 * Geração da OS em Excel seguindo o "Modelo Novo" da Pólobh.
 * Estrutura em 3 colunas: RÓTULO | VALOR | OBSERVAÇÕES. A coluna de observações
 * (vermelha) documenta a ORIGEM de cada campo — se vem automaticamente da EC, se
 * é preenchido pela equipe, se é lista de opções, ou se é preenchido pelo CNPJ.
 * As seções e rótulos espelham o modelo enviado pela Pólobh.
 */
import ExcelJS from "exceljs";
import type { Ec, Os } from "@/data/types";
import { dataBR } from "@/lib/format";
import { COR, fill, thin, baixar, nomeArquivo, carregarLogo } from "./shared";

const moeda = '"R$" #,##0.00';
const VERMELHO = "FFC00000";
const CINZA = "FFD9D9D9";

// Textos padrão da coluna de observações (origem da informação).
const OBS = {
  ec: "Informação vem automaticamente da EC",
  equipe: "Preenchida pela equipe",
  lista: "Preenchida pela equipe a partir de uma lista de opções",
  listaMem: "Lista de opções que o sistema vai acumulando (memórias da Pólobh)",
  cnpj: "Preenchida automaticamente pelo sistema pelo Nº do CNPJ",
  auto: "Preenchida automaticamente pelo sistema",
  fixo: "Texto fixo.",
};

export async function gerarOsExcel(
  os: Os,
  ec: Ec,
  opts: { incluirFinanceiro?: boolean } = {}
): Promise<void> {
  const incluirFinanceiro = opts.incluirFinanceiro ?? true;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("OS", {
    pageSetup: {
      paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 34; // Rótulo
  ws.getColumn(2).width = 74; // Valor
  ws.getColumn(3).width = 60; // Observações

  let r = 1;

  /* ------------------------------ helpers ------------------------------ */
  const secao = (txt: string) => {
    ws.mergeCells(`A${r}:B${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = txt;
    c.font = { bold: true, size: 11, color: { argb: COR.white } };
    c.fill = fill(COR.black);
    c.alignment = { vertical: "middle", horizontal: "center" };
    const o = ws.getCell(`C${r}`);
    o.value = "OBSERVAÇÕES";
    o.font = { bold: true, size: 10, color: { argb: VERMELHO } };
    o.fill = fill(CINZA);
    o.alignment = { vertical: "middle", horizontal: "center" };
    o.border = thin;
    ws.getRow(r).height = 22;
    r++;
  };

  // Sub-cabeçalho cinza (ex.: "DADOS EMISSÃO NF", "DADOS PARA CONTRATO").
  const sub = (txt: string, obs?: string) => {
    ws.mergeCells(`A${r}:B${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = txt;
    c.font = { bold: true, size: 10, color: { argb: COR.ink } };
    c.fill = fill(CINZA);
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = thin;
    if (obs) obsCell(obs);
    else ws.getCell(`C${r}`).border = thin;
    r++;
  };

  const obsCell = (obs: string) => {
    const o = ws.getCell(`C${r}`);
    o.value = obs;
    o.font = { size: 9, italic: true, color: { argb: VERMELHO } };
    o.alignment = { wrapText: true, vertical: "top" };
    o.border = thin;
  };

  const linha = (
    label: string,
    valor: string | number | null | undefined,
    obs: string,
    o: { money?: boolean; fixo?: boolean } = {}
  ) => {
    const a = ws.getCell(`A${r}`);
    a.value = label;
    a.font = { bold: true, size: 10 };
    a.fill = fill(COR.soft);
    a.alignment = { vertical: "top", wrapText: true };
    a.border = thin;
    const b = ws.getCell(`B${r}`);
    b.value = (valor ?? "") as ExcelJS.CellValue;
    // texto fixo/exemplo em preto normal; valores preenchidos em preto também.
    b.font = { size: 10, italic: !!o.fixo, color: { argb: COR.ink } };
    b.alignment = { wrapText: true, vertical: "top" };
    b.border = thin;
    if (o.money && typeof valor === "number") {
      b.numFmt = moeda;
      b.alignment = { vertical: "top", horizontal: "left" };
    }
    obsCell(obs);
    r++;
  };

  /* ------------------------------ cabeçalho ---------------------------- */
  ws.mergeCells(`A${r}:B${r + 1}`);
  const tit = ws.getCell(`A${r}`);
  tit.value = "     Ordem de Serviço";
  tit.font = { name: "Calibri", size: 16, bold: true, color: { argb: COR.white } };
  tit.alignment = { vertical: "middle", horizontal: "center" };
  ["A", "B", "C"].forEach((c) => {
    ws.getCell(`${c}${r}`).fill = fill(COR.black);
    ws.getCell(`${c}${r + 1}`).fill = fill(COR.black);
  });
  ws.mergeCells(`C${r}:C${r + 1}`);
  const sub0 = ws.getCell(`C${r}`);
  sub0.value = `${os.numero}\n${ec.projeto.titulo}`;
  sub0.font = { size: 10, color: { argb: COR.white } };
  sub0.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(r).height = 24;
  ws.getRow(r + 1).height = 24;
  const logo = await carregarLogo();
  if (logo) {
    const id = wb.addImage({ buffer: logo as ArrayBuffer, extension: "png" });
    ws.addImage(id, { tl: { col: 0.15, row: r - 0.9 }, ext: { width: 120, height: 52 } });
  }
  r += 2;
  linha("Data de emissão:", dataBR(new Date().toISOString()), OBS.auto);
  linha("Status da OS:", os.status, OBS.auto);

  /* --------------------------- DADOS DO CLIENTE ------------------------ */
  const cli = ec.cliente;
  secao("DADOS DO CLIENTE");
  linha("Cliente:", cli.nome, OBS.ec);
  linha("Razão Social:", cli.razaoSocial, OBS.ec);
  linha("Endereço:", cli.endereco, OBS.ec);
  linha("CNPJ/CPF:", cli.cnpjCpf, OBS.ec);
  linha("Inscrição Estadual:", cli.inscricaoEstadual, OBS.ec);
  linha("Inscrição Municipal:", cli.inscricaoMunicipal, OBS.ec);

  /* --------------------------- DADOS DO PROJETO ------------------------ */
  const p = ec.projeto;
  secao("DADOS DO PROJETO");
  linha("Título:", p.titulo, OBS.ec);
  linha("Modalidade:", "", OBS.lista);
  linha("Incentivos Fiscais:", p.incentivosFiscais, OBS.ec);
  linha("Data:", dataBR(p.evento), OBS.ec);
  linha("Horário:", p.horario, OBS.ec);
  linha("Local:", p.local, OBS.ec);
  linha("Nº Participantes:", p.participantes ?? "", OBS.ec);
  linha("Endereço do Local:", p.enderecoLocal, OBS.ec);
  linha("Produtora Responsável:", p.produtoraResponsavel, OBS.ec);
  linha("Telefone:", p.telefoneProdutora, OBS.ec);
  linha("E-mail:", p.emailProdutora, OBS.ec);
  // Cronograma geral do projeto (etapas fixas — datas/horários preenchidos pela equipe)
  for (const etapa of ["Montagem", "Alinhamentos Técnicos / Testes", "Ensaios / Passagem de Som", "Evento", "Desmontagem"]) {
    linha("Cronograma:", `${etapa}  —  Data: ____  ·  Horário: ____`, OBS.equipe);
  }

  /* -------------------------- DADOS DO FORNECEDOR ---------------------- */
  const f = os.fornecedor;
  const bnc = f.dadosBancarios;
  secao("DADOS DO FORNECEDOR");
  linha("Fornecedor:", f.nomeFantasia || f.razaoSocial, OBS.equipe);
  linha("CNPJ/CPF:", f.cnpj, OBS.equipe);
  linha("Perfil (MEI / Simples / etc.):", f.perfilTributario, OBS.cnpj);
  linha("Razão Social:", f.razaoSocial, OBS.cnpj);
  linha("Endereço:", f.endereco, OBS.cnpj);
  linha("Inscrição Estadual:", f.inscricaoEstadual, OBS.cnpj);
  linha("Inscrição Municipal:", f.inscricaoMunicipal, OBS.cnpj);
  linha("Dados Bancários — Conta PJ/PF:", bnc.tipoConta, OBS.equipe);
  linha("Banco:", bnc.banco, OBS.equipe);
  linha("Agência:", bnc.agencia, OBS.equipe);
  linha("Conta Corrente:", bnc.conta, OBS.equipe);
  linha("Chave Pix:", bnc.chavePix, OBS.equipe);
  linha("Representante:", f.representante, OBS.equipe);
  linha("Telefone:", f.telefone, OBS.equipe);
  linha("E-mail:", f.email, OBS.equipe);

  /* --------------------- DETALHAMENTO DA CONTRATAÇÃO ------------------- */
  secao("DETALHAMENTO DA CONTRATAÇÃO");
  linha("Modalidade:", os.modalidade, `${OBS.lista} • Produto • Serviço • Locação • Produto + Serviço • Locação + Serviço`);
  linha("Descritivo:", os.descritivo, `${OBS.ec} (descritivo, quantidades, especificações técnicas, relação de equipe)`);
  linha("Entrega:", os.entrega, `${OBS.equipe} (instalação • operação • acompanhamento técnico)`);
  // Cronograma específico do fornecedor (preenchido pela equipe)
  const cron = [...os.cronograma].sort((a, c) => (a.data || "").localeCompare(c.data || ""));
  if (cron.length === 0) {
    linha("Cronograma do Fornecedor:", "Sem etapas cadastradas.", OBS.equipe, { fixo: true });
  } else {
    cron.forEach((c, i) =>
      linha(
        i === 0 ? "Cronograma do Fornecedor:" : "",
        `${c.etapa || "Etapa"}  —  ${dataBR(c.data)}${c.horario ? "  ·  " + c.horario : ""}${c.atividades ? "  ·  " + c.atividades : ""}`,
        i === 0 ? "Preenchida pela equipe. O sistema gera a planilha de cronograma de todos os fornecedores e envia lembrete 2 dias úteis antes." : ""
      )
    );
  }
  // Logística do fornecedor
  const lg = os.logistica;
  const logItens: [string, string][] = [
    ["Transporte Material", lg.transporteMaterial],
    ["Transporte Equipe", lg.transporteEquipe],
    ["Hospedagem Equipe", lg.hospedagem],
    ["Alimentação Equipe", lg.alimentacao],
    ["Estacionamento Carga", lg.estacionamentoCarga],
    ["Estacionamento Equipe", lg.estacionamentoEquipe],
    ["Uniformização Equipe", lg.uniformizacao],
  ];
  logItens.forEach(([nome, val], i) =>
    linha(i === 0 ? "Logística do Fornecedor:" : "", `${nome}: ${val || "____"}`, i === 0 ? OBS.lista : "")
  );
  // Infraestrutura
  const inf = os.infraestrutura;
  const infItens: [string, string][] = [
    ["Energia", inf.energia],
    ["Internet", inf.internet],
    ["Pontos Elétricos", inf.pontosEletricos],
    ["Estruturas Diversas", inf.estruturas],
    ["Serviços de Apoio", inf.servicosApoio],
    ["ART, Laudos e Certificações", inf.artLaudos],
  ];
  infItens.forEach(([nome, val], i) =>
    linha(i === 0 ? "Infraestrutura:" : "", `${nome}: ${val || "____"}`, i === 0 ? OBS.lista : "")
  );
  linha("Observações Gerais:", os.observacoes, OBS.equipe);

  /* ---------------------------- CREDENCIAMENTO ------------------------- */
  secao("CREDENCIAMENTO");
  linha(
    "Formulário de Credenciamento:",
    os.credenciamento.linkFormulario || "Link gerado ao salvar/disparar a OS",
    "O sistema gera automaticamente um link para o formulário (equipe e veículos)."
  );
  linha("Prazo Limite:", dataBR(os.credenciamento.prazoLimite), OBS.equipe);

  /* ------------------------------ ORÇAMENTO ---------------------------- */
  const orc = os.orcamento;
  secao("ORÇAMENTO");
  linha("Valor do Item na EC do Projeto:", orc.valorEc, OBS.ec, { money: true });
  linha("Valor com BV e NF:", orc.valorComBvNf, OBS.equipe, { money: true });
  linha("Valor Sem BV e Com Nota Fiscal:", orc.valorSemBvComNf, OBS.equipe, { money: true });
  linha("Valor Sem BV e Sem NF:", orc.valorSemBvSemNf, OBS.equipe, { money: true });
  if (orc.parcelas.length === 0) {
    linha("Prazo de Pagamento (parcelas):", "____", "Preenchida pela equipe. O sistema permite 1 ou mais parcelas.");
  } else {
    orc.parcelas.forEach((x, i) =>
      linha(
        i === 0 ? "Prazo de Pagamento (parcelas):" : "",
        `${i + 1}ª — ${x.descricao || "Parcela"}: R$ ${(x.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        i === 0 ? "Preenchida pela equipe. O sistema permite 1 ou mais parcelas." : ""
      )
    );
  }
  linha("Documento Fiscal:", orc.documentoFiscal, `${OBS.lista} • Recibo Simples • Fatura • Nota Fiscal • Fatura e Nota Fiscal`);

  /* ----------- INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO --------- */
  if (incluirFinanceiro) {
    const fin = os.financeiro;
    secao("INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO DA PÓLOBH");
    sub("DADOS EMISSÃO — RECIBO SIMPLES | FATURA | NOTA FISCAL | FATURA E NOTA FISCAL", "O sistema permite adicionar campos para mais notas fiscais.");
    const tomadorLabel = fin.tomador === "Polobh" ? "Pólobh" : fin.tomador === "Cliente" ? "Cliente" : "";
    linha("Tomador dos Serviços:", tomadorLabel, "Vem da EC (coluna Pólobh ou Cliente).");
    // Quando o tomador é o Cliente, os dados vêm do cliente da EC.
    const t = fin.tomador === "Cliente" ? cli : null;
    linha("Razão Social:", t?.razaoSocial ?? "", OBS.ec);
    linha("Endereço:", t?.endereco ?? "", OBS.ec);
    linha("CNPJ/CPF:", t?.cnpjCpf ?? "", OBS.ec);
    linha("Inscrição Estadual:", t?.inscricaoEstadual ?? "", OBS.ec);
    linha("Inscrição Municipal:", t?.inscricaoMunicipal ?? "", OBS.ec);
    linha("Descritivo Nota Fiscal:", fin.descritivoNf, OBS.listaMem);
    if (p.incentivosFiscais) linha("Nome do Projeto Incentivado / Lei / Nº:", p.incentivosFiscais, OBS.ec);
    linha("CNAE:", fin.cnae, OBS.listaMem);
    linha("Código de Serviço:", fin.codigoServico, OBS.listaMem);
    linha("Valor unitário:", fin.valorUnitario, OBS.equipe, { money: true });
    linha("Valor total:", fin.valorTotal, OBS.equipe, { money: true });
    linha("Desconto Especial Negociado:", fin.descontoNegociado, OBS.equipe, { money: true });
    linha("Valor total a pagar:", fin.valorAPagar, OBS.equipe, { money: true });
    linha("BV Pólobh — Percentual:", `${fin.bvPercentual ?? 0}%`, OBS.equipe);
    linha("BV Pólobh — Valor:", fin.bvValor, OBS.auto, { money: true });
    linha("Acerto Financeiro:", fin.acertoFinanceiro, OBS.equipe);

    /* ------------------------- DADOS PARA CONTRATO --------------------- */
    sub("DADOS PARA CONTRATO", "O sistema permite adicionar campos para mais contratos.");
    linha("Contratante:", "", `${OBS.lista} (Pólobh ou Cliente)`);
    linha("Razão Social:", "", "Vem da EC conforme a opção acima (Pólobh ou Cliente).");
    linha("Endereço:", "", "Vem da EC conforme a opção acima (Pólobh ou Cliente).");
    linha("CNPJ/CPF:", "", "Vem da EC conforme a opção acima (Pólobh ou Cliente).");
    linha("Inscrição Estadual:", "", "Vem da EC conforme a opção acima.");
    linha("Inscrição Municipal:", "", "Vem da EC conforme a opção acima.");
    linha("Descritivo dos Serviços e/ou Produtos:", fin.descritivoNf || os.descritivo, "Vem do Descritivo NF acima — campo editável.");
    linha("Informações Complementares:", "", OBS.equipe);
    linha(
      "Forma de Pagamento:",
      "Forma de pagamento: à vista, no ato da emissão da nota fiscal / fatura",
      OBS.fixo,
      { fixo: true }
    );
    linha(
      "Observações Gerais:",
      "Estes valores poderão ser revistos em caso de faltas ou execução parcial dos serviços ora contratados.",
      OBS.fixo,
      { fixo: true }
    );
    linha("Data do Contrato:", "", OBS.equipe);
    linha("Rubrica:", "", OBS.listaMem);
  }

  ws.pageSetup.printArea = `A1:C${r - 1}`;

  const buffer = await wb.xlsx.writeBuffer();
  baixar(buffer as ArrayBuffer, `${nomeArquivo(os.numero)}.xlsx`);
}
