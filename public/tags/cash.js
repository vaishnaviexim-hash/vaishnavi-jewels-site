/* VJ Tags cash book - C-20261104-CASHBOOK */
/* VJ Tags - Cash book (owner Abhinav 04/11/2026 14:27, C-20261104-CASHBOOK).
   Loaded by shim.js only when the server says me.cash (Abhinav, Shilpiji, staff, office login); the server checks every call again.
   Day view: opening cash (carried from the day before) + cash received - cash paid = closing; UPI / Bank in their own column (not cash in hand).
   Month view, PDF (made here with jsPDF) and Excel (server). '+ Receipt' saves through the SAME /api/vj/receipt as the bill '+ Pay' and the Ledger,
   so bills and party ledgers update; receipts made there show here by themselves. '+ Expense' -> /api/vj/cash. Only Abhinav / Shilpiji edit,
   delete (with a reason) and restore - the server decides. Voice (mic button): the browser's own speech-to-text, simple rules fill the form,
   one small server call only when the rules miss the category or the amount; the form is ALWAYS shown to check - nothing saves by itself. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const inr = n => "₹ " + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const rs = n => "Rs " + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const el = (tag, props, kids) => { const e = document.createElement(tag); if (props) Object.assign(e, props); (kids || []).forEach(k => k != null && e.append(k)); return e; };
  const btn = (text, cls, fn) => { const b = el("button", { type: "button", className: "btn" + (cls ? " " + cls : ""), textContent: text }); if (fn) b.addEventListener("click", fn); return b; };
  const MODES = [["cash", "Cash"], ["upi", "UPI"], ["bank", "Bank (NEFT/RTGS)"]]; // owner rule: Cash, UPI, Bank only - no cards
  const C = { j: null, view: "day", rc: null, ex: null, photo: "", busy: false, hist: false };
  async function api(path, body) {
    const r = await fetch(path, body ? { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { credentials: "same-origin", cache: "no-store" });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status)); return j;
  }
  const opts = (sel, list, val) => { sel.textContent = ""; list.forEach(([v, l]) => sel.append(el("option", { value: v, textContent: l }))); if (val != null) sel.value = val; };

  function style() {
    const s = el("style"); s.textContent = `
#p-cash .cbbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#p-cash .cbbar select,#p-cash .cbbar input{width:auto;min-width:0}
#p-cash .cbbar .sp{flex:1 1 0}
#p-cash .cbkpi{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
#p-cash button.cbt{font:inherit;text-align:left;cursor:pointer;color:var(--fg)} #p-cash .cbt.bp .v{color:var(--warn);font-size:18px} #p-cash .cbt.bp:hover{border-color:var(--warn)}
#p-cash .cbt{border:1px solid var(--line);border-radius:var(--r);padding:8px 12px;background:var(--bg);min-width:0}
#p-cash .cbt .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
#p-cash .cbt .v{font-family:var(--f-mono);font-size:22px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#p-cash .cbt.in .v{color:var(--ok)} #p-cash .cbt.out .v{color:var(--bad)}
#p-cash .cbt.cl{background:var(--gold-soft);border-color:var(--gold)} #p-cash .cbt.cl .v{color:var(--gold)}
#p-cash .cbnc{font-size:13px;color:var(--muted);margin:0}
#p-cash .cbcols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
#p-cash .cbcol{display:flex;flex-direction:column;gap:6px;min-width:0}
#p-cash .cblist{max-height:calc(100vh - 400px);min-height:140px;overflow:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
#p-cash .cbr{display:grid;grid-template-columns:minmax(0,1fr) 96px 96px;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line);align-items:center;font-size:14px}
#p-cash .cbr.h{position:sticky;top:0;background:var(--sunk);font-size:12px;color:var(--muted);font-weight:600;z-index:1}
#p-cash .cbr.t{position:sticky;bottom:0;background:var(--sunk);font-weight:600;border-bottom:0}
#p-cash .cbr .a{font-family:var(--f-mono);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
#p-cash .cbr .a.nc{color:var(--muted)}
#p-cash .cbr .n{min-width:0} #p-cash .cbr .n b{font-weight:600}
#p-cash .cbr .s{display:block;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#p-cash .cbr.k{cursor:pointer} #p-cash .cbr.k:hover{background:var(--sunk)}
#p-cash .cbr .w{color:var(--warn);font-weight:600}
#p-cash .cbtk{display:flex;flex-direction:row;align-items:center;gap:5px;font-size:12px;color:var(--warn);cursor:pointer;margin-top:2px}
#p-cash .cbtk.on{color:var(--ok)} #p-cash .cbtk input{width:18px;height:18px;margin:0}
#p-cash .cbhold{display:flex;flex-wrap:wrap;gap:8px} #p-cash .cbhold:empty{display:none}
#p-cash .cbhold button{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:999px;padding:6px 12px;cursor:pointer;font-variant-numeric:tabular-nums}
#p-cash .cbhold button b{font-family:var(--f-mono)} #p-cash .cbhold button.w{border-color:var(--warn);color:var(--warn)} #p-cash .cbhold .tot{border-color:var(--gold);background:var(--gold-soft)}
.cbdlg.wide{width:min(1100px,100%)} .cbdlg table.cbm{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums} .cbdlg table.cbm td,.cbdlg table.cbm th{padding:5px 6px;border-bottom:1px solid var(--line);text-align:right} .cbdlg table.cbm td:first-child,.cbdlg table.cbm th:first-child{text-align:left}
.cbdlg table.cbm input{width:120px;text-align:right;padding:5px 6px} .cbdlg .tblw{max-height:60vh;overflow:auto;border:1px solid var(--line);border-radius:var(--r)}
#p-cash .cbempty{padding:14px 10px;color:var(--muted);font-size:13px}
#p-cash table.cbm{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
#p-cash table.cbm th,#p-cash table.cbm td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
#p-cash table.cbm th:first-child,#p-cash table.cbm td:first-child{text-align:left}
#p-cash table.cbm th{background:var(--sunk);font-size:12px;color:var(--muted);position:sticky;top:0}
#p-cash table.cbm tr.d{cursor:pointer} #p-cash table.cbm tr.d:hover{background:var(--sunk)} #p-cash table.cbm tr.tt td{font-weight:600;background:var(--sunk)}
#crBox .crbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center} #crBox .crbar select{width:auto} #crBox .list{max-height:52vh;overflow:auto}
#crBox td,#crBox th{padding:5px 8px} #crBox td .btn{padding:4px 10px;font-size:13px}
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
@media (max-width:1100px){#p-cash .cbkpi{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:700px){#p-cash .cbkpi{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}#p-cash .cbcols{grid-template-columns:minmax(0,1fr)}#p-cash .cblist{max-height:none;min-height:0}
 #p-cash .cbr{grid-template-columns:minmax(0,1fr) 80px 80px;padding:7px 8px}#p-cash .cbt .v{font-size:19px}
 #p-cash .cbbar>.big,#p-cash .cbbar>select{flex:1 1 40%} #p-cash .cbbar>.sp{display:none} #p-cash .cbr .a{font-size:13px} #p-cash .cbr .a.nc{white-space:normal}.cbov{padding:8px}.cbdlg{margin-top:0;padding:12px}#p-cash table.cbm th,#p-cash table.cbm td{padding:6px 4px;font-size:13px}
 #p-cash .cbm .hm{display:none}}`;
    document.head.appendChild(s);
  }

  function build() {
    const nav = document.querySelector("nav"); if (!nav || $("t-cash")) return;
    style();
    const b = el("button", { id: "t-cash", textContent: "Cash book" }); b.setAttribute("role", "tab"); b.dataset.tab = "cash"; b.setAttribute("aria-selected", "false");
    const tl = $("t-ledger"); nav.insertBefore(b, tl ? tl.nextSibling : nav.querySelector('[data-tab="rates"]'));
    const sec = el("section", { id: "p-cash", className: "card", hidden: true });
    sec.innerHTML = `
      <div class="cbbar">
        <select id="cbView" aria-label="View"><option value="day">Day</option><option value="book">Day book</option><option value="month">Month</option><option value="reg">Receipt register</option></select>
        <input id="cbDate" type="date" aria-label="Date"><input id="cbMonth" type="month" aria-label="Month" hidden>
        <button type="button" class="btn big" id="cbRcB">+ Receipt</button><button type="button" class="btn big" id="cbExB">+ Expense</button>
        <select id="cbMore" aria-label="More entries"><option value="">More…</option></select>
        <span class="sp"></span>
        <select id="cbOut" aria-label="Export"><option value="">Export…</option><option value="pdf">PDF (this view)</option><option value="xlsx">Excel (month)</option></select>
        <button type="button" class="btn ghost" id="cbSetB" hidden>Settings</button>
      </div>
      <p class="banner warn" id="cbWarn" hidden></p>
      <div class="cbkpi">
        <div class="cbt"><div class="l">Opening cash</div><div class="v" id="cbO">—</div></div>
        <div class="cbt in"><div class="l">+ Cash received</div><div class="v" id="cbI">—</div></div>
        <div class="cbt out"><div class="l">− Cash expenses</div><div class="v" id="cbP">—</div></div>
        <div class="cbt out"><div class="l">− Handed to owner</div><div class="v" id="cbH">—</div></div>
        <div class="cbt cl"><div class="l">= Closing cash in hand</div><div class="v" id="cbC">—</div></div>
        <button type="button" class="cbt bp" id="cbBP"><div class="l">Bank pending</div><div class="v" id="cbB">—</div></button>
      </div>
      <p class="cbnc" id="cbNC"></p>
      <div class="cbhold" id="cbHold"></div>
      <div class="cblist" id="cbBook" hidden></div>
      <div class="cbcols" id="cbDay">
        <div class="cbcol"><h2>Received</h2><div class="cblist" id="cbInL"></div></div>
        <div class="cbcol"><div style="display:flex;gap:8px;align-items:center"><h2 style="flex:1 1 auto">Paid / expenses</h2><input id="cbSrch" placeholder="Search narration" aria-label="Search narration" style="width:180px;padding:4px 8px;font-size:13px"></div><div class="cblist" id="cbOutL"></div><div id="cbDel"></div></div>
      </div>
      <div class="cblist" id="cbMon" hidden></div>
      <div id="cbReg" hidden style="display:flex;flex-direction:column;gap:8px">
        <div class="cbbar"><input id="crgQ" autocomplete="off" maxlength="40" placeholder="Party name / mobile / bill no." aria-label="Party" style="flex:1 1 200px">
          <select id="crgMode" aria-label="Mode"><option value="">All modes</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option></select>
          <select id="crgSt" aria-label="Status"><option value="">All</option><option value="pend">Not yet verified / handed</option><option value="bank">Bank pending</option><option value="ok">Verified / handed over</option></select></div>
        <div class="cblist" id="crgL"></div></div>
      <p class="hint" id="cbMsg"></p>`;
    const pl = $("p-ledger"), pb = $("p-bill"), at = pl || pb; (at || $("p-rates")).parentNode.insertBefore(sec, at ? at.nextSibling : $("p-rates"));
    nav.addEventListener("click", e => { const x = e.target.closest("button[data-tab]"); if (!x) return; const on = x.dataset.tab === "cash"; sec.hidden = !on;
      if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); nav.querySelectorAll("button").forEach(y => y.setAttribute("aria-selected", y === x ? "true" : "false")); load(); } });
    $("cbDate").value = today(); $("cbMonth").value = today().slice(0, 7);
    $("cbView").addEventListener("change", () => { C.view = $("cbView").value; const dv = C.view === "day" || C.view === "book"; $("cbDate").hidden = !dv; $("cbMonth").hidden = dv; if (!dv) $("cbMonth").value = $("cbDate").value.slice(0, 7); load(); });
    let rt = null; $("crgQ").addEventListener("input", () => { clearTimeout(rt); rt = setTimeout(load, 350); }); $("crgMode").addEventListener("change", load); $("crgSt").addEventListener("change", load);
    $("cbDate").addEventListener("change", load); $("cbMonth").addEventListener("change", load);
    $("cbRcB").addEventListener("click", () => openReceipt()); $("cbExB").addEventListener("click", () => openExpense(null));
    $("cbSetB").addEventListener("click", openSettings);
    $("cbBP").addEventListener("click", () => { $("cbView").value = "reg"; C.view = "reg"; $("cbDate").hidden = true; $("cbMonth").hidden = false; $("cbMonth").value = ""; $("crgMode").value = ""; $("crgSt").value = "bank"; load(); });
    $("cbMore").addEventListener("change", () => { const v = $("cbMore").value; $("cbMore").value = ""; if (v === "give" || v === "ret") openMove(v); if (v === "cpay" || v === "cbill") openCred(v); if (v === "open") openOpening(); if (v === "close") closeMonth(); if (v === "count") cashCount("store"); if (v === "hist") { C.hist = !C.hist; load(); } });
    $("cbSrch").addEventListener("input", () => render());
    $("cbOut").addEventListener("change", () => { const v = $("cbOut").value; $("cbOut").value = ""; if (v === "pdf") pdf(); if (v === "xlsx") excel(); });
  }

  // ---------- view ----------
  async function load() {
    const m = $("cbMsg"), keep = m.textContent; m.textContent = "Loading…";
    try {
      const q = C.view === "reg" ? "reg=1&month=" + encodeURIComponent($("cbMonth").value || "") + "&q=" + encodeURIComponent($("crgQ").value.trim()) + "&mode=" + encodeURIComponent($("crgMode").value) + "&st=" + encodeURIComponent($("crgSt").value)
        : C.view === "month" ? "month=" + encodeURIComponent($("cbMonth").value || today().slice(0, 7)) : "date=" + encodeURIComponent($("cbDate").value || today());
      C.j = await api("/api/vj/cash?" + q + (C.hist ? "&hist=1" : "")); m.textContent = keep === "Loading…" ? "" : keep; render();
    } catch (e) { m.textContent = "Could not load the cash book (" + (e.message || e) + ")."; }
  }
  const KL = { day: ["Opening cash in hand", "+ Cash received", "− Cash expenses", "− Handed to owner", "= Closing cash in hand", "Bank pending"], reg: ["Receipts total", "Cash", "UPI / Bank", "Cash not handed over", "UPI / Bank not verified", "Bank pending (all)"] };
  function render() {
    const j = C.j; if (!j) return; const kl = KL[j.reg ? "reg" : "day"]; document.querySelectorAll("#p-cash .cbt .l").forEach((x, i) => { x.textContent = kl[i]; }); $("cbSetB").hidden = !j.canEdit;
    const w = []; if (!j.openSet) w.push(j.canEdit ? "Opening balances not set yet - More… > Opening balances (go-live date + cash at store)." : "Opening cash is not set yet (Abhinav / Shilpiji set it) - until then the opening counts as 0.");
    if (j.needLink) w.push(j.needLink + " karigar payment" + (j.needLink === 1 ? "" : "s") + " entered by staff wait" + (j.needLink === 1 ? "s" : "") + " for the karigar account - open it in the day and press Link.");
    $("cbWarn").hidden = !w.length; $("cbWarn").textContent = w.join(" ");
    if (j.toConfirm && j.canEdit) w.push(j.toConfirm + " cash return" + (j.toConfirm === 1 ? "" : "s") + " by staff to confirm - tap the staff name below.");
    $("cbWarn").hidden = !w.length; $("cbWarn").textContent = w.join(" ");
    { const mo = $("cbMore"), l = [["", "More…"]]; if (j.canGive) l.push(["give", "Cash given to staff"]); l.push(["ret", "Cash returned by staff"]);
      if (j.canEdit) l.push(["cpay", "Payment to creditor"], ["cbill", "Creditor bill (we owe more)"], ["open", "Opening balances"], ["close", "Close a month"]);
      if (j.canRecon) l.push(["count", "Cash count / Reconcile"], ["hist", C.hist ? "Hide reconciled history" : "Show reconciled history"]); if (mo.dataset.sig !== l.map(x => x[1]).join("|")) { opts(mo, l, ""); mo.dataset.sig = l.map(x => x[1]).join("|"); } }
    const reg = !!j.reg, month = !reg && !!j.month, book = !reg && !month && C.view === "book"; $("cbDay").hidden = month || reg || book; $("cbBook").hidden = !book; $("cbMon").hidden = !month; $("cbReg").hidden = !reg; $("cbHold").hidden = month || reg;
    $("cbB").textContent = j.pend ? inr(j.pend.bankPend) + " (" + j.pend.nBank + ")" : "—"; $("cbBP").title = "UPI / Bank lines since " + (j.pend ? dmy(j.pend.since) : "") + " not yet checked in the bank - tap for the list";
    if (reg) return renderReg();
    if (month) return renderMonth();
    const t = j.tot, nc = v => v == null ? "—" : inr(v);
    $("cbO").textContent = nc(j.opening); $("cbI").textContent = inr(t.cashIn); $("cbP").textContent = inr(t.cashOut); $("cbH").textContent = inr(t.handed); $("cbC").textContent = nc(j.closing);
    $("cbNC").textContent = j.opening == null ? "This date is before the cash book start (" + dmy(j.openDate) + ")." : `UPI / Bank this day (not cash in hand): received ${inr(t.upiIn + t.bankIn)} · paid ${inr(t.upiOut + t.bankOut)}`;
    holders(j); if (book) renderBook(j);
    const sq = $("cbSrch").value.trim().toLowerCase(), ins = j.lines.filter(e => e.dir === "in" && e.src !== "mv"), outs = j.lines.filter(e => e.dir === "out" && e.src !== "mv" && (!sq || [e.note, e.cat, e.to].join(" ").toLowerCase().includes(sq)));
    list($("cbInL"), ins, e => [e.party || "—", [e.bill || "on account", e.id, e.ref, e.note, e.byName].filter(Boolean).join(" · ")], null);
    list($("cbOutL"), outs, e => [e.src === "hand" ? "Handed to owner · " + (e.party || "") : e.src === "cp" ? "Paid to " + e.to : e.cat + (e.src === "kar" ? " · " + e.to : "") + (e.from && e.from !== "store" ? " · from " + e.from : ""), e.src === "hand" ? ["receipt " + e.id, e.bill, "to " + e.byName].filter(Boolean).join(" · ") : e.src === "kar" ? ["from Karigar account", e.note, e.byName].filter(Boolean).join(" · ") : e.src === "cp" ? [e.note, e.ref, e.byName].filter(Boolean).join(" · ") : [e.note, e.to, e.ref, e.byName].filter(Boolean).join(" · "), e],
      e => e.src === "exp" && (j.canEdit || e.photo) ? () => openExpense(e) : e.src === "cp" && j.canEdit ? () => openCred("cpay", e) : null);
    const dl = $("cbDel"); dl.textContent = "";
    if (j.arch && j.arch.n && !j.hist) dl.append(el("p", { className: "hint", textContent: `Reconciled (archived) entries this day: ${j.arch.n} - cash in ${inr(j.arch.cashIn)}, cash out ${inr(j.arch.cashOut)} (still inside the totals above).` }));
    if (j.deleted && j.deleted.length) { const s = el("select", { "aria-label": "Deleted entries" }); s.append(el("option", { value: "", textContent: "Deleted this day (" + j.deleted.length + ") - restore…" }));
      j.deleted.forEach(d => s.append(el("option", { value: d.id, textContent: `${d.cat} ${rs(d.amount)} ${d.to ? "· " + d.to : ""} (${d.del ? d.del.byName + ": " + d.del.why : ""})` })));
      s.addEventListener("change", async () => { const id = s.value; if (!id) return; if (!confirm("Restore this entry?")) { s.value = ""; return; } try { await api("/api/vj/cash", { op: "restore", id }); $("cbMsg").textContent = "Restored."; load(); } catch (e) { $("cbMsg").textContent = "Not restored (" + (e.message || e) + ")."; s.value = ""; } });
      dl.append(s); }
  }
  function list(box, rows, txt, click) {
    box.textContent = ""; const h = el("div", { className: "cbr h" }, [el("span", { textContent: "Details" }), el("span", { className: "a", textContent: "Cash" }), el("span", { className: "a", textContent: "UPI / Bank" })]); box.append(h);
    if (!rows.length) { box.append(el("div", { className: "cbempty", textContent: "Nothing entered." })); return; }
    let c = 0, n = 0;
    rows.forEach(e => { const [a, b, ex] = txt(e), f = click && click(e), r = el("div", { className: "cbr" + (f ? " k" : "") }), nm = el("span", { className: "n" }), s = el("span", { className: "s", textContent: b });
      nm.append(el("b", { textContent: a }));
      if (ex && ex.needLink) s.prepend(el("span", { className: "w", textContent: "Link to karigar account · " }));
      if (ex && ex.kgone) s.prepend(el("span", { className: "w", textContent: "deleted in karigar account · " }));
      if (ex && ex.photo) s.append(" · 📷"); if (ex && ex.edits) s.append(" · edited");
      nm.append(s); r.append(nm);
      const cash = e.mode === "cash"; if (cash) c += e.amount; else n += e.amount;
      if (e.vk) nm.append(tickEl(e));
      r.append(el("span", { className: "a", textContent: cash ? inr(e.amount) : "" }), el("span", { className: "a nc", textContent: cash ? "" : inr(e.amount) + " " + (e.mode === "upi" ? "UPI" : "Bank") }));
      if (f) { r.tabIndex = 0; r.addEventListener("click", f); r.addEventListener("keydown", k => { if (k.key === "Enter") f(); }); }
      box.append(r); });
    box.append(el("div", { className: "cbr t" }, [el("span", { textContent: "Total (" + rows.length + ")" }), el("span", { className: "a", textContent: inr(c) }), el("span", { className: "a nc", textContent: inr(n) })]));
  }
  // ---------- staff imprest boxes (owner 14:50): Total = store + each staff float ----------
  function holders(j) { const box = $("cbHold"); box.textContent = ""; if (!j.holders || !j.holders.length) return;
    j.holders.forEach(h => { const due = h.entries.filter(e => e.vk === "conf" && !e.tick).reduce((a, e) => a + e.amount, 0), sm = h.sett || {};
      const b = el("button", { type: "button", className: due ? "w" : "" }, h.name === "store" ? ["Cash at store ", el("b", { textContent: inr(h.bal) })] : [h.name + (sm.given ? " · given " + inr(sm.given) : "") + " · with " + (h.bal < 0 ? "us (we owe) " : "him "), el("b", { textContent: inr(Math.abs(h.bal)) }), due ? " · to receive " + inr(due) + " ✓?" : ""]);
      if (h.name !== "store") b.addEventListener("click", () => staffBox(h)); else b.disabled = true; box.append(b); });
    box.append(el("button", { type: "button", className: "tot", disabled: true }, ["Total cash ", el("b", { textContent: inr(j.holders.reduce((a, h) => a + h.bal, 0)) })])); }
  function staffBox(h) { const j = C.j, sm = h.sett || {}, d = overlay(`<div class="hd"><h2>Cash with ${h.name}: ${inr(h.bal)}</h2></div>
      <p class="banner ${h.bal < 0 ? "warn" : "ok"}" style="margin:0">Since ${sm.since ? "hisab of " + dmy(sm.since) : "the start"}: given ${inr(sm.given || 0)} − expenses ${inr(sm.spent || 0)} − returned ${inr(sm.returned || 0)} = ${h.bal >= 0 ? "with " + h.name + " " + inr(h.bal) : "we owe " + h.name + " " + inr(-h.bal)}${sm.lastBal ? " (opening due " + inr(sm.lastBal) + ")" : ""}</p><div class="cblist" id="sbL"></div>
      <div class="actions">${j.canGive || j.myStaff === h.name ? '<button type="button" class="btn" id="sbH">Hisab lo</button>' : ""}${j.canGive ? '<button type="button" class="btn ghost" id="sbG">Give cash</button>' : ""}${j.canRecon ? '<button type="button" class="btn ghost" id="sbC">Count float</button>' : ""}<button type="button" class="btn ghost" id="sbR">Cash returned</button><button type="button" class="btn ghost" id="sbX">Close</button></div><p class="hint" id="sbM">Shop cash given to ${h.name} is not an expense - it only moves from the store to ${h.name}. Spending from it reduces ${h.name}'s balance.</p>`);
    const L = $("sbL"); if (!h.entries.length) L.append(el("div", { className: "cbempty", textContent: "No entries yet." }));
    h.entries.forEach(e => { const r = el("div", { className: "cbr" }), nm = el("span", { className: "n" });
      nm.append(el("b", { textContent: e.src === "mv" ? (e.kind === "give" ? "Given by " + e.byName : "Returned to store") : e.cat }), el("span", { className: "s", textContent: [dmy(e.date), e.note, e.to, e.src === "mv" ? "" : e.byName].filter(Boolean).join(" · ") }));
      if (e.vk === "conf") nm.append(tickEl(e, j.canGive)); r.append(nm, el("span", { className: "a", textContent: (e.src === "mv" && e.kind === "give" ? "+ " : "− ") + inr(e.amount) }), el("span", { className: "a nc", textContent: "" }));
      if (j.canEdit && e.src === "mv") { r.classList.add("k"); r.addEventListener("click", () => openMove(e.kind, e)); } if (j.canEdit && e.src === "exp") { r.classList.add("k"); r.addEventListener("click", () => openExpense(e)); } L.append(r); });
    if ($("sbH")) $("sbH").addEventListener("click", () => hisab(h)); if ($("sbC")) $("sbC").addEventListener("click", () => cashCount(h.name));
    if ($("sbG")) $("sbG").addEventListener("click", () => openMove("give", null, h.name)); $("sbR").addEventListener("click", () => openMove("ret", null, h.name)); $("sbX").addEventListener("click", close); void d; }
  function openMove(kind, e, who) { const j = C.j || {}, edit = !!e;
    overlay(`<div class="hd"><h2>${kind === "give" ? "Cash given to staff (from the store)" : "Cash returned by staff (to the store)"}</h2></div>
      <div class="row"><label>Staff <select id="mvS"></select></label><label>Amount (₹) <input id="mvA" inputmode="numeric" maxlength="12"></label><label>Date <input id="mvD" type="date"></label></div>
      <label>Note <input id="mvN" maxlength="120" placeholder="${kind === "give" ? "e.g. outstation trip" : ""}"></label>
      <div class="actions"><button type="button" class="btn" id="mvOk">${edit ? "Save changes" : "Save"}</button>${edit ? '<button type="button" class="btn danger" id="mvDel">Delete</button>' : ""}<button type="button" class="btn ghost" id="mvX">Cancel</button></div>
      <p class="hint" id="mvM">${kind === "ret" ? "Abhinav / Shilpiji confirm it with a tick." : "Not an expense: the total cash stays the same."}</p>`);
    opts($("mvS"), [["", "Choose…"]].concat((j.staff || []).map(s => [s, s])), edit ? e.staff : who || (kind === "ret" ? j.myStaff || "" : "")); $("mvD").value = edit ? e.date : dayOf(); $("mvD").max = today();
    if (edit) { $("mvA").value = String(e.amount); $("mvN").value = e.note || ""; }
    $("mvX").addEventListener("click", close);
    if ($("mvDel")) $("mvDel").addEventListener("click", async () => { const why = prompt("Why delete? (kept; can be restored)"); if (!why || why.trim().length < 3) return; try { await api("/api/vj/cash", { op: "del", id: e.id, why: why.trim() }); close(); load(); } catch (x) { $("mvM").textContent = "Not deleted (" + (x.message || x) + ")."; } });
    $("mvOk").addEventListener("click", async () => { const m = $("mvM"), b = { op: edit ? "edit" : kind, id: edit ? e.id : undefined, staff: $("mvS").value, amount: $("mvA").value.replace(/[,\s]/g, ""), date: $("mvD").value, note: $("mvN").value.trim() };
      if (!b.staff) { m.textContent = "Choose the staff member."; return; } if (!/^\d{1,9}$/.test(b.amount) || !(Number(b.amount) > 0)) { m.textContent = "Type the amount."; return; }
      $("mvOk").disabled = true; try { await api("/api/vj/cash", b); close(); $("cbMsg").textContent = kind === "give" ? `${rs(b.amount)} moved from the store to ${b.staff}.` : `${rs(b.amount)} back to the store from ${b.staff}.`; load(); } catch (x) { m.textContent = "Not saved (" + (x.message || x) + ")."; $("mvOk").disabled = false; } }); }
  // ---------- creditor payment / bill (owner only - the server checks) ----------
  function openCred(kind, e, acct) { const j = C.j || {}, edit = !!e; if (!j.canEdit) return; const A = j.accts || [];
    overlay(`<div class="hd"><h2>${kind === "cpay" ? "Payment to creditor" : "Creditor bill (we owe more)"}</h2></div>
      <div class="row"><label style="flex:2 1 240px">Account <select id="cpA"></select></label><label>Date <input id="cpD" type="date"></label></div>
      <div class="row"><label>Amount (₹) <input id="cpAm" inputmode="numeric" maxlength="12"></label><label id="cpFl" hidden>Fine gold (g) <input id="cpF" inputmode="decimal" maxlength="10"></label>${kind === "cpay" ? '<label>Mode <select id="cpM"></select></label>' : ""}</div>
      ${kind === "cpay" ? '<div class="row" id="cpBk" hidden><label>Cheque no. <input id="cpC" maxlength="20"></label><label>NEFT / UTR ref. <input id="cpR" maxlength="40"></label><label>Bank <input id="cpB" maxlength="40"></label></div>' : ""}
      <label>Narration <input id="cpN" maxlength="120"></label>
      <div class="actions"><button type="button" class="btn" id="cpOk">${edit ? "Save changes" : "Save"}</button>${edit ? '<button type="button" class="btn danger" id="cpDel">Delete</button>' : ""}<button type="button" class="btn ghost" id="cpX">Cancel</button></div>
      <p class="hint" id="cpMsg">${kind === "cpay" ? "Cash: cash in hand goes down. UPI / Bank: bank only (tick 'Bank verified' later)." : "A bill moves no money - it only raises the account balance."}</p>`);
    const groups = [...new Set(A.map(a => a.group))], s = $("cpA"); s.append(el("option", { value: "", textContent: "Choose…" }));
    groups.forEach(g => { const og = el("optgroup", { label: g }); A.filter(a => a.group === g).forEach(a => og.append(el("option", { value: a.id, textContent: a.name }))); s.append(og); });
    if ($("cpM")) opts($("cpM"), MODES, "cash"); $("cpD").value = dayOf(); $("cpD").max = today();
    const ui = () => { const a = A.find(x => x.id === s.value); $("cpFl").hidden = !(a && a.group === "Gold"); if ($("cpM")) $("cpBk").hidden = $("cpM").value === "cash"; };
    s.addEventListener("change", ui); if ($("cpM")) $("cpM").addEventListener("change", ui);
    if (edit) { s.value = e.acct || ""; $("cpD").value = e.date; $("cpAm").value = String(e.amount || ""); $("cpN").value = e.note || ""; if ($("cpM")) $("cpM").value = e.mode; } else if (acct) s.value = acct; ui();
    $("cpX").addEventListener("click", close);
    if ($("cpDel")) $("cpDel").addEventListener("click", async () => { const why = prompt("Why delete? (kept; can be restored)"); if (!why || why.trim().length < 3) return; try { await api("/api/vj/cash", { op: "del", id: e.id, why: why.trim() }); close(); load(); } catch (x) { $("cpMsg").textContent = "Not deleted (" + (x.message || x) + ")."; } });
    $("cpOk").addEventListener("click", async () => { const m = $("cpMsg"), b = { op: edit ? "edit" : kind, id: edit ? e.id : undefined, acct: s.value, date: $("cpD").value, amount: $("cpAm").value.replace(/[,\s]/g, ""), fine: $("cpFl").hidden ? "" : $("cpF").value.trim(), note: $("cpN").value.trim() };
      if ($("cpM")) Object.assign(b, { mode: $("cpM").value, chq: $("cpC").value.trim(), ref: $("cpR").value.trim(), bank: $("cpB").value.trim() });
      if (!b.acct) { m.textContent = "Choose the account."; return; } $("cpOk").disabled = true;
      try { await api("/api/vj/cash", b); close(); $("cbMsg").textContent = "Saved for " + (A.find(a => a.id === b.acct) || {}).name + "."; load(); if (window.vjCredRefresh) window.vjCredRefresh(); } catch (x) { m.textContent = "Not saved (" + (x.message || x) + ")."; $("cpOk").disabled = false; } }); }
  window.vjCashCred = (kind, acct) => { if (C.j) openCred(kind, null, acct); else load().then(() => openCred(kind, null, acct)); };
  // ---------- opening balances (owner only; locked once a month is closed) ----------
  async function openOpening() { let o; try { o = await api("/api/vj/cash?opening=1"); } catch (x) { $("cbMsg").textContent = "Could not open (" + (x.message || x) + ")."; return; }
    const d = overlay(`<div class="hd"><h2>Opening balances</h2></div><p class="hint">${o.locked ? "Locked - the first month (" + o.closed[0] + ") is closed." : "Type every balance as on the go-live date (after the Diwali settlement). Editable until the first month is closed; every save is kept in history."}</p>
      <div class="row"><label>Go-live date <input id="obD" type="date"></label><label>Cash at store (₹) <input id="obS" inputmode="numeric"></label></div><div class="tblw"><table class="cbm"><tbody id="obT"></tbody></table></div>
      <div class="actions"><button type="button" class="btn" id="obOk">Save opening balances</button><button type="button" class="btn ghost" id="obAddB">+ Bank account</button><button type="button" class="btn ghost" id="obAddP">+ Party</button><button type="button" class="btn ghost" id="obX">Close</button></div><p class="hint" id="obM">${o.at ? "Last saved " + dmy(o.at) + " by " + (o.byName || "") : ""}</p>`);
    d.classList.add("wide"); $("obD").value = o.goLive || ""; $("obS").value = o.store != null ? String(o.store) : ""; $("obD").disabled = $("obS").disabled = o.locked;
    const T = $("obT"), sec = t => T.append(el("tr", null, [el("th", { textContent: t, colSpan: 3, style: "text-align:left;background:var(--sunk)" })]));
    const inp = (v, cls, mode) => { const i = el("input", { value: v ? String(v) : "", className: cls, inputMode: mode || "numeric" }); i.disabled = o.locked; return i; };
    const row = (a, b, c) => { const tr = el("tr"); [a, b, c].forEach(x => { const td = el("td"); if (x != null) td.append(x); tr.append(td); }); T.append(tr); return tr; };
    sec("Bank accounts (name · opening ₹)"); const bankRow = bk => { const n = el("input", { value: bk.name || "", className: "obBn", placeholder: "Bank name / a/c", style: "width:220px;text-align:left" }); n.disabled = o.locked; return row(n, inp(bk.open, "obBo"), null); };
    let bAt = null; (o.banks.length ? o.banks : [{ name: "", open: "" }]).forEach(bk => { bAt = bankRow(bk); });
    sec("Staff floats (cash with staff)"); o.staff.forEach(s => { const tr = row(s.name, inp(s.open, "obSt"), null); tr.dataset.n = s.name; });
    sec("Creditors (₹ we owe · fine g for gold)"); o.creds.forEach(c => { const tr = row(c.name + " · " + c.group + (c.active ? "" : " (inactive)"), inp(c.openAmt, "obCa"), c.group === "Gold" ? inp(c.openFine, "obCf", "decimal") : ""); tr.dataset.id = c.id; });
    sec("Parties (₹ they owe us · fine g they owe; minus = advance)"); const partyRow = p => { const tr = row(p.key ? `${p.name}${p.city ? ", " + p.city : ""} · ${p.mobile || "-"}` : el("span", null, [el("input", { className: "obPn", placeholder: "Name", style: "width:140px;text-align:left" }), " ", el("input", { className: "obPm", placeholder: "Mobile", style: "width:120px;text-align:left" })]), el("span", null, [inp(p.open, "obPo"), " ", inp(p.fine, "obPf", "decimal")]), p.key ? "now " + inr(p.now) + (p.fineNow ? " · " + Number(p.fineNow).toFixed(3) + " g" : "") : ""); tr.dataset.k = p.key || ""; };
    o.custs.forEach(partyRow);
    $("obAddB").addEventListener("click", () => { const tr = bankRow({ name: "", open: "" }); bAt.after(tr); bAt = tr; });
    $("obAddP").addEventListener("click", () => partyRow({ key: "", open: "" }));
    $("obX").addEventListener("click", close); if (o.locked) { $("obOk").hidden = true; $("obAddB").hidden = true; $("obAddP").hidden = true; }
    $("obOk").addEventListener("click", async () => { const m = $("obM"), q = s => [...T.querySelectorAll(s)];
      const b = { op: "opening", goLive: $("obD").value, store: $("obS").value, banks: q(".obBn").map(n => ({ name: n.value.trim(), open: n.closest("tr").querySelector(".obBo").value })).filter(x => x.name),
        staff: q("tr[data-n]").map(tr => ({ name: tr.dataset.n, open: tr.querySelector(".obSt").value })), creds: q("tr[data-id]").map(tr => ({ id: tr.dataset.id, openAmt: tr.querySelector(".obCa").value, openFine: (tr.querySelector(".obCf") || {}).value || "" })),
        custs: q("tr[data-k]").map(tr => tr.dataset.k ? { key: tr.dataset.k, open: tr.querySelector(".obPo").value, fine: tr.querySelector(".obPf").value } : { name: (tr.querySelector(".obPn") || {}).value || "", mobile: (tr.querySelector(".obPm") || {}).value || "", open: tr.querySelector(".obPo").value, fine: tr.querySelector(".obPf").value }).filter(x => x.key || x.name) };
      if (!b.goLive) { m.textContent = "Type the go-live date."; return; } $("obOk").disabled = true;
      try { await api("/api/vj/cash", b); close(); $("cbMsg").textContent = "Opening balances saved (history kept)."; load(); } catch (x) { m.textContent = "Not saved (" + (x.message || x) + ")."; $("obOk").disabled = false; } }); }
  async function closeMonth() { const now = today().slice(0, 7), y = Number(now.slice(0, 4)), mo = Number(now.slice(5, 7)), prev = mo === 1 ? (y - 1) + "-12" : y + "-" + String(mo - 1).padStart(2, "0");
    const m = prompt("Close which month? (YYYY-MM) - after closing, its entries cannot be added or changed, and opening balances lock.", prev); if (!m) return;
    try { await api("/api/vj/cash", { op: "close", month: m.trim() }); $("cbMsg").textContent = "Month " + m + " closed."; load(); } catch (x) { $("cbMsg").textContent = "Not closed (" + (x.message || x) + ")."; } }
  // ---------- day book (owner 14:51): every entry of the day in time order, Cash / Bank / Account ----------
  function bookRows(j) { return j.lines.map(e => { const cs = e.mode === "cash", sg = e.dir === "in" ? 1 : -1;
      const what = e.src === "rc" ? "Receipt " + e.id + " · " + (e.bill || "on account") : e.src === "exp" ? "Expense" + (e.from && e.from !== "store" ? " (from " + e.from + ")" : "") : e.src === "kar" ? "Karigar payment" : e.src === "cp" ? "Creditor payment" + (e.ref ? " · " + e.ref : "") : e.src === "hand" ? "Cash handed to owner" : e.src === "cd" ? "Cash difference on reconcile (" + (e.dir === "in" ? "excess" : "short") + ")" : e.kind === "give" ? "Cash given to staff" : "Cash returned by staff";
      const acct = e.src === "rc" ? e.party : e.src === "exp" ? e.cat + (e.to ? " · " + e.to : "") : e.src === "kar" ? "Karigars · " + e.to : e.src === "cp" ? e.to : e.src === "hand" ? "Owner (" + (e.byName || "") + ")" : e.src === "cd" ? (e.holder === "store" ? "Cash at store" : e.holder) : e.staff;
      const cash = e.src === "mv" ? (e.kind === "give" ? "store → " + e.staff : e.staff + " → store") + " " + inr(e.amount) : cs ? (sg > 0 ? "+ " : "− ") + inr(e.amount) : "";
      return { t: isNaN(Date.parse(e.at || "")) ? "" : new Date(Date.parse(e.at) + 5.5 * 3600e3).toISOString().slice(11, 16), what, acct, cash, bank: cs ? "" : (sg > 0 ? "+ " : "− ") + inr(e.amount) + " " + (e.mode === "upi" ? "UPI" : "Bank"), note: e.note || "", e }; }); }
  function renderBook(j) { const box = $("cbBook"); box.textContent = ""; const t = el("table", { className: "cbm" }), hd = el("tr");
    [["Time", "hm"], ["Entry · narration / account Dr-Cr"], ["Account"], ["Cash"], ["Bank"]].forEach(([x, c]) => hd.append(el("th", { textContent: x, className: c || "" }))); const tb = el("tbody"); t.append(el("thead", null, [hd]), tb);
    const R = bookRows(j).concat((j.acctLines || []).map(a => ({ t: isNaN(Date.parse(a.at || "")) ? "" : new Date(Date.parse(a.at) + 5.5 * 3600e3).toISOString().slice(11, 16), what: a.what + " · " + a.vch + (a.og ? " · " + a.og : ""), acct: a.party,
      cash: "", bank: "", note: (a.amt ? (a.amt > 0 ? "Dr " : "Cr ") + inr(Math.abs(a.amt)) : "") + (a.fine ? (a.fine > 0 ? " · Dr " : " · Cr ") + Math.abs(a.fine).toFixed(3) + " g" : "") }))).sort((x, y) => String(x.t).localeCompare(String(y.t)));
    R.forEach(r => { const tr = el("tr"); [[r.t, "hm"], [r.what + (r.note ? " · " + r.note : "")], [r.acct], [r.cash], [r.bank]].forEach(([v, c], i) => { const td = el("td", { textContent: v, className: c || "" }); if (i === 1 || i === 2) { td.style.textAlign = "left"; td.style.whiteSpace = "normal"; } tr.append(td); }); tb.append(tr); });
    if (!R.length) tb.append(el("tr", null, [el("td", { textContent: "Nothing entered this day.", colSpan: 5 })])); box.append(t); }
  // verify tick: owner ticks / unticks (server checks); staff see the status only
  function tickEl(e, may) { const lab = e.vk === "bank" ? "Bank verified" : e.vk === "conf" ? "Cash received" : "Cash received by owner", w = el("label", { className: "cbtk" + (e.tick ? " on" : "") });
    w.addEventListener("click", x => x.stopPropagation());
    if (C.j && (C.j.canEdit || may)) { const ck = el("input", { type: "checkbox", checked: !!e.tick }); ck.addEventListener("change", async () => { ck.disabled = true;
        try { const r = await api("/api/vj/cash", { op: "tick", src: e.src, id: e.id, on: ck.checked }); e.tick = r.on ? { at: r.at, byName: r.byName } : null; const ov = $("cbOv"); if (ov && e.vk === "conf") close(); load(); }
        catch (x) { ck.checked = !ck.checked; $("cbMsg").textContent = "Tick not saved (" + (x.message || x) + ")."; } ck.disabled = false; }); w.append(ck); }
    w.append(e.tick ? "✓ " + lab + " (" + (e.tick.byName || "") + " " + dmy(e.tick.at) + ")" : (C.j && C.j.canEdit ? lab : (e.vk === "bank" ? "Bank: pending check" : e.vk === "conf" ? "Waiting for owner's tick" : "Cash: in hand (not handed over)"))); return w; }
  function renderReg() {
    const j = C.j, s = j.sum || {}; $("cbO").textContent = inr(s.all); $("cbI").textContent = inr(s.cash || 0); $("cbP").textContent = inr((s.upi || 0) + (s.bank || 0)); $("cbH").textContent = inr(s.pendCash || 0); $("cbC").textContent = inr(s.pendBank || 0);
    $("cbNC").textContent = (j.month ? "Month " + j.month.split("-").reverse().join("-") : "All months") + ` · ${j.rows.length} receipt(s)${j.more ? " (+" + j.more + " older not shown - pick a month)" : ""}. Bill + Pay, Ledger and Cash book receipts are all here.`;
    const box = $("crgL"); box.textContent = ""; const t = el("table", { className: "cbm" }), hd = el("tr");
    [["Date"], ["Party (mobile)"], ["Bill", "hm"], ["Amount"], ["Mode / ref."], ["By", "hm"], ["Verified"]].forEach(([x, c]) => hd.append(el("th", { textContent: x, className: c || "" })));
    const tb = el("tbody"); t.append(el("thead", null, [hd]), tb);
    j.rows.forEach(e => { const tr = el("tr"), td = (v, c) => { const d = el("td", { className: c || "" }); d.append(v); tr.append(d); return d; };
      td(dmy(e.date).slice(0, 5)); const p = td(e.party || "—"); p.style.textAlign = "left"; p.style.whiteSpace = "normal"; if (e.mobile) p.append(el("span", { className: "s", textContent: e.mobile, style: "display:block;font-size:12px;color:var(--muted)" }));
      td(e.bill || "on account", "hm"); td(inr(e.amount)); const m = td((e.mode === "cash" ? "Cash" : e.mode === "upi" ? "UPI" : "Bank") + (e.ref ? " · " + e.ref : "") + (e.note ? " · " + e.note : "")); m.style.whiteSpace = "normal";
      td(e.byName || "", "hm"); const v = td(tickEl(e)); v.style.textAlign = "left"; v.style.whiteSpace = "normal"; tb.append(tr); });
    if (!j.rows.length) tb.append(el("tr", null, [el("td", { textContent: "No receipts for this filter.", colSpan: 7 })]));
    box.append(t);
  }
  function renderMonth() {
    const j = C.j, d = j.days || [], first = d[0], last = d[d.length - 1], nc = v => v == null ? "—" : inr(v);
    $("cbO").textContent = first ? nc(first.opening) : "—"; $("cbI").textContent = inr(j.tot.cashIn); $("cbP").textContent = inr(j.tot.cashOut); $("cbH").textContent = inr(j.tot.handed); $("cbC").textContent = last ? nc(last.closing) : "—";
    $("cbNC").textContent = `UPI / Bank this month (not cash in hand): received ${inr(j.tot.upiIn + j.tot.bankIn)} · paid ${inr(j.tot.upiOut + j.tot.bankOut)}. Tap a day to open it.`;
    const box = $("cbMon"); box.textContent = ""; const t = el("table", { className: "cbm" }), hd = el("tr");
    [["Date"], ["Opening"], ["+ Cash in"], ["− Expenses"], ["− To owner", "hm"], ["= Closing"], ["UPI/Bank in", "hm"], ["UPI/Bank out", "hm"]].forEach(([x, c]) => hd.append(el("th", { textContent: x, className: c || "" })));
    const tb = el("tbody"); t.append(el("thead", null, [hd]), tb);
    d.slice().reverse().forEach(x => { const tr = el("tr", { className: "d" }); [[dmy(x.date).slice(0, 5)], [nc(x.opening)], [x.cashIn ? inr(x.cashIn) : ""], [x.cashOut ? inr(x.cashOut) : ""], [x.handed ? inr(x.handed) : "", "hm"], [nc(x.closing)], [x.upiIn + x.bankIn ? inr(x.upiIn + x.bankIn) : "", "hm"], [x.upiOut + x.bankOut ? inr(x.upiOut + x.bankOut) : "", "hm"]]
      .forEach(([v, c]) => tr.append(el("td", { textContent: v, className: c || "" }))); tr.addEventListener("click", () => { $("cbView").value = "day"; C.view = "day"; $("cbDate").value = x.date; $("cbDate").hidden = false; $("cbMonth").hidden = true; load(); }); tb.append(tr); });
    const tt = el("tr", { className: "tt" }); [["Total"], [""], [inr(j.tot.cashIn)], [inr(j.tot.cashOut)], [inr(j.tot.handed), "hm"], [""], [inr(j.tot.upiIn + j.tot.bankIn), "hm"], [inr(j.tot.upiOut + j.tot.bankOut), "hm"]].forEach(([v, c]) => tt.append(el("td", { textContent: v, className: c || "" }))); tb.append(tt);
    if (!d.length) tb.prepend(el("tr", null, [el("td", { textContent: "No days yet in this month.", colSpan: 8 })]));
    box.append(t);
  }

  // ---------- overlay ----------
  let ovKey = null;
  function overlay(html) { close(); const ov = el("div", { className: "cbov", id: "cbOv" }), d = el("div", { className: "cbdlg" }); d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.innerHTML = html; ov.append(d);
    ov.addEventListener("click", e => { if (e.target === ov) close(); }); ovKey = e => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", ovKey); document.body.append(ov); return d; }
  function close() { const o = $("cbOv"); if (o) o.remove(); if (ovKey) document.removeEventListener("keydown", ovKey); ovKey = null; stopMic(); }
  const dayOf = () => ((C.view === "day" || C.view === "book") && $("cbDate").value) || today();

  // ---------- + Receipt (through /api/vj/receipt = same as bill '+ Pay' and Ledger) ----------
  function openReceipt() {
    C.rc = null;
    const d = overlay(`
      <div class="hd"><h2>+ Receipt (money received)</h2><button type="button" class="btn ghost mic" id="crMic" title="Speak">🎤 Bolein</button></div>
      <p class="heard" id="crHeard" hidden></p>
      <label>Party - mobile or name <input id="crQ" autocomplete="off" maxlength="40" placeholder="e.g. 98250 or Ramesh"></label>
      <div class="sug" id="crSug"></div>
      <div class="pc" id="crPc" hidden></div>
      <div class="row" id="crNew" hidden><label>Name <input id="crName" autocomplete="off" maxlength="60"></label><label>Mobile <input id="crMob" inputmode="tel" autocomplete="off" maxlength="14"></label><label>City <input id="crCity" autocomplete="off" maxlength="40"></label></div>
      <div class="row"><label style="flex:2 1 220px">Against bill <select id="crBill"></select></label></div>
      <div class="row"><label>Amount (₹) <input id="crAmt" inputmode="numeric" autocomplete="off" maxlength="12"></label><label>Mode <select id="crMode"></select></label><label id="crRefL" hidden>Ref. / UTR <input id="crRef" autocomplete="off" maxlength="40"></label></div>
      <div class="row"><label>Date <input id="crDate" type="date"></label><label style="flex:2 1 220px">Note <input id="crNote" autocomplete="off" maxlength="120"></label></div>
      <div class="actions"><button type="button" class="btn" id="crSave">Save receipt</button><button type="button" class="btn ghost" id="crX">Cancel</button></div>
      <p class="hint" id="crMsg">Saved here = saved in the party's Ledger and on the bill (same as Saved bills > + Pay).</p>`);
    opts($("crMode"), MODES, "cash"); $("crDate").value = dayOf(); $("crDate").max = today(); billOpts();
    $("crMode").addEventListener("change", () => { $("crRefL").hidden = $("crMode").value === "cash"; });
    let t = null; $("crQ").addEventListener("input", () => { clearTimeout(t); t = setTimeout(suggest, 300); });
    $("crSave").addEventListener("click", saveReceipt); $("crX").addEventListener("click", close);
    $("crMic").addEventListener("click", () => mic("receipt"));
    setTimeout(() => $("crQ").focus(), 30); void d;
  }
  async function suggest() {
    const q = $("crQ").value.trim(), box = $("crSug"); box.textContent = ""; if (q.length < 2) return;
    try { const j = await api("/api/vj/ledger?q=" + encodeURIComponent(q));
      (j.customers || []).slice(0, 6).forEach(c => { const b = el("button", { type: "button", textContent: `${c.name}${c.city ? ", " + c.city : ""} · ${c.mobile || "no mobile"} · balance ${inr(c.balance)}` }); b.addEventListener("click", () => pick(c.key)); box.append(b); });
      const nb = el("button", { type: "button", textContent: "+ New party / not in list: " + q }); nb.addEventListener("click", () => newParty(q)); box.append(nb);
    } catch (e) { box.append(el("p", { className: "hint", textContent: "Could not search (" + (e.message || e) + ")." })); }
  }
  function newParty(q) { C.rc = null; $("crSug").textContent = ""; $("crPc").hidden = true; $("crNew").hidden = false; const dg = q.replace(/\D/g, "");
    if (dg.length >= 10) $("crMob").value = dg.slice(-10); else $("crName").value = q; billOpts(); $(dg.length >= 10 ? "crName" : "crMob").focus(); }
  async function pick(key) {
    $("crSug").textContent = ""; $("crNew").hidden = true; const pc = $("crPc"); pc.hidden = false; pc.textContent = "Loading…";
    try { const j = await api("/api/vj/ledger?key=" + encodeURIComponent(key)); C.rc = j; const c = j.customer;
      pc.textContent = ""; pc.append(el("span", { className: "sp" }, [el("b", { textContent: c.name }), (c.city ? ", " + c.city : "") + " · " + (c.mobile || "no mobile") + " · balance " + inr(c.balance) + (c.account ? " · advance " + inr(c.account) : "")]), btn("Change", "ghost", () => { C.rc = null; pc.hidden = true; billOpts(); $("crQ").focus(); }));
      billOpts(); $("crAmt").focus();
    } catch (e) { pc.textContent = "Could not open (" + (e.message || e) + ")."; }
  }
  function billOpts() { const s = $("crBill"), open = C.rc ? C.rc.bills.filter(b => !b.settled && b.balance > 0) : [];
    opts(s, [["", "On account (advance / no bill)"]].concat(open.map(b => [b.no, `${b.no} (${dmy(b.date)}) - balance ${inr(b.balance)}`]))); if (open.length) s.value = open[0].no; }
  async function saveReceipt() {
    const m = $("crMsg"), mode = $("crMode").value, amt = $("crAmt").value.replace(/[,\s]/g, ""), bill = $("crBill").value;
    if (!/^\d{1,9}$/.test(amt) || !(Number(amt) > 0)) { m.textContent = "Type the amount in rupees."; $("crAmt").focus(); return; }
    if (mode === "bank" && $("crRef").value.trim().length < 3) { m.textContent = "Bank: type the UTR / reference."; $("crRef").focus(); return; }
    const body = { mode, amount: amt, date: $("crDate").value, note: $("crNote").value.trim(), ref: mode === "cash" ? "" : $("crRef").value.trim() };
    if (bill) body.bill = bill; else if (C.rc) body.key = C.rc.customer.key;
    else { if (!$("crName").value.trim()) { m.textContent = "Choose the party from the list, or type a new party's name."; $("crNew").hidden = false; $("crName").focus(); return; } Object.assign(body, { name: $("crName").value.trim(), mobile: $("crMob").value.trim(), city: $("crCity").value.trim() }); }
    const b = $("crSave"); b.disabled = true; m.textContent = "Saving…";
    try { const j = await api("/api/vj/receipt", body); close(); $("cbMsg").textContent = `Receipt ${j.receipt.no} saved: ${rs(j.receipt.amount)} ${j.receipt.modeName} from ${j.receipt.name} (${j.receipt.bill || "on account"}). PDF / WhatsApp: Ledger tab.`; load(); }
    catch (e) { m.textContent = "Not saved (" + (e.message || e) + ")."; b.disabled = false; }
  }

  // ---------- + Expense / edit ----------
  function openExpense(e) {
    const j = C.j || {}, edit = !!e, adm = !!j.canEdit, ro = edit && !adm, lk = edit && !!e.kpay; C.ex = e; C.photo = edit ? e.photo || "" : "";
    const d = overlay(`
      <div class="hd"><h2>${edit ? "Expense" + (ro ? "" : " - change") : "+ Expense (money paid)"}</h2>${edit ? "" : '<button type="button" class="btn ghost mic" id="cxMic" title="Speak">🎤 Bolein</button>'}</div>
      <p class="heard" id="cxHeard" hidden></p>
      <div class="row"><label>Category <select id="cxCat"></select></label><label>Amount (₹) <input id="cxAmt" inputmode="numeric" autocomplete="off" maxlength="12"></label><label>Mode <select id="cxMode"></select></label></div>
      <div class="row" id="cxKarR" hidden><label>Karigar <select id="cxKar"></select></label></div>
      <div class="row" id="cxFromR"><label>Paid from <select id="cxFrom"></select></label></div>
      <div class="row"><label>Paid to <input id="cxTo" autocomplete="off" maxlength="60" placeholder="person / shop"></label><label id="cxRefL" hidden>Ref. / UTR <input id="cxRef" autocomplete="off" maxlength="40"></label><label>Date <input id="cxDate" type="date"></label></div>
      <label>Narration - what was it for? (required) <input id="cxNote" autocomplete="off" maxlength="120" placeholder="e.g. printer paper + pens, puja samaan"></label>
      <div class="ph"><button type="button" class="btn ghost" id="cxPhB">📷 Bill / receipt photo</button><input id="cxPh" type="file" accept="image/*" hidden><a id="cxPhA" target="_blank" rel="noopener" hidden><img id="cxPhI" alt="Bill photo"></a><button type="button" class="btn ghost" id="cxPhX" hidden>Remove photo</button></div>
      <div class="row" id="cxLinkR" hidden><label style="flex:2 1 260px">Karigar account <select id="cxLink"></select></label><div class="actions" style="margin:0;align-self:end"><button type="button" class="btn" id="cxLinkB">Link</button></div></div>
      <div class="actions"><button type="button" class="btn" id="cxSave">${edit ? "Save changes" : "Save expense"}</button>${edit && adm && !lk ? '<button type="button" class="btn danger" id="cxDel">Delete</button>' : ""}<button type="button" class="btn ghost" id="cxX">${ro ? "Close" : "Cancel"}</button></div>
      <p class="hint" id="cxMsg"></p><div class="hist" id="cxHist" hidden></div>`);
    const cats = (j.cats || []).slice(); if (edit && !cats.includes(e.cat)) cats.push(e.cat);
    opts($("cxCat"), [["", "Choose…"]].concat(cats.map(c => [c, c]))); opts($("cxMode"), MODES, "cash"); opts($("cxKar"), [["", "Choose…"]].concat((j.karigars || []).map(k => [k, k])));
    $("cxDate").value = dayOf(); $("cxDate").max = today();
    { const fl = [["store", "Store cash"]].concat((j.staff || []).filter(s => adm || s === j.myStaff || (edit && e.from === s)).map(s => [s, s + "'s float"])); opts($("cxFrom"), fl, edit ? e.from || "store" : j.myStaff || "store"); }
    const kui = () => { $("cxKarR").hidden = $("cxCat").value !== j.kar; $("cxRefL").hidden = $("cxMode").value === "cash"; $("cxFromR").hidden = $("cxMode").value !== "cash" || $("cxFrom").options.length < 2; };
    $("cxCat").addEventListener("change", kui); $("cxMode").addEventListener("change", kui);
    if (edit) { $("cxCat").value = e.cat; $("cxAmt").value = String(e.amount); $("cxMode").value = e.mode; $("cxKar").value = e.kar || ""; $("cxTo").value = e.to || ""; $("cxRef").value = e.ref || ""; $("cxDate").value = e.date; $("cxNote").value = e.note || ""; }
    kui(); phUi();
    if (ro || lk) { ["cxCat", "cxAmt", "cxMode", "cxKar", "cxDate", "cxFrom"].forEach(i => { $(i).disabled = true; }); }
    if (ro) { ["cxTo", "cxRef", "cxNote"].forEach(i => { $(i).disabled = true; }); $("cxSave").hidden = true; $("cxPhB").hidden = true; }
    if (lk) $("cxMsg").textContent = "This payment is in the karigar account - date / amount / mode are changed there (Karigar order > Karigar account).";
    $("cxPhB").addEventListener("click", () => $("cxPh").click()); $("cxPh").addEventListener("change", () => { const f = $("cxPh").files[0]; if (f) upload(f); $("cxPh").value = ""; });
    $("cxPhX").addEventListener("click", () => { C.photo = ""; phUi(); });
    $("cxSave").addEventListener("click", saveExpense); $("cxX").addEventListener("click", close);
    if ($("cxDel")) $("cxDel").addEventListener("click", delExpense);
    if ($("cxMic")) $("cxMic").addEventListener("click", () => mic("expense"));
    if (edit && adm && e.needLink) { const s = $("cxLink"); $("cxLinkR").hidden = false;
      opts(s, [["", "Add as a new payment in " + (e.kar || "the karigar") + "'s account"]].concat((j.kfree || []).filter(k => String(k.karigar).toLowerCase() === String(e.kar).toLowerCase()).map(k => [k.id, `Same as entry of ${dmy(k.date)} - ${rs(k.amount)} (${k.descr})`])));
      $("cxLinkB").addEventListener("click", linkKar); }
    if (edit && adm) { const h = $("cxHist"); h.hidden = false; h.append(el("div", { textContent: `Entered ${dmy(e.date)} by ${e.byName || "?"}${e.edits ? " · changed " + e.edits + " time(s)" : ""}` })); if (e.kpay) h.append(el("div", { textContent: "Karigar account entry " + e.kpay })); }
    if (!edit) setTimeout(() => $("cxCat").focus(), 30); void d;
  }
  function phUi() { const has = !!C.photo; $("cxPhA").hidden = !has; $("cxPhX").hidden = !has || ($("cxSave") && $("cxSave").hidden); if (has) { $("cxPhA").href = "/_blob/" + C.photo; $("cxPhI").src = "/_blob/" + C.photo; } $("cxPhB").textContent = has ? "📷 Change photo" : "📷 Bill / receipt photo"; }
  async function shrink(file) { const url = URL.createObjectURL(file); try { const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      for (const [mx, q] of [[1600, 0.82], [1300, 0.75], [1000, 0.7], [800, 0.65]]) { const s = Math.min(1, mx / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        const b = await new Promise(ok => c.toBlob(ok, "image/jpeg", q)); if (b && b.size <= 300 * 1024) return b; if (mx === 800) return b; } } finally { URL.revokeObjectURL(url); } }
  async function upload(file) { const m = $("cxMsg"); m.textContent = "Making the photo smaller…";
    try { const b = await shrink(file); m.textContent = "Uploading (" + Math.round(b.size / 1024) + " KB)…";
      const r = await fetch("/api/vj/photo", { method: "POST", credentials: "same-origin", headers: { "content-type": "image/jpeg" }, body: b }), j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status);
      C.photo = j.id; phUi(); m.textContent = "Photo added - press Save."; } catch (e) { m.textContent = "Photo not added (" + (e.message || e) + ")."; } }
  async function saveExpense() {
    const m = $("cxMsg"), e = C.ex, cat = $("cxCat").value, amt = $("cxAmt").value.replace(/[,\s]/g, ""), mode = $("cxMode").value;
    if (!cat) { m.textContent = "Choose the category."; $("cxCat").focus(); return; }
    if (!/^\d{1,9}$/.test(amt) || !(Number(amt) > 0)) { m.textContent = "Type the amount in rupees."; $("cxAmt").focus(); return; }
    if ($("cxNote").value.trim().length < 2) { m.textContent = "Write the narration - what was it for?"; $("cxNote").focus(); return; }
    if (cat === (C.j && C.j.kar) && !$("cxKar").value) { m.textContent = "Choose the karigar."; $("cxKar").focus(); return; }
    const body = { op: e ? "edit" : "exp", cat, amount: amt, mode, ref: mode === "cash" ? "" : $("cxRef").value.trim(), to: $("cxTo").value.trim(), note: $("cxNote").value.trim(), date: $("cxDate").value, photo: C.photo, kar: $("cxKar").value, from: mode === "cash" ? $("cxFrom").value : "store" };
    if (e) { body.id = e.id; if (e.kpay) { body.date = e.date; body.amount = String(e.amount); body.mode = e.mode; body.cat = e.cat; body.kar = e.kar; body.from = e.from; } }
    const b = $("cxSave"); b.disabled = true; m.textContent = "Saving…";
    try { const j = await api("/api/vj/cash", body); close();
      $("cbMsg").textContent = e ? (j.same ? "Nothing changed." : "Changed - history kept.") : `Saved: ${cat} ${rs(amt)} ${mode === "cash" ? "cash" : mode.toUpperCase()}` + (j.linked ? " - also in the karigar account." : j.needLink ? " - Abhinav / Shilpiji will link it to the karigar account." : ".");
      if (!e && $("cxDate") == null && C.view === "day" && body.date !== $("cbDate").value) $("cbDate").value = body.date; load(); }
    catch (x) { m.textContent = "Not saved (" + (x.message || x) + ")."; b.disabled = false; }
  }
  async function delExpense() { const e = C.ex, why = prompt("Why delete? (kept with the entry; it can be restored)"); if (why == null) return; if (why.trim().length < 3) { $("cxMsg").textContent = "Write the reason (3+ letters)."; return; }
    try { await api("/api/vj/cash", { op: "del", id: e.id, why: why.trim() }); close(); $("cbMsg").textContent = "Deleted (kept - restore from 'Deleted this day')."; load(); } catch (x) { $("cxMsg").textContent = "Not deleted (" + (x.message || x) + ")."; } }
  async function linkKar() { const e = C.ex, kid = $("cxLink").value; if (!confirm(kid ? "Link to that karigar account entry (no new entry)?" : "Add this payment to " + e.kar + "'s karigar account?")) return;
    try { await api("/api/vj/cash", { op: "klink", id: e.id, kid }); close(); $("cbMsg").textContent = "Linked to the karigar account."; load(); } catch (x) { $("cxMsg").textContent = "Not linked (" + (x.message || x) + ")."; } }

  // ---------- settings (owner only - the server checks) ----------
  function openSettings() {
    const c = (C.j && C.j.cfg) || {};
    overlay(`<div class="hd"><h2>Cash book settings</h2></div>
      <p class="hint">Opening cash, banks, staff floats, creditors and parties: More… &gt; Opening balances.</p>
      <label>Expense heads (Tally ledger names, one per line) <textarea id="csCats"></textarea></label>
      <label>Staff who carry shop cash (one per line: Name, login email - the email lets that login spend from their own float) <textarea id="csStaff" style="min-height:90px"></textarea></label>
      <div class="actions"><button type="button" class="btn" id="csSave">Save</button><button type="button" class="btn ghost" id="csX">Cancel</button></div>
      <p class="hint" id="csMsg">${c.at ? "Last changed " + dmy(c.at) + " by " + (c.byName || "") : ""}</p>`);
    $("csCats").value = (c.cats || []).join("\n"); $("csStaff").value = (c.staff || []).map(s => s.name + (s.email ? ", " + s.email : "")).join("\n");
    $("csX").addEventListener("click", close);
    $("csSave").addEventListener("click", async () => { const m = $("csMsg"); const body = { op: "cfg", cats: $("csCats").value.split("\n").map(s => s.trim()).filter(Boolean),
        staff: $("csStaff").value.split("\n").map(s => s.trim()).filter(Boolean).map(s => { const [n, em] = s.split(","); return { name: (n || "").trim(), email: (em || "").trim() }; }) };
      try { await api("/api/vj/cash", body); close(); $("cbMsg").textContent = "Settings saved."; load(); } catch (e) { m.textContent = "Not saved (" + (e.message || e) + ")."; } });
  }

/*@P3*/
