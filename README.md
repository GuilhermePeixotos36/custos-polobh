# Pólobh — Estimativas (EC) e Ordens de Serviço (OS)

Aplicação web que substitui o controle manual em Excel da **Pólobh Eventos**.
Premissa: **simplicidade** — poucos cliques, baixa manutenção (um dev + IA),
baixo custo (mira o plano gratuito do Supabase).

## Stack
- **Frontend:** Vite + React + TypeScript + Tailwind CSS, `react-router-dom`, `zustand`.
- **Dados:** camada de repositório (`src/data/`) — hoje **mock em memória**, pronta
  para Supabase (Postgres + Auth + Storage) trocando só a fábrica.
- **Excel:** ExcelJS (aplica estilos, ao contrário do SheetJS).
- **Hospedagem alvo:** Vercel (frontend) + Supabase (dados).

## Rodar
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção
npm run lint     # tsc --noEmit
```
No login (modo demo) escolha o perfil: **Direção**, **Produção** ou **Administrativo**.

## Estrutura
```
public/
  polobh-logo.png            logo (sidebar/login/cronograma público)
  templates/OS_template.xlsx template real da OS (preenchido pelo ExcelJS)
src/
  components/ui/             design system (Button, Badge, Card, Field, Table…)
  components/layout/         Sidebar, Topbar, AppLayout, nav, guarda por recurso
  data/                      types, repository (interfaces), mock, seed, fábrica
  domain/calc.ts             cálculos da EC, numeração, consolidação EC→OS
  lib/                       format, cnpj (BrasilAPI), ai (flag), flags, excel/
  pages/                     telas (Login, Dashboard, EC*, OS*, Cronogramas…)
  store/auth.ts              perfil + matriz de permissões
supabase/schema.sql          schema + RLS (aplicar depois)
```

## Perfis de acesso
| Recurso | Direção | Produção | Administrativo |
|---|:--:|:--:|:--:|
| Dashboard / ECs (consulta) / OSs / Cronogramas / Fornecedores | ✅ | ✅ | ✅ |
| Editar EC | ✅ | ✅ | — |
| Bloco financeiro / Configurações | ✅ | — | ✅ |

## Cálculos da EC (fixos)
- `somaFornecedores` = Σ(valor Pólobh) + Σ(produção)
- `honorários` = 15% · `encargos` = 16,33% (sobre fornecedores)
- `subTotalPolobh` = fornecedores + honorários + encargos
- `valorTotalBruto` = subTotalPolobh + somaCliente + honoráriosCliente
- Numeração: `EC – {Cliente} – {Projeto} – V{NN}`; OS: `… – OS-{NN}`.

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
- **Consulta de CNPJ:** BrasilAPI (`/api/cnpj/v1/{cnpj}`), pública e sem chave.
  Ligada por padrão (`VITE_FEATURE_CNPJ`). Erros tratados → edição manual.
- **Descritivo por IA:** `src/lib/ai.ts`, **desligado** (`VITE_FEATURE_IA=false`).
  Ao ativar, apontar `VITE_AI_ENDPOINT` para uma **Edge Function** (a chave de API
  fica no servidor — nunca no frontend).

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
4. No `.env`: `VITE_FEATURE_EMAIL=true` e `VITE_EMAIL_ENDPOINT=https://<ref>.functions.supabase.co/send-email`.
5. Agendar o lembrete via `pg_cron` (bloco comentado em `supabase/schema.sql`).

## Plugar o Supabase depois
1. Criar projeto no Supabase e aplicar `supabase/schema.sql` (tabelas + RLS).
2. Criar `src/data/supabase.ts` implementando as interfaces de `src/data/repository.ts`.
3. Em `src/data/index.ts`, retornar a impl. Supabase quando `VITE_DATA_SOURCE=supabase`.
4. Preencher `.env` a partir de `.env.example`.
O restante do app não muda — fala só com as interfaces de repositório.

## Retenção (baixo custo)
Guardamos **dados estruturados** e regeneramos Excel/PDF sob demanda. Projetos
concluídos são **arquivados (não apagados)** — configurável (sugestão 24 meses).
