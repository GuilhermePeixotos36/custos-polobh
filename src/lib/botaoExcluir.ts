/**
 * As regras do excluir em dois toques (`BotaoExcluir`), fora do componente para serem testadas
 * sem DOM.
 *
 * O `window.confirm` travava a aba inteira numa faixa cinza do navegador para perguntar "tem
 * certeza?" sobre UMA linha. Aqui a pergunta acontece no próprio botão: o primeiro toque arma, o
 * segundo (no "Excluir" vermelho que apareceu ao lado) executa.
 */

export type EstadoExcluir = "ocioso" | "confirmando" | "excluindo";

export type EventoExcluir =
  /** Toque na lixeira: arma, ou desarma se já estava armado. */
  | "alternar"
  | "cancelar"
  | "confirmar"
  /** A exclusão terminou — deu certo ou não. Quem avisa o erro é a tela, não o botão. */
  | "terminar";

export function proximoEstadoExcluir(estado: EstadoExcluir, evento: EventoExcluir): EstadoExcluir {
  switch (estado) {
    case "ocioso":
      // "confirmar" no ocioso é o segundo clique de um duplo-clique que chegou depois do
      // cancelamento: não pode excluir o que a pessoa acabou de desistir de excluir.
      return evento === "alternar" ? "confirmando" : "ocioso";
    case "confirmando":
      if (evento === "confirmar") return "excluindo";
      if (evento === "alternar" || evento === "cancelar") return "ocioso";
      return "confirmando";
    case "excluindo":
      // Com o pedido já no banco, cancelar não desfaz nada — só mentiria. Espera a resposta.
      return evento === "terminar" ? "ocioso" : "excluindo";
  }
}
