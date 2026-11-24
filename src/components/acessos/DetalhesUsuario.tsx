/**
 * "Detalhes do usuário" (o olho da linha): as mesmas informações do "Editar usuário", só leitura,
 * como texto. Fecha no clique fora e no Esc — não há o que perder. Nada de senha, nada que grave.
 */
import { User } from "lucide-react";
import { JanelaModal } from "@/components/padrao/JanelaModal";
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import { Button } from "@/components/ui";
import { CAMADA_POPUP, DadoDeLeitura, RodapeJanela, SeloDoStatus, formatarUltimoAcesso } from "./comum";
import type { GrupoAcesso, UsuarioDoAcesso } from "@/lib/acessos/acessosStore";
import { resumoDoGrupo } from "@/lib/acessos/permissoes";

export function DetalhesUsuario({ usuario, grupo, podeEditar, onEditar, onFechar }: {
  usuario: UsuarioDoAcesso;
  grupo: GrupoAcesso | undefined;
  /** Lápis visível e não travado para quem está na tela: o rodapé ganha "Editar". */
  podeEditar: boolean;
  onEditar: () => void;
  onFechar: () => void;
}) {
  return (
    <JanelaModal onFechar={onFechar} rotulo="Detalhes do usuário" camada={CAMADA_POPUP} className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden bg-card">
      <CabecalhoJanela titulo="Detalhes do usuário" subtitulo={usuario.nome || usuario.email} icone={User} onFechar={onFechar} />
      <div className="grid gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
        <DadoDeLeitura rotulo="Nome" className="sm:col-span-2">{usuario.nome || "—"}</DadoDeLeitura>
        <DadoDeLeitura rotulo="E-mail">{usuario.email || "—"}</DadoDeLeitura>
        <DadoDeLeitura rotulo="Telefone">{usuario.telefone || "—"}</DadoDeLeitura>
        <DadoDeLeitura rotulo="Setor">{usuario.setor || "—"}</DadoDeLeitura>
        <DadoDeLeitura rotulo="Cargo/função">{usuario.cargo || "—"}</DadoDeLeitura>
        <DadoDeLeitura rotulo="Entrada">E-mail e senha</DadoDeLeitura>
        <DadoDeLeitura rotulo="Grupo de permissão">
          {grupo ? (
            <>
              {grupo.nome}
              <span className="block text-xs text-muted-foreground">{resumoDoGrupo(grupo.permissoes)}</span>
            </>
          ) : "—"}
        </DadoDeLeitura>
        <DadoDeLeitura rotulo="Status"><SeloDoStatus status={usuario.status} /></DadoDeLeitura>
        <DadoDeLeitura rotulo="Último acesso">{formatarUltimoAcesso(usuario.ultimoAcesso)}</DadoDeLeitura>
      </div>
      <RodapeJanela>
        {podeEditar && <Button variant="secondary" onClick={onEditar}>Editar</Button>}
        <Button onClick={onFechar}>Fechar</Button>
      </RodapeJanela>
    </JanelaModal>
  );
}
