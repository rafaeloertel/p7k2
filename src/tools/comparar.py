"""Hub — confere que o build da fonte é idêntico, byte a byte, ao que está publicado.

Uso (de dentro de src/, num clone do p7k2):  python3 tools/build-flat.py && python3 tools/comparar.py ..
Sai com erro se qualquer um dos 11 arquivos diferir. É a prova de que fonte e site estão alinhados.
"""
import filecmp, os, sys
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
repo = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(RAIZ)
flat = os.path.join(RAIZ, "dist", "flat")
dif = []
for f in sorted(os.listdir(flat)):
    pub = os.path.join(repo, f)
    igual = os.path.exists(pub) and filecmp.cmp(os.path.join(flat, f), pub, shallow=False)
    print(("igual  " if igual else "DIFERE ") + f)
    if not igual: dif.append(f)
print("\nalinhados" if not dif else "\n%d arquivo(s) diferentes: a fonte e o site NÃO estão alinhados" % len(dif))
sys.exit(1 if dif else 0)
