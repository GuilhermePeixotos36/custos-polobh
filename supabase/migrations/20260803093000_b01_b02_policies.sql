-- B-01 e B-02 — Ajustes de policies.

-- B-01: o nome dizia "self read", mas a regra é `papel_atual() is not null`,
-- ou seja, todo autenticado lê o perfil de todos. O comportamento é intencional
-- (o app precisa listar usuários para atribuir pendências e produtor
-- responsável); o nome é que induzia a erro em revisões. Só renomeia.
alter policy perfis_self_read on perfis rename to perfis_read_autenticados;

comment on table perfis is
  'Perfil e papel de cada usuário. Leitura liberada a qualquer autenticado de propósito: o app lista usuários para menções, pendências e produtor responsável.';

-- B-02: a trilha de auditoria aceitava qualquer autenticado inserir qualquer
-- linha, inclusive atribuída a outra pessoa. Agora o registro tem que ser do
-- próprio autor — continua sem update/delete, então o histórico permanece
-- imutável, só deixa de ser forjável em nome de terceiros.
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert to authenticated
  with check (user_id = auth.uid());
