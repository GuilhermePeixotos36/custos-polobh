/**
 * Popup do grupo de permissão (padrão de Acessos LSPRO): nome, descrição, "Grupo ativo", o nível
 * no banco (adaptação Pólobh) e a MATRIZ em blocos por módulo, cada um com o interruptor "Acesso ao
 * módulo". A lógica é toda de `lib/acessos/permissoes`; aqui só se desenha.
 *
 * "Quem não é do Administrador só marca o que ele próprio tem": a caixa do que ele não tem fica
 * desabilitada, com a dica; o que o grupo já tem e ele não tem pode ser desmarcado, nunca marcado de
 * novo. Todo caminho de marcação (caixa, coluna, "Marcar tudo") passa pelo mesmo filtro. Quem
 * recusa de verdade é o banco (`salvar_grupo_acesso`).
 */
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { JanelaModal } from "@/components/padrao/JanelaModal";
import { CabecalhoJanela } from "@/components/padrao/CabecalhoJanela";
import { AvisoEmLinha } from "@/components/padrao/AvisoEmLinha";
import { Button, Field, Input, Select, Textarea, Toggle } from "@/components/ui";
import { CAMADA_POPUP, RodapeJanela, fecharComGuarda } from "./comum";
import { CATALOGO, NIVEIS_NO_BANCO, nivelContido, type ModuloAcesso } from "@/config/acessos/catalogo";
import {
  acoesDaTela, alternarAcao, alternarModulo, colunasDoModulo, moduloTemPermissao, pode as temPerm,
  permissoesValidas, resumoDoGrupo, rotuloDaAcao, type Permissao,
} from "@/lib/acessos/permissoes";
import { motivoDeNaoInativarGrupo } from "@/lib/acessos/usuarios";
import { salvarGrupo, type GrupoAcesso } from "@/lib/acessos/acessosStore";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast";

const DICA_SEM_PODER = "Você não tem esta permissão, então não pode concedê-la.";

export function GrupoModal({ grupo, meuGrupoId, meuNivel, euSouAdministrador, minhasPermissoes, podeEditar, podeInativar, onFechar, onSalvo }: {
  /** `null` = grupo novo. */
  grupo: GrupoAcesso | null;
  meuGrupoId: string | undefined;
  meuNivel: string | null;
  euSouAdministrador: boolean;
  /** As permissões de quem está na tela (o Administrador tem todas). */
  minhasPermissoes: Permissao[];
  podeEditar: boolean;
  podeInativar: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const novo = !grupo;
  const sistema = grupo?.sistema === true;
  const eMeu = !!grupo && grupo.id === meuGrupoId && !euSouAdministrador;
  const somenteLeitura = sistema || eMeu || !podeEditar;

  const inicial = {
    nome: grupo?.nome ?? "",
    descricao: grupo?.descricao ?? "",
    ativo: grupo?.ativo ?? true,
    nivel: grupo?.nivel ?? "",
    permissoes: grupo?.permissoes ?? ([] as Permissao[]),
  };
  const [form, setForm] = useState(inicial);
  const [ligados, setLigados] = useState<Set<string>>(
    () => new Set(CATALOGO.filter((m) => moduloTemPermissao(inicial.permissoes, m.id)).map((m) => m.id)),
  );
  const [salvando, setSalvando] = useState(false);

  /** Posso LIGAR esta permissão? O Administrador pode tudo; os demais, só o que têm. */
  const possoMarcar = (tela: string, acao: string) => euSouAdministrador || temPerm(minhasPermissoes, tela, acao);
  const niveis = NIVEIS_NO_BANCO.filter((n) => euSouAdministrador || nivelContido(n.valor, meuNivel) || n.valor === inicial.nivel);

  const sujo = JSON.stringify(form) !== JSON.stringify(inicial);
  const fechar = () => (somenteLeitura ? onFechar() : void fecharComGuarda(sujo, onFechar, novo));

  /** Aplica uma mudança da matriz descartando o que quem edita não pode ligar (nunca entra). */
  function aplicar(proximas: Permissao[]) {
    const antes = new Set(form.permissoes.map((p) => `${p.tela}|${p.acao}`));
    const filtradas = proximas.filter((p) => antes.has(`${p.tela}|${p.acao}`) || possoMarcar(p.tela, p.acao));
    setForm({ ...form, permissoes: filtradas });
  }

  function alternarBloco(modulo: ModuloAcesso, ligado: boolean) {
    const proximo = new Set(ligados);
    if (ligado) proximo.add(modulo.id); else proximo.delete(modulo.id);
    setLigados(proximo);
    if (!ligado) setForm({ ...form, permissoes: alternarModulo(form.permissoes, modulo.id, false) });
  }

  function marcarTudo(modulo: ModuloAcesso, marcado: boolean) {
    let atual = form.permissoes;
    for (const tela of modulo.telas) {
      for (const acao of acoesDaTela(tela)) atual = alternarAcao(atual, tela.chave, acao, marcado);
    }
    aplicar(atual);
  }

  function marcarColuna(modulo: ModuloAcesso, acao: string, marcado: boolean) {
    let atual = form.permissoes;
    for (const tela of modulo.telas) {
      if (acoesDaTela(tela).includes(acao)) atual = alternarAcao(atual, tela.chave, acao, marcado);
    }
    aplicar(atual);
  }

  /** A coluna "está marcada" olhando só as telas que têm a ação. */
  function colunaMarcada(modulo: ModuloAcesso, acao: string) {
    const telas = modulo.telas.filter((t) => acoesDaTela(t).includes(acao));
    return telas.length > 0 && telas.every((t) => temPerm(form.permissoes, t.chave, acao));
  }

  async function salvar() {
    const nome = form.nome.trim();
    if (!nome) return toast("Dê um nome ao grupo.", "danger");
    if (!form.nivel) return toast("Escolha o nível no banco do grupo.", "danger");
    if (!novo && inicial.ativo && !form.ativo) {
      const motivo = motivoDeNaoInativarGrupo(grupo?.usuariosAtivos ?? null);
      if (motivo) return toast(motivo, "danger");
    }
    setSalvando(true);
    try {
      await salvarGrupo({
        id: grupo?.id,
        nome,
        descricao: form.descricao.trim(),
        ativo: form.ativo,
        papel: form.nivel,
        permissoes: permissoesValidas(form.permissoes),
      });
      toast(novo ? "Grupo criado." : "Grupo atualizado.", "success");
      onSalvo();
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setSalvando(false);
    }
  }

  const titulo = novo ? "Novo grupo de permissão" : sistema ? `Grupo ${grupo!.nome}` : `Editar grupo · ${grupo!.nome}`;
  const permissoesMostradas = sistema ? grupo!.permissoes : form.permissoes;

  return (
    <JanelaModal onFechar={fechar} fecharNoVeu={false} rotulo={titulo} camada={CAMADA_POPUP} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden bg-card">
      <CabecalhoJanela titulo={titulo} subtitulo={novo ? undefined : resumoDoGrupo(permissoesMostradas)} icone={ShieldCheck} onFechar={fechar} />
      <div className="grid gap-4 overflow-y-auto px-5 py-5">
        {sistema && (
          <AvisoEmLinha tom="info">
            O {grupo!.nome} libera tudo e não se edita: não pode ser renomeado, inativado nem ficar sem usuário ativo.
          </AvisoEmLinha>
        )}
        {eMeu && !sistema && (
          <AvisoEmLinha tom="info">Este é o seu grupo: só um Administrador de sistema altera o acesso do próprio grupo.</AvisoEmLinha>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" obrigatorio>
            <Input formato="titulo" maxLength={80} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} disabled={somenteLeitura} />
          </Field>
          {!sistema && (
            <Field label="Nível no banco" obrigatorio hint="(o que as regras do banco liberam)">
              <Select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} disabled={somenteLeitura} aria-label="Nível no banco">
                <option value="">Escolha o nível</option>
                {niveis.map((n) => <option key={n.valor} value={n.valor}>{n.rotulo}</option>)}
              </Select>
              {form.nivel && (
                <p className="mt-1 text-xs text-muted-foreground">{NIVEIS_NO_BANCO.find((n) => n.valor === form.nivel)?.descricao}</p>
              )}
            </Field>
          )}
          <Field label="Descrição" className="sm:col-span-2">
            <Textarea rows={2} maxLength={500} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} disabled={somenteLeitura} />
          </Field>
          {!novo && !sistema && (
            <label className={cn("inline-flex items-center gap-2 text-sm text-foreground sm:col-span-2", (somenteLeitura || grupo!.padrao || !podeInativar) && "opacity-60")}>
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                disabled={somenteLeitura || grupo!.padrao || (!podeInativar && form.ativo)}
                className="h-4 w-4 rounded border-input accent-brand"
              />
              Grupo ativo
              {grupo!.padrao && <span className="text-xs text-muted-foreground">— grupo padrão não pode ser inativado.</span>}
            </label>
          )}
        </div>

        {CATALOGO.map((modulo) => {
          const ligado = sistema || ligados.has(modulo.id);
          const colunas = colunasDoModulo(modulo);
          return (
            <section key={modulo.id} className="rounded-lg border border-border" aria-label={modulo.rotulo}>
              <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">{modulo.rotulo}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {ligado && !somenteLeitura && (
                    <>
                      <Button variant="text" size="sm" onClick={() => marcarTudo(modulo, true)}>Marcar tudo</Button>
                      <Button variant="text" size="sm" onClick={() => marcarTudo(modulo, false)}>Limpar</Button>
                    </>
                  )}
                  {somenteLeitura ? (
                    <span className="text-xs text-muted-foreground">{ligado ? "Com acesso ao módulo" : "Sem acesso ao módulo"}</span>
                  ) : (
                    <Toggle checked={ligado} onChange={(v) => alternarBloco(modulo, v)} label="Acesso ao módulo" />
                  )}
                </div>
              </header>
              {ligado && (
                <div className="overflow-x-auto border-t border-border">
                  <table className="lista-matriz w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold">Tela</th>
                        {colunas.map((c) => {
                          const algumaTem = modulo.telas.some((t) => acoesDaTela(t).includes(c.chave));
                          return (
                            <th key={c.chave} className="px-3 py-2.5 text-center text-xs font-semibold">
                              <span className="flex flex-col items-center gap-1">
                                {c.rotulo}
                                {algumaTem && !somenteLeitura && (
                                  <input
                                    type="checkbox"
                                    aria-label={`${modulo.rotulo}: marcar a coluna ${c.rotulo}`}
                                    checked={colunaMarcada(modulo, c.chave)}
                                    onChange={(e) => marcarColuna(modulo, c.chave, e.target.checked)}
                                    className="h-4 w-4 rounded border-input accent-brand"
                                  />
                                )}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {modulo.telas.map((tela) => (
                        <tr key={tela.chave}>
                          <td className="px-4 py-2.5 font-medium text-foreground">{tela.rotulo}</td>
                          {colunas.map((c) => {
                            if (!acoesDaTela(tela).includes(c.chave)) {
                              return <td key={c.chave} className="px-3 py-2.5 text-center text-muted-foreground" aria-hidden>—</td>;
                            }
                            const marcado = temPerm(permissoesMostradas, tela.chave, c.chave);
                            const semPoder = !marcado && !possoMarcar(tela.chave, c.chave);
                            return (
                              <td key={c.chave} className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`${tela.rotulo}: ${rotuloDaAcao(tela, c.chave)}`}
                                  title={!somenteLeitura && semPoder ? DICA_SEM_PODER : undefined}
                                  checked={marcado}
                                  disabled={somenteLeitura || semPoder}
                                  onChange={(e) => aplicar(alternarAcao(form.permissoes, tela.chave, c.chave, e.target.checked))}
                                  className="h-4 w-4 rounded border-input accent-brand disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <RodapeJanela>
        {somenteLeitura ? (
          <Button onClick={onFechar}>Fechar</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={fechar} disabled={salvando}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando}>{salvando ? "Salvando…" : novo ? "Criar grupo" : "Salvar"}</Button>
          </>
        )}
      </RodapeJanela>
    </JanelaModal>
  );
}
