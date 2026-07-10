# -*- coding: utf-8 -*-
import os, sys, tempfile, runpy
base = r"C:\tmp\vitras-docx-temp"
os.makedirs(base, exist_ok=True)
os.environ['TMP'] = base
os.environ['TEMP'] = base
os.environ['TMPDIR'] = base
tempfile.tempdir = base
sys.argv = [r"C:\dev\vitras\tmp_render_docx.py", r"C:\dev\vitras\escopos\painel.docx", '--output_dir', r"C:\dev\vitras\artifacts\painel-docx-render"]
runpy.run_path(r"C:\dev\vitras\tmp_render_docx.py", run_name='__main__')
