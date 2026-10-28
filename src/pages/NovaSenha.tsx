/**
 * A senha nova de quem chegou pelo link do e-mail (15/09/2026).
 *
 * É o outro lado do "Esqueceu a sua senha?" da tela de login. Quem abre o link
 * chega aqui com uma sessão de RECUPERAÇÃO já aberta pelo Supabase — é ela que
 * garante que é a pessoa, e por isso esta tela não pergunta a senha atual: quem
 * chegou por aqui não a tem, e é justamente isso que o link resolve.
 *
 * A régua da senha é a mesma da troca comum, menos a senha atual (ver
 * `domain/senha`): mínimo de oito caracteres e confirmação. Sem exigência de
 * símbolo ou maiúscula, de propósito — regra de composição empurra para
 * "Polobh@2026" e para o papel colado no monitor.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, CarregandoTela, Field, Input } from "@/components/ui";
import { motivoSenhaNovaInvalida } from "@/domain/senha";
import { useAuth } from "@/store/auth";
import { supabase } from "@/lib/supabaseClient";

export function NovaSenha() {
  const navigate = useNavigate();
  const definirSenha = useAuth((s) => s.definirSenhaPeloLink);
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);
  /**
   * `null` enquanto o Supabase ainda está lendo o link; `false` quando não há
   * sessão de recuperação — link expirado, já usado, ou alguém que abriu o
   * endereço direto. Sem esta checagem, a pessoa preencheria a senha inteira
   * para só então descobrir que o link não vale mais.
   */
  const [temSessao, setTemSessao] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setTemSessao(!!data.session);
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    const motivo = motivoSenhaNovaInvalida(nova, confirmacao);
    if (motivo) {
      setErro(motivo);
      return;
    }
    setErro("");
    setSalvando(true);
    const r = await definirSenha(nova);
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não foi possível salvar a senha.");
      return;
    }
    setPronto(true);
    // Um instante para a pessoa ler o aviso antes de a tela trocar.
    setTimeout(() => navigate("/"), 1200);
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src="/polobh-logo.png" alt="Pólobh" className="h-16 w-auto object-contain" />
          <div className="text-[12px] text-ink-3 font-semibold">Aplicativo Gestão</div>
        </div>

        <div className="bg-surface border border-border rounded-card-lg shadow-card p-7">
          <h2 className="font-display font-bold text-xl tracking-[-0.4px]">Criar nova senha</h2>

          {temSessao === false ? (
            <>
              <p className="text-ink-2 text-[13.5px] mt-2 mb-5">
                Este link não vale mais — ele expira depois de um tempo e só pode ser usado uma vez.
                Peça outro na tela de entrada.
              </p>
              <Button block onClick={() => navigate("/login")}>Voltar para a entrada</Button>
            </>
          ) : pronto ? (
            <p className="text-[13.5px] font-semibold text-success bg-success-soft rounded-btn px-3 py-2 mt-4">
              Senha alterada. Levando você para o aplicativo…
            </p>
          ) : (
            <form onSubmit={submeter}>
              <p className="text-ink-2 text-[13.5px] mt-0.5 mb-5">
                Escolha uma frase que só você saiba — ela vale mais que uma senha curta cheia de símbolos.
              </p>
              <Field label="Nova senha" className="mb-4" obrigatorio>
                <Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" required />
              </Field>
              <Field label="Confirme a nova senha" className="mb-5" obrigatorio>
                <Input type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" required />
              </Field>

              {erro && (
                <p className="mb-4 text-[12.5px] font-semibold text-danger bg-danger-soft rounded-btn px-3 py-2">{erro}</p>
              )}

              {salvando && <CarregandoTela />}

              <Button type="submit" block disabled={salvando || temSessao === null}>
                {salvando ? "Salvando…" : "Salvar senha"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-ink-3 text-[11.5px] mt-6">© Pólobh Promoções</p>
      </div>
    </div>
  );
}
