import type { Ec } from "@/data/types";
import { dataBRCurta } from "@/lib/format";
const nomeArquivo = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();

export function nomeEcExcel(ec: Ec, modelo: "financeiro" | "completa"): string {
  const sufixo = modelo === "completa" ? "Completa" : "Financeiro";
  const versao = String(ec.versao).padStart(2, "0");
  const titulo = ec.projeto.titulo || ec.numero || "EC";
  return `${nomeArquivo(`${titulo} ${versao} Em ${dataBRCurta(ec.criadoEm)} - ${sufixo}`)}.xlsx`;
}
