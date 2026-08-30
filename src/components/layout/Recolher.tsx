/**
 * Recolher e expandir os blocos de informação de uma tela.
 *
 * Uma OS aberta é uma folha de quinze blocos — cliente, projeto, contratação,
 * cronograma, logística, infraestrutura, resumo dos custos, emissão, contrato,
 * acertos. Quem entra para conferir UM deles rola por todos os outros, e quem
 * quer ver a tela inteira não consegue: não cabe. O sumário existia só na
 * cabeça de quem já sabia a ordem.
 *
 * Com os blocos recolhidos a tela vira exatamente esse sumário — uma lista de
 * títulos em que se abre o que interessa. O comando de recolher/expandir tudo
 * mora no CABEÇALHO da página, que é grudado: ele acompanha a rolagem, então
 * dá para fechar o que já foi conferido sem voltar ao topo.
 *
 * Como as peças se ligam:
 *  · `ProvedorRecolher` — o `PageShell` embrulha a tela inteira nele, então
 *    QUALQUER tela ganha o mecanismo sem pedir nada;
 *  · `useSecaoRecolhivel(id)` — cada bloco se registra e diz se está recolhido;
 *  · `BotaoRecolherTudo` — o comando no cabeçalho, que só aparece quando a tela
 *    de fato tem blocos recolhíveis.
 *
 * Dois contextos, e não um: as AÇÕES têm identidade estável (nunca mudam), o
 * ESTADO muda a cada clique. Num contexto só, o efeito que registra o bloco
 * dependeria de um valor que muda — registrar, desregistrar, registrar — e a
 * tela entraria em laço.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "@/lib/format";

interface AcoesRecolher {
  /** Registra o bloco (devolve a baixa, para quando ele sai da tela). */
  registrar(id: string): () => void;
  alternar(id: string): void;
  /** Abre um bloco específico — usado por quem precisa levar a pessoa a um campo. */
  expandir(id: string): void;
  recolherTudo(): void;
  expandirTudo(): void;
}

interface EstadoRecolher {
  recolhidas: ReadonlySet<string>;
  /** Quantos blocos recolhíveis a tela tem agora. */
  total: number;
}

const VAZIO: ReadonlySet<string> = new Set();

const AcoesCtx = createContext<AcoesRecolher | null>(null);
const EstadoCtx = createContext<EstadoRecolher>({ recolhidas: VAZIO, total: 0 });

export function ProvedorRecolher({ children }: { children: ReactNode }) {
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<string>>(VAZIO);
  const [total, setTotal] = useState(0);
  /** Quem está na tela agora — o "tudo" de recolher tudo. */
  const registradas = useRef<Set<string>>(new Set());

  const acoes = useMemo<AcoesRecolher>(
    () => ({
      registrar(id) {
        registradas.current.add(id);
        setTotal(registradas.current.size);
        return () => {
          registradas.current.delete(id);
          setTotal(registradas.current.size);
          // O estado recolhido do bloco NÃO é apagado aqui: trocar de subaba e
          // voltar deve reencontrar a tela como se deixou.
        };
      },
      alternar(id) {
        setRecolhidas((atuais) => {
          const novo = new Set(atuais);
          if (!novo.delete(id)) novo.add(id);
          return novo;
        });
      },
      expandir(id) {
        setRecolhidas((atuais) => {
          if (!atuais.has(id)) return atuais;
          const novo = new Set(atuais);
          novo.delete(id);
          return novo;
        });
      },
      recolherTudo() {
        setRecolhidas(new Set(registradas.current));
      },
      expandirTudo() {
        setRecolhidas(VAZIO);
      },
    }),
    []
  );

  const estado = useMemo<EstadoRecolher>(() => ({ recolhidas, total }), [recolhidas, total]);

  return (
    <AcoesCtx.Provider value={acoes}>
      <EstadoCtx.Provider value={estado}>{children}</EstadoCtx.Provider>
    </AcoesCtx.Provider>
  );
}

/** As ações, para quem precisa abrir um bloco de fora (ver `destacarCampo`). */
export function useAcoesRecolher(): AcoesRecolher | null {
  return useContext(AcoesCtx);
}

/**
 * Liga um bloco ao mecanismo: ele se registra enquanto está na tela e passa a
 * responder ao recolher/expandir tudo.
 *
 * Fora de um `ProvedorRecolher` devolve "sempre expandido", sem quebrar — é o
 * que faz o componente do bloco servir também em tela de impressão.
 */
export function useSecaoRecolhivel(id: string): { recolhida: boolean; alternar: () => void } {
  const acoes = useContext(AcoesCtx);
  const { recolhidas } = useContext(EstadoCtx);
  // `acoes` tem identidade estável, então isto roda uma vez na montagem.
  useEffect(() => acoes?.registrar(id), [acoes, id]);
  const alternar = useCallback(() => acoes?.alternar(id), [acoes, id]);
  return { recolhida: recolhidas.has(id), alternar };
}

/**
 * O comando no cabeçalho. Some quando a tela tem menos de dois blocos — com um
 * bloco só, "recolher tudo" é só um botão a mais para ler.
 */
export function BotaoRecolherTudo({ className }: { className?: string }) {
  const acoes = useContext(AcoesCtx);
  const { recolhidas, total } = useContext(EstadoCtx);
  if (!acoes || total < 2) return null;
  // "Tudo recolhido" conta só o que está na tela agora: blocos de outra subaba
  // continuam guardados no estado e não podem decidir o rótulo deste botão.
  const tudoRecolhido = recolhidas.size >= total;
  return (
    <button
      type="button"
      onClick={tudoRecolhido ? acoes.expandirTudo : acoes.recolherTudo}
      title={tudoRecolhido ? "Abrir todos os blocos desta tela" : "Fechar todos os blocos e ver só os títulos"}
      className={cx(
        "inline-flex items-center gap-1.5 h-9 px-2.5 rounded-btn text-[12.5px] font-bold",
        "text-ink-2 hover:text-ink hover:bg-[#EDEEF1] transition-colors",
        className
      )}
    >
      {/* A seta mostra o ESTADO da tela, não o que o clique faz: para baixo com
          os blocos abertos, para a direita com tudo fechado. */}
      <Chevron aberta={!tudoRecolhido} />
      {tudoRecolhido ? "Expandir tudo" : "Recolher tudo"}
    </button>
  );
}

/**
 * Seta do estado do bloco: para baixo quando aberto (o conteúdo desce), para a
 * direita quando fechado. Gira em vez de trocar de ícone, para o olho seguir o
 * movimento em vez de reler o símbolo.
 */
export function Chevron({ aberta, className }: { aberta: boolean; className?: string }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx("transition-transform duration-150 shrink-0", aberta ? "" : "-rotate-90", className)}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Identidade de um bloco a partir do seu TÍTULO.
 *
 * Podia ser um `useId()`, mas o id seria diferente a cada montagem — e aí quem
 * precisa abrir um bloco pelo nome (o aviso que leva ao campo travado, por
 * exemplo) não teria como nomeá-lo. O título é estável e único dentro da tela.
 */
export const idSecao = (titulo: string): string =>
  "secao-" +
  titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
