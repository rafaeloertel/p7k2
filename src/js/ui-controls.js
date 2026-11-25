/* Controles próprios: lista suspensa e calendário no padrão visual do ERP.
   Os <select> e <input type=date> originais continuam no HTML (ocultos) e guardam o valor,
   então nenhum módulo precisa mudar. */
(function () {
  "use strict";
  const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const CHK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const CAL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>';
  const PREV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
  const NEXT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const p2 = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => y + "-" + p2(m + 1) + "-" + p2(d);
  const hoje = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* Maiúscula para nomes compostos no texto exibido das listas (mantém siglas, e-mails e o conteúdo entre parênteses). */
  const tcd = (t) => { t = String(t == null ? "" : t); if (!ERP.tcPt || /@/.test(t)) return t; return t.replace(/^[^(]+/, (m) => ERP.tcPt(m)); };

  let pop = null, popOwner = null, popPos = null;
  function closePop() { if (pop) { pop.remove(); pop = null; if (popOwner) popOwner.classList.remove("open"); popOwner = null; popPos = null; } }
  function place(anchor, el) {
    const r = anchor.getBoundingClientRect(); const vw = innerWidth, vh = innerHeight;
    el.style.minWidth = Math.max(r.width, 0) + "px";
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = Math.min(Math.max(8, r.left), vw - w - 8);
    let top = r.bottom + 6; if (top + h > vh - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
    if (top + h > vh - 8) { el.style.maxHeight = Math.max(160, vh - top - 8) + "px"; }
    el.style.left = left + "px"; el.style.top = top + "px";
  }
  function open(owner, el) {
    closePop(); pop = el; popOwner = owner; owner.classList.add("open");
    document.body.appendChild(el); popPos = () => place(owner, el); popPos();
  }
  document.addEventListener("mousedown", (e) => { if (pop && !pop.contains(e.target) && !(popOwner && popOwner.contains(e.target))) closePop(); }, true);
  addEventListener("resize", () => closePop());
  addEventListener("scroll", (e) => { if (pop && !pop.contains(e.target)) { popPos ? popPos() : closePop(); } }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) { e.stopPropagation(); const o = popOwner; closePop(); o && o.querySelector && o.focus && o.focus(); } }, true);

  /* hook: quando código externo muda .value, o controle atualiza */
  function hookValue(el, refresh) {
    const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value"); if (!d) return;
    Object.defineProperty(el, "value", { get() { return d.get.call(this); }, set(v) { d.set.call(this, v); refresh(); }, configurable: true });
  }
  const fire = (el) => { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };

  /* ---------- lista suspensa ---------- */
  function enhanceSelect(sel) {
    if (sel.dataset.xs || sel.multiple || sel.size > 1) return; sel.dataset.xs = "1";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "xs-btn " + (sel.className || "");
    btn.setAttribute("aria-haspopup", "listbox"); btn.style.cssText = sel.style.cssText;
    sel.parentNode.insertBefore(btn, sel); sel.classList.add("xs-native"); sel.tabIndex = -1;
    const label = () => { const o = sel.options[sel.selectedIndex]; btn.innerHTML = `<span class="xs-t">${o ? esc(tcd(o.textContent)) : ""}</span>${CHEV}`; btn.disabled = sel.disabled; };
    label(); hookValue(sel, label);
    sel.addEventListener("change", label);
    new MutationObserver(label).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    const lb = sel.id && document.querySelector(`label[for="${sel.id}"]`); if (lb) lb.addEventListener("click", (e) => { e.preventDefault(); btn.focus(); });

    const norm = (t) => String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    function show(seed) {
      const el = document.createElement("div"); el.className = "xs-pop"; el.setAttribute("role", "listbox");
      const creator = sel.dataset.new && ERP.creators && ERP.creators[sel.dataset.new];
      const searchable = sel.options.length >= 6 || !!creator;
      let q = "", act = sel.selectedIndex, cur = [];
      const sb = document.createElement("input"); sb.type = "text"; sb.className = "xs-s"; sb.autocomplete = "off"; sb.placeholder = creator ? "Digite para buscar ou cadastrar…" : "Digite para buscar…"; sb.setAttribute("aria-label", "Buscar");
      const body = document.createElement("div"); body.className = "xs-b";
      if (searchable) el.append(sb); el.append(body);
      function render() {
        const nq = norm(q); cur = []; let html = "", lastG = null, exact = false;
        Array.from(sel.options).forEach((o, i) => {
          const t = o.textContent; if (nq && !norm(t).includes(nq)) return; if (norm(t) === nq) exact = true;
          const g = o.parentNode.tagName === "OPTGROUP" ? o.parentNode.label : null;
          if (g && g !== lastG) html += `<div class="xs-g">${esc(tcd(g))}</div>`; lastG = g;
          html += `<div class="xs-i${i === sel.selectedIndex ? " on" : ""}${o.disabled ? " off" : ""}" role="option" data-i="${i}"><span>${esc(tcd(t))}${o.dataset.desc ? `<small class="xs-d">${esc(o.dataset.desc)}</small>` : ""}</span>${i === sel.selectedIndex ? CHK : ""}</div>`; cur.push(i);
        });
        if (creator && nq && !exact) html += `<div class="xs-i xs-new" role="option" data-new="1"><span>+ Cadastrar “${esc(q.trim())}”</span></div>`;
        if (!cur.length && !(creator && nq && !exact)) html = `<div class="xs-empty">Nenhum item encontrado</div>`;
        body.innerHTML = html; if (!cur.includes(act)) act = cur.find((i) => !sel.options[i].disabled) ?? -1; mark();
      }
      const items = () => Array.from(body.querySelectorAll(".xs-i"));
      function mark() { const arr = items(); arr.forEach((n) => n.classList.remove("hv")); const n = arr.find((x) => !x.dataset.new && +x.dataset.i === act) || (act === -2 ? arr.find((x) => x.dataset.new) : null); if (n) { n.classList.add("hv"); n.scrollIntoView({ block: "nearest" }); } }
      render(); if (seed) { q = seed; sb.value = seed; render(); }
      open(btn, el); const onx = body.querySelector(".xs-i.on"); if (onx && !q) onx.scrollIntoView({ block: "nearest" });
      if (searchable) { sb.focus(); sb.setSelectionRange(sb.value.length, sb.value.length); }
      const pick = (i) => { const o = sel.options[i]; if (!o || o.disabled) return; closePop(); if (sel.selectedIndex !== i) { sel.selectedIndex = i; label(); fire(sel); } btn.focus(); };
      const create = async () => { const nome = q.trim(); if (!nome) return; closePop(); try { const r = await creator(nome, sel); if (r != null) { let o = Array.from(sel.options).find((x) => x.value === String(r)); if (!o) { o = document.createElement("option"); o.value = String(r); o.textContent = nome; sel.appendChild(o); } sel.value = String(r); label(); fire(sel); } } catch (e) { console.error(e); } btn.focus(); };
      el.addEventListener("mousedown", (e) => { if (e.target !== sb) e.preventDefault(); });
      el.addEventListener("click", (e) => { const n = e.target.closest(".xs-i"); if (!n) return; if (n.dataset.new) create(); else pick(+n.dataset.i); });
      el.addEventListener("mousemove", (e) => { const n = e.target.closest(".xs-i"); if (n && !n.dataset.new) { act = +n.dataset.i; mark(); } });
      const nav = (d) => { const ok = cur.filter((i) => !sel.options[i].disabled), hasNew = !!body.querySelector(".xs-new"); const seq = ok.concat(hasNew ? [-2] : []); if (!seq.length) return; let k = seq.indexOf(act); k = k < 0 ? (d > 0 ? 0 : seq.length - 1) : Math.min(seq.length - 1, Math.max(0, k + d)); act = seq[k]; mark(); };
      el._key = (e) => {
        if (e.key === "ArrowDown") nav(1); else if (e.key === "ArrowUp") nav(-1);
        else if (e.key === "Enter" || (e.key === " " && !searchable)) { if (act === -2 || (act === -1 && creator && q.trim())) create(); else if (act >= 0) pick(act); }
        else if (e.key === "Home" && !searchable) { act = cur[0]; mark(); } else if (e.key === "End" && !searchable) { act = cur[cur.length - 1]; mark(); }
        else if (e.key === "Tab") { closePop(); return; }
        else if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey) { q += e.key; clearTimeout(el._t); el._t = setTimeout(() => { q = ""; }, 700); const nq = norm(q), f = Array.from(sel.options).findIndex((o) => !o.disabled && norm(o.textContent).startsWith(nq)); if (f >= 0) { act = f; cur = Array.from(sel.options).map((_, i) => i); mark(); } }
        else return;
        e.preventDefault();
      };
      sb.addEventListener("input", () => { q = sb.value; render(); if (act === -1 && creator && q.trim() && body.querySelector(".xs-new") && !cur.length) act = -2; mark(); });
      sb.addEventListener("keydown", (e) => { if (["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(e.key)) { e.stopPropagation(); el._key(e); } });
      el._seedable = true;
    }
    btn.addEventListener("click", () => { if (pop && popOwner === btn) closePop(); else show(); });
    btn.addEventListener("keydown", (e) => {
      if (pop && popOwner === btn && pop._key) return pop._key(e);
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); show(e.key); }
    });
  }

  /* ---------- calendário ---------- */
  const fmt = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(8) + "/" + v.slice(5, 7) + "/" + v.slice(0, 4) : "");
  function parseBR(s) {
    const m = String(s).trim().match(/^(\d{1,2})\D+(\d{1,2})\D+(\d{4})$/); if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3]; const t = new Date(y, mo - 1, d);
    return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d ? iso(y, mo - 1, d) : null;
  }
  function enhanceDate(inp) {
    if (inp.dataset.xs) return; inp.dataset.xs = "1";
    const wrap = document.createElement("span"); wrap.className = "xd " + (inp.className || ""); wrap.style.cssText = inp.style.cssText;
    const txt = document.createElement("input"); txt.type = "text"; txt.className = "xd-t"; txt.placeholder = "dd/mm/aaaa"; txt.inputMode = "numeric"; txt.autocomplete = "off"; txt.maxLength = 10;
    const ic = document.createElement("button"); ic.type = "button"; ic.className = "xd-i"; ic.tabIndex = -1; ic.setAttribute("aria-label", "Abrir calendário"); ic.innerHTML = CAL;
    wrap.append(txt, ic); inp.parentNode.insertBefore(wrap, inp); inp.classList.add("xs-native"); inp.tabIndex = -1;
    const sync = () => { txt.value = fmt(inp.value); txt.disabled = inp.disabled; ic.disabled = inp.disabled; };
    sync(); hookValue(inp, sync); inp.addEventListener("change", sync);
    new MutationObserver(sync).observe(inp, { attributes: true, attributeFilter: ["disabled"] });
    if (inp.id) { const lb = document.querySelector(`label[for="${inp.id}"]`); if (lb) lb.addEventListener("click", (e) => { e.preventDefault(); txt.focus(); }); }
    const setV = (v) => { if (inp.value !== v) { inp.value = v; fire(inp); } sync(); };
    txt.addEventListener("input", () => {
      let d = txt.value.replace(/\D/g, "").slice(0, 8); let o = d;
      if (d.length > 4) o = d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4); else if (d.length > 2) o = d.slice(0, 2) + "/" + d.slice(2);
      txt.value = o; if (o.length === 10) { const v = parseBR(o); if (v) setV(v); }
    });
    txt.addEventListener("blur", () => { if (!txt.value.trim()) setV(""); else { const v = parseBR(txt.value); if (v) setV(v); else sync(); } });
    txt.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = parseBR(txt.value); if (v) setV(v); } if (e.key === "ArrowDown" && !pop) { e.preventDefault(); show(); } });

    function show() {
      const sel = inp.value || ""; const base = sel || hoje(); let vy = +base.slice(0, 4), vm = +base.slice(5, 7) - 1, mode = "dias";
      const el = document.createElement("div"); el.className = "xc"; el.addEventListener("mousedown", (e) => e.preventDefault());
      const draw = () => {
        if (mode === "meses") {
          el.innerHTML = `<div class="xc-h"><button type="button" class="xc-n" data-a="py">${PREV}</button><button type="button" class="xc-m" data-a="dias">${vy}</button><button type="button" class="xc-n" data-a="ny">${NEXT}</button></div><div class="xc-meses">${MESES.map((m, i) => `<button type="button" class="${i === vm ? "on" : ""}" data-m="${i}">${m.slice(0, 3)}</button>`).join("")}</div>`;
        } else {
          const first = new Date(vy, vm, 1).getDay(), dim = new Date(vy, vm + 1, 0).getDate(), prevDim = new Date(vy, vm, 0).getDate(); const t = hoje(); let cells = "";
          for (let i = 0; i < 42; i++) {
            let d = i - first + 1, y = vy, m = vm, out = false;
            if (d < 1) { d += prevDim; m--; out = true; } else if (d > dim) { d -= dim; m++; out = true; }
            if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
            const v = iso(y, m, d); cells += `<button type="button" class="xc-d${out ? " out" : ""}${v === sel ? " on" : ""}${v === t ? " today" : ""}" data-v="${v}">${d}</button>`;
            if (i === 34 && cells && !(first + dim > 35)) break;
          }
          el.innerHTML = `<div class="xc-h"><button type="button" class="xc-n" data-a="pm" aria-label="Mês anterior">${PREV}</button><button type="button" class="xc-m" data-a="meses">${MESES[vm]} de ${vy} ${CHEV}</button><button type="button" class="xc-n" data-a="nm" aria-label="Próximo mês">${NEXT}</button></div><div class="xc-w">${["D", "S", "T", "Q", "Q", "S", "S"].map((x) => `<span>${x}</span>`).join("")}</div><div class="xc-g">${cells}</div><div class="xc-f"><button type="button" data-a="limpar">Limpar</button><button type="button" class="hoje" data-a="hoje">Hoje</button></div>`;
        }
      };
      draw();
      el.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.v) { closePop(); setV(b.dataset.v); txt.focus(); return; }
        if (b.dataset.m) { vm = +b.dataset.m; mode = "dias"; return draw(); }
        const a = b.dataset.a;
        if (a === "pm") { if (--vm < 0) { vm = 11; vy--; } } else if (a === "nm") { if (++vm > 11) { vm = 0; vy++; } }
        else if (a === "py") vy--; else if (a === "ny") vy++; else if (a === "meses") mode = "meses"; else if (a === "dias") mode = "dias";
        else if (a === "limpar") { closePop(); setV(""); return; } else if (a === "hoje") { closePop(); setV(hoje()); return; }
        draw();
      });
      open(wrap, el); wrap.classList.add("open");
    }
    ic.addEventListener("click", () => { if (pop && popOwner === wrap) closePop(); else show(); });
    txt.addEventListener("focus", () => { /* abre só pelo ícone ou seta para baixo */ });
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches("select")) enhanceSelect(root); else if (root.matches && root.matches('input[type="date"]')) enhanceDate(root);
    root.querySelectorAll && root.querySelectorAll('select:not([data-xs]),input[type="date"]:not([data-xs])').forEach((n) => (n.tagName === "SELECT" ? enhanceSelect(n) : enhanceDate(n)));
  }
  let busy = false;
  new MutationObserver((ms) => { if (busy) return; busy = true; try { ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && !(n.classList && (n.classList.contains("xs-pop") || n.classList.contains("xc")))) scan(n); })); } finally { busy = false; } }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => scan(document.body));
  if (document.body) scan(document.body);
})();

