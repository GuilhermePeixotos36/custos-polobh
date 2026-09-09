/**
 * Consulta de CNPJ via BrasilAPI (pública, sem chave).
 * https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 * Plano B: erro é tratado e o usuário edita manualmente.
 */
import { onlyDigits, tituloProprio } from "./format";
import { padronizarTexto } from "@/domain/textos";

export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  perfilTributario: string;
  cnaes: string[];
  email: string;
  telefone: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
}

interface CnpjWsPublica {
  estabelecimento?: {
    estado?: { sigla?: string };
    inscricoes_estaduais?: Array<{
      inscricao_estadual?: string;
      ativo?: boolean;
      estado?: { sigla?: string };
    }>;
  };
}

interface DadosFiscaisExternos {
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
}

interface BrasilApiCnpj {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  descricao_situacao_cadastral: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string;
  email: string;
  opcao_pelo_mei: boolean;
  opcao_pelo_simples: boolean;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: { codigo: number; descricao: string }[];
}

function perfil(d: BrasilApiCnpj): string {
  if (d.opcao_pelo_mei) return "MEI";
  if (d.opcao_pelo_simples) return "Simples Nacional";
  return "Lucro Presumido/Real";
}

/**
 * A BrasilAPI devolve tudo em CAIXA ALTA. Aqui cada pedaço é normalizado
 * individualmente — a UF continua maiúscula e o CEP intocado, que colocar o
 * endereço inteiro no tituloProprio viraria "Mg" e "Cep:".
 */
function montarEndereco(d: BrasilApiCnpj): string {
  const t = (s?: string) => tituloProprio(s ?? "");
  const linha1 = [t(d.logradouro), d.numero].filter(Boolean).join(", ");
  const municipioUf = d.municipio ? `${t(d.municipio)}${d.uf ? ` - ${d.uf.toUpperCase()}` : ""}` : "";
  const partes = [linha1, t(d.complemento), t(d.bairro), municipioUf].filter(Boolean).join(" - ");
  return d.cep ? `${partes} - CEP: ${d.cep}` : partes;
}

/** Validação do dígito verificador do CNPJ (evita chamada à API com lixo). */
export function cnpjValido(cnpjRaw: string): boolean {
  const c = onlyDigits(cnpjRaw);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // todos os dígitos iguais
  const dv = (base: string): number => {
    const pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((s, d, i) => s + Number(d) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(c.slice(0, 12));
  const d2 = dv(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}

export function cpfValido(cpfRaw: string): boolean {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    const soma = base.split("").reduce((total, n, i) => total + Number(n) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(cpf.slice(0, 9), 10);
  const d2 = digito(cpf.slice(0, 9) + d1, 11);
  return cpf.endsWith(`${d1}${d2}`);
}

export const documentoFiscalValido = (valor: string): boolean => {
  const d = onlyDigits(valor);
  return d.length === 14 ? cnpjValido(d) : d.length === 11 ? cpfValido(d) : false;
};

export async function consultarCnpj(cnpjRaw: string): Promise<DadosCnpj> {
  const cnpj = onlyDigits(cnpjRaw);
  if (cnpj.length !== 14) {
    throw new Error("Informe um CNPJ com 14 dígitos.");
  }
  // Valida localmente antes de chamar a API — evita o 400 e dá mensagem clara.
  if (!cnpjValido(cnpj)) {
    throw new Error("CNPJ inválido — confira os números digitados.");
  }

  let resp: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: ctrl.signal });
    clearTimeout(timer);
  } catch {
    throw new Error("Sem resposta da consulta agora. Verifique a conexão e tente de novo, ou preencha manualmente.");
  }

  if (!resp.ok) {
    if (resp.status === 404) throw new Error("CNPJ não encontrado na base da Receita.");
    if (resp.status === 400) throw new Error("CNPJ inválido — confira os números digitados.");
    if (resp.status === 429) throw new Error("Muitas consultas em sequência. Aguarde alguns segundos e tente de novo.");
    throw new Error(`Não foi possível consultar agora (erro ${resp.status}). Preencha manualmente.`);
  }
  const d = (await resp.json()) as BrasilApiCnpj;

  // A BrasilAPI não fornece IE/IM. A API pública CNPJ.ws complementa a IE;
  // uma integração fiscal municipal pode ser configurada por endpoint próprio.
  let fiscais: DadosFiscaisExternos = {};
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const fiscalResp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (fiscalResp.ok) {
      const fiscal = (await fiscalResp.json()) as CnpjWsPublica;
      const inscricoes = fiscal.estabelecimento?.inscricoes_estaduais ?? [];
      const uf = d.uf || fiscal.estabelecimento?.estado?.sigla;
      const escolhida = inscricoes.find((i) => i.ativo !== false && i.estado?.sigla === uf)
        ?? inscricoes.find((i) => i.ativo !== false)
        ?? inscricoes[0];
      fiscais.inscricaoEstadual = escolhida?.inscricao_estadual ?? "";
    }
  } catch {
    // Consulta principal continua válida mesmo se a fonte fiscal estiver indisponível.
  }

  const endpointFiscal = import.meta.env.VITE_CNPJ_FISCAL_ENDPOINT as string | undefined;
  if (endpointFiscal) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const fiscalResp = await fetch(endpointFiscal.replace("{cnpj}", cnpj), { signal: ctrl.signal });
      clearTimeout(timer);
      if (fiscalResp.ok) fiscais = { ...fiscais, ...((await fiscalResp.json()) as DadosFiscaisExternos) };
    } catch {
      // O usuário ainda pode preencher as inscrições manualmente.
    }
  }

  const cnaes = [
    d.cnae_fiscal ? `${d.cnae_fiscal} - ${d.cnae_fiscal_descricao}` : "",
    ...(d.cnaes_secundarios ?? []).map((c) => `${c.codigo} - ${c.descricao}`),
  ].filter(Boolean);

  return {
    cnpj: cnpjRaw,
    // Estes campos entram no formulário por código (não por digitação), então
    // escapam do formatador de blur do Input. A gravação os padroniza de todo
    // jeito (ver `domain/textos`), mas eles são normalizados já aqui para
    // aparecerem certos na tela no instante da consulta — e não só depois de
    // salvar.
    razaoSocial: tituloProprio(d.razao_social ?? "", { preservarSiglas: true }),
    nomeFantasia: tituloProprio(d.nome_fantasia ?? ""),
    endereco: montarEndereco(d),
    perfilTributario: perfil(d),
    cnaes,
    email: d.email ?? "",
    telefone: d.ddd_telefone_1 ?? "",
    // A fonte devolve "ISENTO" em caixa alta; o número, quando existe, fica
    // intocado para continuar batendo com a Receita.
    inscricaoEstadual: padronizarTexto(fiscais.inscricaoEstadual, "inscricao"),
    inscricaoMunicipal: padronizarTexto(fiscais.inscricaoMunicipal, "inscricao"),
  };
}
