/**
 * Configurações › Contratos (13/11/2026): o texto PADRÃO de cada cláusula dos
 * dois modelos de contrato, Corporativo e Cultural.
 *
 * Quem altera: o Administrador e a Direção de Produção (recurso
 * `contratos.clausulas`). O banco repete a regra — a gravação desta chave de
 * `config_app` só passa para quem tem o recurso na área.
 *
 * O QUE ISTO MUDA, e o que não:
 *  · vale para os contratos gerados daqui em diante, nos dois lugares em que o
 *    texto aparece — o campo de cada cláusula na OS (que nasce com o texto
 *    padrão) e o PDF;
 *  · o que uma OS escreveu por cima do padrão continua valendo para ela;
 *  · contrato já emitido (PDF na pasta do projeto) não muda;
 *  · só se grava o que DIFERE do texto de fábrica — assim, "voltar ao texto
 *    original" devolve a cláusula ao código, e uma correção futura do código
 *    ainda alcança as cláusulas que ninguém editou.
 *
 * O que o sistema monta sozinho (partes, descritivo do objeto, valores,
 * assinaturas, fecho) não é editado aqui: vem dos dados de cada OS.
 */
import { useEffect, useMemo, useState } from "react";
import { SubGuias } from "@/components/layout/SubGuias";
import { AutoTextarea, Badge, Button, CarregandoTela, Card, CardTitle, Label } from "@/components/ui";
import {
  clausulasDoCodigo,
  MODELOS_CONTRATO,
  type ChaveClausula,
  type ClausulasDaCasa,
  type ModeloContrato,
} from "@/domain/contratoModelo";
import { clausulasDaCasa, gravarClausulasDaCasa } from "@/lib/contratoPdf";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";

const ROTULO_MODELO: Record<ModeloContrato, string> = { Corporativo: "CORPORATIVO", Cultural: "CULTURAL" };

/** Só o que difere do texto de fábrica — o que de fato vira "padrão da casa". */
function soDiferencas(r: ClausulasDaCasa): ClausulasDaCasa {
  const saida: ClausulasDaCasa = {};
  for (const modelo of MODELOS_CONTRATO) {
    const dele = r[modelo];
    if (!dele) continue;
    const limpo: Partial<Record<ChaveClausula, string>> = {};
    for (const c of clausulasDoCodigo(modelo)) {
      const t = dele[c.chave];
      if (t && t.trim() && t.trim() !== c.padrao.trim()) limpo[c.chave] = t;
    }
    if (Object.keys(limpo).length) saida[modelo] = limpo;
  }
  return saida;
}

export function ContratosModelosCard() {
  const pode = useAuth((s) => s.pode);
  const [salvo, setSalvo] = useState<ClausulasDaCasa | null>(null);
  const [rascunho, setRascunho] = useState<ClausulasDaCasa>({});
  const [modelo, setModelo] = useState<ModeloContrato>("Corporativo");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void clausulasDaCasa().then((c) => {
      setSalvo(c);
      setRascunho(c);
    });
  }, []);

  const clausulas = useMemo(() => clausulasDoCodigo(modelo), [modelo]);
  const sujo = salvo !== null && JSON.stringify(soDiferencas(rascunho)) !== JSON.stringify(soDiferencas(salvo));

  // Sair da aba (ou fechar a janela) com texto digitado e não salvo pede confirmação.
  useUnsavedGuard(sujo);

  if (!pode("contratos.clausulas")) {
    return (
      <Card>
        <CardTitle>Contratos</CardTitle>
        <p className="text-sm text-ink-2">Só o Administrador e a Direção de Produção editam as cláusulas padrão dos contratos.</p>
      </Card>
    );
  }
  if (salvo === null) return <CarregandoTela />;

  const valor = (chave: ChaveClausula, padrao: string) => rascunho[modelo]?.[chave] ?? padrao;
  const editar = (chave: ChaveClausula, texto: string) =>
    setRascunho((r) => ({ ...r, [modelo]: { ...(r[modelo] ?? {}), [chave]: texto } }));
  const voltar = (chave: ChaveClausula) =>
    setRascunho((r) => {
      const { [chave]: _fora, ...resto } = r[modelo] ?? {};
      return { ...r, [modelo]: resto };
    });

  async function gravar() {
    setSalvando(true);
    try {
      const final = soDiferencas(rascunho);
      await gravarClausulasDaCasa(final);
      setSalvo(final);
      setRascunho(final);
      toast("Cláusulas padrão dos contratos salvas.", "success");
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`, "danger");
    } finally {
      setSalvando(false);
    }
  }

  async function descartar() {
    if (!(await confirmar({ titulo: "Descartar as alterações?", mensagem: "O que foi digitado e não salvo será perdido.", confirmarTexto: "Descartar" }))) return;
    setRascunho(salvo ?? {});
  }

  return (
    <Card>
      <CardTitle hint="O texto padrão de cada cláusula. Vale para os contratos gerados daqui em diante; contrato já emitido não muda">
        Contratos — cláusulas padrão
      </CardTitle>

      <div className="mb-3">
        <SubGuias
          variante="secundaria"
          rotulo="Modelo de contrato"
          atual={modelo}
          onChange={setModelo}
          abas={MODELOS_CONTRATO.map((m) => ({ key: m, label: ROTULO_MODELO[m] }))}
        />
      </div>

      <div className="rounded-btn bg-info-soft text-info px-3 py-2 text-[12.5px] mb-4 space-y-1">
        <p>
          Para pôr um trecho em <b>negrito</b> no contrato, escreva-o entre dois asteriscos: <b>**assim**</b>. CONTRATANTE e CONTRATADO(A) já saem em negrito sozinhos.
          Uma linha em branco separa os blocos; cada linha seguinte vira um item.
        </p>
        <p>
          Partes, descritivo do objeto, valores, assinaturas e testemunhas são montados com os dados de cada OS e não se editam aqui.
          Se um texto citar outra cláusula (por exemplo, "Cláusula Quinta"), confira a numeração.
        </p>
      </div>

      <div className="space-y-5">
        {clausulas.map((c) => {
          const atual = valor(c.chave, c.padrao);
          const mudou = atual.trim() !== c.padrao.trim();
          return (
            <div key={c.chave}>
              <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                <Label>
                  {c.titulo}
                  {mudou && <Badge tom="warning" className="ml-2">Alterada</Badge>}
                </Label>
                {mudou && (
                  <button
                    type="button"
                    onClick={() => voltar(c.chave)}
                    className="text-[11.5px] font-bold text-ink-3 hover:text-primary-dark input-focus rounded px-1"
                  >
                    Voltar ao texto original
                  </button>
                )}
              </div>
              <AutoTextarea className="min-h-[92px]" value={atual} onChange={(e) => editar(c.chave, e.target.value)} />
              {c.chave === "objeto" && (
                <p className="text-[11.5px] text-ink-3 mt-1">Esta é só a abertura da cláusula; o descritivo e os valores logo abaixo dela vêm da OS.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Button size="sm" onClick={() => void gravar()} disabled={salvando || !sujo}>
          {salvando ? "Salvando…" : "Salvar cláusulas"}
        </Button>
        {sujo && <Button size="sm" variant="secondary" onClick={() => void descartar()} disabled={salvando}>Descartar alterações</Button>}
        {sujo && <span className="text-[12px] text-warning font-semibold">Há alterações não salvas (em qualquer um dos dois modelos).</span>}
      </div>
    </Card>
  );
}
