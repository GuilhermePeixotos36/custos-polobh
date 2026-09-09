-- ============================================================================
-- Acerta a caixa alta/baixa do que já está gravado        (09/09/2026)
--
-- A régua agora é do app e fica no caminho da gravação (`src/domain/textos.ts`,
-- aplicada nos `*Row` de `data/supabase.ts`): daqui para a frente nenhum texto
-- entra torto, venha de onde vier — digitado, puxado da Receita, importado de
-- outra EC ou copiado para a foto da OS. Falta o passivo, e é o que esta
-- migração resolve.
--
-- Os valores abaixo NÃO foram escritos à mão: são o que `padronizarTexto()`
-- devolve, obtido rodando a própria função do app sobre os valores distintos
-- lidos deste banco. É o mesmo cuidado da migração `20260809160000` — só que
-- aquela precisou ser repetida a cada caso novo, e esta é a última, porque a
-- regra passou a viver no código.
--
-- O QUE MUDA, e por quê:
--   · razão social em CAIXA ALTA da Receita vira texto escrito, com as siglas
--     de pé: "SOM & LUZ PRODUÇÕES LTDA" -> "Som & Luz Produções LTDA", e
--     "LSPRO LOCACOES..." -> "LSPRO Locacoes...", que LSPRO é sigla e não nome;
--   · endereço idem, preservando a UF e o "CEP:";
--   · "ISENTO" na inscrição estadual vira "Isento" — o pedido que abriu isto.
--
-- O QUE NÃO MUDA: número de inscrição, documento, telefone, e-mail (precisam
-- bater com a fonte); nome de item da EC (é curto e cheio de sigla da casa —
-- "ECAD", "VT", "MÍDIA"); e tudo o que está em caixa mista, que é decisão de
-- quem escreveu ("Sonora AV" ficou "Sonora AV").
--
-- As duas correções de UF no fim são à parte: elas estão em caixa MISTA, então
-- a régua do app as respeita — são resíduo da correção manual de agosto, que
-- passou o endereço inteiro pelo "Nome Próprio" e produziu "Mg" e "Cep:".
-- ============================================================================

create or replace function _padroniza_texto(v text) returns text
language sql immutable as $$
  select case v
    when 'SOM & LUZ PRODUÇÕES LTDA'                then 'Som & Luz Produções LTDA'
    when 'MONTA TUDO ESTRUTURAS LTDA'              then 'Monta Tudo Estruturas LTDA'
    when 'BUFFET SABOR & ARTE EIRELI'              then 'Buffet Sabor & Arte EIRELI'
    when 'REINECKE PRODUCOES CULTURAIS LTDA'       then 'Reinecke Producoes Culturais LTDA'
    when 'LSPRO LOCACOES, SERVICOS E EVENTOS LTDA' then 'LSPRO Locacoes, Servicos e Eventos LTDA'
    when 'ISENTO'                                  then 'Isento'
    when 'ALVES GUIMARAES, 701 - CASA 1 - PINHEIROS - SAO PAULO - SP - CEP: 05410001'
      then 'Alves Guimaraes, 701 - Casa 1 - Pinheiros - Sao Paulo - SP - CEP: 05410001'
    when 'ALZIRA MENEZES NOGUEIRA, 108 - DISTRITO INDUSTRIAL JOAO DE ALMEIDA - RIBEIRAO DAS NEVES - MG - CEP: 33880300'
      then 'Alzira Menezes Nogueira, 108 - Distrito Industrial Joao de Almeida - Ribeirao das Neves - MG - CEP: 33880300'
    -- Resíduo da correção manual de agosto (caixa mista, UF e CEP baixados).
    when 'Aggeo Pio Sobrinho, 265 - Loja - Buritis - Belo Horizonte - Mg - Cep: 30575834'
      then 'Aggeo Pio Sobrinho, 265 - Loja - Buritis - Belo Horizonte - MG - CEP: 30575834'
    when 'Rua Rio de Janeiro, 1046 - Centro - Belo Horizonte - Mg'
      then 'Rua Rio de Janeiro, 1046 - Centro - Belo Horizonte - MG'
    else v end
$$;

/* Chave do jsonb pela mesma régua — devolve o objeto com aquela chave acertada. */
create or replace function _padroniza_chave(obj jsonb, chave text) returns jsonb
language sql immutable as $$
  select case
    when obj is null or obj->>chave is null then obj
    else jsonb_set(obj, array[chave], to_jsonb(_padroniza_texto(obj->>chave)))
  end
$$;

-- ------------------------------------------------------------- cadastros
update clientes set
  nome = _padroniza_texto(nome),
  razao_social = _padroniza_texto(razao_social),
  endereco = _padroniza_texto(endereco),
  inscricao_estadual = _padroniza_texto(inscricao_estadual),
  inscricao_municipal = _padroniza_texto(inscricao_municipal),
  representante = _padroniza_chave(_padroniza_chave(representante, 'nome'), 'cargo');

update fornecedores set
  razao_social = _padroniza_texto(razao_social),
  nome_fantasia = _padroniza_texto(nome_fantasia),
  endereco = _padroniza_texto(endereco),
  inscricao_estadual = _padroniza_texto(inscricao_estadual),
  inscricao_municipal = _padroniza_texto(inscricao_municipal),
  contato = _padroniza_chave(contato, 'representante');

-- ------------------------------------- fotos do cliente e do evento
-- Cliente e dados do evento são COPIADOS para dentro do projeto, da EC e da OS
-- (ver `Os.projeto`): acertar só o cadastro deixaria os documentos com o texto
-- velho, que é justamente o que aparece impresso.
update projetos set
  nome = _padroniza_texto(nome),
  cliente = _padroniza_chave(_padroniza_chave(_padroniza_chave(_padroniza_chave(
              _padroniza_chave(cliente, 'nome'), 'razaoSocial'), 'endereco'),
              'inscricaoEstadual'), 'inscricaoMunicipal'),
  projeto = _padroniza_chave(_padroniza_chave(_padroniza_chave(
              projeto, 'local'), 'enderecoLocal'), 'produtoraResponsavel');

update ecs set
  cliente = _padroniza_chave(_padroniza_chave(_padroniza_chave(_padroniza_chave(
              _padroniza_chave(cliente, 'nome'), 'razaoSocial'), 'endereco'),
              'inscricaoEstadual'), 'inscricaoMunicipal'),
  projeto = _padroniza_chave(_padroniza_chave(_padroniza_chave(
              projeto, 'local'), 'enderecoLocal'), 'produtoraResponsavel');

update ec_linhas set
  fornecedor_razao = _padroniza_texto(fornecedor_razao),
  fornecedor_contato = _padroniza_texto(fornecedor_contato);

update oss set
  fornecedor = _padroniza_chave(_padroniza_chave(_padroniza_chave(_padroniza_chave(
                 _padroniza_chave(fornecedor, 'razaoSocial'), 'nomeFantasia'), 'endereco'),
                 'inscricaoEstadual'), 'representante'),
  cliente = _padroniza_chave(_padroniza_chave(_padroniza_chave(_padroniza_chave(
              _padroniza_chave(cliente, 'nome'), 'razaoSocial'), 'endereco'),
              'inscricaoEstadual'), 'inscricaoMunicipal'),
  projeto = _padroniza_chave(_padroniza_chave(_padroniza_chave(
              projeto, 'local'), 'enderecoLocal'), 'produtoraResponsavel');

drop function _padroniza_chave(jsonb, text);
drop function _padroniza_texto(text);
