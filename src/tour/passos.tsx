/**
 * O roteiro do tour guiado: o caminho que uma pessoa nova percorre para
 * entender o Pólobh inteiro, na ordem em que o trabalho acontece de verdade.
 *
 * O que este arquivo é: DADOS. Cada passo diz em que tela ele acontece, em que
 * elemento ele encosta e o que explica. Nenhuma conta de posição mora aqui (é
 * em `geometria`), nenhuma busca de elemento (é em `useAlvo`) — o que permite
 * mexer no texto e na ordem sem risco de quebrar o alinhamento.
 *
 * Duas regras que o roteiro respeita:
 *
 *  · O TOUR NÃO CRIA NADA. Ele abre um projeto, uma EC e uma OS que já existem,
 *    e a sobreposição bloqueia cliques enquanto roda. Ninguém termina o tour com
 *    um projeto de mentira salvo no sistema.
 *
 *  · CADA PASSO SOBREVIVE À FALTA DA TELA. Sem registro para abrir (casa nova),
 *    ou sem permissão para aquele recurso, o passo é retirado ou vira uma
 *    explicação no centro — nunca um retângulo apontando para o vazio.
 */
import type { ReactNode } from "react";
import type { Recurso } from "@/store/auth";
import type { Lado } from "./geometria";
import type { ContextoTour } from "./store";

export interface PassoTour {
  id: string;
  /** Etapa do processo — aparece acima do título, para a pessoa se situar. */
  capitulo: string;
  titulo: string;
  corpo: ReactNode;
  /** Rota da tela do passo. `null` = fica onde está. */
  rota?: string | null;
  /** Seletor do elemento destacado. Sem ele, o balão vai para o centro. */
  alvo?: string;
  /** Elemento que precisa ser CLICADO antes de medir (abas com estado interno). */
  abrirAntes?: string;
  posicao?: Lado;
  /** Passo só existe para quem tem este acesso. */
  recurso?: Recurso;
  /** Passo depende de um registro real; sem ele, vira explicação no centro. */
  precisa?: keyof ContextoTour;
}

/* ------------------------------ texto ---------------------------------- */

const P = ({ children }: { children: ReactNode }) => (
  <p className="text-[13px] leading-relaxed text-ink-2">{children}</p>
);

/**
 * Lista numerada do balão. Os itens vêm por PROPRIEDADE, e não como filhos:
 * um array passado como `children` é validado pelo React na criação do
 * elemento e exigiria uma `key` escrita à mão em cada item do roteiro.
 */
const Passos = ({ itens }: { itens: ReactNode[] }) => (
  <ol className="space-y-1.5 text-[13px] leading-relaxed text-ink-2">
    {itens.map((c, i) => (
      <li key={i} className="flex gap-2">
        <span className="mt-[3px] h-4 w-4 shrink-0 rounded-full bg-primary-soft text-primary-dark text-[10px] font-extrabold grid place-items-center">
          {i + 1}
        </span>
        <span className="min-w-0">{c}</span>
      </li>
    ))}
  </ol>
);

const Nota = ({ children }: { children: ReactNode }) => (
  <p className="text-[12px] leading-relaxed text-ink-2 bg-primary-soft/60 border-l-[3px] border-primary rounded-r-btn px-2.5 py-1.5">
    {children}
  </p>
);

/* ----------------------------- o roteiro -------------------------------- */

const PROJETO = "Projeto";
const EC = "Estimativa de Custo";
const OS = "Ordem de Serviço";
const ACOMPANHAR = "Acompanhamento";
const SISTEMA = "Cadastros e sistema";

export function montarPassos(ctx: ContextoTour, pode: (r: Recurso) => boolean): PassoTour[] {
  const proj = ctx.projetoId ? `/projetos/${ctx.projetoId}` : null;

  const todos: PassoTour[] = [
    /* ---------------------------- abertura ---------------------------- */
    {
      id: "inicio",
      capitulo: "Antes de começar",
      titulo: "O caminho de um evento no Pólobh",
      rota: "/guia",
      corpo: (
        <>
          <P>
            Tudo no sistema pendura em um <b>Projeto</b> — um evento. Dentro dele, o trabalho anda sempre na
            mesma ordem:
          </P>
          <Passos
            itens={[
              <><b>Projeto</b> — o evento, o cliente, as datas.</>,
              <><b>EC</b> — a estimativa: cada item, cada fornecedor, cada valor.</>,
              <><b>OS</b> — a ordem de serviço: o que foi aprovado vira documento para o fornecedor.</>,
              <><b>Acompanhamento</b> — check-list, cronograma e credenciamento até o evento acabar.</>,
            ]}
          />
          <Nota>
            Este tour <b>não altera nada</b>. Ele abre telas reais e mostra onde cada coisa acontece; os cliques
            no app ficam bloqueados enquanto ele roda.
          </Nota>
        </>
      ),
    },
    {
      id: "topnav",
      capitulo: "Antes de começar",
      titulo: "A barra de cima é o mapa",
      alvo: '[data-tour="topnav"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            Só entra aqui o que é <b>ponto de partida</b>: Calendário, Projetos e as telas de sistema.
          </P>
          <P>
            EC, OS, cronograma e credenciamento <b>não estão aqui de propósito</b> — eles não existem soltos, existem
            dentro de um projeto. É por isso que se chega neles entrando no projeto.
          </P>
          <P>A bolinha vermelha em cima de um ícone é o número de pendências suas naquela área.</P>
        </>
      ),
    },
    {
      id: "sino",
      capitulo: "Antes de começar",
      titulo: "O sino: tudo que é cobrado de você",
      alvo: '[data-tour="sino"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            O sino junta, de <b>todos os projetos</b>, o que está esperando por você: um comentário sem resposta, um
            item para aprovar, uma OS para emitir, uma tarefa vencendo.
          </P>
          <P>
            Clicar numa pendência abre <b>o lugar exato</b> dela — a linha da EC, o item do check-list — e faz o
            campo piscar. Você não precisa procurar.
          </P>
        </>
      ),
    },

    /* ----------------------------- projeto ---------------------------- */
    {
      id: "projetos-lista",
      capitulo: PROJETO,
      titulo: "Onde tudo começa",
      rota: "/projetos",
      recurso: "projetos",
      alvo: '[data-tour="projetos-filtros"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            Esta é a lista de eventos. Os botões da esquerda filtram por situação (<b>Ativos</b>, <b>Arquivados</b>)
            e a busca da direita procura por nome do evento ou do cliente.
          </P>
          <P>
            Cada linha mostra o cliente, as datas e quantas tarefas do check-list ainda estão abertas — dá para
            saber o que está atrasado sem abrir nada.
          </P>
        </>
      ),
    },
    {
      id: "novo-projeto",
      capitulo: PROJETO,
      titulo: "Criar um projeto",
      rota: "/projetos",
      recurso: "projetos.editar",
      alvo: '[data-tour="acoes-tela"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>É por aqui que um evento entra no sistema. O formulário pede, em ordem:</P>
          <Passos
            itens={[
              <><b>Cliente</b> — digite o CNPJ e clique em <b>Consultar CNPJ</b>: razão social, endereço e perfil
                tributário vêm preenchidos da base pública.</>,
              <><b>Dados do evento</b> — título, local, datas de montagem, realização e desmontagem.</>,
              <><b>Modalidade</b> — é ela que decide qual modelo de EC e de check-list o projeto vai usar.</>,
              <><b>Salvar</b> — só depois de salvar as outras seções abrem, porque elas precisam do projeto existindo.</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "projeto-cliente",
      capitulo: PROJETO,
      titulo: "O cadastro do cliente",
      rota: proj ? `${proj}?aba=dados` : null,
      precisa: "projetoId",
      recurso: "projetos",
      alvo: '[data-tour="projeto-cliente"]',
      posicao: "direita",
      corpo: (
        <>
          <P>
            O bloco do cliente é a base de tudo o que sai impresso depois: é dele que a EC e a OS puxam razão
            social, CNPJ e endereço.
          </P>
          <P>
            A consulta de CNPJ olha <b>o cadastro da casa primeiro</b> e a base pública depois, e <b>nunca apaga</b> um
            campo já preenchido — inscrições e dados bancários não existem em fonte pública, alguém da casa digitou
            aquilo uma vez.
          </P>
        </>
      ),
    },
    {
      id: "projeto-abas",
      capitulo: PROJETO,
      titulo: "As seções de um projeto",
      rota: proj ? `${proj}?aba=dados` : null,
      precisa: "projetoId",
      recurso: "projetos",
      alvo: '[data-tour="subguias"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>Com o projeto salvo, ele passa a ter sete seções — e elas são o resto do trabalho:</P>
          <Passos
            itens={[
              <><b>Dados Gerais</b> — cliente, evento, datas, equipe.</>,
              <><b>Check-list</b> — as tarefas até o evento acontecer.</>,
              <><b>EC</b> — as estimativas de custo, com todas as versões.</>,
              <><b>OS</b> — as ordens emitidas a partir das ECs.</>,
              <><b>Cronograma</b> — os horários de montagem e do evento.</>,
              <><b>Credenciamento</b> — quem entra: pessoas, veículos, acessos.</>,
              <><b>Fornecedores</b> — a folha de contatos do evento.</>,
            ]}
          />
        </>
      ),
    },

    /* -------------------------------- EC ------------------------------ */
    {
      id: "ec-acoes",
      capitulo: EC,
      titulo: "Criar uma estimativa",
      rota: proj ? `${proj}?aba=ec` : null,
      precisa: "projetoId",
      recurso: "ecs",
      alvo: '[data-tour="acoes-ec"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>Três caminhos, e a diferença entre eles importa:</P>
          <Passos
            itens={[
              <><b>Nova EC</b> — já vem com os itens do <b>modelo da modalidade</b> do projeto. É o caminho normal.</>,
              <><b>EC em branco</b> — sem nenhum item, para um evento que não se parece com nada.</>,
              <><b>Importar EC</b> — copia itens e valores de outra EC, deste projeto ou de qualquer outro.</>,
            ]}
          />
          <Nota>
            Uma EC nunca é apagada: quando o cliente pede mudança, o sistema gera <b>uma nova versão</b> e guarda a
            anterior. É o histórico da negociação.
          </Nota>
        </>
      ),
    },
    {
      id: "ec-grupos",
      capitulo: EC,
      titulo: "Os itens da EC",
      rota: ctx.projetoId ? `/estimativas/nova?projeto=${ctx.projetoId}` : null,
      precisa: "projetoId",
      recurso: "ecs.editar",
      alvo: '[data-tour="ec-grupos"]',
      posicao: "cima",
      corpo: (
        <>
          <P>
            A EC é uma lista de <b>grupos</b> (Cenografia, Alimentação, Locação…) e, dentro de cada um, os
            <b> itens</b>. Cada item é uma linha, e é a linha que carrega a informação inteira.
          </P>
          <P>
            Arraste pela alça para reordenar — inclusive de um grupo para outro. Clique na seta para recolher um
            grupo e enxergar o todo.
          </P>
        </>
      ),
    },
    {
      id: "ec-linha",
      capitulo: EC,
      titulo: "O que mora em uma linha",
      rota: null,
      precisa: "projetoId",
      recurso: "ecs.editar",
      alvo: '[data-tour="ec-grupos"]',
      posicao: "cima",
      corpo: (
        <>
          <Passos
            itens={[
              <><b>Item e descritivo</b> — o que será entregue.</>,
              <><b>Fornecedor</b> — CNPJ, razão social e o contato. O que for digitado aqui alimenta o cadastro de
                fornecedores sozinho.</>,
              <><b>Valores</b> — custo do fornecedor e preço ao cliente.</>,
              <><b>BV</b> — a bonificação da Pólobh naquele item, visível só para quem tem acesso financeiro.</>,
              <><b>Status da OS</b> — <b>Pendente</b>, <b>Emitir</b>, <b>Emitir Nova Versão</b>, <b>OK</b> ou
                <b> Não se Aplica</b>. É esta coluna que decide o que vira ordem de serviço.</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "ec-salvar",
      capitulo: EC,
      titulo: "Salvar e aprovar",
      rota: null,
      precisa: "projetoId",
      recurso: "ecs.editar",
      alvo: '[data-tour="acoes-tela"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            Ao salvar, o sistema <b>trava a EC se faltar informação obrigatória</b> — e, em vez de só avisar, ele
            leva você até o campo que falta e faz ele piscar.
          </P>
          <P>
            Depois de salva, a EC é aprovada <b>item a item</b>: cada linha tem seu próprio "OK". Só item aprovado
            vira OS.
          </P>
        </>
      ),
    },
    {
      id: "ec-emitir",
      capitulo: EC,
      titulo: "De EC para OS",
      rota: ctx.ecId ? `/estimativas/${ctx.ecId}` : null,
      precisa: "ecId",
      recurso: "oss.editar",
      alvo: '[data-tour="emitir-os"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            Este botão cria <b>uma OS por fornecedor</b>, juntando todos os itens aprovados daquele fornecedor que
            estejam marcados como <b>Emitir</b>.
          </P>
          <P>
            Item sem fornecedor identificado, ou ainda não aprovado, fica de fora — e o sistema diz quantos ficaram,
            para você não descobrir depois.
          </P>
        </>
      ),
    },

    /* -------------------------------- OS ------------------------------ */
    {
      id: "os-tela",
      capitulo: OS,
      titulo: "A ordem de serviço",
      rota: ctx.osId ? `/ordens/${ctx.osId}` : null,
      precisa: "osId",
      recurso: "oss",
      corpo: (
        <>
          <P>A OS é o documento que vai para o fornecedor. Ela nasce preenchida com o que o sistema já sabe:</P>
          <Passos
            itens={[
              <><b>Dados do Tomador</b> — vêm da empresa do grupo escolhida, sem ninguém digitar.</>,
              <><b>Fornecedor</b> — vem do cadastro; o que faltar lá, você completa aqui.</>,
              <><b>Itens</b> — vêm da EC, com os valores aprovados.</>,
              <><b>Dados para Contrato</b> — a seção só aparece quando algum item pede contrato.</>,
              <><b>Emissão de Nota Fiscal</b> — fecha com o <b>Valor total a pagar</b>.</>,
              <><b>Acertos Financeiros</b> — o BV da Pólobh, calculado, mais as observações.</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "os-pdf",
      capitulo: OS,
      titulo: "Entregar a OS",
      rota: null,
      precisa: "osId",
      recurso: "oss",
      alvo: '[data-tour="baixar-pdf"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            <b>Baixar PDF</b> gera a ordem pronta para assinar e enviar. É um botão só: o PDF abre já na janela de
            impressão, sem passo intermediário.
          </P>
          <P>
            Mudou alguma coisa na EC depois de emitida? Marque o item como <b>Emitir Nova Versão</b> e a OS é
            reemitida com o histórico preservado.
          </P>
        </>
      ),
    },

    /* -------------------------- acompanhamento ------------------------ */
    {
      id: "checklist",
      capitulo: ACOMPANHAR,
      titulo: "Check-list: o que fazer até o evento",
      rota: proj ? `${proj}?aba=checklist` : null,
      precisa: "projetoId",
      recurso: "checklists",
      alvo: '[data-subguia="checklist"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            As tarefas nascem de um <b>modelo</b> (configurado em Configurações → Check-list) escolhido pela
            modalidade do projeto — ninguém digita a mesma lista duas vezes.
          </P>
          <P>
            Cada tarefa tem responsável e prazo. O que estiver vencendo acende no <b>sino</b> e vira notificação no
            computador.
          </P>
        </>
      ),
    },
    {
      id: "calendario",
      capitulo: ACOMPANHAR,
      titulo: "Calendário: o ano inteiro",
      rota: "/calendario",
      recurso: "projetos",
      alvo: '[data-tour="nav-calendario"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            O mesmo conjunto de projetos, visto por <b>quando</b> em vez de por <b>onde está</b>: montagem,
            realização e desmontagem de cada evento no quadro do mês.
          </P>
          <P>É onde se enxerga dois eventos se sobrepondo antes de a equipe descobrir na marra.</P>
        </>
      ),
    },
    {
      id: "cronograma",
      capitulo: ACOMPANHAR,
      titulo: "Cronograma: os horários",
      rota: proj ? `${proj}?aba=cronograma` : null,
      precisa: "projetoId",
      recurso: "cronogramas",
      alvo: '[data-subguia="cronograma"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            Blocos de horário (montagem, evento, desmontagem) com os fornecedores de cada faixa. Dá para <b>enviar
            o cronograma por e-mail</b> a fornecedores escolhidos ou a todos, com um texto padrão.
          </P>
          <P>
            E existe um <b>link público</b>: o fornecedor abre o cronograma no celular, sem login e sem instalar
            nada.
          </P>
        </>
      ),
    },
    {
      id: "credenciamento",
      capitulo: ACOMPANHAR,
      titulo: "Credenciamento: quem entra",
      rota: proj ? `${proj}?aba=credenciamento` : null,
      precisa: "projetoId",
      recurso: "projetos",
      alvo: '[data-subguia="credenciamento"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            Um painel de todos os fornecedores do evento de uma vez — e não a mesma pergunta repetida dentro de cada
            OS.
          </P>
          <P>
            Cada fornecedor recebe um <b>link próprio</b> e preenche as pessoas e os veículos que vão entrar. O que
            eles enviam volta para cá, e a planilha sai em Excel para a portaria.
          </P>
        </>
      ),
    },
    {
      id: "dados-uteis",
      capitulo: ACOMPANHAR,
      titulo: "Dados Úteis: a folha do dia",
      rota: proj ? `${proj}?aba=fornecedores` : null,
      precisa: "projetoId",
      recurso: "projetos",
      alvo: '[data-subguia="fornecedores"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            Uma linha por fornecedor do evento: <b>nome · itens da EC · contato · telefone · e-mail</b>, com os
            serviços das várias OSs dele juntos.
          </P>
          <P>
            Baixe em Excel e leve na prancheta: quem procura um telefone às sete da manhã da montagem não vai abrir
            uma OS.
          </P>
        </>
      ),
    },

    /* ------------------------------ sistema --------------------------- */
    {
      id: "fornecedores",
      capitulo: SISTEMA,
      titulo: "Fornecedores: a memória da casa",
      rota: "/fornecedores",
      recurso: "fornecedores",
      // Sem `alvo`: o cadastro saiu do cabeçalho e não tem mais ícone para
      // apontar. O passo continua valendo — a tela existe e o tour navega até
      // ela —, só não destaca nada.
      posicao: "baixo",
      corpo: (
        <>
          <P>
            Aqui ficam inscrições, dados bancários e a <b>agenda de contatos</b> de cada fornecedor — nome, cargo,
            telefone e e-mail de cada pessoa.
          </P>
          <P>
            Este cadastro se alimenta sozinho: o fornecedor digitado numa EC entra aqui, e um contato de mesmo nome
            <b> completa</b> o que já existe em vez de virar uma segunda pessoa igual.
          </P>
        </>
      ),
    },
    {
      id: "configuracoes",
      capitulo: SISTEMA,
      titulo: "Configurações: as regras",
      rota: "/configuracoes",
      recurso: "configuracoes",
      alvo: '[data-tour="subguias"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>É daqui que saem os padrões que o resto do sistema usa:</P>
          <Passos
            itens={[
              <><b>Geral</b> — empresas do grupo, taxas e encargos que a EC aplica.</>,
              <><b>Check-list</b> — os modelos de tarefa por modalidade.</>,
              <><b>Áreas</b> e <b>Usuários</b> — quem é quem e o que cada perfil enxerga.</>,
              <><b>Notificações</b> — o aviso no computador e no celular, autorizado por aparelho.</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "modelos-checklist",
      capitulo: SISTEMA,
      titulo: "Modelos de tarefa",
      rota: "/configuracoes",
      recurso: "configuracoes",
      abrirAntes: '[data-subguia="checklist"]',
      alvo: '[data-subguia="checklist"]',
      posicao: "baixo",
      corpo: (
        <>
          <P>
            Um modelo por <b>modalidade</b>. Cada tarefa tem título, descrição, etapa, responsável padrão e prazo
            contado a partir da data do evento.
          </P>
          <P>
            Mudar o modelo <b>não mexe</b> nos check-lists já criados — projeto em andamento não muda de regra no
            meio do caminho.
          </P>
        </>
      ),
    },
    {
      id: "fim",
      capitulo: "Pronto",
      titulo: "É isso",
      rota: "/guia",
      recurso: "guia",
      corpo: (
        <>
          <P>
            Você percorreu o caminho inteiro: <b>Projeto → EC → OS → acompanhamento</b>. É essa ordem que o sistema
            protege — não dá para emitir uma OS de um item que ninguém aprovou.
          </P>
          <P>
            Cada módulo tem uma explicação detalhada aqui no Guia, campo por campo. E o tour pode ser refeito quando
            quiser, por este mesmo botão.
          </P>
        </>
      ),
    },
  ];

  return todos.filter((p) => !p.recurso || pode(p.recurso));
}

/**
 * Passo pronto para a tela: com o alvo e a rota já apagados quando o registro
 * que ele precisava não existe. É aqui que "casa sem nenhum projeto" deixa de
 * ser um retângulo apontando para o vazio e vira uma explicação no centro.
 */
export function prepararPasso(passo: PassoTour, ctx: ContextoTour): PassoTour {
  if (passo.precisa && !ctx[passo.precisa]) {
    return { ...passo, rota: null, alvo: undefined, abrirAntes: undefined };
  }
  return passo;
}
