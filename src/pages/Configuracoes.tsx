import { useState } from "react";
import { PageShell, Crumb } from "@/components/layout/AppLayout";
import { Card, CardTitle, Toggle, Badge, Field, Input } from "@/components/ui";
import { IcCheck } from "@/components/icons";
import { PERMISSOES, ROTULO_PAPEL, type Recurso } from "@/store/auth";
import { useEmpresas } from "@/store/empresas";
import { toast } from "@/store/toast";
import { flags } from "@/lib/flags";
import { cx } from "@/lib/format";
import type { Papel } from "@/data/types";

const RECURSOS: { key: Recurso; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "ecs", label: "ECs (consulta)" },
  { key: "ecs.editar", label: "ECs (editar)" },
  { key: "oss", label: "Ordens de Serviço" },
  { key: "cronogramas", label: "Cronogramas" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "financeiro", label: "Bloco financeiro" },
  { key: "configuracoes", label: "Configurações" },
  { key: "logs", label: "Logs do sistema" },
];
const PAPEIS: Papel[] = ["Admin", "Direcao", "Producao", "Administrativo"];

export function Configuracoes() {
  const [retencao, setRetencao] = useState(24);
  const [arquivamentoAuto, setArquivamentoAuto] = useState(true);

  return (
    <PageShell breadcrumb={<Crumb>Configurações</Crumb>} title="Configurações" subtitle="Empresas de emissão, perfis de acesso, retenção e segurança.">
      <div className="space-y-4">
        <EmpresasGrupoCard />

        <Card padded={false}>
          <div className="p-5"><CardTitle hint="Quem enxerga e edita cada recurso">Matriz de perfis × recursos</CardTitle></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-[#FAFAFB]">
                  <th className="text-left px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">Recurso</th>
                  {PAPEIS.map((p) => (
                    <th key={p} className="px-4 py-2.5 text-center text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-ink-3">{ROTULO_PAPEL[p]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECURSOS.map((r) => (
                  <tr key={r.key} className="border-b border-border-soft">
                    <td className="px-4 py-3 font-semibold text-ink">{r.label}</td>
                    {PAPEIS.map((p) => (
                      <td key={p} className="px-4 py-3 text-center">
                        {PERMISSOES[p].includes(r.key) ? (
                          <span className="inline-flex text-success"><IcCheck width={18} height={18} /></span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <Card>
            <CardTitle hint="Arquivar ≠ apagar — registros arquivados continuam consultáveis">Retenção de dados</CardTitle>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">Arquivamento automático</span>
                <Toggle checked={arquivamentoAuto} onChange={setArquivamentoAuto} />
              </div>
              <div>
                <label className="text-[12.5px] font-bold text-ink">Prazo de arquivamento: <span className="text-primary-dark">{retencao} meses</span></label>
                <input type="range" min={6} max={48} step={6} value={retencao} onChange={(e) => setRetencao(Number(e.target.value))} className="w-full accent-[#F2820D] mt-2" />
              </div>
              <p className="text-[12.5px] text-ink-2">Ao concluir um projeto, os dados são arquivados (não apagados) e seguem disponíveis para consulta e duplicação.</p>
            </div>
          </Card>

          <Card>
            <CardTitle hint="Funcionalidades ativadas por feature flag">Integrações & segurança</CardTitle>
            <div className="space-y-3 text-sm">
              <LinhaFlag label="Consulta de CNPJ (BrasilAPI)" on={flags.consultaCnpj} />
              <LinhaFlag label="E-mails automáticos (Brevo)" on={flags.email} />
              <LinhaFlag label="Descritivo por IA" on={flags.descritivoIA} />
              <div className="h-px bg-border-soft" />
              <LinhaFlag label="Trilha de auditoria (Logs)" on={true} />
              <p className="text-[12.5px] text-ink-2">
                <b className="text-ink">Auditoria:</b> acessos, alterações de EC/OS/cadastros e tentativas de acesso
                negado são registrados na tela <b className="text-ink">Logs do sistema</b> (visível apenas ao perfil
                Administrador).
              </p>
              <p className="text-[12.5px] text-ink-2">
                <b className="text-ink">LGPD:</b> dados de clientes e fornecedores são tratados apenas para fins de
                contratação e faturamento. Chaves de API ficam no servidor (Edge Functions), nunca no frontend.
              </p>
              <p className="text-[12.5px] text-ink-2">
                <b className="text-ink">Atenção:</b> as permissões abaixo são controles de interface. A segurança
                efetiva (autenticação e RLS) passa a valer quando o backend (Supabase) for conectado.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function LinhaFlag({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink">{label}</span>
      <Badge tom={on ? "success" : "neutral"}>{on ? "Ativado" : "Desligado"}</Badge>
    </div>
  );
}

/**
 * Empresas do grupo Pólobh (Pólobh Promoções Eireli / MF Promoções Eireli).
 * Preenchem os dados fiscais da OS quando o tomador/contratante é a Pólobh.
 * Fonte: Supabase (tabela empresas_grupo). Edita ao digitar, salva ao sair do campo.
 */
function EmpresasGrupoCard() {
  const { empresas, carregado, editar, persistir, definirPadrao } = useEmpresas();

  const salvar = async (id: string) => {
    try {
      await persistir(id);
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    }
  };

  return (
    <Card>
      <CardTitle hint="Preenchem os dados fiscais da OS quando o tomador ou o contratante é a própria Pólobh">
        Empresas do grupo (emissão de nota fiscal)
      </CardTitle>

      {!carregado && empresas.length === 0 ? (
        <p className="text-ink-3 text-sm">Carregando…</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {empresas.map((e) => (
            <div
              key={e.id}
              className={cx(
                "rounded-card border p-4",
                e.padrao ? "border-active-border bg-primary-soft/40" : "border-border bg-surface"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="font-display font-bold text-[14px] text-ink">{e.nome}</h4>
                {e.padrao ? (
                  <Badge tom="success">Padrão p/ emissão</Badge>
                ) : (
                  <button
                    onClick={async () => { await definirPadrao(e.id); toast(`${e.nome} definida como padrão.`, "success"); }}
                    className="text-[12px] font-bold text-primary-dark hover:underline"
                  >
                    Tornar padrão
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <Field label="Razão Social">
                  <Input value={e.razaoSocial} onChange={(ev) => editar(e.id, { razaoSocial: ev.target.value })} onBlur={() => salvar(e.id)} placeholder="Ex.: Pólobh Promoções Eireli" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CNPJ">
                    <Input value={e.cnpj} onChange={(ev) => editar(e.id, { cnpj: ev.target.value })} onBlur={() => salvar(e.id)} placeholder="00.000.000/0000-00" />
                  </Field>
                  <Field label="Inscrição Estadual">
                    <Input value={e.inscricaoEstadual} onChange={(ev) => editar(e.id, { inscricaoEstadual: ev.target.value })} onBlur={() => salvar(e.id)} />
                  </Field>
                </div>
                <Field label="Endereço">
                  <Input value={e.endereco} onChange={(ev) => editar(e.id, { endereco: ev.target.value })} onBlur={() => salvar(e.id)} />
                </Field>
                <Field label="Inscrição Municipal">
                  <Input value={e.inscricaoMunicipal} onChange={(ev) => editar(e.id, { inscricaoMunicipal: ev.target.value })} onBlur={() => salvar(e.id)} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[12.5px] text-ink-2 mt-3">
        As alterações são salvas ao sair de cada campo. A empresa <b>padrão</b> é usada na emissão;
        se o tomador/contratante da OS for a Pólobh, estes dados entram na planilha.
      </p>
    </Card>
  );
}
