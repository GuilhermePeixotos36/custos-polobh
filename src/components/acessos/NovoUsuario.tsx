/**
 * Cadastro de usuário (padrão de Acessos LSPRO, adaptado à Pólobh em 24/11/2026).
 *
 * O padrão tem três popups empilhados — colaborador do DPRH, "Dados do usuário" e "Login e senha"
 * só para quem está fora do Microsoft 365. Aqui não há lista de colaboradores nem Microsoft
 * (decisão do dono do app), então ficam dois: "Novo usuário" (Nome, E-mail, Setor, Cargo/função e
 * o Grupo de permissão, obrigatório e sem nenhum pré-marcado) e, por cima, "Login e senha" (login =
 * o e-mail, só leitura; senha digitada ou gerada, mostrada uma vez para copiar).
 */
import { useId, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { JanelaModal } from "@/components/padrao/JanelaModal";
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import { AvisoEmLinha } from "@/components/padrao/AvisoEmLinha";
import { Button, Field, Input, Select, TelefoneInput } from "@/components/ui";
import { CAMADA_POPUP, CAMADA_POPUP_EM_CIMA, CampoSenha, RodapeJanela, SenhaParaCopiar, fecharComGuarda } from "./comum";
import { criarUsuario, type GrupoAcesso } from "@/lib/acessos/acessosStore";
import { grafiaExistente, gruposEscolheveis, semGrupoAlemDoSistema } from "@/lib/acessos/usuarios";
import { resumoDoGrupo } from "@/lib/acessos/permissoes";
import { senhaValida } from "@/lib/acessos/senha";
import { toast } from "@/store/toast";

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

type Dados = { nome: string; email: string; telefone: string; setor: string; cargo: string; grupoId: string };
const VAZIO: Dados = { nome: "", email: "", telefone: "", setor: "", cargo: "", grupoId: "" };

export function NovoUsuario({ aberto, onFechar, onCriado, onCriarGrupo, concediveis, grupos, euSouAdministrador, setores, cargos }: {
  aberto: boolean;
  onFechar: () => void;
  /** Depois do "Concluir": a lista recarrega. */
  onCriado: () => void;
  /** "Criar grupo de permissão": fecha (perguntando antes) e leva à sub-aba Grupos. */
  onCriarGrupo: () => void;
  concediveis: GrupoAcesso[];
  grupos: GrupoAcesso[];
  euSouAdministrador: boolean;
  setores: string[];
  cargos: string[];
}) {
  const id = useId();
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [passo, setPasso] = useState<"dados" | "senha" | "criado">("dados");
  const [senha, setSenha] = useState("");
  const [criando, setCriando] = useState(false);

  const escolheveis = useMemo(() => gruposEscolheveis(concediveis, euSouAdministrador), [concediveis, euSouAdministrador]);
  const sistema = grupos.find((g) => g.sistema);
  const emailOk = EMAIL.test(dados.email.trim());
  const podeContinuar = dados.nome.trim().length >= 2 && emailOk && !!dados.grupoId;
  const sujo = passo !== "criado" && (JSON.stringify(dados) !== JSON.stringify(VAZIO) || senha !== "");

  function limparEFechar() {
    setDados(VAZIO);
    setSenha("");
    setPasso("dados");
    onFechar();
  }

  const fechar = () => void fecharComGuarda(sujo, limparEFechar, true);

  async function criar() {
    setCriando(true);
    try {
      await criarUsuario({
        nome: dados.nome.trim(),
        email: dados.email.trim().toLowerCase(),
        telefone: dados.telefone.trim(),
        setor: grafiaExistente(dados.setor, setores),
        cargo: grafiaExistente(dados.cargo, cargos),
        senha,
        grupoId: dados.grupoId,
      });
      setPasso("criado");
    } catch (e) {
      // Recusa do servidor (senha vazada, e-mail já usado…): o popup continua aberto para tentar de novo.
      toast((e as Error).message, "danger");
    } finally {
      setCriando(false);
    }
  }

  function concluir() {
    setDados(VAZIO);
    setSenha("");
    setPasso("dados");
    onCriado();
  }

  return (
    <>
      <JanelaModal aberto={aberto} onFechar={passo === "dados" ? fechar : undefined} fecharNoVeu={false} rotulo="Novo usuário" camada={CAMADA_POPUP} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden bg-card">
        <CabecalhoJanela titulo="Novo usuário" icone={UserPlus} onFechar={fechar} />
        <div className="grid gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
          <Field label="Nome" obrigatorio className="sm:col-span-2">
            <Input formato="titulo" value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="E-mail" hint="(é o login)" obrigatorio>
            <Input type="email" value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} placeholder="nome@polobh.com.br" autoComplete="off" />
          </Field>
          <Field label="Telefone">
            <TelefoneInput value={dados.telefone} onChange={(v) => setDados({ ...dados, telefone: v })} />
          </Field>
          <Field label="Setor">
            <Input value={dados.setor} onChange={(e) => setDados({ ...dados, setor: e.target.value })} sugestoes={setores} placeholder="Escolha ou digite o setor" />
          </Field>
          <Field label="Cargo/função">
            <Input value={dados.cargo} onChange={(e) => setDados({ ...dados, cargo: e.target.value })} sugestoes={cargos} placeholder="Escolha ou digite o cargo" />
          </Field>
          <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">Setor e cargo sugerem os que a casa já usa; um novo também vale.</p>

          <Field label="Grupo de permissão" obrigatorio className="sm:col-span-2">
            <Select value={dados.grupoId} onChange={(e) => setDados({ ...dados, grupoId: e.target.value })} aria-label="Grupo de permissão">
              <option value="">Escolha o grupo</option>
              {escolheveis.map((g) => (
                <option key={g.id} value={g.id}>{g.nome} — {resumoDoGrupo(g.permissoes)}</option>
              ))}
            </Select>
          </Field>
          {semGrupoAlemDoSistema(grupos) && (
            <AvisoEmLinha tom="atencao" className="sm:col-span-2">
              Ainda não há grupo criado além do {sistema?.nome ?? "Administrador de sistema"}.{" "}
              <button type="button" onClick={() => void fecharComGuarda(sujo, () => { limparEFechar(); onCriarGrupo(); }, true)} className="font-semibold underline">
                Criar grupo de permissão
              </button>
            </AvisoEmLinha>
          )}
        </div>
        <RodapeJanela>
          <Button variant="secondary" onClick={fechar}>Cancelar</Button>
          <Button onClick={() => setPasso("senha")} disabled={!podeContinuar}>Continuar</Button>
        </RodapeJanela>
      </JanelaModal>

      <JanelaModal aberto={aberto && passo !== "dados"} fecharNoVeu={false} rotulo={passo === "criado" ? "Usuário criado" : "Login e senha"} camada={CAMADA_POPUP_EM_CIMA} className="flex w-full max-w-lg flex-col overflow-hidden bg-card">
        {passo === "criado" ? (
          <>
            <CabecalhoJanela titulo="Usuário criado" />
            <div className="grid gap-3 px-5 py-5">
              <p className="text-sm text-foreground">
                Usuário criado. Passe a senha para {dados.nome.trim()} — ela não será mostrada de novo.
              </p>
              <SenhaParaCopiar senha={senha} />
            </div>
            <RodapeJanela>
              <Button onClick={concluir}>Concluir</Button>
            </RodapeJanela>
          </>
        ) : (
          <>
            <CabecalhoJanela titulo="Login e senha" subtitulo={dados.nome.trim()} />
            <div className="grid gap-4 px-5 py-5">
              <Field label="Login">
                <Input type="email" value={dados.email.trim().toLowerCase()} readOnly aria-readonly="true" className="bg-muted" />
              </Field>
              <CampoSenha id={`${id}-senha`} rotulo="Senha inicial" valor={senha} onChange={setSenha} />
            </div>
            <RodapeJanela>
              <Button variant="secondary" onClick={() => setPasso("dados")} disabled={criando}>Voltar</Button>
              <Button onClick={() => void criar()} disabled={!senhaValida(senha) || criando}>{criando ? "Criando…" : "Criar usuário"}</Button>
            </RodapeJanela>
          </>
        )}
      </JanelaModal>
    </>
  );
}
