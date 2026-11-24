/**
 * Sub-aba Usuários (padrão de Acessos LSPRO): barra "Filtros" (Grupo e Status) com contador e a
 * busca à direita; a lista com olho · lápis · ativar/inativar, nessa ordem; e os popups. A regra
 * de cada botão vem de `acoesDaLinha` — a tela só desenha o que ela devolve. Não existe excluir.
 *
 * Adaptação Pólobh: sem "Origem" (não há lista de colaboradores de outro app); no lugar dela a
 * coluna Setor.
 */
import { useMemo, useState } from "react";
import { Eye, Pencil, Power, PowerOff, Users } from "lucide-react";
import { BarraFiltros } from "@/components/padrao/BarraFiltros";
import { filterControlClass } from "@/components/padrao/FilterPills";
import { EstadoVazio } from "@/components/padrao/EstadoVazio";
import { AvatarUsuario } from "@/components/padrao/AvatarUsuario";
import { Table, THead, Th, Tr, Td } from "@/components/ui";
import { BotaoIcone, SeloDoStatus, formatarUltimoAcesso } from "./comum";
import { EditarUsuario } from "./EditarUsuario";
import { DetalhesUsuario } from "./DetalhesUsuario";
import { AtivarComGrupo } from "./AtivarComGrupo";
import { definirAcessoDoUsuario, type GrupoAcesso, type UsuarioDoAcesso } from "@/lib/acessos/acessosStore";
import {
  FILTROS_VAZIOS, acoesDaLinha, filtrarUsuarios, filtrosAtivosDeUsuarios, gruposEscolheveis, motivoDeEdicaoTravada,
  type FiltrosDeUsuarios,
} from "@/lib/acessos/usuarios";
import { confirmar } from "@/store/confirm";
import { toast } from "@/store/toast";

export function AbaUsuarios({ usuarios, grupos, concediveis, euId, euSouAdministrador, pode, temEspecial, setores, cargos, onRecarregar }: {
  usuarios: UsuarioDoAcesso[];
  grupos: GrupoAcesso[];
  concediveis: GrupoAcesso[];
  euId: string;
  euSouAdministrador: boolean;
  pode: (tela: string, acao: string) => boolean;
  temEspecial: (chave: string) => boolean;
  setores: string[];
  cargos: string[];
  onRecarregar: () => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosDeUsuarios>(FILTROS_VAZIOS);
  const [vendo, setVendo] = useState<UsuarioDoAcesso | null>(null);
  const [editando, setEditando] = useState<UsuarioDoAcesso | null>(null);
  const [ativandoComGrupo, setAtivandoComGrupo] = useState<UsuarioDoAcesso | null>(null);
  /** A linha no meio de uma gravação: não aceita outro clique. */
  const [gravando, setGravando] = useState<string | null>(null);

  const lista = useMemo(() => filtrarUsuarios(usuarios, filtros), [usuarios, filtros]);
  const grupoDe = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos]);
  const sistemaId = grupos.find((g) => g.sistema)?.id;
  const concediveisIds = useMemo(() => new Set(concediveis.map((g) => g.id)), [concediveis]);

  function contextoDa(u: UsuarioDoAcesso) {
    const grupoAtual = u.grupoId ? grupoDe.get(u.grupoId) : undefined;
    const membroDoAdministrador = !!sistemaId && u.grupoId === sistemaId;
    const ehEu = u.id === euId;
    const grupoAtualConcedivel = !!grupoAtual && grupoAtual.ativo && (euSouAdministrador || concediveisIds.has(grupoAtual.id));
    const acoes = acoesDaLinha(u, {
      pode, ehEu, membroDoAdministrador, euSouAdministrador, grupoAtualConcedivel,
      especiaisForaDoMeuAlcance: u.especiais.some((chave) => !temEspecial(chave)),
    });
    return { grupoAtual, membroDoAdministrador, ehEu, grupoAtualConcedivel, acoes };
  }

  async function inativar(u: UsuarioDoAcesso) {
    const nome = u.nome || u.email;
    const ok = await confirmar({
      titulo: "Inativar usuário",
      mensagem: `${nome} perde o acesso ao app. Dá para ativar de novo depois.`,
      confirmarTexto: "Inativar",
      tom: "danger",
    });
    if (!ok) return;
    await gravar(u.id, () => definirAcessoDoUsuario({ usuarioId: u.id, grupoId: null, status: "inativo" }), `${nome} está sem acesso.`);
  }

  async function ativar(u: UsuarioDoAcesso, escolherGrupo: boolean) {
    if (escolherGrupo) return setAtivandoComGrupo(u);
    const nome = u.nome || u.email;
    const ok = await confirmar({
      titulo: "Ativar usuário",
      mensagem: `${nome} volta a acessar o app com o grupo ${grupoDe.get(u.grupoId ?? "")?.nome ?? "—"}.`,
      confirmarTexto: "Ativar",
    });
    if (!ok) return;
    await gravar(u.id, () => definirAcessoDoUsuario({ usuarioId: u.id, grupoId: null, status: "ativo" }), `${nome} voltou a ter acesso.`);
  }

  async function gravar(id: string, acao: () => Promise<void>, sucesso: string): Promise<boolean> {
    setGravando(id);
    try {
      await acao();
      toast(sucesso, "success");
      onRecarregar();
      return true;
    } catch (e) {
      toast((e as Error).message, "danger");
      return false;
    } finally {
      setGravando(null);
    }
  }

  const ativos = filtrosAtivosDeUsuarios(filtros);

  return (
    <>
      <BarraFiltros
        busca={filtros.busca}
        onBusca={(busca) => setFiltros({ ...filtros, busca })}
        placeholderBusca="Nome, e-mail ou cargo"
        rotuloBusca="Buscar usuário"
        ativos={ativos}
        onLimpar={() => setFiltros({ ...FILTROS_VAZIOS, busca: filtros.busca })}
        contagem={`${lista.length} usuário(s)`}
        className="border-b border-border"
      >
        <select aria-label="Grupo" value={filtros.grupoId} onChange={(e) => setFiltros({ ...filtros, grupoId: e.target.value })} className={filterControlClass}>
          <option value="">Todos os grupos</option>
          {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <select aria-label="Status" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value as FiltrosDeUsuarios["status"] })} className={filterControlClass}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="pendente">Pendente</option>
          <option value="inativo">Inativo</option>
        </select>
      </BarraFiltros>

      {usuarios.length === 0 ? (
        <EstadoVazio semCartao icone={Users} titulo="Nenhum usuário cadastrado." />
      ) : lista.length === 0 ? (
        <EstadoVazio semCartao icone={Users} titulo="Nenhum usuário encontrado." />
      ) : (
        <Table>
          <THead>
            <Th grudado={false}>Nome</Th>
            <Th grudado={false}>E-mail</Th>
            <Th grudado={false}>Setor</Th>
            <Th grudado={false}>Cargo</Th>
            <Th grudado={false}>Grupo</Th>
            <Th grudado={false}>Status</Th>
            <Th grudado={false}>Último acesso</Th>
            <Th grudado={false} align="right"><span className="sr-only">Ações</span></Th>
          </THead>
          <tbody>
            {lista.map((u) => {
              const { grupoAtual, acoes } = contextoDa(u);
              const nome = u.nome || u.email;
              return (
                <Tr key={u.id}>
                  <Td>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <AvatarUsuario nome={nome} className="h-8 w-8" />
                      <span className="truncate font-semibold">{nome}</span>
                    </span>
                  </Td>
                  <Td className="text-muted-foreground">{u.email || "—"}</Td>
                  <Td>{u.setor || "—"}</Td>
                  <Td>{u.cargo || "—"}</Td>
                  <Td>{grupoAtual?.nome ?? "—"}</Td>
                  <Td><SeloDoStatus status={u.status} /></Td>
                  <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{formatarUltimoAcesso(u.ultimoAcesso)}</Td>
                  <Td align="right">
                    <span className="inline-flex items-center gap-1">
                      {acoes.ver !== "oculto" && (
                        <BotaoIcone rotulo={`Ver ${nome}`} icone={<Eye />} onClick={() => setVendo(u)} desabilitado={gravando === u.id} />
                      )}
                      {acoes.editar !== "oculto" && (
                        <BotaoIcone
                          rotulo={u.status === "pendente" ? `Liberar acesso de ${nome}` : `Editar ${nome}`}
                          icone={<Pencil />}
                          onClick={() => setEditando(u)}
                          desabilitado={acoes.editar === "travado" || gravando === u.id}
                          dica={acoes.editar === "travado" ? acoes.motivo : null}
                        />
                      )}
                      {acoes.alternar && (
                        acoes.alternar.tipo === "inativar" ? (
                          <BotaoIcone
                            rotulo={`Inativar ${nome}`}
                            icone={<PowerOff />}
                            perigo
                            onClick={() => void inativar(u)}
                            desabilitado={acoes.alternar.estado === "travado"}
                            dica={acoes.alternar.estado === "travado" ? acoes.motivo : null}
                            carregando={gravando === u.id}
                          />
                        ) : (
                          <BotaoIcone
                            rotulo={`Ativar ${nome}`}
                            icone={<Power />}
                            onClick={() => void ativar(u, acoes.alternar!.escolherGrupo)}
                            desabilitado={acoes.alternar.estado === "travado"}
                            dica={acoes.alternar.estado === "travado" ? acoes.motivo : null}
                            carregando={gravando === u.id}
                          />
                        )
                      )}
                    </span>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {vendo && (() => {
        const { grupoAtual, acoes } = contextoDa(vendo);
        return (
          <DetalhesUsuario
            usuario={vendo}
            grupo={grupoAtual}
            podeEditar={acoes.editar === "livre"}
            onEditar={() => { setEditando(vendo); setVendo(null); }}
            onFechar={() => setVendo(null)}
          />
        );
      })()}

      {editando && (() => {
        const { membroDoAdministrador, ehEu, grupoAtualConcedivel } = contextoDa(editando);
        return (
          <EditarUsuario
            usuario={editando}
            grupos={grupos}
            concediveis={concediveis}
            euSouAdministrador={euSouAdministrador}
            motivoTrava={motivoDeEdicaoTravada({ ehEu, membroDoAdministrador, euSouAdministrador })}
            podeDefinirSenha={editando.status === "ativo" && pode("acessos.usuarios", "editar") && !ehEu && grupoAtualConcedivel}
            setores={setores}
            cargos={cargos}
            onFechar={() => setEditando(null)}
            onSalvo={() => { setEditando(null); onRecarregar(); }}
          />
        );
      })()}

      {ativandoComGrupo && (
        <AtivarComGrupo
          usuario={ativandoComGrupo}
          opcoes={gruposEscolheveis(concediveis, euSouAdministrador)}
          gravando={gravando === ativandoComGrupo.id}
          onFechar={() => setAtivandoComGrupo(null)}
          onConfirmar={(grupoId) => {
            const u = ativandoComGrupo;
            void gravar(u.id, () => definirAcessoDoUsuario({ usuarioId: u.id, grupoId, status: "ativo" }), `${u.nome || u.email} voltou a ter acesso.`)
              .then((ok) => { if (ok) setAtivandoComGrupo(null); });
          }}
        />
      )}
    </>
  );
}
