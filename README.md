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
  domain/pendencias.ts       motor de pendências que alimenta os badges vermelhos
  lib/                       format, cnpj (BrasilAPI), ai (flag), flags, excel/
  pages/                     telas (Login, Projetos, EC*, OS*, Agenda, Cronogramas…)
  store/auth.ts              perfil + matriz de permissões
supabase/schema.sql          schema completo + RLS
supabase/migrations/         atualizações incrementais do banco
```

## Perfis de acesso
| Recurso | Direção | Produção | Administrativo |
|---|:--:|:--:|:--:|
| Dashboard / ECs (consulta) / OSs / Cronogramas / Fornecedores | ✅ | ✅ | ✅ |
| Check-list do projeto / Agenda (ver e editar) | ✅ | ✅ | ✅ |
| Editar EC | ✅ | ✅ | — |
| Modelos de check-list (Configurações) | ✅ | — | — |
| Bloco financeiro / Configurações | ✅ | — | ✅ |

## Cálculos da EC (fixos)
- `somaFornecedores` = Σ(valor Pólobh) + Σ(produção)
- `honorários` = 15% · `encargos` = 16,33% (sobre fornecedores)
- `subTotalPolobh` = fornecedores + honorários + encargos
- `valorTotalBruto` = subTotalPolobh + somaCliente + honoráriosCliente
- Numeração: `EC – {Cliente} – {Projeto} – V{NN}`; OS: `… – OS-{NN}`.

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

Banco: `checklist_modelos`, `checklists`, `checklist_itens` (migração
`20260823100000_checklist_workflow.sql`).

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
- **Impressão:** área de impressão definida, ajuste à largura da página e
  cabeçalho da tabela de custos repetido em todas as páginas da EC.
- O template original da OS (`public/templates/OS_template.xlsx`) e a planilha
  `.xls` da EC ficam em `/reference` apenas como **referência de conteúdo** —
  não são mais preenchidos (eram formulários internos, visualmente pobres).
- **Exemplos:** `npm run gerar:exemplos` gera `exemplos/EC_exemplo.xlsx` e
  `exemplos/OS_exemplo.xlsx` para conferência (espelham o gerador do app).
- **PDF:** `baixarPdfViaImpressao()` usa a impressão do navegador (`window.print`)
  sobre a visualização em tela. Estilos `@media print` em `src/index.css`.
- ExcelJS é carregado **sob demanda** (code-splitting) — não pesa no load inicial.

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
