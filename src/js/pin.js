/* Trava do app no celular: código de 6 dígitos + Face ID / biometria do aparelho.
   Portado do ERP NMB (v0.14.87 e v0.14.88) e adaptado ao Hub (Supabase no lugar do MSAL).

   O que ela é: uma trava de tela do aplicativo, feita no navegador, para o caso de
   perder o celular desbloqueado. O que ela NÃO é: segurança da conta. Em caso de roubo,
   o primeiro passo continua sendo encerrar as sessões da conta Microsoft e apagar o
   aparelho à distância. O código vale por aparelho e nunca sai dele. */
(function () {
  "use strict";
  const { $, $$, esc } = ERP;
  const lsGet = ERP.lsGet, lsSet = ERP.lsSet;

  const MINUTOS = 5;                 /* tempo fora da tela que faz travar de novo */
  const ESPERA = MINUTOS * 60 * 1000;
  const ERROS_MAX = 5;
  const VOLTAS = 150000;             /* PBKDF2-SHA-256 */
  const DIGITOS = 6;

  const PIN = (ERP.PIN = {
    travado: false,
    modo: null,        /* criar | confirmar | bio | travado | atual | null */
    buf: "",
    primeiro: "",      /* primeira digitação, na criação */
    erros: 0,
    email: "",
    motivo: "",        /* por que a biometria não ativou */
    aviso: "",
    forcar: null,      /* bancada: força considerar celular (true) ou não (false) */
    escondidoEm: 0,
  });

  /* ---------- utilidades ---------- */
  const b64e = (u8) => btoa(String.fromCharCode.apply(null, Array.from(u8)));
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  function ehCelular() {
    if (PIN.forcar != null) return !!PIN.forcar;
    const toque = (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
    const s = window.screen || {};
    const lado = Math.min(s.width || window.innerWidth, s.height || window.innerHeight);
    return toque && lado <= 820;
  }
  PIN.ehCelular = ehCelular;

  const chave = (email) => "pin." + String(email || "").toLowerCase();
  const ler = (email) => lsGet(chave(email), null);
  const gravar = (email, v) => lsSet(chave(email), v);
  const apagar = (email) => { try { localStorage.removeItem("erp.rafael." + chave(email)); } catch (e) {} };

  PIN.temCodigo = (email) => !!ler(email || PIN.email);
  PIN.temBio = (email) => { const r = ler(email || PIN.email); return !!(r && r.bio && r.bio.id); };
  PIN.dispensado = () => !!lsGet("pin.dispensado", false);

  /* códigos óbvios: seis iguais, sequência crescente ou decrescente */
  function obvio(c) {
    if (/^(\d)\1{5}$/.test(c)) return true;
    let sobe = true, desce = true;
    for (let i = 1; i < c.length; i++) {
      if (+c[i] !== +c[i - 1] + 1) sobe = false;
      if (+c[i] !== +c[i - 1] - 1) desce = false;
    }
    return sobe || desce;
  }
  PIN._obvio = obvio;

  async function derivar(codigo, saltB64, voltas) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(codigo), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: b64d(saltB64), iterations: voltas, hash: "SHA-256" }, base, 256);
    return b64e(new Uint8Array(bits));
  }

  async function guardarCodigo(email, codigo, bio) {
    const salt = b64e(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derivar(codigo, salt, VOLTAS);
    gravar(email, { salt, hash, voltas: VOLTAS, bio: bio || null, criado: new Date().toISOString() });
  }

  async function confere(email, codigo) {
    const r = ler(email); if (!r) return false;
    const h = await derivar(codigo, r.salt, r.voltas || VOLTAS);
    /* comparação de tempo constante */
    if (h.length !== r.hash.length) return false;
    let d = 0; for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ r.hash.charCodeAt(i);
    return d === 0;
  }
  PIN._confere = confere;

  /* ---------- biometria (WebAuthn, autenticador do próprio aparelho) ---------- */
  async function bioDisponivel() {
    try {
      if (!window.PublicKeyCredential || !navigator.credentials) return false;
      if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) { return false; }
  }
  PIN.bioDisponivel = bioDisponivel;

  function motivoDe(e) {
    const n = (e && e.name) || "";
    if (n === "NotAllowedError") return "O aparelho recusou ou a operação foi cancelada. No iPhone, confira em Ajustes › [seu nome] › iCloud › Senhas e Chaves se está ligado, e se o Face ID está ativo para o Safari.";
    if (n === "NotSupportedError" || n === "AbortError") return "Este aparelho ou navegador não oferece Face ID / digital para sites.";
    if (n === "SecurityError") return "O endereço aberto não confere com o do Hub. Abra pelo atalho do Hub, em https.";
    if (n === "InvalidStateError") return "Já existe uma chave deste aparelho para o Hub. Apague a chave antiga nas senhas do aparelho e tente de novo.";
    if (n === "ConstraintError") return "O aparelho não conseguiu exigir a verificação do usuário (Face ID, Touch ID ou senha do aparelho).";
    return "Não foi possível ativar agora" + (n ? " (" + n + ")" : "") + ".";
  }

  async function bioCriar(email) {
    const enc = new TextEncoder();
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Hub", id: location.hostname },
        user: { id: enc.encode(("u-" + email).slice(0, 64)), name: email, displayName: email },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60000,
        attestation: "none",
      },
    });
    if (!cred) throw new Error("sem credencial");
    return { id: b64e(new Uint8Array(cred.rawId)), em: new Date().toISOString() };
  }

  async function bioUsar(email) {
    const r = ler(email);
    if (!r || !r.bio || !r.bio.id) throw new Error("sem biometria");
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: b64d(r.bio.id), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    if (!cred) throw new Error("sem resposta");
    return true;
  }

  /* Ativar a biometria a qualquer hora, sem trocar o código (v0.14.88 do ERP). */
  PIN.ativarBio = async function () {
    const email = PIN.email || (ERP.Cloud.email && ERP.Cloud.email()) || "";
    const r = ler(email);
    if (!r) { ERP.toast("Crie o código de acesso primeiro."); return false; }
    if (!(await bioDisponivel())) { PIN.motivo = "Este aparelho ou navegador não oferece Face ID / digital para sites."; ERP.toast(PIN.motivo); return false; }
    try {
      const bio = await bioCriar(email);
      r.bio = bio; gravar(email, r); PIN.motivo = "";
      ERP.toast("Face ID ativado neste aparelho.");
      ERP.render();
      return true;
    } catch (e) {
      PIN.motivo = motivoDe(e);
      ERP.toast(PIN.motivo);
      ERP.render();
      return false;
    }
  };

  PIN.removerBio = function () {
    const email = PIN.email || (ERP.Cloud.email && ERP.Cloud.email()) || "";
    const r = ler(email); if (!r) return;
    r.bio = null; gravar(email, r); PIN.motivo = "";
    ERP.toast("Face ID desativado neste aparelho."); ERP.render();
  };

  /* ---------- tela ---------- */
  function caixa() {
    let el = $("#pinTela");
    if (!el) {
      el = document.createElement("div");
      el.id = "pinTela";
      el.className = "pin";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      document.body.appendChild(el);
    }
    return el;
  }

  const TEXTOS = {
    criar: ["Criar o código de acesso", "Seis números que destravam o Hub neste aparelho."],
    confirmar: ["Repita o código", "Digite os mesmos seis números."],
    atual: ["Código atual", "Digite o código que você usa hoje."],
    travado: ["Hub bloqueado", ""],
    bio: ["Usar o Face ID?", "Assim você destrava sem digitar o código. O código continua valendo como reserva."],
  };

  function desenhar() {
    const el = caixa();
    const m = PIN.modo;
    if (!m) { el.hidden = true; document.body.classList.remove("pin-travado"); return; }
    el.hidden = false;
    document.body.classList.add("pin-travado");

    const marca = (($(".brand .mono svg") || {}).outerHTML) || "";
    const t = TEXTOS[m] || ["", ""];

    if (m === "bio") {
      el.innerHTML = `<div class="pin-card">
        <span class="pin-mono">${marca}</span>
        <h1>${t[0]}</h1><p>${t[1]}</p>
        ${PIN.motivo ? `<p class="pin-motivo">${esc(PIN.motivo)}</p>` : ""}
        <div class="pin-act">
          <button class="btn orange lg" id="pinBioSim">Ativar Face ID</button>
          <button class="btn ghost lg" id="pinBioNao">Agora Não</button>
        </div></div>`;
      $("#pinBioSim", el).onclick = async () => {
        const bt = $("#pinBioSim", el); bt.disabled = true; bt.textContent = "Aguardando o aparelho…";
        const ok = await PIN.ativarBio();
        if (ok) PIN.liberar(); else desenhar();
      };
      $("#pinBioNao", el).onclick = () => PIN.liberar();
      return;
    }

    const pontos = Array.from({ length: DIGITOS }, (_, i) => `<i class="${i < PIN.buf.length ? "on" : ""}"></i>`).join("");
    const bio = m === "travado" && PIN.temBio();
    const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", bio ? "bio" : "", "0", "apagar"];

    el.innerHTML = `<div class="pin-card">
      <span class="pin-mono">${marca}</span>
      <h1>${t[0]}</h1>${t[1] ? `<p>${t[1]}</p>` : ""}
      <div class="pin-dots" aria-hidden="true">${pontos}</div>
      <p class="pin-aviso" role="status">${esc(PIN.aviso || "")}</p>
      <div class="pin-pad">${teclas.map((k) => {
        if (k === "") return `<span></span>`;
        if (k === "bio") return `<button type="button" data-k="bio" aria-label="Usar o Face ID">${ERP.ic ? ERP.ic("user", 22) : ""}<small>Face ID</small></button>`;
        if (k === "apagar") return `<button type="button" data-k="apagar" aria-label="Apagar o último número">←</button>`;
        return `<button type="button" data-k="${k}">${k}</button>`;
      }).join("")}</div>
      <div class="pin-foot">${m === "travado"
        ? `<button class="lnk" id="pinEsqueci">Esqueci o código</button><button class="lnk" id="pinSair">Sair da conta</button>`
        : `<button class="lnk" id="pinCancelar">Cancelar</button>`}</div>
    </div>`;

    $$(".pin-pad button", el).forEach((b) => (b.onclick = () => tecla(b.dataset.k)));
    const es = $("#pinEsqueci", el); if (es) es.onclick = () => PIN.expulsar("Código apagado. Entre de novo com a sua conta Microsoft.");
    const sa = $("#pinSair", el); if (sa) sa.onclick = () => PIN.expulsar("");
    const ca = $("#pinCancelar", el); if (ca) ca.onclick = () => PIN.cancelar();
  }
  PIN.desenhar = desenhar;

  function tecla(k) {
    if (k === "bio") { tentarBio(); return; }
    if (k === "apagar") { PIN.buf = PIN.buf.slice(0, -1); PIN.aviso = ""; desenhar(); return; }
    if (!/^\d$/.test(k) || PIN.buf.length >= DIGITOS) return;
    PIN.buf += k; PIN.aviso = ""; desenhar();
    if (PIN.buf.length === DIGITOS) setTimeout(completo, 120);
  }
  PIN.tecla = tecla;

  async function completo() {
    const c = PIN.buf;
    if (PIN.modo === "criar") {
      if (obvio(c)) { PIN.buf = ""; PIN.aviso = "Esse código é fácil demais. Evite números iguais ou em sequência."; desenhar(); return; }
      PIN.primeiro = c; PIN.buf = ""; PIN.modo = "confirmar"; PIN.aviso = ""; desenhar(); return;
    }
    if (PIN.modo === "confirmar") {
      if (c !== PIN.primeiro) { PIN.buf = ""; PIN.primeiro = ""; PIN.modo = "criar"; PIN.aviso = "Os códigos não bateram. Comece de novo."; desenhar(); return; }
      await guardarCodigo(PIN.email, c, ler(PIN.email) && ler(PIN.email).bio);
      PIN.buf = ""; PIN.primeiro = ""; PIN.aviso = "";
      try { lsSet("pin.dispensado", false); } catch (e) {}
      if (!PIN.temBio() && (await bioDisponivel())) { PIN.modo = "bio"; desenhar(); }
      else { ERP.toast("Código de acesso criado."); PIN.liberar(); }
      return;
    }
    if (PIN.modo === "atual") {
      if (!(await confere(PIN.email, c))) { PIN.buf = ""; PIN.aviso = "Código errado."; desenhar(); return; }
      PIN.buf = ""; PIN.modo = "criar"; PIN.aviso = ""; desenhar(); return;
    }
    if (PIN.modo === "travado") {
      if (await confere(PIN.email, c)) { PIN.erros = 0; PIN.buf = ""; PIN.aviso = ""; PIN.liberar(); return; }
      PIN.erros++; PIN.buf = "";
      const resta = ERROS_MAX - PIN.erros;
      if (resta <= 0) { PIN.expulsar("Cinco erros seguidos: o código foi apagado e a conta foi desconectada neste aparelho."); return; }
      PIN.aviso = resta === 1 ? "Código errado. Resta 1 tentativa antes de a conta sair deste aparelho." : `Código errado. Restam ${resta} tentativas.`;
      desenhar();
    }
  }

  async function tentarBio() {
    try { await bioUsar(PIN.email); PIN.erros = 0; PIN.buf = ""; PIN.aviso = ""; PIN.liberar(); }
    catch (e) { PIN.aviso = "Face ID não confirmou. Use o código."; desenhar(); }
  }

  /* ---------- entradas e saídas ---------- */
  PIN.travar = function () {
    if (!PIN.email || !PIN.temCodigo()) return false;
    PIN.travado = true; PIN.modo = "travado"; PIN.buf = ""; PIN.aviso = "";
    desenhar();
    if (PIN.temBio()) setTimeout(() => { if (PIN.modo === "travado") tentarBio(); }, 250);
    return true;
  };

  PIN.liberar = function () {
    PIN.travado = false; PIN.modo = null; PIN.buf = ""; PIN.primeiro = "";
    document.body.classList.remove("pin-travado");
    const el = $("#pinTela"); if (el) el.hidden = true;
    PIN.escondidoEm = 0;
  };

  PIN.cancelar = function () {
    /* cancelar só existe fora da trava: volta ao app sem mudar nada */
    PIN.buf = ""; PIN.primeiro = ""; PIN.aviso = "";
    if (PIN.travado) { PIN.modo = "travado"; desenhar(); return; }
    PIN.liberar(); ERP.render();
  };

  PIN.expulsar = function (msg) {
    apagar(PIN.email);
    /* o próximo "Entrar com Microsoft" tem de pedir a senha: sair do app não desloga a conta no Safari */
    lsSet("reauth", true);
    PIN.liberar(); PIN.erros = 0;
    if (msg) { try { ERP.toast(msg); } catch (e) {} }
    try { ERP.Cloud.logout(); } catch (e) { location.reload(); }
  };

  /* chamado pelo núcleo assim que a sessão é aceita, antes de a tela do app aparecer */
  PIN.aoEntrar = function (email) {
    PIN.email = String(email || "").toLowerCase();
    if (!ehCelular() || !PIN.email) return;
    if (PIN.temCodigo()) { PIN.travar(); return; }
    if (PIN.dispensado()) return;
    PIN.modo = "criar"; PIN.buf = ""; PIN.primeiro = ""; PIN.aviso = "";
    desenhar();
  };

  /* pedir a criação de propósito (botão em Sistema) */
  PIN.criar = function () {
    PIN.email = PIN.email || (ERP.Cloud.email && ERP.Cloud.email()) || "";
    if (!PIN.email) { ERP.toast("Entre com a sua conta primeiro."); return; }
    PIN.modo = "criar"; PIN.buf = ""; PIN.primeiro = ""; PIN.aviso = ""; desenhar();
  };

  PIN.trocar = function () {
    PIN.email = PIN.email || (ERP.Cloud.email && ERP.Cloud.email()) || "";
    if (!PIN.temCodigo()) { PIN.criar(); return; }
    PIN.modo = "atual"; PIN.buf = ""; PIN.primeiro = ""; PIN.aviso = ""; desenhar();
  };

  PIN.remover = async function () {
    if (!(await ERP.confirm("Remover o código de acesso deste aparelho? Quem pegar o celular desbloqueado passa a abrir o Hub direto.", "Remover"))) return;
    apagar(PIN.email); lsSet("pin.dispensado", true);
    ERP.toast("Código removido neste aparelho."); ERP.render();
  };

  /* trava de novo depois de MINUTOS fora da tela */
  document.addEventListener("visibilitychange", () => {
    if (!PIN.email || !PIN.temCodigo() || !ehCelular()) return;
    if (document.visibilityState === "hidden") { PIN.escondidoEm = Date.now(); return; }
    if (PIN.travado) return;
    if (PIN.escondidoEm && Date.now() - PIN.escondidoEm > ESPERA) PIN.travar();
    PIN.escondidoEm = 0;
  });

  PIN.MINUTOS = MINUTOS;
  PIN.ERROS_MAX = ERROS_MAX;
})();

