/**
 * Implementação Supabase dos repositórios — fonte de dados 100% banco.
 * Os blocos JSONB (projeto, producao, fornecedor, cronograma, etc.) são
 * gravados no formato exato do domínio (camelCase), então o mapeamento
 * coluna→objeto é direto. Snapshots embutidos: `ecs.cliente` e `oss.fornecedor`.
 */
import { supabase } from "@/lib/supabaseClient";
import { numeroEc, producaoPadrao, honorariosPadrao, encargosPadrao } from "@/domain/calc";
import { normalizarProjetoInfo, sincronizarCamposLegados } from "@/domain/projeto";
import { onlyDigits } from "@/lib/format";
import { auditar } from "@/store/logs";
import { useAuth, PERMISSOES } from "@/store/auth";

/** O usuário atual tem acesso ao bloco financeiro? (espelha a RLS de os_financeiro) */
function podeFinanceiro(): boolean {
  const u = useAuth.getState().usuario;
  return !!u && PERMISSOES[u.papel].includes("financeiro");
}

const financeiroVazio = () => ({
  tomador: "" as const, descritivoNf: "", cnae: "", codigoServico: "",
  valorUnitario: 0, valorTotal: 0, descontoNegociado: 0, valorAPagar: 0,
  bvPercentual: 0, bvValor: 0, bvJustificativa: "", acertoFinanceiro: "",
});
import type {
  AnexoRepository,
  AuthRepository,
  ClienteRepository,
  EcRepository,
  EmpresasRepository,
  FornecedorRepository,
  OsRepository,
  ProjetoRepository,
  Repositorios,
} from "./repository";
import type {
  Anexo,
  Cliente,
  Ec,
  EcLinha,
  EmpresaGrupo,
  Fornecedor,
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

const nowIso = () => new Date().toISOString();

/* --------------------------------- Cliente ------------------------------- */

const representanteVazio = (): Representante => ({ nome: "", cargo: "", telefones: "", email: "" });
const clienteVazio = (): Cliente => ({
  id: "", nome: "", razaoSocial: "", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "", representante: representanteVazio(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCliente(r: any): Cliente {
  return {
    id: r.id,
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
    contatos: r.contatos ?? [],
  };
}

function fornecedorRow(f: Fornecedor) {
  return {
    razao_social: f.razaoSocial,
    nome_fantasia: f.nomeFantasia ?? null,
    cnpj: f.cnpj,
    perfil_tributario: f.perfilTributario,
    endereco: f.endereco,
    inscricao_estadual: f.inscricaoEstadual,
    inscricao_municipal: f.inscricaoMunicipal,
    dados_bancarios: f.dadosBancarios,
    contato: { representante: f.representante, telefone: f.telefone, email: f.email },
    cnaes: f.cnaes ?? [],
    contatos: f.contatos ?? [],
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
    // migra a observação legada (texto único, ou o antigo campo "pessoa" atribuído) para o formato de autor.
    observacoes:
      Array.isArray(r.observacoes) && r.observacoes.length
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? r.observacoes.map((o: any, indice: number) => ({
            id: o.id || `obs-${r.id}-${indice}`,
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
                  id: rr.id || `resp-${r.id}-${indice}-${j}`,
                  texto: rr.texto ?? "",
                  autorId: rr.autorId ?? "",
                  autorNome: rr.autorNome ?? "",
                  criadoEm: rr.criadoEm ?? nowIso(),
                }))
              : [],
          }))
        : r.observacao
        ? [{ id: `obs-${r.id}-0`, texto: r.observacao, autorId: "", autorNome: "", criadoEm: nowIso(), respostas: [] }]
        : [],
    oculto: !!r.oculto,
    ordem: r.ordem ?? 0,
  };
}

function linhaRow(ecId: string, l: EcLinha) {
  return {
    ec_id: ecId,
    grupo: l.grupo,
    item: l.item,
    descricao: l.descricao,
    descricao_completa: l.descricaoCompleta ?? "",
    valor_polobh: l.valorPolobh,
    valor_cliente: l.valorCliente,
    valor_gasto: l.valorGasto ?? 0,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEc(r: any): Ec {
  const linhas = (r.linhas ?? []).map(mapLinha).sort((a: EcLinha, b: EcLinha) => a.ordem - b.ordem);
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
    linhas,
    // As taxas (honorários/encargos) ficam embutidas no jsonb `producao` para não
    // exigir coluna nova; aqui separamos de volta em campos de primeiro nível.
    producao: extrairProducao(r.producao),
    honorarios: r.producao?.honorarios ?? honorariosPadrao(),
    encargos: r.producao?.encargos ?? encargosPadrao(),
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
    // Embute as taxas no jsonb `producao` (o mapEc separa de volta na leitura).
    producao: { ...ec.producao, honorarios: ec.honorarios, encargos: ec.encargos },
    responsavel: ec.responsavel,
    validade_dias: ec.validadeDias,
    versao: ec.versao,
    status: ec.status,
    cancelada_substituida: ec.canceladaSubstituida ?? false,
    ativa: ec.ativa ?? true,
    atualizado_em: nowIso(),
  };
}

async function sincronizarLinhas(ecId: string, linhas: EcLinha[]) {
  const existentes = ok(await supabase.from("ec_linhas").select("id").eq("ec_id", ecId)) ?? [];
  const idsExistentes = new Set(existentes.map((r: { id: string }) => r.id));
  const manter = new Set<string>();

  for (const l of linhas) {
    if (isUuid(l.id) && idsExistentes.has(l.id)) {
      ok(await supabase.from("ec_linhas").update(linhaRow(ecId, l)).eq("id", l.id).select("id").single());
      manter.add(l.id);
    } else {
      const novo = ok(await supabase.from("ec_linhas").insert(linhaRow(ecId, l)).select("id").single())!;
      manter.add(novo.id);
    }
  }

  const remover = [...idsExistentes].filter((id) => !manter.has(id as string));
  if (remover.length) ok(await supabase.from("ec_linhas").delete().in("id", remover));
}

const SELECT_EC = "*, linhas:ec_linhas(*)";

const ecRepo: EcRepository = {
  async listar() {
    const data = ok(await supabase.from("ecs").select(SELECT_EC).order("criado_em", { ascending: false }));
    return (data ?? []).map(mapEc);
  },
  async obter(id) {
    const data = ok(await supabase.from("ecs").select(SELECT_EC).eq("id", id).maybeSingle());
    return data ? mapEc(data) : undefined;
  },
  async salvar(ec) {
    const atualizando = isUuid(ec.id);
    let id: string;
    if (atualizando) {
      ok(await supabase.from("ecs").update(ecRow(ec)).eq("id", ec.id).select("id").single());
      id = ec.id;
    } else {
      const novo = ok(await supabase.from("ecs").insert(ecRow(ec)).select("id").single())!;
      id = novo.id;
    }
    await sincronizarLinhas(id, ec.linhas);
    // Apenas uma EC ativa por projeto: ao salvar uma ativa, arquiva o "ativa" das irmãs.
    if (ec.ativa && isUuid(ec.projetoId)) {
      ok(await supabase.from("ecs").update({ ativa: false }).eq("projeto_id", ec.projetoId).neq("id", id));
    }
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
    // A versão anterior é arquivada e deixa de ser a ativa (a nova a substitui).
    ok(await supabase.from("ecs").update({ cancelada_substituida: true, ativa: false, status: "Arquivada" }).eq("id", id));
    const irmas = orig.projetoId ? (await this.listar()).filter((ec) => ec.projetoId === orig.projetoId) : [];
    const novaV = Math.max(orig.versao, ...irmas.map((ec) => ec.versao)) + 1;
    const agora = nowIso();
    return this.salvar({
      ...orig,
      id: "",
      versao: novaV,
      status: "Rascunho",
      numero: numeroEc(orig.cliente.nome, orig.projeto.titulo, novaV),
      canceladaSubstituida: true,
      ativa: true,
      criadoEm: agora,
      atualizadoEm: agora,
      linhas: orig.linhas.map((l) => ({ ...l, id: "" })),
    });
  },
  async definirAtiva(id) {
    const ec = await this.obter(id);
    if (!ec) throw new Error("EC não encontrada");
    // Arquiva o "ativa" das irmãs do mesmo projeto e reativa esta.
    if (isUuid(ec.projetoId)) {
      ok(await supabase.from("ecs").update({ ativa: false }).eq("projeto_id", ec.projetoId).neq("id", id));
    }
    const novoStatus = ec.status === "Arquivada" || ec.status === "Cancelada" ? "Rascunho" : ec.status;
    ok(await supabase.from("ecs").update({ ativa: true, status: novoStatus }).eq("id", id));
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
    modalidade: r.modalidade ?? "",
    descritivo: r.descritivo ?? "",
    entrega: r.entrega ?? "",
    cronograma: r.cronograma ?? [],
    logistica: r.logistica ?? logisticaVazia(),
    infraestrutura: r.infraestrutura ?? infraVazia(),
    observacoes: r.observacoes ?? "",
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

const SELECT_OS = "*, ec:ecs(numero), os_linhas(ec_linha_id), os_financeiro(dados)";

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
};

/* ---------------------------------- Auth --------------------------------- */

const authRepo: AuthRepository = {
  async usuarios() {
    const data = ok(await supabase.from("perfis").select("id, nome, papel").order("nome"));
    return (data ?? []).map(
      (r: { id: string; nome: string | null; papel: Usuario["papel"] }): Usuario => ({
        id: r.id,
        nome: r.nome ?? "",
        email: "",
        papel: r.papel,
      })
    );
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

/* --------------------------------- Anexos -------------------------------- */

const ANEXOS_BUCKET = "projeto-anexos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAnexo(r: any): Anexo {
  return {
    id: r.id,
    projetoId: r.projeto_id,
    nome: r.nome ?? "",
    path: r.path ?? "",
    mime: r.mime ?? "",
    tamanho: Number(r.tamanho) || 0,
    criadoEm: r.criado_em,
  };
}

/** Remove acentos/caracteres problemáticos do nome do arquivo no bucket. */
const nomeSeguro = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");

const anexoRepo: AnexoRepository = {
  async listar(projetoId) {
    const data = ok(
      await supabase.from("projeto_anexos").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: false })
    );
    return (data ?? []).map(mapAnexo);
  },
  async enviar(projetoId, file) {
    const path = `${projetoId}/${Date.now()}-${nomeSeguro(file.name)}`;
    const up = await supabase.storage.from(ANEXOS_BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (up.error) throw new Error(up.error.message);
    const data = ok(
      await supabase
        .from("projeto_anexos")
        .insert({ projeto_id: projetoId, nome: file.name, path, mime: file.type || "", tamanho: file.size })
        .select("*")
        .single()
    )!;
    auditar({ categoria: "Projeto", acao: "anexo.enviar", mensagem: `Anexo "${file.name}" adicionado ao projeto`, alvoId: projetoId });
    return mapAnexo(data);
  },
  async remover(id, path) {
    await supabase.storage.from(ANEXOS_BUCKET).remove([path]);
    ok(await supabase.from("projeto_anexos").delete().eq("id", id));
    auditar({ nivel: "aviso", categoria: "Projeto", acao: "anexo.remover", mensagem: `Anexo removido`, alvoId: id });
  },
  async urlAssinada(path) {
    const { data, error } = await supabase.storage.from(ANEXOS_BUCKET).createSignedUrl(path, 600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  },
};

export const supabaseRepositorios: Repositorios = {
  projetos: projetoRepo,
  clientes: clienteRepo,
  fornecedores: fornecedorRepo,
  ecs: ecRepo,
  oss: osRepo,
  auth: authRepo,
  empresas: empresasRepo,
  anexos: anexoRepo,
};
