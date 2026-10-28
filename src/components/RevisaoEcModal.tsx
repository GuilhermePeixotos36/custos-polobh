/**
 * "O que mudou nesta EC" — a conferência antes de salvar.
 *
 * Pedido de 15/09/2026. O botão Revisar deixou de ser só o corretor de
 * formatação: ele padroniza os textos e abre esta tela, com tudo o que a sessão
 * de edição alterou, item a item. Daqui se salva ou se volta a editar — são as
 * duas coisas que fazem sentido depois de conferir.
 *
 * Por que uma tela e não um aviso: numa EC de quarenta itens, "há alterações" é
 * a informação que a pessoa já tem. O que ela não tem é QUAIS — e é isso que
 * evita salvar por cima do trabalho de outra pessoa ou gravar um valor digitado
 * na linha errada.
 */
import { Button } from "@/components/ui";
import type { MudancaItemEc, RevisaoEc } from "@/domain/revisaoEc";
import { cx } from "@/lib/format";

const ROTULO_TIPO: Record<MudancaItemEc["tipo"], string> = {
  incluido: "item novo",
  removido: "item removido",
  alterado: "alterado",
};

const TOM_TIPO: Record<MudancaItemEc["tipo"], string> = {
  incluido: "bg-success-soft text-success",
  removido: "bg-danger-soft text-danger",
  alterado: "bg-primary-soft text-primary-dark",
};

export function RevisaoEcModal({
  revisao,
  salvando,
  onSalvar,
  onVoltar,
  documento = "EC",
}: {
  revisao: RevisaoEc;
  /** Que documento está sendo conferido — a EC e a OS usam este mesmo modal. */
  documento?: "EC" | "OS";
  salvando: boolean;
  onSalvar: () => void;
  onVoltar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-label={`Conferir alterações da ${documento}`}>
      <div className="bg-surface rounded-card-lg shadow-card w-full max-w-[860px] max-h-[85vh] flex flex-col">
        <div className="px-6 pt-5 pb-3 border-b border-border-soft">
          <h2 className="font-display font-bold text-lg text-ink">Conferir alterações</h2>
          <p className="text-[13px] text-ink-2 mt-0.5">
            {revisao.total === 0
              ? "A formatação dos textos foi padronizada e nada mais mudou desde o último salvamento."
              : "A formatação dos textos foi padronizada. Confira o que muda ao salvar — o que está aqui é exatamente o que vai ser gravado."}
          </p>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {revisao.total === 0 && (
            <p className="text-[13px] text-ink-3 py-6 text-center">Nenhuma alteração a conferir.</p>
          )}

          {revisao.gerais.length > 0 && (
            <section>
              <h3 className="text-[10.5px] font-extrabold uppercase tracking-widest text-ink-3 mb-2">Dados da {documento}</h3>
              <div className="rounded-card border border-border divide-y divide-border-soft">
                {revisao.gerais.map((c) => (
                  <LinhaCampo key={c.label} label={c.label} antes={c.antes} depois={c.depois} />
                ))}
              </div>
            </section>
          )}

          {revisao.itens.length > 0 && (
            <section>
              <h3 className="text-[10.5px] font-extrabold uppercase tracking-widest text-ink-3 mb-2">
                Itens ({revisao.itens.length})
              </h3>
              <div className="space-y-2.5">
                {revisao.itens.map((item) => (
                  <div key={item.chave} className="rounded-card border border-border overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap px-3.5 py-2.5 bg-[#FAFAFB] border-b border-border-soft">
                      <span className="font-bold text-[13.5px] text-ink">{item.titulo}</span>
                      {item.grupo && <span className="text-[11.5px] text-ink-3">{item.grupo}</span>}
                      <span className={cx("ml-auto text-[10.5px] font-extrabold uppercase tracking-[0.06em] rounded-pill px-2 py-0.5", TOM_TIPO[item.tipo])}>
                        {ROTULO_TIPO[item.tipo]}
                      </span>
                    </div>
                    {item.campos.length > 0 && (
                      <div className="divide-y divide-border-soft">
                        {item.campos.map((c) => (
                          <LinhaCampo key={c.label} label={c.label} antes={c.antes} depois={c.depois} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border-soft flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onVoltar} disabled={salvando}>
            Voltar a editar
          </Button>
          <Button size="sm" onClick={onSalvar} disabled={salvando}>
            {salvando ? "Salvando…" : `Salvar ${documento}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Uma linha "campo: antes → depois". Valor vazio aparece escrito, não em branco. */
function LinhaCampo({ label, antes, depois }: { label: string; antes: string; depois: string }) {
  return (
    <div className="grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-x-3 gap-y-1 px-3.5 py-2.5">
      <span className="text-[12.5px] font-bold text-ink-2">{label}</span>
      <span className="text-[12.5px] min-w-0">
        <span className="text-ink-3 line-through wrap-break-word">{antes || "(vazio)"}</span>
        <span className="text-ink-3 mx-1.5">›</span>
        <span className="text-ink font-semibold wrap-break-word">{depois || "(vazio)"}</span>
      </span>
    </div>
  );
}
