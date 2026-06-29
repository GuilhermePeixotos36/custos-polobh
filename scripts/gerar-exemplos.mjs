/**
 * Gera arquivos de exemplo EC e OS em ./exemplos para conferência de fidelidade
 * contra os modelos reais em ./reference.
 *
 * Espelha a lógica de src/lib/excel/ec.ts (EC remontada) e os.ts (OS preenchendo
 * o template). Lê logo/template do disco e grava .xlsx. Rode:  npm run gerar:exemplos
 */
import ExcelJS from "exceljs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = (...p) => join(raiz, ...p);

/* ----------------------------- helpers ----------------------------- */
const brl = (v) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const dataBR = (iso) => {
  if (!iso) return "";
  const d = iso.length <= 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
};
const r2 = (n) => Math.round(n * 100) / 100;

const COR = {
  black: "FF0B0B0D", ink: "FF15161A", white: "FFFFFFFF", primary: "FFF2820D",
  soft: "FFFDF1E3", border: "FFE7E8EC", ink2: "FF6A6E78",
};
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = {
  top: { style: "thin", color: { argb: COR.border } },
  left: { style: "thin", color: { argb: COR.border } },
  bottom: { style: "thin", color: { argb: COR.border } },
  right: { style: "thin", color: { argb: COR.border } },
};
const COLS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

/* ------------------------ produção / totais ------------------------ */
const HON = 0.15, ENC = 0.1633;
function totalProducao(p) {
  return r2(
    p.despesasOperacionais * p.qtdDespesas + p.equipeBH * p.qtdEquipeBH + p.equipeViagem * p.qtdEquipeViagem +
    p.transporteBH * p.qtdTransporteBH + p.transporteViagem * p.qtdTransporteViagem +
    p.alimentacaoBH * p.qtdAlimentacaoBH + p.alimentacaoViagem * p.qtdAlimentacaoViagem
  );
}
function calcularTotais(linhas, producao) {
  const somaLinhasPolobh = r2(linhas.reduce((s, l) => s + (l.valorPolobh || 0), 0));
  const somaCliente = r2(linhas.reduce((s, l) => s + (l.valorCliente || 0), 0));
  const somaProducao = totalProducao(producao);
  const somaFornecedores = r2(somaLinhasPolobh + somaProducao);
  const honorariosPolobh = r2(somaFornecedores * HON);
  const honorariosCliente = r2(somaCliente * HON);
  const encargos = r2(somaFornecedores * ENC);
  const subTotalPolobh = r2(somaFornecedores + honorariosPolobh + encargos);
  const valorTotalBruto = r2(subTotalPolobh + somaCliente + honorariosCliente);
  const faturamentoPolobh = r2(subTotalPolobh + honorariosCliente);
  return { somaProducao, somaFornecedores, somaCliente, honorariosPolobh, honorariosCliente,
    encargos, subTotalPolobh, valorTotalBruto, faturamentoPolobh, faturamentoTerceiros: somaCliente };
}

const producaoPadrao = () => ({
  despesasOperacionais: 600, equipeBH: 600, equipeViagem: 750, transporteBH: 125, transporteViagem: 200,
  alimentacaoBH: 85, alimentacaoViagem: 150, qtdDespesas: 1, qtdEquipeBH: 0, qtdEquipeViagem: 0,
  qtdTransporteBH: 0, qtdTransporteViagem: 0, qtdAlimentacaoBH: 0, qtdAlimentacaoViagem: 0,
});

/* ------------------------- dados de exemplo ------------------------- */
const cliente = {
  nome: "BANCO MERCANTIL", razaoSocial: "BANCO MERCANTIL DO BRASIL S/A",
  endereco: "Avenida do Contorno, 5800 | 12º andar - Savassi - Belo Horizonte - MG - CEP: 30110-042",
  cnpjCpf: "17.184.037/0001-10", inscricaoEstadual: "", inscricaoMunicipal: "",
  representante: { nome: "Brunna Lopes", cargo: "Gerência de Comunicação e Marketing",
    telefones: "(31) 3057-6369 | (31) 9 9971-5638", email: "brunna.lopes@mercantil.com.br" },
};
const projeto = {
  titulo: "Convenção Anual de Lideranças", local: "Expominas — Pavilhão 1",
  enderecoLocal: "Av. Amazonas, 6200 - Gameleira - Belo Horizonte - MG", participantes: 300,
  produtoraResponsavel: "Marisa M. Coelho", telefoneProdutora: "(31) 9 9100-0000",
  emailProdutora: "producao@polobh.com.br", preEvento: "2026-08-10", evento: "2026-08-15",
  posEvento: "2026-08-16", horario: "08h às 18h",
  roteiro: "Abertura institucional, painéis, almoço e premiação.", incentivosFiscais: "",
};
const L = (o) => ({ grupo: "", item: "", descricao: "", valorPolobh: 0, valorCliente: 0,
  statusAprovacao: "Pendente", fornecedorRazao: "", fornecedorCnpj: "", faturaNf: "", codigoServico: "",
  pedidoCompra: "", statusOs: "Pendente", observacao: "", ...o });
const linhas = [
  L({ ordem:0, grupo:"AUDIOVISUAL", item:"Sonorização", descricao:"Sistema de som line array para auditório de 300 lugares, 2 técnicos.", valorPolobh:8500, statusAprovacao:"OK", fornecedorRazao:"SOM & LUZ PRODUÇÕES LTDA", fornecedorCnpj:"12.345.678/0001-90", statusOs:"Emitir" }),
  L({ ordem:1, grupo:"AUDIOVISUAL", item:"Iluminação cênica", descricao:"Projeto de luz com moving heads e operação durante o evento.", valorPolobh:6200, statusAprovacao:"OK", fornecedorRazao:"SOM & LUZ PRODUÇÕES LTDA", fornecedorCnpj:"12.345.678/0001-90", statusOs:"Emitir" }),
  L({ ordem:2, grupo:"ESTRUTURA", item:"Palco e backdrop", descricao:"Palco 8x4m, praticáveis e backdrop com lona impressa.", valorPolobh:4800, fornecedorRazao:"MONTA TUDO ESTRUTURAS LTDA", fornecedorCnpj:"34.567.890/0001-12" }),
  L({ ordem:3, grupo:"GASTRONOMIA", item:"Coffee break", descricao:"Coffee break para 300 pessoas, 2 intervalos, equipe de garçons.", valorCliente:9200, statusAprovacao:"OK", fornecedorRazao:"BUFFET SABOR & ARTE EIRELI", fornecedorCnpj:"23.456.789/0001-01" }),
];
const ec = {
  numero: "EC – Banco Mercantil – Convenção Anual – V02", versao: 2, cliente, projeto, linhas,
  producao: { ...producaoPadrao(), qtdEquipeBH: 3, qtdTransporteBH: 3, qtdAlimentacaoBH: 3 },
  responsavel: "Marisa M. Coelho", validadeDias: 30, atualizadoEm: "2026-06-20T10:00:00.000Z",
};

const fornecedor = {
  razaoSocial: "SOM & LUZ PRODUÇÕES LTDA", nomeFantasia: "Som & Luz", cnpj: "12.345.678/0001-90",
  perfilTributario: "Simples Nacional", endereco: "Rua da Bahia, 1200 - Centro - Belo Horizonte - MG",
  inscricaoEstadual: "062.987.654.0011", inscricaoMunicipal: "98765",
  dadosBancarios: { tipoConta: "PJ", banco: "Banco do Brasil (001)", agencia: "1234-5", conta: "67890-1", chavePix: "12.345.678/0001-90" },
  representante: "Roberto Dias", telefone: "(31) 9 8888-1122", email: "contato@someluz.com.br",
};
const os = {
  numero: "EC – Banco Mercantil – Convenção Anual – OS-01", modalidade: "Locação + Serviço", fornecedor,
  descritivo: "• Sonorização — Sistema de som line array para auditório de 300 lugares, 2 técnicos.\n• Iluminação cênica — Projeto de luz com moving heads e operação durante o evento.",
  entrega: "Instalação, operação e acompanhamento técnico.",
  cronograma: [
    { etapa:"Montagem", data:"2026-08-14", horario:"08h", atividades:"Rigging e cabeamento" },
    { etapa:"Evento", data:"2026-08-15", horario:"08h", atividades:"Operação de som e luz" },
  ],
  logistica: { transporteMaterial:"Por conta do fornecedor", transporteEquipe:"Por conta do fornecedor", hospedagem:"Não se aplica", alimentacao:"Pólobh fornece no local", estacionamentoCarga:"Liberado pelo local", estacionamentoEquipe:"Liberado pelo local", uniformizacao:"Camisa preta da equipe" },
  infraestrutura: { energia:"2 pontos trifásicos no palco", internet:"Wi-Fi do local", pontosEletricos:"6 pontos de 220V", estruturas:"Box truss fornecido pela Monta Tudo", servicosApoio:"—", artLaudos:"ART de elétrica sob responsabilidade do fornecedor" },
  observacoes: "Passagem de som obrigatória até 12h do dia do evento.",
  credenciamento: { prazoLimite:"2026-08-12", linkFormulario:"https://forms.polobh.com.br/cred/os1" },
  orcamento: { valorEc:14700, valorComBvNf:14700, valorSemBvComNf:14700, valorSemBvSemNf:13800,
    parcelas:[{descricao:"50% na montagem", valor:7350},{descricao:"50% pós-evento", valor:7350}], documentoFiscal:"Nota Fiscal" },
  financeiro: { tomador:"Polobh", descritivoNf:"Locação de equipamentos de áudio e iluminação com operação técnica.", cnae:"9001-9/06", codigoServico:"03.01", valorUnitario:14700, valorTotal:14700, descontoNegociado:0, valorAPagar:14700, bvPercentual:10, bvValor:1470, acertoFinanceiro:"Pagamento via PIX CNPJ." },
};

/* ------------------------------- EC -------------------------------- */
async function gerarEc() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("EC", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 }, views: [{ showGridLines: false }] });
  [16,34,13,13,14,20,18,12,13,14,10,22].forEach((w,i)=>ws.getColumn(i+1).width=w);
  const t = calcularTotais(ec.linhas, ec.producao);
  let r = 1;
  ws.mergeCells(`A${r}:B${r+1}`); ws.mergeCells(`C${r}:L${r+1}`);
  const titulo = ws.getCell(`C${r}`); titulo.value = "Estimativa de Custos | Proposta Comercial";
  titulo.font = { name:"Calibri", size:16, bold:true, color:{argb:COR.white} };
  titulo.alignment = { vertical:"middle", horizontal:"center" };
  COLS.forEach((c)=>ws.getCell(`${c}${r}`).fill = fill(COR.black));
  ws.getRow(r).height = 26; ws.getRow(r+1).height = 26;
  const logo = await readFile(P("public","polobh-logo.png"));
  const id = wb.addImage({ buffer: logo, extension: "png" });
  ws.addImage(id, { tl:{col:0.2,row:r-0.8}, ext:{width:92,height:56} });
  r += 2;
  const meta = (label,valor) => { ws.getCell(`A${r}`).value=label; ws.getCell(`A${r}`).font={bold:true,size:10}; ws.mergeCells(`B${r}:L${r}`); ws.getCell(`B${r}`).value=valor; ws.getCell(`B${r}`).font={size:10}; r++; };
  meta("Data:", dataBR(ec.atualizadoEm)); meta("Número EC | Orçamento:", ec.numero);
  const secao = (txt) => { ws.mergeCells(`A${r}:L${r}`); const c=ws.getCell(`A${r}`); c.value=txt; c.font={bold:true,size:11,color:{argb:COR.white}}; c.fill=fill(COR.primary); c.alignment={vertical:"middle"}; ws.getRow(r).height=20; r++; };
  const linhaLV = (label,valor) => { ws.getCell(`A${r}`).value=label; ws.getCell(`A${r}`).font={bold:true,size:10}; ws.getCell(`A${r}`).fill=fill(COR.soft); ws.mergeCells(`B${r}:L${r}`); ws.getCell(`B${r}`).value=valor; ws.getCell(`B${r}`).font={size:10}; ws.getCell(`B${r}`).alignment={wrapText:true,vertical:"top"}; r++; };
  secao("CLIENTE");
  linhaLV("Cliente:", cliente.nome); linhaLV("Razão Social:", cliente.razaoSocial); linhaLV("Endereço:", cliente.endereco);
  linhaLV("CNPJ/CPF:", cliente.cnpjCpf); linhaLV("Inscrição Estadual:", cliente.inscricaoEstadual); linhaLV("Inscrição Municipal:", cliente.inscricaoMunicipal);
  linhaLV("Representante:", [cliente.representante.nome,cliente.representante.cargo,cliente.representante.telefones,cliente.representante.email].filter(Boolean).join("\n"));
  secao("PROJETO");
  linhaLV("Título:", projeto.titulo); linhaLV("Local:", `${projeto.local} — ${projeto.enderecoLocal}`); linhaLV("Nº Participantes:", String(projeto.participantes));
  linhaLV("Produtora Responsável:", projeto.produtoraResponsavel); linhaLV("Pré-Evento:", dataBR(projeto.preEvento));
  linhaLV("Evento:", `${dataBR(projeto.evento)} · ${projeto.horario}`); linhaLV("Pós-Evento:", dataBR(projeto.posEvento)); linhaLV("Roteiro:", projeto.roteiro);
  secao("ESTIMATIVA DE CUSTOS");
  const headers = ["Item","Descrição","Pólobh","Cliente","Status Aprovação","Fornecedor (Razão Social)","Fornecedor (CNPJ)","Fatura ou Nota Fiscal","Código Serviço","Pedido de Compra","OS","Observação"];
  const hr = r;
  headers.forEach((h,i)=>{ const c=ws.getCell(`${COLS[i]}${hr}`); c.value=h; c.font={bold:true,size:9,color:{argb:COR.white}}; c.fill=fill(COR.black); c.alignment={wrapText:true,vertical:"middle",horizontal:"center"}; c.border=thin; });
  ws.getRow(hr).height = 30; r++;
  const grupos = new Map();
  for (const l of [...ec.linhas].sort((a,b)=>a.ordem-b.ordem)) { const g=l.grupo||"GERAL"; if(!grupos.has(g)) grupos.set(g,[]); grupos.get(g).push(l); }
  for (const [grupo, ls] of grupos) {
    ws.mergeCells(`A${r}:L${r}`); const gc=ws.getCell(`A${r}`); gc.value=grupo; gc.font={bold:true,size:10,color:{argb:COR.ink}}; gc.fill=fill(COR.soft); gc.border=thin; r++;
    for (const l of ls) {
      const vals=[l.item,l.descricao,l.valorPolobh,l.valorCliente,l.statusAprovacao,l.fornecedorRazao,l.fornecedorCnpj,l.faturaNf,l.codigoServico,l.pedidoCompra,l.statusOs,l.observacao];
      vals.forEach((v,i)=>{ const c=ws.getCell(`${COLS[i]}${r}`); c.value=v; c.font={size:9}; c.border=thin; c.alignment={wrapText:true,vertical:"top"}; if(i===2||i===3){ c.numFmt='"R$" #,##0.00'; c.alignment={horizontal:"right"}; } });
      r++;
    }
  }
  secao("PRODUÇÃO");
  const prod = ec.producao;
  const pl = [
    ["Despesas operacionais","Motoboy, cartório, Correios.", prod.despesasOperacionais*prod.qtdDespesas],
    ["Equipe",`Diária BH R$ ${prod.equipeBH} · Viagem R$ ${prod.equipeViagem}`, prod.equipeBH*prod.qtdEquipeBH+prod.equipeViagem*prod.qtdEquipeViagem],
    ["Transporte",`BH R$ ${prod.transporteBH}/dia · Viagem R$ ${prod.transporteViagem}/dia`, prod.transporteBH*prod.qtdTransporteBH+prod.transporteViagem*prod.qtdTransporteViagem],
    ["Alimentação",`BH R$ ${prod.alimentacaoBH}/dia · Viagem R$ ${prod.alimentacaoViagem}`, prod.alimentacaoBH*prod.qtdAlimentacaoBH+prod.alimentacaoViagem*prod.qtdAlimentacaoViagem],
  ];
  for (const [nome,desc,val] of pl) {
    ws.getCell(`A${r}`).value=nome; ws.getCell(`A${r}`).font={bold:true,size:9};
    ws.getCell(`B${r}`).value=desc; ws.getCell(`B${r}`).font={size:9};
    const c=ws.getCell(`C${r}`); c.value=val; c.numFmt='"R$" #,##0.00'; c.font={size:9};
    [`A${r}`,`B${r}`,`C${r}`,`D${r}`].forEach(a=>ws.getCell(a).border=thin); r++;
  }
  r++;
  const totalRow = (label,desc,valor,destaque=false) => {
    ws.getCell(`A${r}`).value=label; ws.getCell(`A${r}`).font={bold:true,size:10,color:{argb:destaque?COR.white:COR.ink}};
    ws.mergeCells(`B${r}:J${r}`); ws.getCell(`B${r}`).value=desc; ws.getCell(`B${r}`).font={size:9,color:{argb:destaque?COR.white:COR.ink2}};
    ws.mergeCells(`K${r}:L${r}`); const c=ws.getCell(`K${r}`); c.value=valor; c.numFmt='"R$" #,##0.00'; c.font={bold:true,size:10,color:{argb:destaque?COR.white:COR.ink}}; c.alignment={horizontal:"right"};
    if(destaque) COLS.forEach(col=>ws.getCell(`${col}${r}`).fill=fill(COR.primary));
    r++;
  };
  totalRow("Soma dos fornecedores","Σ valor Pólobh + produção", t.somaFornecedores);
  totalRow("Honorários Pólobh (15%)","Serviços de organização e planejamento", t.honorariosPolobh);
  totalRow("Encargos (16,33%)","Incidentes sobre serviços de terceiros", t.encargos);
  totalRow("Sub-total Pólobh","Reembolso + Honorários + Encargos", t.subTotalPolobh);
  totalRow("Faturamento Terceiros","Σ valor Cliente", t.faturamentoTerceiros);
  totalRow("Honorários Cliente (15%)","Sobre valores faturados ao cliente", t.honorariosCliente);
  totalRow("Valor total bruto","Custo total do projeto", t.valorTotalBruto, true);
  r++;
  ws.mergeCells(`A${r}:L${r}`);
  ws.getCell(`A${r}`).value = `Validade: ${ec.validadeDias} dias. Esta EC | Orçamento cancela e substitui todas as anteriores referentes ao mesmo projeto.`;
  ws.getCell(`A${r}`).font = { italic:true, size:9, color:{argb:COR.ink2} };
  ws.getCell(`A${r}`).alignment = { wrapText:true };
  await mkdir(P("exemplos"), { recursive:true });
  await wb.xlsx.writeFile(P("exemplos","EC_exemplo.xlsx"));
}

/* ------------------------------- OS -------------------------------- */
/* Espelha src/lib/excel/os.ts — remontada com a marca Pólobh (9 blocos). */
async function gerarOs() {
  const moeda = '"R$" #,##0.00';
  const OC = ["A","B","C","D","E","F"];
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("OS", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }],
  });
  [24,16,16,15,15,15].forEach((w,i)=>ws.getColumn(i+1).width=w);
  const cli = ec.cliente, p = ec.projeto, f = os.fornecedor, b = f.dadosBancarios;
  let r = 1;

  const secao = (txt) => { ws.mergeCells(`A${r}:F${r}`); const c=ws.getCell(`A${r}`); c.value=txt; c.font={bold:true,size:11,color:{argb:COR.white}}; c.fill=fill(COR.primary); c.alignment={vertical:"middle"}; ws.getRow(r).height=20; r++; };
  const lv = (label,valor,money=false) => {
    const a=ws.getCell(`A${r}`); a.value=label; a.font={bold:true,size:10}; a.fill=fill(COR.soft); a.alignment={vertical:"top",wrapText:true}; a.border=thin;
    ws.mergeCells(`B${r}:F${r}`); const bb=ws.getCell(`B${r}`); bb.value=(valor??""); bb.font={size:10}; bb.alignment={wrapText:true,vertical:"top"}; bb.border=thin;
    if(money && typeof valor==="number"){ bb.numFmt=moeda; }
    r++;
  };
  const headerRow = (cols) => { for(const col of cols){ ws.mergeCells(col.span); const c=ws.getCell(col.span.split(":")[0]); c.value=col.texto; c.font={bold:true,size:9,color:{argb:COR.white}}; c.fill=fill(COR.black); c.alignment={vertical:"middle",horizontal:col.align??"left",wrapText:true}; c.border=thin; } ws.getRow(r).height=18; r++; };

  // cabeçalho
  ws.mergeCells(`A${r}:B${r+1}`); ws.mergeCells(`C${r}:F${r+1}`);
  const tit=ws.getCell(`C${r}`); tit.value="Ordem de Serviço"; tit.font={name:"Calibri",size:16,bold:true,color:{argb:COR.white}}; tit.alignment={vertical:"middle",horizontal:"center"};
  OC.forEach(c=>{ ws.getCell(`${c}${r}`).fill=fill(COR.black); ws.getCell(`${c}${r+1}`).fill=fill(COR.black); });
  ws.getRow(r).height=26; ws.getRow(r+1).height=26;
  const logo=await readFile(P("public","polobh-logo.png"));
  const id=wb.addImage({ buffer: logo, extension:"png" });
  ws.addImage(id,{ tl:{col:0.2,row:r-0.85}, ext:{width:110,height:50} });
  r+=2;
  lv("Número da OS:",os.numero); lv("Projeto:",p.titulo); lv("Data de emissão:",dataBR(new Date().toISOString())); lv("Status:","Disparada");

  secao("DADOS DO CLIENTE  (automático da EC)");
  lv("Cliente:",cli.nome); lv("Razão Social:",cli.razaoSocial); lv("Endereço:",cli.endereco); lv("CNPJ/CPF:",cli.cnpjCpf);

  secao("DADOS DO PROJETO  (automático da EC)");
  lv("Data / Horário:",`${dataBR(p.evento)} · ${p.horario}`); lv("Local:",p.local); lv("Endereço do Local:",p.enderecoLocal); lv("Nº de Participantes:",p.participantes); lv("Produtora Responsável:",p.produtoraResponsavel); lv("Contato Produtora:",[p.telefoneProdutora,p.emailProdutora].filter(Boolean).join(" · "));

  const consolidadas = linhas.filter(l=>l.fornecedorRazao===f.razaoSocial);
  secao("ITENS CONSOLIDADOS DA EC");
  headerRow([{texto:"Grupo",span:`A${r}:A${r}`},{texto:"Item / Descrição",span:`B${r}:D${r}`},{texto:"Pólobh",span:`E${r}:E${r}`,align:"right"},{texto:"Cliente",span:`F${r}:F${r}`,align:"right"}]);
  for(const l of consolidadas){
    ws.getCell(`A${r}`).value=l.grupo; ws.mergeCells(`B${r}:D${r}`); ws.getCell(`B${r}`).value=`${l.item?l.item+" — ":""}${l.descricao}`;
    const cp=ws.getCell(`E${r}`); cp.value=l.valorPolobh; cp.numFmt=moeda; const cc=ws.getCell(`F${r}`); cc.value=l.valorCliente; cc.numFmt=moeda;
    [`A${r}`,`B${r}`,`E${r}`,`F${r}`].forEach(a=>{ ws.getCell(a).border=thin; ws.getCell(a).font={size:9}; ws.getCell(a).alignment={wrapText:true,vertical:"top"}; });
    r++;
  }
  ws.mergeCells(`A${r}:D${r}`); ws.getCell(`A${r}`).value="Total consolidado"; ws.getCell(`A${r}`).font={bold:true,size:9}; ws.getCell(`A${r}`).fill=fill(COR.soft);
  const tp=ws.getCell(`E${r}`); tp.value=consolidadas.reduce((s,l)=>s+l.valorPolobh,0); tp.numFmt=moeda; tp.font={bold:true,size:9}; tp.fill=fill(COR.soft);
  const tc=ws.getCell(`F${r}`); tc.value=consolidadas.reduce((s,l)=>s+l.valorCliente,0); tc.numFmt=moeda; tc.font={bold:true,size:9}; tc.fill=fill(COR.soft);
  [`A${r}`,`E${r}`,`F${r}`].forEach(a=>ws.getCell(a).border=thin); r++;

  secao("DADOS DO FORNECEDOR");
  lv("Fornecedor:",f.nomeFantasia||f.razaoSocial); lv("CNPJ/CPF:",f.cnpj); lv("Perfil tributário:",f.perfilTributario); lv("Razão Social:",f.razaoSocial); lv("Endereço:",f.endereco);
  lv("Dados Bancários:",[b.tipoConta,b.banco,b.agencia&&`Ag. ${b.agencia}`,b.conta&&`Conta ${b.conta}`,b.chavePix&&`Pix ${b.chavePix}`].filter(Boolean).join("  ·  "));
  lv("Representante:",f.representante); lv("Contato:",[f.telefone,f.email].filter(Boolean).join(" · "));

  secao("DETALHAMENTO DA CONTRATAÇÃO");
  lv("Modalidade:",os.modalidade); lv("Descritivo:",os.descritivo); lv("Entrega:",os.entrega);
  ws.mergeCells(`A${r}:F${r}`); ws.getCell(`A${r}`).value="Cronograma específico do fornecedor"; ws.getCell(`A${r}`).font={bold:true,size:9,italic:true,color:{argb:COR.ink2}}; r++;
  headerRow([{texto:"Etapa",span:`A${r}:B${r}`},{texto:"Data",span:`C${r}:C${r}`},{texto:"Horário",span:`D${r}:D${r}`},{texto:"Atividades",span:`E${r}:F${r}`}]);
  for(const c of os.cronograma){ ws.mergeCells(`A${r}:B${r}`); ws.getCell(`A${r}`).value=c.etapa; ws.getCell(`C${r}`).value=dataBR(c.data); ws.getCell(`D${r}`).value=c.horario; ws.mergeCells(`E${r}:F${r}`); ws.getCell(`E${r}`).value=c.atividades; [`A${r}`,`C${r}`,`D${r}`,`E${r}`].forEach(a=>{ ws.getCell(a).border=thin; ws.getCell(a).font={size:9}; ws.getCell(a).alignment={wrapText:true,vertical:"top"}; }); r++; }
  lv("Logística:",[`Transp. material: ${os.logistica.transporteMaterial}`,`Transp. equipe: ${os.logistica.transporteEquipe}`,`Hospedagem: ${os.logistica.hospedagem}`,`Alimentação: ${os.logistica.alimentacao}`,`Estac. carga: ${os.logistica.estacionamentoCarga}`,`Estac. equipe: ${os.logistica.estacionamentoEquipe}`,`Uniformização: ${os.logistica.uniformizacao}`].join("\n"));
  lv("Infraestrutura:",[`Energia: ${os.infraestrutura.energia}`,`Internet: ${os.infraestrutura.internet}`,`Pontos elétricos: ${os.infraestrutura.pontosEletricos}`,`Estruturas: ${os.infraestrutura.estruturas}`,`Apoio: ${os.infraestrutura.servicosApoio}`,`ART/Laudos: ${os.infraestrutura.artLaudos}`].join("\n"));
  lv("Observações Gerais:",os.observacoes);

  secao("CREDENCIAMENTO");
  lv("Link do formulário:",os.credenciamento.linkFormulario); lv("Prazo limite:",dataBR(os.credenciamento.prazoLimite));

  secao("ORÇAMENTO");
  lv("Valor do item na EC:",os.orcamento.valorEc,true); lv("Valor com BV e NF:",os.orcamento.valorComBvNf,true); lv("Valor sem BV e com NF:",os.orcamento.valorSemBvComNf,true); lv("Valor sem BV e sem NF:",os.orcamento.valorSemBvSemNf,true);
  lv("Parcelas:",os.orcamento.parcelas.map((x,i)=>`${i+1}. ${x.descricao}: ${brl(x.valor)}`).join("\n")); lv("Documento Fiscal:",os.orcamento.documentoFiscal);

  secao("FINANCEIRO PÓLOBH  (uso interno)");
  const fin=os.financeiro;
  lv("Tomador:",fin.tomador==="Polobh"?"Pólobh":fin.tomador); lv("Descritivo NF:",fin.descritivoNf); lv("CNAE / Código de Serviço:",[fin.cnae,fin.codigoServico].filter(Boolean).join(" · "));
  lv("Valor unitário:",fin.valorUnitario,true); lv("Valor total:",fin.valorTotal,true); lv("Desconto negociado:",fin.descontoNegociado,true); lv("Valor total a pagar:",fin.valorAPagar,true);
  lv("BV Pólobh:",`${fin.bvPercentual}%  ·  ${brl(fin.bvValor)}`); lv("Acerto Financeiro:",fin.acertoFinanceiro);

  r++;
  ws.getCell(`A${r}`).value="Pólobh Eventos"; ws.getCell(`A${r}`).border={top:{style:"thin",color:{argb:COR.ink}}}; ws.getCell(`A${r}`).font={size:9};
  ws.mergeCells(`D${r}:F${r}`); ws.getCell(`D${r}`).value=`${f.razaoSocial} — Data: ____/____/______`; ws.getCell(`D${r}`).border={top:{style:"thin",color:{argb:COR.ink}}}; ws.getCell(`D${r}`).font={size:9};
  ws.pageSetup.printArea=`A1:F${r}`;

  await mkdir(P("exemplos"), { recursive:true });
  await wb.xlsx.writeFile(P("exemplos", process.env.OS_OUT || "OS_exemplo.xlsx"));
}

const seguro = async (nome, fn) => {
  try { await fn(); console.log(`OK -> exemplos/${nome}`); }
  catch (e) { console.warn(`PULOU ${nome}: ${e.code === "EBUSY" ? "arquivo aberto no Excel — feche e rode de novo" : e.message}`); }
};
await seguro("EC_exemplo.xlsx", gerarEc);
await seguro("OS_exemplo.xlsx", gerarOs);
