/**
 * O CADASTRO DE CLIENTES como tela própria (27/11/2026).
 *
 * O cliente nascia dentro do projeto: quem criava o projeto digitava os dados e
 * eles eram arquivados de passagem. Agora há um cadastro, ao lado do de
 * fornecedores (tela Cadastros), com as mesmas garantias: documento conferido,
 * sem duplicidade, e um ID que se lê.
 *
 * Aqui ficam as regras que não dependem de tela.
 */
import type { Cliente } from "@/data/types";
import { cnpjValido, cpfValido } from "@/lib/cnpj";
import { validarEndereco, textoDoQueFalta } from "@/domain/endereco";

const digitos = (v: string | undefined | null) => (v ?? "").replace(/\D/g, "");
const chave = (v: string | undefined | null) =>
  (v ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export type TipoCliente = "CNPJ" | "CPF";

/** CPF tem 11 dígitos; todo o resto (inclusive em branco) é tratado como CNPJ. */
export const tipoDoCliente = (c: Pick<Cliente, "cnpjCpf">): TipoCliente => (digitos(c.cnpjCpf).length === 11 ? "CPF" : "CNPJ");

/** Cliente em branco, para o "Novo cliente". */
export const novoCliente = (): Cliente => ({
  id: "", apelido: "", nome: "", razaoSocial: "", endereco: "", cnpjCpf: "",
  inscricaoEstadual: "", inscricaoMunicipal: "",
  representante: { nome: "", cargo: "", telefones: "", email: "" },
});

/** O que só existe para empresa: sai do cadastro quando o cliente é pessoa física. */
export const semCamposDeEmpresaDoCliente = (c: Cliente): Cliente => ({ ...c, inscricaoEstadual: "", inscricaoMunicipal: "" });

export type CampoCadastroCliente = "documento" | "nome" | "apelido" | "endereco" | "representante";
export type ErrosCadastroCliente = Partial<Record<CampoCadastroCliente, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * O que impede o cadastro de ser gravado; objeto vazio quando está tudo certo.
 * `outros` é o resto do cadastro: contra ele se confere o documento repetido e
 * o apelido repetido (o apelido é o prefixo dos projetos do cliente — dois
 * clientes com o mesmo confundiriam os títulos).
 */
export function validarCadastroCliente(
  c: Cliente,
  tipo: TipoCliente,
  outros: Pick<Cliente, "id" | "cnpjCpf" | "nome" | "razaoSocial" | "apelido">[]
): ErrosCadastroCliente {
  const erros: ErrosCadastroCliente = {};
  const doc = digitos(c.cnpjCpf);

  if (!doc) erros.documento = `Informe o ${tipo}.`;
  else if (tipo === "CNPJ" && !cnpjValido(doc)) erros.documento = "CNPJ inválido: confira os números digitados.";
  else if (tipo === "CPF" && !cpfValido(doc)) erros.documento = "CPF inválido: confira os números digitados.";
  else {
    const repetido = outros.find((o) => o.id !== c.id && digitos(o.cnpjCpf) === doc);
    if (repetido) erros.documento = `Este ${tipo} já está cadastrado: ${repetido.nome || repetido.razaoSocial || "cliente sem nome"}.`;
  }

  if (!c.nome.trim()) erros.nome = "Informe o nome do cliente.";

  if (!c.apelido.trim()) erros.apelido = "Informe o apelido: é ele que abre o nome dos projetos do cliente.";
  else {
    const mesmo = outros.find((o) => o.id !== c.id && chave(o.apelido) === chave(c.apelido));
    if (mesmo) erros.apelido = `Este apelido já é do cliente ${mesmo.nome || mesmo.razaoSocial}.`;
  }

  const end = validarEndereco(c.endereco);
  if (!end.completo) erros.endereco = `Endereço incompleto. ${textoDoQueFalta(end.faltando)}`;

  const email = c.representante.email.trim();
  if (email && !EMAIL.test(email)) erros.representante = `E-mail do representante inválido: ${email}`;

  return erros;
}
