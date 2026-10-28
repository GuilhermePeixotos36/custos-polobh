import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/store/auth";

export function Login() {
  const navigate = useNavigate();
  const entrarComEmail = useAuth((s) => s.entrarComEmail);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  /**
   * "ESQUECEU A SENHA?" (15/09/2026).
   *
   * Até aqui, quem esquecia a senha abria um chamado no Help Desk e esperava um
   * convite novo — e o resultado prático era a senha do primeiro dia valendo
   * para sempre: ninguém abre chamado para trocar de senha.
   *
   * O aviso de envio é o MESMO tenha o e-mail cadastro ou não. Dizer "este
   * e-mail não existe" entregaria quem trabalha na casa a quem perguntasse.
   */
  const pedirRedefinicao = useAuth((s) => s.pedirRedefinicaoSenha);
  const [enviandoLink, setEnviandoLink] = useState(false);
  const [avisoLink, setAvisoLink] = useState("");

  async function esqueciSenha() {
    setErro("");
    setAvisoLink("");
    if (!email.trim()) {
      setErro("Digite o seu e-mail acima e clique de novo.");
      return;
    }
    setEnviandoLink(true);
    const r = await pedirRedefinicao(email);
    setEnviandoLink(false);
    if (r.ok) setAvisoLink("Se este e-mail estiver cadastrado, o link para criar uma nova senha chega em instantes. Confira também a caixa de spam.");
    else setErro(r.erro ?? "Não foi possível enviar o link agora.");
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      const r = await entrarComEmail(email, senha);
      if (r.ok) navigate("/");
      else setErro(r.erro ?? "Não foi possível entrar.");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Marca acima do bloco. O arquivo perdeu o fundo branco e o slogan
            (revisão de 15/09/2026): sobre a tela clara o quadrado aparecia como
            uma placa em volta do logo, e o slogan competia com o nome do
            aplicativo logo abaixo. Sem esse peso, a marca pode crescer. */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src="/polobh-logo.png" alt="Pólobh" className="h-16 w-auto object-contain" />
          <div className="text-[12px] text-ink-3 font-semibold">Aplicativo Gestão</div>
        </div>

        {/* Bloco de login */}
        <form onSubmit={submeter} className="bg-surface border border-border rounded-card-lg shadow-card p-7">
          <h2 className="font-display font-bold text-xl tracking-[-0.4px] mb-6">Entrar</h2>

          <Field label="E-mail" className="mb-4" obrigatorio>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@polobh.com.br" autoComplete="username" required />
          </Field>
          <Field label="Senha" className="mb-5" obrigatorio>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" autoComplete="current-password" required />
          </Field>

          {erro && (
            <p className="mb-4 text-[12.5px] font-semibold text-danger bg-danger-soft rounded-btn px-3 py-2">{erro}</p>
          )}

          {avisoLink && (
            <p className="mb-4 text-[12.5px] font-semibold text-info bg-info-soft rounded-btn px-3 py-2">{avisoLink}</p>
          )}

          <Button type="submit" block disabled={entrando}>
            {entrando ? "Entrando…" : "Entrar"}
          </Button>

          <button
            type="button"
            onClick={() => void esqueciSenha()}
            disabled={enviandoLink}
            className="mt-4 block w-full text-center text-[12.5px] font-bold text-ink-2 hover:text-primary-dark input-focus rounded-sm"
          >
            {enviandoLink ? "Enviando…" : "Esqueceu a sua senha?"}
          </button>
        </form>

        <p className="text-center text-ink-3 text-[11.5px] mt-6">© Pólobh Promoções</p>
      </div>
    </div>
  );
}
