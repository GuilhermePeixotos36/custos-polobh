# Pólobh — Estimativas (EC) e Ordens de Serviço (OS)

Aplicação web que substitui o controle manual em Excel da **Pólobh Eventos**.
Premissa: **simplicidade** — poucos cliques, baixa manutenção (um dev + IA),
baixo custo (mira o plano gratuito do Supabase).

## Stack
- **Frontend:** Vite + React + TypeScript + Tailwind CSS, `react-router-dom`, `zustand`.
- **Dados:** Supabase/Postgres com RLS e camada de repositório em `src/data/`.
- **Excel:** ExcelJS (aplica estilos, ao contrário do SheetJS).
- **Hospedagem alvo:** Vercel (frontend) + Supabase (dados).

## Rodar
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção
npm run lint     # tsc --noEmit
```
O login usa Supabase Auth e as permissões do perfil cadastrado.

## Estrutura
```
public/
  polobh-logo.png            logo (sidebar/login/cronograma público)
  templates/OS_template.xlsx template real da OS (preenchido pelo ExcelJS)
src/
  components/ui/             design system (Button, Badge, Card, Field, Table…)
  components/layout/         Sidebar, Topbar, AppLayout, nav, guarda por recurso
  data/                      types, repository e implementação Supabase
  domain/calc.ts             cálculos da EC, numeração, consolidação EC→OS
  domain/checklist.ts        régua de prazos e estados do check-list (Work Flow)
  domain/mudancasEvento.ts   o que mudou nos dados gerais e o que fazer com EC/OS já emitidas
  domain/anexos.ts           o que é um "arquivo leve" nos comentários do check-list
  domain/calendario.ts       período do projeto e recorte mês a mês do quadro do ano
  domain/pendencias.ts       motor de pendências que alimenta os badges vermelhos
  lib/                       format, cnpj (BrasilAPI), ai (flag), flags, excel/
  pages/                     telas (Login, Projetos, EC*, OS*, Calendário, Agenda…)
  store/auth.ts              perfil + matriz de permissões
supabase/schema.sql          schema completo + RLS
supabase/migrations/         atualizações incrementais do banco
```

## Perfis de acesso
| Recurso | Direção | Produção | Administrativo |
|---|:--:|:--:|:--:|
| Dashboard / ECs (consulta) / OSs / Cronogramas / Fornecedores | ✅ | ✅ | ✅ |
| Calendário do ano (mesma permissão de Projetos) | ✅ | ✅ | ✅ |
| Check-list do projeto / Agenda (ver e editar) | ✅ | ✅ | ✅ |
| Editar EC | ✅ | ✅ | — |
| Modelos de check-list (Configurações) | ✅ | — | — |
| Bloco financeiro / Configurações | ✅ | — | ✅ |

## Versões da EC (o que é editável)
Cada projeto tem **uma** EC ativa. O par `status` + `ativa` é lido num lugar só
(`domain/ec.ts` → `situacaoEc`), em quatro situações:
- **Ativa** — a versão que vale, editável;
- **Rascunho** — cópia/importação em aberto que ainda não é a ativa: **editável**
  (é o estado em que nascem `Importar EC` e `Duplicar`);
- **Arquivada** — substituída por uma versão nova: preservada, não edita;
- **Cancelada** — não edita.

A trava do editor é sobre o que já foi **finalizado**, não sobre ser a ativa —
antes um rascunho recém-importado caía direto em "Edição bloqueada" e aparecia
com selo de "Arquivada" na lista.

**Quem sai do ar, sai arquivada** (migração `20260908120000`). `definir_ec_ativa`
e `salvar_ec_completa` só baixavam a bandeira `ativa` da versão anterior, e ela
ficava com status `Rascunho`: a lista mostrava **"Rascunho"** numa EC já
substituída — inclusive contrariando a confirmação da própria tela ("as demais
versões passam a arquivadas"). Agora as duas arquivam quem perde o ar, e
`Rascunho + não ativa` volta a significar uma coisa só: **nunca entrou no ar** —
o estado da importação e da cópia. A migração ainda acerta o que já está
gravado, por um corte conservador: só vira `Arquivada` a EC não-ativa em
`Rascunho` criada **antes** da EC que hoje está no ar no mesmo projeto (uma
cópia/importação nasce sempre depois dela, então não é tocada).

### Importar EC
Copia a estrutura de custos de **qualquer** EC — deste projeto ou de outro, em
**qualquer estado** (ativa, rascunho, arquivada ou cancelada) — para cá, como
rascunho não-ativo. A origem não é tocada e a EC ativa do destino continua ativa.
Importar uma **arquivada** é o caso mais comum, e não uma exceção: é a que já deu
certo uma vez.

A cópia das linhas acontece **dentro do banco** (`importar_ec`, mesma migração),
e isso não é detalhe de implementação. Feita no navegador, ela lia a EC de origem
pela view mascarada `ec_linhas_visiveis` — que devolve `NULL` nos valores para
quem não tem o recurso financeiro — e `mapLinha` convertia esses `NULL` em `0`:
para **Produção**, que pode criar EC e não vê valor, a EC importada nascia com
todos os custos **zerados**, em silêncio. A proteção que já existia em
`salvar_ec_completa` não alcançava o caso: ela vive no `on conflict do update`, e
aqui as linhas são inseridas. A mesma RPC serve à cópia de "Reativar gerando uma
nova versão" (`repo.ecs.duplicar`), que tinha o mesmo furo. Ninguém passa a
enxergar o que não enxergava: a EC nova é relida pela view de sempre.

A **versão** também sai do banco, sob o mesmo `advisory lock` das demais funções
— no navegador ela era calculada a partir de uma lista carregada minutos antes, e
duas importações simultâneas nasciam com o mesmo número.

## Pendências (quem vê o quê)
O número vermelho é uma lista de tarefa, não um painel do que anda acontecendo.
Duas portas, e só elas (`domain/pendencias.ts` → `agregarPendencias`):
- o **Produtor(a) Responsável** do projeto — **sempre**, e para ele conta
  **qualquer** pendência nascida ali dentro, inclusive a conversa que no momento
  está com outra pessoa;
- o **destinatário** da cobrança — @mencionado ou escolhido como responsável do
  comentário, e o dono da tarefa do check-list. É o "eventualmente": entra e sai
  conforme a vez (ver a batata quente, abaixo).

Não abrem porta: o **papel** (antes todo Admin/Direção/Administrativo via "emitir
OS" da casa inteira) e o **autor** do comentário (quem cobrava carregava a
pendência do outro).

### Conversa: a batata quente (`destinatariosDaVez`)
Uma observação não é um recado pendurado no primeiro destinatário até alguém
apagá-lo: é uma **conversa**, e a cada mensagem a bola passa. Quem responde já
agiu — a bolinha sai de quem falou e acende para quem tem de responder —, e isso
se repete até alguém apertar **Resolver**, que encerra a thread para todos.

A vez sai da **última mensagem**: quem ela @menciona (na raiz, também o
responsável escolhido no campo); sem menção, volta para quem estava esperando (o
autor da mensagem anterior que não seja da mesma pessoa); nunca o autor da
própria última mensagem. A thread mostra isso em cada item: **Sua vez** ou
*Aguardando Fulano*.

O **Produtor Responsável vê a conversa sempre** (revisão de 08/09/2026), mesmo
quando a vez é de outra pessoa: por um tempo ele só entrava na própria vez, para
o badge não crescer a cada resposta trocada entre duas colegas, e o preço foi
alto — uma cobrança podia ficar semanas parada com outra pessoa sem que quem
responde pelo projeto tivesse qualquer sinal. Quem entra e sai é o destinatário.

Geram pendência: comentário em aberto (**conversa geral da EC**, item da EC, OS e
check-list), tarefa de hoje ou atrasada, **OS e Contrato do item da EC em
"Emitir"/"Emitir Nova Versão"** (uma por item), OS em rascunho, cronograma da OS
vazio, credenciamento sem resposta e projeto ativo sem EC. Projeto
arquivado/cancelado encerra todas; **item oculto da EC não cobra nada** (está
guardado, fora dos totais, do Excel e da tela — cobrar ali seria número sem
endereço).

### Onde cada número é contado
Cada pendência tem **uma** tela onde se resolve (`telaDaPendencia`) e uma
`ancora`: o elemento que a pílula de localização procura no DOM. Daí sai tudo —
a rota do sininho, o badge da listagem e a pílula —, e por isso **o badge de uma
etapa é sempre igual ao número da pílula daquela etapa**:

| badge | conta | confere com |
| --- | --- | --- |
| linha da EC / da OS na listagem | o que se resolve dentro dela | a pílula ao abrir aquela EC/OS |
| título da subguia do projeto | tudo daquela `aba` — o da própria subguia **mais** o das ECs/OSs que ela lista | a soma dos badges da lista, e a pílula da subguia |
| linha do projeto em Projetos | a soma das subguias | — |
| sininho | tudo o que é seu | a soma dos blocos que ele abre |

Na subguia do projeto a pílula **não navega**: a pendência que mora numa EC/OS
aparece ancorada na **linha da listagem** (`pendenciasDaTela` troca a âncora), e
a linha lateja — abrir a EC/OS é o passo seguinte, dado por quem clica.

Três bugs que essa unificação fechou:
- a subguia **EC** contava uma a mais que a lista: era `projeto sem estimativa`,
  que não tem linha na lista. Agora ela acende ao lado do título do card
  *Estimativas (EC)*, onde ficam os comandos de criar a primeira;
- a linha da **EC** contava as pendências que se resolvem dentro da **OS** (elas
  carregam o `ecId` de origem) — coisas que não se acham lá dentro;
- **cronograma da OS vazio** e **credenciamento sem resposta** eram contados e não
  tinham endereço. O cronograma passou a ser cobrado na etapa da **OS** (é lá que
  se preenche) e o credenciamento pisca a linha do fornecedor no painel do
  projeto.

O **Calendário** não tem badge: ele divide o recurso de permissão com Projetos e
por isso herdava o número de lá, sem ter uma pendência sequer para mostrar. O
badge do menu agora é declarado por item (`NavItem.pendencias`).

### Observações gerais da EC
A conversa da equipe sobre o evento inteiro, antes de o assunto virar item de
alguém — "@Marisa o cliente cortou o coffee break". Fica no topo da EC, é
interna (não sai em documento, e-mail nem planilha) e convive com as observações
por item: aqui se combina, lá se acerta o custo.

Grava por caminho próprio (`ecs.observacoes` + `salvar_observacoes_ec`, migração
`20260902110000`), **fora** de `salvar_ec_completa` e sem tocar em
`atualizado_em`: comentar não é editar a estimativa, então uma mensagem não
esbarra na trava de edição de quem está mexendo nos custos, nem o formulário
aberto há meia hora sobrescreve o que foi dito nesse meio tempo. Quem enxerga a
EC pode conversar nela — inclusive o Administrativo, que não edita EC.

Todo número sai da mesma lista — sininho do topo, badge da aba, badge do item e a
pílula do canto inferior direito —, e cada pendência carrega o endereço da tela
(`ancora`, `observacaoId` ou `campo`), então o que é contado pode ser achado.

## Cálculos da EC (fixos)
- `somaFornecedores` = Σ(valor Pólobh) + Σ(produção)
- `honorários` = 15% · `encargos` = 16,33% (sobre fornecedores)
- `subTotalPolobh` = fornecedores + honorários + encargos
- `valorTotalBruto` = subTotalPolobh + somaCliente + honoráriosCliente
- Numeração da EC: `EC – {Cliente} – {Projeto} – V{NN}`.
- Título da OS: `OS – {Apelido do Cliente} – {Projeto} – {Ano} – {Apelido do Fornecedor} – ({NN}) em DD MM AA`.
  O `(NN)` é a **versão daquela OS** (primeira emissão (01); cada "Emitir Nova
  Versão" do mesmo fornecedor avança) — não confundir com `oss.seq`, que é a
  ordem da OS dentro da EC. O apelido do fornecedor é **gerado** de `razao_social`
  / `nome_fantasia` por `gerarApelidoFornecedor` (`domain/fornecedor.ts`), que
  descarta forma jurídica, recheio corporativo e descrição de atividade — só
  preservando a atividade quando ela faz parte do nome ("Casa da Cenografia").
  `fornecedores.apelido` preenchido é uma escolha manual e vence a geração.

## Check-list (Work Flow) do projeto
Substitui a cobrança informal por uma lista de tarefas com prazo, dono e histórico.

- **Modelos por modalidade** (Cultural / Corporativo) ficam em **Configurações →
  Check-list**, editáveis sem tocar em código. Cada tarefa declara sua
  régua de prazo: **percentual** da janela do projeto (0 % = início, 100 % = evento)
  ou **âncora** em dias do evento (ex.: −15 = quinze dias antes).
- **Geração automática:** abrir um projeto que tem modalidade e ainda não tem
  check-list já cria a lista. O **recálculo** de prazos, não — quando as datas do
  projeto mudam, a tela avisa e oferece o botão; ninguém tem prazo remexido sem saber.
- **Aba Check-list** (2ª aba do projeto, logo após Dados Gerais): tarefas por etapa
  ou por data, com responsável, status, observações (mesma thread da EC, com
  @menção) e **data de conclusão editável** — dela sai a leitura de "saiu no prazo".
- **Agenda** (menu Operação): todas as tarefas de todos os projetos na ordem em que
  vencem — atrasadas, hoje, 7 dias, 30 dias. Abre filtrada em quem está logado.
- **Pendências:** tarefa que vence **hoje ou já venceu** entra no quadro de
  pendências (badge vermelho + navegador do canto inferior direito), endereçada ao
  responsável da tarefa ou, na falta dele, ao Produtor Responsável do projeto.
- **Anexos leves na conversa** (só aqui): a foto da planta, o PDF do orçamento, a
  planilha do buffet — até **5 arquivos de 5 MB** por comentário, em imagem, PDF,
  Word, Excel, PowerPoint, CSV e TXT. Formato que o navegador **executa** (html,
  svg, js) não entra. Os bytes vão para o bucket fechado `anexos-checklist`
  (migração `20260908100000`) e a ficha do arquivo viaja dentro do próprio
  comentário, em `checklist_itens.observacoes` — nenhuma coluna nova. Para abrir,
  a tela pede um **link assinado de 60 s**; não existe URL permanente. O teto e a
  lista de tipos são propriedade do **bucket**, então a peneira do app só serve
  para dar a mensagem boa — quem manda é o servidor. Excluir o comentário apaga os
  arquivos dele; o autor pode tirar um anexo isolado. Ver `domain/anexos.ts`.

  **EC e OS não têm anexo de propósito:** lá o documento é o que a planilha e a OS
  impressa dizem, e um arquivo solto na thread criaria uma segunda versão da
  verdade num papel que vai para cliente e fornecedor.

Banco: `checklist_modelos`, `checklists`, `checklist_itens` (migração
`20260823100000_checklist_workflow.sql`).

## Calendário do ano (quadro dos projetos)
Substitui o quadro preto de parede onde a produção anotava, à mão, tudo o que
aconteceria no ano — agora preenchido sozinho pelos projetos já cadastrados.

- **O que entra:** só a **data do projeto**, isto é, a etapa **Evento** do
  cronograma (`info.cronograma.evento`). Montagem, alinhamentos, ensaios e
  desmontagem **não** entram: o quadro é de "quando o projeto acontece". O
  período é do **menor ao maior dia** da etapa (evento de um dia = um dia só);
  projeto anterior ao cronograma por faixas cai no campo legado `info.evento`.
- **Vista Calendário:** doze cards de mês, cada um com a mancha do mês em
  trilhas (projetos que se sobrepõem caem em linhas diferentes), a contagem e os
  nomes. **Vista Lista:** o mesmo conteúdo escrito, mês a mês — a leitura de
  bater o olho e imprimir.
- **Detalhamento do mês** (clicar no card): régua de 1 a 31, uma linha por
  projeto, e a **barra correndo do primeiro ao último dia**. Ponta reta + seta =
  o projeto começa antes ou termina depois daquele mês (ele aparece nos dois).
  Fim de semana sombreado, coluna de hoje em destaque; ←/→ folheiam os meses e
  viram o ano, Esc fecha.
- **Cor por projeto** é fixa (hash do id): a mesma no card, na barra e na lista,
  para reconhecer o projeto de longe.
- **Ano, mês aberto e vista moram na URL** (`/calendario?ano=2026&mes=3&vista=lista`)
  — o link mandado para a colega abre no que você está vendo.
- **Projeto sem data de evento** não some em silêncio: é cobrado na faixa do
  rodapé, com atalho para abrir e preencher.

Sem tabela nova no banco: o quadro é uma leitura de `projetos`
(`domain/calendario.ts`), com o status de cada projeto vindo de
`statusProjetoAutomatico`.

## Editar o evento sem reescrever o que já saiu
O evento é vivo: troca de local, muda o número de participantes, adianta um dia.
Os Dados Gerais do projeto acompanham isso — mas EC e OS são **documentos**, e
não podem mudar de conteúdo pelas costas de quem os recebeu.

- **Modo leitura por padrão.** A aba Dados Gerais abre travada; o botão
  **Editar dados gerais** libera os campos, com **Cancelar** (descarta) e
  **Salvar projeto**. Projeto novo já nasce em edição.
- **A OS emitida é imutável.** Cada OS guarda a própria foto dos dados gerais
  (`oss.projeto` e `oss.cliente`, migração `20260902100000`) — antes ela lia
  tudo da EC, e editar projeto ou EC reescrevia um papel já entregue. Documento,
  planilha e tela da OS leem esse snapshot; da EC vêm só os itens consolidados.
- **Ao salvar, o sistema pergunta.** Se a alteração alcança algo que EC/OS
  imprimem e o projeto já tem documento emitido, abre o comparativo
  (`campo: antes → depois`) com duas escolhas, ambas opcionais e desmarcadas:
  - **atualizar a EC** ainda em aberto (as OSs já emitidas continuam iguais);
  - **gerar nova versão de uma OS**: nasce rascunho com os dados novos, a
    anterior é cancelada e fica no histórico. A cópia (itens, financeiro,
    contrato) acontece no servidor, via `gerar_nova_versao_os` — o financeiro
    tem RLS restrita e copiá-lo pela tela apagaria o que quem reemite não vê.
- **Fechar sem marcar nada é resposta legítima:** o projeto já está salvo, e a
  mudança vale para o que nascer daí em diante.

A comparação é feita pelo **texto que o documento imprime**
(`domain/mudancasEvento.ts`), não pelo dado cru: reordenar faixas do cronograma
ou salvar sem mexer em nada gera JSON diferente e papel idêntico — e papel
idêntico não é mudança.

## Geração de Excel
- **EC e OS:** ambas são **remontadas com a marca Pólobh** via ExcelJS (que aplica
  estilos, ao contrário do SheetJS). A OS segue os blocos do "Modelo Novo"
  (layout RÓTULO | VALOR); a EC segue o modelo original, incluindo os totais em
  **duas colunas (Pólobh | Cliente)** e o **bloco contratual** (Informações
  Gerais, aprovação do cliente, protocolo financeiro). Código em `src/lib/excel/`.
- **Fórmulas vivas:** os totais da EC (soma, 15%, 16,33%, sub-total, total bruto,
  faturamentos) e os campos calculados da OS (valor a pagar, BV) saem como
  **fórmulas de Excel** — se a Marisa editar um valor na planilha baixada, tudo
  recalcula sozinho, como na planilha antiga dela.
- **Layout da EC** (medido célula a célula nos modelos de 2026, em `/reference`):
  corpo **11pt em tudo** (só o título do documento é 16), grade fina, faixas
  CLIENTE/PROJETO em cinza `D9D9D9`, ESTIMATIVA DE CUSTOS e Valor Total Bruto em
  âmbar `FFC000`, e realce de status por formatação condicional (acompanha a
  edição na planilha baixada).
- **Cada item é um BLOCO fechado:** o descritivo inteiro — Descrição (principal),
  Descrição Completa e observações — fica numa **única célula da coluna B**, e
  todas as demais colunas do item (o nome do item na A inclusive) são **mescladas
  na vertical** para acompanhá-la. O bloco leva moldura (`medium`) nos quatro
  lados, para um item não se confundir com o seguinte.
- **Nada é cortado:** a altura sai do conteúdo real e a largura das colunas de
  valor/status/documentação cresce quando precisa (as do modelo são o piso; A e B
  ficam fixas porque quebram texto). A altura de **linha** do Excel para em
  409,5pt, mas a de uma **célula mesclada** é a soma das linhas que ela ocupa: um
  descritivo grande faz o item ganhar quantas linhas forem necessárias, sem nunca
  repartir o texto nem estourar o teto de linha alguma.
- **Impressão:** área de impressão definida, ajuste à largura da página e
  cabeçalho da tabela de custos repetido em todas as páginas da EC.
- O template original da OS (`public/templates/OS_template.xlsx`) e a planilha
  `.xls` da EC ficam em `/reference` apenas como **referência de conteúdo** —
  não são mais preenchidos (eram formulários internos, visualmente pobres).
- **Exemplos:** `npm run gerar:exemplos` gera `exemplos/EC_exemplo.xlsx`,
  `exemplos/EC_exemplo_financeiro.xlsx` e `exemplos/OS_exemplo.xlsx` para
  conferência. O script **chama o gerador do app** (carregado pelo Vite), não uma
  cópia: a cópia que existia apodreceu e os exemplos saíam com o layout de 2022
  muito depois de o app ter migrado.
- **PDF:** `baixarPdfViaImpressao()` usa a impressão do navegador (`window.print`)
  sobre a visualização em tela. Estilos `@media print` em `src/index.css`.
- ExcelJS é carregado **sob demanda** (code-splitting) — não pesa no load inicial.

## Cabeçalho grudado
`PageShell` (`components/layout/AppLayout.tsx`) mantém título e ações colados
logo abaixo da TopNav enquanto a página rola — em tela longa (EC com dezenas de
itens, check-list inteiro) era preciso voltar ao topo só para salvar. Quem tem
fileira de ações própria passa por `acoes`; quem usa `topAction` já vem junto.

A altura real do bloco é publicada em `--altura-cabecalho` (medida por
`ResizeObserver`, porque os botões quebram para uma segunda linha em tela
estreita). Todo elemento grudado DENTRO da página se posiciona por
`calc(var(--altura-topnav) + var(--altura-cabecalho))` — é o caso da barra de
seleção de itens da EC e do índice do Guia.

## Listas de OS
Cada OS consolida VÁRIAS linhas da EC do mesmo fornecedor, e saber quais era o
que faltava nas listagens: só abrindo OS por OS. Uma coluna estreita **sem
cabeçalho**, ao lado do número, guarda esse conteúdo atrás de um ícone — passar
o mouse mostra, clicar prende (o caminho do toque), Esc/clique fora fecha.
Componente em `components/ColunaItensOs.tsx`; o vínculo vem de
`itensDaOs` (`domain/os.ts`), que casa `os.ecLinhaIds` com as linhas da EC.

Escrever os nomes na própria linha não serve: uma OS com oito itens esticaria a
linha e desalinharia a tabela. A caixinha é desenhada em portal com posição
fixa, porque dentro da célula a tabela a cortaria na borda.

## Integrações (prontas)
- **Consulta de CNPJ:** BrasilAPI para dados cadastrais e CNPJ.ws para Inscrição
  Estadual, ambas públicas e sem chave. Ligada por padrão (`VITE_FEATURE_CNPJ`).
  Para uma fonte contratada que também forneça Inscrição Municipal, configure
  `VITE_CNPJ_FISCAL_ENDPOINT` com uma URL contendo `{cnpj}`. Erros mantêm a edição manual.
- **Descritivo por IA:** `src/lib/ai.ts`, **desligado** (`VITE_FEATURE_IA=false`).
  Ao ativar, apontar `VITE_AI_ENDPOINT` para uma **Edge Function** (a chave de API
  fica no servidor — nunca no frontend).
- **Correção das descrições e roteiros:** ao salvar ECs e projetos, revisa ortografia,
  pontuação e maiúsculas via `corrigir-descricoes-ec`, preservando HTML, parágrafos, valores e
  termos técnicos. Publicar com
  `supabase functions deploy corrigir-descricoes-ec --project-ref <ref>`; usa o
  mesmo segredo `OPENROUTER_API_KEY` da função de resumo de proposta.

## E-mails automáticos (Brevo) — pronto para plugar
O app já tem a camada de e-mail (`src/lib/email/`) e dispara nos eventos da Pólobh:
- **Disparar OS** → e-mail ao fornecedor (OS form, botão "Disparar OS")
- **Credenciamento** → "Enviar ao fornecedor" no card de Credenciamento
- **EC para aprovação** → "Enviar ao cliente para aprovação" (EC detalhe)
- **Lembrete de cronograma** → automático, **2 dias úteis antes do evento**
  (Edge Function agendada `lembretes-cronograma`)

Segurança: o frontend **nunca** chama o Brevo direto. Ele faz POST numa **Edge
Function** (`supabase/functions/send-email`) que guarda a `BREVO_API_KEY` no
servidor. Enquanto `VITE_FEATURE_EMAIL=false` (ou sem endpoint), os envios são
**simulados** (toast informando) — dá para testar todo o fluxo sem configurar nada.

**Ativar o Brevo (plano gratuito, ~300 e-mails/dia):**
1. Criar conta no Brevo e gerar uma API key (SMTP & API → API Keys).
2. `supabase functions deploy send-email` e `supabase functions deploy lembretes-cronograma`.
3. `supabase secrets set BREVO_API_KEY=... BREVO_SENDER_EMAIL=contato@polobh.com.br BREVO_SENDER_NAME="Pólobh Eventos"`
   (validar o remetente/domínio no Brevo).
4. No `.env`: `VITE_FEATURE_EMAIL=true`; a sessão Supabase autentica a chamada automaticamente.
5. Criar `CRON_SECRET`, configurá-lo nos secrets da função e enviá-lo no header `x-cron-secret` do `pg_cron`.

## Banco Supabase
`supabase/schema.sql` é a **baseline** (o banco como estava em 21/07/2026). Tudo
que veio depois vive **só** em `supabase/migrations/` — inclusive módulos
inteiros: **Áreas/permissões** (09/08) e **Check-list (Work Flow)** (23/08). A
ordem importa:

1. **Instalação nova:** aplicar `supabase/schema.sql` (baseline).
2. Aplicar **todas** as migrations de `supabase/migrations/` em ordem de nome —
   também num banco recém-criado. Pular este passo faz o sistema nascer sem
   Áreas e sem Check-list.
3. Preencher `.env` a partir de `.env.example` e publicar as Edge Functions.

Nada é aplicado direto no painel do Supabase sem virar migração: foi assim que
`perfis.telefone` e a função `gerenciar-usuarios` ficaram só em produção, fora
do repositório.

**Coluna nova em `ec_linhas` exige mexer em `salvar_ec_completa`.** A função monta
as linhas com `jsonb_populate_recordset` e insere com `select *`: chave ausente no
JSON vira NULL na coluna, e o `default` não vale (o NULL é passado explicitamente).
Com `not null`, uma aba aberta no bundle anterior derruba toda gravação de EC —
foi o que aconteceu em 27/08/2026 com `valores_nao_aplicaveis`. A função hoje
preenche os padrões antes de popular o registro (`v_padroes`); acrescente a coluna
nova lá, e não só na lista do `on conflict do update`.

O mesmo vale para a view `ec_linhas_visiveis` e para `nova_versao_ec`, que
listam as colunas uma a uma. Quando a coluna nova é dinheiro (foi o caso de
`bv`, em 28/08/2026), ela precisa entrar MASCARADA na view e protegida no
`on conflict` — senão quem não enxerga o financeiro lê `null` e grava esse
`null` por cima do que estava lá.

**As migrations rodam UMA vez, na ordem do nome.** Reaplicar a pasta inteira do
zero num banco que já a tem falha em algumas delas (elas assumem o estado
anterior — por exemplo a que recria a view `ec_linhas_visiveis`). Isso é
esperado: cada arquivo é um passo, não um script repetível.

### Projeto de demonstração
`20260826110000_projeto_demonstracao.sql` insere um projeto inteiro de exemplo
(cliente, EC com 6 itens em 3 grupos, 2 OSs com financeiro, credenciamento
respondido e check-list com tarefa atrasada e de hoje) para conferir a
rentabilidade item a item, as opções de valor e as pendências com dados reais.
O cabeçalho do arquivo traz os `delete` para remover tudo quando não precisar mais.

## Retenção (baixo custo)
Guardamos **dados estruturados** e regeneramos Excel/PDF sob demanda. Projetos
concluídos são **arquivados (não apagados)** — configurável (sugestão 24 meses).
