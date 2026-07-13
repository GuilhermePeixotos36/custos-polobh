/**
 * Camada de repositório (interfaces). A aplicação fala apenas com estas
 * interfaces; a implementação concreta é escolhida pela fábrica em ./index.
 * Hoje: mock em memória. Amanhã: Supabase — basta trocar a fábrica.
 */
import type { Anexo, Cliente, CredenciamentoResposta, Ec, EmpresaGrupo, Fornecedor, Os, Projeto, Usuario } from "./types";

export interface ProjetoRepository {
  listar(): Promise<Projeto[]>;
  obter(id: string): Promise<Projeto | undefined>;
  salvar(p: Projeto): Promise<Projeto>;
  remover(id: string): Promise<void>;
}

export interface AnexoRepository {
  listar(projetoId: string): Promise<Anexo[]>;
  enviar(projetoId: string, file: File): Promise<Anexo>;
  remover(id: string, path: string): Promise<void>;
  /** URL assinada temporária para baixar/abrir o anexo. */
  urlAssinada(path: string): Promise<string>;
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
}

export interface AuthRepository {
  usuarios(): Promise<Usuario[]>;
}

export interface EmpresasRepository {
  listar(): Promise<EmpresaGrupo[]>;
  salvar(e: EmpresaGrupo): Promise<EmpresaGrupo>;
  definirPadrao(id: string): Promise<void>;
}

export interface Repositorios {
  projetos: ProjetoRepository;
  anexos: AnexoRepository;
  clientes: ClienteRepository;
  fornecedores: FornecedorRepository;
  ecs: EcRepository;
  oss: OsRepository;
  auth: AuthRepository;
  empresas: EmpresasRepository;
}
