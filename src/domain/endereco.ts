/**
 * ENDEREÇO PADRONIZADO (13/11/2026, pedido da Marisa).
 *
 * O endereço era uma linha de texto livre, digitada à mão ou trazida da consulta
 * de CNPJ — e saía de cada jeito: sem "Avenida" antes do nome da rua (a consulta
 * descartava o tipo do logradouro), com "CEP:" em uns e sem em outros, com
 * vírgulas onde o contrato quer hífen. Agora o endereço tem CAMPOS, e uma só
 * função o escreve:
 *
 *   Rua Nome, Número - Complemento - Bairro - Cidade - UF - CEP: 00000-000
 *
 * O que o resto do app consome continua sendo o TEXTO (`endereco: string`) — o
 * contrato, a OS, o e-mail e as planilhas não mudam —; os campos existem para
 * quem digita, e `lerEndereco` devolve os campos a partir do texto já gravado.
 */

export interface EnderecoPartes {
  /** Rua, Avenida, Travessa… */
  tipo: string;
  /** Nome da rua/avenida, sem o tipo. */
  nome: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export const ENDERECO_VAZIO: EnderecoPartes = {
  tipo: "",
  nome: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
};

export const TIPOS_LOGRADOURO = [
  "Rua",
  "Avenida",
  "Travessa",
  "Alameda",
  "Praça",
  "Rodovia",
  "Estrada",
  "Largo",
  "Via",
  "Viela",
  "Beco",
  "Parque",
  "Quadra",
  "Setor",
  "Condomínio",
  "Fazenda",
  "Sítio",
] as const;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/** Campos que o endereço exige (o complemento é opcional). */
export const CAMPOS_OBRIGATORIOS: (keyof EnderecoPartes)[] = ["tipo", "nome", "numero", "bairro", "cidade", "uf", "cep"];

export const ROTULO_CAMPO: Record<keyof EnderecoPartes, string> = {
  tipo: "Tipo (Rua, Avenida…)",
  nome: "Nome da rua ou avenida",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "UF",
  cep: "CEP",
};

/** "30575834" → "30575-834"; o que não tem 8 dígitos fica como veio. */
export function formatarCep(cru: string): string {
  const d = (cru ?? "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (cru ?? "").trim();
}

/** Abreviações e caixa alta que a Receita e a digitação trazem → o tipo por extenso. */
const ALIAS_TIPO: Record<string, string> = {
  r: "Rua", rua: "Rua",
  av: "Avenida", avenida: "Avenida",
  tv: "Travessa", trav: "Travessa", travessa: "Travessa",
  al: "Alameda", alameda: "Alameda",
  pc: "Praça", pca: "Praça", praca: "Praça", "praça": "Praça",
  rod: "Rodovia", rodovia: "Rodovia",
  est: "Estrada", estr: "Estrada", estrada: "Estrada",
  lgo: "Largo", largo: "Largo",
  via: "Via", viela: "Viela", beco: "Beco", parque: "Parque", pq: "Parque",
  quadra: "Quadra", setor: "Setor",
  "condomínio": "Condomínio", condominio: "Condomínio",
  fazenda: "Fazenda", sitio: "Sítio", "sítio": "Sítio",
};

export function tipoPorExtenso(cru: string): string {
  const k = (cru ?? "").trim().replace(/\.$/, "").toLocaleLowerCase("pt-BR");
  return ALIAS_TIPO[k] ?? "";
}

const preenchido = (s: string) => (s ?? "").trim();

/** Quais campos obrigatórios estão vazios. */
export function camposFaltando(p: EnderecoPartes): (keyof EnderecoPartes)[] {
  return CAMPOS_OBRIGATORIOS.filter((c) => !preenchido(p[c]));
}

/**
 * Escreve o endereço no padrão da casa. Campo vazio simplesmente não entra —
 * quem está no meio da digitação vê o que já escreveu, e a validação
 * (`camposFaltando`) é que diz o que falta.
 */
export function formatarEndereco(p: EnderecoPartes): string {
  const nomeComTipo = [preenchido(p.tipo), preenchido(p.nome)].filter(Boolean).join(" ");
  const linha1 = [nomeComTipo, preenchido(p.numero)].filter(Boolean).join(", ");
  const cep = preenchido(p.cep) ? `CEP: ${formatarCep(p.cep)}` : "";
  return [linha1, preenchido(p.complemento), preenchido(p.bairro), preenchido(p.cidade), preenchido(p.uf).toUpperCase(), cep]
    .filter(Boolean)
    .join(" - ");
}

/**
 * O contrário: lê o texto já gravado e devolve os campos. É uma leitura de boa
 * vontade — o texto livre de antes não tinha formato —, e o que não se reconhece
 * fica de fora (o tipo, por exemplo, é "" quando o endereço começa direto no
 * nome da rua), para o campo aparecer vazio e a pessoa completar.
 *
 * `padronizado` diz se o texto, reescrito pelos campos, sai igual ao que está
 * gravado: é o que decide se a tela mostra o aviso "endereço fora do padrão".
 */
export function lerEndereco(texto: string): { partes: EnderecoPartes; padronizado: boolean } {
  const bruto = (texto ?? "").trim();
  if (!bruto) return { partes: { ...ENDERECO_VAZIO }, padronizado: true };

  let resto = bruto;
  let cep = "";
  const mCep = /(?:^|[\s,;-]+)(?:CEP\s*:?\s*)?(\d{5}-?\d{3})\s*$/i.exec(resto);
  if (mCep) {
    cep = formatarCep(mCep[1]);
    resto = resto.slice(0, mCep.index).replace(/[\s,;-]+$/, "");
  }

  const segmentos = resto.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean);

  let uf = "";
  let cidade = "";
  let bairro = "";
  const ultimo = segmentos[segmentos.length - 1] ?? "";
  if (segmentos.length >= 2 && /^[A-Za-z]{2}$/.test(ultimo) && (UFS as readonly string[]).includes(ultimo.toUpperCase())) {
    uf = ultimo.toUpperCase();
    segmentos.pop();
    cidade = segmentos.pop() ?? "";
    // "Bairro, Cidade" numa vírgula só (o formato antigo da consulta de CNPJ):
    if (cidade.includes(",")) {
      const i = cidade.lastIndexOf(",");
      bairro = cidade.slice(0, i).trim();
      cidade = cidade.slice(i + 1).trim();
    }
  }

  // Primeiro segmento: "Tipo Nome, Número" (o número vem depois da última vírgula).
  const primeiro = segmentos.shift() ?? "";
  let nomeComTipo = primeiro;
  let numero = "";
  const iv = primeiro.lastIndexOf(",");
  if (iv > 0) {
    nomeComTipo = primeiro.slice(0, iv).trim();
    numero = primeiro.slice(iv + 1).trim();
  }
  let tipo = "";
  const palavras = nomeComTipo.split(/\s+/);
  const alias = tipoPorExtenso(palavras[0] ?? "");
  if (alias && palavras.length > 1) {
    tipo = alias;
    nomeComTipo = palavras.slice(1).join(" ");
  }

  // O que sobrou entre o endereço e a cidade: o último é o bairro; antes dele, o complemento.
  let complemento = "";
  if (segmentos.length) {
    if (!bairro) bairro = segmentos.pop() ?? "";
    complemento = segmentos.join(" - ");
  }

  const partes: EnderecoPartes = { tipo, nome: nomeComTipo, numero, complemento, bairro, cidade, uf, cep };
  return { partes, padronizado: formatarEndereco(partes) === bruto && camposFaltando(partes).length === 0 };
}

/* --------------------- validação do endereço --------------------- */

/**
 * O endereço está completo? (13/11/2026: a Marisa pediu campos obrigatórios e
 * que o salvamento seja BLOQUEADO enquanto faltar algo.) Devolve o que falta,
 * para a tela apontar campo a campo.
 */
export function validarEndereco(texto: string): { completo: boolean; faltando: (keyof EnderecoPartes)[] } {
  const faltando = camposFaltando(lerEndereco(texto).partes);
  return { completo: faltando.length === 0, faltando };
}

/** "Falta o tipo (Rua, Avenida…), o CEP." — o que a mensagem de erro diz. */
export function textoDoQueFalta(faltando: (keyof EnderecoPartes)[]): string {
  if (!faltando.length) return "";
  const nomes = faltando.map((c) => ROTULO_CAMPO[c].replace(/ \(.*\)$/, "").toLocaleLowerCase("pt-BR"));
  return `Falta ${nomes.join(", ")}.`;
}
