/* Hub — núcleo: utilitários, armazenamento (local + Supabase), login Microsoft, shell, rotas, modais */
(function () {
  "use strict";
  const ERP = (window.ERP = { version: "v0.16.3", modules: [], defaults: {}, cfg: {} });

  /* ---------- utilitários ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const p2 = (n) => String(n).padStart(2, "0");
  const uid = (p) => (p || "id") + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const usd = (v) => Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const num = (v, d) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  const pct = (v) => (v >= 0 ? "+" : "") + num(v, 2) + "%";
  const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
  const fdate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "");
  const monthKey = (iso) => String(iso || "").slice(0, 7);
  const monthLabel = (mk) => { const [y, m] = mk.split("-"); return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m - 1] + "/" + y.slice(2); };
  const addMonths = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(y, m - 1 + n, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return t.getFullYear() + "-" + p2(t.getMonth() + 1) + "-" + p2(Math.min(d, last)); };
  const parseNum = (s) => { if (typeof s === "number") return s; s = String(s || "").trim().replace(/[^\d,.\-]/g, ""); if (!s) return 0; if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); return Number(s) || 0; };
  Object.assign(ERP, { $, $$, esc, uid, brl, usd, num, pct, todayISO, fdate, monthKey, monthLabel, addMonths, parseNum, p2 });

  function toast(msg, ms) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }
  ERP.toast = toast;

  /* ---------- modal e formulário ---------- */
  function modal(html, opt) {
    opt = opt || {};
    const ov = document.createElement("div"); ov.className = "ov";
    ov.innerHTML = `<div class="modal${opt.wide ? " wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    function close() { document.removeEventListener("keydown", onKey); ov.remove(); }
    document.body.appendChild(ov); if (ERP.iconify) ERP.iconify(ov);
    const f = $("input,select,textarea", ov); if (f && !opt.noFocus) f.focus();
    return { el: ov, close };
  }
  ERP.modal = modal;

  function confirmBox(msg, okLabel) {
    return new Promise((res) => {
      const m = modal(`<h2>Confirmar</h2><p>${esc(msg)}</p><div class="act"><span class="sp"></span><button class="btn ghost" data-n>Cancelar</button><button class="btn orange" data-y>${esc(okLabel || "Confirmar")}</button></div>`, { noFocus: true });
      $("[data-n]", m.el).onclick = () => { m.close(); res(false); };
      $("[data-y]", m.el).onclick = () => { m.close(); res(true); };
    });
  }
  ERP.confirm = confirmBox;

  /* fields: [{k,label,type:text|number|date|month|select|textarea|checkbox|html,options:[[v,label]],value,full,required,step,placeholder,hint,html}]
     opt.init(fm, modal) roda depois de montar (campos dependentes); opt.extra = botões extras [{label, fn}] */
  const isMoney = (f) => f.type === "number" && f.money !== false && (f.money === true || (/R\$/.test(f.label || "") && !/US\$|%/.test(f.label || "") && !/por US/.test(f.label || "")) || (f.step === "0.01" && !/%|US\$/.test(f.label || "")));
  const moneyInit = (root) => $$("input[data-money]", root).forEach((el) => {
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value"), fmt = (t) => (String(t).trim() === "" ? "" : (el.dataset.cur === "USD" ? usd : brl)(parseNum(t)));
    Object.defineProperty(el, "value", { configurable: true, get() { return d.get.call(this); }, set(x) { d.set.call(this, document.activeElement === this ? String(x == null ? "" : x).replace(".", ",") : fmt(x == null ? "" : x)); } });
    el.addEventListener("focus", () => { const n = parseNum(d.get.call(el)); d.set.call(el, n ? String(n).replace(".", ",") : ""); el.select(); setTimeout(() => el.select(), 0); });
    el.addEventListener("blur", () => { d.set.call(el, fmt(d.get.call(el))); });
    el._refmt = () => { if (document.activeElement !== el) d.set.call(el, fmt(d.get.call(el))); };
  });
  ERP.moneyCur = (el, cur) => { if (!el) return; el.dataset.cur = cur === "USD" ? "USD" : "BRL"; el.placeholder = cur === "USD" ? "US$ 0.00" : "R$ 0,00"; if (el._refmt) el._refmt(); };
  function form(opt) {
    const fl = opt.fields.map((f) => {
      if (f.type === "html") return `<div class="f full" data-fk="${esc(f.k || "")}">${f.html || ""}</div>`;
      const id = "f_" + f.k; const v = f.value == null ? "" : f.value; let inp;
      if (f.type === "select") inp = `<select id="${id}" name="${f.k}"${f.creatable ? ` data-new="${esc(f.creatable)}"` : ""}>${(f.options || []).map((o) => o[0] === "__grp" ? `<optgroup label="${esc(o[1])}"></optgroup>` : `<option value="${esc(o[0])}"${String(o[0]) === String(v) ? " selected" : ""}${o[2] ? ` data-desc="${esc(o[2])}"` : ""}>${esc(o[1])}</option>`).join("")}</select>`;
      else if (f.type === "textarea") inp = `<textarea id="${id}" name="${f.k}" rows="3">${esc(v)}</textarea>`;
      else if (f.type === "checkbox") inp = `<input id="${id}" name="${f.k}" type="checkbox" ${v ? "checked" : ""} style="width:20px;height:20px">`;
      else if (isMoney(f)) inp = `<input id="${id}" name="${f.k}" type="text" inputmode="decimal" autocomplete="off" data-money value="${v === "" ? "" : esc(brl(parseNum(v)))}" placeholder="R$ 0,00" ${f.required ? "required" : ""}>`;
      else inp = `<input id="${id}" name="${f.k}" type="${f.type || "text"}" value="${esc(v)}" ${f.step ? `step="${f.step}"` : ""} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""} ${f.required ? "required" : ""} ${f.type === "number" ? 'inputmode="decimal"' : ""}>`;
      return `<div class="f${f.full ? " full" : ""}" data-fk="${esc(f.k)}"><label for="${id}">${esc(f.label)}</label>${inp}${f.hint ? `<small class="mut" style="font-size:11.5px">${f.hint}</small>` : ""}</div>`;
    }).join("");
    const m = modal(`<h2>${esc(opt.title)}</h2>${opt.intro ? `<p class="mut" style="margin-bottom:12px">${opt.intro}</p>` : ""}<form novalidate><div class="fg">${fl}</div><div class="act">${opt.onDelete ? `<button type="button" class="btn danger" data-del>${esc(opt.deleteLabel || "Excluir")}</button>` : ""}${(opt.extra || []).map((x, i) => `<button type="button" class="btn ghost" data-extra="${i}">${esc(x.label)}</button>`).join("")}<span class="sp"></span><button type="button" class="btn ghost" data-cancel>Cancelar</button><button class="btn orange">${esc(opt.okLabel || "Salvar")}</button></div></form>`, { wide: opt.wide });
    const fm = $("form", m.el); moneyInit(m.el);
    const read = () => { const v = {}; opt.fields.forEach((f) => { if (f.type === "html") return; const el = fm.elements[f.k]; if (!el) return; v[f.k] = f.type === "checkbox" ? el.checked : f.type === "number" ? parseNum(el.value) : el.value; }); return v; };
    $("[data-cancel]", m.el).onclick = m.close;
    if (opt.onDelete) $("[data-del]", m.el).onclick = async () => { if (opt.deleteNoConfirm || await confirmBox(opt.deleteConfirm || "Excluir este registro?", opt.deleteLabel || "Excluir")) { m.close(); opt.onDelete(); } };
    (opt.extra || []).forEach((x, i) => { $(`[data-extra="${i}"]`, m.el).onclick = () => x.fn(read(), m); });
    fm.onsubmit = (e) => { e.preventDefault(); if (opt.onSubmit(read(), m) !== false) m.close(); };
    m.read = read; m.show = (k, on) => { const el = $(`[data-fk="${k}"]`, m.el); if (el) el.hidden = !on; };
    if (opt.init) opt.init(fm, m);
    return m;
  }
  ERP.form = form; ERP.creators = ERP.creators || {};
  /* Title Case pt-BR: nomes compostos com inicial maiúscula; de/da/do/e/em/com/para… ficam minúsculos; siglas (IPVA, NMB, ETF) e nomes mistos preservados. */
  ERP.tcPt = (str) => {
    const LOW = new Set("de da do das dos e ou o a os as um uma em no na nos nas com para pra por ao aos à às pelo pela pelos pelas sem sob entre".split(" "));
    const toks = String(str == null ? "" : str).split(" ");
    return toks.map((t, i) => {
      const m = t.match(/^([^0-9A-Za-zÀ-ÿ]*)([0-9A-Za-zÀ-ÿ][0-9A-Za-zÀ-ÿ'’.\-]*)?([\s\S]*)$/);
      if (!m || !m[2]) return t;
      const lead = m[1], word = m[2], rest = m[3];
      const letters = word.replace(/[^A-Za-zÀ-ÿ]/g, "");
      if (letters && letters === letters.toUpperCase() && letters.length > 1) return t;      /* sigla: IPVA, NMB, ETF */
      if (/[A-ZÀ-Ý]/.test(word.slice(1))) return t;                                            /* misto: iPhone, McData */
      const prev = i > 0 ? toks[i - 1] : "";
      const seg = i === 0 || /[\/—(·]$/.test(prev);
      const low = word.toLowerCase();
      const nw = LOW.has(low) && !seg ? low : word.charAt(0).toUpperCase() + word.slice(1);
      return lead + nw + rest;
    }).join(" ");
  };

  /* ---------- armazenamento ---------- */
  const LS = (k) => "erp.rafael." + k;
  const lsGet = (k, d) => { try { const v = localStorage.getItem(LS(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS(k), JSON.stringify(v)); return true; } catch (e) { toast("Armazenamento do navegador cheio — exporte um backup."); return false; } };
  ERP.lsGet = lsGet; ERP.lsSet = lsSet;

  const Store = (ERP.Store = {
    docs: {}, meta: {}, timers: {}, listeners: [],
    names() { return Object.keys(ERP.defaults); },
    load() {
      this.names().forEach((n) => {
        const env = lsGet("doc." + n, null);
        this.meta[n] = lsGet("meta." + n, { updatedAt: null, etag: null, dirty: false });
        this.docs[n] = env && env.data ? env.data : JSON.parse(JSON.stringify(ERP.defaults[n]));
        const def = ERP.defaults[n]; Object.keys(def).forEach((k) => { if (this.docs[n][k] === undefined) this.docs[n][k] = JSON.parse(JSON.stringify(def[k])); });
      });
    },
    get(n) { return this.docs[n]; },
    envelope(n) { return { app: "erp-rafael", doc: n, schema: 1, updatedAt: this.meta[n].updatedAt || new Date().toISOString(), data: this.docs[n] }; },
    /* aplica uma alteração e agenda a gravação (local na hora, nuvem com atraso).
       Alteração sem mudança real (ex.: abrir uma tela que "sincroniza" lembretes já em dia) não conta:
       nada fica pendente nem é enviado. Retorna true se houve mudança. */
    change(n, fn) {
      let antes = null; try { antes = JSON.stringify(this.docs[n]); } catch (e) {}
      fn(this.docs[n]);
      let depois = null; try { depois = JSON.stringify(this.docs[n]); } catch (e) {}
      if (antes !== null && antes === depois) { this.listeners.forEach((f) => f(n)); return false; }
      this.meta[n].updatedAt = new Date().toISOString(); this.meta[n].dirty = true;
      lsSet("doc." + n, this.envelope(n)); lsSet("meta." + n, this.meta[n]);
      this.listeners.forEach((f) => f(n));
      Cloud.schedule(n); return true;
    },
    replace(n, data, updatedAt) {
      this.docs[n] = data; this.meta[n].updatedAt = updatedAt || new Date().toISOString();
      lsSet("doc." + n, this.envelope(n)); lsSet("meta." + n, this.meta[n]);
      this.listeners.forEach((f) => f(n));
    },
    saveMeta(n) { lsSet("meta." + n, this.meta[n]); },
  });

  /* ---------- nuvem: Supabase (Postgres + RLS). Login Microsoft via provedor Azure do Supabase ----------
     Um registro por módulo, por usuário, na tabela public.docs (name, data, rev). A chave abaixo é pública;
     quem protege os dados é a RLS (cada conta só enxerga as próprias linhas). Concorrência por "rev":
     a gravação é condicionada ao rev que este aparelho conhece; se outro aparelho gravou antes, vira conflito
     e o Hub junta em vez de sobrescrever. Anexos ficam no Supabase Storage (bucket privado, pasta por usuário). */
  const SB_URL = "https://jglagrayubmcupmnobfe.supabase.co";
  const SB_KEY = "sb_publishable_8bWnCJoiMhPdV-jW2XDvPQ_s0UvTOcN";
  const PREFIX = "erp.rafael.";
  const BUCKET = "anexos";
  const sbClient = () => {
    if (ERP.sb) return ERP.sb;
    if (!window.supabase || !window.supabase.createClient) throw new Error("A biblioteca do Supabase não carregou.");
    ERP.sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "erp.rafael.sb" } });
    return ERP.sb;
  };

  /* ---- junção segura (nunca descarta o que só existe de um lado) ---- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const hora = (iso) => { try { const d = new Date(iso); const h = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); return d.toDateString() === new Date().toDateString() ? h : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + h; } catch (e) { return ""; } };
  const NOMES = { financas: "Finanças", reminders: "Reminders", investimentos: "Investimentos", patrimonio: "Patrimônio" };
  const nome = (n) => NOMES[n] || n;
  function semAuto(v) {
    if (Array.isArray(v)) return v.filter((x) => !(x && typeof x === "object" && x.auto === true)).map(semAuto);
    if (v && typeof v === "object") { const o = {}; Object.keys(v).sort().forEach((k) => { if (k !== "seq" && k !== "updatedAt" && k !== "dataIni") o[k] = semAuto(v[k]); }); return o; }
    return v;
  }
  const igual = (a, b) => JSON.stringify(semAuto(a)) === JSON.stringify(semAuto(b));
  function itensProprios(data, def, porChave) {
    let t = 0; if (!data || typeof data !== "object") return 0;
    Object.keys(data).forEach((k) => {
      const v = data[k], dv = def && typeof def === "object" ? def[k] : undefined;
      if (Array.isArray(v)) {
        const ids = new Set((Array.isArray(dv) ? dv : []).map((x) => x && x.id));
        const crus = new Set((Array.isArray(dv) ? dv : []).map((x) => JSON.stringify(x)));
        const c = v.filter((x) => !(x && typeof x === "object" && x.auto === true)).filter((x) => (x && typeof x === "object" && "id" in x) ? !ids.has(x.id) : !crus.has(JSON.stringify(x))).length;
        if (c) { t += c; if (porChave) porChave[k] = (porChave[k] || 0) + c; }
      } else if (v && typeof v === "object") {
        if (dv && typeof dv === "object" && !Array.isArray(dv) && !Object.keys(dv).length) { const c = Object.keys(v).length; if (c) { t += c; if (porChave) porChave[k] = (porChave[k] || 0) + c; } }
        else t += itensProprios(v, dv, porChave);
      }
    });
    return t;
  }
  const temDados = (n, data) => itensProprios(data === undefined ? Store.docs[n] : data, ERP.defaults[n]) > 0;
  function resumo(data, n) {
    const por = {}; itensProprios(data || {}, ERP.defaults[n], por);
    const ROT = { lanc: "lançamentos", contas: "contas", cartoes: "cartões", tasks: "tarefas", lists: "listas", assets: "ativos", moves: "movimentações", items: "bens", dividas: "dívidas", metas: "metas", favorecidos: "favorecidos", series: "recorrências", categorias: "categorias", snapshots: "fotos do mês" };
    return Object.keys(por).sort((a, b) => por[b] - por[a]).slice(0, 4).map((k) => { const r = ROT[k] || k; return por[k] + " " + (por[k] === 1 ? r.replace(/ões$/, "ão").replace(/s$/, "") : r); }).join(" · ") || "sem itens próprios";
  }
  function juntarItem(a, b, bMaisNovo) {
    const o = {}; const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    keys.forEach((k) => {
      if (!(k in a)) o[k] = clone(b[k]); else if (!(k in b)) o[k] = clone(a[k]);
      else if (Array.isArray(a[k]) && Array.isArray(b[k])) o[k] = juntar(a[k], b[k]);
      else if (a[k] && b[k] && typeof a[k] === "object" && typeof b[k] === "object" && !Array.isArray(a[k]) && !Array.isArray(b[k])) o[k] = juntarItem(a[k], b[k], bMaisNovo);
      else o[k] = clone(bMaisNovo ? b[k] : a[k]);
    });
    return o;
  }
  function juntar(nuvem, local) {
    if (Array.isArray(nuvem) && Array.isArray(local)) {
      const comId = (a) => a.every((x) => x && typeof x === "object" && x.id != null);
      if (comId(nuvem) && comId(local)) {
        const by = new Map(nuvem.map((x) => [String(x.id), clone(x)]));
        local.forEach((x) => { const k = String(x.id), a = by.get(k); if (!a) by.set(k, clone(x)); else by.set(k, juntarItem(a, clone(x), (x.updatedAt || 0) >= (a.updatedAt || 0))); });
        return Array.from(by.values());
      }
      const vistos = new Set(nuvem.map((x) => JSON.stringify(x))); const out = clone(nuvem);
      local.forEach((x) => { const j = JSON.stringify(x); if (!vistos.has(j)) { vistos.add(j); out.push(clone(x)); } });
      return out;
    }
    if (nuvem && local && typeof nuvem === "object" && typeof local === "object" && !Array.isArray(nuvem) && !Array.isArray(local)) {
      const o = clone(nuvem);
      Object.keys(local).forEach((k) => { if (!(k in o)) o[k] = clone(local[k]); else if (typeof o[k] === "number" && typeof local[k] === "number" && /seq|num|count/i.test(k)) o[k] = Math.max(o[k], local[k]); else o[k] = juntar(o[k], local[k]); });
      return o;
    }
    return local === undefined ? clone(nuvem) : clone(local);
  }
  ERP.syncJuntar = juntar; ERP.syncTemDados = temDados; ERP.syncResumo = resumo; ERP.syncHora = hora;

  const pendentes = () => Store.names().filter((n) => Store.meta[n] && Store.meta[n].remote);
  const sujos = () => Store.names().filter((n) => Store.meta[n] && Store.meta[n].dirty);
  const marcarSalvo = () => lsSet("sync.ultimo", new Date().toISOString());
  ERP.syncPendentes = pendentes; ERP.syncSujos = sujos;
  function baixarBackup(sufixo) {
    const docs = {}; Store.names().forEach((n) => (docs[n] = Store.get(n)));
    ERP.download(`hub-backup-${sufixo || new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "erp-rafael", version: ERP.version, savedAt: new Date().toISOString(), conta: Cloud.email(), docs }, null, 2));
  }
  /* faixa de aviso abaixo do topo: conflito aguardando escolha, sem internet, ou falha ao salvar */
  function faixa() {
    let el = $("#syncBar");
    if (!el) { el = document.createElement("div"); el.id = "syncBar"; el.setAttribute("role", "status"); const tb = $("#topbar"); if (tb && tb.parentNode) tb.parentNode.insertBefore(el, tb.nextSibling); else document.body.prepend(el); }
    let cls = "", html = "";
    if (Cloud.account && pendentes().length) { cls = "warn"; html = `<span>Há dados diferentes neste aparelho e na nuvem (${esc(pendentes().map(nome).join(", "))}). Nada é gravado até você escolher.</span><button type="button" data-sb="escolher">Escolher</button>`; }
    else if (Cloud.account && !navigator.onLine) { cls = "warn"; html = `<span>Sem internet. O que você lançar fica neste aparelho e sobe quando a conexão voltar.</span>`; }
    else if (Cloud.account && Cloud.status === "err") { cls = "err"; html = `<span>Não está salvando na nuvem. O que você lançar está só neste aparelho.</span><button type="button" data-sb="tentar">Tentar de novo</button>`; }
    el.className = cls; el.hidden = !html; el.innerHTML = html;
    const b1 = $("[data-sb=escolher]", el); if (b1) b1.onclick = () => Cloud.askConflict(pendentes());
    const b2 = $("[data-sb=tentar]", el); if (b2) b2.onclick = () => Cloud.sincronizarAgora();
  }

  const Cloud = (ERP.Cloud = {
    account: null, uid: null, status: "local", msg: "Somente neste aparelho", timers: {}, role: "anon",
    redirectUri() { return location.origin + location.pathname.replace(/index\.html$/, ""); },
    setStatus(s, m) {
      if (s === "ok" && pendentes().length) { s = "busy"; m = "Aguardando sua escolha"; }
      else if (s === "ok") { const u = lsGet("sync.ultimo", null); m = "Salvo na nuvem" + (u ? " · " + hora(u) : ""); }
      else if (s === "busy" && !m) m = "Alterações pendentes…";
      this.status = s; this.msg = m;
      $$("#navOut,#mOut").forEach((e) => (e.hidden = !this.account));
      $$(".sync").forEach((c) => { c.className = "chip sync " + (s === "ok" ? "ok" : s === "err" ? "err" : s === "busy" ? "warn" : ""); c.innerHTML = `<i></i><span>${esc(m)}</span>`; c.title = m; });
      try { faixa(); } catch (e) {}
    },
    email() { return ((this.account && this.account.username) || "").trim().toLowerCase(); },
    firstName() { const n = ((this.account && this.account.name) || "").trim(); return n && !n.includes("@") ? n.split(/\s+/)[0] : ""; },
    exportarBackup() { baixarBackup(); },
    ultimoSalvamento() { return lsGet("sync.ultimo", null); },

    /* ---- login (Microsoft, pelo Supabase) ---- */
    setAccount(user) {
      this.uid = user ? user.id : null;
      this.account = user ? { username: (user.email || "").toLowerCase(), name: (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user.email || "") } : null;
      this.role = user ? "user" : "anon";
    },
    async init() {
      try {
        const sb = sbClient();
        const { data } = await sb.auth.getSession();
        const session = data && data.session;
        sb.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_OUT") this.setAccount(null); });
        if (!session) { this.setAccount(null); this.setStatus("local", "Entrar para sincronizar"); ERP.gate("login"); return; }
        this.setAccount(session.user);
        /* entrou com a senha depois de uma expulsão da trava: o login volta ao normal */
        try { localStorage.removeItem(LS("reauth")); } catch (e) {}
        /* trocou de conta neste navegador: guarda cópia do que havia e começa limpo */
        const em = this.email(), u = lsGet("user", null);
        if (u && u !== em) { if (Store.names().some((n) => temDados(n))) try { baixarBackup("conta-anterior"); } catch (e) {} Store.names().forEach((n) => { try { localStorage.removeItem(PREFIX + "doc." + n); localStorage.removeItem(PREFIX + "meta." + n); } catch (e) {} }); Store.load(); }
        lsSet("user", em);
        /* trava do celular antes de a tela do app aparecer, para não piscar o conteúdo */
        try { if (ERP.PIN) ERP.PIN.aoEntrar(em); } catch (e) { console.error(e); }
        ERP.gate(null); this.setStatus("busy", "Sincronizando…");
        await this.pullAll();
      } catch (e) { console.error(e); this.setStatus("err", "Erro de login"); ERP.gate("erro", e.message || String(e)); }
    },
    async login() { try { const options = { scopes: "openid email profile", redirectTo: this.redirectUri() }; if (lsGet("reauth", false)) options.queryParams = { prompt: "login" }; await sbClient().auth.signInWithOAuth({ provider: "azure", options }); } catch (e) { toast("Não foi possível iniciar o login: " + e.message); } },
    async logout() { try { await sbClient().auth.signOut(); } catch (e) {} try { lsSet("user", null); } catch (e) {} location.reload(); },
    async token() { const { data } = await sbClient().auth.getSession(); return data && data.session ? data.session.access_token : null; },

    /* ---- dados: tabela docs ---- */
    async readRow(n) {
      const { data, error } = await sbClient().from("docs").select("data,rev").eq("name", n).maybeSingle();
      if (error) throw new Error("ler " + (error.code || error.message || ""));
      return data;   /* {data, rev} | null */
    },
    aceitar(n, row) { const meta = Store.meta[n]; Store.replace(n, row.data, new Date().toISOString()); meta.rev = row.rev; meta.dirty = false; delete meta.remote; Store.saveMeta(n); },
    /* retorna true quando há conflito aguardando escolha */
    async pull(n) {
      const meta = Store.meta[n];
      const row = await this.readRow(n);
      if (!row) { if (meta.rev != null) { meta.rev = null; Store.saveMeta(n); } if (temDados(n) || meta.dirty) await this.push(n, true, true); return false; }
      if (meta.remote) return true;
      if (meta.rev === row.rev) { if (meta.dirty) await this.push(n); return false; }
      if (meta.rev == null) {
        if (!temDados(n) || igual(row.data, Store.docs[n])) { this.aceitar(n, row); return false; }
        if (!temDados(n, row.data)) { meta.rev = row.rev; Store.saveMeta(n); await this.push(n); return false; }
        meta.remote = { data: row.data, rev: row.rev, primeira: true }; Store.saveMeta(n); return true;
      }
      if (!meta.dirty) { this.aceitar(n, row); return false; }
      if (igual(row.data, Store.docs[n])) { meta.rev = row.rev; meta.dirty = false; Store.saveMeta(n); return false; }
      meta.remote = { data: row.data, rev: row.rev }; Store.saveMeta(n); return true;
    },
    schedule(n) {
      if (!this.account) return;
      const meta = Store.meta[n]; if (meta && meta.remote) { faixa(); return; }
      clearTimeout(this.timers[n]); this.setStatus("busy", "Alterações pendentes…");
      this.timers[n] = setTimeout(() => { delete this.timers[n]; this.push(n).catch(() => {}); }, 1500);
    },
    async push(n, force, criar) {
      if (!this.account) return;
      const meta = Store.meta[n];
      if (meta.remote) { faixa(); return; }
      if (meta.rev == null && !criar) { const c = await this.pull(n); if (c) this.askConflict([n]); return; }
      try {
        this.setStatus("busy", "Salvando…");
        const payload = Store.docs[n];
        if (meta.rev == null) {
          const { data, error } = await sbClient().from("docs").insert({ name: n, data: payload, rev: 1 }).select("rev").maybeSingle();
          if (error) { if (String(error.code) === "23505") { const c = await this.pull(n); if (c) this.askConflict([n]); return; } throw new Error("inserir " + error.code); }
          meta.rev = (data && data.rev) || 1;
        } else {
          const { data, error } = await sbClient().from("docs").update({ data: payload, rev: meta.rev + 1 }).eq("name", n).eq("rev", meta.rev).select("rev");
          if (error) throw new Error("salvar " + error.code);
          if (!data || !data.length) { const c = await this.pull(n); if (c) this.askConflict([n]); else this.setStatus("ok"); return; }
          meta.rev = data[0].rev;
        }
        meta.dirty = false; Store.saveMeta(n); marcarSalvo();
        this.setStatus(sujos().length ? "busy" : "ok");
      } catch (e) { console.error(e); this.setStatus("err", "Não salvou (dados seguros neste aparelho)"); throw e; }
    },
    async pullAll() {
      if (this._puxando) return this._puxando;
      this._puxando = (async () => {
        const conflicts = []; this.setStatus("busy", "Sincronizando…");
        for (const n of Store.names()) {
          try { if (await this.pull(n)) conflicts.push(n); }
          catch (e) { console.error(n, e); this.setStatus("err", "Falha ao ler " + nome(n)); ERP.render(); return; }
        }
        if (!sujos().length) marcarSalvo();
        this.setStatus("ok"); ERP.render();
        if (conflicts.length) this.askConflict(conflicts);
      })();
      try { return await this._puxando; } finally { this._puxando = null; this._ultimaLeitura = Date.now(); }
    },
    async sincronizarAgora() {
      await this.pullAll();
      for (const n of Store.names()) if (Store.meta[n].dirty && !Store.meta[n].remote) await this.push(n).catch(() => {});
      ERP.render();
    },
    /* a pergunta: nunca troca dados em silêncio */
    askConflict(list) {
      list = (list || []).filter((n) => Store.meta[n] && Store.meta[n].remote);
      if (!list.length || this._perguntando) { faixa(); return; }
      this._perguntando = true; faixa();
      const primeira = list.some((n) => Store.meta[n].remote.primeira);
      const linhas = list.map((n) => `<tr><td><b>${esc(nome(n))}</b></td><td>${esc(resumo(Store.docs[n], n))}</td><td>${esc(resumo(Store.meta[n].remote.data, n))}</td></tr>`).join("");
      const m = modal(`<h2>${primeira ? "Este aparelho tem dados que não estão na nuvem" : "Alterações em dois lugares"}</h2>
        <p>${primeira ? "Este aparelho já tinha dados antes de entrar, e a nuvem também tem dados." : "Estes módulos foram alterados neste aparelho e também na nuvem, por outro aparelho."} Nada foi trocado. Escolha o que fazer:</p>
        <table class="sync-tab"><thead><tr><th>Módulo</th><th>Neste aparelho</th><th>Na nuvem</th></tr></thead><tbody>${linhas}</tbody></table>
        <div class="sync-sel">
          <label><input type="radio" name="sOp" value="juntar" checked><span><b>Juntar os dois (recomendado)</b><small>Mantém tudo dos dois lados.</small></span></label>
          <label><input type="radio" name="sOp" value="nuvem"><span><b>Usar só o da nuvem</b><small>Os dados deste aparelho são trocados pelos da nuvem.</small></span></label>
          <label><input type="radio" name="sOp" value="local"><span><b>Usar só o deste aparelho</b><small>Os dados da nuvem são trocados pelos deste aparelho.</small></span></label>
        </div>
        <p class="mut" style="font-size:12.5px">Antes de aplicar, o Hub baixa uma cópia (.json) do que for substituído.</p>
        <div class="act"><button class="btn ghost" data-depois>Decidir depois</button><span class="sp"></span><button class="btn orange" data-ok>Aplicar</button></div>`, { noFocus: true });
      const fechar = () => { this._perguntando = false; m.close(); faixa(); };
      $("[data-depois]", m.el).onclick = fechar;
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { this._perguntando = false; obs.disconnect(); faixa(); } });
      obs.observe(document.body, { childList: true });
      $("[data-ok]", m.el).onclick = async (ev) => {
        const op = ($("input[name=sOp]:checked", m.el) || {}).value || "juntar";
        ev.target.disabled = true; ev.target.textContent = "Aplicando…";
        try {
          for (const n of list) {
            const meta = Store.meta[n], rem = meta.remote; if (!rem) continue;
            if (op === "nuvem") { baixarBackup(n + "-aparelho"); this.aceitar(n, rem); }
            else if (op === "local") { baixarBackup(n + "-nuvem"); delete meta.remote; meta.rev = rem.rev; meta.dirty = true; Store.saveMeta(n); await this.push(n); }
            else { baixarBackup(n + "-aparelho"); baixarBackup(n + "-nuvem"); const junto = juntar(rem.data, Store.docs[n]); delete meta.remote; meta.rev = rem.rev; Store.saveMeta(n); Store.replace(n, junto, new Date().toISOString()); meta.dirty = true; Store.saveMeta(n); await this.push(n); }
          }
          fechar(); this.setStatus(sujos().length ? "busy" : "ok"); ERP.render(); toast(op === "juntar" ? "Dados juntados e salvos na nuvem." : "Pronto. Cópia de segurança baixada.");
        } catch (e) { console.error(e); ev.target.disabled = false; ev.target.textContent = "Aplicar"; toast("Não foi possível aplicar: " + e.message); }
      };
    },

    /* ---- arquivos: anexos no Supabase Storage (pasta privada do usuário) e leitura avulsa (ex.: ibkr) ---- */
    async uploadFile(relPath, file) {
      if (!this.account || !this.uid) throw new Error("Entre com a Microsoft para anexar.");
      const path = `${this.uid}/${String(relPath).replace(/^\/+/, "")}`;
      const { error } = await sbClient().storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (error) throw new Error(error.message || "Upload falhou");
      return { id: path, name: file.name, path, size: file.size };
    },
    async fileUrl(path) {
      const { data, error } = await sbClient().storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error || !data) throw new Error((error && error.message) || "Arquivo não encontrado");
      return data.signedUrl;
    },
    async deleteItem(path) {
      if (!path || !String(path).includes("/")) return false;
      try { const { error } = await sbClient().storage.from(BUCKET).remove([path]); return !error; } catch (e) { return false; }
    },
    /* lê um registro avulso da tabela docs (ex.: "ibkr.json" → name "ibkr"), gravado por um robô ou importado. Retorna o JSON ou null. */
    async readFile(fname) {
      if (!this.account) return null;
      try { const row = await this.readRow(String(fname).replace(/\.json$/i, "")); return row ? row.data : null; } catch (e) { console.warn("readFile", fname, String(e.message || e)); return null; }
    },
  });
  /* celular: envia ao sair da tela, confere ao voltar; sem internet avisa e retoma quando voltar */
  document.addEventListener("visibilitychange", () => {
    if (!Cloud.account) return;
    if (document.visibilityState === "hidden") { Object.keys(Cloud.timers).forEach((n) => { clearTimeout(Cloud.timers[n]); delete Cloud.timers[n]; }); sujos().forEach((n) => { if (!Store.meta[n].remote) Cloud.push(n).catch(() => {}); }); }
    else if (!Cloud._ultimaLeitura || Date.now() - Cloud._ultimaLeitura > 30000) { Cloud.pullAll().catch(() => {}); }
  });
  window.addEventListener("offline", () => faixa());
  window.addEventListener("online", () => { faixa(); if (Cloud.account) Cloud.sincronizarAgora().catch(() => {}); });
  window.addEventListener("beforeunload", (e) => { if (Cloud.account && (sujos().length || Object.keys(Cloud.timers).length)) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- módulos, shell e rotas ---------- */
  ERP.register = (mod) => ERP.modules.push(mod);
  ERP.nav = (path) => { location.hash = "#/" + path; };

  function route() {
    const h = (location.hash || "#/inicio").replace(/^#\//, "").split("?")[0].split("/");
    const mod = ERP.modules.find((m) => m.id === h[0]) || ERP.modules[0];
    const page = (mod.pages || []).find((p) => p.id === h[1]) || (mod.pages || [])[0];
    return { mod, page };
  }
  /* gráficos (Chart.js, carregado do cdnjs): destruídos a cada troca de tela */
  ERP._charts = [];
  ERP.cor = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#888";
  ERP.chart = function (el, cfg) {
    if (!el || typeof Chart === "undefined") { if (el) el.parentElement.innerHTML = '<p class="mut" style="padding:20px;text-align:center">Gráfico indisponível sem internet.</p>'; return null; }
    if (!ERP._dl && typeof ChartDataLabels !== "undefined") { Chart.register(ChartDataLabels); Chart.defaults.set("plugins.datalabels", { display: false }); ERP._dl = 1; }
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.color = ERP.cor("--ink-2"); Chart.defaults.borderColor = ERP.cor("--line");
    const c = new Chart(el, cfg); ERP._charts.push(c); return c;
  };
  /* símbolos e emojis viram ícones de linha; emojis sem equivalente são removidos */
  const SYM = { "💳": "credit-card", "🏦": "landmark", "⚡": "zap", "🔒": "lock", "↻": "repeat", "✎": "pencil", "↺": "undo-2", "✓": "check", "✔": "check", "✕": "x", "✖": "x", "↗": "arrow-up-right", "→": "arrow-right", "🚩": "flag", "💰": "wallet", "📋": "list", "☑": "square-check", "✅": "circle-check", "📈": "trending-up", "🏛": "landmark", "⚙": "settings", "🏠": "house", "‹": "chevron-left", "›": "chevron-right" };
  const SYM_RE = /(\p{Extended_Pictographic}|[✎↺✓✕↗→↻‹›])[\uFE0F\u200D\u2640\u2642\u{1F3FB}-\u{1F3FF}]*/gu;
  ERP.iconify = function (root) {
    if (!root || !ERP.ic) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const hits = [];
    while (w.nextNode()) { const n = w.currentNode; SYM_RE.lastIndex = 0; if (SYM_RE.test(n.nodeValue)) hits.push(n); }
    hits.forEach((n) => {
      const par = n.parentNode; if (!par) return;
      const inCtl = par.closest && par.closest("option,select,textarea,title,script,style");
      const t = n.nodeValue;
      if (inCtl) { n.nodeValue = t.replace(SYM_RE, "").replace(/^\s+/, ""); return; }
      /* "‹" e "›" só viram ícone quando sozinhos num botão (navegação de mês); em texto corrido ficam */
      const solo = t.trim().length <= 2;
      const html = esc(t).replace(SYM_RE, (m0, ch) => { if ((ch === "‹" || ch === "›") && !solo && !/^[‹›]\s|\s[‹›]$/.test(t.trim())) return ch; if (ch === "→" && !solo && par.closest && !par.closest("td,.btn,.ib")) return ch; const nm = SYM[ch]; return nm ? ERP.ic(nm, 15) : ""; });
      const span = document.createElement("span"); span.innerHTML = html.replace(/^\s+(?=<svg)/, "");
      par.replaceChild(span, n); span.replaceWith(...span.childNodes);
    });
    /* botões "+ Algo": troca o "+" por ícone */
    $$(".btn", root).forEach((b) => { const f = b.firstChild; if (f && f.nodeType === 3 && /^\s*\+\s*/.test(f.nodeValue)) { f.nodeValue = f.nodeValue.replace(/^\s*\+\s*/, ""); b.insertAdjacentHTML("afterbegin", ERP.ic("plus", 16)); } });
  };

  /* aparência: "auto" segue o aparelho; "light"/"dark" fixam */
  const mqDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : { matches: false };
  ERP.theme = () => lsGet("theme", "light") || "light";   /* padrão: fundo branco, dentro e fora do sistema */
  ERP.isDark = () => { const t = ERP.theme(); return t === "dark" || (t === "auto" && mqDark.matches); };
  ERP.setTheme = function (t) {
    lsSet("theme", t);
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    ERP.paintTheme(); ERP.render();
  };
  ERP.paintTheme = function () {
    const dark = ERP.isDark();
    $$(".themebtn").forEach((b) => { const lbl = dark ? "Usar modo claro" : "Usar modo escuro"; b.innerHTML = (ERP.ic ? ERP.ic(dark ? "sun" : "moon", b.classList.contains("iconbtn") ? 20 : 16) : "") + (b.classList.contains("chip") ? `<span>${dark ? "Modo Claro" : "Modo Escuro"}</span>` : ""); b.title = lbl; b.setAttribute("aria-label", lbl); });
    $$('meta[name="theme-color"]').forEach((m) => { m.removeAttribute("media"); m.content = dark ? "#14171C" : "#FFFFFF"; });
  };
  if (mqDark.addEventListener) mqDark.addEventListener("change", () => { if (ERP.theme() === "auto") { ERP.paintTheme(); ERP.render(); } });

  ERP.render = function () {
    ERP._charts.forEach((c) => { try { c.destroy(); } catch (e) {} }); ERP._charts = [];
    const { mod, page } = route();
    const ic = (n, s) => (ERP.ic ? ERP.ic(n, s) : "");
    const ORD = ["inicio", "financas", "reminders", "investimentos", "patrimonio"];
    const vis = ERP.modules.filter((m) => m.id !== "sistema").sort((x, y) => (ORD.indexOf(x.id) + 1 || 99) - (ORD.indexOf(y.id) + 1 || 99));
    $("#nav").innerHTML = vis.map((m) => `<a href="#/${m.id}" class="${m.id === mod.id ? "on" : ""}"${m.id === mod.id ? ' aria-current="page"' : ""}>${ic(m.icon, 18)}<span>${esc(m.short || m.label)}</span></a>`).join("");
    const sis = ERP.modules.find((m) => m.id === "sistema");
    if (sis) { const a = $("#navSis"); if (a) { a.className = "iconbtn" + (mod.id === "sistema" ? " on" : ""); a.innerHTML = ic(sis.icon, 20); } const ss = $("#sideSis"); if (ss) { ss.className = mod.id === "sistema" ? "on" : ""; ss.innerHTML = `${ic(sis.icon, 18)}<span>${esc(sis.label)}</span>`; ss.title = sis.label; } }
    $("#tabbar").innerHTML = vis.slice(0, 5).map((m) => `<a href="#/${m.id}" class="${m.id === mod.id ? "on" : ""}">${ic(m.icon, 22)}<span>${esc(m.tab || m.short || m.label)}</span></a>`).join("");
    $("#mTitle").textContent = mod.short || mod.label;
    const bv = $("#brandVer"); if (bv) bv.textContent = ERP.version;
    /* menu lateral: as telas do módulo atual (as de "more" ficam numa seção à parte); sem telas, lista os módulos */
    const sn = $("#sidenav");
    if (sn) {
      const link = (href, on, icon, label, title) => `<a href="${href}" class="${on ? "on" : ""}" title="${esc(title || label)}"${on ? ' aria-current="page"' : ""}>${ic(icon || "chevron-right", 18)}<span>${esc(label)}</span></a>`;
      let html = `<div class="sn-mod">${ic(mod.icon, 18)}<span>${esc(mod.label)}</span></div>`;
      if (mod.pages && mod.pages.length > 1) {
        html += mod.pages.map((p) => link(`#/${mod.id}/${p.id}`, p.id === page.id, p.icon, p.label)).join("");
      } else {
        html += `<div class="sn-sep"><span>Módulos</span></div>` + vis.filter((m) => m.id !== mod.id).map((m) => link(`#/${m.id}`, false, m.icon, m.short || m.label, m.label)).join("");
      }
      sn.innerHTML = html;
    }
    const main = $("#main"); main.innerHTML = "";
    if (mod.pages && mod.pages.length > 1) {
      const head = document.createElement("div"); head.className = "modhead";
      const icons = mod.pages.some((p) => p.icon);
      const tab = (p) => `<a href="#/${mod.id}/${p.id}" class="${p.id === page.id ? "on" : ""}" title="${esc(p.label)}">${p.icon ? ic(p.icon, 20) : ""}<span>${esc(p.short || p.label)}</span></a>`;
      head.innerHTML = `<nav class="subnav${icons ? " subnav-ic" : ""}" aria-label="${esc(mod.label)}">${mod.pages.map(tab).join("")}</nav>`;
      main.appendChild(head);
      const on = $(".subnav a.on", head); if (on) requestAnimationFrame(() => on.scrollIntoView({ block: "nearest", inline: "nearest" }));
    }
    const body = document.createElement("div"); main.appendChild(body);
    try { (page ? page.render : mod.render)(body, { mod, page }); } catch (e) { console.error(e); body.innerHTML = `<div class="note err">Não foi possível abrir esta tela: ${esc(e.message)}</div>`; }
    ERP.iconify(body); ERP.marcarTabelas(body);
    document.title = (page && mod.pages && mod.pages.length > 1 ? page.label + " · " : "") + (mod.short || mod.label) + " · Hub";
  };
  /* tabelas largas (padrão v0.14.43 do ERP NMB): 1ª coluna fixa e aviso "role para o lado" só quando há rolagem lateral */
  ERP.marcarTabelas = (root) => {
    $$(".tw", root || document).forEach((tw) => {
      const wide = tw.scrollWidth > tw.clientWidth + 8; tw.classList.toggle("wide", wide);
      let h = tw.querySelector(":scope > .tw-hint");
      if (wide && !h) { h = document.createElement("div"); h.className = "tw-hint"; h.textContent = "Role para o lado para ver todas as colunas ›"; tw.appendChild(h); }
    });
  };
  window.addEventListener("resize", () => ERP.marcarTabelas());
  /* re-renderizações parciais dentro das telas também ganham ícones e a marcação de tabela larga */
  new MutationObserver((ms) => { if (ERP._iconBusy) return; ERP._iconBusy = true; try { ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && !(n.closest && n.closest("svg"))) { ERP.iconify(n); if (n.matches && (n.matches(".tw") || n.querySelector(".tw"))) ERP.marcarTabelas(n); } })); } finally { ERP._iconBusy = false; } }).observe(document.getElementById("main") || document.documentElement, { childList: true, subtree: true });
  /* ---------- glossário: termos técnicos explicados em linguagem simples (botão "?" ao lado do termo) ---------- */
  ERP.GLOSS = {
    regimeCaixa: ["Regime de caixa", "Conta o dinheiro quando ele realmente entra ou sai da conta (pela data do pagamento/recebimento). Compras no cartão entram quando a fatura é paga."],
    competencia: ["Competência", "Conta pela data em que a despesa ou receita aconteceu (data da compra), mesmo que o pagamento seja depois. Inclui os previstos."],
    saldoHoje: ["Saldo em conta", "Soma do que há hoje nas contas do dia a dia (corrente, digital, dinheiro). Reservas e investimentos ficam de fora."],
    reservas: ["Reservas", "Contas marcadas como reserva: dinheiro guardado que não entra no saldo do dia a dia nem na projeção."],
    resultadoMes: ["Resultado do mês", "Entradas menos saídas do mês (realizadas e previstas). Positivo = sobra; negativo = o mês consome saldo."],
    margem: ["Margem", "Quanto das entradas sobra depois das saídas, em %. Ex.: 20% = de cada R$ 100 que entram, R$ 20 ficam."],
    compromissos: ["Compromissos recorrentes", "Soma mensal das contas que se repetem (aluguel, planos, assinaturas). Um gasto anual entra dividido por 12; um semestral, por 6."],
    mensalizado: ["Por mês (mensalizado)", "Valor da conta convertido para o equivalente mensal: anual ÷ 12, semestral ÷ 6, trimestral ÷ 3, bimestral ÷ 2."],
    saldoProjetado: ["Saldo projetado", "Saldo de hoje somado, dia a dia, a tudo que já está previsto entrar e sair (contas, recorrências, parcelas, faturas). Atrasados contam como hoje."],
    menorSaldo: ["Menor saldo previsto", "O ponto mais baixo que o saldo projetado atinge no período e em que data. Se for negativo, haverá cheque especial ou falta de caixa."],
    previstoPagar: ["Previsto a pagar", "Tudo que já está lançado para sair no período: contas em aberto, parcelas, faturas e recorrências geradas."],
    aConfirmar: ["A confirmar", "Lançamento gerado por uma recorrência de valor variável (energia, água): o valor é uma estimativa até você confirmar o real ao pagar."],
    taxaPoupanca: ["Taxa de poupança", "Parte da renda que foi para investimentos e reservas, em %. Referência comum: 10% a 20%."],
    reservaEmergencia: ["Reserva de emergência", "Quantos meses de gastos as reservas cobrem. Referência: 3 a 6 meses."],
    comprometimento: ["Comprometimento com dívidas", "Parcelas de dívidas divididas pela renda média, em %. Acima de 30% costuma apertar o orçamento."],
    custoFixoRenda: ["Custo fixo ÷ renda", "Quanto da renda já está comprometida com contas fixas. Quanto menor, mais flexibilidade."],
    coberturaCaixa: ["Cobertura de caixa", "Saldo em conta dividido pelas saídas médias de um mês. 1× = cobre um mês de gastos."],
    variacaoCusto: ["Variação do custo de vida", "Quanto as saídas médias dos últimos meses subiram ou caíram em relação aos meses anteriores."],
    necessidades: ["Necessidades", "Gastos essenciais: moradia, alimentação básica, saúde, transporte, contas de consumo. Na regra 50/30/20 deveriam ficar até 50% da renda."],
    estiloVida: ["Estilo de vida", "Gastos de escolha: lazer, restaurantes, assinaturas, viagens, compras. Na regra 50/30/20, até 30% da renda."],
    financeiro: ["Financeiro", "Juros, tarifas bancárias e parcelas de dívidas."],
    investimentos: ["Investimentos e reservas", "Aportes e dinheiro guardado. Não é gasto: é patrimônio mudando de lugar. Na regra 50/30/20, pelo menos 20%."],
    sobra: ["Sobra", "O que fica das entradas depois de todas as saídas e dos aportes em investimentos."],
    dre: ["DRE pessoal", "Demonstração do resultado: receitas, menos cada grupo de despesas, até chegar ao que sobrou. É a mesma lógica da contabilidade de empresas, aplicada à sua vida."],
    classeFixo: ["Custo fixo", "Mesmo valor todo período (aluguel, mensalidade, assinatura)."],
    classeVariavel: ["Custo variável", "Repete-se, mas o valor muda (energia, água, mercado, combustível)."],
    centroCusto: ["Centro de custo", "Etiqueta para separar gastos por área, projeto ou pessoa (Casa, Carro, NMB) e somar cada uma."],
    favorecido: ["Favorecido", "Quem recebe o pagamento (fornecedor, loja, pessoa). O Hub aprende categoria, forma e valor habitual de cada um."],
    fatura: ["Fatura", "Soma das compras do cartão entre um fechamento e o seguinte. Vira uma saída da conta no vencimento."],
    orcamento: ["Orçamento", "Limite mensal que você define por categoria. O Hub mostra quanto já foi usado e avisa ao estourar."],
    recorrencia: ["Recorrência", "Conta que se repete (mensal, bimestral, trimestral, semestral, anual). O Hub gera os lançamentos futuros automaticamente."],
    fluxoCaixa: ["Fluxo de caixa", "Entradas e saídas ao longo do tempo e o saldo que resulta. Mostra se o dinheiro cobre os compromissos e quando aperta."],
    ptax: ["PTAX", "Cotação oficial do dólar divulgada pelo Banco Central, usada no IR para converter valores em moeda estrangeira."],
    depreciacao: ["Depreciação", "Perda de valor de um bem com o tempo e o uso (carro, equipamentos), distribuída ao longo da vida útil."],
    patrimonioLiquido: ["Patrimônio líquido", "Tudo que você tem (contas, investimentos, bens) menos tudo que deve (dívidas, faturas)."],
    patrimInvestido: ["Patrimônio investido", "Valor de mercado da carteira de investimentos convertido para reais pela cotação atual do dólar."],
    resultadoNaoReal: ["Resultado não realizado", "Lucro ou prejuízo \"no papel\": valor de mercado menos o custo de compra, enquanto você ainda não vendeu. Só vira ganho de verdade na venda."],
    dividendos: ["Dividendos", "Parte do lucro das empresas/fundos distribuída a quem tem as cotas. \"No ano (bruto)\" é o total recebido no ano, antes de impostos."],
    cambio: ["Câmbio", "Cotação do dólar usada para converter valores em US$ para reais. Você a atualiza em Investimentos › Atualizar Cotações."],
    ganhoCapital: ["Ganho de capital", "Lucro na venda de um ativo: preço de venda menos o custo de compra. É a base do imposto sobre vendas."],
  };
  ERP.help = (k) => (ERP.GLOSS[k] ? `<button type="button" class="hlp" data-help="${k}" aria-label="O que é ${esc(ERP.GLOSS[k][0])}" title="O que é ${esc(ERP.GLOSS[k][0])}?">?</button>` : "");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-help]"); const open = $(".hlp-pop");
    if (open && !e.target.closest(".hlp-pop")) open.remove();
    if (!b) return; e.preventDefault(); e.stopPropagation();
    const g = ERP.GLOSS[b.dataset.help]; if (!g) return;
    const pop = document.createElement("div"); pop.className = "hlp-pop"; pop.setAttribute("role", "dialog"); pop.innerHTML = `<b>${esc(g[0])}</b><p>${esc(g[1])}</p><a href="#/sistema/glossario">Ver todos os termos ↗</a>`;
    document.body.appendChild(pop); const r = b.getBoundingClientRect(); const w = Math.min(320, window.innerWidth - 16);
    pop.style.width = w + "px"; pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px"; pop.style.top = (r.bottom + 6 + (window.innerHeight - r.bottom < 160 ? -(pop.offsetHeight + r.height + 12) : 0)) + "px";
  });

  /* ---------- gráficos com "ver os lançamentos": duplo clique (ou toque longo) numa barra/fatia abre o extrato do que compõe aquele valor ----------
     drill(datasetIndex, index) → { title, lancs: [...] } | null */
  ERP.chartDrill = (chart, drill) => {
    if (!chart || !chart.canvas) return;
    const abrir = (ev) => { const els = chart.getElementsAtEventForMode(ev, "nearest", { intersect: true }, true); if (!els.length) return; const r = drill(els[0].datasetIndex, els[0].index); if (r && ERP.extrato) ERP.extrato(r.title, r.lancs, r.sub); };
    chart.canvas.addEventListener("dblclick", abrir);
    let t = null; chart.canvas.addEventListener("touchstart", (ev) => { t = setTimeout(() => abrir(ev), 550); }, { passive: true }); ["touchend", "touchmove", "touchcancel"].forEach((n) => chart.canvas.addEventListener(n, () => clearTimeout(t), { passive: true }));
    chart.canvas.title = "Duplo clique numa barra para ver os lançamentos";
  };

  ERP.pagehead = (title, actions) => `<div class="pagehead"><h1>${esc(title)}</h1><span class="sp"></span>${actions ? `<div class="pha">${actions}</div>` : ""}</div>`;
  ERP.kpi = (l, v, s, cls, help) => `<div class="kpi ${cls || ""}"><div class="l">${esc(l)}${help && ERP.GLOSS && ERP.GLOSS[help] ? ERP.help(help) : ""}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
  ERP.download = (name, content, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: type || "application/json" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); };
  // Gera .xlsx real (zip sem compressão), sem bibliotecas. rows: matriz; números viram numéricos, "AAAA-MM-DD" vira data.
  /* zip sem compressão (store) de um mapa {nome: string|Uint8Array|Blob-bytes}. Retorna Blob. */
  ERP.zip = (files) => {
    const enc = new TextEncoder();
    const T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
    const crc = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const parts = [], cen = []; let off = 0;
    Object.keys(files).forEach((fn) => {
      const nb = enc.encode(fn), raw = files[fn], d = raw instanceof Uint8Array ? raw : enc.encode(String(raw)), cr = crc(d);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint32(14, cr, true); lh.setUint32(18, d.length, true); lh.setUint32(22, d.length, true); lh.setUint16(26, nb.length, true);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint32(16, cr, true); ch.setUint32(20, d.length, true); ch.setUint32(24, d.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      parts.push(new Uint8Array(lh.buffer), nb, d); cen.push(new Uint8Array(ch.buffer), nb); off += 30 + nb.length + d.length;
    });
    const csz = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22)); const n = Object.keys(files).length;
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [new Uint8Array(e.buffer)]), { type: "application/zip" });
  };  /* .xlsx profissional, sem bibliotecas: logo + título + subtítulo, cabeçalho no tema (navy/branco), datas e moeda formatadas,
     linha de totais com fórmulas, painel congelado, filtro, larguras automáticas e configuração de impressão.
     opts: { title, subtitle, sheet, totals: [índices de colunas a somar] | "auto", noLogo } */
  ERP.LOGO_PNG = "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAGnklEQVR42u2d3W4aRxTH/zO7S0Bgs3AVPuwaSC/7Cn2DVmqkGhlHsa02ueptpT5Cpd7mKlFkkjZO7Eq56CP0PQAnsZdUjfkwIBP2Y3phwDZxYha8y5CeI618w673nN/s7Myc/5xlQggBspkZpxAQAAJARgAIABkBIABkBOB/Z6rbE6aZtzHG5iIofvrIaCY8R0+AEAKtVnuiFsIYw8JCRPqnQAiB424XjhBwc6cCAGcMi8GgKx/VcW+KMYZWq41vb+dRq9WhadpYIBhjME0T8XgMf73cxeLiwvB6sgWeMYbjbhdf//Yrau02VFUd20fLshCPRPD3z78gGgqN7aPrJ6BWa+DoqOYaAMAwD72dEAJHnQ7etVrQXAAwLQuCuffR9UtY01RomuYKwOC8eTFNUaCpqisAg/N8GQWdP9ycMy/mp480D6CJGAEgIwAEgIwAEACpF7k+13vkfjnFOUcgoMFx5IXgOAKBgAbOOeATCD7JopqbAwBUVUWzeYzXrw/AOYPtONIF33YccM7w6vUBms0mFFWd2F9PAZimBdM0xz4cx4Gqquh2u7i7dR/lcgWqosC2bXmCb9tQFQXlUgV3t+6j+74HNaDBEQKmZcG07dO/Vx0T+KS6bf3xuA5AXL0WJAAwoN1u4+TkBOFwGG8ODOQLm9jdeYJsdgW2bUOZYP3kuoOvKArKlX3kCxs4+PcdFr76Eq3GMULBG4gtLAx9uXI1NBz2NiHjJh8w+M2bgwP8cO8nvDk8RFzXUW80kEwmsCcBhGHwy/tYLWzAMKrQYzpqrTbS6RQeP3yA5aX0cK3fi3yALxmxUqmCfGETRrWKmK6j1mggNWMIo8E/NKpnDeTmTezubCN3K+f5fbgG4JaX7ThQFQWlcgWra5uoSgDhU8FPJBLYe15ELpuBNbgnFz5LmRMeOFwqV5BfO3sSZtEdXdbtDO8lkcBuP/h+NQhf5gFKf9STy2aw+7yIZCKBeqOBmK7j0KhitbCBcnl/+Ds/W/4sg+/rTHgUQqIPIX4BQsUzCJ/s85OzCb7vSxHnIew9LyKZTKDWh2AYVawWNlHyAMJl3U68/x467QJnE/yZLMZdeBJ2ikglz7ojw6gif80QLu12YqODgMzMhsMzE2ZdeDEXNocvw7PAFJHNZmCaJjjnrpdmGAMcx4GmaR/tdmSYi8xUGXfWOitYLWx+EKAXz7ZxK5edfg6yvgXDMKSZg0glTbzsSdB1HbV6HdmVL7D6/e3h2HrcMfbAJSEE9v58ifL+K8RjMdQlC7402tBRCIeHBqLRRZycdNFud6a6diQSRigURLN5jFQqKVXwpRLnnodw5+6PMKpvEQgEwPl0EkbhCLzv9ZBMJPDH00czG+1In5JUFAW9nolcNoM763m0Wm1wzmBZ9lQH46ea1jvreeSyGfR6pjTBly4nzDmH4wjYtnOt4l3GGGzbhuOcZuZASflPQWBzeW1SRYBUEWQEgACQEQACQEYACAAZASAAZASAAGASifg8XvuzAOD0JeKKolzrRgkhBBRFAecMjmTSeEkTMvdgVKu4EQiAfeYJGalSkkP1AqUkZ6tSjlFSXgKJeDKJ3WfbyOUyIFmKjyrl0QCRMMuvlh/TUatff+v083/NxTD0/GjnvFC27lFABhrTbHYFeztPTrWo9VFVtvfSeCkAXAj+2kU9qJddwiiED1XZG56osqUCMLpLxu+tSpc9CbVGA7FYX5W9tjkTCHwWwT+/RcnPfvhj3VFM12FUZwOBNuldtUnPpZBLyk16pVIZ+cLW/GxTTSROt6lOKY2XcqN2rdFAOpnE7k5Ryo3agwaylErh8aMHWEqnx27ZkxSnHQvAsKjpcWv8wq0XShV0EQ6H0WweI51OYm+niExGslIFw3WoKvToItqdDkKhICKRyFilCiYtTut54VZFURAKhdDpdLC0lMKLZ9vSBP/DF3MR+fUtvH37D0KhECzLwtFRDV4Wp/W8cCsAWJaFYDCIp9sPkc2swOpXJ4FE0njLtpHNZvD79kN8810elmWBcz6Wmnqa4rR82qKmVx0DANHoIpbTKTiOcD2y8AVCXxq/vJxGNLoIy7Im9le6eQBjp5monmlKKRE/L1/v9U5rHPlVXNzXpjgPH3Dw+x5JFUFJeQJARgAIABkBAH1FyW3hVi9+L8tQ1C8f1UkLt46bGxisk5imNTcA/PTRu8KtH6wU6nMzEfPTR8/yAfP8ITc/faRPGdLHPOljnvQE0DyAAJARAAJARgAIABkBIABkPtp/FBB429a+xBgAAAAASUVORK5CYII=";
  ERP.xlsxBlob = (header, rows, opts) => {
    opts = opts || {}; const title = opts.title || "Hub · Painel Pessoal"; const sub = opts.subtitle || `Hub · Painel Pessoal · gerado em ${new Date().toLocaleString("pt-BR")}`;
    const x = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
    const col = (n) => { let r = ""; n++; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
    const serial = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5) + 25569;
    const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const nCols = header.length, H0 = 4, D0 = H0 + 1;   /* linha do cabeçalho (1-based) e primeira linha de dados */
    const numCol = header.map((h, c) => rows.length > 0 && rows.every((r) => r[c] == null || r[c] === "" || (typeof r[c] === "number" && isFinite(r[c]))) && rows.some((r) => typeof r[c] === "number"));
    const somar = opts.totals === "auto" || opts.totals == null ? header.map((h, c) => numCol[c] && /valor|total|r\$|custo|venda|ganho|saldo|pago|juros|montante|ir\b|imposto|lucro|preço|preco|renda|rendimento|aporte/i.test(String(h)) && !/qtd|quant|cotação|ptax|%/i.test(String(h))) : header.map((_, c) => (opts.totals || []).includes(c));
    const cell = (v, r, c, st) => { const ref = col(c) + r; if (st === "head") return `<c r="${ref}" s="${numCol[c] ? 9 : 3}" t="inlineStr"><is><t>${x(v)}</t></is></c>`; if (v == null || v === "") return `<c r="${ref}" s="4"/>`; if (typeof v === "number" && isFinite(v)) return `<c r="${ref}" s="2"><v>${v}</v></c>`; if (isDate(v)) return `<c r="${ref}" s="1"><v>${serial(v)}</v></c>`; return `<c r="${ref}" s="4" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`; };
    const w = header.map((h, c) => Math.min(50, Math.max(numCol[c] ? 14 : 10, ...[header].concat(rows).map((r) => (isDate(r[c]) ? 12 : String(r[c] == null ? "" : r[c]).length + 3)))));
    if (!opts.noLogo) w[0] = Math.max(w[0], 12);
    const lastRow = D0 + rows.length - 1; const totRow = rows.length && somar.some(Boolean) ? lastRow + 1 : 0;
    let xml = `<row r="1" ht="30" customHeight="1">${cell(title, 1, opts.noLogo ? 0 : 1, "x").replace('s="4"', 's="5"')}</row><row r="2" ht="16" customHeight="1">${cell(sub, 2, opts.noLogo ? 0 : 1, "x").replace('s="4"', 's="6"')}</row><row r="3" ht="8" customHeight="1"/>`;
    xml += `<row r="${H0}" ht="22" customHeight="1">${header.map((h, c) => cell(h, H0, c, "head")).join("")}</row>`;
    xml += rows.map((r, i) => `<row r="${D0 + i}">${header.map((_, c) => cell(r[c], D0 + i, c)).join("")}</row>`).join("");
    if (totRow) xml += `<row r="${totRow}" ht="20" customHeight="1">${header.map((_, c) => (c === 0 ? `<c r="A${totRow}" s="7" t="inlineStr"><is><t>Total</t></is></c>` : somar[c] ? `<c r="${col(c)}${totRow}" s="8"><f>SUBTOTAL(9,${col(c)}${D0}:${col(c)}${lastRow})</f></c>` : `<c r="${col(c)}${totRow}" s="7"/>`)).join("")}</row>`;
    const ref = `A${H0}:${col(nCols - 1)}${Math.max(lastRow, H0)}`;
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${H0}" topLeftCell="A${D0}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/><cols>${w.map((n, i) => `<col min="${i + 1}" max="${i + 1}" width="${n}" customWidth="1"/>`).join("")}</cols><sheetData>${xml}</sheetData><autoFilter ref="${ref}"/><printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/><headerFooter><oddHeader>&amp;L&amp;"-,Bold"${x(title)}&amp;R${x(sub.split(" · gerado")[0])}</oddHeader><oddFooter>&amp;LHub · Painel Pessoal&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter>${opts.noLogo ? "" : '<drawing r:id="rId1"/>'}</worksheet>`;
    const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const sheetName = x((opts.sheet || "Dados").replace(/[\\/?*\[\]:]/g, " ").slice(0, 31));
    const files = {
      "[Content_Types].xml": H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + (opts.noLogo ? "" : '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>') + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
      "_rels/.rels": H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
      "docProps/core.xml": H + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dc:creator>Hub · Painel Pessoal</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
      "docProps/app.xml": H + `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Hub ${x(ERP.version)}</Application></Properties>`,
      "xl/workbook.xml": H + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      "xl/styles.xml": H + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00;[Red]\\-#,##0.00"/></numFmts><fonts count="6"><font><sz val="10"/><color rgb="FF0B1628"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF0B1628"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF0B1628"/><name val="Calibri"/></font><font><sz val="9"/><color rgb="FF6B7A90"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFE4572A"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B1628"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F3F6"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE6E8EC"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF0B1628"/></top><bottom style="double"><color rgb="FF0B1628"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="165" fontId="1" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs></styleSheet>',
      "xl/worksheets/sheet1.xml": sheet
    };
    if (!opts.noLogo) {
      files["xl/worksheets/_rels/sheet1.xml.rels"] = H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>';
      files["xl/drawings/drawing1.xml"] = H + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:ext cx="495300" cy="495300"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo Hub"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="495300" cy="495300"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>';
      files["xl/drawings/_rels/drawing1.xml.rels"] = H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>';
      files["xl/media/image1.png"] = Uint8Array.from(atob(ERP.LOGO_PNG), (ch) => ch.charCodeAt(0));
    }
    return ERP.zip(files);
  };
  ERP.xlsx = (name, header, rows, opts) => ERP.download(name, ERP.xlsxBlob(header, rows, opts), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  ERP.blobBytes = (b) => b.arrayBuffer().then((a) => new Uint8Array(a));


  /* tela de entrada: bloqueia o sistema até a conta Microsoft entrar (cada conta vê só os próprios dados) */
  ERP.gate = function (kind, detail) {
    const g = $("#gate"); if (!g) return;
    if (!kind) { g.hidden = true; document.body.classList.remove("gated"); return; }
    document.body.classList.add("gated"); g.hidden = false;
    const mark = ($(".mono svg") || {}).outerHTML || "";
    const T = {
      wait: ["Verificando acesso", "Só um instante.", ""],
      login: ["Entrar", "", '<button class="btn orange lg" data-g="in">Entrar com Microsoft</button>'],
      erro: ["Não foi possível entrar", esc(detail || "Erro desconhecido") + ". Verifique a internet e tente de novo.", '<button class="btn orange lg" data-g="retry">Tentar de novo</button><button class="btn ghost lg" data-g="out">Sair</button>'],
    }[kind] || ["", "", ""];
    if (kind === "login") document.title = "Entrar";
    g.innerHTML = `<div class="gate-card"><span class="mono gate-mono">${mark}</span><h1>${T[0]}</h1><p>${T[1]}</p><div class="gate-act">${T[2]}</div></div>`;
    const b = (k) => $(`[data-g="${k}"]`, g);
    if (b("in")) b("in").onclick = () => Cloud.login();
    if (b("out")) b("out").onclick = () => Cloud.logout();
    if (b("retry")) b("retry").onclick = () => location.reload();
  };

  ERP.boot = async function () {
    document.body.classList.add("gated"); ERP.gate("wait");
    Store.load();
    (ERP.onBoot || []).forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    /* atalhos: n = novo lançamento · / = buscar · ? = ajuda (fora de campos de texto e sem janela aberta) */
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; const t = e.target; const typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); if (typing || document.querySelector(".ov")) return;
      if (e.key === "n" && ERP.finUI && ERP.finUI.lancForm) { e.preventDefault(); ERP.finUI.lancForm(); }
      else if (e.key === "/") { const q = document.querySelector("#fQ, #fpQ, #cQ, #rQ, input[placeholder^='Buscar']"); if (q) { e.preventDefault(); q.focus(); q.select && q.select(); } }
      else if (e.key === "?") { e.preventDefault(); toast("Atalhos: n = novo lançamento · / = buscar · Esc = fechar · ← → nas listas: use os botões ‹ ›"); }
    });
    $$(".sync").forEach((c) => (c.onclick = () => ERP.nav("sistema/dados")));
    /* menu lateral (||| no topo): mostra/oculta por completo. Ao escolher uma tela, o menu se oculta e o conteúdo ocupa a largura toda (as abas no topo passam a servir de navegação). Estado guardado neste aparelho. */
    ERP.sideShow = (show) => { document.body.classList.toggle("side-hidden", !show); lsSet("ui.side", show ? "show" : "hide"); const t = $("#sideTgl"); if (t) t.setAttribute("aria-expanded", show ? "true" : "false"); };
    ERP.sideShow(lsGet("ui.side", window.innerWidth < 1180 ? "hide" : "show") === "show");
    { const t = $("#sideTgl"); if (t) t.onclick = () => ERP.sideShow(document.body.classList.contains("side-hidden")); }
    if (!ERP._sideAuto) { ERP._sideAuto = 1; document.addEventListener("click", (e) => { if (e.target.closest("#sidenav a, .side-foot a") && window.innerWidth >= 901) ERP.sideShow(false); }); }
    const no = $("#navOut"), mo = $("#mOut"); if (no) { no.innerHTML = ERP.ic("log-out", 20); no.onclick = () => Cloud.logout(); } if (mo) { mo.innerHTML = ERP.ic("log-out", 20); mo.onclick = () => Cloud.logout(); }
    $$(".themebtn").forEach((c) => (c.onclick = () => ERP.setTheme(ERP.isDark() ? "light" : "dark")));
    ERP.paintTheme();
    window.addEventListener("hashchange", ERP.render);
    ERP.render();
    try { if ("serviceWorker" in navigator && location.protocol === "https:" && /github\.io$/.test(location.hostname)) navigator.serviceWorker.register("sw.js"); } catch (e) {}   /* app instalável (PWA) */
    await Cloud.init();
  };
})();

