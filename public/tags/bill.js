/* VJ Tags - Bill tab (owner 16/10/2026, C-20261016-BILLS). Loaded by shim.js for owners and staff (not sales).
   Pieces are picked by design / tag number; the customer, bill number, date, gold rate (F, fine 24K per g) and
   W/s or Nett are typed in. The figures on screen are a preview; on "Save bill & make PDF" the server works the bill out
   again from the tags it holds, saves it under its number, and the PDF is printed from the saved figures. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  const B = { items: [], mode: "ws", settle: "fine", title: "Bill", photos: true, disc: {} };
  const MODES = { ws: "W/s", nett: "Nett", g2g: "Gold to Gold", item: "Gold Item" };
  const fineMode = () => B.mode === "g2g" || B.mode === "item";
  const g3 = n => Number(n || 0).toFixed(3) + " g";
  const tags = () => (window.VJ_TAGS ? window.VJ_TAGS() : []);
  const settings = () => (window.VJ_SETTINGS && window.VJ_SETTINGS()) || {};
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const dmy = d => d.split("-").reverse().join("-");
  // VJ_BILL_CALC_START (same function in tags/bill.js - keep both copies identical)
  // Bills (owner 16/10/2026, C-20261016-BILLS / BILLS2), formulas from the owner's bills_and_estimates_1.xlsm sheet 'BILLS DIAMONDS'.
  // karat rate = F (fine 24K per g, typed on the bill) x purity. Making per g = Rs 650 if the first gold line is over 5 g, else 750.
  // W/s: gold = net x karat rate x 1.10 (10% wastage, none on 24K), making 650/750 per g.
  // Nett: gold = net x karat rate, making per g = (650 or 750) + 10% of the karat rate, rounded up to Rs 100.
  // Gold to Gold: fine gold due = net x (9K 0.4235, 14K 0.66, 18K 0.836, 22K 1.06, 24K 1), making 650/750 per g in rupees.
  // Gold Item: fine gold due = net x (9K 0.54, 14K 0.74, 18K 0.90, 22K 1.06, 24K 1), making already in the gold (none in rupees).
  // For Gold to Gold / Gold Item, settle 'fine' = customer gives the fine gold; 'amount' = fine x F is charged in rupees.
  // Diamonds = ct x the tag's rate, plus other charges. Discount (C-20261016-BILLDISC) per piece, rupees or 'n%' of that piece's
  // rupee amount, never more than it. Rupee total less discount, rounded UP to Rs 1,000; GST to the nearest rupee.
  const VJ_FINE = { g2g: { '9K': 0.4235, '14K': 0.66, '18K': 0.836, '22K': 1.06, '24K': 1 }, item: { '9K': 0.54, '14K': 0.74, '18K': 0.90, '22K': 1.06, '24K': 1 } };
  function vjBillCalc(tags, o) {
    const pur = Object.assign({ '24K': 1, '22K': 0.92, '18K': 0.76, '14K': 0.60, '9K': 0.40 }, o.purity || {});
    const m = Object.assign({ base: 650, small: 750, limit: 5, pct: 10 }, o.making || {}), F = Number(o.F) || 0;
    const mode = ['ws', 'nett', 'g2g', 'item'].includes(o.mode) ? o.mode : 'ws', fineMode = mode === 'g2g' || mode === 'item';
    const settle = fineMode ? (o.settle === 'amount' ? 'amount' : 'fine') : '';
    const gstPct = o.gst == null ? 3 : Number(o.gst);
    const rows = tags.map(t => {
      const gl = (t.kind === 'sample' ? [{ k: '14K', net: Number(t.metal && t.metal.net) || 0 }] : (Array.isArray(t.gold) ? t.gold : []))
        .map(g => ({ k: String(g && g.k || ''), net: Number(g && g.net) || 0 })).filter(g => g.net > 0);
      const kr = k => F * (Number(pur[k]) || 0), g0 = gl[0];
      let mk = 0;
      if (g0 && mode !== 'item') { const b = g0.net > m.limit ? m.base : m.small; mk = mode === 'nett' ? Math.ceil(Math.round((b + kr(g0.k) * m.pct / 100) * 100) / 100 / 100) * 100 : b; }
      let gold = 0, net = 0, fine = 0;
      gl.forEach(g => { net += g.net;
        if (fineMode) fine += g.net * (VJ_FINE[mode][g.k] || 0);
        else gold += g.net * kr(g.k) * (mode === 'ws' && g.k !== '24K' ? 1.1 : 1); });
      fine = Math.round(fine * 1000) / 1000;
      if (settle === 'amount') gold = fine * F;
      const dl = (Array.isArray(t.dias) ? t.dias : []).filter(Boolean).map(d => ({ ct: Number(d.ct) || 0, rate: Number(d.rate) || 0 }));
      const ct = dl.reduce((a, d) => a + d.ct, 0), dia = dl.reduce((a, d) => a + d.ct * d.rate, 0), oth = Number(t.other && t.other.amt) || 0;
      const r = { id: t.id, label: String(t.label || ''), design: String(t.designNo || ''), cat: String(t.catName || ''),
        gold: gl.map(g => g.k + ' ' + g.net.toFixed(3) + ' g').join(' + '), net: Math.round(net * 1000) / 1000, fine, goldAmt: Math.round(gold),
        mkRate: mk, making: Math.round(mk * net), ct: Math.round(ct * 100) / 100, diaAmt: Math.round(dia), other: Math.round(oth) };
      r.amount = r.goldAmt + r.making + r.diaAmt + r.other;
      const dv = String(o.disc && o.disc[t.id] != null ? o.disc[t.id] : '').trim(), pm = dv.match(/^(\d+(?:\.\d+)?)\s*%$/), dn = Number(dv.replace(/[,\s]/g, ''));
      r.discTxt = pm ? Math.min(100, Number(pm[1])) + '%' : '';
      r.disc = Math.round(Math.min(r.amount, pm ? r.amount * Math.min(100, Number(pm[1])) / 100 : (dn > 0 ? dn : 0)));
      r.net = r.amount - r.disc;
      return r;
    });
    const sum = rows.reduce((a, r) => a + r.amount, 0), disc = rows.reduce((a, r) => a + r.disc, 0), after = sum - disc;
    const sub = Math.ceil(after / 1000) * 1000, gst = Math.round(sub * gstPct / 100);
    const fine = Math.round(rows.reduce((a, r) => a + r.fine, 0) * 1000) / 1000;
    return { mode, settle, rows, fine: settle === 'fine' ? fine : 0, fineIn: fine, sum, disc, after, roundOff: sub - after, sub, gstPct, gst, total: sub + gst };
  }
  // VJ_BILL_CALC_END

  function find(q) {
    q = String(q || "").trim().toUpperCase().replace(/\s+/g, ""); if (!q) return [];
    const n = x => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), nq = n(q);
    if (/^[A-Z]{3}\d+[A-Z]{3}$/.test(q)) { const c = tags().filter(t => t.code && String(t.code).toUpperCase() === q); if (c.length) return c; } // price code on the tag (C-20261016-BILLCODE)
    return tags().filter(t => String(t.no) === q && /^\d+$/.test(q) || nq && (n(t.designNo) === nq || n(t.label) === nq)).slice(0, 12);
  }
  function build() {
    const nav = document.querySelector("nav"); if (!nav || $("t-bill")) return;
    const b = document.createElement("button"); b.setAttribute("role", "tab"); b.id = "t-bill"; b.dataset.tab = "bill"; b.textContent = "Bill"; b.setAttribute("aria-selected", "false");
    nav.insertBefore(b, nav.querySelector('[data-tab="rates"]'));
    const sec = document.createElement("section"); sec.id = "p-bill"; sec.className = "card"; sec.hidden = true;
    sec.innerHTML = `
      <h2>1 · Pieces</h2>
      <div class="row" style="align-items:end"><label style="flex:2 1 220px">Code on the tag, tag number or design number <input id="bq" autocomplete="off" placeholder="e.g. abc270xyz, 803 or 1436"></label>
      <div><button type="button" class="btn" id="badd">Add piece</button></div></div>
      <div id="bpick" class="row" style="gap:8px"></div>
      <div class="list"><table class="items" style="min-width:820px"><thead><tr><th>Piece</th><th>Gold</th><th>Gold value</th><th>Making</th><th>Diamonds</th><th>Other</th><th>Amount</th><th>Discount<br><span style="font-weight:400;text-transform:none">Rs or %</span></th><th>Net</th><th></th></tr></thead><tbody id="brows"></tbody></table></div>
      <h2>2 · Customer &amp; bill</h2>
      <p class="hint" id="bcusthint"></p>
      <div class="row"><label>Name <input id="bname" autocomplete="off" maxlength="60"></label>
        <label>City <input id="bcity" autocomplete="off" maxlength="40"></label>
        <label>Mobile No. <input id="bmob" inputmode="tel" autocomplete="off" maxlength="14" placeholder="98xxxxxxxx"></label></div>
      <div class="row"><label>Number <input id="bno" autocomplete="off" maxlength="20" placeholder="bill book number"></label>
        <label>Date <input id="bdate" type="date"></label>
        <label>Gold Rate (F) per g, 24K <input id="bF" inputmode="decimal" autocomplete="off"></label></div>
      <div class="seg" role="radiogroup" aria-label="Gold calculation">
        <label><input type="radio" name="bmode" value="ws" checked> W/s</label>
        <label><input type="radio" name="bmode" value="nett"> Nett</label>
        <label><input type="radio" name="bmode" value="g2g"> Gold to Gold</label>
        <label><input type="radio" name="bmode" value="item"> Gold Item</label></div>
      <p class="hint" id="bmodehint"></p>
      <div class="seg" role="radiogroup" aria-label="Settle gold as" id="bsettle" hidden style="margin-top:8px">
        <label><input type="radio" name="bset" value="fine" checked> Customer gives fine gold</label>
        <label><input type="radio" name="bset" value="amount"> Charge the gold in rupees</label></div>
      <div class="seg" role="radiogroup" aria-label="Title" style="margin-top:8px">
        <label><input type="radio" name="btitle" value="Bill" checked> Bill</label>
        <label><input type="radio" name="btitle" value="Estimate"> Estimate</label></div>
      <label style="flex-direction:row;align-items:center;gap:8px;color:var(--fg);margin-top:8px"><input type="checkbox" id="bphoto" checked style="width:auto"> Show piece photos on the bill</label>
      <table class="sum"><tr id="bfinerow" hidden><td><b>Fine gold to receive</b></td><td id="bfine"><b>—</b></td></tr><tr><td>Total</td><td id="bsum">—</td></tr><tr id="bdiscrow" hidden><td>Less discount</td><td id="bdisc">—</td></tr><tr><td>Rounded up to Rs 1,000</td><td id="bsub">—</td></tr>
        <tr><td id="bgstl">GST 3%</td><td id="bgst">—</td></tr><tr class="total"><td>Bill total</td><td id="btotal">—</td></tr></table>
      <p class="hint" id="bnote"></p>
      <div class="actions"><button type="button" class="btn" id="bsave">Save bill &amp; make PDF</button><button type="button" class="btn ghost" id="bclear">Clear</button></div>
      <p class="hint" id="bmsg"></p><div class="actions" id="bout" hidden></div>
      <h2>3 · Saved bills &amp; estimates</h2>
      <div class="row" style="align-items:end"><label style="flex:0 1 200px">Month <input id="bmonth" type="month"></label>
        <div class="actions" style="margin:0"><button type="button" class="btn ghost" id="bxl">Download summary (Excel)</button><button type="button" class="btn ghost" id="bxlall">All months (Excel)</button></div></div>
      <div class="list"><table class="items" style="min-width:640px"><thead><tr><th>Date</th><th>Number</th><th>Type</th><th>Customer</th><th>Total</th><th>Fine gold</th><th>By</th><th></th></tr></thead><tbody id="bbook"></tbody></table></div>
      <p class="hint" id="bbookmsg"></p>`;
    $("p-rates").parentNode.insertBefore(sec, $("p-rates"));
    document.querySelectorAll("nav button").forEach(x => x.addEventListener("click", () => {
      const on = x.dataset.tab === "bill"; sec.hidden = !on; if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); prefill(); numField(); render(); loadBook(); setTimeout(() => $("bq").focus(), 50); }
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y === x ? "true" : "false"));
    }));
    $("badd").addEventListener("click", pick); $("bq").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); pick(); } });
    document.querySelectorAll("input[name=bmode]").forEach(r => r.addEventListener("change", () => { B.mode = r.value; render(); }));
    document.querySelectorAll("input[name=bset]").forEach(r => r.addEventListener("change", () => { B.settle = r.value; render(); }));
    document.querySelectorAll("input[name=btitle]").forEach(r => r.addEventListener("change", () => { B.title = r.value; numField(); }));
    $("bmonth").value = today().slice(0, 7); $("bmonth").addEventListener("change", loadBook);
    $("bxl").addEventListener("click", () => xl($("bmonth").value || today().slice(0, 7))); $("bxlall").addEventListener("click", () => xl("all"));
    $("bF").addEventListener("input", render); $("bdate").addEventListener("change", numField); $("bphoto").addEventListener("change", () => { B.photos = $("bphoto").checked; render(); });
    $("bclear").addEventListener("click", () => { B.items = []; B.disc = {}; $("bcusthint").textContent = ""; ["bname", "bcity", "bmob", "bno", "bq", "bF"].forEach(i => $(i).value = ""); $("bdate").value = ""; $("bmsg").textContent = ""; $("bout").hidden = true; prefill(); numField(); render(); });
    $("bsave").addEventListener("click", save);
  }
  // C-20261016-BILLBOOK: estimate numbers are given by the server (E-YYMM-NN, from 01 each month); bill numbers are typed
  function numField() { const e = B.title === "Estimate", n = $("bno"); n.disabled = e; if (e) n.value = ""; const d = $("bdate").value || today();
    n.placeholder = e ? "automatic (E-" + d.slice(2, 4) + d.slice(5, 7) + "-01, 02 …)" : "bill book number"; }
  async function loadBook() {
    const body = $("bbook"), m = $("bbookmsg"); if (!body) return; const mo = $("bmonth").value || today().slice(0, 7);
    try { const r = await fetch("/api/vj/bills?month=" + encodeURIComponent(mo), { credentials: "same-origin" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      body.textContent = ""; let tot = 0;
      j.bills.slice().reverse().forEach(b => { tot += b.total || 0; const tr = document.createElement("tr"); const td = (x, cl) => { const e = document.createElement("td"); if (cl) e.className = cl; e.textContent = x; tr.appendChild(e); };
        td(dmy(b.date)); td(b.no); td(b.title); td(b.name + (b.city ? ", " + b.city : "")); td(fmt(b.total), "num"); td(b.fine ? g3(b.fine) : "—", "num"); td(b.by || "");
        const x = document.createElement("td"), o = document.createElement("button"); o.type = "button"; o.className = "btn ghost"; o.textContent = "PDF"; o.addEventListener("click", () => reprint(b.no, o)); x.appendChild(o); tr.appendChild(x); body.appendChild(tr); });
      m.textContent = j.bills.length ? `${j.bills.length} in this month, total ${fmt(tot)}.` : "Nothing saved in this month.";
    } catch (e) { m.textContent = "Could not load the saved bills (" + (e.message || e) + ")."; }
  }
  async function reprint(no, btn) { btn.disabled = true;
    try { const r = await fetch("/api/vj/bill?no=" + encodeURIComponent(no), { credentials: "same-origin" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      const b = j.bill, blob = await makePdf(b, B.photos), a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${b.title} ${b.no.replace(/[^A-Z0-9\-]/g, "-")} ${String(b.name).replace(/[^A-Za-z0-9 .\-]/g, "").trim().slice(0, 40)}.pdf`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    } catch (e) { $("bbookmsg").textContent = "Could not open " + no + " (" + (e.message || e) + ")."; } btn.disabled = false; }
  async function xl(mo) {
    try { const r = await fetch("/api/vj/bills.xlsx?month=" + encodeURIComponent(mo), { credentials: "same-origin" }); if (!r.ok) throw new Error(r.status);
      const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = "VJ_Bills_" + (mo === "all" ? "all" : mo.split("-").reverse().join("-")) + ".xlsx";
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    } catch (e) { $("bbookmsg").textContent = "Could not make the Excel (" + (e.message || e) + ")."; } }
  function prefill() { if (!$("bdate").value) $("bdate").value = today(); if (!$("bF").value) { const g = settings().gold24g; if (g) $("bF").value = Math.round(g); } }
  function pick() {
    const box = $("bpick"); box.textContent = ""; const r = find($("bq").value);
    if (!r.length) { box.textContent = "No piece with that design or tag number."; return; }
    if (r.length === 1) { add(r[0]); return; }
    r.forEach(t => { const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = (t.designNo ? t.designNo + " · " : "") + t.label; b.addEventListener("click", () => { add(t); box.textContent = ""; }); box.appendChild(b); });
  }
  function add(t) { if (!B.items.includes(t.id)) B.items.push(t.id); $("bq").value = ""; $("bpick").textContent = ""; fillCustomer(t); render(); $("bq").focus(); }
  // an Order piece brings its customer: only empty boxes are filled; a different customer is flagged, never overwritten
  function fillCustomer(t) { const o = t.kind === "order" && t.order, h = $("bcusthint"); if (!o || !o.name) return;
    const same = !$("bname").value.trim() || $("bname").value.trim().toLowerCase() === String(o.name).toLowerCase();
    if (!same) { h.textContent = `Note: ${t.label} is an order for ${o.name}${o.mobile ? " (" + o.mobile + ")" : ""}, not ${$("bname").value.trim()}.`; return; }
    if (!$("bname").value.trim()) $("bname").value = o.name; if (!$("bmob").value.trim() && o.mobile) $("bmob").value = o.mobile; if (!$("bcity").value.trim() && o.city) $("bcity").value = o.city;
    h.textContent = `Filled from order ${t.label}: ${o.name}${o.mobile ? ", " + o.mobile : ""}${o.city ? ", " + o.city : ""}.`; }
  const F = () => Number(String($("bF").value).replace(/[^0-9.]/g, "")) || 0;
  function calcNow() { const s = settings(), all = tags(); const list = B.items.map(id => all.find(t => t.id === id)).filter(Boolean);
    return vjBillCalc(list, { F: F(), mode: B.mode, settle: B.settle, disc: B.disc, purity: s.purity, making: s.making, gst: s.gst }); }
  function goldCell(r, c) { return c.settle === "fine" ? g3(r.fine) + " fine" : fmt(r.goldAmt) + (c.settle ? " (" + g3(r.fine) + " fine)" : ""); }
  function mkCell(r, c) { return c.mode === "item" ? "in gold" : fmt(r.making) + " (" + r.mkRate + "/g)"; }
  function noteText(mode) { return (mode === "ws" || mode === "g2g" ? "Gold includes 10% wastage. " : "") + (mode === "item" ? "Making is included in the gold. " : ""); }
  function render() {
    const body = $("brows"); if (!body) return; body.textContent = "";
    const c = calcNow(), ok = F() >= 2000;
    c.rows.forEach((r, i) => {
      const tr = document.createElement("tr"); const td = (x, cl) => { const e = document.createElement("td"); if (cl) e.className = cl; e.textContent = x; tr.appendChild(e); };
      td((r.design ? r.design + " · " : "") + r.label + (r.cat ? " · " + r.cat : "")); td(r.gold || "—");
      const t0 = tags().find(t => t.id === r.id); if (B.photos && t0 && t0.photo) { const im = document.createElement("img"); im.alt = ""; im.src = "/_blob/" + t0.photo; im.style.cssText = "width:56px;height:56px;object-fit:cover;border-radius:4px;display:block;margin-bottom:4px"; tr.firstChild.prepend(im); }
      td(ok || c.settle === "fine" ? goldCell(r, c) : "—", "num"); td(ok ? mkCell(r, c) : "—", "num");
      td(r.ct ? r.ct.toFixed(2) + " ct · " + fmt(r.diaAmt) : "—", "num"); td(r.other ? fmt(r.other) : "—", "num"); td(ok ? fmt(r.amount) : "—", "num");
      const dc = document.createElement("td"), di = document.createElement("input"); di.className = "bdisc"; di.dataset.id = r.id; di.value = B.disc[r.id] || ""; di.placeholder = "0"; di.maxLength = 12; di.autocomplete = "off"; di.style.cssText = "width:84px;text-align:right";
      di.addEventListener("input", () => { B.disc[r.id] = di.value.trim(); totals(); }); dc.appendChild(di); tr.appendChild(dc);
      const nt = document.createElement("td"); nt.className = "num"; nt.dataset.net = r.id; nt.textContent = ok ? fmt(r.net) : "—"; tr.appendChild(nt);
      const x = document.createElement("td"), rm = document.createElement("button"); rm.type = "button"; rm.className = "btn ghost"; rm.textContent = "Remove";
      rm.addEventListener("click", () => { delete B.disc[r.id]; B.items.splice(i, 1); render(); }); x.appendChild(rm); tr.appendChild(x); body.appendChild(tr);
    });
    totals(c);
  }
  function totals(c) {
    c = c || calcNow(); const ok = F() >= 2000, has = c.rows.length && ok;
    c.rows.forEach(r => { const n = document.querySelector('[data-net="' + r.id + '"]'); if (n) n.textContent = ok ? fmt(r.net) + (r.discTxt ? " (" + r.discTxt + ")" : "") : "—"; });
    $("bdiscrow").hidden = !c.disc; $("bdisc").textContent = "- " + fmt(c.disc);
    $("bsettle").hidden = !fineMode(); $("bsettle").style.display = fineMode() ? "" : "none"; /* .seg sets display:flex, which beats [hidden] */ $("bfinerow").hidden = !(c.settle === "fine" && c.rows.length); $("bfine").firstChild.textContent = g3(c.fine);
    $("bmodehint").textContent = { ws: "Gold x karat rate + 10% wastage; making Rs 650/g (750/g up to 5 g).", nett: "Gold x karat rate; making Rs 650/g (750 up to 5 g) + 10% of the karat rate.",
      g2g: "Fine gold = weight x 14K 0.66 / 18K 0.836 / 9K 0.4235 / 22K 1.06; making Rs 650/g (750 up to 5 g) in rupees.", item: "Fine gold = weight x 14K 0.74 / 18K 0.90 / 9K 0.54 / 22K 1.06; making included in the gold." }[B.mode];
    $("bsum").textContent = has ? fmt(c.sum) : "—"; $("bsub").textContent = has ? fmt(c.sub) : "—";
    $("bgstl").textContent = "GST " + c.gstPct + "%"; $("bgst").textContent = has ? fmt(c.gst) : "—"; $("btotal").textContent = has ? fmt(c.total) : "—";
    $("bnote").textContent = !ok ? "Type the gold rate (F): fine 24K per gram." : noteText(B.mode) + "Diamond values are the rates saved on each tag.";
  }
  async function dataUrl(src) { const r = await fetch(src, { credentials: "same-origin" }); if (!r.ok) throw new Error("img"); const b = await r.blob(); return await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); }); }
  // photo for the PDF: drawn onto a small canvas and saved as JPEG, so PNG / WebP photos work too
  async function thumb(id) { try { const u = await dataUrl("/_blob/" + id), im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const s = 360 / Math.max(im.width, im.height), c = document.createElement("canvas"); c.width = Math.round(im.width * Math.min(1, s)); c.height = Math.round(im.height * Math.min(1, s));
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); return { d: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height }; } catch (e) { return null; } }
  async function makePdf(b, photos) {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 14; let y = 14;
    try { doc.addImage(await dataUrl("/logo_vaishnavi_jewels.png"), "PNG", M, y, 42, 16); } catch (e) { doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("Vaishnavi Jewels", M, y + 10); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90);
    doc.text(["Vaishnavi Gem & Jewel Pvt Ltd", "120, Rajhans Ornate, Parle Point, Surat 395007", "vaishnavijewels.com"], W - M, y + 3, { align: "right" });
    y += 24; doc.setDrawColor(180, 150, 80); doc.line(M, y, W - M, y); y += 10;
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(b.title, M, y);
    doc.setFontSize(12); doc.text(`No. ${b.no}`, W - M, y - 3, { align: "right" }); doc.setFont("helvetica", "normal"); doc.text(`Date ${dmy(b.date)}`, W - M, y + 3, { align: "right" });
    y += 10; doc.setFontSize(12);
    doc.text(`Name: ${b.name}`, M, y); y += 6.5; doc.text(`City: ${b.city || "-"}`, M, y); doc.text(`Mobile: ${b.mobile ? "+91 " + b.mobile : "-"}`, M + 90, y); y += 6.5;
    doc.text(`Gold Rate (F): ${fmt(b.F)} per g (24K)`, M, y); doc.text(`Gold Calculation: ${MODES[b.mode] || b.mode}${b.settle === "fine" ? " (fine gold)" : b.settle === "amount" ? " (in rupees)" : ""}`, M + 90, y); y += 9;
    const pics = {}; if (photos) for (const r of b.rows) if (r.photo) pics[r.id] = await thumb(r.photo);
    const P = Object.values(pics).some(Boolean) ? 22 : 0; // photo column (mm) only when a piece has a photo
    const cols = P ? [["Piece", 60, "l"], ["Gold", 23, "l"], ["Gold value", 21, "r"], ["Making", 20, "r"], ["Diamonds", 21, "r"], ["Other", 15, "r"], ["Amount", 22, "r"]] // 182 mm = page width less margins
      : [["Piece", 42, "l"], ["Gold", 25, "l"], ["Gold value", 23, "r"], ["Making", 22, "r"], ["Diamonds", 24, "r"], ["Other", 20, "r"], ["Amount", 26, "r"]];
    const row = (vals, bold, size, pic) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size || 10.5); let x = M, h = 0;
      const lines = vals.map((v, i) => doc.splitTextToSize(String(v), cols[i][1] - 2 - (i === 0 && pic !== undefined ? P : 0))); lines.forEach(l => h = Math.max(h, l.length));
      if (pic) { const s = 20 / Math.max(pic.w, pic.h); doc.addImage(pic.d, "JPEG", M + (20 - pic.w * s) / 2, y - 3.5 + (20 - pic.h * s) / 2, pic.w * s, pic.h * s); }
      lines.forEach((l, i) => { const [, w, al] = cols[i]; doc.text(l, al === "r" ? x + w - 1 : x + (i === 0 && pic !== undefined ? P : 0), y, al === "r" ? { align: "right" } : undefined); x += w; });
      y += Math.max(h * 5, pic !== undefined && P ? 21 : 0) + 2.5; };
    doc.setFillColor(243, 230, 211); doc.rect(M, y - 5, W - 2 * M, 8, "F"); row(cols.map(c => c[0]), true); y += 1;
    b.rows.forEach(r => { if (y > 250) { doc.addPage(); y = 20; }
      row([(r.design ? r.design + " - " : "") + r.label + (r.cat ? "\n" + r.cat : ""), r.gold || "-", b.settle === "fine" ? g3(r.fine) + "\nfine" : fmt(r.goldAmt) + (b.settle ? "\n" + g3(r.fine) + " fine" : ""), b.mode === "item" ? "in gold" : fmt(r.making) + "\n@ " + r.mkRate + "/g",
        r.ct ? r.ct.toFixed(2) + " ct\n" + fmt(r.diaAmt) : "-", r.other ? fmt(r.other) : "-", r.disc ? fmt(r.amount) + "\nless " + fmt(r.disc).slice(3) + (r.discTxt ? " (" + r.discTxt + ")" : "") + "\n" + fmt(r.net) : fmt(r.amount)], false, 10.5, P ? (pics[r.id] || null) : undefined);
      doc.setDrawColor(225); doc.line(M, y - 3, W - M, y - 3); });
    y += 3; if (y > 240) { doc.addPage(); y = 20; }
    const tot = (l, v, big) => { doc.setFont("helvetica", big ? "bold" : "normal"); doc.setFontSize(big ? 15 : 12); doc.text(l, W - M - 50, y, { align: "right" }); doc.text(v, W - M, y, { align: "right" }); y += big ? 9 : 7; };
    if (b.settle === "fine") { tot("Fine gold to receive", g3(b.fine), true); y += 2; }
    tot("Total", fmt(b.sum)); if (b.disc) { tot("Less discount", "- " + fmt(b.disc)); tot("Total after discount", fmt(b.after)); } tot("Rounded up to Rs 1,000", fmt(b.sub)); tot(`GST ${b.gstPct}%`, fmt(b.gst)); doc.setDrawColor(180, 150, 80); doc.line(W - M - 95, y - 4, W - M, y - 4); y += 2; tot(b.title + " total", fmt(b.total), true);
    y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(80);
    const notes = [noteText(b.mode).trim(), "All diamonds are third-party certified (IGI / EGL / TGL) and all gold is BIS HUID hallmarked.", b.title === "Estimate" ? "This is an estimate. Final figure may vary with the gold price." : ""].filter(Boolean);
    doc.text(doc.splitTextToSize(notes.join(" "), W - 2 * M), M, y);
    return doc.output("blob");
  }
  async function save() {
    const m = $("bmsg"), out = $("bout"); out.hidden = true;
    const body = { no: $("bno").value.trim(), name: $("bname").value.trim(), city: $("bcity").value.trim(), mobile: $("bmob").value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""),
      date: $("bdate").value, F: F(), mode: B.mode, settle: B.settle, title: B.title, ids: B.items.slice(), disc: Object.assign({}, B.disc) };
    if (!body.name) { m.textContent = "Enter the customer's name."; return; }
    if (!body.no && B.title !== "Estimate") { m.textContent = "Enter the bill number."; return; }
    if (body.mobile && !/^[6-9]\d{9}$/.test(body.mobile)) { m.textContent = "Mobile must be 10 digits (or leave it empty)."; return; }
    if (!(body.F >= 2000)) { m.textContent = "Type the gold rate (F) per gram, 24K."; return; }
    if (!body.ids.length) { m.textContent = "Add at least one piece."; return; }
    $("bsave").disabled = true; m.textContent = "Saving the bill…";
    try {
      const r = await fetch("/api/vj/bill", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status));
      const b = j.bill; m.textContent = "Making the PDF…";
      const blob = await makePdf(b, B.photos), fname = `${b.title} ${b.no.replace(/[^A-Z0-9\-]/g, "-")} ${b.name.replace(/[^A-Za-z0-9 .\-]/g, "").trim().slice(0, 40)}.pdf`;
      const file = new File([blob], fname, { type: "application/pdf" }), url = URL.createObjectURL(file);
      loadBook(); m.textContent = `${b.title} ${b.no} saved: ${fmt(b.total)}${b.fine ? " + " + g3(b.fine) + " fine gold" : ""}.`;
      out.textContent = ""; out.hidden = false;
      const op = document.createElement("a"); op.className = "btn"; op.href = url; op.target = "_blank"; op.rel = "noopener"; op.textContent = "Open PDF (print)";
      const dl = document.createElement("a"); dl.className = "btn ghost"; dl.href = url; dl.download = fname; dl.textContent = "Download";
      out.append(op, dl);
      const canFile = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { return false; } })();
      if (canFile) { const sh = document.createElement("button"); sh.type = "button"; sh.className = "btn ghost"; sh.textContent = "Share (WhatsApp)";
        sh.onclick = async () => { try { await navigator.share({ files: [file] }); } catch (e) {} }; out.append(sh); }
    } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; }
    $("bsave").disabled = false;
  }
  function boot() { if (document.querySelector("nav") && $("p-rates")) { build(); setInterval(() => { const s = $("p-bill"); if (s && !s.hidden && !(document.activeElement && document.activeElement.classList.contains("bdisc"))) render(); }, 20000); } else setTimeout(boot, 300); }
  boot();
})();
