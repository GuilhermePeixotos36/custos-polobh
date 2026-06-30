/**
 * Modelo de domínio do sistema Pólobh (EC e OS).
 * Fonte de verdade: planilhas reais em /reference.
 */

export type Papel = "Admin" | "Direcao" | "Producao" | "Administrativo";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

/* --------------------------- Trilha de auditoria ------------------------- */

export type LogNivel = "info" | "aviso" | "erro";

export type LogCategoria =
  | "Autenticação"
  | "Acesso"
  | "EC"
  | "OS"
  | "Fornecedor"
  | "Cliente"
  | "Configuração"
  | "Exportação"
  | "Sistema";

/** Um evento de auditoria. Estrutura pronta para virar tabela `audit_log`. */
export interface LogEntry {
  id: string;
  ts: string; // ISO 8601
  nivel: LogNivel;
  categoria: LogCategoria;
  acao: string; // identificador técnico, ex.: "auth.login", "ec.atualizar"
  mensagem: string; // descrição legível em pt-BR
  usuario?: string; // nome de quem executou
  papel?: Papel;
  alvoId?: string; // id do registro afetado, quando houver
}

/* ------------------------------- Cliente -------------------------------- */

export interface Representante {
  nome: string;
  cargo: string;
  telefones: string;
  email: string;
}

export interface Cliente {
  id: string;
  nome: string;
  razaoSocial: string;
  endereco: string;
  cnpjCpf: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  representante: Representante;
}

/* ----------------------------- Fornecedor ------------------------------- */

export interface DadosBancarios {
  tipoConta: "PF" | "PJ" | "";
  banco: string;
  agencia: string;
  conta: string;
  chavePix: string;
}

export interface Fornecedor {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  perfilTributario: string; // MEI / Simples / etc. (vem da consulta de CNPJ)
  endereco: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  dadosBancarios: DadosBancarios;
  representante: string;
  telefone: string;
  email: string;
  cnaes?: string[];
}

/* --------------------------------- EC ----------------------------------- */

export type StatusEc =
  | "Rascunho"
  | "Aguardando"
  | "Aprovada"
  | "Reprovada"
  | "Cancelada"
  | "Arquivada";

export type StatusAprovacao = "Pendente" | "OK";
export type StatusOs = "Pendente" | "Emitir" | "OK";

export interface Projeto {
  titulo: string;
  local: string;
  enderecoLocal: string;
  participantes: number | null;
  produtoraResponsavel: string;
  telefoneProdutora: string;
  emailProdutora: string;
  preEvento: string; // ISO date
  evento: string;
  posEvento: string;
  horario: string;
  roteiro: string;
  incentivosFiscais: string;
}

export interface EcLinha {
  id: string;
  grupo: string;
  item: string;
  descricao: string;
  valorPolobh: number;
  valorCliente: number;
  /** Valor total gasto até a presente data no item (para rentabilidade). */
  valorGasto: number;
  statusAprovacao: StatusAprovacao;
  fornecedorRazao: string;
  fornecedorCnpj: string;
  faturaNf: string;
  codigoServico: string;
  pedidoCompra: string;
  statusOs: StatusOs;
  observacao: string;
  ordem: number;
}

/** Valores padrão de produção — editáveis por EC. */
export interface Producao {
  despesasOperacionais: number;
  equipeBH: number; // diária BH
  equipeViagem: number; // diária viagem
  transporteBH: number; // /dia
  transporteViagem: number; // /dia
  alimentacaoBH: number; // /dia
  alimentacaoViagem: number; // /dia
  /** Quantidades para compor o subtotal de produção. */
  qtdDespesas: number;
  qtdEquipeBH: number;
  qtdEquipeViagem: number;
  qtdTransporteBH: number;
  qtdTransporteViagem: number;
  qtdAlimentacaoBH: number;
  qtdAlimentacaoViagem: number;
}

export interface Ec {
  id: string;
  numero: string; // "EC – Cliente – Projeto – V01"
  slugPublico: string; // token não-adivinhável p/ o link público do cronograma
  versao: number;
  status: StatusEc;
  clienteId: string;
  cliente: Cliente; // snapshot embutido (simplicidade)
  projeto: Projeto;
  linhas: EcLinha[];
  producao: Producao;
  responsavel: string; // produtora responsável / visto Pólobh
  validadeDias: number;
  criadoEm: string;
  atualizadoEm: string;
  canceladaSubstituida?: boolean;
}

/* --------------------------------- OS ----------------------------------- */

export type StatusOsDoc = "Rascunho" | "Emitida" | "Disparada" | "Cancelada";

export type Modalidade =
  | "Produto"
  | "Serviço"
  | "Locação"
  | "Produto + Serviço"
  | "Locação + Serviço"
  | "";

export type DocumentoFiscal =
  | "Recibo Simples"
  | "Fatura"
  | "Nota Fiscal"
  | "Fatura e Nota Fiscal"
  | "";

export interface CronogramaItem {
  etapa: string; // Montagem, Alinhamentos/Testes, Ensaios, Evento...
  data: string;
  horario: string;
  atividades: string;
}

export interface Logistica {
  transporteMaterial: string;
  transporteEquipe: string;
  hospedagem: string;
  alimentacao: string;
  estacionamentoCarga: string;
  estacionamentoEquipe: string;
  uniformizacao: string;
}

export interface Infraestrutura {
  energia: string;
  internet: string;
  pontosEletricos: string;
  estruturas: string;
  servicosApoio: string;
  artLaudos: string;
}

export interface Parcela {
  descricao: string;
  valor: number;
}

export interface Orcamento {
  valorEc: number; // auto da EC (somado das linhas consolidadas)
  valorComBvNf: number;
  valorSemBvComNf: number;
  valorSemBvSemNf: number;
  parcelas: Parcela[];
  documentoFiscal: DocumentoFiscal;
}

/** Bloco financeiro Pólobh (restrito a Direção/Administrativo). */
export interface FinanceiroOs {
  tomador: "Polobh" | "Cliente" | "";
  descritivoNf: string;
  cnae: string;
  codigoServico: string;
  valorUnitario: number;
  valorTotal: number;
  descontoNegociado: number;
  valorAPagar: number;
  bvPercentual: number; // %
  bvValor: number; // auto
  /** Justificativa obrigatória quando não há BV ou o BV é < 15%. */
  bvJustificativa: string;
  acertoFinanceiro: string;
}

export interface Credenciamento {
  prazoLimite: string;
  linkFormulario: string;
}

/* Respostas do formulário público de credenciamento (preenchido pelo fornecedor) */
export interface CredenciamentoMembro {
  nome: string;
  cpf: string;
  funcao: string;
}
export interface CredenciamentoVeiculo {
  modelo: string;
  placa: string;
}
export interface CredenciamentoResposta {
  id: string;
  equipe: CredenciamentoMembro[];
  veiculos: CredenciamentoVeiculo[];
  enviadoEm: string;
}

export interface Os {
  id: string;
  numero: string; // "...– OS-01"
  slugCredenciamento: string; // token do link público de credenciamento
  seq: number;
  ecId: string;
  ecNumero: string;
  ecLinhaIds: string[]; // linhas da EC consolidadas
  status: StatusOsDoc;
  fornecedor: Fornecedor; // snapshot
  modalidade: Modalidade;
  descritivo: string;
  entrega: string;
  cronograma: CronogramaItem[];
  logistica: Logistica;
  infraestrutura: Infraestrutura;
  observacoes: string;
  credenciamento: Credenciamento;
  orcamento: Orcamento;
  financeiro: FinanceiroOs;
  criadoEm: string;
  atualizadoEm: string;
}
