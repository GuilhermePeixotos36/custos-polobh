import { useMemo, useState, type ReactNode } from "react";
import { PageShell } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui";
import {
  IcSearch, IcGrid, IcDoc, IcClipboard, IcCalendar, IcUsers, IcGear,
  IcActivity, IcShield, IcSend, IcCheck, IcBook, IcClock, IcBell,
} from "@/components/icons";
import { cx } from "@/lib/format";

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
        <Secao titulo="O menu lateral">
          <p>À esquerda fica o menu. Os itens visíveis dependem do seu perfil — você só vê o que tem permissão de usar.</p>
          <div className="flex flex-wrap gap-1.5">
            <Tag tom="primary">Projetos</Tag><Tag>Estimativas (EC)</Tag><Tag>Ordens de Serviço</Tag>
            <Tag>Cronogramas</Tag><Tag>Fornecedores</Tag><Tag>Configurações</Tag><Tag>Logs</Tag><Tag>Guia</Tag>
          </div>
          <Dica>Está com dúvida em algum módulo? Volte sempre aqui no <b>Guia</b> e use a busca no topo.</Dica>
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
        <Secao titulo="O que vira pendência">
          <div className="flex flex-wrap gap-1.5">
            <Tag tom="primary">Comentário em aberto</Tag><Tag tom="primary">Tarefa de hoje ou atrasada</Tag>
            <Tag tom="primary">OS a emitir</Tag><Tag tom="primary">Contrato a emitir</Tag>
            <Tag tom="primary">Cronograma da OS vazio</Tag><Tag tom="primary">Credenciamento sem resposta</Tag>
            <Tag tom="primary">Projeto sem EC</Tag>
          </div>
          <p>
            Nos itens da EC, <b>OS</b> ou <b>Contrato</b> em <Tag tom="warning">Emitir</Tag> ou
            <Tag tom="warning">Emitir Nova Versão</Tag> viram pendência <b>item a item</b> — cada uma leva à linha certa
            e faz o campo piscar.
          </p>
          <Atencao>Projeto <b>arquivado ou cancelado</b> encerra todas as pendências dele.</Atencao>
        </Secao>
        <Secao titulo="Achar a pendência na tela">
          <p>
            Todo número do sistema sai da <b>mesma lista</b>: o do sininho, o da aba, o do item e o da pílula do canto
            inferior direito. O que é contado sempre pode ser encontrado.
          </p>
          <Passos>
            <span>O <b>sininho</b> no canto superior direito abre tudo o que está pendente com você, agrupado por projeto. Clicar num bloco <b>abre a tela</b> da pendência com a câmera em cima dela.</span>
            <span>A <b>pílula</b> do canto inferior direito anda pelas pendências <b>da tela aberta</b>, uma a uma, pelas setas ▲ ▼.</span>
            <span>Ao chegar, o item <b>lateja em vermelho</b>: a cadeia de comentários abre e o comentário pendente pisca — ou o campo <b>OS/Contrato</b>, quando a pendência é emitir.</span>
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
        <Secao titulo="Opções de valor do item (o que sai na OS)">
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
            <span>O <b>rádio</b> marca qual das três <b>vale</b> para o item. É ela que a planilha da OS imprime, logo abaixo de "Valor do Item na EC do Projeto".</span>
            <span>Marcar "Não se aplica" <b>não apaga</b> o valor digitado: dá para voltar atrás sem perder o que estava escrito.</span>
          </Passos>
          <Dica>Uma opção marcada como "Não se aplica" sai na planilha com esse texto e <b>não entra</b> no total das opções escolhidas.</Dica>
        </Secao>
        <Secao titulo="Enviar para aprovação, versões e Excel">
          <Passos>
            <span>Na EC, em <b>Ações</b>, use <b>Enviar ao cliente para aprovação</b> — a EC vai para o status <Tag tom="warning">Aguardando</Tag>.</span>
            <span><b>Gerar nova versão (V02…)</b> cria uma cópia que “cancela e substitui” a anterior — use quando o escopo muda.</span>
            <span><b>Duplicar EC</b> cria uma nova estimativa (V01, Rascunho) a partir desta.</span>
            <span><b>Importar EC</b> (na aba EC do projeto) copia os itens e valores de <b>qualquer</b> EC — deste projeto ou de outro, ativa ou arquivada — para cá, como um <Tag tom="info">Rascunho</Tag> novo. A EC de origem não é tocada.</span>
            <span><b>Excel Financeiro</b> exporta somente itens e valores; <b>Excel Completa</b> inclui todos os dados e as descrições completas.</span>
          </Passos>
          <Dica>
            Cada projeto tem <b>uma</b> EC <Tag tom="success">Ativa</Tag> — a versão que vale. As outras podem ser
            <Tag tom="info">Rascunho</Tag> (cópia ou importação ainda em aberto, <b>editável</b>) ou
            <Tag>Arquivada</Tag> (substituída por uma versão nova, preservada como está). Para promover um rascunho,
            use <b>Tornar EC ativa</b> no detalhe.
          </Dica>
          <Atencao>Arquivar e Cancelar <b>não apagam</b> a EC — ela continua consultável. Nada é excluído de fato.</Atencao>
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
        <Secao titulo="Bloco financeiro (restrito)">
          <p>O bloco <b>Financeiro Pólobh</b> (BV, valor a pagar, margem) só aparece para os perfis <b>Direção</b>, <b>Administrativo</b> e <b>Administrador</b>. A <b>Produção</b> não vê esses valores — nem na tela, nem pela API.</p>
        </Secao>
        <Secao titulo="Disparar e exportar">
          <Passos>
            <span><b>Disparar OS</b> muda o status para <Tag tom="success">Disparada</Tag> e envia a OS ao fornecedor por e-mail.</span>
            <span><b>Baixar PDF</b> gera o documento da OS já na janela de salvar (o PDF respeita seu perfil quanto ao financeiro).</span>
          </Passos>
          <Atencao>O <b>envio de e-mail está aguardando a conexão com o Brevo</b> da Pólobh. Até lá, o disparo é <b>simulado</b> — a OS é salva e o status muda, mas nenhum e-mail sai de fato.</Atencao>
        </Secao>
      </>
    ),
  },
  {
    id: "checklist",
    icone: <IcCheck />,
    titulo: "Check-list do projeto (Work Flow)",
    resumo: "Lista de tarefas com prazo e dono, gerada do modelo da modalidade.",
    tags: ["check-list", "checklist", "work flow", "workflow", "tarefa", "tarefas", "prazo", "etapa", "modelo", "responsável", "concluir", "atrasada", "pendência"],
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
            <span>Ajuste responsável, prazo e status tarefa a tarefa. Dá para <b>adicionar tarefas</b> que só existem neste projeto.</span>
          </Passos>
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
    id: "agenda",
    icone: <IcClock />,
    titulo: "Agenda",
    resumo: "Todas as tarefas de todos os projetos, na ordem em que vencem.",
    tags: ["agenda", "hoje", "semana", "atrasadas", "tarefas", "prazo", "check-list", "minhas tarefas", "pauta"],
    conteudo: (
      <>
        <Secao titulo="O que a Agenda responde">
          <p>
            Dentro do projeto você vê <b>um projeto por vez</b>. A Agenda responde a outra pergunta:
            <b> o que precisa acontecer esta semana na Pólobh inteira?</b>
          </p>
          <Tela titulo="Agenda">
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center gap-2"><Tag tom="warning">Atrasadas</Tag><span className="text-ink-3">o que exige ação hoje</span></div>
              <div className="flex items-center gap-2"><Tag tom="warning">Hoje</Tag><span className="text-ink-3">vence no dia</span></div>
              <div className="flex items-center gap-2"><Tag tom="info">Próximos 7 dias</Tag><span className="text-ink-3">a semana à frente</span></div>
              <div className="flex items-center gap-2"><Tag>Próximos 30 dias · Mais adiante · Sem data</Tag></div>
            </div>
          </Tela>
        </Secao>
        <Secao titulo="Como usar">
          <Passos>
            <span>A tela abre filtrada em <b>você</b> — a leitura mais frequente é "o que é meu".</span>
            <span>Troque o filtro para <b>Todos</b> e ela vira a <b>pauta da reunião de produção</b>.</span>
            <span>Marque a tarefa como concluída ali mesmo, ou clique nela para abrir o projeto na aba do check-list.</span>
          </Passos>
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
            <span>As respostas aparecem em <b>Credenciamentos recebidos</b>, na mesma subaba.</span>
          </Passos>
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
    tags: ["fornecedor", "cnpj", "cadastro", "perfil tributário", "mei", "simples", "banco", "pix", "contato"],
    conteudo: (
      <>
        <Secao titulo="Cadastrar e consultar">
          <Passos>
            <span>Em <b>Fornecedores</b>, clique em <b>Novo fornecedor</b>.</span>
            <span>Digite o <b>CNPJ</b> e clique em <b>Consultar CNPJ</b> — razão social, perfil tributário e endereço vêm da base pública.</span>
            <span>Complete contato e dados bancários e <b>Salve</b>.</span>
          </Passos>
          <Dica>Use a busca no topo da lista para achar um fornecedor por nome, CNPJ ou perfil tributário.</Dica>
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

/* ================================ Página ================================ */

export function Guia() {
  const [busca, setBusca] = useState("");
  const [ativoId, setAtivoId] = useState("primeiros-passos");

  const filtrados = useMemo(() => {
    const termos = busca.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (termos.length === 0) return MODULOS;
    return MODULOS.filter((m) => {
      const alvo = [m.titulo, m.resumo, ...m.tags].join(" ").toLowerCase();
      return termos.every((t) => alvo.includes(t));
    });
  }, [busca]);

  const ativo = filtrados.find((m) => m.id === ativoId) ?? filtrados[0] ?? null;

  return (
    <PageShell
      title="Guia do aplicativo"
      subtitle="Documentação completa e didática de cada módulo. Pesquise para ir direto ao ponto."
    >
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
        <nav className="lg:sticky lg:top-[calc(var(--altura-topnav)+var(--altura-cabecalho)+16px)] space-y-1.5">
          <div className="px-1 mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            {busca ? `${filtrados.length} resultado(s)` : "Módulos"}
          </div>
          {filtrados.length === 0 && (
            <p className="text-[13px] text-ink-3 px-1">Nada encontrado para “{busca}”. Tente outro termo.</p>
          )}
          {filtrados.map((m) => {
            const sel = ativo?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setAtivoId(m.id)}
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
        </nav>

        {/* Conteúdo */}
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
          </Card>
        ) : (
          <Card><p className="text-ink-3 text-sm">Selecione um módulo ou refine a busca.</p></Card>
        )}
      </div>
    </PageShell>
  );
}
