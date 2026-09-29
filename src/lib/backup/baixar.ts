/**
 * Entrega ao navegador o pacote que a Edge Function devolveu.
 *
 * O pacote chega em base64 porque a resposta da função é JSON — não há como
 * mandar bytes crus por ali. A conversão é feita em pedaços: um `.zip` de
 * alguns megabytes vira um array de milhões de posições, e `String.fromCharCode
 * (...tudo)` estoura a pilha de chamadas do navegador nesse tamanho — o erro
 * clássico, que só aparece quando a base cresce.
 */
export function baixarArquivoBase64(nome: string, base64: string, tipo = "application/zip"): void {
  const bruto = atob(base64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);

  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Sem isto o blob fica na memória da aba até ela ser fechada — e um back-up
  // não é um arquivo pequeno.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
