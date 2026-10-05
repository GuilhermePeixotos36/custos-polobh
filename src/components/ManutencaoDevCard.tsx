/**
 * MANUTENÇÃO DO DESENVOLVEDOR — limpar o banco e a senha que protege isso.
 *
 * Só existe para o papel Admin (o desenvolvedor, que não pertence a nenhuma
 * área da Pólobh): para todo mundo o componente devolve nada, e o servidor
 * confere de novo — papel E senha de manutenção — antes de apagar qualquer
 * coisa (migração `20261001120000_dev_limpar_banco.sql`).
 *
 * A senha de manutenção é DIFERENTE da senha de login, e fica só como hash no
 * banco. Esqueceu? Rode no SQL do Supabase `delete from dev_segredo;` e crie
 * outra aqui — quem tem acesso ao SQL já tem acesso a tudo de qualquer jeito.
 */
import { useEffect, useState } from "react";
import { Button, Card, CardTitle, Field, Input } from "@/components/ui";
import { repo } from "@/data";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";

const PALAVRA = "LIMPAR";

export function ManutencaoDevCard() {
  const ehDev = useAuth((s) => s.usuario?.papel === "Admin");
  if (!ehDev) return null;
  return <ManutencaoDev />;
}

function ManutencaoDev() {
  const [temSenha, setTemSenha] = useState<boolean | null>(null);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetir, setRepetir] = useState("");
  const [senha, setSenha] = useState("");
  const [palavra, setPalavra] = useState("");
  const [cadastros, setCadastros] = useState(false);
  const [historico, setHistorico] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    repo.dev
      .senhaDefinida()
      .then(setTemSenha)
      .catch((e) => toast(`Manutenção indisponível: ${(e as Error).message}`, "danger"));
  }, []);

  const gravarSenha = async () => {
    if (nova.length < 8) return toast("A senha nova precisa ter pelo menos 8 caracteres.", "warning");
    if (nova !== repetir) return toast("As duas senhas novas não batem.", "warning");
    setOcupado(true);
    try {
      await repo.dev.definirSenha(atual, nova);
      setTemSenha(true);
      setAtual("");
      setNova("");
      setRepetir("");
      toast(temSenha ? "Senha de manutenção trocada." : "Senha de manutenção criada.", "success");
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setOcupado(false);
    }
  };

  const limpar = async () => {
    const ok = await confirmar({
      titulo: "Limpar o banco de dados?",
      mensagem:
        "Projetos, ECs, OSs, check-lists e credenciamentos serão apagados" +
        (cadastros ? ", junto com clientes e fornecedores" : "") +
        (historico ? ", e também logs, e-mails, chamados e registros de back-up" : "") +
        ". Usuários, áreas, empresas, configurações e listas padrão ficam. NÃO há como desfazer — tire um back-up antes.",
      confirmarTexto: "Apagar tudo",
      tom: "danger",
    });
    if (!ok) return;
    setOcupado(true);
    try {
      const resultado = await repo.dev.limparBanco(senha, { cadastros, historico });
      const total = Object.values(resultado).reduce((a, b) => a + b, 0);
      toast(`Banco limpo: ${total} registro(s) apagado(s).`, "success");
      setSenha("");
      setPalavra("");
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card>
      <CardTitle hint="Visível só para o desenvolvedor (Administrador). Protegido por uma senha própria, diferente da senha de login.">
        Manutenção do desenvolvedor
      </CardTitle>

      {temSenha === null ? (
        <div className="text-sm text-ink-3">Carregando…</div>
      ) : (
        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-[13px] font-extrabold text-ink">
              {temSenha ? "Trocar a senha de manutenção" : "Criar a senha de manutenção"}
            </h4>
            <div className="grid gap-2 sm:grid-cols-3">
              {temSenha && (
                <Field label="Senha atual">
                  <Input type="password" autoComplete="off" value={atual} onChange={(e) => setAtual(e.target.value)} />
                </Field>
              )}
              <Field label="Senha nova (mín. 8)">
                <Input type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
              </Field>
              <Field label="Repita a senha nova">
                <Input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
              </Field>
            </div>
            <Button size="sm" variant="secondary" disabled={ocupado || !nova} onClick={() => void gravarSenha()}>
              {temSenha ? "Trocar senha" : "Criar senha"}
            </Button>
          </section>

          {temSenha && (
            <section className="space-y-2 rounded-card border border-danger/40 bg-danger-soft/40 p-3">
              <h4 className="text-[13px] font-extrabold text-danger">Limpar o banco</h4>
              <p className="text-[12.5px] font-bold text-ink-2">
                Apaga projetos e tudo o que depende deles (EC, OS, check-list, credenciamento). Nunca apaga
                usuários, áreas, empresas do grupo, configurações nem as listas padrão do check-list.
              </p>
              <label className="flex items-center gap-2 text-[12.5px] font-bold text-ink-2">
                <input type="checkbox" className="h-4 w-4 accent-[#F2820D]" checked={cadastros} onChange={(e) => setCadastros(e.target.checked)} />
                Apagar também clientes e fornecedores
              </label>
              <label className="flex items-center gap-2 text-[12.5px] font-bold text-ink-2">
                <input type="checkbox" className="h-4 w-4 accent-[#F2820D]" checked={historico} onChange={(e) => setHistorico(e.target.checked)} />
                Apagar também o histórico (logs, e-mails, chamados, registros de back-up)
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Senha de manutenção">
                  <Input type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} />
                </Field>
                <Field label={`Digite ${PALAVRA} para confirmar`}>
                  <Input value={palavra} onChange={(e) => setPalavra(e.target.value)} />
                </Field>
              </div>
              <Button
                size="sm"
                variant="danger"
                disabled={ocupado || !senha || palavra.trim().toUpperCase() !== PALAVRA}
                onClick={() => void limpar()}
              >
                {ocupado ? "Limpando…" : "Limpar o banco"}
              </Button>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
