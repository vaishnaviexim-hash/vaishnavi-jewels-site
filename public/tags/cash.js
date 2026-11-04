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
      <div class="row" id="cxKarR" hidden><label>Karigar <select id="cxKar"></select></label><label id="cxKmL" hidden style="flex:2 1 220px">Month account (due) <select id="cxKm"></select></label></div>
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
    /* C-20261104-KPAYMONTH (owner 15:31): karigar -> month account with its rupee due; picking a month fills the due (part payment allowed) */
    const kmLoad = async () => { const k = $("cxKar").value, s = $("cxKm"); $("cxKmL").hidden = !(adm && k && !lk); if ($("cxKmL").hidden) return; opts(s, [["", "Loading dues…"]]);
      try { const r = await api("/api/vj/cash?kdue=" + encodeURIComponent(k)); C.kdue = r.months; opts(s, [["", "No month (general payment)"]].concat(r.months.map(m => [m.month, m.label + " — due " + inr(m.due)])), edit ? e.kmonth || "" : "");
        if (!edit) { const first = r.months.slice().reverse().find(m => m.due > 0); if (first) { s.value = first.month; if (!$("cxAmt").value) $("cxAmt").value = String(Math.round(first.due)); } } } catch (x) { opts(s, [["", "No month (dues not loaded)"]]); } };
    $("cxKar").addEventListener("change", kmLoad); $("cxCat").addEventListener("change", () => { if ($("cxCat").value === j.kar) kmLoad(); });
    $("cxKm").addEventListener("change", () => { const m = (C.kdue || []).find(x => x.month === $("cxKm").value); if (m && m.due > 0) $("cxAmt").value = String(Math.round(m.due)); });
    if (edit) { $("cxCat").value = e.cat; $("cxAmt").value = String(e.amount); $("cxMode").value = e.mode; $("cxKar").value = e.kar || ""; $("cxTo").value = e.to || ""; $("cxRef").value = e.ref || ""; $("cxDate").value = e.date; $("cxNote").value = e.note || ""; }
    kui(); phUi(); if (edit && e.kar) kmLoad();
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
    const body = { op: e ? "edit" : "exp", cat, amount: amt, mode, ref: mode === "cash" ? "" : $("cxRef").value.trim(), to: $("cxTo").value.trim(), note: $("cxNote").value.trim(), date: $("cxDate").value, photo: C.photo, kar: $("cxKar").value, kmonth: cat === (C.j && C.j.kar) && !$("cxKmL").hidden ? $("cxKm").value : "", from: mode === "cash" ? $("cxFrom").value : "store" };
    if (e) { body.id = e.id; if (e.kpay) { body.date = e.date; body.amount = String(e.amount); body.mode = e.mode; body.cat = e.cat; body.kar = e.kar; body.from = e.from; } }
    const b = $("cxSave"); b.disabled = true; m.textContent = "Saving…";
    try { const j = await api("/api/vj/cash", body); close();
      $("cbMsg").textContent = e ? (j.same ? "Nothing changed." : "Changed - history kept.") : `Saved: ${cat} ${rs(amt)} ${mode === "cash" ? "cash" : mode.toUpperCase()}` + (j.linked ? " - also in the karigar account" + (j.kmonth && j.kdue != null ? " (" + ((C.kdue || []).find(x => x.month === j.kmonth) || { label: j.kmonth }).label + " account: remaining due " + inr(j.kdue) + ")" : "") + "." : j.needLink ? " - Abhinav / Shilpiji will link it to the karigar account." : ".");
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

  // ---------- voice ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null;
  function stopMic() { if (rec) { try { rec.abort(); } catch (e) {} rec = null; } document.querySelectorAll(".cbdlg .mic").forEach(b => b.classList.remove("on")); }
  function mic(kind) {
    const pre = kind === "receipt" ? "cr" : "cx", heard = $(pre + "Heard"), b = $(pre + "Mic");
    if (rec) { stopMic(); return; }
    if (!SR) { heard.hidden = false; heard.textContent = "Is phone/browser mein seedha bolne ki suvidha nahi hai. Note box par tap karke keyboard ka 🎤 mic button dabaiye aur bolie, phir baaki box bhariye."; $(pre === "cr" ? "crNote" : "cxNote").focus(); return; }
    const go = lang => { const r = new SR(); rec = r; r.lang = lang; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false; let got = false;
      b.classList.add("on"); heard.hidden = false; heard.textContent = "Sun raha hai… boliye (e.g. " + (kind === "receipt" ? "\"Ramesh bhai 5000 cash\")" : "\"chai nashta 240 rupaye cash\")");
      r.onresult = ev => { got = true; const t = Array.from(ev.results).map(x => x[0].transcript).join(" ").trim(); stopMic(); fill(kind, t); };
      r.onerror = ev => { if (ev.error === "language-not-supported" && lang === "hi-IN") { rec = null; go("en-IN"); return; } stopMic(); heard.textContent = ev.error === "not-allowed" ? "Mic ki permission nahi mili - browser settings mein mic allow karein, ya keyboard ka mic use karein." : ev.error === "no-speech" ? "Kuch suna nahi - dobara 🎤 dabakar boliye." : "Bolna samajh nahi aaya (" + ev.error + ") - dobara try karein ya type karein."; };
      r.onend = () => { if (!got && rec === r) { stopMic(); if (heard.textContent.startsWith("Sun raha")) heard.textContent = "Kuch suna nahi - dobara 🎤 dabakar boliye."; } };
      try { r.start(); } catch (e) { stopMic(); heard.textContent = "Mic shuru nahi hua - keyboard ka mic use karein."; } };
    go("hi-IN");
  }
  // rules: amount, mode, category (fuzzy), paid-to / note. Exposed for tests as window.vjCashParse.
  const DEVD = s => s.replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x966));
  const NUMW = { ek: 1, "एक": 1, do: 2, "दो": 2, teen: 3, tin: 3, "तीन": 3, char: 4, chaar: 4, "चार": 4, panch: 5, paanch: 5, "पांच": 5, "पाँच": 5, chhe: 6, che: 6, "छह": 6, "छः": 6, saat: 7, sat: 7, "सात": 7, aath: 8, ath: 8, "आठ": 8, nau: 9, "नौ": 9, das: 10, "दस": 10, bees: 20, bis: 20, "बीस": 20, pachas: 50, pachaas: 50, "पचास": 50, dhai: 2.5, "ढाई": 2.5, dedh: 1.5, derh: 1.5, "डेढ़": 1.5, "डेढ": 1.5 };
  const MULW = { hazar: 1000, hazaar: 1000, hajar: 1000, hajaar: 1000, "हज़ार": 1000, "हजार": 1000, thousand: 1000, sau: 100, "सौ": 100, hundred: 100, lakh: 100000, lac: 100000, "लाख": 100000 };
  const CUR = /^(rs|rs\.|rupaye|rupaiye|rupay|rupees?|rupiya|rupaya|रुपये|रुपए|रुपया|रूपये|रूपए|₹)$/;
  const MODEW = { cash: /\b(cash|nakad|nagad|naqad)\b|कैश|नकद|नगद|कॅश/, upi: /\b(upi|gpay|g pay|google pay|phone ?pe|phonepay|paytm|bhim|online)\b|यूपीआई|यूपीआय|गूगल पे|फोन ?पे|पेटीएम|ऑनलाइन/, bank: /\b(bank|neft|rtgs|imps|transfer|cheque|check)\b|बैंक|ट्रांसफर|चेक/ };
  // owner 14:50: heads = his Tally ledgers; Hinglish words point to them (chai / nashta -> Showroom Expenses, petrol / auto / train -> Travelling, bijli -> Electricity Bills)
  const KW = { "showroom expenses": ["chai", "chay", "tea", "nashta", "nasta", "naashta", "snacks", "snack", "coffee", "biscuit", "pani", "water", "refreshment", "doodh", "milk", "nashte", "safai", "cleaning", "jhadu", "showroom", "चाय", "नाश्ता", "नास्ता", "नाश्ते", "पानी", "कॉफी", "बिस्कुट", "दूध", "सफाई"],
    "salary a/c": ["salary", "pagar", "tankhwah", "tankha", "vetan", "सैलरी", "पगार", "तनख्वाह", "वेतन"], courier: ["courier", "curier", "kuriyar", "parcel", "dak", "speed post", "कूरियर", "कुरियर", "पार्सल", "डाक"],
    travelling: ["petrol", "diesel", "auto", "rickshaw", "riksha", "taxi", "uber", "ola", "rapido", "bus", "train", "travel", "flight", "ticket", "पेट्रोल", "डीजल", "ऑटो", "रिक्शा", "टैक्सी", "ट्रेन", "बस", "टिकट"],
    transportation: ["tempo", "transport", "bhada", "hamal", "टेम्पो", "भाड़ा"], "electricity bills": ["bijli", "electricity", "light bill", "dgvcl", "torrent", "बिजली", "लाइट"],
    "telephone & internet charges": ["phone", "recharge", "internet", "wifi", "broadband", "jio", "airtel", "रिचार्ज", "इंटरनेट"], "display, boxes, trays etc": ["box", "dibba", "dabba", "pouch", "tray", "display", "packing", "डिब्बा", "डब्बा", "बॉक्स", "पाउच", "ट्रे"],
    "repairing and maintainace": ["repair", "marammat", "mistri", "plumber", "electrician", "ac service", "रिपेयर", "मरम्मत", "मिस्त्री"], maintainance: ["maintenance", "society", "मेंटेनेंस"],
    karigars: ["karigar", "kaarigar", "कारीगर"], "staff uniform": ["uniform", "यूनिफॉर्म"], "bonus diwali": ["bonus", "बोनस"], "legal charges": ["lawyer", "vakil", "legal", "वकील"],
    "sales promotion & advertisement": ["advertisement", "ad", "banner", "promotion", "pamphlet", "विज्ञापन"], "social media & advertisement exp": ["instagram", "facebook", "social", "meta ads"], "melting tunch etc": ["melting", "tunch", "गलाई"],
    "exhibition expenses": ["exhibition", "प्रदर्शनी"], "stall rent": ["stall"], "lic and insurances": ["lic", "insurance", "बीमा"], "miscl expenses": ["misc", "miscellaneous", "other", "baaki", "puja", "pooja", "agarbatti", "phool", "prasad", "फुटकर", "पूजा", "अगरबत्ती", "फूल", "प्रसाद"] };
  const STOPW = new Set(["expenses", "expense", "exp", "charges", "a/c", "etc", "and", "the", "purchase", "purchased", "new", "bills"]);
  const lev = (a, b) => { if (Math.abs(a.length - b.length) > 1) return 9; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  function parse(text, kind, cats, karigars) {
    const raw = DEVD(String(text || "")).replace(/(\d),(?=\d{2,3}\b)/g, "$1").replace(/₹\s*/g, "₹ ").trim(), low = raw.toLowerCase(), out = { amount: 0, mode: "", category: "", kar: "", to: "", note: "", mobile: "", party: "" };
    let toks = low.split(/\s+/).filter(Boolean), used = new Set();
    // a 10-digit mobile (spoken as groups) is never the amount
    const mm = low.match(/(?:^|\D)([6-9](?:[\s-]?\d){9})(?!\d)/); if (mm) { out.mobile = mm[1].replace(/\D/g, ""); }
    const isMob = i => out.mobile && /\d/.test(toks[i]) && out.mobile.includes(toks[i].replace(/\D/g, "")) && toks[i].replace(/\D/g, "").length >= 3;
    const cands = [];
    for (let i = 0; i < toks.length; i++) { if (isMob(i)) { used.add(i); continue; }
      const t = toks[i].replace(/^₹/, ""); let v = /^\d+(\.\d+)?$/.test(t) ? Number(t) : NUMW[t] != null ? NUMW[t] : null; if (v == null) continue; let k = i, mul = MULW[toks[i + 1]];
      if (/^\d+(\.\d+)?k$/.test(t)) { v = Number(t.slice(0, -1)) * 1000; }
      if (mul) { v *= mul; k = i + 1; const nx = toks[i + 2] && /^\d+$/.test(toks[i + 2]) ? Number(toks[i + 2]) : null; if (nx != null && nx < mul) { v += nx; k = i + 2; } }
      if (NUMW[t] != null && !mul) continue; // a lone 'do' / 'ek' is a word, not money
      const cur = CUR.test(toks[k + 1] || "") || CUR.test(toks[i - 1] || "") || /^₹/.test(toks[i]);
      cands.push({ v: Math.round(v), i, k, cur }); }
    if (cands.length) { const best = cands.find(c => c.cur) || cands.reduce((a, c) => c.v > a.v ? c : a, cands[0]); out.amount = best.v; for (let x = best.i; x <= best.k; x++) used.add(x);
      if (CUR.test(toks[best.k + 1] || "")) used.add(best.k + 1); if (CUR.test(toks[best.i - 1] || "")) used.add(best.i - 1); }
    toks.forEach((t, i) => { if (CUR.test(t)) used.add(i); });
    for (const [m, re] of Object.entries(MODEW)) if (re.test(low)) { out.mode = m; break; }
    toks.forEach((t, i) => { for (const re of Object.values(MODEW)) if (re.test(t)) used.add(i); });
    if (kind === "expense") {
      const kn = (karigars || []).find(k => low.includes(k.toLowerCase())); const karCat = (cats || []).find(c => c === (C.j && C.j.kar));
      let best = null, score = 0;
      (cats || []).forEach(c => { const words = (KW[c.toLowerCase()] || []).concat(c.toLowerCase().split(/[\/\s,&]+/).filter(w => w.length >= 3 && !STOPW.has(w))); let s = 0;
        words.forEach(w => { if (w.includes(" ") ? low.includes(w) : toks.some((t, i) => { return t === w || (w.length >= 4 && t.length >= 4 && lev(t, w) <= 1) || (w.length >= 5 && t.startsWith(w)); })) s++; });
        if (s > score) { score = s; best = c; } });
      if (kn && karCat) { best = karCat; out.kar = kn; toks.forEach((t, i) => { if (kn.toLowerCase().split(/\s+/).includes(t)) used.add(i); }); }
      out.category = best || "";
      const sn = (C.j && C.j.staff || []).find(s => new RegExp("(^|\\s)" + s.toLowerCase() + "(\\s|$)").test(low)); if (sn) { out.from = sn; toks.forEach((t, i) => { if (t === sn.toLowerCase() || t === "ne" || t === "ने") used.add(i); }); }
      const ko = raw.match(/(\S+(?:\s+(?:ji|जी|bhai|भाई|ben|बेन))?)\s+(?:ko|को)\b/i); if (ko) out.to = ko[1];
    }
    const filler = /^(ka|ki|ke|ko|diya|diye|di|de|dena|paid|pay|mein|me|se|का|की|के|को|दिया|दिए|दी|में|से|aur|और|liye|लिए|ka|hai|है|for|to|the|of)$/;
    const rest = raw.split(/\s+/).filter((t, i) => !used.has(i) && !(kind === "receipt" && filler.test(t.toLowerCase())));
    if (kind === "receipt") { out.party = out.mobile || rest.filter(t => !filler.test(t.toLowerCase())).join(" ").replace(/\s+(se|से)$/i, "").trim(); out.note = ""; }
    else out.note = rest.join(" ").replace(/^(ka|ki|ke|का|की|के)\s+/i, "").trim();
    return out;
  }
  window.vjCashParse = parse;
  async function fill(kind, text) {
    const j = C.j || {}, pre = kind === "receipt" ? "cr" : "cx", heard = $(pre + "Heard"); if (!heard) return;
    heard.hidden = false; heard.textContent = "Suna: “" + text + "”";
    let p = parse(text, kind, j.cats || [], j.karigars || []);
    const miss = kind === "expense" ? (!p.category || !p.amount) : !p.amount;
    if (miss) { heard.textContent += " - samajh rahe hain…";
      try { const a = await api("/api/vj/cash", { op: "parse", kind, text }); if (!p.amount && a.amount) p.amount = a.amount; if (!p.mode && a.mode) p.mode = a.mode;
        if (kind === "expense") { if (!p.category && a.category) p.category = a.category; if (!p.to && a.paidTo) p.to = a.paidTo; if (a.note && !p.note) p.note = a.note; } else if (!p.party && a.party) p.party = a.party;
        heard.textContent = "Suna: “" + text + "”"; } catch (e) { heard.textContent = "Suna: “" + text + "” (" + (e.message || e) + ")"; } }
    if (!$(pre + "Heard")) return; // closed meanwhile
    if (kind === "expense") { if (p.category) $("cxCat").value = p.category; if (p.kar) $("cxKar").value = p.kar; if (p.amount) $("cxAmt").value = String(p.amount); if (p.mode) $("cxMode").value = p.mode;
      if (p.to) $("cxTo").value = p.to; $("cxNote").value = p.note || text.slice(0, 120); if (p.from && [...$("cxFrom").options].some(o => o.value === p.from)) $("cxFrom").value = p.from; $("cxCat").dispatchEvent(new Event("change")); $("cxMode").dispatchEvent(new Event("change")); }
    else { if (p.amount) $("crAmt").value = String(p.amount); if (p.mode) { $("crMode").value = p.mode; $("crMode").dispatchEvent(new Event("change")); } if (p.party && !C.rc) { $("crQ").value = p.party; suggest(); } }
    heard.textContent += " → box check karke Save dabaiye."; // never saved by itself
  }

  // ---------- export ----------
  async function excel() { const mon = C.view === "month" ? $("cbMonth").value : $("cbDate").value.slice(0, 7), m = $("cbMsg"); m.textContent = "Making the Excel…";
    try { const r = await fetch("/api/vj/cash.xlsx?month=" + encodeURIComponent(mon), { credentials: "same-origin" }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
      const a = el("a", { href: URL.createObjectURL(await r.blob()), download: "VJ_Cash_Book_" + mon + ".xlsx" }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); m.textContent = ""; }
    catch (e) { m.textContent = "Could not make the Excel (" + (e.message || e) + ")."; } }
  function pdf() {
    const j = C.j; if (!j || !window.jspdf) { $("cbMsg").textContent = "PDF maker not loaded - reload the page."; return; }
    if (j.reg) { $("cbMsg").textContent = "For the register use Excel (month) - it lists every receipt."; return; }
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" }), W = 210, M = 14; let y = 18;
    const line = (t, x, sz, bold, al) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(sz || 11); doc.text(String(t), x, y, al ? { align: al } : undefined); };
    const nl = h => { y += h || 6; if (y > 280) { doc.addPage(); y = 18; } };
    const hr = () => { doc.setDrawColor(180); doc.line(M, y - 4, W - M, y - 4); };
    if (j.month) {
      line("Cash book - " + j.month.split("-").reverse().join("-"), M, 16, true); nl(9);
      const X = [M, 56, 80, 104, 128, 152, 176, W - M], H = ["Date", "Opening", "Cash in", "Expenses", "To owner", "Closing", "UPI/Bank in", "UPI/Bank out"], P = (t, i, b) => line(t, X[i], 9, b, i ? "right" : undefined);
      H.forEach((h, i) => P(h, i, true)); nl(3); hr(); nl(3);
      const v = x => x == null ? "-" : rs(x);
      (j.days || []).forEach(d => { [dmy(d.date), v(d.opening), d.cashIn ? rs(d.cashIn) : "", d.cashOut ? rs(d.cashOut) : "", d.handed ? rs(d.handed) : "", v(d.closing), d.upiIn + d.bankIn ? rs(d.upiIn + d.bankIn) : "", d.upiOut + d.bankOut ? rs(d.upiOut + d.bankOut) : ""].forEach((t, i) => P(t, i)); nl(6); });
      hr(); ["TOTAL", "", rs(j.tot.cashIn), rs(j.tot.cashOut), rs(j.tot.handed), "", rs(j.tot.upiIn + j.tot.bankIn), rs(j.tot.upiOut + j.tot.bankOut)].forEach((t, i) => P(t, i, true)); nl(8);
    } else {
      line("Cash book - " + dmy(j.date), M, 16, true); nl(10);
      const kv = (k, v, b) => { line(k, M, 12, b); line(v, W - M, 12, b, "right"); nl(7); };
      kv("Opening cash in hand", j.opening == null ? "-" : rs(j.opening), true);
      const sec = (title, rows, f) => { nl(2); line(title, M, 12, true); nl(6); hr();
        if (!rows.length) { line("Nothing entered.", M, 10); nl(6); }
        rows.forEach(e => { const [a, m] = f(e), tx = doc.splitTextToSize(a, 130); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(tx, M, y); line(m, 158, 10, false, "right"); line(rs(e.amount), W - M, 10, false, "right"); nl(5 * tx.length + 1); }); };
      const ins = j.lines.filter(e => e.dir === "in" && e.src !== "mv"), outs = j.lines.filter(e => e.dir === "out" && e.src !== "mv"), mvs = j.lines.filter(e => e.src === "mv");
      if (mvs.length) sec("Staff cash moves (not income / expense)", mvs, e => [(e.kind === "give" ? "Store -> " + e.staff : e.staff + " -> store" + (e.tick ? "" : " (to receive)")) + (e.note ? " - " + e.note : ""), "Cash"]);
      sec("Received", ins, e => [[e.party, e.src === "rc" ? e.bill || "on account" : "", e.src === "rc" ? e.id : "", e.note].filter(Boolean).join(" - "), e.mode === "cash" ? "Cash" : e.mode === "upi" ? "UPI" : "Bank"]);
      sec("Paid / expenses / handed to owner", outs, e => [e.src === "hand" ? "Handed to owner - " + [e.party, e.id].filter(Boolean).join(" - ") : [e.cat, e.to, e.note].filter(Boolean).join(" - "), e.mode === "cash" ? "Cash" : e.mode === "upi" ? "UPI" : "Bank"]);
      nl(3); hr(); kv("+ Cash received", rs(j.tot.cashIn)); kv("- Cash expenses", rs(j.tot.cashOut)); kv("- Cash handed to owner", rs(j.tot.handed)); kv("= Closing cash in hand", j.closing == null ? "-" : rs(j.closing), true);
      nl(2); kv("UPI / Bank received (not cash)", rs(j.tot.upiIn + j.tot.bankIn)); kv("UPI / Bank paid (not cash)", rs(j.tot.upiOut + j.tot.bankOut)); if (j.pend) kv("Bank pending check (all days)", rs(j.pend.bankPend) + " (" + j.pend.nBank + ")");
    }
    nl(6); line("Printed " + dmy(today()) + " " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), M, 9);
    doc.save("VJ_Cash_Book_" + (j.month || j.date) + ".pdf");
  }

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
  // ---------- CASH COUNT / RECONCILE (Abhinav only): book vs counted -> one difference line; older lines archived ----------
  function cashCount(holder) { const j = C.j || {}, d = overlay(`<div class="hd"><h2>Cash count / Reconcile</h2></div>
      <div class="row"><label>Whose cash <select id="ccH"></select></label><label>Date <input id="ccD" type="date"></label><label>Time <input id="ccT" type="time"></label><label>Cash counted (₹) <input id="ccA" inputmode="numeric"></label></div>
      <p class="hint" id="ccB">Type the cash actually counted, then Check.</p>
      <div class="actions"><button type="button" class="btn ghost" id="ccChk">Check</button><button type="button" class="btn" id="ccOk" disabled>Confirm</button><button type="button" class="btn ghost" id="ccU">Undo last count</button><button type="button" class="btn ghost" id="ccX">Cancel</button></div><p class="hint" id="ccM"></p>`);
    opts($("ccH"), [["store", "Cash at store"]].concat((j.staff || []).map(s => [s, s + "'s float"])), holder || "store"); $("ccD").value = dayOf(); $("ccD").max = today(); $("ccT").value = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(11, 16);
    let P = null; const body = () => ({ op: "count", holder: $("ccH").value, date: $("ccD").value, time: $("ccT").value, counted: $("ccA").value.replace(/[,\s]/g, "") });
    ["ccH", "ccD", "ccA"].forEach(i => $(i).addEventListener("input", () => { P = null; $("ccOk").disabled = true; }));
    $("ccChk").addEventListener("click", async () => { try { P = await api("/api/vj/cash", body()); $("ccB").textContent = `Book ${inr(P.book)} · counted ${inr(P.counted)} · difference ${P.diff > 0 ? "excess " + inr(P.diff) + " (extra income)" : P.diff < 0 ? "short " + inr(-P.diff) + " (cash shortage)" : "none"}`; $("ccOk").disabled = false; } catch (e) { $("ccB").textContent = e.message || String(e); } });
    $("ccOk").addEventListener("click", async () => { if (!P || !confirm(`Book becomes ${inr(P.counted)} on ${dmy(P.date)} (difference ${inr(P.diff)}). Older lines are archived (kept). OK?`)) return;
      try { await api("/api/vj/cash", Object.assign(body(), { expect: P.book })); close(); $("cbMsg").textContent = "Cash reconciled: " + inr(P.counted) + "."; load(); } catch (e) { $("ccM").textContent = "Not saved (" + (e.message || e) + ")."; } });
    $("ccU").addEventListener("click", async () => { if (!confirm("Undo the last cash count of " + $("ccH").selectedOptions[0].textContent + "?")) return; try { await api("/api/vj/cash", { op: "cundo", holder: $("ccH").value }); close(); load(); } catch (e) { $("ccM").textContent = "Not undone (" + (e.message || e) + ")."; } });
    $("ccX").addEventListener("click", close); void d; }
  // ---------- STAFF SETTLEMENT 'Hisab lo' (Abhinav, Shilpiji, Mihir) ----------
  function hisab(h) { const j = C.j || {}, s = h.sett || { given: 0, spent: 0, returned: 0 }, d = overlay(`<div class="hd"><h2>Hisab lo - ${h.name}</h2></div>
      <p class="hint">Since the last settlement${s.since ? " (" + dmy(s.since) + ")" : ""}: given ${inr(s.given)} · already spent ${inr(s.spent)} · returned ${inr(s.returned)} · now with ${h.name}: <b>${inr(h.bal)}</b></p>
      <div id="hsL" style="display:flex;flex-direction:column;gap:8px"></div><button type="button" class="add" id="hsAdd">+ Expense line (Hisab diya)</button>
      <div class="row"><label>Cash returned (₹) <input id="hsR" inputmode="numeric"></label><label>Date <input id="hsD" type="date"></label></div>
      <p class="banner ok" id="hsLive" style="margin:0"></p>
      <div class="actions"><button type="button" class="btn" id="hsOk">Save hisab</button><button type="button" class="btn ghost" id="hsX">Cancel</button></div><p class="hint" id="hsM"></p>`);
    $("hsD").value = dayOf(); $("hsD").max = today();
    const live = () => { const sp = [...document.querySelectorAll(".hsA")].reduce((a, i) => a + (Number(i.value.replace(/[,\s]/g, "")) || 0), 0), r = Number($("hsR").value.replace(/[,\s]/g, "")) || 0, bal = h.bal - sp - r;
      $("hsLive").textContent = `With ${h.name} now ${inr(h.bal)} − expenses ${inr(sp)} − returned ${inr(r)} = ${bal >= 0 ? "still with " + h.name + " " + inr(bal) : "we owe " + h.name + " " + inr(-bal) + " (spent extra)"}`; $("hsLive").className = "banner " + (bal >= 0 ? "ok" : "warn"); };
    const add = () => { const r = el("div", { className: "row hsl" }), c = el("select", { className: "hsC" }); opts(c, [["", "Head…"]].concat((j.cats || []).map(x => [x, x])));
      const n = el("input", { className: "hsN", placeholder: "Narration (required)", maxLength: 120 }), a = el("input", { className: "hsA", placeholder: "₹", inputMode: "numeric", maxLength: 10 }), ph = el("input", { type: "file", accept: "image/*", className: "hsP" });
      a.addEventListener("input", live); ph.addEventListener("change", async () => { const f = ph.files[0]; if (!f) return; try { const b = await shrink(f), x = await fetch("/api/vj/photo", { method: "POST", credentials: "same-origin", headers: { "content-type": "image/jpeg" }, body: b }), jj = await x.json(); if (!x.ok) throw new Error(jj.error); ph.dataset.id = jj.id; $("hsM").textContent = "Photo added."; } catch (e) { $("hsM").textContent = "Photo not added (" + (e.message || e) + ")."; } });
      [[c, "2 1 160px"], [n, "3 1 200px"], [a, "1 1 90px"], [ph, "1 1 120px"]].forEach(([x, fl]) => { const l = el("label"); l.style.flex = fl; l.append(x); r.append(l); }); $("hsL").append(r); };
    add(); live(); $("hsAdd").addEventListener("click", add); $("hsR").addEventListener("input", live); $("hsX").addEventListener("click", close);
    $("hsOk").addEventListener("click", async () => { const lines = [...document.querySelectorAll(".hsl")].map(r => ({ cat: r.querySelector(".hsC").value, note: r.querySelector(".hsN").value.trim(), amount: r.querySelector(".hsA").value.replace(/[,\s]/g, ""), photo: r.querySelector(".hsP").dataset.id || "" })).filter(l => l.cat || l.amount || l.note);
      if (lines.some(l => !l.cat || !l.amount || l.note.length < 2)) { $("hsM").textContent = "Each line needs a head, a narration and the amount."; return; } $("hsOk").disabled = true;
      try { const r = await api("/api/vj/cash", { op: "settle", staff: h.name, date: $("hsD").value, lines, ret: $("hsR").value.replace(/[,\s]/g, "") }); close(); $("cbMsg").textContent = `Hisab saved for ${h.name}: expenses ${inr(r.spent)}, returned ${inr(r.returned)}, balance ${r.bal >= 0 ? inr(r.bal) + " with " + h.name : "we owe " + inr(-r.bal)}.`; load(); }
      catch (e) { $("hsM").textContent = "Not saved (" + (e.message || e) + ")."; $("hsOk").disabled = false; } }); void d; }
  // ---------- SUNDRY DEBTORS block inside the accounts section (owner) ----------
  async function debtInit() { const sec = $("p-vchain"), cb = $("crBox"); if (!sec || !cb || $("dbBox")) return;
    const box = el("div", { id: "dbBox", style: "display:flex;flex-direction:column;gap:8px;margin-top:10px" }); box.innerHTML = `<div class="crbar"><h3 style="margin:0;flex:1 1 auto">Sundry debtors (customers)</h3><input id="dbQ" placeholder="Name / mobile" style="width:180px"></div>
      <div class="list"><table class="items" style="min-width:0;width:100%"><thead><tr><th>Party</th><th>Mobile</th><th style="text-align:right">Balance ₹</th><th style="text-align:right">Fine g</th><th></th></tr></thead><tbody id="dbRows"></tbody></table></div><p class="hint" id="dbMsg">Bills, + Pay, receipts, discounts and old gold come in by themselves (same data as the Ledger tab).</p>`;
    cb.after(box); $("dbQ").addEventListener("input", debtRows); debtLoad(); document.querySelector("nav").addEventListener("click", e => { const x = e.target.closest("button[data-tab]"); if (x && x.dataset.tab === "vchain") debtLoad(); }); }
  async function debtLoad() { try { CR.d = await api("/api/vj/debtors"); debtRows(); } catch (e) { $("dbMsg").textContent = "Could not load debtors (" + (e.message || e) + ")."; } }
  function debtRows() { const j = CR.d; if (!j) return; const q = $("dbQ").value.trim().toLowerCase(), tb = $("dbRows"); tb.textContent = "";
    j.list.filter(d => !q || (d.name + " " + d.mobile).toLowerCase().includes(q)).forEach(d => { const tr = el("tr"); [[d.name + (d.city ? ", " + d.city : "")], [d.mobile || "—"], [inr(d.balance), 1], [d.fineDue ? Number(d.fineDue).toFixed(3) : "", 1]].forEach(([v, r]) => tr.append(el("td", { textContent: v, style: r ? "text-align:right" : "" })));
      const x = el("td"); x.append(btn("Ledger", "ghost", () => debtStmt(d))); tr.append(x); tb.append(tr); });
    const tr = el("tr", { style: "font-weight:700" }); [["TOTAL (" + j.list.length + ")"], [""], [inr(j.total), 1], [j.fine ? Number(j.fine).toFixed(3) : "", 1], [""]].forEach(([v, r]) => tr.append(el("td", { textContent: v, style: r ? "text-align:right" : "" }))); tb.append(tr); }
  async function debtStmt(dd, hist) { let s; try { s = await api("/api/vj/ledger?key=" + encodeURIComponent(dd.key) + (hist ? "&hist=1" : "")); } catch (e) { $("dbMsg").textContent = "Could not open (" + (e.message || e) + ")."; return; }
    const d = overlay(`<div class="hd"><h2>${s.customer.name} · ${s.customer.mobile || ""}</h2></div><p class="hint">Balance ${inr(s.customer.balance)}${s.customer.fineDue ? " · fine " + Number(s.customer.fineDue).toFixed(3) + " g" : ""}</p>
      <div class="tblw"><table class="cbm"><thead><tr><th>Date</th><th>Voucher</th><th>Narration</th><th>Dr ₹</th><th>Cr ₹</th><th>Bal ₹</th><th>Dr g</th><th>Cr g</th><th>Fine bal g</th></tr></thead><tbody id="dsT"></tbody></table></div>
      <div class="actions" id="dsA"><button type="button" class="btn ghost" id="dsX">Close</button></div>`); d.classList.add("wide");
    s.ledger.forEach(l => { const tr = el("tr"); [dmy(l.date), l.vch || "", l.part, l.dr ? inr(l.dr) : "", l.cr ? inr(l.cr) : "", inr(l.bal), l.fdr ? l.fdr.toFixed(3) : "", l.fcr ? l.fcr.toFixed(3) : "", Number(l.fbal || 0).toFixed(3)].forEach((v, i) => { const td = el("td", { textContent: v }); if (i === 2) { td.style.textAlign = "left"; td.style.whiteSpace = "normal"; } tr.append(td); }); $("dsT").append(tr); });
    const A = $("dsA"), again = () => { close(); debtLoad(); debtStmt(dd); };
    if (s.canRecon) { A.prepend(btn("Reconcile…", "", () => reconDlg("cust", dd.key, s.customer.name, again))); if (s.recon) A.append(btn("Undo last reconcile", "ghost", () => window.vjReconUndo("cust", dd.key, again))); if (s.recon || s.hist) A.append(btn(s.hist ? "Hide reconciled history" : "Show reconciled history", "ghost", () => { close(); debtStmt(dd, !s.hist); })); }
    $("dsX").addEventListener("click", close); }
  // ---------- CREDITOR ACCOUNTS inside Sundry Creditors (owner 14:51; Abhinav / Shilpiji only - the server checks /api/vj/creditors) ----------
  const CR = { j: null };
  function credInit() { const sec = $("p-vchain"); if (!sec || $("crBox")) return; const me = (window.__vjMe || {}); void me;
    const box = el("div", { id: "crBox", style: "display:flex;flex-direction:column;gap:8px" }); box.innerHTML = `<div class="crbar"><h3 style="margin:0;flex:1 1 auto">Creditor accounts</h3>
      <select id="crGrp" aria-label="Group"><option value="">All groups</option></select><select id="crAct" aria-label="Show"><option value="">Active</option><option value="all">With inactive</option></select>
      <button type="button" class="btn" id="crPay">+ Payment</button><button type="button" class="btn ghost" id="crBill">+ Bill</button><button type="button" class="btn ghost" id="crNew">+ Account</button></div>
      <div class="list"><table class="items" style="min-width:0;width:100%"><thead><tr><th>Account</th><th>Group</th><th style="text-align:right">Balance ₹ (we owe)</th><th style="text-align:right">Fine g</th><th></th></tr></thead><tbody id="crRows"></tbody></table></div><p class="hint" id="crMsg"></p>`;
    const h = sec.querySelector("h2"); (h || sec.firstChild).after(box);
    $("crGrp").addEventListener("change", credRows); $("crAct").addEventListener("change", credRows);
    $("crPay").addEventListener("click", () => window.vjCashCred("cpay")); $("crBill").addEventListener("click", () => window.vjCashCred("cbill")); $("crNew").addEventListener("click", () => credAcct(null));
    document.querySelector("nav").addEventListener("click", e => { const x = e.target.closest("button[data-tab]"); if (x && x.dataset.tab === "vchain") credLoad(); }); credLoad(); }
  async function credLoad() { try { CR.j = await api("/api/vj/creditors"); const g = $("crGrp"), v = g.value; opts(g, [["", "All groups"]].concat(CR.j.groups.map(x => [x, x])), v); credRows(); } catch (e) { $("crMsg").textContent = "Could not load creditor accounts (" + (e.message || e) + ")."; } }
  window.vjCredRefresh = () => { if ($("crBox")) credLoad(); };
  function credRows() { const j = CR.j; if (!j) return; const g = $("crGrp").value, all = $("crAct").value === "all", tb = $("crRows"); tb.textContent = ""; let tot = 0;
    j.accts.filter(a => (!g || a.group === g) && (all || a.active)).forEach(a => { tot += a.bal; const tr = el("tr"); [[a.name + (a.active ? "" : " (inactive)") + (a.mobile ? " · " + a.mobile : "")], [a.group], [inr(a.bal), 1], [a.group === "Gold" ? Number(a.fine || 0).toFixed(3) : "", 1]].forEach(([v, r]) => tr.append(el("td", { textContent: v, style: r ? "text-align:right;font-variant-numeric:tabular-nums" : "" })));
      const x = el("td", { style: "white-space:nowrap" }); x.append(btn("Statement", "ghost", () => credStmt(a)), " ", btn("Pay", "ghost", () => window.vjCashCred("cpay", a.id))); tr.append(x); tb.append(tr); });
    const tr = el("tr", { style: "font-weight:700" }); [["TOTAL"], [""], [inr(tot), 1], [""], [""]].forEach(([v, r]) => tr.append(el("td", { textContent: v, style: r ? "text-align:right" : "" }))); tb.append(tr);
    $("crMsg").textContent = j.unlinked.length ? "Vendors not linked to an account yet: " + j.unlinked.map(u => u.vendor + " (" + u.n + ", " + inr(u.amt) + ")").join(", ") + " - open the account > Edit > add the vendor name under 'Vendor names'." : "Chain purchases (vendor chains sold / used, chain parts) come in by themselves, matched by vendor name."; }
  async function credStmt(a, hist) { let s; try { s = await api("/api/vj/creditors?id=" + encodeURIComponent(a.id) + (hist ? "&hist=1" : "")); } catch (e) { $("crMsg").textContent = "Could not open (" + (e.message || e) + ")."; return; }
    const gold = a.group === "Gold", d = overlay(`<div class="hd"><h2>${a.name} · ${a.group}</h2></div><p class="hint">Opening ${s.opening.date ? dmy(s.opening.date) : "(no date)"}: ${inr(s.opening.amt)}${gold ? " · " + Number(s.opening.fine).toFixed(3) + " g" : ""} · Balance now <b>${inr(s.bal)}</b>${gold ? " · " + Number(s.fine).toFixed(3) + " g" : ""}</p>
      <div class="tblw"><table class="cbm"><thead><tr><th>Date</th><th>Particulars</th><th>Bill / purchase ₹</th><th>Paid ₹</th>${gold ? "<th>Fine +/− g</th>" : ""}<th>Balance ₹</th></tr></thead><tbody id="csT"></tbody></table></div>
      <div class="actions" id="csAct"><button type="button" class="btn" id="csP">+ Payment</button><button type="button" class="btn ghost" id="csE">Edit account</button><button type="button" class="btn ghost" id="csX">Close</button></div>`); d.classList.add("wide");
    if (s.canRecon) { const again = () => { close(); credLoad(); credStmt(a); }, A = $("csAct"); A.append(btn("Reconcile…", "ghost", () => reconDlg("cred", a.id, a.name, again))); if (s.reconUpto) A.append(btn("Undo last reconcile", "ghost", () => window.vjReconUndo("cred", a.id, again))); if (s.reconUpto || hist) A.append(btn(hist ? "Hide reconciled history" : "Show reconciled history", "ghost", () => { close(); credStmt(a, !hist); })); }
    const T = $("csT"); s.lines.forEach(l => { const tr = el("tr"); [dmy(l.date), l.descr + (l.byName ? " · " + l.byName : ""), l.cr ? inr(l.cr) : "", l.dr ? inr(l.dr) : ""].concat(gold ? [(l.crFine - l.drFine) ? (l.crFine - l.drFine).toFixed(3) : ""] : []).concat([inr(l.bal)]).forEach((v, i) => { const td = el("td", { textContent: v }); if (i === 1) { td.style.textAlign = "left"; td.style.whiteSpace = "normal"; } tr.append(td); }); T.append(tr); });
    if (!s.lines.length) T.append(el("tr", null, [el("td", { textContent: "No entries yet.", colSpan: 6 })]));
    $("csP").addEventListener("click", () => window.vjCashCred("cpay", a.id)); $("csE").addEventListener("click", () => credAcct(a)); $("csX").addEventListener("click", close); }
  function credAcct(a) { const j = CR.j || { groups: [] }, ed = !!a;
    overlay(`<div class="hd"><h2>${ed ? "Edit account" : "New creditor account"}</h2></div>
      <div class="row"><label style="flex:2 1 220px">Name <input id="caN" maxlength="60"></label><label>Group <select id="caG"></select></label><label>Mobile <input id="caM" inputmode="tel" maxlength="14"></label></div>
      <div class="row"><label>Opening ₹ (optional) <input id="caO" inputmode="numeric"></label><label id="caFl">Opening fine g <input id="caF" inputmode="decimal"></label><label>As on <input id="caD" type="date"></label></div>
      <label>Vendor names that feed this account (comma) <input id="caL" maxlength="300" placeholder="e.g. Siddharth"></label>
      ${ed ? '<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="caA" style="width:auto"> Active (untick = inactive; never deleted)</label>' : ""}
      <div class="actions"><button type="button" class="btn" id="caOk">Save</button><button type="button" class="btn ghost" id="caX">Cancel</button></div><p class="hint" id="caMsg"></p>`);
    opts($("caG"), j.groups.map(g => [g, g]), ed ? a.group : "Diamonds / chain"); const ui = () => { $("caFl").hidden = $("caG").value !== "Gold"; }; $("caG").addEventListener("change", ui);
    if (ed) { $("caN").value = a.name; $("caM").value = a.mobile || ""; $("caO").value = a.openAmt ? String(a.openAmt) : ""; $("caF").value = a.openFine ? String(a.openFine) : ""; $("caD").value = a.openDate || ""; $("caL").value = (a.links || []).join(", "); $("caA").checked = a.active; } ui();
    $("caX").addEventListener("click", close);
    $("caOk").addEventListener("click", async () => { const b = { op: "acct", id: ed ? a.id : undefined, name: $("caN").value.trim(), group: $("caG").value, mobile: $("caM").value.trim(), openAmt: $("caO").value, openFine: $("caF").value, openDate: $("caD").value, links: $("caL").value.split(",").map(s => s.trim()).filter(Boolean), active: ed ? $("caA").checked : true };
      try { await api("/api/vj/creditors", b); close(); credLoad(); } catch (e) { $("caMsg").textContent = "Not saved (" + (e.message || e) + ")."; } }); }
  setInterval(() => { if (C.j && C.j.canEdit) { credInit(); debtInit(); } else if (!C.j && $("p-vchain") && !CR.tried) { CR.tried = true; api("/api/vj/cash?date=" + today()).then(j => { C.j = C.j || j; if (j.canEdit) credInit(); }).catch(() => {}); } }, 1500);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
