-- Renomear um setor ou função no cadastro leva o novo nome a quem já está nele
-- (perfis.setor / perfis.cargo guardam o nome escolhido da lista).
create or replace function private.propagar_nome_setor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.nome is distinct from old.nome then
    update public.perfis set setor = new.nome where setor = old.nome;
  end if;
  return new;
end; $$;

create or replace function private.propagar_nome_funcao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.nome is distinct from old.nome then
    update public.perfis set cargo = new.nome where cargo = old.nome;
  end if;
  return new;
end; $$;

revoke all on function private.propagar_nome_setor() from public;
revoke all on function private.propagar_nome_funcao() from public;

drop trigger if exists acesso_setor_propagar_nome on public.acesso_setor;
create trigger acesso_setor_propagar_nome after update of nome on public.acesso_setor
  for each row execute function private.propagar_nome_setor();
drop trigger if exists acesso_funcao_propagar_nome on public.acesso_funcao;
create trigger acesso_funcao_propagar_nome after update of nome on public.acesso_funcao
  for each row execute function private.propagar_nome_funcao();
