-- ============================================================================
-- O print da tela vai junto com o chamado                    (10/09/2026)
--
-- Metade de um chamado de suporte é a imagem: "o botão some", "o valor aparece
-- errado", "dá esse erro aqui". Descrever isso por escrito custa três idas e
-- vindas — e a pessoa está justamente no meio de um trabalho, com pressa.
--
-- Os BYTES ficam no Storage, num bucket próprio; a FICHA do arquivo (nome,
-- tamanho, quem mandou) fica no jsonb do chamado, ao lado do texto que ela
-- acompanha. É o mesmo desenho dos anexos do check-list (migração
-- 20260908100000) — a diferença é quem pode subir: ali são os quatro papéis que
-- mexem em tarefa, aqui é QUALQUER pessoa logada, porque qualquer pessoa logada
-- abre chamado. Justamente quem tem menos acesso é quem mais precisa pedir
-- ajuda.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anexos-chamados',
  'anexos-chamados',
  -- Fechado, como o do check-list: não existe URL permanente, e a tela pede um
  -- link assinado de vida curta a cada abertura.
  false,
  5242880, -- 5 MB por arquivo
  -- Print, foto do celular e o PDF que a pessoa recebeu e não conseguiu abrir.
  -- Nada que o navegador execute (html, svg, js) — anexo é para ser lido.
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- Quem está logado sobe o seu print; quem está logado abre o que precisa ver.
--
-- A leitura é de qualquer perfil válido, e não "só do dono": o suporte precisa
-- abrir o print de quem pediu ajuda, e o Storage não conhece a regra de quem é
-- o chamado. O que protege o conteúdo é o CAMINHO ser imprevisível (uuid do
-- chamado + uuid do arquivo) e o link ser assinado por 60 segundos — mesma
-- régua já aceita nos anexos do check-list.
-- ----------------------------------------------------------------------------
drop policy if exists anexos_chamados_read on storage.objects;
create policy anexos_chamados_read on storage.objects for select
  using (bucket_id = 'anexos-chamados' and papel_atual() is not null);

drop policy if exists anexos_chamados_insert on storage.objects;
create policy anexos_chamados_insert on storage.objects for insert
  with check (bucket_id = 'anexos-chamados' and papel_atual() is not null);

-- Apagar é só do suporte: o anexo é prova do que aconteceu, e quem abriu o
-- chamado não deve poder tirar a prova do meio depois de mandada.
drop policy if exists anexos_chamados_delete on storage.objects;
create policy anexos_chamados_delete on storage.objects for delete
  using (bucket_id = 'anexos-chamados' and e_suporte());

-- Sem policy de UPDATE, pelo mesmo motivo do check-list: anexo não se edita.
-- Cada envio cria um caminho novo.

-- ----------------------------------------------------------------------------
-- A ficha dos arquivos do RELATO (a abertura do chamado).
--
-- Os anexos de cada RESPOSTA vão dentro da própria mensagem, em
-- `mensagens[].anexos` — a coluna abaixo é só do texto de abertura, que não é
-- uma mensagem da lista.
-- ----------------------------------------------------------------------------
alter table chamados add column if not exists anexos jsonb not null default '[]'::jsonb;

comment on column chamados.anexos is
  'Fichas dos arquivos do relato inicial: [{id, caminho, nome, tamanho, tipo, enviadoPorNome, enviadoEm}]. Os bytes ficam no bucket anexos-chamados.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chamados_anexos_check') then
    alter table chamados add constraint chamados_anexos_check check (jsonb_typeof(anexos) = 'array');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Pendurar arquivos no relato do chamado.
--
-- Por que uma função, e não um UPDATE: a policy de UPDATE de `chamados` é do
-- SUPORTE. Quem abre o chamado não tem escrita na tabela de propósito — com
-- ela, poderia reescrever o próprio relato ou o status depois de respondido.
-- Esta função faz uma coisa só: ACRESCENTA fichas no fim da lista.
--
-- O chamado é gravado ANTES de o arquivo subir (é o "grava primeiro, avisa
-- depois" da tela): quando o upload falha, sobra um chamado sem print — que é
-- muito melhor do que um print sem chamado.
-- ----------------------------------------------------------------------------
create or replace function anexar_ao_chamado(p_chamado_id uuid, p_anexos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono uuid;
  v_linha chamados%rowtype;
begin
  if auth.uid() is null or papel_atual() is null then
    raise exception 'Sem permissao para anexar';
  end if;
  if jsonb_typeof(p_anexos) is distinct from 'array' then
    raise exception 'Anexos devem ser uma lista';
  end if;
  -- O mesmo teto da tela e do e-mail: três arquivos por mensagem.
  if jsonb_array_length(p_anexos) > 3 then
    raise exception 'No maximo 3 arquivos por vez';
  end if;

  select aberto_por into v_dono from chamados where id = p_chamado_id;
  if not found then
    raise exception 'Chamado nao encontrado';
  end if;
  if not e_suporte() and v_dono is distinct from auth.uid() then
    raise exception 'Este chamado nao e seu';
  end if;

  update chamados
     set anexos = coalesce(anexos, '[]'::jsonb) || p_anexos,
         atualizado_em = now()
   where id = p_chamado_id
   returning * into v_linha;

  return to_jsonb(v_linha);
end;
$$;

revoke all on function anexar_ao_chamado(uuid, jsonb) from public, anon;
grant execute on function anexar_ao_chamado(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- Responder passa a levar anexos junto.
--
-- Assinatura nova, com valor padrão: quem chamar com dois argumentos continua
-- funcionando (é a mesma função). A versão de dois argumentos é derrubada antes
-- para não ficarem duas, ambíguas entre si.
-- ----------------------------------------------------------------------------
drop function if exists responder_chamado(uuid, text);

create or replace function responder_chamado(
  p_chamado_id uuid,
  p_texto text,
  p_anexos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suporte boolean;
  v_dono uuid;
  v_nome text;
  v_email text;
  v_msg jsonb;
  v_linha chamados%rowtype;
  v_anexos jsonb := coalesce(p_anexos, '[]'::jsonb);
begin
  if auth.uid() is null or papel_atual() is null then
    raise exception 'Sem permissao para responder chamado';
  end if;
  if jsonb_typeof(v_anexos) is distinct from 'array' then
    raise exception 'Anexos devem ser uma lista';
  end if;
  if jsonb_array_length(v_anexos) > 3 then
    raise exception 'No maximo 3 arquivos por vez';
  end if;
  -- Texto vazio continua recusado, MENOS quando a mensagem é o arquivo: mandar
  -- só o print é uma resposta legítima, e das mais comuns aqui.
  if coalesce(btrim(p_texto), '') = '' and jsonb_array_length(v_anexos) = 0 then
    raise exception 'A resposta nao pode ser vazia';
  end if;
  if length(p_texto) > 10000 then
    raise exception 'Resposta longa demais';
  end if;

  select aberto_por into v_dono from chamados where id = p_chamado_id;
  if not found then
    raise exception 'Chamado nao encontrado';
  end if;

  v_suporte := e_suporte();
  if not v_suporte and v_dono is distinct from auth.uid() then
    raise exception 'Este chamado nao e seu';
  end if;

  select coalesce(p.nome, ''), coalesce(u.email, '')
    into v_nome, v_email
    from auth.users u left join perfis p on p.id = u.id
   where u.id = auth.uid();

  v_msg := jsonb_build_object(
    'id', gen_random_uuid(),
    'texto', btrim(coalesce(p_texto, '')),
    'autorNome', v_nome,
    'autorEmail', v_email,
    'suporte', v_suporte,
    'anexos', v_anexos,
    'criadoEm', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update chamados
     set mensagens = mensagens || v_msg,
         -- Quem falou passa a vez ao outro.
         status = case when v_suporte then 'Respondido' else 'Aberto' end,
         atualizado_em = now()
   where id = p_chamado_id
   returning * into v_linha;

  return to_jsonb(v_linha);
end;
$$;

revoke all on function responder_chamado(uuid, text, jsonb) from public, anon;
grant execute on function responder_chamado(uuid, text, jsonb) to authenticated;
