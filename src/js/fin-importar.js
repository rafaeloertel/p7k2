/* Finanças › Importar extrato (banco ou cartão) com conciliação — inspirado na importação da CAP do ERP NMB
   (lote com desfazer, aviso de duplicidade, casamento automático). Lê CSV (;,\t) e OFX. */
(function () {
  "use strict";
  const { $, $$, esc, uid, brl, num, todayISO, fdate, monthKey, monthLabel, parseNum, Store } = ERP;
  const F = ERP.fin; const D = F.D;
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const STOP = new Set("de da do das dos e em no na com para por pag pagto pagamento compra debito credito pix ted doc transf transferencia ltda me sa eireli".split(" "));
  const tokens = (s) => norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t));

  /* ---------- leitura de arquivos ---------- */
  function parseDate(s) {
    s = String(s || "").trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{2})$/); if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/^(\d{4})(\d{2})(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return "";
  }
  function parseOFX(txt) {
    const out = []; const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi; let m;
    const tag = (b, t) => { const r = new RegExp("<" + t + ">([^<\\r\\n]*)", "i").exec(b); return r ? r[1].trim() : ""; };
    while ((m = re.exec(txt))) { const b = m[1]; const dt = parseDate(tag(b, "DTPOSTED")); const v = parseFloat(String(tag(b, "TRNAMT")).replace(",", ".")); const d = tag(b, "MEMO") || tag(b, "NAME") || tag(b, "PAYEE"); if (dt && !isNaN(v)) out.push({ data: dt, desc: d, valor: v, ref: tag(b, "FITID") }); }
    return out;
  }
  function splitCSV(line, sep) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === sep && !q) { out.push(cur); cur = ""; } else cur += c; }
    out.push(cur); return out.map((x) => x.trim());
  }
  function parseCSV(txt) {
    const lines = txt.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    if (!lines.length) return [];
    const sep = [";", ",", "\t"].map((s) => [s, (lines[0].match(new RegExp("\\" + s, "g")) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
    const head = splitCSV(lines[0], sep).map((h) => norm(h));
    const idx = (names) => head.findIndex((h) => names.some((n) => h.includes(n)));
    let iD = idx(["data", "date", "dt "]), iDesc = idx(["descricao", "historico", "description", "memo", "lancamento", "estabelecimento", "titulo"]), iV = idx(["valor", "amount", "value", "montante"]);
    const iDeb = idx(["debito", "debit", "saida"]), iCre = idx(["credito", "credit", "entrada"]);
    const temHead = iD >= 0 && (iV >= 0 || iDeb >= 0 || iCre >= 0);
    const rows = temHead ? lines.slice(1) : lines;
    if (!temHead) { iD = 0; iDesc = 1; iV = 2; }
    const out = [];
    rows.forEach((l) => {
      const c = splitCSV(l, sep); const dt = parseDate(c[iD]); if (!dt) return;
      let v = null;
      if (iV >= 0 && c[iV] !== undefined && c[iV] !== "") v = parseNum(c[iV]);
      else if (iDeb >= 0 || iCre >= 0) { const deb = iDeb >= 0 ? parseNum(c[iDeb]) : 0, cre = iCre >= 0 ? parseNum(c[iCre]) : 0; v = cre - Math.abs(deb); }
      if (v == null || isNaN(v) || v === 0) return;
      /* sinal explícito em texto (D/C) */
      const dc = c.find((x) => /^[DC]$/i.test(x)); if (dc && /^D$/i.test(dc)) v = -Math.abs(v);
      out.push({ data: dt, desc: iDesc >= 0 ? c[iDesc] : c.filter((x) => isNaN(parseNum(x)) || x.length > 12).join(" "), valor: v });
    });
    return out;
  }
  function parseFile(name, txt) {
    if (/\.ofx$|\.qfx$/i.test(name) || /<OFX>|<STMTTRN>/i.test(txt)) return parseOFX(txt);
    return parseCSV(txt);
  }

  /* ---------- conciliação ---------- */
  const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  function sugerirCategoria(desc, tipo) {
    const tk = tokens(desc); if (!tk.length) return null;
    let best = null, bs = 0;
    D().lanc.forEach((l) => { if (!l.catId) return; if ((tipo === "receita") !== (l.tipo === "receita")) return; const lt = tokens(l.desc); const inter = tk.filter((t) => lt.includes(t)).length; if (inter > bs) { bs = inter; best = l; } });
    (D().favorecidos || []).forEach((f) => { const ft = tokens(f.nome); const inter = tk.filter((t) => ft.includes(t)).length; if (inter > bs && f.catId) { bs = inter; best = { catId: f.catId, favId: f.id, desc: f.nome }; } });
    return best ? { catId: best.catId, favId: best.favId || "", desc: best.desc } : null;
  }
  function conciliar(trans, origem) {
    const cc = origem.startsWith("cc:"); const oid = origem.slice(3); const d = D(); const usados = new Set();
    return trans.map((t) => {
      const tipo = t.valor < 0 ? "despesa" : "receita"; const abs = Math.abs(t.valor);
      const cand = d.lanc.filter((l) => !usados.has(l.id) && Math.abs(l.valor - abs) < 0.011 && Math.abs(diasEntre(l.venc || l.comp, t.data)) <= 5 && (cc ? l.tipo === "compra" && l.cartaoId === oid : (l.tipo === tipo && (l.contaId === oid || !l.contaId))));
      const aberto = cand.find((l) => !l.pago && !cc); const pago = cand.find((l) => l.pago || cc);
      let acao, lanc = null, motivo = "";
      if (aberto) { acao = "baixar"; lanc = aberto; usados.add(aberto.id); motivo = `casa com "${aberto.desc}" (${fdate(aberto.venc)})`; }
      else if (pago) { acao = "ignorar"; lanc = pago; usados.add(pago.id); motivo = `já lançado: "${pago.desc}"`; }
      else { acao = "criar"; const sg = sugerirCategoria(t.desc, tipo); motivo = sg ? `categoria sugerida por "${sg.desc}"` : "sem categoria sugerida"; t.sug = sg; }
      return Object.assign({}, t, { tipo, abs, acao, lanc, motivo });
    });
  }

  /* ---------- tela ---------- */
  function abrir() {
    const d = D();
    const origens = F.contasAtivas().map((c) => ["ct:" + c.id, "🏦 " + c.nome]).concat(d.cartoes.filter((c) => c.ativo !== false).map((c) => ["cc:" + c.id, "💳 " + c.nome]));
    const ult = (d.importacoes || []).slice(-1)[0];
    const m = ERP.modal(`<h2>Importar Extrato</h2>
      <p class="mut" style="margin-bottom:12px">Arquivo <b>CSV</b> ou <b>OFX</b> exportado do banco ou do cartão. O Hub casa cada linha com os lançamentos em aberto (mesmo valor, até 5 dias), marca como pago, e sugere criar o que falta. Dá para desfazer o lote inteiro.</p>
      <div class="fg"><div class="f"><label>Conta ou Cartão</label><select id="imOrig">${origens.map((o) => `<option value="${o[0]}">${esc(o[1])}</option>`).join("")}</select></div>
      <div class="f"><label>Arquivo</label><input type="file" id="imFile" accept=".csv,.txt,.ofx,.qfx"></div></div>
      <div id="imPrev" style="margin-top:12px"></div>
      <div class="act"><span class="sp"></span>${ult ? `<button type="button" class="btn ghost" id="imUndo" title="${esc(ult.em)}">Desfazer Última Importação (${ult.n})</button>` : ""}<button type="button" class="btn ghost" data-cancel>Fechar</button><button type="button" class="btn orange" id="imApply" disabled>Aplicar</button></div>`, { wide: true });
    $("[data-cancel]", m.el).onclick = m.close;
    let linhas = [];
    const prev = $("#imPrev", m.el), apply = $("#imApply", m.el);
    const cats = (tipo) => (ERP.finUI.catOpts(tipo === "receita" ? "receita" : "despesa")).map((x) => x[0] === "__grp" ? `<optgroup label="${esc(x[1])}"></optgroup>` : `<option value="${x[0]}">${esc(x[1])}</option>`).join("");
    function pintar() {
      if (!linhas.length) { prev.innerHTML = `<div class="empty">Nenhuma linha reconhecida. Confira se o arquivo tem colunas de data, descrição e valor.</div>`; apply.disabled = true; return; }
      const n = { baixar: 0, criar: 0, ignorar: 0 }; linhas.forEach((l) => n[l.acao]++);
      prev.innerHTML = `<div class="mut" style="margin-bottom:8px">${linhas.length} linha(s): <b>${n.baixar}</b> para baixar · <b>${n.criar}</b> para criar · <b>${n.ignorar}</b> ignoradas</div>
        <div class="tw" style="max-height:46vh;overflow:auto"><table><thead><tr><th>Data</th><th>Descrição</th><th class="r">Valor</th><th>Ação</th><th>Categoria / Motivo</th></tr></thead><tbody>${linhas.map((l, i) => `<tr><td style="white-space:nowrap">${fdate(l.data)}</td><td>${esc(l.desc)}</td><td class="r ${l.tipo === "receita" ? "pos" : "neg"}">${brl(l.abs)}</td><td><select data-ac="${i}" class="sm"><option value="baixar" ${l.acao === "baixar" ? "selected" : ""} ${l.lanc && !l.lanc.pago ? "" : "disabled"}>Baixar</option><option value="criar" ${l.acao === "criar" ? "selected" : ""}>Criar</option><option value="ignorar" ${l.acao === "ignorar" ? "selected" : ""}>Ignorar</option></select></td><td class="mut" style="font-size:12px">${l.acao === "criar" ? `<select data-cat="${i}" class="sm">${cats(l.tipo)}</select>` : esc(l.motivo)}</td></tr>`).join("")}</tbody></table></div>`;
      linhas.forEach((l, i) => { const cs = $(`[data-cat="${i}"]`, prev); if (cs) { cs.value = l.sug && [...cs.options].some((o) => o.value === l.sug.catId) ? l.sug.catId : cs.options[1] ? cs.options[1].value : ""; l.catId = cs.value; cs.onchange = () => { l.catId = cs.value; }; } });
      $$("[data-ac]", prev).forEach((sel) => (sel.onchange = () => { linhas[+sel.dataset.ac].acao = sel.value; pintar(); }));
      apply.disabled = !linhas.some((l) => l.acao !== "ignorar");
    }
    $("#imFile", m.el).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const buf = await f.arrayBuffer(); let txt = new TextDecoder("utf-8").decode(buf); if (/\uFFFD/.test(txt)) txt = new TextDecoder("windows-1252").decode(buf);
      const trans = parseFile(f.name, txt); linhas = conciliar(trans, $("#imOrig", m.el).value); pintar();
    };
    $("#imOrig", m.el).onchange = () => { if (linhas.length) { linhas = conciliar(linhas, $("#imOrig", m.el).value); pintar(); } };
    apply.onclick = () => {
      const origem = $("#imOrig", m.el).value; const cc = origem.startsWith("cc:"); const oid = origem.slice(3);
      const lote = uid("imp"); let nb = 0, ncr = 0;
      ERP.finUI.salvar((dd) => {
        linhas.forEach((l) => {
          if (l.acao === "baixar" && l.lanc) { const x = dd.lanc.find((y) => y.id === l.lanc.id); if (x && !x.pago) { x.pago = l.data; x.valorPago = l.abs; x.estimado = false; if (!cc) x.contaId = oid; x.lote = lote; x.hist = (x.hist || []).concat({ em: new Date().toISOString(), o: "Baixado pela importação do extrato" }); nb++; } }
          else if (l.acao === "criar") {
            const x = { id: uid("l"), desc: (l.sug && l.sug.desc && tokens(l.desc).length < 2 ? l.sug.desc : l.desc).slice(0, 80), catId: l.catId || "", favId: l.sug ? l.sug.favId || "" : "", valor: l.abs, notas: "Importado do extrato", forma: cc ? "Cartão de Crédito" : "", classe: "", centro: "", moeda: "BRL", lote, criado: Date.now(), hist: [{ em: new Date().toISOString(), o: "Criado pela importação do extrato" }] };
            if (cc) { const c = F.cartao(oid); Object.assign(x, { tipo: "compra", cartaoId: oid, comp: l.data, venc: l.data, fatura: c ? F.faturaDe(c, l.data).key : monthKey(l.data), pago: null }); }
            else Object.assign(x, { tipo: l.tipo, contaId: oid, comp: l.data, venc: l.data, pago: l.data, valorPago: l.abs });
            dd.lanc.push(x); ncr++;
          }
        });
        dd.importacoes = (dd.importacoes || []).concat({ id: lote, em: new Date().toLocaleString("pt-BR"), origem, n: nb + ncr, baixados: nb, criados: ncr }).slice(-10);
      });
      m.close(); ERP.toast(`Importação aplicada: ${nb} baixado(s), ${ncr} criado(s).`); ERP.render();
    };
    const undo = $("#imUndo", m.el); if (undo) undo.onclick = () => desfazer(ult.id, m);
  }
  function desfazer(lote, m) {
    ERP.confirm("Desfazer a última importação? Os lançamentos criados por ela são removidos e os baixados voltam a ficar em aberto.", "Desfazer").then((ok) => {
      if (!ok) return;
      ERP.finUI.salvar((dd) => {
        dd.lanc = dd.lanc.filter((l) => !(l.lote === lote && (l.hist || []).some((h) => /Criado pela importação/.test(h.o))));
        dd.lanc.forEach((l) => { if (l.lote === lote) { l.pago = null; l.valorPago = null; delete l.lote; l.hist = (l.hist || []).concat({ em: new Date().toISOString(), o: "Baixa desfeita (importação revertida)" }); } });
        dd.importacoes = (dd.importacoes || []).filter((i) => i.id !== lote);
      });
      if (m) m.close(); ERP.toast("Importação desfeita."); ERP.render();
    });
  }
  ERP.finImportar = { abrir, parseFile, conciliar, desfazer };
})();

