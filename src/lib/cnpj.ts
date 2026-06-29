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

export async function consultarCnpj(cnpjRaw: string): Promise<DadosCnpj> {
  const cnpj = onlyDigits(cnpjRaw);
  if (cnpj.length !== 14) throw new Error("CNPJ inválido (precisa de 14 dígitos).");

  const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("CNPJ não encontrado na base pública.");
    throw new Error(`Falha na consulta (${resp.status}). Preencha manualmente.`);
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
