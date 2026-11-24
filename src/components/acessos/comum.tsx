/**
 * Peças comuns da tela de Acessos: botão de ícone da linha, campo de senha, dado de leitura e o
 * selo de status. Visual do design system do app (tokens e `components/padrao`); a estrutura e
 * os textos são os do contrato de tela do padrão de Acessos LSPRO.
 */
import { useState, type ReactNode } from "react";
import { Copy, Eye, EyeOff, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Selo } from "@/components/padrao/Selo";
import { confirmar } from "@/store/confirm";
import { toast } from "@/store/toast";
import { TEXTOS_DESCARTE } from "@/lib/guardaDeSaida";
import { gerarSenha, motivoDaSenhaInvalida } from "@/lib/acessos/senha";
import { ROTULO_STATUS } from "@/lib/acessos/usuarios";
import type { StatusUsuarioAcesso } from "@/lib/acessos/acessosStore";

/**
 * Camadas dos popups de Acessos. Abaixo da confirmação (`ConfirmDialog`, z-90) e dos avisos
 * (z-100) de propósito: a pergunta "Descartar cadastro?" e a confirmação de inativar precisam
 * aparecer POR CIMA do popup que as chamou. O padrão da `JanelaModal` (9990) os esconderia.
 */
export const CAMADA_POPUP = 70;
export const CAMADA_POPUP_EM_CIMA = 80;

/**
 * Fecha um formulário perguntando antes se há algo preenchido. Usa a confirmação do app
 * (`@/store/confirm`) com os textos únicos de descarte (`guardaDeSaida.ts`).
 */
export async function fecharComGuarda(sujo: boolean, fechar: () => void, novo = false): Promise<void> {
  if (sujo) {
    const textos = novo ? TEXTOS_DESCARTE.cadastro : TEXTOS_DESCARTE.alteracoes;
    const ok = await confirmar({
      titulo: textos.titulo,
      mensagem: textos.mensagem,
      confirmarTexto: TEXTOS_DESCARTE.confirmar,
      cancelarTexto: TEXTOS_DESCARTE.cancelar,
      tom: "danger",
    });
    if (!ok) return;
  }
  fechar();
}

/** Botão só de ícone, com nome acessível próprio e a dica do motivo quando travado. */
export function BotaoIcone({ rotulo, icone, onClick, desabilitado, dica, perigo, carregando }: {
  rotulo: string;
  icone: ReactNode;
  onClick: () => void;
  desabilitado?: boolean;
  dica?: string | null;
  perigo?: boolean;
  carregando?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={dica ?? rotulo}
      disabled={desabilitado || carregando}
      aria-busy={carregando || undefined}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4",
        perigo ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        carregando && "animate-pulse",
      )}
    >
      {icone}
    </button>
  );
}

export function SeloDoStatus({ status }: { status: StatusUsuarioAcesso }) {
  const tom = status === "ativo" ? "sucesso" : status === "pendente" ? "atencao" : "neutro";
  return <Selo tom={tom} ponto>{ROTULO_STATUS[status]}</Selo>;
}

/** `dd/mm/aaaa hh:mm`, ou "Nunca" para quem nunca entrou. */
export function formatarUltimoAcesso(iso: string): string {
  if (!iso) return "Nunca";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "Nunca";
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()} ${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

/** Um dado só de leitura: rótulo pequeno em cima, texto embaixo (não é campo desabilitado). */
export function DadoDeLeitura({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-muted-foreground">{rotulo}</p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

/**
 * Campo de senha do cadastro e do "Definir nova senha": mostrar/ocultar, copiar e "Gerar" (que
 * deixa a senha visível — é a única chance de vê-la). A senha só vive no estado do formulário.
 */
export function CampoSenha({ rotulo, valor, onChange, id }: {
  rotulo: string;
  valor: string;
  onChange: (senha: string) => void;
  id: string;
}) {
  const [visivel, setVisivel] = useState(false);
  const erro = valor ? motivoDaSenhaInvalida(valor) : null;

  async function copiar() {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      toast("Senha copiada.", "success");
    } catch {
      toast("Não foi possível copiar. Selecione a senha e copie à mão.", "warning");
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted-foreground">{rotulo}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          autoComplete="new-password"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!erro || undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className={cn(
            "h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/15",
            visivel && "font-mono",
          )}
        />
        <BotaoIcone rotulo={visivel ? "Ocultar senha" : "Mostrar senha"} icone={visivel ? <EyeOff /> : <Eye />} onClick={() => setVisivel((v) => !v)} />
        <BotaoIcone rotulo="Copiar senha" icone={<Copy />} onClick={() => void copiar()} desabilitado={!valor} />
        <button
          type="button"
          onClick={() => { onChange(gerarSenha()); setVisivel(true); }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <Wand2 aria-hidden className="h-4 w-4" /> Gerar
        </button>
      </div>
      {erro && <p id={`${id}-erro`} className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  );
}

/** A senha recém-definida, mostrada uma vez, com "Copiar senha" que vira "Senha copiada". */
export function SenhaParaCopiar({ senha }: { senha: string }) {
  const [copiada, setCopiada] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiada(true);
    } catch {
      toast("Não foi possível copiar. Selecione a senha e copie à mão.", "warning");
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2">
      <code className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">{senha}</code>
      <button
        type="button"
        onClick={() => void copiar()}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted"
      >
        <Copy aria-hidden className="h-4 w-4" /> {copiada ? "Senha copiada" : "Copiar senha"}
      </button>
    </div>
  );
}

/** Rodapé dos popups: os botões à direita, separados do corpo por um fio. */
export function RodapeJanela({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-5 py-3", className)}>
      {children}
    </div>
  );
}
