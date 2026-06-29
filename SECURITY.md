# Segurança — app Custo Pólobh

Estado de segurança do app e pontos de atenção.

## Arquitetura atual (100% Supabase)

O app é totalmente integrado ao Supabase (projeto `qtubypczpkkrdbvgdziu`):

- **Sem mock.** A fonte de dados é o banco (`src/data/supabase.ts`), via RLS.
- **Autenticação real** (Supabase Auth, e-mail/senha). Sessão persistida e
  renovada automaticamente; bootstrap em `src/main.tsx` → `useAuth.bootstrap()`.
- **RLS habilitada em todas as tabelas** com policies por papel
  (`perfis.papel`), espelhando a matriz de `src/store/auth.ts`. A função
  `papel_atual()` deriva o papel do usuário autenticado no servidor — o cliente
  **não** é fonte de verdade de permissão.
- **Trilha de auditoria no banco** (`audit_log`, append-only): só o perfil
  **Admin** lê (RLS); qualquer autenticado insere; sem update/delete. Escrita
  centralizada em `auditar()` (`src/store/logs.ts`).

### Perfis

`Admin` (acesso total + único com a tela de Logs), `Direcao`, `Producao`
(sem financeiro/config) e `Administrativo` (não edita EC). A coluna
`perfis.papel` tem CHECK com esses 4 valores; novos usuários ganham perfil via
trigger `handle_new_user` (papel de `raw_user_meta_data.papel`, default `Producao`).

## Auditoria IDOR / BOLA

Revisão de autorização em nível de objeto/campo (acesso por id direto na API):

- **Modelo de acesso:** não há multi-tenant nem dono por registro — todo usuário
  interno autenticado lê EC/OS/clientes/fornecedores (RLS `papel_atual() is not
  null`). Isso é **intencional** (ferramenta interna pequena), não um IDOR.
- **🔴 Corrigido — financeiro da OS exposto na API:** o bloco `financeiro`
  (BV, margem Pólobh, valor a pagar) era restrito **só na UI**. Como ficava em
  `oss.financeiro` e a RLS de leitura libera a linha inteira, um perfil sem o
  recurso (ex.: **Produção**) conseguia lê-lo via PostgREST por id (BOLA de
  campo). **Fix:** movido para a tabela `os_financeiro` com RLS restrita a
  Admin/Direção/Administrativo. O repositório só grava o financeiro se o usuário
  tiver o recurso (guarda `podeFinanceiro`), evitando overwrite com zeros.
  *Validado:* Produção lê 0 linhas de `os_financeiro`; Admin/Direção/Administrativo
  leem; Produção salvando a OS não apaga o financeiro.
- **audit_log:** só Admin lê (validado por simulação de RLS por papel).
- **Cronograma público:** acesso por `slug_publico` não-adivinhável (não pelo id
  sequencial), e a Edge Function devolve só campos do cronograma.
- **Credenciamento público:** formulário sem login acessado por `oss.slug_credenciamento`
  (token não-adivinhável). A Edge Function `credenciamento` valida token + prazo,
  limita tamanho do payload e grava com service role; a tabela `credenciamentos`
  não tem policy de insert para usuários (escrita só via função). Equipe interna lê.
- **Dados bancários do fornecedor** (em `oss.fornecedor`/`fornecedores`): legíveis
  por perfis que gerenciam fornecedores (inclui Produção) — condizente com o
  modelo do app (não há restrição de banco por papel no brief).

### Endurecimentos aplicados

- Login sem backdoor: removido o seletor de perfil de demonstração.
- `audit_log` INSERT exige `auth.uid()` (sem `with check (true)`).
- `EXECUTE` revogado de `handle_new_user` (todos) e `papel_atual` (anon),
  para não exporem RPC pública.
- Sem chaves secretas no front (só a `anon`, pública por design). IA/e-mail
  ficam atrás de Edge Functions.
- Sem `eval`/`innerHTML`/`dangerouslySetInnerHTML` (sem vetor de XSS).
- Rotas de impressão exigem login e respeitam o bloco financeiro.

## Pendências recomendadas

1. **Proteção contra senhas vazadas** (Supabase Auth advisor `WARN`): habilitar
   em *Authentication → Policies* (HaveIBeenPwned). Trocar a senha de teste
   `Polobh@2026` dos usuários seed antes de uso real.
2. **Cronograma público** (`/cronograma/:ecId`): ✅ servido pela Edge Function
   `cronograma-publico` (service role, `verify_jwt=false`), que devolve **apenas**
   título/local/data do projeto, nome do cliente e, por bloco, fornecedor +
   status + cronograma — nunca financeiro/bancário. Pendência menor: trocar o
   `ecId` sequencial por um slug/token não adivinhável no link compartilhado.
3. **`emails`**: escrita apenas pela service role (Edge Functions); leitura
   restrita a Admin/Direção/Administrativo (já configurado).
4. **Cabeçalhos de segurança** no deploy: CSP, `X-Content-Type-Options`,
   `Referrer-Policy`, HSTS.
5. **Dependências**: `npm audit` no CI; manter pacotes atualizados.

## Usuários de teste (criados no Auth)

| E-mail | Perfil | Senha |
|---|---|---|
| admin@polobh.com.br | Administrador | `Polobh@2026` |
| marisa@polobh.com.br | Direção | `Polobh@2026` |
| producao@polobh.com.br | Produção | `Polobh@2026` |
| financeiro@polobh.com.br | Administrativo | `Polobh@2026` |

> Troque essas senhas (ou recrie os usuários) antes de colocar em produção.

O schema completo (idempotente) está em `supabase/schema.sql`.
