/**
 * A casca comum de modal: véu, painel, ESC, portal e a saída animada.
 *
 * Cada tela do app montava o próprio modal — `fixed inset-0`, véu, painel, `useFecharComEsc` —, e
 * por isso nenhum deles tinha saída: para animar o fechamento, cada um precisaria segurar o
 * conteúdo na tela depois que a dona já tinha zerado o item selecionado. Aqui isso é resolvido
 * uma vez. A casca guarda o último conteúdo aberto e continua mostrando-o durante os 120ms da
 * saída, então a tela pode limpar o estado no mesmo clique do "Fechar" sem o modal esvaziar
 * enquanto some.
 *
 * Sai por portal no `body`, como a `CentralDeAvisos`: um ancestral com `transform` (a entrada de
 * um card, o tremor de uma mensagem) viraria o referencial do `position: fixed` e o modal abriria
 * preso à caixa dele em vez da janela.
 *
 * Duas formas de uso:
 * - modal que fica montado e recebe `aberto` (`<JanelaModal aberto={x} …>`);
 * - modal que a tela monta só quando há item (`{item && <Modal item={item} />}`): troque por
 *   `<Presenca valor={item}>{(i) => <Modal item={i} />}</Presenca>` e deixe o `aberto` de fora —
 *   a casca descobre pela `Presenca` quando está saindo.
 *
 * Formulário: passe `sujo` (e `novo` no cadastro). Com alteração não salva, ESC, clique fora e o
 * X do `CabecalhoJanela` perguntam antes de fechar (`guardaDeSaida.ts`) — a pergunta mora aqui
 * para nenhuma tela esquecer um dos caminhos. O "Cancelar" do rodapé, que a tela desenha, chama
 * `sairSeConfirmar(sujo, fechar, { novo })`; depois de salvar, a tela fecha direto, sem guarda.
 */
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { useFecharComEsc } from "@/lib/modalEsc";
import { usePresenca } from "@/lib/presenca";
import { useGuardaDeSaida } from "@/lib/useGuardaDeSaida";

/** `null` fora de uma `Presenca`; dentro dela, se o conteúdo está saindo. */
const ContextoSaindo = createContext<boolean | null>(null);

type PedirParaSair = (sair: () => void) => Promise<boolean>;

/**
 * A guarda da janela de cima, para o X do `CabecalhoJanela` passar pela mesma pergunta do ESC.
 * Cada `JanelaModal` provê a sua: o X do modal de dentro não pergunta pelo formulário de fora.
 */
const ContextoGuardaDaJanela = createContext<PedirParaSair | null>(null);

/** Fora de uma `JanelaModal`, `null`: quem chama fecha direto. */
export const usePedirParaSairDaJanela = (): PedirParaSair | null => useContext(ContextoGuardaDaJanela);

/**
 * Mantém montado, por mais um instante, o que a tela acabou de tirar — e o mostra com o último
 * valor que teve, para o modal não esvaziar no meio da saída.
 */
export function Presenca<T>({ valor, children }: {
  valor: T | null | undefined | false;
  children: (valor: T) => ReactNode;
}) {
  const presente = valor !== null && valor !== undefined && valor !== false;
  const { montado, saindo } = usePresenca(presente);
  const [ultimo, setUltimo] = useState(valor);
  // Estado derivado de prop, ajustado no render: guarda o valor enquanto ele existe.
  if (presente && valor !== ultimo) setUltimo(valor);

  const mostrado = presente ? valor : ultimo;
  if (!montado || mostrado === null || mostrado === undefined || mostrado === false) return null;
  return <ContextoSaindo.Provider value={saindo}>{children(mostrado as T)}</ContextoSaindo.Provider>;
}

type Props = {
  /** Omitido dentro de uma `Presenca`, que é quem sabe. Fora dela, o padrão é aberto. */
  aberto?: boolean;
  /** ESC e clique no véu chamam isto. Sem ele, o modal só fecha pelos botões de dentro. */
  onFechar?: () => void;
  /** `false` para formulário longo, em que um clique fora sem querer perderia o preenchido. */
  fecharNoVeu?: boolean;
  /** Formulário com alteração não salva: ESC, clique fora e o X perguntam antes de fechar. */
  sujo?: boolean;
  /** Registro novo: a pergunta fala em "Descartar cadastro?". */
  novo?: boolean;
  role?: "dialog" | "alertdialog";
  /** Nome acessível — o título do modal, como a pessoa o lê. */
  rotulo?: string;
  rotuloId?: string;
  descricaoId?: string;
  /** Camada do conjunto. 9990 é a dos modais de tela; a `CentralDeAvisos` fica acima. */
  camada?: number;
  /** `topo` para o formulário mais alto que a janela: o painel rola junto com o véu. */
  alinhar?: "centro" | "topo";
  /**
   * Classes do painel: largura, altura, fundo e `overflow`. Canto, contorno e sombra não — são da
   * `.janela-modal` (styles.css), para todo popup sair com a mesma superfície.
   */
  className?: string;
  children: ReactNode;
};

export function JanelaModal({
  aberto: abertoProp, onFechar, fecharNoVeu = true, sujo = false, novo = false, role = "dialog", rotulo,
  rotuloId, descricaoId, camada = 9990, alinhar = "centro", className, children,
}: Props) {
  const saindoDaPresenca = useContext(ContextoSaindo);
  const aberto = abertoProp ?? (saindoDaPresenca === null ? true : !saindoDaPresenca);
  const { montado, saindo } = usePresenca(aberto);
  const pedirParaSair = useGuardaDeSaida(sujo && aberto, { novo });
  const fechar = onFechar ? () => { void pedirParaSair(onFechar); } : undefined;
  useFecharComEsc(fechar, aberto);

  // O conteúdo da última abertura. Quem desenha a saída é ele, não o `children` do momento —
  // que já pode estar vazio ou apontando para um item que a tela deixou de ter.
  const conteudo = useRef(children);
  if (aberto) conteudo.current = children;

  if (!montado) return null;

  return createPortal(
    <div
      // Saindo, o conjunto some da árvore de acessibilidade e deixa de receber foco e clique: para
      // quem usa leitor de tela ou teclado, o modal já fechou — só o olho ainda o vê indo embora.
      aria-hidden={saindo || undefined}
      inert={saindo ? "" : undefined}
      className={cn(
        "fixed inset-0 flex justify-center p-4",
        alinhar === "centro" ? "items-center" : "items-start overflow-y-auto",
      )}
      style={{ zIndex: camada }}
    >
      {/* Véu sólido, sem `backdrop-blur`: vidro fosco é o glassmorphism que o design system
          deixou de fora, e o desfoque ainda custa quadro em máquina fraca. */}
      <div
        aria-hidden
        className={cn("fixed inset-0 bg-navy/40", saindo ? "saida-overlay" : "entrada-overlay")}
        onClick={fecharNoVeu ? fechar : undefined}
      />
      <section
        role={role}
        aria-modal="true"
        aria-label={rotulo}
        aria-labelledby={rotuloId}
        aria-describedby={descricaoId}
        className={cn("janela-modal relative", saindo ? "saida-modal" : "entrada-modal", className)}
      >
        <ContextoGuardaDaJanela.Provider value={pedirParaSair}>
          {saindo ? conteudo.current : children}
        </ContextoGuardaDaJanela.Provider>
      </section>
    </div>,
    document.body,
  );
}
