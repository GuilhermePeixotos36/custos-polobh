/**
 * Modelo de domínio do sistema Pólobh (EC e OS).
 * Fonte de verdade: planilhas reais em /reference.
 */

/**
 * Nível de segurança de dados. Governa a RLS no banco (`papel_atual()`) — por
 * isso continua sendo um conjunto fechado. Quem escolhe as telas é a Área.
 */
export type Papel = "Admin" | "Direcao" | "Producao" | "Administrativo";

/**
 * Grupo de permissão cadastrável ("área", no vocabulário da Pólobh).
 * `recursos` são chaves do tipo `Recurso` (src/store/auth.ts) — as telas que a
 * área vê/edita. `papelBase` é o nível de segurança herdado no banco.
 */
export interface Area {
  id: string;
  nome: string;
  papelBase: Papel;
  recursos: string[];
  /** Área inativa não pode ser atribuída a novos usuários; quem já está nela mantém o acesso. */
  ativa: boolean;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  papel: Papel;
  /** Área à qual o usuário pertence (define suas telas). */
  areaId?: string;
  /** Nome da área, para exibição em listas. */
  areaNome?: string;
}

/** Empresa emissora do grupo Pólobh (dados fiscais usados na OS). */
export interface EmpresaGrupo {
  id: string; // slug estável ("polobh", "mf")
  nome: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  padrao: boolean;
  ordem: number;
}

/* --------------------------- Trilha de auditoria ------------------------- */

export type LogNivel = "info" | "aviso" | "erro";

export type LogCategoria =
  | "Autenticação"
  | "Acesso"
  | "Projeto"
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
  /** Apelido único do cliente, reutilizado como prefixo dos novos projetos. */
  apelido: string;
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
  /**
   * Nome curto pelo qual a casa chama o fornecedor — é ele que entra no título
   * da OS (ver `numeroOs`). Diferente do nome fantasia, que vem do cadastro na
   * Receita: aqui quem escolhe é a Pólobh.
   */
  apelido?: string;
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
  /**
   * A agenda do fornecedor: as PESSOAS com quem se fala ali dentro.
   *
   * Diferente de `representante`/`telefone`/`email`, que são o contato único da
   * empresa e vão para a OS. Aqui moram os vários: quem atende a produção, quem
   * resolve nota fiscal, o sócio. Cada vez que alguém informa um contato numa
   * EC, ele entra nesta lista se ainda não estiver.
   */
  contatos?: ContatoFornecedor[];
}

/**
 * Uma pessoa dentro do fornecedor.
 *
 * Isto já foi UMA LINHA DE TEXTO — "Maria — (31) 9…" — e era ruim exatamente
 * onde mais importava: não dava para ligar com um toque no celular, não dava
 * para mandar e-mail, não dava para ordenar, e "qual delas cuida de nota
 * fiscal?" só se descobria perguntando. Separado, cada pedaço serve para
 * alguma coisa.
 *
 * Todos os campos são opcionais menos a existência de ALGUM: um contato só com
 * o telefone é um contato legítimo — é o que sobra de um recado às pressas.
 */
export interface ContatoFornecedor {
  nome: string;
  /** O que a pessoa é ali dentro: "Produção", "Financeiro", "Sócia". */
  funcao?: string;
  telefone?: string;
  email?: string;
}

/* --------------------------------- EC ----------------------------------- */

/**
 * O que o app GRAVA em `ecs.status`. A EC tem dois estados — no ar ou no
 * arquivo (ver `domain/ec`) —, e a coluna acompanha a bandeira `ativa`: quem
 * decide é ela, e o banco normaliza o status em toda gravação (migração
 * `20260909100000`).
 */
export type StatusEc = "Ativa" | "Arquivada" | StatusEcLegado;

/**
 * Selos do antigo fluxo de aprovação do cliente, que não existe mais. Podem vir
 * de linhas gravadas antes da normalização; nada no app os escreve, e a leitura
 * da situação os ignora de propósito.
 */
type StatusEcLegado = "Rascunho" | "Aguardando" | "Aprovada" | "Reprovada" | "Cancelada";

export type StatusAprovacao = "Pendente" | "OK";
export type StatusOs = "Pendente" | "Emitir" | "Emitir Nova Versão" | "OK" | "Não se Aplica";
export type DocumentoPg = "" | "Fatura" | "Nota Fiscal" | "Fatura e Nota Fiscal" | "Recibo Simples" | "Não se aplica";

/**
 * Arquivo pendurado num comentário — SÓ nas tarefas do check-list.
 *
 * Aqui mora apenas a FICHA do arquivo; os bytes ficam no bucket
 * `anexos-checklist` do Supabase Storage, e `caminho` é a chave que os acha. O
 * bucket é fechado: para abrir, a tela pede um link assinado de curta duração.
 *
 * EC e OS não têm anexo de propósito — ver `domain/anexos`.
 */
export interface AnexoObservacao {
  id: string;
  /** Caminho dentro do bucket (`<itemId>/<id>-<nome-seguro>`). */
  caminho: string;
  /** Nome como a pessoa mandou — é este que ela vê e baixa. */
  nome: string;
  tamanho: number; // bytes
  tipo: string; // MIME
  enviadoPorNome: string;
  enviadoEm: string; // ISO 8601
}

/** Resposta a uma observação (thread) — mantém a discussão até a pendência ser resolvida. */
export interface RespostaObservacao {
  id: string;
  texto: string;
  autorId: string;
  autorNome: string;
  criadoEm: string; // ISO 8601
  /** Arquivos leves da resposta (só check-list). */
  anexos?: AnexoObservacao[];
}

/**
 * Observação (comentário) de um item da EC — feed estilo chat. Cada uma tem o
 * autor (usuário que escreveu) e pode ser endereçada a um responsável (usuário do
 * sistema). Enquanto aberta (não resolvida), é uma PENDÊNCIA daquele responsável.
 * Só o autor pode editar/excluir a própria observação.
 */
export interface Observacao {
  id: string;
  texto: string;
  autorId: string;
  autorNome: string;
  criadoEm: string; // ISO 8601
  /** Usuário a quem a observação está endereçada (gera a pendência dele). */
  responsavelNome?: string;
  /** Resolvida = a pendência foi encerrada (fica no histórico, pode ser excluída). */
  resolvida?: boolean;
  resolvidoPorNome?: string;
  resolvidoEm?: string;
  /** Thread de respostas dos usuários. */
  respostas?: RespostaObservacao[];
  /** Arquivos leves do comentário (só check-list — ver `domain/anexos`). */
  anexos?: AnexoObservacao[];
}

export type ModalidadeProjeto = "Corporativo" | "Cultural" | "";
export type EtapaCronogramaProjeto = "montagem" | "alinhamentos" | "ensaios" | "evento" | "desmontagem";

export interface FaixaCronogramaProjeto {
  id: string;
  data: string;
  inicio: string;
  fim: string;
}

export type CronogramaProjeto = Record<EtapaCronogramaProjeto, FaixaCronogramaProjeto[]>;

/** Bloco adicional do cronograma, criado pelo usuário além das cinco etapas padrão. */
export interface BlocoCronogramaExtra {
  id: string;
  titulo: string;
  faixas: FaixaCronogramaProjeto[];
}

export interface RoteirosProjeto {
  preEvento: string;
  evento: string;
  posEvento: string;
}

/** Bloco adicional de roteiro, criado pelo usuário além das três etapas padrão. */
export interface RoteiroExtraProjeto {
  id: string;
  titulo: string;
  conteudo: string;
}

export interface ProjetoInfo {
  /** Composto automaticamente a partir de clienteAbreviado + nomeProjeto + anoProjeto. */
  titulo: string;
  clienteAbreviado: string;
  nomeProjeto: string;
  anoProjeto: string;
  modalidade: ModalidadeProjeto;
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
  cronograma: CronogramaProjeto;
  /** Blocos adicionais, livres, do cronograma. */
  cronogramaExtras: BlocoCronogramaExtra[];
  /** Ordem de exibição das etapas padrão e dos blocos adicionais do cronograma. */
  cronogramaOrdem: string[];
  /** Etapas do cronograma ocultadas pelo usuário (ficam recolhidas, mas os dados não são perdidos). */
  etapasOcultas: EtapaCronogramaProjeto[];
  roteiros: RoteirosProjeto;
  /** Seções do roteiro ocultadas pelo usuário (ficam recolhidas, mas os dados não são perdidos). */
  roteirosOcultos: (keyof RoteirosProjeto)[];
  /** Blocos adicionais, livres, do roteiro. */
  roteirosExtras: RoteiroExtraProjeto[];
  /** Ordem de exibição das etapas padrão e dos blocos adicionais do roteiro. */
  roteiroOrdem: string[];
}

/**
 * As três formas de cobrar um item. Os rótulos de tela/planilha vivem em
 * `OPCOES_VALOR_ITEM`, em domain/calc.
 *
 * Não existe mais um "" de "ninguém escolheu ainda": na EC as três são
 * informação lado a lado, e não uma escolha — quem decide a condição de
 * pagamento é a OS (revisão de 09/09/2026).
 */
export type OpcaoValorDefinida = "comBvNf" | "semBvComNf" | "semBvSemNf";

/**
 * BV do item: a bonificação que o fornecedor dá à Pólobh.
 *
 * Vale só quando a forma de cobrança escolhida é "com BV e NF" — nas outras
 * duas, por definição, não há BV, e o que resta é a justificativa de por quê.
 * Mesmo formato de honorários e encargos da EC, para ser o mesmo raciocínio.
 */
export interface BvItem {
  /** Percentual sobre o valor com BV do item, ou valor fixo em R$. */
  modo: "percentual" | "fixo";
  /** O número combinado: % quando percentual, R$ quando fixo. */
  valor: number;
  /** Por que o BV está fora do padrão da casa (sem BV, ou abaixo de 15%). */
  justificativa: string;
}

/* ------------------- A contratação: o que a OS decide pagar --------------- */

/**
 * Uma das três formas de cobrança, já decidida na OS.
 *
 * Na EC as três são informação lado a lado; aqui cada uma vale ou não vale, e
 * por quanto. A justificativa é UMA POR FORMA (na EC era uma por item): ali só
 * uma valia, aqui as três convivem na mesma tabela e cada uma responde por si.
 */
export interface OpcaoContratacaoOs {
  /** A forma não vale para este item nesta contratação. */
  naoSeAplica: boolean;
  /** O valor NEGOCIADO — chega da EC e segue editável, que a OS é acordo. */
  valor: number;
  /** Por que sem BV, ou com BV fora do padrão da casa. */
  justificativaBv: string;
}

/** O que foi fechado para UM item da EC dentro desta OS (ver `domain/contratacaoOs`). */
export interface ItemContratacaoOs {
  /** Item da EC a que esta decisão pertence. */
  ecLinhaId: string;
  comBvNf: OpcaoContratacaoOs;
  /** O BV combinado — só existe na cobrança com BV e NF, e por isso mora fora dela. */
  bv: { modo: "percentual" | "fixo"; valor: number };
  semBvComNf: OpcaoContratacaoOs;
  semBvSemNf: OpcaoContratacaoOs;
}

export interface EcLinha {
  id: string;
  grupo: string;
  item: string;
  /** Descrição Financeiro: descrição resumida do item (era o antigo `descricao`). */
  descricao: string;
  /** Descrição Completa: detalhamento do item em rich-text (HTML com bullets/negrito). */
  descricaoCompleta: string;
  valorPolobh: number;
  valorCliente: number;
  /** Valor total gasto até a presente data no item (para rentabilidade). */
  valorGasto: number;
  /**
   * As três formas de cobrar ESTE item, levantadas pela produção. A OS consolida
   * vários itens e cada um é negociado do seu jeito — um sai com nota, outro
   * sem, outro com BV —, então o preço de cada forma mora no item.
   *
   * Aqui elas são INFORMAÇÃO: as três seguem lado a lado para a OS, que é onde
   * se decide por qual delas o item vai ser pago. Na EC não há escolha.
   */
  valorComBvNf: number;
  valorSemBvComNf: number;
  valorSemBvSemNf: number;
  /**
   * Formas que NÃO SE APLICAM a este item. Cada um dos três campos é uma coisa
   * ou outra: um valor digitado ou "Não se aplica" — e as duas respostas são
   * diferentes de "ainda não preenchi", que é o campo em branco.
   */
  valoresNaoAplicaveis: OpcaoValorDefinida[];
  /**
   * BV combinado com o fornecedor NESTE item.
   *
   * Ele é negociado junto com o valor, e uma OS consolida vários itens do mesmo
   * fornecedor — cada um podendo ter saído com um BV diferente. Por isso mora
   * aqui, e a OS soma o dos itens que consolida.
   */
  bv: BvItem;
  statusAprovacao: StatusAprovacao;
  fornecedorRazao: string;
  fornecedorCnpj: string;
  /** Contato do fornecedor informado nesta linha (acumula no cadastro do fornecedor). */
  fornecedorContato: string;
  faturaNf: DocumentoPg;
  codigoServico: string;
  pedidoCompra: string;
  statusOs: StatusOs;
  /** Contrato: Pendente | Emitir | OK | Não se Aplica. */
  contratoStatus: StatusOs;
  /** @deprecated Observação legada (texto único). Migrada para `observacoes`. */
  observacao: string;
  /** Observações do item (comentários com pessoa responsável). */
  observacoes: Observacao[];
  /** Item ocultado da EC (fica guardado, some da visão e do Excel; pode reexibir). */
  oculto: boolean;
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

/* ------------------------------- Projeto -------------------------------- */

export type TemplateEc = "Corporativo" | "Cultural" | "";
export type StatusProjeto = "Ativo" | "Arquivado" | "Concluido" | "Cancelado";

/**
 * Projeto = container de tudo (segue a hierarquia project-centric).
 * Guarda Cliente + informações do projeto + roteiro + link de documentos,
 * e é dono das ECs (que podem ter versões).
 */
/**
 * As abas do projeto que têm CONVERSA — o corredor de cada etapa.
 *
 * "Dados Gerais" e "Check-list" ficam de fora de propósito: a primeira é o
 * cadastro do evento, e a segunda já é feita de tarefas com dono e prazo, que é
 * uma forma melhor de cobrar alguém do que um comentário.
 */
export const ABAS_COM_CONVERSA = ["ec", "os", "fornecedores", "cronograma", "credenciamento"] as const;
export type AbaComConversa = (typeof ABAS_COM_CONVERSA)[number];

export interface Projeto {
  id: string;
  nome: string;
  cliente: Cliente;
  info: ProjetoInfo; // título, modalidade, datas, local, participantes, produtora, roteiro
  docsUrl: string;
  status: StatusProjeto;
  /**
   * A conversa geral de cada aba: "@Marisa o palco não respondeu o
   * credenciamento". Interna — nunca sai em documento, e-mail ou planilha.
   *
   * Gravada por caminho próprio, uma aba de cada vez (`salvarConversa`):
   * comentar não é editar o projeto, e duas pessoas conversando em abas
   * diferentes não podem apagar a mensagem uma da outra.
   */
  conversas?: Partial<Record<AbaComConversa, Observacao[]>>;
  criadoEm: string;
  atualizadoEm: string;
}

/* --------------------------------- EC ----------------------------------- */

/** Configuração de uma taxa da EC: percentual (fração, ex.: 0,15) ou valor fixo em R$. */
export interface TaxaConfig {
  modo: "percentual" | "fixo";
  valor: number;
  /**
   * Taxa mínima em R$ (piso). Só vale no modo percentual: quando o percentual
   * rende menos que este valor, cobra-se o mínimo; quando rende mais, vale o
   * percentual. Ausente ou 0 = sem piso.
   */
  minimo?: number;
}

export interface Ec {
  id: string;
  numero: string; // "EC – Cliente – Projeto – V01"
  slugPublico: string; // token não-adivinhável p/ o link público do cronograma
  versao: number;
  status: StatusEc;
  projetoId: string; // Projeto (container) a que esta EC pertence
  template: TemplateEc; // tipo de modelo usado ("Corporativo" | "Cultural" | "")
  clienteId: string;
  cliente: Cliente; // snapshot embutido (simplicidade)
  projeto: ProjetoInfo;
  linhas: EcLinha[];
  /**
   * Observações GERAIS da EC — a conversa da equipe sobre o evento inteiro,
   * antes de ela se dividir item a item.
   *
   * É o corredor onde alguém escreve "@Marisa o cliente cortou o coffee break"
   * e a equipe combina o que fazer. Cada pessoa depois trata o que é dela
   * DENTRO do item, na thread do item — as duas conversas convivem: esta é a
   * pauta do evento, aquela é o acerto de um custo.
   *
   * Não sai em documento, e-mail nem planilha: é interna, como as observações
   * dos itens. Gravada por caminho próprio (`salvarObservacoes`), fora do
   * salvamento da EC — comentar não é editar a estimativa, e uma conversa não
   * pode esbarrar na trava de edição de quem está mexendo nos custos.
   */
  observacoes: Observacao[];
  producao: Producao;
  /** Honorários Pólobh — % sobre a soma dos fornecedores ou valor fixo (padrão 15%). */
  honorarios: TaxaConfig;
  /** Encargos — % sobre a soma dos fornecedores ou valor fixo (padrão 16,33%). */
  encargos: TaxaConfig;
  /** Rótulo editável de Honorários no resumo/planilha (vazio = usa o padrão). */
  honorariosRotulo?: string;
  /** Rótulo editável de Encargos no resumo/planilha (vazio = usa o padrão). */
  encargosRotulo?: string;
  responsavel: string; // produtora responsável / visto Pólobh
  validadeDias: number;
  criadoEm: string;
  atualizadoEm: string;
  canceladaSubstituida?: boolean;
  /** Apenas uma EC fica ativa por projeto; as demais versões ficam arquivadas. */
  ativa: boolean;
}

/* --------------------------------- OS ----------------------------------- */

export type StatusOsDoc = "Rascunho" | "Emitida" | "Disparada" | "Cancelada" | "Arquivada";

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
  /** Chave estável de UI (React). Opcional: registros antigos não têm. */
  id?: string;
  etapa: string; // Montagem, Alinhamentos/Testes, Ensaios, Evento...
  data: string;
  horario: string;
  atividades: string;
}

/** Um dos itens de Logística do Fornecedor (ver `CAMPOS_LOGISTICA` em domain/os). */
export type CampoLogistica =
  | "transporteMaterial"
  | "transporteEquipe"
  | "hospedagem"
  | "alimentacao"
  | "estacionamentoCarga"
  | "estacionamentoEquipe"
  | "uniformizacao";

export interface Logistica {
  transporteMaterial: string;
  transporteEquipe: string;
  hospedagem: string;
  alimentacao: string;
  estacionamentoCarga: string;
  estacionamentoEquipe: string;
  uniformizacao: string;
  /**
   * Itens que NÃO SE APLICAM a esta OS. Eles somem do documento impresso, do
   * que vai por e-mail e da planilha — "Hospedagem: ____" numa OS de locação
   * só faz o fornecedor procurar o que responder.
   *
   * É diferente de campo vazio: vazio é pergunta sem resposta, "não se aplica"
   * é resposta. O valor digitado não é apagado ao marcar (quem marcou por
   * engano volta atrás sem perder o que escreveu).
   */
  naoAplicaveis?: CampoLogistica[];
}

/** Um dos itens de Infraestrutura (ver `CAMPOS_INFRAESTRUTURA` em domain/os). */
export type CampoInfraestrutura =
  | "energia"
  | "internet"
  | "pontosEletricos"
  | "estruturas"
  | "servicosApoio"
  | "artLaudos";

export interface Infraestrutura {
  energia: string;
  internet: string;
  pontosEletricos: string;
  estruturas: string;
  servicosApoio: string;
  artLaudos: string;
  /** Itens que não se aplicam a esta OS — mesma regra da Logística. */
  naoAplicaveis?: CampoInfraestrutura[];
}

export interface Parcela {
  /** Chave estável de UI (React). Opcional: registros antigos não têm. */
  id?: string;
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
  /** Nome do projeto incentivado (aparece no descritivo da NF e no contrato). */
  projetoIncentivado?: string;
  /**
   * Lei de incentivo à cultura COM o número do projeto — um campo só.
   *
   * Eram dois (`leiIncentivo` + `numeroProjetoIncentivado`), e a separação não
   * pagava o que custava: a lei e o número nunca aparecem um sem o outro, e o
   * Projeto já guarda os dois juntos numa string (`incentivosFiscais`:
   * "Lei Federal de Incentivo à Cultura (Rouanet) — PRONAC 26 1234"). Partir
   * isso em dois obrigava a redigitar na OS o que a EC já sabia. Agora este
   * campo nasce preenchido com a string inteira do Projeto.
   */
  leiIncentivo?: string;
  cnae: string;
  codigoServico: string;
  valorUnitario: number;
  valorTotal: number;
  descontoNegociado: number;
  valorAPagar: number;
  /**
   * Como o fornecedor recebe o que a nota cobra — o campo que FECHA o bloco de
   * emissão, logo depois do valor a pagar (revisão de 09/09/2026). É outra
   * coisa que a forma de pagamento do CONTRATO: aquela é cláusula contratual, e
   * existe só quando há contrato; esta acompanha a nota, e existe sempre.
   */
  formaPagamento?: string;
  bvPercentual: number; // %
  bvValor: number; // auto
  /**
   * @deprecated A justificativa do BV é UMA POR FORMA, dentro de cada item da
   * contratação (`ItemContratacaoOs.comBvNf.justificativaBv` e companhia) — é lá
   * que o BV é combinado. O campo continua no tipo e na tabela só para não
   * perder o que já foi escrito nas OS antigas; a tela não o mostra mais e nada
   * o exige (revisão de 09/09/2026).
   */
  bvJustificativa: string;
  acertoFinanceiro: string;
}

export interface Credenciamento {
  prazoLimite: string;
  linkFormulario: string;
}

/** Bloco "Dados para Contrato" da OS (modelo Pólobh). */
export interface ContratoOs {
  contratante: "Polobh" | "Cliente" | "";
  descritivoServicos: string; // parte do descritivo NF, editável
  informacoesComplementares: string;
  valorUnitario: number;
  valorTotal: number;
  descontoNegociado: number;
  valorAPagar: number;
  /** Forma de pagamento (ex.: "À vista, no ato da emissão da nota fiscal"). */
  formaPagamento?: string;
  /** Observações gerais do contrato. */
  observacoesGerais?: string;
  dataContrato: string; // ISO date
  rubrica: string;
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
  /**
   * A CONTRATAÇÃO: o que se decidiu pagar, item a item (ver
   * `domain/contratacaoOs`). Nasce dos valores levantados na EC e segue
   * editável — é aqui que se fecha a condição com o fornecedor, e é daqui que
   * sai o Resumo dos Custos do documento.
   */
  itens: ItemContratacaoOs[];
  status: StatusOsDoc;
  fornecedor: Fornecedor; // snapshot
  /**
   * Dados gerais do evento COMO ESTAVAM na emissão desta OS — o bloco "Dados do
   * Projeto" que o fornecedor recebeu impresso.
   *
   * É um snapshot de propósito. A OS lia esses dados direto da EC, e então
   * qualquer edição posterior no projeto ou na EC reescrevia, em silêncio, um
   * documento que já estava na mão do fornecedor. Com a foto guardada aqui, a
   * OS emitida é imutável: mudou o evento? Gera-se uma NOVA VERSÃO da OS (ver
   * `domain/mudancasEvento`), e a anterior continua contando a história que
   * contava.
   */
  projeto: ProjetoInfo;
  /** Bloco "Dados do Cliente" da OS, congelado na emissão pelo mesmo motivo. */
  cliente: Cliente;
  modalidade: Modalidade;
  descritivo: string;
  entrega: string;
  cronograma: CronogramaItem[];
  logistica: Logistica;
  infraestrutura: Infraestrutura;
  /**
   * Observações gerais da OS em TEXTO LIVRE, escritas para o fornecedor ler.
   * Saem no documento impresso, no e-mail e na planilha.
   */
  observacoesGerais: string;
  /**
   * Thread INTERNA de comentários e pendências da OS (mesmo padrão dos itens da
   * EC, com @menção e responsável). Não sai em documento, e-mail nem planilha —
   * para isso existe `observacoesGerais`.
   */
  observacoes: Observacao[];
  credenciamento: Credenciamento;
  orcamento: Orcamento;
  financeiro: FinanceiroOs;
  contrato: ContratoOs;
  criadoEm: string;
  atualizadoEm: string;
}

/* -------------------------- HELP DESK / CHAMADOS -------------------------- */

/**
 * De quem é a vez num chamado — o mesmo "batata quente" das conversas do resto
 * do app. O status não é digitado: ele decorre de quem falou por último.
 */
export type StatusChamado = "Aberto" | "Respondido" | "Resolvido";

/** Uma fala dentro do chamado, depois da abertura. */
export interface MensagemChamado {
  id: string;
  texto: string;
  autorNome: string;
  autorEmail: string;
  /** Veio do suporte? É o que decide o lado em que a mensagem aparece. */
  suporte: boolean;
  criadoEm: string;
}

/**
 * Um chamado do Help Desk.
 *
 * O e-mail continua saindo — é ele que AVISA —, mas a informação mora aqui: a
 * conversa acontece dentro do app, e quem abriu acompanha sem depender da caixa
 * de entrada.
 */
export interface Chamado {
  id: string;
  /** Quem abriu. Nulo quando o usuário foi desligado — o chamado sobrevive. */
  abertoPor: string | null;
  autorNome: string;
  autorEmail: string;
  tipo: string;
  assunto: string;
  descricao: string;
  /** Onde a pessoa estava e em que navegador — preenchidos pelo sistema. */
  tela: string;
  ambiente: string;
  status: StatusChamado;
  mensagens: MensagemChamado[];
  criadoEm: string;
  atualizadoEm: string;
}

/* ------------------------------ CHECK-LIST ------------------------------- */

/** Status de um item do check-list (work flow do projeto). */
export type StatusChecklist = "Pendente" | "Em andamento" | "Concluído" | "Não se aplica";

/**
 * Onde a tarefa cai no calendário do projeto. Duas réguas, porque a produção de
 * evento tem dois tipos de tarefa:
 *
 *  - `percentual` — distribui a tarefa proporcionalmente ao período completo do
 *    projeto (0 = início, 1 = fim). É a régua pedida no briefing e serve bem
 *    para o miolo da produção, que "estica" junto com o projeto.
 *  - `ancora` — fixa a tarefa a uma distância em dias do DIA DO EVENTO
 *    (negativo = antes, positivo = depois). Serve para o que não estica:
 *    credenciamento fecha 7 dias antes do evento, seja o projeto de 2 meses ou
 *    de 2 anos.
 */
export interface RegraPrazoChecklist {
  modo: "percentual" | "ancora";
  /** Modo percentual: fração de 0 a 1 do período do projeto. */
  percentual?: number;
  /** Modo âncora: dias em relação ao evento (ex.: -7 = uma semana antes). */
  diasDoEvento?: number;
}

/** Item de uma lista padrão (o "molde" de onde nascem os itens do projeto). */
export interface ItemModeloChecklist {
  id: string;
  titulo: string;
  descricao: string;
  /** Agrupador na tela (ex.: "PRÉ-PRODUÇÃO", "MONTAGEM", "PÓS-EVENTO"). */
  etapa: string;
  prazo: RegraPrazoChecklist;
  /** Sugestão de responsável — pode ficar vazio e ser definido no projeto. */
  responsavelPadrao: string;
  ordem: number;
}

/**
 * Lista padrão de tarefas de uma modalidade. É o cadastro que a Coordenação
 * mantém em Configurações e de onde o sistema instancia o check-list de cada
 * projeto novo.
 */
export interface ModeloChecklist {
  id: string;
  modalidade: ModalidadeProjeto;
  nome: string;
  itens: ItemModeloChecklist[];
  atualizadoEm: string;
}

/** Item do check-list de um projeto — o que a equipe de fato acompanha. */
export interface ItemChecklist {
  id: string;
  checklistId: string;
  /** Item de modelo que originou este (vazio quando criado à mão no projeto). */
  origemModeloItemId: string;
  titulo: string;
  descricao: string;
  etapa: string;
  status: StatusChecklist;
  /** Data-limite (ISO). Calculada pelo motor de prazos ou definida à mão. */
  dataLimite: string;
  /**
   * Data-limite editada à mão. Quando verdadeiro, recalcular os prazos do
   * projeto NÃO sobrescreve esta data — o ajuste da pessoa vale mais que a régua.
   */
  dataManual: boolean;
  /** Quando o item foi concluído (ISO) — vazio enquanto não conclui. */
  concluidoEm: string;
  concluidoPor: string;
  responsavel: string;
  /** Thread de observações — mesmo formato e comportamento dos itens da EC. */
  observacoes: Observacao[];
  /** Item recolhido da visão principal (some da lista, não é apagado). */
  oculto: boolean;
  ordem: number;
}

/** Check-list de um projeto: uma lista, instanciada a partir de um modelo. */
export interface Checklist {
  id: string;
  projetoId: string;
  modalidade: ModalidadeProjeto;
  /** Modelo que originou a lista — rastreia de onde os itens vieram. */
  modeloId: string;
  itens: ItemChecklist[];
  criadoEm: string;
  atualizadoEm: string;
}
