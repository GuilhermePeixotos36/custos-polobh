/**
 * IMPRESSÃO DIGITAL DA EC — o que foi para a pasta do projeto (11/11/2026).
 *
 * O "Salvar na pasta" decidia "mudou desde a pasta?" pela data de alteração da
 * EC. Só que o banco também mexe nessa data em ações que não mudam o documento
 * (definir a EC ativa, arquivar documentos do projeto), e aí o próximo "Salvar
 * na pasta" criava uma versão nova sem edição nenhuma. Agora a pasta guarda
 * esta impressão do CONTEÚDO, e a comparação é com ela.
 *
 * Fica de fora o que não é documento: identificadores, número e versão, datas,
 * status e "ativa", e as conversas (gerais e dos itens), que não saem na EC.
 */
import type { Ec } from "@/data/types";

/**
 * JSON com as chaves em ordem — o mesmo conteúdo dá sempre o mesmo texto. Os
 * campos `id` ficam de fora em qualquer nível: identificador não é conteúdo, e
 * alguns (as faixas do cronograma do projeto) são gerados na leitura.
 */
function estavel(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(estavel).join(",")}]`;
  if (valor && typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => k !== "id" && obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${estavel(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valor ?? null);
}

/** cyrb53 — hash curto e estável; não é segurança, é só "é o mesmo conteúdo?". */
function hash(texto: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** A impressão de qualquer conteúdo (o contrato, por exemplo): mesmo conteúdo, mesma impressão. */
export const impressaoDeConteudo = (valor: unknown): string => hash(estavel(valor));

export function impressaoDigitalEc(ec: Ec): string {
  const {
    numero: _numero, slugPublico: _slug, versao: _versao, status: _status,
    criadoEm: _criado, atualizadoEm: _atualizado, canceladaSubstituida: _cs, ativa: _ativa,
    baixadaEm: _baixada, observacoes: _obs,
    linhas, ...resto
  } = ec;
  const conteudo = {
    ...resto,
    linhas: linhas.map(({ observacoes: _lobs, observacao: _lob, ...l }) => l),
  };
  return hash(estavel(conteudo));
}
