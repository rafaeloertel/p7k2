/* Sistema — conta e dados (Supabase), backup e restauração, dados de exemplo, aparência, glossário */
(function () {
  "use strict";
  const { $, $$, esc, todayISO, Store, Cloud } = ERP;

  /* restaura um backup (.json gerado pelo próprio Hub). "merge" junta pelo id; "replace" troca os módulos presentes no arquivo. */
  function importFile(file, mode) {
    const r = new FileReader();
    r.onload = async () => {
      let j; try { j = JSON.parse(r.result); } catch (e) { ERP.toast("Arquivo inválido."); return; }
      const docs = j.docs || (j.doc && j.data ? { [j.doc]: j.data } : null);
      if (!docs) { ERP.toast("Este arquivo não é um backup do Hub."); return; }
      const names = Object.keys(docs).filter((n) => ERP.defaults[n]);
      if (!names.length) { ERP.toast("O arquivo não tem módulos conhecidos."); return; }
      const label = names.map((n) => ({ financas: "Finanças", reminders: "Reminders", investimentos: "Investimentos", patrimonio: "Patrimônio" }[n] || n)).join(", ");
      if (!(await ERP.confirm(`${mode === "merge" ? "Juntar" : "Substituir"} os dados de: ${label}? ${mode === "merge" ? "Itens com o mesmo ID são atualizados; os demais são mantidos." : "Os dados atuais desses módulos serão trocados pelos do arquivo."}`, "Restaurar"))) return;
      names.forEach((n) => Store.change(n, (cur) => {
        const inc = docs[n];
        Object.keys(inc).forEach((k) => {
          if (mode === "merge" && Array.isArray(inc[k]) && Array.isArray(cur[k])) { const by = new Map(cur[k].map((x) => [x.id, x])); inc[k].forEach((x) => by.set(x.id, Object.assign(by.get(x.id) || {}, x))); cur[k] = Array.from(by.values()); }
          else if (mode === "merge" && inc[k] && typeof inc[k] === "object" && !Array.isArray(inc[k]) && cur[k] && typeof cur[k] === "object") cur[k] = Object.assign({}, cur[k], inc[k], k === "fx" ? { ptax: Object.assign({}, cur[k].ptax, inc[k].ptax) } : {});
          else cur[k] = inc[k];
        });
      }));
      ERP.toast("Restaurado: " + label); ERP.render();
    };
    r.readAsText(file);
  }

  /* Bloqueio do app: código de 6 dígitos + Face ID, só no celular e só neste aparelho. */
  function cartaoTrava() {
    const P = ERP.PIN; if (!P) return "";
    const cel = P.ehCelular(), tem = P.temCodigo(), bio = P.temBio();
    const estado = !cel ? `<span class="pill">não se aplica a este aparelho</span>`
      : tem ? `<span class="pill ok">código ativo${bio ? " · Face ID ativo" : ""}</span>`
        : `<span class="pill warn">sem código</span>`;
    return `<div class="card"><h3>Bloqueio do App</h3>
      <div class="kv"><div><span class="k">Neste aparelho</span><span class="v">${estado}</span></div></div>
      <p class="mut" style="margin-top:10px">Um código de seis números pedido ao abrir o Hub no celular e ao voltar depois de ${P.MINUTOS} minutos fora da tela, com Face ID ou digital se o aparelho tiver. Serve para o caso de perder o celular desbloqueado. O código fica só neste aparelho, embaralhado, e nunca vai para a nuvem.</p>
      ${cel ? `<div class="toolbar" style="margin-top:12px">
          ${tem ? `<button class="btn ghost" id="pnTroc">Trocar o Código</button>` : `<button class="btn orange" id="pnCria">Criar o Código</button>`}
          ${tem && !bio ? `<button class="btn ghost" id="pnBio">Ativar Face ID / Biometria</button>` : ""}
          ${tem && bio ? `<button class="btn ghost" id="pnBioOff">Desativar Face ID</button>` : ""}
          ${tem ? `<button class="btn danger" id="pnRem">Remover o Código</button>` : ""}
        </div>
        ${P.motivo ? `<p class="mut" style="font-size:12.5px;margin-top:10px">${esc(P.motivo)}</p>` : ""}`
      : `<p class="mut" style="font-size:12.5px;margin-top:10px">A trava vale por aparelho e só aparece no celular. Neste computador nada muda.</p>`}
      <p class="mut" style="font-size:12.5px;margin-top:10px">É uma trava do aplicativo, não da sua conta. Se o celular for roubado, o primeiro passo continua sendo encerrar as sessões da conta Microsoft, trocar a senha e apagar o aparelho à distância.</p>
    </div>`;
  }

  function pDados(root) {
    const logado = !!Cloud.account;
    const u = Cloud.ultimoSalvamento ? Cloud.ultimoSalvamento() : null;
    const sujos = ERP.syncSujos ? ERP.syncSujos() : [], pend = ERP.syncPendentes ? ERP.syncPendentes() : [];
    const NM = { financas: "Finanças", reminders: "Reminders", investimentos: "Investimentos", patrimonio: "Patrimônio" };
    const lista = (a) => a.map((n) => NM[n] || n).join(", ");
    const estado = pend.length ? `<span class="pill warn">aguardando sua escolha</span>` : Cloud.status === "err" ? `<span class="pill err">não está salvando</span>` : sujos.length ? `<span class="pill warn">enviando…</span>` : logado ? `<span class="pill ok">em dia</span>` : `<span class="pill">só neste aparelho</span>`;
    root.innerHTML = ERP.pagehead("Dados e Sincronização") + `
      <div class="card"><h3>Sua Conta</h3>
        ${logado ? `<div class="kv"><div><span class="k">Conta</span><span class="v">${esc(Cloud.account.username)}</span></div>${Cloud.firstName() ? `<div><span class="k">Nome</span><span class="v">${esc(Cloud.account.name)}</span></div>` : ""}</div>
        <p class="mut" style="margin-top:10px">Login pela sua conta Microsoft pessoal. Cada conta vê somente os próprios dados.</p>
        <div class="toolbar" style="margin-top:12px"><button class="btn ghost" id="cOut">Sair da Conta</button></div>`
        : `<p class="mut" style="margin-bottom:12px">Você não entrou. O que você lançar fica só neste aparelho até entrar.</p><div class="toolbar"><button class="btn orange" id="cIn">Entrar com Microsoft</button></div>`}
      </div>
      <div class="card"><h3>Seus Dados</h3>
        <div class="kv">
          <div><span class="k">Situação</span><span class="v">${estado}</span></div>
          <div><span class="k">Onde ficam</span><span class="v">Na nuvem (banco de dados protegido por login e regras por usuário), com cópia de trabalho neste aparelho</span></div>
          <div><span class="k">Último salvamento</span><span class="v">${u ? esc(ERP.syncHora(u)) : "ainda não"}</span></div>
          <div><span class="k">Ainda não enviado</span><span class="v">${sujos.length ? esc(lista(sujos)) : '<span class="sync-ok">nada</span>'}</span></div>
          <div><span class="k">Decisão pendente</span><span class="v">${pend.length ? esc(lista(pend)) : '<span class="sync-ok">nenhuma</span>'}</span></div>
        </div>
        <div class="toolbar" style="margin-top:12px">${pend.length ? '<button class="btn orange" id="sgEsc">Escolher como juntar</button>' : ""}${logado ? '<button class="btn" id="cSync">Sincronizar Agora</button>' : ""}</div>
        <p class="mut" style="font-size:12.5px;margin-top:10px">Nos outros aparelhos, basta entrar com a mesma conta: os dados aparecem iguais. Se dois aparelhos alterarem o mesmo módulo ao mesmo tempo, o Hub pergunta antes de juntar — nunca descarta nada sozinho.</p>
      </div>
      <div class="card"><h3>Backup</h3>
        <p class="mut" style="margin-bottom:10px">Uma cópia completa dos seus dados em um arquivo <code>.json</code>, para guardar fora da nuvem. Para voltar a um backup, use "Restaurar".</p>
        <div class="toolbar"><button class="btn ghost" id="bExp">Exportar Backup (.json)</button><label class="btn ghost" style="cursor:pointer">Restaurar e Juntar<input type="file" accept=".json,application/json" id="iMerge" hidden></label><label class="btn ghost" style="cursor:pointer">Restaurar e Substituir<input type="file" accept=".json,application/json" id="iRep" hidden></label></div>
      </div>
      <div class="card"><h3>Dados de Exemplo</h3><p class="mut" style="margin-bottom:10px">Para conhecer Finanças com números: carrega uma conta, um cartão, recorrências, compras, um empréstimo e uma meta, todos marcados como exemplo. Remover apaga só eles.</p><div class="toolbar">${ERP.temExemplo() ? `<button class="btn ghost" id="exRem">Remover Exemplos</button>` : `<button class="btn ghost" id="exAdd">Carregar Exemplo</button>`}</div></div>
      ${logado ? cartaoTrava() : ""}
      <div class="card"><h3>Aparência</h3><p class="mut" style="margin-bottom:12px">O padrão é o modo claro. Escolha Escuro, ou Automático para seguir o modo do aparelho. O botão de lua/sol no menu alterna na hora.</p><div class="tabs" id="aTheme" style="margin:0">${[["light", "Claro"], ["dark", "Escuro"], ["auto", "Automático"]].map(([k, n]) => `<button data-th="${k}" class="${ERP.theme() === k ? "on" : ""}">${n}</button>`).join("")}</div></div>
      <div class="card"><h3>Sobre</h3><p>Hub ${esc(ERP.version)} · módulos: ${ERP.modules.map((m) => esc(m.label)).join(", ")}.</p><p class="mut" style="margin-top:6px">Página instalável (PWA). Dados na nuvem via Supabase; login Microsoft. O código no GitHub é público e não contém dados.</p></div>`;
    $("#aTheme", root).onclick = (e) => { const b = e.target.closest("[data-th]"); if (b) ERP.setTheme(b.dataset.th); };
    const i = $("#cIn", root); if (i) i.onclick = () => Cloud.login();
    const o = $("#cOut", root); if (o) o.onclick = async () => { if (await ERP.confirm("Sair da conta neste aparelho? Seus dados continuam na nuvem.", "Sair")) Cloud.logout(); };
    const s = $("#cSync", root); if (s) s.onclick = async () => { s.disabled = true; s.textContent = "Sincronizando…"; try { await Cloud.sincronizarAgora(); } finally { ERP.render(); } };
    const e1 = $("#sgEsc", root); if (e1) e1.onclick = () => Cloud.askConflict(ERP.syncPendentes());
    const ea = $("#exAdd", root); if (ea) ea.onclick = () => ERP.finExemplo();
    const er = $("#exRem", root); if (er) er.onclick = () => ERP.confirm("Remover todos os dados de exemplo?", "Remover").then((ok) => ok && ERP.finRemoverExemplo());
    const P = ERP.PIN;
    if (P) {
      const pc = $("#pnCria", root); if (pc) pc.onclick = () => P.criar();
      const pt = $("#pnTroc", root); if (pt) pt.onclick = () => P.trocar();
      const pb = $("#pnBio", root); if (pb) pb.onclick = () => { pb.disabled = true; pb.textContent = "Aguardando o aparelho…"; P.ativarBio(); };
      const pf = $("#pnBioOff", root); if (pf) pf.onclick = () => P.removerBio();
      const pr = $("#pnRem", root); if (pr) pr.onclick = () => P.remover();
    }
    $("#bExp", root).onclick = () => { Cloud.exportarBackup(); ERP.toast("Backup baixado."); };
    $("#iMerge", root).onchange = (e) => e.target.files[0] && importFile(e.target.files[0], "merge");
    $("#iRep", root).onchange = (e) => e.target.files[0] && importFile(e.target.files[0], "replace");
  }

  /* glossário: todos os termos técnicos usados nas telas, em linguagem simples */
  function pGlossario(root) {
    const q = (root._q || "").toLowerCase();
    const itens = Object.entries(ERP.GLOSS).map(([k, v]) => ({ k, t: v[0], d: v[1] })).sort((a, b) => a.t.localeCompare(b.t, "pt-BR"));
    root.innerHTML = ERP.pagehead("Glossário") + `<p class="mut" style="margin:-6px 0 14px">O que significa cada termo das telas. Nas telas, o botão <span class="hlp" style="cursor:default">?</span> ao lado de um termo abre esta explicação.</p>
      <div class="toolbar"><input id="glQ" placeholder="Buscar termo…" value="${esc(root._q || "")}" style="max-width:280px"></div>
      <div class="gloss">${itens.filter((i) => !q || (i.t + " " + i.d).toLowerCase().includes(q)).map((i) => `<div class="card" id="gl-${i.k}"><b>${esc(i.t)}</b><p>${esc(i.d)}</p></div>`).join("") || `<p class="mut">Nenhum termo encontrado.</p>`}</div>`;
    $("#glQ", root).oninput = (e) => { root._q = e.target.value; const v = e.target.value; pGlossario(root); const i = $("#glQ", root); i.focus(); i.setSelectionRange(v.length, v.length); };
  }
  ERP.register({ id: "sistema", label: "Sistema", icon: "settings", group: "Sistema", pages: [{ id: "dados", label: "Dados e Sincronização", icon: "cloud", render: pDados }, { id: "glossario", label: "Glossário", icon: "info", render: pGlossario }] });
})();

