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
  domain/anexos.ts           o que é um "arquivo leve" no check-list e no chamado
  domain/senha.ts            a régua da senha nova, e o inglês do Supabase em pt-BR
  lib/captura.ts             o print da tela, para o chamado do Help Desk
  components/suporte/        o painel do Help Desk, que abre sobre a tela
  domain/calendario.ts       período do projeto e recorte mês a mês do quadro do ano
  domain/pendencias.ts       motor de pendências que alimenta os badges vermelhos
  lib/                       format, cnpj (BrasilAPI), ai (flag), flags, excel/
  pages/                     telas (Login, Projetos, EC*, OS*, Calendário…)
  store/auth.ts              perfil + matriz de permissões
supabase/schema.sql          schema completo + RLS
supabase/migrations/         atualizações incrementais do banco
```

## A revisão de 15/09/2026 (check-list da Pólobh)

A Pólobh mandou um check-list de cerca de 120 pedidos sobre o aplicativo
inteiro. A leitura item a item — onde é no app, o que quiseram, o que muda —
está em [`docs/plano-ajustes-2026-09-15.md`](docs/plano-ajustes-2026-09-15.md),
com o que já foi feito, o que ficou pendente e por quê.

Vale ler antes de mexer no que ela tocou, porque vários pedidos **desfazem
decisões anteriores** documentadas aqui embaixo — e as seções que eles mudaram
estão atualizadas, mas a história de por que a regra era outra continua no
histórico do git. Os maiores:

- **a Produtora Responsável saiu das conversas** (era a regra de 08/09) e ficou
  só no que não tem destinatário nominal;
- **"Concluído" acabou** no projeto: sobraram Ativo e Arquivado, como na EC;
- **o Calendário passou a mostrar o período inteiro** (montagem → desmontagem),
  e não só a etapa Evento;
- **a OS ganhou fases** — produção monta, financeiro conclui, back-office
  emite — e abre em modo leitura;
- **"Disparada" deixou de ser status da OS** e virou carimbo de envio;
- a conversa **saiu** das listagens de EC e OS e **entrou** em Dados Gerais e
  Check-list.

**O que ficou pendente, e por quê:** a matriz dos sete perfis da Pólobh (falta a
tabela de quem vê o quê), os dois modelos de contrato (não vieram anexados), a
conta da rentabilidade com honorários e encargos (falta um exemplo numérico da
casa), o Dropbox e o WhatsApp (dependem de decisão e de conta). O plano detalha
cada um.

## Perfis de acesso
| Recurso | Direção | Produção | Administrativo |
|---|:--:|:--:|:--:|
| Dashboard / ECs (consulta) / OSs / Cronogramas / Fornecedores | ✅ | ✅ | ✅ |
| Calendário do ano (mesma permissão de Projetos) | ✅ | ✅ | ✅ |
| Check-list do projeto (ver e editar) | ✅ | ✅ | ✅ |
| Editar EC | ✅ | ✅ | — |
| Modelos de check-list (Configurações) | ✅ | — | — |
| Bloco financeiro / Configurações | ✅ | — | ✅ |

## Versões da EC: Ativa ou Arquivada
Cada projeto tem **uma** EC no ar — a que vale — e todas as outras são o
**arquivo** do projeto. São só esses dois estados (`domain/ec.ts` →
`situacaoEc`), e quem manda é a bandeira `ativa` (uma por projeto, índice único
`ecs_uma_ativa_por_projeto_idx`):
- **Ativa** — a estimativa que vale. É a única editável, e a única que gera
  pendência e recebe mudança dos dados do evento;
- **Arquivada** — todo o resto: versões anteriores, o que foi tirado do ar, o
  que veio de outro evento. Consultável e, sobretudo, **importável**.

O arquivo não é cemitério: é de lá que se puxa uma estimativa de volta, por
**Tornar EC ativa** (troca simples e reversível) ou por **Importar EC** (copia
para uma versão nova). Para mexer numa arquivada, é por um desses dois caminhos.

**Por que caiu o modelo antigo** (09/09/2026). A coluna `ecs.status` era herdeira
de um fluxo de aprovação do cliente que não existe mais e carregava seis valores
(`Rascunho`, `Aguardando`, `Aprovada`, `Reprovada`, `Cancelada`, `Arquivada`). A
tela lia o **par** (status, ativa), e a mesma EC aparecia ora como "Rascunho",
ora como "Arquivada", conforme o caminho pelo qual tinha saído do ar — ninguém
sabia dizer o que cada selo queria dizer. Agora a tela responde a única pergunta
que o dia a dia faz: *esta é a estimativa que vale, ou não é?*

`status` continua na tabela e passa a **acompanhar** a bandeira: toda função que
grava o deriva de `ativa` (migração `20260909100000`), o app não escolhe mais a
palavra — nem uma aba aberta no bundle anterior consegue sujar a coluna —, e um
`check (status in ('Ativa','Arquivada'))` fecha a porta para um UPDATE solto no
painel do banco. Os selos antigos foram normalizados: `status = ativa ? 'Ativa' :
'Arquivada'`, sem heurística nenhuma.

**Cancelar virou Arquivar.** Uma EC que não vale mais é simplesmente arquivada, e
segue consultável e importável como qualquer outra.

**As demais regras da EC continuam como estavam** — elas liam o `status`, e o
`status` continua lá, só com um vocabulário menor. `EC_ENCERRADA` (pendências e
`ecsAtualizaveis`) segue sendo `["Cancelada", "Arquivada"]`: 'Arquivada' passou a
ser toda EC fora do ar, e 'Cancelada' fica na lista para as linhas antigas que
ainda a tenham. O único ajuste foi em `statusProjetoAutomatico`: "Concluído" era
"o evento passou E alguma EC está **Aprovada**", e sem esse selo a leitura
equivalente é "o evento passou e a estimativa continua **de pé**" — a alternativa
era o status sumir em silêncio, e aí sim uma regra teria sido desfeita.
"Cancelado" continua no código para dado antigo e simplesmente deixa de
acontecer, já que não há mais como cancelar uma EC.

**Reativar não duplica mais.** "Tornar EC ativa" numa arquivada apenas a traz de
volta ao ar (a que estava valendo vai para o arquivo). Antes ela era duplicada
numa versão nova — com dois estados isso virou repetição de "Gerar nova versão",
e enchia a lista de versões só para poder editar. Por isso `repo.ecs.duplicar`
saiu: ninguém mais o chamava.

### Importar EC = gerar nova versão com o conteúdo de outra
Importar **gera a próxima versão da EC deste projeto** com a estrutura de uma EC
que já existe — deste projeto ou de outro, no ar ou arquivada. É o mesmo que
**Gerar nova versão** (numeração seguinte, entra no ar, a anterior vai para o
arquivo e leva a marca `cancelada_substituida` de "cancela e substitui todas as
anteriores"), mudando só **de onde vem o conteúdo**: em vez de copiar a EC atual,
copia a escolhida. A origem nunca é tocada. Importar uma **arquivada** é o caso
comum, e não a exceção: é a que já deu certo uma vez.

O que **não** atravessa é a vida da EC de origem — o que estava emitido, gasto e
comentado lá não vale aqui, e a versão nova começa limpa nesses campos (regra da
importação desde sempre). Para seguir com a mesma negociação preservando tudo,
existe `nova_versao_ec`.

A cópia das linhas acontece **dentro do banco** (`importar_ec`, migração
`20260908120000`), e isso não é detalhe de implementação. Feita no navegador, ela
lia a EC de origem pela view mascarada `ec_linhas_visiveis` — que devolve `NULL`
nos valores para quem não tem o recurso financeiro — e `mapLinha` convertia esses
`NULL` em `0`: para **Produção**, que pode criar EC e não vê valor, a EC
importada nascia com todos os custos **zerados**, em silêncio. A proteção que já
existia em `salvar_ec_completa` não alcançava o caso: ela vive no
`on conflict do update`, e aqui as linhas são inseridas. Ninguém passa a enxergar
o que não enxergava — a EC nova é relida pela view de sempre.

A **versão** também sai do banco, sob o mesmo `advisory lock` das demais funções
— no navegador ela era calculada a partir de uma lista carregada minutos antes, e
duas importações simultâneas nasciam com o mesmo número.

## Caixa alta e baixa: a régua é uma só (`domain/textos.ts`)
A padronização morava no `<Input formato="…">` e acontecia no **blur**: alcançava
só o que alguém digitava e depois saía do campo. Tudo que entra **por código**
escapava — a consulta de CNPJ (a Receita entrega em CAIXA ALTA), a importação de
EC, a foto do evento copiada para a OS, os modelos de item. A correção vinha caso
a caso: a migração `20260809160000` chegou a acertar três clientes um a um.

Agora a régua fica **no caminho da gravação** — `domain/textos.ts`, aplicada nos
`*Row` de `data/supabase.ts`. Todo save passa por ela, venha o valor de onde
vier. O `formato` do `<Input>` continua, para o retorno imediato enquanto se
digita; a palavra final é do domínio.

**Só se mexe no que veio em CAIXA ALTA.** É a regra que `gerarApelidoFornecedor`
já usava: maiúsculas em tudo é o padrão das fontes externas; **caixa mista é
decisão de gente e se respeita** — quem escreveu "Sonora AV" quis aquilo. Sem
esse corte, "Belo Horizonte/MG" viraria "Belo Horizonte/Mg" e "Coffee break"
viraria "Coffee Break" a cada gravação.

| formato | o que faz |
| --- | --- |
| `titulo` | Nome Próprio — pessoas, lugares |
| `titulo-empresa` | idem, preservando LTDA/ME/EIRELI/S/A |
| `endereco` | idem, preservando a **UF** e o **"CEP:"** |
| `frase` | baixa tudo e capitaliza o início das frases |
| `inscricao` | número intocado; palavra vira Nome Próprio (**ISENTO → Isento**) |
| `livre` | só apara espaços — documento, telefone, e-mail, apelido |

**Sigla não vira nome próprio.** "LSPRO LOCACOES…" → "LSPRO Locacoes…", pelo
mesmo teste do apelido do fornecedor (`pareceSigla`: português não começa palavra
com três consoantes, nem escreve palavra sem vogal) — com **teto de 5 letras**,
senão "CONSTRUTORA" ("nstr") e "CONTRIBUINTE" ("ntr") passariam por siglas.

**Fica de fora, de propósito:** documento, telefone, e-mail, URL, código de
serviço, número de nota, CNAE; o **apelido** do cliente e do fornecedor (é código
curto da casa — "BM" viraria "Bm" — e entra no número da EC e no título da OS); o
**grupo** da EC (cabeçalho em caixa alta por convenção); e o **nome do item**, que
é curto e cheio de sigla da casa ("ECAD", "VT", "MÍDIA"), onde acertar a caixa
automaticamente erra mais do que acerta. Texto longo (descritivo, roteiro,
observação) tem dono próprio: o revisor da EC (`lib/correcaoOrtografica`).

As **fotos** do cliente e do evento gravadas dentro do projeto, da EC e da OS
passam pela mesma régua — é o texto delas que sai impresso.

O passivo foi acertado pela migração `20260909140000`, com os valores obtidos
rodando a própria `padronizarTexto()` sobre o que estava no banco (não escritos à
mão). Ela é a última do tipo: a regra agora vive no código.

## Pendências (quem vê o quê)
O número vermelho é uma lista de tarefa, não um painel do que anda acontecendo.
Três portas, e só elas (`domain/pendencias.ts` → `agregarPendencias`):
- o **destinatário** da cobrança — @mencionado ou escolhido como responsável do
  comentário, e o dono da tarefa do check-list. Entra e sai conforme a vez (ver
  a batata quente, abaixo);
- o **Produtor(a) Responsável**, mas só no que **não tem outro dono**: OS em
  rascunho, cronograma vazio, credenciamento sem resposta, projeto sem EC,
  OS/Contrato a emitir. **Conversa não entra** (revisão de 15/09/2026). Ele já
  recebeu tudo o que nascia no projeto — regra de 08/09 — e o preço foi o
  número vermelho de quem responde por seis projetos deixar de significar
  "tenho o que fazer". Sem esta porta, porém, as cinco pendências acima sumiriam
  do sistema: elas não têm a quem mais pertencer;
- a **função**, e só nas passagens de bastão da OS ("aguardando o financeiro"):
  ninguém é nomeado quando a OS vai *para o financeiro*. Fora daí o papel
  continua sem abrir porta nenhuma.

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

### Formas de cobrar o item: informação, não escolha
Cada item da EC traz as três formas de cobrança lado a lado — **Valor com BV e
NF**, **Valor Sem BV e Com Nota Fiscal**, **Valor Sem BV e Sem NF** —, e cada uma
aceita **um valor** ou **"Não se aplica"** (respostas diferentes de deixar em
branco, que é pergunta sem resposta). Na EC **não há escolha**: as três seguem
para a OS, que é onde se decide por qual delas o item vai ser pago (bloco
*Valores negociados*). Na EC se levanta o preço; na OS se fecha a condição.

Havia um rádio elegendo "a que vale" (`ec_linhas.opcao_valor`). Ele obrigava a
produção a fechar a condição de pagamento dentro de um documento ainda em
montagem, e a escolha **nem chegava à planilha** — o bloco ORÇAMENTO da OS já
imprimia as três colunas item a item. A escolha passou para a OS, item a item
(ver abaixo). A coluna continua no banco por ora, sem uso: o app parou de
escrevê-la e a RPC preenche o padrão vazio (revisão de 09/09/2026).

Duas regras do **BV** saíram junto do seletor:
- o BV conta assim que existe **valor com BV e NF** no item — antes só valia
  depois de alguém eleger essa forma, e ele é combinado *junto* com o preço;
- a **justificativa** aparece quando a produção respondeu sobre a cobrança com
  BV e a resposta foge do padrão: "Não se aplica" (o item sai sem BV, de
  propósito) ou um BV abaixo de 15%. Campo em branco não pede nada, senão toda
  linha recém-criada nasceria com alerta. Ela é **opcional** — ver adiante.

## A OS caminha em fases (revisão de 15/09/2026)

A OS era um formulário só: quem podia editar editava tudo, em qualquer ordem, e
"está pronta para o financeiro" era conversa de corredor. Agora ela tem o
caminho que a casa já faz na prática (`domain/faseOs.ts`):

**Produção monta → Financeiro conclui → Back-office emite.**

- **A fase TRAVA, não avisa.** Os blocos da etapa anterior ficam em leitura,
  porque o que isso impede é o valor mudando embaixo de quem já o usou para
  emitir a nota. Devolver à etapa anterior é possível e explícito.
- **Permissão e fase são coisas diferentes** e precisam concordar: a permissão
  diz o que a PESSOA pode (`oss.editar`, `financeiro`), a fase diz o que o
  DOCUMENTO aceita agora. É assim que "a partir desta etapa a Produção não edita
  mais" se cumpre sem depender de os sete perfis da Pólobh já existirem.
- **Cada passagem vira pendência de quem recebeu**, endereçada à FUNÇÃO — a OS
  vai "para o financeiro", não "para a Marisa".
- **Emitir fecha o ciclo:** a OS vira Emitida e os itens da EC que ela consolida
  passam de "Emitir" para "OK" (RPC `marcar_itens_da_os_como_emitidos`; pela
  tela não daria, porque quem emite não escreve em `ec_linhas`). Antes disso,
  **OS com pendência aberta não é emitida** — a trava é de EMISSÃO, não de
  salvamento: salvar segue livre, como ficou combinado em 10/09.
- **A OS abre em modo leitura**, e "Editar OS" libera o que a fase permite.

**Quatro status, e "Disparada" não é um deles.** Rascunho · Emitida · Cancelada ·
Arquivada. "Disparada" não dizia em que estado o documento está, dizia que um
e-mail saiu — uma OS entregue em mãos ficava para sempre parecendo menos pronta
que uma enviada por e-mail. Virou o carimbo `disparadaEm`, e é ele que destrava
as cobranças de cronograma e credenciamento (elas só fazem sentido com o
fornecedor de posse do documento). O carimbo só é gravado quando o e-mail sai de
verdade.

## A OS em dois blocos: Detalhamento e Resumo da Contratação

> **16/09/2026** — o módulo "Pagamento ao Fornecedor" deixou de existir: os
> totais, o prazo de pagamento e o documento fiscal viraram o **Resumo dos
> Custos**, no fim do Detalhamento da Contratação, como o check-list pediu nos
> dois sentidos ("consolidar … sob o título Resumo dos Custos" e "Módulo
> Pagamento ao Fornecedor — excluir"). Os totais só querem dizer alguma coisa
> ao lado dos itens que os produziram.
Revisão de 09/09/2026. A OS é o documento que vira **contrato com o fornecedor**,
e ela agora se lê em duas metades, na ordem em que a decisão acontece.

**Detalhamento da Contratação** — onde se decide:
- Modalidade · Item da EC · Descritivo (puxado da EC);
- e um **bloquinho por item** (`ItemContratacao`, em `pages/OsForm`) com as três
  formas de cobrança. Os valores **chegam prontos da EC** e seguem editáveis: a
  EC levanta o preço, a OS fecha a condição, e o número que fecha nem sempre é o
  estimado. O que a EC registrou fica lá, intacto.
  - **Valor com BV e NF** — "Não se aplica" ou valor, mais o **BV** (percentual
    ou valor fixo) e a **justificativa do BV**;
  - **Valor Sem BV e Com Nota Fiscal** e **Valor Sem BV e Sem NF** — "Não se
    aplica" ou valor, mais a **justificativa do BV** (por definição elas saem
    sem BV, e a casa quer saber por quê).

A **justificativa é uma por forma**, e não uma por item como na EC: ali só uma
das três valia, aqui as três convivem na mesma tabela e cada uma responde por si
(`exigeJustificativa` diz onde o campo faz sentido aparecer).

**Resumo da Contratação** — o que sai do que foi decidido: Entrega, Cronograma,
Logística, Infraestrutura, Observações Gerais e o **Resumo dos Custos**, a tabela
dos itens da EC com os valores definidos no Detalhamento.
- **Só sai a coluna que tem algum valor.** Uma coluna inteira zerada, ou inteira
  "Não se aplica", não é informação numa tabela que o fornecedor confere linha a
  linha — ela simplesmente não aparece no PDF nem na planilha. Dentro de uma
  coluna que sai, o item que não se aplica sai **escrito**, e não como R$ 0,00.
- No pé, o **total de cada coluna**, e depois a separação que interessa ao
  faturamento: **Total a Faturar** (as duas colunas *com* NF, que são as que
  geram nota) e **Total Sem Nota Fiscal**. Cada linha só aparece quando há o que
  dizer nela. Os dados para pagamento vêm logo abaixo, conforme essas opções.

A regra mora em `domain/contratacaoOs.ts` (`resumoContratacao`,
`COLUNAS_CONTRATACAO`, `bvDoItem`, `bvDaContratacao`) e é a mesma nos três
lugares em que a OS aparece — tela, PDF (`print/OsDocumento`) e planilha
(`excel/os`) —, para os três nunca discordarem sobre o nome ou a presença de uma
coluna. A contratação é gravada em `oss.itens` (jsonb, migração
`20260909160000`); **OS gravada antes disso vem `[]`** e se preenche a partir da
EC ao ser aberta ou exportada (`sincronizarContratacao`), que também é o que
mantém o já negociado quando a OS ganha ou perde itens.

Os três totais do bloco Pagamento ao Fornecedor (`orcamento.valorComBvNf` e
companhia) viraram **leitura**: são a soma do que foi definido item a item. Antes
eram digitados para a OS inteira, e não sabiam dizer de onde vinham.

### O resto da tela da OS (revisão de 09/09/2026)
- A **conversa** subiu para o topo, antes do bloco "Ordem de Serviço": quem abre
  uma OS costuma abrir por causa do que foi dito nela, e no fim da tela isso
  ficava atrás de quinze blocos.
- O bloco de emissão fecha no par **Valor total a pagar + Forma de Pagamento**.
  A forma da NOTA (`financeiro.formaPagamento`) é campo próprio e nasce com o
  padrão do modelo: é outra coisa que a forma do CONTRATO — aquela é cláusula, e
  só existe quando há contrato.
- "Informações a serem preenchidas pelo Financeiro da Pólobh" virou **"Dados
  Nota Fiscal, Fatura, etc..."**.
- **Acertos Financeiros**: o BV perdeu o "— Percentual" do rótulo, e a
  justificativa saiu. Ela é uma por FORMA, dentro de cada item da contratação —
  uma justificativa só, da OS inteira, não sabia dizer de qual item falava.
  `financeiro.bvJustificativa` fica no tipo e na tabela para não perder o que as
  OS antigas escreveram; nada mais o exige nem o preenche.
- **Nada trava o salvamento da OS** (10/09/2026). Houve aqui uma trava: sem a
  justificativa do BV de uma forma fora do padrão, a OS não salvava — e ela foi
  desfeita a pedido da Pólobh. O motivo é bom: quem monta o documento raramente
  tem todas as respostas na mesma sessão, e a trava transformava "ainda não sei"
  em "não posso guardar o que já sei". A justificativa continua no Detalhamento
  como **nota opcional**.
- **Dados para Contrato** só existe quando a EC pediu "Emitir"/"Emitir Nova
  Versão". Marcado "Não se Aplica", o grupo não aparece nem como aviso: um grupo
  vazio não é neutro — ele descreve um contrato inexistente com valores, forma de
  pagamento e data no documento do fornecedor.

### Trocar o fornecedor de uma OS já emitida
Deixou de ser edição. A tela avisa enquanto ainda dá para desfazer; ao salvar,
pede autorização, **arquiva a OS como ela era** e abre a versão seguinte com o
fornecedor novo, no número seguinte da série. Em rascunho nada disso acontece
(`exigeNovaVersaoPorFornecedor`, em `domain/os.ts`): ali a troca é correção de
quem ainda monta o documento — a OS nasce com o fornecedor que a EC apontou, e o
primeiro ajuste costuma ser exatamente esse.

Mexer no cadastro do MESMO fornecedor (corrigir a razão social, preencher o CNPJ
que faltava) não conta como troca: `mesmoFornecedor` compara pelo CNPJ quando
ele existe dos dois lados, e pela razão social sem acento/caixa quando não — a
mesma régua de `versaoOs`, porque as duas respondem à mesma pergunta.

A cópia é do servidor (`gerar_nova_versao_os`, agora com `p_fornecedor`): o
financeiro é restrito por RLS, e copiá-lo pela tela apagaria o que quem reemite
não tem permissão de enxergar. **A mesma migração (`20260910120000`) corrigiu um
defeito**: a função copia coluna a coluna e `oss.itens` não estava na lista, de
modo que reemitir uma OS zerava a contratação inteira, calada.

## Dois cabeçalhos (revisão de 09/09/2026)
O topo tinha sete itens e misturava o que se faz todo dia (Projetos,
Calendário) com o que se administra de vez em quando (Áreas, Usuários, Logs) e
com cadastro que já vive dentro do projeto (Fornecedores). Na largura de um
notebook os rótulos sumiam e sobrava uma fileira de ícones parecidos.

**O cabeçalho geral** (`NAV`, em `layout/nav.tsx`) tem cinco botões e diz só em
que parte do aplicativo se está: **Calendário Pólobh | Projetos | Configurações
| Guia do Aplicativo | Help Desk**. O Calendário vem primeiro porque é por ele
que o dia começa — "o que acontece esta semana" antes de "onde está cada
projeto"; a rota `/` leva a ele.

**O segundo cabeçalho** (`layout/BarraSecao.tsx`) é a barra da área, e a
diferença para `SubGuias` é que ela **atravessa rotas**:
- `BarraProjeto` — Dados Gerais / Check-list / EC / OS / Cronograma /
  Credenciamento / Fornecedores. É a mesma dentro do projeto, da EC e da OS:
  entrar num documento deixava a pessoa sem nenhuma referência de onde estava.
  Dentro do projeto a troca é por estado (`onAba`); nas outras telas ela navega
  para `/projetos/:id?aba=…`.
- `BarraConfiguracoes` — Geral / Check-list / Áreas e permissões / Usuários /
  **Logs**, que tem rota própria mas pertence ali. Cada seção respeita a
  permissão que já governava a tela.

  A **Agenda** e o **cadastro geral de Fornecedores** estiveram nesta barra por
  um dia e saíram (10/09/2026). A Agenda deixou de existir no aplicativo — o
  acompanhamento das tarefas é o Check-list, dentro do projeto —; o cadastro de
  fornecedores continua existindo (`/fornecedores`) porque é o único lugar onde
  se editam inscrições, dados bancários, Pix, apelido e a agenda de contatos,
  mas hoje **não tem link em nenhum menu**. Pôr os dois em Configurações foi
  consequência de uma pergunta mal feita: ao enxugar o cabeçalho para cinco
  botões, o certo era perguntar SE aquelas telas deviam continuar existindo, e
  não onde guardá-las.

As duas entram pelo slot `subabas` do `PageShell`, então grudam com o título.

**Dois níveis, dois desenhos.** Na EC e na OS as duas barras aparecem juntas — a
do projeto por cima, a das vistas do documento embaixo —, e desenhá-las igual
fazia as duas lerem como UMA fileira que quebrou de linha. Pior: "EC" aparecia
nas duas, acesa em laranja com o mesmo sublinhado, e não dava para saber qual
dizia "você está na EC do projeto" e qual dizia "você está vendo a EC, e não o
Resumo dos Custos". Agora `SubGuias` tem duas variantes: `principal` (abas com
sublinhado — sair dali troca de tela) e `secundaria` (pílulas menores — é uma
vista do que já está aberto, nada sai do lugar). A vista da EC também deixou de
se chamar só "EC": virou **"Itens da EC"**.

O cabeçalho da OS ficou com o **número como título**, como o da EC. Ele aparecia
três vezes no mesmo bloco — na trilha, no subtítulo e implícito no título
genérico "Ordem de Serviço" —, gastando uma linha do cabeçalho grudado para
repetir. Que documento é aquele, a barra do projeto já diz.

## Trocar a própria senha
Clicar no nome, no canto do cabeçalho, abre **Minha conta** (`MinhaContaModal`) —
quem é você aqui dentro, e a troca da senha. Antes disso a senha só mudava por
fora do aplicativo: era preciso pedir um convite novo ao suporte, e o resultado
prático é a senha do primeiro dia valendo para sempre.

**A senha atual é exigida**, e não é burocracia: o Supabase troca a senha de
quem tem sessão válida sem perguntar mais nada, então qualquer pessoa que
sentasse numa cadeira com o app aberto poderia trocar a senha e deixar a dona da
conta de fora. `trocarSenha` (em `store/auth`) confere entrando de novo com a
senha atual — dá certo, é a pessoa; dá errado, para ali, e a recusa fica na
trilha de auditoria (`auth.senha.recusada`).

A régua da senha nova mora em `domain/senha.ts`, testada: mínimo de **8**
caracteres (o piso do Supabase é 6, que é o que o servidor tolera, não o que a
casa acha razoável), diferente da atual, e confirmada. Sem exigência de símbolo
ou maiúscula de propósito — regra de composição empurra para "Polobh@2026" e
para o papel colado no monitor; uma frase que só a pessoa sabe vale mais. As
mensagens do Supabase são traduzidas ali também, e o que não for reconhecido
chega inteiro à tela, para o caso raro não virar "erro genérico".

No celular o nome some (não cabe) mas o **avatar continua clicável**: trocar a
senha não pode depender de estar no computador.

## Help Desk
O quinto botão. Abre chamado para o suporte com a **tela de origem** e o
**navegador** preenchidos pelo sistema — a primeira resposta do suporte era
sempre a mesma pergunta. O chamado é um **registro** (tabela `chamados`), o
e-mail avisa um endereço de suporte **configurável** (Configurações › Geral), e
a conversa continua dentro do aplicativo. Fica na trilha de auditoria
(`helpdesk.chamado`) mesmo quando o e-mail é simulado ou desviado pela
homologação: o registro de que alguém pediu ajuda é a informação.

### Um painel sobre a tela, não uma tela (10/09/2026)
O botão **não navega**: abre um painel por cima do que a pessoa está fazendo
(`components/suporte/PainelSuporte`, estado em `store/suporte`). Quem pede ajuda
está no meio de outra coisa — uma OS com o cliente esperando, uma EC que não
fecha —, e trocar de tela custa duas coisas: abandonar o trabalho e perder de
vista justamente o que se quer descrever. Com o painel, a tela continua atrás,
inteira, e fechar devolve tudo como estava.

Por isso a tela de origem deixou de ser adivinhada: o painel lê o endereço
ATUAL quando abre, porque ninguém saiu do lugar. `lib/telaAnterior.ts`
(`sessionStorage`) existia só para atravessar a navegação até a página de
suporte, e foi removido junto com ela.

A rota `/suporte` continua, e só faz uma coisa: abre o painel em "Meus
chamados" e devolve a pessoa ao Calendário. É por ela que o botão do e-mail de
resposta entra, e link já enviado precisa continuar valendo.

### O print da tela
Metade de um chamado é a imagem, e descrever imagem por escrito custa três idas
e vindas. Três caminhos param no mesmo lugar, de propósito:

- **Print da tela** — `getDisplayMedia`, a captura do próprio navegador
  (`lib/captura.ts`). O painel se esconde por um instante antes do quadro, senão
  o print mostraria o formulário de chamado em vez do problema. Um quadro só, e
  a câmera é solta em seguida.
- **Ctrl+V** — é como a maioria já tira print (PrintScreen, colar).
- **Anexar arquivo** — imagem ou PDF, o que sempre funciona; é o único caminho
  onde `getDisplayMedia` não existe (Safari do iPhone), e a tela some com o
  botão nesse caso.

Desenhar a página por conta (html2canvas e parentes) foi descartado: não pede
permissão, mas RECONSTRÓI a tela em vez de fotografá-la, e erra justamente onde
interessa — o menu aberto, o campo em foco, o pedaço rolado. Print que não
mostra o problema é pior que print nenhum.

**Três por mensagem**, e o número não é gosto: os mesmos arquivos vão como
anexo no e-mail, e a Edge Function `send-email` aceita no máximo três (o Brevo
recusa mensagem grande). Aceitar cinco na tela produziria chamado gravado com
aviso que não sai.

Os bytes ficam no bucket `anexos-chamados`, fechado, com link assinado de 60s —
mesmo desenho dos anexos do check-list. A ficha do arquivo fica no jsonb, ao
lado do texto que ela acompanha: `chamados.anexos` para o relato,
`mensagens[].anexos` para cada resposta. Pendurar a ficha é RPC
(`anexar_ao_chamado`), e não `UPDATE`: quem abre o chamado não tem escrita na
tabela — com ela, poderia reescrever o próprio relato depois de respondido.

O chamado é gravado ANTES de o arquivo subir. Quando o upload falha sobra um
chamado sem print, que é muito melhor do que um print sem chamado.

### O e-mail do Help Desk sai de verdade (10/09/2026)
É a **única** mensagem que atravessa a homologação, e isso foi preciso porque o
chamado simplesmente **não chegava**. Dois guardas, somados, barravam tudo:

1. `protegerDestinatarios` (`lib/email/seguranca`) reescreve o destino de toda
   mensagem para a caixa de teste enquanto `VITE_EMAIL_DESTINO_REAL` é `false`;
2. `send-email` recusa destinatário que o sistema não conheça — fornecedor,
   contato de cliente ou usuário do app (M-04, `emails_conhecidos`).

A caixa de teste não é nenhum dos três. Com as duas ligadas, **nenhum e-mail
conseguia sair**: o último envio bem-sucedido do sistema é de 20/07/2026.

A saída tem duas partes, as duas estreitas de propósito:
- `MensagemEmail.interna` marca a mensagem que vai **da Pólobh para a Pólobh**.
  A trava existe para proteger TERCEIROS; no chamado de Help Desk não há
  terceiro — ele sai para o suporte cadastrado e responde para quem o abriu.
  Só as duas pontas do Help Desk usam a marca — `emailHelpDesk` (o chamado que
  vai ao suporte) e `emailRespostaChamado` (a resposta que volta a quem abriu) —,
  e há teste que percorre os outros templates para garantir que nenhum deles a
  ganhe por descuido.
- `emails_conhecidos` passou a aceitar o endereço gravado em
  `config_app.helpdesk` e a caixa de homologação (migração `20260910160000`).
  A função continua fechada: quem escolhe o endereço é quem administra, pela
  política de escrita de `config_app`, e nunca quem dispara.

O endereço vive em `config_app` (migração `20260910100000`), uma tabela de
chave/valor criada para isto: não havia **onde** guardar um ajuste do sistema —
ou virava coluna numa tabela que não é dela, ou variável de ambiente, que só
quem publica muda.

### O chamado virou registro, com a conversa dentro (10/09/2026)
Enquanto o chamado era **só e-mail**, ele saía do aplicativo e sumia: quem abriu
não sabia se tinha sido lido, quem atende respondia do seu cliente de e-mail, e a
resposta não existia em lugar nenhum do sistema. "Quantos chamados estão
abertos?" não tinha resposta.

Agora o chamado é uma linha em `chamados` (migração `20260910180000`) com a
conversa na coluna `mensagens`. O e-mail continua saindo — é ele que **avisa** —,
mas deixou de ser onde a informação mora.

- **A situação decorre de quem falou por último**, não é digitada: `Aberto`
  espera o suporte, `Respondido` espera quem abriu, `Resolvido` não cobra
  ninguém. Chamado resolvido **reabre** quando alguém volta a falar — é o que
  acontece de verdade quando o problema não estava resolvido. Mesma ideia das
  conversas do resto do app (`pendenciaDeConversa`).
- **Quem atende é o papel `Admin`**, atrás da função `e_suporte()` em vez de
  `papel_atual() = 'Admin'` espalhado pelas policies: o dia em que o suporte
  deixar de ser o Admin, muda num lugar. A tela pergunta ao **banco** quem
  atende (`repo.chamados.souSuporte`), e não ao papel guardado na sessão — é o
  banco que decide o que a pessoa vai conseguir ler e responder, e a tela não
  pode oferecer um botão que vai dar erro.
- **Cada um vê o seu; o suporte vê todos** (`chamados_read`). Um chamado conta o
  que a pessoa estava fazendo e onde errou: não é assunto de todo mundo.
- **Responder é uma RPC** (`responder_chamado`), e não `UPDATE` na tabela: com
  permissão de escrita, quem abriu poderia reescrever o próprio relato ou o
  status depois de respondido. A função só sabe **acrescentar** no fim.
- **Grava primeiro, avisa depois.** `NovoChamado` insere o chamado e só então
  dispara o e-mail; se o envio falhar, o aviso na tela diz isso, mas o chamado
  existe. Era exatamente esse o problema de quando ele era só e-mail.
- A resposta do suporte **também sai por e-mail** (`emailRespostaChamado`), com
  link de volta para a tela. Quem responde sem ser o suporte não dispara e-mail:
  avisar a si mesmo não serve para nada, e o suporte já está olhando a fila.

**O que NÃO existe:** ingestão de e-mail de **entrada**. Responder o aviso pelo
cliente de e-mail não escreve no chamado — a resposta que o sistema registra é a
escrita na tela do Help Desk. É para isso que o aviso leva um link para ela.

## Conversa por aba do projeto
Cinco abas — **Dados Gerais, Check-list, Fornecedores, Cronograma e
Credenciamento** — têm o seu corredor: "@Marisa o palco não respondeu o
credenciamento". Sem ele, esse tipo de recado ou não era escrito, ou ia parar
numa observação de item que nada tinha a ver com o assunto, só porque era o
campo de texto mais perto — e quem fosse procurar depois não achava.

**A lista mudou em 15/09/2026.** Dados Gerais e Check-list entraram (tinham
ficado de fora por bom motivo — uma é cadastro, a outra já é feita de tarefas
com dono e prazo —, mas na prática o recado da etapa ia parar no campo de texto
mais próximo). **EC e OS saíram**: ali a conversa mora DENTRO do documento, e no
corredor da listagem ela era uma terceira caixa de texto para o mesmo assunto —
e era ela o número "a mais" que fazia a pílula da subguia divergir do badge da
linha da EC.

O que ficou gravado nas duas abas antigas continua no banco e **deixa de
cobrar**: pendência sem tela onde se resolver é justamente o número que não se
consegue achar (`ABAS_CONVERSA_GRAVADAS` guarda o formato; `ABAS_COM_CONVERSA` é
quem mostra).

Guardadas em `projetos.conversas` (jsonb, `{"<aba>": [observacoes]}`, migração
`20260910140000`) e gravadas **uma aba por vez** (`salvar_conversa_projeto`,
`jsonb_set`): duas pessoas conversando em abas diferentes do mesmo projeto não
podem apagar a mensagem uma da outra. Como a conversa da EC, fica fora do
`salvar` do projeto — comentar não é editar, não passa pela permissão de edição
e não mexe em `atualizado_em`.

As pendências saem com `aba` preenchida (`projeto.conversa`), então caem no
badge da subguia certa, e a âncora (`ancoraConversaAba`) leva ao card daquela
aba — não ao projeto.

O card em si é o mesmo da EC e da OS (`components/CardConversa.tsx`): o rótulo
do botão é **"Adicionar Observação"** em toda parte.

## O contrato em Word (16/09/2026)

Os dois modelos da casa — **Corporativo** e **Cultural** — chegaram como .docx
anotados, e o sistema gera o documento a partir deles. Quem baixa clica em
**Contrato Word**, no alto da OS; o botão só aparece quando a EC pediu contrato
("Emitir" ou "Emitir Nova Versão" na coluna Contrato de algum item).

Os modelos separam três coisas, e o sistema respeita a separação:

| No modelo | No app |
| --- | --- |
| *"O sistema lança automaticamente…"* | Vem da OS e não se digita no contrato: número, data, tomador, fornecedor, valores, forma de pagamento. Reeditar aqui criaria uma segunda verdade para o mesmo dado. |
| *"Manter este campo editável."* | Cada uma das sete cláusulas é um campo, já preenchido com o texto do modelo. Só o que muda fica gravado — assim, corrigir o padrão depois vale para os contratos que ainda não foram assinados. |
| Em branco no modelo | Cidade da assinatura e as duas testemunhas (nome e CPF). Em branco, saem para assinar à mão. |

**Qual modelo vale** é a modalidade do projeto que decide — a mesma que escolhe
o modelo da EC e do check-list. Projeto sem modalidade cai no Corporativo, e o
seletor existe para o caso raro do contrário. O Cultural difere em três pontos,
todos de direito cultural: nomeia o projeto incentivado, a lei e o código na
Cláusula Primeira; acrescenta, entre as obrigações do CONTRATANTE, receber e
administrar os recursos do incentivo; e acrescenta, nas considerações finais,
que serviço novo pede contrato novo.

**CONTRATANTE é o tomador do serviço; CONTRATADO(A) é o fornecedor.** No alto
dos dois modelos, os dois blocos trazem a mesma anotação ("os dados do Tomador
de Serviço"), e é o bloco de assinaturas deles que desfaz o engano. Por isso o
contratante, em branco, segue o tomador do faturamento em vez de perguntar duas
vezes a mesma coisa na mesma OS.

Sai em **.docx, e não em PDF**, porque é ele que vai para o jurídico do
fornecedor, que devolve com alteração — um PDF obrigaria a refazer tudo no app.

Onde mora: `domain/contratoModelo` (os textos dos dois modelos),
`domain/contratoDocumento` (o que entra em cada lugar, função pura da OS, com
teste) e `lib/docx/contrato` (o desenho). As tarjas cinzas das cláusulas são
tabelas de uma célula, e não as caixas de texto flutuantes do modelo original:
a tabela acompanha o texto quando a cláusula cresce, e a caixa flutuante ficaria
por cima do parágrafo seguinte.

## As sete áreas da Pólobh (16/09/2026)

A matriz de perfis estava escrita no check-list, em três lugares diferentes, e
virou a migração `20260922100000_os_sete_perfis_da_polobh.sql`:

| Perfil | Edita EC | Vê rentabilidade | Monta a OS | Conclui e emite |
| --- | :---: | :---: | :---: | :---: |
| Diretoria Produção | ✅ | ✅ | ✅ | ✅ |
| Direção Administrativo-Financeira | — | ✅ | ✅ | ✅ |
| Coordenação Produção | ✅ | ✅ | ✅ | ✅ |
| Coordenação Administrativo-Financeira | — | ✅ | ✅ | ✅ |
| Assistência Administrativo-Financeira | — | — | — | — |
| Produção | ✅ | — | ✅ | — |
| Back-office | ✅ | — | ✅ | ✅ |

A última coluna pediu uma chave nova, `oss.emitir`. A emissão pelo Back-office
usava `oss.editar`, que é a chave de MONTAR a OS — e com uma chave só, "a partir
desta etapa a Produção não edita mais" não se cumpre: a Produção precisa de
`oss.editar` para montar, e com ela emitiria o documento que a fase acabou de
tirar das mãos dela.

As quatro áreas antigas **continuam existindo**, e ligadas a quem já usa o
sistema: a troca é feita usuário a usuário em Configurações. O teste
`domain/perfisPolobh.test` lê a própria migração e confere as quatro regras do
check-list — uma cópia da matriz em TypeScript passaria a divergir do banco no
dia em que alguém corrigisse só um dos dois.

## Código de Serviço e Ordem de Compra: nascem na OS, voltam para a EC

Revisão de 15/09/2026, e era um nó que travava o sistema inteiro. Documento PG,
Código de Serviço e Pedido de Compra eram **digitados na EC** e, ao mesmo tempo,
**exigidos para emitir a OS** — só que quem os conhece é quem emite o
faturamento, ou seja, a própria OS. Na prática: item aprovado, fornecedor
identificado, e a emissão barrada esperando por um dado que só existiria depois
dela. Era a queixa *"não estou conseguindo emitir OS's"*.

Agora eles são **leitura na EC** e decisão da OS, e voltam por RPC
(`devolver_dados_fiscais_para_ec`) — pela tela não daria: quem preenche o
faturamento é o Administrativo, que não edita EC, e a RLS recusaria.

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

## Data(s) e Horário(s) do evento na OS
O evento de vários dias é o caso comum da casa, mas `ProjetoInfo.evento` e
`ProjetoInfo.horario` guardam só a **primeira** faixa do cronograma — são
resquício de quando o cronograma era um par de campos soltos
(`sincronizarCamposLegados`). Todo documento que lia esses campos mandava o
fornecedor para um evento de **um dia**.

`datasDoEvento` / `horariosDoEvento` (`domain/projeto.ts`) leem o cronograma
inteiro e caem nos campos legados só quando não há cronograma (OS antiga, cujo
snapshot foi tirado antes de ele existir). Datas repetidas colapsam (duas faixas
no mesmo dia são um dia); horários idênticos também (três dias das 9h às 18h leem
"09:00 às 18:00", não a mesma faixa três vezes).

Os rótulos são **"Data(s)"** e **"Horário(s)"**, iguais nos três lugares em que a
OS aparece — tela (`OsForm`), OS impressa (`print/OsDocumento`) e planilha
(`excel/os`) — e no e-mail que dispara a OS ao fornecedor. O **cronograma do
fornecedor** de uma OS nova também passou a nascer com todas as faixas de todas
as etapas (`cronogramaDoProjeto`): antes ele nascia com uma única linha "Evento"
tirada dos campos legados, e só era corrigido depois, ao reabrir a OS, por um
remendo que reconhecia essa linha padrão e a substituía.

## Check-list: uma lista, não um formulário
Revisão de 10/09/2026. A aba era uma pilha de cartões em que cada tarefa trazia
o título num campo de digitação e mais três campos com borda — prazo,
responsável e status —, todos abertos o tempo todo. Doze tarefas viravam
trinta e seis molduras, e a tarefa em si competia por atenção com caixas
vazias; ainda por cima o status aparecia duas vezes (no seletor e num selo
logo abaixo) e cada linha gastava uma faixa inteira só para dizer "Adicionar
Observação".

O que mudou, e por quê:
- **Cada grupo é uma lista**, e não uma pilha: um fundo só, linhas separadas por
  um fio, título preso no topo com o progresso do grupo ("3 de 8"). O que faz
  uma lista parecer lista é a continuidade.
- **Tudo se lê como texto** e vira controle no clique (`CampoDiscreto`). O
  normal é ler; editar é a exceção.
- **A caixa de marcar é o maior alvo da linha** — é o gesto mais frequente — e
  mostra um tique esmaecido no hover, dizendo o que o clique vai fazer.
- **Atrasada ganha um fio vermelho na lateral**, não uma borda inteira: a linha
  continua sendo linha.
- **Recolher e excluir só aparecem no hover** (e sempre no toque). São ações
  raras que ocupavam lugar fixo em toda linha.
- **A conversa entrou na linha de dados**, encostada à direita, e o convite só
  aparece no hover quando não há nada — mas fica à vista quando há conversa
  **ou pendência**: a regra da casa é que todo número contado pode ser achado.

A mesma lista, com as mesmas sete tarefas, ficou cerca de um terço mais curta.

### Segunda passada (10/09/2026)
Quatro coisas que a primeira revisão deixou passar — as duas primeiras são
defeito, não gosto:

- **A descrição da tarefa não aparecia em lugar nenhum.** O campo existe no
  tipo, é preenchido na lista padrão (com o rótulo "aparece na tarefa do
  projeto"!) e era copiado para cada projeto por `itemDoModelo` — e a tela nunca
  o desenhou. Quem escrevia a instrução no modelo escrevia para ninguém, e a
  tarefa continuava um título solto. Agora ela aparece embaixo do título e se
  edita como ele: texto para ler, campo ao clicar.
- **O progresso do grupo contava a lista visível.** "0 de 5" numa etapa com três
  tarefas concluídas — porque concluir recolhe o item, e o cabeçalho contava o
  que sobrou à vista. Passa a contar o grupo inteiro, tirando "Não se aplica" do
  denominador, como o resumo do topo.
- **Concluir fazia a linha evaporar.** O item é recolhido (é o pedido do
  briefing), e o efeito era o clique apagar a tarefa da tela: sem o risco em
  xis, sem o contador subindo à vista, e sem como voltar atrás senão indo em
  "Ver recolhidas". Agora a tarefa encerrada NESTA sessão fica — riscada, com o
  tique verde — até a próxima visita à aba. O banco já gravou `oculto`; é só a
  tela não escondendo o que acabou de acontecer.
- **Acrescentar tarefa onde se está olhando**: cada grupo ganhou o seu "+", e a
  tarefa nasce naquela etapa (ou naquele dia). O botão do topo cria no fim da
  lista, que é o certo para ele — mas era o único jeito, e a tarefa nova
  aparecia longe de onde a pessoa clicou.

Junto, duas miudezas: "Minhas tarefas" subiu para o topo do filtro de
responsável (era o filtro mais usado, perdido no meio dos nomes) e a conversa
ganha a linha inteira no celular, onde vinha espremida em três linhas.

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

## Calendário Pólobh (quadro dos projetos)
Substitui o quadro preto de parede onde a produção anotava, à mão, tudo o que
aconteceria no ano — agora preenchido sozinho pelos projetos já cadastrados. É
o **primeiro item** do aplicativo desde 09/09/2026.

A faixa de resumo tem **duas** caixas, não quatro: "Projetos no ano" e "Dias
ocupados" saíram (respondiam perguntas que ninguém faz olhando um calendário, e
ocupavam a dobra inteira antes do quadro). Ficaram as duas que levam a algum
lugar — o mês mais cheio, que abre o mês, e o que acontece agora ou vem a
seguir. O quadro nunca teve badge de pendências, e continua sem: aqui não se
resolve nada.

- **O que entra:** o **período inteiro de ocupação da equipe** — do primeiro dia
  de **Montagem** ao último de **Desmontagem**, passando pelo Evento (revisão de
  15/09/2026; antes era só a etapa Evento). Quem olha o quadro está decidindo se
  cabe mais um projeto na semana, e a equipe está em campo desde a montagem: um
  evento de sábado com montagem na quinta bloqueia três dias, não um.
  Alinhamentos e ensaios continuam fora — são reuniões, não ocupação no local.
  Cada etapa vira um trecho da barra, em **tons da mesma cor do projeto** (cor
  diferente por etapa competiria com a identidade que faz reconhecer o projeto
  de longe). Projeto anterior ao cronograma por faixas cai no campo legado
  `info.evento`.
- **"Projeto sem data" continua sendo sem data de EVENTO:** com o período
  completo, um projeto que só tem montagem marcada já aparece no quadro — e
  deixaria de ser cobrado justamente pelo dado que falta.
- **Feriados** (15/09/2026): os **nacionais** vêm sozinhos da BrasilAPI
  (`/feriados/v1/{ano}`), inclusive as datas móveis; os **municipais de BH** são
  lançados à mão em Configurações › Geral, porque deles **não existe fonte
  oficial em formato de dados**. Ver `domain/feriados.ts`.
- **Vista Calendário:** doze cards de mês, cada um com a mancha do mês em
  trilhas (projetos que se sobrepõem caem em linhas diferentes), a contagem e
  **todos** os nomes — o card cresce o quanto precisar. Ele cortava em quatro e
  resumia o resto em "+N", o que escondia justamente o que se vem ver: num mês
  cheio, "+6 projetos" obrigava a abrir o mês para descobrir quais (revisão de
  09/09/2026). A mancha continua limitada a três trilhas: ali o assunto é "quão
  cheio está", e com dez trilhas de 7px o desenho vira um borrão. **Vista Lista:** o mesmo conteúdo escrito, mês a mês — a leitura de
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

## Aplicando migrações: o que o banco real ensinou (22/09/2026)

As cinco migrações pendentes foram aplicadas no projeto POLOBH. Três coisas só
apareceram ao conferir o schema de produção antes de rodar, e valem para a
próxima vez:

1. **A pasta `supabase/migrations/` não é espelho fiel da produção.** A tabela
   `areas` tem, no banco, a coluna **`ativa`** (área inativa não pode ser
   atribuída a novos usuários) — e não `sistema`, que é o que o arquivo
   `20260809120000_areas_permissoes.sql` declara. Uma migração escrita a partir
   do arquivo teria falhado; escrita com `sistema = false` traduzido para
   `ativa = false`, teria criado as sete áreas **inatribuíveis**. Confira o
   schema real antes de escrever `insert`.
2. **Nome de área é único, e "Produção" já existia.** Um `on conflict (nome) do
   nothing` teria engolido a área nova em silêncio, deixando a matriz com seis
   perfis. A antiga virou **"Produção (legado)"** e manteve seus acessos — o
   vínculo do usuário é por id, e `papel_base` não mudou, então a RLS também
   não.
3. **`revoke all ... from public` NÃO tira o `anon`.** O schema `public` do
   Supabase concede EXECUTE a `anon` e `authenticated` por DEFAULT PRIVILEGES em
   toda função nova, e essa concessão pertence ao papel — o revoke no
   pseudo-papel PUBLIC não a alcança. Numa função `security definer`, que passa
   por cima da RLS de propósito, é a diferença entre uma RPC interna e um
   endpoint aberto em `/rest/v1/rpc`. **A convenção deste banco é
   `from public, anon`** — foi o linter de segurança do Supabase que pegou as
   duas que escaparam dela.

Fora isso, ficou um aviso de segurança que não é do nosso código e vale um
clique: **proteção contra senha vazada desligada** no Supabase Auth (ele checa a
senha contra o HaveIBeenPwned na hora de cadastrar). Liga em Authentication ›
Policies.

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

## Back-up do sistema (25/09/2026)

A pergunta da Pólobh foi "qual a frequência do back-up e como teremos acesso a
ele". A resposta honesta tem duas metades.

**O que o Supabase faz sozinho.** Ele tira back-up do banco todo dia. No plano
gratuito, a retenção é curta e a cópia mora na mesma conta. Isso cobre o
acidente comum (alguém apagou um projeto na terça) e não cobre perder a conta
nem descobrir um estrago depois do fim da retenção.

**O que o sistema passou a fazer.** Um pacote `.zip` com a base inteira, que sai
do servidor e vai para a mão da casa: por e-mail, para uma pasta do Dropbox, ou
no download direto da tela — em **Configurações › Back-up**, onde também mora a
explicação acima, em português de gente, para quem for decidir a frequência.

### As peças

| Onde | O quê |
| --- | --- |
| `supabase/migrations/20260925100000_backup_do_sistema.sql` | tabela `backups` (histórico), `backup_tabelas()`, `backup_anexos()`, a chave `config_app.backup` e o job `backup-do-sistema` |
| `supabase/functions/backup/` | `index.ts` (orquestra), `pacote.ts` (o conteúdo), `zip.ts` (o container), `dropbox.ts` (o envio) |
| `src/domain/backup.ts` | a situação na tela: em dia, atrasado, nunca, desligado |
| `src/pages/Configuracoes.tsx` › `BackupCard` | a tela e o texto didático |

### Decisões que não são óbvias

- **A lista de tabelas sai do catálogo do banco, não de uma lista à mão.** Lista
  à mão envelhece: a tabela nova entra no sistema, ninguém lembra do back-up, e
  a falta só aparece no dia da restauração. E a consulta termina num `LEFT JOIN`
  com todas as tabelas — uma tabela dentro de um ciclo de chaves estrangeiras
  não seria alcançada pela recursão e sumiria do pacote, calada.
- **O cron roda todo dia; quem decide se hoje é dia é a função**, lendo
  `config_app.backup.frequencia`. Trocar semanal por diário é um clique na tela,
  não uma migração.
- **A comparação é por distância, não por dia da semana.** Se a função ficou
  fora do ar na segunda, ela roda na terça. Back-up atrasado é o que se quer;
  back-up pulado, não.
- **O `.zip` é escrito à mão, sem biblioteca** (`zip.ts`, ~120 linhas). O motivo
  é poder testá-lo: o código roda no Deno (onde o back-up nasce) e no Node (onde
  a suíte roda), e a suíte abre o pacote pelo índice do fim do arquivo, como faz
  um descompactador de verdade. O teste já pegou um defeito real — a compressão
  desligada em silêncio, que só apareceria no dia em que um pacote grande não
  coubesse no e-mail.
- **Os CSV saem com `;` e BOM.** O destino é o Excel em português: com vírgula
  ele joga a linha numa coluna só, e sem BOM "Promoções" vira "PromoÃ§Ãµes".
- **Anexos entram até 25 MB.** Sem teto, o dia em que a casa subir muitos
  arquivos é o dia em que o back-up passa a falhar. O que não coube é listado
  pelo nome no `LEIA-ME` e no `manifesto.json`, em vez de sumir.
- **Quem tira é Admin e Direção** — recorte mais estreito que a tela de
  Configurações, porque o pacote leva a base inteira, financeiro incluído. O
  Administrativo lê a explicação e o histórico.
- **O agendamento só executa a ação `agendado`.** Assim o segredo do cron, se
  vazar, não vira um jeito de alguém de fora mandar a base para o próprio
  e-mail.

### Ligar o Dropbox (opcional, uma vez só)

O envio por e-mail funciona sem configuração nenhuma. O Dropbox precisa de três
segredos, criados uma vez:

1. em <https://www.dropbox.com/developers/apps>, criar um app *Scoped access* →
   *App folder* → dar um nome;
2. na aba **Permissions**, marcar `files.content.write` e `files.content.read`,
   e **Submit**;
3. na aba **Settings**, copiar o **App key** e o **App secret**;
4. gerar um *refresh token* (não o "generated access token" da tela — esse dura
   4 horas e o back-up pararia de subir na mesma tarde, em silêncio):
   - abrir no navegador
     `https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline`,
     autorizar e copiar o código;
   - trocar o código pelo refresh token:
     ```
     curl -u APP_KEY:APP_SECRET https://api.dropbox.com/oauth2/token \
       -d code=CODIGO -d grant_type=authorization_code
     ```
5. gravar os três no Supabase (Edge Functions › Secrets):
   `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN` — e, se
   quiser outra pasta, `DROPBOX_PASTA`.

Com os segredos no lugar, basta ligar o interruptor na tela. Sem eles, ligar o
interruptor faz o histórico registrar "Dropbox não configurado" — de propósito:
falha visível é melhor do que um back-up que a casa acha que tem.

### O que o pacote NÃO leva

Senhas (nem embaralhadas — quem as guarda é o serviço de autenticação) e os
logins em si. O cadastro de perfis está lá; recriar o acesso é um passo à parte,
por convite. Está escrito no `LEIA-ME` dentro de cada pacote.
