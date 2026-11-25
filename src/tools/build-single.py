"""Hub — junta a fonte modular num index.html único (dist/index.html).

CSS de assets/app.css entra num bloco <style>; cada js/x.js entra num <script> com o
marcador /* js/x.js */ (é por ele que a fonte se reconstrói a partir do publicado).
Os arquivos estáticos de assets/ passam a ser chamados pela raiz, onde o build-flat os põe.
"""
import os, re, sys
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC = ["supabase.js", "591.supabase.js", "favicon.svg", "favicon-32.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]

def ler(p):
    with open(os.path.join(RAIZ, p), encoding="utf-8", newline="") as f:
        return f.read()

def montar():
    h = ler("index.html")
    css = '<link rel="stylesheet" href="assets/app.css">'
    if h.count(css) != 1: sys.exit("index.html: link do app.css não encontrado (ou repetido)")
    h = h.replace(css, "<style>\n" + ler("assets/app.css") + "</style>")
    usados = []
    def js(m):
        usados.append(m.group(1))
        return "<script>/* %s */\n%s</script>" % (m.group(1), ler(m.group(1)))
    h = re.sub(r'<script src="(js/[a-z0-9._-]+\.js)"></script>', js, h)
    for f in STATIC:
        h = h.replace('href="assets/%s"' % f, 'href="%s"' % f).replace('src="assets/%s"' % f, 'src="%s"' % f)
    if "assets/" in h: sys.exit("sobrou referência a assets/ no build")
    soltos = sorted(set(os.listdir(os.path.join(RAIZ, "js"))) - {u[3:] for u in usados})
    if soltos: sys.exit("js/ fora do index.html: " + ", ".join(soltos))
    return h, usados

if __name__ == "__main__":
    h, usados = montar()
    os.makedirs(os.path.join(RAIZ, "dist"), exist_ok=True)
    with open(os.path.join(RAIZ, "dist", "index.html"), "w", encoding="utf-8", newline="") as f:
        f.write(h)
    print("dist/index.html: %d módulos, %d bytes" % (len(usados), len(h.encode("utf-8"))))
