-- ============================================================================
-- Feriados: quem pode lançar                                  (29/09/2026)
--
-- Todo janeiro o sistema cobra o lançamento dos feriados municipais do ano, e a
-- pessoa cobrada é, por padrão, o Tiago — do Financeiro (papel 'Administrativo').
-- Mas `config_app` só era escrita por Admin/Direção: o Financeiro receberia a
-- pendência e não conseguiria cumpri-la.
--
-- Esta política abre a escrita, e só ela, para as DUAS chaves do assunto:
--   · `feriados`             — a lista de feriados (nacionais em cache + municipais);
--   · `feriados_responsavel` — quem recebe o lembrete de janeiro.
-- Qualquer outra chave de `config_app` continua só de Admin/Direção. (As políticas
-- do Postgres se somam: esta não tira nada da política que já existe.)
-- ============================================================================

drop policy if exists config_app_feriados_write on config_app;

create policy config_app_feriados_write on config_app for all
  using (chave in ('feriados', 'feriados_responsavel') and papel_atual() in ('Admin','Direcao','Administrativo'))
  with check (chave in ('feriados', 'feriados_responsavel') and papel_atual() in ('Admin','Direcao','Administrativo'));
