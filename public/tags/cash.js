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
/*@P2*/
/*@P3*/
