/**
 * DADOS PELO CPF/CNPJ, SOZINHOS (18/11/2026, pedido da Marisa):
 *
 *   "Os dados dos cadastros de clientes e fornecedores, a partir de seus CNPJs,
 *    deverão ser sempre lançados automaticamente pelo sistema em todas as
 *    oportunidades em que forem necessários."
 *
 * Eram botões ("Consultar CNPJ", "Validar") espalhados pelas telas, e quem não
 * clicava digitava à mão o que a casa já sabia. Aqui mora a busca única — os
 * cadastros da casa primeiro (são a memória dela: inscrições, endereço
 * conferido), a Receita depois — e o gatilho que a dispara quando o documento
 * fica completo.
 */
import { useEffect, useRef } from "react";
import { repo } from "@/data";
import { cnpjValido, consultarCnpj, cpfValido } from "@/lib/cnpj";
import { flags } from "@/lib/flags";
import { onlyDigits } from "@/lib/format";

/**
 * CPF ou CNPJ completo E válido (dígitos verificadores certos). Conferir o CPF
 * importa: quem digita um CNPJ passa pelo 11º dígito, e sem a conferência o
 * meio da digitação parecia um CPF e disparava a busca.
 */
export const documentoCompleto = (digitos: string): boolean =>
  (digitos.length === 11 && cpfValido(digitos)) || (digitos.length === 14 && cnpjValido(digitos));

/** O que se sabe de uma empresa (ou pessoa) pelo documento, e de onde veio. */
export interface DadosDoDocumento {
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  origem: "cliente" | "fornecedor" | "receita";
}

/** A frase que a tela mostra depois de preencher. */
export const AVISO_ORIGEM: Record<DadosDoDocumento["origem"], string> = {
  cliente: "Dados vindos do cadastro de clientes.",
  fornecedor: "Dados vindos do cadastro de fornecedores.",
  receita: "Dados preenchidos pelas fontes cadastrais e fiscais integradas.",
};

/**
 * Busca pelo CPF/CNPJ: cadastro de clientes, cadastro de fornecedores (os que
 * forem pedidos) e, para CNPJ, a Receita. `null` quando ninguém conhece o
 * documento — CPF sem cadastro não tem fonte pública.
 */
export async function buscarPorDocumento(
  documento: string,
  onde: { clientes?: boolean; fornecedores?: boolean },
): Promise<DadosDoDocumento | null> {
  const digitos = onlyDigits(documento);
  if (onde.clientes) {
    const c = (await repo.clientes.listar().catch(() => [])).find((x) => onlyDigits(x.cnpjCpf) === digitos);
    if (c) {
      return {
        razaoSocial: c.razaoSocial, nomeFantasia: c.nome, endereco: c.endereco,
        inscricaoEstadual: c.inscricaoEstadual, inscricaoMunicipal: c.inscricaoMunicipal, origem: "cliente",
      };
    }
  }
  if (onde.fornecedores) {
    const f = await repo.fornecedores.porCnpj(digitos).catch(() => undefined);
    if (f) {
      return {
        razaoSocial: f.razaoSocial, nomeFantasia: f.nomeFantasia ?? "", endereco: f.endereco,
        inscricaoEstadual: f.inscricaoEstadual, inscricaoMunicipal: f.inscricaoMunicipal, origem: "fornecedor",
      };
    }
  }
  if (digitos.length !== 14 || !flags.consultaCnpj) return null;
  const r = await consultarCnpj(digitos);
  return {
    razaoSocial: r.razaoSocial, nomeFantasia: r.nomeFantasia, endereco: r.endereco,
    // IE vazia aqui quando a Receita não a tem: quem chama decide entre o que
    // já está digitado e o "Isenta" (ver `ieDaBusca`).
    inscricaoEstadual: r.inscricaoEstadual, inscricaoMunicipal: r.inscricaoMunicipal, origem: "receita",
  };
}

/**
 * A IE depois de uma busca: a encontrada; se não, a que já estava digitada; e
 * só na falta das duas, "Isenta" quando a Receita respondeu sem IE (29/09/2026).
 */
export function ieDaBusca(d: DadosDoDocumento, atual: string): string {
  return d.inscricaoEstadual || atual || (d.origem === "receita" ? "Isenta" : "");
}

/**
 * Chama `aoCompletar` quando o CPF/CNPJ do campo MUDA e fica completo.
 *
 * O documento que já estava lá quando o campo ficou ativo não dispara nada —
 * abrir uma tela não pode sair consultando a Receita nem mexer no que foi
 * gravado. Só a digitação (ou a colagem) de um documento novo dispara.
 */
export function useAoCompletarDocumento(
  documento: string,
  ativo: boolean,
  aoCompletar: (digitos: string) => void,
  /** O registro em tela: trocou de registro (outra linha, outro cadastro), o documento dele é o novo ponto de partida. */
  chave?: string,
) {
  const visto = useRef<string | null>(null);
  const chaveVista = useRef(chave);
  const digitos = onlyDigits(documento);
  useEffect(() => {
    if (!ativo) {
      visto.current = null;
      return;
    }
    if (chaveVista.current !== chave) {
      chaveVista.current = chave;
      visto.current = digitos;
      return;
    }
    if (visto.current === null || visto.current === digitos) {
      visto.current = digitos;
      return;
    }
    visto.current = digitos;
    if (documentoCompleto(digitos)) aoCompletar(digitos);
    // `aoCompletar` fica fora: o gatilho é o documento, não a função nova de cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, digitos, chave]);
}
