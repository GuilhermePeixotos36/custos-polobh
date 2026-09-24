/*
 * ATIVAR e INATIVAR um usuário                                  (24/09/2026)
 *
 * Até aqui, tirar alguém do sistema só tinha uma forma: apagar o login. É
 * definitivo, e leva junto o vínculo de tudo o que a pessoa fez — a trilha de
 * auditoria fica sem dono, e um dia alguém precisa saber quem lançou aquela EC.
 * Quem sai de férias, quem é afastado, quem deixa a casa mas cujo trabalho
 * continua lá: nenhum desses casos era "apagar".
 *
 * ONDE O BLOQUEIO MORDE. Não na tela — no banco. Toda a RLS deste sistema passa
 * por `papel_atual()`, que responde qual é o papel de quem está pedindo. Basta
 * ela devolver NULO para um inativo e TODAS as políticas recusam, de uma vez,
 * sem depender de o aplicativo lembrar de checar. Vale inclusive para uma sessão
 * já aberta: o bloqueio é no próximo comando, não no próximo login.
 *
 * Três políticas não passavam por `papel_atual()` — as do Help Desk e a de
 * auditoria, que olham `auth.uid()` direto porque são "as minhas próprias
 * linhas". Elas ganham a mesma régua aqui. Meio bloqueado é o tipo de coisa que
 * surpreende alguém seis meses depois.
 *
 * QUEM PODE INATIVAR é decidido na Edge Function `gerenciar-usuarios`
 * (Admin e Direção). O que o banco garante, por baixo, é o que nenhuma tela
 * pode desfazer: ninguém inativa a si mesmo, e ninguém inativa o último acesso
 * capaz de reativar os outros.
 */

alter table perfis add column if not exists ativo boolean not null default true;

comment on column perfis.ativo is
  'Conta ativa. Inativa não passa pela RLS (ver `papel_atual`): perde o acesso no comando seguinte, mesmo com sessão aberta. Preserva o histórico, que apagar o login destruiria.';

/* ------------------------------------------------------------------ *
 * 1. O portão da RLS passa a exigir conta ativa.
 * ------------------------------------------------------------------ */
create or replace function papel_atual()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select papel from perfis where id = auth.uid() and ativo
$function$;

comment on function papel_atual() is
  'O papel de quem está pedindo — NULO quando a conta está inativa, o que faz toda a RLS recusar.';

/* `e_suporte()` deriva de `papel_atual()` e herda a regra sem precisar mudar. */

/**
 * A mesma régua para as políticas que olham `auth.uid()` direto.
 */
create or replace function perfil_ativo()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select ativo from perfis where id = auth.uid()), false)
$function$;

revoke all on function perfil_ativo() from public, anon;
grant execute on function perfil_ativo() to authenticated;

/* ------------------------------------------------------------------ *
 * 2. Help Desk e auditoria: "as minhas próprias linhas", só se eu valho.
 * ------------------------------------------------------------------ */
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log
  for insert to authenticated
  with check (user_id = auth.uid() and perfil_ativo());

drop policy if exists chamados_insert on chamados;
create policy chamados_insert on chamados
  for insert to authenticated
  with check (aberto_por = auth.uid() and perfil_ativo());

drop policy if exists chamados_read on chamados;
create policy chamados_read on chamados
  for select to authenticated
  using ((aberto_por = auth.uid() and perfil_ativo()) or e_suporte());

/* ------------------------------------------------------------------ *
 * 3. As duas travas que nenhuma tela pode desfazer.
 *
 * A primeira é óbvia depois que acontece: quem se inativa não consegue se
 * reativar, e se for o único com permissão, ninguém consegue.
 *
 * A segunda é a mesma história um passo adiante — inativar o último Admin ou
 * Direção ATIVO deixaria o sistema sem ninguém capaz de reativar qualquer um.
 * O conserto seria por SQL, no banco de produção, às pressas.
 * ------------------------------------------------------------------ */
create or replace function impedir_lockout_de_acesso()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.ativo and not new.ativo then
    if new.id = auth.uid() then
      raise exception 'Você não pode inativar a sua própria conta.';
    end if;

    if old.papel in ('Admin', 'Direcao')
       and not exists (
         select 1 from perfis
          where ativo and papel in ('Admin', 'Direcao') and id <> old.id
       ) then
      raise exception 'Esta é a última conta capaz de ativar e inativar usuários — inativá-la deixaria o sistema sem ninguém para reverter.';
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists perfis_impedir_lockout on perfis;
create trigger perfis_impedir_lockout
  before update on perfis
  for each row execute function impedir_lockout_de_acesso();

revoke all on function impedir_lockout_de_acesso() from public, anon, authenticated;

/* ------------------------------------------------------------------ *
 * 4. Quem está inativo ainda lê a PRÓPRIA linha.
 *
 * Sem isto, a tela de entrada não tem como distinguir "sua conta foi
 * desativada" de "seu usuário não tem perfil configurado": a RLS recusa a
 * leitura, e o aplicativo só vê o vazio. A pessoa abriria chamado perguntando
 * de um defeito que não existe.
 *
 * Ler o próprio nome e papel não é privilégio nenhum — e é o que permite a
 * mensagem certa na tela. Todo o resto do sistema continua fechado, porque
 * todas as outras políticas passam por `papel_atual()`.
 * ------------------------------------------------------------------ */
drop policy if exists perfis_read_autenticados on perfis;
create policy perfis_read_autenticados on perfis
  for select to authenticated
  using (papel_atual() is not null or id = auth.uid());
