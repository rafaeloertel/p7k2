"""Hub — reconstrói a fonte modular a partir do index.html publicado (desfaz o build-single).

Só para emergência: a fonte já vive em src/ no próprio repositório. Uso:
    python3 tools/desinline.py <repo>/index.html <pasta-nova>
"""
import re, sys, os, shutil
src, out = sys.argv[1], sys.argv[2]
repo = os.path.dirname(src)
h = open(src, encoding="utf-8").read()
os.makedirs(out + "/js", exist_ok=True); os.makedirs(out + "/assets", exist_ok=True)
# CSS
a = h.index("<style>\n"); b = h.index("</style>", a)
open(out + "/assets/app.css", "w", encoding="utf-8", newline="").write(h[a + 8:b])
h = h[:a] + '<link rel="stylesheet" href="assets/app.css">' + h[b + 8:]
# JS com marcador
pat = re.compile(r"<script>/\* (js/[a-z0-9._-]+\.js) \*/\n(.*?)</script>", re.S)
names = []
def rep(m):
    names.append(m.group(1))
    open(out + "/" + m.group(1), "w", encoding="utf-8", newline="").write(m.group(2))
    return '<script src="%s"></script>' % m.group(1)
h = pat.sub(rep, h)
# arquivos estáticos referenciados pela raiz passam a viver em assets/
STATIC = ["supabase.js", "591.supabase.js", "favicon.svg", "favicon-32.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]
for f in STATIC:
    shutil.copyfile(os.path.join(repo, f), out + "/assets/" + f)
    h = h.replace('href="%s"' % f, 'href="assets/%s"' % f).replace('src="%s"' % f, 'src="assets/%s"' % f)
open(out + "/index.html", "w", encoding="utf-8", newline="").write(h)
for f in ["sw.js", "manifest.json"]:
    shutil.copyfile(os.path.join(repo, f), out + "/" + f)
print(len(names), "módulos:", " ".join(names))
