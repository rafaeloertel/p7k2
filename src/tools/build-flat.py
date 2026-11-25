"""Hub — pacote de publicação: os 11 arquivos que vão na raiz do repositório p7k2 (dist/flat/).

Inclui sempre o .nojekyll (sem ele o GitHub Pages tenta interpretar o JS e o build falha em silêncio).
Confere que a versão está igual nos três lugares antes de gerar.
"""
import os, re, shutil, subprocess, sys
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "tools"))
import importlib.util
spec = importlib.util.spec_from_file_location("bs", os.path.join(RAIZ, "tools", "build-single.py"))
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)

h, _ = bs.montar()
v_core = re.search(r'version: "(v[\d.]+)"', bs.ler("js/core.js")).group(1)
v_sw = re.search(r'const VER = "hub-(v[\d.]+)"', bs.ler("sw.js")).group(1)
if v_core != v_sw: sys.exit("versão diferente: core.js %s × sw.js %s" % (v_core, v_sw))

out = os.path.join(RAIZ, "dist", "flat")
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
with open(os.path.join(out, "index.html"), "w", encoding="utf-8", newline="") as f: f.write(h)
for f in ["sw.js", "manifest.json"]: shutil.copyfile(os.path.join(RAIZ, f), os.path.join(out, f))
for f in bs.STATIC: shutil.copyfile(os.path.join(RAIZ, "assets", f), os.path.join(out, f))
open(os.path.join(out, ".nojekyll"), "w").write("\n")
arqs = sorted(os.listdir(out))
print("dist/flat (%s): %d arquivos — %s" % (v_core, len(arqs), " ".join(arqs)))
if len(arqs) != 11: sys.exit("esperados 11 arquivos")
