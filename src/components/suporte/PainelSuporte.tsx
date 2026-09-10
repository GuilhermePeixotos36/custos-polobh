/**
 * HELP DESK — um painel POR CIMA da tela, não uma tela.
 *
 * Quem pede ajuda está no meio de outra coisa: montando uma OS com o cliente
 * esperando, conferindo uma EC, tentando entender por que um valor não bate.
 * Mandar essa pessoa para uma página de suporte é fazê-la abandonar o trabalho
 * e, pior, perder de vista exatamente aquilo que precisa descrever. Aqui o
 * painel desliza sobre a tela, que continua atrás, inteira; fechar devolve tudo
 * como estava. É a diferença entre "vou abrir um chamado depois" e abrir agora.
 *
 * O PRINT é o coração disto. Metade de um chamado é a imagem — "o botão some",
 * "aparece este erro" — e descrever isso por escrito custa três idas e vindas.
 * O botão fotografa a tela de verdade (ver `lib/captura`), escondendo o painel
 * por um instante para o print mostrar o problema, e não o formulário. Colar
 * (Ctrl+V) e escolher um arquivo fazem o mesmo caminho.
 *
 * O que o painel mostra, na ordem em que se precisa:
 *  · Novo chamado — com a tela de origem e o navegador já preenchidos;
 *  · Meus chamados — o andamento do que a pessoa pediu, e a conversa;
 *  · Fila do suporte — só para quem atende (papel Admin, ver `e_suporte`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, EmptyState, Field, Input, Select, Textarea, type Tom } from "@/components/ui";
import { IcCamera, IcCheck, IcChevron, IcClipe, IcFechar, IcSend, IcSuporte, IcTrash } from "@/components/icons";
import { repo } from "@/data";
import { useAuth } from "@/store/auth";
import { useConfigApp } from "@/store/configApp";
import { useSuporte, type AbaSuporte } from "@/store/suporte";
import { toast } from "@/store/toast";
import { confirmar } from "@/store/confirm";
import {
  arquivoParaAnexo,
  enviarChamado,
  enviarRespostaChamado,
  resumoDoEnvio,
  type TipoChamado,
} from "@/lib/email";
import { origemDoApp } from "@/lib/links";
import { capturarTela, capturaSuportada, imagensColadas } from "@/lib/captura";
import { ACCEPT_ANEXOS_CHAMADO, MAXIMO_ANEXOS_CHAMADO, motivoRecusaAnexoChamado, tamanhoLegivel } from "@/domain/anexos";
import { destacarCampo, idCampoTrava } from "@/lib/destaque";
import { cx, dataHoraBR } from "@/lib/format";
import type { AnexoObservacao, Chamado, StatusChamado } from "@/data/types";

const TIPOS: TipoChamado[] = ["Erro no sistema", "Dúvida de uso", "Sugestão de melhoria", "Acesso e permissões"];

/**
 * A cor de cada situação diz DE QUEM É A VEZ, e não "bom/ruim": aberto cobra o
 * suporte, respondido cobra quem abriu, resolvido não cobra ninguém.
 */
const TOM_STATUS: Record<StatusChamado, Tom> = {
  Aberto: "warning",
  Respondido: "info",
  Resolvido: "success",
};

/** Âncoras dos campos, para o aviso poder levar a pessoa até eles. */
const CAMPO_ASSUNTO = idCampoTrava("chamado-assunto");
const CAMPO_DESCRICAO = idCampoTrava("chamado-descricao");

/** Navegador e tamanho de tela: metade dos "não funciona aqui" mora nisso. */
function ambienteAtual(): string {
  if (typeof window === "undefined") return "—";
  return `${navigator.userAgent} · ${window.innerWidth}×${window.innerHeight}`;
}

/* ========================================================================== */

export function PainelSuporte() {
  const usuario = useAuth((s) => s.usuario);
  const { aberto, aba, telaOrigem, ocultoParaPrint, fechar, irPara } = useSuporte();
  const carregarConfig = useConfigApp((s) => s.carregar);
  const helpdesk = useConfigApp((s) => s.helpdesk);

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [souSuporte, setSouSuporte] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string>("");
  /** Já perguntamos ao banco quem atende? A resposta não muda na sessão. */
  const papelConsultado = useRef(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      setChamados(await repo.chamados.listar());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Nada é buscado enquanto o painel não abre: ele vive montado na casca do
  // aplicativo, e uma consulta por carregamento de tela seria puro desperdício.
  useEffect(() => {
    if (!aberto || !usuario) return;
    void carregarConfig();
    void recarregar();
    if (papelConsultado.current) return;
    papelConsultado.current = true;
    void repo.chamados
      .souSuporte()
      .then((r) => {
        setSouSuporte(r);
        // Quem atende vem ver a fila; quem usa vem pedir ajuda. Só que não
        // atropelamos quem já pediu uma aba: o link do e-mail abre em "Meus
        // chamados", e quem clicou nele quer ver o chamado dele.
        if (r && useSuporte.getState().aba === "novo") useSuporte.getState().irPara("fila");
      })
      .catch(() => setSouSuporte(false));
  }, [aberto, usuario, carregarConfig, recarregar]);

  // Esc fecha, e a rolagem da página trava enquanto o painel está aberto —
  // senão rolar dentro dele arrasta a tela de trás.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, fechar]);

  const meus = useMemo(
    () => chamados.filter((c) => c.abertoPor === usuario?.id || c.autorEmail === usuario?.email),
    [chamados, usuario]
  );
  const meusEmAberto = meus.filter((c) => c.status !== "Resolvido").length;
  const naFila = chamados.filter((c) => c.status === "Aberto").length;

  if (!aberto || !usuario) return null;

  const abas: { key: AbaSuporte; label: string; n?: number }[] = [
    { key: "novo", label: "Pedir ajuda" },
    { key: "meus", label: "Meus chamados", n: meusEmAberto },
    ...(souSuporte ? [{ key: "fila" as const, label: "Fila do suporte", n: naFila }] : []),
  ];

  return (
    <div
      className={cx(
        "no-print fixed inset-0 z-[70] flex justify-end",
        // Escondido, e não desmontado, enquanto o print é tirado: desmontar
        // perderia o texto que a pessoa já escreveu.
        ocultoParaPrint && "opacity-0 pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Help Desk"
    >
      {/* O fundo escurece o que está atrás sem esconder: a pessoa continua vendo
          a tela de que está falando. */}
      <button
        type="button"
        aria-label="Fechar o Help Desk"
        onClick={fechar}
        className="absolute inset-0 bg-[#0B0C0E]/30"
      />

      <aside className="painel-suporte relative h-full w-full sm:w-[540px] bg-bg border-l border-border shadow-2xl flex flex-col">
        <header className="shrink-0 px-4 pt-3 pb-0 bg-surface border-b border-border">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-primary-dark shrink-0">
              <IcSuporte width={20} height={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-bold text-ink leading-tight">Help Desk</h2>
              <p className="text-[12px] text-ink-3 truncate">
                {souSuporte
                  ? "A fila do sistema — responda por aqui."
                  : telaOrigem
                    ? `Você está em ${telaOrigem}`
                    : "Peça ajuda sem sair do que está fazendo."}
              </p>
            </div>
            <button
              type="button"
              onClick={fechar}
              title="Fechar (Esc)"
              className="shrink-0 rounded-btn p-1.5 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink"
            >
              <IcFechar width={18} height={18} />
            </button>
          </div>

          <nav className="flex items-center gap-1 mt-2" aria-label="Seções do Help Desk">
            {abas.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => irPara(a.key)}
                className={cx(
                  "px-2.5 h-8 text-[12.5px] font-bold border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5",
                  aba === a.key
                    ? "border-primary text-primary-dark"
                    : "border-transparent text-ink-2 hover:text-ink"
                )}
              >
                {a.label}
                {!!a.n && (
                  <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-danger text-white text-[10.5px] font-extrabold tabular-nums">
                    {a.n}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {erro && (
            <div className="mb-3 rounded-btn border border-danger bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
              Não foi possível carregar os chamados: {erro}{" "}
              <button type="button" onClick={() => void recarregar()} className="underline font-bold">
                tentar de novo
              </button>
            </div>
          )}

          {aba === "novo" && (
            <NovoChamado
              emailSuporte={helpdesk.email}
              telaOrigem={telaOrigem}
              onAberto={() => {
                void recarregar();
                irPara("meus");
              }}
            />
          )}

          {aba === "meus" && (
            <ListaChamados
              chamados={meus}
              souSuporte={souSuporte}
              carregando={carregando}
              vazio="Você ainda não abriu nenhum chamado."
              dica="O que você pedir aparece aqui, com a resposta do suporte."
              onMudou={recarregar}
            />
          )}

          {aba === "fila" && souSuporte && (
            <FilaDoSuporte chamados={chamados} carregando={carregando} onMudou={recarregar} />
          )}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------ novo chamado ------------------------------ */

function NovoChamado({
  emailSuporte,
  telaOrigem,
  onAberto,
}: {
  emailSuporte: string;
  telaOrigem: string;
  onAberto: () => void;
}) {
  const usuario = useAuth((s) => s.usuario);
  const [tipo, setTipo] = useState<TipoChamado>("Erro no sistema");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tela, setTela] = useState(telaOrigem);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setTela(telaOrigem), [telaOrigem]);

  /**
   * O que ainda falta para o chamado poder ser aberto — e QUAL campo é.
   *
   * O botão não fica mais apagado sem dizer por quê. Um botão desabilitado é
   * uma porta trancada sem aviso: quem escreveu pouco no relato clicava, não
   * acontecia nada, e ia embora achando que tinha pedido ajuda — que é
   * exatamente o oposto do que esta tela existe para fazer. Agora o clique
   * responde: diz o que falta e põe o cursor lá.
   */
  function oQueFalta(): { aviso: string; campo: string } | null {
    if (assunto.trim().length <= 2) {
      return { aviso: "Escreva um assunto — uma frase que diga do que se trata.", campo: CAMPO_ASSUNTO };
    }
    if (descricao.trim().length <= 9) {
      return {
        aviso: "Conte o que aconteceu: o que você fez, o que esperava e o que apareceu.",
        campo: CAMPO_DESCRICAO,
      };
    }
    return null;
  }

  async function enviar() {
    const falta = oQueFalta();
    if (falta) {
      // Mesma régua do resto do sistema: o aviso LEVA até o campo, pisca nele e
      // deixa o cursor lá (`lib/destaque`).
      toast(falta.aviso, "warning");
      destacarCampo(falta.campo);
      return;
    }
    if (enviando) return;
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
      const chamado = await repo.chamados.abrir(dados);

      // Os prints sobem DEPOIS, com o chamado já criado: é dele que sai o
      // caminho no bucket. Se o upload falhar, sobra um chamado sem print —
      // muito melhor do que um print sem chamado.
      let avisoAnexos = "";
      if (arquivos.length) {
        try {
          const fichas = await repo.chamados.subirAnexos(chamado.id, arquivos, dados.autorNome);
          await repo.chamados.anexarAoRelato(chamado.id, fichas);
        } catch (e) {
          avisoAnexos = ` Os arquivos não subiram: ${(e as Error).message}`;
        }
      }

      const anexosEmail = await Promise.all(arquivos.map(arquivoParaAnexo));
      const r = await enviarChamado({ ...dados, tipo }, emailSuporte, anexosEmail);
      toast(
        (r.ok
          ? "Chamado aberto. O suporte foi avisado por e-mail."
          : `Chamado aberto, mas o aviso por e-mail não saiu: ${r.motivo ?? "falha no envio"}.`) + avisoAnexos,
        r.ok && !avisoAnexos ? "success" : "warning"
      );
      setAssunto("");
      setDescricao("");
      setArquivos([]);
      onAberto();
    } catch (e) {
      toast(`Não foi possível abrir o chamado: ${(e as Error).message}`, "danger");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3.5">
      <Field label="Tipo">
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoChamado)}>
          {TIPOS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>

      <div id={CAMPO_ASSUNTO}>
        <Field label="Assunto">
          <Input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex.: A OS não salva quando o fornecedor é MEI"
            maxLength={120}
          />
        </Field>
      </div>

      <div id={CAMPO_DESCRICAO}>
        <Field label="O que aconteceu">
          <Textarea
            rows={6}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={"O que você estava fazendo:\nO que esperava que acontecesse:\nO que aconteceu:"}
          />
        </Field>
      </div>

      <CaixaDeAnexos arquivos={arquivos} onMudar={setArquivos} />

      <Field label="Tela" hint="(preenchida pelo sistema — corrija se o problema foi em outro lugar)">
        <Input value={tela} onChange={(e) => setTela(e.target.value)} />
      </Field>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <p className="text-[11.5px] text-ink-3 flex-1 min-w-[180px]">
          Fica registrado aqui e avisa <b className="text-ink-2">{emailSuporte}</b>. A resposta aparece em{" "}
          <b className="text-ink-2">Meus chamados</b>.
        </p>
        <Button icon={<IcSend width={15} height={15} />} onClick={() => void enviar()} disabled={enviando}>
          {enviando ? "Abrindo…" : "Abrir chamado"}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- anexos ---------------------------------- */

/**
 * Os arquivos que ainda vão subir: print da tela, colado ou escolhido.
 *
 * Os três caminhos param no mesmo lugar de propósito. O botão de print é o mais
 * rápido, mas depende do seletor do navegador (e não existe no iPhone); colar é
 * o que a maioria já faz por hábito; escolher arquivo é o que sempre funciona.
 */
function CaixaDeAnexos({ arquivos, onMudar }: { arquivos: File[]; onMudar: (a: File[]) => void }) {
  const ocultarParaPrint = useSuporte((s) => s.ocultarParaPrint);
  const [capturando, setCapturando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  /** Miniaturas: criadas por arquivo e devolvidas ao navegador no fim. */
  const previas = useMemo(
    () => arquivos.map((a) => ({ arquivo: a, url: a.type.startsWith("image/") ? URL.createObjectURL(a) : "" })),
    [arquivos]
  );
  useEffect(() => () => previas.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previas]);

  const acrescentar = useCallback(
    (novos: File[]) => {
      if (!novos.length) return;
      const aceitos: File[] = [];
      for (const arquivo of novos) {
        const motivo = motivoRecusaAnexoChamado(arquivo, arquivos.length + aceitos.length);
        if (motivo) {
          toast(motivo, "warning");
          break;
        }
        aceitos.push(arquivo);
      }
      if (aceitos.length) onMudar([...arquivos, ...aceitos]);
    },
    [arquivos, onMudar]
  );

  // Colar é como a maioria das pessoas já tira print: PrintScreen, Ctrl+V.
  useEffect(() => {
    const aoColar = (e: ClipboardEvent) => {
      const imagens = imagensColadas(e.clipboardData);
      if (imagens.length) {
        e.preventDefault();
        acrescentar(imagens);
        toast(imagens.length === 1 ? "Print colado." : `${imagens.length} imagens coladas.`, "success");
      }
    };
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [acrescentar]);

  async function tirarPrint() {
    setCapturando(true);
    // O painel some para o print mostrar o PROBLEMA, e não o formulário de
    // chamado por cima dele.
    ocultarParaPrint(true);
    try {
      // Um respiro para o navegador realmente apagar o painel antes do quadro.
      await new Promise((r) => setTimeout(r, 120));
      const arquivo = await capturarTela();
      if (arquivo) acrescentar([arquivo]);
    } catch (e) {
      toast(`Não foi possível capturar a tela: ${(e as Error).message}`, "danger");
    } finally {
      ocultarParaPrint(false);
      setCapturando(false);
    }
  }

  const cheio = arquivos.length >= MAXIMO_ANEXOS_CHAMADO;

  return (
    <div className="rounded-card border border-border-soft bg-surface p-3">
      <div className="flex items-center gap-2 flex-wrap">
        {capturaSuportada() && (
          <Button
            variant="secondary"
            size="sm"
            icon={<IcCamera width={15} height={15} />}
            onClick={() => void tirarPrint()}
            disabled={cheio || capturando}
          >
            {capturando ? "Capturando…" : "Print da tela"}
          </Button>
        )}
        <Button
          variant="text"
          size="sm"
          icon={<IcClipe width={15} height={15} />}
          onClick={() => entrada.current?.click()}
          disabled={cheio}
        >
          Anexar arquivo
        </Button>
        <input
          ref={entrada}
          type="file"
          multiple
          accept={ACCEPT_ANEXOS_CHAMADO}
          className="hidden"
          onChange={(e) => {
            acrescentar(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <span className="ml-auto text-[11px] font-bold text-ink-3">
          {arquivos.length}/{MAXIMO_ANEXOS_CHAMADO}
        </span>
      </div>

      {!arquivos.length && (
        <p className="mt-2 text-[11.5px] text-ink-3">
          O print vale mais que a descrição. O painel some enquanto a foto é tirada — ou cole com <b>Ctrl+V</b>.
        </p>
      )}

      {!!previas.length && (
        <ul className="mt-2.5 flex items-start gap-2 flex-wrap">
          {previas.map(({ arquivo, url }, i) => (
            <li key={`${arquivo.name}-${i}`} className="relative">
              {url ? (
                <img
                  src={url}
                  alt={arquivo.name}
                  className="h-20 w-28 object-cover rounded-btn border border-border-soft bg-[#F1F2F5]"
                />
              ) : (
                <div className="h-20 w-28 rounded-btn border border-border-soft bg-[#F1F2F5] grid place-items-center text-[11px] font-bold text-ink-3 px-2 text-center">
                  {arquivo.name}
                </div>
              )}
              <button
                type="button"
                title="Tirar este arquivo"
                onClick={() => onMudar(arquivos.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 h-6 w-6 grid place-items-center rounded-full bg-surface border border-border shadow-card text-ink-3 hover:text-danger"
              >
                <IcFechar width={13} height={13} />
              </button>
              <span className="block mt-0.5 text-[10px] text-ink-3 w-28 truncate" title={arquivo.name}>
                {tamanhoLegivel(arquivo.size)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Os arquivos JÁ gravados numa mensagem — abrem por link assinado de 60s. */
function AnexosGravados({ anexos }: { anexos?: AnexoObservacao[] }) {
  if (!anexos?.length) return null;

  const abrir = (anexo: AnexoObservacao) => {
    // A aba é aberta AGORA, no clique, e só depois recebe o endereço: dentro da
    // promessa, o navegador trataria como pop-up e bloquearia.
    const janela = window.open("", "_blank", "noopener,noreferrer");
    repo.chamados
      .urlAnexo(anexo.caminho)
      .then((url) => {
        if (janela) janela.location.href = url;
        else window.location.href = url;
      })
      .catch((e) => {
        janela?.close();
        toast(`Não foi possível abrir "${anexo.nome}": ${(e as Error).message}`, "danger");
      });
  };

  return (
    <ul className="mt-1.5 flex items-center gap-1.5 flex-wrap">
      {anexos.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => abrir(a)}
            title={`${a.nome} · ${tamanhoLegivel(a.tamanho)}`}
            className="inline-flex items-center gap-1 max-w-[200px] rounded-pill border border-border-soft bg-surface px-2 h-6 text-[11px] font-bold text-ink-2 hover:text-primary-dark hover:border-primary"
          >
            <IcClipe width={12} height={12} className="shrink-0" />
            <span className="truncate">{a.nome}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- fila ----------------------------------- */

const SITUACOES: (StatusChamado | "Todos")[] = ["Aberto", "Respondido", "Resolvido", "Todos"];

function FilaDoSuporte({
  chamados,
  carregando,
  onMudou,
}: {
  chamados: Chamado[];
  carregando: boolean;
  onMudou: () => void;
}) {
  // Abre em "Aberto": a fila do suporte é o que está esperando por ele.
  const [situacao, setSituacao] = useState<StatusChamado | "Todos">("Aberto");
  const visiveis = situacao === "Todos" ? chamados : chamados.filter((c) => c.status === situacao);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 flex-wrap">
        {SITUACOES.map((s) => {
          const n = s === "Todos" ? chamados.length : chamados.filter((c) => c.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSituacao(s)}
              className={cx(
                "h-8 px-2.5 rounded-pill text-[12px] font-bold border transition-colors",
                situacao === s
                  ? "bg-primary-soft border-primary text-primary-dark"
                  : "bg-surface border-border-soft text-ink-2 hover:text-ink"
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
        carregando={carregando}
        vazio={situacao === "Aberto" ? "Nenhum chamado esperando resposta." : "Nada nesta situação."}
        dica="A fila mostra os chamados de todo mundo."
        onMudou={onMudou}
      />
    </div>
  );
}

/* -------------------------------- a lista --------------------------------- */

function ListaChamados({
  chamados,
  souSuporte,
  carregando,
  vazio,
  dica,
  onMudou,
}: {
  chamados: Chamado[];
  souSuporte: boolean;
  carregando: boolean;
  vazio: string;
  dica: string;
  onMudou: () => void;
}) {
  /** Um aberto por vez: a conversa é longa, e duas abertas viram um muro. */
  const [aberto, setAberto] = useState("");

  if (carregando && !chamados.length) {
    return <p className="text-[13px] text-ink-3 py-6 text-center">Carregando…</p>;
  }
  if (!chamados.length) return <EmptyState title={vazio} hint={dica} />;

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
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const resolvido = chamado.status === "Resolvido";

  async function responder() {
    const texto = resposta.trim();
    // Só o print, sem texto, é uma resposta legítima — e das mais comuns aqui.
    if (!texto && !arquivos.length) return;
    setOcupado(true);
    try {
      const fichas = arquivos.length
        ? await repo.chamados.subirAnexos(chamado.id, arquivos, souSuporte ? "O suporte" : chamado.autorNome)
        : [];
      await repo.chamados.responder(chamado.id, texto, fichas);
      setResposta("");
      setArquivos([]);
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
          anexos: await Promise.all(arquivos.map(arquivoParaAnexo)),
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
  }

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
    <div className={cx("rounded-card border border-border bg-surface overflow-hidden", resolvido && "opacity-75")}>
      {/* O cabeçalho é o resumo: assunto, quem abriu, quando, e de quem é a vez. */}
      <button
        type="button"
        onClick={onAlternar}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-[#FCFCFD] transition-colors"
      >
        <IcChevron
          width={15}
          height={15}
          className={cx("mt-1 shrink-0 text-ink-3 transition-transform", aberto && "rotate-90")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5 flex-wrap">
            <span className={cx("text-[13.5px] font-bold text-ink", resolvido && "line-through text-ink-3")}>
              {chamado.assunto}
            </span>
            <Badge tom={TOM_STATUS[chamado.status]}>{chamado.status}</Badge>
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-3">
            {souSuporte && <b className="text-ink-2">{chamado.autorNome || chamado.autorEmail} · </b>}
            {dataHoraBR(chamado.criadoEm)}
            {chamado.mensagens.length > 0 &&
              ` · ${chamado.mensagens.length} ${chamado.mensagens.length === 1 ? "resposta" : "respostas"}`}
            {chamado.anexos.length > 0 &&
              ` · ${chamado.anexos.length} ${chamado.anexos.length === 1 ? "anexo" : "anexos"}`}
          </div>
        </div>
      </button>

      {aberto && (
        <div className="px-3 pb-3 border-t border-border-soft pt-2.5 space-y-2.5">
          {/* O relato original, e o que o sistema soube dizer sozinho. */}
          <div className="rounded-btn bg-[#FAFAFB] border border-border-soft px-2.5 py-2">
            <p className="text-[12.5px] text-ink whitespace-pre-line">{chamado.descricao}</p>
            <AnexosGravados anexos={chamado.anexos} />
            <p className="mt-1.5 text-[11px] text-ink-3">
              {chamado.tipo} · Tela: <b>{chamado.tela || "—"}</b>
              {souSuporte && chamado.ambiente ? ` · ${chamado.ambiente}` : ""}
            </p>
          </div>

          {/* A conversa. O lado de quem fala diz de quem é a fala. */}
          {chamado.mensagens.map((m) => (
            <div key={m.id} className={cx("flex", m.suporte ? "justify-start" : "justify-end")}>
              <div
                className={cx("max-w-[88%] rounded-card px-2.5 py-2", m.suporte ? "bg-primary-soft" : "bg-[#F1F2F5]")}
              >
                <div className="text-[10.5px] font-bold text-ink-2">
                  {m.suporte ? `${m.autorNome || "Suporte"} · suporte` : m.autorNome || "—"}
                  <span className="font-semibold text-ink-3"> · {dataHoraBR(m.criadoEm)}</span>
                </div>
                {m.texto && <p className="text-[12.5px] text-ink whitespace-pre-line mt-0.5">{m.texto}</p>}
                <AnexosGravados anexos={m.anexos} />
              </div>
            </div>
          ))}

          <Textarea
            rows={3}
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            placeholder={souSuporte ? "Responda a quem abriu o chamado…" : "Escreva para o suporte…"}
          />
          <CaixaDeAnexos arquivos={arquivos} onMudar={setArquivos} />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button
              variant="text"
              size="sm"
              icon={resolvido ? <IcTrash width={14} height={14} /> : <IcCheck width={15} height={15} />}
              onClick={() => void encerrar()}
              disabled={ocupado}
            >
              {resolvido ? "Reabrir chamado" : "Marcar como resolvido"}
            </Button>
            <Button
              size="sm"
              icon={<IcSend width={15} height={15} />}
              onClick={() => void responder()}
              disabled={ocupado || (!resposta.trim() && !arquivos.length)}
            >
              {ocupado ? "Enviando…" : "Responder"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
