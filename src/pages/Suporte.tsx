/**
 * HELP DESK — abrir chamado, acompanhar e responder, tudo dentro do sistema.
 *
 * Pedir ajuda era uma mensagem solta no WhatsApp de alguém, e chegava sem o que
 * importa: em que tela a pessoa estava, o que ela tentou fazer, qual navegador.
 * A primeira resposta do suporte era sempre a mesma pergunta.
 *
 * Depois virou e-mail — melhor, mas o chamado saía do aplicativo e sumia. Quem
 * abriu não sabia se tinha sido lido; quem atende respondia do seu cliente de
 * e-mail, e a resposta não existia em lugar nenhum do sistema. "Quantos
 * chamados estão abertos?" não tinha resposta.
 *
 * Agora o chamado é um REGISTRO com a conversa junto (tabela `chamados`). O
 * e-mail continua saindo — é ele que avisa —, mas deixou de ser o lugar onde a
 * informação mora.
 *
 * DUAS LEITURAS da mesma tela:
 *  · quem usa o sistema vê "Meus chamados" e responde ao suporte;
 *  · quem ATENDE (papel Admin, ver `e_suporte`) ganha a fila inteira, com filtro
 *    por situação, e responde de dentro daqui.
 *
 * ESTE É O ÚNICO E-MAIL QUE SAI DE VERDADE enquanto o app está em homologação.
 * A trava existe para proteger fornecedor e cliente de receberem algo que ainda
 * não vale; aqui a mensagem vai da Pólobh para a Pólobh. Quem carrega a exceção
 * é a marca `interna` — ver `lib/email/seguranca.ts` e os testes que garantem
 * que nenhum outro template a use.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { SubGuias } from "@/components/layout/SubGuias";
import {
  Badge, Button, Card, CardTitle, EmptyState, Field, Input, Select, Textarea, AvisoErro, type Tom,
} from "@/components/ui";
import { IcSend, IcCheck, IcChevron } from "@/components/icons";
import { enviarChamado, enviarRespostaChamado, resumoDoEnvio, type TipoChamado } from "@/lib/email";
import { origemDoApp } from "@/lib/links";
import { repo } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/store/auth";
import { useConfigApp } from "@/store/configApp";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import { telaAnterior } from "@/lib/telaAnterior";
import { cx, dataHoraBR } from "@/lib/format";
import type { Chamado, StatusChamado } from "@/data/types";

const TIPOS: TipoChamado[] = ["Erro no sistema", "Dúvida de uso", "Sugestão de melhoria", "Acesso e permissões"];

/**
 * A cor de cada situação diz DE QUEM É A VEZ, e não "bom/ruim":
 * aberto cobra o suporte, respondido cobra quem abriu, resolvido não cobra
 * ninguém.
 */
const TOM_STATUS: Record<StatusChamado, Tom> = {
  Aberto: "warning",
  Respondido: "info",
  Resolvido: "success",
};

/** Navegador e tamanho de tela: metade dos "não funciona aqui" mora nisso. */
function ambienteAtual(): string {
  if (typeof window === "undefined") return "—";
  return `${navigator.userAgent} · ${window.innerWidth}×${window.innerHeight}`;
}

type Aba = "novo" | "meus" | "fila";

export function Suporte() {
  const usuario = useAuth((s) => s.usuario);
  const { helpdesk, carregar } = useConfigApp();

  useEffect(() => { carregar(); }, [carregar]);

  /**
   * Quem atende? Perguntamos ao BANCO, e não ao papel guardado na sessão: é o
   * banco que decide o que a pessoa consegue ler e responder (RLS), e a tela
   * precisa mostrar exatamente aquilo — nunca um botão que vai dar erro.
   */
  const { data: souSuporte } = useAsync(() => repo.chamados.souSuporte(), []);
  const { data: chamados, reload, error } = useAsync(() => repo.chamados.listar(), []);

  const [aba, setAba] = useState<Aba>("novo");
  const meusChamados = useMemo(
    () => (chamados ?? []).filter((c) => c.autorEmail === usuario?.email || c.abertoPor === usuario?.id),
    [chamados, usuario]
  );
  /** A fila do suporte: tudo o que não é meu entra aqui, junto com o que é. */
  const fila = chamados ?? [];

  // Quem atende cai direto na fila; quem usa, no formulário. É o que cada um
  // vem fazer.
  useEffect(() => {
    if (souSuporte) setAba("fila");
  }, [souSuporte]);

  const abertos = fila.filter((c) => c.status === "Aberto").length;
  const meusEmAberto = meusChamados.filter((c) => c.status !== "Resolvido").length;

  // O subtítulo segue a ABA, e não o papel: quem atende passa o dia na fila, mas
  // quando abre um chamado está fazendo outra coisa, e a tela precisa dizer qual.
  return (
    <PageShell
      title="Help Desk"
      subtitle={
        aba === "fila"
          ? "A fila de chamados do sistema. Responda aqui — quem abriu recebe um e-mail e continua a conversa nesta tela."
          : aba === "meus"
            ? "Os chamados que você abriu, com a resposta do suporte. Clique num deles para ler e responder."
            : "Abra um chamado e acompanhe a resposta por aqui. A tela e o navegador vão junto — você não precisa descrevê-los."
      }
      subabas={
        <SubGuias
          rotulo="Seções do Help Desk"
          atual={aba}
          onChange={(a) => setAba(a as Aba)}
          abas={[
            { key: "novo", label: "Novo chamado" },
            { key: "meus", label: "Meus chamados", pendencias: meusEmAberto },
            ...(souSuporte ? ([{ key: "fila", label: "Fila do suporte", pendencias: abertos }] as const) : []),
          ]}
        />
      }
    >
      {error && <AvisoErro erro={error} oQue="os chamados" onTentarDeNovo={reload} />}

      {aba === "novo" && (
        <NovoChamado
          emailSuporte={helpdesk.email}
          onAberto={() => {
            reload();
            setAba("meus");
          }}
        />
      )}

      {aba === "meus" && (
        <ListaChamados
          chamados={meusChamados}
          souSuporte={!!souSuporte}
          vazio="Você ainda não abriu nenhum chamado."
          onMudou={reload}
        />
      )}

      {aba === "fila" && souSuporte && (
        <FilaDoSuporte chamados={fila} onMudou={reload} />
      )}
    </PageShell>
  );
}

/* ------------------------------ novo chamado ----------------------------- */

function NovoChamado({ emailSuporte, onAberto }: { emailSuporte: string; onAberto: () => void }) {
  const usuario = useAuth((s) => s.usuario);
  const { pathname } = useLocation();
  const [tipo, setTipo] = useState<TipoChamado>("Erro no sistema");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tela, setTela] = useState("");
  const [enviando, setEnviando] = useState(false);

  // A tela de origem é lida na entrada: se a pessoa navegar por aqui dentro, o
  // chamado continua falando de onde ela veio.
  useEffect(() => { setTela(telaAnterior() || pathname); }, [pathname]);

  const podeEnviar = assunto.trim().length > 2 && descricao.trim().length > 9 && !enviando;

  async function enviar() {
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      const dados = {
        tipo,
        assunto: assunto.trim(),
        descricao: descricao.trim(),
        tela: tela || "—",
        autorNome: usuario?.nome ?? "—",
        autorEmail: usuario?.email ?? "",
        ambiente: ambienteAtual(),
      };
      // GRAVA primeiro, avisa depois. O chamado precisa existir mesmo que o
      // e-mail falhe — era esse o problema de quando ele era só e-mail.
      await repo.chamados.abrir(dados);
      const r = await enviarChamado({ ...dados, tipo }, emailSuporte);
      toast(
        r.ok
          ? "Chamado aberto. O suporte foi avisado por e-mail."
          : `Chamado aberto, mas o aviso por e-mail não saiu: ${r.motivo ?? "falha no envio"}.`,
        r.ok ? "success" : "warning"
      );
      setAssunto("");
      setDescricao("");
      onAberto();
    } catch (e) {
      toast(`Não foi possível abrir o chamado: ${(e as Error).message}`, "danger");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
      <Card>
        <CardTitle hint="Quanto mais concreto o relato, menos idas e vindas. Diga o que você fez, o que esperava e o que aconteceu.">
          Novo chamado
        </CardTitle>
        <div className="space-y-4">
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoChamado)}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Assunto">
            <Input
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex.: A OS não salva quando o fornecedor é MEI"
              maxLength={120}
            />
          </Field>
          <Field label="O que aconteceu">
            <Textarea
              rows={8}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={"O que você estava fazendo:\nO que esperava que acontecesse:\nO que aconteceu:"}
            />
          </Field>
          <Field label="Tela" hint="(preenchida pelo sistema — corrija se veio de outro lugar)">
            <Input value={tela} onChange={(e) => setTela(e.target.value)} />
          </Field>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12.5px] text-ink-3">
              Fica registrado aqui e avisa <b className="text-ink-2">{emailSuporte}</b> por e-mail. A resposta aparece
              em <b className="text-ink-2">Meus chamados</b>.
            </p>
            <Button icon={<IcSend width={15} height={15} />} onClick={enviar} disabled={!podeEnviar}>
              {enviando ? "Abrindo…" : "Abrir chamado"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle hint="O que costuma resolver antes de abrir chamado.">Antes de abrir</CardTitle>
        <ul className="space-y-2.5 text-[13px] text-ink-2 list-disc pl-4">
          <li>
            O <b className="text-ink">Guia do Aplicativo</b> descreve cada bloco de cada tela, campo a campo, e diz o
            que o sistema preenche sozinho.
          </li>
          <li>
            Campo que não salva costuma ter uma <b className="text-ink">pendência travando</b> — o aviso leva até ele
            quando você clica.
          </li>
          <li>
            Valor que não aparece pode ser <b className="text-ink">permissão</b>: os blocos financeiros são restritos
            a Direção, Administrativo e Administrador.
          </li>
          <li>
            E-mail de <b className="text-ink">fornecedor ou cliente</b> ainda não sai de verdade: o sistema está em
            homologação e desvia tudo para a caixa de teste. O chamado daqui é a exceção.
          </li>
        </ul>
      </Card>
    </div>
  );
}

/* -------------------------------- a fila --------------------------------- */

const SITUACOES: (StatusChamado | "Todos")[] = ["Aberto", "Respondido", "Resolvido", "Todos"];

function FilaDoSuporte({ chamados, onMudou }: { chamados: Chamado[]; onMudou: () => void }) {
  // Abre em "Aberto": a fila do suporte é o que está esperando por ele.
  const [situacao, setSituacao] = useState<StatusChamado | "Todos">("Aberto");
  const visiveis = situacao === "Todos" ? chamados : chamados.filter((c) => c.status === situacao);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {SITUACOES.map((s) => {
          const n = s === "Todos" ? chamados.length : chamados.filter((c) => c.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSituacao(s)}
              className={cx(
                "h-9 px-3.5 rounded-btn text-[13px] font-bold border-[1.5px] transition-colors",
                situacao === s
                  ? "bg-primary-soft border-active-border text-primary-dark"
                  : "bg-surface border-[#D6D9E0] text-ink-2 hover:text-ink"
              )}
            >
              {s} <span className="tabular-nums text-ink-3">({n})</span>
            </button>
          );
        })}
      </div>
      <ListaChamados
        chamados={visiveis}
        souSuporte
        vazio={situacao === "Aberto" ? "Nenhum chamado esperando resposta." : "Nada nesta situação."}
        onMudou={onMudou}
      />
    </div>
  );
}

/* ------------------------------- a lista --------------------------------- */

function ListaChamados({
  chamados,
  souSuporte,
  vazio,
  onMudou,
}: {
  chamados: Chamado[];
  souSuporte: boolean;
  vazio: string;
  onMudou: () => void;
}) {
  /** Um aberto por vez: a conversa é longa, e duas abertas viram um muro. */
  const [aberto, setAberto] = useState("");

  if (!chamados.length) {
    return <Card><EmptyState title={vazio} hint="Chamados abertos por aqui aparecem nesta lista." /></Card>;
  }

  return (
    <div className="space-y-2">
      {chamados.map((c) => (
        <CartaoChamado
          key={c.id}
          chamado={c}
          souSuporte={souSuporte}
          aberto={aberto === c.id}
          onAlternar={() => setAberto((a) => (a === c.id ? "" : c.id))}
          onMudou={onMudou}
        />
      ))}
    </div>
  );
}

function CartaoChamado({
  chamado,
  souSuporte,
  aberto,
  onAlternar,
  onMudou,
}: {
  chamado: Chamado;
  souSuporte: boolean;
  aberto: boolean;
  onAlternar: () => void;
  onMudou: () => void;
}) {
  const [resposta, setResposta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const resolvido = chamado.status === "Resolvido";

  const responder = useCallback(async () => {
    const texto = resposta.trim();
    if (!texto) return;
    setOcupado(true);
    try {
      await repo.chamados.responder(chamado.id, texto);
      setResposta("");
      // O e-mail só sai quando quem responde é o SUPORTE: avisar a si mesmo de
      // que respondeu não serve para nada, e o suporte já está olhando a fila.
      if (souSuporte && chamado.autorEmail) {
        const r = await enviarRespostaChamado({
          assuntoChamado: chamado.assunto,
          texto,
          deNome: "O suporte",
          paraNome: chamado.autorNome,
          paraEmail: chamado.autorEmail,
          urlApp: origemDoApp(),
        });
        toast(
          r.ok ? `Resposta enviada e ${chamado.autorNome || "quem abriu"} foi avisado por e-mail.` : resumoDoEnvio(r),
          r.ok ? "success" : "warning"
        );
      } else {
        toast("Resposta registrada no chamado.", "success");
      }
      onMudou();
    } catch (e) {
      toast(`Não foi possível responder: ${(e as Error).message}`, "danger");
    } finally {
      setOcupado(false);
    }
  }, [resposta, chamado, souSuporte, onMudou]);

  async function encerrar() {
    if (
      !resolvido &&
      !(await confirmar({
        titulo: "Marcar este chamado como resolvido?",
        mensagem: "Ele sai da fila. Quem abriu pode reabrir a qualquer momento, é só responder de novo.",
        confirmarTexto: "Marcar como resolvido",
      }))
    )
      return;
    setOcupado(true);
    try {
      await repo.chamados.encerrar(chamado.id, !resolvido);
      onMudou();
    } catch (e) {
      toast(`Não foi possível mudar a situação: ${(e as Error).message}`, "danger");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card padded={false} className={cx(resolvido && "opacity-75")}>
      {/* O cabeçalho é o resumo: assunto, quem abriu, quando, e de quem é a vez. */}
      <button
        type="button"
        onClick={onAlternar}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[#FCFCFD] transition-colors"
      >
        <IcChevron
          width={16}
          height={16}
          className={cx("mt-1 shrink-0 text-ink-3 transition-transform", aberto && "rotate-90")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cx("text-[14px] font-bold text-ink", resolvido && "line-through text-ink-3")}>
              {chamado.assunto}
            </span>
            <Badge tom={TOM_STATUS[chamado.status]}>{chamado.status}</Badge>
            <Badge tom="neutral">{chamado.tipo}</Badge>
          </div>
          <div className="mt-0.5 text-[12px] text-ink-3">
            {souSuporte && <b className="text-ink-2">{chamado.autorNome || chamado.autorEmail} · </b>}
            {dataHoraBR(chamado.criadoEm)}
            {chamado.mensagens.length > 0 &&
              ` · ${chamado.mensagens.length} ${chamado.mensagens.length === 1 ? "resposta" : "respostas"}`}
          </div>
        </div>
      </button>

      {aberto && (
        <div className="px-4 pb-4 border-t border-border-soft pt-3 space-y-3">
          {/* O relato original, e o que o sistema soube dizer sozinho. */}
          <div className="rounded-btn bg-[#FAFAFB] border border-border-soft px-3 py-2.5">
            <p className="text-[13px] text-ink whitespace-pre-line">{chamado.descricao}</p>
            <p className="mt-2 text-[11.5px] text-ink-3">
              Tela: <b>{chamado.tela || "—"}</b>
              {souSuporte && chamado.ambiente ? ` · ${chamado.ambiente}` : ""}
            </p>
          </div>

          {/* A conversa. O lado de quem fala diz de quem é a fala. */}
          {chamado.mensagens.map((m) => (
            <div key={m.id} className={cx("flex", m.suporte ? "justify-start" : "justify-end")}>
              <div
                className={cx(
                  "max-w-[85%] rounded-card px-3 py-2",
                  m.suporte ? "bg-primary-soft" : "bg-[#F1F2F5]"
                )}
              >
                <div className="text-[11px] font-bold text-ink-2">
                  {m.suporte ? `${m.autorNome || "Suporte"} · suporte` : m.autorNome || "—"}
                  <span className="font-semibold text-ink-3"> · {dataHoraBR(m.criadoEm)}</span>
                </div>
                <p className="text-[13px] text-ink whitespace-pre-line mt-0.5">{m.texto}</p>
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <Textarea
              rows={3}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder={souSuporte ? "Responda a quem abriu o chamado…" : "Escreva para o suporte…"}
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button
                variant="text"
                size="sm"
                icon={<IcCheck width={15} height={15} />}
                onClick={encerrar}
                disabled={ocupado}
              >
                {resolvido ? "Reabrir chamado" : "Marcar como resolvido"}
              </Button>
              <Button
                size="sm"
                icon={<IcSend width={15} height={15} />}
                onClick={responder}
                disabled={ocupado || !resposta.trim()}
              >
                {ocupado ? "Enviando…" : "Responder"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
