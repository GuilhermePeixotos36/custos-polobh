/**
 * O Help Desk é um painel POR CIMA da tela, e não uma tela.
 *
 * Quem pede ajuda está no meio de outra coisa: montando uma OS, conferindo uma
 * EC, com o cliente esperando. Mandar essa pessoa para uma página de suporte é
 * fazê-la abandonar o que estava fazendo — e, pior, perder de vista justamente
 * o que ela precisa descrever. O painel abre sobre a tela, com ela intacta
 * atrás; fechar devolve tudo exatamente como estava.
 *
 * Por isso o estado mora aqui, num store, e não na rota: o painel é convocado
 * de qualquer lugar (o botão do cabeçalho, um link de e-mail) sem que ninguém
 * saia do lugar.
 */
import { create } from "zustand";

export type AbaSuporte = "novo" | "meus" | "fila";

interface EstadoSuporte {
  aberto: boolean;
  aba: AbaSuporte;
  /**
   * A tela em que a pessoa estava quando pediu ajuda.
   *
   * Gravada na ABERTURA, e não lida no momento de enviar: o painel não navega,
   * mas nada impede a pessoa de abrir o painel, fechá-lo, andar e voltar — e o
   * chamado precisa falar de onde o problema aconteceu.
   */
  telaOrigem: string;
  /**
   * O painel está escondido para o print sair limpo.
   *
   * Fotografar a tela com o painel aberto devolveria uma imagem do formulário
   * de chamado por cima do problema. Ele some por um instante, o quadro é
   * tirado, e ele volta.
   */
  ocultoParaPrint: boolean;
  abrir: (aba?: AbaSuporte, tela?: string) => void;
  fechar: () => void;
  irPara: (aba: AbaSuporte) => void;
  ocultarParaPrint: (oculto: boolean) => void;
}

export const useSuporte = create<EstadoSuporte>((set) => ({
  aberto: false,
  aba: "novo",
  telaOrigem: "",
  ocultoParaPrint: false,
  abrir: (aba = "novo", tela) =>
    set({
      aberto: true,
      aba,
      telaOrigem: tela ?? (typeof location !== "undefined" ? location.pathname + location.search : ""),
      ocultoParaPrint: false,
    }),
  fechar: () => set({ aberto: false, ocultoParaPrint: false }),
  irPara: (aba) => set({ aba }),
  ocultarParaPrint: (oculto) => set({ ocultoParaPrint: oculto }),
}));

/** Atalho para quem está fora de um componente. */
export const abrirSuporte = (aba?: AbaSuporte) => useSuporte.getState().abrir(aba);
