# Revisão geral — ponto a ponto da lista da Marisa

*21/09/2026 · ramo `claude/relaxed-newton-9kb6hj` · 35 arquivos de teste, 928 testes
passando, `tsc` limpo, build de produção verde.*

Este documento responde a uma pergunta só, item por item: **isso está resolvido
e garantido, ou não?**

## Como ler

| | O que significa |
| --- | --- |
| ✅ **Resolvido** | Está no app, funciona hoje, e onde a regra é de cálculo existe teste automatizado que quebra se alguém desfizer sem querer. |
| 🔌 **Pronto, mas dormindo** | O código está escrito e testado, mas **só acorda depois que as quatro migrações rodarem no Supabase** (ver o aviso abaixo). Até lá, a tela existe e a regra antiga continua valendo. |
| ⏳ **Depende de você** | Falta uma decisão sua ou um arquivo que não chegou. Eu não tenho como fechar sozinho. |
| ❓ **Pergunta em aberto** | Entendi o pedido, mas há duas leituras possíveis e a escolha muda o resultado. |

---

## ⚠️ Antes de tudo: as migrações NÃO foram aplicadas

Eu não consegui aplicar. O acesso ao Supabase que está ligado nesta sessão é de
**outra conta** — ele enxerga dois projetos, e nenhum deles é o
`qtubypczpkkrdbvgdziu`, que é o do aplicativo. A conexão certa, que está
configurada no repositório, **pede autorização** e esta sessão não tem como
fazer esse login.

**Dois caminhos:**

1. **Você autoriza a conexão** — nas configurações de conectores do claude.ai,
   ou, numa sessão interativa do Claude Code, com `/mcp`. Aí eu aplico.
2. **Você mesmo aplica**, pelo SQL Editor do Supabase ou pela CLI, **nesta ordem
   de nome** (é a ordem em que elas se apoiam):

   1. `20260916100000_os_devolve_codigo_servico_e_ordem_compra.sql`
   2. `20260916110000_permissao_propria_da_rentabilidade.sql`
   3. `20260916120000_os_em_fases.sql`
   4. `20260916130000_os_quatro_status.sql`

   As **duas últimas mexem em dado que já existe** — OS já emitida entra na fase
   certa, e OS "Disparada" vira "Emitida" guardando a data do disparo. Rodam uma
   vez só, e em ordem.

Tudo que está marcado 🔌 neste relatório depende disso. Nada se perde esperando:
o app continua funcionando como antes até a migração rodar.

---

# Geral

| Ponto | Estado | O que está valendo |
| --- | --- | --- |
| **G1** · URL e onde o sistema mora | ❓ | Preciso saber se a pergunta é sobre trocar o endereço (`polobh.com.br` em vez do endereço da Vercel) ou sobre onde ficam os dados. São duas conversas diferentes. |
| **G2** · Tela de acesso | ✅ | Marca sem fundo branco e sem slogan, "Pólobh Promoções" em todo o sistema. |
| **G3** · "Esqueceu a sua senha" | ✅ | Deixou de ser chamado para o suporte: o botão manda o link por e-mail e a pessoa cria a senha sozinha, na tela nova. Link expirado avisa em vez de deixar a pessoa preencher à toa. |
| **G4** · Back-up | ⏳ | Minha recomendação: plano Pro do Supabase (back-up diário + volta a um ponto no tempo) **mais** uma cópia semanal para fora, no Dropbox/Drive de vocês. Falta sua decisão sobre o plano — é custo mensal. |
| **G5** · Arquivo automático no Dropbox | ⏳ | Depende do Max autorizar um app Dropbox na conta da empresa, e de vocês definirem a estrutura de pastas e o padrão de nome dos arquivos. |
| **G6** · Quem vê qual pendência | ✅ | Três portas: destinatário nominal, produtora responsável e função. A produtora **saiu das conversas** (não herda mais bolinha de conversa entre terceiros) e **ficou** no que não tem dono — OS em rascunho, cronograma vazio, credenciamento sem resposta, projeto sem EC. Decisão minha; se quiser tirar de tudo, essas cinco somem do sistema. 55 testes cobrem essa regra. |
| **G7** · Número do sino = número do pop-up | ✅ | Batiam diferente (5 e 6) porque a conversa da aba entrava num e não no outro. A conversa saiu das listagens, e os dois números passaram a vir da mesma conta. |
| **G8** · Revisão de texto e caixa alta/baixa por IA | ⏳ (parcial ✅) | Caixa alta/baixa já é resolvida no caminho da gravação, em todo o sistema. A revisão por IA cobre os descritivos da EC e do projeto. Estender à OS e ao check-list **aumenta o custo por salvamento** — me confirme se quer. |
| **G9** · Duas pessoas no mesmo documento | ⏳ (parcial ✅) | Hoje existe a trava que **avisa no salvamento** ("alguém mexeu enquanto você editava"). A trava de presença — "a Marisa está editando desde 14h20" — é obra à parte e ficou para depois. |

---

# Calendário

| Ponto | Estado | O que está valendo |
| --- | --- | --- |
| **C1** · Título "Calendário Pólobh" | ✅ | Já era assim. |
| **C2** · "Encerrados" → "Arquivados" | ✅ | |
| **C3** · "Toda Modalidade" → "Todos" | ✅ | |
| **C4** · Filtrar por Produtora Responsável | ✅ | O seletor só lista quem de fato responde por algum projeto — não a casa inteira. |
| **C5** · Os dois filtros agem juntos? | ✅ | Sim, agem juntos (produtora **e** modalidade, não um ou outro). Era o que fazia sentido; se quiserem o contrário, me diga. |
| **C6** · Tirar "Mês mais cheio" e "Próximo Evento" | ✅ | A faixa saiu. |
| **C7** · Feriados nacionais e de BH | ✅ | Nacionais vêm da BrasilAPI (oficial, inclusive Carnaval e Corpus Christi, que mudam de data todo ano). **Municipais de BH são lançados à mão em Configurações** — e é honesto que seja assim: não existe fonte oficial em formato de dados para eles, e feriado municipal errado no quadro é montagem marcada num dia em que a cidade para. O quadro mostra de onde veio cada um. |
| **C8** · Acabar com "Concluído" | ✅ | Agora são dois estados: **Ativo** e **Arquivado**. O evento que já passou **continua cobrando pendência até alguém arquivar** — arquivar virou a rotina de encerramento. Era a sua decisão nº 2, e eu segui em frente com ela. |
| **C9** · Período completo (montagem + evento + desmontagem) | ✅ | O projeto ocupa o quadro do primeiro dia de montagem ao último de desmontagem, com cor mais clara na montagem e na desmontagem e cheia no evento. **O quadro ficou visivelmente mais cheio** — era inevitável, e foi o pedido. |
| **C10** · Tirar "Nenhum Projeto neste mês" e "Ver os dias" | ✅ | |
| **C11** · Coluna de Produtora no modo Lista | ✅ | |
| **C12** · Detalhamento do mês | ✅ | Vem junto do C9: cada barra diz qual etapa é. |

---

# Projetos

| Ponto | Estado | O que está valendo |
| --- | --- | --- |
| **P1** · Coluna Produtora Responsável | ✅ | |
| **P2** · Coluna com as datas do evento | ✅ | |
| **P3** · Cabeçalho com data, local e produtora em todas as abas | ✅ | |
| **P4** · Inscrição Estadual não encontrada → "Isenta" | ✅ | |
| **P5** · Mudança nos Dados Gerais repercute em todas as etapas | ✅ | Já funcionava. Atenção, e isso é de propósito: a OS **já emitida** guarda a foto dos dados do dia da emissão e **não** muda sozinha — senão um documento assinado mudaria de conteúdo depois de assinado. Só uma nova versão da OS o substitui. |
| **P6** · Só "Modo leitura" sob o título | ✅ | |
| **P7** · Pop-up de alerta ao salvar Dados Gerais | ✅ | Mantive o comparativo (mostra o que mudou), com o texto do check-list como aviso de abertura e as opções **desmarcadas**. Decisão minha — confirme. |
| **P8** · Conversinha no alto dos Dados Gerais | ✅ | |
| **P9** · Título "Observações" e texto padrão | ✅ | Padronizado em todo o sistema. |
| **P10** · Incentivos Fiscais vira três campos | ⏳ | Pede migração e conversão do que já está gravado. Ficou para o próximo lote, junto com a matriz de perfis — não quis misturar com as quatro migrações que já estão na fila. |

---

# Check-list

| Ponto | Estado | O que está valendo |
| --- | --- | --- |
| **CL1** · Modelos Corporativo e Cultural | ⏳ | Vocês avisaram que viriam depois. Quando chegarem, é cadastro em Configurações — não precisa de programação. |
| **CL2** · Conversinha no alto da aba | ✅ | |
| **CL3** · Conversinha de cada item embaixo da linha, como na EC | ✅ | |
| **CL4** · Criar e movimentar etapas e itens | ✅ | Criar, renomear, mover para cima e para baixo, e remover. |
| **CL5** · Pendência vermelha **fixa**, não piscando | ✅ | A marca vermelha ficou permanente enquanto a pendência existir; o piscar sobrou só para o pulo do "ir até o campo". |

---

# EC — Estimativa de Custos

| Ponto | Estado | O que está valendo |
| --- | --- | --- |
| **E1** · Tirar a conversinha da tela principal das ECs | ✅ | |
| **E2** · Tirar o pop-up de pendências da listagem | ✅ | |
| **E3** · Rótulos e ordem dos botões | ✅ | O **Arquivar** ficou, e agora só para a Direção — ele serve ao caso que sobra: o evento que o cliente cancelou, sem estimativa substituta. Decisão minha. |
| **E4** · Barra do modo edição igual à de leitura | ✅ | E o **"Revisar"** faz as duas coisas numa tela só: padroniza o texto **e mostra o que mudou antes de salvar**. |
| **E5** · Quem pode criar, editar e substituir EC | ⏳ | A estrutura está pronta. **Falta a matriz de vocês** (ver "O que ainda depende de você"). |
| **E6** · Conversinha padronizada no topo e por item | ✅ | |
| **E7** · 🐞 Importação do Resumo das Propostas não funcionava | ✅ (com ressalva) | Fechei **dois caminhos silenciosos**: a IA sem texto para extrair devolvia "ok" vazio e o modal fechava como se tivesse dado certo; e a inserção não dizia onde o texto tinha entrado. **Se ainda falhar, agora a mensagem diz o motivo** — e aí o problema é a Edge Function `resumo-proposta` (publicação ou saldo), não o app. Só consigo confirmar de vez testando com um arquivo de verdade em produção. |
| **E8** · 🐞 Campos do item / **emissão de OS travada** | ✅ **+** 🔌 | **Este era o "não consigo emitir OS".** Era um nó: a OS não podia nascer porque faltavam Documento PG, Código de Serviço e Pedido de Compra — que só existem **depois** que a OS existe. Os três saíram da peneira de emissão e viraram leitura na EC. **Isso já funciona hoje.** 🔌 O que dorme é a **volta** desses dados da OS para a EC: ela passa por uma rotina nova no banco (migração 1), porque quem emite o faturamento não tem permissão de escrever na EC. |
| **E9** · "Alternativas de Custos" na tabelinha | ✅ | Virou tabela recolhível. |
| **E10** · Honorários 15% e Encargos 16,33% | ✅ | Já era assim. |
| **E11** · Pop-up cobrindo a planilha | ✅ | |
| **E12** · Pendência vermelha fixa | ✅ | Mesmo ajuste do CL5. |
| **E13** · Aba Rentabilidade por item | 🔌 **+** ⏳ | A aba está pronta: Valor na EC, Valor Líquido da OS, Rentabilidade e Justificativa, com Excel e PDF. 🔌 Ela **só aparece depois da migração 2**, que cria a permissão própria de rentabilidade (Direção e Admin). ⏳ E a conta tem **uma premissa minha que você precisa confirmar**: encargos entram como **custo real** e honorários como **margem** (gasto zero). **Me mande um exemplo numérico de um projeto com o resultado que vocês esperam** — se a premissa estiver errada, é uma linha para trocar. |

---

# OS — Ordem de Serviço

| Ponto | Estado | O que está valendo |
| --- | --- | --- |
| **O1** · Tirar a conversinha da lista de OSs | ✅ | |
| **O2** · Rascunho / Emitida / Cancelada / Arquivada | 🔌 | Os quatro rótulos estão no app. A migração 4 é que **converte as OSs "Disparada" que já existem** em "Emitida", guardando a data do disparo. Sem ela, o status antigo continua aparecendo. |
| **O3** · Filtros na lista de OSs do projeto | ✅ | |
| **O4** · Menu da OS igual ao da EC, com modo leitura | 🔌 | A OS agora **anda em fases** e passa o bastão: Produção → Financeiro → Back-office → Emitida. Cada fase só edita os campos dela; o resto fica em leitura, com uma tarja dizendo em que mão o documento está. 🔌 Precisa da migração 3, que cria a marca da fase. **"Disparar OS" continua existindo, e só depois de emitida** — decisão minha. |
| **O5** · Conversinha no alto de cada OS | ✅ | |
| **O6** · Tirar o pop-up de pendências | ✅ | Saiu da **listagem**. Dentro da OS ele ficou — é dele que depende o "pular para o campo pendente" (O24). |
| **O7–O10** · Altura das linhas, Cliente, Projeto, Fornecedor | ✅ | |
| **O9** · (campos de incentivo) | ⏳ | Mesma migração do P10, no próximo lote. |
| **O11** · Detalhamento da Contratação | 🔌 **+** ❓ | O Financeiro **escolhe** entre as alternativas da EC. ❓ Ainda preciso da sua confirmação sobre duas coisas: que ele **não pode alterar valor**, só escolher; e que itens do mesmo fornecedor em **modalidades de pagamento diferentes** passam a virar **OSs separadas**. |
| **O12** · "Cronograma \| Logística \| Infraestrutura" | ✅ | O bloco ganhou o nome do que tem dentro, com itens e grupos novos, e "não se aplica" onde não cabe. |
| **O13** · "Observações Gerais" em módulo separado | ✅ | |
| **O14** · Tirar "Pagamento ao Fornecedor" | ✅ | |
| **O15** · "Enviar OS para Conclusão Financeiro" | 🔌 | Botão existe; é a passagem de bastão do O4. |
| **O16** · Permissão por etapa da OS | 🔌 **+** ⏳ | A estrutura está pronta (cada fase tem o seu recurso). Falta a **matriz de perfis**. |
| **O17** · "Dados Emissão Faturamento" | 🔌 | Módulo novo, com tomador MF/Outro, CNAE, Ordem de Compra e Retenções Fiscais. Anda junto das fases. |
| **O18** · Acertos Financeiros | ✅ | A conta da devolução para a Pólobh: BV sobre o valor original **+** o acréscimo **–** os encargos sobre o acréscimo (16,33% por padrão, editável). 5 testes cobrem a conta. |
| **O19** · Trocar o fornecedor de uma OS emitida | ✅ | Já existia. |
| **O20** · Módulo Contrato | ✅ (estrutura) **+** ⏳ | O módulo está lá. ⏳ **Os dois modelos — Corporativo e Cultural — nunca chegaram**: o arquivo veio sem os anexos. |
| **O21** · "Enviar OS para Emissão Back-Office" | 🔌 | Passagem de bastão do O4. |
| **O22** · Não emitir OS com pendência aberta | 🔌 | |
| **O23** · Módulo Status OS | 🔌 | |
| **O24** · Pular para o campo pendente | ✅ | |

---

# Cronograma

| Ponto | Estado | O que está valendo |
| --- | --- | --- |
| **CR1** · Conversinha no alto | ✅ | |
| **CR2** · Pop-up de pendências | ✅ | |
| **CR3** · Pendência vermelha fixa | ✅ | Mesmo ajuste do CL5. |
| **CR4** · Nome fantasia em vez de razão social | ✅ | |
| **CR5** · Envio por e-mail **e WhatsApp** | ✅ (e-mail) **+** ⏳ (WhatsApp) | O e-mail funciona e o texto padrão já pode ser ajustado. O WhatsApp é **escolha sua** (ver abaixo). |

---

# Credenciamento

| Ponto | Estado | O que está valendo |
| --- | --- | --- |
| **CD1** · Conversinha no alto | ✅ | |
| **CD2** · Pop-up de pendências | ✅ | |
| **CD3** · Escolher os campos do formulário a cada credenciamento | ✅ | Função, RG, CPF, endereço, telefone, aniversário, veículo e placa — marcados **por evento**, não uma configuração fixa da casa. Nome é sempre obrigatório. **A planilha da portaria só cria coluna do que foi pedido.** Quem nunca escolher nada continua com o formulário de sempre. |
| **CD4** · Prazo limite | ✅ | Já existia. |
| **CD5** · Selecionar fornecedores, enviar para todos, baixar planilha | ✅ | Já existia. |
| **CD6** · Mensagem por e-mail e WhatsApp | ✅ (e-mail) **+** ⏳ (WhatsApp) | Mesma situação do CR5. |

---

# Fornecedores

| Ponto | Estado | O que está valendo |
| --- | --- | --- |
| **F1** · Conversinha no alto | ✅ | |
| **F2** · Pop-up de pendências | ✅ | |
| **F3** · Nome fantasia na listagem | ✅ **+** ❓ | A listagem mostra, nesta ordem: **apelido** (se cadastrado) → nome fantasia → razão social. ❓ Confirme se é isso, ou se o apelido deve sair da frente e valer sempre o nome fantasia. |

---

# O que **não** está garantido — e por quê

Sete coisas. Nenhuma trava as outras.

1. **As quatro migrações no Supabase.** Não consegui aplicar (explicação no topo).
   Enquanto elas não rodarem, tudo que está 🔌 fica dormindo: fases da OS, quatro
   status, aba Rentabilidade e a volta do Código de Serviço para a EC.
2. **A matriz dos sete perfis** (E5, E13, O16). A estrutura está pronta e
   esperando. Preciso da tabela de vocês: **sete perfis × o que cada um vê e
   edita em todas as telas** — não só EC, Rentabilidade e OS. Com ela em mãos,
   eu cadastro as Áreas e depois vira autoatendimento em Configurações.
3. **Os dois modelos de contrato** (O20). O arquivo chegou **sem os anexos**.
   Preciso do Corporativo e do Cultural, com as instruções de preenchimento.
4. **A conta da rentabilidade** (E13). Preciso de **um exemplo numérico de um
   projeto real com o resultado que vocês esperam**, para conferir a premissa
   (encargos = custo, honorários = margem).
5. **WhatsApp** (CR5, CD6). Escolha sua: **(a)** botão que abre o WhatsApp com a
   mensagem pronta — rápido, sem custo, um envio por vez; ou **(b)** API oficial
   — automático, mas exige conta Meta verificada, número dedicado, aprovação dos
   modelos de mensagem e custo por mensagem enviada.
6. **Dropbox** (G5) e **back-up** (G4). O Dropbox depende de o Max autorizar o
   app e de vocês definirem as pastas. O back-up depende da sua decisão sobre o
   plano Pro do Supabase.
7. **Três campos de incentivo** (P10/O9/O17), **trava de presença** (G9) e
   **IA em todos os textos** (G8). Ficaram para o próximo lote: os dois primeiros
   pedem migração e decisão, o terceiro pede definição de escopo por causa do
   custo por salvamento.

---

# O que eu decidi por você — e você pode desfazer

Seis decisões. Todas reversíveis, nenhuma cara de desfazer.

1. **A produtora responsável ficou nas pendências sem dono** (G6). Tirar de tudo
   faz cinco pendências sumirem do sistema.
2. **O "Arquivar EC" continuou**, só para a Direção (E3).
3. **O "Revisar" da EC faz duas coisas numa tela só** (E4).
4. **Encargos = custo, honorários = margem** na rentabilidade (E13). É uma
   constante no alto de um arquivo — muda em uma linha.
5. **O alerta dos Dados Gerais continuou**, com as opções desmarcadas (P7).
6. **"Disparar OS" continuou existindo**, e só depois de emitida (O4).
