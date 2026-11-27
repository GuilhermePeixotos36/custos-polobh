/**
 * O card de conversa — o "corredor" de uma tela.
 *
 * Toda tela do sistema tem duas camadas de conversa: a do DETALHE, presa ao
 * item ("este buffet está caro"), e a do CONJUNTO, que fala do documento ou da
 * etapa inteira ("o cliente cortou o coffee break"). A segunda é sempre a mesma
 * coisa — título, contador do que é seu, e a thread — e estava escrita de novo
 * a cada tela que ganhava conversa, com um rótulo ligeiramente diferente em
 * cada uma. Agora é uma peça só: EC, OS e as abas do projeto usam esta, e o
 * rótulo do botão ("Adicionar Observação") é o mesmo em toda parte.
 *
 * Aqui mora só o DESENHO. Quem grava é quem chama, porque as telas gravam de
 * jeitos diferentes de propósito: a EC e as abas do projeto gravam na hora, por
 * caminho próprio (comentar não é editar o documento); a OS acumula no
 * formulário e vai junto do "Salvar".
 */
import { Card } from "@/components/ui";
import { ObservacoesThread } from "@/components/ObservacoesPopup";
import { NotifDot } from "@/components/NotifDot";
import type { Observacao } from "@/data/types";

/**
 * UMA LINHA SÓ (26/11/2026): o balão laranja e "Adicionar Observação".
 *
 * O card tinha título, um parágrafo explicando o campo e outro dizendo que a
 * conversa é interna — três linhas de texto, em toda tela, para apresentar um
 * botão. A equipe já conhece a ferramenta; o que sobra é o gesto. Com
 * observações escritas, a mesma linha mostra a contagem e abre a conversa.
 */
export function CardConversa({
  ancora,
  observacoes,
  usuarios,
  minhas,
  onChange,
  ancoraDom,
}: {
  /** Chave da conversa para o sistema de pendências (ver `domain/pendencias`). */
  ancora: string;
  observacoes: Observacao[];
  usuarios: string[];
  /** Quantas pendências desta conversa são de quem está olhando. */
  minhas: number;
  onChange: (observacoes: Observacao[]) => void;
  /** `id` no DOM, para o navegador de pendências rolar até aqui. */
  ancoraDom?: string;
}) {
  return (
    <Card padded={false} className="relative px-4 py-2.5 md:px-5">
      <div id={ancoraDom}>
        <ObservacoesThread
          className="!border-t-0 !px-0 !py-0"
          ancora={ancora}
          observacoes={observacoes}
          usuarios={usuarios}
          onChange={onChange}
        />
      </div>
      {minhas > 0 && (
        <span className="absolute -right-1.5 -top-1.5">
          <NotifDot n={minhas} inline title={`${minhas} pendência(s) sua(s) nesta conversa`} />
        </span>
      )}
    </Card>
  );
}
