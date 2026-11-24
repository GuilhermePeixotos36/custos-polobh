/**
 * "Editar usuário" / "Liberar acesso" (padrão de Acessos LSPRO). Só para usuário ativo ou
 * pendente: inativo não se edita (o banco recusa) — volta pelo "Ativar" da linha. Sem inativar
 * nem ativar aqui: isso é o botão da linha. Grava só o que mudou.
 */
import { useId, useMemo, useState } from "react";
import { UserCog } from "lucide-react";
import { JanelaModal } from "@/components/padrao/JanelaModal";
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import { AvisoEmLinha } from "@/components/padrao/AvisoEmLinha";
import { Button, Field, Input, Select, TelefoneInput } from "@/components/ui";
import { CAMADA_POPUP, CampoSenha, RodapeJanela, fecharComGuarda } from "./comum";
import { definirAcessoDoUsuario, definirSenha, type GrupoAcesso, type UsuarioDoAcesso } from "@/lib/acessos/acessosStore";
import { grafiaExistente, gruposEscolheveis } from "@/lib/acessos/usuarios";
import { resumoDoGrupo } from "@/lib/acessos/permissoes";
import { senhaValida } from "@/lib/acessos/senha";
import { confirmar } from "@/store/confirm";
import { toast } from "@/store/toast";

export function EditarUsuario({ usuario, grupos, concediveis, euSouAdministrador, motivoTrava, podeDefinirSenha, setores, cargos, onFechar, onSalvo }: {
  usuario: UsuarioDoAcesso;
  grupos: GrupoAcesso[];
  concediveis: GrupoAcesso[];
  euSouAdministrador: boolean;
  /** A própria linha, ou membro do Administrador para quem não é: tudo desabilitado. */
  motivoTrava: string | null;
  /** Ativo, com permissão de editar e grupo atual que quem edita poderia conceder. */
  podeDefinirSenha: boolean;
  setores: string[];
  cargos: string[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const id = useId();
  const pendente = usuario.status === "pendente";
  const inicial = { nome: usuario.nome, setor: usuario.setor, cargo: usuario.cargo, telefone: usuario.telefone, grupoId: usuario.grupoId ?? "" };
  const [form, setForm] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [gravandoSenha, setGravandoSenha] = useState(false);
  const travado = !!motivoTrava;

  // Os concedíveis + o grupo atual (mesmo inativo ou fora do alcance), para a caixa não ficar vazia.
  const opcoes = useMemo(() => {
    const lista = gruposEscolheveis(concediveis, euSouAdministrador);
    const atual = grupos.find((g) => g.id === usuario.grupoId);
    return atual && !lista.some((g) => g.id === atual.id) ? [atual, ...lista] : lista;
  }, [concediveis, euSouAdministrador, grupos, usuario.grupoId]);

  const sujo = JSON.stringify(form) !== JSON.stringify(inicial) || senha !== "";
  const fechar = () => void fecharComGuarda(sujo, onFechar);
  const titulo = pendente ? "Liberar acesso" : "Editar usuário";

  async function salvar() {
    if (!form.grupoId) return toast("Escolha o grupo de permissão.", "danger");
    const nome = form.nome.trim();
    if (nome.length < 2) return toast("Informe o nome.", "danger");
    const setor = grafiaExistente(form.setor, setores);
    const cargo = grafiaExistente(form.cargo, cargos);
    setSalvando(true);
    try {
      await definirAcessoDoUsuario({
        usuarioId: usuario.id,
        grupoId: form.grupoId !== (usuario.grupoId ?? "") ? form.grupoId : null,
        status: pendente ? "ativo" : undefined,
        nome: nome !== usuario.nome ? nome : null,
        setor: setor !== usuario.setor ? setor : null,
        cargo: cargo !== usuario.cargo ? cargo : null,
        telefone: form.telefone.trim() !== usuario.telefone ? form.telefone.trim() : null,
      });
      toast(pendente ? "Acesso liberado." : "Usuário atualizado.", "success");
      onSalvo();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha() {
    const ok = await confirmar({
      titulo: "Definir nova senha",
      mensagem: `A senha de ${usuario.nome || usuario.email} será trocada. A anterior deixa de valer.`,
      confirmarTexto: "Trocar senha",
    });
    if (!ok) return;
    setGravandoSenha(true);
    try {
      await definirSenha(usuario.id, senha);
      toast("Senha trocada. Passe a nova senha para a pessoa — ela não será mostrada de novo.", "success");
      setTrocandoSenha(false);
      setSenha("");
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setGravandoSenha(false);
    }
  }

  return (
    <JanelaModal onFechar={fechar} fecharNoVeu={false} rotulo={titulo} camada={CAMADA_POPUP} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden bg-card">
      <CabecalhoJanela titulo={titulo} subtitulo={usuario.nome || usuario.email} icone={UserCog} onFechar={fechar} />
      <div className="grid gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
        {motivoTrava && <AvisoEmLinha tom="info" className="sm:col-span-2">{motivoTrava}</AvisoEmLinha>}
        <p className="text-xs text-muted-foreground sm:col-span-2">{usuario.email} · Entra com e-mail e senha</p>

        <Field label="Nome" obrigatorio className="sm:col-span-2">
          <Input formato="titulo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} disabled={travado} />
        </Field>
        <Field label="Setor">
          <Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} sugestoes={setores} disabled={travado} placeholder="Escolha ou digite o setor" />
        </Field>
        <Field label="Cargo/função">
          <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} sugestoes={cargos} disabled={travado} placeholder="Escolha ou digite o cargo" />
        </Field>
        <Field label="Telefone">
          {/* O campo de telefone do app não tem estado desabilitado: travado, mostra o número num campo comum. */}
          {travado
            ? <Input value={form.telefone} disabled aria-label="Telefone" />
            : <TelefoneInput value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />}
        </Field>
        <Field label="Grupo de permissão" obrigatorio>
          <Select value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })} disabled={travado} aria-label="Grupo de permissão">
            <option value="">Escolha o grupo</option>
            {opcoes.map((g) => (
              <option key={g.id} value={g.id}>{g.nome}{g.ativo ? "" : " (inativo)"} — {resumoDoGrupo(g.permissoes)}</option>
            ))}
          </Select>
        </Field>

        {podeDefinirSenha && !travado && (
          <div className="rounded-lg border border-border p-4 sm:col-span-2">
            {trocandoSenha ? (
              <div className="grid gap-3">
                <CampoSenha id={`${id}-senha`} rotulo="Nova senha" valor={senha} onChange={setSenha} />
                <div className="flex justify-end gap-2">
                  <Button variant="text" size="sm" onClick={() => { setTrocandoSenha(false); setSenha(""); }} disabled={gravandoSenha}>Cancelar</Button>
                  <Button variant="secondary" size="sm" onClick={() => void trocarSenha()} disabled={!senhaValida(senha) || gravandoSenha}>
                    {gravandoSenha ? "Trocando…" : "Trocar senha"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">A pessoa também pode trocar a senha sozinha, pelo "Esqueci minha senha" do login.</p>
                <Button variant="secondary" size="sm" onClick={() => setTrocandoSenha(true)}>Definir nova senha</Button>
              </div>
            )}
          </div>
        )}
      </div>
      <RodapeJanela>
        <Button variant="secondary" onClick={fechar} disabled={salvando}>Cancelar</Button>
        <Button onClick={() => void salvar()} disabled={travado || !form.grupoId || salvando}>
          {salvando ? "Salvando…" : pendente ? "Liberar acesso" : "Salvar"}
        </Button>
      </RodapeJanela>
    </JanelaModal>
  );
}
