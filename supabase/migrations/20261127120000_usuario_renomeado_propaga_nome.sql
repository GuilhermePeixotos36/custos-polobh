-- Renomear um usuário leva o nome novo aos DADOS VIVOS que guardam a pessoa pelo nome
-- (27/11/2026). Sem isto, tirar o "(cp)" do nome da Carol deixava o nome antigo em
-- projetos e tarefas, e a pessoa aparecia duas vezes nos filtros.
--
-- Vivo  = quem É o responsável hoje: produtora do projeto, responsável da tarefa do
--         check-list, responsável padrão dos modelos e o do lembrete de feriados.
-- Não entra o que é REGISTRO do que aconteceu: quem concluiu, quem escreveu a observação,
-- logs e documentos emitidos continuam com o nome da época.

-- A pessoa pelo nome, sem apelido entre parênteses, acento, caixa ou espaço sobrando —
-- a mesma comparação que o app faz em `normalizarPessoa` (domain/pendencias.ts).
create or replace function private.chave_pessoa(v text)
returns text language sql immutable set search_path = '' as $$
  select lower(translate(
    regexp_replace(trim(regexp_replace(coalesce(v, ''), '\s*\([^)]*\)\s*', ' ', 'g')), '\s+', ' ', 'g'),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  ));
$$;

-- Troca, nos dados vivos, todo nome que seja a pessoa `p_chave` por `p_novo`.
create or replace function private.aplicar_nome_pessoa(p_chave text, p_novo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p_chave, '') = '' or coalesce(p_novo, '') = '' then return; end if;

  update public.projetos
     set projeto = jsonb_set(projeto, '{produtoraResponsavel}', to_jsonb(p_novo))
   where coalesce(projeto->>'produtoraResponsavel', '') not in ('', p_novo)
     and private.chave_pessoa(projeto->>'produtoraResponsavel') = p_chave;

  update public.checklist_itens
     set responsavel = p_novo
   where coalesce(responsavel, '') not in ('', p_novo)
     and private.chave_pessoa(responsavel) = p_chave;

  update public.checklist_modelos m
     set itens = (
       select jsonb_agg(
         case when coalesce(i->>'responsavelPadrao', '') <> '' and private.chave_pessoa(i->>'responsavelPadrao') = p_chave
              then jsonb_set(i, '{responsavelPadrao}', to_jsonb(p_novo)) else i end
         order by ord)
       from jsonb_array_elements(m.itens) with ordinality as t(i, ord))
   where jsonb_typeof(m.itens) = 'array'
     and exists (
       select 1 from jsonb_array_elements(m.itens) i
        where coalesce(i->>'responsavelPadrao', '') not in ('', p_novo)
          and private.chave_pessoa(i->>'responsavelPadrao') = p_chave);

  update public.config_app
     set valor = jsonb_set(valor, '{nome}', to_jsonb(p_novo))
   where chave = 'feriados_responsavel'
     and coalesce(valor->>'nome', '') not in ('', p_novo)
     and private.chave_pessoa(valor->>'nome') = p_chave;
end; $$;

create or replace function private.propagar_nome_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  antiga text := private.chave_pessoa(old.nome);
begin
  if new.nome is distinct from old.nome and coalesce(trim(new.nome), '') <> '' then
    -- Homônimo: se outro usuário atende pelo mesmo nome antigo, não dá para saber de
    -- quem é cada lançamento — nada é trocado.
    if not exists (select 1 from public.perfis p where p.id <> new.id and private.chave_pessoa(p.nome) = antiga) then
      perform private.aplicar_nome_pessoa(antiga, new.nome);
    end if;
  end if;
  return new;
end; $$;

revoke all on function private.chave_pessoa(text) from public;
revoke all on function private.aplicar_nome_pessoa(text, text) from public;
revoke all on function private.propagar_nome_usuario() from public;

drop trigger if exists perfis_propagar_nome on public.perfis;
create trigger perfis_propagar_nome after update of nome on public.perfis
  for each row execute function private.propagar_nome_usuario();

-- Limpeza única do que já estava gravado com o nome antigo ("Carol Estelian (cp)").
do $$
declare p record;
begin
  for p in
    select nome, private.chave_pessoa(nome) as chave from public.perfis a
     where not exists (select 1 from public.perfis b where b.id <> a.id and private.chave_pessoa(b.nome) = private.chave_pessoa(a.nome))
  loop
    perform private.aplicar_nome_pessoa(p.chave, p.nome);
  end loop;
end $$;

-- "Emanuelle" (só o primeiro nome, digitado antes de o cadastro ter sobrenome) é a única
-- Emanuelle da casa: passa ao nome do cadastro.
do $$
declare alvo text;
begin
  if (select count(*) from public.perfis where private.chave_pessoa(nome) like 'emanuelle%') = 1 then
    select nome into alvo from public.perfis where private.chave_pessoa(nome) like 'emanuelle%';
    perform private.aplicar_nome_pessoa('emanuelle', alvo);
  end if;
end $$;
