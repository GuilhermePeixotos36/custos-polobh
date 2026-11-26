/**
 * "Defina sua nova senha" — primeiro acesso / senha provisória (padrão de Acessos, 26/11/2026).
 *
 * A senha definida por quem administra os acessos (no cadastro ou em "Definir nova senha") é
 * provisória: enquanto ela valer, esta tela toma o lugar do app inteiro, sem menu e sem rota.
 * É regra de uso, não barreira — quem sabe a senha provisória já tem a sessão.
 */
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { motivoDaTrocaInvalida, requisitosDaSenha } from "@/lib/acessos/senha";

export function DefinirNovaSenha() {
  const trocarSenha = useAuth((s) => s.trocarSenha);
  const sair = useAuth((s) => s.sair);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const motivo = motivoDaTrocaInvalida({ senhaAtual, senhaNova, confirmacao });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (motivo) return;
    setErro("");
    setSalvando(true);
    try {
      const r = await trocarSenha(senhaAtual, senhaNova);
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível trocar a senha.");
        return;
      }
      toast("Senha alterada.", "success");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form onSubmit={salvar} className="w-full max-w-[420px] bg-surface border border-border rounded-card-lg shadow-card p-7">
        <h1 className="font-display font-bold text-xl tracking-[-0.4px]">Defina sua nova senha</h1>
        <p className="mt-2 mb-5 text-[13px] text-ink-2">
          Sua senha foi definida por um administrador. Para continuar, crie uma senha só sua.
        </p>
        <Field label="Senha atual" className="mb-4" obrigatorio>
          <Input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="Nova senha" className="mb-2" obrigatorio>
          <Input type="password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} autoComplete="new-password" />
        </Field>
        <ul className="mb-4 space-y-0.5 text-[12px]">
          {requisitosDaSenha(senhaNova).map((r) => (
            <li key={r.rotulo} className={r.cumprido ? "text-success" : "text-ink-3"}>
              {r.cumprido ? "✓" : "•"} {r.rotulo}
            </li>
          ))}
        </ul>
        <Field label="Confirmar nova senha" className="mb-5" obrigatorio>
          <Input type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" />
        </Field>
        {(erro || (motivo && confirmacao)) && (
          <p className="mb-4 text-[12.5px] font-semibold text-danger bg-danger-soft rounded-btn px-3 py-2">{erro || motivo}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => void sair()} disabled={salvando}>Sair</Button>
          <Button type="submit" disabled={!!motivo || salvando}>{salvando ? "Salvando…" : "Salvar e entrar"}</Button>
        </div>
      </form>
    </main>
  );
}
