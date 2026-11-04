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
/*@G2*/
