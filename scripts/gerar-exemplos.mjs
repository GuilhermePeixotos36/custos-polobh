/**
 * Gera arquivos de exemplo EC e OS em ./exemplos para conferência de fidelidade
 * contra os modelos reais em ./reference. Rode: npm run gerar:exemplos
 *
 * Usa o GERADOR DO APP (src/lib/excel), carregado pelo Vite — e não uma cópia
 * da lógica. A cópia existia aqui e apodreceu: os exemplos continuavam saindo
 * com as barras pretas e a coluna "Observação" de 2022, muito depois de o app
 * ter migrado para os modelos de 2026. Um exemplo que não é o que o sistema
 * gera é pior do que exemplo nenhum — quem confere está conferindo o arquivo
 * errado.
 *
 * Se o arquivo estiver aberto no Excel (EBUSY), grava com sufixo " (novo)".
 */
import { createServer } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = (...p) => join(raiz, ...p);

// O gerador busca a logo por fetch("/polobh-logo.png") — no navegador é a rede,
// aqui é o arquivo do repositório.
const logo = await readFile(P("public", "polobh-logo.png"));
globalThis.fetch = async () => ({
  ok: true,
  arrayBuffer: async () => logo.buffer.slice(logo.byteOffset, logo.byteOffset + logo.byteLength),
});

const servidor = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });
const carregar = (caminho) => servidor.ssrLoadModule(caminho);

const { criarEcExcelBuffer } = await carregar("/src/lib/excel/ec.ts");
const { criarOsExcelBuffer } = await carregar("/src/lib/excel/os.ts");
const { honorariosPadrao, encargosPadrao, producaoPadrao } = await carregar("/src/domain/calc.ts");
const { projetoInfoVazio } = await carregar("/src/domain/projeto.ts");

/* ------------------------- dados de exemplo ------------------------- */
const cliente = {
  id: "c1", apelido: "Mercantil", nome: "BANCO MERCANTIL",
  razaoSocial: "BANCO MERCANTIL DO BRASIL S/A",
  endereco: "Avenida do Contorno, 5800 | 12º andar - Savassi - Belo Horizonte - MG - CEP: 30110-042",
  cnpjCpf: "17.184.037/0001-10", inscricaoEstadual: "062.123.456.0099", inscricaoMunicipal: "123456",
  representante: {
    nome: "Brunna Lopes", cargo: "Gerência de Comunicação e Marketing",
    telefones: "(31) 3057-6369 | (31) 9 9971-5638", email: "brunna.lopes@mercantil.com.br",
  },
};

const projeto = {
  ...projetoInfoVazio(),
  titulo: "Banco Mercantil – Convenção Anual de Lideranças – 2026",
  clienteAbreviado: "Banco Mercantil", nomeProjeto: "Convenção Anual de Lideranças", anoProjeto: "2026",
  modalidade: "Corporativo", local: "Expominas — Pavilhão 1",
  enderecoLocal: "Av. Amazonas, 6200 - Gameleira - Belo Horizonte - MG", participantes: 300,
  produtoraResponsavel: "Marisa M. Coelho", telefoneProdutora: "(31) 9 9100-0000",
  emailProdutora: "producao@polobh.com.br", preEvento: "2026-08-10", evento: "2026-08-15",
  posEvento: "2026-08-16", horario: "08h às 18h",
  roteiro: "Abertura institucional, painéis, almoço e premiação.",
};

const L = (o) => ({
  id: o.id, grupo: "", item: "", descricao: "", descricaoCompleta: "",
  valorPolobh: 0, valorCliente: 0, valorGasto: 0,
  valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [], opcaoValor: "",
  statusAprovacao: "Pendente", fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "",
  faturaNf: "", codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
  observacao: "", observacoes: [], oculto: false, ...o,
});

const linhas = [
  L({
    id: "l1", ordem: 0, grupo: "AUDIOVISUAL", item: "Sonorização",
    descricao: "Sistema de som line array para auditório de 300 lugares, 2 técnicos.",
    descricaoCompleta:
      "<p>Sistema de sonorização profissional dimensionado para o pavilhão, incluindo:</p>" +
      "<ul><li>2 torres de line array com 6 caixas por lado</li>" +
      "<li>4 subgraves e sistema de front fill para as primeiras fileiras</li>" +
      "<li>Mesa digital 32 canais, com operador durante todo o evento</li>" +
      "<li>8 microfones sem fio (6 de mão e 2 headset) e 2 praticáveis de retorno</li></ul>" +
      "<p>Inclui montagem na véspera, passagem de som e desmontagem na madrugada seguinte.</p>",
    valorPolobh: 8500, valorComBvNf: 8500, opcaoValor: "comBvNf",
    statusAprovacao: "OK", fornecedorRazao: "SOM & LUZ PRODUÇÕES LTDA",
    fornecedorCnpj: "12.345.678/0001-90", codigoServico: "03.01", statusOs: "Emitir",
    contratoStatus: "Emitir",
    observacoes: [
      { id: "o1", texto: "Passagem de som confirmada para 12h da véspera.", autorId: "", autorNome: "Marisa M. Coelho", criadoEm: "2026-08-01T10:00:00.000Z", responsavelNome: "", resolvida: false, respostas: [] },
    ],
  }),
  L({
    id: "l2", ordem: 1, grupo: "AUDIOVISUAL", item: "Iluminação cênica",
    descricao: "Projeto de luz com moving heads e operação durante o evento.",
    valorPolobh: 6200, valorSemBvComNf: 6200, opcaoValor: "semBvComNf",
    valoresNaoAplicaveis: ["semBvSemNf"],
    statusAprovacao: "OK", fornecedorRazao: "SOM & LUZ PRODUÇÕES LTDA",
    fornecedorCnpj: "12.345.678/0001-90", statusOs: "Emitir", contratoStatus: "OK",
  }),
  L({
    id: "l3", ordem: 2, grupo: "ESTRUTURA", item: "Palco e backdrop",
    descricao: "Palco 8x4m, praticáveis e backdrop com lona impressa.",
    valorPolobh: 4800, fornecedorRazao: "MONTA TUDO ESTRUTURAS LTDA",
    fornecedorCnpj: "34.567.890/0001-12", pedidoCompra: "PC-2026-118",
  }),
  L({
    id: "l4", ordem: 3, grupo: "GASTRONOMIA", item: "Coffee break",
    descricao: "Coffee break para 300 pessoas, 2 intervalos, equipe de garçons.",
    valorCliente: 9200, statusAprovacao: "OK", fornecedorRazao: "BUFFET SABOR & ARTE EIRELI",
    fornecedorCnpj: "23.456.789/0001-01", faturaNf: "Nota Fiscal",
  }),
];

const ec = {
  id: "ec1", numero: "EC – Banco Mercantil – Convenção Anual de Lideranças – 2026 – V02",
  slugPublico: "", versao: 2, status: "Rascunho", projetoId: "p1", template: "Corporativo",
  clienteId: "c1", cliente, projeto, linhas,
  producao: { ...producaoPadrao(), qtdEquipeBH: 3, qtdTransporteBH: 3, qtdAlimentacaoBH: 3 },
  honorarios: honorariosPadrao(), encargos: encargosPadrao(),
  responsavel: "Marisa M. Coelho", validadeDias: 30,
  criadoEm: "2026-06-20T10:00:00.000Z", atualizadoEm: "2026-06-20T10:00:00.000Z", ativa: true,
};

const os = {
  id: "os1", numero: "EC – Banco Mercantil – Convenção Anual de Lideranças – 2026 – OS-01",
  slugCredenciamento: "demo-os-01", seq: 1, ecId: "ec1", ecNumero: ec.numero,
  ecLinhaIds: ["l1", "l2"], status: "Disparada",
  fornecedor: {
    id: "f1", razaoSocial: "SOM & LUZ PRODUÇÕES LTDA", nomeFantasia: "Som & Luz",
    cnpj: "12.345.678/0001-90", perfilTributario: "Simples Nacional",
    endereco: "Rua da Bahia, 1200 - Centro - Belo Horizonte - MG",
    inscricaoEstadual: "062.987.654.0011", inscricaoMunicipal: "98765",
    dadosBancarios: { tipoConta: "PJ", banco: "Banco do Brasil (001)", agencia: "1234-5", conta: "67890-1", chavePix: "12.345.678/0001-90" },
    representante: "Roberto Dias", telefone: "(31) 9 8888-1122", email: "contato@someluz.com.br",
  },
  modalidade: "Locação + Serviço",
  descritivo:
    "• Sonorização — Sistema de som line array para auditório de 300 lugares, 2 técnicos.\n" +
    "• Iluminação cênica — Projeto de luz com moving heads e operação durante o evento.",
  entrega: "Instalação, operação e acompanhamento técnico.",
  cronograma: [
    { id: "c1", etapa: "Montagem", data: "2026-08-14", horario: "08h", atividades: "Rigging e cabeamento" },
    { id: "c2", etapa: "Evento", data: "2026-08-15", horario: "08h", atividades: "Operação de som e luz" },
  ],
  logistica: {
    transporteMaterial: "Por conta do fornecedor", transporteEquipe: "Por conta do fornecedor",
    hospedagem: "Não se aplica", alimentacao: "Pólobh fornece no local",
    estacionamentoCarga: "Liberado pelo local", estacionamentoEquipe: "Liberado pelo local",
    uniformizacao: "Camisa preta da equipe",
  },
  infraestrutura: {
    energia: "2 pontos trifásicos no palco", internet: "Wi-Fi do local",
    pontosEletricos: "6 pontos de 220V", estruturas: "Box truss fornecido pela Monta Tudo",
    servicosApoio: "—", artLaudos: "ART de elétrica sob responsabilidade do fornecedor",
  },
  observacoes: [
    { id: "obs1", texto: "Passagem de som obrigatória até 12h do dia do evento.", autorId: "", autorNome: "Marisa M. Coelho", criadoEm: "2026-08-01T10:00:00.000Z", responsavelNome: "", resolvida: false, respostas: [] },
  ],
  credenciamento: { prazoLimite: "2026-08-12", linkFormulario: "" },
  orcamento: {
    valorEc: 14700, valorComBvNf: 14700, valorSemBvComNf: 14700, valorSemBvSemNf: 13800,
    parcelas: [{ descricao: "50% na montagem", valor: 7350 }, { descricao: "50% pós-evento", valor: 7350 }],
    documentoFiscal: "Nota Fiscal",
  },
  financeiro: {
    tomador: "Cliente", descritivoNf: "Locação de equipamentos de áudio e iluminação com operação técnica.",
    cnae: "9001-9/06", codigoServico: "03.01", valorUnitario: 14700, valorTotal: 14700,
    descontoNegociado: 0, valorAPagar: 14700, bvPercentual: 10, bvValor: 1470,
    bvJustificativa: "", acertoFinanceiro: "Pagamento via PIX CNPJ.",
  },
  contrato: {
    contratante: "Cliente", descritivoServicos: "",
    informacoesComplementares: "Montagem concluída até 12h da véspera.",
    valorUnitario: 14700, valorTotal: 14700, descontoNegociado: 0, valorAPagar: 14700,
    dataContrato: "2026-08-01", rubrica: "MMC",
  },
  criadoEm: "2026-08-01T10:00:00.000Z", atualizadoEm: "2026-08-01T10:00:00.000Z",
};

/* ------------------------------ escrita ------------------------------ */
async function gravar(nome, buffer) {
  const destino = P("exemplos", nome);
  try {
    await writeFile(destino, Buffer.from(buffer));
    console.log(`OK -> exemplos/${nome}`);
  } catch (e) {
    if (e?.code !== "EBUSY" && e?.code !== "EPERM") throw e;
    const alternativo = nome.replace(/\.xlsx$/, " (novo).xlsx");
    await writeFile(P("exemplos", alternativo), Buffer.from(buffer));
    console.log(`Arquivo em uso — gravado como exemplos/${alternativo}`);
  }
}

await mkdir(P("exemplos"), { recursive: true });
const ecCompleta = await criarEcExcelBuffer(ec, "completa");
await gravar("EC_exemplo.xlsx", ecCompleta.buffer);
const ecFinanceira = await criarEcExcelBuffer(ec, "financeiro");
await gravar("EC_exemplo_financeiro.xlsx", ecFinanceira.buffer);
const osExemplo = await criarOsExcelBuffer(os, ec, { incluirFinanceiro: true });
await gravar("OS_exemplo.xlsx", osExemplo.buffer);

await servidor.close();
