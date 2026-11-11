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
import { notificar, pedirPermissao, permissaoAtual, type PermissaoNotificacao } from "@/lib/notificacoes";
import {
  esquecerPessoasComPush,
  iosForaDaTelaDeInicio,
  pushAtivoNesteAparelho,
  pushSuportado,
  sincronizarInscricao,
  testarPush,
} from "@/lib/push";
import { useMinhasPendencias } from "@/store/pendencias";
import { toast } from "@/store/toast";

export function AvisosNoAparelho({ compacto = false }: { compacto?: boolean }) {
  const [permissao, setPermissao] = useState<PermissaoNotificacao>(() => permissaoAtual());
  const [ocupado, setOcupado] = useState(false);
  const { itens } = useMinhasPendencias();
  const ios = iosForaDaTelaDeInicio();

  async function ativar() {
    setOcupado(true);
    try {
      const r = await pedirPermissao();
      setPermissao(r);
      if (r !== "concedida") return;
      let comPush = false;
      try {
        comPush = await sincronizarInscricao(itens.map((p) => p.id));
        // Este app passa a repassar as pendências desta pessoa já na próxima carga.
        if (comPush) esquecerPessoasComPush();
      } catch (e) {
        console.warn("[push] inscrição indisponível:", (e as Error).message);
      }
      await notificar({
        titulo: "Notificações ligadas",
        corpo: comPush
          ? "O Pólobh vai avisar aqui quando aparecer pendência para você, mesmo com o navegador fechado."
          : "O Pólobh vai avisar aqui quando aparecer pendência para você, enquanto o app estiver aberto.",
        tag: "polobh-teste",
      });
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
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
      setOcupado(false);
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
    corpo = (
      <div className={cx("flex gap-2", compacto ? "items-center" : "flex-col items-start")}>
        <p className={cx(texto, "flex-1")}>
          <b>Avisos ligados neste aparelho</b>
          {pushSuportado() ? ", mesmo com o navegador fechado." : ", com o app aberto."}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void testar()} disabled={ocupado}>
          {ocupado ? "Enviando…" : "Testar"}
        </Button>
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
          {ocupado ? "Ativando…" : "Ativar avisos"}
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
