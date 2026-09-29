# -*- coding: utf-8 -*-
"""
Escreve as respostas DENTRO do check-list original da Marisa.

O documento dela não é reescrito: cada resposta entra como um trecho novo no FIM
do parágrafo do item correspondente, em cor e com etiqueta própria. O que ela
escreveu continua lá, palavra por palavra — e é isso que permite ler o pedido e
a resposta na mesma linha, sem ter de abrir dois arquivos lado a lado.
"""
import re, sys, shutil, zipfile, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xml.etree import ElementTree as ET
from checklist_respostas import R

DIR = os.path.dirname(os.path.abspath(__file__))
# Aponte para a cópia desempacotada do check-list original da Marisa.
DOC = os.environ.get("DOC_XML", os.path.join(DIR, "un/word/document.xml"))
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# Os prefixos de namespace precisam sair como entraram: o Word recusa o arquivo
# se o `w:` virar `ns0:`, que é o que o ElementTree faz sem isto.
bruto = open(DOC, encoding="utf8").read()
# TODOS os namespaces, e não só os da tag raiz: o Word declara alguns (o do
# DrawingML, por exemplo) dentro do corpo, e o que não estiver registrado aqui
# sai renomeado para `ns5:` — um arquivo que o Word recusa a abrir.
for prefixo, uri in re.findall(r'xmlns:([A-Za-z0-9]+)="([^"]+)"', bruto):
    ET.register_namespace(prefixo, uri)

arvore = ET.parse(DOC)
raiz = arvore.getroot()
corpo = raiz.find(W + "body")
paras = list(corpo.iter(W + "p"))

ETIQUETA = {
    "F": ("[FEITO]",            "1B7F3B"),  # verde
    "D": ("[DEPENDE DE VOCÊ]",  "B25B00"),  # laranja
    "P": ("[PERGUNTA]",         "1B5FA8"),  # azul
}

def run(texto, cor, negrito=False, italico=False):
    r = ET.SubElement(None if False else ET.Element(W + "r"), W + "t")  # placeholder
    r = ET.Element(W + "r")
    pr = ET.SubElement(r, W + "rPr")
    if negrito:
        ET.SubElement(pr, W + "b")
    if italico:
        ET.SubElement(pr, W + "i")
    c = ET.SubElement(pr, W + "color"); c.set(W + "val", cor)
    sz = ET.SubElement(pr, W + "sz"); sz.set(W + "val", "20")
    szcs = ET.SubElement(pr, W + "szCs"); szcs.set(W + "val", "20")
    t = ET.SubElement(r, W + "t")
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = texto
    return r

aplicadas = 0
for indice, (estado, texto) in sorted(R.items()):
    if indice >= len(paras):
        print("ÍNDICE FORA DA FAIXA:", indice); continue
    p = paras[indice]
    etiqueta, cor = ETIQUETA[estado]
    p.append(run("   ", cor))
    p.append(run(etiqueta, cor, negrito=True))
    p.append(run(" " + texto, cor))
    aplicadas += 1

# ---- a legenda, logo depois do título do documento -------------------------
def paragrafo(runs, depois=60):
    p = ET.Element(W + "p")
    pPr = ET.SubElement(p, W + "pPr")
    esp = ET.SubElement(pPr, W + "spacing")
    esp.set(W + "after", str(depois)); esp.set(W + "before", "60")
    for r in runs:
        p.append(r)
    return p

legenda = [
    paragrafo([run("Respostas da GPX Automação — 22/09/2026", "1F2430", negrito=True)], 40),
    paragrafo([run("As respostas aparecem em cor, no fim de cada item. O texto da Pólobh não foi alterado em nenhum ponto.", "4A5262", italico=True)], 40),
    paragrafo([run("[FEITO]", "1B7F3B", negrito=True),
               run("  está no app e funcionando.    ", "4A5262"),
               run("[DEPENDE DE VOCÊ]", "B25B00", negrito=True),
               run("  falta uma decisão ou um arquivo.    ", "4A5262"),
               run("[PERGUNTA]", "1B5FA8", negrito=True),
               run("  há duas leituras possíveis.", "4A5262")], 40),
    paragrafo([run("82 dos 87 pontos estão feitos. As migrações do banco já foram aplicadas em produção.", "4A5262", italico=True)], 160),
]
filhos = list(corpo)
pos = filhos.index(paras[0])
for i, p in enumerate(legenda):
    corpo.insert(pos + i, p)

arvore.write(DOC, encoding="UTF-8", xml_declaration=True)

# A tag <w:document> precisa das declarações de namespace DOS DOIS LADOS, e não
# de um só:
#   · o ElementTree descarta as que nenhum elemento usa — e várias delas são
#     exigidas pelo atributo `mc:Ignorable`, que a própria tag carrega;
#   · o original não declara na raiz as que o Word escrevia lá embaixo, no
#     elemento em que eram usadas (o `a:` do DrawingML), e o ElementTree as sobe
#     para a raiz.
# Trocar uma tag pela outra perde metade em qualquer direção; então a nova
# recebe o que só existe na antiga.
escrito = open(DOC, encoding="utf8").read()
tag_orig = re.search(r"<w:document\b[^>]*>", bruto).group(0)
tag_nova = re.search(r"<w:document\b[^>]*>", escrito).group(0)
ja_tem = set(re.findall(r'xmlns:([A-Za-z0-9]+)=', tag_nova))
faltantes = [d for pre, d in
             ((pre, d) for pre, d in
              zip(re.findall(r'xmlns:([A-Za-z0-9]+)=', tag_orig),
                  re.findall(r'(xmlns:[A-Za-z0-9]+="[^"]*")', tag_orig)))
             if pre not in ja_tem]
tag_final = tag_nova[:-1] + ("".join(" " + d for d in faltantes)) + ">"
open(DOC, "w", encoding="utf8").write(escrito.replace(tag_nova, tag_final, 1))
print("namespaces devolvidos à raiz:", len(faltantes))

print("respostas aplicadas:", aplicadas)
