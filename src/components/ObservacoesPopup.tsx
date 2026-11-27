import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui";
import { IcComment, IcChevron, IcPencil, IcTrash, IcSend, IcClipe, IcFechar } from "@/components/icons";
import { cx, dataHoraBR } from "@/lib/format";
import { idComentario } from "@/lib/destaque";
import { alvoPendente, aoFocarPendencia, destacarAlvo, destacarComentario, type AlvoPendencia } from "@/lib/focoPendencia";
import { extrairMencoes, regexMencoes } from "@/domain/mencoes";
import {
  ACCEPT_ANEXOS,
  MAXIMO_ANEXOS_POR_COMENTARIO,
  iconeAnexo,
  motivoRecusaAnexo,
  tamanhoLegivel,
} from "@/domain/anexos";
import { destinatariosDaVez, podeConcluirPendencia } from "@/domain/pendencias";
import { useAuth } from "@/store/auth";
import type { AnexoObservacao, Observacao, RespostaObservacao } from "@/data/types";

/**
 * O que a thread precisa para lidar com arquivo. Passada SÓ pelo check-list —
 * sem ela não aparece clipe nenhum, e EC e OS seguem como sempre foram (ver
 * `domain/anexos` para o porquê).
 */
export interface ApiAnexos {
  /** Sobe o arquivo e devolve a ficha dele. Lança com a mensagem pronta se recusar. */
  enviar: (arquivo: File) => Promise<AnexoObservacao>;
  /** Abre o anexo para quem clicou (link assinado, aba nova). */
  abrir: (anexo: AnexoObservacao) => void;
  /** Apaga os arquivos do armazenamento — comentário excluído não deixa lixo. */
  remover: (anexos: AnexoObservacao[]) => void;
}

interface Props {
  observacoes: Observacao[];
  usuarios: string[]; // nomes dos usuários do sistema (para @mencionar / atribuir)
  onChange: (obs: Observacao[]) => void;
  /** Habilita anexos nesta thread. Ausente = thread sem arquivo. */
  anexos?: ApiAnexos;
  /** Ajusta o espaçamento do rodapé ao contêiner que o recebe (ex.: `!px-0`). */
  className?: string;
  /**
   * Id do item dono desta thread (linha da EC, tarefa do check-list, OS). Com
   * ele, o navegador de pendências consegue abrir esta thread e piscar o
   * comentário exato — ver `focoPendencia`.
   */
  ancora?: string;
}

const novoId = () => globalThis.crypto?.randomUUID?.() ?? `obs-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Mesma tolerância a acento e caixa do quadro de pendências. */
const mesmaPessoa = (a: string, b: string) => {
  const chave = (v: string) => v.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return !!a.trim() && !!b.trim() && chave(a) === chave(b);
};

/** Divide o texto em partes normais e menções @Nome destacadas. */
function renderComMencoes(texto: string, usuarios: string[]) {
  const re = regexMencoes(usuarios);
  if (!re) return texto;
  const partes: React.ReactNode[] = [];
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let chave = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    partes.push(
      <span key={chave++} className="font-bold text-primary-dark">
        {m[0]}
      </span>
    );
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/**
 * Feed de observações (comentários) de um item, estilo chat: uma seta à
 * esquerda expande/retrai a lista; o balão só serve para adicionar um
 * comentário novo. Cada um só edita/exclui o próprio comentário.
 */
type ComporState =
  | { modo: "novo" }
  | { modo: "editar"; id: string }
  | { modo: "responder"; id: string }
  | null;

export function ObservacoesThread({ observacoes, usuarios, onChange, className, ancora, anexos }: Props) {
  const usuarioAtual = useAuth((s) => s.usuario);
  const nomeAtual = usuarioAtual?.nome ?? "";
  const [aberto, setAberto] = useState(false);
  const [compor, setCompor] = useState<ComporState>(null);

  /**
   * O navegador de pendências (ou o sininho) saltou para este item: abre a
   * CADEIA INTEIRA de comentários — ela nasce retraída — e faz latejar em
   * vermelho o que a pendência é de fato: o comentário em aberto, ou o campo
   * OS/Contrato quando a pendência é um status a emitir. Sem isto, a pessoa
   * chegava ao item certo e ainda precisava caçar o que fazer ali.
   */
  useEffect(() => {
    if (!ancora) return;
    const atender = (alvo: AlvoPendencia) => {
      setAberto(true);
      // O comentário só existe no DOM depois que a thread abre — o próprio
      // `destacarElemento` reespera alguns quadros por ele.
      if (alvo.observacaoId) destacarComentario(alvo.observacaoId);
    };
    // Salto disparado de OUTRA tela (ex.: a pendência de uma EC clicada a partir
    // do projeto ou do sininho): ele ficou guardado até esta thread existir.
    const guardado = alvoPendente(ancora);
    if (guardado) {
      destacarAlvo(guardado);
      atender(guardado);
    }
    return aoFocarPendencia((alvo) => {
      if (alvo.ancora !== ancora) return false;
      atender(alvo);
      return true;
    });
  }, [ancora]);

  const validas = observacoes.filter((o) => o.texto.trim());
  const n = validas.length;
  const abertas = validas.filter((o) => !o.resolvida).length;

  /**
   * Quem recebe a pendência é quem foi @marcado no texto (26/11/2026). O campo
   * "Responsável" saiu: eram dois jeitos de endereçar a mesma observação, e a
   * pessoa marcada na lista não aparecia no texto. `responsavelNome` continua
   * sendo lido nas observações antigas (ver `destinatariosDaVez`).
   */
  const adicionar = (texto: string, arquivos: AnexoObservacao[] = []) => {
    const nova: Observacao = {
      id: novoId(),
      texto,
      autorId: usuarioAtual?.id ?? "",
      autorNome: usuarioAtual?.nome ?? "Você",
      criadoEm: new Date().toISOString(),
      responsavelNome: "",
      resolvida: false,
      respostas: [],
      ...(arquivos.length ? { anexos: arquivos } : {}),
    };
    onChange([...observacoes, nova]);
    setAberto(true);
    setCompor(null);
  };

  /** Editar também aceita arquivo novo — o "esqueci de anexar" é frequente. */
  const editar = (id: string, texto: string, arquivos: AnexoObservacao[] = []) => {
    onChange(
      observacoes.map((o) =>
        o.id === id ? { ...o, texto, anexos: [...(o.anexos ?? []), ...arquivos] } : o
      )
    );
    setCompor(null);
  };

  const responder = (id: string, texto: string, arquivos: AnexoObservacao[] = []) => {
    const resp: RespostaObservacao = {
      id: novoId(),
      texto,
      autorId: usuarioAtual?.id ?? "",
      autorNome: usuarioAtual?.nome ?? "Você",
      criadoEm: new Date().toISOString(),
      ...(arquivos.length ? { anexos: arquivos } : {}),
    };
    onChange(observacoes.map((o) => (o.id === id ? { ...o, respostas: [...(o.respostas ?? []), resp] } : o)));
    setCompor(null);
  };

  /** Marca como resolvida — sem opção de reabrir (decisão do fluxo). O texto pode ser editado pelo autor. */
  const resolver = (id: string) => {
    const alvo = observacoes.find((o) => o.id === id);
    if (!alvo || !podeConcluirPendencia(alvo, usuarioAtual)) return;
    onChange(
      observacoes.map((o) =>
        o.id === id
          ? { ...o, resolvida: true, resolvidoPorNome: nomeAtual, resolvidoEm: new Date().toISOString() }
          : o
      )
    );
  };

  const excluir = (id: string) => {
    // Comentário que some leva os arquivos junto — senão o armazenamento vira
    // depósito de anexo órfão, que ninguém mais alcança para apagar.
    const alvo = observacoes.find((o) => o.id === id);
    const doComentario = [...(alvo?.anexos ?? []), ...(alvo?.respostas ?? []).flatMap((r) => r.anexos ?? [])];
    if (doComentario.length) anexos?.remover(doComentario);
    onChange(observacoes.filter((o) => o.id !== id));
  };

  /** Tira um anexo do comentário — só o autor, e o arquivo é apagado de fato. */
  const removerAnexo = (observacaoId: string, anexo: AnexoObservacao) => {
    anexos?.remover([anexo]);
    onChange(
      observacoes.map((o) =>
        o.id === observacaoId ? { ...o, anexos: (o.anexos ?? []).filter((a) => a.id !== anexo.id) } : o
      )
    );
  };

  const emEdicao = compor?.modo === "editar" ? observacoes.find((o) => o.id === compor.id) : undefined;

  return (
    // Sem observação, o rodapé encolhe: antes uma faixa inteira era gasta só para
    // dizer "Nenhuma observação" ao lado de um botão grande na outra ponta.
    <div className={cx("border-t border-border-soft px-3", n > 0 ? "py-2.5" : "py-2", className)}>
      <div className="flex items-center gap-2">
        {n > 0 && (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="shrink-0 text-ink-2 hover:text-ink"
            title={aberto ? "Retrair observações" : "Expandir observações"}
            aria-label={aberto ? "Retrair observações" : "Expandir observações"}
          >
            <IcChevron width={16} height={16} className={cx("transition-transform duration-200", aberto && "rotate-90")} />
          </button>
        )}
        {n > 0 ? (
          <>
            <span className={cx("text-[12px] font-semibold", abertas > 0 ? "text-danger" : "text-ink-3")}>
              {n} observaç{n > 1 ? "ões" : "ão"}
              {abertas > 0 ? ` · ${abertas} aberta${abertas > 1 ? "s" : ""}` : " · resolvidas"}
            </span>
            <button
              type="button"
              onClick={() => { setCompor({ modo: "novo" }); setAberto(true); }}
              className="ml-auto inline-flex items-center gap-1.5 h-8 px-2.5 rounded-btn border-[1.5px] border-[#D6D9E0] bg-surface text-[12px] font-bold text-ink-2 hover:text-ink hover:border-primary/50 input-focus"
              title="Adicionar Observação"
            >
              <IcComment width={14} height={14} className="text-primary" /> Observações
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { setCompor({ modo: "novo" }); setAberto(true); }}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-2 hover:text-primary-dark input-focus rounded"
            title="Adicionar Observação"
          >
            <IcComment width={15} height={15} className="text-primary" /> Adicionar Observação
          </button>
        )}
      </div>

      {aberto && n > 0 && (
        <div className="mt-3 divide-y divide-border-soft">
          {validas.map((o) => (
            <ComentarioLinha
              key={o.id}
              o={o}
              usuarios={usuarios}
              vez={destinatariosDaVez(o, usuarios)}
              nomeAtual={nomeAtual}
              anexos={anexos}
              onRemoverAnexo={(a) => removerAnexo(o.id, a)}
              souAutor={!!usuarioAtual && o.autorId === usuarioAtual.id}
              // Só quem abriu a observação conclui — e, além dela, a Coordenação
              // e a Direção (ver `podeConcluirPendencia`).
              podeResolver={podeConcluirPendencia(o, usuarioAtual)}
              respondendo={compor?.modo === "responder" && compor.id === o.id}
              onResponder={() => setCompor({ modo: "responder", id: o.id })}
              onEditar={() => setCompor({ modo: "editar", id: o.id })}
              onExcluir={() => excluir(o.id)}
              onResolver={() => resolver(o.id)}
              composer={
                compor?.modo === "responder" && compor.id === o.id ? (
                  <Composer
                    key={`resp-${o.id}`}
                    valorInicial=""
                    usuarios={usuarios}
                    rotuloEnviar="Responder"
                    anexos={anexos}
                    onEnviar={(texto, arquivos) => responder(o.id, texto, arquivos)}
                    onCancelar={() => setCompor(null)}
                  />
                ) : null
              }
            />
          ))}
        </div>
      )}

      {(compor?.modo === "novo" || compor?.modo === "editar") && (
        <Composer
          key={compor.modo === "editar" ? compor.id : "novo"}
          valorInicial={emEdicao?.texto ?? ""}
          usuarios={usuarios}
          avisaQuemRecebe={compor.modo === "novo"}
          rotuloEnviar={compor.modo === "editar" ? "Salvar" : "Enviar"}
          anexos={anexos}
          onEnviar={(texto, arquivos) =>
            compor.modo === "editar" ? editar(compor.id, texto, arquivos) : adicionar(texto, arquivos)
          }
          onCancelar={() => setCompor(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------- Linha do comentário --------------------------- */

function ComentarioLinha({
  o,
  usuarios,
  souAutor,
  podeResolver,
  vez,
  nomeAtual,
  anexos,
  onRemoverAnexo,
  respondendo,
  onResponder,
  onEditar,
  onExcluir,
  onResolver,
  composer,
}: {
  o: Observacao;
  usuarios: string[];
  souAutor: boolean;
  podeResolver: boolean;
  respondendo: boolean;
  onResponder: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onResolver: () => void;
  composer: React.ReactNode;
  /** De quem é a vez agora (ver `destinatariosDaVez`). */
  vez: string[];
  nomeAtual: string;
  anexos?: ApiAnexos;
  onRemoverAnexo: (anexo: AnexoObservacao) => void;
}) {
  const respostas = o.respostas ?? [];
  const minhaVez = vez.some((n) => mesmaPessoa(n, nomeAtual));
  return (
    // DESENHO DE CHAT (26/11/2026): avatar, nome e hora numa linha, o texto
    // embaixo, as respostas penduradas num fio à esquerda. Sem caixa em volta
    // de cada observação — quem separa uma da outra é um fio e o respiro.
    <div id={idComentario(o.id)} className={cx("group flex gap-2.5 py-3 first:pt-0 last:pb-1", o.resolvida && "opacity-70")}>
      <Avatar nome={o.autorNome || "Usuário"} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex min-h-[28px] items-center gap-x-2 gap-y-0.5 flex-wrap">
          <span className="text-[13px] font-bold text-ink">{o.autorNome || "Usuário"}</span>
          <span className="text-[11px] text-ink-3 tabular-nums">{dataHoraBR(o.criadoEm)}</span>
          {/* De quem é a bola agora. Cada resposta passa adiante; só "Resolver" encerra. */}
          {o.resolvida ? (
            <Etiqueta tom="success">Resolvida{o.resolvidoPorNome ? ` por ${o.resolvidoPorNome}` : ""}</Etiqueta>
          ) : vez.length > 0 ? (
            minhaVez ? <Etiqueta tom="danger">Sua vez</Etiqueta> : <Etiqueta>Aguardando {vez.join(", ")}</Etiqueta>
          ) : null}
          <span className="acoes-observacao ml-auto flex items-center gap-0.5 transition-opacity focus-within:opacity-100">
            <AcaoTexto onClick={onResponder} title="Responder">Responder</AcaoTexto>
            {podeResolver && (
              <AcaoTexto
                onClick={onResolver}
                className="hover:!text-success"
                title="Concluir a pendência (não pode ser reaberta). Só quem abriu a observação, a Coordenação e a Direção concluem."
              >
                Resolver
              </AcaoTexto>
            )}
            {souAutor && (
              <button type="button" onClick={onEditar} className="rounded p-1 text-ink-3 hover:bg-[#F1F2F5] hover:text-ink" title="Editar observação" aria-label="Editar observação">
                <IcPencil width={14} height={14} />
              </button>
            )}
            {souAutor && (
              <button type="button" onClick={onExcluir} className="rounded p-1 text-ink-3 hover:bg-danger-soft hover:text-danger" title="Excluir observação" aria-label="Excluir observação">
                <IcTrash width={14} height={14} />
              </button>
            )}
          </span>
        </div>
        <p className={cx("text-[13px] whitespace-pre-wrap leading-relaxed", o.resolvida ? "text-ink-3" : "text-ink")}>
          {renderComMencoes(o.texto, usuarios)}
        </p>
        {/* Observação antiga, endereçada pelo campo "Responsável" que não existe mais. */}
        {o.responsavelNome && <p className="mt-0.5 text-[11.5px] font-semibold text-ink-3">Para {o.responsavelNome}</p>}

        {anexos && (o.anexos ?? []).length > 0 && (
          <ListaAnexos
            itens={o.anexos!}
            onAbrir={anexos.abrir}
            onRemover={souAutor && !o.resolvida ? onRemoverAnexo : undefined}
          />
        )}

        {respostas.length > 0 && (
          <div className="mt-2.5 space-y-2.5 border-l-2 border-border-soft pl-3">
            {respostas.map((r) => (
              <div key={r.id} className="flex gap-2">
                <Avatar nome={r.autorNome || "Usuário"} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-h-[22px] items-center gap-2">
                    <span className="text-[12.5px] font-bold text-ink">{r.autorNome || "Usuário"}</span>
                    <span className="text-[11px] text-ink-3 tabular-nums">{dataHoraBR(r.criadoEm)}</span>
                  </div>
                  <p className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed">{renderComMencoes(r.texto, usuarios)}</p>
                  {anexos && (r.anexos ?? []).length > 0 && <ListaAnexos itens={r.anexos!} onAbrir={anexos.abrir} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {respondendo && composer}
      </div>
    </div>
  );
}

/** Etiqueta pequena ao lado do nome: de quem é a vez, ou que já foi resolvida. */
function Etiqueta({ tom, children }: { tom?: "danger" | "success"; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "rounded-pill px-2 py-[3px] text-[11px] font-bold leading-none",
        tom === "danger" ? "bg-danger-soft text-danger" : tom === "success" ? "bg-success-soft text-success" : "bg-[#F0F1F4] text-ink-2"
      )}
    >
      {children}
    </span>
  );
}

/** Ação em texto da observação (Responder, Resolver): discreta até o mouse chegar. */
function AcaoTexto({ className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cx("rounded px-1.5 py-1 text-[11.5px] font-bold text-ink-3 hover:bg-[#F1F2F5] hover:text-ink", className)} {...rest}>
      {children}
    </button>
  );
}

/* ------------------------------- Anexos ------------------------------------ */

/**
 * Os arquivos de um comentário, em fichas clicáveis.
 *
 * Nome e tamanho aparecem antes de abrir: num evento, saber que "planta.pdf tem
 * 3 MB" decide se vale baixar ali no 4G do corredor ou esperar chegar em casa.
 */
function ListaAnexos({
  itens,
  onAbrir,
  onRemover,
}: {
  itens: AnexoObservacao[];
  onAbrir: (anexo: AnexoObservacao) => void;
  /** Só o autor do comentário recebe — e aí o arquivo é apagado de verdade. */
  onRemover?: (anexo: AnexoObservacao) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {itens.map((a) => (
        <span
          key={a.id}
          className="group/anexo inline-flex items-center gap-1.5 max-w-full rounded-btn border border-border-soft bg-[#FAFAFB] pl-2 pr-1.5 py-1"
        >
          <span aria-hidden className="text-[13px] leading-none shrink-0">{iconeAnexo(a.nome)}</span>
          <button
            type="button"
            onClick={() => onAbrir(a)}
            title={`Abrir ${a.nome}`}
            className="min-w-0 text-left text-[12px] font-semibold text-ink hover:text-primary-dark truncate max-w-[220px]"
          >
            {a.nome}
          </button>
          <span className="text-[10.5px] text-ink-3 shrink-0 tabular-nums">{tamanhoLegivel(a.tamanho)}</span>
          {onRemover && (
            <button
              type="button"
              onClick={() => onRemover(a)}
              title="Remover anexo"
              aria-label={`Remover ${a.nome}`}
              className="shrink-0 text-ink-3 hover:text-danger p-0.5"
            >
              <IcFechar width={12} height={12} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/* -------------------------- Caixa de compor/editar -------------------------- */

/** Posição (relativa ao textarea) do caret numa dada posição de texto — técnica do "div espelho". */
function posicaoDoCaret(el: HTMLTextAreaElement, posicao: number): { top: number; left: number; height: number } {
  const div = document.createElement("div");
  const estilo = window.getComputedStyle(el);
  const propriedades = [
    "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle",
    "fontSize", "fontFamily", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
    "textAlign", "textTransform", "wordSpacing", "textIndent",
  ] as const;
  propriedades.forEach((p) => {
    (div.style as unknown as Record<string, string>)[p] = estilo[p as keyof CSSStyleDeclaration] as string;
  });
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.style.height = "auto";

  div.appendChild(document.createTextNode(el.value.slice(0, posicao)));
  const marcador = document.createElement("span");
  marcador.textContent = el.value.slice(posicao) || ".";
  div.appendChild(marcador);
  document.body.appendChild(div);

  const top = marcador.offsetTop + parseInt(estilo.borderTopWidth || "0", 10);
  const left = marcador.offsetLeft;
  const height = marcador.offsetHeight || parseInt(estilo.lineHeight || "16", 10);
  document.body.removeChild(div);
  return { top, left, height };
}

interface MencaoAtiva {
  query: string;
  inicio: number; // posição do "@" no texto
}

function Composer({
  valorInicial,
  usuarios,
  onEnviar,
  onCancelar,
  avisaQuemRecebe = false,
  rotuloEnviar = "Enviar",
  anexos,
}: {
  valorInicial: string;
  usuarios: string[];
  onEnviar: (texto: string, arquivos?: AnexoObservacao[]) => void;
  onCancelar: () => void;
  /** Observação nova: o rodapé diz quem fica com a pendência (os @marcados). */
  avisaQuemRecebe?: boolean;
  rotuloEnviar?: string;
  anexos?: ApiAnexos;
}) {
  const [texto, setTexto] = useState(valorInicial);
  /**
   * Os arquivos escolhidos ficam AQUI até o envio, e só então sobem.
   *
   * Subir na escolha seria mais rápido de ver, mas encheria o armazenamento de
   * arquivo de comentário que a pessoa desistiu de escrever — e desistir é
   * comum. O preço é a espera de um instante ao enviar, que o botão avisa.
   */
  const [pendentes, setPendentes] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  // Comentário escrito e não enviado: recarregar a página perderia o texto.
  useUnsavedGuard(!enviando && (texto.trim() !== valorInicial.trim() || pendentes.length > 0));
  const [erroAnexo, setErroAnexo] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [mencao, setMencao] = useState<MencaoAtiva | null>(null);
  const [posDropdown, setPosDropdown] = useState<{ top: number; left: number } | null>(null);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const borda = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borda}px`;
  }, [texto]);

  const sugestoes = useMemo(() => {
    if (!mencao) return [];
    const q = mencao.query.toLowerCase();
    return usuarios.filter((u) => u.toLowerCase().includes(q)).slice(0, 6);
  }, [mencao, usuarios]);

  function detectarMencao(valor: string, cursor: number) {
    const antes = valor.slice(0, cursor);
    const idx = antes.lastIndexOf("@");
    if (idx === -1) {
      setMencao(null);
      return;
    }
    const trecho = antes.slice(idx + 1);
    if (trecho.includes("\n") || trecho.includes("@") || trecho.length > 40) {
      setMencao(null);
      return;
    }
    setMencao({ query: trecho, inicio: idx });
    setIndiceAtivo(0);
    if (taRef.current) {
      const coords = posicaoDoCaret(taRef.current, cursor);
      const rect = taRef.current.getBoundingClientRect();
      const largura = 240;
      setPosDropdown({
        top: Math.min(rect.top + coords.top + coords.height - taRef.current.scrollTop + 4, window.innerHeight - 200),
        left: Math.max(8, Math.min(rect.left + coords.left, window.innerWidth - largura - 8)),
      });
    }
  }

  function selecionarMencao(nome: string) {
    if (!mencao || !taRef.current) return;
    const cursor = taRef.current.selectionStart;
    const antes = texto.slice(0, mencao.inicio);
    const depois = texto.slice(cursor);
    const novoTexto = `${antes}@${nome} ${depois}`;
    setTexto(novoTexto);
    setMencao(null);
    const novaPos = antes.length + nome.length + 2;
    requestAnimationFrame(() => {
      taRef.current?.setSelectionRange(novaPos, novaPos);
      taRef.current?.focus();
    });
  }

  /** O botão "@": põe o arroba onde está o cursor e já abre a lista de pessoas. */
  function inserirArroba() {
    const el = taRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? texto.length;
    const antes = texto.slice(0, pos);
    const arroba = antes && !/\s$/.test(antes) ? " @" : "@";
    const novoTexto = antes + arroba + texto.slice(pos);
    const novaPos = pos + arroba.length;
    setTexto(novoTexto);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(novaPos, novaPos);
      detectarMencao(novoTexto, novaPos);
    });
  }

  /** Quem está marcado no texto agora — é para eles que a pendência vai. */
  const marcados = useMemo(() => (avisaQuemRecebe ? extrairMencoes(texto, usuarios) : []), [avisaQuemRecebe, texto, usuarios]);

  /** Peneira os escolhidos: o que não passa vira mensagem, o resto entra na fila. */
  function escolherArquivos(lista: FileList | null) {
    if (!lista?.length) return;
    const aceitos: File[] = [];
    let recusa = "";
    for (const arquivo of Array.from(lista)) {
      const motivo = motivoRecusaAnexo(arquivo, pendentes.length + aceitos.length);
      if (motivo) recusa = recusa || motivo;
      else aceitos.push(arquivo);
    }
    setErroAnexo(recusa);
    if (aceitos.length) setPendentes((atuais) => [...atuais, ...aceitos]);
    // Zera o input: sem isto, escolher o MESMO arquivo de novo não dispara nada.
    if (arquivoRef.current) arquivoRef.current.value = "";
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    if (!pendentes.length || !anexos) {
      onEnviar(t);
      return;
    }
    setEnviando(true);
    setErroAnexo("");
    try {
      // Em sequência, não em paralelo: são poucos arquivos, e assim o erro
      // aponta qual deles falhou em vez de derrubar o lote inteiro.
      const enviados: AnexoObservacao[] = [];
      for (const arquivo of pendentes) enviados.push(await anexos.enviar(arquivo));
      onEnviar(t, enviados);
    } catch (e) {
      // O texto continua na caixa: ninguém perde o que escreveu por causa do anexo.
      setErroAnexo((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mencao && sugestoes.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndiceAtivo((i) => (i + 1) % sugestoes.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndiceAtivo((i) => (i - 1 + sugestoes.length) % sugestoes.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selecionarMencao(sugestoes[indiceAtivo]);
        return;
      }
      if (e.key === "Escape") {
        setMencao(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      enviar();
    }
    if (e.key === "Escape" && !mencao) {
      onCancelar();
    }
  }

  return (
    // A CAIXA DE ESCREVER (26/11/2026): o texto em cima e uma régua de ações
    // embaixo — marcar alguém e anexar à esquerda, cancelar e enviar à direita.
    // Uma moldura só; nenhum campo dentro de campo.
    <div className="mt-2.5 rounded-[14px] border border-border bg-surface shadow-card transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(242,130,13,0.12)]">
      <textarea
        ref={taRef}
        autoFocus
        rows={2}
        lang="pt-BR"
        spellCheck
        autoCapitalize="sentences"
        autoCorrect="on"
        placeholder={avisaQuemRecebe ? "Escreva a observação. Use @ para marcar quem precisa responder." : "Escreva aqui. Use @ para marcar alguém."}
        className="block w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[13px] text-ink outline-none placeholder:text-ink-3 leading-relaxed"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          detectarMencao(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (mencao && ["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(e.key)) return;
          detectarMencao(e.currentTarget.value, e.currentTarget.selectionStart ?? 0);
        }}
        onClick={(e) => detectarMencao(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onBlur={() => setTimeout(() => setMencao(null), 150)} // dá tempo do clique na sugestão registrar
      />
      {/* Fila de anexos deste comentário — ainda no computador de quem escreve. */}
      {anexos && pendentes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3.5 pt-1">
          {pendentes.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1.5 max-w-full rounded-btn border border-border-soft bg-[#FAFAFB] pl-2 pr-1.5 py-1"
            >
              <span aria-hidden className="text-[13px] leading-none shrink-0">{iconeAnexo(f.name)}</span>
              <span className="text-[12px] font-semibold text-ink truncate max-w-[200px]">{f.name}</span>
              <span className="text-[10.5px] text-ink-3 shrink-0 tabular-nums">{tamanhoLegivel(f.size)}</span>
              <button
                type="button"
                disabled={enviando}
                onClick={() => setPendentes((atuais) => atuais.filter((_, j) => j !== i))}
                title="Tirar da lista"
                aria-label={`Tirar ${f.name} da lista`}
                className="shrink-0 text-ink-3 hover:text-danger p-0.5 disabled:opacity-40"
              >
                <IcFechar width={12} height={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {erroAnexo && <p className="px-3.5 pt-1.5 text-[11.5px] font-semibold text-danger">{erroAnexo}</p>}

      <div className="flex items-center gap-1 px-2 pb-2 pt-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()} // o cursor continua no texto
          onClick={inserirArroba}
          disabled={enviando}
          title="Marcar alguém"
          aria-label="Marcar alguém"
          className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-[15px] font-extrabold leading-none text-ink-3 hover:bg-primary-soft hover:text-primary-dark disabled:opacity-40"
        >
          @
        </button>
        {anexos && (
          <>
            <input
              ref={arquivoRef}
              type="file"
              multiple
              accept={ACCEPT_ANEXOS}
              className="hidden"
              onChange={(e) => escolherArquivos(e.target.files)}
            />
            <button
              type="button"
              onClick={() => arquivoRef.current?.click()}
              disabled={enviando || pendentes.length >= MAXIMO_ANEXOS_POR_COMENTARIO}
              title={`Anexar arquivo (até ${MAXIMO_ANEXOS_POR_COMENTARIO}, 5 MB cada)`}
              aria-label="Anexar arquivo"
              className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-ink-3 hover:bg-primary-soft hover:text-primary-dark disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <IcClipe width={15} height={15} />
            </button>
          </>
        )}
        {/* Para quem vai: a pendência fica com quem foi marcado, até a pessoa responder. */}
        {avisaQuemRecebe && (
          <span className="ml-1 min-w-0 truncate text-[11.5px] font-semibold text-ink-3">
            {marcados.length ? (
              <>
                Pendência para <span className="font-bold text-primary-dark">{marcados.join(", ")}</span>
              </>
            ) : (
              "Sem ninguém marcado, fica só como recado"
            )}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className="h-8 rounded-btn px-2.5 text-[12.5px] font-bold text-ink-2 hover:bg-[#F1F2F5] hover:text-ink disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            title="Enviar (Ctrl + Enter)"
            className="inline-flex h-8 items-center gap-1.5 rounded-btn bg-primary-grad px-3 text-[12.5px] font-bold text-[#2A1602] hover:brightness-[1.03] disabled:bg-none disabled:bg-[#EEF1F7] disabled:text-[#A3ADC2] disabled:cursor-not-allowed"
          >
            <IcSend width={14} height={14} />
            {enviando ? "Enviando…" : rotuloEnviar}
          </button>
        </span>
      </div>

      {mencao && sugestoes.length > 0 && posDropdown &&
        createPortal(
          <div
            style={{ position: "fixed", top: posDropdown.top, left: posDropdown.left, zIndex: 90, width: 240 }}
            className="rounded-[12px] border border-border bg-white shadow-modal p-1 max-h-56 overflow-y-auto"
          >
            {sugestoes.map((u, i) => (
              <button
                key={u}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // não perde o foco do textarea antes do clique
                  selecionarMencao(u);
                }}
                className={cx(
                  "flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left text-[13px]",
                  i === indiceAtivo ? "bg-primary-soft text-primary-dark font-bold" : "text-ink hover:bg-[#FAFAFB]"
                )}
              >
                <Avatar nome={u} size={22} />
                <span className="truncate">{u}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
