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

export function SubGuias<K extends string>({
  abas,
  atual,
  onChange,
  rotulo,
  tituloPendencias = "Ações pendentes nesta etapa",
}: {
  abas: readonly SubGuia<K>[];
  atual: K;
  onChange: (aba: K) => void;
  /** Identifica a barra para quem usa leitor de tela. */
  rotulo: string;
  tituloPendencias?: string;
}) {
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label={rotulo}>
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
            "px-4 h-10 text-[13.5px] font-bold whitespace-nowrap border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5",
            a.desabilitada
              ? "text-ink-3/40 cursor-not-allowed border-transparent"
              : atual === a.key
                ? "text-primary-dark border-primary"
                : "text-ink-2 hover:text-ink border-transparent"
          )}
        >
          {a.label}
          <NotifDot inline n={a.desabilitada ? 0 : a.pendencias ?? 0} title={tituloPendencias} />
        </button>
      ))}
    </div>
  );
}
