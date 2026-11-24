/**
 * "Ativar usuário" quando o grupo atual não serve (inativo, sumido ou fora do alcance de quem
 * ativa): a confirmação pede o grupo, obrigatório e sem nenhum pré-marcado, e grava grupo e status
 * numa chamada só — o banco aceita trocar o grupo de um inativo só quando ativa. Quando o grupo
 * atual serve, a tela usa a confirmação simples do app (`confirmar`).
 */
import { useState } from "react";
import { JanelaModal } from "@/components/padrao/JanelaModal";
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import { Button, Field, Select } from "@/components/ui";
import { CAMADA_POPUP, RodapeJanela } from "./comum";
import type { GrupoAcesso, UsuarioDoAcesso } from "@/lib/acessos/acessosStore";

export function AtivarComGrupo({ usuario, opcoes, gravando, onConfirmar, onFechar }: {
  usuario: UsuarioDoAcesso;
  opcoes: GrupoAcesso[];
  gravando: boolean;
  onConfirmar: (grupoId: string) => void;
  onFechar: () => void;
}) {
  const [grupoId, setGrupoId] = useState("");
  const nome = usuario.nome || usuario.email;
  return (
    <JanelaModal onFechar={gravando ? undefined : onFechar} fecharNoVeu={false} role="alertdialog" rotulo="Ativar usuário" camada={CAMADA_POPUP} className="flex w-full max-w-md flex-col overflow-hidden bg-card">
      <CabecalhoJanela titulo="Ativar usuário" onFechar={onFechar} fecharDesabilitado={gravando} />
      <div className="grid gap-4 px-5 py-5">
        <p className="text-sm text-foreground">{nome} volta a acessar o app. Escolha o grupo.</p>
        <Field label="Grupo de permissão" obrigatorio>
          <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} aria-label="Grupo de permissão">
            <option value="">Escolha o grupo</option>
            {opcoes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </Select>
        </Field>
      </div>
      <RodapeJanela>
        <Button variant="secondary" onClick={onFechar} disabled={gravando}>Cancelar</Button>
        <Button onClick={() => onConfirmar(grupoId)} disabled={!grupoId || gravando}>{gravando ? "Ativando…" : "Ativar"}</Button>
      </RodapeJanela>
    </JanelaModal>
  );
}
