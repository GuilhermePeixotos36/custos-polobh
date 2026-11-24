# Acessos (padrão de Acessos do Grupo LSPRO) — 24/11/2026

Tela `/acessos` (menu Administração → **Acessos**), com as sub-abas **Usuários** e **Grupos de
permissão**. Substitui as abas "Áreas e permissões" e "Usuários" de Configurações: foi uma
**mudança de lugar** — cada área virou um grupo de permissão com o mesmo id, o mesmo nome, o mesmo
nível e as mesmas permissões, e o cadastro de usuários veio junto. Os links antigos
(`/configuracoes?aba=areas|usuarios`) levam para cá.

## Onde está cada peça

| Peça | Arquivo |
|---|---|
| Catálogo (módulo → telas → ações) e o mapa recurso antigo ↔ tela × ação | `src/config/acessos/catalogo.ts` |
| Regras puras da matriz, das rotas e da ponte com os recursos antigos | `src/lib/acessos/permissoes.ts` |
| Regras puras da lista de usuários, dos grupos concedíveis e das travas | `src/lib/acessos/usuarios.ts` |
| Senha que o administrador define (gerador e validação) | `src/lib/acessos/senha.ts` |
| Leitura e escrita (RPCs e Edge `acessos`) | `src/lib/acessos/acessosStore.ts` |
| `usePermissoes()` (gancho sobre `useAuth`) | `src/lib/acessos/usePermissoes.ts` |
| Permissões no login, modo de compatibilidade, `pode(Recurso)` lido do grupo | `src/store/auth.ts` |
| Guarda de rota, "Seu grupo não tem permissão…" e faixa "Somente leitura" | `src/components/layout/RequireRecurso.tsx` |
| Tela | `src/pages/Acessos.tsx`, `src/components/acessos/*` |
| Banco | `supabase/migrations/20261124150000_acessos_grupos_de_permissao.sql` |
| Edge `acessos` (criar usuário, definir senha) | `supabase/functions/acessos/index.ts` + `_shared/acessos.ts` |
| Helper de permissão para as outras Edges | `supabase/functions/_shared/permissaoDoUsuario.ts` |
| Testes | `src/lib/acessos/*.test.ts` |

## Regras

- **O catálogo é a fonte única.** Chave se acrescenta, nunca se renomeia (o banco guarda `tela` e
  `acao` em texto). Tela nova = linha no catálogo + `pode(tela, acao)` / `useAuth().pode(recurso)`.
  Recurso novo = linha em `RECURSO_POR_PERMISSAO` **e** no mapa da migration (o teste
  `mapaRecursos.test.ts` acusa a diferença).
- **Como o app antigo continua valendo:** todo `useAuth().pode("oss.editar")` passa a ler o grupo
  pelo mapa. No banco, `tem_recurso` e `recurso_da_area` leem o grupo; o `papel` (que as policies
  usam) é derivado do grupo — grupo de sistema = `Admin`, os demais = o **nível no banco** do grupo;
  e a tabela `areas` virou espelho do grupo (mesmo id), mantido por gatilho. Ninguém grava em
  `areas` nem em `perfis` pela sessão.
- **Usuário pertence a um grupo**, obrigatório no cadastro, nenhum pré-marcado. **Nunca excluir —
  inativar** (usuário e grupo). Inativo não se edita: volta pelo "Ativar" da linha.
- **Grupo "Administrador de sistema"**: libera tudo, não se renomeia nem se inativa, nunca fica sem
  usuário ativo. Só membro dele põe, tira ou altera membro dele.
- **Quem não é do Administrador nunca concede mais do que tem** — grupo (permissões **e nível**
  contidos nos dele), permissão na matriz e senha (só troca a de quem está num grupo que ele
  poderia conceder). Conferido no banco e na Edge; a tela só evita o erro.
- **Grupo padrão:** "Produção" (o da área com mais usuários na virada). Recebe quem ficar ativo
  sem grupo por caminho antigo. Não se inativa.
- **Conta nova no Auth fora da tela** (convite antigo, painel do Supabase) nasce **pendente**, sem
  acesso, até alguém "Liberar acesso" escolhendo o grupo.

### Adaptações do padrão decididas pelo dono do app

1. **Sem Microsoft 365 / Entra ID / SSO / Graph.** Login só por e-mail e senha; o cadastro sempre
   passa pelo popup "Login e senha". Não existem `verificar_microsoft`, `ms_object_id`,
   `entradas_dos_usuarios()` nem o botão "Entrar com Microsoft".
2. **Sem lista de colaboradores de outro app** (DPRH, `colaboradores_dp`, `DP_TOKEN`). O popup
   "Novo usuário" pede Nome, E-mail (login), Telefone, Setor e Cargo/função (texto, com sugestão dos
   valores já usados) e o Grupo de permissão. Não há coluna nem filtro "Origem"; no lugar, Setor.
3. **A recuperação de senha pela própria pessoa continua** ("Esqueci minha senha" no login, rota
   `/nova-senha`, e o "Alterar senha" do cartão da conta). O administrador também define a senha de
   outra pessoa pela tela (Editar usuário → "Definir nova senha").
4. **Nível no banco** no grupo (Direção, Produção, Financeiro): as policies antigas decidem por
   esses quatro papéis (não por "escreve × só lê"), então o grupo diz qual deles quem está nele
   recebe. Some quando a escrita por tela (Fase 6) substituir as policies por papel.
5. **Sem permissões específicas por usuário** (`PERMISSOES_ESPECIAIS` vazio): o que a área chamava
   de "permissão especial" vale para o time inteiro e virou ação extra da tela (emitir OS, revisar
   OS cultural, cláusulas padrão, lista padrão do check-list, responder pela etapa). A tabela
   `acesso_usuario_especial` existe, vazia, para o banco ficar igual ao dos outros apps.

## Limites conhecidos

- **Leitura por tela é só da tela**: o banco não recorta leitura por tela (as policies de leitura
  seguem "usuário ativo").
- **Escrita por tela ainda não está no banco** (Fase 6, abaixo). Até lá, o banco separa o que o
  **nível** separa e o que `tem_recurso` separa (blocos financeiros da OS, check-list, cláusulas);
  um grupo com escrita numa tela e só leitura em outra é barrado na segunda apenas pela tela.
- **RPCs `security definer` que gravam** passam por cima de qualquer policy de escrita por tela e
  conferem o papel (ou nada): `salvar_ec_completa`, `nova_versao_ec(_com_mapa)`,
  `gerar_nova_versao_os`, `importar_ec`, `marcar_itens_da_os_como_emitidos`,
  `devolver_dados_fiscais_para_ec`, `salvar_observacoes_ec`, `salvar_conversa_projeto`,
  `marcar_ec_baixada`, `abrir_edicao`/`fechar_edicao` (conferido no banco em 24/11/2026;
  `definir_ec_ativa` e `arquivar_documentos_projeto` são `security invoker` e obedecem às
  policies). Converter as que importam para `tem_permissao('<tela>', '<acao>')` é parte da Fase 6.
- **Edge Functions que autorizam por papel** (`autorizar(req, papeis)` em `_shared/auth.ts`:
  backup, send-email, resumo-proposta, corrigir-descricoes-ec, arquivar-documento, push-pendencias
  e o `listar` da gerenciar-usuarios) continuam
  certas porque o papel é derivado do grupo, mas o portão é o nível, não a tela. Converter para
  `temPermissaoDoUsuario(...)` (`_shared/permissaoDoUsuario.ts`) quando forem mexidas.
- **"Dar `acessos.grupos` · editar + `acessos.usuarios` · criar a um grupo é dar a chave do app"**
  (quem monta grupo e cadastra usuário se promove até o próprio alcance): só ao Administrador de
  sistema e a quem ele confia. Na virada, só as áreas que tinham `configuracoes` ("Direção" e
  "Financeiro", hoje sem ninguém) ganharam as telas de Acessos.
- **Grupo sem nenhuma permissão:** no banco e na tela não pode nada; o push de pendências e a
  lista de Produtor Responsável, que leem `areas.recursos`, caem no padrão do papel para quem tem
  área com recursos vazios (comportamento antigo). Não acontece com os grupos de partida.
- **Inativar e trocar senha não derrubam a sessão na hora** (a Edge antiga chamava `signOut`, que na
  API admin pede o JWT da pessoa, não o id): a RLS recusa tudo do inativo no comando seguinte,
  porque `papel_atual()` exige ativo; quem teve a senha trocada segue logado até a sessão expirar.
- **Quem não é do Administrador não age acima do próprio alcance:** não edita, inativa nem troca a
  senha de quem está num grupo com mais acesso (permissões ou nível) que o dele, e não altera um
  grupo assim (banco: `definir_acesso_do_usuario`, `salvar_grupo_acesso`; Edge: `definir_senha`).
- **Front publicado antes do banco:** as abas antigas de Áreas e Usuários saíram de Configurações e
  `/acessos`, sem a migration, só mostra o aviso — ninguém cadastra usuário nesse intervalo. Por
  isso a ordem banco → Edges → front é obrigatória no dia do merge.
- Fica para depois: sugestão de grupo por setor/cargo (gancho em `usuarios.ts`) e troca automática
  de grupo quando a pessoa muda de função.

## Pendência: Fase 6 — escrita por tela no banco (NÃO implementada)

Por que esperar: as policies restritivas só podem entrar depois de o front estar em produção
usando o catálogo e de a equipe ter usado a tela de Acessos; antes disso, uma tabela esquecida no
mapa trancaria trabalho legítimo. Modelo: `banco.sql`, PARTE 2, da skill `acesso-padrao-lspro`
(`pode_gravar_em(telas)` + três policies `as restrictive` por tabela), com o teste do mapa
(`testes.md`, bloco 5) e o ensaio em `begin … rollback`.

Rascunho do mapa tabela → telas (tabelas que o front grava direto, levantadas em 24/11/2026 em
`src/data/supabase.ts`; **na dúvida, a tela entra**):

| Tabela | Telas que gravam |
|---|---|
| `projetos` | `projetos.projetos` |
| `clientes` | `projetos.projetos`, `estimativas.ec`, `ordens.os` |
| `checklists`, `checklist_itens` | `projetos.checklists`, `projetos.projetos` |
| `checklist_modelos` | `projetos.checklists` (ação `lista_padrao`) |
| `ecs` | `estimativas.ec`, `ordens.os` |
| `oss`, `os_linhas` | `ordens.os`, `estimativas.ec` |
| `os_financeiro` | `ordens.financeiro` |
| `fornecedores` | `cadastros.fornecedores`, `ordens.os`, `estimativas.ec` |

Ficam **fora** (seguem pelas policies de hoje): `empresas_grupo` e `config_app` (a tela
`admin.configuracoes` só tem "Ver" — a condição "alguma ação além de ver" trancaria todo mundo
menos o Administrador, lição do DP Corp), `chamados` (Help Desk, tela só de "Ver"), `audit_log`,
`areas` (espelho), `perfis` e as tabelas `acesso_*`, e o que só se grava por RPC/Edge/gatilho
(`ec_linhas` por `salvar_ec_completa`, `edicoes_abertas`, `push_inscricoes`, `credenciamentos`).
Antes de escrever a migration: confirmar cada linha abrindo a tela, inventariar as RPCs acima e
decidir se o "nível no banco" sai junto (entrega separada, com deploy acoplado).

## Publicação (dia do merge) — ordem: banco → Edges → front

1. **Ensaio** (não grava nada): abrir `supabase/migrations/20261124150000_acessos_grupos_de_permissao.sql`
   no SQL Editor, **descomentar o bloco "ENSAIO"** do fim (fica antes do `commit;`) e rodar o
   arquivo inteiro. Ele termina em erro de propósito; a mensagem é o resultado. Esperado:
   `ativos sem grupo=0, administradores ativos=1, grupo padrão=1, grupos=10` e o mapa
   papel → grupo igual ao de hoje. Se a migration desistir antes (mensagens "A tradução área →
   grupo mudaria…", "Há usuário ativo sem área…"), nada foi aplicado: resolva e ensaie de novo.
   Área inativa que ainda tem gente ativa vira grupo **ativo** (senão essas pessoas perderiam o
   acesso); confira antes com
   `select a.nome, count(*) from areas a join perfis p on p.area_id = a.id and p.ativo where not a.ativa group by 1;`
   (em 24/11/2026: nenhuma).
2. **Aplicar a migration** (arquivo original, sem o bloco de ensaio).
3. Rodar as consultas de **CONFERÊNCIA DEPOIS DE APLICAR** do fim do arquivo.
4. **Publicar a Edge `acessos`** (nova) e **republicar `gerenciar-usuarios`** (agora recusa criar,
   editar e ativar/inativar depois da migration; `listar` continua). A `acessos` valida o JWT por
   conta própria: pode ser publicada com `--no-verify-jwt` (padrão) ou com a verificação do
   gateway ligada — as duas funcionam. Baixar a versão no ar e comparar com o repositório.
5. **Publicar o front.**
6. Painel do Supabase (equipe; a IA não mexe em configuração do Auth):
   - *Authentication → Attack Protection* (o nome pode variar): **"Prevent use of leaked
     passwords"** ligado, tamanho mínimo **8**. Exige plano **Pro**; no Free fica travado — anotar
     como pendência. Conferir pelo advisor de segurança (aviso `auth_leaked_password_protection`
     tem de sumir).
   - Conferir que **"Allow new users to sign up"** está **desligado**: até esta migration, qualquer
     conta nova no Auth nascia com acesso (papel lido do próprio cadastro). Agora nasce pendente,
     mas cadastro aberto continua sendo porta desnecessária.
   - Segredo opcional da Edge `acessos`: `ACESSOS_ALLOWED_ORIGINS` (origens do app, separadas por
     vírgula). Sem ele o CORS responde `*`.
7. Atualizar a lista de tabelas do back-up diário (`supabase/functions/backup-diario`) com
   `acesso_grupo`, `acesso_grupo_permissao` e `acesso_usuario_especial`.
