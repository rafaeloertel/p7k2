/* Finanças Pessoais — telas (painel, lançamentos, agenda, cartões, fluxo de caixa, orçamento, dívidas, metas e planejamento, relatórios, cadastros) */
(function () {
  "use strict";
  const { $, $$, esc, uid, brl, num, todayISO, fdate, monthKey, monthLabel, addMonths, parseNum, Store } = ERP;
  const F = ERP.fin;
  const D = F.D;
  /* lista de meses para a competência: 18 para trás, 36 para a frente, sempre incluindo o atual e o do lançamento */
  const mesesOpts = (atual) => { const hoje = todayISO().slice(0, 7); const set = new Set([atual, hoje]); for (let i = -18; i <= 36; i++) set.add(monthKey(addMonths(hoje + "-01", i))); return Array.from(set).sort().map((mk) => [mk, monthLabel(mk)]); };
  const descBase = (d) => String(d || "").replace(/\s*\(\d+\/\d+\)\s*$/, "");
  /* muda o total de um parcelamento: acrescenta parcelas no fim (copiando a última) ou tira as últimas em aberto. Retorna quantas entraram (+) ou saíram (−). */
  function ajustarParcelas(dd, g, novoT) {
    const grupo = dd.lanc.filter((y) => y.parcela && y.parcela.g === g).sort((a, b) => a.parcela.n - b.parcela.n); if (!grupo.length) return 0;
    const oldT = grupo[grupo.length - 1].parcela.t, base = descBase(grupo[0].desc); let delta = 0;
    if (novoT > oldT) {
      const ult = grupo[grupo.length - 1];
      for (let n = oldT + 1; n <= novoT; n++) { const k = n - ult.parcela.n; const x = JSON.parse(JSON.stringify(ult)); x.id = uid("l"); x.criado = Date.now(); x.pago = null; x.valorPago = null; x.hist = []; x.anexos = []; x.parcela = { g, n, t: novoT };
        x.comp = addMonths(ult.comp, k); if (x.tipo === "compra") { x.fatura = F.mesSeg(ult.fatura, k); } else { x.venc = addMonths(ult.venc, k); }
        hist(x, `Parcela acrescentada (total ${oldT} → ${novoT})`); dd.lanc.push(x); delta++; }
    } else if (novoT < oldT) {
      const sai = grupo.filter((y) => y.parcela.n > novoT && !y.pago && !F.travado(y)); const ids = new Set(sai.map((y) => y.id)); dd.lanc = dd.lanc.filter((y) => !ids.has(y.id)); delta = -sai.length;
    }
    dd.lanc.forEach((y) => { if (y.parcela && y.parcela.g === g) { y.parcela.t = novoT; y.desc = `${base} (${y.parcela.n}/${novoT})`; } });
    return delta;
  }
  const S = { mk: monthKey(todayISO()), q: "", tipo: "", sit: "", cat: "", origem: "", card: "", ano: new Date().getFullYear(), extra: 500, metodo: "avalanche", agenda: "pagar", dreAno: new Date().getFullYear(), sel: new Set() };
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const hist = (l, o) => { (l.hist = l.hist || []).push({ em: new Date().toISOString(), o }); };
  const salvar = (fn) => { Store.change("financas", (d) => { fn(d); F.materializar(d); }); try { F.sincronizarLembretes(); } catch (e) { console.error(e); } };

  /* ---------- peças de tela ---------- */
  const pill = (s) => `<span class="pill ${s.cls}">${esc(s.n)}</span>`;
  const sinal = (v) => `<span class="${v < 0 ? "neg" : v > 0 ? "pos" : ""}">${brl(v)}</span>`;
  const MESES_ABR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const mesNav = () => `<button class="btn ghost sm" data-mes="-1" aria-label="Mês anterior">‹</button><button type="button" class="fin-mes" data-mespick title="Escolher mês e ano">${monthLabel(S.mk)} <span class="mut" style="font-size:10px">▾</span></button><button class="btn ghost sm" data-mes="1" aria-label="Próximo mês">›</button>${S.mk !== monthKey(todayISO()) ? `<button class="btn ghost sm" data-mes="hoje" title="Voltar ao mês atual">Hoje</button>` : ""}`;
  const irMes = (mk) => { S.mk = mk; F.materializarAte(S.mk); ERP.render(); };
  function mesPicker(anchor) {
    document.querySelectorAll(".mp-pop").forEach((e) => e.remove());
    let ano = +S.mk.slice(0, 4); const pop = document.createElement("div"); pop.className = "xs-pop mp-pop";
    const draw = () => { pop.innerHTML = `<div class="mp-head"><button type="button" class="btn ghost sm" data-y="-1">‹</button><b>${ano}</b><button type="button" class="btn ghost sm" data-y="1">›</button></div><div class="mp-grid">${MESES_ABR.map((m, i) => { const k = ano + "-" + String(i + 1).padStart(2, "0"); return `<button type="button" class="${k === S.mk ? "on" : ""}${k === monthKey(todayISO()) ? " hoje" : ""}" data-k="${k}">${m}</button>`; }).join("")}</div><div class="mp-foot"><button type="button" class="btn ghost sm" data-k="${monthKey(todayISO())}">Hoje</button></div>`; };
    draw(); document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + "px"; pop.style.top = (r.bottom + 6) + "px";
    pop.addEventListener("click", (e) => { const y = e.target.closest("[data-y]"); if (y) { ano += +y.dataset.y; draw(); return; } const k = e.target.closest("[data-k]"); if (k) { pop.remove(); irMes(k.dataset.k); } });
    const close = (e) => { if (!pop.contains(e.target) && e.target !== anchor) { pop.remove(); document.removeEventListener("mousedown", close, true); } };
    setTimeout(() => document.addEventListener("mousedown", close, true), 0);
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { pop.remove(); document.removeEventListener("keydown", esc, true); } }, true);
  }
  const bindMes = (root) => { $$("[data-mes]", root).forEach((b) => (b.onclick = () => irMes(b.dataset.mes === "hoje" ? monthKey(todayISO()) : F.mesSeg(S.mk, +b.dataset.mes)))); $$("[data-mespick]", root).forEach((b) => (b.onclick = () => mesPicker(b))); };

  const catOpts = (tipo, sel) => { const gs = []; const by = {}; D().categorias.filter((c) => c.ativa !== false && (!tipo || c.tipo === tipo || (tipo === "despesa" && c.tipo === "despesa"))).forEach((c) => { if (!by[c.grupo]) { by[c.grupo] = []; gs.push(c.grupo); } by[c.grupo].push(c); }); const out = []; gs.forEach((g) => { out.push(["__grp", g]); by[g].forEach((c) => out.push([c.id, c.nome])); }); return out; };
  const FORMAS = ["Pix", "Débito", "Boleto", "Débito Automático", "Transferência", "Dinheiro", "Cartão de Crédito"];
  const FREQ = [["1", "Mensal"], ["2", "Bimestral"], ["3", "Trimestral"], ["6", "Semestral"], ["12", "Anual"]];
  const freqLabel = (p) => (FREQ.find((f) => +f[0] === (p || 1)) || ["", "a cada " + (p || 1) + " meses"])[1];
  const formaOpts = () => [["", "—"]].concat(FORMAS.concat((D().formas || []).filter((x) => !FORMAS.includes(x))).map((x) => [x, x]));
  /* cadastro rápido a partir das listas (digitar um item que não existe) */
  ERP.creators = ERP.creators || {};
  ERP.creators.categoria = (nome, sel) => { nome = (ERP.tcPt || ((x)=>x))(nome.trim());
    const fm = sel.form, tipo = fm && fm.elements.tipo ? fm.elements.tipo.value : "despesa", rec = tipo === "receita";
    const ja = D().categorias.find((c) => c.nome.toLowerCase() === nome.toLowerCase() && (c.tipo === "receita") === rec); let id = ja && ja.id;
    const cur = D().categorias.find((c) => c.id === sel.value);
    Store.change("financas", (dd) => {
      if (ja) { dd.categorias.find((c) => c.id === ja.id).ativa = true; return; }
      id = uid("c"); const base = cur && (cur.tipo === "receita") === rec ? cur : null;
      dd.categorias.push({ id, nome, grupo: base ? base.grupo : "Outros", tipo: rec ? "receita" : "despesa", natureza: base ? base.natureza : rec ? "receita" : "estilo", fixo: false, cor: base ? base.cor : "#5B6068", ativa: true });
    });
    ERP.toast(`Categoria "${nome}" cadastrada${cur && cur.grupo && !ja ? " em " + cur.grupo : ""}. Ajuste grupo e natureza em Orçamento > Categorias.`); return id;
  };
  ERP.creators.forma = (nome) => { nome = (ERP.tcPt || ((x)=>x))(nome.trim()); const ja = FORMAS.concat(D().formas || []).find((x) => x.toLowerCase() === nome.toLowerCase()); if (ja) return ja; Store.change("financas", (dd) => { dd.formas = (dd.formas || []).concat(nome); }); ERP.toast(`Forma de pagamento "${nome}" cadastrada.`); return nome; };
  const favOpts = () => [["", "—"]].concat((D().favorecidos || []).filter((f) => f.ativo !== false).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((f) => [f.id, f.nome]));
  ERP.creators.favorecido = (nome) => { nome = (ERP.tcPt || ((x) => x))(nome.trim()); const ja = (D().favorecidos || []).find((f) => f.nome.toLowerCase() === nome.toLowerCase()); if (ja) return ja.id; const id = uid("fv"); Store.change("financas", (dd) => { dd.favorecidos = (dd.favorecidos || []).concat({ id, nome, catId: "", classe: "", centro: "", forma: "", moeda: "BRL", ultimoValor: null, ultimaData: "", dia: null, ativo: true }); }); ERP.toast(`Favorecido "${nome}" cadastrado. Os padrões são aprendidos deste lançamento.`); return id; };
  /* Favoritos: estrela por aparelho (como na CAP do NMB) */
  const FAV = { get: () => ERP.lsGet("fav", { lanc: [], series: [], dividas: [] }), has: (k, id) => FAV.get()[k].includes(id), toggle: (k, id) => { const f = FAV.get(); f[k] = f[k].includes(id) ? f[k].filter((x) => x !== id) : f[k].concat(id); ERP.lsSet("fav", f); } };
  const star = (k, id) => `<button type="button" class="star${FAV.has(k, id) ? " on" : ""}" data-star="${k}|${id}" title="${FAV.has(k, id) ? "Tirar dos favoritos" : "Acompanhar (favorito)"}">${FAV.has(k, id) ? "★" : "☆"}</button>`;
  const bindStars = (root) => $$("[data-star]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const [k, id] = b.dataset.star.split("|"); FAV.toggle(k, id); ERP.render(); }));
  const centroOpts = () => [["", "—"]].concat((D().centros || []).slice().sort((a, b) => a.localeCompare(b, "pt-BR")).map((x) => [x, x]));
  /* conta criada na hora, de dentro de qualquer formulário (corrente por padrão; saldo inicial e detalhes em Cadastros › Contas) */
  ERP.creators.conta = (nome) => {
    nome = (ERP.tcPt || ((x) => x))(nome.trim()); const ja = D().contas.find((c) => c.nome.toLowerCase() === nome.toLowerCase()); if (ja) return ja.id;
    const id = uid("ct"); Store.change("financas", (dd) => { dd.contas.push({ id, nome, tipo: "corrente", banco: "", saldoIni: 0, dataIni: todayISO(), limite: 0, jurosCheque: 8, ativa: true }); });
    ERP.toast(`Conta "${nome}" cadastrada. Saldo inicial e detalhes em Cadastros › Contas.`); return id;
  };
  ERP.creators.origem = (nome) => "ct:" + ERP.creators.conta(nome);
  ERP.creators.centro = (nome) => { nome = (ERP.tcPt || ((x)=>x))(nome.trim()); const ja = (D().centros || []).find((x) => x.toLowerCase() === nome.toLowerCase()); if (ja) return ja; Store.change("financas", (dd) => { dd.centros = (dd.centros || []).concat(nome); }); ERP.toast(`Centro de custo "${nome}" cadastrado.`); return nome; };
  const origemOpts = (comCartao) => F.contasAtivas().map((c) => ["ct:" + c.id, "🏦 " + c.nome]).concat(comCartao ? D().cartoes.filter((c) => c.ativo !== false).map((c) => ["cc:" + c.id, "💳 " + c.nome]) : []);
  const regimeTgl = () => `<div class="tabs fin-tgl" role="group" aria-label="Regime"><button class="${D().cfg.regime === "caixa" ? "on" : ""}" data-reg="caixa" title="Quando o dinheiro entra e sai da conta">Caixa</button><button class="${D().cfg.regime === "competencia" ? "on" : ""}" data-reg="competencia" title="Quando a despesa acontece (compra no cartão conta na data da compra; inclui previstos)">Competência</button>${ERP.help("competencia")}</div>`;
  const bindReg = (root) => $$("[data-reg]", root).forEach((b) => (b.onclick = () => { Store.change("financas", (d) => { d.cfg.regime = b.dataset.reg; }); ERP.render(); }));

  /* gráfico de barras pares (azul = entradas, laranja = saídas) */
  function barras(pts) {
    const mx = Math.max(1, ...pts.map((p) => Math.max(p.a, p.b)));
    return `<div class="cols6">${pts.map((p) => `<div class="c"><div class="pair"><i style="height:${(p.a / mx) * 100}%" title="${esc(p.l)} · entradas ${brl(p.a)}"></i><i class="o" style="height:${(p.b / mx) * 100}%" title="${esc(p.l)} · saídas ${brl(p.b)}"></i></div><small>${esc(p.l)}</small></div>`).join("")}</div>`;
  }
  /* linha do saldo projetado (SVG, com linha do zero) */
  function linha(pts) {
    const W = 640, H = 170, pad = 30; if (!pts.length) return "";
    const vs = pts.map((p) => p.v); const mx = Math.max(0, ...vs), mn = Math.min(0, ...vs); const rg = mx - mn || 1;
    const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, pts.length - 1), y = (v) => 12 + ((mx - v) * (H - 34)) / rg;
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const area = path + ` L${x(pts.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
    return `<div class="tw" style="border:0"><svg viewBox="0 0 ${W} ${H}" class="fin-svg" role="img" aria-label="Saldo Projetado">
      <path d="${area}" class="fin-area"/><line x1="${pad}" x2="${W - pad}" y1="${y(0)}" y2="${y(0)}" class="fin-zero"/>
      <path d="${path}" class="fin-line"/>${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="${i === pts.length - 1 ? 4 : 2.5}" class="${p.v < 0 ? "fin-dot neg" : "fin-dot"}"><title>${esc(p.l)} · ${brl(p.v)}</title></circle>`).join("")}
      ${pts.map((p, i) => (i % Math.ceil(pts.length / 6) === 0 || i === pts.length - 1) ? `<text x="${x(i)}" y="${H - 4}" text-anchor="middle" class="fin-tx">${esc(p.l)}</text>` : "").join("")}
      <text x="${pad - 4}" y="${y(mx) + 4}" text-anchor="end" class="fin-tx">${num(mx / 1000, 0)}k</text><text x="${pad - 4}" y="${y(mn) + 4}" text-anchor="end" class="fin-tx">${num(mn / 1000, 0)}k</text></svg></div>`;
  }

  /* ---------- lançamento: criar / editar ---------- */
  function lancForm(l, pre) {
    const d = D(); const novo = !l; pre = pre || {};
    if (l && F.travado(l)) { ERP.toast("Mês fechado: reabra o mês em Cadastros › Fechamento para alterar."); return; }
    l = l || { tipo: pre.tipo || "despesa", comp: todayISO(), venc: todayISO(), contaId: (F.contasAtivas()[0] || {}).id, catId: pre.catId || "" };
    const serie = l.serieId ? d.series.find((y) => y.id === l.serieId) : null;
    const origem = l.cartaoId ? "cc:" + l.cartaoId : "ct:" + (l.contaId || "");
    const fields = [
      { k: "tipo", label: "Tipo", type: "select", value: l.tipo === "compra" ? "despesa" : l.tipo, options: [["despesa", "Despesa (−)"], ["receita", "Receita (+)"], ["transferencia", "Transferência entre Contas"]] },
      { k: "valor", label: "Valor", type: "number", step: "0.01", money: true, value: l.moeda === "USD" ? l.valorMoeda : l.valor, required: true, hint: novo ? "No parcelado, o total." : "" },
      { k: "moeda", label: "Moeda", type: "select", value: l.moeda === "USD" ? "USD" : "BRL", options: [["BRL", "R$ (real)"], ["USD", "US$ (dólar)"]] },
      { k: "favId", label: "Favorecido", type: "select", creatable: "favorecido", value: l.favId || "", options: favOpts(), hint: "Quem recebe (Enel, Netflix, academia…). Escolher preenche categoria, forma, centro, moeda e o último valor." },
      { k: "desc", label: "Descrição", value: l.desc, full: true, required: true, placeholder: "Ex.: Mercado, Aluguel, Salário" },
      { k: "catId", label: "Categoria", type: "select", creatable: "categoria", value: l.catId, options: catOpts("despesa") },
      { k: "origem", label: "Pago com / Recebido em", type: "select", creatable: "origem", value: origem, options: origemOpts(true) },
      { k: "paraId", label: "Para a Conta", type: "select", creatable: "conta", value: l.paraId || "", options: F.contasAtivas().map((c) => [c.id, c.nome]) },
      { k: "forma", label: "Forma de Pagamento", type: "select", creatable: "forma", value: l.forma || "", options: formaOpts() },
      { k: "classe", label: "Classificação", type: "select", value: l.classe || "", options: [["", "Pela Categoria", "Usa a natureza da categoria (necessidades, estilo de vida, financeiro, investimento)."]].concat(F.CLASSES.map((x) => [x[0], x[1], x[3]])), hint: l.classe && F.CLS_DESC[l.classe] ? F.CLS_DESC[l.classe] : "Usa a natureza da categoria. Só Fixo e Variável sugerem recorrência." },
      { k: "centro", label: "Centro de Custo", type: "select", creatable: "centro", value: l.centro || "", options: centroOpts(), hint: "Para separar os gastos por área, projeto ou pessoa (ex.: Casa, Carro, NMB). Digite para buscar ou cadastrar um novo." },
      { k: "compMes", label: "Competência", type: "select", value: (l.comp || todayISO()).slice(0, 7), options: mesesOpts((l.comp || todayISO()).slice(0, 7)), hint: "Mês a que o lançamento pertence" },
      { k: "compData", label: "Data da Compra", type: "date", value: l.comp, hint: "Define em qual fatura a compra entra" },
      { k: "venc", label: "Vencimento", type: "date", value: l.venc, hint: "Quando sai ou entra o dinheiro" },
    ];
    if (novo) fields.push({ k: "parcelas", label: "Parcelas", type: "number", step: "1", value: 1, hint: "Quantas vezes. No cartão, uma por fatura; na conta, uma por mês" }, { k: "repetir", label: "Recorrência", type: "select", value: pre.repetir || "0", options: [["0", "Não se Repete"]].concat(FREQ), hint: "Mensal (aluguel), Bimestral (condomínio), Anual (IPTU, seguro)… O valor vira a estimativa dos próximos; ao pagar, corrija o real só daquele mês." }, { k: "duracao", label: "Por Quantas Vezes", type: "number", step: "1", value: 0, hint: "Digite o número de ocorrências. 0 = sempre (sem fim)." });
    else if (!l.serieId && ["despesa", "receita", "compra"].includes(l.tipo)) fields.push({ k: "repetir", label: "Recorrência", type: "select", value: "0", options: [["0", "Não se Repete"]].concat(FREQ), hint: "Transformar este lançamento em recorrente, a partir deste mês." }, { k: "duracao", label: "Por Quantas Vezes", type: "number", step: "1", value: 0, hint: "Digite o número de ocorrências. 0 = sempre (sem fim)." });
    if (!novo && l.parcela && l.parcela.g) fields.push({ k: "parcTotal", label: "Parcelas (total)", type: "number", step: "1", value: l.parcela.t, hint: `Esta é a ${l.parcela.n}ª de ${l.parcela.t}. Aumente para acrescentar parcelas no fim; diminua para tirar as últimas em aberto.` });
    else if (serie) fields.push({ k: "repetir", label: "Recorrência", type: "select", value: String(serie.passo || 1), options: FREQ, hint: `Este lançamento faz parte de uma recorrência ${freqLabel(serie.passo)}${serie.fim ? " · termina em " + monthLabel(monthKey(serie.fim)) : " · sem data de fim"}. Mudar aqui altera a frequência de toda a série a partir deste mês.` });
    fields.push({ k: "jaPago", label: "Já Foi Pago / Recebido", type: "checkbox", value: novo ? false : !!l.pago }, { k: "notas", label: "Anotações", value: l.notas, full: true });
    if (!novo) fields.push({ type: "html", k: "_anx", html: `<div class="anx"><label>Comprovantes e Documentos</label>${(l.anexos || []).length ? `<div class="anx-list">${l.anexos.map((a) => `<a class="anx-it" href="${a.path ? "#" : esc(a.url || "#")}" ${a.path ? `data-anx-open="${esc(a.path)}"` : 'target="_blank" rel="noopener"'}>📎 ${esc(a.name)}</a><button type="button" class="ib del" data-anx-del="${esc(a.id)}" title="Remover">✕</button>`).join("")}</div>` : `<div class="mut" style="font-size:12px">Nenhum anexo.</div>`}${ERP.Cloud && ERP.Cloud.account ? `<div class="toolbar" style="margin-top:8px"><label class="btn ghost sm" style="cursor:pointer">Anexar comprovante / nota <input type="file" data-anx-file hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.xml"></label><span class="mut" style="font-size:11.5px">guardado na nuvem, só na sua conta · Comprovantes/${(l.venc || l.comp || "").slice(0, 7).replace("-", "/")}</span></div>` : `<div class="mut" style="font-size:11.5px">Entre com a Microsoft para anexar.</div>`}</div>` });
    if (!novo && l.hist && l.hist.length) fields.push({ type: "html", k: "_h", html: `<details class="fin-hist"><summary>Histórico (${l.hist.length})</summary>${l.hist.slice().reverse().map((h) => `<div><span class="mut">${new Date(h.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span> · ${esc(h.o)}</div>`).join("")}</details>` });
    const m = ERP.form({
      title: novo ? "Novo Lançamento" : "Editar Lançamento" + (l.parcela ? ` (${l.parcela.n}/${l.parcela.t})` : ""), wide: true, fields, intro: !novo && l.estimado && !l.pago ? `Lançamento de uma recorrência <b>${freqLabel(serie ? serie.passo : 1)}</b>, com valor <b>estimado</b> — confirme o valor real da fatura ao salvar.` : (serie ? `Faz parte de uma recorrência <b>${freqLabel(serie.passo)}</b> (favorecido, categoria, forma e frequência vêm do cadastro).` : ""),
      extra: !novo && l.serieId ? [{ label: "Cancelar a recorrência a partir deste mês", fn: (v, md) => { ERP.confirm(`Encerrar "${l.desc}" a partir de ${monthLabel(monthKey(l.venc))}? Os lançamentos em aberto deste mês em diante saem; os pagos ficam.`, "Encerrar").then((ok) => { if (!ok) return; md.close(); salvar((dd) => { dd.lanc = dd.lanc.filter((y) => !(y.serieId === l.serieId && !y.pago && y.serieMes >= monthKey(l.venc))); dd.series = dd.series.filter((y) => y.id !== l.serieId); dd.lanc.forEach((y) => { if (y.serieId === l.serieId) { y.serieId = null; delete y.serieMes; } }); }); ERP.toast("Recorrência encerrada e removida."); ERP.render(); }); } }] : null,
      init(fm, md) {
        const sync = () => {
          const t = fm.elements.tipo.value; const o = fm.elements.origem.value; const cc = o.startsWith("cc:");
          fm.elements.catId.innerHTML = catOpts(t === "receita" ? "receita" : "despesa").map((x) => x[0] === "__grp" ? `<optgroup label="${esc(x[1])}"></optgroup>` : `<option value="${x[0]}">${esc(x[1])}</option>`).join("");
          if (l.catId && [...fm.elements.catId.options].some((op) => op.value === l.catId)) fm.elements.catId.value = l.catId;
          md.show("catId", t !== "transferencia"); md.show("paraId", t === "transferencia");
          [...fm.elements.origem.options].forEach((op) => { op.hidden = op.value.startsWith("cc:") && t !== "despesa"; });
          if (t !== "despesa" && cc) fm.elements.origem.value = (fm.elements.origem.options[0] || {}).value;
          md.show("venc", !cc); md.show("compMes", !cc); md.show("compData", cc); md.show("jaPago", !(fm.elements.origem.value.startsWith("cc:")));
          md.show("classe", t === "despesa" && !fm.elements.origem.value.startsWith("cc:")); md.show("forma", t !== "transferencia");
          if (fm.elements.origem.value.startsWith("cc:") && !fm.elements.forma.value) fm.elements.forma.value = "Cartão de Crédito";
          if (fm.elements.duracao) md.show("duracao", fm.elements.repetir.value !== "0");
        };
        fm.elements.tipo.onchange = sync; fm.elements.origem.onchange = sync;
        /* ao classificar como fixo ou variável num lançamento novo, a recorrência mensal já vem marcada (dá para trocar) */
        let repTocou = false;
        if (fm.elements.repetir) { md.show("duracao", fm.elements.repetir.value !== "0"); fm.elements.repetir.addEventListener("change", () => { md.show("duracao", fm.elements.repetir.value !== "0"); }); }
        fm.elements.classe.addEventListener("change", () => { const cl = fm.elements.classe.value; const h = md.el.querySelector('[data-fk=classe] small'); if (h) h.textContent = F.CLS_DESC[cl] || "Usa a natureza da categoria. Só Fixo e Variável sugerem recorrência."; if (novo && fm.elements.repetir && !repTocou) { fm.elements.repetir.value = ["fixo", "variavel"].includes(cl) ? "1" : "0"; md.show("duracao", fm.elements.repetir.value !== "0"); } });
        if (novo && fm.elements.repetir) fm.elements.repetir.addEventListener("change", () => { repTocou = true; md.show("duracao", fm.elements.repetir.value !== "0"); });
        const valEl = fm.elements.valor; const dolar = () => (ERP.investimentos && ERP.investimentos.fx && +ERP.investimentos.fx()) || 0;
        let moedaAnt = fm.elements.moeda.value; const syncMoeda = () => { const usdSel = fm.elements.moeda.value === "USD"; const r0 = dolar(); const atual = ERP.parseNum(valEl.value); if (moedaAnt !== fm.elements.moeda.value && atual && r0) { valEl.value = usdSel ? F.r2(atual / r0) : F.r2(atual * r0); } moedaAnt = fm.elements.moeda.value; ERP.moneyCur(valEl, usdSel ? "USD" : "BRL"); const h = md.el.querySelector('[data-fk=moeda] small') || (() => { const sm = document.createElement("small"); sm.className = "mut"; sm.style.fontSize = "11.5px"; md.el.querySelector('[data-fk=moeda]').appendChild(sm); return sm; })(); const r = dolar(); if (usdSel) h.innerHTML = r ? `Fica em dólar. O valor em real é recalculado pela cotação do dia (hoje R$ ${num(r, 4)}) até ser pago.` : `Defina a cotação do dólar em Investimentos › Atualizar Cotações.`; else h.textContent = ""; };
        fm.elements.moeda.onchange = syncMoeda; syncMoeda();
        if (fm.elements.favId) fm.elements.favId.addEventListener("change", () => {
          const f = F.favorecido(fm.elements.favId.value); if (!f) return;
          if (novo && f.origem && fm.elements.origem && [...fm.elements.origem.options].some((o) => o.value === f.origem && !o.hidden)) { fm.elements.origem.value = f.origem; sync(); }
          if (!fm.elements.desc.value.trim()) fm.elements.desc.value = f.nome;
          if (f.catId && [...fm.elements.catId.options].some((o) => o.value === f.catId)) fm.elements.catId.value = f.catId;
          if (f.classe && fm.elements.classe) { fm.elements.classe.value = f.classe; fm.elements.classe.dispatchEvent(new Event("change")); }
          if (f.centro && fm.elements.centro) fm.elements.centro.value = f.centro;
          if (f.forma && fm.elements.forma) fm.elements.forma.value = f.forma;
          const vazio = !ERP.parseNum(valEl.value);
          if (novo && vazio && f.moeda && fm.elements.moeda.value !== f.moeda) { fm.elements.moeda.value = f.moeda; syncMoeda(); }
          if (vazio && f.ultimoValor && (f.moeda || "BRL") === fm.elements.moeda.value) valEl.value = f.ultimoValor;
          if (novo && f.dia && fm.elements.venc) { const base = fm.elements.venc.value || todayISO(); const d = new Date(base.slice(0, 4), +base.slice(5, 7) - 1, Math.min(f.dia, 28)); fm.elements.venc.value = d.toISOString().slice(0, 10); }
        });
        fm.elements.compMes.onchange = () => { if (novo && fm.elements.venc.value.slice(0, 7) < fm.elements.compMes.value) fm.elements.venc.value = fm.elements.compMes.value + "-" + (fm.elements.venc.value.slice(8, 10) || "01"); };
        const anxIn = md.el.querySelector("[data-anx-file]"); if (anxIn) anxIn.onchange = async (e) => {
          const file = e.target.files[0]; if (!file) return; if (file.size > 25 * 1024 * 1024) { ERP.toast("Arquivo acima de 25 MB."); return; }
          const ym = (l.venc || l.comp || todayISO()).slice(0, 7).split("-"); const safe = file.name.replace(/[^\w.\-]+/g, "_");
          ERP.toast("Enviando anexo…");
          try { const it = await ERP.Cloud.uploadFile(`Comprovantes/${ym[0]}/${ym[1]}/${l.id}_${Date.now().toString(36)}_${safe}`, file); Store.change("financas", (dd) => { const x = dd.lanc.find((y) => y.id === l.id); if (x) x.anexos = (x.anexos || []).concat({ id: it.id, name: it.name, path: it.path, em: todayISO() }); }); ERP.toast("Anexo guardado na nuvem."); md.close(); lancForm(D().lanc.find((y) => y.id === l.id)); }
          catch (err) { console.error(err); ERP.toast("Não foi possível anexar: " + (err.message || err)); }
        };
        md.el.querySelectorAll("[data-anx-open]").forEach((a) => (a.onclick = async (ev) => { ev.preventDefault(); try { const url = await ERP.Cloud.fileUrl(a.dataset.anxOpen); window.open(url, "_blank", "noopener"); } catch (err) { ERP.toast("Não foi possível abrir o anexo: " + (err.message || err)); } }));
        md.el.querySelectorAll("[data-anx-del]").forEach((b) => (b.onclick = async () => { if (!(await ERP.confirm("Remover este anexo do lançamento? O arquivo também é apagado da nuvem.", "Remover"))) return; const id = b.dataset.anxDel; const ax = (l.anexos || []).find((a) => a.id === id); if (ax && ax.path && ERP.Cloud && ERP.Cloud.deleteItem) ERP.Cloud.deleteItem(ax.path); Store.change("financas", (dd) => { const x = dd.lanc.find((y) => y.id === l.id); if (x) x.anexos = (x.anexos || []).filter((a) => a.id !== id); }); md.close(); lancForm(D().lanc.find((y) => y.id === l.id)); }));
        sync();
      },
      onSubmit(v, md) {
        if (!(v.valor > 0)) { ERP.toast("Informe um valor maior que zero."); return false; }
        if (!v.desc.trim()) { ERP.toast("Informe a descrição."); return false; }
        const [ok, oid] = v.origem.split(":"); const cc = ok === "cc" && v.tipo === "despesa";
        if (v.tipo === "transferencia" && v.paraId === oid) { ERP.toast("Escolha contas diferentes na transferência."); return false; }
        /* competência: no cartão é a data da compra (decide a fatura); na conta é o mês escolhido, no dia do vencimento (ou o dia original ao editar) */
        if (cc) v.comp = v.compData || todayISO();
        else { const mk = v.compMes || todayISO().slice(0, 7); const dia = (!novo && l.comp && l.comp.slice(0, 7) === mk) ? l.comp.slice(8, 10) : (v.venc && v.venc.slice(0, 7) === mk ? v.venc.slice(8, 10) : "01"); v.comp = F.diaNoMes ? F.diaNoMes(mk, +dia) : mk + "-" + dia; }
        if (!v.venc || cc) v.venc = v.comp;
        if (novo && [v.comp, v.venc].some((dt) => F.mesFechado(monthKey(dt)))) { ERP.toast("Esse mês está fechado. Reabra em Cadastros › Fechamento."); return false; }
        if (novo && !md._dupOk) { const nq = norm(v.desc), mk0 = monthKey(v.venc || v.comp); const dup = D().lanc.find((y) => y.tipo === v.tipo && monthKey(y.venc || y.comp) === mk0 && norm(y.desc) === nq && (Math.abs((+y.valorMoeda || y.valor) - +v.valor) < 0.005 || Math.abs(y.valor - +v.valor) < 0.005)); if (dup) { ERP.confirm(`Já existe "${dup.desc}" em ${monthLabel(mk0)} com o mesmo valor. Lançar mesmo assim?`, "Lançar mesmo assim").then((ok) => { if (ok) { md._dupOk = true; $("form", md.el).requestSubmit(); } }); return false; } }
        const moeda = v.moeda === "USD" ? "USD" : "BRL";
        const rateNow = moeda === "USD" ? ((ERP.investimentos && ERP.investimentos.fx && +ERP.investimentos.fx()) || 0) : 1;
        if (moeda === "USD" && !(rateNow > 0)) { ERP.toast("Defina a cotação do dólar em Investimentos › Atualizar Cotações."); return false; }
        const valorBRL = F.r2((+v.valor || 0) * rateNow);
        const moedaInfo = moeda === "USD" ? { moeda: "USD", valorMoeda: F.r2(+v.valor), cambio: rateNow } : { moeda: "BRL", valorMoeda: null, cambio: null };
        let askSerie = false;
        salvar((dd) => {
          const base = Object.assign({ desc: v.desc.trim(), catId: v.tipo === "transferencia" ? "" : v.catId, notas: v.notas || "", forma: v.forma || (cc ? "Cartão de Crédito" : ""), classe: v.tipo === "despesa" && !cc ? v.classe || "" : "", centro: v.centro || "", favId: v.favId || "" }, moedaInfo);
          if (!novo) {
            const x = dd.lanc.find((y) => y.id === l.id); const antes = x.valor;
            const prev = { desc: x.desc, catId: x.catId, forma: x.forma || "", classe: x.classe || "", centro: x.centro || "", valor: x.valor };
            Object.assign(x, base, { valor: valorBRL, comp: v.comp });
            if (x.tipo === "compra") { /* compra no cartão: mantém a fatura das parcelas */ }
            else { x.tipo = v.tipo; x.venc = v.venc; x.contaId = oid; x.paraId = v.tipo === "transferencia" ? v.paraId : ""; if (v.jaPago && !x.pago) { x.pago = v.venc <= todayISO() ? v.venc : todayISO(); x.valorPago = x.valor; hist(x, "Marcado como pago na edição"); } if (!v.jaPago && x.pago) { x.pago = null; x.valorPago = null; hist(x, "Pagamento desfeito na edição"); } }
            if (antes !== x.valor && x.estimado) x.estimado = false;
            F.aprenderFavorecido(dd, x);
            hist(x, "Editado" + (antes !== x.valor ? ` (valor ${brl(antes)} → ${brl(x.valor)})` : ""));
            if (x.parcela && x.parcela.g && v.parcTotal != null) { const novoT = Math.max(x.parcela.n, Math.min(120, Math.round(+v.parcTotal || x.parcela.t))); if (novoT !== x.parcela.t) { const r = ajustarParcelas(dd, x.parcela.g, novoT); ERP.toast(r > 0 ? `${r} parcela(s) acrescentada(s); agora são ${novoT}.` : r < 0 ? `${-r} parcela(s) em aberto retirada(s); agora são ${novoT}.` : `Total ajustado para ${novoT}.`); } }
            if (!x.serieId && +v.repetir > 0) { const passo = +v.repetir, ocor = +(v.duracao || 0); const ini = x.tipo === "compra" ? x.comp : x.venc; const sNew = { id: uid("s"), tipo: x.tipo, desc: x.desc, catId: x.catId, favId: x.favId || "", forma: x.forma || "", classe: x.classe || "", centro: x.centro || "", moeda: x.moeda || "BRL", valorMoeda: x.valorMoeda || null, valor: x.valor, dia: +String(x.venc || x.comp).slice(8, 10), passo, inicio: ini, fim: ocor ? addMonths(ini, passo * (ocor - 1)) : null, contaId: x.tipo === "compra" ? "" : x.contaId, cartaoId: x.cartaoId || "", paraId: x.paraId || "", ativa: true }; dd.series.push(sNew); x.serieId = sNew.id; x.serieMes = monthKey(ini); hist(x, "Tornou-se recorrente (" + freqLabel(passo) + ")"); F.materializar(dd); ERP.toast("Lançamento agora é recorrente (" + freqLabel(passo) + ")."); }
            if (x.serieId) { const s = dd.series.find((y) => y.id === x.serieId); const freqNova = +v.repetir || (s ? s.passo : 1);
              if (s && freqNova && freqNova !== s.passo) {
                const anchor = x.serieMes || monthKey(x.tipo === "compra" ? x.comp : x.venc);
                Object.assign(s, { passo: freqNova, desc: x.desc, catId: x.catId, forma: x.forma || "", classe: x.classe || "", centro: x.centro || "", favId: x.favId || "", moeda: x.moeda || "BRL", valorMoeda: x.valorMoeda || null, valor: x.valor, dia: s.dia || +String(x.venc || x.comp).slice(8, 10), inicio: F.diaNoMes(anchor, s.dia || +String(x.venc || x.comp).slice(8, 10)) });
                x.serieMes = anchor;
                dd.lanc = dd.lanc.filter((y) => !(y.serieId === s.id && y.id !== x.id && !y.pago && (y.tipo === "compra" ? y.comp : y.venc) >= todayISO()));
                F.materializar(dd); hist(x, "Frequência da recorrência alterada para " + freqLabel(freqNova));
                ERP.toast("Recorrência agora é " + freqLabel(freqNova) + "; os próximos lançamentos foram refeitos."); return;
              } }
            if ((l.serieId || (l.parcela && l.parcela.g)) && (prev.desc !== x.desc || prev.catId !== x.catId || prev.forma !== (x.forma || "") || prev.classe !== (x.classe || "") || prev.centro !== (x.centro || "") || prev.valor !== x.valor)) askSerie = true;
            return;
          }
          const n = Math.max(1, Math.min(120, Math.round(v.parcelas || 1))); const passo = +v.repetir;
          if (passo > 0) {   /* recorrência (com ou sem parcelas) */
            const ocor = +(v.duracao || 0); const ini = cc ? v.comp : v.venc;
            const s = { id: uid("s"), tipo: v.tipo, desc: base.desc, catId: base.catId, favId: base.favId, forma: base.forma, classe: base.classe, centro: base.centro, moeda, valorMoeda: moedaInfo.valorMoeda, valor: valorBRL, parcelas: n > 1 ? n : undefined, dia: +v.venc.slice(8, 10), passo, inicio: ini, fim: ocor ? addMonths(ini, passo * (ocor - 1)) : null, contaId: cc ? "" : oid, cartaoId: cc ? oid : "", paraId: v.tipo === "transferencia" ? v.paraId : "", ativa: true };
            dd.series.push(s); F.materializar(dd); { const p0 = dd.lanc.find((y) => y.serieId === s.id); if (p0) F.aprenderFavorecido(dd, p0); }
            if (v.jaPago && !cc) { const p = dd.lanc.find((y) => y.serieId === s.id && y.serieMes === monthKey(s.inicio) && (!y.parcela || y.parcela.n === 1)); if (p) { p.pago = p.venc <= todayISO() ? p.venc : todayISO(); p.valorPago = p.valor; hist(p, "Pago no cadastro"); } }
            return;
          }
          const g = n > 1 ? uid("g") : null; const per = Math.floor((valorBRL / n) * 100) / 100; const perM = moeda === "USD" ? Math.floor((moedaInfo.valorMoeda / n) * 100) / 100 : null;
          for (let i = 0; i < n; i++) {
            const val = i === n - 1 ? F.r2(valorBRL - per * (n - 1)) : per;
            const x = Object.assign({ id: uid("l"), valor: val, criado: Date.now() }, base, { desc: n > 1 ? `${base.desc} (${i + 1}/${n})` : base.desc });
            if (moeda === "USD") x.valorMoeda = i === n - 1 ? F.r2(moedaInfo.valorMoeda - perM * (n - 1)) : perM;
            if (g) x.parcela = { g, n: i + 1, t: n };
            if (cc) { const c = F.cartao(oid); const f0 = F.faturaDe(c, v.comp); Object.assign(x, { tipo: "compra", cartaoId: oid, comp: addMonths(v.comp, i), venc: v.comp, fatura: F.mesSeg(f0.key, i), pago: null }); }
            else { Object.assign(x, { tipo: v.tipo, contaId: oid, paraId: v.tipo === "transferencia" ? v.paraId : "", comp: addMonths(v.comp, i), venc: addMonths(v.venc, i), pago: null }); if (v.jaPago && i === 0) { x.pago = x.venc <= todayISO() ? x.venc : todayISO(); x.valorPago = x.valor; } }
            hist(x, "Criado"); dd.lanc.push(x); if (i === n - 1) F.aprenderFavorecido(dd, x);
          }
        });
        ERP.toast(novo ? "Lançamento salvo." : "Alterações salvas."); ERP.render();
        if (askSerie) { const parc = l.parcela && l.parcela.g && !l.serieId; setTimeout(() => ERP.confirm(parc ? "Aplicar estas mudanças (valor, descrição, favorecido, categoria, forma de pagamento e centro de custo) também às próximas parcelas em aberto deste parcelamento?" : "Aplicar estas mudanças (valor, moeda, descrição, favorecido, categoria, forma de pagamento e centro de custo) também aos próximos lançamentos em aberto desta recorrência?", "Aplicar aos próximos").then((ok) => {
          if (!ok) return;
          salvar((dd) => { const x = dd.lanc.find((y) => y.id === l.id); if (!x) return; const commons = { desc: x.desc, catId: x.catId, forma: x.forma || "", classe: x.classe || "", centro: x.centro || "", favId: x.favId || "" };
            if (x.serieId) { const s = dd.series.find((y) => y.id === x.serieId); if (s) Object.assign(s, commons, { valor: x.valor, moeda: x.moeda || "BRL", valorMoeda: x.valorMoeda || null }); }
            dd.lanc.forEach((y) => { if (y.id === x.id || y.pago || F.travado(y)) return; const sameSerie = x.serieId && y.serieId === x.serieId && y.venc > x.venc; const samePar = x.parcela && x.parcela.g && y.parcela && y.parcela.g === x.parcela.g && y.parcela.n > x.parcela.n; if (!sameSerie && !samePar) return; Object.assign(y, commons); if (samePar) y.desc = `${descBase(x.desc)} (${y.parcela.n}/${y.parcela.t})`; if (x.moeda === "USD") { y.moeda = "USD"; y.valorMoeda = x.valorMoeda; if (sameSerie || samePar) y.valor = x.valor; } else { y.valor = x.valor; y.moeda = "BRL"; y.valorMoeda = null; } if (y.estimado) y.estimado = false; hist(y, "Atualizado em lote"); }); });
          ERP.toast("Lançamentos atualizados."); ERP.render();
        }), 0); }
      },
      deleteNoConfirm: true,
      onDelete: novo ? null : async () => {
        if (F.mesFechado(monthKey(l.venc || l.comp))) { ERP.toast("Mês fechado. Reabra em Cadastros › Fechamento para excluir."); return; }
        if (!(await ERP.confirm("Excluir este lançamento?", "Excluir"))) return;
        let scope = "one";
        if (l.parcela && l.parcela.t > 1) scope = (await ERP.confirm(`Parcelamento em ${l.parcela.t}x. Excluir também as outras parcelas em aberto?`, "Excluir as outras")) ? "allPar" : "one";
        else if (l.serieId) scope = (await ERP.confirm("É um lançamento de uma recorrência. Encerrar a recorrência e excluir os próximos em aberto? (Não = exclui só este mês.)", "Encerrar recorrência")) ? "serie" : "one";
        salvar((dd) => {
          if (scope === "allPar") dd.lanc = dd.lanc.filter((y) => !(y.parcela && y.parcela.g === l.parcela.g && !F.travado(y)));
          else if (scope === "serie") {
            dd.lanc = dd.lanc.filter((y) => !(y.serieId === l.serieId && !y.pago && y.serieMes >= l.serieMes));
            dd.series = dd.series.filter((y) => y.id !== l.serieId);
            dd.lanc.forEach((y) => { if (y.serieId === l.serieId) { y.serieId = null; delete y.serieMes; } });
          } else { dd.lanc = dd.lanc.filter((y) => y.id !== l.id); }
        });
        ERP.toast(scope === "serie" ? "Recorrência encerrada e removida." : "Excluído."); ERP.render();
      },
    });
    return m;
  }

  /* pagar / receber (como na CAP: data, conta, juros e multa, desconto) */
  function pagar(id) {
    const l = D().lanc.find((x) => x.id === id); if (!l) return;
    if (F.travado(l)) { ERP.toast("Mês fechado."); return; }
    const rec = l.tipo === "receita";
    ERP.form({
      title: (rec ? "Receber · " : "Pagar · ") + l.desc, intro: `Valor previsto ${brl(l.valor)} · vencimento ${fdate(l.venc)}`,
      fields: [
        { k: "data", label: rec ? "Data do recebimento" : "Data do Pagamento", type: "date", value: todayISO() },
        { k: "contaId", label: rec ? "Recebido na conta" : "Pago pela conta", type: "select", creatable: "conta", value: l.contaId, options: F.contasAtivas().map((c) => [c.id, c.nome]) },
        { k: "juros", label: rec ? "Acréscimos" : "Juros e multa", type: "number", step: "0.01", value: 0 },
        { k: "desconto", label: "Desconto", type: "number", step: "0.01", value: 0 },
      ],
      okLabel: rec ? "Registrar recebimento" : "Registrar pagamento",
      onSubmit(v) {
        if (F.mesFechado(monthKey(v.data))) { ERP.toast("O mês do pagamento está fechado."); return false; }
        salvar((d) => { const x = d.lanc.find((y) => y.id === id); x.pago = v.data; x.estimado = false; x.contaId = v.contaId; x.juros = F.r2(v.juros); x.desconto = F.r2(v.desconto); x.valorPago = F.r2(x.valor + x.juros - x.desconto); hist(x, `${rec ? "Recebido" : "Pago"} em ${fdate(v.data)}: ${brl(x.valorPago)}${x.juros ? ` (juros ${brl(x.juros)})` : ""}${x.desconto ? ` (desconto ${brl(x.desconto)})` : ""}`); });
        ERP.toast(rec ? "Recebimento registrado." : "Pagamento registrado."); ERP.render();
      },
    });
  }
  function estornar(id) {
    const l = D().lanc.find((x) => x.id === id); if (!l) return;
    if (F.travado(l)) { ERP.toast("Mês fechado."); return; }
    ERP.form({ title: "Desfazer Pagamento · " + l.desc, intro: "O lançamento volta para em aberto. O motivo fica no histórico.", fields: [{ k: "motivo", label: "Motivo", full: true, required: true }], okLabel: "Desfazer",
      onSubmit(v) { if (!v.motivo.trim()) { ERP.toast("Escreva o motivo."); return false; } salvar((d) => { const x = d.lanc.find((y) => y.id === id); hist(x, `Pagamento de ${fdate(x.pago)} desfeito: ${v.motivo.trim()}`); x.pago = null; x.valorPago = null; x.juros = 0; x.desconto = 0; }); ERP.render(); } });
  }
  function pagarFatura(cid, key) {
    const c = F.cartao(cid); const f = F.faturas(cid).find((x) => x.key === key); if (!f) return;
    ERP.form({ title: `Pagar fatura ${c.nome} · ${monthLabel(key)}`, intro: `Total ${brl(f.total)} · vence ${fdate(f.vence)}. As compras já estão nas categorias; o pagamento só tira o dinheiro da conta.`,
      fields: [{ k: "data", label: "Data do Pagamento", type: "date", value: todayISO() }, { k: "valor", label: "Valor Pago (R$)", type: "number", step: "0.01", value: f.total }, { k: "contaId", label: "Conta", type: "select", value: c.contaId || (F.contasAtivas()[0] || {}).id, options: F.contasAtivas().map((x) => [x.id, x.nome]) }],
      okLabel: "Registrar pagamento",
      onSubmit(v) {
        salvar((d) => {
          let p = d.lanc.find((y) => y.tipo === "pagfatura" && y.cartaoId === cid && y.fatura === key);
          if (!p) { p = { id: uid("l"), tipo: "pagfatura", cartaoId: cid, fatura: key, desc: `Fatura ${c.nome} ${monthLabel(key)}`, valor: f.total, venc: f.vence, comp: f.vence, catId: "" }; d.lanc.push(p); }
          p.valor = f.total; p.pago = v.data; p.contaId = v.contaId; p.valorPago = F.r2(v.valor); hist(p, `Fatura paga em ${fdate(v.data)}: ${brl(v.valor)}`);
        });
        ERP.toast("Fatura paga."); ERP.render();
      } });
  }
  function desfazerFatura(cid, key) {
    ERP.confirm("Desfazer o pagamento desta fatura? Ela volta a ficar em aberto.", "Desfazer").then((ok) => { if (!ok) return; salvar((d) => { d.lanc = d.lanc.filter((y) => !(y.tipo === "pagfatura" && y.cartaoId === cid && y.fatura === key)); }); ERP.render(); });
  }

  /* lançamento rápido: "Mercado 250,90 @nubank 3x #alimentação 25/10" — "+" ou "recebi" no início = receita */
  function rapido(txt) {
    let t = " " + txt.trim() + " "; if (!txt.trim()) return;
    const d = D(); let tipo = "despesa", parc = 1, dt = todayISO(), origem = null, catId = "";
    if (/^\s*\+/.test(t) || /\b(recebi|receita)\b/i.test(t)) { tipo = "receita"; t = t.replace(/^\s*\+/, " ").replace(/\b(recebi|receita)\b/i, " "); }
    t = t.replace(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/, (m0, dd, mm, yy) => { const y = yy ? (yy.length === 2 ? "20" + yy : yy) : String(new Date().getFullYear()); dt = y + "-" + ERP.p2(mm) + "-" + ERP.p2(dd); return " "; });
    t = t.replace(/\s(\d{1,2})x\s/i, (m0, n) => { parc = +n; return " "; });
    t = t.replace(/@(\S+)/, (m0, a) => { const k = norm(a); const cc = d.cartoes.find((c) => norm(c.nome).includes(k)); const ct = F.contasAtivas().find((c) => norm(c.nome).includes(k)); origem = cc && tipo === "despesa" ? "cc:" + cc.id : ct ? "ct:" + ct.id : null; return " "; });
    t = t.replace(/#(\S+)/, (m0, a) => { const k = norm(a); const c = d.categorias.find((x) => norm(x.nome).includes(k) && x.tipo === (tipo === "receita" ? "receita" : "despesa")); if (c) catId = c.id; return " "; });
    let valor = 0; t = t.replace(/\s(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s/, (m0, v) => { valor = parseNum(v); return " "; });
    const desc = t.replace(/\s+/g, " ").trim();
    if (!catId) { const w = norm(desc).split(" ").filter((x) => x.length > 3); const c = d.categorias.find((x) => x.tipo === (tipo === "receita" ? "receita" : "despesa") && w.some((p) => norm(x.nome).includes(p))); if (c) catId = c.id; }
    if (!valor || !desc) { ERP.toast("Escreva ao menos descrição e valor. Ex.: Mercado 250,90 @nubank"); return; }
    const pre = { tipo, catId };
    const m = lancForm(null, pre); if (!m) return; const fm = $("form", m.el);
    fm.elements.valor.value = valor; fm.elements.desc.value = desc; if (fm.elements.compMes) fm.elements.compMes.value = dt.slice(0, 7); if (fm.elements.compData) fm.elements.compData.value = dt; fm.elements.venc.value = dt; fm.elements.parcelas.value = parc;
    fm.elements.tipo.value = tipo; fm.elements.tipo.onchange(); if (origem) { fm.elements.origem.value = origem; fm.elements.origem.onchange(); } if (catId) fm.elements.catId.value = catId;
    fm.elements.jaPago.checked = dt <= todayISO();
  }

  /* ---------- 1. Painel ---------- */
  function pPainel(root) {
    const d = D(); const r = F.dreMes(S.mk); const pj = F.projecao(12); const pend = F.pendencias(); const h = todayISO();
    const venc = pend.filter((p) => p.data < h && p.tipo !== "receita"); const prox30 = pend.filter((p) => p.data >= h && p.data <= F.addDias(h, 30));
    const fimMes = pj.porMes[0] ? pj.porMes[0].saldo : pj.ini;
    const alertas = [];
    if (venc.length) alertas.push(["err", `${venc.length} conta(s) vencida(s), ${brl(venc.reduce((s, p) => s + p.valor, 0))}`, "#/financas/agenda"]);
    if (pj.min.v < 0) alertas.push(["err", `O saldo projetado fica negativo em ${fdate(pj.min.data)} (${brl(pj.min.v)})`, "#/financas/fluxo"]);
    d.cartoes.forEach((c) => { const u = F.usoCartao(c.id); if (c.limite > 0 && u / c.limite * 100 >= (d.cfg.alertaCartao || 80)) alertas.push(["warn", `${c.nome}: ${num(u / c.limite * 100, 0)}% do limite usado`, "#/financas/cartoes"]); });
    F.orcamentoMes(S.mk).filter((x) => x.orcado > 0 && x.pct > 100).forEach((x) => alertas.push(["warn", `Orçamento estourado em ${x.c.nome}: ${brl(x.realizado)} de ${brl(x.orcado)}`, "#/financas/orcamento"]));
    const vazio = d.lanc.length === 0;
    const six = []; for (let i = -5; i <= 0; i++) { const mk = F.mesSeg(S.mk, i); const x = F.dreMes(mk); six.push({ l: monthLabel(mk), a: x.rec, b: x.despesas + x.investimento }); }
    const cats = Object.entries(r.porCat).filter(([k]) => F.cat(k).tipo === "despesa").sort((a, b) => b[1] - a[1]).slice(0, 8); const mx = cats.length ? cats[0][1] : 1;
    root.innerHTML = ERP.pagehead("Finanças Pessoais", `${regimeTgl()}${mesNav()}<button class="btn orange" id="fNovo">+ Lançamento</button>`) + `
      ${vazio ? `<div class="card fin-onb"><h3>Comece por Aqui</h3><ol><li><a href="#/financas/cadastros">Cadastre suas contas</a> com o saldo de hoje e os cartões com fechamento e vencimento.</li><li>Lance as <b>contas fixas</b> com “Repetir todo mês” (aluguel, condomínio, escola, assinaturas, salário).</li><li>Defina o <a href="#/financas/orcamento">orçamento</a> do mês por categoria.</li><li>Cadastre <a href="#/financas/dividas">dívidas</a> e <a href="#/financas/metas">metas</a>.</li></ol><p class="mut">No dia a dia, use o lançamento rápido em Lançamentos: <code>Mercado 250,90 @nubank 3x</code>.</p></div>` : ""}
      ${alertas.length ? `<div class="fin-alertas">${alertas.map(([c, t, hr]) => `<a class="note ${c === "err" ? "err" : ""}" href="${hr}">${esc(t)}</a>`).join("")}</div>` : ""}
      <div class="kpis">${ERP.kpi("Saldo em Contas Hoje", brl(pj.ini), F.contasAtivas().length + " conta(s)" + (F.saldoReservas() ? " · reservas " + brl(F.saldoReservas()) : ""), pj.ini < 0 ? "neg" : "")}${ERP.kpi("Receitas · " + monthLabel(S.mk), brl(r.rec), d.cfg.regime === "caixa" ? "recebidas" : "competência, com previstos", "pos")}${ERP.kpi("Despesas · " + monthLabel(S.mk), brl(r.despesas), `necessidades ${brl(r.essencial)} · estilo ${brl(r.estilo)}`, "neg")}${ERP.kpi("Sobra do Mês", brl(r.resultado), r.rec ? "taxa de poupança " + num(r.poupanca, 1) + "%" : "", r.resultado >= 0 ? "pos" : "neg")}${ERP.kpi("A Pagar em 30 Dias", brl(prox30.filter((p) => p.tipo !== "receita").reduce((s, p) => s + p.valor, 0)), `a receber ${brl(prox30.filter((p) => p.tipo === "receita").reduce((s, p) => s + p.valor, 0))}`)}${ERP.kpi("Saldo Previsto no Fim do Mês", brl(fimMes), "pelo fluxo de caixa", fimMes < 0 ? "neg" : "")}</div>
      <div class="grid2"><div class="card"><h3>Últimos 6 Meses</h3>${barras(six)}<p class="mut fin-leg"><i class="sq a"></i>receitas <i class="sq b"></i>despesas e aportes</p></div>
      <div class="card"><h3>Para Onde Foi o Dinheiro · ${monthLabel(S.mk)}</h3>${cats.length ? cats.map(([k, v]) => { const c = F.cat(k); const o = F.orcado(S.mk, k); return `<div class="hrow"><span class="n" title="${esc(c.grupo)}">${esc(c.nome)}</span><div class="bar"><i style="width:${(v / mx) * 100}%;background:${c.cor}"></i></div><span class="v">${brl(v)}${o ? `<small class="mut"> / ${num(o, 0)}</small>` : ""}</span></div>`; }).join("") : `<div class="empty">Sem despesas neste mês.</div>`}</div></div>
      <div class="grid2"><div class="card"><h3>Próximos Vencimentos</h3>${prox30.length || venc.length ? `<div class="tw"><table><tbody>${venc.concat(prox30).slice(0, 10).map((p) => `<tr><td style="white-space:nowrap">${fdate(p.data).slice(0, 5)}</td><td>${esc(p.desc)}<div>${p.k === "l" ? pill(F.situacao(p.l)) : `<span class="pill ${p.data < h ? "err" : "info"}">fatura</span>`}</div></td><td class="r ${p.tipo === "receita" ? "pos" : ""}" style="white-space:nowrap">${brl(p.valor)}</td><td class="r">${p.k === "l" ? `<button class="btn sm" data-pay="${p.l.id}">${p.tipo === "receita" ? "Receber" : "Pagar"}</button>` : `<button class="btn sm" data-payf="${p.f.cartaoId}|${p.f.key}">Pagar</button>`}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Nada vencendo nos próximos 30 dias.</div>`}</div>
      <div class="card"><h3>Saldo Projetado · 12 Meses</h3>${linha([{ l: "hoje", v: pj.ini }].concat(pj.porMes.map((m) => ({ l: monthLabel(m.mk), v: m.saldo }))))}<p class="mut fin-leg">Menor saldo: <b class="${pj.min.v < 0 ? "neg" : ""}">${brl(pj.min.v)}</b> em ${fdate(pj.min.data)}. <a href="#/financas/fluxo">Abrir fluxo de caixa</a></p></div></div>`;
    bindMes(root); bindReg(root); $("#fNovo", root).onclick = () => lancForm();
    $$("[data-pay]", root).forEach((b) => (b.onclick = () => pagar(b.dataset.pay)));
    $$("[data-payf]", root).forEach((b) => (b.onclick = () => { const [c, k] = b.dataset.payf.split("|"); pagarFatura(c, k); }));
  }

  /* ---------- 2. Lançamentos ---------- */
  function pLanc(root) {
    const d = D(); const q = norm(S.q); const reg = d.cfg.regime;
    const rows = d.lanc.filter((l) => l.tipo !== "pagfatura" || true).filter((l) => monthKey(reg === "caixa" ? (l.tipo === "compra" ? l.comp : F.dataCaixa(l)) : F.dataComp(l)) === S.mk)
      .filter((l) => (!S.tipo || (S.tipo === "despesa" ? l.tipo === "despesa" || l.tipo === "compra" : l.tipo === S.tipo)) && (!S.cat || l.catId === S.cat) && (!S.centro || l.centro === S.centro) && (!S.fav || l.favId === S.fav) && (!S.origem || ("ct:" + l.contaId) === S.origem || ("cc:" + l.cartaoId) === S.origem) && (!S.sit || F.situacao(l).k === S.sit || (S.sit === "aberto" && !l.pago && l.tipo !== "compra")) && (!q || norm(l.desc + " " + (l.notas || "") + " " + F.cat(l.catId).nome + " " + ((F.favorecido(l.favId) || {}).nome || "")).includes(q)))
      .sort((a, b) => (b.comp || b.venc).localeCompare(a.comp || a.venc));
    const tot = (f) => rows.filter(f).reduce((s, l) => s + l.valor, 0);
    root.innerHTML = ERP.pagehead("Lançamentos", `${regimeTgl()}${mesNav()}<button class="btn ghost" id="fImp" title="CSV ou OFX do banco/cartão, com conciliação">Importar Extrato</button><button class="btn ghost" id="fXls">Exportar Excel</button><button class="btn orange" id="fNovo">+ Lançamento</button>`) + `
      <div class="quick"><input id="fRap" placeholder="Lançamento rápido, ex.: Mercado 250,90 @nubank 3x #mercado 25/10 · + Salário 12000 @itaú" aria-label="Lançamento rápido"><button class="btn orange" id="fRapBtn">Lançar</button></div>
      <div class="toolbar"><input id="fQ" placeholder="Buscar" value="${esc(S.q)}" style="max-width:200px">
        <select id="fT"><option value="">Todos os Tipos</option><option value="despesa">Despesas</option><option value="receita">Receitas</option><option value="transferencia">Transferências</option><option value="pagfatura">Pagamentos de fatura</option></select>
        <select id="fS"><option value="">Todas as Situações</option><option value="aberto">Em aberto</option><option value="estimado">A confirmar</option><option value="vencido">Vencidos</option><option value="pago">Pagos</option><option value="cartao">No cartão</option></select>
        <select id="fC"><option value="">Todas as Categorias</option>${catOpts("").map((x) => x[0] === "__grp" ? `<optgroup label="${esc(x[1])}"></optgroup>` : `<option value="${x[0]}">${esc(x[1])}</option>`).join("")}</select>
        ${(d.favorecidos && d.favorecidos.length) ? `<select id="fFV"><option value="">Todos os Favorecidos</option>${favOpts().slice(1).map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join("")}</select>` : ""}${(d.centros && d.centros.length) ? `<select id="fCC"><option value="">Todos os Centros</option>${centroOpts().slice(1).map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join("")}</select>` : ""}
        <select id="fO"><option value="">Todas as Contas e Cartões</option>${origemOpts(true).map((o) => `<option value="${o[0]}">${esc(o[1])}</option>`).join("")}</select></div>
      ${(() => { const ch = []; const add = (lbl, fn) => ch.push({ lbl, fn }); if (S.tipo) add("Tipo: " + { despesa: "Despesas", receita: "Receitas", transferencia: "Transferências" }[S.tipo] || S.tipo, "tipo"); if (S.sit) add("Situação: " + ({ aberto: "Em aberto", estimado: "A confirmar", vencido: "Vencido", pago: "Pago", hoje: "Vence hoje", semana: "Esta semana", previsto: "Previsto", cartao: "No cartão" }[S.sit] || S.sit), "sit"); if (S.cat) add("Categoria: " + F.cat(S.cat).nome, "cat"); if (S.centro) add("Centro: " + S.centro, "centro"); if (S.fav) add("Favorecido: " + ((F.favorecido(S.fav) || {}).nome || ""), "fav"); if (S.origem) { const [k, id] = S.origem.split(":"); add((k === "cc" ? "Cartão: " : "Conta: ") + (((k === "cc" ? F.cartao(id) : F.conta(id)) || {}).nome || ""), "origem"); } if (S.q) add("Busca: " + S.q, "q"); return ch.length ? `<div class="chips-f">${ch.map((c) => `<span class="chip-f">${esc(c.lbl)} <button type="button" data-chip="${c.fn}" title="Tirar este filtro">×</button></span>`).join("")}<button type="button" class="btn ghost sm" data-chip="*">Limpar Tudo</button></div>` : ""; })()}
      ${(() => { const r = tot((l) => l.tipo === "receita"), ds = tot((l) => l.tipo === "despesa" || l.tipo === "compra"), pg = rows.filter((l) => l.pago && (l.tipo === "despesa")).reduce((s, l) => s + (l.valorPago != null ? l.valorPago : l.valor), 0); return `<div class="fp-stats lc-stats"><span>Receitas<b class="pos">${brl(r)}</b></span><span>Despesas<b class="neg">${brl(ds)}</b></span><span>Resultado<b class="${r - ds >= 0 ? "pos" : "neg"}">${brl(r - ds)}</b></span><span>Já pago<b>${brl(pg)}</b></span><span>Lançamentos<b>${rows.length}</b></span><span class="lc-reg mut" title="${reg === "caixa" ? "Regime de caixa: datas de pagamento (em aberto, pelo vencimento); compras no cartão pela data da compra." : "Competência: pela data da compra/competência, com os previstos."}">${reg === "caixa" ? "regime de caixa" : "por competência"}</span></div>`; })()}
      ${rows.length ? `<div class="tw"><table class="lt"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta / Cartão</th><th>Situação</th><th class="r">Valor</th><th></th></tr></thead><tbody>${rows.map((l) => {
        const c = F.cat(l.catId); const s = F.situacao(l); const orig = l.cartaoId ? "💳 " + esc((F.cartao(l.cartaoId) || {}).nome || "") + (l.tipo === "compra" ? ` <small class="mut">fatura ${monthLabel(l.fatura)}</small>` : "") : "🏦 " + esc((F.conta(l.contaId) || {}).nome || "") + (l.tipo === "transferencia" ? " → " + esc((F.conta(l.paraId) || {}).nome || "") : "");
        const v = l.valorPago != null ? l.valorPago : l.valor;
        return `<tr data-ed="${l.id}" class="fin-row"><td style="white-space:nowrap">${star("lanc", l.id)}${fdate(l.tipo === "compra" ? l.comp : F.dataCaixa(l))}</td><td><b>${esc(l.desc)}</b>${l.centro ? ` <span class="tag-cc">${esc(l.centro)}</span>` : ""}${l.serieId ? ' <span class="tic" title="Recorrente">↻</span>' : ""}${(l.anexos || []).length ? ` <span class="tic" title="${l.anexos.length} anexo(s)">📎</span>` : ""}${F.travado(l) ? ' <span class="tic" title="Mês fechado">🔒</span>' : ""}${l.notas ? `<div class="mut fin-sub">${esc(l.notas)}</div>` : ""}</td><td>${l.catId ? `<span class="cat" data-fc="${l.catId}" title="Filtrar por esta categoria" style="cursor:pointer"><i style="background:${c.cor}"></i>${esc(c.nome)}</span>` : l.tipo === "pagfatura" ? '<span class="pill info">pagamento de fatura</span>' : ""}</td><td class="mut" data-fo="${l.cartaoId ? "cc:" + l.cartaoId : "ct:" + l.contaId}" title="Filtrar por esta conta/cartão" style="cursor:pointer">${orig}</td><td>${pill(s)}</td><td class="r ${l.tipo === "receita" ? "pos" : l.tipo === "transferencia" ? "" : "neg"}">${l.moeda === "USD" && l.valorMoeda != null ? `<b>${l.tipo === "receita" ? "" : "−"}US$ ${num(+l.valorMoeda, 2)}</b><div class="mut fin-sub" style="white-space:nowrap">${brl(v)}${l.cambio ? " · " + num(l.cambio, 2) : ""}${l.pago ? "" : " · flutua"}</div>` : `${l.tipo === "receita" ? "" : l.tipo === "transferencia" ? "" : "−"}${brl(v)}`}</td><td class="r" style="white-space:nowrap">${l.tipo === "compra" || l.tipo === "pagfatura" ? "" : l.pago ? `<button class="ib" data-est="${l.id}" title="Desfazer Pagamento" aria-label="Desfazer Pagamento">↺</button>` : `<button class="btn ghost sm" data-pay="${l.id}">${l.tipo === "receita" ? "Receber" : "Pagar"}</button>`}</td></tr>`;
      }).join("")}</tbody></table></div>` : `<div class="empty">Nenhum lançamento em ${monthLabel(S.mk)}${(S.tipo || S.sit || S.cat || S.origem || S.centro || S.fav || S.q) ? " com esses filtros" : ""}.<div class="toolbar" style="justify-content:center;margin-top:12px">${(S.tipo || S.sit || S.cat || S.origem || S.centro || S.fav || S.q) ? `<button class="btn ghost sm" id="fLimpar">Limpar Filtros</button>` : ""}<button class="btn orange sm" onclick="document.getElementById('fNovo').click()">+ Lançamento</button></div></div>`}`;
    bindMes(root); bindReg(root); bindStars(root);
    $("#fT", root).value = S.tipo; $("#fS", root).value = S.sit; $("#fC", root).value = S.cat; $("#fO", root).value = S.origem;
    $("#fT", root).onchange = (e) => { S.tipo = e.target.value; ERP.render(); }; $("#fS", root).onchange = (e) => { S.sit = e.target.value; ERP.render(); };
    $("#fC", root).onchange = (e) => { S.cat = e.target.value; ERP.render(); }; $("#fO", root).onchange = (e) => { S.origem = e.target.value; ERP.render(); }; { const cc = $("#fCC", root); if (cc) { cc.value = S.centro || ""; cc.onchange = (e) => { S.centro = e.target.value; ERP.render(); }; } const fv = $("#fFV", root); if (fv) { fv.value = S.fav || ""; fv.onchange = (e) => { S.fav = e.target.value; ERP.render(); }; } }
    $("#fQ", root).onchange = (e) => { S.q = e.target.value; ERP.render(); };
    { const lf = $("#fLimpar", root); if (lf) lf.onclick = () => { S.tipo = ""; S.sit = ""; S.cat = ""; S.origem = ""; S.centro = ""; S.fav = ""; S.q = ""; ERP.render(); }; }
    $$("[data-chip]", root).forEach((b) => (b.onclick = () => { const k = b.dataset.chip; if (k === "*") { S.tipo = ""; S.sit = ""; S.cat = ""; S.origem = ""; S.centro = ""; S.fav = ""; S.q = ""; } else S[k] = ""; ERP.render(); }));
    $("#fNovo", root).onclick = () => lancForm();
    { const bi = $("#fImp", root); if (bi) bi.onclick = () => ERP.finImportar.abrir(); }
    $("#fRapBtn", root).onclick = () => rapido($("#fRap", root).value); $("#fRap", root).onkeydown = (e) => { if (e.key === "Enter") rapido(e.target.value); };
    root.onclick = (e) => {
      const b = e.target.closest("[data-pay],[data-est]"); if (b) { e.stopPropagation(); if (b.dataset.pay) pagar(b.dataset.pay); else estornar(b.dataset.est); return; }
      const fc = e.target.closest("[data-fc]"); if (fc) { e.stopPropagation(); S.cat = S.cat === fc.dataset.fc ? "" : fc.dataset.fc; ERP.render(); return; }
      const fo = e.target.closest("[data-fo]"); if (fo) { e.stopPropagation(); S.origem = S.origem === fo.dataset.fo ? "" : fo.dataset.fo; ERP.render(); return; }
      const r = e.target.closest("[data-ed]"); if (r) { const l = D().lanc.find((x) => x.id === r.dataset.ed); if (l.tipo === "pagfatura") { S.card = l.cartaoId; ERP.nav("financas/cartoes"); return; } lancForm(l); }
    };
    $("#fXls", root).onclick = () => { const num = (v) => (v == null || v === "" ? "" : Number(v)); const H = ["Competência", "Vencimento", "Pagamento", "Tipo", "Descrição", "Favorecido", "Grupo", "Categoria", "Natureza", "Centro de custo", "Conta/Cartão", "Fatura", "Valor", "Valor pago"]; const R = d.lanc.slice().sort((a, b) => (a.comp || "").localeCompare(b.comp || "")).map((l) => { const c = F.cat(l.catId); return [l.comp, l.venc, l.pago || "", l.tipo, l.desc, (F.favorecido(l.favId) || {}).nome || "", l.catId ? c.grupo : "", l.catId ? c.nome : "", l.catId ? F.NAT[c.natureza] : "", l.centro || "", l.cartaoId ? (F.cartao(l.cartaoId) || {}).nome : (F.conta(l.contaId) || {}).nome, l.fatura || "", num(l.valor), num(l.valorPago)]; }); ERP.xlsx(`hub-lancamentos-${todayISO()}.xlsx`, H, R, { title: "Lançamentos · todos os períodos", subtitle: `Hub · Painel Pessoal · ${d.lanc.length} lançamento(s) · gerado em ${new Date().toLocaleString("pt-BR")}`, sheet: "Lançamentos" }); };
  }

  /* ---------- 3. Contas a pagar e a receber ---------- */
  function pAgenda(root) {
    const h = todayISO(); const all = F.pendencias().filter((p) => S.agenda === "receber" ? p.tipo === "receita" : p.tipo !== "receita");
    const faixas = [["Vencidas", (p) => p.data < h], ["Hoje", (p) => p.data === h], ["Próximos 7 dias", (p) => p.data > h && p.data <= F.addDias(h, 7)], ["Até 30 dias", (p) => p.data > F.addDias(h, 7) && p.data <= F.addDias(h, 30)], ["Depois", (p) => p.data > F.addDias(h, 30)]];
    const soma = (f) => all.filter(f).reduce((s, p) => s + p.valor, 0);
    const linhaP = (p) => `<tr><td>${fdate(p.data)}</td><td><b>${esc(p.desc)}</b>${p.k === "l" ? `<div class="mut fin-sub">${esc(F.cat(p.l.catId).nome)} · ${esc((F.conta(p.l.contaId) || {}).nome || "")}</div>` : `<div class="mut fin-sub">${p.f.itens.length} compra(s)</div>`}</td><td>${p.k === "l" ? pill(F.situacao(p.l)) : `<span class="pill ${p.data < h ? "err" : "info"}">fatura ${p.f.status}</span>`}</td><td class="r">${brl(p.valor)}</td><td class="r" style="white-space:nowrap">${p.k === "l" ? `<button class="btn ghost sm" data-ed="${p.l.id}">Editar</button> <button class="btn sm" data-pay="${p.l.id}">${p.tipo === "receita" ? "Receber" : "Pagar"}</button>` : `<button class="btn sm" data-payf="${p.f.cartaoId}|${p.f.key}">Pagar Fatura</button>`}</td></tr>`;
    root.innerHTML = ERP.pagehead("Contas a Pagar e a Receber", `<button class="btn orange" id="fNovo">+ Lançamento</button>`) + `
      <div class="tabs"><button class="${S.agenda === "pagar" ? "on" : ""}" data-ag="pagar">A Pagar</button><button class="${S.agenda === "receber" ? "on" : ""}" data-ag="receber">A Receber</button></div>
      <div class="kpis">${faixas.slice(0, 4).map(([n, f], i) => ERP.kpi(n, brl(soma(f)), all.filter(f).length + " item(ns)", i === 0 && soma(f) > 0 ? "neg" : "")).join("")}</div>
      ${(() => { const lim = F.addDias(h, -90); const pend = D().lanc.filter((l) => l.pago && l.pago >= lim && ["despesa", "receita"].includes(l.tipo) && !(l.anexos || []).length && l.valor >= 50).sort((a, b) => b.pago.localeCompare(a.pago)); return pend.length ? `<div class="card"><h3>Pendências de Comprovante <small class="mut" style="font-weight:400">pagos nos últimos 90 dias sem anexo · a partir de R$ 50</small></h3><div class="tw"><table><tbody>${pend.slice(0, 15).map((l) => `<tr><td>${fdate(l.pago)}</td><td><b>${esc(l.desc)}</b><div class="mut fin-sub">${esc(F.cat(l.catId).nome)}</div></td><td class="r">${brl(l.valorPago != null ? l.valorPago : l.valor)}</td><td class="r"><button class="btn ghost sm" data-ed="${l.id}">Anexar</button></td></tr>`).join("")}</tbody></table></div>${pend.length > 15 ? `<p class="mut" style="margin-top:6px">e mais ${pend.length - 15}…</p>` : ""}</div>` : ""; })()}
      ${faixas.map(([n, f]) => { const it = all.filter(f); return it.length ? `<div class="card"><h3>${n} · ${brl(soma(f))}</h3><div class="tw"><table><tbody>${it.map(linhaP).join("")}</tbody></table></div></div>` : ""; }).join("") || `<div class="empty">Nada em aberto.<div class="toolbar" style="justify-content:center;margin-top:12px"><button class="btn orange sm" onclick="document.getElementById('fNovo').click()">+ Lançamento</button></div></div>`}`;
    $$("[data-ag]", root).forEach((b) => (b.onclick = () => { S.agenda = b.dataset.ag; ERP.render(); }));
    $("#fNovo", root).onclick = () => lancForm(null, { tipo: S.agenda === "receber" ? "receita" : "despesa" });
    $$("[data-pay]", root).forEach((b) => (b.onclick = () => pagar(b.dataset.pay)));
    $$("[data-ed]", root).forEach((b) => (b.onclick = () => lancForm(D().lanc.find((x) => x.id === b.dataset.ed))));
    $$("[data-payf]", root).forEach((b) => (b.onclick = () => { const [c, k] = b.dataset.payf.split("|"); pagarFatura(c, k); }));
  }

  /* ---------- 4. Cartões ---------- */
  function pCartoes(root) {
    const d = D(); if (!S.card || !F.cartao(S.card)) S.card = (d.cartoes[0] || {}).id;
    const c = F.cartao(S.card);
    const tiles = d.cartoes.map((x) => { const u = F.usoCartao(x.id); const p = x.limite > 0 ? Math.min(100, (u / x.limite) * 100) : 0; return `<button class="fin-cc ${x.id === S.card ? "on" : ""}" data-cc="${x.id}"><b>${esc(x.nome)}</b><span class="mut">fecha dia ${x.fecha} · vence dia ${x.vence}</span><span class="fin-cc-v">${brl(u)}</span><div class="bar"><i style="width:${p}%;${p >= (d.cfg.alertaCartao || 80) ? "background:var(--err)" : ""}"></i></div><span class="mut">${x.limite ? "disponível " + brl(x.limite - u) : "sem limite cadastrado"}</span></button>`; }).join("");
    let body = `<div class="empty">Cadastre um cartão em <a href="#/financas/cadastros">Cadastros</a>.</div>`;
    if (c) {
      const fs = F.faturas(c.id);
      body = fs.length ? fs.map((f) => `<div class="card fin-fat"><div class="fin-fat-h"><div><h3 style="margin:0">Fatura ${monthLabel(f.key)}</h3><span class="mut">fecha ${fdate(f.fecha)} · vence ${fdate(f.vence)} · ${f.itens.length} lançamento(s)</span></div><span class="sp"></span><span class="pill ${f.status === "paga" ? "ok" : f.status === "vencida" ? "err" : f.status === "fechada" ? "warn" : "info"}">${f.status}</span><b class="fin-fat-v">${brl(f.total)}</b>${f.status === "paga" ? `<button class="btn ghost sm" data-unf="${f.key}">Desfazer Pagamento</button>` : f.total > 0 ? `<button class="btn sm" data-payf="${f.key}">Pagar</button>` : ""}</div>
        ${f.pagto && f.pagto.pago ? `<p class="mut fin-sub">Paga em ${fdate(f.pagto.pago)} · ${brl(f.pagto.valorPago)}${Math.abs(f.pagto.valorPago - f.total) > 0.01 ? ` (diferença de ${brl(f.pagto.valorPago - f.total)})` : ""}</p>` : ""}
        <details ${f.status !== "paga" && f.key <= F.mesSeg(monthKey(todayISO()), 1) ? "open" : ""}><summary>Compras</summary><div class="tw"><table><tbody>${f.itens.map((l) => `<tr data-ed="${l.id}" class="fin-row"><td>${fdate(l.comp)}</td><td>${esc(l.desc)}</td><td class="mut">${esc(F.cat(l.catId).nome)}</td><td class="r ${l.tipo === "estorno" ? "pos" : ""}">${l.tipo === "estorno" ? "−" : ""}${brl(l.valor)}</td></tr>`).join("")}</tbody></table></div></details></div>`).join("") : `<div class="empty">Nenhuma compra neste cartão.<div class="toolbar" style="justify-content:center;margin-top:12px"><button class="btn orange sm" onclick="document.getElementById('fNovo').click()">+ Compra neste cartão</button></div></div>`;
    }
    root.innerHTML = ERP.pagehead("Cartões e Faturas", `<button class="btn ghost" id="fEst">Estorno / Crédito</button><button class="btn orange" id="fNovo">+ Compra</button>`) + `<div class="fin-ccs">${tiles}</div>${body}`;
    $$("[data-cc]", root).forEach((b) => (b.onclick = () => { S.card = b.dataset.cc; ERP.render(); }));
    $("#fNovo", root).onclick = () => { const m = lancForm(); if (m && c) { const fm = $("form", m.el); fm.elements.origem.value = "cc:" + c.id; fm.elements.origem.onchange(); } };
    $("#fEst", root).onclick = () => { if (!c) return; ERP.form({ title: "Estorno ou Crédito no " + c.nome, fields: [{ k: "desc", label: "Descrição", required: true, full: true }, { k: "valor", label: "Valor (R$)", type: "number", step: "0.01" }, { k: "data", label: "Data", type: "date", value: todayISO() }, { k: "catId", label: "Categoria da Compra Estornada", type: "select", options: catOpts("despesa") }], onSubmit(v) { if (!(v.valor > 0)) return false; salvar((dd) => dd.lanc.push({ id: uid("l"), tipo: "estorno", cartaoId: c.id, desc: v.desc, valor: F.r2(v.valor), comp: v.data, venc: v.data, fatura: F.faturaDe(c, v.data).key, catId: v.catId, pago: null, hist: [{ em: new Date().toISOString(), o: "Estorno lançado" }] })); ERP.render(); } }); };
    $$("[data-payf]", root).forEach((b) => (b.onclick = () => pagarFatura(c.id, b.dataset.payf)));
    $$("[data-unf]", root).forEach((b) => (b.onclick = () => desfazerFatura(c.id, b.dataset.unf)));
    $$("[data-ed]", root).forEach((r) => (r.onclick = () => { const l = D().lanc.find((x) => x.id === r.dataset.ed); if (l.tipo === "estorno") { ERP.confirm("Excluir este estorno?", "Excluir").then((ok) => { if (ok) { salvar((dd) => { dd.lanc = dd.lanc.filter((y) => y.id !== l.id); }); ERP.render(); } }); } else lancForm(l); }));
  }

  /* ---------- 5. Fluxo de caixa ---------- */
  function pFluxo(root) {
    const pj = F.projecao(12); const jur = pj.porMes.reduce((s, m) => s + m.juros, 0);
    const hist = []; for (let i = -6; i < 0; i++) { const mk = F.mesSeg(monthKey(todayISO()), i); const r = F.dreMes(mk, "caixa"); hist.push({ l: monthLabel(mk), a: r.rec, b: r.despesas + r.investimento }); }
    root.innerHTML = ERP.pagehead("Fluxo de Caixa", `<button class="btn orange" id="fNovo">+ Lançamento</button>`) + `
      <div class="kpis">${ERP.kpi("Saldo Hoje", brl(pj.ini), "contas, sem as reservas", pj.ini < 0 ? "neg" : "")}${ERP.kpi("Em 3 Meses", brl(pj.porMes[2].saldo), monthLabel(pj.porMes[2].mk), pj.porMes[2].saldo < 0 ? "neg" : "")}${ERP.kpi("Em 12 Meses", brl(pj.porMes[11].saldo), monthLabel(pj.porMes[11].mk), pj.porMes[11].saldo < 0 ? "neg" : "")}${ERP.kpi("Menor Saldo Previsto", brl(pj.min.v), fdate(pj.min.data), pj.min.v < 0 ? "neg" : "")}${jur ? ERP.kpi("Juros de Cheque Especial", brl(jur), "estimativa em 12 meses", "neg") : ""}</div>
      <div class="card"><h3>Saldo Projetado</h3>${linha([{ l: "hoje", v: pj.ini }].concat(pj.porMes.map((m) => ({ l: monthLabel(m.mk), v: m.saldo }))))}<p class="mut fin-leg">Contas e recebimentos em aberto (os atrasados entram hoje), faturas pelo vencimento e recorrências até 12 meses. Cadastre os fixos com “Repetir todo mês” para a projeção ficar completa.</p></div>
      <div class="card"><h3>Mês a Mês</h3><div class="tw"><table><thead><tr><th>Mês</th><th class="r">Entradas</th><th class="r">Saídas</th><th class="r">Resultado</th><th class="r">Saldo no Fim</th></tr></thead><tbody>
      <tr><td>Hoje</td><td></td><td></td><td></td><td class="r">${sinal(pj.ini)}</td></tr>${pj.porMes.map((m) => `<tr><td>${monthLabel(m.mk)}</td><td class="r pos">${brl(m.ent)}</td><td class="r neg">${brl(m.sai)}</td><td class="r">${sinal(m.ent - m.sai)}</td><td class="r"><b>${sinal(m.saldo)}</b></td></tr>`).join("")}</tbody></table></div></div>
      <div class="card"><h3>Realizado nos Últimos 6 Meses (caixa)</h3>${barras(hist)}</div>`;
    { const b = $("#fNovo", root); if (b) b.onclick = () => lancForm(); }
  }

  /* ---------- 6. Orçamento ---------- */
  function pOrc(root) {
    const d = D(); const linhas = F.orcamentoMes(S.mk); const r = F.dreMes(S.mk, "competencia");
    const comO = linhas.filter((x) => x.orcado > 0); const totO = comO.reduce((s, x) => s + x.orcado, 0), totR = comO.reduce((s, x) => s + x.realizado, 0);
    const fora = linhas.filter((x) => !(x.orcado > 0)).reduce((s, x) => s + x.realizado, 0);
    const rec = r.rec || 0; const b5 = { nec: r.essencial + r.financeiro, est: r.estilo, inv: r.investimento };
    const cats = d.categorias.filter((c) => c.tipo === "despesa" && c.ativa !== false);
    root.innerHTML = ERP.pagehead("Orçamento", `${mesNav()}<button class="btn ghost" id="oCopy">Copiar do Mês Anterior</button><button class="btn orange" id="oEdit">Definir Orçamento</button>`) + `
      <div class="kpis">${ERP.kpi("Orçado", brl(totO), monthLabel(S.mk))}${ERP.kpi("Realizado + Previsto", brl(totR), totO ? num((totR / totO) * 100, 0) + "% do orçado (categorias orçadas)" : "", totO && totR > totO ? "neg" : "")}${ERP.kpi("Fora do Orçamento", brl(fora), "categorias sem valor orçado", fora ? "neg" : "")}${ERP.kpi("Sobra Planejada", brl(rec - totO - fora), "receitas " + brl(rec) + " − orçado − fora do orçamento", rec - totO - fora < 0 ? "neg" : "pos")}</div>
      <div class="card"><h3>Regra 50/30/20 · ${monthLabel(S.mk)}</h3><p class="mut" style="margin-bottom:8px">Referência: até 50% da renda em necessidades (incluindo dívidas), até 30% em estilo de vida e pelo menos 20% em investimentos.</p>
        ${[["Necessidades", b5.nec, 50], ["Estilo de Vida", b5.est, 30], ["Investimentos e Reservas", b5.inv, 20]].map(([n, v, ref], i) => { const p = rec ? (v / rec) * 100 : 0; const ruim = i === 2 ? p < ref : p > ref; return `<div class="hrow" style="grid-template-columns:170px 1fr 120px"><span class="n">${n}</span><div class="bar"><i style="width:${Math.min(100, p)}%;${ruim && rec ? "background:var(--err)" : ""}"></i></div><span class="v">${num(p, 0)}% <small class="mut">ref. ${ref}%</small></span></div>`; }).join("")}</div>
      <div class="card"><h3>Por Categoria</h3>${linhas.length ? `<div class="tw"><table><thead><tr><th>Categoria</th><th class="r">Orçado</th><th class="r">Realizado + Previsto</th><th class="r">Ainda a Pagar</th><th>Uso</th><th class="r">Disponível</th></tr></thead><tbody>${linhas.sort((a, b) => b.pct - a.pct).map((x) => `<tr><td><b>${esc(x.c.nome)}</b><div class="mut fin-sub">${esc(x.c.grupo)}</div></td><td class="r">${brl(x.orcado)}</td><td class="r">${brl(x.realizado)}</td><td class="r mut">${x.pendente ? brl(x.pendente) : ""}</td><td style="min-width:140px"><div class="bar"><i style="width:${Math.min(100, x.pct)}%;${x.pct > 100 ? "background:var(--err)" : x.pct > 80 ? "background:var(--warn)" : ""}"></i></div></td><td class="r">${x.orcado ? sinal(x.orcado - x.realizado) : '<span class="pill warn">sem orçamento</span>'}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Sem orçamento e sem despesas neste mês.<div class="toolbar" style="justify-content:center;margin-top:12px"><button class="btn orange sm" onclick="document.getElementById('oEdit').click()">Definir Orçamento</button></div></div>`}</div>`;
    bindMes(root);
    $("#oCopy", root).onclick = () => { const ant = F.mesSeg(S.mk, -1); Store.change("financas", (dd) => { const m = {}; cats.forEach((c) => { const v = F.orcado(ant, c.id); if (v) m[c.id] = v; }); dd.orcamento.meses[S.mk] = m; }); ERP.toast("Orçamento copiado de " + monthLabel(ant) + "."); ERP.render(); };
    $("#oEdit", root).onclick = () => {
      const ult = {}; for (let i = 1; i <= 3; i++) { const x = F.dreMes(F.mesSeg(S.mk, -i), "competencia"); Object.entries(x.porCat).forEach(([k, v]) => (ult[k] = (ult[k] || 0) + v / 3)); }
      ERP.form({ title: "Orçamento de " + monthLabel(S.mk), wide: true, intro: "Valores por categoria. Deixe em branco o que não quer acompanhar. A dica ao lado é a média dos últimos 3 meses.",
        fields: [{ k: "padrao", label: "Usar estes valores como padrão para os próximos meses", type: "checkbox", value: true, full: true }].concat(cats.map((c) => ({ k: "o_" + c.id, label: c.grupo + " · " + c.nome, type: "number", step: "0.01", value: F.orcado(S.mk, c.id) || "", hint: ult[c.id] ? "média " + brl(ult[c.id]) : "" }))),
        onSubmit(v) { Store.change("financas", (dd) => { const m = {}; cats.forEach((c) => { const x = v["o_" + c.id]; if (x > 0) m[c.id] = F.r2(x); }); dd.orcamento.meses[S.mk] = m; if (v.padrao) dd.orcamento.padrao = Object.assign({}, m); }); ERP.toast("Orçamento salvo."); ERP.render(); } });
    };
  }

  /* ---------- 7. Dívidas ---------- */
  function dividaForm(dv) {
    const novo = !dv; dv = dv || { tipo: "emprestimo", prioridade: "Média", taxa: 0, dia: 10 };
    const inf = novo ? null : F.dividaInfo(dv);
    ERP.form({ title: novo ? "Nova Dívida" : "Editar Dívida", wide: true,
      intro: novo ? "As parcelas viram contas a pagar previstas (categoria Parcelas de dívidas) e aparecem no fluxo de caixa." : `Restam ${inf.rest} parcela(s) em aberto. Mudar parcela, quantidade ou dia refaz só as parcelas em aberto.`,
      fields: [
        { k: "nome", label: "Nome", value: dv.nome, required: true, placeholder: "Ex.: Financiamento do carro" }, { k: "credor", label: "Credor", value: dv.credor },
        { k: "tipo", label: "Tipo", type: "select", value: dv.tipo, options: [["emprestimo", "Empréstimo Pessoal"], ["financiamento", "Financiamento"], ["consignado", "Consignado"], ["acordo", "Acordo / Renegociação"], ["parcelamento", "Parcelamento de Fatura"], ["outro", "Outro"]] },
        { k: "prioridade", label: "Prioridade", type: "select", value: dv.prioridade, options: [["Alta", "Alta"], ["Média", "Média"], ["Baixa", "Baixa"]] },
        { k: "parcela", label: "Valor da Parcela (R$)", type: "number", step: "0.01", value: inf && inf.proxima ? inf.proxima.valor : dv.parcela },
        { k: "rest", label: "Parcelas Restantes", type: "number", step: "1", value: inf ? inf.rest : "" },
        { k: "prox", label: "Próximo Vencimento", type: "date", value: inf && inf.proxima ? inf.proxima.venc : F.diaNoMes(F.mesSeg(monthKey(todayISO()), 1), dv.dia) },
        { k: "taxa", label: "Juros (% ao mês)", type: "number", step: "0.01", value: dv.taxa, hint: "Usado no saldo devedor e no plano de quitação" },
        { k: "contaId", label: "Paga pela Conta", type: "select", creatable: "conta", value: dv.contaId, options: F.contasAtivas().map((c) => [c.id, c.nome]) },
        { k: "obs", label: "Observação", value: dv.obs, full: true },
      ],
      onSubmit(v) {
        if (!v.nome.trim() || !(v.parcela > 0) || !(v.rest >= 0) || !v.prox) { ERP.toast("Informe nome, parcela, parcelas restantes e próximo vencimento."); return false; }
        salvar((d) => {
          let x = novo ? null : d.dividas.find((y) => y.id === dv.id);
          if (!x) { x = { id: uid("dv") }; d.dividas.push(x); }
          Object.assign(x, { nome: v.nome.trim(), credor: v.credor, tipo: v.tipo, prioridade: v.prioridade, taxa: v.taxa, contaId: v.contaId, obs: v.obs, dia: +v.prox.slice(8, 10) });
          d.lanc = d.lanc.filter((l) => !(l.dividaId === x.id && !l.pago));
          for (let i = 0; i < Math.round(v.rest); i++) { const dt = addMonths(v.prox, i); d.lanc.push({ id: uid("l"), tipo: "despesa", dividaId: x.id, desc: `${x.nome} · parcela`, catId: F.DIVIDA_CAT, valor: F.r2(v.parcela), contaId: v.contaId, comp: dt, venc: dt, pago: null, hist: [{ em: new Date().toISOString(), o: "Parcela gerada pela dívida" }] }); }
        });
        ERP.toast("Dívida salva."); ERP.render();
      },
      onDelete: novo ? null : () => { salvar((d) => { d.dividas = d.dividas.filter((y) => y.id !== dv.id); d.lanc = d.lanc.filter((l) => !(l.dividaId === dv.id && !l.pago)); }); ERP.render(); },
      deleteConfirm: "Excluir a dívida? As parcelas em aberto saem das contas a pagar; as pagas ficam no histórico." });
  }
  function pDividas(root) {
    const d = D(); const infos = d.dividas.map((dv) => Object.assign({ dv }, F.dividaInfo(dv))); const ativas = infos.filter((x) => x.rest > 0);
    const tot = ativas.reduce((s, x) => s + x.saldo, 0), mes = ativas.reduce((s, x) => s + (x.proxima ? x.proxima.valor : 0), 0);
    const rec = F.dreMes(monthKey(todayISO()), "competencia").rec;
    const base = F.simularDividas(0, S.metodo), com = F.simularDividas(S.extra, S.metodo);
    const PR = { Alta: 0, "Média": 1, Baixa: 2 };
    const ord = ativas.slice().sort((a, b) => S.metodo === "neve" ? a.saldo - b.saldo : S.metodo === "prioridade" ? PR[a.dv.prioridade] - PR[b.dv.prioridade] || a.saldo - b.saldo : (+b.dv.taxa || 0) - (+a.dv.taxa || 0) || a.saldo - b.saldo);
    /* aderência do mês (IDP do Piloto): parcelas pagas ÷ planejadas */
    const mkH = monthKey(todayISO()); const doMes = d.lanc.filter((l) => l.dividaId && monthKey(l.venc) === mkH);
    const plan = doMes.reduce((s2, l) => s2 + l.valor, 0), pagoM = doMes.filter((l) => l.pago).reduce((s2, l) => s2 + l.valor, 0); const idp = plan ? pagoM / plan : 0;
    const mesLbl = (n) => monthLabel(F.mesSeg(monthKey(todayISO()), n));
    root.innerHTML = ERP.pagehead("Dívidas", `<button class="btn orange" id="dNova">+ Dívida</button>`) + `
      <div class="kpis">${ERP.kpi("Saldo Devedor", brl(tot), "valor presente das parcelas", tot ? "neg" : "")}${ERP.kpi("Parcelas por Mês", brl(mes), rec ? num((mes / rec) * 100, 1) + "% da renda do mês" : "", rec && mes / rec > 0.3 ? "neg" : "")}${ERP.kpi("Juros Embutidos", brl(ativas.reduce((s, x) => s + x.juros, 0)), "nominal − saldo")}${ERP.kpi("Quitação de Tudo", base.meses ? mesLbl(base.meses) : "—", base.meses ? base.meses + " meses no ritmo atual" : "")}</div>
      ${ativas.length ? `<div class="card"><h3>Plano de Quitação</h3>
        <div class="toolbar"><div class="tabs" style="margin:0"><button class="${S.metodo === "avalanche" ? "on" : ""}" data-met="avalanche" title="Paga primeiro a dívida com maior juros: gasta menos">Avalanche (maior juros)</button><button class="${S.metodo === "neve" ? "on" : ""}" data-met="neve" title="Paga primeiro a menor dívida: vitórias rápidas">Bola de Neve (menor saldo)</button><button class="${S.metodo === "prioridade" ? "on" : ""}" data-met="prioridade" title="Pela prioridade que você definiu (Alta, Média, Baixa)">Por Prioridade</button></div><label class="mut" for="dExtra">Extra por mês (R$)</label><input id="dExtra" type="number" step="50" value="${S.extra}" style="width:120px"></div>
        <div class="kpis" style="margin:10px 0">${ERP.kpi("Sem Extra", base.meses + " meses", "juros " + brl(base.juros))}${ERP.kpi("Com " + brl(S.extra) + "/mês", com.meses + " meses", "juros " + brl(com.juros), "pos")}${ERP.kpi("Economia", brl(base.juros - com.juros), (base.meses - com.meses) + " meses antes", "pos")}</div>
        <ol class="fin-plano">${ord.map((x) => `<li><b>${esc(x.dv.nome)}</b> · saldo ${brl(x.saldo)} · ${num(+x.dv.taxa || 0, 2)}% a.m. · quita em <b>${com.quit[x.dv.id] ? mesLbl(com.quit[x.dv.id]) : "—"}</b>${x.atraso ? ` <span class="pill err">${x.atraso} em atraso</span>` : ""}</li>`).join("")}</ol>
        ${plan ? `<p class="fin-leg">Parcelas de ${monthLabel(mkH)}: pagas <b>${brl(pagoM)}</b> de <b>${brl(plan)}</b> planejadas · aderência <b class="${idp >= 0.98 ? "pos" : idp >= 0.9 ? "" : "neg"}">${Math.round(idp * 100)}% ● ${idp >= 0.98 ? "Aderente" : idp >= 0.9 ? "Atenção" : "Desvio"}</b></p>` : ""}
        <p class="mut fin-leg">Simulação: paga a parcela de todas e põe o extra (mais as parcelas de quem já quitou) na primeira da lista. Para pagar a mais de verdade, combine a amortização com o credor e ajuste as parcelas aqui.</p></div>` : ""}
      ${ativas.length ? `<div class="card"><h3>Projeção de desembolso mensal <small class="mut" style="font-weight:600">parcelas futuras · empilhado por dívida</small></h3><div class="fp-chart" style="height:240px"><canvas id="chDivProj"></canvas></div></div>` : ""}
      <div class="card"><h3>Dívidas Cadastradas</h3>${infos.length ? `<div class="tw"><table><thead><tr><th>Dívida</th><th>Prioridade</th><th class="r">Parcela</th><th class="r">Restam</th><th class="r">Saldo Devedor</th><th>Próximo Vencimento</th><th>Última</th><th></th></tr></thead><tbody>${infos.map((x) => `<tr><td>${star("dividas", x.dv.id)}<b>${esc(x.dv.nome)}</b><div class="mut fin-sub">${esc(x.dv.credor || "")} ${x.dv.taxa ? "· " + num(+x.dv.taxa, 2) + "% a.m." : ""}</div></td><td><span class="pill ${x.dv.prioridade === "Alta" ? "err" : x.dv.prioridade === "Média" ? "warn" : ""}">${x.dv.prioridade}</span></td><td class="r">${x.proxima ? brl(x.proxima.valor) : ""}</td><td class="r">${x.rest ? x.rest + "x" : '<span class="pill ok">quitada</span>'}</td><td class="r">${brl(x.saldo)}</td><td>${x.proxima ? fdate(x.proxima.venc) + " " + pill(F.situacao(x.proxima)) : ""}</td><td>${x.ultima ? monthLabel(monthKey(x.ultima.venc)) : ""}</td><td class="r" style="white-space:nowrap">${x.proxima ? `<button class="btn sm" data-pay="${x.proxima.id}">Pagar Parcela</button> ` : ""}<button class="btn ghost sm" data-dv="${x.dv.id}">Editar</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Nenhuma dívida cadastrada. Cheque especial e cartão já aparecem no fluxo de caixa e nas faturas; cadastre aqui empréstimos, financiamentos e acordos.<div class="toolbar" style="justify-content:center;margin-top:12px"><button class="btn orange sm" onclick="document.getElementById('dNova').click()">+ Dívida</button></div></div>`}</div>`;
    $("#dNova", root).onclick = () => dividaForm();
    $$("[data-dv]", root).forEach((b) => (b.onclick = () => dividaForm(d.dividas.find((x) => x.id === b.dataset.dv))));
    $$("[data-pay]", root).forEach((b) => (b.onclick = () => pagar(b.dataset.pay)));
    $$("[data-met]", root).forEach((b) => (b.onclick = () => { S.metodo = b.dataset.met; ERP.render(); }));
    if (ativas.length) {
      const H = Math.min(24, Math.max(6, ...ativas.map((x) => x.rest))); const ms = Array.from({ length: H }, (_, i) => F.mesSeg(mkH, i));
      const PAL = ["#3F6DB3", "#E0796F", "#C9922E", "#3A8F7E", "#8A63C2", "#7A8BA8"];
      const top = ativas.slice().sort((a, b) => b.saldo - a.saldo); const prim = top.slice(0, 5), resto = top.slice(5);
      const serie = (xs) => ms.map((mk) => d.lanc.filter((l) => xs.some((x) => x.dv.id === l.dividaId) && !l.pago && (l.venc < todayISO() ? mkH : monthKey(l.venc)) === mk).reduce((s2, l) => s2 + l.valor, 0));
      const ds = prim.map((x, i) => ({ label: x.dv.nome, data: serie([x]), backgroundColor: PAL[i], borderRadius: 3, stack: "s" })); if (resto.length) ds.push({ label: "Outras", data: serie(resto), backgroundColor: "#AEB6C2", stack: "s" });
      ERP.chart($("#chDivProj", root), { type: "bar", data: { labels: ms.map((m) => monthLabel(m)), datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${brl(c.parsed.y)}`, footer: (its) => "Total do mês: " + brl(its.reduce((s2, i) => s2 + i.parsed.y, 0)) } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: () => ERP.cor("--line") } } } } });
    }
    const ex = $("#dExtra", root); if (ex) ex.onchange = (e) => { S.extra = Math.max(0, parseNum(e.target.value)); ERP.render(); };
  }

  /* ---------- 8. Metas e planejamento ---------- */
  function pMetas(root) {
    const d = D(); const c = d.cfg; const h = todayISO();
    const media = F.mediaEssencial(6); const alvoRes = media * (c.reservaMeses || 6);
    const metaRes = d.metas.find((m) => m.reserva); const guardRes = (metaRes ? +metaRes.guardado : 0) + F.saldoReservas();
    const pat = ERP.patrimonio ? ERP.patrimonio.total().net : 0;
    const anos = Math.max(1, (c.idadeApos || 60) - (c.idade || 40)); const n = anos * 12; const i = Math.pow(1 + (c.retornoReal || 4) / 100, 1 / 12) - 1;
    const alvoApos = (c.rendaDesejada || 0) * 12 / 0.04;
    const fvAtual = pat * Math.pow(1 + i, n); const falta = Math.max(0, alvoApos - fvAtual);
    const aporteNec = i > 0 ? falta * i / (Math.pow(1 + i, n) - 1) : falta / n;
    const proj = []; let v = pat; proj.push({ l: String(c.idade), v }); for (let k = 1; k <= n; k++) { v = v * (1 + i) + (+c.aporteApos || 0); if (k % 12 === 0 && (k / 12) % Math.max(1, Math.round(anos / 8)) === 0) proj.push({ l: String((c.idade || 40) + k / 12), v }); }
    const metaRow = (m) => { const p = m.alvo > 0 ? Math.min(100, (m.guardado / m.alvo) * 100) : 0; const meses = m.prazo ? Math.max(1, F.diasEntre(h, m.prazo) / 30.4) : 0; const porMes = meses ? Math.max(0, (m.alvo - m.guardado) / meses) : 0; return `<div class="fin-meta"><div><b>${esc(m.nome)}</b><div class="mut fin-sub">${brl(m.guardado)} de ${brl(m.alvo)}${m.prazo ? " · até " + fdate(m.prazo) : ""}${porMes ? " · guardar " + brl(porMes) + "/mês" : ""}</div><div class="bar"><i style="width:${p}%;background:${p >= 100 ? "var(--ok)" : "var(--orange)"}"></i></div></div><span class="v">${num(p, 0)}%</span><button class="btn sm" data-ap="${m.id}">Guardar</button><button class="btn ghost sm" data-me="${m.id}">Editar</button></div>`; };
    root.innerHTML = ERP.pagehead("Metas e Planejamento", `<button class="btn orange" id="mNova">+ Meta</button>`) + `
      <div class="grid2"><div class="card"><h3>Reserva de Emergência</h3>
        <div class="kpis" style="margin:0 0 10px">${ERP.kpi("Alvo", brl(alvoRes), `${c.reservaMeses || 6} meses × ${brl(media)} de custo essencial`)}${ERP.kpi("Guardado", brl(guardRes), alvoRes ? num((guardRes / alvoRes) * 100, 0) + "% · cobre " + num(media ? guardRes / media : 0, 1) + " meses" : "", guardRes >= alvoRes && alvoRes ? "pos" : "")}</div>
        <div class="bar"><i style="width:${alvoRes ? Math.min(100, (guardRes / alvoRes) * 100) : 0}%"></i></div>
        <p class="mut fin-leg">Conta como reserva o saldo das contas do tipo “Reserva” e a meta marcada como reserva. O custo essencial é a média de necessidades + financeiro dos últimos 6 meses.</p></div>
      <div class="card"><h3>Aposentadoria (independência financeira)</h3>
        <div class="kpis" style="margin:0 0 10px">${ERP.kpi("Patrimônio Necessário", brl(alvoApos), `renda de ${brl(c.rendaDesejada)}/mês pela regra dos 4%`)}${ERP.kpi("Aporte Mensal Necessário", brl(aporteNec), `por ${anos} anos a ${num(c.retornoReal || 4, 1)}% a.a. real`, aporteNec > (c.aporteApos || 0) ? "neg" : "pos")}</div>
        ${linha(proj)}<p class="mut fin-leg">Projeção com patrimônio líquido de hoje (${brl(pat)}) e aporte de ${brl(c.aporteApos)}/mês. <a href="javascript:void 0" id="mApo">Ajustar premissas</a></p></div></div>
      <div class="card"><h3>Metas</h3>${d.metas.length ? d.metas.map(metaRow).join("") : `<div class="empty">Nenhuma meta. Exemplos: viagem, troca de carro, entrada de imóvel, reserva de emergência.<div class="toolbar" style="justify-content:center;margin-top:12px"><button class="btn orange sm" onclick="document.getElementById('mNova').click()">+ Meta</button></div></div>`}</div>`;
    const metaForm = (m) => { const nova = !m; m = m || { guardado: 0 }; ERP.form({ title: nova ? "Nova Meta" : "Editar meta", fields: [{ k: "nome", label: "Nome", value: m.nome, required: true, full: true }, { k: "alvo", label: "Valor Alvo (R$)", type: "number", step: "0.01", value: m.alvo }, { k: "guardado", label: "Já Guardado (R$)", type: "number", step: "0.01", value: m.guardado }, { k: "prazo", label: "Prazo", type: "date", value: m.prazo }, { k: "reserva", label: "É a reserva de emergência", type: "checkbox", value: m.reserva }], onSubmit(v) { Store.change("financas", (dd) => { if (nova) dd.metas.push(Object.assign({ id: uid("mt"), hist: [] }, v)); else Object.assign(dd.metas.find((x) => x.id === m.id), v); }); ERP.render(); }, onDelete: nova ? null : () => { Store.change("financas", (dd) => { dd.metas = dd.metas.filter((x) => x.id !== m.id); }); ERP.render(); } }); };
    $("#mNova", root).onclick = () => metaForm();
    $$("[data-me]", root).forEach((b) => (b.onclick = () => metaForm(d.metas.find((x) => x.id === b.dataset.me))));
    $$("[data-ap]", root).forEach((b) => (b.onclick = () => { const m = d.metas.find((x) => x.id === b.dataset.ap); ERP.form({ title: "Guardar em " + m.nome, intro: "Opcional: lance também a saída da conta como aporte (categoria Investimentos e reservas).", fields: [{ k: "valor", label: "Valor (R$)", type: "number", step: "0.01" }, { k: "lanc", label: "Lançar como despesa de aporte", type: "checkbox", value: true }, { k: "contaId", label: "Saiu da Conta", type: "select", creatable: "conta", options: F.contasAtivas().map((c2) => [c2.id, c2.nome]) }], onSubmit(v) { if (!v.valor) return false; salvar((dd) => { const x = dd.metas.find((y) => y.id === m.id); x.guardado = F.r2((+x.guardado || 0) + v.valor); (x.hist = x.hist || []).push({ em: todayISO(), v: v.valor }); if (v.lanc) { const cid = (dd.categorias.find((c2) => c2.natureza === "investimento" && (m.reserva ? /reserva/i.test(c2.nome) : /aporte/i.test(c2.nome))) || {}).id; dd.lanc.push({ id: uid("l"), tipo: "despesa", desc: "Aporte · " + m.nome, catId: cid, valor: F.r2(v.valor), contaId: v.contaId, comp: todayISO(), venc: todayISO(), pago: todayISO(), valorPago: F.r2(v.valor), hist: [{ em: new Date().toISOString(), o: "Aporte na meta" }] }); } }); ERP.render(); } }); }));
    $("#mApo", root).onclick = () => ERP.form({ title: "Premissas do Planejamento", fields: [{ k: "idade", label: "Idade Hoje", type: "number", value: c.idade }, { k: "idadeApos", label: "Idade para se Aposentar", type: "number", value: c.idadeApos }, { k: "rendaDesejada", label: "Renda Mensal Desejada (R$ de hoje)", type: "number", step: "100", value: c.rendaDesejada }, { k: "retornoReal", label: "Retorno Real (% a.a., acima da inflação)", type: "number", step: "0.1", value: c.retornoReal }, { k: "aporteApos", label: "Aporte Mensal Atual (R$)", type: "number", step: "100", value: c.aporteApos }, { k: "reservaMeses", label: "Meses de Reserva de Emergência", type: "number", value: c.reservaMeses }], onSubmit(v) { Store.change("financas", (dd) => Object.assign(dd.cfg, v)); ERP.render(); } });
  }

  /* ---------- 9. Relatórios (DRE pessoal e indicadores) ---------- */
  function pRel(root) {
    const reg = D().cfg.regime; const y = S.dreAno; const ms = Array.from({ length: 12 }, (_, i) => y + "-" + ERP.p2(i + 1)); const rs = ms.map((mk) => F.dreMes(mk, reg));
    const T = (k) => rs.reduce((s, r) => s + (r[k] || 0), 0);
    const linhaD = (n, k, cls, neg) => `<tr class="${cls || ""}"><td>${n}</td>${rs.map((r) => `<td class="r">${r[k] ? (neg ? "−" : "") + num(Math.abs(r[k]), 0) : ""}</td>`).join("")}<td class="r"><b>${(neg && T(k) ? "−" : "") + num(Math.abs(T(k)), 0)}</b></td></tr>`;
    const grupos = {}; D().categorias.forEach((c) => { if (c.tipo === "despesa") (grupos[c.natureza + "|" + c.grupo] = grupos[c.natureza + "|" + c.grupo] || []).push(c.id); });
    const linhaG = (nat) => Object.entries(grupos).filter(([k]) => k.startsWith(nat + "|")).map(([k, ids]) => { const vs = rs.map((r) => ids.reduce((s, id) => s + (r.porCat[id] || 0), 0)); const t = vs.reduce((a, b) => a + b, 0); return t ? `<tr class="fin-sub-row"><td>${esc(k.split("|")[1])}</td>${vs.map((v) => `<td class="r mut">${v ? num(v, 0) : ""}</td>`).join("")}<td class="r mut">${num(t, 0)}</td></tr>` : ""; }).join("");
    const rec = T("rec"), desp = T("despesas"), fin = T("financeiro"), inv = T("investimento"), res = T("resultado");
    const mesesAtivos = rs.filter((r) => r.n).length || 1;
    root.innerHTML = ERP.pagehead("Relatórios · " + y, `${regimeTgl()}<button class="btn ghost sm" data-ano="-1">‹ ${y - 1}</button><button class="btn ghost sm" data-ano="1">${y + 1} ›</button>`) + `
      <div class="kpis">${ERP.kpi("Receitas no Ano", brl(rec), "média " + brl(rec / mesesAtivos) + "/mês", "pos")}${ERP.kpi("Despesas no Ano", brl(desp), "média " + brl(desp / mesesAtivos) + "/mês", "neg")}${ERP.kpi("Taxa de Poupança", rec ? num(((inv + Math.max(0, res - inv)) / rec) * 100, 1) + "%" : "—", "aportes + sobra ÷ receitas")}${ERP.kpi("Comprometimento com Dívidas", rec ? num((fin / rec) * 100, 1) + "%" : "—", "financeiro ÷ receitas", rec && fin / rec > 0.3 ? "neg" : "")}${ERP.kpi("Custos Fixos", desp ? num((T("fixo") / desp) * 100, 0) + "%" : "—", "das despesas")}</div>
      ${(() => { const tot = { consumo: 0, financeiro: 0, investimento: 0, fora: 0 }; const porMes = {}; D().lanc.forEach((l) => { if (l.tipo === "receita" || l.tipo === "compra" || l.tipo === "estorno") return; const dt = reg === "caixa" ? (l.pago || null) : F.dataComp(l); if (!dt || dt.slice(0, 4) !== String(y)) return; if (reg === "caixa" && !l.pago) return; const nt = F.naturezaGasto(l); const v = l.valorPago != null && reg === "caixa" ? l.valorPago : l.valor; tot[nt] = (tot[nt] || 0) + v; }); const base = tot.consumo + tot.financeiro + tot.investimento || 1; const CORN = { consumo: "var(--navy)", financeiro: "var(--err)", investimento: "var(--ok)", fora: "var(--ink-3)" }; return `<div class="card"><h3>Por Natureza do Gasto · ${y} <small class="mut" style="font-weight:400">regra automática: dívidas/parcelas → Financeiro; aportes e reservas → Investimento; transferências → fora do resultado</small></h3>${["consumo", "financeiro", "investimento", "fora"].map((k) => `<div class="hrow"><span class="n" title="${esc(F.NATUREZA_GASTO[k])}">${esc(F.NATUREZA_GASTO[k].split(" (")[0])}</span><div class="bar"><i style="width:${k === "fora" ? 0 : (tot[k] / base) * 100}%;background:${CORN[k]}"></i></div><span class="v">${brl(tot[k])}${k !== "fora" ? `<small class="mut"> ${num((tot[k] / base) * 100, 0)}%</small>` : ""}</span></div>`).join("")}<p class="mut" style="margin-top:8px;font-size:12px">Compras no cartão entram pela fatura paga (regime de caixa) ou pela competência da compra. A classificação do lançamento (Dívidas / Investimentos) vale antes da natureza da categoria.</p></div>`; })()}
      <div class="card"><h3>DRE Pessoal · Regime de ${reg === "caixa" ? "caixa" : "competência"}</h3><div class="tw"><table class="fin-dre"><thead><tr><th></th>${ms.map((m) => `<th class="r">${monthLabel(m)}</th>`).join("")}<th class="r">Total</th></tr></thead><tbody>
        ${linhaD("Receitas", "rec", "fin-pos")}
        ${linhaD("(−) Necessidades", "essencial", "", true)}${linhaG("essencial")}
        ${linhaD("(−) Estilo de vida", "estilo", "", true)}${linhaG("estilo")}
        ${linhaD("(=) Resultado antes do financeiro", "operacional", "total")}
        ${linhaD("(−) Financeiro (juros, tarifas, dívidas)", "financeiro", "", true)}${linhaG("financeiro")}
        ${linhaD("(=) Sobra do mês", "resultado", "total")}
        ${linhaD("(−) Investimentos e reservas", "investimento", "", true)}
        ${linhaD("(=) Saldo livre", "livre", "total")}</tbody></table></div>
        <p class="mut fin-leg">${reg === "caixa" ? "Caixa: o que foi pago e recebido; a fatura do cartão entra quando é paga, rateada pelas categorias das compras." : "Competência: quando a despesa aconteceu (compra no cartão na data da compra, parcelas mês a mês), com os previstos."}</p></div>`;
    bindReg(root); $$("[data-ano]", root).forEach((b) => (b.onclick = () => { S.dreAno += +b.dataset.ano; ERP.render(); }));
  }

  /* ---------- 10. Cadastros ---------- */
  /* formulário da recorrência (usado em Cadastros e em Contas Ativas) */
  const serieF = (s) => ERP.form({ title: "Recorrência · " + s.desc, intro: "Alterações valem para os lançamentos em aberto a partir de hoje (eles são refeitos). Os já pagos não mudam.", wide: true, fields: [
      { k: "desc", label: "Descrição", value: s.desc, full: true },
      { k: "valor", label: "Valor", type: "number", step: "0.01", money: true, value: s.moeda === "USD" ? s.valorMoeda : s.valor },
      { k: "moeda", label: "Moeda", type: "select", value: s.moeda === "USD" ? "USD" : "BRL", options: [["BRL", "R$ (real)"], ["USD", "US$ (dólar)"]] },
      { k: "favId", label: "Favorecido", type: "select", creatable: "favorecido", value: s.favId || "", options: favOpts() },
      { k: "catId", label: "Categoria", type: "select", creatable: "categoria", value: s.catId, options: catOpts(s.tipo === "receita" ? "receita" : "despesa") },
      { k: "classe", label: "Classificação", type: "select", value: s.classe || "", options: [["", "Pela Categoria", "Usa a natureza da categoria"]].concat(F.CLASSES.map((x) => [x[0], x[1], x[3]])) },
      { k: "forma", label: "Forma de Pagamento", type: "select", creatable: "forma", value: s.forma || "", options: formaOpts() },
      { k: "centro", label: "Centro de Custo", type: "select", creatable: "centro", value: s.centro || "", options: centroOpts() },
      { k: "dia", label: "Dia do Mês", type: "number", value: s.dia },
      { k: "passo", label: "Recorrência", type: "select", value: String(s.passo || 1), options: FREQ },
      { k: "fim", label: "Termina em (vazio = sem fim)", type: "date", value: s.fim || "" },
      { k: "ativa", label: "Ativa", type: "checkbox", value: s.ativa !== false },
    ],
    init(fm, md) { const valEl = fm.elements.valor; let ant = fm.elements.moeda.value; const dolar = () => (ERP.investimentos && ERP.investimentos.fx && +ERP.investimentos.fx()) || 0; const sync = () => { const usd = fm.elements.moeda.value === "USD"; const r = dolar(), atual = ERP.parseNum(valEl.value); if (ant !== fm.elements.moeda.value && atual && r) valEl.value = usd ? F.r2(atual / r) : F.r2(atual * r); ant = fm.elements.moeda.value; ERP.moneyCur(valEl, usd ? "USD" : "BRL"); }; fm.elements.moeda.onchange = sync; ERP.moneyCur(valEl, fm.elements.moeda.value === "USD" ? "USD" : "BRL"); },
    onSubmit(v) {
      const usd = v.moeda === "USD"; const rate = usd ? ((ERP.investimentos && ERP.investimentos.fx && +ERP.investimentos.fx()) || 0) : 1; if (usd && !(rate > 0)) { ERP.toast("Defina a cotação do dólar em Investimentos."); return false; }
      salvar((dd) => { const x = dd.series.find((y) => y.id === s.id); Object.assign(x, { desc: v.desc.trim() || x.desc, moeda: usd ? "USD" : "BRL", valorMoeda: usd ? F.r2(+v.valor) : null, valor: F.r2((+v.valor || 0) * rate), dia: Math.min(31, Math.max(1, Math.round(v.dia))), passo: +v.passo || 1, fim: v.fim || null, catId: v.catId, classe: v.classe || "", forma: v.forma || "", centro: v.centro || "", favId: v.favId || "", ativa: !!v.ativa }); dd.lanc = dd.lanc.filter((l) => !(l.serieId === x.id && !l.pago && l.venc >= todayISO() && l.tipo !== "compra") && !(l.serieId === x.id && l.tipo === "compra" && l.comp >= todayISO())); });
      ERP.toast("Recorrência atualizada; os próximos lançamentos foram refeitos."); ERP.render();
    },
    onDelete() { salvar((dd) => { dd.lanc = dd.lanc.filter((l) => !(l.serieId === s.id && ((!l.pago && l.venc >= todayISO() && l.tipo !== "compra") || (l.tipo === "compra" && l.comp >= todayISO())))); dd.series = dd.series.filter((y) => y.id !== s.id); dd.lanc.forEach((l) => { if (l.serieId === s.id) { l.serieId = null; delete l.serieMes; } }); }); ERP.render(); }, deleteConfirm: "Excluir a recorrência e os próximos lançamentos em aberto? Os já pagos ficam." });
  function pCad(root) {
    const d = D(); const TIPOS = [["corrente", "Conta Corrente"], ["poupanca", "Poupança"], ["reserva", "Reserva (fora do saldo do dia a dia)"], ["dinheiro", "Dinheiro"], ["digital", "Conta Digital / Carteira"]];
    const meses = []; for (let i = -6; i <= 0; i++) meses.push(F.mesSeg(monthKey(todayISO()), i));
    root.innerHTML = ERP.pagehead("Cadastros") + `
      <div class="card"><h3>Contas</h3><div class="tw"><table><thead><tr><th>Conta</th><th>Tipo</th><th class="r">Saldo Inicial</th><th>Desde</th><th class="r">Saldo Hoje</th></tr></thead><tbody>${d.contas.map((c) => `<tr class="fin-row" data-ct="${c.id}"><td><b>${esc(c.nome)}</b>${c.ativa === false ? ' <span class="pill">inativa</span>' : ""}<div class="mut fin-sub">${esc(c.banco || "")}${c.limite ? " · cheque especial " + brl(c.limite) : ""}</div></td><td class="mut">${esc((TIPOS.find((t) => t[0] === c.tipo) || [, ""])[1])}</td><td class="r">${brl(c.saldoIni)}</td><td>${fdate(c.dataIni)}</td><td class="r">${sinal(F.saldoConta(c.id))}</td></tr>`).join("")}</tbody></table></div><div class="toolbar" style="margin-top:10px"><button class="btn ghost sm" data-novo="ct">+ Conta</button><span class="mut fin-sub">Saldo inicial = o saldo do extrato no dia em “Desde”; daí em diante o ERP calcula.</span></div></div>
      <div class="card"><h3>Cartões de Crédito</h3>${d.cartoes.length ? `<div class="tw"><table><thead><tr><th>Cartão</th><th>Fecha</th><th>Vence</th><th class="r">Limite</th><th>Paga pela Conta</th></tr></thead><tbody>${d.cartoes.map((c) => `<tr class="fin-row" data-cc="${c.id}"><td><b>${esc(c.nome)}</b></td><td>dia ${c.fecha}</td><td>dia ${c.vence}</td><td class="r">${brl(c.limite)}</td><td class="mut">${esc((F.conta(c.contaId) || {}).nome || "")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="mut">Nenhum cartão.</p>`}<div class="toolbar" style="margin-top:10px"><button class="btn ghost sm" data-novo="cc">+ Cartão</button></div></div>
      <div class="card"><h3>Recorrências</h3>${(() => { const ser = d.series.filter((s) => !s.fim || monthKey(s.fim) >= monthKey(todayISO())); return ser.length ? `<div class="tw"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Frequência</th><th>Dia</th><th>De</th><th>Até</th><th class="r">Valor</th></tr></thead><tbody>${ser.map((s) => `<tr class="fin-row" data-sr="${s.id}"><td>${star("series", s.id)}<b>${esc(s.desc)}</b>${s.ativa === false ? ' <span class="pill">pausada</span>' : ""}<div class="mut fin-sub">${s.cartaoId ? "💳 " + esc((F.cartao(s.cartaoId) || {}).nome || "") : "🏦 " + esc((F.conta(s.contaId) || {}).nome || "")}</div></td><td class="mut">${esc(F.cat(s.catId).nome)}</td><td>${freqLabel(s.passo)}${s.parcelas > 1 ? " · " + s.parcelas + "x" : ""}</td><td>${s.dia}</td><td>${monthLabel(monthKey(s.inicio))}</td><td>${s.fim ? monthLabel(monthKey(s.fim)) : "sem fim"}</td><td class="r ${s.tipo === "receita" ? "pos" : ""}">${brl(s.valor)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="mut">Nenhuma. Crie um lançamento e escolha a Recorrência (Mensal, Trimestral, Anual…).</p>`; })()}</div>
      <div class="card"><h3>Plano de Contas</h3><p class="mut" style="margin-bottom:8px">Cada categoria tem uma natureza, que define a linha da DRE e a regra 50/30/20. Clique para editar.</p>${Object.entries(d.categorias.reduce((g, c) => ((g[c.grupo] = g[c.grupo] || []).push(c), g), {})).map(([g, cs]) => `<div class="fin-grp"><b>${esc(g)}</b> <span class="mut fin-sub">${esc(F.NAT[cs[0].natureza] || "")}</span><div>${cs.map((c) => `<button class="pill" data-cat="${c.id}" style="border:0;cursor:pointer;background:${c.cor}1f;color:${c.cor}${c.ativa === false ? ";opacity:.5" : ""}">${esc(c.nome)}${c.fixo ? " · fixo" : ""}</button>`).join(" ")}</div></div>`).join("")}<div class="toolbar" style="margin-top:10px"><button class="btn ghost sm" data-novo="cat">+ Categoria</button></div></div>
      <div class="card"><h3>Favorecidos</h3><p class="mut" style="margin-bottom:8px">Quem recebe suas contas. Os padrões (categoria, classificação, forma, conta/cartão, centro, moeda) e o último valor são aprendidos a cada lançamento e preenchem um novo. Clique para editar.</p>${(d.favorecidos && d.favorecidos.length) ? `<div class="tw"><table><thead><tr><th>Favorecido</th><th>Padrões</th><th class="r">Último Valor</th><th class="r">Pago 12m</th><th class="r">Em Aberto</th><th></th></tr></thead><tbody>${d.favorecidos.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((f) => { const r = F.resumoFavorecido(f.id); const c = f.catId ? F.cat(f.catId) : null; const org = f.origem ? (f.origem.startsWith("cc:") ? "💳 " + ((F.cartao(f.origem.slice(3)) || {}).nome || "") : "🏦 " + ((F.conta(f.origem.slice(3)) || {}).nome || "")) : ""; return `<tr class="fin-row" data-fv="${f.id}"><td><b>${esc(f.nome)}</b>${f.ativo === false ? ' <span class="pill">inativo</span>' : ""}<div class="mut fin-sub">${r.n} lançamento(s)${f.dia ? " · dia " + f.dia : ""}</div></td><td class="mut" style="font-size:12px">${[c ? c.nome : "", f.classe ? (F.CLS_SHORT[f.classe] || "") : "", f.forma, org, f.centro, f.moeda === "USD" ? "US$" : ""].filter(Boolean).join(" · ") || "—"}</td><td class="r">${f.ultimoValor != null ? (f.moeda === "USD" ? "US$ " + num(f.ultimoValor, 2) : brl(f.ultimoValor)) : "—"}</td><td class="r">${brl(r.pago)}</td><td class="r ${r.atraso ? "neg" : ""}">${r.aberto ? brl(r.aberto) : "—"}${r.atraso ? `<div class="mut fin-sub">${brl(r.atraso)} vencido</div>` : ""}</td><td class="r"><button class="btn ghost sm" data-fv-ver="${f.id}">Ver Lançamentos</button></td></tr>`; }).join("")}</tbody></table></div>` : `<p class="mut">Nenhum favorecido ainda. Eles são criados pelo campo Favorecido do lançamento (digite o nome e cadastre).</p>`}<div class="toolbar" style="margin-top:10px"><button class="btn ghost sm" data-fv-novo>+ Favorecido</button></div></div>
      <div class="card"><h3>Centros de Custo</h3><p class="mut" style="margin-bottom:8px">Para separar os gastos por área, projeto ou pessoa (ex.: Casa, Carro, NMB). Clique para renomear ou remover.</p>${(d.centros && d.centros.length) ? `<div class="chips">${d.centros.slice().sort((a, b) => a.localeCompare(b, "pt-BR")).map((x) => `<button class="chip-cc" data-cc-ed="${esc(x)}">${esc(x)}</button>`).join("")}</div>` : `<p class="mut">Nenhum centro cadastrado ainda.</p>`}<div class="toolbar" style="margin-top:10px"><button class="btn ghost sm" data-cc-novo>+ Centro de custo</button></div></div>
      <div class="card"><h3>Fechamento do Mês</h3><p class="mut" style="margin-bottom:8px">Depois de conferir com o extrato, feche o mês: lançamentos do mês fechado não podem ser alterados nem excluídos até reabrir (com motivo).</p><div class="tw"><table><tbody>${meses.map((mk) => { const f = d.fechados[mk]; return `<tr><td><b>${monthLabel(mk)}</b></td><td>${f ? `<span class="pill ok">fechado em ${fdate(f.em.slice(0, 10))}</span>` : '<span class="pill">aberto</span>'}</td><td class="mut">${f ? "saldo das contas: " + brl(f.saldo) : ""}</td><td class="r">${f ? `<button class="btn ghost sm" data-reab="${mk}">Reabrir</button>` : mk < monthKey(todayISO()) ? `<button class="btn sm" data-fech="${mk}">Fechar</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div></div>`;
    const contaF = (c) => ERP.form({ title: c ? "Editar Conta" : "Nova Conta", fields: [{ k: "nome", label: "Nome", value: c && c.nome, required: true }, { k: "banco", label: "Banco", value: c && c.banco }, { k: "tipo", label: "Tipo", type: "select", value: c && c.tipo, options: TIPOS }, { k: "saldoIni", label: "Saldo Inicial (R$, negativo com −)", type: "number", step: "0.01", value: c ? c.saldoIni : 0 }, { k: "dataIni", label: "Saldo na Data", type: "date", value: c ? c.dataIni : todayISO() }, { k: "limite", label: "Limite do Cheque Especial (R$)", type: "number", step: "0.01", value: c ? c.limite : 0 }, { k: "jurosCheque", label: "Juros do Cheque Especial (% a.m.)", type: "number", step: "0.01", value: c ? c.jurosCheque : 8 }, { k: "ativa", label: "Ativa", type: "checkbox", value: c ? c.ativa !== false : true }], onSubmit(v) { Store.change("financas", (dd) => { if (c) Object.assign(dd.contas.find((x) => x.id === c.id), v); else dd.contas.push(Object.assign({ id: uid("ct") }, v)); }); ERP.render(); }, onDelete: c ? () => { if (d.lanc.some((l) => l.contaId === c.id || l.paraId === c.id)) { ERP.toast("A conta tem lançamentos: marque como inativa."); return; } Store.change("financas", (dd) => { dd.contas = dd.contas.filter((x) => x.id !== c.id); }); ERP.render(); } : null });
    const cartaoF = (c) => ERP.form({ title: c ? "Editar Cartão" : "Novo Cartão", fields: [{ k: "nome", label: "Nome", value: c && c.nome, required: true, placeholder: "Ex.: Visa Santander 8038" }, { k: "limite", label: "Limite (R$)", type: "number", step: "0.01", value: c ? c.limite : 0 }, { k: "fecha", label: "Dia do Fechamento", type: "number", value: c ? c.fecha : 1 }, { k: "vence", label: "Dia do Vencimento", type: "number", value: c ? c.vence : 10 }, { k: "contaId", label: "Fatura Paga pela Conta", type: "select", creatable: "conta", value: c && c.contaId, options: F.contasAtivas().map((x) => [x.id, x.nome]) }], onSubmit(v) { if (!(v.fecha >= 1 && v.fecha <= 31 && v.vence >= 1 && v.vence <= 31)) { ERP.toast("Dias entre 1 e 31."); return false; } Store.change("financas", (dd) => { if (c) Object.assign(dd.cartoes.find((x) => x.id === c.id), v); else dd.cartoes.push(Object.assign({ id: uid("cc") }, v)); }); ERP.render(); }, onDelete: c ? () => { if (d.lanc.some((l) => l.cartaoId === c.id)) { ERP.toast("O cartão tem compras: não pode ser excluído."); return; } Store.change("financas", (dd) => { dd.cartoes = dd.cartoes.filter((x) => x.id !== c.id); }); ERP.render(); } : null });
    const catF = (c) => ERP.form({ title: c ? "Editar Categoria" : "Nova Categoria", fields: [{ k: "nome", label: "Nome", value: c && c.nome, required: true }, { k: "grupo", label: "Grupo", value: c ? c.grupo : "", placeholder: "Ex.: Moradia" }, { k: "natureza", label: "Natureza", type: "select", value: c ? c.natureza : "estilo", options: Object.entries(F.NAT) }, { k: "fixo", label: "Custo Fixo (se repete todo mês)", type: "checkbox", value: c && c.fixo }, { k: "cor", label: "Cor (hex)", value: c ? c.cor : "#5B6068" }, { k: "ativa", label: "Ativa", type: "checkbox", value: c ? c.ativa !== false : true }], onSubmit(v) { v.tipo = v.natureza === "receita" ? "receita" : "despesa"; Store.change("financas", (dd) => { if (c) Object.assign(dd.categorias.find((x) => x.id === c.id), v); else dd.categorias.push(Object.assign({ id: uid("c") }, v)); }); ERP.render(); }, onDelete: c ? () => { if (d.lanc.some((l) => l.catId === c.id)) { ERP.toast("Categoria em uso: desative em vez de excluir."); return; } Store.change("financas", (dd) => { dd.categorias = dd.categorias.filter((x) => x.id !== c.id); }); ERP.render(); } : null });
    const favF = (f) => ERP.form({ title: f ? "Editar Favorecido" : "Novo Favorecido", fields: [
        { k: "nome", label: "Nome", value: f ? f.nome : "", required: true, placeholder: "Ex.: Enel, Netflix, Academia" },
        { k: "catId", label: "Categoria Padrão", type: "select", value: f ? f.catId || "" : "", options: [["", "—"]].concat(catOpts("")) },
        { k: "classe", label: "Classificação Padrão", type: "select", value: f ? f.classe || "" : "", options: [["", "Pela Categoria"]].concat(F.CLASSES.map((x) => [x[0], x[1]])) },
        { k: "centro", label: "Centro de Custo Padrão", type: "select", creatable: "centro", value: f ? f.centro || "" : "", options: centroOpts() },
        { k: "forma", label: "Forma de Pagamento Padrão", type: "select", creatable: "forma", value: f ? f.forma || "" : "", options: formaOpts() },
        { k: "origem", label: "Conta / Cartão Padrão", type: "select", creatable: "origem", value: f ? f.origem || "" : "", options: [["", "—"]].concat(origemOpts(true)) },
        { k: "moeda", label: "Moeda", type: "select", value: f ? f.moeda || "BRL" : "BRL", options: [["BRL", "R$ (real)"], ["USD", "US$ (dólar)"]] },
        { k: "dia", label: "Dia de Vencimento Habitual", type: "number", value: f ? f.dia || "" : "" },
        { k: "ativo", label: "Ativo", type: "checkbox", value: f ? f.ativo !== false : true },
      ], intro: f ? `Padrões aprendidos a cada lançamento deste favorecido e usados para preencher um novo. Último valor: ${f.ultimoValor != null ? (f.moeda === "USD" ? "US$ " + num(f.ultimoValor, 2) : brl(f.ultimoValor)) : "—"}.` : "Quem recebe suas contas. Os padrões preenchem o lançamento quando você escolhe este favorecido.", onSubmit(v) { const nome = ERP.tcPt(v.nome.trim()); if (!nome) return false; salvar((dd) => { dd.favorecidos = dd.favorecidos || []; if (f) { const x = dd.favorecidos.find((y) => y.id === f.id); Object.assign(x, { nome, catId: v.catId || "", classe: v.classe || "", centro: v.centro || "", forma: v.forma || "", origem: v.origem || "", moeda: v.moeda || "BRL", dia: v.dia ? Math.min(31, Math.max(1, Math.round(v.dia))) : null, ativo: !!v.ativo }); } else dd.favorecidos.push({ id: uid("fv"), nome, catId: v.catId || "", classe: v.classe || "", centro: v.centro || "", forma: v.forma || "", origem: v.origem || "", moeda: v.moeda || "BRL", dia: v.dia ? Math.round(v.dia) : null, ultimoValor: null, ultimaData: "", ativo: !!v.ativo }); }); ERP.render(); },
      onDelete: f ? () => { salvar((dd) => { dd.favorecidos = (dd.favorecidos || []).filter((y) => y.id !== f.id); dd.lanc.forEach((l) => { if (l.favId === f.id) l.favId = ""; }); dd.series.forEach((sr) => { if (sr.favId === f.id) sr.favId = ""; }); }); ERP.render(); } : null, deleteConfirm: "Remover este favorecido? Os lançamentos ficam, sem o vínculo." });
    const centroF = (nome) => ERP.form({ title: nome ? "Editar Centro de Custo" : "Novo Centro de Custo", fields: [{ k: "nome", label: "Nome", value: nome || "", required: true, placeholder: "Ex.: Casa, Carro, NMB" }], onSubmit(v) { const novo = ERP.tcPt(v.nome.trim()); if (!novo) return; salvar((dd) => { dd.centros = dd.centros || []; if (nome) { const i = dd.centros.indexOf(nome); if (i >= 0) dd.centros[i] = novo; dd.lanc.forEach((l) => { if (l.centro === nome) l.centro = novo; }); dd.series.forEach((sr) => { if (sr.centro === nome) sr.centro = novo; }); } else if (!dd.centros.some((x) => x.toLowerCase() === novo.toLowerCase())) dd.centros.push(novo); }); ERP.render(); }, onDelete: nome ? () => { salvar((dd) => { dd.centros = (dd.centros || []).filter((x) => x !== nome); dd.lanc.forEach((l) => { if (l.centro === nome) l.centro = ""; }); dd.series.forEach((sr) => { if (sr.centro === nome) sr.centro = ""; }); }); ERP.render(); } : null, deleteConfirm: "Remover este centro de custo? Os lançamentos que o usavam ficam sem centro." });
    root.onclick = (e) => {
      const bfv = e.target.closest("[data-fv-ver],[data-fv-novo],[data-fv]"); if (bfv) { if (bfv.dataset.fvVer) { S.fav = bfv.dataset.fvVer; S.mk = monthKey(todayISO()); ERP.nav("financas/lancamentos"); return; } if (bfv.dataset.fvNovo !== undefined) { favF(null); return; } favF(d.favorecidos.find((x) => x.id === bfv.dataset.fv)); return; }
      const bcc = e.target.closest("[data-cc-ed],[data-cc-novo]"); if (bcc) { if (bcc.dataset.ccNovo !== undefined) centroF(null); else centroF(bcc.dataset.ccEd); return; }
      const b = e.target.closest("[data-ct],[data-cc],[data-cat],[data-sr],[data-novo],[data-fech],[data-reab]"); if (!b) return;
      if (b.dataset.ct) contaF(d.contas.find((x) => x.id === b.dataset.ct)); else if (b.dataset.cc) cartaoF(d.cartoes.find((x) => x.id === b.dataset.cc));
      else if (b.dataset.cat) catF(d.categorias.find((x) => x.id === b.dataset.cat)); else if (b.dataset.sr) serieF(d.series.find((x) => x.id === b.dataset.sr));
      else if (b.dataset.novo) ({ ct: contaF, cc: cartaoF, cat: catF })[b.dataset.novo](null);
      else if (b.dataset.fech) { const mk = b.dataset.fech; const ab = d.lanc.filter((l) => !l.pago && l.tipo !== "compra" && monthKey(l.venc) === mk); ERP.confirm(`Fechar ${monthLabel(mk)}?${ab.length ? ` Há ${ab.length} lançamento(s) desse mês ainda em aberto.` : ""} Depois, nada desse mês pode ser alterado sem reabrir.`, "Fechar o mês").then((ok) => { if (!ok) return; Store.change("financas", (dd) => { dd.fechados[mk] = { em: new Date().toISOString(), saldo: F.contasAtivas().reduce((s, c) => s + F.saldoConta(c.id, F.diaNoMes(mk, 31)), 0) }; }); ERP.render(); }); }
      else if (b.dataset.reab) { const mk = b.dataset.reab; ERP.form({ title: "Reabrir " + monthLabel(mk), fields: [{ k: "motivo", label: "Motivo", required: true, full: true }], okLabel: "Reabrir", onSubmit(v) { if (!v.motivo.trim()) return false; Store.change("financas", (dd) => { (dd.reaberturas = dd.reaberturas || []).push({ mk, em: new Date().toISOString(), motivo: v.motivo.trim() }); delete dd.fechados[mk]; }); ERP.render(); } }); }
    };
  }

  /* exemplo removível (para conhecer as telas) */
  ERP.finExemplo = function () {
    const h = todayISO(), mk = monthKey(h);
    salvar((d) => {
      const ct = { id: "ex_ct", nome: "Conta exemplo", tipo: "corrente", banco: "Banco exemplo", saldoIni: 3500, dataIni: F.diaNoMes(F.mesSeg(mk, -2), 1), limite: 5000, jurosCheque: 8, ativa: true, ex: 1 };
      const rs = { id: "ex_res", nome: "Reserva exemplo", tipo: "reserva", saldoIni: 12000, dataIni: ct.dataIni, ativa: true, ex: 1 };
      const cc = { id: "ex_cc", nome: "Cartão exemplo", limite: 8000, fecha: 5, vence: 12, contaId: "ex_ct", ex: 1 };
      d.contas.push(ct, rs); d.cartoes.push(cc);
      const c = (n) => (d.categorias.find((x) => x.nome === n) || {}).id;
      [["Salário exemplo", "receita", c("Salário / Pró-labore"), 14000, 5], ["Aluguel exemplo", "despesa", c("Aluguel / Financiamento"), 3200, 10], ["Condomínio exemplo", "despesa", c("Condomínio"), 850, 10], ["Energia exemplo", "despesa", c("Energia"), 320, 15], ["Plano de saúde exemplo", "despesa", c("Plano de Saúde"), 1100, 20], ["Aporte exemplo", "despesa", c("Aportes em Investimentos"), 1500, 6]].forEach(([desc, tipo, catId, valor, dia]) => d.series.push({ id: uid("s"), tipo, desc, catId, valor, dia, inicio: F.diaNoMes(F.mesSeg(mk, -2), dia), fim: null, contaId: "ex_ct", ativa: true, ex: 1 }));
      d.series.push({ id: uid("s"), tipo: "despesa", desc: "Streaming exemplo", catId: c("Assinaturas e Streaming"), valor: 55.9, dia: 8, inicio: F.diaNoMes(F.mesSeg(mk, -2), 8), fim: null, cartaoId: "ex_cc", ativa: true, ex: 1 });
      F.materializar(d);
      d.lanc.forEach((l) => { if (l.serieId && d.series.find((s) => s.id === l.serieId && s.ex) && l.venc <= h && l.tipo !== "compra") { l.pago = l.venc; l.valorPago = l.valor; } if (l.serieId && d.series.find((s) => s.id === l.serieId && s.ex)) l.ex = 1; });
      [["Mercado exemplo", "Mercado", 612.4, -1], ["Restaurante exemplo", "Restaurantes e Delivery", 186, -3], ["Farmácia exemplo", "Farmácia", 94.5, -8], ["Mercado exemplo", "Mercado", 538.2, -20], ["Viagem exemplo (3x)", "Viagens", 2400, -25]].forEach(([desc, cn, v, dd], i) => { const dt = F.addDias(h, dd); const n = i === 4 ? 3 : 1; const per = F.r2(v / n); for (let k = 0; k < n; k++) d.lanc.push({ id: uid("l"), tipo: "compra", cartaoId: "ex_cc", desc: n > 1 ? `${desc} ${k + 1}/${n}` : desc, catId: c(cn), valor: per, comp: addMonths(dt, k), venc: dt, fatura: F.mesSeg(F.faturaDe(cc, dt).key, k), parcela: n > 1 ? { g: "ex_g", n: k + 1, t: n } : undefined, pago: null, ex: 1 }); });
      const dv = { id: "ex_dv", nome: "Empréstimo exemplo", credor: "Banco exemplo", tipo: "emprestimo", prioridade: "Alta", taxa: 2.9, contaId: "ex_ct", dia: 18, ex: 1 }; d.dividas.push(dv);
      for (let i = 0; i < 14; i++) { const dt = F.diaNoMes(F.mesSeg(mk, i), 18); d.lanc.push({ id: uid("l"), tipo: "despesa", dividaId: "ex_dv", desc: "Empréstimo exemplo · parcela", catId: F.DIVIDA_CAT, valor: 780, contaId: "ex_ct", comp: dt, venc: dt, pago: null, ex: 1 }); }
      d.metas.push({ id: "ex_mt", nome: "Viagem de férias (exemplo)", alvo: 15000, guardado: 4200, prazo: F.diaNoMes(F.mesSeg(mk, 9), 1), ex: 1 });
      d.orcamento.meses[mk] = Object.assign({}, d.orcamento.meses[mk], { [c("Mercado")]: 1400, [c("Restaurantes e Delivery")]: 600, [c("Farmácia")]: 200, [c("Viagens")]: 500 });
    });
    ERP.toast("Exemplo carregado. Para tirar: Sistema › Remover exemplos."); ERP.render();
  };
  ERP.finRemoverExemplo = function () {
    Store.change("financas", (d) => { d.lanc = d.lanc.filter((l) => !l.ex && !["ex_ct", "ex_cc"].includes(l.contaId) && l.cartaoId !== "ex_cc" && l.dividaId !== "ex_dv"); d.series = d.series.filter((s) => !s.ex); d.contas = d.contas.filter((c) => !c.ex); d.cartoes = d.cartoes.filter((c) => !c.ex); d.dividas = d.dividas.filter((c) => !c.ex); d.metas = d.metas.filter((c) => !c.ex); delete d.orcamento.meses[monthKey(todayISO())]; });
    ERP.toast("Exemplos removidos."); ERP.render();
  };
  /* ---------- Resumo do Mês: uma página limpa para imprimir ou salvar em PDF ---------- */
  function pResumo(root) {
    const d = D(); const mk = S.mk; const reg = d.cfg.regime; const r = F.dreMes(mk, reg); const h = todayISO();
    const sai = r.essencial + r.estilo + r.financeiro; const res = r.rec - sai; const sd = F.saudeFinanceira();
    const cats = Object.entries(r.porCat).filter(([k]) => F.cat(k).tipo === "despesa").sort((a, b) => b[1] - a[1]).slice(0, 10);
    const prox = F.pendencias().filter((p) => p.data >= h && p.data <= F.addDias(h, 30)).slice(0, 12); const venc = F.pendencias().filter((p) => p.data < h);
    const contas = F.contasAtivas();
    const fmtV = (it) => it.valor == null ? "—" : it.un === "%" ? num(it.valor, 1) + "%" : it.un === "meses" ? num(it.valor, 1) + " meses" : num(it.valor, 2) + "×";
    root.innerHTML = ERP.pagehead("Resumo de " + monthLabel(mk), `${mesNav()}<button class="btn orange" onclick="print()">Imprimir / PDF</button>`) + `
      <div class="resumo">
        <div class="resumo-h"><img class="resumo-logo" src="data:image/png;base64,${ERP.LOGO_PNG}" alt="" width="44" height="44"><div><b>Resumo Financeiro · ${monthLabel(mk)}</b><div class="mut">Hub · Painel Pessoal · regime de ${reg === "caixa" ? "caixa" : "competência"} · gerado em ${fdate(h)}</div></div><div class="mut resumo-r">${contas.length} conta(s) · ${d.cartoes.length} cartão(ões)<br>${esc(ERP.version)}</div></div>
        <div class="kpis fp-4" style="margin:12px 0">${ERP.kpi("Receitas", brl(r.rec), "", "pos")}${ERP.kpi("Saídas", brl(sai), `fixos ${brl(r.fixo)} · variáveis ${brl(r.variavel)} · cartão ${brl(r.cartao)}`, "neg")}${ERP.kpi("Resultado", brl(res), res >= 0 ? "sobrou" : "faltou", res >= 0 ? "pos" : "neg")}${ERP.kpi("Investido no Mês", brl(Math.max(0, r.investimento)), "aportes e reservas")}</div>
        <div class="grid2">
          <div class="card"><h3>Para Onde Foi o Dinheiro</h3>${cats.length ? cats.map(([k, v]) => { const c = F.cat(k); return `<div class="hrow"><span class="n">${esc(c.nome)}</span><div class="bar"><i style="width:${(v / cats[0][1]) * 100}%;background:${c.cor}"></i></div><span class="v">${brl(v)}</span></div>`; }).join("") : `<div class="empty">Sem despesas no mês.</div>`}</div>
          <div class="card"><h3>Saúde Financeira</h3>${sd.itens.map((it) => `<div class="hrow"><span class="n"><span class="saude-dot ${it.nivel}" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:${it.nivel === "bom" ? "var(--ok)" : it.nivel === "atencao" ? "var(--warn)" : it.nivel === "ruim" ? "var(--err)" : "var(--line)"}"></span>${esc(it.nome)}</span><span class="v">${fmtV(it)}</span></div>`).join("")}</div>
        </div>
        <div class="grid2">
          <div class="card"><h3>Próximos 30 Dias${venc.length ? ` <span class="pill err">${venc.length} vencida(s) · ${brl(venc.reduce((a, p) => a + p.valor, 0))}</span>` : ""}</h3>${prox.length ? `<div class="tw" style="border:0"><table><tbody>${prox.map((p) => `<tr><td style="white-space:nowrap">${fdate(p.data).slice(0, 5)}</td><td>${esc(p.desc)}</td><td class="r ${p.tipo === "receita" ? "pos" : ""}">${brl(p.valor)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Nada vencendo nos próximos 30 dias.</div>`}</div>
          <div class="card"><h3>Saldos de Hoje</h3><div class="tw" style="border:0"><table><tbody>${contas.map((c) => `<tr><td>${esc(c.nome)}${c.tipo === "reserva" ? ' <span class="pill">reserva</span>' : ""}</td><td class="r">${sinal(F.saldoConta(c.id))}</td></tr>`).join("")}<tr class="total"><td>Total em contas</td><td class="r">${sinal(F.saldoTotal())}</td></tr>${F.saldoReservas() ? `<tr><td class="mut">Reservas</td><td class="r">${brl(F.saldoReservas())}</td></tr>` : ""}</tbody></table></div></div>
        </div>
      </div>`;
    bindMes(root);
  }
  ERP.temExemplo = () => D().contas.some((c) => c.ex);

  /* materializa recorrências ao abrir (sem marcar como alterado se nada mudou) */
  ERP.onBoot = (ERP.onBoot || []).concat(() => { const d = D(); const antes = d.lanc.length; F.materializar(d); if (d.lanc.length !== antes) Store.change("financas", () => {}); });

  ERP.finUI = { S, lancForm, pagar, estornar, pagarFatura, rapido, salvar, hist, pill, sinal, catOpts, origemOpts, barras, linha, mesNav, bindMes, irMes, regimeTgl, bindReg, star, bindStars, freqLabel, serieF, norm };
  ERP.register({ id: "financas", label: "Finanças Pessoais", short: "Finanças", icon: "wallet", group: "Finanças", pages: [
    { id: "painel", label: "Painel", icon: "house", render: pPainel }, { id: "lancamentos", label: "Lançamentos", icon: "list", render: pLanc }, { id: "agenda", label: "A Pagar e a Receber", short: "A Pagar", icon: "calendar-clock", render: pAgenda },
    { id: "cartoes", label: "Cartões", icon: "credit-card", render: pCartoes }, { id: "fluxo", label: "Fluxo de Caixa", short: "Fluxo", icon: "trending-up", render: pFluxo }, { id: "orcamento", label: "Orçamento", icon: "chart-pie", render: pOrc },
    { id: "dividas", label: "Dívidas", icon: "scale", render: pDividas }, { id: "metas", label: "Metas e Planejamento", short: "Metas", icon: "target", render: pMetas }, { id: "relatorios", label: "Relatórios", icon: "chart-column", render: pRel }, { id: "resumo", label: "Resumo do Mês", short: "Resumo", icon: "file-text", render: pResumo }, { id: "cadastros", label: "Cadastros", icon: "settings", render: pCad } ] });
})();

