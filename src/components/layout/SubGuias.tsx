/**
 * Barra de subguias das telas — EC, Projeto, Configurações.
 *
 * Ela existia repetida em três lugares, com três medidas ligeiramente
 * diferentes, e rolava embora junto com o conteúdo: numa EC com dezenas de
 * itens ou num projeto com o check-list inteiro, trocar de subaba obrigava a
 * voltar ao topo. Agora a barra é uma só e entra pelo slot `subabas` do
 * `PageShell`, ou seja, gruda logo abaixo do título e das ações da página —
 * pelo mesmo caminho, em qualquer tela que venha a ter subabas.
 *
 * O desenho fica aqui; o "grudar" fica no PageShell, que também mede a altura
 * do conjunto e a publica em `--altura-cabecalho`.
 */
import { NotifDot } from "@/components/NotifDot";
import { cx } from "@/lib/format";

export interface SubGuia<K extends string = string> {
  key: K;
  label: string;
  /** Contador de pendências ao lado do rótulo. Zero não desenha nada. */
  pendencias?: number;
  /** Aba que ainda não faz sentido abrir (projeto novo, por exemplo). */
  desabilitada?: boolean;
  titulo?: string;
}

/**
 * Dois níveis, dois desenhos — e isso não é enfeite.
 *
 * Onde as duas barras aparecem juntas (na EC e na OS: a do projeto por cima, a
 * das vistas do documento embaixo), desenhá-las igual fazia as duas lerem como
 * UMA fileira que quebrou de linha. Pior: "EC" aparece nas duas, e nas duas
 * acesa em laranja com o mesmo sublinhado — não dava para saber qual dizia
 * "você está na EC do projeto" e qual dizia "você está vendo a EC, e não o
 * Resumo dos Custos".
 *
 *  · `principal` — abas com sublinhado. É a NAVEGAÇÃO: sair daqui troca de
 *    tela.
 *  · `secundaria` — pílulas menores, sem sublinhado. É uma VISTA do que já está
 *    aberto; nada sai do lugar.
 */
export type VarianteSubGuias = "principal" | "secundaria";

export function SubGuias<K extends string>({
  abas,
  atual,
  onChange,
  rotulo,
  variante = "principal",
  tituloPendencias = "Ações pendentes nesta etapa",
}: {
  abas: readonly SubGuia<K>[];
  atual: K;
  onChange: (aba: K) => void;
  /** Identifica a barra para quem usa leitor de tela. */
  rotulo: string;
  variante?: VarianteSubGuias;
  tituloPendencias?: string;
}) {
  const secundaria = variante === "secundaria";
  return (
    <div
      className={cx("flex items-center gap-1", secundaria && "my-1.5 p-1 rounded-full bg-default w-fit max-w-full overflow-x-auto")}
      role="tablist"
      aria-label={rotulo}
    >
      {abas.map((a) => (
        <button
          key={a.key}
          data-subguia={a.key}
          type="button"
          role="tab"
          aria-selected={atual === a.key}
          disabled={a.desabilitada}
          title={a.titulo}
          onClick={() => onChange(a.key)}
          className={cx(
            "whitespace-nowrap font-medium transition-colors inline-flex items-center gap-1.5",
            secundaria
              ? "px-3 h-7 text-[12.5px] rounded-full"
              : "px-4 h-10 text-[13.5px] border-b-2 -mb-px",
            a.desabilitada
              ? cx("text-ink-3/40 cursor-not-allowed", !secundaria && "border-transparent")
              : atual === a.key
                ? secundaria
                  ? "bg-surface text-foreground font-semibold shadow-surface"
                  : "text-foreground font-semibold border-accent"
                : cx("text-muted hover:text-foreground", secundaria ? "hover:bg-surface/70" : "border-transparent")
          )}
        >
          {a.label}
          <NotifDot inline n={a.desabilitada ? 0 : a.pendencias ?? 0} title={tituloPendencias} />
        </button>
      ))}
    </div>
  );
}
