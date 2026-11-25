"""Regressão de telas do Hub: abre todas as páginas registradas, com o exemplo de Finanças carregado,
em computador (1280) e celular (390), claro e escuro. Falha com erro de JS, tela vazia ou rolagem lateral no celular.
Sessão e banco falsos (nada sai do contêiner). Uso: python3 -I tests/t_telas.py [dist/flat] [pasta-de-prints]
"""
import functools, http.server, json, os, sys, threading
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "dist", "flat")
PRINTS = sys.argv[2] if len(sys.argv) > 2 else None
import importlib.util
spec = importlib.util.spec_from_file_location("ra", os.path.join(RAIZ, "tests", "t_reauth.py"))
SB = "https://jglagrayubmcupmnobfe.supabase.co"

def sessao():
    import base64, time
    b = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
    t = int(time.time()); uid = "00000000-0000-0000-0000-000000000001"
    tok = b({"alg": "HS256"}) + "." + b({"sub": uid, "email": "teste@exemplo.com", "exp": t + 86400}) + ".x"
    return {"access_token": tok, "token_type": "bearer", "expires_in": 86400, "expires_at": t + 86400, "refresh_token": "r",
            "user": {"id": uid, "aud": "authenticated", "email": "teste@exemplo.com", "app_metadata": {"provider": "azure"}, "user_metadata": {}}}

def rede(route):
    from urllib.parse import urlparse
    p = urlparse(route.request.url).path; m = route.request.method
    if p.startswith("/rest/v1/docs"):
        return route.fulfill(status=200 if m == "GET" else 201, content_type="application/json", body="[]" if m == "GET" else '[{"rev":1}]')
    return route.fulfill(status=200, content_type="application/json", body="[]" if p.startswith("/storage") else "{}")

# Chart.js de verdade (npm install chart.js@4.4.1 chartjs-plugin-datalabels@2.2.0 em HUB_VENDOR):
# um Chart falso esconde erro de tela — foi o que aconteceu na primeira rodada desta bancada.
VENDOR = os.environ.get("HUB_VENDOR", "/home/claude/vendor") + "/node_modules/"
def cdn(route):
    u = route.request.url
    f = "chart.js/dist/chart.umd.js" if "chart.umd" in u else "chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.min.js" if "datalabels" in u else None
    if not f or not os.path.exists(VENDOR + f): sys.exit("Chart.js local não encontrado em " + VENDOR + " (ver cabeçalho)")
    route.fulfill(status=200, content_type="application/javascript", body=open(VENDOR + f, encoding="utf-8").read())

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=PASTA))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:%d/" % srv.server_port
falhas, total = [], 0
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for nome, vp, cel in [("computador", (1280, 860), False), ("celular", (390, 844), True)]:
        for tema in ["light", "dark"]:
            ctx = b.new_context(viewport={"width": vp[0], "height": vp[1]}, is_mobile=cel, has_touch=cel, service_workers="block")
            ctx.route(SB + "/**", rede)
            ctx.route("https://cdnjs.cloudflare.com/**", cdn)
            ctx.route("https://fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
            ctx.route("https://fonts.gstatic.com/**", lambda r: r.abort())
            pg = ctx.new_page(); erros = []
            pg.on("pageerror", lambda e: erros.append(str(e)))
            pg.goto(URL); pg.wait_for_timeout(500)
            pg.evaluate("([s,t]) => { localStorage.setItem('erp.rafael.sb', JSON.stringify(s)); localStorage.setItem('erp.rafael.theme', JSON.stringify(t)); localStorage.setItem('erp.rafael.pin.dispensado','true'); }", [sessao(), tema])
            pg.goto(URL); pg.wait_for_timeout(1200)
            pg.evaluate("() => { if (ERP.finExemplo) ERP.finExemplo(); }"); pg.wait_for_timeout(400)
            rotas = pg.evaluate("() => ERP.modules.flatMap(m => (m.pages && m.pages.length) ? m.pages.map(p => m.id + '/' + p.id) : [m.id])")
            for r in rotas:
                total += 1; n0 = len(erros)
                pg.evaluate("r => { location.hash = '#/' + r; }", r); pg.wait_for_timeout(350)
                txt = len(pg.inner_text("#main").strip())
                lat = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
                prob = []
                if len(erros) > n0: prob.append("JS: " + erros[-1][:120])
                if txt < 20: prob.append("tela vazia")
                faixa = pg.evaluate("() => /Não foi possível abrir esta tela/.test(document.querySelector('#main').innerText)")
                if faixa: prob.append("faixa de erro: " + pg.inner_text("#main")[:120].replace("\n", " "))
                if cel and lat > 1: prob.append("rolagem lateral %dpx" % lat)
                if prob: falhas.append("%s/%s %s: %s" % (nome, tema, r, "; ".join(prob)))
                if PRINTS and tema == "light":
                    os.makedirs(PRINTS, exist_ok=True); pg.screenshot(path=os.path.join(PRINTS, "%s-%s.png" % (nome, r.replace("/", "_"))))
            print("%s %s: %d telas" % (nome, tema, len(rotas)))
            ctx.close()
    b.close()
srv.shutdown()
for f in falhas: print("FALHA", f)
print("\n%d/%d telas sem problema" % (total - len(falhas), total))
sys.exit(1 if falhas else 0)
