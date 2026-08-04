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
        {/* Marca acima do bloco */}
        <div className="flex flex-col items-center gap-2.5 mb-6">
          <img src="/polobh-logo.png" alt="Pólobh" className="h-10 w-auto object-contain" />
          <div className="text-[12px] text-ink-3 font-semibold">Custos de Eventos</div>
        </div>

        {/* Bloco de login */}
        <form onSubmit={submeter} className="bg-surface border border-border rounded-card-lg shadow-card p-7">
          <h2 className="font-display font-bold text-xl tracking-[-0.4px]">Entrar</h2>
          <p className="text-ink-2 text-[13.5px] mt-0.5 mb-6">Acesse o painel da Pólobh.</p>

          <Field label="E-mail" className="mb-4">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@polobh.com.br" autoComplete="username" required />
          </Field>
          <Field label="Senha" className="mb-5">
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" autoComplete="current-password" required />
          </Field>

          {erro && (
            <p className="mb-4 text-[12.5px] font-semibold text-danger bg-danger-soft rounded-btn px-3 py-2">{erro}</p>
          )}

          <Button type="submit" block disabled={entrando}>
            {entrando ? "Entrando…" : "Entrar no painel"}
          </Button>
        </form>

        <p className="text-center text-ink-3 text-[11.5px] mt-6">© Pólobh Eventos</p>
      </div>
    </div>
  );
}
