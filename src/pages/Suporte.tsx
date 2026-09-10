/**
 * HELP DESK — abrir chamado de dentro do sistema.
 *
 * Pedir ajuda era uma mensagem solta no WhatsApp de alguém, e chegava sem o que
 * importa: em que tela a pessoa estava, o que ela tentou fazer, qual navegador.
 * A primeira resposta do suporte era sempre a mesma pergunta.
 *
 * Aqui o chamado sai completo. A TELA e o AMBIENTE o sistema preenche sozinho
 * — a pessoa não deveria precisar saber o que é "Chrome 128" para pedir ajuda —,
 * e o "responder" do e-mail já volta para quem abriu.
 *
 * O endereço de destino é configurável (Configurações › Geral) e não vem de
 * variável de ambiente de propósito: trocar o suporte não pode depender de
 * publicar versão nova.
 *
 * ESTA É A ÚNICA TELA CUJO E-MAIL SAI DE VERDADE enquanto o app está em
 * homologação (10/09/2026). A trava existe para proteger fornecedor e cliente
 * de receberem algo que ainda não vale; aqui a mensagem vai da Pólobh para a
 * Pólobh, e um chamado que não chega é um chamado que não existe. Quem carrega
 * a exceção é a marca `interna` da mensagem — ver `lib/email/seguranca.ts`, e
 * os testes que garantem que nenhum outro template a use.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageShell } from "@/components/layout/AppLayout";
import { Button, Card, CardTitle, Field, Input, Select, Textarea } from "@/components/ui";
import { IcSend } from "@/components/icons";
import { enviarChamado, resumoDoEnvio, type TipoChamado } from "@/lib/email";
import { useAuth } from "@/store/auth";
import { useConfigApp } from "@/store/configApp";
import { toast } from "@/store/toast";
import { auditar } from "@/store/logs";
import { telaAnterior } from "@/lib/telaAnterior";

const TIPOS: TipoChamado[] = ["Erro no sistema", "Dúvida de uso", "Sugestão de melhoria", "Acesso e permissões"];

/** Navegador e tamanho de tela: metade dos "não funciona aqui" mora nisso. */
function ambienteAtual(): string {
  if (typeof window === "undefined") return "—";
  const { userAgent } = navigator;
  return `${userAgent} · ${window.innerWidth}×${window.innerHeight}`;
}

export function Suporte() {
  const usuario = useAuth((s) => s.usuario);
  const { helpdesk, carregar } = useConfigApp();
  const { pathname } = useLocation();

  const [tipo, setTipo] = useState<TipoChamado>("Erro no sistema");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tela, setTela] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { carregar(); }, [carregar]);

  // A tela de origem é lida uma vez, na entrada: se a pessoa navegar por aqui
  // dentro, o chamado continua falando de onde ela veio.
  useEffect(() => {
    setTela(telaAnterior() || pathname);
  }, [pathname]);

  const podeEnviar = assunto.trim().length > 2 && descricao.trim().length > 9 && !enviando;

  async function enviar() {
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      const chamado = {
        tipo,
        assunto: assunto.trim(),
        descricao: descricao.trim(),
        tela: tela || "—",
        autorNome: usuario?.nome ?? "—",
        autorEmail: usuario?.email ?? "",
        ambiente: ambienteAtual(),
      };
      const r = await enviarChamado(chamado, helpdesk.email);
      toast(resumoDoEnvio(r), r.ok && !r.desviado ? "success" : "warning");
      if (r.ok) {
        // Fica na trilha de auditoria mesmo quando o e-mail é simulado ou
        // desviado: o registro de que alguém pediu ajuda é a informação.
        auditar({
          categoria: "Sistema",
          acao: "helpdesk.chamado",
          mensagem: `Chamado aberto (${tipo}): ${chamado.assunto}`,
        });
        setAssunto("");
        setDescricao("");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PageShell
      title="Help Desk"
      subtitle="Abra um chamado para o suporte do sistema. A tela e o navegador vão junto — você não precisa descrevê-los."
    >
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
                Sai de verdade para <b className="text-ink-2">{helpdesk.email}</b>; a resposta do suporte chega no seu
                e-mail, <b className="text-ink-2">{usuario?.email || "o cadastrado no seu usuário"}</b>.
              </p>
              <Button icon={<IcSend width={15} height={15} />} onClick={enviar} disabled={!podeEnviar}>
                {enviando ? "Enviando…" : "Abrir chamado"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle hint="O que costuma resolver antes de abrir chamado.">Antes de abrir</CardTitle>
          <ul className="space-y-2.5 text-[13px] text-ink-2 list-disc pl-4">
            <li>
              O <b className="text-ink">Guia do Aplicativo</b> descreve cada bloco de cada tela, campo a campo, e
              diz o que o sistema preenche sozinho.
            </li>
            <li>
              Campo que não salva costuma ter uma <b className="text-ink">pendência travando</b> — o aviso leva
              até ele quando você clica.
            </li>
            <li>
              Valor que não aparece pode ser <b className="text-ink">permissão</b>: os blocos financeiros são
              restritos a Direção, Administrativo e Administrador.
            </li>
            <li>
              E-mail de <b className="text-ink">fornecedor ou cliente</b> ainda não sai de verdade: o sistema está em
              homologação e desvia tudo para a caixa de teste. O chamado daqui é a exceção — ele sai mesmo.
            </li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
