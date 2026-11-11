/* VJ Tags - Party accounts (gold) = Sundry Debtors (owner Abhinav 04/11/2026 16:40, C-20261104-G2GACCOUNT; split out of the cash book 16:55
   C-20261104-CASHBOOKOFF - cash book and creditors stay in Tally). Laid out like his Excel CUSTOMERS ACCOUNT (per party) and GrpSum (all parties).
   Loaded by shim.js for Abhinav / Shilpiji only; the server checks every call (/api/vj/g2g, /api/vj/recon). Party Reconcile (Abhinav only) lives here too. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const inr = n => "₹ " + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const el = (tag, props, kids) => { const e = document.createElement(tag); if (props) Object.assign(e, props); (kids || []).forEach(k => k != null && e.append(k)); return e; };
  const btn = (text, cls, fn) => { const b = el("button", { type: "button", className: "btn" + (cls ? " " + cls : ""), textContent: text }); if (fn) b.addEventListener("click", fn); return b; };
  async function api(path, body) {
    const r = await fetch(path, body ? { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { credentials: "same-origin", cache: "no-store" });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status)); return j;
  }
  const opts = (sel, list, val) => { sel.textContent = ""; list.forEach(([v, l]) => sel.append(el("option", { value: v, textContent: l }))); if (val != null) sel.value = val; };
  const CR = { d: null, a: null };
  function style() { const s = el("style"); s.textContent = `
#p-g2g .cbbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#p-g2g .cbbar select,#p-g2g .cbbar input{width:auto;min-width:0}
#p-g2g .cbbar .sp{flex:1 1 0}
#p-g2g .cbkpi{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
#p-g2g button.cbt{font:inherit;text-align:left;cursor:pointer;color:var(--fg)} #p-g2g .cbt.bp .v{color:var(--warn);font-size:18px} #p-g2g .cbt.bp:hover{border-color:var(--warn)}
#p-g2g .cbt{border:1px solid var(--line);border-radius:var(--r);padding:8px 12px;background:var(--bg);min-width:0}
#p-g2g .cbt .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
#p-g2g .cbt .v{font-family:var(--f-mono);font-size:22px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#p-g2g .cbt.in .v{color:var(--ok)} #p-g2g .cbt.out .v{color:var(--bad)}
#p-g2g .cbt.cl{background:var(--gold-soft);border-color:var(--gold)} #p-g2g .cbt.cl .v{color:var(--gold)}
#p-g2g .cbtk{display:flex;flex-direction:row;align-items:center;gap:5px;font-size:12px;color:var(--warn);cursor:pointer;margin-top:2px}
#p-g2g .cbtk.on{color:var(--ok)} #p-g2g .cbtk input{width:18px;height:18px;margin:0}
.cbdlg.wide{width:min(1100px,100%)} .cbdlg table.cbm{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums} .cbdlg table.cbm td,.cbdlg table.cbm th{padding:5px 6px;border-bottom:1px solid var(--line);text-align:right} .cbdlg table.cbm td:first-child,.cbdlg table.cbm th:first-child{text-align:left}
.cbdlg table.cbm input{width:120px;text-align:right;padding:5px 6px} .cbdlg .tblw{max-height:60vh;overflow:auto;border:1px solid var(--line);border-radius:var(--r)}
#p-g2g table.cbm{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
#p-g2g table.cbm th,#p-g2g table.cbm td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
#p-g2g table.cbm th:first-child,#p-g2g table.cbm td:first-child{text-align:left}
#p-g2g table.cbm th{background:var(--sunk);font-size:12px;color:var(--muted);position:sticky;top:0}
#p-g2g table.cbm tr.d{cursor:pointer} #p-g2g table.cbm tr.d:hover{background:var(--sunk)} #p-g2g table.cbm tr.tt td{font-weight:600;background:var(--sunk)}
.cbdlg table.cbm td{white-space:nowrap} .cbdlg table.cbm tr.tt td{font-weight:600;background:var(--sunk)} .cbdlg table.cbm{font-size:13px}
#p-g2g .crbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center} #p-g2g .crbar select{width:auto} #p-g2g .list{max-height:52vh;overflow:auto}
.cbov{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}
.cbdlg{background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:var(--r);padding:16px;width:min(620px,100%);display:flex;flex-direction:column;gap:12px;margin-top:3vh}
.cbdlg .hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap} .cbdlg .hd h2{flex:1 1 auto}
.cbdlg .mic{font-size:15px;padding:8px 14px} .cbdlg .mic.on{background:var(--bad);border-color:var(--bad);color:#fff}
.cbdlg .heard{font-size:13px;color:var(--muted);margin:0}
.cbdlg .sug{display:flex;flex-direction:column;gap:4px}
.cbdlg .sug button{font:inherit;font-size:14px;text-align:left;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:var(--r);padding:8px 10px;cursor:pointer}
.cbdlg .sug button:hover{border-color:var(--gold)}
.cbdlg .pc{border:1px solid var(--gold);background:var(--gold-soft);border-radius:var(--r);padding:8px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:14px}
.cbdlg .pc .sp{flex:1 1 auto}
.cbdlg .ph{display:flex;gap:10px;align-items:center;flex-wrap:wrap} .cbdlg .ph img{width:64px;height:64px;object-fit:cover;border-radius:var(--r);border:1px solid var(--line)}
.cbdlg .hist{font-size:12px;color:var(--muted);max-height:110px;overflow:auto;border-top:1px solid var(--line);padding-top:6px}
.cbdlg textarea{font:inherit;font-size:15px;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:var(--r);padding:8px 10px;width:100%;min-height:180px}
@media (max-width:1100px){#p-g2g .cbkpi{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:700px){#p-g2g .cbkpi{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}#p-g2g .cbcols{grid-template-columns:minmax(0,1fr)}#p-g2g .cblist{max-height:none;min-height:0}
 #p-g2g .cbr{grid-template-columns:minmax(0,1fr) 80px 80px;padding:7px 8px}#p-g2g .cbt .v{font-size:19px}
 #p-g2g .cbbar>.big,#p-g2g .cbbar>select{flex:1 1 40%} #p-g2g .cbbar>.sp{display:none} #p-g2g .cbr .a{font-size:13px} #p-g2g .cbr .a.nc{white-space:normal}.cbov{padding:8px}.cbdlg{margin-top:0;padding:12px}#p-g2g table.cbm th,#p-g2g table.cbm td{padding:6px 4px;font-size:13px}
#p-g2g .crbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center} #p-g2g .crbar select,#p-g2g .crbar input{width:auto}
#p-g2g .list{max-height:60vh;overflow:auto} #p-g2g td,#p-g2g th{padding:5px 8px}
@media (max-width:700px){#p-g2g .cbkpi{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}.cbov{padding:8px}.cbdlg{margin-top:0;padding:12px}}`; document.head.appendChild(s); }
  let ovKey = null;
  function overlay(html) { close(); const ov = el("div", { className: "cbov", id: "cbOv" }), d = el("div", { className: "cbdlg" }); d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.innerHTML = html; ov.append(d);
    ov.addEventListener("click", e => { if (e.target === ov) close(); }); ovKey = e => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", ovKey); document.body.append(ov); return d; }
  function close() { const o = $("cbOv"); if (o) o.remove(); if (ovKey) document.removeEventListener("keydown", ovKey); ovKey = null; }
  function build() {
    const nav = document.querySelector("nav"); if (!nav || $("t-g2g")) return; style();
    const b = el("button", { id: "t-g2g", textContent: "Party accounts (gold)" }); b.setAttribute("role", "tab"); b.dataset.tab = "g2g"; b.setAttribute("aria-selected", "false");
    const tl = $("t-ledger"); nav.insertBefore(b, tl ? tl.nextSibling : nav.querySelector('[data-tab="rates"]'));
    const sec = el("section", { id: "p-g2g", className: "card", hidden: true }); sec.append(el("h2", { textContent: "Sundry debtors - party accounts (fine gold + ₹)" }));
    const pl = $("p-ledger"); (pl || $("p-rates")).parentNode.insertBefore(sec, pl ? pl.nextSibling : $("p-rates"));
    nav.addEventListener("click", e => { const x = e.target.closest("button[data-tab]"); if (!x) return; const on = x.dataset.tab === "g2g"; sec.hidden = !on;
      if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); nav.querySelectorAll("button").forEach(y => y.setAttribute("aria-selected", y === x ? "true" : "false")); if ($("dbBox")) debtLoad(); else debtInit(sec); } }); }
  // ---------- RECONCILE a party (Abhinav only - the server checks /api/vj/recon) ----------
  async function reconDlg(kind, key, name, done) {
    const d = overlay(`<div class="hd"><h2>Reconcile - ${name}</h2></div><div class="row"><label>Reconcile up to <input id="rqD" type="date"></label></div><p class="hint" id="rqB">Pick the date to see the balance as on that day.</p>
      <div class="row" id="rqT" hidden><label>Rupee difference is <select id="rqTy"><option value="">Choose…</option><option value="dgiven">Discount given (to party)</option><option value="drecv">Discount received (from party)</option><option value="profit">Extra profit / Rounded off</option></select></label>
        <label id="rqFl">Fine difference is <select id="rqFt"><option value="">Choose…</option><option value="wo">Fine difference written off</option><option value="gain">Fine difference gained</option></select></label></div>
      <div class="actions"><button type="button" class="btn" id="rqOk" disabled>Reconcile</button><button type="button" class="btn ghost" id="rqX">Cancel</button></div><p class="hint" id="rqM">One adjusting entry dated that day brings the balance to 0 ₹ and 0 g. Older entries are then hidden (kept; 'Show reconciled history'; Undo last).</p>`);
    let P = null; $("rqD").max = today(); $("rqX").addEventListener("click", close);
    $("rqD").addEventListener("change", async () => { P = null; $("rqOk").disabled = true; try { P = await api("/api/vj/recon?kind=" + kind + "&key=" + encodeURIComponent(key) + "&upto=" + $("rqD").value);
        $("rqB").textContent = `Balance as on ${dmy(P.upto)}: ${inr(P.rs)}${P.fine ? " · " + Number(P.fine).toFixed(3) + " g fine" : ""}${kind === "cust" ? " (party owes us; minus = we owe)" : " (we owe; minus = they owe us)"}`;
        $("rqT").hidden = !(P.rs || P.fine); $("rqTy").parentNode.hidden = !P.rs; $("rqFl").hidden = !P.fine; $("rqOk").disabled = false; } catch (e) { $("rqB").textContent = e.message || String(e); } });
    $("rqOk").addEventListener("click", async () => { if (!P) return; const ty = $("rqTy").value, ft = $("rqFt").value; if (P.rs && !ty) { $("rqM").textContent = "Choose what the rupee difference is."; return; } if (P.fine && !ft) { $("rqM").textContent = "Choose what the fine difference is."; return; }
      if (!confirm(`Post ONE entry dated ${dmy(P.upto)}: ${inr(Math.abs(P.rs))}${P.rs ? " " + $("rqTy").selectedOptions[0].textContent : ""}${P.fine ? " and " + Math.abs(P.fine).toFixed(3) + " g " + $("rqFt").selectedOptions[0].textContent : ""} - balance as on ${dmy(P.upto)} becomes 0. OK?`)) return;
      try { await api("/api/vj/recon", { op: "do", kind, key, upto: P.upto, type: ty, ftype: ft, expect: { rs: P.rs, fine: P.fine } }); close(); if (done) done(); } catch (e) { $("rqM").textContent = "Not done (" + (e.message || e) + ")."; } }); void d; }
  window.vjRecon = reconDlg;
  window.vjReconUndo = async (kind, key, done) => { if (!confirm("Undo the last reconcile of this party? Its adjusting entry goes and the hidden entries come back.")) return; try { await api("/api/vj/recon", { op: "undo", kind, key }); if (done) done(); } catch (e) { alert("Not undone (" + (e.message || e) + ")."); } };
  // ---------- PARTY GOLD ACCOUNTS (owner 04/11 16:40, C-20261104-G2GACCOUNT): his Excel CUSTOMERS ACCOUNT + GrpSum, Abhinav / Shilpiji only ----------
  const g3 = n => (Number(n) || 0).toFixed(3), fineLab = f => f > 0 ? g3(f) + " g लेना" : f < 0 ? g3(-f) + " g जमा" : "0.000 g";
  async function debtInit(sec) {
    const box = el("div", { id: "dbBox", style: "display:flex;flex-direction:column;gap:8px;margin-top:10px" }); box.innerHTML = `<div class="crbar"><h3 style="margin:0;flex:1 1 auto">Sundry debtors - party gold accounts</h3>
      <input id="dbQ" placeholder="Name / mobile / city" style="width:170px"><select id="dbF" aria-label="Show"><option value="">All parties</option><option value="lena">₹ लेना</option><option value="jama">₹ जमा (advance)</option><option value="fl">Fine लेना</option><option value="fj">Fine जमा</option></select>
      <select id="dbS" aria-label="Sort"><option value="lena">Sort: ₹ लेना ↓</option><option value="fine">Sort: fine ↓</option><option value="name">Sort: name</option></select>
      <select id="dbX" aria-label="More"><option value="">More…</option><option value="xlsx">Excel (all parties)</option><option value="pdf">PDF (this list)</option><option value="imp">Import opening from Excel</option><option value="fac">Fine factors</option></select></div>
      <div class="cbkpi" id="dbTot" style="grid-template-columns:repeat(4,minmax(0,1fr))"></div>
      <div class="list"><table class="items" style="min-width:0;width:100%"><thead><tr><th>Party</th><th>Type</th><th style="text-align:right">₹ लेना</th><th style="text-align:right">₹ जमा</th><th style="text-align:right">Fine g (− = जमा)</th></tr></thead><tbody id="dbRows"></tbody></table></div><p class="hint" id="dbMsg">Bills, OG register, + Pay receipts and discounts come in by themselves. Tap a party for its account (Excel layout).</p>`;
    sec.append(box); ["dbQ", "dbF", "dbS"].forEach(i => $(i).addEventListener(i === "dbQ" ? "input" : "change", debtRows));
    $("dbX").addEventListener("change", () => { const v = $("dbX").value; $("dbX").value = ""; if (v === "xlsx") g2Xlsx(); if (v === "pdf") g2ListPdf(); if (v === "imp") g2Import(); if (v === "fac") g2Fac(); });
    debtLoad(); }
  async function debtLoad() { try { CR.d = await api("/api/vj/g2g"); debtRows(); } catch (e) { $("dbMsg").textContent = "Could not load party accounts (" + (e.message || e) + ")."; } }
  function g2Rows() { const j = CR.d, q = $("dbQ").value.trim().toLowerCase(), f = $("dbF").value, s = $("dbS").value;
    return j.parties.filter(p => (!q || [p.name, p.city, p.mobile].join(" ").toLowerCase().includes(q)) && (!f || (f === "lena" ? p.lena > 0 : f === "jama" ? p.jama > 0 : f === "fl" ? p.fine > 0 : p.fine < 0)))
      .sort((a, b) => s === "name" ? a.name.localeCompare(b.name) : s === "fine" ? b.fine - a.fine : b.lena - a.lena || b.jama - a.jama); }
  function debtRows() { const j = CR.d; if (!j) return; const t = j.tot, tb = $("dbRows"); tb.textContent = "";
    const T = $("dbTot"); T.textContent = ""; [["₹ लेना", inr(t.lena)], ["₹ जमा (advance)", inr(t.jama)], ["Fine लेना", g3(t.fineL) + " g"], ["Fine जमा", g3(t.fineJ) + " g"]].forEach(([l, v]) => T.append(el("div", { className: "cbt" }, [el("div", { className: "l", textContent: l }), el("div", { className: "v", textContent: v, style: "font-size:18px" })])));
    g2Rows().forEach(p => { const tr = el("tr", { style: "cursor:pointer" }); tr.addEventListener("click", () => g2Open(p.key));
      [[[p.name, p.city, p.mobile].filter(Boolean).join(" · ")], [p.type], [p.lena ? inr(p.lena) : "", 1], [p.jama ? inr(p.jama) : "", 1], [p.fine ? fineLab(p.fine) : "", 1]].forEach(([v, r]) => tr.append(el("td", { textContent: v, style: r ? "text-align:right;font-variant-numeric:tabular-nums" : "" }))); tb.append(tr); });
    if (!tb.children.length) tb.append(el("tr", null, [el("td", { textContent: "No party for this filter.", colSpan: 5 })])); }
  // one party's account, Excel layout: header row, bill lines, Total, credits (OP / OG / receipts / Gold to Cash), Total, Balance
  async function g2Open(key, keepScroll) { let a; try { a = await api("/api/vj/g2g?key=" + encodeURIComponent(key)); } catch (e) { $("dbMsg").textContent = "Could not open (" + (e.message || e) + ")."; return; } g2Draw(a); }
  function g2Draw(a) { CR.a = a;
    const d = overlay(`<div class="hd"><h2>${a.name}${a.city ? " · " + a.city : ""}${a.mobile ? " · " + a.mobile : ""}</h2></div>
      <div class="cbbar" style="gap:10px"><label style="flex-direction:row;align-items:center;gap:6px">Type <select id="gaT"></select></label><span class="pc" id="gaH" style="flex:1 1 auto"></span></div>
      <div class="tblw"><table class="cbm" id="gaTbl"></table></div>
      <div class="actions"><button type="button" class="btn ghost" id="gaAdd">+ Bill line</button><button type="button" class="btn ghost" id="gaGtc">+ Gold to Cash</button><label style="flex-direction:row;align-items:center;gap:6px">Booked rate <input id="gaR" inputmode="numeric" style="width:100px"></label>
        <button type="button" class="btn ghost" id="gaPdf">PDF</button><button type="button" class="btn ghost" id="gaX">Close</button></div><p class="hint" id="gaM">Fine and Amount cells can be changed (type, then leave the box). Empty box = back to the bill / factor figure.</p>`); d.classList.add("wide");
    opts($("gaT"), a.types.map(t => [t, t]), a.type); $("gaR").value = a.bookedRate || ""; $("gaR").placeholder = "today " + (a.todayRate || "-");
    $("gaH").textContent = `${a.type} · Over due by ${fineLab(a.bal.fine)} · ₹ ${a.bal.amount >= 0 ? "लेना " + Math.abs(a.bal.amount).toLocaleString("en-IN") : "जमा " + Math.abs(a.bal.amount).toLocaleString("en-IN")} · GST ₹ ${a.bal.gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const T = $("gaTbl"), hd = ["B No", "Code", "Gr Wt", "Tunch", "Fine", "Diamonds", "CS", "Making", "Amount", "GST", "Total"], tr = (cells, cls) => { const r = el("tr", { className: cls || "" }); cells.forEach((c, i) => { const td = el(i ? "td" : "td"); if (c instanceof Node) td.append(c); else td.textContent = c == null ? "" : c; if (i < 2) td.style.textAlign = "left"; r.append(td); }); T.append(r); return r; };
    const th = el("tr"); hd.forEach(h => th.append(el("th", { textContent: h }))); T.append(el("thead", null, [th]));
    const edit = (x, k, val, dec) => { const i = el("input", { value: val == null ? "" : String(val), inputMode: "decimal", style: "width:" + (dec ? 78 : 90) + "px" + ((k === "fine" ? x.fineAuto : x.amtAuto) === false ? ";border-color:var(--gold)" : "") });
      i.addEventListener("change", () => g2Post(x.src === "man" ? { op: "man", id: x.id, date: x.date, bill: x.bill, code: x.code, grWt: x.grWt, kt: x.kt, fine: k === "fine" ? i.value : x.fine, amount: k === "amount" ? i.value : x.amount, dia: x.dia, cs: x.cs, mk: x.mk } : { op: "ov", id: x.id, [k]: i.value.trim() })); return i; };
    a.dr.forEach(x => { const r = tr([x.bill || "", x.code, x.grWt ? g3(x.grWt) : "", x.kt || "", edit(x, "fine", g3(x.fine), 1), x.dia ? inr(x.dia) : "", x.cs ? inr(x.cs) : "", x.mk ? inr(x.mk) : "", edit(x, "amount", x.amount), x.gst.toFixed(2), x.total.toFixed(2)]);
      if (x.src === "man") { const del = btn("×", "ghost", () => { if (confirm("Remove this line? (kept, can be restored)")) g2Post({ op: "mandel", id: x.id }); }); del.style.padding = "2px 8px"; r.lastChild.append(" ", del); } });
    tr(["Total", "", "", "", g3(a.drT.fine), "", "", "", inr(a.drT.amount), a.drT.gst.toFixed(2), a.drT.total.toFixed(2)], "tt");
    tr(["", "", "", "", "", "", "", "", "", "", ""]);
    a.cr.forEach(x => { const r = tr([x.label, x.src === "gtc" ? "@ " + x.rate : x.date ? dmy(x.date) : "", "", "", x.fine ? g3(x.fine) : "", "", "", "", x.amount ? inr(x.amount) : "", "", ""]);
      if (x.src === "gtc") { const e = btn("Edit", "ghost", () => g2Gtc(x)); e.style.padding = "2px 8px"; r.lastChild.append(e); } });
    tr(["Total", "", "", "", g3(a.crT.fine), "", "", "", inr(a.crT.amount), "", ""], "tt");
    const b = tr(["Balance", a.bal.fine > 0 ? "लेना" : a.bal.fine < 0 ? "जमा" : "", "", "", g3(a.bal.fine), "", "", "", inr(a.bal.amount), a.bal.gst.toFixed(2), ""], "tt"); b.style.color = a.bal.fine < 0 ? "var(--ok)" : "var(--warn)";
    $("gaT").addEventListener("change", () => g2Post({ op: "type", type: $("gaT").value })); $("gaR").addEventListener("change", () => g2Post({ op: "rate", rate: $("gaR").value.trim() || "0" }));
    $("gaAdd").addEventListener("click", g2Man); $("gaGtc").addEventListener("click", () => g2Gtc(null)); $("gaPdf").addEventListener("click", () => g2Pdf(a)); $("gaX").addEventListener("click", () => { close(); debtLoad(); }); }
  async function g2Post(body) { const a = CR.a; try { const r = await api("/api/vj/g2g", Object.assign({ key: a.key }, body)); g2Draw(r); } catch (e) { const m = $("gaM"); if (m) m.textContent = "Not saved (" + (e.message || e) + ")."; } }
  function g2Man() { const a = CR.a, box = $("gaM"); box.textContent = ""; const f = el("div", { className: "row" });
    const I = (ph, w) => el("input", { placeholder: ph, style: "width:" + w + "px", inputMode: ph === "B No" || ph === "Code" ? "text" : "decimal" }), bn = I("B No", 90), cd = I("Code", 80), gr = I("Gr Wt", 70), kt = el("select"), fi = I("Fine (blank = factor)", 130), di = I("Diamonds", 90), cs = I("CS", 70), mk = I("Making", 80), am = I("Amount (blank = D+CS+M)", 160);
    opts(kt, [["14", "14K"], ["18", "18K"], ["9", "9K"], ["22", "22K"]]); const ok = btn("Add line", "", () => g2Post({ op: "man", date: today(), bill: bn.value, code: cd.value, grWt: gr.value, kt: kt.value, fine: fi.value, dia: di.value, cs: cs.value, mk: mk.value, amount: am.value }));
    [bn, cd, gr, kt, fi, di, cs, mk, am, ok].forEach(x => f.append(x)); box.append(f); }
  function g2Gtc(x) { const a = CR.a, box = $("gaM"); box.textContent = ""; const f = el("div", { className: "row" }), gm = el("input", { placeholder: "Grams (+ = लेना to ₹)", inputMode: "decimal", style: "width:170px", value: x ? String(x.grams) : a.bal.fine ? g3(a.bal.fine) : "" }),
      rt = el("input", { placeholder: "Rate 24K/g", inputMode: "numeric", style: "width:110px", value: String(x ? x.rate : a.defRate || "") }), dt = el("input", { type: "date", value: x ? x.date : today() });
    f.append(gm, rt, dt, btn(x ? "Save" : "Add Gold to Cash", "", () => g2Post({ op: "gtc", id: x ? x.id : undefined, grams: gm.value, rate: rt.value, date: dt.value })));
    if (x) f.append(btn("Remove", "ghost", () => { if (confirm("Remove this Gold to Cash line? (kept, can be restored)")) g2Post({ op: "gtcdel", id: x.id }); }));
    box.append(f, el("div", { className: "hint", textContent: "Rate default = higher of the party's booked rate and today's 24K rate (" + (a.todayRate || "-") + "). The line stays open - change it any time." })); }
  async function g2Xlsx() { try { const r = await fetch("/api/vj/g2g.xlsx", { credentials: "same-origin" }); if (!r.ok) throw new Error(r.status); const u = URL.createObjectURL(await r.blob()), l = el("a", { href: u, download: "VJ_Party_Gold_Accounts.xlsx" }); document.body.append(l); l.click(); setTimeout(() => { URL.revokeObjectURL(u); l.remove(); }, 3000); } catch (e) { $("dbMsg").textContent = "Excel not made (" + (e.message || e) + ")."; } }
  const pdfOk = () => { if (!window.jspdf) { alert("PDF maker not loaded - reload the page."); return null; } return new window.jspdf.jsPDF({ unit: "mm", format: "a4" }); };
  const num0 = n => Math.round(Number(n) || 0).toLocaleString("en-IN");
  function g2ListPdf() { const doc = pdfOk(); if (!doc) return; const t = CR.d.tot; let y = 16; const P = (s, x, b, al) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(9); doc.text(String(s), x, y, al ? { align: al } : undefined); };
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Party accounts - " + dmy(today()), 14, y); y += 8;
    P("Total", 14, 1); P("Rs " + num0(t.lena), 140, 1, "right"); P("Rs " + num0(t.jama), 168, 1, "right"); P((t.fineL - t.fineJ).toFixed(3), 196, 1, "right"); y += 5;
    P("Party", 14, 1); P("Rs lena", 140, 1, "right"); P("Rs jama", 168, 1, "right"); P("Fine g (- = jama)", 196, 1, "right"); y += 5;
    g2Rows().forEach(p => { P([p.name, p.city, p.mobile].filter(Boolean).join(" ").slice(0, 60), 14); P(p.lena ? num0(p.lena) : "", 140, 0, "right"); P(p.jama ? num0(p.jama) : "", 168, 0, "right"); P(p.fine ? p.fine.toFixed(3) : "", 196, 0, "right"); y += 5; if (y > 285) { doc.addPage(); y = 16; } });
    doc.save("VJ_Party_Accounts.pdf"); }
  function g2Pdf(a) { const doc = pdfOk(); if (!doc) return; let y = 14; const X = [10, 30, 52, 66, 80, 100, 118, 136, 158, 176, 200], P = (s, i, b) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(8); doc.text(String(s == null ? "" : s), X[i], y, i > 1 ? { align: "right" } : undefined); };
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text([a.name, a.city, a.mobile].filter(Boolean).join("  "), 10, y); y += 6;
    doc.setFontSize(9); doc.text(a.type + "   Over due by " + a.bal.fine.toFixed(3) + " g   Amount " + num0(a.bal.amount) + "   GST " + a.bal.gst.toFixed(2), 10, y); y += 7;
    ["B No", "Code", "Gr Wt", "Tunch", "Fine", "Diamonds", "CS", "Making", "Amount", "GST", "Total"].forEach((h, i) => P(h, i, 1)); y += 5;
    const row = (c, b) => { c.forEach((v, i) => P(v, i, b)); y += 5; if (y > 285) { doc.addPage(); y = 14; } };
    a.dr.forEach(x => row([x.bill, x.code, x.grWt ? x.grWt.toFixed(3) : "", x.kt || "", x.fine.toFixed(3), x.dia ? num0(x.dia) : "", x.cs ? num0(x.cs) : "", x.mk ? num0(x.mk) : "", num0(x.amount), x.gst.toFixed(2), x.total.toFixed(2)]));
    row(["Total", "", "", "", a.drT.fine.toFixed(3), "", "", "", num0(a.drT.amount), a.drT.gst.toFixed(2), a.drT.total.toFixed(2)], 1); y += 3;
    a.cr.forEach(x => row([x.label.slice(0, 40), x.src === "gtc" ? "@ " + x.rate : "", "", "", x.fine ? x.fine.toFixed(3) : "", "", "", "", x.amount ? num0(x.amount) : "", "", ""]));
    row(["Total", "", "", "", a.crT.fine.toFixed(3), "", "", "", num0(a.crT.amount), "", ""], 1);
    row(["Balance", a.bal.fine > 0 ? "lena" : a.bal.fine < 0 ? "jama" : "", "", "", a.bal.fine.toFixed(3), "", "", "", num0(a.bal.amount), a.bal.gst.toFixed(2), ""], 1);
    doc.save("VJ_Account_" + a.name.replace(/[^A-Za-z0-9_]+/g, "_") + ".pdf"); }
  function g2Import() { const d = overlay(`<div class="hd"><h2>Import opening balances from Excel</h2></div>
      <p class="hint">In his Composite / GrpSum sheet select the rows (Party · ₹ लेना · ₹ जमा · Fine) and paste below (Ctrl+V). Name with mobile matches the party by mobile; else by name. Written as the party's opening (₹ + fine) on the date below; locked once the first month is closed.</p>
      <div class="row"><label>Opening date <input id="giD" type="date"></label></div><textarea id="giT" placeholder="Prachi Vrindavan 9639645505	500		-16.805"></textarea>
      <div class="actions"><button type="button" class="btn ghost" id="giC">Check</button><button type="button" class="btn" id="giOk" disabled>Import</button><button type="button" class="btn ghost" id="giX">Cancel</button></div><p class="hint" id="giM"></p>`);
    $("giD").value = (CR.d && CR.d.goLive) || today(); let rows = [];
    $("giC").addEventListener("click", () => { rows = $("giT").value.split(String.fromCharCode(10)).map(l => l.replace(String.fromCharCode(13), "").split(String.fromCharCode(9))).filter(c => c[0] && c[0].trim()).map(c => ({ name: c[0].trim(), lena: (c[1] || "").trim(), jama: (c[2] || "").trim(), fine: (c[3] || "").trim() }));
      const bad = rows.filter(r => [r.lena, r.jama, r.fine].some(v => v && isNaN(Number(v.replace(/,/g, "")))));
      $("giM").textContent = rows.length + " rows" + (bad.length ? " - " + bad.length + " with unreadable numbers: " + bad.slice(0, 3).map(r => r.name).join(", ") : " - looks fine. Press Import."); $("giOk").disabled = !rows.length; });
    $("giOk").addEventListener("click", async () => { if (!confirm("Write these " + rows.length + " openings? (the old openings are kept in history)")) return; try { const r = await api("/api/vj/g2g", { op: "import", date: $("giD").value, rows }); close(); $("dbMsg").textContent = `Imported: ${r.matched} matched, ${r.added} new${r.skipped.length ? ", skipped " + r.skipped.length : ""}.`; debtLoad(); } catch (e) { $("giM").textContent = "Not imported (" + (e.message || e) + ")."; } });
    $("giX").addEventListener("click", close); void d; }
  function g2Fac() { const c = (CR.d && CR.d.cfg) || {}; const d = overlay(`<div class="hd"><h2>Fine factors</h2></div><div class="tblw"><table class="cbm" id="gfT"></table></div><div class="actions"><button type="button" class="btn" id="gfOk">Save</button><button type="button" class="btn ghost" id="gfX">Cancel</button></div><p class="hint" id="gfM">Fine = gross gold wt × factor. Gold type = fine typed (no factor).</p>`);
    const T = $("gfT"), hr = el("tr"); ["", "18K", "14K", "9K"].forEach(h => hr.append(el("th", { textContent: h }))); T.append(hr);
    [["ws", "W/s (wastage)"], ["nett", "Nett"]].forEach(([k, l]) => { const r = el("tr"); r.append(el("td", { textContent: l })); [18, 14, 9].forEach(x => { const td = el("td"); td.append(el("input", { value: String((c[k] || {})[x] || ""), className: "gf", style: "width:80px" })); td.firstChild.dataset.k = k; td.firstChild.dataset.x = x; r.append(td); }); T.append(r); });
    $("gfOk").addEventListener("click", async () => { const b = { op: "cfg", ws: {}, nett: {} }; T.querySelectorAll(".gf").forEach(i => { b[i.dataset.k][i.dataset.x] = i.value.trim(); }); try { await api("/api/vj/g2g", b); close(); debtLoad(); } catch (e) { $("gfM").textContent = "Not saved (" + (e.message || e) + ")."; } });
    $("gfX").addEventListener("click", close); void d; }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
