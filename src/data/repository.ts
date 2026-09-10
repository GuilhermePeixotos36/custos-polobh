/**
 * Camada de repositório (interfaces). A aplicação fala apenas com estas
 * interfaces; a implementação concreta é escolhida pela fábrica em ./index —
 * hoje, Supabase para tudo (não existe mais mock em memória).
 */
import type {
  AbaComConversa, AnexoObservacao, Area, Chamado, Checklist, Cliente, CredenciamentoResposta, Ec, EmpresaGrupo, Fornecedor,
  ItemChecklist, ModeloChecklist, Observacao, Os, Projeto, ProjetoInfo, Usuario,
} from "./types";

export interface ProjetoRepository {
  listar(): Promise<Projeto[]>;
  obter(id: string): Promise<Projeto | undefined>;
  salvar(p: Projeto): Promise<Projeto>;
  /**
   * Grava a conversa de UMA aba do projeto, e só ela.
   *
   * Fora do `salvar` de propósito, como a conversa da EC: comentar não é editar
   * o projeto — não passa pela permissão de edição, não mexe em
   * `atualizado_em`, e duas pessoas conversando em abas diferentes ao mesmo
   * tempo não apagam a mensagem uma da outra.
   */
  salvarConversa(projetoId: string, aba: AbaComConversa, observacoes: Observacao[]): Promise<Observacao[]>;
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
  /**
   * Listagem LEVE para o painel de pendências e a memória de campos.
   *
   * As linhas vêm PARCIAIS de propósito — só o que essas duas coisas leem (ver
   * `SELECT_EC_PAINEL`). Descritivo, valores e dados de fornecedor voltam
   * vazios. NUNCA use esta lista para copiar dados de uma EC (importação, nova
   * versão, Excel): para isso existe `obter`, que traz a EC inteira.
   */
  listarPainel(): Promise<Ec[]>;
  obter(id: string): Promise<Ec | undefined>;
  salvar(ec: Ec): Promise<Ec>;
  /**
   * Grava SÓ a conversa geral da EC (`Ec.observacoes`).
   *
   * Comentar não é editar a estimativa: passa por fora de `salvar`, não mexe em
   * `atualizadoEm` e não esbarra na trava de edição de quem está com o
   * formulário aberto.
   */
  salvarObservacoes(ecId: string, observacoes: Observacao[]): Promise<Observacao[]>;
  /**
   * Gera a NOVA VERSÃO da EC de um projeto com a estrutura de outra EC.
   *
   * Mesma coisa que `novaVersao` — numeração seguinte, entra no ar, a anterior
   * vai para o arquivo, e leva a marca de "cancela e substitui as anteriores" —,
   * mudando só de onde vem o conteúdo: em vez da EC atual, uma que já existe. A
   * origem pode ser deste projeto ou de outro, estar no ar ou arquivada, e nunca
   * é tocada.
   *
   * `destino` é o cabeçalho da EC nova (cliente, dados do projeto, taxas) já
   * montado pela tela; a VERSÃO e o número saem do banco, sob trava — no
   * navegador eles vinham de uma lista carregada minutos antes.
   */
  importar(origemId: string, destino: Ec): Promise<Ec>;
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
  /**
   * Reemite a OS: cria a versão seguinte (rascunho, com o mesmo conteúdo,
   * inclusive a contratação item a item) e cancela esta. A anterior fica no
   * histórico exatamente como o fornecedor a recebeu.
   *
   * Duas razões levam aqui, e a diferença está no que se passa em `dados`:
   *  · os dados gerais do EVENTO mudaram (`projeto`/`cliente`);
   *  · o FORNECEDOR mudou (`fornecedor`) — outra empresa não pode herdar o
   *    documento que a primeira recebeu, com o mesmo número.
   * O que não é passado, a nova versão herda da anterior.
   */
  gerarNovaVersao(
    os: Os,
    dados: { numero: string; projeto?: ProjetoInfo; cliente?: Cliente; fornecedor?: Fornecedor }
  ): Promise<Os>;
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
 * Ajustes do aplicativo — uma chave, um valor.
 *
 * Existe porque não havia onde guardar um ajuste do sistema: ou virava coluna
 * numa tabela que não é dele, ou virava variável de ambiente, que só quem
 * publica consegue mudar. A primeira chave é a do Help Desk.
 */
export interface ConfigRepository {
  ler<T>(chave: string): Promise<T | undefined>;
  gravar<T>(chave: string, valor: T): Promise<void>;
}

/**
 * Chamados do Help Desk.
 *
 * `listar` devolve o que a RLS deixa ver: o suporte enxerga todos, cada pessoa
 * enxerga os seus. Não há um "listar do fulano" separado de propósito — quem
 * decide é o banco, e não um parâmetro que a tela poderia esquecer de passar.
 */
export interface ChamadosRepository {
  listar(): Promise<Chamado[]>;
  abrir(
    dados: Omit<Chamado, "id" | "abertoPor" | "status" | "mensagens" | "anexos" | "criadoEm" | "atualizadoEm">
  ): Promise<Chamado>;
  /** Acrescenta uma fala e passa a vez ao outro lado (ver `responder_chamado`). */
  responder(id: string, texto: string, anexos?: AnexoObservacao[]): Promise<Chamado>;
  /** Encerra ou reabre. Quem abriu também pode: é ele quem sabe se resolveu. */
  encerrar(id: string, resolvido: boolean): Promise<Chamado>;
  /** Quem está logado atende chamados? */
  souSuporte(): Promise<boolean>;
  /**
   * Sobe os arquivos para o bucket e devolve as fichas.
   *
   * Só sobe — pendurar a ficha no chamado é o passo seguinte, e ele é diferente
   * conforme o arquivo acompanhe o RELATO (`anexarAoRelato`) ou uma RESPOSTA
   * (`responder`). O chamado precisa existir antes: é dele que sai o caminho no
   * bucket, e é ele que sobrevive quando o upload falha.
   */
  subirAnexos(chamadoId: string, arquivos: File[], enviadoPorNome: string): Promise<AnexoObservacao[]>;
  /** Pendura no relato as fichas já subidas (ver `anexar_ao_chamado`). */
  anexarAoRelato(chamadoId: string, anexos: AnexoObservacao[]): Promise<Chamado>;
  /** Link assinado de vida curta para abrir um anexo. */
  urlAnexo(caminho: string): Promise<string>;
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

  /* ------------------------ anexos dos comentários ------------------------ */

  /**
   * Sobe um arquivo leve para o comentário de uma tarefa e devolve a ficha dele
   * (ver `domain/anexos` para o que é "leve"). Só o check-list tem anexo.
   */
  anexar(itemId: string, arquivo: File, enviadoPorNome: string): Promise<AnexoObservacao>;
  /**
   * Link temporário para abrir o anexo. O bucket é fechado: não existe URL
   * permanente, e cada abertura pede um link novo, de vida curta.
   */
  urlAnexo(caminho: string): Promise<string>;
  /** Apaga os arquivos — some o comentário, somem os anexos dele. */
  removerAnexos(caminhos: string[]): Promise<void>;
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
  config: ConfigRepository;
  chamados: ChamadosRepository;
  checklists: ChecklistRepository;
}
