# -*- coding: utf-8 -*-
from docx import Document
from collections import Counter
path = r"C:\Users\joão.benedito\Downloads\Escopo Funcional -34966- Importador NFe - Unificado novo V1.2.docx"
doc = Document(path)
styles = Counter(p.style.name for p in doc.paragraphs if p.text.strip())
for name,count in styles.items():
    print(name, count)
section = doc.sections[0]
print('margins', section.top_margin, section.bottom_margin, section.left_margin, section.right_margin)
print('page', section.page_width, section.page_height)
