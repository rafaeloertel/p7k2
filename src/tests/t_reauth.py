"""Bancada da v0.16.3 — senha da Microsoft depois que a trava apaga o código.

Usa o supabase.js de verdade, com toda a rede do Supabase respondida aqui (nada sai do contêiner).
A prova é a URL do /auth/v1/authorize: com expulsão, leva prompt=login; sem expulsão, não leva.
Celular 390x844 com toque; conta e dados fictícios. Uso: python3 -I tests/t_reauth.py [dist/flat]
"""
import base64, functools, http.server, json, os, sys, threading, time
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "dist", "flat")
SB = "https://jglagrayubmcupmnobfe.supabase.co"
EMAIL = "teste@exemplo.com"
PIN_OK = "258147"

def jwt():
    b = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
    return b({"alg": "HS256", "typ": "JWT"}) + "." + b({"sub": "00000000-0000-0000-0000-000000000001", "email": EMAIL, "exp": int(time.time()) + 86400, "role": "authenticated"}) + ".x"

def sessao():
    t = int(time.time())
    return {"access_token": jwt(), "token_type": "bearer", "expires_in": 86400, "expires_at": t + 86400, "refresh_token": "r-ficticio",
            "user": {"id": "00000000-0000-0000-0000-000000000001", "aud": "authenticated", "role": "authenticated", "email": EMAIL,
                     "app_metadata": {"provider": "azure"}, "user_metadata": {"email": EMAIL}, "created_at": "2026-01-01T00:00:00Z"}}

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

def main():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=PASTA))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d/" % srv.server_port
    autorizes, erros, res = [], [], []
    def ok(nome, cond, extra=""):
        res.append(bool(cond)); print(("OK   " if cond else "FALHA") + " " + nome + (("  — " + str(extra)) if extra else ""))

    def rede(route):
        u = route.request.url; p = urlparse(u).path; m = route.request.method
        if p.startswith("/auth/v1/authorize"):
            autorizes.append(u); return route.fulfill(status=200, content_type="text/html", body="<p>Microsoft (falsa)</p>")
        if p.startswith("/auth/v1/logout"): return route.fulfill(status=204, body="")
        if p.startswith("/auth/v1/"): return route.fulfill(status=200, content_type="application/json", body="{}")
        if p.startswith("/rest/v1/docs"):
            if m == "GET": return route.fulfill(status=200, content_type="application/json", body="[]")
            return route.fulfill(status=201 if m == "POST" else 200, content_type="application/json", body='[{"rev":1}]')
        if p.startswith("/storage/"): return route.fulfill(status=200, content_type="application/json", body="[]")
        return route.fulfill(status=404, body="")

    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers="block")
        ctx.route(SB + "/**", rede)
        ctx.route("https://cdnjs.cloudflare.com/**", cdn)
        ctx.route("https://fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
        ctx.route("https://fonts.gstatic.com/**", lambda r: r.abort())
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: erros.append(str(e)))

        def abrir():
            pg.goto(url); pg.wait_for_timeout(900)
        def entrar_sessao():
            """simula a volta do OAuth: a sessão aparece no armazenamento e a página recarrega"""
            pg.evaluate("s => localStorage.setItem('erp.rafael.sb', JSON.stringify(s))", sessao()); abrir()
        def clicar_entrar():
            n = len(autorizes); pg.click("[data-g=in]"); pg.wait_for_timeout(700)
            return autorizes[n] if len(autorizes) > n else None
        def prompt(u):
            return (parse_qs(urlparse(u).query).get("prompt") or [None])[0] if u else "SEM-URL"
        def reauth():
            return pg.evaluate("localStorage.getItem('erp.rafael.reauth')")
        def digitar(cod):
            for d in cod: pg.click(".pin-pad button[data-k='%s']" % d); pg.wait_for_timeout(40)
            pg.wait_for_timeout(1500)  # PBKDF2 150 mil voltas
        def criar_codigo():
            digitar(PIN_OK); digitar(PIN_OK)
            if pg.locator("#pinBioNao").count(): pg.click("#pinBioNao"); pg.wait_for_timeout(300)

        # 1. login comum
        abrir()
        ok("sem sessão, mostra a tela Entrar", pg.locator("[data-g=in]").count() == 1)
        u = clicar_entrar()
        ok("login comum chega ao authorize do provedor azure", u and parse_qs(urlparse(u).query).get("provider") == ["azure"], u and u[:90])
        ok("login comum NÃO força a senha", prompt(u) is None, prompt(u))
        ok("redirect de volta para o próprio endereço", u and parse_qs(urlparse(u).query).get("redirect_to", [""])[0].startswith(url))

        # 2. entra, cria o código, trava, Esqueci o código
        abrir(); entrar_sessao()
        ok("celular: pede para criar o código", pg.locator(".pin-pad").count() == 1 and "Criar" in pg.inner_text(".pin-card"))
        criar_codigo()
        ok("código criado, Hub liberado", not pg.evaluate("document.body.classList.contains('pin-travado')"))
        ok("rodapé mostra v0.16.3", "v0.16.3" in pg.inner_text("#brandVer"), pg.inner_text("#brandVer"))
        abrir()
        ok("ao reabrir, o Hub fica travado", pg.locator("#pinEsqueci").count() == 1)
        ok("sem marca de reauth antes da expulsão", reauth() is None, reauth())
        pg.click("#pinEsqueci"); pg.wait_for_timeout(1200)
        ok("Esqueci o código grava a marca reauth", reauth() == "true", reauth())
        ok("Esqueci o código encerra a sessão", pg.evaluate("localStorage.getItem('erp.rafael.sb')") is None)
        ok("Esqueci o código apaga o código", pg.evaluate("localStorage.getItem('erp.rafael.pin.%s')" % EMAIL) is None)
        ok("volta para a tela Entrar", pg.locator("[data-g=in]").count() == 1)
        u = clicar_entrar()
        ok("login depois da expulsão vai com prompt=login", prompt(u) == "login", u and u[:160])

        # 3. entrar limpa a marca; o login seguinte volta ao normal
        abrir(); entrar_sessao()
        ok("sessão aceita apaga a marca reauth", reauth() is None, reauth())
        criar_codigo()
        pg.evaluate("ERP.Cloud.logout()"); pg.wait_for_timeout(1200)
        u = clicar_entrar()
        ok("Sair da Conta comum: login seguinte sem prompt", prompt(u) is None, prompt(u))

        # 4. Sair da conta na tela travada também marca
        abrir(); entrar_sessao(); abrir()
        ok("travado de novo", pg.locator("#pinSair").count() == 1)
        pg.click("#pinSair"); pg.wait_for_timeout(1200)
        ok("Sair da conta (tela travada) grava a marca", reauth() == "true")
        u = clicar_entrar()
        ok("e o login seguinte vai com prompt=login", prompt(u) == "login")

        # 5. cinco erros também marcam
        abrir(); entrar_sessao(); criar_codigo(); abrir()
        for i in range(5):
            if pg.locator(".pin-pad").count() == 0: break
            digitar("135790")
        pg.wait_for_timeout(1200)
        ok("cinco erros: marca gravada e sessão encerrada", reauth() == "true" and pg.evaluate("localStorage.getItem('erp.rafael.sb')") is None)
        u = clicar_entrar()
        ok("login depois dos cinco erros vai com prompt=login", prompt(u) == "login")

        ok("390 px sem rolagem lateral", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        ok("nenhum erro de JavaScript", not erros, erros[:3])
        b.close()
    srv.shutdown()
    print("\n%d/%d" % (sum(res), len(res)))
    sys.exit(0 if all(res) else 1)

main()
