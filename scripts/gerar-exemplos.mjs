/**
 * Gera arquivos de exemplo EC e OS em ./exemplos para conferência de fidelidade
 * contra os modelos reais em ./reference.
 *
 * Espelha a lógica de src/lib/excel/ec.ts e os.ts (fórmulas vivas, bloco
 * contratual da EC, OS em 2 colunas "Modelo Novo"). Rode: npm run gerar:exemplos
 * Se o arquivo estiver aberto no Excel (EBUSY), grava com sufixo " (novo)".
 */
import ExcelJS from "exceljs";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = (...p) => join(raiz, ...p);

/* ----------------------------- helpers ----------------------------- */
const dataBR = (iso) => {
  if (!iso) return "";
  const d = iso.length <= 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
};
const r2 = (n) => Math.round(n * 100) / 100;
const moeda = '"R$" #,##0.00';

const COR = {
  black: "FF0B0B0D", ink: "FF15161A", white: "FFFFFFFF", primary: "FFF2820D",
  soft: "FFFDF1E3", border: "FFE7E8EC", ink2: "FF6A6E78",
};
const CINZA = "FFD9D9D9";
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = {
  top: { style: "thin", color: { argb: COR.border } },
  left: { style: "thin", color: { argb: COR.border } },
  bottom: { style: "thin", color: { argb: COR.border } },
  right: { style: "thin", color: { argb: COR.border } },
};
const COLS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

/* ------------------------ produção / totais ------------------------ */
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
  const honorariosPolobh = r2(somaFornecedores * 0.15);
  const honorariosCliente = r2(somaCliente * 0.15);
  const encargos = r2(somaFornecedores * 0.1633);
  const subTotalPolobh = r2(somaFornecedores + honorariosPolobh + encargos);
  const valorTotalBruto = r2(subTotalPolobh + somaCliente + honorariosCliente);
  const faturamentoPolobh = r2(subTotalPolobh + honorariosCliente);
  return { somaFornecedores, somaCliente, honorariosPolobh, honorariosCliente,
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
  numero: "EC – Banco Mercantil – Convenção Anual – OS-01", status: "Disparada", modalidade: "Locação + Serviço", fornecedor,
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
  financeiro: { tomador:"Cliente", descritivoNf:"Locação de equipamentos de áudio e iluminação com operação técnica.", cnae:"9001-9/06", codigoServico:"03.01", valorUnitario:14700, valorTotal:14700, descontoNegociado:0, valorAPagar:14700, bvPercentual:10, bvValor:1470, acertoFinanceiro:"Pagamento via PIX CNPJ." },
  contrato: { contratante:"Cliente", descritivoServicos:"", informacoesComplementares:"Montagem concluída até 12h da véspera.", valorUnitario:14700, valorTotal:14700, descontoNegociado:0, valorAPagar:14700, dataContrato:"2026-08-01", rubrica:"MMC" },
};

/* ------------------------------- EC -------------------------------- */
async function gerarEc(outName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("EC", {
    pageSetup: {
      paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });
  [16,34,13,13,14,20,18,12,13,14,10,22].forEach((w,i)=>ws.getColumn(i+1).width=w);
  const t = calcularTotais(ec.linhas, ec.producao);
  let r = 1;

  // cabeçalho
  ws.mergeCells(`A${r}:B${r+1}`); ws.mergeCells(`C${r}:L${r+1}`);
  const titulo = ws.getCell(`C${r}`); titulo.value = "Estimativa de Custos | Proposta Comercial";
  titulo.font = { name:"Calibri", size:16, bold:true, color:{argb:COR.white} };
  titulo.alignment = { vertical:"middle", horizontal:"center" };
  COLS.forEach((c)=>{ ws.getCell(`${c}${r}`).fill = fill(COR.black); ws.getCell(`${c}${r+1}`).fill = fill(COR.black); });
  ws.getRow(r).height = 26; ws.getRow(r+1).height = 26;
  const logo = await readFile(P("public","polobh-logo.png"));
  const id = wb.addImage({ buffer: logo, extension: "png" });
  ws.addImage(id, { tl:{col:0.2,row:r-0.8}, ext:{width:92,height:56} });
  r += 2;
  const meta = (label,valor) => { ws.getCell(`A${r}`).value=label; ws.getCell(`A${r}`).font={bold:true,size:10}; ws.mergeCells(`B${r}:L${r}`); ws.getCell(`B${r}`).value=valor; ws.getCell(`B${r}`).font={size:10}; r++; };
  meta("Data:", dataBR(new Date().toISOString()));
  meta("Número EC | Orçamento:", ec.numero);
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
  const itemStart = r;
  const grupos = new Map();
  for (const l of [...ec.linhas].sort((a,b)=>a.ordem-b.ordem)) { const g=l.grupo||"GERAL"; if(!grupos.has(g)) grupos.set(g,[]); grupos.get(g).push(l); }
  for (const [grupo, ls] of grupos) {
    ws.mergeCells(`A${r}:L${r}`); const gc=ws.getCell(`A${r}`); gc.value=grupo; gc.font={bold:true,size:10,color:{argb:COR.ink}}; gc.fill=fill(COR.soft); gc.border=thin; r++;
    for (const l of ls) {
      const vals=[l.item,l.descricao,l.valorPolobh,l.valorCliente,l.statusAprovacao,l.fornecedorRazao,l.fornecedorCnpj,l.faturaNf,l.codigoServico,l.pedidoCompra,l.statusOs,l.observacao];
      vals.forEach((v,i)=>{ const c=ws.getCell(`${COLS[i]}${r}`); c.value=v; c.font={size:9}; c.border=thin; c.alignment={wrapText:true,vertical:"top"}; if(i===2||i===3){ c.numFmt=moeda; c.alignment={horizontal:"right"}; } });
      r++;
    }
  }
  const itemEnd = r - 1;

  secao("PRODUÇÃO");
  const prodStart = r;
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
    const c=ws.getCell(`C${r}`); c.value=val; c.numFmt=moeda; c.font={size:9};
    [`A${r}`,`B${r}`,`C${r}`,`D${r}`].forEach(a=>ws.getCell(a).border=thin); r++;
  }
  const prodEnd = r - 1;

  // Totais — fórmulas vivas, 2 colunas (C = Pólobh, D = Cliente) como o modelo
  r++;
  const temItens = itemEnd >= itemStart;
  const fSomaC = temItens ? `SUM(C${itemStart}:C${itemEnd})+SUM(C${prodStart}:C${prodEnd})` : `SUM(C${prodStart}:C${prodEnd})`;
  const fSomaD = temItens ? `SUM(D${itemStart}:D${itemEnd})` : undefined;
  const totalRow = (label, desc, cVal, dVal, destaque=false) => {
    const corTxt = destaque ? COR.white : COR.ink;
    const a=ws.getCell(`A${r}`); a.value=label; a.font={bold:true,size:10,color:{argb:corTxt}}; a.alignment={vertical:"middle"};
    const b=ws.getCell(`B${r}`); b.value=desc; b.font={size:9,color:{argb:destaque?COR.white:COR.ink2}}; b.alignment={wrapText:true,vertical:"middle"};
    const setVal=(ref,v)=>{ const c=ws.getCell(ref); c.value=v.formula?{formula:v.formula,result:v.result}:v.result; c.numFmt=moeda; c.font={bold:true,size:10,color:{argb:corTxt}}; c.alignment={horizontal:"right",vertical:"middle"}; };
    if (dVal===null){ ws.mergeCells(`C${r}:D${r}`); setVal(`C${r}`,cVal); }
    else { setVal(`C${r}`,cVal); setVal(`D${r}`,dVal); }
    for (const col of ["A","B","C","D"]) { const c=ws.getCell(`${col}${r}`); c.border=thin; if(destaque) c.fill=fill(COR.primary); else if(col==="A") c.fill=fill(COR.soft); }
    r++;
  };
  const rSoma=r;
  totalRow("Soma dos fornecedores","Serviços de terceiros + produção",{formula:fSomaC,result:t.somaFornecedores},{formula:fSomaD,result:t.somaCliente});
  const rHon=r;
  totalRow("Pólobh","Honorários Serviços de Organização e Planejamento (15%)",{formula:`C${rSoma}*0.15`,result:t.honorariosPolobh},{formula:`D${rSoma}*0.15`,result:t.honorariosCliente});
  const rEnc=r;
  totalRow("Encargos","Incidentes sobre serviços terceiros contratados através da Pólobh (16,33%)",{formula:`C${rSoma}*0.1633`,result:t.encargos},{result:0});
  const rSub=r;
  totalRow("Sub-total","Reembolso Serviços terceiros + Honorários Pólobh + Encargos",{formula:`C${rSoma}+C${rHon}+C${rEnc}`,result:t.subTotalPolobh},{formula:`D${rSoma}+D${rHon}`,result:r2(t.somaCliente+t.honorariosCliente)});
  totalRow("Valor total bruto","Custo total do projeto",{formula:`C${rSub}+D${rSub}`,result:t.valorTotalBruto},null,true);
  ws.getCell(`A${r}`).value="Sendo:"; ws.getCell(`A${r}`).font={bold:true,size:9,italic:true,color:{argb:COR.ink2}}; r++;
  totalRow("Faturamento Pólobh","Valor Total Geral NF Pólobh x Cliente",{formula:`C${rSub}+D${rHon}`,result:t.faturamentoPolobh},null);
  totalRow("Faturamento Terceiros","Valor Total Geral NF's Terceiros x Cliente",{formula:`D${rSoma}`,result:t.faturamentoTerceiros},null);

  // Bloco contratual
  r++;
  ws.getCell(`A${r}`).value="Visto Pólobh:"; ws.getCell(`A${r}`).font={bold:true,size:10};
  ws.mergeCells(`B${r}:C${r}`); ws.getCell(`B${r}`).value=ec.responsavel; ws.getCell(`B${r}`).font={size:10};
  ws.getCell(`D${r}`).value=dataBR(new Date().toISOString()); ws.getCell(`D${r}`).font={size:10}; r++;
  ws.getCell(`A${r}`).value="Validade"; ws.getCell(`A${r}`).font={bold:true,size:10};
  ws.mergeCells(`B${r}:L${r}`); ws.getCell(`B${r}`).value=`Esta Estimativa de Custos | Orçamento é válida por ${ec.validadeDias} dias.`; ws.getCell(`B${r}`).font={size:10}; r+=2;
  ws.mergeCells(`A${r}:L${r}`); ws.getCell(`A${r}`).value="INFORMAÇÕES GERAIS:"; ws.getCell(`A${r}`).font={bold:true,size:10}; r++;
  ws.mergeCells(`A${r}:L${r}`);
  const legal=ws.getCell(`A${r}`);
  legal.value="A aprovação desta proposta, seja por meio de assinatura ou por e-mail, tem força contratual, gera obrigações entre as partes (compatíveis com os descritivos dos serviços e/ou produtos nela relacionados) e pressupõe que o cliente concorda e aceita os termos nela descritos, com os valores devidos à Pólobh (reembolsos, honorários pelos serviços de organização e planejamento e taxa de administração sobre serviços de terceiros) e às empresas contratadas por conta e ordem do cliente para fornecimento de serviços e mercadorias vinculados ao projeto, e promete efetuar o pagamento do valor descrito na linha \"Total Geral NF Pólobh x Cliente\" no prazo máximo de 30 dias a partir da apresentação da(s) nota(s) fiscal(is) da Pólobh, que poderão ser emitidas pela Pólobh Promoções Eireli e MF Promoções Eireli, ambas do mesmo grupo empresarial, em conjunto ou separadamente.";
  legal.font={size:8.5,color:{argb:COR.ink}}; legal.alignment={wrapText:true,vertical:"top",horizontal:"justify"}; ws.getRow(r).height=66; r++;
  ws.mergeCells(`A${r}:L${r}`); ws.getCell(`A${r}`).value="Obs.: Esta EC | Orçamento cancela e substitui todas as anteriores referentes ao mesmo projeto | peça que porventura existam."; ws.getCell(`A${r}`).font={italic:true,size:9}; r+=2;
  ws.getCell(`A${r}`).value="Aprovação do Cliente:"; ws.getCell(`A${r}`).font={bold:true,size:10};
  ws.mergeCells(`B${r}:C${r}`); ws.getCell(`B${r}`).border={bottom:{style:"thin",color:{argb:COR.ink}}};
  ws.getCell(`D${r}`).value="____/____/______"; ws.getCell(`D${r}`).font={size:10}; ws.getRow(r).height=22; r++;
  ws.mergeCells(`A${r}:L${r}`); ws.getCell(`A${r}`).value="Identificação do Signatário: Nome e Identidade Funcional"; ws.getCell(`A${r}`).font={size:9,color:{argb:COR.ink2}}; r++;
  ws.getCell(`A${r}`).value="Protocolo Financeiro Pólobh:"; ws.getCell(`A${r}`).font={bold:true,size:10};
  ws.getCell(`B${r}`).value="Assinatura:"; ws.getCell(`B${r}`).font={size:10};
  ws.getCell(`C${r}`).border={bottom:{style:"thin",color:{argb:COR.ink}}};
  ws.getCell(`D${r}`).value="____/____/______"; ws.getCell(`D${r}`).font={size:10}; ws.getRow(r).height=22;

  ws.pageSetup.printArea=`A1:L${r}`;
  ws.pageSetup.printTitlesRow=`${hr}:${hr}`;

  await mkdir(P("exemplos"), { recursive:true });
  await wb.xlsx.writeFile(P("exemplos", outName));
}

/* ------------------------------- OS -------------------------------- */
/* Espelha src/lib/excel/os.ts — "Modelo Novo": 2 colunas RÓTULO | VALOR. */
async function gerarOs(outName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Pólobh";
  const ws = wb.addWorksheet("OS", {
    pageSetup: {
      paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 92;
  let r = 1;

  const secao = (txt) => { ws.mergeCells(`A${r}:B${r}`); const c=ws.getCell(`A${r}`); c.value=txt; c.font={bold:true,size:11,color:{argb:COR.white}}; c.fill=fill(COR.black); c.alignment={vertical:"middle",horizontal:"center"}; ws.getRow(r).height=22; r++; };
  const sub = (txt) => { ws.mergeCells(`A${r}:B${r}`); const c=ws.getCell(`A${r}`); c.value=txt; c.font={bold:true,size:10,color:{argb:COR.ink}}; c.fill=fill(CINZA); c.alignment={vertical:"middle",horizontal:"center",wrapText:true}; c.border=thin; r++; };
  const linha = (label, valor, o={}) => {
    const a=ws.getCell(`A${r}`); a.value=label; a.font={bold:true,size:10}; a.fill=fill(COR.soft); a.alignment={vertical:"top",wrapText:true}; a.border=thin;
    const b=ws.getCell(`B${r}`);
    b.value = o.formula ? { formula:o.formula, result: typeof valor==="number"?valor:undefined } : (valor ?? "");
    b.font={size:10,italic:!!o.fixo,color:{argb:COR.ink}}; b.alignment={wrapText:true,vertical:"top"}; b.border=thin;
    if (o.money && typeof valor==="number"){ b.numFmt=moeda; b.alignment={vertical:"top",horizontal:"left"}; }
    if (o.numFmt) b.numFmt=o.numFmt;
    r++;
  };

  // cabeçalho
  ws.mergeCells(`A${r}:B${r+1}`);
  const tit=ws.getCell(`A${r}`); tit.value="        Ordem de Serviço";
  tit.font={name:"Calibri",size:16,bold:true,color:{argb:COR.white}}; tit.alignment={vertical:"middle",horizontal:"center"};
  ["A","B"].forEach(c=>{ ws.getCell(`${c}${r}`).fill=fill(COR.black); ws.getCell(`${c}${r+1}`).fill=fill(COR.black); });
  ws.getRow(r).height=26; ws.getRow(r+1).height=26;
  const logo=await readFile(P("public","polobh-logo.png"));
  const id=wb.addImage({ buffer:logo, extension:"png" });
  ws.addImage(id,{ tl:{col:0.15,row:r-0.9}, ext:{width:120,height:52} });
  r+=2;
  linha("Número da OS:", os.numero);
  linha("Projeto:", projeto.titulo);
  linha("Data de emissão:", dataBR(new Date().toISOString()));
  linha("Status da OS:", os.status);

  const cli = cliente;
  secao("DADOS DO CLIENTE");
  linha("Cliente:", cli.nome); linha("Razão Social:", cli.razaoSocial); linha("Endereço:", cli.endereco);
  linha("CNPJ/CPF:", cli.cnpjCpf); linha("Inscrição Estadual:", cli.inscricaoEstadual); linha("Inscrição Municipal:", cli.inscricaoMunicipal);

  const p = projeto;
  secao("DADOS DO PROJETO");
  linha("Título:", p.titulo); linha("Incentivos Fiscais:", p.incentivosFiscais); linha("Data:", dataBR(p.evento));
  linha("Horário:", p.horario); linha("Local:", p.local); linha("Nº Participantes:", p.participantes ?? "");
  linha("Endereço do Local:", p.enderecoLocal); linha("Produtora Responsável:", p.produtoraResponsavel);
  linha("Telefone:", p.telefoneProdutora); linha("E-mail:", p.emailProdutora);

  const f = os.fornecedor; const bnc = f.dadosBancarios;
  secao("DADOS DO FORNECEDOR");
  linha("Fornecedor:", f.nomeFantasia || f.razaoSocial); linha("CNPJ/CPF:", f.cnpj);
  linha("Perfil (MEI / Simples / etc.):", f.perfilTributario); linha("Razão Social:", f.razaoSocial);
  linha("Endereço:", f.endereco); linha("Inscrição Estadual:", f.inscricaoEstadual); linha("Inscrição Municipal:", f.inscricaoMunicipal);
  linha("Conta PJ / PF:", bnc.tipoConta); linha("Banco:", bnc.banco); linha("Agência:", bnc.agencia);
  linha("Conta Corrente:", bnc.conta); linha("Chave Pix:", bnc.chavePix);
  linha("Representante:", f.representante); linha("Telefone:", f.telefone); linha("E-mail:", f.email);

  secao("DETALHAMENTO DA CONTRATAÇÃO");
  linha("Modalidade:", os.modalidade); linha("Descritivo:", os.descritivo); linha("Entrega:", os.entrega);
  const cron=[...os.cronograma].sort((a,c)=>(a.data||"").localeCompare(c.data||""));
  cron.forEach((c,i)=>linha(i===0?"Cronograma do Fornecedor:":"", `${c.etapa||"Etapa"}  —  ${dataBR(c.data)}${c.horario?"  ·  "+c.horario:""}${c.atividades?"  ·  "+c.atividades:""}`));
  const lg=os.logistica;
  [["Transporte Material",lg.transporteMaterial],["Transporte Equipe",lg.transporteEquipe],["Hospedagem Equipe",lg.hospedagem],["Alimentação Equipe",lg.alimentacao],["Estacionamento Carga",lg.estacionamentoCarga],["Estacionamento Equipe",lg.estacionamentoEquipe],["Uniformização Equipe",lg.uniformizacao]]
    .forEach(([nome,val],i)=>linha(i===0?"Logística do Fornecedor:":"", `${nome}: ${val||"____"}`));
  const inf=os.infraestrutura;
  [["Energia",inf.energia],["Internet",inf.internet],["Pontos Elétricos",inf.pontosEletricos],["Estruturas Diversas",inf.estruturas],["Serviços de Apoio",inf.servicosApoio],["ART, Laudos e Certificações",inf.artLaudos]]
    .forEach(([nome,val],i)=>linha(i===0?"Infraestrutura:":"", `${nome}: ${val||"____"}`));
  linha("Observações Gerais:", os.observacoes);

  secao("CREDENCIAMENTO");
  linha("Formulário de Credenciamento:", os.credenciamento.linkFormulario);
  linha("Prazo Limite:", dataBR(os.credenciamento.prazoLimite));

  const orc=os.orcamento;
  secao("ORÇAMENTO");
  linha("Valor do Item na EC do Projeto:", orc.valorEc, {money:true});
  linha("Valor com BV e NF:", orc.valorComBvNf, {money:true});
  linha("Valor Sem BV e Com Nota Fiscal:", orc.valorSemBvComNf, {money:true});
  linha("Valor Sem BV e Sem NF:", orc.valorSemBvSemNf, {money:true});
  orc.parcelas.forEach((x,i)=>linha(i===0?"Prazo de Pagamento (parcelas):":"", `${i+1}ª — ${x.descricao||"Parcela"}: R$ ${(x.valor||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`));
  linha("Documento Fiscal:", orc.documentoFiscal);

  const fin=os.financeiro;
  secao("INFORMAÇÕES A SEREM PREENCHIDAS PELO FINANCEIRO DA PÓLOBH");
  sub("DADOS EMISSÃO — RECIBO SIMPLES | FATURA | NOTA FISCAL | FATURA E NOTA FISCAL");
  linha("Tomador dos Serviços:", fin.tomador==="Polobh"?"Pólobh":fin.tomador);
  const tm = fin.tomador==="Cliente" ? cli : null;
  linha("Razão Social:", tm?.razaoSocial ?? ""); linha("Endereço:", tm?.endereco ?? ""); linha("CNPJ/CPF:", tm?.cnpjCpf ?? "");
  linha("Inscrição Estadual:", tm?.inscricaoEstadual ?? ""); linha("Inscrição Municipal:", tm?.inscricaoMunicipal ?? "");
  linha("Descritivo Nota Fiscal:", fin.descritivoNf);
  linha("CNAE:", fin.cnae); linha("Código de Serviço:", fin.codigoServico);
  linha("Valor unitário:", fin.valorUnitario, {money:true});
  const rTotF=r; linha("Valor total:", fin.valorTotal, {money:true});
  const rDescF=r; linha("Desconto Especial Negociado:", fin.descontoNegociado, {money:true});
  linha("Valor total a pagar:", (fin.valorTotal||0)-(fin.descontoNegociado||0), {money:true, formula:`B${rTotF}-B${rDescF}`});
  const rPctF=r; linha("BV Pólobh — Percentual:", fin.bvPercentual ?? 0, {numFmt:'0.##"%"'});
  linha("BV Pólobh — Valor:", ((fin.valorTotal||0)*(fin.bvPercentual||0))/100, {money:true, formula:`B${rTotF}*B${rPctF}/100`});
  linha("Acerto Financeiro:", fin.acertoFinanceiro);

  const ct=os.contrato;
  const contr = ct.contratante==="Cliente" ? cli : null;
  sub("DADOS PARA CONTRATO");
  linha("Contratante:", ct.contratante==="Polobh"?"Pólobh":ct.contratante);
  linha("Razão Social:", contr?.razaoSocial ?? ""); linha("Endereço:", contr?.endereco ?? ""); linha("CNPJ/CPF:", contr?.cnpjCpf ?? "");
  linha("Inscrição Estadual:", contr?.inscricaoEstadual ?? ""); linha("Inscrição Municipal:", contr?.inscricaoMunicipal ?? "");
  linha("Descritivo dos Serviços e/ou Produtos:", ct.descritivoServicos || fin.descritivoNf || os.descritivo);
  linha("Informações Complementares:", ct.informacoesComplementares);
  linha("Valor unitário:", ct.valorUnitario, {money:true});
  const rTotC=r; linha("Valor total:", ct.valorTotal, {money:true});
  const rDescC=r; linha("Desconto Especial Negociado:", ct.descontoNegociado, {money:true});
  linha("Valor total a pagar:", (ct.valorTotal||0)-(ct.descontoNegociado||0), {money:true, formula:`B${rTotC}-B${rDescC}`});
  linha("Forma de Pagamento:", "Forma de pagamento: à vista, no ato da emissão da nota fiscal / fatura", {fixo:true});
  linha("Observações Gerais:", "Estes valores poderão ser revistos em caso de faltas ou execução parcial dos serviços ora contratados.", {fixo:true});
  linha("Data do Contrato:", dataBR(ct.dataContrato));
  linha("Rubrica:", ct.rubrica);

  ws.pageSetup.printArea=`A1:B${r-1}`;

  await mkdir(P("exemplos"), { recursive:true });
  await wb.xlsx.writeFile(P("exemplos", outName));
}

/* ------------------------------- run -------------------------------- */
const seguro = async (nome, fn) => {
  try { await fn(nome); console.log(`OK -> exemplos/${nome}`); }
  catch (e) {
    if (e.code === "EBUSY") {
      const alt = nome.replace(".xlsx", " (novo).xlsx");
      try { await fn(alt); console.log(`AVISO: ${nome} está aberto no Excel — gravei como exemplos/${alt}`); return; }
      catch (e2) { console.warn(`PULOU ${nome}: ${e2.message}`); return; }
    }
    console.warn(`PULOU ${nome}: ${e.message}`);
  }
};
await seguro("EC_exemplo.xlsx", gerarEc);
await seguro("OS_exemplo.xlsx", gerarOs);
