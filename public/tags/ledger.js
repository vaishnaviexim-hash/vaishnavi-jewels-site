/* VJ Tags - Ledger tab: customer receipts, ledgers and Settled (owner Abhinav 17/10/2026, C-20261017-LEDGER).
   Loaded by shim.js for every login (owner: everyone may enter receipts and see ledgers). The page only sends what was typed;
   the server finds the bill, works out every balance, numbers the receipt (R-YYMM-NN) and refuses overpayments.
   Settled / Un-settle are shown only when the server says canSettle (Abhinav only, owner 17/10 16:15) - the server checks again.
   Receipt PDFs are made here with jsPDF, same look as bills (no company name / logo / address at the top, owner 16/10). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = n => "Rs " + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const g3 = n => Number(n || 0).toFixed(3) + " g";
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const el = (tag, props, kids) => { const e = document.createElement(tag); if (props) Object.assign(e, props); (kids || []).forEach(k => e.append(k)); return e; };
  const btn = (text, cls, fn) => { const b = el("button", { type: "button", className: "btn" + (cls ? " " + cls : ""), textContent: text }); if (fn) b.addEventListener("click", fn); return b; };
  const L = { cust: null, card: null, canSettle: false, wa: { bill: false, receipt: false } };
  const MODES = [["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["cheque", "Cheque"], ["bank", "Bank transfer"], ["gold", "Old gold"], ["adjust", "Adjustment"]];
  async function api(path, body) {
    const r = await fetch(path, body ? { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { credentials: "same-origin", cache: "no-store" });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status)); return j;
  }

  function build() {
    const nav = document.querySelector("nav"); if (!nav || $("t-ledger")) return;
    const b = el("button", { id: "t-ledger", textContent: "Ledger" }); b.setAttribute("role", "tab"); b.dataset.tab = "ledger"; b.setAttribute("aria-selected", "false");
    const tb = $("t-bill"); nav.insertBefore(b, tb ? tb.nextSibling : nav.querySelector('[data-tab="rates"]')); // owner 17/10: Ledger right after Bill
    const sec = el("section", { id: "p-ledger", className: "card", hidden: true });
    sec.innerHTML = `
      <h2>1 · Customer</h2>
      <div class="row" style="align-items:end"><label style="flex:2 1 220px">Name, mobile or bill number <input id="lq" autocomplete="off" maxlength="40" placeholder="e.g. Ramesh, 98250 or B-2610-06"></label>
        <div class="actions" style="margin:0"><button type="button" class="btn" id="lfind">Find</button><button type="button" class="btn ghost" id="lopen">Customers with a balance</button></div></div>
      <p class="hint" id="lmsg"></p>
      <div class="list" id="lreswrap" hidden><table class="items" style="min-width:600px"><thead><tr><th>Customer</th><th>Mobile</th><th>Bills</th><th>Balance</th><th>Fine gold due</th><th></th></tr></thead><tbody id="lres"></tbody></table></div>
      <div id="lcard" hidden style="display:flex;flex-direction:column;gap:14px"></div>
      <h2>2 · New receipt</h2>
      <p class="hint" id="rwho">Find the customer above first, or type a new customer here for money taken on account.</p>
      <div class="row" id="rnew"><label>Name <input id="rname" autocomplete="off" maxlength="60"></label><label>City <input id="rcity" autocomplete="off" maxlength="40"></label><label>Mobile No. <input id="rmob" inputmode="tel" autocomplete="off" maxlength="20" placeholder="98xxxxxxxx"></label></div>
      <div class="seg" role="radiogroup" aria-label="Payment mode" id="rmodes" style="flex-wrap:wrap"></div>
      <div class="row" id="rf-against"><label style="flex:2 1 220px">Against <select id="rbill"></select></label></div>
      <div class="row" id="rf-adjust" hidden><label>Move from <select id="rfrom"></select></label><label>Move to <select id="rto"></select></label></div>
      <div class="row" id="rf-cheque" hidden><label>Cheque no. <input id="rchq" autocomplete="off" maxlength="20"></label><label>Bank <input id="rbank" autocomplete="off" maxlength="40"></label></div>
      <div class="row" id="rf-ref" hidden><label id="rrefl">Reference <input id="rref" autocomplete="off" maxlength="40"></label></div>
      <div id="rf-gold" hidden style="display:flex;flex-direction:column;gap:10px">
        <div class="row"><label>Gross weight (g) <input id="rgross" inputmode="decimal" autocomplete="off"></label>
          <label>Karat <select id="rkarat"><option value="">-</option><option>24K</option><option>22K</option><option>18K</option><option>14K</option><option>9K</option></select></label>
          <label>or purity % <input id="rpur" inputmode="decimal" autocomplete="off" placeholder="e.g. 91.6"></label></div>
        <div class="seg" role="radiogroup" aria-label="Take old gold as"><label><input type="radio" name="rgas" value="fine" checked> As fine gold (against fine gold due)</label><label><input type="radio" name="rgas" value="rupees"> In rupees</label></div>
        <div class="row" id="rf-rate" hidden><label>Rate per g of fine gold <input id="rrate" inputmode="decimal" autocomplete="off"></label></div>
        <p class="hint" id="rfine"></p></div>
      <div class="row"><label id="ramtl">Amount (Rs) <input id="ramt" inputmode="numeric" autocomplete="off" maxlength="14"></label><label>Date <input id="rdate" type="date"></label><label style="flex:2 1 220px">Note <input id="rnote" autocomplete="off" maxlength="120"></label></div>
      <div class="actions"><button type="button" class="btn" id="rsave">Save receipt &amp; make PDF</button><button type="button" class="btn ghost" id="rclear">Clear</button></div>
      <p class="hint" id="rmsg"></p><div class="actions" id="rout" hidden></div>
      <h2>3 · Ledger (Excel)</h2>
      <div class="row" style="align-items:end"><label style="flex:0 1 200px">Receipts of month <input id="lmonth" type="month"></label>
        <div class="actions" style="margin:0"><button type="button" class="btn ghost" id="lxl">Ledger (Excel)</button></div></div>
      <p class="hint" id="lxlmsg">Sheet 1: every customer's balance today. Sheet 2: all receipts of the month. Prints A4 landscape.</p>`;
    const pb = $("p-bill"); (pb || $("p-rates")).parentNode.insertBefore(sec, pb ? pb.nextSibling : $("p-rates"));
    document.querySelectorAll("nav button").forEach(x => x.addEventListener("click", () => {
      const on = x.dataset.tab === "ledger"; sec.hidden = !on;
      if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y === x ? "true" : "false")); opened(); }
    }));
    const seg = $("rmodes"); MODES.forEach(([v, l], i) => { const lb = el("label"), r = el("input", { type: "radio", name: "rmode", value: v, checked: i === 0 }); r.addEventListener("change", modeUi); lb.append(r, " " + l); seg.appendChild(lb); });
    document.querySelectorAll("input[name=rgas]").forEach(r => r.addEventListener("change", modeUi));
    ["rgross", "rpur", "rrate"].forEach(i => $(i).addEventListener("input", fineNow)); $("rkarat").addEventListener("change", fineNow);
    $("lfind").addEventListener("click", search); $("lq").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); search(); } });
    $("lopen").addEventListener("click", () => search(true));
    $("rsave").addEventListener("click", saveReceipt); $("rclear").addEventListener("click", clearForm);
    $("lmonth").value = today().slice(0, 7); $("lxl").addEventListener("click", excel);
    $("rdate").value = today(); modeUi(); fillBills();
  }
  function opened() { if (!$("rdate").value) $("rdate").value = today(); api("/api/vj/wa-ready").then(j => { L.wa = { bill: !!j.bill, receipt: !!j.receipt }; }).catch(() => {}); setTimeout(() => $("lq").focus(), 50); }
  const mode = () => (document.querySelector("input[name=rmode]:checked") || {}).value || "cash";
  const goldAs = () => (document.querySelector("input[name=rgas]:checked") || {}).value || "fine";
  function modeUi() {
    const m = mode(), show = (id, on) => { $(id).hidden = !on; $(id).style.display = on ? (id === "rf-gold" ? "flex" : "") : "none"; };
    show("rf-against", m !== "adjust"); show("rf-adjust", m === "adjust"); show("rf-cheque", m === "cheque"); show("rf-ref", m === "bank" || m === "upi" || m === "card"); show("rf-gold", m === "gold");
    show("rf-rate", m === "gold" && goldAs() === "rupees"); $("ramtl").hidden = m === "gold"; $("ramtl").style.display = m === "gold" ? "none" : "";
    $("rrefl").firstChild.textContent = m === "bank" ? "Bank reference (UTR) " : "Reference (optional) ";
    show("rnew", !L.cust && m !== "adjust"); fineNow();
  }
  function fineNow() { const g = Number($("rgross").value) || 0, p = Number($("rpur").value) || 0, k = { "24K": 24, "22K": 22, "18K": 18, "14K": 14, "9K": 9 }[$("rkarat").value];
    const pur = p > 0 && p <= 100 ? p / 100 : k ? k / 24 : 0, f = Math.round(g * pur * 1000) / 1000, rate = Number($("rrate").value) || 0;
    $("rfine").textContent = g && pur ? `Fine gold ${g3(f)}` + (goldAs() === "rupees" && rate ? ` = ${fmt(f * rate)}` : "") + " (the server works it out again)." : "Type the weight and the karat (or purity %)."; }
  // the "against" choices come from the open customer's card (server figures)
  function fillBills() {
    const s = $("rbill"), f = $("rfrom"), t = $("rto"); [s, f, t].forEach(x => { x.textContent = ""; });
    const open = L.card ? L.card.bills.filter(b => !b.settled) : [];
    s.append(el("option", { value: "", textContent: "On account (no bill) - advance / credit" }));
    open.filter(b => b.balance > 0 || b.fineDue > 0).forEach(b => s.append(el("option", { value: b.no, textContent: `${b.no} (${dmy(b.date)}) - balance ${fmt(b.balance)}${b.fineDue > 0 ? " + " + g3(b.fineDue) + " fine" : ""}` })));
    const acc = L.card ? L.card.customer.account : 0;
    f.append(el("option", { value: "account", textContent: `Account (credit ${fmt(acc)})` })); t.append(el("option", { value: "account", textContent: "Account (credit)" }));
    open.forEach(b => { f.append(el("option", { value: b.no, textContent: `${b.no} - received ${fmt(b.received)}` })); if (b.balance > 0) t.append(el("option", { value: b.no, textContent: `${b.no} - balance ${fmt(b.balance)}` })); });
    if (t.options.length > 1) t.selectedIndex = 1;
  }
  async function search(open) {
    const q = $("lq").value.trim(), m = $("lmsg"); if (open !== true && q.length < 2) { m.textContent = "Type at least 2 letters or digits."; return; }
    m.textContent = "Looking…";
    try { const j = await api("/api/vj/ledger?" + (open === true ? "open=1" : "q=" + encodeURIComponent(q))); L.canSettle = !!j.canSettle;
      const body = $("lres"); body.textContent = ""; $("lreswrap").hidden = !j.customers.length;
      j.customers.forEach(c => { const tr = el("tr"); const td = (x, cl) => tr.appendChild(el("td", { className: cl || "", textContent: x }));
        td(c.name + (c.city ? ", " + c.city : "")); td(c.mobile ? (/^\d{10}$/.test(c.mobile) ? "+91 " + c.mobile : c.mobile) : "—"); td(String(c.bills), "num"); td(fmt(c.balance) + (c.account ? " (credit " + fmt(c.account) + ")" : ""), "num"); td(c.fineDue ? g3(c.fineDue) : "—", "num");
        const x = el("td"); x.appendChild(btn("Open", "ghost", () => openCust(c.key))); tr.appendChild(x); body.appendChild(tr); });
      m.textContent = j.customers.length ? `${j.customers.length} customer${j.customers.length === 1 ? "" : "s"}${j.more ? " (" + j.more + " more - type more of the name)" : ""}.` : "No customer found. For money taken before a bill, type the new customer in 2 · New receipt.";
      if (j.customers.length === 1) openCust(j.customers[0].key);
    } catch (e) { m.textContent = "Could not search (" + (e.message || e) + ")."; }
  }
  async function openCust(key) {
    const box = $("lcard"); box.hidden = false; box.textContent = "Loading…";
    try { const j = await api("/api/vj/ledger?key=" + encodeURIComponent(key)); L.card = j; L.cust = j.customer; L.canSettle = !!j.canSettle; drawCard(); fillBills(); modeUi();
      $("rwho").textContent = `Receipt for ${j.customer.name}${j.customer.city ? ", " + j.customer.city : ""}${j.customer.mobile ? " (" + j.customer.mobile + ")" : ""}.`;
    } catch (e) { box.textContent = "Could not open the ledger (" + (e.message || e) + ")."; }
  }
  function table(head, minW) { const t = el("table", { className: "items" }); t.style.minWidth = (minW || 640) + "px"; const tr = el("tr"); head.forEach(h => tr.appendChild(el("th", { textContent: h }))); t.appendChild(el("thead", null, [tr])); const tb = el("tbody"); t.appendChild(tb); return [el("div", { className: "list" }, [t]), tb]; }
  function drawCard() {
    const j = L.card, c = j.customer, box = $("lcard"); box.textContent = "";
    box.appendChild(el("div", { className: "labelno", textContent: c.name })); box.appendChild(el("div", { className: "hint", textContent: [c.city, c.mobile && (/^\d{10}$/.test(c.mobile) ? "+91 " + c.mobile : c.mobile)].filter(Boolean).join(" · ") }));
    const sum = el("table", { className: "sum" }); const line = (l, v, cl) => { const tr = el("tr", { className: cl || "" }); tr.append(el("td", { textContent: l }), el("td", { textContent: v })); sum.appendChild(tr); };
    line("Billed", fmt(c.billed)); line("Received", fmt(c.received)); if (c.settlement) line("Settlement discount", fmt(c.settlement)); if (c.account) line("On account (credit not yet used)", fmt(c.account)); if (c.fineDue) line("Fine gold due", g3(c.fineDue)); line("Balance", fmt(c.balance), "total"); box.appendChild(sum);
    // bills
    box.appendChild(el("h2", { textContent: "Bills" }));
    const [bw, bt] = table(["Number", "Date", "Total", "Received", "Discount / settled", "Balance", "Fine gold due", ""], 820);
    j.bills.forEach(b => { const tr = el("tr"); const td = (x, cl) => tr.appendChild(el("td", { className: cl || "", textContent: x }));
      td(b.no); td(dmy(b.date)); td(fmt(b.total), "num"); td(fmt(b.received) + (b.fineRecv ? " + " + g3(b.fineRecv) + " fine" : ""), "num");
      td(b.settled ? `Settled ${dmy(b.settled.at)}: ${fmt(b.settlement)}${b.settled.fineWaived ? " + " + g3(b.settled.fineWaived) + " fine waived" : ""}` : "—", "num"); td(fmt(b.balance), "num"); td(b.fine ? g3(b.fineDue) : "—", "num");
      const x = el("td"); x.style.whiteSpace = "nowrap"; x.appendChild(btn("PDF", "ghost", ev => billPdf(b.no, ev.currentTarget)));
      if (L.canSettle && !b.settled && (b.balance > 0 || b.fineDue > 0) && b.balance >= 0) x.appendChild(settleBtn(b));
      if (L.canSettle && b.settled) x.appendChild(btn("Un-settle", "ghost", () => unsettleBox(b, x)));
      tr.appendChild(x); bt.appendChild(tr); });
    if (!j.bills.length) bt.appendChild(el("tr", null, [el("td", { colSpan: 8, className: "hint", textContent: "No bills yet (money on account only)." })]));
    box.appendChild(bw);
    // receipts
    box.appendChild(el("h2", { textContent: "Receipts" }));
    const [rw, rt] = table(["Receipt", "Date", "How", "Against", "Amount", "Fine gold", "By", ""], 820);
    j.receipts.slice().reverse().forEach(r => { const tr = el("tr"); const td = (x, cl) => tr.appendChild(el("td", { className: cl || "", textContent: x }));
      td(r.no); td(dmy(r.date)); td(r.text + (r.note ? " · " + r.note : "")); td(r.bill || "account"); td(r.mode === "adjust" ? (r.dir === "out" ? "- " : "+ ") + fmt(r.amount) : fmt(r.amount), "num"); td(r.fine ? g3(r.fine) : "—", "num"); td(r.byName || "");
      const x = el("td"); x.style.whiteSpace = "nowrap"; if (r.mode !== "adjust") x.appendChild(btn("Slip", "ghost", ev => slipAgain(r.no, ev.currentTarget))); x.appendChild(btn("Reverse", "ghost", () => reverseBox(r, x))); tr.appendChild(x); rt.appendChild(tr); });
    if (!j.receipts.length) rt.appendChild(el("tr", null, [el("td", { colSpan: 8, className: "hint", textContent: "No receipts yet." })]));
    box.appendChild(rw);
    // running ledger
    box.appendChild(el("h2", { textContent: "Ledger" }));
    const [lw, lt] = table(["Date", "Particulars", "Debit", "Credit", "Balance"], 640);
    j.ledger.forEach(e => { const tr = el("tr"); const td = (x, cl) => tr.appendChild(el("td", { className: cl || "", textContent: x }));
      td(dmy(e.date)); td(e.part); td(e.dr ? fmt(e.dr) : "", "num"); td(e.cr ? fmt(e.cr) : "", "num"); td(fmt(e.bal), "num"); lt.appendChild(tr); });
    box.appendChild(lw);
    box.appendChild(el("p", { className: "hint", id: "lcmsg" }));
  }
  const cmsg = t => { const m = $("lcmsg"); if (m) m.textContent = t; };
  // Settled (Abhinav only): tap twice; the second tap shows the exact figures the server will use
  function settleBtn(b) {
    let sure = false; const o = btn("Settled", "ghost");
    o.addEventListener("click", async () => {
      if (!sure) { sure = true; const g = Number(b.gstPct) || 0, paid = b.received, tax = b.balance === 0 ? b.sub : Math.round(paid / (1 + g / 100)), disc = Math.max(0, (b.sub || 0) - tax);
        o.className = "btn danger"; o.textContent = `Yes: discount ${fmt(disc)} (GST ${fmt(b.nowTotal - b.sub - (paid - tax))} less), new total ${fmt(paid)}${b.fineDue > 0 ? ", waive " + g3(b.fineDue) + " fine" : ""}`; return; }
      o.disabled = true;
      try { const j = await api("/api/vj/ledger/settle", { no: b.no, expect: b.received }); const nb = j.bill;
        await openCust(L.cust.key); cmsg(`${b.no} settled: settlement discount ${fmt(nb.settled.discount)}, bill total now ${fmt(nb.total)}.`); offerBill(nb);
      } catch (e) { cmsg("Not settled: " + (e.message || e) + "."); o.disabled = false; sure = false; o.className = "btn ghost"; o.textContent = "Settled"; } });
    return o;
  }
  function unsettleBox(b, cell) {
    cell.textContent = ""; const inp = el("input", { placeholder: "reason (needed)", maxLength: 120 }); inp.style.width = "180px";
    const y = btn("Un-settle " + b.no, "danger"), n = btn("Keep", "ghost", () => drawCard()); y.disabled = true; inp.addEventListener("input", () => { y.disabled = inp.value.trim().length < 3; });
    y.addEventListener("click", async () => { y.disabled = true;
      try { await api("/api/vj/ledger/unsettle", { no: b.no, reason: inp.value.trim() }); await openCust(L.cust.key); cmsg(`${b.no} is open again with its original figures.`); }
      catch (e) { cmsg("Could not un-settle: " + (e.message || e) + "."); y.disabled = false; } });
    cell.append(el("div", { style: "display:flex;gap:6px;flex-wrap:wrap" }, [inp, y, n]));
  }
  function reverseBox(r, cell) {
    cell.textContent = ""; const inp = el("input", { placeholder: "reason (needed)", maxLength: 120 }); inp.style.width = "180px";
    const y = btn("Reverse " + r.no, "danger"), n = btn("Keep", "ghost", () => drawCard()); y.disabled = true; inp.addEventListener("input", () => { y.disabled = inp.value.trim().length < 3; });
    y.addEventListener("click", async () => { y.disabled = true;
      try { const j = await api("/api/vj/receipt/reverse", { no: r.no, reason: inp.value.trim() }); await openCust(L.cust.key); cmsg(`Reversed: ${j.reversed.join(", ")} (kept in the records, left out of the balance).`); }
      catch (e) { cmsg("Could not reverse: " + (e.message || e) + "."); y.disabled = false; } });
    cell.append(el("div", { style: "display:flex;gap:6px;flex-wrap:wrap" }, [inp, y, n]));
  }
  async function billPdf(no, b0) { if (b0) b0.disabled = true;
    try { const j = await api("/api/vj/ledger/bill?no=" + encodeURIComponent(no)); offerBill(j.bill); } catch (e) { cmsg("Could not open " + no + " (" + (e.message || e) + ")."); } if (b0) b0.disabled = false; }
  async function offerBill(nb) {
    if (!window.vjBillPdf) { cmsg("Open the Bill tab once, then try again (the bill printer is not loaded)."); return; }
    const blob = await window.vjBillPdf(nb, true), fname = `${nb.title} ${nb.no} ${String(nb.name).replace(/[^A-Za-z0-9 .\-]/g, "").trim().slice(0, 40)}.pdf`;
    const url = URL.createObjectURL(new File([blob], fname, { type: "application/pdf" }));
    const w = el("div", { className: "actions" }); w.append(el("a", { className: "btn", href: url, target: "_blank", rel: "noopener", textContent: "Open " + nb.no + " PDF" }), el("a", { className: "btn ghost", href: url, download: fname, textContent: "Download" }));
    const m = $("lcmsg"); if (m) m.after(w);
  }

  // ---------- receipt ----------
  async function saveReceipt() {
    const m = $("rmsg"), out = $("rout"); out.hidden = true; const md = mode();
    const body = { mode: md, date: $("rdate").value, note: $("rnote").value.trim() };
    if (md === "adjust") { if (!L.cust) { m.textContent = "Find the customer first."; return; } Object.assign(body, { from: $("rfrom").value, to: $("rto").value, amount: $("ramt").value.trim() }); }
    else {
      if (L.cust) { if ($("rbill").value) body.bill = $("rbill").value; else body.key = L.cust.key; }
      else { Object.assign(body, { name: $("rname").value.trim(), city: $("rcity").value.trim(), mobile: $("rmob").value.trim() }); if (!body.name) { m.textContent = "Find the customer above, or type the name."; return; } }
      if (md === "gold") Object.assign(body, { gross: $("rgross").value.trim(), karat: $("rkarat").value, purity: $("rpur").value.trim(), goldAs: goldAs(), rate: $("rrate").value.trim() });
      else body.amount = $("ramt").value.trim();
      if (md === "cheque") Object.assign(body, { chequeNo: $("rchq").value.trim(), bank: $("rbank").value.trim() });
      if (md === "bank" || md === "upi" || md === "card") body.ref = $("rref").value.trim();
    }
    $("rsave").disabled = true; m.textContent = "Saving…";
    try { const j = await api("/api/vj/receipt", body), r = j.receipt;
      m.textContent = md === "adjust" ? `Adjustment saved: ${j.linked.no} and ${r.no}, ${fmt(r.amount)} moved.` : `Receipt ${r.no} saved: ${r.amount ? fmt(r.amount) : g3(r.fine) + " fine gold"} from ${r.name}.`;
      ["ramt", "rnote", "rchq", "rbank", "rref", "rgross", "rpur", "rrate"].forEach(i => { $(i).value = ""; }); $("rkarat").value = "";
      if (L.cust) await openCust(L.cust.key); else if (r.key) await openCust(r.key);
      if (md !== "adjust") await slip(r);
    } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; }
    $("rsave").disabled = false;
  }
  function clearForm() { L.cust = null; L.card = null; $("lcard").hidden = true; $("lcard").textContent = ""; ["rname", "rcity", "rmob", "ramt", "rnote", "rchq", "rbank", "rref", "rgross", "rpur", "rrate"].forEach(i => { $(i).value = ""; });
    $("rdate").value = today(); $("rmsg").textContent = ""; $("rout").hidden = true; $("rwho").textContent = "Find the customer above first, or type a new customer here for money taken on account."; fillBills(); modeUi(); }
  async function slipAgain(no, b0) { b0.disabled = true; try { const j = await api("/api/vj/receipt?no=" + encodeURIComponent(no)); await slip(j.receipt, true); } catch (e) { cmsg("Could not open " + no + " (" + (e.message || e) + ")."); } b0.disabled = false; }
  function makeSlip(r) {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" }); const W = 210, M = 14; let y = 20;
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("Receipt", M, y); // owner 16/10: no company name / logo / address at the top
    doc.setFontSize(13); doc.text(`No. ${r.no}`, W - M, y - 3, { align: "right" }); doc.setFont("helvetica", "normal"); doc.text(`Date ${dmy(r.date)}`, W - M, y + 4, { align: "right" });
    if (r.reversed) { doc.setTextColor(161, 43, 43); doc.setFont("helvetica", "bold"); doc.text("REVERSED", M + 45, y); doc.setTextColor(20); doc.setFont("helvetica", "normal"); }
    y += 14; doc.setFontSize(13);
    doc.text(`Name: ${r.name}`, M, y); y += 7.5; doc.text(`City: ${r.city || "-"}`, M, y); doc.text(`Mobile: ${!r.mobile ? "-" : /^\d{10}$/.test(r.mobile) ? "+91 " + r.mobile : r.mobile}`, M + 90, y); y += 12;
    const row = (l, v, big) => { doc.setFont("helvetica", "bold"); doc.setFontSize(big ? 15 : 12.5); doc.text(l, M, y); doc.setFont("helvetica", big ? "bold" : "normal");
      const lines = doc.splitTextToSize(String(v), W - 2 * M - 62); doc.text(lines, M + 62, y); y += Math.max(1, lines.length) * (big ? 7 : 6) + 3; };
    doc.setDrawColor(200, 170, 100); doc.line(M, y - 6, W - M, y - 6);
    row("Received by", r.modeName || r.mode); if (r.text && r.text !== r.modeName) row("Details", r.text);
    row("Amount", r.amount ? fmt(r.amount) : g3(r.fine) + " fine gold", true);
    if (r.mode === "gold" && r.amount) row("Fine gold", g3(r.fine));
    row("Against", r.bill ? "Bill " + r.bill : "Customer's account (advance / credit)");
    const ba = r.balAfter || {};
    if (r.bill && ba.bill != null) row("Balance of the bill after this receipt", fmt(ba.bill) + (ba.fineDue > 0 ? " + " + g3(ba.fineDue) + " fine gold" : ""));
    if (ba.customer != null) row("Total balance after this receipt", fmt(ba.customer) + (!r.bill && ba.account ? " (credit on account " + fmt(ba.account) + ")" : ""));
    if (r.note) row("Note", r.note);
    doc.line(M, y - 2, W - M, y - 2); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(80); doc.text("Received with thanks. Cheques and transfers are subject to realisation.", M, y);
    doc.text(`Received by: ${r.byName || ""}`, W - M, y + 14, { align: "right" });
    return doc.output("blob");
  }
  async function slip(r, again) {
    const blob = makeSlip(r), fname = `Receipt ${r.no} ${String(r.name).replace(/[^A-Za-z0-9 .\-]/g, "").trim().slice(0, 40)}.pdf`;
    const file = new File([blob], fname, { type: "application/pdf" }), url = URL.createObjectURL(file), out = $("rout"); out.textContent = ""; out.hidden = false;
    out.append(el("a", { className: "btn", href: url, target: "_blank", rel: "noopener", textContent: "Open PDF (print)" }), el("a", { className: "btn ghost", href: url, download: fname, textContent: "Download" }));
    const canFile = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { return false; } })();
    if (canFile) out.append(btn("Share", "ghost", async () => { try { await navigator.share({ files: [file] }); } catch (e) {} }));
    // owner 17/10: Aashvi sends it only once the WhatsApp template vj_receipt_pdf_v1 is approved (server flag wa-ready:receipt)
    if (L.wa.receipt && /^[6-9]\d{9}$/.test(String(r.mobile || "")) && !r.reversed) {
      const s = btn("Send on WhatsApp (Aashvi)", "ghost"); s.addEventListener("click", () => waSend(r, blob, s)); out.append(s); }
    if (again) $("rmsg").textContent = "Receipt " + r.no + " ready below.";
  }
  async function waSend(r, blob, b0) {
    b0.disabled = true; const m = $("rmsg"); m.textContent = "Sending to Aashvi…";
    try { const b64 = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(",")[1]); f.onerror = rej; f.readAsDataURL(blob); });
      const j = await api("/api/vj/bill/send", { no: r.no, pdf: b64 }); m.textContent = `Aashvi is sending ${r.no} to ${j.to}…`;
      for (let i = 0; i < 12; i++) { await new Promise(z => setTimeout(z, 5000)); const st = await api("/api/vj/bill/sendstatus?t=" + j.token).catch(() => null);
        if (st && st.status === "sent") { m.textContent = `Receipt ${r.no} sent on WhatsApp to ${j.to}.`; return; }
        if (st && (st.status === "failed" || st.status === "expired")) { m.textContent = `Not sent: ${st.error || st.status}.`; b0.disabled = false; return; } }
      m.textContent = `Aashvi has the receipt; WhatsApp has not confirmed yet.`;
    } catch (e) { m.textContent = "Not sent: " + (e.message || e) + "."; b0.disabled = false; }
  }
  async function excel() {
    const mo = $("lmonth").value || today().slice(0, 7), m = $("lxlmsg");
    try { const r = await fetch("/api/vj/ledger.xlsx?month=" + encodeURIComponent(mo), { credentials: "same-origin" }); if (!r.ok) throw new Error(r.status);
      const a = el("a", { href: URL.createObjectURL(await r.blob()), download: "VJ_Ledger_" + mo.split("-").reverse().join("-") + ".xlsx" }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    } catch (e) { m.textContent = "Could not make the Excel (" + (e.message || e) + ")."; } }
  // wait for the Bill tab (bill.js) so Ledger sits right after it; after 6 s go ahead anyway
  let tries = 0;
  function boot() { if (document.querySelector("nav") && $("p-rates") && ($("t-bill") || tries > 20)) build(); else { tries++; setTimeout(boot, 300); } }
  boot();
})();
