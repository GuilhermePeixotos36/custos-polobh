/**
 * O CADASTRO DE FORNECEDORES como tela própria (27/11/2026).
 *
 * Até aqui o fornecedor nascia de passagem, dentro de uma EC, e a tela dele era
 * um painel lateral escondido do menu. Agora há um cadastro de verdade, feito
 * pelo Administrativo-Financeiro: cada fornecedor tem um ID, é CNPJ ou CPF, tem
 * o documento conferido antes de gravar e não pode existir duas vezes.
 *
 * Aqui ficam as regras que não dependem de tela: o ID como se lê, o tipo do
 * documento, a validação do cadastro e a ida e volta entre os contatos como o
 * banco os guarda (uma pessoa com telefone e e-mail) e como o formulário os
 * mostra (uma linha por meio de contato: nome, tipo e valor).
 */
import type { ContatoFornecedor, Fornecedor } from "@/data/types";
import { cnpjValido, cpfValido } from "@/lib/cnpj";
import { validarEndereco, textoDoQueFalta } from "@/domain/endereco";

const digitos = (v: string | undefined | null) => (v ?? "").replace(/\D/g, "");
const chave = (v: string | undefined | null) =>
  (v ?? "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

/* ----------------------------------- ID ---------------------------------- */

/** O ID do fornecedor como aparece na lista: "0042". Sem número ainda, um traço. */
export const rotuloIdFornecedor = (codigo: number | null | undefined): string =>
  typeof codigo === "number" && codigo > 0 ? String(codigo).padStart(4, "0") : "—";

/* ---------------------------------- tipo --------------------------------- */

export type TipoFornecedor = "CNPJ" | "CPF";

/** CPF tem 11 dígitos; todo o resto (inclusive em branco) é tratado como CNPJ. */
export const tipoDoFornecedor = (f: Pick<Fornecedor, "cnpj">): TipoFornecedor =>
  digitos(f.cnpj).length === 11 ? "CPF" : "CNPJ";

/** O que só existe para empresa: sai do cadastro quando o fornecedor é pessoa física. */
export function semCamposDeEmpresa(f: Fornecedor): Fornecedor {
  return { ...f, nomeFantasia: "", inscricaoEstadual: "", inscricaoMunicipal: "", cnaes: [] };
}

/* -------------------------------- contatos ------------------------------- */

export type TipoContato = "telefone" | "email";

/** Uma linha do formulário: quem, por onde, e o número ou endereço. */
export interface LinhaContato {
  nome: string;
  tipo: TipoContato;
  valor: string;
  /** O cargo que o contato já tinha (vem das ECs); o formulário não edita, só não perde. */
  funcao?: string;
}

export const linhaContatoVazia = (): LinhaContato => ({ nome: "", tipo: "telefone", valor: "" });

/**
 * Do banco para o formulário. A pessoa que tem telefone E e-mail vira duas
 * linhas com o mesmo nome; a que não tem nenhum dos dois vira uma linha de
 * telefone em branco, para não sumir da tela.
 */
export function linhasDosContatos(contatos: ContatoFornecedor[] | undefined): LinhaContato[] {
  const linhas: LinhaContato[] = [];
  for (const c of contatos ?? []) {
    const base = { nome: (c.nome ?? "").trim(), ...(c.funcao?.trim() ? { funcao: c.funcao.trim() } : {}) };
    const tel = (c.telefone ?? "").trim();
    const email = (c.email ?? "").trim();
    if (tel) linhas.push({ ...base, tipo: "telefone", valor: tel });
    if (email) linhas.push({ ...base, tipo: "email", valor: email });
    if (!tel && !email && base.nome) linhas.push({ ...base, tipo: "telefone", valor: "" });
  }
  return linhas;
}

/**
 * Do formulário para o banco. Linhas do MESMO nome voltam a ser uma pessoa só
 * (o telefone e o e-mail da Maria são da mesma Maria); linha sem nome e sem
 * valor é descartada. Segundo telefone da mesma pessoa vira outro contato com
 * o mesmo nome — nada do que foi digitado se perde.
 */
export function contatosDasLinhas(linhas: LinhaContato[]): ContatoFornecedor[] {
  const contatos: ContatoFornecedor[] = [];
  for (const l of linhas) {
    const nome = l.nome.trim();
    const valor = l.valor.trim();
    if (!nome && !valor) continue;
    const campo = l.tipo === "email" ? "email" : "telefone";
    const mesmo = nome ? contatos.find((c) => chave(c.nome) === chave(nome) && !c[campo]) : undefined;
    if (mesmo) {
      if (valor) mesmo[campo] = valor;
      if (!mesmo.funcao && l.funcao) mesmo.funcao = l.funcao;
      continue;
    }
    contatos.push({ nome, ...(l.funcao ? { funcao: l.funcao } : {}), ...(valor ? { [campo]: valor } : {}) });
  }
  return contatos;
}

/* ------------------------------- validação ------------------------------- */

export type CampoCadastroFornecedor = "documento" | "nome" | "endereco" | "contatos";
export type ErrosCadastroFornecedor = Partial<Record<CampoCadastroFornecedor, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * O que impede o cadastro de ser gravado. Devolve um objeto vazio quando está
 * tudo certo. `outros` é o resto do cadastro: é contra ele que se confere a
 * duplicidade (o banco também recusa, mas avisar antes poupa o formulário).
 */
export function validarCadastroFornecedor(
  f: Fornecedor,
  tipo: TipoFornecedor,
  linhas: LinhaContato[],
  outros: Pick<Fornecedor, "id" | "cnpj" | "razaoSocial" | "nomeFantasia">[]
): ErrosCadastroFornecedor {
  const erros: ErrosCadastroFornecedor = {};
  const doc = digitos(f.cnpj);

  if (!doc) erros.documento = `Informe o ${tipo}.`;
  else if (tipo === "CNPJ" && !cnpjValido(doc)) erros.documento = "CNPJ inválido: confira os números digitados.";
  else if (tipo === "CPF" && !cpfValido(doc)) erros.documento = "CPF inválido: confira os números digitados.";
  else {
    const repetido = outros.find((o) => o.id !== f.id && digitos(o.cnpj) === doc);
    if (repetido) erros.documento = `Este ${tipo} já está cadastrado: ${repetido.nomeFantasia || repetido.razaoSocial || "fornecedor sem nome"}.`;
  }

  if (!f.razaoSocial.trim()) erros.nome = tipo === "CPF" ? "Informe o nome completo." : "Informe a razão social.";

  const end = validarEndereco(f.endereco);
  if (!end.completo) erros.endereco = `Endereço incompleto. ${textoDoQueFalta(end.faltando)}`;

  const emailRuim = linhas.find((l) => l.tipo === "email" && l.valor.trim() && !EMAIL.test(l.valor.trim()));
  const semValor = linhas.find((l) => l.nome.trim() && !l.valor.trim());
  if (emailRuim) erros.contatos = `E-mail inválido no contato ${emailRuim.nome.trim() || "sem nome"}: ${emailRuim.valor.trim()}`;
  else if (semValor) erros.contatos = `Informe o ${semValor.tipo === "email" ? "e-mail" : "telefone"} de ${semValor.nome.trim()}, ou remova a linha.`;

  return erros;
}
