/**
 * A pergunta antes de largar um formulário preenchido — um texto e uma regra para o app inteiro.
 *
 * Pedido do usuário (13/11/2026): criando ou editando qualquer registro, sair do formulário (X,
 * ESC, clique fora, "Cancelar", trocar de tela, fechar a aba) tem que perguntar se a pessoa quer
 * mesmo descartar. Cada tela que já perguntava tinha o próprio texto; aqui fica o único.
 *
 * Só pergunta com alteração não salva ("sujo"): abrir e fechar sem mexer não é motivo para
 * interromper ninguém, e depois de salvar a tela fecha pelo caminho direto, sem guarda.
 *
 * Fora do React de propósito, como `avisos.ts`: o bloqueio de rota e o `beforeunload` são
 * estado do documento — precisam saber se há ALGUM formulário sujo aberto, em qualquer tela.
 */
import { confirmar } from "@/lib/avisos";

export const TEXTOS_DESCARTE = {
  alteracoes: {
    titulo: "Descartar alterações?",
    mensagem: "Você tem alterações não salvas. Se sair agora, elas serão perdidas.",
  },
  cadastro: {
    titulo: "Descartar cadastro?",
    mensagem: "O cadastro ainda não foi salvo. Se sair agora, o que foi preenchido será perdido.",
  },
  confirmar: "Descartar e sair",
  cancelar: "Continuar editando",
} as const;

export type OpcoesDescarte = {
  /** Registro que ainda não existe no banco: a pergunta fala em cadastro, não em alteração. */
  novo?: boolean;
};

// Uma pergunta por vez. ESC e clique no X quase juntos chegariam aqui duas vezes; com a fila do
// `avisos.ts`, a segunda pergunta apareceria logo depois de a pessoa responder a primeira.
let perguntaEmCurso: Promise<boolean> | null = null;

/** Pergunta se descarta. Resolve `true` só no "Descartar e sair". */
export function confirmarDescarte(opcoes: OpcoesDescarte = {}): Promise<boolean> {
  if (perguntaEmCurso) return perguntaEmCurso;
  const texto = opcoes.novo ? TEXTOS_DESCARTE.cadastro : TEXTOS_DESCARTE.alteracoes;
  perguntaEmCurso = confirmar(texto.mensagem, {
    titulo: texto.titulo,
    confirmar: TEXTOS_DESCARTE.confirmar,
    cancelar: TEXTOS_DESCARTE.cancelar,
    perigo: true,
  }).finally(() => { perguntaEmCurso = null; });
  return perguntaEmCurso;
}

/**
 * Sai na hora se não há o que perder; senão pergunta e só sai no "Descartar e sair".
 * Devolve se saiu.
 */
export async function sairSeConfirmar(
  sujo: boolean,
  sair: () => void,
  opcoes: OpcoesDescarte = {},
): Promise<boolean> {
  if (sujo && !(await confirmarDescarte(opcoes))) return false;
  sair();
  return true;
}

// ---------------------------------------------------------------------------------------------
// Quem está sujo agora — para o bloqueio de troca de rota e o aviso do navegador ao fechar a aba.

const formulariosSujos = new Set<symbol>();

function aoSairDaPagina(evento: BeforeUnloadEvent) {
  if (formulariosSujos.size === 0) return;
  // O navegador mostra o texto dele; o que importa é pedir a confirmação.
  evento.preventDefault();
  evento.returnValue = "";
}

/** Marca um formulário como sujo enquanto a função devolvida não for chamada. */
export function marcarFormularioSujo(): () => void {
  const marca = Symbol("formulario-sujo");
  if (formulariosSujos.size === 0 && typeof window !== "undefined") {
    window.addEventListener("beforeunload", aoSairDaPagina);
  }
  formulariosSujos.add(marca);
  return () => {
    formulariosSujos.delete(marca);
    if (formulariosSujos.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("beforeunload", aoSairDaPagina);
    }
  };
}

export const haFormularioSujo = (): boolean => formulariosSujos.size > 0;

// ---------------------------------------------------------------------------------------------
// "Sujo" = diferente do que abriu.

/**
 * Vazio é vazio: o campo que abre `null` do banco e vira `""` no primeiro foco (ou `undefined`
 * do opcional) não é alteração — senão a pergunta apareceria para quem só clicou num campo.
 */
const vazio = (valor: unknown) => valor === null || valor === undefined || valor === "";

/**
 * Compara o estado do formulário com o de quando abriu, por valor (objetos, listas, datas).
 * Ordem de chave não importa; ordem de lista importa (é a ordem que a pessoa vê).
 */
export function estaSujo(atual: unknown, inicial: unknown): boolean {
  return !iguais(atual, inicial);
}

function iguais(a: unknown, b: unknown): boolean {
  if (vazio(a) && vazio(b)) return true;
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => iguais(item, b[i]));
  }
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const chave of chaves) {
      if (!iguais((a as Record<string, unknown>)[chave], (b as Record<string, unknown>)[chave])) return false;
    }
    return true;
  }
  return false;
}
