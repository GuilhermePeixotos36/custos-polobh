# Backup diário e arquivo automático no Dropbox

## 1. Backup diário (22h00) — implementado, falta ativar

**Como funciona.** O Supabase roda, todo dia às 22h00 (Brasília), a função
`supabase/functions/backup-diario`. Ela lê as tabelas do sistema, monta
`backup-AAAA-MM-DD.json` e envia pela API do Dropbox para a pasta
`/Pólobh (HGM)/Internos (Novo)/05 - TI/App Pólobh/Back-Up`. O Dropbox instalado
no computador da Marisa sincroniza sozinho, e o arquivo aparece em
`C:\Users\Marisa M. Coelho\Dropbox\Pólobh (HGM)\Internos (Novo)\05 - TI\App Pólobh\Back-Up`.

> Um servidor na nuvem não escreve em `C:\...` de um computador. O caminho certo
> é enviar para a conta Dropbox e deixar o app do Dropbox baixar — é o "download
> automático" pedido.

**Ativação (uma vez):**
1. Em dropbox.com/developers criar um app (Scoped access, *Full Dropbox*) com as
   permissões `files.content.write` e `sharing.read`. Anotar *App key* e *App secret*.
2. Autorizar o app com `token_access_type=offline` e guardar o **refresh token**.
3. `supabase secrets set CRON_SECRET=… DROPBOX_APP_KEY=… DROPBOX_APP_SECRET=… DROPBOX_REFRESH_TOKEN=…`
4. `supabase functions deploy backup-diario --no-verify-jwt`
5. Aplicar a migração `20260929100000_agendar_backup_diario.sql` e rodar
   `select agendar_backup_diario('https://<REF>.functions.supabase.co/backup-diario','<CRON_SECRET>');`
6. Testar: `curl -X POST -H "x-cron-secret: …" <URL>` e conferir o arquivo na pasta.

Cada execução também registra `backup.diario` na trilha de auditoria. Os arquivos
não são apagados (um por dia; retenção é decisão da Pólobh).

## 2. Arquivo automático dos documentos — avaliação

**É viável.** Cada projeto passa a ter o link da sua pasta no Dropbox (campo
*Pasta do projeto no Dropbox*, em Dados Gerais — já implementado, grava em
`projetos.docs_url`). O que falta é o envio automático, que exige um passo de
servidor porque o navegador não escreve no Dropbox.

**Desenho proposto:**
- Edge Function `arquivar-documento` (autenticada pelo usuário logado) recebe o
  arquivo gerado (PDF/XLSX da EC, OS, cronograma) e o `projetoId`.
- Resolve a pasta do projeto: `sharing/get_shared_link_metadata` com o link
  guardado devolve o `path_lower`/`id` da pasta; o arquivo vai por `files/upload`.
- O app chama a função logo após gerar o documento (fluxo "gerar → baixar" ganha
  o "→ arquivar"), com aviso na tela se falhar, sem travar a geração.
- Reaproveita as credenciais do app Dropbox do item 1.

**Pontos a decidir/validar antes de construir:**
1. **Link de pasta compartilhada:** o link precisa ser de pasta do próprio time
   Pólobh; links "somente leitura" não aceitam upload. Validar com uma pasta real
   se o app consegue resolver o caminho pelo link (senão, guardar o caminho da
   pasta em vez do link).
2. **Permissão:** o app do Dropbox precisa acessar as pastas de projeto (Full
   Dropbox / namespace do time).
3. **Nomes e versões:** definir se cada versão vira arquivo novo (sugestão: sim,
   com número da versão no nome) ou substitui.
4. **Quais documentos:** EC, OS, cronograma, resumo de proposta?
Estimativa: pequena/média — uma função, um ponto de chamada por tipo de documento.
