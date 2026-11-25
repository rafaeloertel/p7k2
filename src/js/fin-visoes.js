/* Finanças Pessoais — visões reorganizadas (v0.9): Visão Geral, Contas Ativas, Fluxo de Caixa, A Pagar / Receber,
   Cadastros com abas e menu "Mais". Cada tela responde uma pergunta e cabe numa página. O Painel antigo vira "Análise Detalhada". */
(function () {
  "use strict";
  const { $, $$, esc, brl, num, todayISO, fdate, monthKey, monthLabel, Store } = ERP;
  const F = ERP.fin, U = ERP.finUI, D = F.D, S = U.S;
  const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const alpha = (hex, a) => { const h = String(hex).replace("#", ""); if (h.length < 6) return hex; return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };
  const kfmt = (v) => (Math.abs(v) >= 1000 ? num(v / 1000, Math.abs(v) >= 10000 ? 0 : 1) + " mil" : num(v, 0));
  const eixoR$ = () => ({ ticks: { callback: (v) => kfmt(v) }, grid: { color: () => ERP.cor("--line") } });
  const COR = () => ({ ent: ERP.cor("--ok"), sai: ERP.cor("--err"), warn: ERP.cor("--warn"), navy: ERP.cor("--navy"), orange: ERP.cor("--orange"), ink2: ERP.cor("--ink-2"), fixo: "#3F6DB3", variavel: "#C9922E", cartao: "#8A63C2", inv: "#2E9E6B" });
  const canvas = (id, h) => `<div class="fp-chart" style="height:${h || 240}px"><canvas id="${id}"></canvas></div>`;
  const sec = (t, n, extra) => `<div class="vg-sec"><h2>${esc(t)}${n ? ` <small>${n}</small>` : ""}</h2>${extra || ""}</div>`;
  const kpi = (l, v, s, cls, href, cor, help) => `<${href ? `a href="${href}"` : "div"} class="kpi fp-k ${cls || ""}" style="--kc:${cor || "var(--accent)"}"><div class="l">${esc(l)}${help ? ERP.help(help) : ""}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</${href ? "a" : "div"}>`;
  const hoje = () => todayISO();
  const mkHoje = () => monthKey(hoje());
  const fx = () => (ERP.investimentos && ERP.investimentos.fx && +ERP.investimentos.fx()) || 0;
  const valorSerie = (s) => (s.moeda === "USD" && fx() ? F.r2(s.valorMoeda * fx()) : +s.valor || 0);
  const mensal = (s) => valorSerie(s) / (s.passo || 1);
  const dinheiro = (l) => (l.valorPago != null ? l.valorPago : l.valor);
  const fdm = (iso) => fdate(iso).replace(/\/20(\d\d)$/, "/$1");
  const origemTxt = (l) => (l.cartaoId ? "💳 " + esc((F.cartao(l.cartaoId) || {}).nome || "") : "🏦 " + esc((F.conta(l.contaId) || {}).nome || ""));
  const porMesLabel = (mk) => MES[+mk.slice(5) - 1] + "/" + mk.slice(2, 4);
  const acoes = (root) => {
    $$("[data-pay]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); U.pagar(b.dataset.pay); }));
    $$("[data-est]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); U.estornar(b.dataset.est); }));
    $$("[data-ed]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); U.lancForm(D().lanc.find((x) => x.id === b.dataset.ed)); }));
    $$("[data-payf]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const [c, k] = b.dataset.payf.split("|"); U.pagarFatura(c, k); }));
    $$("[data-sr]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const s = D().series.find((x) => x.id === b.dataset.sr); if (s) U.serieF(s); }));
  };

  /* ---------- extrato: os lançamentos por trás de um número (duplo clique nos gráficos, links "ver") ---------- */
  const sinalDe = (l) => (l.tipo === "receita" || (l.tipo === "ajuste" && l.valor > 0) || l.tipo === "estorno" ? 1 : l.tipo === "transferencia" ? 0 : -1);
  function extrato(title, lancs, sub) {
    lancs = (lancs || []).slice().sort((a, b) => (b.pago || b.venc || b.comp || "").localeCompare(a.pago || a.venc || a.comp || ""));
    const tot = lancs.reduce((t, l) => t + sinalDe(l) * Math.abs(dinheiro(l)), 0);
    const rows = lancs.map((l) => { const c = F.cat(l.catId); const sg = sinalDe(l); return `<tr class="fin-row" data-ed="${l.id}"><td class="vg-d">${fdm(l.tipo === "compra" ? l.comp : F.dataCaixa(l))}</td><td><b>${esc(l.desc)}</b><div class="mut fin-sub">${l.catId ? esc(c.nome) : l.tipo === "pagfatura" ? "Pagamento de fatura" : l.tipo === "ajuste" ? "Ajuste de saldo" : ""}${l.favId && F.favorecido(l.favId) ? " · " + esc(F.favorecido(l.favId).nome) : ""} · ${origemTxt(l)}</div></td><td>${U.pill(F.situacao(l))}</td><td class="r ${sg > 0 ? "pos" : sg < 0 ? "neg" : ""}"><b>${sg > 0 ? "+ " : sg < 0 ? "− " : ""}${brl(Math.abs(dinheiro(l)))}</b></td></tr>`; }).join("");
    const m = ERP.modal(`<h2>${esc(title)}</h2>${sub ? `<p class="mut" style="margin:-6px 0 10px">${esc(sub)}</p>` : ""}${lancs.length ? `<div class="tw" style="max-height:60vh;overflow:auto"><table class="vg-tbl ex-tbl"><tbody>${rows}</tbody></table></div><div class="fp-foot"><span>${lancs.length} lançamento(s) · clique para abrir</span><span>Total: <b class="${tot < 0 ? "neg" : "pos"}">${brl(tot)}</b></span></div>` : `<div class="empty">Nenhum lançamento compõe este valor.</div>`}<div class="act"><button class="btn ghost" data-xls ${lancs.length ? "" : "disabled"}>Exportar Excel</button><span class="sp"></span><button class="btn" data-fechar>Fechar</button></div>`, { wide: true, noFocus: true });
    $("[data-fechar]", m.el).onclick = m.close;
    $("[data-xls]", m.el).onclick = () => ERP.xlsx(`hub-extrato-${todayISO()}.xlsx`, ["Data", "Descrição", "Favorecido", "Categoria", "Conta/Cartão", "Situação", "Valor"], lancs.map((l) => [l.tipo === "compra" ? l.comp : F.dataCaixa(l), l.desc, (F.favorecido(l.favId) || {}).nome || "", l.catId ? F.cat(l.catId).nome : "", l.cartaoId ? (F.cartao(l.cartaoId) || {}).nome : (F.conta(l.contaId) || {}).nome, F.situacao(l).n, sinalDe(l) * Math.abs(dinheiro(l))]), { title, subtitle: (sub ? sub + " · " : "") + "Hub · Painel Pessoal · gerado em " + new Date().toLocaleString("pt-BR"), sheet: "Extrato" });
    $$("[data-ed]", m.el).forEach((r) => (r.onclick = () => { const l = D().lanc.find((x) => x.id === r.dataset.ed); if (l && l.tipo !== "pagfatura" && l.tipo !== "ajuste") { m.close(); U.lancForm(l); } }));
    return m;
  }
  ERP.extrato = extrato;
  /* lançamentos de um mês (competência) por categoria/natureza */
  const lancsMes = (mk, f) => D().lanc.filter((l) => ["receita", "despesa", "compra", "estorno"].includes(l.tipo) && monthKey(F.dataComp(l)) === mk && (!f || f(l)));
  const lancsCaixaMes = (mk) => { const ids = new Set(F.contasAtivas().filter((c) => c.tipo !== "reserva").map((c) => c.id)); return D().lanc.filter((l) => l.pago && monthKey(l.pago) === mk && ids.has(l.contaId) && ["receita", "despesa", "pagfatura"].includes(l.tipo)); };
  const pendMes = (mk) => { const h = hoje(); return D().lanc.filter((l) => !l.pago && ["receita", "despesa"].includes(l.tipo) && monthKey(l.venc < h ? h : l.venc) === mk); };

  /* ---------- medidas compartilhadas ---------- */
  /* mês: realizado + previsto (competência), separados */
  function mesRealPrev(mk) {
    const r = { entR: 0, entP: 0, saiR: 0, saiP: 0, nAbertos: 0 };
    D().lanc.forEach((l) => {
      const c = F.cat(l.catId); if (c.natureza === "investimento") return;
      if (l.tipo === "receita" || l.tipo === "despesa") { if (monthKey(F.dataComp(l)) !== mk) return; const v = dinheiro(l); if (l.tipo === "receita") { if (l.pago) r.entR += v; else r.entP += v; } else { if (l.pago) r.saiR += v; else { r.saiP += v; r.nAbertos++; } } }
      else if (l.tipo === "compra" || l.tipo === "estorno") { if (monthKey(l.comp) !== mk) return; const v = l.tipo === "estorno" ? -l.valor : l.valor; r.saiR += v; }
    });
    return r;
  }
  function alertas() {
    const h = hoje(); const d = D(); const out = []; const pend = F.pendencias();
    const venc = pend.filter((p) => p.tipo !== "receita" && p.data < h);
    if (venc.length) out.push(["err", `${venc.length} conta(s) vencida(s) · ${brl(venc.reduce((s, p) => s + p.valor, 0))}`, "#/financas/agenda", "Pagar agora"]);
    const hj = pend.filter((p) => p.tipo !== "receita" && p.data === h); if (hj.length) out.push(["warn", `${hj.length} conta(s) vencendo hoje · ${brl(hj.reduce((s, p) => s + p.valor, 0))}`, "#/financas/agenda", "Ver"]);
    const est = d.lanc.filter((l) => l.estimado && !l.pago && l.venc <= F.addDias(h, 7)); if (est.length) out.push(["warn", `${est.length} valor(es) a confirmar nos próximos 7 dias (recorrências variáveis)`, "#/financas/lancamentos", "Confirmar"]);
    const pj = F.projecao(12); if (pj.min.v < 0 && pj.ini >= 0) out.push(["err", `Saldo projetado fica negativo em ${fdate(pj.min.data)} (${brl(pj.min.v)})`, "#/financas/fluxo", "Ver fluxo"]);
    d.cartoes.forEach((c) => { const u = F.usoCartao(c.id); if (c.limite > 0 && (u / c.limite) * 100 >= (d.cfg.alertaCartao || 80)) out.push(["warn", `${c.nome}: ${num((u / c.limite) * 100, 0)}% do limite usado`, "#/financas/cartoes", "Ver"]); });
    F.orcamentoMes(mkHoje()).filter((x) => x.orcado > 0 && x.pct > 100).slice(0, 3).forEach((x) => out.push(["warn", `Orçamento estourado em ${x.c.nome}: ${brl(x.realizado)} de ${brl(x.orcado)}`, "#/financas/orcamento", "Ver"]));
    const comp = d.lanc.filter((l) => l.pago && l.pago >= F.addDias(h, -90) && ["despesa", "receita"].includes(l.tipo) && !(l.anexos || []).length && l.valor >= 50).length; if (comp) out.push(["info", `${comp} pagamento(s) sem comprovante anexado (90 dias)`, "#/financas/agenda", "Anexar"]);
    const rec = pend.filter((p) => p.tipo === "receita" && p.data < h); if (rec.length) out.push(["info", `${rec.length} recebimento(s) atrasado(s) · ${brl(rec.reduce((s, p) => s + p.valor, 0))}`, "#/financas/agenda", "Ver"]);
    return out;
  }
  /* compromissos recorrentes ativos (séries), com o estado no mês */
  function ativas(mk) {
    const d = D(); const h = hoje();
    return d.series.filter((s) => s.ativa !== false && (!s.fim || monthKey(s.fim) >= mkHoje())).map((s) => {
      const ls = d.lanc.filter((l) => l.serieId === s.id);
      const noMes = ls.filter((l) => l.serieMes === mk);
      const prox = ls.filter((l) => !l.pago && (l.tipo === "compra" ? l.comp : l.venc) >= h).sort((a, b) => (a.venc || a.comp).localeCompare(b.venc || b.comp))[0];
      const ult = ls.filter((l) => l.pago).sort((a, b) => b.pago.localeCompare(a.pago))[0];
      const st = !noMes.length ? "fora" : noMes.every((l) => l.pago || l.tipo === "compra") ? "pago" : noMes.some((l) => !l.pago && l.venc < h && l.tipo !== "compra") ? "vencido" : "aberto";
      return { s, ls, noMes, prox, ult, st, mensal: mensal(s), valor: valorSerie(s) };
    });
  }

  /* ================= VISÃO GERAL ================= */
  function pGeral(root) {
    const d = D(); const h = hoje(); const mk = S.mk; const C = COR();
    const m = mesRealPrev(mk); const ent = m.entR + m.entP, sai = m.saiR + m.saiP, res = ent - sai;
    const saldo = F.saldoTotal(); const reservas = F.saldoReservas(); const fat = F.faturasAbertas(); const fatTot = fat.reduce((s, f) => s + f.total, 0);
    const al = alertas(); const pend = F.pendencias();
    const prox = pend.filter((p) => p.data <= F.addDias(h, 7)).slice(0, 8);
    const sd = F.saudeFinanceira();
    const at = ativas(mk); const fixosMes = at.filter((a) => a.s.tipo !== "receita").reduce((s, a) => s + a.mensal, 0);
    const R = F.dreMes(mk, "competencia"); const cats = Object.entries(R.porCat).filter(([k]) => F.cat(k).natureza !== "investimento").sort((a, b) => b[1] - a[1]);
    const orc = F.orcamentoMes(mk).filter((x) => x.orcado > 0).sort((a, b) => b.pct - a.pct).slice(0, 5);
    const mkAtual = mk === mkHoje();
    root.innerHTML = ERP.pagehead("Visão Geral", `${U.mesNav()}<button class="btn orange" id="vgNovo">+ Lançamento</button>`) + `
      <div class="kpis fp-4 vg-kpis">
        ${kpi("Saldo em Conta Hoje", brl(saldo), `${reservas ? `reservas à parte: <b>${brl(reservas)}</b> · ` : ""}${fat.length ? `faturas em aberto: <b>${brl(fatTot)}</b>` : "sem faturas em aberto"}`, saldo < 0 ? "neg" : "", "#/financas/analise", saldo < 0 ? "var(--err)" : "var(--ok)", "saldoHoje")}
        ${kpi("Entradas · " + monthLabel(mk), brl(ent), `recebido <b>${brl(m.entR)}</b> · previsto <b>${brl(m.entP)}</b>`, "pos", "#/financas/lancamentos", "var(--ok)")}
        ${kpi("Saídas · " + monthLabel(mk), brl(sai), `pago <b>${brl(m.saiR)}</b> · a pagar <b>${brl(m.saiP)}</b> (${m.nAbertos})`, "neg", "#/financas/lancamentos", "var(--err)")}
        ${kpi("Resultado do Mês", (res >= 0 ? "+ " : "− ") + brl(Math.abs(res)), ent > 0 ? `margem de <b>${num((res / ent) * 100, 1)}%</b> · compromissos fixos <b>${brl(fixosMes)}</b>/mês` : `compromissos fixos <b>${brl(fixosMes)}</b>/mês`, res >= 0 ? "pos" : "neg", "#/financas/fluxo", res >= 0 ? "var(--ok)" : "var(--err)", "resultadoMes")}
      </div>
      <div class="vg-grid">
        <div class="card vg-al"><h3>Precisa de Atenção <small class="mut">${al.length ? al.length + " item(ns)" : "tudo em dia"}</small></h3>
          ${al.length ? `<ul class="vg-alist">${al.map(([c, t, hr, b]) => `<li class="${c}"><span class="vg-dot"></span><span class="vg-at">${esc(t)}</span><a class="btn ghost sm" href="${hr}">${esc(b)}</a></li>`).join("")}</ul>` : `<div class="vg-ok">${ERP.ic("circle-check", 22)} Nenhuma pendência: nada vencido, orçamento e cartões dentro do limite.</div>`}
        </div>
        <div class="card vg-prox"><h3>Próximos 7 Dias <small class="mut">${brl(prox.reduce((s, p) => s + (p.tipo === "receita" ? p.valor : -p.valor), 0))} líquido</small><a class="vg-more" href="#/financas/agenda">ver agenda ↗</a></h3>
          ${prox.length ? `<table class="vg-tbl"><tbody>${prox.map((p) => `<tr class="${p.data < h ? "late" : ""}"><td class="vg-d">${p.data < h ? "venceu " : ""}${fdm(p.data)}</td><td><b>${esc(p.desc)}</b><div class="mut fin-sub">${p.k === "l" ? esc(F.cat(p.l.catId).nome) : p.f.itens.length + " compra(s)"}</div></td><td class="r ${p.tipo === "receita" ? "pos" : "neg"}"><b>${p.tipo === "receita" ? "+ " : "− "}${brl(p.valor)}</b></td><td class="r">${p.k === "l" ? `<button class="btn sm" data-pay="${p.l.id}">${p.tipo === "receita" ? "Receber" : "Pagar"}</button>` : `<button class="btn sm" data-payf="${p.f.cartao.id}|${p.f.key}">Pagar</button>`}</td></tr>`).join("")}</tbody></table>` : `<div class="vg-ok mut">Nada vence nos próximos 7 dias.</div>`}
        </div>
      </div>
      <div class="vg-grid vg-grid-b">
        <div class="card"><h3>Fluxo de Caixa${ERP.help("fluxoCaixa")} <small class="mut">6 meses realizados + 6 previstos · duplo clique numa barra abre os lançamentos</small><a class="vg-more" href="#/financas/fluxo">ver fluxo ↗</a></h3>${canvas("vgFluxo", 250)}</div>
        <div class="card vg-saude"><h3>Saúde Financeira <small class="mut">${sd.meses} mês(es) de dados · toque no ? para entender cada indicador</small><a class="vg-more" href="#/financas/relatorios">detalhes ↗</a></h3>
          <ul class="vg-slist">${sd.itens.map((it) => `<li class="${it.nivel}"><span class="saude-dot"></span><span class="vg-sn">${esc(it.nome)}${ERP.help({ poupanca: "taxaPoupanca", reserva: "reservaEmergencia", dividas: "comprometimento", fixo: "custoFixoRenda", custo: "variacaoCusto", cobertura: "coberturaCaixa" }[it.k] || "")}</span><b>${it.valor == null ? "—" : it.un === "%" ? num(it.valor, 1) + "%" : it.un === "meses" ? num(it.valor, 1) + " m" : num(it.valor, 2) + "×"}</b></li>`).join("")}</ul>
          <div class="vg-fixos"><span>Compromissos recorrentes${ERP.help("compromissos")}</span><b>${brl(fixosMes)}<small>/mês</small></b><a href="#/financas/ativas">${at.length} conta(s) ativa(s) ↗</a></div>
        </div>
      </div>
      <div class="vg-grid vg-grid-b">
        <div class="card"><h3>Para Onde Vai · ${monthLabel(mk)} <small class="mut">despesas por categoria · realizado + previsto</small><a class="vg-more" href="#/financas/relatorios">relatórios ↗</a></h3>${cats.length ? canvas("vgCat", Math.max(160, Math.min(8, cats.length) * 30 + 20)) : `<div class="vg-ok mut">Sem despesas em ${monthLabel(mk)}.</div>`}</div>
        <div class="card"><h3>Orçamento · ${monthLabel(mk)} <small class="mut">${orc.length ? "maiores usos" : ""}</small><a class="vg-more" href="#/financas/orcamento">${orc.length ? "ver tudo ↗" : "definir ↗"}</a></h3>
          ${orc.length ? `<div class="vg-orc">${orc.map((x) => `<div class="vg-orow"><div class="vg-ol"><span>${esc(x.c.nome)}</span><b class="${x.pct > 100 ? "neg" : ""}">${brl(x.realizado)} <small class="mut">de ${brl(x.orcado)}</small></b></div><div class="bar"><i style="width:${Math.min(100, x.pct)}%;background:${x.pct > 100 ? "var(--err)" : x.pct > 80 ? "var(--warn)" : "var(--ok)"}"></i></div></div>`).join("")}</div>` : `<div class="vg-ok mut">Defina limites por categoria para acompanhar aqui o quanto já foi usado.</div>`}
        </div>
      </div>`;
    U.bindMes(root); acoes(root);
    $("#vgNovo", root).onclick = () => U.lancForm();
    /* gráfico de fluxo: 6 meses atrás (caixa) + 6 à frente (projeção) */
    const histM = []; for (let i = -6; i < 0; i++) { const k = F.mesSeg(mkHoje(), i); const x = ERP.finPainel.caixaMes(k); histM.push({ mk: k, ent: x.ent, sai: x.sai, saldo: F.saldoEm(F.diaNoMes(k, 31)), prev: false }); }
    const pj = F.projecao(6); pj.porMes.forEach((x) => histM.push({ mk: x.mk, ent: x.ent, sai: x.sai, saldo: x.saldo, prev: true }));
    ERP.chart($("#vgFluxo", root), { data: { labels: histM.map((x) => porMesLabel(x.mk)), datasets: [
      { type: "bar", label: "Entradas", data: histM.map((x) => x.ent), backgroundColor: histM.map((x) => alpha(C.ent, x.prev ? 0.28 : 0.6)), borderRadius: 3, order: 2 },
      { type: "bar", label: "Saídas", data: histM.map((x) => -x.sai), backgroundColor: histM.map((x) => alpha(C.sai, x.prev ? 0.25 : 0.5)), borderRadius: 3, order: 2 },
      { type: "line", label: "Saldo no fim do mês", data: histM.map((x) => x.saldo), borderColor: C.navy, backgroundColor: C.navy, borderWidth: 1.8, tension: 0.25, pointRadius: 2.5, order: 1, segment: { borderDash: (c) => (histM[c.p1DataIndex] && histM[c.p1DataIndex].prev ? [5, 4] : undefined) } }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 14 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${brl(Math.abs(c.parsed.y))}`, footer: (its) => (histM[its[0].dataIndex].prev ? "previsto · duplo clique abre os lançamentos" : "realizado · duplo clique abre os lançamentos") } } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 10 }, color: (c) => (histM[c.index] && histM[c.index].prev ? ERP.cor("--ink-3") : ERP.cor("--ink-2")) } }, y: Object.assign({}, eixoR$(), { grace: "10%" }) } } });
    ERP.chartDrill(ERP._charts[ERP._charts.length - 1], (di, i) => { const x = histM[i]; const L = x.prev ? pendMes(x.mk) : lancsCaixaMes(x.mk); const f = di === 0 ? (l) => l.tipo === "receita" : di === 1 ? (l) => l.tipo !== "receita" : null; return { title: `${di === 0 ? "Entradas" : di === 1 ? "Saídas" : "Movimentos"} · ${monthLabel(x.mk)}`, sub: x.prev ? "Previstos (em aberto)" : "Realizados (regime de caixa)", lancs: f ? L.filter(f) : L }; });
    if (cats.length) { const top = cats.slice(0, 8); ERP.chart($("#vgCat", root), { type: "bar", data: { labels: top.map((x) => F.cat(x[0]).nome), datasets: [{ data: top.map((x) => x[1]), backgroundColor: top.map((x) => alpha(F.cat(x[0]).cor, 0.8)), borderRadius: 4, barThickness: 16 }] }, options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + brl(c.parsed.x) + (sai ? ` · ${num((c.parsed.x / sai) * 100, 0)}%` : "") } }, datalabels: { display: true, anchor: "end", align: "right", font: { size: 10, weight: "700" }, formatter: (v) => kfmt(v) } }, scales: { x: Object.assign({}, eixoR$(), { grace: "18%" }), y: { grid: { display: false }, ticks: { font: { size: 11 } } } } } });
      ERP.chartDrill(ERP._charts[ERP._charts.length - 1], (di, i) => ({ title: `${F.cat(top[i][0]).nome} · ${monthLabel(mk)}`, sub: "Despesas da categoria · realizado + previsto", lancs: lancsMes(mk, (l) => l.catId === top[i][0] && l.tipo !== "receita") })); }
  }

  /* ================= CONTAS ATIVAS ================= */
  function pAtivas(root) {
    const d = D(); const mk = S.mk; S.atTab = S.atTab || "despesa"; const C = COR();
    const todas = ativas(mk); const desp = todas.filter((a) => a.s.tipo !== "receita"), rec = todas.filter((a) => a.s.tipo === "receita");
    const somaM = (arr) => arr.reduce((s, a) => s + a.mensal, 0);
    const pausadas = d.series.filter((s) => s.ativa === false || (s.fim && monthKey(s.fim) < mkHoje()));
    /* parcelamentos em andamento (compras parceladas e dívidas) */
    const grupos = {}; d.lanc.forEach((l) => { if (!l.parcela || !l.parcela.g) return; (grupos[l.parcela.g] = grupos[l.parcela.g] || []).push(l); });
    const parc = Object.values(grupos).map((ls) => { ls.sort((a, b) => a.parcela.n - b.parcela.n); const ab = ls.filter((l) => (l.tipo === "compra" ? l.fatura >= mkHoje() : !l.pago)); const pagas = ls.length - ab.length; return { ls, ab, pagas, t: ls[0].parcela.t, desc: ls[0].desc.replace(/\s*\(\d+\/\d+\)$/, ""), valor: ls[0].valor, resta: ab.reduce((s, l) => s + l.valor, 0), fim: ls[ls.length - 1].venc || ls[ls.length - 1].comp }; }).filter((g) => g.ab.length).sort((a, b) => a.fim.localeCompare(b.fim));
    const div = d.dividas.map((x) => ({ x, i: F.dividaInfo(x) })).filter((v) => v.i.rest > 0);
    const lista = S.atTab === "receita" ? rec : S.atTab === "pausadas" ? [] : desp;
    const st = (a) => ({ pago: ["ok", "Pago"], aberto: ["info", "Em aberto"], vencido: ["err", "Vencido"], fora: ["", "Não cai no mês"] })[a.st];
    const linha = (a) => { const s = a.s; const c = F.cat(s.catId); const fv = F.favorecido(s.favId); const [pc, pt] = st(a); return `<tr class="fin-row" data-sr="${s.id}"><td>${U.star("series", s.id)}<b>${esc(s.desc)}</b>${s.parcelas > 1 ? ` <span class="tag-cc">${s.parcelas}x</span>` : ""}<div class="mut fin-sub">${fv ? esc(fv.nome) + " · " : ""}${esc(c.nome)}${s.centro ? " · " + esc(s.centro) : ""}</div></td><td class="mut">${esc(U.freqLabel(s.passo))}<div class="fin-sub">dia ${s.dia}${s.fim ? " · até " + monthLabel(monthKey(s.fim)) : ""}</div></td><td class="r"><b>${s.moeda === "USD" ? "US$ " + num(s.valorMoeda, 2) : brl(s.valor)}</b>${s.moeda === "USD" ? `<div class="mut fin-sub">≈ ${brl(a.valor)}</div>` : ""}</td><td class="r">${brl(a.mensal)}</td><td>${a.prox ? fdm(a.prox.venc || a.prox.comp) : "<span class='mut'>—</span>"}</td><td><span class="pill ${pc}">${pt}</span>${a.noMes.length && a.st !== "pago" && a.noMes[0].tipo !== "compra" ? ` <button class="btn sm" data-pay="${a.noMes.find((l) => !l.pago).id}">${s.tipo === "receita" ? "Receber" : "Pagar"}</button>` : ""}</td><td class="mut">${s.cartaoId ? "💳 " + esc((F.cartao(s.cartaoId) || {}).nome || "") : esc(s.forma || "")}</td></tr>`; };
    root.innerHTML = ERP.pagehead("Contas Ativas", `${U.mesNav()}<button class="btn ghost" id="atNovaRec">+ Receita Recorrente</button><button class="btn orange" id="atNova">+ Conta Recorrente</button>`) + `
      <div class="kpis fp-4">
        ${kpi("Compromissos por Mês", brl(somaM(desp)), `${desp.length} conta(s) recorrente(s) · ${brl(somaM(desp) * 12)} por ano`, "neg", "", "var(--err)", "compromissos")}
        ${kpi("Receitas Recorrentes", brl(somaM(rec)), `${rec.length} entrada(s) · ${brl(somaM(rec) * 12)} por ano`, "pos", "", "var(--ok)")}
        ${kpi("Sobra Recorrente", (somaM(rec) - somaM(desp) >= 0 ? "+ " : "− ") + brl(Math.abs(somaM(rec) - somaM(desp))), somaM(rec) > 0 ? `${num(((somaM(rec) - somaM(desp)) / somaM(rec)) * 100, 0)}% da renda recorrente fica livre` : "cadastre a renda como recorrente", somaM(rec) - somaM(desp) >= 0 ? "pos" : "neg")}
        ${kpi("Em " + monthLabel(mk), `${desp.filter((a) => a.st === "pago").length}/${desp.filter((a) => a.st !== "fora").length} pagas`, `${desp.filter((a) => a.st === "vencido").length ? `<b class="neg">${desp.filter((a) => a.st === "vencido").length} vencida(s)</b> · ` : ""}${desp.filter((a) => a.st === "aberto").length} em aberto · ${brl(desp.filter((a) => a.st !== "pago" && a.st !== "fora").reduce((s, a) => s + a.noMes.filter((l) => !l.pago).reduce((t, l) => t + l.valor, 0), 0))} a pagar`, "", "#/financas/agenda", "var(--navy)")}
      </div>
      <div class="tabs"><button class="${S.atTab === "despesa" ? "on" : ""}" data-at="despesa">Contas a Pagar · ${desp.length}</button><button class="${S.atTab === "receita" ? "on" : ""}" data-at="receita">Receitas · ${rec.length}</button><button class="${S.atTab === "pausadas" ? "on" : ""}" data-at="pausadas">Pausadas e Encerradas · ${pausadas.length}</button></div>
      ${S.atTab !== "pausadas" ? (lista.length ? `<div class="card" style="padding:0"><div class="tw" style="border:0"><table class="at-tbl"><thead><tr><th>Conta</th><th>Frequência</th><th class="r">Valor</th><th class="r">Por Mês${ERP.help("mensalizado")}</th><th>Próximo</th><th>${monthLabel(mk)}</th><th>Forma</th></tr></thead><tbody>${lista.sort((a, b) => b.mensal - a.mensal).map(linha).join("")}</tbody></table></div><div class="fp-foot"><span>Clique na linha para editar valor, moeda, favorecido, dia, frequência ou pausar.</span><span>Total: <b>${brl(somaM(lista))}/mês</b></span></div></div>` : `<div class="empty">Nenhuma ${S.atTab === "receita" ? "receita" : "conta"} recorrente ativa.<div class="toolbar" style="justify-content:center;margin-top:12px"><button class="btn orange sm" onclick="document.getElementById('${S.atTab === "receita" ? "atNovaRec" : "atNova"}').click()">+ Cadastrar</button></div><p class="mut" style="margin-top:10px">Dica: ao lançar uma conta, marque a recorrência (mensal, bimestral, anual…) e ela aparece aqui.</p></div>`)
        : (pausadas.length ? `<div class="card" style="padding:0"><div class="tw" style="border:0"><table><thead><tr><th>Conta</th><th>Frequência</th><th class="r">Valor</th><th>Situação</th></tr></thead><tbody>${pausadas.map((s) => `<tr class="fin-row" data-sr="${s.id}"><td><b>${esc(s.desc)}</b><div class="mut fin-sub">${esc(F.cat(s.catId).nome)}</div></td><td class="mut">${esc(U.freqLabel(s.passo))}</td><td class="r">${brl(s.valor)}</td><td><span class="pill">${s.ativa === false ? "pausada" : "encerrada em " + monthLabel(monthKey(s.fim))}</span></td></tr>`).join("")}</tbody></table></div></div>` : `<div class="empty">Nenhuma recorrência pausada ou encerrada.</div>`)}
      <div class="vg-grid vg-grid-b">
        <div class="card"><h3>Compromissos Mês a Mês <small class="mut">próximos 12 meses, inclusive anuais · duplo clique abre os lançamentos</small></h3>${canvas("atMeses", 230)}</div>
        <div class="card"><h3>Parcelamentos e Dívidas em Andamento <small class="mut">${parc.length + div.length} item(ns)</small></h3>
          ${parc.length || div.length ? `<table class="vg-tbl"><tbody>${parc.map((g) => `<tr><td><b>${esc(g.desc)}</b><div class="mut fin-sub">${g.pagas}/${g.t} parcelas · ${brl(g.valor)}/parcela · última ${fdm(g.fim)}</div></td><td class="r"><b>${brl(g.resta)}</b><div class="mut fin-sub">restam ${g.t - g.pagas}</div></td></tr>`).join("")}${div.map(({ x, i }) => `<tr><td><b>${esc(x.nome)}</b><div class="mut fin-sub">dívida · ${i.rest} parcela(s) restante(s)${x.taxa ? " · " + num(x.taxa, 2) + "% a.m." : ""}</div></td><td class="r"><b>${brl(i.saldo)}</b><div class="mut fin-sub"><a href="#/financas/dividas">plano ↗</a></div></td></tr>`).join("")}</tbody></table>` : `<div class="vg-ok mut">Nenhum parcelamento em aberto.</div>`}
        </div>
      </div>`;
    U.bindMes(root); U.bindStars(root); acoes(root);
    $$("[data-at]", root).forEach((b) => (b.onclick = () => { S.atTab = b.dataset.at; ERP.render(); }));
    $("#atNova", root).onclick = () => U.lancForm(null, { tipo: "despesa", repetir: "1" });
    $("#atNovaRec", root).onclick = () => U.lancForm(null, { tipo: "receita", repetir: "1" });
    /* compromissos por mês (12 meses): lançamentos em aberto de séries + parcelas + faturas futuras */
    const ms = Array.from({ length: 12 }, (_, i) => F.mesSeg(mkHoje(), i)); F.materializarAte(ms[11]);
    const porCls = { fixo: ms.map(() => 0), variavel: ms.map(() => 0), parcela: ms.map(() => 0), outros: ms.map(() => 0) };
    D().lanc.forEach((l) => { if (l.pago || l.tipo !== "despesa") return; const i = ms.indexOf(monthKey(l.venc)); if (i < 0) return; const k = l.parcela ? "parcela" : l.serieId ? (F.baseClasse(l.classe || (F.cat(l.catId).fixo ? "fixo" : "variavel"))) : "outros"; porCls[k][i] += l.valor; });
    ERP.chart($("#atMeses", root), { type: "bar", data: { labels: ms.map(porMesLabel), datasets: [["fixo", "Fixas", C.fixo], ["variavel", "Variáveis (estimadas)", C.variavel], ["parcela", "Parcelas", C.cartao], ["outros", "Avulsas previstas", C.ink2]].map(([k, l, c]) => ({ label: l, data: porCls[k], backgroundColor: alpha(c, 0.75), borderRadius: 2, stack: "a" })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, padding: 12 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${brl(c.parsed.y)}`, footer: (its) => "Total: " + brl(its.reduce((s, i) => s + i.parsed.y, 0)) } } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 10 } } }, y: Object.assign({ stacked: true }, eixoR$()) } } });
    const KS = ["fixo", "variavel", "parcela", "outros"], KL = ["Fixas", "Variáveis", "Parcelas", "Avulsas previstas"];
    ERP.chartDrill(ERP._charts[ERP._charts.length - 1], (di, i) => ({ title: `${KL[di]} · ${monthLabel(ms[i])}`, sub: "Contas previstas (em aberto)", lancs: D().lanc.filter((l) => !l.pago && l.tipo === "despesa" && monthKey(l.venc) === ms[i] && (l.parcela ? "parcela" : l.serieId ? F.baseClasse(l.classe || (F.cat(l.catId).fixo ? "fixo" : "variavel")) : "outros") === KS[di]) }));
  }

  /* ================= FLUXO DE CAIXA ================= */
  function pFluxo(root) {
    S.fxHor = S.fxHor || 12; const H = S.fxHor; const C = COR(); const h = hoje();
    F.materializarAte(F.mesSeg(mkHoje(), H - 1));
    const pj = F.projecao(H); const jur = pj.porMes.reduce((s, m) => s + m.juros, 0);
    const totEnt = pj.porMes.reduce((s, m) => s + m.ent, 0), totSai = pj.porMes.reduce((s, m) => s + m.sai, 0);
    const R = F.dreMes(S.mk, "competencia");
    const hist = []; for (let i = -6; i < 0; i++) { const k = F.mesSeg(mkHoje(), i); const x = ERP.finPainel.caixaMes(k); hist.push({ mk: k, ent: x.ent, sai: x.sai, saldo: F.saldoEm(F.diaNoMes(k, 31)) }); }
    const negs = pj.porMes.filter((m) => m.saldo < 0);
    root.innerHTML = ERP.pagehead("Fluxo de Caixa", `<div class="tabs fin-tgl" role="group" aria-label="Horizonte">${[6, 12, 24].map((n) => `<button class="${H === n ? "on" : ""}" data-hor="${n}">${n} meses</button>`).join("")}</div><button class="btn orange" id="fxNovo">+ Lançamento</button>`) + `
      <div class="kpis fp-4">
        ${kpi("Saldo Hoje", brl(pj.ini), "contas do dia a dia, sem as reservas", pj.ini < 0 ? "neg" : "", "", pj.ini < 0 ? "var(--err)" : "var(--ok)", "saldoHoje")}
        ${kpi("Menor Saldo Previsto", brl(pj.min.v), `em ${fdate(pj.min.data)}${pj.min.v < 0 ? " · <b class='neg'>fica negativo</b>" : " · não fica negativo"}`, pj.min.v < 0 ? "neg" : "", "", pj.min.v < 0 ? "var(--err)" : "var(--navy)", "menorSaldo")}
        ${kpi(`Saldo em ${H} Meses`, brl(pj.porMes[H - 1].saldo), `${monthLabel(pj.porMes[H - 1].mk)} · ${brl(totEnt)} entram · ${brl(totSai)} saem`, pj.porMes[H - 1].saldo < 0 ? "neg" : "pos", "", "var(--navy)")}
        ${kpi("Previsto a Pagar", brl(totSai), `${H} meses · contas, parcelas, faturas e recorrências${jur ? ` · juros do cheque especial ~${brl(jur)}` : ""}`, "neg", "#/financas/agenda", "var(--err)", "previstoPagar")}
      </div>
      ${negs.length ? `<div class="note err">O saldo fica negativo em ${negs.length} mês(es): ${negs.slice(0, 4).map((m) => monthLabel(m.mk) + " (" + brl(m.saldo) + ")").join(", ")}${negs.length > 4 ? "…" : ""}. Veja o que pesa em <a href="#/financas/ativas">Contas Ativas</a>.</div>` : ""}
      <div class="card"><h3>Saldo Projetado${ERP.help("saldoProjetado")} <small class="mut">dia a dia, pelas contas em aberto e recorrências · atrasados contam hoje</small></h3>${canvas("fxSaldo", 260)}</div>
      <div class="vg-grid vg-grid-b">
        <div class="card"><h3>Mês a Mês <small class="mut">entradas, saídas e saldo no fim de cada mês</small></h3><div class="tw" style="max-height:420px;overflow:auto"><table class="fx-tbl"><thead><tr><th>Mês</th><th class="r">Entradas</th><th class="r">Saídas</th><th class="r">Resultado</th><th class="r">Saldo</th></tr></thead><tbody>
          ${hist.map((m) => `<tr class="mut"><td>${monthLabel(m.mk)} <small>real.</small></td><td class="r">${brl(m.ent)}</td><td class="r">${brl(m.sai)}</td><td class="r">${U.sinal(m.ent - m.sai)}</td><td class="r">${U.sinal(m.saldo)}</td></tr>`).join("")}
          <tr class="fx-hoje"><td>Hoje</td><td></td><td></td><td></td><td class="r"><b>${U.sinal(pj.ini)}</b></td></tr>
          ${pj.porMes.map((m) => `<tr class="${m.saldo < 0 ? "fx-neg" : ""}"><td>${monthLabel(m.mk)}</td><td class="r pos">${m.ent ? brl(m.ent) : "—"}</td><td class="r neg">${m.sai ? brl(m.sai) : "—"}</td><td class="r">${U.sinal(m.ent - m.sai)}</td><td class="r"><b>${U.sinal(m.saldo)}</b>${m.juros ? `<div class="mut fin-sub">+ juros ~${brl(m.juros)}</div>` : ""}</td></tr>`).join("")}</tbody></table></div></div>
        <div class="card"><h3>De Onde Vem, Para Onde Vai${ERP.help("dre")} <small class="mut">${monthLabel(S.mk)} · realizado + previsto · duplo clique abre os lançamentos</small><span class="vg-more">${U.mesNav()}</span></h3>${canvas("fxCasc", 300)}
          <div class="fx-leg"><span>Entradas <b class="pos">${brl(R.rec)}</b></span><span>Necessidades${ERP.help("necessidades")} <b>${brl(R.essencial)}</b></span><span>Estilo de vida${ERP.help("estiloVida")} <b>${brl(R.estilo)}</b></span><span>Financeiro${ERP.help("financeiro")} <b>${brl(R.financeiro)}</b></span><span>Investimentos${ERP.help("investimentos")} <b>${brl(R.investimento)}</b></span><span>Sobra${ERP.help("sobra")} <b class="${R.livre >= 0 ? "pos" : "neg"}">${brl(R.livre)}</b></span></div></div>
      </div>`;
    U.bindMes(root);
    $$("[data-hor]", root).forEach((b) => (b.onclick = () => { S.fxHor = +b.dataset.hor; ERP.render(); }));
    $("#fxNovo", root).onclick = () => U.lancForm();
    /* saldo dia a dia */
    const pts = [{ d: h, v: pj.ini }]; let s = pj.ini; pj.ev.forEach((e) => { s += e.v; const last = pts[pts.length - 1]; if (last.d === e.data) last.v = s; else pts.push({ d: e.data, v: s }); });
    const fim = F.diaNoMes(pj.porMes[H - 1].mk, 31); if (pts[pts.length - 1].d < fim) pts.push({ d: fim, v: s });
    ERP.chart($("#fxSaldo", root), { type: "line", data: { labels: pts.map((p) => fdm(p.d)), datasets: [{ data: pts.map((p) => p.v), borderColor: C.navy, borderWidth: 2, stepped: true, pointRadius: pts.length > 60 ? 0 : 2, fill: { target: { value: 0 }, above: alpha(C.ent, 0.12), below: alpha(C.sai, 0.18) } }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: (its) => its[0].label, label: (c) => " saldo " + brl(c.parsed.y) } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10, maxRotation: 0 } }, y: eixoR$() } } });
    /* cascata do mês */
    const steps = [["Entradas", R.rec, C.ent], ["Necessid.", -R.essencial, C.fixo], ["Estilo", -R.estilo, C.variavel], ["Financ.", -R.financeiro, C.sai], ["Invest.", -R.investimento, C.inv]];
    let run = 0; const bars = steps.map(([l, v, c]) => { const a = run; run += v; return { l, y: [Math.min(a, run), Math.max(a, run)], c, v }; }); bars.push({ l: "Sobra", y: [Math.min(0, run), Math.max(0, run)], c: run >= 0 ? C.navy : C.sai, v: run });
    ERP.chart($("#fxCasc", root), { type: "bar", data: { labels: bars.map((b) => b.l), datasets: [{ data: bars.map((b) => b.y), backgroundColor: bars.map((b) => alpha(b.c, 0.8)), borderRadius: 3, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + brl(bars[c.dataIndex].v) } }, datalabels: { display: true, anchor: "end", align: "top", font: { size: 10, weight: "700" }, formatter: (v, c) => kfmt(bars[c.dataIndex].v) } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10.5 }, maxRotation: 0, autoSkip: false } }, y: Object.assign({}, eixoR$(), { grace: "12%" }) } } });
    const NATS = [null, "essencial", "estilo", "financeiro", "investimento"]; const NL = ["Entradas", "Necessidades", "Estilo de Vida", "Financeiro", "Investimentos"];
    ERP.chartDrill(ERP._charts[ERP._charts.length - 1], (di, i) => { if (i >= NATS.length) return { title: `Sobra · ${monthLabel(S.mk)}`, sub: "Todos os lançamentos do mês", lancs: lancsMes(S.mk) }; const n = NATS[i]; return { title: `${NL[i]} · ${monthLabel(S.mk)}`, sub: "Realizado + previsto (competência)", lancs: lancsMes(S.mk, (l) => (n ? l.tipo !== "receita" && F.cat(l.catId).natureza === n : l.tipo === "receita" && F.cat(l.catId).natureza !== "investimento")) }; });
  }

  /* ================= A PAGAR / RECEBER ================= */
  function pAgenda(root) {
    const h = hoje(); S.agenda = S.agenda || "pagar"; S.agHor = S.agHor || 12; const C = COR();
    F.materializarAte(F.mesSeg(mkHoje(), S.agHor - 1));
    const all = F.pendencias().filter((p) => p.tipo !== "transferencia").filter((p) => (S.agenda === "receber" ? p.tipo === "receita" : S.agenda === "pagar" ? p.tipo !== "receita" : true));
    const lim30 = F.addDias(h, 30);
    const faixas = [["Vencidas", (p) => p.data < h, "err"], ["Hoje", (p) => p.data === h, "warn"], ["Próximos 7 Dias", (p) => p.data > h && p.data <= F.addDias(h, 7), ""], ["Até 30 Dias", (p) => p.data > F.addDias(h, 7) && p.data <= lim30, ""]];
    const soma = (arr) => arr.reduce((s, p) => s + p.valor, 0);
    const depois = all.filter((p) => p.data > lim30); const porMes = {}; depois.forEach((p) => { (porMes[monthKey(p.data)] = porMes[monthKey(p.data)] || []).push(p); });
    const ms = Array.from({ length: S.agHor }, (_, i) => F.mesSeg(mkHoje(), i));
    const linha = (p) => `<tr class="${p.data < h ? "late" : ""}"><td class="vg-d">${fdm(p.data)}</td><td><b>${esc(p.desc)}</b>${p.k === "l" && p.l.estimado ? ' <span class="pill warn" title="Valor estimado pela recorrência">a confirmar</span>' : ""}<div class="mut fin-sub">${p.k === "l" ? esc(F.cat(p.l.catId).nome) + (F.favorecido(p.l.favId) ? " · " + esc(F.favorecido(p.l.favId).nome) : "") + " · " + origemTxt(p.l) : p.f.itens.length + " compra(s) · " + esc(p.f.cartao.nome)}</div></td><td class="r ${p.tipo === "receita" ? "pos" : "neg"}"><b>${brl(p.valor)}</b></td><td class="r" style="white-space:nowrap">${p.k === "l" ? `<button class="btn ghost sm" data-ed="${p.l.id}">Editar</button> <button class="btn sm" data-pay="${p.l.id}">${p.tipo === "receita" ? "Receber" : "Pagar"}</button>` : `<button class="btn sm" data-payf="${p.f.cartao.id}|${p.f.key}">Pagar Fatura</button>`}</td></tr>`;
    const comp = D().lanc.filter((l) => l.pago && l.pago >= F.addDias(h, -90) && ["despesa", "receita"].includes(l.tipo) && !(l.anexos || []).length && l.valor >= 50).sort((a, b) => b.pago.localeCompare(a.pago));
    root.innerHTML = ERP.pagehead(S.agenda === "receber" ? "Contas a Receber" : S.agenda === "pagar" ? "Contas a Pagar" : "A Pagar e a Receber", `<div class="tabs fin-tgl" role="group">${[["pagar", "A Pagar"], ["receber", "A Receber"], ["tudo", "Tudo"]].map(([k, n]) => `<button class="${S.agenda === k ? "on" : ""}" data-ag="${k}">${n}</button>`).join("")}</div><button class="btn orange" id="agNovo">+ Lançamento</button>`) + `
      <div class="kpis fp-4">${faixas.map(([n, f, c], i) => { const it = all.filter(f); return kpi(n, brl(soma(it)), `${it.length} item(ns)`, i === 0 && it.length ? "neg" : "", "", c === "err" && it.length ? "var(--err)" : c === "warn" && it.length ? "var(--warn)" : "var(--navy)"); }).join("")}</div>
      <div class="vg-grid vg-grid-c">
        <div>
          ${faixas.map(([n, f, c]) => { const it = all.filter(f); return it.length ? `<div class="card ag-faixa ${c}"><h3>${n} <small class="mut">${it.length} · ${brl(soma(it))}</small></h3><table class="vg-tbl"><tbody>${it.map(linha).join("")}</tbody></table></div>` : ""; }).join("") || `<div class="card"><div class="vg-ok">${ERP.ic("circle-check", 22)} Nada vencido nem a vencer nos próximos 30 dias.</div></div>`}
          <div class="card"><h3>Meses Seguintes <small class="mut">${depois.length} item(ns) · ${brl(soma(depois))} · já previstos</small><span class="vg-more"><span class="tabs fin-tgl">${[12, 24].map((n) => `<button class="${S.agHor === n ? "on" : ""}" data-aghor="${n}">${n} meses</button>`).join("")}</span></span></h3>
            ${Object.keys(porMes).length ? Object.keys(porMes).sort().map((mk) => `<details class="ag-mes"${mk === S.agOpen ? " open" : ""} data-mk="${mk}"><summary><span>${monthLabel(mk)}</span><span class="mut">${porMes[mk].length} conta(s)</span><b>${brl(soma(porMes[mk]))}</b></summary><table class="vg-tbl"><tbody>${porMes[mk].map(linha).join("")}</tbody></table></details>`).join("") : `<div class="vg-ok mut">Nada previsto depois de 30 dias.</div>`}
          </div>
        </div>
        <div>
          <div class="card"><h3>Previsto por Mês <small class="mut">${S.agHor} meses</small></h3>${canvas("agMeses", 220)}<p class="mut fin-leg">Clique numa barra para abrir o mês na lista; duplo clique mostra o extrato.</p></div>
          ${comp.length ? `<details class="card ag-comp"><summary><b>Pendências de Comprovante</b> <span class="mut">${comp.length} pagamento(s) sem anexo · 90 dias</span></summary><table class="vg-tbl"><tbody>${comp.slice(0, 12).map((l) => `<tr><td class="vg-d">${fdm(l.pago)}</td><td><b>${esc(l.desc)}</b><div class="mut fin-sub">${esc(F.cat(l.catId).nome)}</div></td><td class="r">${brl(dinheiro(l))}</td><td class="r"><button class="btn ghost sm" data-ed="${l.id}">Anexar</button></td></tr>`).join("")}</tbody></table></details>` : ""}
        </div>
      </div>`;
    acoes(root);
    $$("[data-ag]", root).forEach((b) => (b.onclick = () => { S.agenda = b.dataset.ag; ERP.render(); }));
    $$("[data-aghor]", root).forEach((b) => (b.onclick = () => { S.agHor = +b.dataset.aghor; ERP.render(); }));
    $("#agNovo", root).onclick = () => U.lancForm(null, { tipo: S.agenda === "receber" ? "receita" : "despesa" });
    const pr = ms.map(() => 0), pp = ms.map(() => 0); all.forEach((p) => { const i = ms.indexOf(p.data < h ? mkHoje() : monthKey(p.data)); if (i < 0) return; if (p.tipo === "receita") pr[i] += p.valor; else pp[i] += p.valor; });
    const ds = []; if (S.agenda !== "pagar") ds.push({ label: "A Receber", data: pr, backgroundColor: alpha(C.ent, 0.6), borderRadius: 3 }); if (S.agenda !== "receber") ds.push({ label: "A Pagar", data: pp, backgroundColor: alpha(C.sai, 0.55), borderRadius: 3 });
    const ch = ERP.chart($("#agMeses", root), { type: "bar", data: { labels: ms.map(porMesLabel), datasets: ds }, options: { responsive: true, maintainAspectRatio: false, onClick: (e, els) => { if (!els.length) return; const mk = ms[els[0].index]; const det = $(`.ag-mes[data-mk="${mk}"]`, root); S.agOpen = mk; if (det) { det.open = true; det.scrollIntoView({ block: "center", behavior: "smooth" }); } }, plugins: { legend: { display: ds.length > 1, position: "bottom", labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${brl(c.parsed.y)}` } }, datalabels: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, font: { size: 10 } } }, y: Object.assign({}, eixoR$(), { grace: "12%" }) } } });
    if (ch) { ch.canvas.style.cursor = "pointer"; ERP.chartDrill(ch, (di, i) => { const rec = ds[di].label === "A Receber"; return { title: `${ds[di].label} · ${monthLabel(ms[i])}`, sub: "Previstos em aberto (atrasados contam no mês atual)", lancs: pendMes(ms[i]).filter((l) => (rec ? l.tipo === "receita" : l.tipo !== "receita")) }; }); }
  }

  /* ================= CADASTROS com abas ================= */
  const pCadOrig = ERP.modules.find((m) => m.id === "financas").pages.find((p) => p.id === "cadastros").render;
  function pCad(root) {
    pCadOrig(root);
    const cards = $$(":scope > .card", root); if (!cards.length) return;
    const tabs = []; const wrap = document.createElement("div"); wrap.className = "cad-tabs tabs";
    cards.forEach((c, i) => { const h3 = $("h3", c); const t = h3 ? h3.childNodes[0].textContent.trim() : "Outros"; if (/^Recorr/.test(t)) { c.remove(); return; } tabs.push({ t, c }); });
    S.cadTab = tabs.some((x) => x.t === S.cadTab) ? S.cadTab : tabs[0].t;
    wrap.innerHTML = tabs.map((x) => `<button class="${x.t === S.cadTab ? "on" : ""}" data-cad="${esc(x.t)}">${esc(x.t)}</button>`).join("") + `<a class="btn ghost sm" href="#/financas/ativas" style="margin-left:auto">Recorrências → Contas Ativas</a>`;
    tabs.forEach((x) => { x.c.style.display = x.t === S.cadTab ? "" : "none"; });
    const head = $(".pagehead", root); head.insertAdjacentElement("afterend", wrap);
    $$("[data-cad]", wrap).forEach((b) => (b.onclick = () => { S.cadTab = b.dataset.cad; ERP.render(); }));
  }

  /* ================= registro das páginas ================= */
  const mod = ERP.modules.find((m) => m.id === "financas");
  const old = Object.fromEntries(mod.pages.map((p) => [p.id, p]));
  mod.pages = [
    { id: "painel", label: "Visão Geral", short: "Visão Geral", icon: "house", render: pGeral },
    { id: "lancamentos", label: "Lançamentos", icon: "list", render: old.lancamentos.render },
    { id: "ativas", label: "Contas Ativas", short: "Contas Ativas", icon: "repeat", render: pAtivas },
    { id: "fluxo", label: "Fluxo de Caixa", short: "Fluxo", icon: "trending-up", render: pFluxo },
    { id: "agenda", label: "A Pagar e a Receber", short: "A Pagar", icon: "calendar-clock", render: pAgenda },
    { id: "cartoes", label: "Cartões e Faturas", short: "Cartões", icon: "credit-card", render: old.cartoes.render, more: true },
    { id: "analise", label: "Análise Detalhada", short: "Análise", icon: "chart-column", render: old.painel.render, more: true },
    { id: "extratos", label: "Extratos", icon: "banknote", render: old.extratos.render, more: true },
    { id: "relatorios", label: "Relatórios", icon: "chart-pie", render: old.relatorios.render, more: true },
    { id: "orcamento", label: "Orçamento", icon: "target", render: old.orcamento.render, more: true },
    { id: "dividas", label: "Dívidas", icon: "scale", render: old.dividas.render, more: true },
    { id: "metas", label: "Metas e Planejamento", short: "Metas", icon: "flag", render: old.metas.render, more: true },
    { id: "resumo", label: "Resumo do Mês", short: "Resumo", icon: "file-text", render: old.resumo.render, more: true },
    { id: "cadastros", label: "Cadastros", icon: "layers", render: pCad, more: true },
  ];
  ERP.finVisoes = { ativas, alertas, mesRealPrev };
})();

