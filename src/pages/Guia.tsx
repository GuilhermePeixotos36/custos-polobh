import { useMemo, useRef, useState, type ReactNode } from "react";
import { PageShell } from "@/components/layout/AppLayout";
import { Button, Card } from "@/components/ui";
import {
  IcSearch, IcGrid, IcDoc, IcClipboard, IcCalendar, IcUsers, IcGear,
  IcActivity, IcShield, IcSend, IcCheck, IcBook, IcBell, IcCompass, IcSuporte,
} from "@/components/icons";
import { cx } from "@/lib/format";
import { useTour } from "@/tour/store";

/* ============================== Componentes ============================== */

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="h-4 w-1.5 rounded-full bg-progress-grad" />
        <h3 className="font-display font-bold text-ink text-[16px]">{titulo}</h3>
      </div>
      <div className="space-y-3 text-[13.5px] text-ink-2 leading-relaxed">{children}</div>
    </section>
  );
}

function Passos({ children }: { children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <ol className="space-y-2.5">
      {items.map((c, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 h-6 w-6 rounded-full bg-primary-soft text-primary-dark font-display font-bold text-[12.5px] grid place-items-center">
            {i + 1}
          </span>
          <div className="pt-0.5">{c}</div>
        </li>
      ))}
    </ol>
  );
}

function Dica({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-card bg-success-soft text-success px-3.5 py-2.5 text-[13px]">
      <span className="mt-0.5 shrink-0"><IcCheck width={16} height={16} /></span>
      <div><b>Dica.</b> {children}</div>
    </div>
  );
}

function Atencao({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-card bg-warning-soft text-warning px-3.5 py-2.5 text-[13px]">
      <span className="mt-0.5 shrink-0" aria-hidden>⚠️</span>
      <div><b>Atenção.</b> {children}</div>
    </div>
  );
}

/** "Print" ilustrativo: um quadro estilo janela com conteúdo simplificado. */
function Tela({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-border overflow-hidden shadow-card bg-surface">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#F4F5F7] border-b border-border">
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5564B]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#F2B441]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#36C26B]" />
        <span className="ml-2 text-[11px] font-bold text-ink-3">{titulo}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Tag({ children, tom = "neutral" }: { children: ReactNode; tom?: "neutral" | "primary" | "success" | "warning" | "info" }) {
  const tons: Record<string, string> = {
    neutral: "bg-[#F0F1F4] text-ink-2",
    primary: "bg-primary-soft text-primary-dark",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
  };
  return <span className={cx("inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-bold", tons[tom])}>{children}</span>;
}

/**
 * De onde vem o valor de um campo. É a informação que a pessoa procura primeiro
 * ao abrir uma tela nova: "isso eu preencho ou o sistema traz?".
 */
type Origem = "auto" | "escolha" | "equipe" | "calculado";

const ORIGEM: Record<Origem, { rotulo: string; tom: "primary" | "info" | "warning" | "success"; explica: string }> = {
  auto: { rotulo: "Automático", tom: "primary", explica: "O sistema preenche a partir do Projeto, da EC ou do cadastro. Você pode alterar." },
  escolha: { rotulo: "Seleção", tom: "info", explica: "Lista fechada de opções — evita duas grafias para a mesma coisa." },
  equipe: { rotulo: "Preencher", tom: "warning", explica: "Só a equipe sabe: ninguém consegue adivinhar por você." },
  calculado: { rotulo: "Calculado", tom: "success", explica: "Resultado de uma conta. Não se digita." },
};

/** Legenda das origens — abre os módulos que usam `Campos`. */
function LegendaOrigem() {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {(Object.keys(ORIGEM) as Origem[]).map((o) => (
        <div key={o} className="flex items-start gap-2 rounded-card border border-border-soft bg-[#FAFAFB] px-3 py-2">
          <Tag tom={ORIGEM[o].tom}>{ORIGEM[o].rotulo}</Tag>
          <span className="text-[12px] text-ink-2 leading-snug">{ORIGEM[o].explica}</span>
        </div>
      ))}
    </div>
  );
}

/** Uma tabela de campos de um bloco: nome, origem e o que ele significa. */
function Campos({ bloco, itens }: { bloco: string; itens: [string, Origem, string][] }) {
  return (
    <div className="rounded-card border border-border overflow-hidden">
      <div className="bg-[#EDEEF1] px-3 py-2 text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-ink-2">{bloco}</div>
      <div className="divide-y divide-border-soft">
        {itens.map(([nome, origem, o_que]) => (
          <div key={nome} className="grid sm:grid-cols-[13rem_6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-3 py-2 items-start">
            <span className="text-[12.5px] font-bold text-ink">{nome}</span>
            <span><Tag tom={ORIGEM[origem].tom}>{ORIGEM[origem].rotulo}</Tag></span>
            <span className="text-[12.5px] text-ink-2 leading-snug">{o_que}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== Conteúdo ================================ */

interface Modulo {
  id: string;
  icone: ReactNode;
  titulo: string;
  resumo: string;
  tags: string[]; // termos para a busca
  conteudo: ReactNode;
}

const MODULOS: Modulo[] = [
  {
    id: "primeiros-passos",
    icone: <IcBook />,
    titulo: "Primeiros passos",
    resumo: "Login, perfis de acesso e como navegar pelo app.",
    tags: ["login", "entrar", "senha", "perfil", "acesso", "menu", "navegação", "sair", "logout", "começar"],
    conteudo: (
      <>
        <Secao titulo="Antes de ler: faça o tour">
          <p>
            Se esta é a sua primeira semana no Pólobh, comece pelo <b>tour guiado</b> — o botão fica no alto desta
            tela. Ele percorre o app inteiro nas telas de verdade, mostrando onde cada coisa é criada, na ordem em
            que o trabalho acontece. São uns 10 minutos, e nada é alterado no sistema.
          </p>
          <Dica>
            O Guia e o tour se completam: o tour mostra <b>o caminho</b>; os módulos aqui embaixo explicam
            <b> cada campo</b> de cada tela.
          </Dica>
        </Secao>
        <Secao titulo="Entrar no sistema">
          <p>O acesso é por <b>e-mail e senha</b>. Cada pessoa tem um <b>perfil</b> que define o que ela pode ver e fazer.</p>
          <Tela titulo="custos-polobh.vercel.app/login">
            <div className="max-w-[260px] mx-auto space-y-2">
              <div className="text-center font-display font-bold text-ink text-sm">Entrar</div>
              <div className="h-9 rounded-btn border border-border bg-bg flex items-center px-2.5 text-[12px] text-ink-3">voce@polobh.com.br</div>
              <div className="h-9 rounded-btn border border-border bg-bg flex items-center px-2.5 text-[12px] text-ink-3">••••••••</div>
              <div className="h-9 rounded-btn bg-primary-grad text-[#2A1602] grid place-items-center text-[12.5px] font-bold">Entrar no painel</div>
            </div>
          </Tela>
          <Passos>
            <span>Abra o endereço do sistema e digite seu <b>e-mail</b> e <b>senha</b>.</span>
            <span>Clique em <b>Entrar no painel</b>. Você cai direto na tela de <b>Projetos</b>.</span>
            <span>Para sair, use o botão <b>Sair</b> no canto superior direito.</span>
            <span>O <b>cabeçalho da página</b> — título e botões de ação — fica <b>grudado no topo</b> enquanto você rola: em tela longa, Salvar, Excel e Voltar continuam à mão sem precisar subir de volta.</span>
          </Passos>
        </Secao>
        <Secao titulo="A barra de navegação">
          <p>
            A navegação fica no <b>topo</b>, e o que ela mostra depende do seu perfil — você só vê o que tem
            permissão de usar.
          </p>
          <p>São <b>dois cabeçalhos</b>. O de cima diz em que parte do aplicativo você está — cinco botões, e só:</p>
          <div className="flex flex-wrap gap-1.5">
            <Tag tom="primary">Calendário Pólobh</Tag><Tag>Projetos</Tag>
            <Tag>Configurações</Tag><Tag>Guia do Aplicativo</Tag><Tag>Help Desk</Tag>
          </div>
          <p>
            O de baixo é a barra da <b>área em que você entrou</b>, e ela acompanha: dentro de um projeto são
            Dados Gerais / Check-list / EC / OS / Cronograma / Credenciamento / Fornecedores — e <b>a mesma barra
            continua ali</b> quando você abre uma EC ou uma OS, para você nunca perder a referência de onde está.
            Em Configurações são Geral / Check-list / Áreas e permissões / Usuários / Logs.
          </p>
          <p>
            <b>Tudo parte do Projeto.</b> EC, OS, Cronograma, Check-list, Credenciamento e Fornecedores não são telas
            soltas do menu: são <b>abas dentro do projeto</b>, porque é lá que elas fazem sentido juntas.
          </p>
          <Dica>Está com dúvida em algum módulo? Volte sempre aqui no <b>Guia</b> e use a busca no topo.</Dica>
        </Secao>
        <Secao titulo="Avisos no computador e no celular">
          <p>
            Em <b>Configurações › Geral</b> há o cartão <b>Notificações no aparelho</b>. Autorizado, o sistema avisa
            na barra do Windows (ou na do telefone) quando aparece <b>pendência nova para você</b> — mesmo com o app
            em outra aba ou minimizado. Clicar no aviso abre direto o lugar da pendência.
          </p>
          <p>
            Basta o Pólobh estar <b>aberto em alguma aba</b> — ele não precisa estar na frente. O sistema consulta as
            pendências de tempos em tempos por conta própria e avisa quando aparece coisa nova, mesmo com a janela
            minimizada ou você trabalhando em outro programa.
          </p>
          <Atencao>
            A autorização é <b>por aparelho e por navegador</b>: quem usa no computador e no celular precisa
            autorizar nos dois. Com o app <b>fechado</b> não chega aviso — para isso seria preciso um envio pelo
            servidor, que fica para uma etapa seguinte.
          </Atencao>
        </Secao>
        <Secao titulo="Usar pelo celular">
          <p>
            O app funciona no telefone. Para ficar com ícone na tela de início e receber as notificações na barra,
            use o menu do navegador: <b>Instalar aplicativo</b> (Chrome) ou <b>Adicionar à Tela de Início</b>
            (Safari). As tabelas largas — como o cronograma da OS — <b>rolam para o lado</b> no celular, em vez de
            espremer as colunas.
          </p>
        </Secao>
      </>
    ),
  },
  {
    id: "como-ler",
    icone: <IcGrid />,
    titulo: "Como ler as telas",
    resumo: "As convenções que se repetem em todo o app: rótulos, cores, o que gruda e o que avisa.",
    tags: ["rótulo", "rotulo", "convenção", "convencao", "cores", "status", "recolher", "expandir", "cabeçalho", "grudado", "pendência", "setas", "arraste", "memória", "sugestão", "navegação"],
    conteudo: (
      <>
        <Secao titulo="O que o rótulo de um campo está te dizendo">
          <p>
            Debaixo do nome de cada campo, em letra pequena, o sistema diz de onde aquele valor vem. É a resposta
            para a pergunta que se faz ao abrir qualquer tela: <i>isso eu preencho ou já vem pronto?</i>
          </p>
          <LegendaOrigem />
          <p>
            Na prática, os textos que você vai ver são <b>(auto do projeto)</b>, <b>(auto da EC)</b>,
            <b> (espelha o valor do Faturamento)</b>, <b>(padrão do modelo — editável)</b> e <b>(preencher)</b>.
            Quando o rótulo diz <b>auto</b>, o campo continua editável: o sistema traz a melhor resposta, você
            confirma ou troca.
          </p>
          <Dica>
            Quando um valor automático fica <b>diferente</b> da origem, o sistema não corrige por trás: ele avisa em
            laranja e oferece o atalho — “Usar o valor do Orçamento”, “Usar o BV da Contratação”, “Usar o que
            está no Projeto”. Quem decide é você.
          </Dica>
        </Secao>

        <Secao titulo="As cores dos status">
          <p>A mesma régua vale em EC, OS e Contrato:</p>
          <div className="flex flex-wrap gap-2">
            <Tag tom="success">OK</Tag>
            <Tag tom="warning">Emitir · Emitir Nova Versão</Tag>
            <Tag tom="neutral">Pendente</Tag>
            <Tag tom="success">Não se aplica</Tag>
          </div>
          <p>
            <b>Não se aplica</b> é verde junto com OK de propósito: os dois querem dizer “não há nada a fazer aqui”.
            O vermelho fica reservado para o que exige ação de alguém.
          </p>
        </Secao>

        <Secao titulo="O cabeçalho acompanha a rolagem">
          <p>
            O título da tela, os botões de ação e as subabas ficam <b>grudados</b> no topo. Numa EC com dezenas de
            itens você não precisa voltar ao começo para salvar, exportar ou trocar de subaba. Nas listagens, o
            <b> cabeçalho das colunas</b> também gruda — como o congelamento de painéis da planilha.
          </p>
        </Secao>

        <Secao titulo="Recolher e expandir">
          <p>
            Uma OS aberta é uma folha de quinze blocos. A faixa cinza de cada bloco é um <b>botão</b>: clique para
            fechar ou abrir aquele bloco. No cabeçalho da tela há o <b>Recolher tudo</b> — com tudo fechado, a tela
            vira o sumário da OS, e você abre só o que veio conferir.
          </p>
        </Secao>

        <Secao titulo="A pílula de pendências">
          <p>
            No canto inferior direito aparece uma pílula vermelha com as pendências <b>daquela tela</b>. As setas
            andam de uma para a outra: a tela rola até o item, ele pisca e, quando a pendência é um comentário, a
            conversa abre no ponto certo. Ela nunca leva você para outra tela — o que é de outra tela se resolve lá.
          </p>
          <Dica>
            Se o salvamento for barrado por um campo obrigatório, o aviso também <b>leva você até ele</b>: a tela
            rola, o bloco abre se estiver recolhido, o campo pisca em vermelho e já recebe o cursor.
          </Dica>
        </Secao>

        <Secao titulo="Ordenar: setas e arraste">
          <p>
            Itens da EC, etapas do cronograma, tarefas do check-list e blocos do roteiro se movem de dois jeitos:
            as <b>setas</b> andam uma posição por vez (bom para o ajuste fino) e o <b>arraste</b> pela alça leva para
            longe de uma vez. O item acompanhado pela tela não escapa do campo de visão.
          </p>
        </Secao>

        <Secao titulo="O sistema lembra o que você já digitou">
          <p>
            Campo preenchido uma vez vira sugestão nos próximos — para <b>todos os usuários</b>. Ao digitar num campo
            de texto, o navegador oferece o que a casa já usou ali (nomes, endereços, telefones, formas de pagamento,
            descritivos). É atalho, não trava: qualquer valor novo continua valendo.
          </p>
        </Secao>

        <Secao titulo="Sair sem salvar">
          <p>
            Telas de edição avisam quando você tenta sair com alteração pendente. O aviso é do navegador, então ele
            aparece igual ao trocar de tela, fechar a aba ou voltar.
          </p>
        </Secao>
      </>
    ),
  },
  {
    id: "dicionario",
    icone: <IcDoc />,
    titulo: "Dicionário de campos",
    resumo: "Campo a campo, bloco a bloco: o que é, de onde vem e quem preenche.",
    tags: ["campo", "dicionário", "dicionario", "referência", "referencia", "bv", "cnae", "tomador", "contratante", "rubrica", "honorários", "encargos", "descritivo", "inscrição", "perfil tributário"],
    conteudo: (
      <>
        <Secao titulo="Como ler este dicionário">
          <LegendaOrigem />
        </Secao>

        <Secao titulo="Projeto — Dados Gerais">
          <Campos
            bloco="Identificação"
            itens={[
              ["Cliente (apelido)", "equipe", "Nome curto do cliente. Entra no título da EC e da OS. Uma vez definido para aquele cliente, o sistema oferece nos próximos projetos."],
              ["Nome do Projeto", "equipe", "Como a casa chama o evento. Compõe o título dos documentos."],
              ["Modalidade", "escolha", "Corporativo ou Cultural. Decide qual lista padrão de check-list o projeto recebe e qual modelo de EC é usado."],
              ["Data do evento / Pré / Pós", "equipe", "A janela do projeto. É dela que saem os prazos das tarefas em percentual."],
              ["Local e Endereço do Local", "equipe", "Vão para a OS e para o cronograma público."],
              ["Produtora Responsável", "escolha", "Quem responde pelo projeto. Vê todas as pendências que nascem dentro dele."],
              ["Incentivos Fiscais", "equipe", "Lei e número do projeto incentivado, na mesma linha. A OS puxa isso pronto para a nota."],
            ]}
          />
        </Secao>

        <Secao titulo="EC — cada item da tabela">
          <Campos
            bloco="Item"
            itens={[
              ["Grupo e Item", "equipe", "O que está sendo contratado. O grupo agrupa na tela, no Excel e no resumo."],
              ["Descrição / Descritivo completo", "equipe", "A curta identifica; a completa (texto rico) descreve para valer. As duas vão juntas para o Descritivo da OS."],
              ["Valor Pólobh / Valor Cliente", "equipe", "De que lado o custo entra. Só um dos dois por item."],
              ["Fornecedor (razão social e CNPJ)", "auto", "Vem do cadastro ao escolher o fornecedor; a consulta de CNPJ completa o que falta."],
              ["Aprovação", "escolha", "Pendente ou Aprovado. Só item aprovado entra na emissão de OS."],
              ["OS / Contrato", "escolha", "Pendente, Emitir, Emitir Nova Versão, OK ou Não se aplica. É o Contrato aqui que decide se a OS terá o bloco Dados para Contrato."],
              ["Documento PG", "escolha", "Recibo, Fatura, Nota Fiscal… A OS nasce com o que estiver aqui."],
              ["Código de Serviço", "equipe", "Vai para a emissão da nota na OS."],
              ["Bloco de valores (com BV e NF / sem BV com NF / sem BV sem NF)", "equipe", "Quanto o item custaria de cada forma. Cada uma aceita “Não se aplica” ou um valor — a escolha é feita na OS, no Detalhamento da Contratação."],
              ["BV — percentual ou valor fixo", "equipe", "Só na forma com BV e NF, assim que ela tem valor. É daqui que sai o BV consolidado da OS."],
              ["Justificativa do BV", "equipe", "Pedida quando não há BV ou ele é menor que 15%. Sem ela o item não entra na emissão da OS — depois de emitida, quem lê o documento não tem a quem perguntar por que a Pólobh abriu mão da bonificação."],
              ["Observações do item", "equipe", "Conversa interna com @menção. Vira pendência para quem foi mencionado. Não sai em documento."],
            ]}
          />
          <Campos
            bloco="Fechamento da EC"
            itens={[
              ["Honorários Pólobh", "equipe", "Percentual e taxa mínima. O sistema adota sempre o maior dos dois."],
              ["Encargos", "equipe", "Percentual sobre a base. Não aceita valor fora do padrão de 100%."],
              ["Total Bruto / Rentabilidade", "calculado", "Somatório e margem, item a item."],
            ]}
          />
        </Secao>

        <Secao titulo="OS — bloco a bloco">
          <Campos
            bloco="Dados do Fornecedor"
            itens={[
              ["CNPJ + Consultar CNPJ", "equipe", "O botão busca o cadastro da casa primeiro e a Receita depois. Traz razão social, endereço, perfil e as atividades (CNAE)."],
              ["Perfil (regime tributário)", "escolha", "MEI, Simples, Lucro Presumido, Lucro Real, Imune/Isenta, Pessoa Física (RPA). Decide retenção e o que a nota precisa trazer."],
              ["Inscrição Municipal", "equipe", "Tem botão de busca, como o do cliente."],
              ["Dados bancários / Pix", "equipe", "Nenhuma fonte pública tem isso: é memória da casa, e a consulta de CNPJ nunca apaga."],
            ]}
          />
          <Campos
            bloco="Detalhamento da Contratação — onde a condição é fechada"
            itens={[
              ["Modalidade", "auto", "Cultural ou Corporativo, do projeto."],
              ["Itens da EC", "escolha", "Quais itens esta OS consolida. É deles que sai tudo o que vem abaixo."],
              ["Bloquinho de cada item", "equipe", "As três formas de cobrança do item, com os valores JÁ IMPORTADOS da EC — e editáveis: a EC levanta o preço, a OS fecha a condição. Cada forma aceita “Não se aplica” ou um valor."],
              ["BV — percentual ou valor fixo", "equipe", "Só dentro da forma com BV e NF; nas outras duas não existe BV, por definição. Incide sobre o valor NEGOCIADO na OS."],
              ["Justificativa do BV", "equipe", "OPCIONAL. Uma por FORMA, e não uma por item como na EC: aqui as três convivem e cada uma responde por si. O campo aparece quando a forma vale e sai sem BV — ou com BV abaixo de 15% —, mas nada impede de salvar a OS sem ele."],
              ["Formas de pagamento", "equipe", "Como o fornecedor recebe."],
              ["Descritivo", "auto", "O descritivo financeiro e o detalhado da produção, um abaixo do outro, vindos dos itens da EC."],
            ]}
          />
          <Campos
            bloco="Resumo da Contratação — o que sai do que foi decidido"
            itens={[
              ["Entrega", "equipe", "Campo livre — deixou de ter preenchimento automático."],
              ["Cronograma", "auto", "Nasce do cronograma do projeto. Reordenável por setas e arraste."],
              ["Logística e Infraestrutura", "equipe", "Cada linha aceita “Não se aplica”: marcada, ela some do documento impresso e da planilha."],
              ["Observações Gerais", "equipe", "Texto livre que SAI no documento e no Excel — é para o fornecedor ler."],
              ["Resumo dos Custos", "auto", "Os itens da EC com os valores definidos no Detalhamento. Só sai a coluna que tem algum valor: coluna inteira zerada, ou inteira “Não se aplica”, não aparece para o fornecedor."],
              ["Totais por coluna", "calculado", "No pé da tabela, o total de cada forma que saiu."],
              ["Total a Faturar / Total Sem Nota", "calculado", "As duas colunas COM nota fiscal somadas (é sobre elas que a emissão fala) e, separado, o que é pago sem nota."],
              ["Documento Fiscal", "auto", "Vem do Documento PG dos itens da EC."],
              ["Parcelas", "equipe", "A soma das parcelas precisa fechar com o valor a pagar; o sistema avisa se não fechar."],
            ]}
          />
          <Campos
            bloco="Dados Nota Fiscal, Fatura, etc... (restrito)"
            itens={[
              ["Tomador dos Serviços", "auto", "Nasce “Pólobh” e traz razão social, endereço, CNPJ e inscrições. Troque para Cliente quando o faturamento for direto."],
              ["Descritivo Nota Fiscal", "auto", "Vem do descritivo da EC."],
              ["Nome do Projeto Incentivado", "auto", "Do projeto."],
              ["Lei de Incentivo à Cultura", "auto", "Lei e número na MESMA linha, como o Projeto guarda. Avisa quando fica diferente do Projeto."],
              ["CNAE", "escolha", "As atividades daquele CNPJ, vindas do cartão. Tem escape para digitar quando o cartão está desatualizado."],
              ["Valor total a pagar", "calculado", "Fecha o bloco de emissão, junto da forma de pagamento."],
              ["Forma de Pagamento", "auto", "Como o fornecedor recebe o que a nota cobra. Nasce com o padrão do modelo e é editável. É outra coisa que a forma de pagamento do CONTRATO: aquela é cláusula contratual, e só existe quando há contrato."],
            ]}
          />
          <Campos
            bloco="Dados para Contrato (restrito — só existe quando a EC pede)"
            itens={[
              ["Contratante", "auto", "Nasce “Pólobh”, com os dados fiscais junto."],
              ["Descritivo dos Serviços", "auto", "Vem do descritivo da NF. Acima dele o sistema monta o objeto do contrato."],
              ["Informações Complementares", "equipe", "O que este contrato tem de particular."],
              ["Valores e desconto", "auto", "Espelham o Faturamento enquanto ninguém os altera."],
              ["Forma de Pagamento / Observações Gerais", "auto", "Texto padrão do modelo, editável."],
              ["Data do Contrato", "auto", "A data de emissão da OS."],
              ["Rubrica", "equipe", "Iniciais de quem responde pelo contrato."],
            ]}
          />
          <Campos
            bloco="Acertos Financeiros"
            itens={[
              ["BV Pólobh", "auto", "Vem do BV combinado item a item no Detalhamento da Contratação. Avisa e oferece o atalho quando diverge."],
              ["BV Pólobh — Valor", "calculado", "Percentual sobre o valor total."],
              ["Observações", "equipe", "O que ficou combinado no acerto."],
            ]}
          />
          <Atencao>
            A <b>Justificativa do BV</b> saiu daqui: ela é uma <b>por forma de cobrança</b>, dentro de cada item do
            Detalhamento da Contratação — que é onde o BV é combinado. Uma justificativa só, da OS inteira, não sabia
            dizer de qual item falava. Se faltar alguma, este bloco avisa e o botão leva até ela.
          </Atencao>
          <Atencao>
            O grupo <b>Dados para Contrato</b> só aparece quando algum item desta OS foi marcado como <b>Emitir</b> ou
            <b> Emitir Nova Versão</b> na coluna Contrato, na EC. Marcado “Não se Aplica”, ele não entra na OS — nem
            como aviso: um grupo em branco não é neutro, ele descreveria um contrato inexistente com valores, forma de
            pagamento e data no documento que vai ao fornecedor.
          </Atencao>
          <Atencao>
            Os blocos de <b>emissão</b> e de <b>contrato</b> só aparecem para Direção, Administrativo e Administrador.
            <b> Acertos Financeiros</b> aparece para todos de propósito: quem negocia o BV com o fornecedor é a Produção.
          </Atencao>
        </Secao>

        <Secao titulo="Check-list — modelos (Configurações)">
          <Campos
            bloco="Cada tarefa da lista padrão"
            itens={[
              ["Título", "equipe", "O nome da tarefa como ela aparecerá no projeto."],
              ["Descrição", "equipe", "A instrução: é o que transforma “Fechar fornecedores” em algo que a pessoa consegue seguir sozinha."],
              ["Etapa", "equipe", "Agrupador na tela (PRÉ-PRODUÇÃO, MONTAGEM, PÓS-EVENTO…)."],
              ["Modo do prazo", "escolha", "% do projeto (a tarefa estica com o período) ou Dias do evento (fica grudada no dia D)."],
              ["Percentual / Dias", "equipe", "O número do prazo. A linha abaixo do campo traduz em português o que ele significa."],
              ["Responsável padrão", "escolha", "Da lista real de usuários — nome digitado à mão não bate com o cadastro."],
            ]}
          />
          <Dica>
            Alterar a lista padrão <b>não mexe</b> nos check-lists já criados. Cada projeto em andamento recebe um
            aviso e decide quando trazer as tarefas novas.
          </Dica>
        </Secao>
      </>
    ),
  },
  {
    id: "pendencias",
    icone: <IcBell />,
    titulo: "Pendências (o que o sistema cobra de você)",
    resumo: "Quem vê cada número vermelho, o sininho do topo e como saltar até a pendência.",
    tags: ["pendência", "pendencias", "sininho", "sino", "badge", "número vermelho", "bolinha", "notificação", "cobrança", "responsável"],
    conteudo: (
      <>
        <Secao titulo="De quem é a pendência">
          <p>
            O número vermelho é uma <b>lista de tarefa</b>, não um resumo do que anda acontecendo na casa. Por isso ele
            só acende para <b>duas pessoas</b>:
          </p>
          <Passos>
            <span>O(a) <b>Produtor(a) Responsável</b> do projeto — para ele conta <b>tudo</b> o que está pendente ali dentro, mesmo o que foi endereçado a outra pessoa. É quem responde pelo projeto inteiro.</span>
            <span>O <b>destinatário</b> da cobrança — quem foi <b>@mencionado</b> ou escolhido como responsável do comentário, e quem é dono da tarefa do check-list.</span>
          </Passos>
          <Atencao>
            Quem <b>escreveu</b> o comentário não carrega a pendência do outro: cobrar não é ter o que fazer. Acompanhe
            pela própria thread do item ou pelo projeto.
          </Atencao>
        </Secao>
        <Secao titulo="Conversa: a batata quente">
          <p>
            Uma observação não fica pendurada em quem foi cobrado até alguém apagá-la: é uma
            <b> conversa</b>, e a cada mensagem <b>a bola passa</b>. Quem responde já agiu — a bolinha
            sai de quem falou e acende para quem tem de responder.
          </p>
          <Tela titulo="Observações do item">
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center gap-2"><b className="text-ink">Ana</b><Tag tom="warning">Sua vez</Tag><span className="text-ink-3">@Bruno confere o orçamento</span></div>
              <div className="flex items-center gap-2"><b className="text-ink">Ana</b><Tag>Aguardando Ana</Tag><span className="text-ink-3">Bruno respondeu "conferido"</span></div>
              <div className="flex items-center gap-2"><b className="text-ink">Ana</b><Tag tom="success">Resolvida por Bruno</Tag></div>
            </div>
          </Tela>
          <Passos>
            <span>A vez sai da <b>última mensagem</b>: quem ela <b>@menciona</b> fica com a bola.</span>
            <span>Respondeu sem mencionar ninguém? A bola <b>volta para quem estava esperando</b> — quem falou antes de você.</span>
            <span>Isso vai e volta até alguém apertar <b>Resolver</b>, que encerra a thread para todo mundo. Quem está com a bola pode resolver.</span>
          </Passos>
          <Dica>
            O(a) <b>Produtor(a) Responsável</b> vê a conversa <b>sempre</b>, inclusive quando a vez é de
            outra pessoa: quem responde pelo projeto não pode descobrir tarde que uma cobrança ficou
            semanas parada. O <b>destinatário</b> é que entra e sai conforme a bola passa.
          </Dica>
        </Secao>
        <Secao titulo="O que vira pendência">
          <div className="flex flex-wrap gap-1.5">
            <Tag tom="primary">Observação geral da EC</Tag><Tag tom="primary">Comentário em aberto</Tag><Tag tom="primary">Tarefa de hoje ou atrasada</Tag>
            <Tag tom="primary">OS a emitir</Tag><Tag tom="primary">Contrato a emitir</Tag>
            <Tag tom="primary">Cronograma da OS vazio</Tag><Tag tom="primary">Credenciamento sem resposta</Tag>
            <Tag tom="primary">Projeto sem EC</Tag>
          </div>
          <p>
            Cada uma é cobrada <b>onde se resolve</b>: o cronograma vazio na <b>OS</b> (é lá que se
            preenchem as etapas), o credenciamento na subguia <b>Credenciamento</b> do projeto (é de lá
            que se reenvia o link). <b>Item oculto</b> da EC não cobra nada — está guardado, fora dos
            totais e da tela.
          </p>
          <p>
            Nos itens da EC, <b>OS</b> ou <b>Contrato</b> em <Tag tom="warning">Emitir</Tag> ou
            <Tag tom="warning">Emitir Nova Versão</Tag> viram pendência <b>item a item</b> — cada uma leva à linha certa
            e faz o campo piscar.
          </p>
          <Atencao>Projeto <b>arquivado ou cancelado</b> encerra todas as pendências dele.</Atencao>
        </Secao>
        <Secao titulo="A lista do check-list">
          <p>
            Cada etapa é uma <b>lista</b>: uma caixa para marcar, o nome da tarefa e, embaixo, prazo, responsável e
            status escritos como texto. <b>Clique em qualquer um deles</b> para alterar — não são campos abertos o
            tempo todo, para a lista continuar sendo uma lista.
          </p>
          <Passos>
            <span>A <b>caixa à esquerda</b> conclui e reabre a tarefa com um clique — é o gesto mais usado da tela.</span>
            <span>O <b>fio vermelho</b> na lateral marca a tarefa atrasada.</span>
            <span><b>Recolher</b> e <b>excluir</b> aparecem ao passar o mouse na linha (no celular, ficam sempre visíveis).</span>
            <span>O cabeçalho de cada etapa mostra o progresso dela — <b>“3 de 8”</b>.</span>
          </Passos>
        </Secao>
        <Secao titulo="Conversa de cada aba do projeto">
          <p>
            Cinco abas do projeto têm o seu próprio espaço de conversa, no topo delas: <b>EC</b>, <b>OS</b>,
            <b> Fornecedores</b>, <b>Cronograma</b> e <b>Credenciamento</b>. É onde entra o recado da etapa —
            “@Marisa o palco não respondeu o credenciamento”, “o cronograma mudou, avisa a produção”.
          </p>
          <p>
            Vale a mesma regra de sempre: quem é <b>@mencionado</b> fica com a pendência, e ela é contada no número
            daquela aba. A conversa é <b>interna</b> — não sai em documento, e-mail nem planilha.
          </p>
          <Dica>
            <b>Dados Gerais</b> e <b>Check-list</b> não têm: a primeira é o cadastro do evento, e a segunda já é feita
            de tarefas com dono e prazo, que cobram melhor do que um comentário.
          </Dica>
        </Secao>
        <Secao titulo="Os números batem — sempre">
          <p>
            O número vermelho de cada etapa é <b>igual</b> ao número da pílula de localização daquela
            etapa. É a regra da casa: contou, dá para achar.
          </p>
          <Passos>
            <span>O badge da <b>linha da EC</b> (ou da OS) é o que a pílula mostra ao <b>abrir</b> aquela EC (ou OS).</span>
            <span>O badge do <b>título da subguia</b> é a <b>soma</b> dos badges da lista dela — e a pílula da subguia percorre essas mesmas linhas, piscando cada uma.</span>
            <span>O badge do <b>projeto</b> é a soma das subguias; o do <b>sininho</b>, a soma de tudo o que é seu.</span>
          </Passos>
          <Atencao>
            O <b>Calendário</b> não tem número de pendências: ali se lê <i>quando</i> cada projeto
            acontece, não o que falta fazer.
          </Atencao>
        </Secao>
        <Secao titulo="Achar a pendência na tela">
          <p>
            Todo número do sistema sai da <b>mesma lista</b>: o do sininho, o da aba, o do item e o da pílula do canto
            inferior direito. O que é contado sempre pode ser encontrado.
          </p>
          <Passos>
            <span>O <b>sininho</b> no canto superior direito abre tudo o que está pendente com você, agrupado por projeto. Clicar num bloco <b>abre a tela</b> da pendência com a câmera em cima dela.</span>
            <span>A <b>pílula</b> do canto inferior direito anda pelas pendências <b>da tela aberta</b>, uma a uma, pelas setas ▲ ▼.</span>
            <span>Ao chegar, o item <b>lateja em vermelho</b>: a cadeia de comentários abre e o comentário pendente pisca — ou o campo <b>OS/Contrato</b>, quando a pendência é emitir. Numa <b>listagem</b>, quem lateja é a linha da EC/OS: abra-a para responder.</span>
          </Passos>
          <Dica>Duas pendências no mesmo item? A seta pisca de novo mesmo sem a tela rolar — é o sinal de que ela mudou de alvo.</Dica>
        </Secao>
      </>
    ),
  },
  {
    id: "projetos",
    icone: <IcGrid />,
    titulo: "Projetos",
    resumo: "Tela inicial: cada projeto reúne cliente, ECs, OSs, cronograma e fornecedores.",
    tags: ["projetos", "cliente", "início", "container", "ativos", "arquivados"],
    conteudo: (
      <>
        <Secao titulo="O que mostra">
          <p>É a tela inicial. Tudo começa por um projeto: dentro dele ficam as ECs, OSs, cronograma e fornecedores.</p>
          <ul className="grid sm:grid-cols-2 gap-2">
            <li className="rounded-card bg-bg p-3"><b className="text-ink">Filtros</b> — Todos, Ativos e Arquivados.</li>
            <li className="rounded-card bg-bg p-3"><b className="text-ink">Status em destaque</b> — ao lado do nome do projeto.</li>
            <li className="rounded-card bg-bg p-3"><b className="text-ink">EC ativa</b> — apenas uma EC fica ativa por projeto.</li>
          </ul>
          <Dica>Abra um projeto e navegue pelas subguias (Dados Gerais → EC → OS → Cronograma → Fornecedores).</Dica>
        </Secao>
        <Secao titulo="Editar os dados gerais do evento">
          <p>
            Evento muda: troca de local, cresce o número de participantes, adianta um dia. Os
            <b> Dados Gerais</b> acompanham isso — a aba abre em <b>modo leitura</b> e o botão
            <b> Editar dados gerais</b> libera os campos.
          </p>
          <Passos>
            <span>Clique em <b>Editar dados gerais</b>. Os campos destravam; <b>Cancelar</b> descarta o que você digitou.</span>
            <span>Altere o que mudou e clique em <b>Salvar projeto</b>.</span>
            <span>
              Se o projeto já tem EC ou OS emitida, o sistema mostra <b>o que mudou</b> (antes → depois)
              e pergunta o que fazer com cada documento.
            </span>
          </Passos>
          <Atencao>
            <b>Nada do que já saiu muda sozinho.</b> A EC e a OS que o cliente e os fornecedores
            receberam continuam como estão — cada OS guarda a própria cópia dos dados do evento. A
            alteração vale para o que nascer daí em diante.
          </Atencao>
          <Tela titulo="O evento mudou. E os documentos já emitidos?">
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center gap-2"><span className="text-ink-3 line-through">Expominas</span><span className="text-ink-3">→</span><b className="text-ink">Minascentro</b></div>
              <div className="flex items-center gap-2"><Tag>☐</Tag><span className="text-ink">EC – ACME – V02</span><span className="text-ink-3">atualizar os dados do evento</span></div>
              <div className="flex items-center gap-2"><Tag>☐</Tag><span className="text-ink">OS – Som &amp; Luz – (01)</span><span className="text-ink-3">gerar nova versão</span></div>
            </div>
          </Tela>
          <Passos>
            <span><b>Atualizar a EC</b> — a EC em aberto passa a mostrar os dados novos. As OSs já emitidas a partir dela <b>não</b> mudam.</span>
            <span><b>Gerar nova versão da OS</b> — nasce uma OS rascunho com os dados novos; a atual é <b>cancelada</b> e fica no histórico, com tudo que tinha dentro (itens, financeiro, contrato).</span>
            <span><b>Agora não</b> também é resposta: o projeto já foi salvo, e nenhum documento é tocado.</span>
          </Passos>
        </Secao>
      </>
    ),
  },
  {
    id: "ec",
    icone: <IcDoc />,
    titulo: "Estimativas de Custo (EC)",
    resumo: "Criar e versionar a EC: cliente, projeto, linhas de custo, produção, totais, aprovação.",
    tags: ["ec", "estimativa", "orçamento", "cliente", "projeto", "linha de custo", "produção", "honorários", "encargos", "cnpj", "excel", "versão", "duplicar", "arquivar", "cancelar", "aprovação", "totais"],
    conteudo: (
      <>
        <Secao titulo="Para que serve">
          <p>A <b>EC</b> é o documento que estima o custo de um evento: agrupa os itens por fornecedor, calcula honorários e encargos e chega ao <b>valor total</b>. É a partir dela que se geram as Ordens de Serviço.</p>
        </Secao>
        <Secao titulo="Criar uma EC">
          <Passos>
            <span>Vá em <b>Estimativas (EC)</b> e clique em <b>Nova EC</b>.</span>
            <span>Preencha o <b>Cliente</b>. Dica: digite o CNPJ e clique em <b>Consultar CNPJ</b> para puxar razão social e endereço automaticamente.</span>
            <span>Preencha o <b>Projeto</b> (título, local, datas, participantes).</span>
            <span>Na tabela <b>Estimativa de custos</b>, adicione as linhas: grupo, item, descrição, fornecedor e valores.</span>
            <span>Ajuste o bloco <b>Produção</b> (diárias, transporte, alimentação) informando as quantidades.</span>
            <span>Confira os <b>Totais ao vivo</b> e clique em <b>Salvar</b>.</span>
          </Passos>
          <Tela titulo="Nova Estimativa">
            <div className="space-y-2 text-[12px]">
              <div className="grid grid-cols-[1fr_1fr_70px_70px] gap-1.5 text-[10px] font-bold uppercase text-ink-3"><span>Item</span><span>Fornecedor</span><span className="text-right">Pólobh</span><span className="text-right">Cliente</span></div>
              <div className="grid grid-cols-[1fr_1fr_70px_70px] gap-1.5 items-center"><span className="text-ink">Sonorização</span><span className="text-ink-2">Som &amp; Luz</span><span className="text-right font-bold">R$ 8.500</span><span className="text-right">—</span></div>
              <div className="grid grid-cols-[1fr_1fr_70px_70px] gap-1.5 items-center"><span className="text-ink">Coffee break</span><span className="text-ink-2">Sabor &amp; Arte</span><span className="text-right">—</span><span className="text-right font-bold">R$ 9.200</span></div>
              <div className="flex justify-between bg-primary-soft rounded-btn px-2.5 py-1.5 mt-1"><b className="text-ink">Valor total bruto</b><b className="text-primary-dark">R$ 40.168,65</b></div>
            </div>
          </Tela>
          <Dica>Os percentuais são fixos: <b>honorários 15%</b> e <b>encargos 16,33%</b>. O valor total recalcula sozinho a cada mudança.</Dica>
        </Secao>
        <Secao titulo="Observações gerais (a conversa da EC)">
          <p>
            No topo da EC fica a <b>conversa da equipe sobre o evento inteiro</b> — o corredor, antes
            de o assunto virar item de alguém. É de lá que cada um pega o que é seu e vai tratar
            <b> dentro do item</b>, na thread do item.
          </p>
          <Passos>
            <span>Escreva e <b>@mencione</b> quem precisa agir. A pessoa mencionada fica com a pendência (bolinha vermelha).</span>
            <span>Cada resposta <b>passa a bola</b> adiante — ver "Conversa: a batata quente", em Pendências.</span>
            <span>Quando o assunto se resolve, <b>Resolver</b> encerra a thread.</span>
          </Passos>
          <Dica>
            A conversa <b>grava sozinha</b>, na hora: comentar não é editar a estimativa. Você pode
            conversar mesmo com a EC aberta por outra pessoa — e mesmo sem permissão de editar EC.
          </Dica>
          <Atencao>É interna: não sai no documento, no e-mail nem na planilha da EC.</Atencao>
        </Secao>
        <Secao titulo="Aprovar o item">
          <p>
            Marcar a <b>Aprovação</b> do item como <Tag tom="success">OK</Tag> já muda o campo <b>OS</b> para
            <Tag tom="warning">Emitir</Tag> — item liberado pelo cliente é item que precisa de OS. Vale tanto no campo
            do item quanto no botão <b>Aprovar selecionados</b>.
          </p>
          <Passos>
            <span>Voltar a Aprovação para <Tag tom="warning">Pendente</Tag> desfaz <b>só</b> a OS que a aprovação criou (a que está em "Emitir").</span>
            <span>OS já em <Tag tom="success">OK</Tag>, em <Tag tom="warning">Emitir Nova Versão</Tag> ou em <Tag tom="success">Não se Aplica</Tag> não é tocada — esses estados vieram do processo real.</span>
            <span>Item <b>já aprovado</b> não é reaprovado. Se o escopo mudou depois da OS, quem marca <b>Emitir Nova Versão</b> é você: só você sabe que houve alteração.</span>
          </Passos>
        </Secao>
        <Secao titulo="Emitir OS a partir da EC">
          <p>
            O botão <b>Emitir OS</b> cria <b>uma OS por fornecedor</b> cujos itens já tenham sido aprovados. Item
            marcado como <Tag tom="warning">Emitir Nova Versão</Tag> arquiva automaticamente a OS anterior daquele
            fornecedor e gera a seguinte.
          </p>
          <Passos>
            <span>Item que está marcado para emitir mas tem campo faltando (fornecedor, CNPJ, Documento PG, Código de Serviço, Pedido de Compra) fica <b>de fora</b>, e a tela <b>rola até ele e o faz piscar em vermelho</b>. A lista de faltas continua no topo, e clicar num item dela volta a apontá-lo.</span>
            <span>Depois de emitir, <b>complete os dados fiscais</b> de cada OS — boa parte deles é preenchida à mão.</span>
          </Passos>
        </Secao>
        <Secao titulo="Formas de cobrar o item (informação, não escolha)">
          <p>
            Dentro de cada item há um bloquinho com as <b>três formas de cobrar</b> aquele serviço — a OS junta vários
            itens, e cada um é negociado do seu jeito:
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Tag tom="primary">Valor com BV e NF</Tag>
            <Tag tom="primary">Valor Sem BV e Com Nota Fiscal</Tag>
            <Tag tom="primary">Valor Sem BV e Sem NF</Tag>
          </div>
          <Passos>
            <span>Em cada uma, ou você <b>digita o valor</b>, ou clica em <b>Não se aplica</b> — este item não é cobrado daquela forma. São respostas diferentes de deixar em branco.</span>
            <span>Na EC <b>não se escolhe nada</b>: as três seguem lado a lado para a OS, que é onde se decide por qual delas o item vai ser pago (bloco <b>Detalhamento da Contratação</b>, item a item).</span>
            <span>Marcar "Não se aplica" <b>não apaga</b> o valor digitado: dá para voltar atrás sem perder o que estava escrito.</span>
          </Passos>
          <Dica>
            Havia aqui um <b>rádio</b> elegendo "a que vale". Ele obrigava a produção a fechar a condição de pagamento
            dentro de um documento que ainda estava sendo montado — e a escolha nem chegava à planilha, que já imprime
            as três colunas de qualquer jeito. Na EC se <b>levanta o preço</b>; na OS se <b>fecha a condição</b>.
          </Dica>
        </Secao>
        <Secao titulo="Enviar para aprovação, versões e Excel">
          <Passos>
            <span>Na EC, em <b>Ações</b>, use <b>Enviar ao cliente para aprovação</b> — a EC vai para o status <Tag tom="warning">Aguardando</Tag>.</span>
            <span><b>Gerar nova versão (V02…)</b> cria uma cópia que “cancela e substitui” a anterior — use quando o escopo muda.</span>
            <span><b>Importar EC</b> (na aba EC do projeto) faz o mesmo que <b>Gerar nova versão</b>, mudando só de onde vem o conteúdo: pega a estrutura de <b>qualquer</b> EC — deste projeto ou de outro, <b>no ar ou arquivada</b> — e gera com ela a <b>próxima versão</b> da EC daqui. A de origem não é tocada; a que estava valendo neste projeto vai para o arquivo.</span>
            <span><b>Arquivar EC</b> tira a estimativa do ar. Ela continua consultável e importável — e volta por <b>Tornar EC ativa</b>.</span>
            <span><b>Excel Financeiro</b> exporta somente itens e valores; <b>Excel Completa</b> inclui todos os dados e as descrições completas.</span>
          </Passos>
          <Dica>
            A EC tem <b>dois estados, e só</b>: <Tag tom="success">Ativa</Tag> — a estimativa que vale, uma por
            projeto, a única que se edita — e <Tag>Arquivada</Tag>, que é todo o resto: versões anteriores, o que
            saiu do ar, o que veio de outro evento. O arquivo <b>não é cemitério</b>: é de lá que se puxa uma
            estimativa de volta, por <b>Tornar EC ativa</b> ou <b>Importar EC</b>. Não existe "cancelar" — quem não
            vale mais é arquivada.
          </Dica>
          <Atencao>Arquivar <b>não apaga</b> a EC — ela continua consultável e importável. Nada é excluído de fato.</Atencao>
        </Secao>
      </>
    ),
  },
  {
    id: "os",
    icone: <IcClipboard />,
    titulo: "Ordens de Serviço (OS)",
    resumo: "Gerar OS a partir da EC, consolidar por fornecedor, bloco financeiro, disparo e PDF.",
    tags: ["os", "ordem de serviço", "fornecedor", "consolidar", "modalidade", "cronograma", "orçamento", "financeiro", "bv", "disparar", "pdf", "excel", "nota fiscal", "credenciamento"],
    conteudo: (
      <>
        <Secao titulo="Ver os itens de cada OS na lista">
          <p>
            Na lista de OSs — dentro do projeto e em <b>Ordens de Serviço</b> — há um ícone discreto ao lado do número.
            <b> Passe o mouse</b> nele e sai uma caixinha com os itens da EC que aquela OS consolida, em bullets, com o
            grupo de cada um. <b>Clique</b> para prender a caixinha aberta (é assim no celular, onde não existe passar o
            mouse); <b>Esc</b> ou um clique fora fecham.
          </p>
          <Dica>
            Os nomes não são impressos na linha de propósito: uma OS com oito itens esticaria a linha e desalinharia a
            tabela inteira. A lista longa rola dentro da própria caixinha.
          </Dica>
        </Secao>
        <Secao titulo="Trocar o fornecedor de uma OS já emitida">
          <p>
            Numa OS em <b>rascunho</b>, trocar o fornecedor é só corrigir — a OS nasce com o fornecedor que a EC
            apontou, e o primeiro ajuste costuma ser esse.
          </p>
          <p>
            Depois de <b>emitida</b> ou <b>disparada</b>, não. O documento já existe do lado do primeiro fornecedor, e
            deixar duas empresas com o <b>mesmo número</b> na mão é problema. Então o sistema avisa assim que você
            troca — enquanto ainda dá para desfazer —, pede autorização ao salvar, <b>arquiva a OS como ela era</b> e
            abre a <b>versão seguinte</b> em rascunho, com o fornecedor novo e todo o conteúdo da anterior: itens,
            valores, cronograma e contratação.
          </p>
          <Dica>
            Corrigir a razão social ou preencher o CNPJ que faltava <b>não</b> conta como troca: continua sendo o mesmo
            fornecedor, e a OS segue a mesma.
          </Dica>
        </Secao>
        <Secao titulo="Como nasce uma OS">
          <p>A OS deriva da EC. Você seleciona as linhas de <b>um mesmo fornecedor</b> e gera a ordem para ele.</p>
          <Passos>
            <span>Abra a EC e, na tabela de linhas, <b>marque as linhas</b> do mesmo fornecedor.</span>
            <span>Clique em <b>Gerar OS</b>. A OS já vem com cliente, projeto e itens preenchidos a partir da EC.</span>
            <span>Complete os dados do <b>Fornecedor</b> (use Consultar CNPJ), o <b>detalhamento</b>, o <b>cronograma</b> e o <b>orçamento</b>.</span>
            <span>Clique em <b>Salvar</b>.</span>
          </Passos>
          <Dica>
            O <b>título da OS</b> é montado sozinho:
            <b> OS – Apelido do Cliente – Nome do Projeto – Ano – Apelido do Fornecedor – (NN) em DD MM AA</b>.
            O <b>(NN)</b> é a versão daquela OS: a primeira emissão é (01), e cada "Emitir Nova Versão" para o mesmo
            fornecedor avança para (02), (03)… O <b>apelido do fornecedor é gerado pelo sistema</b> a partir do nome
            dele — a razão social vem da Receita cheia de forma jurídica e descrição de atividade, e o sistema descarta
            isso: <i>"SOM &amp; LUZ PRODUÇÕES LTDA"</i> vira <b>Som &amp; Luz</b>, <i>"LSPRO LOCACOES, SERVICOS E
            EVENTOS LTDA"</i> vira <b>LSPRO</b>. Não gostou do resultado? O campo <b>Apelido</b>, em Fornecedores,
            aceita o seu.
          </Dica>
          <Atencao>Cada OS consolida linhas de <b>um único fornecedor</b>. Se você marcar fornecedores diferentes, o sistema avisa.</Atencao>
        </Secao>
        <Secao titulo="Evento de vários dias">
          <p>
            Em <b>Dados do Projeto</b>, a OS mostra <b>Data(s)</b> e <b>Horário(s)</b> — no plural porque saem
            <b> todas</b> as faixas cadastradas no cronograma do projeto, e não só a primeira.
          </p>
          <Passos>
            <span>Datas repetidas contam uma vez: duas faixas no mesmo dia (manhã e noite) são <b>um dia</b> na lista.</span>
            <span>Horários iguais também: três dias das 9h às 18h leem <b>09:00 às 18:00</b>, e não a mesma faixa três vezes. Diferentes entre si, aparecem todos.</span>
            <span>O <b>Cronograma do Fornecedor</b> já nasce com todas as faixas de todas as etapas do projeto — é só ajustar o que for dele.</span>
          </Passos>
          <Dica>
            Vale nos três lugares em que a OS aparece — tela, PDF e Excel — e no e-mail que a dispara ao fornecedor.
          </Dica>
        </Secao>
        <Secao titulo="Bloco financeiro (restrito)">
          <p>O bloco <b>Financeiro Pólobh</b> (BV, valor a pagar, margem) só aparece para os perfis <b>Direção</b>, <b>Administrativo</b> e <b>Administrador</b>. A <b>Produção</b> não vê esses valores — nem na tela, nem pela API.</p>
        </Secao>
        <Secao titulo="O documento da OS">
          <p>
            A OS tem <b>uma</b> ação de documento: <b>Baixar PDF</b>, que já abre a janela de salvar. O PDF respeita
            o seu perfil — quem não vê o bloco financeiro também não o vê no arquivo.
          </p>
          <Dica>
            A opção “OS em Excel” saiu do menu. A planilha continua sendo gerada como <b>anexo do e-mail</b> que o
            fornecedor recebe, sem o bloco financeiro.
          </Dica>
        </Secao>
        <Secao titulo="Disparar ao fornecedor">
          <p>
            <b>Disparar OS</b> muda o status para <Tag tom="success">Disparada</Tag> e manda a OS ao fornecedor por
            e-mail, com a planilha anexada.
          </p>
          <Atencao>
            Enquanto o sistema está em <b>homologação</b>, o botão de disparar fica <b>desabilitado</b> e nenhum
            e-mail chega a fornecedor ou cliente: o que for enviado por qualquer tela vai para a caixa de teste da
            equipe, com o destinatário original no assunto. É uma trava de publicação — nem o Administrador liga ou
            desliga pela interface.
          </Atencao>
        </Secao>
      </>
    ),
  },
  {
    id: "checklist",
    icone: <IcCheck />,
    titulo: "Check-list do projeto (Work Flow)",
    resumo: "Lista de tarefas com prazo e dono, gerada do modelo da modalidade.",
    tags: ["check-list", "checklist", "work flow", "workflow", "tarefa", "tarefas", "prazo", "etapa", "modelo", "responsável", "concluir", "atrasada", "pendência", "anexo", "anexar", "arquivo", "foto", "pdf"],
    conteudo: (
      <>
        <Secao titulo="Para que serve">
          <p>
            O check-list é a <b>lista de tarefas do projeto</b>: o que precisa acontecer, <b>até quando</b> e
            <b> de quem</b> é. Ele nasce sozinho a partir do modelo da <b>modalidade</b> (Cultural ou Corporativo)
            e vira a pauta da reunião de produção.
          </p>
          <Passos>
            <span>Preencha <b>Modalidade</b> e as <b>datas</b> em <b>Dados Gerais</b> e salve o projeto.</span>
            <span>Abra a aba <b>Check-list</b> (a segunda, logo depois de Dados Gerais). A lista já vem pronta.</span>
            <span>Ajuste responsável, prazo e status tarefa a tarefa. O <b>+</b> no fim de cada etapa cria uma tarefa ali mesmo, só deste projeto.</span>
          </Passos>
          <p>
            Cada tarefa pode ter uma <b>descrição</b> embaixo do título — o "como fazer" que veio da lista padrão. Ela
            se edita como o título: clique no texto (ou em <b>+ descrição</b>) e escreva.
          </p>
          <Dica>Trocar as datas do projeto <b>não</b> mexe nos prazos sozinho: a tela avisa quantas tarefas mudariam e você decide com o botão <b>Recalcular prazos</b>.</Dica>
        </Secao>
        <Secao titulo="Prazo de cada tarefa">
          <p>O modelo define a régua de cada tarefa, de dois jeitos:</p>
          <Passos>
            <span><b>Percentual</b> da janela do projeto — 0 % é o começo, 100 % é o dia do evento. Serve para o que acompanha o andamento (montar a EC, aprovar, contratar).</span>
            <span><b>Âncora no evento</b> — tantos dias antes ou depois do dia D (ex.: −15 = quinze dias antes). Serve para o que é preso ao evento (credenciamento, montagem, prestação de contas).</span>
          </Passos>
          <p>
            Uma data ajustada à mão fica marcada como <Tag>data ajustada à mão</Tag> e o recálculo <b>não</b> passa por cima dela.
          </p>
        </Secao>
        <Secao titulo="Concluir e medir o prazo">
          <p>
            Ao marcar <Tag tom="success">Concluído</Tag>, o sistema carimba <b>data e hora</b> e o seu nome. Essa data é
            <b> editável</b>: quem terminou na sexta e só marcou na segunda corrige, e o histórico não inventa atraso.
          </p>
          <p>Comparando o prazo com a conclusão, a tarefa mostra <Tag tom="success">no prazo</Tag> ou <Tag tom="warning">N dias de atraso</Tag>.</p>
        </Secao>
        <Secao titulo="Anexar arquivos na conversa da tarefa">
          <p>
            A conversa da tarefa aceita <b>arquivo leve</b>: a foto da planta do local, o PDF do
            orçamento que chegou, a planilha do buffet. O papel fica junto da decisão, em vez de
            se perder no WhatsApp.
          </p>
          <Passos>
            <span>Abra as <b>Observações</b> da tarefa e clique em <b>Anexar</b> — dá para escolher vários de uma vez.</span>
            <span>Os arquivos ficam na caixa, esperando; quem sobe é o botão <b>Comentar</b> (ou <b>Responder</b>).</span>
            <span>Clicar no anexo <b>abre em outra aba</b>. Quem escreveu o comentário pode tirar um anexo pelo <b>×</b>.</span>
          </Passos>
          <Tela titulo="Observações da tarefa">
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center gap-2 flex-wrap">
                <b className="text-ink">Ana</b>
                <span className="text-ink-3">@Bruno a planta mudou — segue a nova</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Tag>📕 Planta Expominas v2.pdf · 820 KB</Tag>
                <Tag>📊 Buffet - orçamento.xlsx · 46 KB</Tag>
              </div>
            </div>
          </Tela>
          <Atencao>
            <b>Até 5 arquivos por comentário, 5 MB cada.</b> Vale imagem, PDF, Word, Excel,
            PowerPoint, CSV e TXT — vídeo não entra, e nem formato que o navegador executa.
            Precisa mandar mais? Escreva outro comentário.
          </Atencao>
          <Dica>
            Anexo é só do <b>check-list</b>. Na EC e na OS o documento é a planilha e a OS impressa —
            um arquivo solto na conversa criaria uma segunda versão da verdade num papel que vai
            para cliente e fornecedor. Excluir o comentário apaga os anexos dele.
          </Dica>
        </Secao>
        <Secao titulo="Pendências">
          <p>
            Tarefa que <b>vence hoje ou já venceu</b> entra no quadro de pendências — o número vermelho na aba e a
            pílula do canto inferior direito, que salta de uma pendência para a outra. A cobrança vai para o
            <b> responsável da tarefa</b>; sem responsável, para o <b>Produtor Responsável</b> do projeto — que enxerga
            tudo do projeto dele de qualquer jeito (ver <b>Pendências</b>).
          </p>
          <Atencao>Projeto <b>arquivado ou cancelado</b> encerra as pendências dele — inclusive as do check-list.</Atencao>
        </Secao>
        <Secao titulo="Modelos (quem edita)">
          <p>
            As listas padrão ficam em <b>Configurações → Check-list</b>, uma por modalidade, e só
            <b> Direção</b> e <b>Administrador</b> editam. Mudar o modelo <b>não</b> mexe nos check-lists já gerados: dentro do
            projeto aparece a ação <b>trazer itens novos</b>, que você aplica quando quiser.
          </p>
        </Secao>
      </>
    ),
  },
  {
    id: "calendario",
    icone: <IcCalendar />,
    titulo: "Calendário Pólobh",
    resumo: "O ano inteiro num quadro só: quando cada projeto acontece.",
    tags: ["calendário", "calendario", "ano", "anual", "quadro", "meses", "mês", "datas", "quando", "barrinha", "linha do tempo", "quadro preto"],
    conteudo: (
      <>
        <Secao titulo="O que o Calendário responde">
          <p>
            É o <b>quadro do ano</b> — o mesmo que a produção mantinha à mão na parede, agora
            preenchido sozinho. Responde de bate-pronto: <b>o que acontece em cada mês do ano?</b>
            É o <b>primeiro botão</b> do aplicativo, e a tela que abre quando você entra.
          </p>
          <p>
            O card de cada mês lista <b>todos</b> os projetos dele e cresce o quanto precisar. Ele cortava em quatro e
            resumia o resto em “+6 projetos”, o que obrigava a abrir o mês só para descobrir quais eram. A barrinha
            colorida continua em três trilhas: ali o assunto é <i>quão cheio está</i>, e mais linhas virariam um borrão.
          </p>
          <Tela titulo="Calendário — 2026">
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center gap-2">
                <Tag tom="primary">‹ 2026 ›</Tag>
                <span className="text-ink-3">a seta troca o ano</span>
              </div>
              <div className="flex items-center gap-2"><Tag>Calendário</Tag><Tag>Lista</Tag><span className="text-ink-3">duas leituras do mesmo quadro</span></div>
              <div className="flex items-center gap-2">
                <span className="text-ink-3">Março</span>
                <span className="h-2 w-24 rounded-pill bg-primary" />
                <span className="text-ink-3">05 a 08</span>
              </div>
            </div>
          </Tela>
        </Secao>
        <Secao titulo="Como usar">
          <Passos>
            <span>Use as <b>setas ao lado do ano</b> para ir e voltar no tempo. Os doze meses aparecem em cards.</span>
            <span>Cada card mostra <b>quantos projetos</b> o mês tem e os nomes, com a cor de cada projeto.</span>
            <span>Clique no mês para abrir a <b>régua de dias</b>: cada projeto vira uma barra que corre do primeiro ao último dia. Barra com <b>seta na ponta</b> = o projeto começa antes ou termina depois daquele mês.</span>
            <span>A vista <b>Lista</b> mostra o ano inteiro escrito, mês a mês — é a leitura de quem quer bater o olho ou imprimir.</span>
          </Passos>
        </Secao>
        <Secao titulo="De onde vêm as datas">
          <p>
            Do próprio projeto: a etapa <b>Evento</b> do cronograma (aba Dados Gerais). É a data do
            projeto acontecendo — <b>montagem, ensaios e desmontagem não entram</b> no quadro.
          </p>
          <Atencao>
            Projeto sem data de evento não tem onde ser desenhado. Ele não some: aparece na faixa
            amarela no rodapé da tela, para alguém preencher a data.
          </Atencao>
          <Dica>
            Ninguém digita nada duas vezes. Cadastrou a data do evento no projeto, o calendário se
            preenche sozinho — e a cor de cada projeto é sempre a mesma, em todas as telas do quadro.
          </Dica>
        </Secao>
      </>
    ),
  },
  {
    id: "cronogramas",
    icone: <IcCalendar />,
    titulo: "Cronogramas & link público",
    resumo: "Linha do tempo consolidada do evento e link público para enviar ao cliente.",
    tags: ["cronograma", "linha do tempo", "timeline", "link público", "compartilhar", "evento", "etapas"],
    conteudo: (
      <>
        <Secao titulo="Linha do tempo do projeto">
          <p>O módulo <b>Cronogramas</b> junta as etapas de <b>todos os fornecedores</b> de um projeto numa única linha do tempo, em ordem cronológica, além do detalhe por fornecedor.</p>
          <Passos>
            <span>Em <b>Cronogramas</b>, escolha o <b>projeto</b> no seletor do topo.</span>
            <span>Veja a <b>Linha do tempo consolidada</b> e, abaixo, as etapas por fornecedor.</span>
          </Passos>
        </Secao>
        <Secao titulo="Compartilhar com o cliente">
          <Passos>
            <span>Clique em <b>Copiar link público</b>.</span>
            <span>Envie o link ao cliente. Ele abre <b>sem login</b> e mostra só o cronograma — nenhum valor, custo ou dado interno aparece.</span>
          </Passos>
          <Dica>O link usa um código único e não-adivinhável. Cada projeto tem o seu.</Dica>
        </Secao>
        <Secao titulo="Mandar o cronograma a cada fornecedor">
          <p>
            Abaixo da linha do tempo há o painel <b>Envio dos cronogramas</b> — o mesmo desenho do credenciamento.
            Cada fornecedor recebe o cronograma <b>da OS dele</b>: o texto padrão da Pólobh com as etapas, datas e
            horários daquele contrato.
          </p>
          <Passos>
            <span><b>Enviar a todos</b> alcança quem tem e-mail e cronograma montado.</span>
            <span><b>Marque</b> fornecedores para alcançar só eles — inclusive quem ainda está com as etapas em branco, quando a intenção é justamente avisar que o dele está para sair.</span>
          </Passos>
          <Atencao>
            Em homologação este botão fica <b>desabilitado</b>, como o de disparar OS, e nada chega a fornecedor
            nenhum.
          </Atencao>
        </Secao>
      </>
    ),
  },
  {
    id: "credenciamento",
    icone: <IcSend />,
    titulo: "Credenciamento de fornecedores",
    resumo: "Subaba do Projeto: dispara o link a todos os fornecedores de uma vez e mostra quem já respondeu.",
    tags: ["credenciamento", "fornecedor", "equipe", "veículos", "placa", "cpf", "link", "formulário", "acesso ao local", "projeto"],
    conteudo: (
      <>
        <Secao titulo="Como funciona">
          <p>O credenciamento é do <b>evento</b>, não de cada contrato: ele vive na subaba <b>Credenciamento</b> do Projeto, onde se vê a fila de todos os fornecedores e quem ainda falta responder.</p>
          <p>Cada fornecedor recebe o <b>link da OS dele</b> — é esse link que diz ao formulário quem está respondendo. Ele abre sem login, informa a <b>equipe</b> (nome, CPF, função) e os <b>veículos</b> (modelo, placa), e os dados caem direto no sistema.</p>
          <Passos>
            <span>Abra o Projeto e vá na subaba <b>Credenciamento</b>.</span>
            <span>Defina o <b>prazo-limite</b> — ele costuma ser o mesmo para o evento inteiro, e há um campo que aplica a todas as OSs.</span>
            <span>Clique em <b>Enviar a todos</b>. Quem já respondeu e quem está sem e-mail cadastrado ficam de fora; para um só, use o <b>Enviar</b> da linha.</span>
            <span>Precisa alcançar só alguns? <b>Marque</b> os fornecedores na lista — o botão passa a ser “Enviar aos marcados”. Marcar vale inclusive para <b>reenviar</b> a quem já respondeu, quando o formulário voltou errado.</span>
            <span>As respostas aparecem em <b>Credenciamentos recebidos</b>, na mesma subaba.</span>
          </Passos>
          <Dica>
            <b>Baixar Excel</b> gera a folha da <b>portaria</b>: uma linha por pessoa (fornecedor, nome, CPF, função)
            e outra tabela de veículos, mais a lista de quem <b>ainda não respondeu</b> — sem ela, a ausência de um
            nome no portão vira dúvida na hora de liberar a entrada.
          </Dica>
          <Tela titulo="custos-polobh.vercel.app/credenciamento/…">
            <div className="space-y-2 text-[12px]">
              <div className="font-display font-bold text-ink">Equipe</div>
              <div className="grid grid-cols-[1fr_90px_1fr] gap-1.5"><span className="bg-bg rounded px-2 py-1">Nome</span><span className="bg-bg rounded px-2 py-1">CPF</span><span className="bg-bg rounded px-2 py-1">Função</span></div>
              <div className="font-display font-bold text-ink pt-1">Veículos</div>
              <div className="grid grid-cols-[1fr_90px] gap-1.5"><span className="bg-bg rounded px-2 py-1">Modelo</span><span className="bg-bg rounded px-2 py-1">Placa</span></div>
            </div>
          </Tela>
          <Atencao>Após o <b>prazo limite</b>, o formulário não aceita mais envios.</Atencao>
        </Secao>
      </>
    ),
  },
  {
    id: "fornecedores",
    icone: <IcUsers />,
    titulo: "Fornecedores",
    resumo: "Cadastro com CNPJ automático, perfil tributário, contato e dados bancários.",
    tags: ["fornecedor", "cnpj", "cadastro", "perfil tributário", "mei", "simples", "banco", "pix", "contato", "contatos", "telefone", "e-mail", "cargo", "função", "agenda"],
    conteudo: (
      <>
        <Secao titulo="Cadastrar e consultar">
          <Passos>
            <span>Em <b>Fornecedores</b>, clique em <b>Novo fornecedor</b>.</span>
            <span>Digite o <b>CNPJ</b> e clique em <b>Consultar CNPJ</b> — razão social, perfil tributário e endereço vêm da base pública.</span>
            <span>Complete contato e dados bancários e <b>Salve</b>.</span>
          </Passos>
          <Dica>Use a busca no topo da lista para achar um fornecedor por nome, CNPJ, perfil tributário — ou pelo
            nome de uma pessoa da agenda de contatos.</Dica>
          <Atencao>
            A consulta de CNPJ olha o <b>cadastro da casa primeiro</b> e a Receita depois, e nunca apaga campo
            preenchido: inscrições, dados bancários e representante não existem em fonte pública — alguém da casa
            digitou aquilo uma vez.
          </Atencao>
        </Secao>
        <Secao titulo="Contatos: as pessoas do fornecedor">
          <p>
            O bloco <b>Contatos</b> é a agenda de quem se fala lá dentro — separado do contato da empresa, que é
            o que vai para a OS. Cada pessoa tem <b>Nome</b>, <b>Cargo / função</b>, <b>Telefone</b> e
            <b> E-mail</b> em campos próprios.
          </p>
          <Campos
            bloco="Cada contato"
            itens={[
              ["Nome", "equipe", "Quem é a pessoa."],
              ["Cargo / função", "equipe", "O que ela resolve ali: produção, financeiro, sócia. É o que responde “com quem eu falo sobre nota fiscal?”."],
              ["Telefone", "equipe", "Em DDD + número, para o celular reconhecer e discar."],
              ["E-mail", "equipe", "O endereço daquela pessoa, que pode não ser o da empresa."],
            ]}
          />
          <Dica>
            <b>Adicionar</b> cria um contato em branco e leva o cursor até ele. Contato deixado em branco some ao
            salvar, então não sobra linha vazia.
          </Dica>
          <Atencao>
            Os contatos informados nas ECs entram aqui sozinhos. Quando o nome já existe, o sistema
            <b> completa</b> o que faltava (o telefone, por exemplo) em vez de criar uma segunda pessoa igual — e
            nunca sobrescreve o que a equipe digitou no cadastro.
          </Atencao>
        </Secao>
        <Secao titulo="Dados Úteis do projeto">
          <p>
            Dentro de cada <b>Projeto</b>, a subaba <b>Fornecedores</b> é outra coisa: é a folha de contatos do
            evento — <b>Nome Fantasia · Itens da EC · Nome · Telefone · E-mail</b>, uma linha por fornecedor, com os
            serviços das várias OSs dele juntos.
          </p>
          <Dica>
            <b>Baixar Excel</b> gera essa folha em paisagem, para ir na prancheta no dia da montagem. Quem procura
            um telefone às sete da manhã não abre OS.
          </Dica>
        </Secao>
      </>
    ),
  },
  {
    id: "perfis",
    icone: <IcShield />,
    titulo: "Perfis & permissões",
    resumo: "O que cada perfil (Admin, Direção, Produção, Administrativo) pode ver e fazer.",
    tags: ["perfil", "permissão", "papel", "admin", "direção", "produção", "administrativo", "acesso", "financeiro", "rls"],
    conteudo: (
      <>
        <Secao titulo="Os quatro perfis">
          <div className="space-y-2">
            <div className="rounded-card bg-bg p-3"><Tag tom="primary">Administrador</Tag> <span className="ml-1">acesso total + a tela de <b>Logs</b>. Perfil do desenvolvedor/gestor do app.</span></div>
            <div className="rounded-card bg-bg p-3"><Tag tom="info">Direção</Tag> <span className="ml-1">acesso total ao operacional, incluindo o <b>bloco financeiro</b> e Configurações.</span></div>
            <div className="rounded-card bg-bg p-3"><Tag tom="success">Produção</Tag> <span className="ml-1">cria e edita ECs/OSs, mas <b>não vê o financeiro</b> nem Configurações.</span></div>
            <div className="rounded-card bg-bg p-3"><Tag tom="warning">Administrativo</Tag> <span className="ml-1">vê o <b>financeiro</b> e Configurações; não edita ECs.</span></div>
          </div>
          <Dica>A matriz completa de perfis × recursos fica em <b>Configurações</b>.</Dica>
        </Secao>
      </>
    ),
  },
  {
    id: "logs",
    icone: <IcActivity />,
    titulo: "Logs do sistema",
    resumo: "Trilha de auditoria de tudo que acontece no app (somente Administrador).",
    tags: ["logs", "auditoria", "histórico", "eventos", "acesso negado", "exportar", "csv", "admin"],
    conteudo: (
      <>
        <Secao titulo="Para que serve">
          <p>Visível apenas para o <b>Administrador</b>. Registra logins, alterações em EC/OS/cadastros, tentativas de acesso negado e exportações — para manutenção e segurança.</p>
          <Passos>
            <span>Abra <b>Logs do sistema</b> no menu.</span>
            <span>Filtre por <b>categoria</b>, <b>nível</b> ou use a <b>busca</b>.</span>
            <span>Use <b>Exportar CSV</b> para baixar a trilha filtrada.</span>
          </Passos>
        </Secao>
      </>
    ),
  },
  {
    id: "helpdesk",
    icone: <IcSuporte />,
    titulo: "Help Desk",
    resumo: "Abrir chamado para o suporte, acompanhar a resposta e continuar a conversa — tudo dentro do aplicativo.",
    tags: ["help desk", "helpdesk", "suporte", "chamado", "erro", "bug", "ajuda", "problema", "reclamação", "sugestão", "resposta", "fila"],
    conteudo: (
      <>
        <Secao titulo="Quando usar">
          <p>
            Quando alguma coisa <b>não funciona como deveria</b>, quando você tem dúvida de uso que o Guia não
            responde, ou quando tem uma <b>sugestão</b>. O botão fica no cabeçalho, ao lado do Guia.
          </p>
          <Dica>
            Antes de abrir, vale conferir três coisas que resolvem a maioria dos casos: item da EC que <b>não vira
            OS</b> costuma ter um campo obrigatório em falta (a tela diz qual, item a item); valor que <b>não
            aparece</b> costuma ser permissão (os blocos financeiros são restritos); e e-mail que “não chegou”
            costuma ser a <b>homologação</b>, que desvia tudo para a caixa de teste.
          </Dica>
        </Secao>
        <Secao titulo="O que vai no chamado">
          <Campos
            bloco="Novo chamado"
            itens={[
              ["Tipo", "escolha", "Erro no sistema, dúvida de uso, sugestão de melhoria ou acesso e permissões."],
              ["Assunto", "equipe", "Uma frase. “A OS não salva quando o fornecedor é MEI” diz mais que “erro na OS”."],
              ["O que aconteceu", "equipe", "O que você fez, o que esperava e o que aconteceu. Quanto mais concreto, menos idas e vindas."],
              ["Tela", "auto", "De onde você veio — o sistema preenche sozinho. Corrija se o problema foi em outro lugar."],
              ["Navegador e tamanho da tela", "auto", "Vai junto sem você precisar saber qual é: metade dos “aqui não funciona” mora nisso."],
            ]}
          />
          <p>
            O chamado fica <b>registrado no sistema</b> e avisa por e-mail o suporte configurado em
            <b> Configurações › Geral</b>. Toda abertura e todo encerramento também entram nos
            <b> Logs do sistema</b>.
          </p>
        </Secao>
        <Secao titulo="Acompanhar e responder">
          <p>
            A aba <b>Meus chamados</b> lista o que você abriu, do mais recente para o mais antigo. Clique num chamado
            para ler a conversa inteira e <b>escrever de volta</b> ali mesmo — não é preciso abrir outro chamado para
            completar um relato ou dizer que continua acontecendo.
          </p>
          <p>
            A <b>situação</b> diz de quem é a vez, e o sistema a calcula a partir de quem falou por último:
          </p>
          <ul className="space-y-1.5 list-disc pl-5">
            <li><b>Aberto</b> — esperando o suporte.</li>
            <li><b>Respondido</b> — o suporte já falou; a bola está com você.</li>
            <li><b>Resolvido</b> — encerrado. Sai da fila, e <b>volta a abrir</b> se alguém responder de novo: é o que acontece de verdade quando o problema não estava resolvido.</li>
          </ul>
          <p>
            Quem abriu o chamado pode marcá-lo como resolvido a qualquer momento — é quem sabe se resolveu.
          </p>
          <Dica>
            Quando o suporte responde, você recebe um <b>e-mail</b> avisando, e a resposta fica guardada no chamado.
            O e-mail é o aviso; a conversa mora no sistema, e continua ali mesmo que o e-mail se perca.
          </Dica>
        </Secao>
        <Secao titulo="Para quem atende (Administrador)">
          <p>
            Quem tem papel <b>Administrador</b> ganha uma terceira aba, <b>Fila do suporte</b>, com
            <b> todos</b> os chamados do sistema — filtrados por situação, e com o número de cada uma no próprio
            filtro. Além do relato, o atendente vê o <b>navegador e o tamanho da tela</b> de quem abriu.
          </p>
          <p>
            A resposta é escrita no próprio chamado: ela fica registrada na conversa <b>e</b> sai por e-mail para
            quem abriu. Os demais perfis continuam vendo apenas os seus próprios chamados — um chamado conta o que a
            pessoa estava fazendo e onde errou, e isso não é assunto de todo mundo.
          </p>
          <Atencao>
            O e-mail do Help Desk <b>sai de verdade</b>, e é o único que sai por enquanto — tanto o aviso de chamado
            novo quanto a resposta do suporte. Os disparos para fornecedor e cliente continuam em homologação, indo
            para a caixa de teste.
          </Atencao>
        </Secao>
      </>
    ),
  },
  {
    id: "emails",
    icone: <IcSend />,
    titulo: "E-mails automáticos",
    resumo: "Disparo de OS, credenciamento e aprovação — aguardando conexão com o Brevo.",
    tags: ["email", "e-mail", "brevo", "disparo", "envio", "aprovação", "credenciamento", "simulado"],
    conteudo: (
      <>
        <Secao titulo="Status atual">
          <Atencao>O envio de e-mails está <b>aguardando a conexão com o e-mail da Pólobh (Brevo)</b>. Enquanto isso, todas as ações de e-mail (disparar OS, enviar credenciamento, enviar EC para aprovação) funcionam em modo <b>simulado</b>: a ação acontece no sistema (status muda, registros são salvos), mas <b>nenhum e-mail sai de fato</b>.</Atencao>
          <p>Assim que o Brevo for conectado, os mesmos botões passam a enviar os e-mails de verdade — sem nenhuma mudança no uso.</p>
        </Secao>
      </>
    ),
  },
  {
    id: "configuracoes",
    icone: <IcGear />,
    titulo: "Configurações",
    resumo: "Matriz de perfis, retenção de dados e integrações/segurança.",
    tags: ["configurações", "matriz", "perfis", "retenção", "arquivamento", "integrações", "flags", "segurança", "lgpd"],
    conteudo: (
      <>
        <Secao titulo="O que tem aqui">
          <ul className="space-y-1.5 list-disc pl-5">
            <li><b>Matriz de perfis × recursos</b> — quem vê e edita cada módulo.</li>
            <li><b>Retenção de dados</b> — arquivamento automático (arquivar ≠ apagar).</li>
            <li><b>Integrações &amp; segurança</b> — status do CNPJ, e-mail (Brevo) e da trilha de auditoria.</li>
          </ul>
          <Atencao>Disponível para <b>Direção</b>, <b>Administrativo</b> e <b>Administrador</b>.</Atencao>
        </Secao>
      </>
    ),
  },
];

/**
 * O passo seguinte (ou o anterior) da leitura, no pé do módulo.
 *
 * Mostra o TÍTULO do módulo vizinho, e não só "próximo": a pessoa decide se
 * quer continuar sabendo para onde vai.
 */
function PassoModulo({
  lado,
  modulo,
  onClick,
}: {
  lado: "anterior" | "proximo";
  modulo: Modulo;
  onClick: () => void;
}) {
  const proximo = lado === "proximo";
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex-1 min-w-[13rem] flex items-center gap-3 px-4 py-3 rounded-card border border-border bg-surface",
        "hover:bg-[#FAFAFB] transition-colors text-left",
        proximo ? "flex-row-reverse text-right" : ""
      )}
    >
      <span className="text-ink-3 text-lg leading-none shrink-0">{proximo ? "→" : "←"}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
          {proximo ? "Próximo módulo" : "Módulo anterior"}
        </span>
        <span className="block text-[13.5px] font-bold text-ink leading-tight mt-0.5 truncate">{modulo.titulo}</span>
      </span>
    </button>
  );
}

/**
 * O convite para o tour guiado.
 *
 * Fica ACIMA da busca de propósito: quem chega ao Guia pela primeira vez não
 * sabe o que procurar — pesquisar pressupõe já conhecer o nome da coisa. O tour
 * é a porta de quem ainda não conhece nada; a busca é a de quem já conhece.
 */
function ConviteTour() {
  const abrir = useTour((s) => s.abrir);
  const [jaFez, setJaFez] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_TOUR) === "1";
    } catch {
      return false;
    }
  });

  function comecar() {
    try {
      localStorage.setItem(CHAVE_TOUR, "1");
    } catch {
      /* navegador sem armazenamento: o convite só volta a aparecer como novo */
    }
    setJaFez(true);
    abrir();
  }

  return (
    <div className="mb-5 rounded-card border border-active-border bg-primary-soft/50 p-4 md:p-5 flex items-center gap-4 flex-wrap">
      <span className="h-11 w-11 rounded-card bg-surface text-primary-dark grid place-items-center shrink-0 shadow-card">
        <IcCompass width={22} height={22} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display font-bold text-ink text-[17px] leading-tight">
          {jaFez ? "Refazer o tour guiado" : "Comece pelo tour guiado"}
        </h2>
        <p className="text-[13px] text-ink-2 mt-1">
          O caminho inteiro de um evento — <b>Projeto → EC → OS → acompanhamento</b> — mostrado nas telas de
          verdade, passo a passo. Uns 10 minutos, e nada é alterado no sistema.
        </p>
      </div>
      <Button onClick={comecar} icon={<IcCompass width={16} height={16} />}>
        {jaFez ? "Refazer" : "Começar o tour"}
      </Button>
    </div>
  );
}

/** Lembra que esta pessoa já conhece o tour — só muda o convite, nada mais. */
const CHAVE_TOUR = "polobh:tour-feito";

/* ================================ Página ================================ */

/**
 * Distância do topo da janela até onde o conteúdo pode começar: a barra de
 * navegação mais o cabeçalho grudado da página, que ficam por cima de tudo.
 * Sem descontar os dois, "rolar até o topo do módulo" enfiaria o título do
 * módulo embaixo do cabeçalho.
 */
function alturaDasCamadas(): number {
  const estilo = getComputedStyle(document.documentElement);
  const px = (nome: string) => parseFloat(estilo.getPropertyValue(nome)) || 0;
  return px("--altura-topnav") + px("--altura-cabecalho") + 16;
}

export function Guia() {
  const [busca, setBusca] = useState("");
  const [ativoId, setAtivoId] = useState("primeiros-passos");
  const conteudo = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  /**
   * Trocar de módulo tem de recomeçar a leitura no COMEÇO do módulo novo.
   *
   * A lista de módulos agora acompanha a rolagem, então o clique no próximo
   * módulo acontece lá no fundo da página — e, sem isto, a pessoa continuava
   * exatamente na mesma altura, caindo no meio de um texto que ela nunca leu.
   * Só rola quando já está ABAIXO do começo do conteúdo: quem clica com a
   * página no topo não é empurrado para lugar nenhum.
   */
  function abrirModulo(id: string) {
    setAtivoId(id);
    trazerParaALista(id);
    const card = conteudo.current;
    if (!card) return;
    const alvo = window.scrollY + card.getBoundingClientRect().top - alturaDasCamadas();
    if (window.scrollY <= alvo + 4) return;
    const suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(alvo, 0), behavior: suave ? "smooth" : "auto" });
  }

  /**
   * Deixa o módulo escolhido VISÍVEL dentro da lista que rola.
   *
   * Importa quando a escolha não veio da própria lista: avançando pelos botões
   * do pé do texto, o módulo aberto ia parar fora da parte visível da lista, e
   * o realce ficava num lugar que ninguém via. Mexe só na rolagem da lista —
   * a da página é assunto de `abrirModulo`.
   */
  function trazerParaALista(id: string) {
    const caixa = lista.current;
    const alvo = caixa?.querySelector<HTMLElement>(`[data-modulo="${id}"]`);
    if (!caixa || !alvo) return;
    const item = alvo.getBoundingClientRect();
    const janela = caixa.getBoundingClientRect();
    if (item.top < janela.top) caixa.scrollTop += item.top - janela.top - 8;
    else if (item.bottom > janela.bottom) caixa.scrollTop += item.bottom - janela.bottom + 8;
  }

  const filtrados = useMemo(() => {
    const termos = busca.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (termos.length === 0) return MODULOS;
    return MODULOS.filter((m) => {
      const alvo = [m.titulo, m.resumo, ...m.tags].join(" ").toLowerCase();
      return termos.every((t) => alvo.includes(t));
    });
  }, [busca]);

  const ativo = filtrados.find((m) => m.id === ativoId) ?? filtrados[0] ?? null;

  /**
   * Vizinhos do módulo aberto, para ler em sequência.
   *
   * No celular a lista fica ACIMA do texto e não acompanha a rolagem — quem
   * termina de ler está a uma tela inteira de distância do próximo módulo.
   * Estes dois botões fecham esse caminho: o passo seguinte nasce onde a
   * leitura termina.
   */
  const posicao = ativo ? filtrados.findIndex((m) => m.id === ativo.id) : -1;
  const anterior = posicao > 0 ? filtrados[posicao - 1] : null;
  const proximo = posicao >= 0 && posicao < filtrados.length - 1 ? filtrados[posicao + 1] : null;

  return (
    <PageShell
      title="Guia do aplicativo"
      subtitle="Documentação completa e didática de cada módulo. Pesquise para ir direto ao ponto."
    >
      <ConviteTour />

      {/* Busca */}
      <div className="relative max-w-xl mb-5">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"><IcSearch width={18} height={18} /></span>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar módulo ou assunto (ex.: BV, CNPJ, credenciamento, link público…)"
          className="w-full h-12 bg-surface border-[1.5px] border-[#BFC4CE] rounded-card pl-11 pr-3.5 text-sm text-ink placeholder:text-ink-3 input-focus"
        />
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">
        {/* TOC / lista de módulos */}
        {/* Abaixo da navegação + do cabeçalho grudado da página (ver PageShell). */}
        {/* A lista tem rolagem PRÓPRIA, e isso não é enfeite: são dezessete
            módulos, mais alto que qualquer tela. Grudada sem rolar, os últimos
            ficavam fora do campo de visão para sempre — para clicar em
            "Configurações" era preciso subir a página inteira, ler, e descer
            tudo de novo. Com rolagem própria, a lista inteira fica ao alcance
            em qualquer altura do texto. */}
        <nav
          className={cx(
            "flex flex-col gap-1.5 min-h-0",
            // No computador: acompanha a rolagem, limitada ao que sobra da tela.
            "lg:sticky lg:top-[calc(var(--altura-topnav)+var(--altura-cabecalho)+16px)]",
            "lg:max-h-[calc(100vh-var(--altura-topnav)-var(--altura-cabecalho)-2rem)]",
            // No celular a lista fica em cima do conteúdo: limitar a meia tela é
            // o que impede o texto de nascer a mil pixels de distância. A regra
            // do `lg` está numa media query, então ela vence esta aqui embaixo.
            "max-h-[46vh]"
          )}
        >
          <div className="px-1 mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-3 shrink-0">
            {busca ? `${filtrados.length} resultado(s)` : "Módulos"}
          </div>
          {filtrados.length === 0 && (
            <p className="text-[13px] text-ink-3 px-1">Nada encontrado para “{busca}”. Tente outro termo.</p>
          )}
          {/* `min-h-0` é o que faz a rolagem existir: sem ele o filho de um flex
              nunca encolhe abaixo do próprio conteúdo, e a barra não aparece.
              O `px-1 -mx-1` devolve o espaço que o corte da rolagem comeria do
              anel de foco do botão. */}
          <div ref={lista} className="flex-1 min-h-0 overflow-y-auto space-y-1.5 px-1 -mx-1 pb-1">
          {filtrados.map((m) => {
            const sel = ativo?.id === m.id;
            return (
              <button
                key={m.id}
                data-modulo={m.id}
                onClick={() => abrirModulo(m.id)}
                className={cx(
                  "w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-card border transition-colors",
                  sel ? "bg-primary-soft border-active-border" : "bg-surface border-border hover:bg-[#FAFAFB]"
                )}
              >
                <span className={cx("mt-0.5 shrink-0", sel ? "text-primary-dark" : "text-ink-3")}>{m.icone}</span>
                <span className="min-w-0">
                  <span className={cx("block text-[13.5px] font-bold leading-tight", sel ? "text-primary-dark" : "text-ink")}>{m.titulo}</span>
                  <span className="block text-[11.5px] text-ink-3 leading-snug mt-0.5">{m.resumo}</span>
                </span>
              </button>
            );
          })}
          </div>
        </nav>

        {/* Conteúdo */}
        <div ref={conteudo} className="min-w-0">
        {ativo ? (
          <Card className="!p-6 md:!p-8">
            <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border-soft">
              <span className="h-11 w-11 rounded-card bg-primary-soft text-primary-dark grid place-items-center">{ativo.icone}</span>
              <div>
                <h2 className="font-display font-bold text-ink text-[22px] tracking-[-0.4px] leading-none">{ativo.titulo}</h2>
                <p className="text-ink-2 text-[13px] mt-1.5">{ativo.resumo}</p>
              </div>
            </div>
            <div className="space-y-7">{ativo.conteudo}</div>

            {(anterior || proximo) && (
              <div className="mt-8 pt-5 border-t border-border-soft flex flex-wrap items-stretch gap-2.5">
                {anterior && <PassoModulo lado="anterior" modulo={anterior} onClick={() => abrirModulo(anterior.id)} />}
                {proximo && <PassoModulo lado="proximo" modulo={proximo} onClick={() => abrirModulo(proximo.id)} />}
              </div>
            )}
          </Card>
        ) : (
          <Card><p className="text-ink-3 text-sm">Selecione um módulo ou refine a busca.</p></Card>
        )}
        </div>
      </div>
    </PageShell>
  );
}
