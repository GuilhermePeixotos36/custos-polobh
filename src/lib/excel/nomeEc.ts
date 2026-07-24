import type { Ec } from "@/data/types";
import { tituloEc } from "@/domain/calc";

/**
 * Nome do arquivo Excel da EC: mesmo título usado no sistema
 * ("EC – {Projeto} ({NN}) em {DD/MM/AA}"), com os caracteres inválidos para
 * nome de arquivo (/, :, etc.) substituídos por espaço.
 */
export function nomeEcExcel(ec: Ec, modelo: "financeiro" | "completa"): string {
  const sufixo = modelo === "completa" ? "Completa" : "Financeiro";
  const base = `${tituloEc(ec)} - ${sufixo}`.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return `${base}.xlsx`;
}
