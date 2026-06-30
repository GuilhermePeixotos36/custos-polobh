/**
 * Consulta de CNPJ via BrasilAPI (pública, sem chave).
 * https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 * Plano B: erro é tratado e o usuário edita manualmente.
 */
import { onlyDigits } from "./format";

export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  perfilTributario: string;
  cnaes: string[];
  email: string;
  telefone: string;
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

function montarEndereco(d: BrasilApiCnpj): string {
  const linha1 = [d.logradouro, d.numero].filter(Boolean).join(", ");
  const partes = [linha1, d.complemento, d.bairro, `${d.municipio} - ${d.uf}`]
    .filter(Boolean)
    .join(" - ");
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

  const cnaes = [
    d.cnae_fiscal ? `${d.cnae_fiscal} - ${d.cnae_fiscal_descricao}` : "",
    ...(d.cnaes_secundarios ?? []).map((c) => `${c.codigo} - ${c.descricao}`),
  ].filter(Boolean);

  return {
    cnpj: cnpjRaw,
    razaoSocial: d.razao_social ?? "",
    nomeFantasia: d.nome_fantasia ?? "",
    endereco: montarEndereco(d),
    perfilTributario: perfil(d),
    cnaes,
    email: d.email ?? "",
    telefone: d.ddd_telefone_1 ?? "",
  };
}
