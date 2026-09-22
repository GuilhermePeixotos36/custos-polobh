# O que eu fiz com o zip, e o que verifiquei ponto a ponto

*22/09/2026 · ramo `claude/relaxed-newton-9kb6hj` · 37 arquivos de teste, 982
testes passando, `tsc` limpo, build de produção verde.*

O zip trouxe quatro arquivos. Um deles eu já conhecia; três eram novidade, e
duas delas mudam o relatório de ontem.

| Arquivo | O que era |
| --- | --- |
| **Modelo Contrato Corporativo** | 🆕 O anexo que faltava. **Implementado.** |
| **Modelo Contrato Cultural** | 🆕 O anexo que faltava. **Implementado.** |
| **Check-List Recursos Aplicativo (1)** | 🆕 Lista de confirmação dos recursos. **Verificado item a item.** |
| **Check-List Revisão Aplicativo (2)** | É o mesmo arquivo de 15/09 (conferi o md5 — byte por byte idêntico). Reconferido. |

---

# 1. Os contratos — feito

Os dois modelos não eram "um texto": eram documentos **anotados**, e a anotação
é a especificação. Havia três tipos de anotação, e o sistema respeita os três.

| O que o modelo diz | O que o app faz |
| --- | --- |
| *"O sistema lança automaticamente…"* (amarelo) | **Não se digita no contrato.** Número da OS, data, dados do tomador, dados do fornecedor, valor unitário, valor total, desconto, valor a pagar, forma de pagamento, projeto incentivado, lei e código — tudo vem da OS. Redigitar aqui criaria uma segunda verdade para o mesmo dado, e a segunda é a que ninguém confere. |
| *"Manter este campo editável."* (amarelo) | **Cada uma das sete cláusulas é um campo**, que já abre com o texto do modelo dentro. Só o que você mudar fica gravado — assim, corrigir o padrão mais tarde ainda alcança os contratos que ninguém assinou. Cada campo tem "Voltar ao texto do modelo". |
| Em branco no modelo | **Cidade da assinatura e as duas testemunhas** (nome e CPF). Em branco, saem em branco, para assinar à mão — como saem hoje. |

**Como usar:** dentro da OS, botão **"Contrato Word"**, no alto da tela, ao lado
do "OS PDF". Ele só aparece quando a EC pediu contrato ("Emitir" ou "Emitir Nova
Versão" na coluna Contrato de algum item) — sem isso não há o que gerar.

**Qual modelo sai:** a modalidade do projeto decide, a mesma que já escolhe o
modelo da EC e do check-list. Cultural → Cultural; o resto → Corporativo. Tem um
seletor para o caso raro do contrário (projeto corporativo com item incentivado).

**O que o Cultural tem a mais** — e é só isso, o resto é palavra por palavra
igual:
1. A Cláusula Primeira nomeia o projeto incentivado, a lei e o código;
2. A Segunda acrescenta, nas obrigações do CONTRATANTE, receber e administrar os
   recursos do incentivo;
3. A Sexta acrescenta que serviço novo pede contrato novo.

**Sai em .docx, não em PDF**, de propósito: é o documento que vai para o jurídico
do fornecedor, que devolve com alteração. Um PDF obrigaria a refazer tudo aqui.

**Anexei dois exemplos gerados pelo app.** Abra no Word e compare com os seus
modelos — é exatamente o que sai do botão.

## Três coisas que eu precisei decidir nos contratos

1. **Quem é CONTRATANTE e quem é CONTRATADO(A).** No alto dos dois modelos, os
   **dois** blocos trazem a mesma anotação: *"o sistema lança automaticamente os
   dados do Tomador de Serviço da OS"*. O bloco de assinaturas dos próprios
   modelos desfaz o engano: *"CONTRATADA – Sistema lança Razão Social do
   Fornecedor"* e *"CONTRATANTE – Sistema lança Razão Social do Tomador"*. Segui
   o bloco de assinaturas: **CONTRATANTE = tomador, CONTRATADO(A) = fornecedor.**
   Por consequência, o contratante do contrato passou a **seguir o tomador do
   faturamento** quando ninguém escolhe outro — antes ele nascia "Pólobh" fixo, e
   a OS faturada pela MF ou pelo cliente saía com um contratante errado que
   ninguém tinha escolhido.
2. **A Cláusula Primeira do Corporativo.** No seu modelo ela tem só "Manter este
   campo editável" — sem corpo. Montei com a mesma estrutura do Cultural, menos
   as linhas de incentivo: descritivo, informações complementares, os quatro
   valores e a forma de pagamento. Um contrato corporativo sem o objeto e sem o
   valor não fecha negócio nenhum. **Se preferir outra coisa ali, é um campo.**
3. **A linha "Municipio:".** O app guarda o endereço inteiro num campo só (é
   assim que a consulta de CNPJ devolve). A cidade é lida do próprio endereço
   quando ele traz o par cidade + UF; quando não traz, **a linha sai em branco**,
   para ser completada à mão. Preferi em branco a um palpite errado num documento
   que alguém assina.

**Uma diferença técnica que não se vê impressa:** no seu modelo, o título e as
tarjas cinzas das cláusulas são *caixas de texto flutuantes* do Word. No app elas
são tabelas de uma célula, com o mesmo cinza e a mesma borda. O impresso é igual;
a diferença é que a tabela desce quando a cláusula cresce, e a caixa flutuante
ficaria por cima do parágrafo seguinte no primeiro contrato em que alguém
escrevesse três linhas a mais na vigência.

---

# 2. A matriz dos sete perfis — feito (eu tinha errado)

**Ontem eu disse que faltava a matriz. Ela estava no check-list**, escrita em
três lugares diferentes — na seção da EC, na da Rentabilidade e na da OS. Reli e
cadastrei as sete áreas:

| Perfil | Edita EC | Vê rentabilidade | Monta a OS | Conclui e emite |
| --- | :---: | :---: | :---: | :---: |
| Diretoria Produção | ✅ | ✅ | ✅ | ✅ |
| Direção Administrativo-Financeira | — | ✅ | ✅ | ✅ |
| Coordenação Produção | ✅ | ✅ | ✅ | ✅ |
| Coordenação Administrativo-Financeira | — | ✅ | ✅ | ✅ |
| Assistência Administrativo-Financeira | — | — | — | — |
| Produção | ✅ | — | ✅ | — |
| Back-office | ✅ | — | ✅ | ✅ |

**A única lacuna do documento, e o que eu fiz com ela:** nas duas listas da OS, a
**Direção Administrativo-Financeira** não aparece nem entre quem pode nem entre
quem não pode. Nas outras duas listas vocês a nomeiam sempre que é para excluí-la
(na EC) ou incluí-la (na rentabilidade) — então a omissão é falha de digitação,
não regra. **Entrou como quem edita as duas etapas da OS.** Se estiver errado, é
desmarcar dois recursos numa tela de Configurações, sem migração.

**Precisei criar uma chave nova**, `oss.emitir`. A emissão pelo Back-office usava
a mesma chave de *montar* a OS. Com uma chave só, "a partir desta etapa a Produção
não edita mais" não se cumpre: a Produção precisa dela para montar, e com ela
emitiria o documento que a fase acabou de tirar das mãos dela.

**As quatro áreas antigas continuam existindo** e ligadas a quem já usa o
sistema. Apagá-las deixaria gente sem acesso no meio do expediente — a troca é
feita usuário a usuário, em Configurações, quando vocês quiserem.

**Está garantido por teste:** 32 testes leem a própria migração e conferem as
quatro regras do check-list, perfil por perfil.

---

# 3. Um item que eu tinha dado como pronto e não estava

**Módulo "Pagamento ao Fornecedor" (O11 + O14).** O check-list pede nos dois
sentidos: *"no final de todos os itens, o sistema deverá consolidar o valor total
contratado, o valor total do BV e o valor líquido, prazo de pagamento, documento
fiscal … sob o título Resumo dos Custos"* e *"Módulo Pagamento ao Fornecedor —
excluir"*.

O que estava no app: o módulo "Pagamento ao Fornecedor" **ainda existia**, como
card próprio, e a tabela do Resumo dos Custos estava no fim do bloco de
Cronograma — nem num lugar nem no outro.

**Corrigido.** Os totais, o prazo de pagamento (parcelas), o documento fiscal e a
tabela item a item viraram o **Resumo dos Custos, no fim do Detalhamento da
Contratação**. O módulo antigo não existe mais. Quem vê o quê **não mudou junto**:
mover um módulo de lugar não é hora de mexer em permissão.

---

# 4. Check-list de Recursos — verificado item a item

Este arquivo é, na maior parte, uma lista de confirmação: quase toda linha traz
em vermelho *"vamos testar este recurso com o funcionamento do sistema"*. Conferi
**no código**, um por um, os que não traziam essa nota — que são os que poderiam
estar em aberto.

| Item | Situação |
| --- | --- |
| Validação dos campos obrigatórios antes de emitir OS, sinalizando o que falta | ✅ Os itens que ficam de fora são listados na tela, item a item, com o que falta em cada um. |
| Ajuste automático de colunas e linhas na EC Excel | ✅ Largura medida pelo conteúdo, coluna a coluna. |
| Corpo de letra 11 na planilha Completa | ✅ |
| Mesclar as linhas do item para as duas linhas do descritivo, só na coluna B | ✅ |
| Fechar todos os itens com margens de todos os lados | ✅ |
| Subir "Endereço do Local" para logo após "Local" | ✅ |
| Lista de opções no Perfil do fornecedor | ✅ Seletor de regime tributário. |
| Descritivo financeiro **e** detalhado no Descritivo da Contratação | ✅ Os dois entram no descritivo consolidado. |
| Link da Inscrição Municipal do fornecedor (PBH) | ✅ Campo com a lupa. |
| Arquivar o que já foi preenchido, para todos os usuários | ✅ É a memória de sugestões, em todos os campos. |
| Eliminar o preenchimento automático do campo Entrega | ✅ O campo não existe mais. |
| Setas e arraste no cronograma dentro da OS | ✅ |
| "Não se aplica" na Logística — some do documento | ✅ |
| "Não se aplica" na Infraestrutura — some do documento | ✅ |
| Observações como campo livre | ✅ Com "não se aplica" como alternativa. |
| Retirar da OS o grupo Credenciamento | ✅ Virou subaba do Projeto. |
| Busca e opção de CNAE pelo cartão CNPJ | ✅ |
| Recolher e expandir no cabeçalho | ✅ |
| Fornecedores → planilha Dados Úteis em Excel (fantasia, itens, nome, telefone, e-mail) | ✅ |
| Check-list é a segunda aba | ✅ Dados Gerais · **Check-list** · EC · OS · … |

**Nenhum item deste check-list ficou em aberto.**

---

# 5. Reconferência do check-list de Revisão

Reconferi no código os pontos estruturais da OS e da EC — foi aí que eu tinha
errado no "Pagamento ao Fornecedor", então olhei os vizinhos com o mesmo rigor:

- **O7** linha Status fora do módulo Ordem de Serviço — ✅ conferido no código.
- **O12** campo "Entrega" excluído — ✅ não existe mais.
- **O13** Observações Gerais em módulo próprio — ✅.
- **E8** ordem dos campos do item da EC: Aprovação → **OS** → **Contrato** →
  Fornecedor → Documento PG / Código de Serviço / Pedido de Compra — ✅ exatamente
  nessa ordem.
- **E4** barra do modo edição: Revisar + Salvar, **sem** Cancelar, **sem** Arquivar
  EC, **sem** Emitir OS — ✅ os três saíram do modo edição, como pedido.
- **E3** "Arquivar EC" — continua existindo no modo leitura, só para a Direção.
  **Decisão minha, que continua valendo:** ele serve ao caso que sobra — o evento
  que o cliente cancelou, sem estimativa substituta. Diga se prefere eliminá-lo.

---

# 6. O que continua em aberto

Encurtou. Sobraram cinco, e **nenhuma depende de programação** — todas dependem
de uma decisão sua ou de um acesso.

1. **As quatro migrações no Supabase, agora cinco.** Continuam sem aplicar: o
   acesso ao Supabase desta sessão é de outra conta e não enxerga o projeto
   `qtubypczpkkrdbvgdziu`. Ou você autoriza a conexão (Configurações de
   conectores do claude.ai, ou `/mcp` numa sessão interativa) e eu aplico, ou
   aplique nesta ordem:
   1. `20260916100000_os_devolve_codigo_servico_e_ordem_compra.sql`
   2. `20260916110000_permissao_propria_da_rentabilidade.sql`
   3. `20260916120000_os_em_fases.sql`
   4. `20260916130000_os_quatro_status.sql`
   5. `20260922100000_os_sete_perfis_da_polobh.sql` ← **nova, dos sete perfis**

   As de número 3, 4 e 5 mexem em dado que já existe. Rodam uma vez, em ordem.
   Até elas rodarem, os sete perfis não aparecem em Configurações e as fases da
   OS continuam dormindo.

2. **A conta da rentabilidade.** Ainda preciso de **um exemplo numérico de um
   projeto real com o resultado que vocês esperam**, para conferir a premissa
   (encargos = custo, honorários = margem). É a única decisão que sai cara se
   estiver errada — o número vai em Excel e PDF para a casa inteira.

3. **WhatsApp.** Escolha sua: **(a)** botão que abre o WhatsApp com a mensagem
   pronta — rápido, sem custo, um envio por vez; ou **(b)** API oficial —
   automático, mas exige conta Meta verificada, número dedicado, aprovação dos
   modelos e custo por mensagem. Os textos padrão dos dois avisos já estão no
   e-mail, que funciona.

4. **Dropbox e back-up.** O Dropbox depende de o Max autorizar o app e de vocês
   definirem as pastas e o padrão de nome. O back-up depende da sua decisão sobre
   o plano Pro do Supabase (back-up diário + volta a um ponto no tempo), que eu
   recomendo, mais uma cópia semanal para fora.

5. **Modelos de check-list Corporativo e Cultural.** Vocês avisaram que vinham
   depois. Quando chegarem, é cadastro em Configurações, sem programação.

**Saíram da lista de ontem:** os modelos de contrato (chegaram e estão feitos), a
matriz dos sete perfis (estava no check-list e está cadastrada) e o Código do
Projeto Incentivado, que virou campo próprio no faturamento — o contrato Cultural
cita a lei e o código em lugares diferentes da Cláusula Primeira, e partir a
string na hora de gerar o Word seria adivinhar onde a lei acaba.

**Continuam de fora, por escolha:** a trava de presença ("fulano está editando
desde 14h20"), a revisão por IA estendida à OS e ao check-list (aumenta o custo
por salvamento — confirme o escopo) e os três campos de incentivo nos Dados
Gerais do Projeto, que pedem migração própria.
