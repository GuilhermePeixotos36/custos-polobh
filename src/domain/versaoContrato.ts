/**
 * AS VERSÕES DO CONTRATO (11/11/2026): "cada versão é identificada por um número
 * subsequente e arquiva a anterior", como as ECs e as OSs.
 *
 *  · nunca emitido → vai como a (01);
 *  · já emitido e o conteúdo é o mesmo → continua a mesma versão (o arquivo já
 *    está na pasta; emitir de novo não cria nada);
 *  · já emitido e o conteúdo mudou → nasce a seguinte, e a anterior segue na
 *    pasta como estava (o nome de cada arquivo leva a versão, então nada é
 *    substituído).
 *
 * "Mudou" é pelo CONTEÚDO do contrato (a impressão digital), não pela data de
 * gravação da OS — a OS é regravada por muitos motivos que não tocam no
 * contrato, e cada um geraria uma versão à toa (foi o que aconteceu com a EC).
 */
import type { ContratoOs } from "@/data/types";

export function versaoDoContrato(
  ct: Pick<ContratoOs, "versaoEmitida" | "impressaoEmitida">,
  impressaoAtual: string
): { versao: number; jaEmitido: boolean } {
  const emitida = ct.versaoEmitida ?? 0;
  if (emitida < 1) return { versao: 1, jaEmitido: false };
  if (ct.impressaoEmitida && ct.impressaoEmitida === impressaoAtual) return { versao: emitida, jaEmitido: true };
  return { versao: emitida + 1, jaEmitido: false };
}
