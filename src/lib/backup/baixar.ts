import { baixarArquivo } from "@/lib/download";

/**
 * Entrega ao navegador o pacote que a Edge Function devolveu.
 *
 * O pacote chega em base64 porque a resposta da função é JSON — não há como
 * mandar bytes crus por ali. A conversão é feita em pedaços: um `.zip` de
 * alguns megabytes vira um array de milhões de posições, e `String.fromCharCode
 * (...tudo)` estoura a pilha de chamadas do navegador nesse tamanho — o erro
 * clássico, que só aparece quando a base cresce.
 *
 * O download em si é do `baixarArquivo` (24/11/2026): tirar o back-up inteiro do
 * sistema é justamente a exportação que mais precisa ficar na tela Logs. Ele
 * também libera o blob da memória da aba depois do clique.
 */
export function baixarArquivoBase64(nome: string, base64: string, tipo = "application/zip"): void {
  const bruto = atob(base64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);

  baixarArquivo(nome, new Blob([bytes], { type: tipo }), { detalhe: { origem: "back-up" } });
}
