// Regras puras da Edge Function `acessos` (padrão de Acessos — só login e senha): validação do
// corpo de cada ação, CPF, e-mail e política de senha. Mora em _shared para o vitest alcançar (a
// função em si só roda no Deno). Nada aqui lê `Deno.env`.
//
// Todo usuário entra com e-mail (o login) e senha. Não há SSO nem recuperação por e-mail: a senha
// inicial é definida pelo administrador e é PROVISÓRIA (a pessoa troca no primeiro acesso); depois
// a própria pessoa troca dentro do app, informando a senha atual (`trocar_minha_senha`), e o
// administrador pode definir uma nova (`definir_senha`, que volta a ser provisória).
//
// As MESMAS regras de CPF e de senha existem no front (`src/lib/acessos/cpf.ts`, `senha.ts`) e no
// banco (`private.cpf_valido`). Mudou uma, mude as três.

/**
 * Recorte extra por EMPRESA: o Pólobh não tem (decisão de 26/11/2026). `false`: o corpo não manda
 * empresas e a Edge não toca em nada de empresa.
 */
export const RECORTE_DE_EMPRESAS = false;

export const SENHA_MIN = 8;
// O bcrypt do Supabase Auth só lê os primeiros 72 bytes; acima disso a senha seria cortada em silêncio.
export const SENHA_MAX = 72;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

export const ehUuid = (valor: unknown): valor is string => typeof valor === "string" && UUID.test(valor);

/** Minúsculas e sem espaço nas pontas; qualquer outra coisa vira vazio. */
export function normalizarEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export const emailValido = (email: string): boolean => email.length <= 254 && EMAIL.test(email);

export type Validacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

const recusa = (erro: string): { ok: false; erro: string } => ({ ok: false, erro });

// --- CPF -----------------------------------------------------------------------------------------

/** Só os dígitos (aceita "123.456.789-09", "12345678909", com espaços). Outra coisa vira vazio. */
export function normalizarCpf(cpf: unknown): string {
  return typeof cpf === "string" ? cpf.replace(/\D/g, "") : "";
}

/**
 * CPF válido: 11 dígitos, não todos iguais, e os dois dígitos verificadores conferem.
 * Recebe já normalizado (só dígitos).
 */
export function cpfValido(cpf: string): boolean {
  if (!/^[0-9]{11}$/.test(cpf)) return false;
  if (cpf === cpf[0].repeat(11)) return false;
  const d = cpf.split("").map(Number);
  const verificador = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += d[i] * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return verificador(9) === d[9] && verificador(10) === d[10];
}

/** "***.456.789-**" — o único formato em que o CPF aparece em log, lista ou mensagem. */
export function mascararCpf(cpf: string): string {
  return /^[0-9]{11}$/.test(cpf) ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : "";
}

// --- Senha ---------------------------------------------------------------------------------------

/**
 * Política de senha (igual em `senha.ts` no front): 8 a 72 bytes, ao menos uma letra e um número.
 * Sem aparar espaços (são parte da senha). A senha vazada quem recusa é o Auth (HIBP ligado).
 */
export function validarSenha(senha: unknown): string | null {
  if (typeof senha !== "string" || senha.length < SENHA_MIN) return `A senha precisa ter ao menos ${SENHA_MIN} caracteres.`;
  if (new TextEncoder().encode(senha).length > SENHA_MAX) return `A senha pode ter no máximo ${SENHA_MAX} bytes (menos caracteres se tiver acentos).`;
  if (!/\p{L}/u.test(senha) || !/[0-9]/.test(senha)) return "A senha precisa ter ao menos uma letra e um número.";
  return null;
}

/**
 * Erro do Auth ao gravar senha -> mensagem para a tela. O projeto liga "Prevent use of leaked
 * passwords" (HIBP): o Auth devolve `weak_password` com `reasons` contendo "pwned".
 */
export function traduzirErroDeSenha(erro: { code?: unknown; reasons?: unknown } | null | undefined): { status: 400; erro: string } | null {
  if (!erro || erro.code !== "weak_password") return null;
  const motivos = Array.isArray(erro.reasons) ? erro.reasons.map(String) : [];
  return motivos.includes("pwned")
    ? { status: 400, erro: "Esta senha aparece em vazamentos de dados públicos. Escolha outra." }
    : { status: 400, erro: "A senha não atende à política de senhas do projeto." };
}

// --- criar_usuario ------------------------------------------------------------------------------

export type CriarUsuario = {
  origem: "colaborador" | "avulso";
  colaboradorId: string | null;
  nome: string;
  /** E-mail do corpo, normalizado. Com colaborador só vale quando o cadastro não tem corporativo. */
  email: string;
  /** Só dígitos, já validado. Obrigatório para as duas origens (a lista do DPRH não traz CPF). */
  cpf: string;
  cargo: string;
  /**
   * Setor (até 120) e, acima, cargo (até 200). Avulso: escolhido na tela entre os da lista do DPRH
   * (setor e cargo são criados no Gestão de Colaboradores). Colaborador: vale o da lista.
   */
  setor: string;
  /** Senha inicial (provisória), digitada ou gerada por quem cadastra. Obrigatória. */
  senha: string;
  grupoId: string;
  /** Só com `RECORTE_DE_EMPRESAS`; sem recorte, sempre `[]` e `false`. */
  empresas: string[];
  todasEmpresas: boolean;
};

export function validarCriarUsuario(corpo: Record<string, unknown>, recorte = RECORTE_DE_EMPRESAS): Validacao<CriarUsuario> {
  const origem = corpo.origem;
  if (origem !== "colaborador" && origem !== "avulso") return recusa("Escolha se o usuário é um colaborador ou avulso.");
  if (!ehUuid(corpo.grupoId)) return recusa("Escolha o grupo de permissão do usuário.");

  const todasEmpresas = recorte && corpo.todasEmpresas === true;
  const lista = recorte && Array.isArray(corpo.empresas) ? corpo.empresas : [];
  const empresas = [...new Set(lista.map((e) => String(e).trim()).filter(Boolean))];
  if (empresas.some((e) => !ehUuid(e))) return recusa("Empresa inválida.");
  // Com recorte, sem escopo o usuário nasce enxergando nada: a RLS filtra toda tabela por empresa.
  if (recorte && !todasEmpresas && !empresas.length) return recusa("Escolha ao menos uma empresa, ou marque o acesso a todas.");

  const email = normalizarEmail(corpo.email);
  const cpf = normalizarCpf(corpo.cpf);
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  const cargo = typeof corpo.cargo === "string" ? corpo.cargo.trim() : "";
  const setor = typeof corpo.setor === "string" ? corpo.setor.trim() : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  if (nome.length > 200 || cargo.length > 200) return recusa("Nome ou cargo longo demais.");
  if (setor.length > 120) return recusa("Setor longo demais.");
  if (!cpf) return recusa("Informe o CPF do usuário.");
  if (!cpfValido(cpf)) return recusa("CPF inválido. Confira os números.");
  const erroDaSenha = validarSenha(senha);
  if (erroDaSenha) return recusa(erroDaSenha);
  const comum = { cpf, cargo, setor, senha, grupoId: corpo.grupoId, empresas: todasEmpresas ? [] : empresas, todasEmpresas };

  if (origem === "colaborador") {
    if (!ehUuid(corpo.colaboradorId)) return recusa("Escolha o colaborador.");
    if (email && !emailValido(email)) return recusa("E-mail inválido.");
    return { ok: true, dados: { origem, colaboradorId: corpo.colaboradorId, nome, email, ...comum } };
  }

  if (nome.length < 2) return recusa("Informe o nome do usuário.");
  if (!emailValido(email)) return recusa("Informe um e-mail válido.");
  return { ok: true, dados: { origem, colaboradorId: null, nome, email, ...comum } };
}

/**
 * E-mail do usuário vindo de um colaborador: o corporativo do cadastro manda; o do corpo só
 * entra quando o cadastro não tem corporativo válido. Vazio = não há como criar a conta.
 */
export function emailDoColaborador(corporativo: unknown, informado: string): string {
  const cadastro = normalizarEmail(corporativo);
  if (cadastro && emailValido(cadastro)) return cadastro;
  return informado && emailValido(informado) ? informado : "";
}

/**
 * Violação de unicidade (23505) -> o que estava duplicado. Os índices são `usuario_email_key`,
 * `usuario_cpf_key` e `usuario_colaborador_id_key` (banco.sql). A mensagem nunca traz o valor.
 */
export function duplicidadeDoErro(erro: { code?: unknown; message?: unknown; details?: unknown } | null | undefined): "email" | "cpf" | "colaborador" | null {
  if (!erro || erro.code !== "23505") return null;
  const texto = `${erro.message ?? ""} ${erro.details ?? ""}`;
  if (/usuario_cpf_key|\(cpf\)/.test(texto)) return "cpf";
  if (/usuario_email_key|email/.test(texto)) return "email";
  if (/colaborador_id/.test(texto)) return "colaborador";
  return null;
}

export const MENSAGEM_DE_DUPLICIDADE: Record<"email" | "cpf" | "colaborador", string> = {
  email: "Já existe um usuário com este e-mail.",
  cpf: "Já existe um usuário com este CPF.",
  colaborador: "Este colaborador já é um usuário.",
};

// --- definir_senha (administrador) -------------------------------------------------------------

export function validarDefinirSenha(corpo: Record<string, unknown>): Validacao<{ usuarioId: string; senha: string }> {
  if (!ehUuid(corpo.usuarioId)) return recusa("Informe o usuário.");
  const erro = validarSenha(corpo.senha);
  if (erro) return recusa(erro);
  return { ok: true, dados: { usuarioId: corpo.usuarioId, senha: corpo.senha as string } };
}

// --- trocar_minha_senha (a própria pessoa) -------------------------------------------------------

export function validarTrocarMinhaSenha(corpo: Record<string, unknown>): Validacao<{ senhaAtual: string; senhaNova: string }> {
  const senhaAtual = typeof corpo.senhaAtual === "string" ? corpo.senhaAtual : "";
  const senhaNova = typeof corpo.senhaNova === "string" ? corpo.senhaNova : "";
  if (!senhaAtual) return recusa("Informe a senha atual.");
  const erro = validarSenha(senhaNova);
  if (erro) return recusa(erro);
  if (senhaNova === senhaAtual) return recusa("A nova senha precisa ser diferente da atual.");
  return { ok: true, dados: { senhaAtual, senhaNova } };
}

/**
 * Freio da troca da própria senha: quem erra a senha atual 5 vezes em 15 minutos espera. Em memória
 * (por instância da Edge): é a primeira barreira; o Auth tem o próprio limite de tentativas.
 */
export const TENTATIVAS_DE_SENHA_ATUAL = 5;
export const JANELA_DE_TENTATIVAS_MS = 15 * 60 * 1000;

export function criarFreioDeTentativas(agora: () => number = Date.now) {
  const erros = new Map<string, number[]>();
  const recentes = (chave: string) => (erros.get(chave) ?? []).filter((t) => agora() - t < JANELA_DE_TENTATIVAS_MS);
  return {
    bloqueado: (chave: string) => recentes(chave).length >= TENTATIVAS_DE_SENHA_ATUAL,
    registrarErro: (chave: string) => erros.set(chave, [...recentes(chave), agora()]),
    limpar: (chave: string) => erros.delete(chave),
  };
}

// --- conta do Auth que já existe -----------------------------------------------------------

export type Reaproveitamento = { ok: true } | { ok: false; status: 409; erro: string };

/**
 * Criar acesso para um e-mail que já tem conta no Auth. Ativo já é usuário (409). Inativo também
 * não se recadastra (409): volta pelo "Ativar" da lista, com confirmação e as travas da ativação —
 * recadastrar trocaria grupo, origem e dados de um inativo por fora delas. Só o PENDENTE (conta
 * criada no Auth por fora do cadastro) é liberado por aqui, o que quem chama só pode se também
 * puder editar.
 */
export function decidirReaproveitamento(statusDoUsuario: string): Reaproveitamento {
  if (statusDoUsuario === "ativo") return { ok: false, status: 409, erro: "Este e-mail já é um usuário ativo." };
  if (statusDoUsuario === "inativo") {
    return { ok: false, status: 409, erro: "Este e-mail é de um usuário inativo. Use \"Ativar\" na lista de usuários." };
  }
  return { ok: true };
}

/** O e-mail do Auth do id achado é exatamente o pedido (normalizados): trava de tomada de conta. */
export function emailConfere(pedido: unknown, doAuth: unknown): boolean {
  const a = normalizarEmail(pedido);
  return a !== "" && a === normalizarEmail(doAuth);
}
