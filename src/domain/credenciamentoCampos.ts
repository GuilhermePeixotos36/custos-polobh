/**
 * Quais dados o fornecedor preenche no CREDENCIAMENTO — escolhidos por evento.
 *
 * Pedido de 15/09/2026: *"criar um sistema de, a cada credenciamento, a gente
 * escolher quais serão os campos do formulário a ser preenchido pelo
 * fornecedor"*. O formulário era fixo em nome, CPF e função (mais veículo e
 * placa), e a lista da Pólobh é maior — RG, endereço, telefone, aniversário.
 *
 * A escolha é POR CREDENCIAMENTO, e não uma configuração da casa, porque o que
 * o evento exige muda com ele: um credenciamento de estádio pede RG e placa; um
 * almoço de trinta pessoas pede nome e função, e pedir o resto é atrito para o
 * fornecedor e dado sensível guardado à toa.
 *
 * NOME é obrigatório sempre e não entra na escolha: sem ele, a linha da planilha
 * não identifica ninguém.
 */

export type CampoCredenciamento =
  | "funcao"
  | "rg"
  | "cpf"
  | "endereco"
  | "telefone"
  | "aniversario"
  | "veiculo"
  | "placa";

export const CAMPOS_CREDENCIAMENTO: { campo: CampoCredenciamento; rotulo: string; dica?: string }[] = [
  { campo: "funcao", rotulo: "Função" },
  { campo: "rg", rotulo: "RG" },
  { campo: "cpf", rotulo: "CPF" },
  { campo: "endereco", rotulo: "Endereço completo" },
  { campo: "telefone", rotulo: "Telefone celular com DDD" },
  { campo: "aniversario", rotulo: "Data de aniversário" },
  { campo: "veiculo", rotulo: "Veículo (marca e modelo)", dica: "abre o bloco de veículos" },
  { campo: "placa", rotulo: "Placa", dica: "junto do veículo" },
];

/**
 * O que um credenciamento pede quando ninguém escolheu nada.
 *
 * São os campos que o formulário SEMPRE teve: mudar o padrão mudaria, em
 * silêncio, o que os credenciamentos já disparados pedem de quem ainda não
 * respondeu.
 */
export const CAMPOS_PADRAO: CampoCredenciamento[] = ["funcao", "cpf", "veiculo", "placa"];

/** Os campos deste credenciamento, com o padrão de quem nunca escolheu. */
export const camposDoCredenciamento = (escolhidos?: CampoCredenciamento[]): CampoCredenciamento[] =>
  escolhidos?.length ? escolhidos : CAMPOS_PADRAO;

/** Este credenciamento pede algum dado de veículo? */
export const pedeVeiculo = (campos: CampoCredenciamento[]): boolean =>
  campos.includes("veiculo") || campos.includes("placa");
