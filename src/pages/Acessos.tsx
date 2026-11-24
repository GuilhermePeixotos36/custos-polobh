/**
 * Acessos (padrão de Acessos do Grupo LSPRO, 24/11/2026): sub-abas Usuários e Grupos de
 * permissão, com o botão primário no canto direito da fileira das abas ("Novo usuário" / "Novo
 * grupo", só com a permissão de criar da sub-aba).
 *
 * Substitui as abas "Áreas e permissões" e "Usuários" de Configurações — foi uma MUDANÇA DE LUGAR:
 * a área virou grupo de permissão (mesmo id, mesmo nome, mesmas permissões) e o cadastro de
 * usuários veio junto. `/configuracoes?aba=areas|usuarios` redireciona para cá.
 *
 * MODO DE COMPATIBILIDADE: enquanto a migration 20261124150000 não estiver no banco, a tela não
 * tenta carregar nada e mostra o aviso — o resto do app segue funcionando como antes.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageShell } from "@/components/layout/AppLayout";
import { FolderPanel, FolderTabs } from "@/components/padrao/FolderTabs";
import { AvisoEmLinha } from "@/components/padrao/AvisoEmLinha";
import { EsqueletoTabela } from "@/components/padrao/EsqueletoTabela";
import { Button } from "@/components/ui";
import { AbaUsuarios } from "@/components/acessos/AbaUsuarios";
import { AbaGrupos } from "@/components/acessos/AbaGrupos";
import { NovoUsuario } from "@/components/acessos/NovoUsuario";
import { GrupoModal } from "@/components/acessos/GrupoModal";
import { usePermissoes } from "@/lib/acessos/usePermissoes";
import { carregarGrupos, carregarUsuarios, type GrupoAcesso, type UsuarioDoAcesso } from "@/lib/acessos/acessosStore";
import { gruposQuePossoConceder, sugestoesDistintas } from "@/lib/acessos/usuarios";
import { useAuth } from "@/store/auth";

type Aba = "usuarios" | "grupos";

export function Acessos() {
  const { legado, grupo: meuGrupo, pode, temEspecial, permissoes, recarregar } = usePermissoes();
  const euId = useAuth((s) => s.usuario?.id ?? "");
  const verUsuarios = pode("acessos.usuarios", "ver");
  const verGrupos = pode("acessos.grupos", "ver");
  const [params, setParams] = useSearchParams();
  const pedida = params.get("aba") as Aba | null;
  const aba: Aba = pedida === "grupos" && verGrupos ? "grupos" : pedida === "usuarios" && verUsuarios ? "usuarios" : verUsuarios ? "usuarios" : "grupos";

  const [grupos, setGrupos] = useState<GrupoAcesso[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioDoAcesso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [novoUsuario, setNovoUsuario] = useState(false);
  const [grupoAberto, setGrupoAberto] = useState<{ grupo: GrupoAcesso | null } | null>(null);

  useEffect(() => {
    if (legado) return;
    let vivo = true;
    setCarregando(true);
    setErro(null);
    Promise.all([carregarGrupos(verUsuarios), verUsuarios ? carregarUsuarios() : Promise.resolve([])])
      .then(([g, u]) => { if (vivo) { setGrupos(g); setUsuarios(u); } })
      .catch((e: Error) => { if (vivo) setErro(e.message); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [legado, verUsuarios, versao]);

  /** Depois de qualquer gravação: relê a lista e as próprias permissões (o próprio grupo pode ter mudado de nome). */
  const recarregarTudo = () => { setVersao((v) => v + 1); void recarregar(); };

  const euSouAdministrador = meuGrupo?.sistema === true;
  const concediveis = useMemo(() => gruposQuePossoConceder(meuGrupo, grupos), [meuGrupo, grupos]);
  const meuNivel = grupos.find((g) => g.id === meuGrupo?.id)?.nivel ?? null;
  const setores = useMemo(() => sugestoesDistintas(usuarios.map((u) => u.setor)), [usuarios]);
  const cargos = useMemo(() => sugestoesDistintas(usuarios.map((u) => u.cargo)), [usuarios]);

  const trocarAba = (proxima: Aba) => setParams({ aba: proxima }, { replace: true });
  const abas = [
    ...(verUsuarios ? [{ value: "usuarios" as const, label: "Usuários" }] : []),
    ...(verGrupos ? [{ value: "grupos" as const, label: "Grupos de permissão" }] : []),
  ];
  const botao = aba === "usuarios"
    ? pode("acessos.usuarios", "criar") && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setNovoUsuario(true)}>Novo usuário</Button>
    : pode("acessos.grupos", "criar") && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setGrupoAberto({ grupo: null })}>Novo grupo</Button>;

  return (
    <PageShell title="Acessos" subtitle="Usuários do aplicativo e os grupos de permissão que dizem o que cada um pode.">
      {legado ? (
        <div className="card-surface p-5">
          <AvisoEmLinha tom="atencao">
            Os grupos de permissão ainda não estão disponíveis neste ambiente (a atualização do banco está pendente).
          </AvisoEmLinha>
        </div>
      ) : (
        <div>
          {/* O botão de cadastrar mora na fileira das sub-abas, à direita (regra do padrão). O
              fio de baixo é desenhado pela barra inteira, para correr também sob o botão; a aba
              ativa, branca, passa por cima dele e emenda no painel. */}
          <div className="barra-abas flex flex-col-reverse gap-2 rounded-t-xl border border-b-0 border-border bg-muted/35 pt-3 shadow-[inset_0_-1px_0_var(--color-border)] sm:flex-row sm:items-end sm:justify-between">
            <FolderTabs value={aba} options={abas} onChange={trocarAba} ariaLabel="Seções de Acessos" className="px-4 pt-0" />
            {botao && <div className="flex justify-end px-4 sm:pb-1.5">{botao}</div>}
          </div>
          <FolderPanel semRecuo>
            {erro ? (
              <div className="p-4"><AvisoEmLinha tom="erro">Não foi possível carregar os acessos: {erro}</AvisoEmLinha></div>
            ) : carregando ? (
              <EsqueletoTabela
                rotulo="Carregando acessos…"
                colunas={aba === "usuarios"
                  ? ["Nome", "E-mail", "Setor", "Cargo", "Grupo", "Status", "Último acesso", ""]
                  : ["Nome", "Descrição", "Nível no banco", "Usuários", "Resumo", "Status", ""]}
              />
            ) : aba === "usuarios" ? (
              <AbaUsuarios
                usuarios={usuarios}
                grupos={grupos}
                concediveis={concediveis}
                euId={euId}
                euSouAdministrador={euSouAdministrador}
                pode={pode}
                temEspecial={temEspecial}
                setores={setores}
                cargos={cargos}
                onRecarregar={recarregarTudo}
              />
            ) : (
              <AbaGrupos
                grupos={grupos}
                meuGrupoId={meuGrupo?.id}
                euSouAdministrador={euSouAdministrador}
                podeEditar={pode("acessos.grupos", "editar")}
                concediveisIds={new Set(concediveis.map((g) => g.id))}
                onAbrir={(g) => setGrupoAberto({ grupo: g })}
              />
            )}
          </FolderPanel>
        </div>
      )}

      {!legado && (
        <NovoUsuario
          aberto={novoUsuario}
          onFechar={() => setNovoUsuario(false)}
          onCriado={() => { setNovoUsuario(false); recarregarTudo(); }}
          onCriarGrupo={() => { setNovoUsuario(false); trocarAba("grupos"); if (pode("acessos.grupos", "criar")) setGrupoAberto({ grupo: null }); }}
          concediveis={concediveis}
          grupos={grupos}
          euSouAdministrador={euSouAdministrador}
          setores={setores}
          cargos={cargos}
        />
      )}

      {grupoAberto && (
        <GrupoModal
          grupo={grupoAberto.grupo}
          meuGrupoId={meuGrupo?.id}
          meuNivel={meuNivel}
          euSouAdministrador={euSouAdministrador}
          minhasPermissoes={permissoes}
          podeEditar={grupoAberto.grupo ? pode("acessos.grupos", "editar") : pode("acessos.grupos", "criar")}
          podeInativar={pode("acessos.grupos", "inativar")}
          dentroDoAlcance={!grupoAberto.grupo || euSouAdministrador || concediveis.some((g) => g.id === grupoAberto.grupo!.id)}
          onFechar={() => setGrupoAberto(null)}
          onSalvo={() => { setGrupoAberto(null); recarregarTudo(); }}
        />
      )}
    </PageShell>
  );
}
