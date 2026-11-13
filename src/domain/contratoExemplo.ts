/**
 * Um contrato de EXEMPLO (13/11/2026), para a pessoa ver como as cláusulas
 * padrão ficam no documento pronto — em Configurações › Contratos, antes de
 * valerem para as OS reais.
 *
 * Todos os dados são fictícios e se reconhecem como tais ("Exemplo"): nada aqui
 * vem de um cliente, fornecedor ou OS de verdade, e o documento nunca é gravado
 * em lugar nenhum.
 */
import type { Cliente, EmpresaGrupo, Os } from "@/data/types";
import { montarContrato, type ContratoDocumento } from "@/domain/contratoDocumento";
import type { ClausulasDaCasa, ModeloContrato } from "@/domain/contratoModelo";
import { TESTEMUNHAS_PADRAO, type TestemunhaFixa } from "@/domain/testemunhasContrato";

const cliente = (): Cliente =>
  ({
    nome: "Cliente Exemplo",
    apelido: "Exemplo",
    razaoSocial: "Cliente Exemplo S.A.",
    cnpjCpf: "11.222.333/0001-81",
    endereco: "Avenida Exemplo, 100 - Sala 1 - Centro - Belo Horizonte - MG - CEP: 30100-000",
    inscricaoEstadual: "Isenta",
    inscricaoMunicipal: "",
  }) as Cliente;

const empresas = (): EmpresaGrupo[] => [
  {
    id: "exemplo",
    nome: "Exemplo",
    razaoSocial: "Produtora Exemplo Ltda.",
    cnpj: "11222333000181",
    endereco: "Rua da Produtora, 200 - Bairro Exemplo - Belo Horizonte - MG - CEP: 30200-000",
    inscricaoEstadual: "000000000.00-00",
    inscricaoMunicipal: "",
    telefone: "(31) 3000-0000",
    ordem: 1,
    padrao: true,
  } as EmpresaGrupo,
];

export function contratoDeExemplo(
  modelo: ModeloContrato,
  casa: ClausulasDaCasa,
  testemunhas: TestemunhaFixa[] = TESTEMUNHAS_PADRAO,
): ContratoDocumento {
  const cultural = modelo === "Cultural";
  const projeto = {
    modalidade: modelo,
    clienteAbreviado: "Exemplo",
    nomeProjeto: cultural ? "Festival Exemplo" : "Convenção Exemplo",
    anoProjeto: "2027",
    titulo: cultural ? "Exemplo Festival 2027" : "Exemplo Convenção 2027",
    projetoIncentivado: cultural ? "Festival Exemplo 1a. Edição" : "",
    codigoProjetoIncentivado: cultural ? "Pronac No. 00 0000" : "",
    leiIncentivo: cultural ? "Lei Federal de Incentivo à Cultura" : "",
  };
  const descritivo = "Locação de sistema de som e iluminação para o palco principal do evento.";
  const os = {
    numero: "OS (00)",
    fornecedor: {
      apelido: "Fornecedor Exemplo",
      razaoSocial: "Fornecedor Exemplo Ltda.",
      cnpj: "44.555.666/0001-00",
      inscricaoEstadual: "Isenta",
      telefone: "(31) 99999-0000",
      endereco: "Rua do Fornecedor, 300 - Bairro Exemplo - Contagem - MG - CEP: 32000-000",
    },
    projeto,
    financeiro: { tomador: "exemplo", descritivoNf: descritivo },
    contrato: {
      contratante: "",
      descritivoServicos: descritivo,
      informacoesComplementares: "",
      valorUnitario: 5000,
      quantidade: 1,
      valorTotal: 5000,
      descontoNegociado: 0,
      valorAPagar: 5000,
      formaPagamento: "À vista, no ato da emissão da nota fiscal / fatura",
      observacoesGerais: "",
      dataContrato: "2027-01-15",
      rubrica: "",
    },
  } as unknown as Os;
  return montarContrato(os, {
    cliente: cliente(),
    empresas: empresas(),
    testemunhas,
    titulo: `Contrato de exemplo – ${modelo}`,
    clausulasDaCasa: casa,
  });
}
