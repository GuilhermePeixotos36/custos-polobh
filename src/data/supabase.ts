/**
 * Implementação Supabase dos repositórios — fonte de dados 100% banco.
 * Os blocos JSONB (projeto, producao, fornecedor, cronograma, etc.) são
 * gravados no formato exato do domínio (camelCase), então o mapeamento
 * coluna→objeto é direto. Snapshots embutidos: `ecs.cliente` e `oss.fornecedor`.
 */
import { supabase } from "@/lib/supabaseClient";
import { numeroEc, producaoPadrao, producaoZerada, linhasProducaoLegado, honorariosPadrao, encargosPadrao, bvVazio } from "@/domain/calc";
import { normalizarProjetoInfo, sincronizarCamposLegados } from "@/domain/projeto";
import { limparContatos, normalizarContatos } from "@/domain/fornecedor";
import { caminhoAnexo, motivoRecusaAnexo, tipoDoAnexo } from "@/domain/anexos";
import { onlyDigits } from "@/lib/format";
import { auditar } from "@/store/logs";
import { useAuth } from "@/store/auth";

/** O usuário atual tem acesso ao bloco financeiro? (espelha a RLS de os_financeiro) */
function podeFinanceiro(): boolean {
  return useAuth.getState().pode("financeiro");
}

const financeiroVazio = () => ({
  tomador: "" as const, descritivoNf: "", cnae: "", codigoServico: "",
  valorUnitario: 0, valorTotal: 0, descontoNegociado: 0, valorAPagar: 0,
  bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "",
});
import type {
  AreaRepository,
  AuthRepository,
  ChecklistRepository,
  ClienteRepository,
  EcRepository,
  EmpresasRepository,
  FornecedorRepository,
  OsRepository,
  ProjetoRepository,
  Repositorios,
} from "./repository";
import type {
  Area,
  Checklist,
  Cliente,
  Ec,
  EcLinha,
  ItemChecklist,
  ModeloChecklist,
  ItemModeloChecklist,
  StatusChecklist,
  ModalidadeProjeto,
  EmpresaGrupo,
  Fornecedor,
  AnexoObservacao,
  Observacao,
  Os,
  Producao,
  Projeto,
  Representante,
  Usuario,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

function ok<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

/** Erro de edição concorrente na EC — a tela oferece recarregar em vez de sobrescrever. */
export class ConflitoEdicaoError extends Error {
  constructor() {
    super(
      "Esta EC foi alterada por outra pessoa depois que você abriu a tela. " +
        "Recarregue para ver a versão atual — salvar agora apagaria o que ela incluiu."
    );
    this.name = "ConflitoEdicaoError";
  }
}

/** Converte os erros da trava otimista da RPC em algo que o usuário entende. */
function traduzirConflitoEc<T>(r: { data: T; error: { message: string } | null }): { data: T; error: { message: string } | null } {
  const msg = r.error?.message ?? "";
  if (msg.includes("EC_CONFLITO_EDICAO")) throw new ConflitoEdicaoError();
  if (msg.includes("EC_VERSAO_NAO_INFORMADA")) {
    throw new Error("Recarregue a página: esta aba está com uma versão antiga do app.");
  }
  return r;
}

const nowIso = () => new Date().toISOString();
const novoUuid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Bucket dos anexos das tarefas do check-list (fechado — ver a migração). */
const BUCKET_ANEXOS = "anexos-checklist";

/**
 * O erro do Storage vem em inglês e técnico. Os dois casos que a pessoa pode
 * causar sozinha ganham a explicação do que fazer; o resto passa como veio.
 */
function traduzirErroAnexo(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("exceeded") || m.includes("too large") || m.includes("maximum size")) {
    return "Arquivo acima do limite de 5 MB.";
  }
  if (m.includes("mime") || m.includes("not allowed")) {
    return "Tipo de arquivo não aceito. Vale imagem, PDF, Word, Excel, PowerPoint, CSV e TXT.";
  }
  return `Não foi possível enviar o anexo: ${mensagem}`;
}

/* --------------------------------- Cliente ------------------------------- */

const representanteVazio = (): Representante => ({ nome: "", cargo: "", telefones: "", email: "" });
const clienteVazio = (): Cliente => ({
  id: "", apelido: "", nome: "", razaoSocial: "", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "", representante: representanteVazio(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCliente(r: any): Cliente {
  return {
    id: r.id,
    apelido: r.apelido ?? "",
    nome: r.nome ?? "",
    razaoSocial: r.razao_social ?? "",
    endereco: r.endereco ?? "",
    cnpjCpf: r.cnpj_cpf ?? "",
    inscricaoEstadual: r.inscricao_estadual ?? "",
    inscricaoMunicipal: r.inscricao_municipal ?? "",
    representante: r.representante ?? representanteVazio(),
  };
}

function clienteRow(c: Cliente) {
  return {
    apelido: c.apelido.trim(),
    nome: c.nome,
    razao_social: c.razaoSocial,
    endereco: c.endereco,
    cnpj_cpf: c.cnpjCpf,
    inscricao_estadual: c.inscricaoEstadual,
    inscricao_municipal: c.inscricaoMunicipal,
    representante: c.representante,
  };
}

const clienteRepo: ClienteRepository = {
  async listar() {
    const data = ok(await supabase.from("clientes").select("*").order("nome"));
    return (data ?? []).map(mapCliente);
  },
  async obter(id) {
    const data = ok(await supabase.from("clientes").select("*").eq("id", id).maybeSingle());
    return data ? mapCliente(data) : undefined;
  },
  async salvar(c) {
    const atualizando = isUuid(c.id);
    const data = atualizando
      ? ok(await supabase.from("clientes").update(clienteRow(c)).eq("id", c.id).select("*").single())!
      : ok(await supabase.from("clientes").insert(clienteRow(c)).select("*").single())!;
    const cli = mapCliente(data);
    auditar({
      categoria: "Cliente",
      acao: atualizando ? "cliente.atualizar" : "cliente.criar",
      mensagem: `Cliente ${cli.nome || cli.razaoSocial} ${atualizando ? "atualizado" : "criado"}`,
      alvoId: cli.id,
    });
    return cli;
  },
};

/* ------------------------------- Fornecedor ------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFornecedor(r: any): Fornecedor {
  const contato = r.contato ?? {};
  return {
    id: r.id,
    razaoSocial: r.razao_social ?? "",
    apelido: r.apelido ?? undefined,
    nomeFantasia: r.nome_fantasia ?? undefined,
    cnpj: r.cnpj ?? "",
    perfilTributario: r.perfil_tributario ?? "",
    endereco: r.endereco ?? "",
    inscricaoEstadual: r.inscricao_estadual ?? "",
    inscricaoMunicipal: r.inscricao_municipal ?? "",
    dadosBancarios: r.dados_bancarios ?? { tipoConta: "", banco: "", agencia: "", conta: "", chavePix: "" },
    representante: contato.representante ?? "",
    telefone: contato.telefone ?? "",
    email: contato.email ?? "",
    cnaes: r.cnaes ?? [],
    // O banco pode ter as frases antigas ("Maria — (31) 9…") ou os contatos já
    // separados; a leitura entende os dois e a tela só vê o formato novo.
    contatos: normalizarContatos(r.contatos),
  };
}

function fornecedorRow(f: Fornecedor) {
  return {
    razao_social: f.razaoSocial,
    apelido: (f.apelido ?? "").trim() || null,
    nome_fantasia: f.nomeFantasia ?? null,
    cnpj: f.cnpj,
    perfil_tributario: f.perfilTributario,
    endereco: f.endereco,
    inscricao_estadual: f.inscricaoEstadual,
    inscricao_municipal: f.inscricaoMunicipal,
    dados_bancarios: f.dadosBancarios,
    contato: { representante: f.representante, telefone: f.telefone, email: f.email },
    cnaes: f.cnaes ?? [],
    contatos: limparContatos(f.contatos ?? []),
  };
}

const fornecedorRepo: FornecedorRepository = {
  async listar() {
    const data = ok(await supabase.from("fornecedores").select("*").order("razao_social"));
    return (data ?? []).map(mapFornecedor);
  },
  async obter(id) {
    const data = ok(await supabase.from("fornecedores").select("*").eq("id", id).maybeSingle());
    return data ? mapFornecedor(data) : undefined;
  },
  async porCnpj(cnpj) {
    const todos = await this.listar();
    return todos.find((f) => onlyDigits(f.cnpj) === onlyDigits(cnpj));
  },
  async salvar(f) {
    const atualizando = isUuid(f.id);
    const data = atualizando
      ? ok(await supabase.from("fornecedores").update(fornecedorRow(f)).eq("id", f.id).select("*").single())!
      : ok(await supabase.from("fornecedores").insert(fornecedorRow(f)).select("*").single())!;
    const forn = mapFornecedor(data);
    auditar({
      categoria: "Fornecedor",
      acao: atualizando ? "fornecedor.atualizar" : "fornecedor.criar",
      mensagem: `Fornecedor ${forn.razaoSocial || forn.nomeFantasia || forn.cnpj} ${atualizando ? "atualizado" : "criado"}`,
      alvoId: forn.id,
    });
    return forn;
  },
};

/* ----------------------------------- EC ---------------------------------- */

/** Lê só os campos conhecidos de Produção do jsonb (ignora as taxas embutidas). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrairProducao(raw: any): Producao {
  const base = producaoPadrao();
  if (!raw || typeof raw !== "object") return base;
  const out = { ...base };
  for (const k of Object.keys(base) as (keyof Producao)[]) {
    if (typeof raw[k] === "number") out[k] = raw[k];
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * Normaliza a thread de observações vinda do jsonb.
 *
 * Vale para os itens da EC e para os do check-list: as duas telas usam o mesmo
 * componente de thread e o mesmo motor de pendências, então precisam do mesmo
 * formato. `legado` migra a observação antiga de texto único (e o antigo campo
 * "pessoa", que virou autor/responsável) — só a EC tem essa herança.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapObservacoes(linhaId: string, raw: any, legado?: string): Observacao[] {
  if (Array.isArray(raw) && raw.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return raw.map((o: any, indice: number) => ({
      id: o.id || `obs-${linhaId}-${indice}`,
      texto: o.texto ?? "",
      autorId: o.autorId ?? "",
      autorNome: o.autorNome ?? o.pessoa ?? "",
      criadoEm: o.criadoEm ?? nowIso(),
      responsavelNome: o.responsavelNome ?? o.pessoa ?? "",
      resolvida: !!o.resolvida,
      resolvidoPorNome: o.resolvidoPorNome ?? "",
      resolvidoEm: o.resolvidoEm ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      respostas: Array.isArray(o.respostas)
        ? o.respostas.map((rr: any, j: number) => ({
            id: rr.id || `resp-${linhaId}-${indice}-${j}`,
            texto: rr.texto ?? "",
            autorId: rr.autorId ?? "",
            autorNome: rr.autorNome ?? "",
            criadoEm: rr.criadoEm ?? nowIso(),
          }))
        : [],
    }));
  }
  if (legado) {
    return [{ id: `obs-${linhaId}-0`, texto: legado, autorId: "", autorNome: "", criadoEm: nowIso(), respostas: [] }];
  }
  return [];
}

function mapLinha(r: any): EcLinha {
  return {
    id: r.id,
    grupo: r.grupo ?? "",
    item: r.item ?? "",
    descricao: r.descricao ?? "",
    descricaoCompleta: r.descricao_completa ?? "",
    valorPolobh: Number(r.valor_polobh) || 0,
    valorCliente: Number(r.valor_cliente) || 0,
    valorGasto: Number(r.valor_gasto) || 0,
    valorComBvNf: Number(r.valor_com_bv_nf) || 0,
    valorSemBvComNf: Number(r.valor_sem_bv_com_nf) || 0,
    valorSemBvSemNf: Number(r.valor_sem_bv_sem_nf) || 0,
    valoresNaoAplicaveis: Array.isArray(r.valores_nao_aplicaveis) ? r.valores_nao_aplicaveis : [],
    opcaoValor: r.opcao_valor ?? "",
    // BV mascarado (null) para quem não vê financeiro — vira o vazio, nunca undefined.
    bv: r.bv ?? bvVazio(),
    statusAprovacao: r.status_aprovacao ?? "Pendente",
    fornecedorRazao: r.fornecedor_razao ?? "",
    fornecedorCnpj: r.fornecedor_cnpj ?? "",
    fornecedorContato: r.fornecedor_contato ?? "",
    faturaNf: r.fatura_nf ?? "",
    codigoServico: r.codigo_servico ?? "",
    pedidoCompra: r.pedido_compra ?? "",
    statusOs: r.status_os ?? "Pendente",
    contratoStatus: r.contrato_status ?? "Pendente",
    observacao: r.observacao ?? "",
    observacoes: mapObservacoes(r.id, r.observacoes, r.observacao),
    oculto: !!r.oculto,
    ordem: r.ordem ?? 0,
  };
}

function linhaRow(ecId: string, l: EcLinha) {
  return {
    id: l.id,
    ec_id: ecId,
    grupo: l.grupo,
    item: l.item,
    descricao: l.descricao,
    descricao_completa: l.descricaoCompleta ?? "",
    valor_polobh: l.valorPolobh,
    valor_cliente: l.valorCliente,
    valor_gasto: l.valorGasto ?? 0,
    valor_com_bv_nf: l.valorComBvNf ?? 0,
    valor_sem_bv_com_nf: l.valorSemBvComNf ?? 0,
    valor_sem_bv_sem_nf: l.valorSemBvSemNf ?? 0,
    valores_nao_aplicaveis: l.valoresNaoAplicaveis ?? [],
    opcao_valor: l.opcaoValor ?? "",
    bv: l.bv ?? bvVazio(),
    status_aprovacao: l.statusAprovacao,
    fornecedor_razao: l.fornecedorRazao,
    fornecedor_cnpj: l.fornecedorCnpj,
    fornecedor_contato: l.fornecedorContato ?? "",
    fatura_nf: l.faturaNf,
    codigo_servico: l.codigoServico,
    pedido_compra: l.pedidoCompra,
    status_os: l.statusOs,
    contrato_status: l.contratoStatus ?? "Pendente",
    observacao: l.observacao ?? "",
    observacoes: l.observacoes ?? [],
    oculto: l.oculto ?? false,
    ordem: l.ordem,
  };
}

/** Linha de custo completa a partir de campos mínimos (usada na migração da Produção legada). */
function linhaMigrada(o: { id: string; grupo: string; item: string; descricao: string; valorPolobh: number; ordem: number }): EcLinha {
  return {
    id: o.id, grupo: o.grupo, item: o.item, descricao: o.descricao, descricaoCompleta: "",
    valorPolobh: o.valorPolobh, valorCliente: 0, valorGasto: 0,
    valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, valoresNaoAplicaveis: [], opcaoValor: "", bv: bvVazio(),
    statusAprovacao: "Pendente", fornecedorRazao: "", fornecedorCnpj: "", fornecedorContato: "",
    faturaNf: "", codigoServico: "", pedidoCompra: "", statusOs: "Pendente", contratoStatus: "Pendente",
    observacao: "", observacoes: [], oculto: false, ordem: o.ordem,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEc(r: any): Ec {
  const linhas = (r.linhas ?? []).map(mapLinha).sort((a: EcLinha, b: EcLinha) => a.ordem - b.ordem);
  // Migração: o bloco fixo de Produção foi descontinuado. Se a EC salva ainda tiver
  // valores nele, viram linhas do grupo EQUIPE PRODUÇÃO (total idêntico) e o bloco é zerado.
  const migradas = linhasProducaoLegado(extrairProducao(r.producao));
  if (migradas.length) {
    const baseOrdem = linhas.reduce((m: number, l: EcLinha) => Math.max(m, l.ordem), 0);
    migradas.forEach((mg, i) =>
      linhas.push(linhaMigrada({ id: `prodmig-${r.id}-${i}`, grupo: "EQUIPE PRODUÇÃO", item: mg.item, descricao: mg.descricao, valorPolobh: mg.valorPolobh, ordem: baseOrdem + 1 + i }))
    );
  }
  return {
    id: r.id,
    numero: r.numero,
    slugPublico: r.slug_publico ?? "",
    projetoId: r.projeto_id ?? "",
    template: r.template ?? "",
    versao: r.versao,
    status: r.status,
    clienteId: r.cliente_id ?? "",
    cliente: r.cliente ?? clienteVazio(),
    projeto: normalizarProjetoInfo(r.projeto),
    // Conversa geral da EC — gravada por caminho próprio (ver `salvarObservacoes`).
    observacoes: r.observacoes ?? [],
    linhas,
    // Produção fixa descontinuada → sempre zerada (os custos vivem em linhas do grupo).
    producao: producaoZerada(),
    honorarios: r.producao?.honorarios ?? honorariosPadrao(),
    encargos: r.producao?.encargos ?? encargosPadrao(),
    honorariosRotulo: r.producao?.honorariosRotulo || undefined,
    encargosRotulo: r.producao?.encargosRotulo || undefined,
    responsavel: r.responsavel ?? "",
    validadeDias: r.validade_dias ?? 30,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    canceladaSubstituida: r.cancelada_substituida ?? false,
    ativa: r.ativa ?? true,
  };
}

function ecRow(ec: Ec) {
  return {
    numero: ec.numero,
    projeto_id: isUuid(ec.projetoId) ? ec.projetoId : null,
    template: ec.template || null,
    cliente_id: isUuid(ec.cliente?.id) ? ec.cliente.id : null,
    cliente: ec.cliente,
    projeto: sincronizarCamposLegados(ec.projeto),
    // Embute as taxas e seus rótulos no jsonb `producao` (o mapEc separa de volta na leitura).
    producao: { ...ec.producao, honorarios: ec.honorarios, encargos: ec.encargos, honorariosRotulo: ec.honorariosRotulo ?? "", encargosRotulo: ec.encargosRotulo ?? "" },
    responsavel: ec.responsavel,
    validade_dias: ec.validadeDias,
    versao: ec.versao,
    status: ec.status,
    cancelada_substituida: ec.canceladaSubstituida ?? false,
    ativa: ec.ativa ?? true,
    criado_em: ec.criadoEm || nowIso(),
    atualizado_em: nowIso(),
  };
}

// Lê pela view mascarada (A-03): o SELECT direto em `ec_linhas` é revogado, e a
// view devolve NULL nos valores para quem não tem o recurso financeiro.
// A gravação continua pela RPC `salvar_ec_completa`, que é SECURITY DEFINER.
const SELECT_EC = "*, linhas:ec_linhas_visiveis(*)";

/**
 * Projeção LEVE das linhas, para o painel de pendências e a memória de campos.
 *
 * Estas duas coisas recarregam a cada navegação e leem a base INTEIRA de ECs.
 * Com `*` nas linhas isso significa baixar, a cada clique de menu, o descritivo
 * rico de cada item de cada EC já feita pela casa — o campo mais pesado da
 * tabela, e o único que nenhuma das duas usa. Com poucas ECs não se nota; com
 * um ano de operação é o que faz o app parecer travado.
 *
 * As colunas aqui são exatamente o que `calcularPendencias` (observações,
 * status de OS e de Contrato) e `montarSugestoes` (item, grupo, pedido de
 * compra, código de serviço) leem. `observacao` vem junto por causa do formato
 * antigo, que `mapObservacoes` ainda converte.
 */
const SELECT_EC_PAINEL =
  "*, linhas:ec_linhas_visiveis(id,grupo,item,pedido_compra,codigo_servico,status_os,contrato_status,status_aprovacao,observacao,observacoes,oculto,ordem)";

const ecRepo: EcRepository = {
  async listar() {
    const data = ok(await supabase.from("ecs").select(SELECT_EC).order("criado_em", { ascending: false }));
    return (data ?? []).map(mapEc);
  },
  async listarPainel() {
    const data = ok(await supabase.from("ecs").select(SELECT_EC_PAINEL).order("criado_em", { ascending: false }));
    return (data ?? []).map(mapEc);
  },
  async obter(id) {
    const data = ok(await supabase.from("ecs").select(SELECT_EC).eq("id", id).maybeSingle());
    return data ? mapEc(data) : undefined;
  },
  async salvar(ec) {
    const atualizando = isUuid(ec.id);
    const linhas = ec.linhas.map((linha) => ({
      ...linha,
      id: isUuid(linha.id) ? linha.id : globalThis.crypto.randomUUID(),
    }));
    // Trava otimista: manda a versão que a tela carregou. Se alguém salvou nesse
    // intervalo, a RPC recusa em vez de apagar o trabalho da outra pessoa.
    const data = ok(traduzirConflitoEc(await supabase.rpc("salvar_ec_completa", {
      p_ec_id: atualizando ? ec.id : null,
      p_ec: ecRow(ec),
      p_linhas: linhas.map((linha) => linhaRow(atualizando ? ec.id : "", linha)),
      p_esperado_em: atualizando ? ec.atualizadoEm : null,
    })));
    const id = data as string;
    const salvo = await this.obter(id);
    if (!salvo) throw new Error("Falha ao reler a EC salva.");
    auditar({
      categoria: "EC",
      acao: atualizando ? "ec.atualizar" : "ec.criar",
      mensagem: `EC ${salvo.numero} ${atualizando ? "atualizada" : "criada"} (status: ${salvo.status})`,
      alvoId: id,
    });
    return salvo;
  },
  async salvarObservacoes(ecId, observacoes) {
    // RPC própria (ver a migração `ec_observacoes_gerais`): grava só a conversa,
    // sem tocar em `atualizado_em` e sem exigir permissão de EDITAR a EC — quem
    // enxerga a EC conversa nela.
    const salvas = ok(
      await supabase.rpc("salvar_observacoes_ec", { p_ec_id: ecId, p_observacoes: observacoes })
    ) as unknown as Observacao[] | null;
    return salvas ?? observacoes;
  },
  async duplicar(id) {
    const orig = await this.obter(id);
    if (!orig) throw new Error("EC não encontrada");
    const agora = nowIso();
    const irmas = orig.projetoId ? (await this.listar()).filter((ec) => ec.projetoId === orig.projetoId) : [];
    const novaV = Math.max(orig.versao, ...irmas.map((ec) => ec.versao)) + 1;
    // Cópia é uma nova versão em rascunho e NÃO ativa (não perturba a EC ativa do projeto).
    return this.salvar({
      ...orig,
      id: "",
      versao: novaV,
      status: "Rascunho",
      numero: numeroEc(orig.cliente.nome, orig.projeto.titulo, novaV),
      canceladaSubstituida: false,
      ativa: false,
      criadoEm: agora,
      atualizadoEm: agora,
      linhas: orig.linhas.map((l) => ({ ...l, id: "" })),
    });
  },
  async novaVersao(id) {
    const orig = await this.obter(id);
    if (!orig) throw new Error("EC não encontrada");
    const novoId = ok(await supabase.rpc("nova_versao_ec", { p_ec_id: id })) as string;
    const nova = await this.obter(novoId);
    if (!nova) throw new Error("Falha ao reler a nova versão.");
    return nova;
  },
  async definirAtiva(id) {
    const ec = await this.obter(id);
    if (!ec) throw new Error("EC não encontrada");
    ok(await supabase.rpc("definir_ec_ativa", { p_ec_id: id }));
    auditar({ categoria: "EC", acao: "ec.ativar", mensagem: `EC ${ec.numero} definida como ativa`, alvoId: id });
    const salvo = await this.obter(id);
    if (!salvo) throw new Error("Falha ao reler a EC.");
    return salvo;
  },
  async remover(id) {
    const ec = await this.obter(id);
    // Remove OSs dependentes (sem cascade no FK), depois a EC (cascade nas linhas).
    ok(await supabase.from("oss").delete().eq("ec_id", id));
    ok(await supabase.from("ecs").delete().eq("id", id));
    auditar({ nivel: "aviso", categoria: "EC", acao: "ec.remover", mensagem: `EC ${ec?.numero ?? id} removida`, alvoId: id });
  },
};

/* ----------------------------------- OS ---------------------------------- */

const logisticaVazia = () => ({ transporteMaterial: "", transporteEquipe: "", hospedagem: "", alimentacao: "", estacionamentoCarga: "", estacionamentoEquipe: "", uniformizacao: "" });
const infraVazia = () => ({ energia: "", internet: "", pontosEletricos: "", estruturas: "", servicosApoio: "", artLaudos: "" });
const contratoVazio = () => ({ contratante: "" as const, descritivoServicos: "", informacoesComplementares: "", valorUnitario: 0, valorTotal: 0, descontoNegociado: 0, valorAPagar: 0, dataContrato: "", rubrica: "" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOs(r: any): Os {
  // os_financeiro é 1:1 e protegido por RLS — vem null/[] para quem não pode ver.
  const finRow = Array.isArray(r.os_financeiro) ? r.os_financeiro[0] : r.os_financeiro;
  // BV mora na própria OS (editável pela Produção); o resto do financeiro é restrito.
  const bv = r.bv ?? {};
  const financeiro = {
    ...(finRow?.dados ?? financeiroVazio()),
    bvPercentual: Number(bv.percentual) || 0,
    bvValor: Number(bv.valor) || 0,
    bvJustificativa: bv.justificativa ?? "",
  };
  return {
    id: r.id,
    numero: r.numero,
    slugCredenciamento: r.slug_credenciamento ?? "",
    seq: r.seq,
    ecId: r.ec_id,
    ecNumero: r.ec?.numero ?? "",
    ecLinhaIds: (r.os_linhas ?? []).map((x: { ec_linha_id: string }) => x.ec_linha_id),
    status: r.status,
    fornecedor: r.fornecedor,
    projeto: normalizarProjetoInfo(r.projeto ?? r.ec?.projeto),
    cliente: r.cliente ?? r.ec?.cliente ?? clienteVazio(),
    modalidade: r.modalidade ?? "",
    descritivo: r.descritivo ?? "",
    entrega: r.entrega ?? "",
    cronograma: r.cronograma ?? [],
    logistica: r.logistica ?? logisticaVazia(),
    infraestrutura: r.infraestrutura ?? infraVazia(),
    observacoesGerais: r.observacoes_gerais ?? "",
    observacoes: r.observacoes ?? [],
    credenciamento: r.credenciamento ?? { prazoLimite: "", linkFormulario: "" },
    orcamento: r.orcamento ?? { valorEc: 0, valorComBvNf: 0, valorSemBvComNf: 0, valorSemBvSemNf: 0, parcelas: [], documentoFiscal: "" },
    financeiro,
    contrato: r.contrato ?? contratoVazio(),
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

function osRow(os: Os) {
  return {
    numero: os.numero,
    ec_id: os.ecId,
    seq: os.seq,
    fornecedor: os.fornecedor,
    // Foto dos dados gerais do evento na emissão — depois de gravada, só uma
    // nova versão da OS a substitui (ver `Os.projeto`).
    projeto: os.projeto,
    cliente: os.cliente,
    modalidade: os.modalidade,
    descritivo: os.descritivo,
    entrega: os.entrega,
    cronograma: os.cronograma,
    logistica: os.logistica,
    infraestrutura: os.infraestrutura,
    credenciamento: os.credenciamento,
    orcamento: os.orcamento,
    contrato: os.contrato,
    // BV na própria OS (gravado por quem tem oss_write, inclui Produção)
    bv: {
      percentual: os.financeiro.bvPercentual || 0,
      valor: os.financeiro.bvValor || 0,
      justificativa: os.financeiro.bvJustificativa ?? "",
    },
    observacoes_gerais: os.observacoesGerais ?? "",
    observacoes: os.observacoes,
    status: os.status,
    atualizado_em: nowIso(),
  };
}

async function sincronizarOsLinhas(osId: string, ecLinhaIds: string[]) {
  ok(await supabase.from("os_linhas").delete().eq("os_id", osId));
  const validos = ecLinhaIds.filter(isUuid);
  if (validos.length) {
    ok(await supabase.from("os_linhas").insert(validos.map((ec_linha_id) => ({ os_id: osId, ec_linha_id }))));
  }
}

/**
 * `ec:ecs(projeto, cliente)` é o plano B das OSs gravadas antes de a OS ter
 * snapshot próprio (ver `Os.projeto`): elas leem o da EC, como sempre leram, e
 * a partir da primeira gravação passam a ter o seu. Assim o resto do app nunca
 * precisa perguntar se o snapshot existe.
 */
const SELECT_OS = "*, ec:ecs(numero, projeto, cliente), os_linhas(ec_linha_id), os_financeiro(dados)";

const osRepo: OsRepository = {
  async listar() {
    const data = ok(await supabase.from("oss").select(SELECT_OS).order("criado_em", { ascending: false }));
    return (data ?? []).map(mapOs);
  },
  async porEc(ecId) {
    const data = ok(await supabase.from("oss").select(SELECT_OS).eq("ec_id", ecId).order("seq"));
    return (data ?? []).map(mapOs);
  },
  async obter(id) {
    const data = ok(await supabase.from("oss").select(SELECT_OS).eq("id", id).maybeSingle());
    return data ? mapOs(data) : undefined;
  },
  async salvar(os) {
    const atualizando = isUuid(os.id);
    let id: string;
    if (atualizando) {
      ok(await supabase.from("oss").update(osRow(os)).eq("id", os.id).select("id").single());
      id = os.id;
    } else {
      const novo = ok(await supabase.from("oss").insert(osRow(os)).select("id").single())!;
      id = novo.id;
    }
    await sincronizarOsLinhas(id, os.ecLinhaIds);
    // Financeiro só é gravado por quem tem o recurso (RLS reforça no servidor).
    // Sem essa guarda, um perfil sem acesso salvaria zeros por cima do real.
    if (podeFinanceiro()) {
      ok(await supabase.from("os_financeiro").upsert({ os_id: id, dados: os.financeiro, atualizado_em: nowIso() }));
    }
    const salvo = await this.obter(id);
    if (!salvo) throw new Error("Falha ao reler a OS salva.");
    auditar({
      categoria: "OS",
      acao: atualizando ? "os.atualizar" : "os.criar",
      mensagem: `OS ${salvo.numero} ${atualizando ? "atualizada" : "criada"} (status: ${salvo.status})`,
      alvoId: id,
    });
    return salvo;
  },
  async gerarNovaVersao(os, dados) {
    // A cópia acontece no servidor (ver a função `gerar_nova_versao_os`): o
    // financeiro da OS é restrito por RLS, e copiá-lo pela tela apagaria o que
    // quem está reemitindo não tem permissão de enxergar.
    const novoId = ok(
      await supabase.rpc("gerar_nova_versao_os", {
        p_os_id: os.id,
        p_numero: dados.numero,
        p_projeto: dados.projeto,
        p_cliente: dados.cliente,
      })
    ) as unknown as string;
    const salvo = await this.obter(novoId);
    if (!salvo) throw new Error("Falha ao reler a nova versão da OS.");
    auditar({
      categoria: "OS",
      acao: "os.nova_versao",
      mensagem: `OS ${os.numero} reemitida como ${salvo.numero} (dados do evento atualizados)`,
      alvoId: salvo.id,
    });
    return salvo;
  },
  async proximaSeq(ecId) {
    const data = ok(await supabase.from("oss").select("seq").eq("ec_id", ecId));
    const max = (data ?? []).reduce((m: number, r: { seq: number }) => Math.max(m, r.seq), 0);
    return max + 1;
  },
  async remover(id) {
    const os = await this.obter(id);
    ok(await supabase.from("oss").delete().eq("id", id));
    auditar({ nivel: "aviso", categoria: "OS", acao: "os.remover", mensagem: `OS ${os?.numero ?? id} removida`, alvoId: id });
  },
  async credenciamentos(osId) {
    const data = ok(
      await supabase
        .from("credenciamentos")
        .select("id, equipe, veiculos, enviado_em")
        .eq("os_id", osId)
        .order("enviado_em", { ascending: false })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any) => ({
      id: r.id,
      equipe: r.equipe ?? [],
      veiculos: r.veiculos ?? [],
      enviadoEm: r.enviado_em,
    }));
  },
  async osComCredenciamento() {
    const data = ok(await supabase.from("credenciamentos").select("os_id"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [...new Set((data ?? []).map((r: any) => r.os_id as string).filter(Boolean))];
  },
};

/* ---------------------------------- Auth --------------------------------- */

/** Chama a Edge Function `gerenciar-usuarios` (roda com chave de serviço — cria login/edita e-mail). */
async function gerenciarUsuarios(body: Record<string, unknown>): Promise<Usuario> {
  const { data, error } = await supabase.functions.invoke("gerenciar-usuarios", { body });
  if (error) throw new Error((error as { message?: string }).message ?? "Falha ao chamar gerenciar-usuarios.");
  const resposta = data as { ok: boolean; erro?: string; usuario?: Usuario };
  if (!resposta?.ok) throw new Error(resposta?.erro ?? "Não foi possível concluir a operação.");
  return resposta.usuario!;
}

const authRepo: AuthRepository = {
  async usuarios() {
    const data = ok(await supabase.from("perfis").select("id, nome, papel, telefone, area_id, areas(nome)").order("nome"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any): Usuario => {
      const area = Array.isArray(r.areas) ? r.areas[0] : r.areas;
      return {
        id: r.id,
        nome: r.nome ?? "",
        email: "",
        telefone: r.telefone ?? "",
        papel: r.papel,
        areaId: r.area_id ?? undefined,
        areaNome: area?.nome ?? undefined,
      };
    });
  },
  async usuariosCompletos() {
    const { data, error } = await supabase.functions.invoke("gerenciar-usuarios", { body: { acao: "listar" } });
    if (error) throw new Error((error as { message?: string }).message ?? "Falha ao listar usuários.");
    const resposta = data as { ok: boolean; erro?: string; usuarios?: Usuario[] };
    if (!resposta?.ok) throw new Error(resposta?.erro ?? "Não foi possível listar os usuários.");
    return resposta.usuarios ?? [];
  },
  criarUsuario: (dados) => gerenciarUsuarios({ acao: "criar", ...dados }),
  atualizarUsuario: (dados) => gerenciarUsuarios({ acao: "atualizar", ...dados }),
};

/* ---------------------------------- Áreas -------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapArea = (r: any): Area => ({
  id: r.id,
  nome: r.nome ?? "",
  papelBase: r.papel_base,
  recursos: r.recursos ?? [],
  ativa: r.ativa !== false,
});

const AREA_COLS = "id, nome, papel_base, recursos, ativa";

const areaRepo: AreaRepository = {
  async listar() {
    const data = ok(await supabase.from("areas").select(AREA_COLS).order("nome"));
    return (data ?? []).map(mapArea);
  },
  async salvar(a) {
    const linha = { nome: a.nome.trim(), papel_base: a.papelBase, recursos: a.recursos };
    const data = a.id
      ? ok(await supabase.from("areas").update(linha).eq("id", a.id).select(AREA_COLS).single())
      : ok(await supabase.from("areas").insert(linha).select(AREA_COLS).single());
    const area = mapArea(data);
    auditar({
      categoria: "Configuração",
      acao: a.id ? "area.atualizar" : "area.criar",
      mensagem: `Área "${area.nome}" ${a.id ? "atualizada" : "criada"} (${area.recursos.length} permissões)`,
      alvoId: area.id,
    });
    return area;
  },
  async definirAtiva(id, ativa) {
    const area = mapArea(ok(await supabase.from("areas").update({ ativa }).eq("id", id).select(AREA_COLS).single()));
    auditar({
      categoria: "Configuração",
      acao: ativa ? "area.reativar" : "area.inativar",
      mensagem: `Área "${area.nome}" ${ativa ? "reativada" : "inativada"}`,
      alvoId: area.id,
    });
    return area;
  },
  async remover(id) {
    ok(await supabase.from("areas").delete().eq("id", id).select());
    auditar({ categoria: "Configuração", acao: "area.remover", mensagem: `Área removida (${id})`, alvoId: id });
  },
};

/* --------------------------------- Projeto ------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProjeto(r: any): Projeto {
  return {
    id: r.id,
    nome: r.nome ?? "",
    cliente: r.cliente ?? clienteVazio(),
    info: normalizarProjetoInfo(r.projeto),
    docsUrl: r.docs_url ?? "",
    status: r.status ?? "Ativo",
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

function projetoRow(p: Projeto) {
  return {
    nome: p.nome || p.info?.titulo || "Projeto",
    cliente: p.cliente,
    projeto: sincronizarCamposLegados(p.info),
    docs_url: p.docsUrl ?? "",
    status: p.status,
    atualizado_em: nowIso(),
  };
}

const projetoRepo: ProjetoRepository = {
  async listar() {
    const data = ok(await supabase.from("projetos").select("*").order("criado_em", { ascending: false }));
    return (data ?? []).map(mapProjeto);
  },
  async obter(id) {
    const data = ok(await supabase.from("projetos").select("*").eq("id", id).maybeSingle());
    return data ? mapProjeto(data) : undefined;
  },
  async salvar(p) {
    const atualizando = isUuid(p.id);
    const data = atualizando
      ? ok(await supabase.from("projetos").update(projetoRow(p)).eq("id", p.id).select("*").single())!
      : ok(await supabase.from("projetos").insert(projetoRow(p)).select("*").single())!;
    const proj = mapProjeto(data);
    auditar({
      categoria: "Projeto",
      acao: atualizando ? "projeto.atualizar" : "projeto.criar",
      mensagem: `Projeto ${proj.nome} ${atualizando ? "atualizado" : "criado"}`,
      alvoId: proj.id,
    });
    return proj;
  },
  async arquivarDocumentos(id) {
    ok(await supabase.rpc("arquivar_documentos_projeto", { p_projeto_id: id }));
    auditar({
      categoria: "Projeto",
      acao: "projeto.arquivar",
      mensagem: "Projeto e documentos associados arquivados",
      alvoId: id,
    });
  },
  async remover(id) {
    const p = await this.obter(id);
    // Desvincula as ECs (não apaga dados) e remove o projeto.
    ok(await supabase.from("ecs").update({ projeto_id: null }).eq("projeto_id", id));
    ok(await supabase.from("projetos").delete().eq("id", id));
    auditar({ nivel: "aviso", categoria: "Projeto", acao: "projeto.remover", mensagem: `Projeto ${p?.nome ?? id} removido`, alvoId: id });
  },
};

/* -------------------------------- Empresas ------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmpresa(r: any): EmpresaGrupo {
  return {
    id: r.id,
    nome: r.nome ?? "",
    razaoSocial: r.razao_social ?? "",
    cnpj: r.cnpj ?? "",
    endereco: r.endereco ?? "",
    inscricaoEstadual: r.inscricao_estadual ?? "",
    inscricaoMunicipal: r.inscricao_municipal ?? "",
    padrao: !!r.padrao,
    ordem: r.ordem ?? 0,
  };
}

function empresaRow(e: EmpresaGrupo) {
  return {
    id: e.id,
    nome: e.nome,
    razao_social: e.razaoSocial,
    cnpj: e.cnpj,
    endereco: e.endereco,
    inscricao_estadual: e.inscricaoEstadual,
    inscricao_municipal: e.inscricaoMunicipal,
    padrao: e.padrao,
    ordem: e.ordem,
    atualizado_em: nowIso(),
  };
}

const empresasRepo: EmpresasRepository = {
  async listar() {
    const data = ok(await supabase.from("empresas_grupo").select("*").order("ordem"));
    return (data ?? []).map(mapEmpresa);
  },
  async salvar(e) {
    // id é slug estável ("polobh"/"mf") — upsert por id.
    const data = ok(await supabase.from("empresas_grupo").upsert(empresaRow(e)).select("*").single())!;
    const emp = mapEmpresa(data);
    auditar({
      categoria: "Configuração",
      acao: "empresa.atualizar",
      mensagem: `Dados fiscais da empresa ${emp.nome} atualizados`,
      alvoId: emp.id,
    });
    return emp;
  },
  async definirPadrao(id) {
    ok(await supabase.from("empresas_grupo").update({ padrao: false }).neq("id", id));
    ok(await supabase.from("empresas_grupo").update({ padrao: true }).eq("id", id));
    auditar({ categoria: "Configuração", acao: "empresa.padrao", mensagem: `Empresa emissora padrão definida (${id})`, alvoId: id });
  },
};

/* ------------------------------ CHECK-LIST ------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapModeloChecklist(r: any): ModeloChecklist {
  return {
    id: r.id,
    modalidade: (r.modalidade ?? "") as ModalidadeProjeto,
    nome: r.nome ?? "",
    itens: (Array.isArray(r.itens) ? r.itens : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any, n: number): ItemModeloChecklist => ({
        id: i.id || `mi-${n + 1}`,
        titulo: i.titulo ?? "",
        descricao: i.descricao ?? "",
        etapa: i.etapa ?? "",
        prazo:
          i.prazo?.modo === "ancora"
            ? { modo: "ancora", diasDoEvento: Number(i.prazo.diasDoEvento) || 0 }
            : { modo: "percentual", percentual: Number(i.prazo?.percentual) || 0 },
        responsavelPadrao: i.responsavelPadrao ?? "",
        ordem: Number(i.ordem) || n,
      }))
      .sort((a: ItemModeloChecklist, b: ItemModeloChecklist) => a.ordem - b.ordem),
    atualizadoEm: r.atualizado_em ?? "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItemChecklist(r: any): ItemChecklist {
  return {
    id: r.id,
    checklistId: r.checklist_id,
    origemModeloItemId: r.origem_modelo_item_id ?? "",
    titulo: r.titulo ?? "",
    descricao: r.descricao ?? "",
    etapa: r.etapa ?? "",
    status: (r.status ?? "Pendente") as StatusChecklist,
    // `date` do Postgres já chega como "YYYY-MM-DD"; normaliza por segurança.
    dataLimite: r.data_limite ? String(r.data_limite).slice(0, 10) : "",
    dataManual: !!r.data_manual,
    concluidoEm: r.concluido_em ?? "",
    concluidoPor: r.concluido_por ?? "",
    responsavel: r.responsavel ?? "",
    observacoes: mapObservacoes(r.id, r.observacoes),
    oculto: !!r.oculto,
    ordem: r.ordem ?? 0,
  };
}

function itemChecklistRow(i: ItemChecklist) {
  return {
    id: i.id,
    checklist_id: i.checklistId,
    origem_modelo_item_id: i.origemModeloItemId ?? "",
    titulo: i.titulo,
    descricao: i.descricao ?? "",
    etapa: i.etapa ?? "",
    status: i.status,
    // Coluna `date`: string vazia viraria erro de cast, então vira NULL.
    data_limite: i.dataLimite || null,
    data_manual: !!i.dataManual,
    concluido_em: i.concluidoEm || null,
    concluido_por: i.concluidoPor ?? "",
    responsavel: i.responsavel ?? "",
    observacoes: i.observacoes ?? [],
    oculto: !!i.oculto,
    ordem: i.ordem ?? 0,
  };
}

const SELECT_CHECKLIST = "*, itens:checklist_itens(*)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapChecklist(r: any): Checklist {
  return {
    id: r.id,
    projetoId: r.projeto_id,
    modalidade: (r.modalidade ?? "") as ModalidadeProjeto,
    modeloId: r.modelo_id ?? "",
    itens: (Array.isArray(r.itens) ? r.itens : []).map(mapItemChecklist).sort(
      (a: ItemChecklist, b: ItemChecklist) => a.ordem - b.ordem
    ),
    criadoEm: r.criado_em ?? "",
    atualizadoEm: r.atualizado_em ?? "",
  };
}

const checklistRepo: ChecklistRepository = {
  async listarModelos() {
    const data = ok(await supabase.from("checklist_modelos").select("*").order("modalidade"));
    return (data ?? []).map(mapModeloChecklist);
  },
  async salvarModelo(modelo) {
    const data = ok(
      await supabase
        .from("checklist_modelos")
        .update({ nome: modelo.nome, itens: modelo.itens, atualizado_em: new Date().toISOString() })
        .eq("id", modelo.id)
        .select("*")
        .single()
    )!;
    auditar({
      categoria: "Configuração",
      acao: "checklist.modelo.atualizar",
      mensagem: `Lista padrão de check-list (${modelo.modalidade}) atualizada — ${modelo.itens.length} itens`,
      alvoId: modelo.id,
    });
    return mapModeloChecklist(data);
  },
  async doProjeto(projetoId) {
    const data = ok(
      await supabase.from("checklists").select(SELECT_CHECKLIST).eq("projeto_id", projetoId).maybeSingle()
    );
    return data ? mapChecklist(data) : undefined;
  },
  async listar() {
    const data = ok(await supabase.from("checklists").select(SELECT_CHECKLIST));
    return (data ?? []).map(mapChecklist);
  },
  async criar(checklist) {
    const cab = ok(
      await supabase
        .from("checklists")
        .insert({
          id: checklist.id,
          projeto_id: checklist.projetoId,
          modalidade: checklist.modalidade,
          modelo_id: checklist.modeloId || null,
        })
        .select("*")
        .single()
    )!;
    if (checklist.itens.length) {
      ok(await supabase.from("checklist_itens").insert(checklist.itens.map(itemChecklistRow)));
    }
    auditar({
      categoria: "Projeto",
      acao: "checklist.gerar",
      mensagem: `Check-list ${checklist.modalidade} gerado com ${checklist.itens.length} tarefas`,
      alvoId: checklist.projetoId,
    });
    return { ...checklist, criadoEm: cab.criado_em, atualizadoEm: cab.atualizado_em };
  },
  async salvarItem(item) {
    const data = ok(
      await supabase.from("checklist_itens").upsert(itemChecklistRow(item)).select("*").single()
    )!;
    return mapItemChecklist(data);
  },
  async salvarItens(itens) {
    if (!itens.length) return;
    ok(await supabase.from("checklist_itens").upsert(itens.map(itemChecklistRow)));
  },
  async removerItem(id) {
    ok(await supabase.from("checklist_itens").delete().eq("id", id));
  },
  async remover(checklistId) {
    // Os itens saem por cascade.
    ok(await supabase.from("checklists").delete().eq("id", checklistId));
  },

  /* ------------------------- anexos dos comentários ------------------------ */

  async anexar(itemId, arquivo, enviadoPorNome) {
    const motivo = motivoRecusaAnexo(arquivo);
    // A peneira roda aqui e no bucket: esta dá a mensagem boa, aquela é a que
    // não dá para burlar. Nunca só uma das duas.
    if (motivo) throw new Error(motivo);

    const id = novoUuid();
    const caminho = caminhoAnexo(itemId, id, arquivo.name);
    const tipo = tipoDoAnexo(arquivo);
    const { error } = await supabase.storage.from(BUCKET_ANEXOS).upload(caminho, arquivo, {
      contentType: tipo,
      // Caminho novo a cada envio (o id é único), então não há o que sobrescrever.
      upsert: false,
    });
    if (error) throw new Error(traduzirErroAnexo(error.message));

    const anexo: AnexoObservacao = {
      id,
      caminho,
      nome: arquivo.name,
      tamanho: arquivo.size,
      tipo,
      enviadoPorNome,
      enviadoEm: nowIso(),
    };
    auditar({
      categoria: "Projeto",
      acao: "checklist.anexo",
      mensagem: `Anexo "${anexo.nome}" (${anexo.tamanho} bytes) enviado numa observação do check-list`,
      alvoId: itemId,
    });
    return anexo;
  },

  async urlAnexo(caminho) {
    // Link de vida curta: o bucket é fechado e não existe URL permanente. Um
    // minuto basta para o navegador abrir e sobra pouco se o link vazar.
    const { data, error } = await supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(caminho, 60);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? "Não foi possível abrir o anexo.");
    return data.signedUrl;
  },

  async removerAnexos(caminhos) {
    const validos = caminhos.filter(Boolean);
    if (!validos.length) return;
    const { error } = await supabase.storage.from(BUCKET_ANEXOS).remove(validos);
    if (error) throw new Error(error.message);
  },
};

export const supabaseRepositorios: Repositorios = {
  projetos: projetoRepo,
  clientes: clienteRepo,
  fornecedores: fornecedorRepo,
  ecs: ecRepo,
  oss: osRepo,
  auth: authRepo,
  areas: areaRepo,
  empresas: empresasRepo,
  checklists: checklistRepo,
};
