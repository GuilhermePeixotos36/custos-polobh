import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { IcComment, IcChevron, IcPencil, IcTrash, IcSend } from "@/components/icons";
import { cx, dataHoraBR } from "@/lib/format";
import { regexMencoes } from "@/domain/mencoes";
import { useAuth } from "@/store/auth";
import type { Observacao } from "@/data/types";

interface Props {
  observacoes: Observacao[];
  usuarios: string[]; // nomes dos usuários do sistema (para @mencionar)
  onChange: (obs: Observacao[]) => void;
}

const novoId = () => globalThis.crypto?.randomUUID?.() ?? `obs-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
export function ObservacoesThread({ observacoes, usuarios, onChange }: Props) {
  const usuarioAtual = useAuth((s) => s.usuario);
  const [aberto, setAberto] = useState(false);
  const [compor, setCompor] = useState<{ modo: "novo" } | { modo: "editar"; id: string } | null>(null);

  const validas = observacoes.filter((o) => o.texto.trim());
  const n = validas.length;

  const adicionar = (texto: string) => {
    const nova: Observacao = {
      id: novoId(),
      texto,
      autorId: usuarioAtual?.id ?? "",
      autorNome: usuarioAtual?.nome ?? "Você",
      criadoEm: new Date().toISOString(),
    };
    onChange([...observacoes, nova]);
    setAberto(true);
    setCompor(null);
  };

  const editar = (id: string, texto: string) => {
    onChange(observacoes.map((o) => (o.id === id ? { ...o, texto } : o)));
    setCompor(null);
  };

  const excluir = (id: string) => {
    onChange(observacoes.filter((o) => o.id !== id));
  };

  const emEdicao = compor?.modo === "editar" ? observacoes.find((o) => o.id === compor.id) : undefined;

  return (
    <div className="border-t border-border-soft px-3 py-2.5">
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
        <span className="text-[12px] font-semibold text-ink-3">
          {n > 0 ? `${n} observaç${n > 1 ? "ões" : "ão"}` : "Nenhuma observação"}
        </span>
        <button
          type="button"
          onClick={() => setCompor({ modo: "novo" })}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-2.5 rounded-btn border-[1.5px] border-[#E2E3E8] bg-surface text-[12px] font-bold text-ink-2 hover:text-ink hover:border-primary/50 input-focus"
          title="Adicionar observação"
        >
          <IcComment width={14} height={14} /> Comentar
        </button>
      </div>

      {aberto && n > 0 && (
        <div className="mt-2.5 space-y-3">
          {validas.map((o) => (
            <ComentarioLinha
              key={o.id}
              o={o}
              usuarios={usuarios}
              souAutor={!!usuarioAtual && o.autorId === usuarioAtual.id}
              onEditar={() => setCompor({ modo: "editar", id: o.id })}
              onExcluir={() => excluir(o.id)}
            />
          ))}
        </div>
      )}

      {compor && (
        <Composer
          key={compor.modo === "editar" ? compor.id : "novo"}
          valorInicial={emEdicao?.texto ?? ""}
          usuarios={usuarios}
          onEnviar={(texto) => (compor.modo === "editar" ? editar(compor.id, texto) : adicionar(texto))}
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
  onEditar,
  onExcluir,
}: {
  o: Observacao;
  usuarios: string[];
  souAutor: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <div className="group">
      <div className="flex items-baseline gap-2">
        <span className="text-[12.5px] font-bold text-ink">{o.autorNome || "Usuário"}</span>
        <span className="text-[11px] text-ink-3">{dataHoraBR(o.criadoEm)}</span>
        {souAutor && (
          <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={onEditar} className="text-ink-3 hover:text-primary p-1" title="Editar observação" aria-label="Editar observação">
              <IcPencil width={14} height={14} />
            </button>
            <button type="button" onClick={onExcluir} className="text-ink-3 hover:text-danger p-1" title="Excluir observação" aria-label="Excluir observação">
              <IcTrash width={14} height={14} />
            </button>
          </span>
        )}
      </div>
      <p className="text-[13px] text-ink-2 whitespace-pre-wrap leading-snug mt-0.5">{renderComMencoes(o.texto, usuarios)}</p>
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
}: {
  valorInicial: string;
  usuarios: string[];
  onEnviar: (texto: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(valorInicial);
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

  function enviar() {
    const t = texto.trim();
    if (!t) return;
    onEnviar(t);
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
    <div className="mt-2.5 rounded-btn border-[1.5px] border-[#E2E3E8] bg-surface p-2 focus-within:border-primary/60">
      <textarea
        ref={taRef}
        autoFocus
        rows={2}
        lang="pt-BR"
        spellCheck
        autoCapitalize="sentences"
        autoCorrect="on"
        placeholder="Escreva uma observação… use @ para mencionar alguém"
        className="w-full resize-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3 leading-relaxed"
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
      <div className="flex justify-end gap-2 mt-1.5">
        <Button type="button" variant="text" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="button" size="sm" icon={<IcSend width={14} height={14} />} onClick={enviar} disabled={!texto.trim()}>
          Comentar
        </Button>
      </div>

      {mencao && sugestoes.length > 0 && posDropdown &&
        createPortal(
          <div
            style={{ position: "fixed", top: posDropdown.top, left: posDropdown.left, zIndex: 90, width: 240 }}
            className="rounded-btn border border-border bg-white shadow-2xl py-1 max-h-52 overflow-y-auto"
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
                  "w-full text-left px-3 py-1.5 text-[13px] truncate",
                  i === indiceAtivo ? "bg-primary-soft text-primary-dark font-bold" : "text-ink hover:bg-[#FAFAFB]"
                )}
              >
                {u}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
