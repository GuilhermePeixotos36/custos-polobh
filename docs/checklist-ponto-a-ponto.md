# Check-list da Pólobh — ponto a ponto

*Atualizado em 25/09/2026, com o back-up do sistema (G4) publicado e testado em
produção.*
*Ramo `claude/relaxed-newton-9kb6hj` · 41 arquivos de teste, 1.064 testes
passando, `tsc` limpo, build de produção verde.*

Este é **o relatório corrente**. Ele substitui os dois anteriores (21 e 22/09),
que ficaram só no histórico do Git.

## O que mudou desde o último

**O back-up do sistema (G4) saiu do papel.** Deixou de ser uma recomendação e
virou tela: frequência escolhida pela Direção, `.zip` com a base inteira saindo
para fora da conta do Supabase — por e-mail, Dropbox ou download —, com LEIA-ME
dentro e histórico verificável. Testado em produção de ponta a ponta: o pacote
foi montado (20 tabelas) e o e-mail chegou com o arquivo anexado. O único
pendente é a **autorização do app Dropbox** (G5), que é acesso de vocês.

Antes disso, as **seis migrações foram aplicadas** no projeto POLOBH. Com isso, tudo que
estava marcado como "pronto, mas dormindo" **acordou**: as fases da OS, os quatro
status, a aba Rentabilidade e a volta do Código de Serviço para a EC. Não há mais
nada esperando banco.

## Como ler

| | O que significa |
| --- | --- |
| ✅ | Está no app, funcionando, e onde a regra é de cálculo ou de permissão existe teste automatizado que quebra se alguém desfizer sem querer. |
| ⏳ | Falta uma decisão sua ou um arquivo. Eu não fecho sozinho. |
| ❓ | Entendi o pedido, mas há duas leituras e a escolha muda o resultado. |

**Placar, dos 87 pontos do check-list:** **85 estão ✅**. Dois não têm nada
pronto — G1 e CL1 —, e o G1 é pergunta; o CL1 espera os arquivos de vocês. O G5
(Dropbox) está programado e publicado, esperando só a autorização na conta da
empresa. Entre os 82 prontos, oito carregam uma ressalva ⏳ e
três, uma pergunta ❓ — estão marcados linha a linha.

---

# Geral

| Ponto | Estado | O que está valendo |
| --- | :---: | --- |
| **G1** · URL e armazenamento | ❓ | Preciso saber se a pergunta é trocar o endereço (`polobh.com.br` no lugar do endereço da Vercel) ou onde ficam os dados. São duas conversas. |
| **G2** · Tela de acesso | ✅ | Marca sem fundo branco e sem slogan; "Pólobh Promoções" em todo o sistema. |
| **G3** · "Esqueceu a sua senha" | ✅ | Deixou de ser chamado para o suporte: o botão manda o link por e-mail e a pessoa cria a senha sozinha. Link expirado avisa antes de a pessoa preencher. |
| **G4** · Back-up | ✅ | **Configurações › Back-up.** A Direção escolhe a frequência (diário/semanal/mensal/desligado) e o sistema monta sozinho um `.zip` com a base inteira — dados, planilhas em `.csv` e anexos —, que sai **para fora da conta do Supabase**: por e-mail, para o Dropbox e no botão "Baixar agora". Histórico com data, tamanho e destino na própria tela. O plano Pro continua valendo a pena, mas deixou de ser a única proteção. Falta só vocês informarem o e-mail que recebe. |
| **G5** · Dropbox | ⏳ | Depende do Max autorizar um app Dropbox na conta da empresa e de vocês definirem pastas e padrão de nome. A **mesma autorização** já destrava o destino do back-up (G4), que está programado e publicado esperando a credencial. |
| **G6** · Quem vê qual pendência | ✅ | Três portas: destinatário nominal, produtora responsável e função. A produtora saiu das **conversas** e ficou no que não tem dono. 55 testes cobrem a regra. |
| **G7** · Número do sino = número do pop-up | ✅ | Batiam diferente porque a conversa da aba entrava num e não no outro. Os dois vêm da mesma conta agora. |
| **G8** · Revisão de texto por IA | ✅ | Obrigatória no salvamento da **EC, da OS e das tarefas do check-list**, além dos roteiros do projeto. Ao ligar apareceu algo pior que a falta: a EC **tinha** o revisor programado e nenhuma tela o chamava. Sobre o custo: só o texto que **mudou** é enviado, então a conta cresce com as edições de texto, não com os salvamentos. Ficam de fora as conversas (são as palavras de cada um), as cláusulas do contrato (texto jurídico) e os cadastros (são identificadores, não prosa). |
| **G9** · Duas pessoas no mesmo documento | ✅ | **Duas travas, uma em cima da outra.** A de PRESENÇA impede: quem entra em edição toma o documento, e quem chega depois fica em leitura, com o aviso nomeando quem está e desde que horas ("Marisa está editando desde as 14h20"). A posse cai sozinha após 90 segundos sem sinal, para um notebook fechado não prender o documento. Embaixo dela, a trava do SALVAMENTO recusa gravar por cima — e essa, ao conferir, só existia na EC: a OS e o projeto gravavam por cima **em silêncio**. Agora as três têm. |

---

# Calendário

| Ponto | Estado | O que está valendo |
| --- | :---: | --- |
| **C1** · Título "Calendário Pólobh" | ✅ | Já era assim. |
| **C2** · "Encerrados" → "Arquivados" | ✅ | |
| **C3** · "Toda Modalidade" → "Todos" | ✅ | |
| **C4** · Filtro por Produtora Responsável | ✅ | Só lista quem de fato responde por algum projeto. |
| **C5** · Os dois filtros agem juntos? | ✅ | Sim — produtora **e** modalidade. Se quiser o contrário, diga. |
| **C6** · Tirar "Mês mais cheio" e "Próximo Evento" | ✅ | |
| **C7** · Feriados nacionais e de BH | ✅ | Nacionais pela BrasilAPI (inclusive Carnaval e Corpus Christi, que mudam todo ano). **Municipais lançados à mão** em Configurações: não existe fonte oficial em formato de dados para eles, e feriado municipal errado é montagem marcada num dia em que a cidade para. |
| **C8** · Acabar com "Concluído" | ✅ | Dois estados: Ativo e Arquivado. O evento que passou **continua cobrando pendência até alguém arquivar**. |
| **C9** · Período completo | ✅ | Do primeiro dia de montagem ao último de desmontagem, com cor mais clara nas pontas. O quadro ficou mais cheio — era o pedido. |
| **C10** · Tirar "Nenhum Projeto neste mês" e "Ver os dias" | ✅ | |
| **C11** · Produtora no modo Lista | ✅ | |
| **C12** · Detalhamento do mês | ✅ | Cada barra diz qual etapa é. |

---

# Projetos

| Ponto | Estado | O que está valendo |
| --- | :---: | --- |
| **P1** · Coluna Produtora Responsável | ✅ | |
| **P2** · Coluna com as datas do evento | ✅ | |
| **P3** · Cabeçalho com data, local e produtora | ✅ | Em todas as abas. |
| **P4** · Inscrição Estadual não encontrada → "Isenta" | ✅ | |
| **P5** · Dados Gerais repercutem nas etapas | ✅ | Com uma exceção de propósito: a OS **já emitida** guarda a foto do dia da emissão e não muda sozinha — senão um documento assinado mudaria de conteúdo depois de assinado. Só nova versão o substitui. |
| **P6** · Só "Modo leitura" sob o título | ✅ | |
| **P7** · Pop-up ao salvar Dados Gerais | ✅ | Mantive o comparativo, com o texto do check-list como aviso e as opções **desmarcadas**. Decisão minha. |
| **P8** · Conversinha no alto dos Dados Gerais | ✅ | |
| **P9** · Título "Observações" e texto padrão | ✅ | Padronizado em todo o sistema. |
| **P10** · Incentivos Fiscais vira três campos | ✅ (na OS) **+** ⏳ (no Projeto) | Na OS os três existem: Nome do Projeto Incentivado, Lei de Incentivo e **Código do Projeto Incentivado**, este último criado em 16/09 porque o contrato Cultural cita a lei e o código em lugares diferentes da Cláusula Primeira. Nos **Dados Gerais do Projeto** continua um campo só — separar lá pede migração e conversão do que já está gravado. |

---

# Check-list

| Ponto | Estado | O que está valendo |
| --- | :---: | --- |
| **CL1** · Modelos Corporativo e Cultural | ⏳ | Vocês avisaram que vinham depois. Quando chegarem, é cadastro em Configurações, sem programação. |
| **CL2** · Conversinha no alto da aba | ✅ | |
| **CL3** · Conversinha abaixo de cada item | ✅ | Como na EC. |
| **CL4** · Criar e movimentar etapas e itens | ✅ | Criar, renomear, subir, descer e remover. |
| **CL5** · Pendência vermelha **fixa** | ✅ | A marca fica enquanto a pendência existir; o piscar sobrou só para o pulo do "ir até o campo". |

---

# EC — Estimativa de Custos

| Ponto | Estado | O que está valendo |
| --- | :---: | --- |
| **E1** · Tirar a conversinha da lista de ECs | ✅ | |
| **E2** · Tirar o pop-up de pendências da listagem | ✅ | |
| **E3** · Rótulos e ordem dos botões | ✅ | O **Arquivar EC** ficou, só para a Direção. Serve ao caso que sobra: o evento que o cliente cancelou, sem estimativa substituta. **Decisão minha — diga se prefere eliminá-lo.** |
| **E4** · Barra do modo edição | ✅ | Revisar + Salvar. Saíram do modo edição o Cancelar, o Arquivar e o Emitir OS, como pedido. O **Revisar** padroniza o texto **e** mostra o que mudou antes de salvar. |
| **E5** · Quem cria, edita e substitui EC | ✅ | Cadastrado: Diretoria Produção, Coordenação Produção, Produção e Back-office editam; os três do Administrativo-Financeiro, não. |
| **E6** · Conversinha padronizada | ✅ | |
| **E7** · 🐞 Importação do Resumo das Propostas | ✅ (com ressalva) | Fechei **dois caminhos silenciosos**: a IA sem texto devolvia "ok" vazio e o modal fechava como se tivesse funcionado; e a inserção não dizia onde o texto entrou. Se ainda falhar, **agora a mensagem diz o motivo** — e aí é a Edge Function `resumo-proposta` (publicação ou saldo). Só se confirma de vez com um arquivo real em produção. |
| **E8** · 🐞 Campos do item / emissão travada | ✅ | **Era o "não consigo emitir OS".** Documento PG, Código de Serviço e Pedido de Compra saíram da peneira de emissão e viraram leitura na EC. A **volta** desses dados da OS para a EC está no ar: passa por uma rotina no banco, porque quem emite o faturamento não tem escrita em `ec_linhas`. Ordem dos campos conferida: Aprovação → OS → Contrato → Fornecedor. |
| **E9** · "Alternativas de Custos" na tabelinha | ✅ | Tabela recolhível. |
| **E10** · Honorários 15% e Encargos 16,33% | ✅ | Já era assim. |
| **E11** · Pop-up cobrindo a planilha | ✅ | |
| **E12** · Pendência vermelha fixa | ✅ | Mesmo ajuste do CL5. |
| **E13** · Aba Rentabilidade por item | ✅ **+** ⏳ | A aba está no ar, com Excel e PDF, e a permissão própria já está no banco. ⏳ **A conta tem uma premissa que você precisa confirmar:** encargos entram como **custo real**, honorários como **margem**. **Mande um exemplo numérico de um projeto com o resultado esperado** — se a premissa estiver errada, é uma linha para trocar. |

---

# OS — Ordem de Serviço

| Ponto | Estado | O que está valendo |
| --- | :---: | --- |
| **O1** · Tirar a conversinha da lista de OSs | ✅ | |
| **O2** · Rascunho / Emitida / Cancelada / Arquivada | ✅ | Os quatro no ar. A OS que estava "Disparada" virou **Emitida** com o carimbo da data de envio. |
| **O3** · Filtros na lista de OSs | ✅ | |
| **O4** · Menu da OS igual ao da EC, com modo leitura | ✅ | A OS **anda em fases** e passa o bastão: Produção → Financeiro → Back-office → Emitida. Cada fase só edita os campos dela; o resto fica em leitura, com tarja dizendo em que mão o documento está. **"Disparar OS" continua existindo, e só depois de emitida** — decisão minha. |
| **O5** · Conversinha no alto de cada OS | ✅ | |
| **O6** · Tirar o pop-up de pendências | ✅ | Saiu da **listagem**. Dentro da OS ficou — é dele que depende o O24. |
| **O7** · Módulo Ordem de Serviço | ✅ | Linha "Status" fora do módulo e altura das linhas reduzida — conferido no código. |
| **O8** · Dados do Cliente | ✅ | Altura das linhas. |
| **O9** · Dados do Projeto | ✅ **+** ⏳ | Altura das linhas; datas e horários múltiplos vão inteiros para a OS. Os **três campos de incentivo** existem na OS (ver P10); nos Dados Gerais do Projeto continua um campo só. |
| **O10** · Dados do Fornecedor | ✅ | Altura das linhas, e Inscrição Estadual não encontrada vira "Isenta". |
| **O11** · Detalhamento da Contratação | ✅ **+** ❓ | O bloco está pronto e o Financeiro define item a item. ❓ **Duas coisas continuam esperando você:** hoje o Financeiro **pode alterar o valor**, não só escolher entre as alternativas da EC — confirme se é para travar; e a OS é agrupada **por fornecedor**, não por modalidade de pagamento — vocês escreveram que misturar "na prática não acontece", então não separei. |
| **O12** · "Cronograma \| Logística \| Infraestrutura" | ✅ | Com itens e grupos novos, "não se aplica" e setas. Campo "Entrega" excluído. |
| **O13** · "Observações Gerais" em módulo separado | ✅ | Com "não se aplica". |
| **O14** · Excluir "Pagamento ao Fornecedor" | ✅ | **Corrigido em 22/09** — eu tinha dado como pronto e não estava. Os totais, o prazo de pagamento, o documento fiscal e a tabela viraram o **Resumo dos Custos, no fim do Detalhamento da Contratação**, como o check-list pede nos dois sentidos. |
| **O15** · "Enviar OS para Conclusão Financeiro" | ✅ | Gera pendência para quem recebe. |
| **O16** · Permissão por etapa da OS | ✅ | Cadastrado. Precisou de uma chave nova, `oss.emitir`: a emissão usava a mesma chave de *montar* a OS, e sem separá-las a Produção emitiria o documento que a fase acabou de tirar das mãos dela. |
| **O17** · "Dados Emissão Faturamento" | ✅ | Tomador MF/Outro, CNAE, Ordem de Compra e Retenções Fiscais em box de destaque. |
| **O18** · Acertos Financeiros | ✅ | BV sobre o valor original **+** acréscimo **–** encargos sobre o acréscimo (16,33% editável). 5 testes cobrem a conta. |
| **O19** · Trocar o fornecedor de uma OS emitida | ✅ | Já existia. |
| **O20** · Módulo Contrato | ✅ | **Os dois modelos chegaram e estão implementados** — ver a seção abaixo. |
| **O21** · "Enviar OS para Emissão Back-Office" | ✅ | |
| **O22** · Não emitir OS com pendência aberta | ✅ | |
| **O23** · Módulo Status OS | ✅ | Emitir a OS fecha o item da EC: de "Emitir"/"Emitir Nova Versão" para "OK". |
| **O24** · Pular para o campo pendente | ✅ | |

---

# Cronograma

| Ponto | Estado | O que está valendo |
| --- | :---: | --- |
| **CR1** · Conversinha no alto | ✅ | |
| **CR2** · Pop-up de pendências | ✅ | |
| **CR3** · Pendência vermelha fixa | ✅ | |
| **CR4** · Nome fantasia em vez de razão social | ✅ | |
| **CR5** · Envio por e-mail **e WhatsApp** | ✅ (e-mail) **+** ⏳ (WhatsApp) | O e-mail funciona e o texto padrão já pode ser ajustado. O WhatsApp é escolha sua — ver a lista final. |

---

# Credenciamento

| Ponto | Estado | O que está valendo |
| --- | :---: | --- |
| **CD1** · Conversinha no alto | ✅ | |
| **CD2** · Pop-up de pendências | ✅ | |
| **CD3** · Escolher os campos a cada credenciamento | ✅ | Função, RG, CPF, endereço, telefone, aniversário, veículo e placa — marcados **por evento**. Nome é sempre obrigatório. **A planilha da portaria só cria coluna do que foi pedido.** |
| **CD4** · Prazo limite | ✅ | |
| **CD5** · Selecionar fornecedores, enviar, baixar planilha | ✅ | |
| **CD6** · Mensagem por e-mail e WhatsApp | ✅ (e-mail) **+** ⏳ (WhatsApp) | Mesma situação do CR5. |

---

# Fornecedores

| Ponto | Estado | O que está valendo |
| --- | :---: | --- |
| **F1** · Conversinha no alto | ✅ | |
| **F2** · Pop-up de pendências | ✅ | |
| **F3** · Nome fantasia na listagem | ✅ **+** ❓ | A ordem é: **apelido** (se cadastrado) → nome fantasia → razão social. Confirme se é isso, ou se o apelido deve sair da frente. |

---

# Contratos (O20) — como ficou

Os dois modelos eram documentos **anotados**, e a anotação é a especificação:

| No modelo | No app |
| --- | --- |
| *"O sistema lança automaticamente…"* | Não se digita: número da OS, data, tomador, fornecedor, os quatro valores, forma de pagamento, projeto incentivado, lei e código. |
| *"Manter este campo editável."* | Cada uma das **sete cláusulas** é um campo, já aberto com o texto do modelo, com "voltar ao padrão". Só o que muda fica gravado — assim, corrigir o padrão depois ainda alcança os contratos que ninguém assinou. |
| Em branco | Cidade da assinatura e as duas testemunhas. Em branco, saem para assinar à mão. |

Botão **"Contrato Word"** no alto da OS, só quando a EC pediu contrato. O modelo
sai pela modalidade do projeto, com seletor para o caso raro do contrário. Sai em
**.docx, não PDF**, porque é o documento que vai para o jurídico do fornecedor,
que devolve com alteração.

**Uma leitura que eu precisei fazer:** no alto dos dois modelos, o bloco do
CONTRATANTE e o do CONTRATADO trazem **a mesma anotação** ("os dados do Tomador
de Serviço"). O bloco de assinaturas dos próprios modelos desfaz o engano —
"CONTRATADA – Razão Social do Fornecedor", "CONTRATANTE – Razão Social do
Tomador". Segui o bloco de assinaturas.

# As sete áreas (E5, E13, O16) — como ficou

| Perfil | Edita EC | Vê rentabilidade | Monta a OS | Conclui e emite |
| --- | :---: | :---: | :---: | :---: |
| Diretoria Produção | ✅ | ✅ | ✅ | ✅ |
| Direção Administrativo-Financeira | — | ✅ | ✅ | ✅ |
| Coordenação Produção | ✅ | ✅ | ✅ | ✅ |
| Coordenação Administrativo-Financeira | — | ✅ | ✅ | ✅ |
| Assistência Administrativo-Financeira | — | — | — | — |
| Produção | ✅ | — | ✅ | — |
| Back-office | ✅ | — | ✅ | ✅ |

**A única lacuna do documento:** nas duas listas da OS, a **Direção
Administrativo-Financeira** não aparece nem entre quem pode nem entre quem não
pode. Como vocês a nomeiam explicitamente nas outras listas, tratei como falha de
digitação e ela **edita**. Desmarcar são dois cliques em Configurações.

**As três áreas antigas continuam existindo**, com seus usuários. A de nome
"Produção" virou **"Produção (legado)"** para abrir espaço à nova — quem está
nela manteve exatamente os acessos de hoje. A troca é feita usuário a usuário,
quando vocês quiserem.

---

# Check-list de Recursos — verificado item a item

O segundo arquivo do zip é uma lista de confirmação: quase toda linha traz
*"vamos testar este recurso com o funcionamento do sistema"*. Conferi **no
código** os 20 que não traziam essa nota — os únicos que poderiam estar em
aberto. **Todos confirmados**, entre eles: validação antes de emitir OS listando
o que falta item a item; ajuste automático de colunas na EC Excel; corpo 11 na
planilha Completa; mescla do descritivo só na coluna B; bordas nos quatro lados;
"Endereço do Local" logo após "Local"; lista de opções no Perfil do fornecedor;
descritivo financeiro **e** detalhado na Contratação; lupa da Inscrição Municipal;
memória de preenchimento em todos os campos; campo "Entrega" eliminado; setas e
arraste no cronograma da OS; "não se aplica" em Logística e Infraestrutura
sumindo do documento; Observações como campo livre; grupo Credenciamento fora da
OS; CNAE pelo cartão CNPJ; recolher/expandir no cabeçalho; planilha Dados Úteis
em Excel; e o Check-list como segunda aba.

---

# O que continua em aberto

Quatro decisões suas e três perguntas. **Nada depende de programação.**

1. **A conta da rentabilidade (E13).** Preciso de **um exemplo numérico de um
   projeto real com o resultado que vocês esperam**, para conferir a premissa
   (encargos = custo, honorários = margem). É a única que sai cara se estiver
   errada — o número vai em Excel e PDF para a casa inteira.
2. **WhatsApp (CR5, CD6).** **(a)** botão que abre o WhatsApp com a mensagem
   pronta — rápido, sem custo, um envio por vez; ou **(b)** API oficial —
   automático, mas exige conta Meta verificada, número dedicado, aprovação dos
   modelos e custo por mensagem.
3. **Dropbox (G5).** Depende do Max autorizar um app na conta da empresa
   (`dropbox.com/developers/apps`, uns 5 minutos, sem custo) e de vocês
   definirem as pastas. A mesma credencial liga o destino Dropbox do back-up —
   que já está publicado e, enquanto isso, entrega por e-mail e por download
   normalmente. O **back-up saiu desta lista**: está feito (G4); o que resta
   dele é informar o e-mail que recebe, na tela.
4. **Modelos de check-list (CL1).** Quando chegarem, é cadastro, sem programação.

**As três perguntas:** G1 (URL ou armazenamento?), O11 (o Financeiro pode alterar
valor ou só escolher? modalidades diferentes viram OSs separadas?) e F3 (apelido
na frente do nome fantasia?).

**Fora da lista, por escolha e não por esquecimento:** os três
campos de incentivo nos **Dados Gerais do Projeto** (P10 — na OS já existem;
separar no Projeto pede migração e conversão do que está gravado).

---

# Um aviso do Supabase que vale um clique

Não é do nosso código: a **proteção contra senha vazada está desligada** no
Supabase Auth — ele checaria a senha contra o HaveIBeenPwned no cadastro. Fica em
Authentication › Policies. Os demais avisos do linter são pré-existentes e
intencionais.
