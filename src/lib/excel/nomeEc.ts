import type { Ec } from "@/data/types";
import { tituloEc } from "@/domain/calc";

/**
 * Nome do arquivo Excel da EC: mesmo título usado no sistema
 * ("EC – {Projeto} ({NN}) em {DD/MM/AA}"), com os caracteres inválidos para
 * nome de arquivo (/, :, etc.) substituídos por espaço.
 */
export function nomeEcExcel(ec: Ec, modelo: "financeiro" | "completa"): string {
  // Só a planilha financeira leva complemento; a completa é "a" EC (30/10/2026).
  const sufixo = modelo === "financeiro" ? " - Financeiro" : "";
  const base = `${tituloEc(ec)}${sufixo}`.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return `${base}.xlsx`;
}
