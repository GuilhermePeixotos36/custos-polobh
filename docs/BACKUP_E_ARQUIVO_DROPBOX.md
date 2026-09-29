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

## 2. Arquivo automático dos documentos — pesquisa e decisões

**Pesquisa (documentação e fórum do Dropbox):**
- `files/upload` recebe um **caminho** (`/pasta/arquivo`), não um link. Não existe
  upload "para um link compartilhado". ([Sharing guide](https://developers.dropbox.com/dbx-sharing-guide))
- `sharing/get_shared_link_metadata` traduz o link em pasta e devolve `path_lower`
  **somente se a pasta está no Dropbox da conta autenticada**; para pasta de
  outra conta o campo vem vazio (spec: [shared_links.stone](https://github.com/dropbox/dropbox-api-spec/blob/main/shared_links.stone)).
- Há relatos de problemas com os links novos `/scl/fo/…` em
  `get_shared_link_metadata` ([fórum](https://community.dropbox.com/en/discussion/731378/get-shared-link-metadata-api-problem-with-the-new-scl-folder-links));
  não consegui abrir a discussão daqui, então **este ponto precisa de teste real**.
- Em conta Business, tokens de time não fazem upload; o app deve autorizar como
  **membro** que enxerga as pastas, e pastas de outro namespace exigem o cabeçalho
  `Dropbox-API-Path-Root` ([Team Files](https://developers.dropbox.com/dbx-team-files-guide)).

**Conclusão:** viável, com a tradução link → caminho feita no servidor. Implementado:
- campo *Pasta do projeto no Dropbox* (Dados Gerais → `projetos.docs_url`);
- Edge Function `arquivar-documento`: resolve o link, exige que seja pasta e que
  tenha `path_lower`; se não, devolve erro claro (nada é gravado no lugar errado);
- `src/lib/arquivarDocumento.ts`: helper do app, que nunca lança.

**Decisões:**
- **Versões:** cada versão é um arquivo novo (número da versão no nome do
  arquivo); nada é sobrescrito (`mode: add` + `autorename`).
- **Documentos:** EC, OS e cronograma (os arquivos que o app já gera em Excel/PDF).
  Resumo de proposta e e-mails ficam de fora.
- **Falha:** o aviso aparece na tela e a geração do documento segue normalmente.

**Ligado aos botões (29/09/2026):** ao gerar o Excel da EC (Financeiro/Completa),
o Cronograma ou a OS, o app baixa o arquivo como sempre e, em segundo plano, envia
uma cópia para a pasta Dropbox do projeto (só se o projeto tiver o link). Sucesso
e falha aparecem como aviso; nada trava o download. A OS oficial é o PDF, gerado
pela impressão do navegador, que não entrega arquivo — então "Baixar PDF" envia a
OS em **Excel** (sem financeiro) como cópia.

**Pendente (depende do acesso ao Dropbox):** validar com uma pasta real da Pólobh
(link `/scl/fo/…` resolve? conta é Business?), publicar `arquivar-documento` e
definir os segredos. Se o link não resolver, plano B: guardar o **caminho** da
pasta (ex.: `/Pólobh (HGM)/Projetos/ACME`) em vez do link.
