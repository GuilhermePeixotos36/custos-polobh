// Regras puras da Edge Function `acessos` (padrão de Acessos LSPRO, adaptado à Pólobh em
// 24/11/2026): validação do corpo de cada ação e decisão sobre conta do Auth que já existe. Mora
// em _shared para o vitest alcançar (a função em si só roda no Deno). Nada aqui lê `Deno.env`.
//
// ADAPTAÇÕES do padrão (decisão do dono do app): sem Microsoft 365/SSO — todo usuário entra com
// e-mail e senha, e a senha inicial é definida por quem cadastra; sem lista de colaboradores de
// outro app — nome, setor e cargo são digitados no cadastro. A recuperação de senha pela própria
// pessoa continua existindo no app (fora desta função).
//
// NUNCA escreva escape unicode (barra invertida + u) neste arquivo, nem em comentário.

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

/** Senha digitada pelo administrador: 8 a 72 bytes, sem aparar espaços (são parte da senha). */
export function validarSenha(senha: unknown): string | null {
  if (typeof senha !== "string" || senha.length < SENHA_MIN) return `A senha precisa ter ao menos ${SENHA_MIN} caracteres.`;
  if (new TextEncoder().encode(senha).length > SENHA_MAX) return `A senha pode ter no máximo ${SENHA_MAX} bytes (menos caracteres se tiver acentos).`;
  return null;
}

const texto = (valor: unknown): string => (typeof valor === "string" ? valor.replace(/\s+/g, " ").trim() : "");

// --- criar_usuario ------------------------------------------------------------------------

export type CriarUsuario = {
  nome: string;
  email: string;
  setor: string;
  cargo: string;
  telefone: string;
  senha: string;
  grupoId: string;
};

/** Sem Microsoft, a senha é obrigatória já no corpo: não há o que perguntar a um tenant. */
export function validarCriarUsuario(corpo: Record<string, unknown>): Validacao<CriarUsuario> {
  if (!ehUuid(corpo.grupoId)) return recusa("Escolha o grupo de permissão do usuário.");
  const nome = texto(corpo.nome);
  const email = normalizarEmail(corpo.email);
  const setor = texto(corpo.setor);
  const cargo = texto(corpo.cargo);
  const telefone = texto(corpo.telefone);
  if (nome.length < 2) return recusa("Informe o nome do usuário.");
  if (nome.length > 200 || cargo.length > 200) return recusa("Nome ou cargo longo demais.");
  if (setor.length > 120) return recusa("Setor longo demais.");
  if (telefone.length > 40) return recusa("Telefone longo demais.");
  if (!emailValido(email)) return recusa("Informe um e-mail válido.");
  const erroDaSenha = validarSenha(corpo.senha);
  if (erroDaSenha) return recusa(erroDaSenha);
  return { ok: true, dados: { nome, email, setor, cargo, telefone, senha: corpo.senha as string, grupoId: corpo.grupoId } };
}

/**
 * Erro do Auth ao gravar senha -> mensagem para a tela. Com "Prevent use of leaked passwords"
 * (HIBP) ligado no projeto, o Auth devolve `weak_password` com `reasons` contendo "pwned".
 */
export function traduzirErroDeSenha(erro: { code?: unknown; reasons?: unknown } | null | undefined): { status: 400; erro: string } | null {
  if (!erro || erro.code !== "weak_password") return null;
  const motivos = Array.isArray(erro.reasons) ? erro.reasons.map(String) : [];
  return motivos.includes("pwned")
    ? { status: 400, erro: "Esta senha aparece em vazamentos de dados públicos. Escolha outra." }
    : { status: 400, erro: "A senha não atende à política de senhas do projeto." };
}

// --- definir_senha ------------------------------------------------------------------------

export function validarDefinirSenha(corpo: Record<string, unknown>): Validacao<{ usuarioId: string; senha: string }> {
  if (!ehUuid(corpo.usuarioId)) return recusa("Informe o usuário.");
  const erro = validarSenha(corpo.senha);
  if (erro) return recusa(erro);
  return { ok: true, dados: { usuarioId: corpo.usuarioId, senha: corpo.senha as string } };
}

// --- conta do Auth que já existe -----------------------------------------------------------

export type Reaproveitamento = { ok: true } | { ok: false; status: 409; erro: string };

/**
 * Cadastrar um e-mail que já tem conta no Auth. Ativo já é usuário (409). Inativo também não se
 * recadastra (409): volta pelo "Ativar" da lista, com confirmação e as travas da ativação —
 * recadastrar trocaria grupo e dados de um inativo por fora delas. Só o PENDENTE (conta que
 * apareceu no Auth sem passar pela tela, ex.: convite antigo) é liberado por aqui, e quem chama
 * só pode se também puder editar usuários (a Edge confere).
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
