/**
 * "Avisos neste aparelho" — liga as notificações do sistema e o push.
 *
 * Mora no SINO (11/11/2026). Antes ficava só em Configurações › Geral, que
 * pede a permissão "configuracoes" — quase ninguém da equipe chegava lá, e o
 * recurso existia só no papel.
 *
 * A permissão do navegador SÓ pode ser pedida a partir de um clique: navegador
 * nenhum aceita o pedido no carregamento, e o Chrome bloqueia de vez o site que
 * tenta. Por isso é um botão, e nunca um pedido automático.
 */
import { useState } from "react";
import { Button } from "@/components/ui";
import { cx } from "@/lib/format";
import { notificar, permissaoAtual, type PermissaoNotificacao } from "@/lib/notificacoes";
import {
  ativarAvisos,
  iosForaDaTelaDeInicio,
  pushAtivoNesteAparelho,
  pushSuportado,
  sincronizarInscricao,
  testarPush,
  usePushEstado,
  type ResultadoAtivacao,
} from "@/lib/push";
import { useMinhasPendencias, usePendencias } from "@/store/pendencias";
import { toast } from "@/store/toast";

/** O que dizer a quem clicou em "Ativar avisos", conforme o que o navegador respondeu. */
const MENSAGEM_ATIVACAO: Record<Exclude<ResultadoAtivacao, "ativo">, { texto: string; tom: "info" | "warning" }> = {
  negada: {
    texto: "O navegador bloqueou as notificações do Pólobh. Clique no cadeado ao lado do endereço, escolha Notificações › Permitir e atualize a página.",
    tom: "warning",
  },
  ignorada: {
    texto: "O pedido foi fechado sem escolha. Clique em Ativar avisos de novo e escolha Permitir. Se o navegador mostrar só um sininho cortado na barra de endereço, clique nele e permita.",
    tom: "info",
  },
  "sem-push": {
    texto: "As notificações foram permitidas, mas este navegador só avisa com o app aberto.",
    tom: "info",
  },
  falhou: {
    texto: "As notificações foram permitidas, mas não foi possível registrar este aparelho para receber com o navegador fechado. Tente de novo; se persistir, avise o suporte.",
    tom: "warning",
  },
  "sem-suporte": { texto: "Este navegador não mostra notificações do sistema.", tom: "info" },
};

/**
 * A ativação, com a resposta SEMPRE visível. Usada pelo sino e pela faixa de
 * convite: as duas precisam dizer à pessoa o que aconteceu, inclusive quando o
 * navegador não concede.
 */
export function useAtivarAvisos() {
  const [ocupado, setOcupado] = useState(false);
  const [permissao, setPermissao] = useState<PermissaoNotificacao>(() => permissaoAtual());
  const { itens } = useMinhasPendencias();

  async function ativar(): Promise<ResultadoAtivacao> {
    setOcupado(true);
    try {
      const r = await ativarAvisos(itens.map((p) => p.id));
      setPermissao(permissaoAtual());
      if (r === "ativo") {
        toast("Avisos ligados neste aparelho.", "success");
        await notificar({
          titulo: "Notificações ligadas",
          corpo: "O Pólobh vai avisar aqui quando aparecer pendência para você, mesmo com o navegador fechado.",
          tag: "polobh-teste",
        });
      } else {
        const m = MENSAGEM_ATIVACAO[r];
        toast(m.texto, m.tom);
      }
      return r;
    } finally {
      setOcupado(false);
    }
  }

  return { ativar, ocupado, permissao };
}

export function AvisosNoAparelho({ compacto = false }: { compacto?: boolean }) {
  const { ativar, ocupado: ativando, permissao } = useAtivarAvisos();
  const [testando, setTestando] = useState(false);
  const { estado, erro } = usePushEstado();
  const { itens } = useMinhasPendencias();
  const ios = iosForaDaTelaDeInicio();
  const ocupado = ativando || testando;
  // Antes de as pendências carregarem o app ainda não tentou registrar o aparelho.
  const carregado = usePendencias((s) => s.ultimoLoad > 0);

  async function tentarDeNovo() {
    setTestando(true);
    try {
      await sincronizarInscricao(itens.map((p) => p.id));
    } catch {
      /* o motivo fica em `erro` e aparece na tela */
    } finally {
      setTestando(false);
    }
  }

  async function testar() {
    setTestando(true);
    try {
      if (pushAtivoNesteAparelho()) {
        const n = await testarPush();
        if (!n) toast("O servidor não conseguiu entregar o teste a este aparelho.", "warning");
      } else if (!(await notificar({ titulo: "Teste do Pólobh", corpo: "As notificações estão funcionando neste aparelho.", url: "/projetos", tag: "polobh-teste" }))) {
        toast("Não foi possível mostrar a notificação neste navegador.", "warning");
      }
    } catch (e) {
      toast(`Não foi possível enviar o teste: ${(e as Error).message}`, "warning");
    } finally {
      setTestando(false);
    }
  }

  const texto = cx(compacto ? "text-[11.5px] leading-snug" : "text-[12.5px]", "text-ink-2");

  let corpo: React.ReactNode;
  if (ios) {
    corpo = (
      <p className={texto}>
        No iPhone, os avisos só funcionam com o Pólobh na Tela de Início: toque em <b>Compartilhar</b> ›{" "}
        <b>Adicionar à Tela de Início</b> e abra o app por lá.
      </p>
    );
  } else if (permissao === "sem-suporte") {
    corpo = <p className={texto}>Este navegador não mostra notificações. O sino continua funcionando.</p>;
  } else if (permissao === "negada") {
    corpo = (
      <p className={texto}>
        Avisos <b>bloqueados</b> neste navegador. Para liberar, clique no cadeado ao lado do endereço e permita
        "Notificações".
      </p>
    );
  } else if (permissao === "concedida") {
    // O que se diz aqui TEM de ser o que o servidor sabe: só "ligados, mesmo com
    // o navegador fechado" quando o aparelho está de fato registrado.
    corpo =
      estado === "ativo" ? (
        <div className={cx("flex gap-2", compacto ? "items-center" : "flex-col items-start")}>
          <p className={cx(texto, "flex-1")}>
            <b>Avisos ligados neste aparelho</b>, mesmo com o navegador fechado.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void testar()} disabled={ocupado}>
            {testando ? "Enviando…" : "Testar"}
          </Button>
        </div>
      ) : estado === "verificando" || (estado === "inativo" && !carregado) ? (
        <p className={texto}>Conectando este aparelho aos avisos…</p>
      ) : (
        <div className={cx("flex gap-2", compacto ? "items-center" : "flex-col items-start")}>
          <p className={cx(texto, "flex-1")}>
            {pushSuportado() ? (
              <>
                <b>Atenção:</b> as notificações estão permitidas, mas este aparelho <b>ainda não está registrado</b> para
                receber com o navegador fechado{erro ? ` (${erro})` : ""}. Por enquanto o aviso só aparece com o app aberto.
              </>
            ) : (
              <>
                <b>Avisos ligados</b>, mas este navegador só avisa com o app aberto.
              </>
            )}
          </p>
          {pushSuportado() && (
            <Button size="sm" onClick={() => void tentarDeNovo()} disabled={ocupado}>
              {testando ? "Conectando…" : "Tentar de novo"}
            </Button>
          )}
        </div>
      );
  } else {
    corpo = (
      <div className={cx("flex gap-2", compacto ? "items-center" : "flex-col items-start")}>
        <p className={cx(texto, "flex-1")}>
          Receba um aviso no {compacto ? "aparelho" : "computador ou no celular"} quando aparecer pendência para você,
          mesmo com o navegador fechado.
        </p>
        <Button size="sm" onClick={() => void ativar()} disabled={ocupado}>
          {ativando ? "Ativando…" : "Ativar avisos"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {corpo}
      {!compacto && (
        <p className="text-[11.5px] text-ink-3">
          A autorização é <b>por aparelho</b>: quem usa no computador e no celular autoriza nos dois. No Windows, o aviso
          com o navegador fechado chega enquanto o Chrome/Edge segue rodando em segundo plano (o padrão). No celular,
          adicione o Pólobh à tela de início pelo menu do navegador ("Instalar aplicativo" ou "Adicionar à tela inicial").
        </p>
      )}
    </div>
  );
}
