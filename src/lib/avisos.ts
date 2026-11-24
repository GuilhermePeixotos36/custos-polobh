/**
 * Avisos e confirmações do app, sem `window.alert` e sem `window.confirm`.
 *
 * O diálogo do navegador aparecia como uma faixa cinza colada no topo da janela, com o endereço
 * do site em cima ("dp-corp.vercel.app diz"), e despejava lá dentro a mensagem crua do Postgres
 * — `new row for relation "colaborador" violates check constraint …`. Quem está cadastrando um
 * colaborador não tem por que ler nome de restrição em inglês, e a faixa do navegador não
 * pertence ao app: não segue a paleta, não fecha com ESC, não distingue erro de confirmação e
 * ainda trava a aba inteira enquanto está aberta.
 *
 * A API é imperativa de propósito. As chamadas estão espalhadas por vinte e tantos pontos, boa
 * parte dentro de `.catch()` de promessa — fora de componente, sem hook à mão. Um contexto de
 * React obrigaria a reescrever cada um desses pontos como componente; aqui basta trocar
 * `window.alert(x)` por `void alerta(x)`, e `window.confirm(x)` por `await confirmar(x)`.
 *
 * A fila existe porque o `window.confirm` era síncrono e o código chamador contava com isso: em
 * `_app.ferias.tsx` duas falhas seguidas disparam dois avisos no mesmo instante. Com um só
 * estado, o segundo apagaria o primeiro antes de alguém ler. Enfileirados, aparecem um após o
 * outro.
 */

export type TomDoAviso = "erro" | "atencao" | "sucesso" | "info";

export type Aviso = {
  id: number;
  tom: TomDoAviso;
  titulo: string;
  mensagem: string;
  /** Presente só nas confirmações — é o que faz aparecer o segundo botão. */
  confirmacao?: { rotuloConfirmar: string; rotuloCancelar: string; perigo: boolean };
  /** `true` = confirmou; `false` = cancelou ou fechou. Um alerta sempre resolve `true`. */
  responder: (confirmado: boolean) => void;
};

type Ouvinte = (aviso: Aviso | null) => void;

const fila: Aviso[] = [];
const ouvintes = new Set<Ouvinte>();
let proximoId = 1;

const atual = (): Aviso | null => fila[0] ?? null;
const avisar = () => { for (const ouvinte of ouvintes) ouvinte(atual()); };

/** Assina o aviso da vez. Devolve a função que cancela a assinatura. */
export function assinarAvisos(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  ouvinte(atual());
  return () => { ouvintes.delete(ouvinte); };
}

export const avisoAtual = (): Aviso | null => atual();

/**
 * Fecha o aviso da vez e deixa passar o próximo da fila.
 *
 * Ignora respostas fora de hora — um clique duplo no "OK" chegaria duas vezes, e a segunda
 * responderia ao aviso seguinte, que ninguém leu ainda.
 */
export function responderAviso(id: number, confirmado: boolean) {
  const aviso = fila[0];
  if (!aviso || aviso.id !== id) return;
  fila.shift();
  avisar();
  aviso.responder(confirmado);
}

function enfileirar(aviso: Omit<Aviso, "id" | "responder">): Promise<boolean> {
  return new Promise<boolean>((resolver) => {
    fila.push({ ...aviso, id: proximoId++, responder: resolver });
    // Só o primeiro da fila está na tela; os demais entram sem mexer no que já apareceu.
    if (fila.length === 1) avisar();
  });
}

/** Mensagem de uma via: aparece, a pessoa lê, fecha. O `await` espera o fechamento. */
export function alerta(
  mensagem: string,
  opcoes: { titulo?: string; tom?: TomDoAviso } = {},
): Promise<boolean> {
  const tom = opcoes.tom ?? "erro";
  return enfileirar({
    tom,
    titulo: opcoes.titulo ?? TITULO_PADRAO[tom],
    mensagem,
  });
}

/**
 * Pergunta de sim ou não. Resolve `true` só no botão de confirmar — ESC, clique fora e "Cancelar"
 * resolvem `false`, como o `window.confirm` fazia.
 */
export function confirmar(
  mensagem: string,
  opcoes: {
    titulo?: string;
    confirmar?: string;
    cancelar?: string;
    /** Pinta o botão de confirmar de vermelho: exclusão, cancelamento, o que não volta atrás. */
    perigo?: boolean;
  } = {},
): Promise<boolean> {
  return enfileirar({
    tom: opcoes.perigo ? "erro" : "atencao",
    titulo: opcoes.titulo ?? "Confirmar",
    mensagem,
    confirmacao: {
      rotuloConfirmar: opcoes.confirmar ?? "Confirmar",
      rotuloCancelar: opcoes.cancelar ?? "Cancelar",
      perigo: opcoes.perigo ?? false,
    },
  });
}

const TITULO_PADRAO: Record<TomDoAviso, string> = {
  erro: "Não foi possível concluir",
  atencao: "Atenção",
  sucesso: "Pronto",
  info: "Aviso",
};

/**
 * Atalho para o `catch`: mostra a mensagem do erro, ou o texto de reserva quando o que veio não
 * é um `Error` — rejeição de promessa aceita qualquer coisa, inclusive `undefined`.
 */
export function alertaDeErro(erro: unknown, reserva: string): Promise<boolean> {
  return alerta(erro instanceof Error && erro.message ? erro.message : reserva);
}
