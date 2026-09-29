# Plano de ajustes — Check-List Pólobh de 15/09/2026

Leitura item a item do check-list enviado pela Pólobh, cruzada com o código que
está no ar. Para cada ponto: **onde é no aplicativo**, **o que entendi que
querem**, **o que proponho fazer** e **o que precisa da sua decisão antes**.

> **Estado em 16/09/2026 — a maior parte disto foi implementada.**
> O plano continua sendo o mapa (onde é no app, o que quiseram, o que muda), e
> ganhou no fim a seção **[12. O que foi feito, e o que
> falta](#12-o-que-foi-feito-e-o-que-falta)** com o estado item a item. Onde a
> decisão era sua e a obra não podia parar, seguimos com a recomendação deste
> documento — e cada uma dessas está marcada lá, para você confirmar ou mandar
> mudar.

## Como ler

| Marca | Significado |
| --- | --- |
| ✅ | **Já está pronto** — o pedido já existe no app; no máximo confere-se |
| 🛠 | **Ajuste direto** — rótulo, ordem, cor, coluna; baixo risco |
| 🧱 | **Obra** — recurso novo ou mudança de arquitetura |
| 🔁 | **Desfaz uma decisão anterior** — foi combinado o contrário em rodada passada; precisa de confirmação |
| 🐞 | **Defeito confirmado no código** |
| ❓ | **Pergunta, não pedido** — resposta, não alteração |
| ⚠️ | **Depende de uma decisão sua** antes de virar tarefa |

**Esforço:** `P` = até meio dia · `M` = 1 a 3 dias · `G` = mais de 3 dias.

## Resumo

| Bloco | Itens | Já pronto | Ajuste | Obra | Reverte decisão | Pergunta |
| --- | --: | --: | --: | --: | --: | --: |
| Geral | 7 | 1 | 1 | 3 | 1 | 3 |
| Calendário | 12 | 2 | 6 | 2 | 2 | 2 |
| Projetos / Dados Gerais | 10 | 2 | 4 | 2 | 2 | 0 |
| Check-list | 5 | 1 | 1 | 2 | 2 | 0 |
| EC | 13 | 2 | 4 | 6 | 2 | 1 |
| OS | 24 | 4 | 7 | 12 | 1 | 1 |
| Cronograma | 5 | 2 | 2 | 1 | 0 | 0 |
| Credenciamento | 6 | 3 | 1 | 2 | 0 | 0 |
| Fornecedores | 3 | 2 | 1 | 0 | 0 | 0 |

**As cinco decisões que destravam o resto** (detalhadas no fim):
1. A **Produtora Responsável** deixa de ver todas as pendências do projeto?
2. O status **"Concluído"** sai do sistema inteiro?
3. O **Calendário** passa a mostrar montagem + evento + desmontagem?
4. Os **7 perfis** do documento viram Áreas no sistema — quem cadastra a matriz?
5. Quem manda nos **valores da OS**: a EC (só leitura na OS) ou o Financeiro?

---

# 1. Geral

### G1 · URL e armazenamento do sistema ❓
**Pediram:** esclarecer onde o sistema fica "armazenado" e qual arquitetura dá
mais velocidade, segurança e back-up.

**Como está hoje:** frontend publicado na **Vercel**; dados no **Supabase**
(Postgres gerenciado, com RLS ligada). O endereço `app.polobh.com.br` é um
apontamento de DNS **no domínio da Pólobh** — ou seja, o endereço é de vocês, e
apontá-lo para outro provedor um dia é trocar um registro de DNS, sem refazer
nada. Arquivos (anexos de check-list e de chamado) ficam em buckets fechados do
Supabase, com link assinado de 60 segundos — não existe URL permanente.

**Recomendação:** manter Vercel + Supabase e subir o Supabase para o **plano
Pro** quando entrar em produção de verdade (ver G3). É o mesmo desenho usado por
empresas muito maiores, e o custo fixo é baixo. Não vejo motivo técnico para
servidor próprio — ele traria back-up, atualização de segurança e monitoramento
para a conta de vocês.

**Nada a fazer no código.**

### G2 · Tela de acesso 🛠 `P`
**Onde:** `src/pages/Login.tsx` e `public/polobh-logo.png`.

| Pedido | O que entendi | Proposta |
| --- | --- | --- |
| Marca sem o quadrado branco, sem o slogan, maior | O PNG atual tem **fundo branco chapado** e o slogan "JUNTOS PARA FAZER PARTE" embutido na imagem | Trocar o arquivo por um **PNG/SVG com fundo transparente e sem o slogan**. O ideal é vocês mandarem o original da marca; se não houver, eu recorto e removo o fundo do arquivo atual |
| "Custos de Eventos" → "Aplicativo Gestão" | É a linha cinza sob o logo | Trocar o texto |
| Excluir "Acesse o painel da Pólobh" | Linha sob o título "Entrar" | Remover |
| Botão "Entrar no painel" → "Entrar" | — | Trocar |
| "© Pólobh Eventos" → "© Pólobh Promoções" | — | Trocar |

⚠️ **Decisão:** "Pólobh Eventos" também aparece na **EC impressa, na OS impressa,
nas planilhas Excel, nos e-mails automáticos e no título da aba do navegador**.
Entendo que a troca é de razão social e vale para tudo — confirme, porque isso
muda documento que vai para cliente e fornecedor.

### G3 · "Esqueceu a sua senha" 🧱 `P`
**Onde:** `src/pages/Login.tsx` + `src/store/auth.ts`.

Hoje **não existe**: quem esquece a senha pede ao suporte pelo Help Desk. Trocar
a própria senha, estando logado, já existe (clicando no nome no canto superior).

**Proposta:** link "Esqueceu a senha?" na tela de login → e-mail com link de
redefinição (recurso nativo do Supabase) → tela nova de senha, usando a mesma
régua já testada (mínimo 8 caracteres, diferente da atual, confirmada).

⚠️ Depende de **e-mail saindo de verdade**. Hoje os e-mails do sistema estão em
homologação (só o Help Desk atravessa). Antes de ligar isto, é preciso concluir a
configuração do Brevo com um remetente do domínio `polobh.com.br`.

### G4 · Back-up ❓ + 🧱 `P`
**Pediram:** frequência, como acessar, se fica no mesmo domínio.

**Como está hoje:** o Supabase no plano gratuito faz cópia diária, com retenção
curta, e **não** oferece restauração a um ponto no tempo. O back-up fica na
infraestrutura do Supabase — mesma nuvem do banco, não no domínio de vocês.

**Recomendação (é aqui que eu mexeria):**
1. Subir para o **plano Pro** do Supabase: back-up diário com 7 dias de retenção
   e *point-in-time recovery* (voltar o banco para "ontem às 14h32").
2. Somar a isso uma **cópia semanal para fora do Supabase** — uma rotina agendada
   que exporta o banco e joga no Dropbox/Drive da Pólobh. É o que garante que uma
   falha do fornecedor não leve tudo junto. Casa bem com o pedido G5.
3. Documentar quem tem a chave e como se restaura.

Confirmando o caminho, viro item de trabalho.

### G5 · Arquivo automático dos documentos no Dropbox 🧱 `G`
**Pediram:** avaliar com o Max salvar automaticamente todo documento gerado nas
pastas Dropbox da rede da Pólobh.

**Como está hoje:** nada disso existe. Excel e PDF são **gerados na hora** e vão
para a pasta de downloads de quem clicou.

**É viável.** Caminho: app Dropbox da Pólobh (autorização uma vez) + rotina no
servidor que, a cada EC/OS emitida, grava o arquivo na pasta do projeto.

⚠️ **Precisa antes:** (a) o Max autorizar um app Dropbox na conta da empresa;
(b) vocês definirem a **estrutura de pastas e o padrão de nome** — é a parte que
não posso decidir sozinho. Sugiro `/Projetos/{Ano}/{Cliente} — {Projeto}/EC/` e
`/OS/`. Só o desenvolvimento é `G`.

### G6 · Gestão das pendências — quem vê o quê 🔁 ⚠️ `M`
**Pediram:** *"que o número e as pendências apareçam apenas para os seus
responsáveis — sempre para os destinatários dos comentários. Ou seja, não vamos
considerar o pedido que eu tinha feito antes de incluir em todas as pendências a
produtora responsável."*

**Onde:** `src/domain/pendencias.ts` → `agregarPendencias`.

**Como está hoje:** existem **duas portas** para uma pendência chegar a alguém:
ser o destinatário (@mencionado, responsável do comentário, dono da tarefa) **ou**
ser a Produtora Responsável do projeto — que hoje vê tudo que nasce dentro dele.
Tirar a segunda porta é uma linha de código.

⚠️ **O problema:** quatro pendências **não têm destinatário nominal** e hoje são
endereçadas à produtora justamente por isso:
- OS em rascunho esperando emissão;
- cronograma da OS vazio;
- credenciamento sem resposta do fornecedor;
- projeto ativo sem nenhuma EC.

Se a produtora sair de cena, **essas quatro ficam sem dono e somem do sistema**.

**Proposta:** tirar a produtora das **conversas** (é disso que o pedido fala — ela
recebia a bolinha de toda troca de mensagem entre duas colegas) e **mantê-la nas
quatro pendências de sistema acima**, que não têm a quem endereçar. Se você
preferir remover em todos os casos, também faço — mas aí é preciso dizer quem
passa a responder por elas.

E note: no item E8 vocês pedem **explicitamente** que "Emitir OS/Contrato" seja
pendência **da produtora responsável**. Ou seja: a regra que vocês querem não é
"a produtora não vê nada", é "a produtora não herda conversa dos outros". É como
vou implementar, salvo instrução em contrário.

### G7 · Número do badge = número do pop-up ✅ + 🛠 `P`
**Pediram:** os números dos badges vermelhos têm de bater com o pop-up de
localização em todas as etapas.

**Como está hoje:** a regra já é essa — badge e pílula saem da mesma lista. A
divergência que aparece no seu print (linha da EC com **5**, pílula com **6**) tem
explicação: a pílula da aba soma **a conversa da própria aba**, que não tem linha
na lista. Ou seja, o "a mais" é a conversinha que vocês pedem para **excluir**
dessa página no item E1. **Removida a conversa da aba EC/OS, os números passam a
bater sozinhos.**

Vou conferir etapa por etapa depois das mudanças e corrigir o que sobrar.

### G8 · Revisão de texto e caixa alta/baixa por IA 🛠 + 🧱 `M`
**Pediram:** obrigar o sistema a rever a formatação (caixa alta/baixa) e a fazer
revisão de texto em **todos** os textos do aplicativo.

**Como está hoje, e é mais do que parece:**
- **Caixa alta e baixa** já é resolvida no caminho da gravação
  (`src/domain/textos.ts`): todo save passa por ela, venha de digitação, da
  consulta de CNPJ (a Receita devolve tudo em MAIÚSCULA) ou de importação.
- **Revisão de texto por IA** já existe para os **descritivos da EC e do projeto**
  (função `corrigir-descricoes-ec`), preservando valores e termos técnicos.

**O que falta, e proponho fazer:**
1. Estender a revisão de texto aos textos da **OS** (observações gerais,
   descritivo da NF, cláusulas do contrato) e do **check-list**.
2. Rodar uma **varredura única** no que já está gravado — o passivo antigo.
3. Ficam **de fora de propósito**, e recomendo manter assim: documento, telefone,
   e-mail, código de serviço, apelido do cliente/fornecedor ("BM" viraria "Bm") e
   **nome do item da EC**, que é curto e cheio de sigla da casa ("ECAD", "VT",
   "MÍDIA") — ali o automático erra mais do que acerta.

⚠️ Cada revisão por IA é uma chamada paga. Estender a tudo aumenta o custo por
salvamento. Sugiro rodar **no salvamento do documento**, não a cada tecla.

### G9 · Duplicidade de acesso ao mesmo documento 🧱 `M`
**Pediram:** o sistema não pode permitir editar, substituir, arquivar, cancelar ou
emitir um documento que **outro usuário tenha aberto em modo de edição**.

**Como está hoje:** existe uma trava, mas é de **outro tipo**. Ela é *otimista*:
deixa os dois abrirem e, na hora de salvar, o segundo recebe "este documento mudou
enquanto você editava, recarregue" (`EC_CONFLITO_EDICAO`). Nada se perde, mas o
trabalho do segundo é refeito — que é exatamente o incômodo relatado.

**Proposta:** trava de **presença**. Ao entrar em edição, o documento fica marcado
com quem está mexendo; os demais veem "Marisa está editando desde 14h20" e abrem
em leitura. A marca cai sozinha por inatividade (senão uma aba fechada no susto
trancaria o documento para sempre) e pode ser liberada pela Direção.

Vale para EC, OS e Dados Gerais do projeto.

---

# 2. Calendário

### C1 · Título "Calendário Pólobh" ✅
Já é o título da tela, e o subtítulo já diz *"O ano inteiro num quadro só: todo
projeto do primeiro ao último dia."* Ajusto a redação para a frase exata do
check-list se quiser. `P`

### C2 · "Encerrados" → "Arquivados" 🛠 `P`
`src/pages/Calendario.tsx`. Troca de rótulo. Conecta-se ao C8: hoje esse filtro
recolhe Arquivado **e** Concluído **e** Cancelado.

### C3 · "Toda Modalidade" → "Todos" 🛠 `P`

### C4 · Filtrar por Produtora Responsável 🛠 `P`
Terceiro seletor, alimentado pelos nomes já cadastrados nos projetos.

### C5 · Os dois filtros agem juntos? ❓
**Sim.** São cumulativos: Ativos + Culturais + "Marisa" devolve os projetos
culturais ativos da Marisa. Com o filtro de produtora (C4) continua valendo.

### C6 · Excluir "Mês mais cheio" e "Próximo Evento" 🛠 `P`
São as duas caixas da faixa de resumo. Saindo as duas, **a faixa inteira
desaparece** e o quadro do ano sobe para logo abaixo do título — que entendo ser o
objetivo.

### C7 · Feriados nacionais e de Belo Horizonte 🧱 ⚠️ `M`
**É possível.** Sobre a fonte, que é o que vocês perguntam:
- **Nacionais:** a BrasilAPI (`/feriados/v1/{ano}`) devolve a lista oficial, é
  pública e gratuita. Resolve o federal, inclusive as datas móveis (Carnaval,
  Corpus Christi).
- **Municipais de BH:** **não existe fonte oficial em formato de dados.** Os
  feriados municipais saem de lei municipal. Aqui não há automático confiável.

**Proposta:** uma tabela de feriados em Configurações, semeada automaticamente com
os nacionais a cada virada de ano e com os **municipais lançados à mão uma vez por
ano** (são poucos: 8/12 Nossa Senhora da Conceição, 15/08 Assunção, 26/06
Sagrado Coração — confirmar com vocês a lista que a casa considera). Aparecem na
lista, na tabela e no detalhamento, com cor própria.

### C8 · Acabar com "Concluído" 🔁 ⚠️ `M`
**Pediram:** todo o sistema deve considerar somente "Ativo" ou "Arquivado", para
todos os documentos, inclusive EC e OS.

**Como está hoje:** na **EC isso já foi feito** (só Ativa/Arquivada desde 09/09).
No **projeto**, porém, o status é calculado e ainda tem quatro leituras: Ativo,
Concluído (evento passou e a estimativa continua de pé), Arquivado, Cancelado.

**Proposta:** aposentar "Concluído" e "Cancelado" no projeto, deixando **Ativo** e
**Arquivado**. Consequência que você precisa conhecer: hoje projeto "Concluído"
**para de gerar pendência de conversa** automaticamente. Sem esse estado, o projeto
de um evento que já passou continua cobrando a equipe até alguém **arquivar o
projeto**. Ou seja, arquivar deixa de ser opcional e vira parte da rotina de
encerramento.

Se topar, implemento junto um lembrete: "evento realizado há X dias e o projeto
continua ativo".

### C9 · Período completo: montagem + evento + desmontagem 🔁 ⚠️ `M`
**Pediram:** nos modos Lista, Calendário e Detalhamento o sistema deve registrar o
período completo.

**Como está hoje:** o quadro mostra **só a etapa Evento**, por decisão da rodada
anterior ("o quadro é de quando o projeto acontece"). Os dados de montagem e
desmontagem existem e estão preenchidos — é só a leitura que os ignora.

**Proposta:** passar a usar do **primeiro dia de montagem ao último de
desmontagem**, com **cores diferentes por etapa** no detalhamento do mês (que é o
C12). Efeitos colaterais a aceitar: os meses ficam visivelmente mais cheios,
projetos que não se cruzavam passam a se sobrepor em trilhas diferentes, e a
contagem de dias ocupados cresce.

Confirmando, faço de uma vez só com o C12.

### C10 · Excluir "Nenhum Projeto neste mês" e "Ver os dias" 🛠 `P`
"Ver os dias" é hoje **o comando que abre o detalhamento do mês**. Removendo o
texto, mantenho o **card inteiro clicável** (já é) e o cursor de mão — senão o
detalhamento fica inacessível no modo Calendário.

### C11 · Coluna de Produtora Responsável no modo Lista 🛠 `P`
Possível — o dado já está no projeto.

### C12 · Detalhamento do mês 🛠 + 🧱 `M`
| Pedido | Proposta |
| --- | --- |
| Nome do cliente → Produtora Responsável | Troca direta. ⚠️ Confirme se o cliente **sai** ou se os dois convivem (cliente + produtora em letra menor) |
| Cores por etapa (montagem, evento, desmontagem) | Depende do C9. Hoje a barra é de uma cor só, por projeto |
| Rodapé: "A barra considera todas as etapas do projeto — Montagem, Evento e Desmontagem" | Troca de texto, junto com o C9 |
| Legenda: Fim de Semana, Hoje e **Feriado** com cor nova | Fim de semana e hoje já são desenhados, sem legenda. Feriado depende do C7 |

---

# 3. Projetos e Dados Gerais

### P1 · Coluna Produtora Responsável na lista de Projetos 🛠 `P`
### P2 · Coluna com as datas do evento 🛠 `P`
Só as datas do **evento**, como pedido — mesmo com o C9 mudando o Calendário.

### P3 · Cabeçalho de todas as abas com data, local e produtora 🛠 `M`
**Onde:** o cabeçalho grudado (`PageShell`) e a barra do projeto.

Entendi: uma linha discreta sob o título do projeto/EC/OS, visível em qualquer
aba. Dentro da **OS** há uma sutileza: a OS guarda a **foto** dos dados do projeto
de quando foi emitida (é o que a torna um documento imutável). Vou mostrar a foto
da OS, não o dado de hoje — senão o cabeçalho diria uma coisa e o corpo do
documento, outra. Se preferir o dado atual, com aviso de divergência, também dá.

### P4 · Inscrição Estadual não encontrada → "Isenta" 🛠 `P`
Hoje, quando a consulta não acha a IE, o campo fica **vazio**. Passa a gravar
"Isenta". Vale para cliente e, pelo item O10, também para fornecedor.
⚠️ Só para quando a fonte **responde e não encontra**. Se a consulta cair, mantenho
vazio: gravar "Isenta" por causa de um erro de rede é pior que o campo em branco.

### P5 · Alterações nos Dados Gerais repercutem em todas as etapas ✅ + ⚠️
Já existe, e funciona assim: **Calendário e Cronograma** leem o projeto ao vivo,
então acompanham na hora. **EC e OS** são documentos — ao salvar, o sistema
compara o que mudou e oferece atualizar a EC em aberto e gerar nova versão das OSs
emitidas. Ver P7, que muda justamente esse comportamento.

### P6 · Excluir a frase sob o título, manter só "Modo leitura" 🛠 `P`

### P7 · Pop-up de alerta ao salvar os Dados Gerais 🔁 ⚠️ `P`
**Pediram** um alerta com o texto: *"Os dados gerais deste projeto foram
atualizados. Os próximos documentos serão emitidos com as novas informações. Os
documentos já emitidos não serão alterados. Substitua os documentos que precisarem
de atualização."*

**Atenção — isto contraria o que o app faz hoje.** Hoje, ao salvar, abre um
comparativo (`campo: antes → depois`) que **oferece** atualizar a EC em aberto e
gerar nova versão da OS, com um clique. O texto pedido diz o oposto: nada é
atualizado, e a substituição é manual.

**Duas saídas, escolha uma:**
- **(a)** Trocar mesmo: o comparativo some, fica só o alerta. Mais simples de
  entender, mas quem esquecer de substituir fica com documento velho no ar.
- **(b) — minha recomendação:** manter o comparativo (que é útil e já está pronto)
  e usar **esse texto como o alerta de abertura dele**, deixando as duas opções
  desmarcadas, como já estão. Você ganha o aviso e não perde o atalho.

### P8 · Conversinha no alto dos Dados Gerais 🔁 `P`
Hoje Dados Gerais **não tem** conversa, de propósito ("é o cadastro do evento"). O
pedido reverte isso. É simples de ligar e não vejo prejuízo — só registro que foi
decisão consciente na rodada passada.

### P9 · Título "Observações" e texto padrão em todo o sistema 🛠 `P`
**Onde:** `src/components/CardConversa.tsx` — a peça é uma só, mas cada tela passa
hoje um texto diferente.

Padronizo: título **"Observações"** (sem o "— EC", "— OS") e a frase *"Neste campo
a equipe da Pólobh registra suas observações e pendências sobre esta etapa do
trabalho"* em **todas** as etapas. ⚠️ Registro que se perde uma informação útil que
está lá hoje: *"não sai em documento, e-mail nem planilha"* — é o que garante à
equipe que pode escrever à vontade. Sugiro manter essa frase em letra menor.

### P10 · Incentivos Fiscais vira três campos 🔁 `M`
**Pediram:** trocar o campo "Incentivos Fiscais" por **Nome do Projeto
Incentivado**, **Lei de Incentivo à Cultura** e **Código do Projeto Incentivado**.

**Como está hoje:** no **projeto** é um campo de texto livre; na **OS** já são dois
campos (Nome do Projeto Incentivado + "Lei de Incentivo à Cultura", que junta a lei
e o número num só, por decisão anterior).

**Proposta:** três campos no projeto, alimentando automaticamente a OS e os
documentos (é o que o item O9 pede). Precisa de migração do banco e de conversão do
que já está gravado — os textos antigos entram em "Lei de Incentivo" e alguém
revisa. Faço uma tela de conferência se forem muitos.

---

# 4. Check-list

### CL1 · Modelos Corporativo e Cultural
Aguardando as planilhas de vocês. Nada a fazer até chegarem — quando chegarem, é
cadastro em Configurações › Check-list, **sem tocar em código**.

### CL2 · Conversinha no alto da aba Check-list 🔁 `P`
Mesmo caso do P8: hoje está fora de propósito ("a aba já é feita de tarefas com
dono e prazo"). Ligo se confirmar.

### CL3 · Conversinha de cada item embaixo da linha, como na EC 🔁 `M`
**Como está hoje:** desde a revisão de 10/09 a conversa de cada tarefa fica
**encostada à direita, dentro da própria linha** — e foi assim justamente para
encurtar a lista (ela ficou um terço mais curta; antes cada tarefa gastava uma
faixa inteira só para dizer "Adicionar Observação").

**O pedido reverte isso.** Faço, com uma ressalva: proponho a linha de conversa
abaixo do item **só quando houver conversa ou pendência**; nas tarefas sem
observação, mantenho o convite discreto. Assim atende ao padrão da EC sem a lista
voltar a triplicar de altura. Se quiser igual à EC em todos os casos, também faço.

### CL4 · Criar e movimentar etapas e itens 🧱 `M`
Hoje já dá para **acrescentar tarefa em cada etapa** (o "+" de cada grupo) e
excluir. Falta: **criar e renomear etapas**, e **mover** tarefas e etapas por
arraste ou setas. O mecanismo de arrastar/setas já existe pronto na EC e no
cronograma — é reaproveitar.

### CL5 · Pendência vermelha fixa, não piscando 🛠 `M`
**Pediram:** hoje a pendência **pisca** quando acionada; querem que fique
**vermelha enquanto estiver pendente** e enquanto for a apontada pelo pop-up.

Este pedido aparece **quatro vezes** no check-list (Check-list, EC, Resumo de
Custos, Cronograma) — é um comportamento só, mudado num lugar
(`src/lib/destaque.ts`).

**Proposta:** duas marcas distintas: **(1)** contorno vermelho **permanente** em
todo elemento com pendência aberta, e **(2)** um realce mais forte no item que o
pop-up está apontando naquele momento, que sai quando se avança para o próximo.
É o que entendi do pedido, e resolve a queixa de "pisquei e perdi de vista".

---

# 5. EC

### E1 · Excluir a conversinha da tela principal das ECs 🔁 `P`
A conversa da **aba EC do projeto** (a listagem). A conversa **dentro** da EC
continua. Como dito no G7, isso também acerta os números dos badges.

### E2 · Excluir o pop-up de pendências da lista de ECs 🛠 `P`
A pílula flutuante sai dessa tela. ⚠️ Registro a perda: é por ela que se navega de
pendência em pendência. Ficam os badges vermelhos nas linhas, que continuam
levando à EC certa. Concordo que na listagem ela sobra.

### E3 · Rótulos e ordem dos botões da EC 🛠 ⚠️ `P`
**Hoje:** `Arquivar EC · Gerar nova versão · Excel ▾ · Ver / PDF · Emitir OS ·
Editar EC`

**Pedido:** `Editar EC · Gerar Nova Versão EC · [Arquivar EC — eliminar?] · EC
Excel ⬇ · EC PDF 👁 · Emitir OS(s)`

- Alerta ao gerar nova versão: *"Ao gerar uma nova versão da EC, a versão atual
  será arquivada automaticamente."* — troco o texto atual por este.
- **"EC Excel"** hoje é um menu com duas saídas: **Financeiro** e **Completa**.
  ⚠️ Confirme: mantenho o menu (com o ícone de download) ou passa a existir um
  Excel só?
- **Sobre eliminar o "Arquivar EC"** — respondendo à dúvida de vocês: ele serve
  para o caso de a EC sair do ar **sem substituta**, deixando o projeto sem
  estimativa valendo (evento cancelado pelo cliente, por exemplo). Se eliminarmos,
  a única forma de tirar uma EC do ar passa a ser gerar outra por cima. Existe
  também "Tornar EC ativa", que traz uma arquivada de volta. **Minha sugestão:**
  manter o botão, mas só para a Direção. Se ainda assim quiser eliminar, eu
  elimino.

### E4 · Barra do modo edição igual à de leitura 🛠 ⚠️ `M`
**Hoje, em edição:** `Excel Financeiro · Excel Completa · Revisar · Cancelar ·
Salvar`

**Pedido:** a mesma barra do modo leitura, com "Editar EC" substituído por
**Revisar** e **Salvar** (dois botões), **sem** Cancelar, **sem** Arquivar, **sem**
Emitir OS.

Concordo com tudo — inclusive tirar "Emitir OS" da edição: emitir OS a partir de
uma EC com alterações não salvas é pedido de confusão.

⚠️ **Uma ressalva e uma pergunta:**
- Sem "Cancelar", a saída da edição é navegar para fora; o sistema já pergunta
  "há alterações não salvas, sair mesmo?". Funciona, mas é menos explícito. Sugiro
  manter um "Sair da edição" discreto, à esquerda.
- **"Ao clicar em Revisar, o sistema pode mostrar o que foi alterado antes de
  salvar?"** — hoje o botão "Revisar" faz outra coisa: é a **revisão ortográfica**
  dos textos. Mostrar o que mudou (campo a campo, antes → depois) é recurso novo,
  perfeitamente possível (`M`). **Escolha:** (a) "Revisar texto" e "Conferir
  alterações" viram dois botões; ou (b) "Revisar" passa a fazer as duas coisas numa
  tela só — revisa o texto e mostra o comparativo antes de salvar. **Recomendo a
  (b)**, é um clique a menos e um lugar só para conferir.

### E5 · Quem pode criar, editar e substituir EC 🧱 ⚠️ `M`
**Pediram:** podem — Diretoria Produção, Coordenação Produção, Produção,
Back-office. Não podem — Direção Adm-Financeira, Coordenação Adm-Financeira,
Assistência Adm-Financeira.

**Como está hoje:** o sistema não tem esses sete perfis. Ele tem quatro papéis-base
(Admin, Direção, Produção, Administrativo) e, acima deles, **Áreas** — cada área
define quais telas seus usuários veem e editam. Ou seja, **a estrutura para isso já
existe**; o que falta é cadastrar as sete áreas com a matriz certa.

**Proposta:** eu crio as **sete áreas** com os nomes exatos do documento e a matriz
de permissões, seguindo este e os demais itens de perfil (E13, O16). Depois disso,
mexer em quem pode o quê é **tela de Configurações, sem desenvolvedor**.

⚠️ Preciso de **uma tabela de vocês**: sete perfis × o que cada um vê e edita. Os
itens do check-list cobrem EC, Rentabilidade e OS; faltam Projetos, Check-list,
Cronograma, Credenciamento, Fornecedores e Configurações.

### E6 · Conversinha padronizada no topo e por item ✅ + 🛠
Os dois lugares já existem na EC. Só muda título e texto (P9).

### E7 · Importação do Resumo das Propostas não funciona 🐞 `M`
**Onde:** botão que lê a proposta do fornecedor (PDF/imagem/Excel) e escreve o
resumo em "Descrição Completa".

Preciso reproduzir para dizer a causa. As duas hipóteses prováveis: a função de IA
no servidor não está publicada/com saldo, ou o resumo está sendo **acrescentado ao
fim** do que já existe no campo em vez de substituir — e aí parece que "não
funcionou". Investigo e trago o diagnóstico antes de mexer.

### E8 · Campos do item da EC 🛠 + 🧱 `M`

| Pedido | Situação | Proposta |
| --- | --- | --- |
| Todos os campos nascem pendentes, inclusive CNPJ e Razão Social | Aprovação, OS e Contrato já nascem "Pendente". CNPJ e Razão são texto livre, sem estado | Marcar fornecedor vazio com o mesmo visual de pendente |
| Seleção múltipla para alterar Aprovação, OS e Contrato — junto ou separado | Hoje a seleção múltipla existe, mas só com "Aprovar e liberar OS" e "Reverter" | Trocar por três seletores na barra da seleção: Aprovação, OS e Contrato, aplicáveis isoladamente |
| **"Não estou conseguindo emitir OS's"** | 🐞 **Encontrei a causa** | Ver abaixo |
| CNPJ e Razão podem ficar pendentes mesmo com a EC aprovada (só obrigatórios para OS e contrato) | Hoje a aprovação não exige fornecedor — a **emissão** exige | Confirmo o comportamento e ajusto as mensagens |
| Documento PG, Código de Serviço e Pedido de Compra deixam de ser editáveis e vêm da OS | Hoje são digitados **na EC** | Virar somente leitura e receber o dado da OS (ver O17) |
| OS e Contrato logo após Aprovação, antes do fornecedor | Hoje ficam no fim da linha | Reordenar |
| "Emitir"/"Emitir Nova Versão" de OS e Contrato geram pendência **para a produtora** | Já existe, uma por item | ✅ — e é o oposto do G6; ver a nota lá |
| Fornecedor faltando em item aprovado gera pendência para a produtora | Não existe | Criar |

🐞 **Por que a OS não emite.** A regra atual só libera a emissão quando o item tem:
aprovação OK, razão social, CNPJ completo, **Documento PG**, **Código de Serviço**,
**Pedido de Compra** e justificativa do BV quando fora do padrão. Só que o próprio
check-list diz que Documento PG, Código de Serviço e Pedido de Compra **nascem na
OS**, não na EC. É um nó: a EC exige, para emitir a OS, três dados que só a OS
produz. **Retirar essas três exigências resolve a emissão** e alinha a regra ao que
vocês descrevem. (Se, mesmo com itens prontos, o botão não aparecer, o outro motivo
possível é nenhum item estar com OS = "Emitir" — nesse caso o botão nem é
desenhado. Vou fazer o botão aparecer sempre, explicando o que falta.)

### E9 · "Alternativas de Custos" — a tabelinha 🔁 `M`
**Pediram:** trocar o título para *"Alternativas de Custos: Informe as negociações
possíveis a serem definidas no ato da emissão das OS's"*, excluir "Valor do Item na
EC", e trocar os três blocos lado a lado por **uma tabela compacta**:

| Modalidade | Valor | BV | Observações sob o BV |
| --- | --- | --- | --- |
| Valor com BV e NF | valor ou Não se aplica | % ou valor ou Não se aplica | editável |
| Valor Sem BV e Com NF | valor ou Não se aplica | não se aplica | editável |
| Valor Sem BV e Sem NF | valor | não se aplica | editável |

...ocupando o **menor espaço possível**, **ocultável item a item**.

Concordo — os três cartões atuais comem a largura da tela. Faço a tabela recolhida
por padrão, mostrando uma linha-resumo ("3 formas informadas · a definir na OS"),
que abre no clique. É a mesma informação em um quinto do espaço.

⚠️ Confirmo o entendimento: **"Esta tabelinha não impacta em nada na EC, apenas na
OS"** — ou seja, o valor que a EC totaliza continua sendo o valor do item, e estas
três linhas são alternativas de negociação. É como está hoje.

### E10 · Honorários 15% e Encargos 16,33% ✅
Já é exatamente assim: os dois nascem com esses percentuais, são aplicados
automaticamente e continuam editáveis. Nada a fazer.

### E11 · O pop-up está cobrindo a planilha 🛠 `P`
A pílula flutuante tapa a última linha do Resumo de Custos. Resolvo com folga no
rodapé das telas que têm pílula, para o documento poder subir. Vale para EC e OS.

### E12 · Pendência vermelha fixa
Mesmo item do CL5.

### E13 · Aba Rentabilidade por item 🧱 ⚠️ `G`
O bloco mais pesado da lista. Hoje a aba tem quatro colunas (Item · Estimado ·
Gasto OS · Rentabilidade), sem exportação e sem os custos internos.

| Pedido | Proposta |
| --- | --- |
| Conversinha no topo + título/texto padrão | 🛠 `P` |
| Colunas: Item · **Valor na EC** · **Valor Líquido OS** · Rentabilidade · **Justificativa Rentabilidade** | Renomear as três primeiras. A justificativa hoje vive **por forma de cobrança dentro da OS** — puxo a que valeu no item. Como o texto é longo, fica um ícone que abre a justificativa, como vocês sugerem |
| Incluir Honorários Pólobh e Encargos nas linhas de custo | ⚠️ **Preciso alinhar a conta.** Hoje honorários e encargos são **receita** da Pólobh (entram no valor cobrado do cliente). Tratá-los como **custo** muda o resultado para baixo. Entendo que vocês querem ver **quanto do valor da EC vira margem depois de tudo**. Antes de programar, me mande um exemplo numérico de um projeto com o resultado que esperam ver — é o jeito seguro de não errar a fórmula |
| Outros custos internos, fora da EC, considerados no cálculo | Tabela nova na aba, com descrição e valor, lançada à mão. `M` |
| Percentual calculado sobre o valor total da EC | Ajusto o denominador |
| Gerar Excel e PDF da rentabilidade | `M` |
| Visível só para Diretoria Produção, Direção Adm-Fin, Coordenação Produção, Coordenação Adm-Fin | Hoje a aba usa a mesma permissão do **bloco financeiro** — quem vê valor, vê rentabilidade. Crio uma permissão **própria** para Rentabilidade. `P` |

---

# 6. OS

### O1 · Excluir a conversinha da lista de OSs do projeto 🔁 `P`
Igual ao E1.

### O2 · Rótulos de status: Rascunho / Emitida / Cancelada / Arquivada 🛠 ⚠️ `M`
**Hoje:** Rascunho, **Disparada**, Cancelada, Arquivada (e "Emitida" existe no
código, sem uso claro).

**Proposta:** os quatro pedidos, com estas transições automáticas:
- **Rascunho** — nasce assim, ao ser gerada pela EC;
- **Emitida** — quando conclui o fluxo (ver O21/O23) e o documento sai;
- **Cancelada** — quando cancelada à mão ou substituída por nova versão;
- **Arquivada** — automaticamente quando o **projeto** é arquivado, e quando uma
  nova versão a substitui.

⚠️ "Disparada" quer dizer "e-mail enviado ao fornecedor" — informação diferente de
"emitida". Proposta: vira uma marca ao lado ("enviada em 12/09"), não um status.
Confirma?

### O3 · Filtros na lista de OSs do projeto 🛠 `P`
Todas · Rascunho · Emitida · Cancelada · Arquivada, iguais aos da EC. (A lista
geral de OSs já tem filtro; a do projeto, não.)

### O4 · Menu da OS igual ao da EC, com modo leitura 🧱 ⚠️ `G`
**Hoje:** `Recolher tudo · Baixar PDF · Salvar · Disparar OS` — e a OS **abre
sempre em edição**.

**Pedido:** `Recolher/Expandir · Editar OS · Gerar Nova Versão OS · Revisar ·
Salvar · Cancelar OS · Arquivar OS · OS PDF 👁`, abrindo em **leitura**.

É a mudança mais estruturante do bloco OS, e concordo com ela: hoje qualquer pessoa
que abre uma OS emitida está, tecnicamente, editando um documento que já foi para o
fornecedor.

⚠️ **Duas perguntas:**
1. **"Disparar OS"** (o e-mail ao fornecedor) **não está na sua lista**. Ele
   desaparece, ou continua — e em que momento? Meu palpite: ele passa a ser o
   **"Enviar OS para Emissão Back-Office"** (O21), e quem dispara de fato é o
   Back-office. Confirme.
2. "Gerar Nova Versão OS" hoje só acontece em dois casos (troca de fornecedor e
   mudança nos dados do projeto). Vira botão livre, a qualquer momento?

### O5 · Conversinha no alto de cada OS ✅ + 🛠
Já está no topo desde 09/09. Só título e texto (P9).

### O6 · Excluir o pop-up de pendências 🛠 `P`
⚠️ **Atenção para não corrigir errado:** este pedido está escrito na seção *"Dentro
das OS's"*, mas a imagem que o acompanha é a **listagem de OSs do projeto**, não a
tela de dentro da OS. Vou tratá-lo como **listagem** (igual ao E2) e **manter** a
pílula dentro da OS, onde ela é o caminho para achar o campo pendente — que é
justamente o que o item O24 pede. Me corrija se a intenção era tirar dos dois.

### O7 · Módulo "Ordem de Serviço" 🛠 `P`
Excluir a linha **Status** de dentro do módulo e **reduzir a altura das linhas**.

⚠️ Sobre a altura: o pedido se repete em quase todos os módulos (O8, O9, O10) e é
sempre "reduzir para diminuir o documento". Faço **uma vez, para a OS inteira** —
uma OS de seis itens deve encolher de 25% a 30% em número de páginas. Vale para a
tela, o PDF e o Excel.

### O8 · Dados do Cliente 🛠 `P` — só a altura (O7).
### O9 · Dados do Projeto 🛠 `P` + 🧱
- Altura das linhas (O7);
- Os três campos de incentivo, automáticos dos Dados Gerais → depende do **P10**;
- **Datas e horários múltiplos** — ✅ **já resolvido**: a OS lê o cronograma inteiro
  e mostra todas as faixas ("Data(s)" e "Horário(s)"). Confiro caso a caso com um
  evento de vários dias, mas a regra está no lugar.

### O10 · Dados do Fornecedor 🛠 `P`
Altura das linhas + Inscrição Estadual "Isenta" quando não encontrada (igual ao P4).

### O11 · Detalhamento da Contratação 🔁 ⚠️ `G`
O item mais delicado do check-list, porque **inverte quem manda no valor**.

**Hoje:** os valores chegam prontos da EC e **seguem editáveis na OS** — "a EC
levanta o preço, a OS fecha a condição", decisão de 09/09.

**Pedido:** a tabela de valores e justificativas **não é editável na OS** (só na
EC); o Financeiro apenas **escolhe uma das opções** (valor e forma de pagamento), e
a escolha atualiza o Resumo de Custos.

**Entendi assim, e é coerente:** a negociação e os números são da **Produção**, na
EC; ao Financeiro cabe **escolher qual das alternativas vale nesta OS** — não mudar
preço. É o mesmo raciocínio da tabelinha do E9 ("informe as negociações possíveis a
serem definidas no ato da emissão das OS's"). ⚠️ Confirme, porque significa que
**um valor negociado na última hora obriga a voltar na EC** — que é, entendo, o
controle que vocês querem.

Os demais pontos do módulo:
- **Descritivo Financeiro e Descritivo Completo continuam editáveis** — ok, já são;
- **Todos os itens do mesmo fornecedor em uma única OS** — ✅ já é assim;
- **Consolidar no fim do módulo** o total contratado, o total de BV, o líquido, o
  prazo de pagamento e o documento fiscal, sob o título **Resumo dos Custos**,
  trazendo para dentro o que estava no módulo "Pagamento ao Fornecedor". `M`
- **Nunca misturar modalidades de pagamento na mesma OS** (com BV e NF / sem BV e
  com NF / sem BV e sem NF). ⚠️ Isso muda a **emissão**: hoje a EC agrupa por
  fornecedor; passará a agrupar por **fornecedor + modalidade**. Dois itens do
  mesmo fornecedor em modalidades diferentes viram **duas OSs**. Confirme que é
  isso mesmo — é uma consequência silenciosa e importante.

### O12 · "Resumo da Contratação" → "Cronograma | Logística | Infraestrutura" 🛠 `M`
- Renomear o módulo;
- **Excluir "Entrega"**;
- **"Não se aplica"** para o Cronograma inteiro e para **cada item** de logística e
  infraestrutura (já existe por item; falta para o cronograma);
- **Criar novos grupos e novos itens** além dos previstos — hoje a lista é fixa.
  🧱 `M`
- **Arrastar/setas** nos itens — reaproveito o mecanismo que já existe;
- **Um item por linha**, não lado a lado — 🛠 `P`.

### O13 · "Observações Gerais" em módulo separado 🛠 `P`
Com "Não se aplica" próprio.

### O14 · Excluir o módulo "Pagamento ao Fornecedor" 🛠 `P`
Depois do O11, que absorve o conteúdo.

### O15 · Botão "Enviar OS para Conclusão Financeiro" 🧱 `M`
Gera pendência automática para a **Coordenação Administrativo-Financeira**.
Depende de E5 (os perfis existirem).

### O16 · Permissão por **etapa** da OS 🧱 ⚠️ `G`
**Pediram:** até a etapa do financeiro, editam Diretoria Produção, Coordenação
Produção, Coordenação Adm-Fin, Produção e Back-office; **daí em diante**, os
mesmos **menos Produção**.

Hoje a permissão é por **tela** ("pode editar OS"), não por **trecho da tela**. Isto
cria um conceito novo: a OS passa a ter **fases**, e cada fase tem seus editores.
É trabalho de verdade, mas é o coração do fluxo que vocês estão desenhando (O15,
O21, O22, O23) — e sem ele os botões de "enviar para" viram enfeite.

### O17 · Módulo "Dados Emissão Faturamento" 🛠 + 🧱 `G`
| Pedido | Situação |
| --- | --- |
| Renomear o módulo e excluir o subtítulo | 🛠 `P` |
| Tomador: Pólobh, **MF**, Cliente ou **Outro** | Hoje só Pólobh e Cliente. "Outro" com preenchimento manual + consulta de CNPJ + **lupa da Inscrição Municipal na PBH** — a lupa **já existe** no sistema, é reaproveitar. `M` |
| Razão social, endereço, CNPJ/CPF, inscrições | Sem alteração ✅ |
| Descritivo NF traz só o Descritivo Geral (Financeiro) da EC, editável | Confiro e confirmo. É o que está programado |
| Três campos de incentivo, automáticos | Depende do P10 |
| **CNAE** automático do cartão CNPJ | O CNAE já vem na consulta; falta exibi-lo aqui. `P` |
| Código de Serviço editável | ✅ já é |
| **Novo campo: Ordem de Compra** | `P` |
| Subir Valor unitário / Total / Desconto / A pagar / Forma de pagamento; descer Código de Serviço e Ordem de Compra | 🛠 `P` |
| **Código de Serviço e Ordem de Compra voltam para os itens da EC válida** | 🧱 `M` — é a outra ponta do E8. Fluxo de volta OS → EC, gravado na EC ativa |
| **Retenções Fiscais**: texto padrão de destaque, em box de cor diferente, ou "Não se aplica" | 🧱 `P`. O texto sai na OS impressa e no Excel |

### O18 · Acertos Financeiros 🛠 `M`
**Pedido:** "Não se aplica" como padrão, **ou** uma caixa com:
valor original dos serviços (automático) · BV sobre o valor original (automático) ·
valor NF (automático) · valor do acréscimo (calculado) · encargos sobre o acréscimo
(% editável, calculado) · **valor de devolução Pólobh** = BV + acréscimo − encargos
sobre o acréscimo.

Mais: **excluir os campos de BV e as legendas de forma de pagamento** que estão lá
hoje. Entendi a conta e ela fecha. Faço com os seis campos calculados ao vivo.

### O19 · Trocar o fornecedor de uma OS emitida ✅
**Já está implementado exatamente como pedido:** ao salvar, o sistema pede
autorização, **arquiva a OS como ela era** e abre a versão seguinte com o
fornecedor novo. Em rascunho, a troca é livre (é correção de quem ainda monta o
documento). Nada a fazer — confiro junto com vocês numa OS real.

### O20 · Módulo Contrato ✅ + ⚠️
- *"O grupo Dados para Contrato só deve aparecer quando a EC pedir Emitir ou Emitir
  Nova Versão do Contrato"* — ✅ **já é assim** desde 09/09. Marcado "Não se
  aplica", o grupo não aparece nem como aviso.
- ⚠️ **Os dois modelos de contrato (Corporativo e Cultural) não vieram anexados** ao
  arquivo que recebi — o .docx chegou sem anexos. **Preciso dos dois arquivos com
  as instruções de preenchimento automático.** É trabalho `G` quando chegarem.

### O21 · Botão "Enviar OS para Emissão Back-Office" 🧱 `M`
Gera pendência para o Back-office. Ver O4 (é onde, imagino, entra o disparo).

### O22 · Não emitir OS com pendência aberta 🧱 `M`
*"O sistema não pode permitir que uma OS seja emitida se existir alguma pendência a
ela relacionada até a fase do Coordenador Administrativo-Financeiro."*

⚠️ Registro uma tensão com uma decisão de 10/09: naquela data foi **retirada**, a
pedido da Pólobh, a trava que impedia **salvar** a OS sem a justificativa do BV —
o motivo era bom ("quem monta o documento raramente tem todas as respostas na mesma
sessão"). O pedido de agora é diferente e compatível: **salvar continua livre;
emitir é que passa a exigir tudo resolvido.** É assim que vou fazer.

### O23 · Módulo Status OS 🧱 `M`
O lugar onde o status caminha até "Emitida" e, ao emitir, **vira o status do item
na EC de Pendente para OK**. É o fecho do ciclo EC → OS → EC. Depende de O2 e O16.

### O24 · Pular para o campo pendente 🛠 `P`
Quando algo impedir a emissão, a tela rola até o campo e o destaca. A mecânica já
existe (é a da pílula de pendências); falta ligá-la ao botão de emitir.

---

# 7. Cronograma

### CR1 · Conversinha no alto ✅ + 🛠 `P` — já existe; só título e texto (P9).
### CR2 · Pop-up de pendências do cronograma ✅
Já está instalado na aba. Confiro se as pendências do cronograma aparecem nela.
### CR3 · Pendência vermelha fixa — mesmo item do CL5.
### CR4 · Nome fantasia em vez de razão social 🛠 `P`
Na listagem consolidada do cronograma. (Na aba Fornecedores isso já é feito.)
### CR5 · Envio do cronograma por e-mail e WhatsApp 🛠 + 🧱 ⚠️ `M`–`G`
- **E-mail:** já existe — há tela de envio por fornecedor e lembrete automático
  2 dias úteis antes do evento. **Ajusto o texto** para o padrão que vocês
  escreveram ("Alerta: Cronograma...") e incluo os Dados do Projeto completos.
  `P`
- **WhatsApp:** não existe. Dois caminhos:
  - **(a) `P`** — botão que **abre o WhatsApp** com a mensagem pronta, e a pessoa
    aperta enviar. Sem custo, sem burocracia, mas é um envio por vez, manual.
  - **(b) `G`** — API oficial do WhatsApp Business: envio automático, em massa.
    Exige conta Meta Business verificada, número dedicado, **aprovação prévia dos
    modelos de mensagem** pela Meta e custo por mensagem.

  **Recomendo começar pela (a)**, que resolve 90% do incômodo em uma semana, e
  avaliar a (b) depois, com volume conhecido.

---

# 8. Credenciamento

### CD1 · Conversinha no alto ✅ + 🛠 `P`
### CD2 · Pop-up de pendências ✅ — já instalado na aba.
### CD3 · Escolher os campos do formulário a cada credenciamento 🧱 `M`
**Hoje o formulário é fixo:** nome, função, CPF + veículo (modelo e placa).

**Pedido:** poder escolher, credenciamento a credenciamento, entre: Nome · Função ·
**RG** · CPF · **Endereço completo** · **Telefone celular com DDD** · **Data de
aniversário** · Veículo (marca e modelo) · Placa.

Faço: quatro campos novos no formulário público e uma lista de marcar, no
credenciamento, dizendo quais o fornecedor vai ver. A planilha de saída acompanha
os campos escolhidos.

### CD4 · Prazo limite ✅
Já existe, inclusive com aplicação em lote para todas as OSs do projeto, e o
formulário se fecha sozinho quando o prazo passa.

### CD5 · Selecionar fornecedores, enviar para todos e baixar a planilha ✅
Tudo isso já existe na aba Credenciamento do projeto.

### CD6 · Mensagem por e-mail e WhatsApp 🛠 + 🧱 `P`–`G`
E-mail existe — **ajusto o texto** para o padrão que vocês escreveram, com os dados
do projeto e o prazo preenchido automaticamente. WhatsApp: mesma escolha do CR5.

---

# 9. Fornecedores

### F1 · Conversinha no alto ✅ + 🛠 `P`
### F2 · Pop-up de pendências ✅ — já instalado.
### F3 · Nome fantasia na listagem ✅ ⚠️
A listagem **já mostra o nome curto**, nesta ordem: **apelido** (se cadastrado) →
nome fantasia → razão social. ⚠️ Confirme se é isso que querem, ou se o apelido
deve sair da frente e valer sempre o nome fantasia.

---

# 10. As decisões que eu preciso de você

Cinco pontos travam ou mudam o sentido de vários outros. O resto eu toco sem
perguntar.

**1. Produtora Responsável e pendências (G6).** Minha recomendação: ela sai das
**conversas** (para não herdar a bolinha de troca de mensagem entre terceiros) e
**continua** nas pendências que não têm dono nominal — OS em rascunho, cronograma
vazio, credenciamento sem resposta, projeto sem EC —, senão elas somem do sistema.
Você aprova este recorte, ou tira a produtora de tudo?

**2. Fim do "Concluído" (C8).** Aprovado, o projeto de evento já realizado
**continua cobrando pendência até alguém arquivar**. Arquivar vira rotina de
encerramento. Confirma?

**3. Calendário com período completo (C9).** Montagem + evento + desmontagem deixa
o quadro visivelmente mais cheio e muda a contagem de dias. Confirma?

**4. Os sete perfis (E5, E13, O16).** Preciso da **matriz completa**: sete perfis ×
o que cada um vê e edita em todas as telas — não só EC, Rentabilidade e OS. Com ela
em mãos, cadastro as sete Áreas e passa a ser autoatendimento em Configurações.

**5. Quem manda no valor da OS (O11).** Confirma que o Financeiro **escolhe** entre
as alternativas da EC, sem poder alterar valor? E que itens do mesmo fornecedor em
modalidades de pagamento diferentes passam a virar **OSs separadas**?

**E três coisas que faltaram chegar:**
- os **modelos de check-list** Corporativo e Cultural (você já avisou);
- os **dois modelos de contrato** — Corporativo e Cultural — com as instruções de
  preenchimento; o arquivo chegou **sem os anexos**;
- o **logotipo** sem fundo branco e sem o slogan, se existir o original.

---

# 11. Ordem de execução que eu sugiro

**Bloco 1 — rápido e visível (1 semana).** Login (G2), rótulos do Calendário
(C2–C6, C10–C11), colunas de Projetos (P1–P2), frase dos Dados Gerais (P6), título
e texto da conversinha em todo o sistema (P9), rótulos da EC (E3–E4), filtros e
rótulos da OS (O2–O3), nome fantasia no cronograma (CR4), altura das linhas da OS
(O7–O10).

**Bloco 2 — os defeitos.** Emissão de OS travada (E8 🐞), importação do resumo da
proposta (E7 🐞), pendência vermelha permanente (CL5), pop-up cobrindo a planilha
(E11), conversinha e pílula fora das listagens (E1, E2, O1, O6).

**Bloco 3 — depois das suas decisões.** Pendências e produtora (G6), fim do
Concluído (C8), Calendário com período completo (C9, C12), perfis e permissões
(E5, E13, O16).

**Bloco 4 — as obras.** Fluxo da OS em fases com os botões de envio (O4, O11, O15,
O21, O22, O23), Emissão/Faturamento (O17), Acertos Financeiros (O18), aba
Rentabilidade (E13), contratos (O20), credenciamento configurável (CD3).

**Bloco 5 — infraestrutura.** Esqueceu a senha (G3), back-up externo (G4), Dropbox
(G5), trava de edição simultânea (G9), WhatsApp (CR5, CD6), feriados (C7).

---

# 12. O que foi feito, e o que falta

Executado entre 15 e 16/09/2026, no ramo `claude/relaxed-newton-9kb6hj`.
**928 testes passando, `tsc` limpo, build de produção verde.**

## Os dois defeitos

| | Estado |
| --- | --- |
| 🐞 **Emissão de OS travada** (E8) | **Corrigido.** Documento PG, Código de Serviço e Pedido de Compra saíram da peneira de emissão, viraram leitura na EC e voltam preenchidos da OS por RPC (quem emite o faturamento não tem escrita em `ec_linhas`). |
| 🐞 **Resumo da proposta** (E7) | **Dois caminhos silenciosos fechados:** IA sem texto para extrair devolvia "ok" vazio e o modal fechava como se tivesse funcionado; e a inserção não dizia onde o texto tinha entrado. Se ainda falhar, agora a mensagem diz o motivo — e aí é a Edge Function `resumo-proposta` que precisa ser publicada/ter saldo. |

## Feito, por bloco

**Geral** — marca sem fundo branco e sem slogan (G2), "Pólobh Promoções" em todo
o sistema, "Esqueceu a senha?" com link por e-mail (G3), pendências recortadas
(G6), badges e pílula conciliados (G7).

**Calendário** — "Arquivados" (C2), "Todos" (C3), filtro por produtora (C4),
faixa de resumo removida (C6), feriados nacionais pela BrasilAPI e municipais em
Configurações (C7), fim do "Concluído" (C8), período completo com cores por
etapa (C9/C12), card limpo (C10), produtora na lista (C11).

**Projetos** — colunas de produtora e datas (P1/P2), frase do modo leitura
(P6), conversa em Dados Gerais (P8), conversinha padronizada (P9).

**Check-list** — conversa na aba (CL2), conversa abaixo do item (CL3), criar,
renomear e mover etapas e tarefas (CL4), pendência vermelha permanente (CL5).

**EC** — conversa e pílula fora da listagem (E1/E2), barras de leitura e edição
(E3/E4), "Revisar" mostrando o que mudou antes de salvar, campos do item
reordenados e os três status em massa (E8), Alternativas de Custos em tabela
recolhível (E9), pílula não cobre mais a planilha (E11), Rentabilidade
redesenhada com Excel e PDF (E13).

**OS** — fases com passagem de bastão e modo leitura (O4, O15, O21, O22, O23),
quatro status (O2), filtros na listagem do projeto (O3), altura das linhas
(O7–O10), "Cronograma | Logística | Infraestrutura" com itens e grupos novos
(O12), Observações Gerais em módulo próprio (O13), "Dados Emissão Faturamento"
com MF/Outro, CNAE, Ordem de Compra e Retenções Fiscais (O17), Acertos
Financeiros com a conta da devolução (O18).

**Cronograma e Fornecedores** — nome fantasia nas listagens (CR4), conversa e
pílula conferidas (CR1/CR2, F1–F3).

**Credenciamento** — campos escolhidos por evento, com RG, endereço, telefone e
aniversário (CD3); a planilha da portaria só cria coluna do que foi preenchido.

## As decisões que tomei por você — confirme ou mande mudar

1. **Produtora nas pendências (G6):** ela saiu das **conversas** e ficou no que
   não tem destinatário nominal (OS em rascunho, cronograma vazio,
   credenciamento sem resposta, projeto sem EC, OS/Contrato a emitir). Tirá-la
   de tudo faria essas cinco sumirem do sistema.
2. **Arquivar EC (E3):** o botão ficou, e agora só para a Direção. Ele serve ao
   caso que sobra — o evento que o cliente cancelou, sem estimativa substituta.
3. **"Revisar" da EC (E4):** faz as duas coisas numa tela só — padroniza o texto
   e mostra o comparativo antes de salvar.
4. **Encargos na rentabilidade (E13):** entram como **custo real**; honorários
   como **margem** (gasto zero). É uma constante no topo de
   `domain/rentabilidade.ts` — muda numa linha. **Me mande um exemplo numérico
   de um projeto com o resultado esperado** e eu confiro a conta.
5. **Alerta dos Dados Gerais (P7):** o comparativo continua, com o texto do
   check-list como aviso de abertura e as opções desmarcadas.
6. **"Disparar OS" (O4):** continua existindo, e só **depois de emitida**.

## O que ficou pendente, e por quê

| Item | O que falta |
| --- | --- |
| **Matriz dos sete perfis** (E5, E13, O16) | A estrutura está pronta (Áreas + o recurso novo `rentabilidade` + as fases da OS). Falta **a tabela de vocês**: sete perfis × o que cada um vê e edita em todas as telas. Com ela, cadastro as Áreas e passa a ser autoatendimento em Configurações. |
| **Modelos de contrato** (O20) | O .docx chegou **sem os anexos**. Preciso dos dois arquivos — Corporativo e Cultural — com as instruções de preenchimento. |
| **Modelos de check-list** (CL1) | Vocês já avisaram que vinham depois. Quando chegarem, é cadastro em Configurações, sem código. |
| **WhatsApp** (CR5, CD6) | Escolha sua: **(a)** botão que abre o WhatsApp com a mensagem pronta (rápido, sem custo, um envio por vez) ou **(b)** API oficial (automático, exige conta Meta verificada, número dedicado, aprovação dos modelos e custo por mensagem). Os **textos padrão** dos dois avisos já podem ser ajustados no e-mail, que existe. |
| **Dropbox** (G5) | Depende de o Max autorizar um app Dropbox na conta da empresa e de vocês definirem a estrutura de pastas e o padrão de nome. |
| **Back-up** (G4) | Recomendação: plano Pro do Supabase (back-up diário + restauração a um ponto no tempo) **mais** uma cópia semanal para fora, no Dropbox/Drive de vocês. Precisa da sua decisão sobre o plano. |
| **Trava de edição simultânea** (G9) | Hoje existe a trava otimista (avisa no salvamento). A trava de presença ("Marisa está editando desde 14h20") é obra à parte, e ficou para depois das decisões acima. |
| **Revisão de texto por IA em tudo** (G8) | A caixa alta/baixa já é resolvida no caminho da gravação e a revisão por IA cobre os descritivos da EC e do projeto. Estender à OS e ao check-list aumenta o custo por salvamento — confirme o escopo. |
| **Três campos de incentivo** (P10, O9, O17) | Pede migração e conversão do que já está gravado. Ficou para o próximo lote, junto com a matriz de perfis. |

## Migrações do banco a aplicar

Quatro, em ordem de nome (`supabase/migrations/`):

- `20260916100000_os_devolve_codigo_servico_e_ordem_compra.sql`
- `20260916110000_permissao_propria_da_rentabilidade.sql`
- `20260916120000_os_em_fases.sql`
- `20260916130000_os_quatro_status.sql`

As duas últimas **normalizam dado existente** (OS emitida entra na fase certa;
"Disparada" vira "Emitida" com o carimbo de envio), então rodam uma vez e na
ordem — como todas as outras deste repositório.
