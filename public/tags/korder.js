/* VJ Tags - Karigar order v2 (owner Abhinav 02/11/2026 15:44, 16:45, 16:51 + his karigar workbook; C-20261102-KORDER3). The paper karigar order slip as a tab.
   Order no. series PER KARIGAR, stage (Design, CAD, Ghaat, Setting, Polish, Ready ...) updated by staff any time, a 'Pending deliveries' screen laid out like the
   owner's sheet (one block per karigar: Code / Customer / Item / Stage / Estimate, karigar Total / Due on top), pricing basis (rate fixed / gold to gold),
   diamonds issued / received back / used, delivery figures (TAG USE ONLY), the karigar account (gold balance, cash to pay - cash for Abhinav / Shilpiji only),
   'Create tag from this' (fills the New tag form), A5 print, Excel, and an admin import from the karigar workbook (read on this page, karigar sheets only).
   The server checks and works out every figure again; staff add and move forward, Abhinav / Shilpiji edit / cancel (old version kept), sales only reads.
   C-20261102-KSETTLE (owner 17:17): labour grade A / B per order, monthly settlement per karigar (A4 statement, Excel, month locked until reopened with a reason). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const r3 = n => (Math.round((Number(n) || 0) * 1000) / 1000).toFixed(3);
  const inr = n => "\u20b9" + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const num = v => { const x = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(x) ? x : 0; };
  const ST = { open: "Open", karigar: "With karigar", received: "Received", tagged: "Tagged", cancelled: "Cancelled" }, NEXT = { open: "karigar", karigar: "received", received: "tagged" };
  const SHAPES = ["Round", "Baguette", "Oval", "Pear", "Marquise", "Princess", "Emerald", "Other"], SIZED = ["Ring", "Bangle", "Earring", "Bali"];
  const CATMAP = { Ring: "VLR", Earring: "VER", Bali: "VER", Bracelet: "VBR", Bangle: "VBN", Pendant: "VP", "Pendant set": "VPS", Necklace: "VNS", Mangalsutra: "VMN", Chain: "CH", "Nose pin": "VNP" };
  let sec = null, J = null, cur = null, drawing = "", view = "pend";
  const live = o => o.status === "open" || o.status === "karigar";
  const post = async body => { const r = await fetch("/api/vj/korder", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || r.status); e.j = j; throw e; } return j; };
  /* owner 17:04 / 17:02: over-issue needs a second explicit confirm; a quality clash can be overridden by Abhinav / Shilpiji with a reason */
  async function postC(body) { try { return await post(body); } catch (e) { const j = e.j || {};
      if (j.needConfirm && window.confirm(j.error)) return post(Object.assign({}, body, { confirmOver: true }));
      if (J && J.admin && /^Wrong quality issued/.test(e.message)) { const w = window.prompt(e.message.replace(/ \(Abhinav.*$/, "") + "\n\nIssue anyway? Type the reason:"); if (w && w.trim()) return post(Object.assign({}, body, { override: w.trim() })); }
      throw e; } }
  const tot = t => t && (t.pcs || t.ct) ? t.pcs + " pcs / " + Number(t.ct).toFixed(3) + " ct" : "-";
  const css = `#p-korder .kosum{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}#p-korder .kosum span{border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-weight:600}
#p-korder .kobox{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0}#p-korder .kobox h3{margin:0 0 6px}
#p-korder .kodraw{max-width:100%;max-height:340px;border:1px solid var(--line);border-radius:8px;display:block;margin-top:6px}
#p-korder tr.kox td{opacity:.5;text-decoration:line-through}#p-korder .kolate{color:var(--bad);font-weight:700}
#p-korder .kodia td input{width:84px}#p-korder .kodia td select{width:110px}#p-korder .kostat{font-weight:700}#p-korder.konoadm .koRate,#p-korder.konoadm .koAdm{display:none}
#p-korder .kotabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}#p-korder .kotabs .btn[aria-pressed="true"]{background:var(--gold);color:#fff;border-color:var(--gold)}
#p-korder .kopend{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px}#p-korder .kopend table{width:100%;font-size:15px}
#p-korder .kopend h3{margin:0;padding:6px 8px;background:var(--gold-soft);border:1px solid var(--gold);border-radius:8px 8px 0 0;font-size:16px}
#p-korder .koprev{font-variant-numeric:tabular-nums;background:var(--ok-soft);border:1px solid var(--ok);border-radius:8px;padding:6px 10px;margin:6px 0}`;

  async function load() { const m = $("koMsg");
    try { const r = await fetch("/api/vj/korders", { credentials: "same-origin", cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); J = j;
      sec.classList.toggle("konoadm", !j.admin); $("koAdd").hidden = !j.canAdd; ["koXl", "koXlP", "koPrP"].forEach(i => { $(i).hidden = !j.canAdd; }); $("koSetB").hidden = !j.admin;
      const fill = (id, list, first) => { const s = $(id), v = s.value; s.textContent = ""; if (first) s.appendChild(el("option", { value: "", textContent: first })); list.forEach(x => s.appendChild(el("option", { value: x, textContent: x }))); s.value = v; };
      fill("koFK", ks(), "All karigars"); fill("koItem", j.items || [], "- item -"); fill("koColour", j.golds || [], "-"); fill("koKt", j.kts || [], "-"); fill("koStage", j.stages || [], "- stage -");
      { const q = $("koDq"), v = q.value; q.textContent = ""; q.appendChild(el("option", { value: "", textContent: "LGD (CVD) - default" })); /* 17:02: a simple choice - Natural (quality) or LGD (shape) */
        [["LGD", "LGD (CVD)"], ["Natural", "Natural"]].forEach(([t, n]) => { const g = el("optgroup", { label: n }); (j.codes || []).filter(c => c.type === t && !/broken/i.test(c.desc)).forEach(c => g.appendChild(el("option", { value: c.code, textContent: (t === "LGD" ? c.desc : "Natural " + (c.round ? "Round " : "") + c.desc) + " (" + c.code + ")" }))); q.appendChild(g); }); q.value = v; }
      const dl = $("koCodesDl"); dl.textContent = ""; (j.codes || []).forEach(c => dl.appendChild(el("option", { value: c.code, label: c.desc + " \u00b7 " + c.type })));
      const tl = $("koTrDl"); tl.textContent = ""; (j.trates || []).forEach(t => tl.appendChild(el("option", { value: t.name, label: "tag \u20b9" + t.rate + "/pc" })));
      summary(); render(); if (cur) { const o = (j.orders || []).find(x => x.id === cur.id); if (o) openOrder(o, true); }
    } catch (e) { if (m) m.textContent = "Could not load karigar orders (" + (e.message || e) + ")."; } }
  const ks = () => [...new Set((J.karigars || []).concat(Object.keys(J.kcfg || {})).concat((J.orders || []).map(o => o.karigar).filter(Boolean)))];
  function summary() { const b = $("koSum"); b.textContent = ""; const L = J.orders || [], c = s => L.filter(o => o.status === s).length;
    ["open", "karigar", "received", "tagged", "cancelled"].forEach(s => b.append(el("span", { textContent: ST[s] + ": " + c(s) })));
    const od = L.filter(o => o.overdue).length; if (od) b.append(el("span", { className: "kolate", textContent: "Overdue: " + od })); }
  function render() { document.querySelectorAll("#koTabs .btn").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === view ? "true" : "false")); $("koFilt").hidden = view !== "all";
    const box = $("koList"); box.textContent = ""; if (view === "pend") return pending(box); if (view === "acct") return account(box); all(box); }
  function all(box) { const k = $("koFK").value, s = $("koFS").value, od = $("koFO").checked, q = String($("koQ").value || "").trim().toLowerCase();
    const rows = (J.orders || []).filter(o => (!k || o.karigar === k) && (!s || o.status === s) && (!od || o.overdue) && (!q || [o.no, o.itemTxt, o.name, o.city, o.karigar, o.dq, o.stage].join(" ").toLowerCase().includes(q))).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.no - a.no);
    const t = el("table", { className: "items" }), hr = el("tr"), tb = el("tbody");
    ["Karigar", "Order no.", "Date", "Item", "Party", "Del date", "Stage", "Status", "Diamonds pending", ""].forEach(h => hr.appendChild(el("th", { textContent: h })));
    rows.forEach(o => { const tr = el("tr", { className: o.status === "cancelled" ? "kox" : "" }), td = (x, cl) => tr.appendChild(el("td", { className: cl || "", textContent: x == null ? "" : x }));
      td(o.karigar); td(o.no); td(dmy(o.date)); td([o.itemTxt, o.size, o.kt ? o.kt + (o.kt === "PT" ? "" : "KT") : "", o.colour].filter(Boolean).join(" \u00b7 ")); td(o.name ? [o.name, o.city].filter(Boolean).join(", ") + (o.mobile ? " \u00b7 " + o.mobile : "") : "Stock");
      const dd = el("td", { textContent: dmy(o.delDate) + (o.overdue ? " (overdue)" : "") }); if (o.overdue) dd.className = "kolate"; tr.appendChild(dd); td(o.stage || "-");
      tr.appendChild(el("td", { className: "kostat", textContent: ST[o.status] || o.status })); td(tot(o.diaPend), "num");
      const x = el("td"); x.style.whiteSpace = "nowrap"; const ob = el("button", { type: "button", className: "btn ghost", textContent: "Open" }); ob.addEventListener("click", () => openOrder(o));
      const pb = el("button", { type: "button", className: "btn ghost", textContent: "\u{1F5A8} Print" }); pb.addEventListener("click", () => print(o, pb)); x.append(ob, pb); tr.appendChild(x); tb.appendChild(tr); });
    if (!rows.length) tb.appendChild(el("tr", {}, [el("td", { colSpan: 10, className: "hint", textContent: "No orders here." })]));
    t.append(el("thead", {}, [hr]), tb); t.style.minWidth = "980px"; box.appendChild(el("div", { className: "list" }, [t])); }
  // ---------- Pending deliveries (the owner's daily sheet) ----------
  function pendBlocks() { const L = (J.orders || []).filter(live); return ks().filter(k => L.some(o => o.karigar === k)).map(k => { const rows = L.filter(o => o.karigar === k).sort((a, b) => a.no - b.no), ph = (J.pendHead || {})[k], total = ph ? ph.total : 0, due = ph ? ph.due : 0; /* worked out by the server, as on the owner's sheet */
      return { k, rows, total, due, est: rows.reduce((a, o) => a + (Number(o.estimate) || 0), 0) }; }); }
  function pending(box) { const B = pendBlocks(); if (!B.length) { box.appendChild(el("p", { className: "hint", textContent: "Nothing pending with any karigar." })); return; }
    const g = el("div", { className: "kopend" });
    B.forEach(b => { const t = el("table", { className: "items" }), hr = el("tr"), tb = el("tbody"); ["Code", "Customer", "Item", "Stage", "Estimate"].forEach(h => hr.appendChild(el("th", { textContent: h })));
      b.rows.forEach(o => { const tr = el("tr"), cd = el("td"), a = el("button", { type: "button", className: "btn ghost", textContent: String(o.no) }); a.style.padding = "2px 8px"; a.addEventListener("click", () => openOrder(o)); cd.appendChild(a); tr.appendChild(cd);
        tr.appendChild(el("td", { textContent: o.name || "Stock" })); tr.appendChild(el("td", { textContent: o.itemTxt }));
        const sc = el("td"); if (J.canAdd) { const s = el("select"); [""].concat(J.stages || []).forEach(x => s.appendChild(el("option", { value: x, textContent: x || "-" }))); s.value = o.stage || "";
            s.addEventListener("change", async () => { s.disabled = true; try { await post({ op: "stage", id: o.id, stage: s.value }); o.stage = s.value; $("koMsg").textContent = o.karigar + " " + o.no + ": stage " + (s.value || "-") + "."; } catch (e) { $("koMsg").textContent = "Not saved: " + (e.message || e) + "."; } s.disabled = false; }); sc.appendChild(s); } else sc.textContent = o.stage || "-";
        tr.appendChild(sc); const ec = el("td", { className: "num", textContent: o.estimate ? String(o.estimate) : "" }); if (o.overdue) { ec.title = "Overdue (del date " + dmy(o.delDate) + ")"; tr.style.color = "var(--bad)"; } tr.appendChild(ec); tb.appendChild(tr); });
      tb.appendChild(el("tr", {}, [el("td", { colSpan: 4, textContent: b.rows.length + " pcs pending", style: "font-weight:700" }), el("td", { className: "num", textContent: String(Math.round(b.est * 100) / 100), style: "font-weight:700" })]));
      t.append(el("thead", {}, [hr]), tb); g.appendChild(el("div", {}, [el("h3", { textContent: b.k + "   Total " + b.total.toFixed(2) + "   Due " + b.due.toFixed(2) + (J.pendHead && J.pendHead[b.k] ? "" : "   (no account)") }), el("div", { className: "list" }, [t])])); });
    box.append(el("p", { className: "hint", textContent: "As on the Excel sheet: Total = fine credited to the karigar (deliveries + wastage + the fine of pieces in work) minus gold given. Due = Total minus the fine of pieces still at no stage / Hold / Design / CAD. Change the stage right here." }), g); }
  async function printPending(btn) { if (!window.jspdf) return; btn.disabled = true;
    try { const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" }), W = 297, M = 8, B = pendBlocks(), per = Math.min(3, Math.max(1, B.length)), bw = (W - 2 * M - (per - 1) * 4) / per;
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Vaishnavi Jewels - Pending deliveries " + dmy(today()), M, 12);
      let x = M, y0 = 18, row = 0; B.forEach((b, i) => { if (i && i % per === 0) { row++; doc.addPage(); x = M; } x = M + (i % per) * (bw + 4); let y = y0;
        doc.setFontSize(11.5); doc.setFont("helvetica", "bold"); doc.text(b.k + "  Total " + b.total.toFixed(2) + "  Due " + b.due.toFixed(2), x, y); y += 3; doc.line(x, y, x + bw, y); y += 5;
        const cw = [0.17, 0.27, 0.17, 0.22, 0.17].map(f => f * bw), hd = ["Code", "Customer", "Item", "Stage", "Estimate"]; let cx = x; doc.setFontSize(10); hd.forEach((h, j) => { doc.text(h, cx, y); cx += cw[j]; }); y += 2; doc.line(x, y, x + bw, y); y += 5; doc.setFont("helvetica", "normal");
        b.rows.forEach(o => { cx = x; [String(o.no), o.name || "Stock", o.itemTxt, o.stage || "", o.estimate ? String(o.estimate) : ""].forEach((v, j) => { doc.text(String(v).slice(0, 16), cx, y); cx += cw[j]; }); y += 5.6; if (y > 200) { doc.addPage(); y = y0; } });
        doc.setFont("helvetica", "bold"); doc.text(b.rows.length + " pending   Estimate " + (Math.round(b.est * 100) / 100), x, y + 2); });
      const blob = doc.output("blob"); if (window.vjPrintBlob) window.vjPrintBlob(blob, $("koMsg")); else window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch (e) { $("koMsg").textContent = "Print not made (" + (e.message || e) + ")."; } btn.disabled = false; }
  // ---------- Karigar account ----------
  function account(box) { (J.account || []).filter(a => a.rows.length || a.openOrders).forEach(a => { const c = el("div", { className: "kobox" });
      c.append(el("h3", { textContent: a.karigar }), el("div", { textContent: "Gold balance (fine, given \u2212 used): " + r3(a.fine) + " g" + (a.fine < 0 ? " (we owe the karigar " + r3(-a.fine) + " g)" : a.fine > 0 ? " (karigar holds " + r3(a.fine) + " g of ours)" : "") + " \u00b7 gold issued since opening " + r3(a.goldIssued) + " g \u00b7 fine used " + r3(a.fineUsed) + " g" }),
        el("div", { textContent: "Open orders: " + a.openOrders + " \u00b7 diamonds pending: " + tot(a.diaPend) + (a.opening ? " \u00b7 opening " + dmy(a.opening.date) + ": " + r3(a.opening.fine) + " g" + (a.opening.cash != null ? ", " + inr(a.opening.cash) : "") : "") }));
      if (J.admin) { c.append(el("div", { style: "font-weight:700;font-size:18px", textContent: "Cash to pay: " + inr(a.cash) + "  (labour & charges " + inr(a.labour) + ", paid " + inr(a.paid) + ")" }));
        const amt = el("input", { placeholder: "\u20b9 paid", inputMode: "decimal", style: "width:110px" }), nt = el("input", { placeholder: "note", maxLength: 120 }), dt = el("input", { type: "date", value: today() }), pb = el("button", { type: "button", className: "btn ghost", textContent: "Enter payment" });
        pb.addEventListener("click", async () => { if (!(num(amt.value) > 0)) return; pb.disabled = true; try { await post({ op: "pay", karigar: a.karigar, cash: amt.value, date: dt.value, note: nt.value }); $("koMsg").textContent = "Payment entered for " + a.karigar + "."; await load(); } catch (e) { $("koMsg").textContent = "Not saved: " + (e.message || e) + "."; } pb.disabled = false; });
        c.append(el("div", { className: "row", style: "align-items:end" }, [dt, amt, nt, pb])); }
      const t = el("table", { className: "items" }), hr = el("tr"), tb = el("tbody"); ["Date", "Type", "Order", "Details", "Fine g"].concat(J.admin ? ["Cash \u20b9", ""] : []).forEach(h => hr.appendChild(el("th", { textContent: h })));
      if (J.admin) c.append(settleBox(a.karigar));
      a.rows.slice(-40).reverse().forEach(r => { const tr = el("tr", { className: r.status === "reversed" ? "kox" : "" }); [dmy(r.date), r.type === "pay" ? "cash given" : r.type === "excel" ? "Excel estimate" : r.type, r.no, r.descr, r.fine ? r3(r.fine) : ""].forEach(v => tr.appendChild(el("td", { textContent: v == null ? "" : String(v) })));
        if (J.admin) { tr.appendChild(el("td", { className: "num", textContent: r.cash ? inr(r.cash) : "" })); const x = el("td"); if (r.status === "ok" && !r.rev && (r.type === "pay" || r.type === "opening")) { const b = el("button", { type: "button", className: "btn ghost", textContent: "Reverse" });
            b.addEventListener("click", async () => { if (b.dataset.s !== "1") { b.dataset.s = "1"; b.textContent = "Sure?"; return; } try { await post({ op: "ledrev", id: r.id, why: prompt("Why? (optional)") || "" }); load(); } catch (e) { $("koMsg").textContent = "Not done: " + (e.message || e) + "."; } }); x.appendChild(b); } tr.appendChild(x); }
        tb.appendChild(tr); });
      t.append(el("thead", {}, [hr]), tb); c.append(el("div", { className: "list" }, [t])); box.appendChild(c); });
    if (!box.children.length) box.appendChild(el("p", { className: "hint", textContent: "No karigar account entries yet (import the opening balances from the Excel under Settings)." })); }

  // ---------- monthly settlement (owner 17:17): Abhinav / Shilpiji only ----------
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], monTxt = m => MON[Number(String(m).slice(5, 7)) - 1] + " " + String(m).slice(0, 4);
  function settleBox(k) { const box = el("div", { className: "kobox" }), mi = el("input", { type: "month", value: today().slice(0, 7), max: today().slice(0, 7) }), sb = el("button", { type: "button", className: "btn" }), msg = el("span", { className: "hint" });
    const lab = () => { sb.textContent = "Settle " + monTxt(mi.value || today().slice(0, 7)); }; lab(); mi.addEventListener("change", lab);
    sb.addEventListener("click", async () => { const m = mi.value; if (!m) return; if (sb.dataset.s !== m) { sb.dataset.s = m; sb.textContent = "Sure? Settle and lock " + k + " " + monTxt(m); return; } sb.disabled = true;
      try { const j = await post({ op: "settle", karigar: k, month: m }); msg.textContent = "Settled and locked - statement ready."; await load(); printStatement(j.settle); } catch (e) { msg.textContent = "Not settled: " + (e.message || e) + "."; } sb.disabled = false; sb.dataset.s = ""; lab(); });
    box.append(el("b", { textContent: "Monthly settlement " }), mi, sb, msg);
    (J.settles || []).filter(x => x.karigar === k).slice().reverse().forEach(st => { const z = st.snap, row = el("div", { className: "row", style: "align-items:center;margin-top:6px" });
      row.append(el("span", { style: "font-weight:700", textContent: monTxt(st.month) + (st.status === "locked" ? " \u00b7 locked" : " \u00b7 REOPENED") }), el("span", { textContent: "closing fine " + r3(z.closeFine) + " g \u00b7 cash " + inr(z.closeCash) + " (to pay " + inr(z.cashToPay) + ")" }));
      const pb = el("button", { type: "button", className: "btn ghost", textContent: "\u{1F5A8} Statement (A4)" }); pb.addEventListener("click", () => printStatement(st));
      const xb = el("button", { type: "button", className: "btn ghost", textContent: "Excel" }); xb.addEventListener("click", async () => { xb.disabled = true; try { const r = await fetch("/api/vj/korders?xlsx=settle&id=" + encodeURIComponent(st.id), { credentials: "same-origin", cache: "no-store" }); if (!r.ok) throw new Error(r.status); const a = el("a", { href: URL.createObjectURL(await r.blob()), download: "VJ_karigar_" + k + "_" + st.month + ".xlsx" }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); } catch (e) { msg.textContent = "Excel not made (" + (e.message || e) + ")."; } xb.disabled = false; });
      row.append(pb, xb);
      if (st.status === "locked") { const rb = el("button", { type: "button", className: "btn ghost", textContent: "Reopen" }); rb.addEventListener("click", async () => { const why = prompt("Why reopen " + k + " " + monTxt(st.month) + "? (kept in the history)"); if (!why || !why.trim()) return; try { await post({ op: "reopen", karigar: k, month: st.month, why: why.trim() }); msg.textContent = "Reopened - press Settle again when done."; await load(); } catch (e) { msg.textContent = "Not reopened: " + (e.message || e) + "."; } }); row.append(rb); }
      if ((st.hist || []).length > 1) row.append(el("span", { className: "hint", textContent: st.hist.map(h => h.act + " " + dmy(h.at) + " " + (h.byName || "") + (h.why ? " (" + h.why + ")" : "")).join(" \u00b7 ") }));
      box.append(row); });
    return box; }
  function printStatement(st) { if (!window.jspdf) { $("koMsg").textContent = "PDF maker did not load - reload the page."; return; } /* A4, large font, no party names (owner 17:17) */
    try { const z = st.snap, { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" }), W = 210, M = 14; let y = 18;
      const line = () => { doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 6; }, room = h => { if (y + h > 282) { doc.addPage(); y = 18; } };
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("Vaishnavi Jewels", M, y); y += 9; doc.setFontSize(16); doc.text("Karigar statement: " + st.karigar + " - " + monTxt(st.month), M, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text("Settled " + dmy(st.at) + (st.status === "locked" ? "" : " (reopened)"), M, y); y += 4; line();
      const kv = (k, v, b) => { room(9); doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(14); doc.text(k, M, y); doc.text(v, W - M, y, { align: "right" }); y += 8; };
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("GOLD (fine grams)", M, y); y += 8;
      kv("Opening balance", r3(z.openFine) + " g"); kv("+ Gold given (OG register)", r3(z.goldIssued) + " g"); kv("- Gold credited (deliveries + wastage)", r3(z.credited) + " g"); if (z.fineOther) kv("+ Other entries", r3(z.fineOther) + " g");
      kv("Closing gold balance", r3(z.closeFine) + " g" + (z.closeFine < 0 ? " (we owe " + r3(-z.closeFine) + " g)" : z.closeFine > 0 ? " (karigar holds " + r3(z.closeFine) + " g)" : ""), true); y += 2; line();
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("CASH (Rs)", M, y); y += 8; const rs = n => "Rs " + Math.round(Number(n) || 0).toLocaleString("en-IN");
      kv("Opening", rs(z.openCash)); kv("+ Labour & charges", rs(z.labour)); kv("- Cash given", rs(z.paid)); if (z.cashOther) kv("+ Other entries", rs(z.cashOther)); kv("Closing", rs(z.closeCash), true); kv("Cash to pay (rounded down to Rs 1,000)", rs(z.cashToPay), true); y += 2; line();
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("Entries this month", M, y); y += 7; doc.setFontSize(11.5);
      const cols = [[M, "Date"], [M + 26, "Order"], [M + 46, "Details"], [W - M - 30, "Fine g"], [W - M, "Rs"]]; cols.forEach(([x, h], i) => doc.text(h, x, y, i >= 3 ? { align: "right" } : {})); y += 2; doc.line(M, y, W - M, y); y += 6; doc.setFont("helvetica", "normal");
      z.rows.forEach(r => { const d = doc.splitTextToSize(String(r.descr || r.type), W - 2 * M - 46 - 50); room(6 * d.length + 1); doc.text(dmy(r.date), M, y); doc.text(String(r.no || ""), M + 26, y); doc.text(d, M + 46, y); doc.text(r.fine ? r3(r.fine) : "", W - M - 30, y, { align: "right" }); doc.text(r.cash ? Math.round(r.cash).toLocaleString("en-IN") : "", W - M, y, { align: "right" }); y += 6 * d.length; });
      if (!z.rows.length) { doc.text("No entries.", M, y); y += 6; } y += 3; room(20); line();
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("Pieces in work (" + z.pending.length + ")", M, y); y += 7; doc.setFontSize(11.5);
      [[M, "Code"], [M + 28, "Item"], [M + 92, "Stage"], [W - M - 30, "Est. gold g"], [W - M, "Est. fine g"]].forEach(([x, h], i) => doc.text(h, x, y, i >= 3 ? { align: "right" } : {})); y += 2; doc.line(M, y, W - M, y); y += 6; doc.setFont("helvetica", "normal");
      z.pending.forEach(p => { room(7); doc.text(String(p.no), M, y); doc.text(String(p.item + (p.kt ? " " + p.kt + (p.kt === "PT" ? "" : "KT") : "")).slice(0, 34), M + 28, y); doc.text(p.stage || "-", M + 92, y); doc.text(p.gwt ? r3(p.gwt) : "", W - M - 30, y, { align: "right" }); doc.text(p.fine ? r3(p.fine) : "", W - M, y, { align: "right" }); y += 6.5; });
      room(24); y += 12; doc.setFontSize(12); doc.text("Karigar sign: ____________________", M, y); doc.text("For Vaishnavi Jewels: ____________________", W - M, y, { align: "right" });
      const blob = doc.output("blob"); if (window.vjPrintBlob) window.vjPrintBlob(blob, $("koMsg")); else window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch (e) { $("koMsg").textContent = "Statement not made (" + (e.message || e) + ")."; } }

  // ---------- diamond rows ----------
  function diaRows(id, list, ro, used) { const tb = $(id); tb.textContent = ""; (list && list.length ? list : [{}]).forEach(d => tb.appendChild(diaRow(d, ro, used))); }
  function diaRow(d, ro, used) { const tr = el("tr"); d = d || {};
    [["pkt", "P42", 30], ["shape"], ["pcs", "0", 6], ["ct", "0.000", 9], ["rate", "\u20b9/ct", 9]].concat(used ? [["add", "10", 5]] : []).forEach(([k, ph, ml]) => { let i;
      if (k === "shape") { i = el("select", { disabled: !!ro }); i.appendChild(el("option", { value: "", textContent: "-" })); const l = SHAPES.slice(); if (d.shape && !l.includes(d.shape)) l.push(d.shape); l.forEach(x => i.appendChild(el("option", { value: x, textContent: x }))); i.value = d.shape || ""; }
      else { i = el("input", { value: d[k] != null && d[k] !== 0 ? String(d[k]) : "", placeholder: ph, maxLength: ml, disabled: !!ro }); if (k === "pkt") i.setAttribute("list", "koCodesDl"); else i.inputMode = "decimal"; }
      i.dataset.k = k; const c = el("td", {}, [i]); if (k === "rate") c.className = "koRate"; tr.appendChild(c); });
    if (used) tr.appendChild(el("td", { className: "num koTc" })); return tr; }
  const diaGet = id => [...$(id).querySelectorAll("tr")].map(tr => { const o = {}; tr.querySelectorAll("[data-k]").forEach(i => { o[i.dataset.k] = i.value.trim(); }); return o; }).filter(o => num(o.pcs) > 0 || num(o.ct) > 0);
  const diaCt = id => diaGet(id).reduce((a, x) => a + num(x.ct), 0);
  const diaTable = (id, addId, used) => el("div", {}, [el("div", { className: "list" }, [el("table", { className: "items kodia" }, [el("thead", {}, [el("tr", {}, ["Code / packet", "Shape", "Pcs", "Ct", "Rate \u20b9/ct"].concat(used ? ["Tag + %", "Tag ct"] : []).map((h, i) => el("th", { textContent: h, className: i === 4 ? "koRate" : "" })))]), el("tbody", { id })])]),
    el("button", { type: "button", className: "btn ghost", id: addId, textContent: "+ Add row" })]);
  const normCode = c => { const m = String(c || "").toUpperCase().replace(/\s+/g, "").match(/^P-?(\d+)([A-Z]?)/); return m ? "P-" + m[1] + m[2] : String(c || "").trim().toUpperCase(); }; /* 'P12/644', 'p 12' -> P-12 */
  const codeOf = c => (J.codes || []).find(x => x.code === normCode(c));
  const isSol = r => { const c = codeOf(r.pkt) || (r.pkt ? null : codeOf($("koDq").value)); return !!(c && (c.sol || c.type === "Solitaire")); };
  const normPkt = p => { const m = String(p || "").toUpperCase().replace(/\s+/g, "").match(/^P-?(\d+)([A-Z]?)(?:[\/\-](.*))?$/); return m ? "P-" + m[1] + m[2] + (m[3] ? "/" + m[3] : "") : String(p || "").trim().toUpperCase(); };
  function usedAuto() { const m = new Map(); diaGet("koIss2").forEach(r => { const pk = normPkt(r.pkt), k = pk + "|" + r.shape, e = m.get(k) || { pkt: pk, shape: r.shape, pcs: 0, ct: 0, rate: r.rate }; e.pcs += num(r.pcs); e.ct += num(r.ct); m.set(k, e); });
    diaGet("koRec").forEach(r => { const pk = normPkt(r.pkt), e = m.get(pk + "|" + r.shape) || [...m.values()].find(x => x.pkt === pk && (x.pcs > 0 || x.ct > 0)) || [...m.values()].find(x => x.pkt.split("/")[0] === pk.split("/")[0] && (x.pcs > 0 || x.ct > 0)); if (e) { e.pcs -= num(r.pcs); e.ct -= num(r.ct); } }); /* same packet; lot / shape may be left out on the received row */
    diaRows("koUsed", [...m.values()].filter(e => e.pcs > 0 || e.ct > 0).map(e => ({ pkt: e.pkt, shape: e.shape, pcs: Math.max(0, e.pcs), ct: r3(Math.max(0, e.ct)), rate: e.rate })), false, true); rPrev(); }

  // ---------- drawing photo ----------
  async function shrink(file) { const url = URL.createObjectURL(file); try { const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      for (const [mx, q] of [[1600, 0.82], [1300, 0.75], [1000, 0.7], [800, 0.65]]) { const s = Math.min(1, mx / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        const b = await new Promise(ok => c.toBlob(ok, "image/jpeg", q)); if (b && b.size <= 300 * 1024) return b; if (mx === 800) return b; } } finally { URL.revokeObjectURL(url); } }
  async function upload(file) { const m = $("koDrawMsg"); m.textContent = "Making the photo smaller\u2026";
    try { const b = await shrink(file); m.textContent = "Uploading (" + Math.round(b.size / 1024) + " KB)\u2026";
      const r = await fetch("/api/vj/photo", { method: "POST", credentials: "same-origin", headers: { "content-type": "image/jpeg" }, body: b }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status);
      drawing = j.id; $("koDrawImg").src = "/_blob/" + j.id; $("koDrawImg").hidden = false; m.textContent = "Drawing added - press Save."; } catch (e) { m.textContent = "Photo not added (" + (e.message || e) + ")."; } }

  // ---------- the order form ----------
  const F = ["koGrade", "koDate", "koItem", "koItemNote", "koSize", "koColour", "koGwt", "koKt", "koDq", "koDct", "koDctNote", "koName", "koMob", "koCity", "koDel", "koRate", "koBudget", "koBasis", "koOg", "koStage", "koEst", "koInstr", "koSetting", "koCs", "koKSel", "koKNew", "koNoIn"];
  function kSel(v) { const s = $("koKSel"); s.textContent = ""; s.appendChild(el("option", { value: "", textContent: "- pick the karigar -" })); const l = (J.karigars || []).slice(); if (v && !l.includes(v)) l.push(v);
    l.forEach(k => s.appendChild(el("option", { value: k, textContent: k }))); if (J.admin) s.appendChild(el("option", { value: "__new", textContent: "+ new karigar" })); s.value = v || ""; $("koKNew").hidden = true; $("koKNew").value = ""; }
  function ogSel(v) { const s = $("koOg"); s.textContent = ""; s.appendChild(el("option", { value: "", textContent: "- none -" })); const l = (J.freeOgs || []).slice(); if (v && !l.some(x => x.no === v)) l.push({ no: v, name: "(linked)" });
    l.forEach(x => s.appendChild(el("option", { value: x.no, textContent: "OG " + x.no + " \u00b7 " + x.name + (x.city ? ", " + x.city : "") }))); s.value = v || ""; }
  function syncForm() { const it = $("koItem").value; $("koSizeL").hidden = !SIZED.includes(it); $("koItemNote").placeholder = it === "Other" ? "type the item" : "e.g. Bali, design no."; const g = $("koBasis").value === "g2g"; $("koRateL").hidden = g;
    $("koDqInfo").textContent = cur && cur.dq && ![...$("koDq").options].some(x => x.value === cur.dq) ? "old code " + cur.dq : "";
    const k = $("koKSel").value; if (!cur && k && k !== "__new") $("koNoIn").placeholder = "blank = " + ((J.nextBy || {})[k] || 1); $("koKNew").hidden = k !== "__new"; }
  function newOrder() { cur = null; drawing = ""; kSel(""); ogSel(""); F.forEach(i => { if (!["koKSel", "koOg"].includes(i)) $(i).value = ""; }); $("koBasis").value = "rate"; $("koGrade").value = "A"; $("koDct").dataset.man = ""; $("koDate").value = today(); $("koNo").textContent = "New karigar order";
    $("koNoIn").placeholder = "pick the karigar"; $("koDrawImg").hidden = true; $("koDrawMsg").textContent = ""; diaRows("koIss", []); lock(false); diaLock(); $("koSave").hidden = false; $("koSave").textContent = "Save order"; $("koActs").hidden = true; $("koForm").hidden = false; $("koFMsg").textContent = ""; syncForm();
    window.scrollTo({ top: $("koForm").offsetTop - 10, behavior: "smooth" }); }
  function diaLock() { if (J.canDia) return; /* 17:04: diamond rows only for Fenil / Mihir / Abhinav (the 'diamonds' flag) - others see them read-only */
    ["koIss", "koRec", "koUsed", "koIssMore"].forEach(t => $(t).querySelectorAll("input,select").forEach(i => { if (i.dataset.k !== "add") i.disabled = true; })); ["koIssAdd", "koRecAdd", "koUsedAdd", "koUsedAuto"].forEach(i => { $(i).disabled = true; }); $("koDq").disabled = !!(cur && (cur.iss || []).length); }
  function lock(ro) { F.forEach(i => { $(i).disabled = ro; }); $("koDrawF").disabled = ro; $("koDrawCam").disabled = ro; $("koIssAdd").disabled = ro; $("koIss").querySelectorAll("input,select").forEach(i => { i.disabled = ro; }); }
  function openOrder(o, keep) { cur = o; drawing = o.drawing || ""; kSel(o.karigar || ""); ogSel(o.ogNo || ""); $("koDct").dataset.man = "1";
    const v = { koDate: o.date, koItem: o.item, koItemNote: o.itemNote, koSize: o.size, koColour: o.colour, koGwt: o.gwt || "", koKt: o.kt, koDq: o.dq, koDct: o.dct || "", koDctNote: o.dctNote || "", koName: o.name, koMob: o.mobile, koCity: o.city, koDel: o.delDate,
      koRate: o.goldRate || "", koBudget: o.budget || "", koBasis: o.basis || "rate", koGrade: o.grade === "B" ? "B" : "A", koStage: o.stage || "", koEst: o.estimate || "", koInstr: o.instr, koSetting: o.setting, koCs: o.cs, koNoIn: o.no };
    Object.entries(v).forEach(([k, x]) => { $(k).value = x == null ? "" : String(x); });
    $("koDrawImg").hidden = !drawing; if (drawing) $("koDrawImg").src = "/_blob/" + drawing; $("koDrawMsg").textContent = "";
    diaRows("koIss", o.iss || []); const canEdit = J.canAdd && o.status !== "cancelled"; lock(!canEdit); $("koSave").hidden = !canEdit; if (!J.admin) { $("koKSel").disabled = true; $("koKNew").disabled = true; $("koNoIn").disabled = true; } diaLock(); $("koSave").textContent = "Update order " + o.no; $("koStage").disabled = !(J.canAdd && o.status !== "cancelled");
    $("koNo").textContent = o.karigar + " \u00b7 order no. " + o.no + " \u00b7 " + (ST[o.status] || o.status) + (o.stage ? " \u00b7 " + o.stage : "") + (o.overdue ? " \u00b7 OVERDUE" : "") + (o.cancelled ? " (" + dmy(o.cancelled.at) + (o.cancelled.why ? ", " + o.cancelled.why : "") + ")" : "") + (o.imported ? " \u00b7 from Excel" : "") + (o.editedByName ? " \u00b7 last change by " + o.editedByName : "");
    syncForm(); acts(o); $("koForm").hidden = false; if (!keep) { $("koFMsg").textContent = ""; window.scrollTo({ top: $("koForm").offsetTop - 10, behavior: "smooth" }); } }
  const VJS = s => ["open", "karigar", "received", "tagged"].indexOf(s);
  function acts(o) { $("koActs").hidden = false; const lv = o.status !== "cancelled", can = J.canAdd, kc = (J.kcfg || {})[o.karigar] || {}, mount = kc.type === "mounting";
    $("koDiaInfo").textContent = "Issued " + tot(o.diaIss) + " \u00b7 received back " + tot(o.diaRec) + " \u00b7 used " + tot(o.diaUsed) + " \u00b7 PENDING " + tot(o.diaPend) + (o.tagRate ? " \u00b7 tag gold rate (workbook 'Making') " + inr(o.tagRate) + "/g" : "");
    const sb = $("koStatusBtns"); sb.textContent = ""; if (can && lv && NEXT[o.status]) { const n = NEXT[o.status]; const b = el("button", { type: "button", className: "btn", textContent: n === "received" ? "Delivered - fill below" : "Mark: " + ST[n] });
        b.addEventListener("click", async () => { if (n === "received") { $("koRecBox").open = true; $("koRecBox").scrollIntoView({ behavior: "smooth" }); return; } await act({ op: "status", id: o.id, to: n }, "Now: " + ST[n] + "."); }); sb.appendChild(b); }
    if (J.admin) { if (lv) { const c = el("button", { type: "button", className: "btn ghost", textContent: "Cancel order" }); c.style.color = "var(--bad)"; c.addEventListener("click", async () => { if (c.dataset.s !== "1") { c.dataset.s = "1"; c.textContent = "Sure? Cancel " + o.karigar + " " + o.no; return; } const why = prompt("Why cancel? (optional)") || ""; await act({ op: "cancel", id: o.id, why }, "Order cancelled (kept, struck through; its karigar account entries reversed)."); }); sb.appendChild(c); }
      else { const r = el("button", { type: "button", className: "btn ghost", textContent: "Bring back (Open)" }); r.addEventListener("click", () => act({ op: "status", id: o.id, to: "open" }, "Order is open again.")); sb.appendChild(r); }
      if (lv && o.status !== "open") { const back = el("select"); back.appendChild(el("option", { value: "", textContent: "Move back to\u2026" })); ["open", "karigar", "received"].filter(s => VJS(s) < VJS(o.status)).forEach(s => back.appendChild(el("option", { value: s, textContent: ST[s] })));
        back.addEventListener("change", () => { if (back.value) act({ op: "status", id: o.id, to: back.value }, "Moved back to " + ST[back.value] + "."); }); sb.appendChild(back); } }
    $("koDiaAddBox").hidden = !(can && lv && J.canDia); diaRows("koIssMore", []);
    const t = o.tag || {}; $("koRecBox").hidden = !(lv || o.tag); const ro = !lv || !can || (!!o.tag && !J.admin), gB = !mount && o.grade === "B"; $("koMountF").hidden = !(mount || gB); $("koMRateL").hidden = !mount; $("koMSetL").hidden = !gB; $("koMNote").textContent = mount ? "Mounting karigar: fine = given wt \u00d7 tunch, amount = making \u20b9/g \u00d7 given wt (his sheet)." : gB ? "Grade B (stock mounting): gold used = net recd \u00d7 1.5 % + stones \u00d7 0.15 % \u2212 loss; labour = round \u00d7 5 + choki \u00d7 5 + (net + loss) g \u00d7 10 + CS (rates in Settings)." : "";
    diaRows("koIss2", o.iss || [], true); diaRows("koRec", o.rec || [], ro); diaRows("koUsed", o.tag ? (o.used || []) : [], ro, true);
    [["koTDate", t.date || today()], ["koTKt", t.kt || o.kt || ""], ["koTG", t.gGold || ""], ["koTCs", t.csWt || ""], ["koTD", o.tag && !t.dWtAuto ? r3(t.dWt) : ""], ["koTN", o.tag && t.nGoldMan ? r3(t.nGold) : ""], ["koTCsCost", t.csCost || ""],
      ["koTCsCh", o.tag && t.csChargeMan ? t.csCharge : ""], ["koTMk", t.making || ""], ["koTLab", t.lab || ""], ["koTDet", t.details || ""], ["koMNet", t.netRecd || ""], ["koMChoki", t.choki || ""], ["koMRound", t.round || ""], ["koMRate", t.mkRate || kc.making || ""], ["koMGiven", t.mGiven || ""], ["koMCs", t.setCs || ""]].forEach(([i, v]) => { $(i).value = String(v); $(i).disabled = ro; });
    const ob = $("koOth"); ob.textContent = ""; (t.others && t.others.length ? t.others : [{}]).forEach(x => ob.appendChild(othRow(x, ro)));
    ["koRecAdd", "koUsedAdd", "koOthAdd", "koUsedAuto"].forEach(i => { $(i).disabled = ro; }); $("koRecSave").hidden = ro; $("koRecSave").textContent = o.tag ? "Update delivery figures" : "Save - delivered";
    if (!o.tag && !ro) usedAuto(); diaLock(); rPrev();
    const cp = $("koCost"); cp.hidden = !(J.admin && o.cost); if (o.cost) { const c = o.cost; cp.textContent = "OUR COST (admin only; costing rates are notional): diamonds " + inr(c.dia) + (c.diaNeedRate.length ? " + rate needed for " + c.diaNeedRate.join(", ") : "") +
      (c.gold != null ? " \u00b7 gold " + r3(c.fine) + " g fine = " + inr(c.gold) : c.goldNote ? " \u00b7 gold: " + c.goldNote : " \u00b7 gold: after delivery") + (c.labour != null ? " \u00b7 karigar labour + CS + other " + inr(c.labour) : "") + " \u00b7 TOTAL " + inr(c.total) +
      (o.overIssues && o.overIssues.length ? " \u00b7 over-issue confirmed by " + o.overIssues.map(x => x.byName + " " + dmy(x.at)).join(", ") : "") + (o.overrides && o.overrides.length ? " \u00b7 quality override: " + o.overrides.map(x => x.why).join("; ") : ""); }
    const nt = document.querySelector('nav button[data-tab="new"]'); $("koTagB").hidden = !(o.tag && can && nt && !nt.hidden);
    const gl = $("koGoldInfo"), g = o.goldOut ? (J.outs || []).find(x => x.id === o.goldOut) : null; gl.textContent = o.goldOut ? "Gold issued for this order: " + (g ? dmy(g.date) + " \u00b7 " + r3(g.fine) + " g fine to " + g.karigar + (g.note ? " (" + g.note + ")" : "") : "linked OG OUT entry") : "No gold linked yet.";
    const gs = $("koGoldSel"); gs.textContent = ""; gs.appendChild(el("option", { value: "", textContent: "- link an existing OG OUT issue -" })); (J.outs || []).filter(x => x.karigar === o.karigar).forEach(x => gs.appendChild(el("option", { value: x.id, textContent: dmy(x.date) + " \u00b7 " + r3(x.fine) + " g" + (x.note ? " \u00b7 " + x.note : "") })));
    $("koGoldBox").hidden = !(can && lv) || (!!o.goldOut && !J.admin); }
  function othRow(x, ro) { x = x || {}; const tr = el("tr"); [["desc", "e.g. Polki setting", 40], ["pcs", "0", 6], ["kRate", "karigar \u20b9/pc", 9], ["tRate", "tag \u20b9/pc", 9]].forEach(([k, ph, ml]) => { const i = el("input", { value: x[k] != null && x[k] !== 0 ? String(x[k]) : "", placeholder: ph, maxLength: ml, disabled: !!ro }); i.dataset.k = k; if (k === "desc") i.setAttribute("list", "koTrDl"); else i.inputMode = "decimal"; tr.appendChild(el("td", {}, [i])); });
    tr.querySelector('[data-k="desc"]').addEventListener("change", e => { const t = (J.trates || []).find(z => z.name === e.target.value), tr2 = tr.querySelector('[data-k="tRate"]'); if (t && !tr2.value) tr2.value = String(t.rate); rPrev(); }); return tr; }
  const othGet = () => [...$("koOth").querySelectorAll("tr")].map(tr => { const o = {}; tr.querySelectorAll("[data-k]").forEach(i => { o[i.dataset.k] = i.value.trim(); }); return o; }).filter(o => o.desc && num(o.pcs) > 0);
  function rPrev() { const U = diaGet("koUsed"), uct = U.reduce((a, x) => a + num(x.ct), 0), g = num($("koTG").value), cs = num($("koTCs").value), dw = $("koTD").value.trim() === "" ? Math.round(uct / 5 * 1000) / 1000 : num($("koTD").value);
    const nA = g > 0 ? g - cs - dw : 0, csc = num($("koTCsCost").value), csCh = $("koTCsCh").value.trim() === "" ? (csc > 0 ? Math.ceil(csc * 2 / 500) * 500 : 0) : num($("koTCsCh").value), O = othGet();
    [...$("koUsed").querySelectorAll("tr")].forEach(tr => { const o = {}; tr.querySelectorAll("[data-k]").forEach(i => { o[i.dataset.k] = i.value.trim(); }); const add = o.add !== "" && o.add != null ? num(o.add) : isSol(o) ? 0 : 10, c = tr.querySelector(".koTc");
      if (c) c.textContent = num(o.ct) > 0 ? (Math.round(num(o.ct) * (1 + add / 100) * 100) / 100).toFixed(2) + " (+" + add + "%)" : ""; const ai = tr.querySelector('[data-k="add"]'); if (ai) ai.placeholder = String(isSol(o) ? 0 : 10); });
    $("koTDa").textContent = "auto " + r3(uct / 5); $("koTNa").textContent = g > 0 ? "auto " + r3(nA) : ""; $("koTCsCha").textContent = csc > 0 ? "auto " + inr(Math.ceil(csc * 2 / 500) * 500) : "";
    $("koRPrev").textContent = g > 0 ? "N GOLD " + r3($("koTN").value.trim() === "" ? nA : num($("koTN").value)) + " g \u00b7 D.WT " + r3(dw) + " g (used " + r3(uct) + " ct \u00f7 5) \u00b7 CS charge on tag " + inr(csCh) + " \u00b7 other charges: karigar " + inr(O.reduce((a, x) => a + num(x.pcs) * num(x.kRate), 0)) + ", tag " + inr(O.reduce((a, x) => a + num(x.pcs) * num(x.tRate), 0)) : "Type G.GOLD to see N GOLD."; }
  async function act(body, ok) { const m = $("koFMsg"); m.textContent = "Saving\u2026"; try { const j = await postC(body); m.textContent = ok || "Saved."; cur = j.order; await load(); } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; } }
  async function save() { const m = $("koFMsg"), ks0 = $("koKSel").value, karigar = ks0 === "__new" ? $("koKNew").value.trim() : ks0;
    const body = { op: cur ? "edit" : "new", id: cur ? cur.id : undefined, karigar, no: $("koNoIn").value.trim(), date: $("koDate").value, basis: $("koBasis").value, goldRate: $("koRate").value, budget: $("koBudget").value, ogNo: $("koOg").value,
      item: $("koItem").value, itemNote: $("koItemNote").value.trim(), size: $("koSize").value.trim(), colour: $("koColour").value, gwt: $("koGwt").value, kt: $("koKt").value, dq: $("koDq").value.trim(), dct: $("koDct").value, dctNote: $("koDctNote").value.trim(),
      name: $("koName").value.trim(), mobile: $("koMob").value.trim(), city: $("koCity").value.trim(), delDate: $("koDel").value, stage: $("koStage").value, estimate: $("koEst").value, grade: $("koGrade").value, drawing, iss: diaGet("koIss"), instr: $("koInstr").value.trim(), setting: $("koSetting").value, cs: $("koCs").value.trim() };
    if (!karigar) { m.textContent = "Pick the karigar (each karigar has his own order no. series)."; return; } if (!body.item && !body.itemNote) { m.textContent = "Pick the item."; return; }
    $("koSave").disabled = true; m.textContent = "Saving\u2026";
    try { const j = await postC(body); m.textContent = (cur ? "Updated " : "Saved ") + j.order.karigar + " order no. " + j.order.no + (j.order.name ? "" : " (stock order - no party)") + "."; cur = j.order; await load(); openOrder(j.order, true); } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; } $("koSave").disabled = false; }
  function saveRec() { if (!cur) return; const kc = (J.kcfg || {})[cur.karigar] || {};
    const body = { op: "receive", id: cur.id, tDate: $("koTDate").value, tKt: $("koTKt").value.trim(), gGold: $("koTG").value, csWt: $("koTCs").value, dWt: $("koTD").value.trim(), nGold: $("koTN").value.trim(), csCost: $("koTCsCost").value, csCharge: $("koTCsCh").value.trim(),
      others: othGet(), making: $("koTMk").value, lab: $("koTLab").value.trim(), details: $("koTDet").value.trim(), rec: diaGet("koRec"), used: diaGet("koUsed") };
    if (kc.type === "mounting" || cur.grade === "B") Object.assign(body, { mGiven: $("koMGiven").value, netRecd: $("koMNet").value, choki: $("koMChoki").value, round: $("koMRound").value, setCs: $("koMCs").value, mkRate: $("koMRate").value });
    act(body, "Delivery figures saved - karigar account updated."); }

  // ---------- Create tag from this order: fills the New tag form (nothing saved until Save there) ----------
  async function makeTag() { const o = cur; if (!o || !o.tag) return; const t = o.tag, nb = document.querySelector('nav button[data-tab="new"]'); if (!nb) return; nb.click(); await new Promise(r => setTimeout(r, 350)); const left = [], g = id => document.getElementById(id), fire = (e, ev) => e && e.dispatchEvent(new Event(ev || "input", { bubbles: true }));
    try { const kr = g(o.name ? "k-order" : "k-sale"); if (kr) { kr.checked = true; fire(kr, "change"); }
      if (o.name) { [["oName", o.name], ["oMob", o.mobile], ["oCity", o.city], ["oDue", o.delDate]].forEach(([i, v]) => { const e = g(i); if (e && v) { e.value = v; fire(e); } });
        if (o.basis === "rate" && o.goldRate) { g("oRate").value = String(o.goldRate); fire(g("oRate")); } else left.push("gold rate (F) for the order - this order is Gold to Gold" + (o.ogNo ? " (OG " + o.ogNo + ")" : "")); }
      const cat = CATMAP[o.item]; if (cat && g("cat")) { g("cat").value = cat; fire(g("cat"), "change"); } else left.push("category (" + o.itemTxt + ")");
      const gl = g("goldLines"); if (gl) { [...gl.children].slice(1).forEach(x => x.remove()); const r = gl.children[0], id = r && r.dataset.id;
        if (id) { const k = g("gk" + id), kt = (t.kt || o.kt) + "K"; if ([...k.options].some(x => x.value === kt)) { k.value = kt; fire(k, "change"); } else left.push("karat " + (t.kt || o.kt)); g("gn" + id).value = r3(t.nGold); fire(g("gn" + id)); } }
      const dl = g("diaLines"); if (dl && typeof window.addDia === "function") { dl.textContent = ""; (o.tagDia || []).forEach(d => { window.addDia(); const r = dl.lastElementChild, id = r && r.dataset.id; if (!id) return;
          const c = codeOf(d.pkt) || codeOf(o.dq), QM = { "P-2": "VS IJ", "P-3": "VS HI", "P-4": "VS GH", "P-7": "VVS EF" }, sh = c && c.sol ? "Solitaire" : c && /choki/i.test(c.desc) ? "Choki" : c && /polki/i.test(c.desc) ? "Polki" : (d.shape === "Round" || (c && (c.round || /round/i.test(c.desc)))) ? "Round" : "Fancy",
            q = !c || c.type === "LGD" ? "CVD" : QM[c.code] || "Other";
          g("ds" + id).value = sh; fire(g("ds" + id), "change"); g("dq" + id).value = q; fire(g("dq" + id), "change"); if (q === "Other") { g("dqo" + id).value = (d.pkt || o.dq || "").toUpperCase(); fire(g("dqo" + id)); }
          g("dp" + id).value = String(d.pcs || 0); fire(g("dp" + id)); g("dc" + id).value = Number(d.tagCt).toFixed(2); fire(g("dc" + id)); });
        if (!(o.tagDia || []).length) window.addDia(); } else left.push("diamond lines");
      const oa = g("otherAmt"); if (oa) { oa.value = String(Math.round((t.csCharge || 0) + (t.otherTag || 0))); fire(oa); }
      if (t.making > 0 && g("mkPerG")) { g("mkPerG").value = String(Math.round(t.making)); g("mkPerG").dataset.own = "1"; fire(g("mkPerG")); } else left.push("making per g (formula from the owner pending)");
      if (o.drawing && g("photo") && window.DataTransfer) { try { const b = await (await fetch("/_blob/" + o.drawing, { credentials: "same-origin" })).blob(), dt = new DataTransfer(); dt.items.add(new File([b], "order-" + o.no + ".jpg", { type: b.type || "image/jpeg" })); g("photo").files = dt.files; fire(g("photo"), "change"); } catch (e) { left.push("photo"); } }
    } catch (e) { left.push("some fields could not be filled (" + (e.message || e) + ")"); }
    left.unshift("design no.", "certificate", "diamond sale rate per ct (left at the default rate - the order's rates are purchase cost)");
    const box = g("koTagCopy") || el("div", { id: "koTagCopy", className: "card", style: "border:2px dashed var(--gold);padding:10px 12px;margin:8px 0" }); box.textContent = "";
    box.append(el("b", { textContent: "From " + o.karigar + " order " + o.no + (o.name ? " (order piece for " + o.name + ")" : " (stock)") + ": filled kind, party, category, karat + net gold " + r3(t.nGold) + " g, " + (o.tagDia || []).length + " diamond line(s) with +10% tag weight, other charges " + inr((t.csCharge || 0) + (t.otherTag || 0)) + " (CS " + inr(t.csCharge) + " + " + inr(t.otherTag) + ")" + (o.drawing ? ", photo = drawing" : "") + "." }),
      el("div", { textContent: "Still to type / check: " + left.join("; ") + ". Then Save the tag here, and mark the karigar order Tagged." }));
    const p = g("p-new"); if (p && !box.parentNode) p.prepend(box); window.scrollTo({ top: 0, behavior: "smooth" }); }

  // ---------- A5 print, the slip's layout ----------
  async function imgData(id) { try { const r = await fetch("/_blob/" + id, { credentials: "same-origin" }); if (!r.ok) return null; const b = await r.blob(); const d = await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); });
      const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = d; }); return { d, w: im.naturalWidth, h: im.naturalHeight }; } catch (e) { return null; } }
  async function print(o, btn) { if (!window.jspdf) { $("koMsg").textContent = "PDF maker did not load - reload the page."; return; } if (btn) btn.disabled = true;
    try { const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a5", orientation: "landscape" }), W = 210, H = 148, M = 6, X2 = W - M; doc.setDrawColor(40); doc.setTextColor(15); doc.setLineWidth(0.3);
      const fit = (s, w, fs) => { s = String(s == null ? "" : s); doc.setFontSize(fs); while (fs > 6 && doc.getTextWidth(s) > w) doc.setFontSize(fs -= 0.5); return s; };
      doc.rect(M, M, W - 2 * M, H - 2 * M);
      doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text("Vaishnavi Jewels", M + 3, M + 8); doc.setFontSize(10); doc.text("KARIGAR ORDER", M + 3, M + 13);
      doc.setFontSize(16); doc.text(o.name ? "ORDER" : "STOCK", X2 - 3, M + 10, { align: "right" }); /* 17:05: this print goes to the karigar - no party, money, rate or OG details */
      let y = M + 16; doc.line(M, y, X2, y); doc.setFontSize(13); doc.text("KARIGAR : " + (o.karigar || "") + "     ORDER NO : " + o.no + (o.stage ? "     STAGE : " + o.stage : ""), M + 3, y + 6); if (o.status === "cancelled") { doc.setTextColor(170, 30, 30); doc.text("CANCELLED", X2 - 3, y + 6, { align: "right" }); doc.setTextColor(15); }
      y += 8; doc.line(M, y, X2, y);
      const cols = [["ORDER NO", 15, o.no], ["DATE", 17, dmy(o.date)], ["ITEM", 24, o.itemTxt], ["SIZE", 10, o.size], ["GOLD Y/W/R", 14, o.colour], ["G.WT", 13, o.gwt ? r3(o.gwt) : ""], ["KT", 10, o.kt], ["D.Q", 38, String(o.dqTxt || o.dq || "LGD").replace(/ \u00b7 [\d.]+ ct$/, "")], ["D.CT", 19, (o.dct ? r3(o.dct) : "") + (o.dctNote ? " " + o.dctNote : "")], ["DEL DATE", 18, dmy(o.delDate)]];
      let x = M; cols.forEach(([h, w, v], i) => { doc.setFont("helvetica", "bold"); doc.text(fit(h, w - 2, 7), x + w / 2, y + 4.2, { align: "center" }); doc.setFont("helvetica", "normal"); doc.text(fit(v, w - 2, 10.5), x + w / 2, y + 11, { align: "center" }); x += w; if (i < cols.length - 1) doc.line(x, y, x, y + 13.5); });
      doc.line(M, y + 6, X2, y + 6); y += 13.5; doc.line(M, y, X2, y);
      const DW = 118, bodyH = 62, xr = M + DW; doc.line(xr, y, xr, y + bodyH); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("DRAWING", M + DW / 2, y + 4, { align: "center" }); doc.line(M, y + 5.5, xr, y + 5.5);
      if (o.drawing) { const im = await imgData(o.drawing); if (im) { const bw = DW - 4, bh = bodyH - 8, s = Math.min(bw / im.w, bh / im.h), w = im.w * s, h = im.h * s; doc.addImage(im.d, "JPEG", M + 2 + (bw - w) / 2, y + 6.5 + (bh - h) / 2, w, h); } }
      const RW = X2 - xr, part = bodyH / 3, dsum = l => { const a = (l || []).reduce((s, x) => [s[0] + (Number(x.pcs) || 0), s[1] + (Number(x.ct) || 0)], [0, 0]); return a[0] + " pcs / " + a[1].toFixed(3) + " ct"; };
      [["DIAMOND ISSUED", o.iss], ["DIAMOND RECEIVED", o.rec], ["DIAMOND USED", o.used]].forEach(([h, l], i) => { const yy = y + i * part; if (i) doc.line(xr, yy, X2, yy); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(h, xr + RW / 2, yy + 4, { align: "center" }); doc.line(xr, yy + 5.5, X2, yy + 5.5);
        doc.setFont("helvetica", "normal"); (l || []).slice(0, 4).forEach((d, j) => doc.text(fit([d.pkt, d.shape].filter(Boolean).join("  ") + "   " + (d.pcs || 0) + " pcs   " + Number(d.ct || 0).toFixed(3) + " ct", RW - 4, 9.5), xr + 2, yy + 9.5 + j * 3.6));
        if ((l || []).length > 4) doc.text("+ " + ((l || []).length - 4) + " more \u00b7 total " + dsum(l), xr + 2, yy + part - 1); else if ((l || []).length > 1) { doc.setFont("helvetica", "bold"); doc.text(fit("Total " + dsum(l), RW - 4, 9), xr + 2, yy + part - 1); } });
      y += bodyH; doc.line(M, y, X2, y);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("SPECIAL INSTRUCTIONS", M + 2, y + 4); doc.text("SETTING : " + ["MICRO", "NIL", "MIXED"].map(s => s === o.setting ? "[" + s + "]" : s).join(" / "), M + 70, y + 4);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(doc.splitTextToSize(o.instr || "", W - 2 * M - 4).slice(0, 2), M + 2, y + 8.5); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("C/S TONES:", M + 2, y + 15.5); doc.setFont("helvetica", "normal"); doc.text(fit(o.cs || "", 160, 10), M + 22, y + 15.5);
      y += 17; doc.line(M, y, X2, y);
      const t = o.tag || {}, tc = [["", 22, "DETAILS"], ["DATE", 18, t.gGold ? dmy(t.date) : ""], ["KT", 12, t.kt || ""], ["G.GOLD", 19, t.gGold ? r3(t.gGold) : ""], ["CS WT", 17, t.gGold ? r3(t.csWt) : ""], ["D. WT", 17, t.gGold ? r3(t.dWt) : ""], ["N GOLD", 19, t.gGold ? r3(t.nGold) : ""], ["LAB", 16, t.lab || ""], ["CS RATE", 18, ""], ["OTHER CH.", 30, ""]];
      x = M; tc.forEach(([h, w, v], i) => { doc.setFont("helvetica", "bold"); doc.setFontSize(8); if (h) doc.text(h, x + w / 2, y + 4, { align: "center" }); doc.setFont("helvetica", i ? "normal" : "bold"); doc.text(fit(v, w - 2, i ? 10 : 9), x + w / 2, y + 10, { align: "center" }); x += w; if (i < tc.length - 1) doc.line(x, y, x, y + 12.5); });
      doc.line(M + 22, y + 5.5, X2, y + 5.5); y += 12.5; doc.line(M, y, X2, y); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("TAG USE ONLY", W / 2, y + 4, { align: "center" }); doc.line(M, y + 5.5, X2, y + 5.5);
      doc.setFont("helvetica", "normal"); doc.text(fit([(t.others || []).map(x => x.desc + " " + x.pcs + " pcs").join(", "), t.details].filter(Boolean).join(" \u00b7 "), W - 2 * M - 4, 9), M + 2, y + 10);
      const blob = doc.output("blob"); if (window.vjPrintBlob) window.vjPrintBlob(blob, $("koMsg")); else window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch (e) { $("koMsg").textContent = "Print not made (" + (e.message || e) + ")."; } if (btn) btn.disabled = false; }
  async function xl(kind, b) { b.disabled = true;
    try { const r = await fetch("/api/vj/korders?xlsx=" + kind, { credentials: "same-origin", cache: "no-store" }); if (!r.ok) throw new Error(r.status); const a = el("a", { href: URL.createObjectURL(await r.blob()), download: "VJ_karigar_" + (kind === "pending" ? "pending" : "orders") + "_" + dmy(today()) + ".xlsx" }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); }
    catch (e) { $("koMsg").textContent = "Excel not made (" + (e.message || e) + ")."; } b.disabled = false; }

  // ---------- Settings + import from the karigar workbook (admin) ----------
  function settings() { const box = $("koSet"); box.hidden = !box.hidden; if (box.hidden) return; box.textContent = ""; const K = J.kcfg || {};
    const t = el("table", { className: "items" }), hr = el("tr"); ["Karigar", "Type", "Next order no.", "A: Labour \u20b9/g", "Rhodium \u20b9/g", "A: Wastage %", "B: \u20b9/round pc", "B: \u20b9/choki pc", "B: \u20b9/g net", "B: \u20b9/g loss", "Tunch (mounting)", "Making \u20b9/g (mounting)"].forEach(h => hr.appendChild(el("th", { textContent: h }))); const tb = el("tbody");
    ks().forEach(k => { const v = K[k] || {}, tr = el("tr"); tr.dataset.k = k; tr.appendChild(el("td", { textContent: k })); const ty = el("select"); [["std", "standard"], ["mounting", "mounting"]].forEach(([a, b]) => ty.appendChild(el("option", { value: a, textContent: b }))); ty.value = v.type || "std"; ty.dataset.f = "type"; tr.appendChild(el("td", {}, [ty]));
      const g2 = v.g2 || {}; [["next", v.next || (J.nextBy || {})[k] || ""], ["labour", v.labour], ["rhodium", v.rhodium], ["ws", v.ws], ["g2.round", g2.round], ["g2.choki", g2.choki], ["g2.perG", g2.perG], ["g2.loss", g2.loss], ["tunch", v.tunch], ["making", v.making]].forEach(([f, x]) => { const i = el("input", { value: x == null ? "" : String(x), inputMode: "decimal", style: "width:80px" }); i.dataset.f = f; tr.appendChild(el("td", {}, [i])); }); tb.appendChild(tr); });
    t.append(el("thead", {}, [hr]), tb);
    const codes = el("textarea", { rows: 9, style: "width:100%", value: (J.codes || []).map(c => [c.code, c.desc, c.type, c.sol ? "solitaire" : "", c.round ? "round" : "", c.cost || ""].join(" | ")).join("\n") }), tr = el("textarea", { rows: 3, style: "width:100%", value: (J.trates || []).map(c => c.name + " | " + c.rate).join("\n") }), stg = el("input", { style: "width:100%", value: (J.stages || []).join(", ") });
    const sv = el("button", { type: "button", className: "btn", textContent: "Save settings" }), msg = el("p", { className: "hint" });
    sv.addEventListener("click", async () => { const kc = {}; [...tb.children].forEach(r => { const o = {}; const old = K[r.dataset.k] || {}; o.g2 = Object.assign({}, old.g2 || {}); r.querySelectorAll("[data-f]").forEach(i => { const f = i.dataset.f; if (f.startsWith("g2.")) { if (i.value.trim() !== "") o.g2[f.slice(3)] = num(i.value); } else o[f] = f === "type" ? i.value : num(i.value); }); kc[r.dataset.k] = Object.assign({}, old, o); });
      try { await post({ op: "cfg", kcfg: kc, codes: codes.value.split("\n").map(l => l.split("|").map(s => s.trim())).filter(a => a[0]).map(a => ({ code: a[0], desc: a[1] || "", type: a[2] || "LGD", sol: /sol/i.test(a[3] || ""), round: /round/i.test(a[4] || ""), cost: a[5] || "" })), trates: tr.value.split("\n").map(l => l.split("|").map(s => s.trim())).filter(a => a[0]).map(a => ({ name: a[0], rate: num(a[1]) })), stages: stg.value.split(",").map(s => s.trim()).filter(Boolean) });
        msg.textContent = "Saved."; await load(); } catch (e) { msg.textContent = "Not saved: " + (e.message || e) + "."; } });
    const uBox = el("div"), uMsg = el("p", { className: "hint" }), uSv = el("button", { type: "button", className: "btn ghost", textContent: "Save diamond permissions" });
    (J.users || []).forEach(u => uBox.appendChild(el("label", { style: "display:flex;flex-direction:row;gap:8px;align-items:center" }, [el("input", { type: "checkbox", checked: u.diamonds, value: u.email }), (u.name || u.email) + " \u00b7 " + u.email + " \u00b7 " + u.role])));
    uBox.appendChild(el("p", { className: "hint", textContent: "Abhinav and Shilpiji (owner logins) always handle diamonds. A login appears here once it exists in VJ Tags (e.g. Fenil) - tick it then and press Save. Logins in VJ Tags now: " + ((J.users || []).map(u => (u.name || u.email.split("@")[0]) + " (" + u.role + ")").join(", ") || "none") + "." }));
    uSv.addEventListener("click", async () => { try { await post({ op: "diaperm", emails: [...uBox.querySelectorAll("input:checked")].map(i => i.value) }); uMsg.textContent = "Saved."; await load(); } catch (e) { uMsg.textContent = "Not saved: " + (e.message || e) + "."; } });
    const fi = el("input", { type: "file", accept: ".xlsm,.xlsx" }), im = el("p", { className: "hint" }); fi.addEventListener("change", () => { const f = fi.files && fi.files[0]; if (f) importBook(f, im); fi.value = ""; });
    box.append(el("h3", { textContent: "Karigar settings (next order no. = number on his next blank slip)" }), el("div", { className: "list" }, [t]),
      el("p", { className: "hint", textContent: "From the workbook - grade A: fine credited = gold used x pure factor (14K .593, 9K .385, 18K .76; Badshah 14K .59) + gold used x w/s factor (.583 / .375 / .75) x wastage %; cash = labour \u20b9/g x gold used + rhodium \u20b9/g x gold used + stones. Grade B (stock mounting setting): gold used = net recd x 1.5 % + (choki + round pcs) x 0.15 % - loss, no wastage; labour = round pcs x B round + choki pcs x B choki + net g x B net + loss g x B loss + CS. Mounting (Priyank): fine = given wt x tunch, cash = making \u20b9/g x given wt." }),
      el("b", { textContent: "Diamond packet codes: code | description | Natural / LGD | solitaire (no +10%) | round (natural round quality - must match the order) | costing rate \u20b9/ct (notional, admin only; blank = type the packet's rate)" }), codes, el("b", { textContent: "Other charges - tag rate per pc (name | \u20b9)" }), tr, el("b", { textContent: "Stages (comma separated)" }), stg, el("div", { className: "actions" }, [sv]), msg,
      el("h3", { textContent: "Who handles diamonds (issue / receive back / used)" }), uBox, el("div", { className: "actions" }, [uSv]), uMsg,
      el("h3", { textContent: "Import pending orders + opening balances from the karigar workbook" }), el("p", { className: "hint", textContent: "Pick the .xlsm. Only the karigar sheets are read (Pending Deliveries, Montu / Hiru / Badshah / Mounting Priyank) - nothing else in the file is read or sent. Safe to run again: an order already here (same karigar + code) is skipped." }), fi, im); }
  function loadXlsx() { return window.XLSX ? Promise.resolve() : new Promise((ok, bad) => { const s = el("script", { src: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" }); s.onload = ok; s.onerror = () => bad(new Error("Excel reader did not load")); document.head.appendChild(s); }); }
  async function importBook(file, m) { m.textContent = "Reading\u2026";
    try { await loadXlsx(); const SHEETS = ["Pending Deliveries", "Montu -4", "Hiru-2", "Badshah 2", "Mounting Priyank"], wb = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, sheets: SHEETS, bookVBA: false });
      const cell = (sh, a) => { const s = wb.Sheets[sh]; const c = s && s[a]; return c ? c.v : null; }, d10 = v => v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : "";
      const rows = sh => window.XLSX.utils.sheet_to_json(wb.Sheets[sh] || {}, { header: 1, defval: null, raw: true });
      const MAP = { Montu: { sh: "Montu -4", code: 8, rate: 1, dd: 4, gw: 10, kt: 11, date: 9, est: 0, party: 2, item: 7, open: ["W1", "X1"] }, Hiru: { sh: "Hiru-2", code: 9, rate: 1, dd: 4, gw: 11, kt: 12, date: 10, est: 0, party: 2, item: 8, open: ["X1", "Y1"] },
        Badshah: { sh: "Badshah 2", code: 9, rate: 1, dd: 4, gw: 11, kt: 12, date: 10, est: 0, party: 2, item: 8, open: ["X1", "Y1"] } };
      const PD = rows("Pending Deliveries"), orders = [], openings = [], seen = {};
      [["Montu", 0], ["Hiru", 6], ["Badshah", 12]].forEach(([k, c]) => { const R = rows(MAP[k].sh), mp = MAP[k];
        PD.slice(3, 61).forEach(r => { const code = r[c]; if (typeof code !== "number" || code < 100) return; const src = R.find(x => x[mp.code] === code) || [];
          orders.push({ karigar: k, no: code, party: r[c + 1] || src[mp.party] || "", item: r[c + 2] || src[mp.item] || "", stage: r[c + 3] || "", est: r[c + 4] || src[mp.est] || 0, rate: src[mp.rate] || 0, dd: d10(src[mp.dd]), gw: src[mp.gw] || 0, kt: src[mp.kt] || "", date: "" }); seen[k] = (seen[k] || 0) + 1; });
        const f = cell(mp.sh, mp.open[0]), cs = cell(mp.sh, mp.open[1]); if (typeof f === "number" || typeof cs === "number") openings.push({ karigar: k, fine: Math.round((f || 0) * 1000) / 1000, cash: cs || 0 }); });
      const pf = cell("Mounting Priyank", "O1"), pc = cell("Mounting Priyank", "U1"); if (typeof pf === "number" || typeof pc === "number") openings.push({ karigar: "Priyank", fine: -Math.round((pf || 0) * 1000) / 1000, cash: Math.round((pc || 0) * 100) / 100 });
      m.textContent = "Found " + orders.length + " pending orders (" + Object.entries(seen).map(([k, n]) => k + " " + n).join(", ") + ") and opening balances for " + openings.map(o => o.karigar + " (fine " + o.fine + " g, cash " + inr(o.cash) + ")").join(", ") + ". Importing\u2026";
      const j = await post({ op: "import", orders, openings }); m.textContent = "Imported: " + Object.entries(j.result.orders).map(([k, n]) => k + " " + n).join(", ") + " orders sent (already-present ones skipped), " + j.result.openings + " opening balance rows (once per karigar). " + m.textContent.split(". Importing")[0] + "."; await load();
    } catch (e) { m.textContent = "Import stopped: " + (e.message || e) + "."; } }

  function show(on) { if (!sec) return; sec.hidden = !on;
    if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "korder" ? "true" : "false")); load(); window.scrollTo({ top: 0 }); } }
  let tries = 0;
  function build() { const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-korder")) return;
    const og = $("t-ogreg"); if (!og && ++tries < 8) { setTimeout(build, 500); return; }
    document.head.appendChild(el("style", { textContent: css }));
    const b = el("button", { id: "t-korder", textContent: "Karigar order" }); b.setAttribute("role", "tab"); b.dataset.tab = "korder"; b.setAttribute("aria-selected", "false");
    const after = og || nav.querySelector('[data-tab="bill"]'); nav.insertBefore(b, after ? after.nextSibling : null);
    sec = el("section", { className: "card", id: "p-korder", hidden: true });
    const inp = (id, ph, extra) => Object.assign(el("input", { id, placeholder: ph || "", autocomplete: "off" }), extra || {});
    const lab = (t, i, st, id) => el("label", Object.assign(st ? { style: st } : {}, id ? { id } : {}), [t + " ", i]);
    const sel = (id, opts) => { const s = el("select", { id }); opts.forEach(([v, t]) => s.appendChild(el("option", { value: v, textContent: t }))); return s; };
    const auto = id => el("span", { className: "hint", id });
    const form = el("div", { id: "koForm", className: "kobox", hidden: true }, [el("h3", { id: "koNo", textContent: "New order" }),
      el("div", { className: "row" }, [lab("Karigar", el("span", {}, [el("select", { id: "koKSel" }), inp("koKNew", "new karigar's name", { maxLength: 40, hidden: true })])), lab("Order no. (his series)", inp("koNoIn", "", { maxLength: 8, inputMode: "numeric" })),
        lab("Pricing", sel("koBasis", [["rate", "Gold rate fixed"], ["g2g", "Gold to Gold"]])), lab("Gold rate \u20b9/g", inp("koRate", "", { maxLength: 10, inputMode: "decimal" }), "", "koRateL"), lab("Budget \u20b9", inp("koBudget", "", { maxLength: 12, inputMode: "decimal" })), lab("Party OG (optional)", el("select", { id: "koOg" }))]),
      el("div", { className: "row" }, [lab("Date", inp("koDate", "", { type: "date" })), lab("Item", el("select", { id: "koItem" })), lab("", inp("koItemNote", "", { maxLength: 60 })), lab("Size", inp("koSize", "", { maxLength: 20 }), "", "koSizeL"), lab("Gold", el("select", { id: "koColour" })),
        lab("G.WT g (estimate)", inp("koGwt", "", { maxLength: 10, inputMode: "decimal" })), lab("KT", el("select", { id: "koKt" })),
        lab("Labour grade", sel("koGrade", [["A", "A - normal (wastage + labour per g)"], ["B", "B - stock mounting (setting)"]]))]),
      el("div", { className: "row" }, [lab("D.Q (diamond quality)", el("span", {}, [el("select", { id: "koDq" }), auto("koDqInfo")])), lab("D.CT (requirement, ct)", inp("koDct", "", { maxLength: 10, inputMode: "decimal" })), lab("D.CT note", inp("koDctNote", "e.g. R+O+B", { maxLength: 30 })),
        lab("Stage", el("select", { id: "koStage" })), lab("Estimate", inp("koEst", "", { maxLength: 12, inputMode: "decimal" }))]),
      el("div", { className: "row" }, [lab("Party name (blank = stock)", inp("koName", "type 2+ letters", { maxLength: 60 })), lab("Mobile", inp("koMob", "98xxxxxxxx", { maxLength: 20, inputMode: "tel" })), lab("City", inp("koCity", "", { maxLength: 40 })), lab("Del date", inp("koDel", "", { type: "date" }))]),
      el("div", { className: "kobox" }, [el("b", { textContent: "Drawing " }), el("input", { type: "file", id: "koDrawF", accept: "image/*" }), el("button", { type: "button", className: "btn ghost", id: "koDrawCam", textContent: "\u{1F4F7} Take photo" }), el("input", { type: "file", id: "koDrawCamIn", accept: "image/*", capture: "environment", hidden: true }),
        el("span", { className: "hint", id: "koDrawMsg" }), el("img", { id: "koDrawImg", className: "kodraw", alt: "Drawing", hidden: true })]),
      el("div", { className: "kobox" }, [el("b", { textContent: "Diamonds issued (leave empty for a gold-only job)" }), diaTable("koIss", "koIssAdd")]),
      el("div", { className: "row" }, [lab("Special instructions", inp("koInstr", "", { maxLength: 300 }), "flex:3 1 300px"), lab("Setting", sel("koSetting", [["", "-"], ["MICRO", "MICRO"], ["NIL", "NIL"], ["MIXED", "MIXED"]])), lab("C/S tones", inp("koCs", "", { maxLength: 120 }), "flex:2 1 200px")]),
      el("datalist", { id: "koCodesDl" }), el("datalist", { id: "koTrDl" }),
      el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "koSave", textContent: "Save order" }), el("button", { type: "button", className: "btn ghost", id: "koPrintB", textContent: "\u{1F5A8} Print slip (A5)" }), el("button", { type: "button", className: "btn ghost", id: "koClose", textContent: "Close" })]),
      el("p", { className: "hint", id: "koFMsg" }),
      el("div", { id: "koActs", hidden: true }, [
        el("div", { className: "kobox" }, [el("b", { textContent: "Status " }), el("span", { id: "koStatusBtns" }), el("p", { className: "hint", id: "koDiaInfo" })]),
        el("div", { className: "kobox", id: "koDiaAddBox" }, [el("b", { textContent: "Issue more diamonds to the karigar" }), diaTable("koIssMore", "koIssMoreAdd"), el("button", { type: "button", className: "btn", id: "koIssMoreSave", textContent: "Add to diamonds issued" })]),
        el("details", { className: "kobox", id: "koRecBox" }, [el("summary", { textContent: "Delivered by karigar - TAG USE ONLY" }),
          el("div", { hidden: true }, [diaTable("koIss2", "koIss2Add")]),
          el("div", { className: "row" }, [el("div", { style: "flex:1 1 320px" }, [el("b", { textContent: "Diamonds received back (broken / extra)" }), diaTable("koRec", "koRecAdd")]),
            el("div", { style: "flex:2 1 420px" }, [el("b", { textContent: "Diamonds used (= issued \u2212 received back; tag weight +10 %, solitaire 0 %) " }), el("button", { type: "button", className: "btn ghost", id: "koUsedAuto", textContent: "Used = issued \u2212 received" }), diaTable("koUsed", "koUsedAdd", true)])]),
          el("div", { className: "row" }, [lab("Delivered", inp("koTDate", "", { type: "date" })), lab("KT", inp("koTKt", "", { maxLength: 4 })), lab("G.GOLD g", inp("koTG", "", { maxLength: 10, inputMode: "decimal" })), lab("CS WT (g)", inp("koTCs", "", { maxLength: 10, inputMode: "decimal" })),
            lab("D.WT (g)", el("span", {}, [inp("koTD", "auto", { maxLength: 10, inputMode: "decimal" }), auto("koTDa")])), lab("N GOLD g", el("span", {}, [inp("koTN", "auto", { maxLength: 10, inputMode: "decimal" }), auto("koTNa")])), lab("LAB", inp("koTLab", "IGI / GIA\u2026", { maxLength: 30 }))]),
          el("div", { className: "row" }, [lab("CS cost \u20b9 (karigar)", inp("koTCsCost", "", { maxLength: 10, inputMode: "decimal" })), lab("CS charge on tag \u20b9", el("span", {}, [inp("koTCsCh", "auto", { maxLength: 10, inputMode: "decimal" }), auto("koTCsCha")])), lab("Making \u20b9/g (manual for now)", inp("koTMk", "", { maxLength: 10, inputMode: "decimal" })), lab("Details", inp("koTDet", "", { maxLength: 200 }), "flex:2 1 220px")]),
          el("div", { className: "row", id: "koMountF", hidden: true }, [lab("Given g (mounting wt)", inp("koMGiven", "blank = G.GOLD", { maxLength: 10, inputMode: "decimal" })), lab("Net recd g", inp("koMNet", "", { maxLength: 10, inputMode: "decimal" })), lab("Choki pc", inp("koMChoki", "", { maxLength: 6, inputMode: "numeric" })), lab("Round pc", inp("koMRound", "", { maxLength: 6, inputMode: "numeric" })),
            lab("CS \u20b9 (setting)", inp("koMCs", "", { maxLength: 8, inputMode: "decimal" }), "", "koMSetL"), lab("Making \u20b9/g (karigar)", inp("koMRate", "", { maxLength: 8, inputMode: "decimal" }), "", "koMRateL"), el("p", { className: "hint", id: "koMNote", style: "flex:1 1 100%" })]),
          el("b", { textContent: "Other charges (karigar labour: Polki setting, meena ...)" }), el("div", { className: "list" }, [el("table", { className: "items kodia" }, [el("thead", {}, [el("tr", {}, ["Description", "Pcs", "Karigar \u20b9/pc", "Tag \u20b9/pc"].map(h => el("th", { textContent: h })))]), el("tbody", { id: "koOth" })])]),
          el("button", { type: "button", className: "btn ghost", id: "koOthAdd", textContent: "+ Add row" }), el("p", { className: "koprev", id: "koRPrev" }),
          el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "koRecSave", textContent: "Save - delivered" }), el("button", { type: "button", className: "btn ghost", id: "koTagB", textContent: "Create tag from this", hidden: true })])]),
        el("p", { className: "koprev koAdm", id: "koCost", hidden: true }),
        el("div", { className: "kobox", id: "koGoldBox" }, [el("b", { textContent: "Gold issued for this order (OG register) " }), el("p", { className: "hint", id: "koGoldInfo" }),
          el("div", { className: "row", style: "align-items:end" }, [lab("Link", el("select", { id: "koGoldSel" })), el("button", { type: "button", className: "btn ghost", id: "koGoldLink", textContent: "Link" }),
            lab("or issue new: fine g", inp("koGoldFine", "e.g. 4.000", { maxLength: 10, inputMode: "decimal" })), el("button", { type: "button", className: "btn ghost", id: "koGoldNew", textContent: "Issue from OG pool" })])])])]);
    sec.append(el("h2", { textContent: "Karigar order" }), el("div", { className: "kosum", id: "koSum" }),
      el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "koAdd", textContent: "+ New karigar order", hidden: true }), el("button", { type: "button", className: "btn ghost", id: "koPrP", textContent: "\u{1F5A8} Print pending", hidden: true }), el("button", { type: "button", className: "btn ghost", id: "koXlP", textContent: "Excel pending", hidden: true }),
        el("button", { type: "button", className: "btn ghost", id: "koXl", textContent: "Excel all + account", hidden: true }), el("button", { type: "button", className: "btn ghost", id: "koSetB", textContent: "Settings / import", hidden: true })]),
      el("div", { className: "kobox", id: "koSet", hidden: true }), form, el("p", { className: "hint", id: "koMsg" }),
      el("div", { className: "kotabs", id: "koTabs" }, [["pend", "Pending deliveries"], ["all", "All orders"], ["acct", "Karigar account"]].map(([v, t]) => { const x = el("button", { type: "button", className: "btn ghost", textContent: t }); x.dataset.v = v; x.addEventListener("click", () => { view = v; render(); }); return x; })),
      el("div", { className: "row", id: "koFilt", style: "align-items:center" }, [lab("Karigar", el("select", { id: "koFK" }), "flex:0 0 auto"), lab("Status", sel("koFS", [["", "All"]].concat(Object.entries(ST))), "flex:0 0 auto"),
        el("label", { style: "flex:0 0 auto;flex-direction:row;align-items:center;gap:6px" }, [el("input", { type: "checkbox", id: "koFO" }), "Only overdue"]), lab("Search", inp("koQ", "order no., item, party, stage", { maxLength: 40 }))]),
      el("div", { id: "koList" }));
    rates.parentNode.insertBefore(sec, rates);
    $("koAdd").addEventListener("click", newOrder); $("koXl").addEventListener("click", e => xl("1", e.target)); $("koXlP").addEventListener("click", e => xl("pending", e.target)); $("koPrP").addEventListener("click", e => printPending(e.target)); $("koSetB").addEventListener("click", settings);
    $("koSave").addEventListener("click", save); $("koClose").addEventListener("click", () => { $("koForm").hidden = true; cur = null; });
    $("koPrintB").addEventListener("click", () => { if (cur) print(cur, $("koPrintB")); else $("koFMsg").textContent = "Save the order first, then print."; });
    ["koKSel", "koItem", "koBasis", "koDq"].forEach(i => { $(i).addEventListener("change", syncForm); $(i).addEventListener("input", syncForm); });
    $("koStage").addEventListener("change", async () => { if (!cur || !J.canAdd || J.admin && !$("koSave").hidden && false) return; if (cur && !J.admin) { try { await post({ op: "stage", id: cur.id, stage: $("koStage").value }); $("koFMsg").textContent = "Stage saved."; await load(); } catch (e) { $("koFMsg").textContent = "Not saved: " + (e.message || e) + "."; } } });
    $("koDrawF").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) upload(f); e.target.value = ""; }); $("koDrawCam").addEventListener("click", () => $("koDrawCamIn").click()); $("koDrawCamIn").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) upload(f); e.target.value = ""; });
    [["koIssAdd", "koIss"], ["koIssMoreAdd", "koIssMore"], ["koRecAdd", "koRec"]].forEach(([b, t]) => $(b).addEventListener("click", () => $(t).appendChild(diaRow({}))));
    $("koUsedAdd").addEventListener("click", () => $("koUsed").appendChild(diaRow({}, false, true))); $("koOthAdd").addEventListener("click", () => $("koOth").appendChild(othRow({}))); $("koUsedAuto").addEventListener("click", usedAuto);
    $("koRec").addEventListener("change", usedAuto); ["koUsed", "koOth"].forEach(i => { $(i).addEventListener("input", rPrev); $(i).addEventListener("change", rPrev); });
    ["koTG", "koTCs", "koTD", "koTN", "koTCsCost", "koTCsCh"].forEach(i => $(i).addEventListener("input", rPrev));
    $("koIssMoreSave").addEventListener("click", () => { if (cur) act({ op: "diaadd", id: cur.id, iss: diaGet("koIssMore") }, "Diamonds added to issued."); });
    $("koRecSave").addEventListener("click", saveRec); $("koTagB").addEventListener("click", makeTag);
    $("koGoldLink").addEventListener("click", () => { if (cur && $("koGoldSel").value) act({ op: "gold", id: cur.id, link: $("koGoldSel").value }, "Gold issue linked to the order."); });
    $("koGoldNew").addEventListener("click", () => { if (!cur) return; if (!(num($("koGoldFine").value) > 0)) { $("koFMsg").textContent = "Type the fine g to issue."; return; } act({ op: "gold", id: cur.id, fine: $("koGoldFine").value }, "Gold issued to the karigar from the OG pool (also in OG register > Outward list) and linked."); });
    ["koFK", "koFS", "koFO"].forEach(i => $(i).addEventListener("change", render)); $("koQ").addEventListener("input", render);
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "korder"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 1200);
})();
