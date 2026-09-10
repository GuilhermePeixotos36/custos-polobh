/**
 * Minha conta — quem eu sou aqui dentro, e a troca da própria senha.
 *
 * Até agora a senha só podia ser trocada por fora do aplicativo: quem quisesse
 * mudar tinha de pedir ao suporte um convite novo. Isso empurra para o pior dos
 * mundos — a senha que a pessoa recebeu no primeiro dia fica valendo para
 * sempre, e a que ela desconfia que alguém viu continua valendo também.
 *
 * A SENHA ATUAL é pedida, e não é burocracia: o Supabase troca a senha de quem
 * tem sessão válida sem perguntar mais nada, então qualquer pessoa que sentasse
 * numa cadeira com o app aberto poderia trocar a senha e deixar a dona da conta
 * de fora (ver `trocarSenha`, em `store/auth`).
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Avatar, Button, Field, Input } from "@/components/ui";
import { IcFechar } from "@/components/icons";
import { useAuth, ROTULO_PAPEL } from "@/store/auth";
import { toast } from "@/store/toast";
import { motivoSenhaInvalida, TAMANHO_MINIMO_SENHA } from "@/domain/senha";

export function MinhaContaModal({ onClose }: { onClose: () => void }) {
  const usuario = useAuth((s) => s.usuario);
  const trocarSenha = useAuth((s) => s.trocarSenha);

  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!usuario) return null;

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    // A régua mora no domínio, testada — a tela só a aplica (ver `domain/senha`).
    const motivo = motivoSenhaInvalida(atual, nova, confirmacao);
    if (motivo) {
      setErro(motivo);
      return;
    }
    setSalvando(true);
    try {
      const r = await trocarSenha(atual, nova);
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível trocar a senha.");
        return;
      }
      toast("Senha alterada. Use a nova no próximo login.", "success");
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return createPortal(
    /* z-[80]: acima dos modais das telas (z-[70]) e do painel do Help Desk,
       porque este abre do cabeçalho, que está por cima de tudo. */
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={salvando ? undefined : onClose} />

      <div className="relative w-full max-w-[440px] bg-surface rounded-card-lg shadow-modal border border-border p-6 animate-[fadein_.12s_ease] max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          title="Fechar"
          className="absolute right-3 top-3 rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink"
        >
          <IcFechar width={18} height={18} />
        </button>

        {/* Quem sou eu aqui: o cabeçalho mostra o nome truncado e nada mais. */}
        <div className="flex items-center gap-3">
          <Avatar nome={usuario.nome} size={44} />
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-ink leading-tight truncate">{usuario.nome}</div>
            <div className="text-[12.5px] text-ink-2 truncate">{usuario.email}</div>
            {/* Área e papel costumam ser coisas diferentes ("Produção" na área
                "Operações"), mas às vezes têm o mesmo nome — e aí a linha lia
                "Direção · Direção". Repetir não informa. */}
            <div className="text-[11.5px] text-ink-3">
              {usuario.areaNome && usuario.areaNome !== ROTULO_PAPEL[usuario.papel]
                ? `${usuario.areaNome} · ${ROTULO_PAPEL[usuario.papel]}`
                : ROTULO_PAPEL[usuario.papel]}
            </div>
          </div>
        </div>

        <hr className="my-5 border-border-soft" />

        <h3 className="text-[14px] font-bold text-ink">Trocar senha</h3>
        <p className="text-[12.5px] text-ink-2 mt-0.5 mb-4">
          Pelo menos {TAMANHO_MINIMO_SENHA} caracteres. Uma frase que só você sabe vale mais que uma palavra curta
          cheia de símbolos.
        </p>

        <form onSubmit={submeter}>
          {/* O e-mail vai junto, escondido: sem ele o gerenciador de senhas do
              navegador não sabe de qual conta é a senha que acabou de mudar. */}
          <input type="hidden" name="username" autoComplete="username" value={usuario.email} readOnly />

          <Field label="Senha atual" className="mb-3">
            <Input
              type="password"
              autoComplete="current-password"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Nova senha" className="mb-3">
            <Input
              type="password"
              autoComplete="new-password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Repita a nova senha" className="mb-4">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {erro && (
            <p className="mb-4 text-[12.5px] font-semibold text-danger bg-danger-soft rounded-btn px-3 py-2">{erro}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" block disabled={salvando}>
              {salvando ? "Trocando…" : "Trocar senha"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        </form>

        <p className="text-[11.5px] text-ink-3 mt-4">
          Você continua conectado depois da troca. A senha nova vale a partir do próximo login, aqui e no celular.
        </p>
      </div>
    </div>,
    document.body
  );
}
