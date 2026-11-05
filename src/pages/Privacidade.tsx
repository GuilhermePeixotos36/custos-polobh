/**
 * POLÍTICA DE PRIVACIDADE (LGPD, 05/11/2026) — página pública, sem login.
 * Linkada no login e no formulário de credenciamento.
 */
import type { ReactNode } from "react";
import { ATUALIZADA_EM, CONTROLADORA, ENCARREGADO, PRAZOS } from "@/lib/privacidade";

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display font-bold text-ink text-[17px] mb-2">{titulo}</h2>
      <div className="space-y-2 text-[14px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function Privacidade() {
  const contato = ENCARREGADO.email
    ? <>Fale com o encarregado de dados{ENCARREGADO.nome ? `, ${ENCARREGADO.nome},` : ""} pelo e-mail <a className="text-primary-dark font-semibold underline" href={`mailto:${ENCARREGADO.email}`}>{ENCARREGADO.email}</a>.</>
    : <>Fale com a {CONTROLADORA.nome} no endereço abaixo ou pelo contato da produção que enviou o link a você.</>;

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-surface border-b-2 border-primary">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <img src="/polobh-logo.png" className="h-8 w-auto object-contain" alt="Pólobh" />
          <div className="text-ink-3 text-[12px] font-semibold">Política de privacidade</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-bold text-[24px] tracking-[-0.6px] text-ink">Política de privacidade</h1>
        <p className="text-ink-3 text-[12.5px] mt-1">Atualizada em {ATUALIZADA_EM}</p>
        <p className="text-ink-2 text-[14px] leading-relaxed mt-4">
          O Aplicativo Gestão da Pólobh organiza orçamentos, ordens de serviço e a produção de eventos. Esta página explica
          quais dados pessoais ele guarda, para quê, com quem compartilha e por quanto tempo, conforme a Lei Geral de
          Proteção de Dados (Lei 13.709/2018).
        </p>

        <Secao titulo="Quem é responsável pelos dados">
          <p>
            {CONTROLADORA.nome}, CNPJ {CONTROLADORA.cnpj}, {CONTROLADORA.endereco}. A Pólobh decide como os dados são
            usados; o desenvolvedor do aplicativo trata os dados apenas em nome dela.
          </p>
        </Secao>

        <Secao titulo="Quais dados e para quê">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><b>Equipe da Pólobh</b> (usuários): nome, e-mail, telefone e área, para dar acesso ao sistema e registrar quem fez cada alteração.</li>
            <li><b>Clientes</b>: nome, CPF ou CNPJ, endereço e representante, para orçamentos, contratos e faturamento.</li>
            <li><b>Fornecedores</b>: nome, CPF ou CNPJ, endereço, contatos e dados bancários, para contratar e pagar os serviços.</li>
            <li><b>Equipe e veículos dos fornecedores</b> (credenciamento): nome e, quando o evento exige, CPF, RG, função e placa, somente para liberar a entrada no local do evento.</li>
          </ul>
          <p>O aplicativo não foi feito para dados sensíveis, como saúde, religião ou biometria, nem para dados de crianças.</p>
        </Secao>

        <Secao titulo="Com quem compartilhamos">
          <p>
            Os dados do credenciamento são repassados ao local ou à organização do evento, que controla a entrada. Para
            funcionar, o aplicativo usa serviços de tecnologia que podem guardar dados fora do Brasil, com as proteções
            contratuais exigidas pela lei: Supabase (banco de dados), Vercel (hospedagem), Brevo (e-mails), Dropbox (cópias
            de segurança) e um serviço de inteligência artificial que revisa a ortografia de textos internos.
          </p>
          <p>Não vendemos dados pessoais nem os usamos para publicidade.</p>
        </Secao>

        <Secao titulo="Por quanto tempo guardamos">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Respostas de credenciamento: apagadas automaticamente {PRAZOS.credenciamentoDias} dias depois do envio.</li>
            <li>Registro de ações dos usuários: {PRAZOS.auditoriaAnos} anos.</li>
            <li>Registro de e-mails enviados: {PRAZOS.emailsAnos} anos.</li>
            <li>Orçamentos, ordens de serviço, clientes e fornecedores: enquanto forem necessários à operação e, no mínimo, pelo prazo fiscal de 5 anos.</li>
          </ul>
        </Secao>

        <Secao titulo="Como protegemos">
          <p>
            Acesso só com login individual e perfis de permissão, regras de acesso no próprio banco de dados, conexão
            criptografada, registro de quem altera o quê, cópia de segurança diária e monitoramento automático do banco.
          </p>
        </Secao>

        <Secao titulo="Seus direitos">
          <p>
            Você pode pedir para saber quais dados seus temos, corrigi-los, apagá-los quando não forem mais necessários e
            saber com quem foram compartilhados. {contato}
          </p>
        </Secao>

        <p className="text-center text-ink-3 text-[12px] mt-10">© Pólobh Promoções</p>
      </main>
    </div>
  );
}
