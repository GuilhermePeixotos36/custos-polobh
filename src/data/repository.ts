/**
 * Camada de repositório (interfaces). A aplicação fala apenas com estas
 * interfaces; a implementação concreta é escolhida pela fábrica em ./index —
 * hoje, Supabase para tudo (não existe mais mock em memória).
 */
import type {
  Area, Checklist, Cliente, CredenciamentoResposta, Ec, EmpresaGrupo, Fornecedor,
  ItemChecklist, ModeloChecklist, Os, Projeto, Usuario,
} from "./types";

export interface ProjetoRepository {
  listar(): Promise<Projeto[]>;
  obter(id: string): Promise<Projeto | undefined>;
  salvar(p: Projeto): Promise<Projeto>;
  /** Arquiva, em uma única operação, todas as ECs e OSs vinculadas ao projeto. */
  arquivarDocumentos(id: string): Promise<void>;
  remover(id: string): Promise<void>;
}

export interface ClienteRepository {
  listar(): Promise<Cliente[]>;
  obter(id: string): Promise<Cliente | undefined>;
  salvar(c: Cliente): Promise<Cliente>;
}

export interface FornecedorRepository {
  listar(): Promise<Fornecedor[]>;
  obter(id: string): Promise<Fornecedor | undefined>;
  porCnpj(cnpj: string): Promise<Fornecedor | undefined>;
  salvar(f: Fornecedor): Promise<Fornecedor>;
}

export interface EcRepository {
  listar(): Promise<Ec[]>;
  obter(id: string): Promise<Ec | undefined>;
  salvar(ec: Ec): Promise<Ec>;
  duplicar(id: string): Promise<Ec>;
  novaVersao(id: string): Promise<Ec>;
  /** Torna esta EC a ativa do projeto (arquiva as demais). Reativa arquivadas. */
  definirAtiva(id: string): Promise<Ec>;
  remover(id: string): Promise<void>;
}

export interface OsRepository {
  listar(): Promise<Os[]>;
  porEc(ecId: string): Promise<Os[]>;
  obter(id: string): Promise<Os | undefined>;
  salvar(os: Os): Promise<Os>;
  proximaSeq(ecId: string): Promise<number>;
  remover(id: string): Promise<void>;
  /** Respostas de credenciamento enviadas pelos fornecedores para esta OS. */
  credenciamentos(osId: string): Promise<CredenciamentoResposta[]>;
  /** IDs das OSs que já receberam ao menos uma resposta de credenciamento (consulta única, p/ as pendências). */
  osComCredenciamento(): Promise<string[]>;
}

export interface AuthRepository {
  /** Lista leve (nome/papel/telefone), usada em @menções, seleção de responsável etc. Sem e-mail real. */
  usuarios(): Promise<Usuario[]>;
  /** Lista completa (com e-mail real do login) — só para quem gerencia usuários, em Configurações. */
  usuariosCompletos(): Promise<Usuario[]>;
  /** Convida um novo usuário por e-mail e cria o perfil correspondente, na área indicada. */
  criarUsuario(dados: { email: string; nome: string; areaId: string; telefone: string }): Promise<Usuario>;
  /** Atualiza nome/telefone/área/e-mail de um usuário existente. */
  atualizarUsuario(dados: { id: string; nome?: string; telefone?: string; areaId?: string; email?: string }): Promise<Usuario>;
}

/** Áreas = grupos de permissão cadastráveis (Configurações → Áreas). */
export interface AreaRepository {
  listar(): Promise<Area[]>;
  salvar(a: Area): Promise<Area>;
  /** Inativa/reativa. Usado quando a área tem usuários e não pode ser excluída. */
  definirAtiva(id: string, ativa: boolean): Promise<Area>;
  remover(id: string): Promise<void>;
}

export interface EmpresasRepository {
  listar(): Promise<EmpresaGrupo[]>;
  salvar(e: EmpresaGrupo): Promise<EmpresaGrupo>;
  definirPadrao(id: string): Promise<void>;
}

/**
 * Check-list (work flow) do projeto.
 *
 * Repare que não existe um `salvar(checklist)` que grave a lista inteira: os
 * itens vão um a um. Duas pessoas mexendo em tarefas diferentes do mesmo
 * projeto é o caso normal aqui, e gravar tudo de uma vez faria uma sobrescrever
 * a outra em silêncio.
 */
export interface ChecklistRepository {
  /** Listas padrão por modalidade (cadastro de Configurações). */
  listarModelos(): Promise<ModeloChecklist[]>;
  salvarModelo(modelo: ModeloChecklist): Promise<ModeloChecklist>;
  /** Check-list de um projeto, com os itens. */
  doProjeto(projetoId: string): Promise<Checklist | undefined>;
  /** Todos os check-lists com itens — visão cronológica e quadro de pendências. */
  listar(): Promise<Checklist[]>;
  /** Grava o check-list recém-gerado (cabeçalho + itens) de uma vez só. */
  criar(checklist: Checklist): Promise<Checklist>;
  salvarItem(item: ItemChecklist): Promise<ItemChecklist>;
  /** Gravação em lote — usada no recálculo de prazos e na ordenação. */
  salvarItens(itens: ItemChecklist[]): Promise<void>;
  removerItem(id: string): Promise<void>;
  /** Apaga o check-list do projeto (usado ao trocar a modalidade). */
  remover(checklistId: string): Promise<void>;
}

export interface Repositorios {
  projetos: ProjetoRepository;
  clientes: ClienteRepository;
  fornecedores: FornecedorRepository;
  ecs: EcRepository;
  oss: OsRepository;
  auth: AuthRepository;
  areas: AreaRepository;
  empresas: EmpresasRepository;
  checklists: ChecklistRepository;
}
