-- OS CANCELADA DEVOLVE OS ITENS À EC (15/10/2026).
--
-- Emitir a OS marca os itens da EC como "OK" (a OS saiu). Cancelar a OS não
-- desfazia isso: o item ficava "OK" apontando para uma OS cancelada — não
-- entrava mais na emissão, não podia ser ocultado nem excluído, e a equipe
-- ficava sem caminho para emitir de novo (aconteceu em 12/10, Passagens Aéreas).
--
-- Agora, quando uma OS passa a Cancelada, cada item dela que não esteja coberto
-- por outra OS viva volta para "Emitir": o item segue aprovado e pronto para uma
-- nova OS (outro fornecedor, outra condição). OS Arquivada não entra aqui — ela
-- é arquivada justamente porque uma versão nova a substituiu.
create or replace function public.liberar_itens_de_os_cancelada()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'Cancelada' and old.status is distinct from 'Cancelada' then
    update ec_linhas l
       set status_os = 'Emitir'
     where l.id in (select x.ec_linha_id from os_linhas x where x.os_id = new.id)
       and l.status_os in ('OK', 'Emitir Nova Versão')
       and not exists (
         select 1 from os_linhas y join oss o on o.id = y.os_id
          where y.ec_linha_id = l.id and o.id <> new.id
            and o.status not in ('Cancelada', 'Arquivada')
       );
  end if;
  return new;
end;
$$;

drop trigger if exists oss_cancelada_libera_itens on public.oss;
create trigger oss_cancelada_libera_itens
  after update of status on public.oss
  for each row execute function public.liberar_itens_de_os_cancelada();

-- O caso que já aconteceu: itens "OK" cuja única OS está cancelada.
update ec_linhas l
   set status_os = 'Emitir'
 where l.status_os in ('OK', 'Emitir Nova Versão')
   and exists (select 1 from os_linhas x join oss o on o.id = x.os_id where x.ec_linha_id = l.id and o.status = 'Cancelada')
   and not exists (select 1 from os_linhas y join oss o on o.id = y.os_id where y.ec_linha_id = l.id and o.status not in ('Cancelada', 'Arquivada'));
