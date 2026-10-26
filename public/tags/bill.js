/* VJ Tags - Bill tab (owner 16/10/2026, C-20261016-BILLS). Loaded by shim.js for owners and staff (not sales).
   Pieces are picked by design / tag number; the customer, bill number, date, gold rate (F, fine 24K per g) and
   W/s or Nett are typed in. The figures on screen are a preview; on "Save bill & make PDF" the server works the bill out
   again from the tags it holds, saves it under its number, and the PDF is printed from the saved figures. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  const B = { items: [], mode: "ws", settle: "fine", title: "Bill", photos: true, nbb: false, disc: {}, rates: {}, frates: {}, prates: {}, pdrates: {} }; // prates: polki rate per pc for this bill (C-20261017-POLKI)
  const MODES = { ws: "W/s", nett: "Nett", g2g: "Gold to Gold", item: "Gold Item" };
  const fineMode = () => B.mode === "g2g" || B.mode === "item";
  const g3 = n => Number(n || 0).toFixed(3) + " g";
  const tags = () => (window.VJ_TAGS_ALL ? window.VJ_TAGS_ALL() : window.VJ_TAGS ? window.VJ_TAGS() : []); // includes sold pieces so saved bills can be edited (C-20261026-SOLD)
  const stockTags = () => tags().filter(t => t.status !== "sold");
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
  // Diamonds = ct x the tag's rate, polki = pcs x rate per pc, plus other charges. Discount (C-20261016-BILLDISC) per piece, rupees or 'n%' of that piece's
  // rupee amount, never more than it. Rupee total less discount, rounded UP to Rs 500 (owner 17 Oct 2026; the rounding is never printed - the Total shown is the rounded figure, and with a discount the printed discount is reduced so the arithmetic holds); GST to the nearest rupee.
  const VJ_FINE = { g2g: { '9K': 0.4235, '14K': 0.66, '18K': 0.836, '22K': 1.06, '24K': 1 }, item: { '9K': 0.54, '14K': 0.74, '18K': 0.90, '22K': 1.06, '24K': 1 } };
  function vjBillCalc(tags, o) {
    const pur = Object.assign({ '24K': 1, '22K': 0.92, '18K': 0.76, '14K': 0.60, '9K': 0.40 }, o.purity || {});
    const m = Object.assign({ base: 650, small: 750, limit: 5, pct: 10, min: 1000 }, o.making || {}), F = Number(o.F) || 0;
    const mode = ['ws', 'nett', 'g2g', 'item'].includes(o.mode) ? o.mode : 'ws', fineMode = mode === 'g2g' || mode === 'item';
    const settle = fineMode ? (o.settle === 'amount' ? 'amount' : 'fine') : '';
    const gstPct = o.gst == null ? 3 : Number(o.gst);
    const rows = tags.map(t => {
      const gl = (t.kind === 'sample' ? [{ k: '14K', net: Number(t.metal && t.metal.net) || 0 }] : (Array.isArray(t.gold) ? t.gold : []))
        .map(g => ({ k: String(g && g.k || ''), net: Number(g && g.net) || 0, tn: (n => n >= 0.3 && n <= 1.1 ? n : 0)(Number(g && g.tunch)) })).filter(g => g.net > 0);
      const tr0 = Number(t.kind === 'order' && t.order && t.order.rate), trT = tr0 >= 2000 && tr0 <= 50000 ? tr0 : (t.kind === 'order' && Number(t.gold24gAtTag) >= 2000 && Number(t.gold24gAtTag) <= 50000 ? Number(t.gold24gAtTag) : 0), Fo = trT || F; // the gold rate typed on the tag is used; only tags without one use today's rate F (owner 17/10, C-20261017-TAGRATE; was C-20261016-ORDERRATE)
      const Fx = Number(o.frates && o.frates[t.id]), Fr = Fx >= 2000 && Fx <= 50000 ? Fx : Fo; // rate typed for this piece on the bill (C-20261016-PIECERATE)
      // owner 17/10/2026 18:16 / 18:19 (C-20261017-CHAINTUNCH): a gold line marked as a chain (its own tunch tn) is gold = net x tunch x the fine rate,
      // fine gold (Gold to Gold / Gold Item) = net x tunch, with no making and no extra wastage. Making, its 5 g limit (first non-chain line) and the
      // Rs 1,000 minimum apply to the non-chain lines only.
      const kr = k => Fr * (Number(pur[k]) || 0), g0 = gl.find(g => !g.tn);
      let mk = 0;
      // owner 17/10/2026 17:00 (C-20261017-MAKINGMIN): making Rs 650/g (750/g when the first gold line is up to 5 g), never below Rs 1,000 a piece,
      // plus 10% wastage on the gold - in every mode (W/s: wastage in the gold value; Nett: wastage added to the making; Gold to Gold: in the fine factor)
      const b = g0 ? (g0.net > m.limit ? m.base : m.small) : 0; if (g0 && mode !== 'item') mk = b;
      let gold = 0, net = 0, fine = 0, nc = 0, ng = 0;
      gl.forEach(g => { net += g.net;
        if (g.tn) { if (fineMode) fine += g.net * g.tn; else gold += g.net * g.tn * Fr; return; }
        nc += g.net;
        if (fineMode) fine += g.net * (VJ_FINE[mode][g.k] || 0);
        else { const v = g.net * kr(g.k) * (mode === 'ws' && g.k !== '24K' ? 1.1 : 1); gold += v; ng += v; } });
      fine = Math.round(fine * 1000) / 1000;
      if (settle === 'amount') gold = fine * Fr;
      const ov = o.rates && Array.isArray(o.rates[t.id]) ? o.rates[t.id] : []; // rates edited on the bill (C-20261016-BILLALL); the tag is not changed
      const dl = (Array.isArray(t.dias) ? t.dias : []).filter(Boolean).map((d, i) => ({ q: String(d.q || ''), shape: String(d.shape || '').slice(0, 20), ct: Number(d.ct) || 0, tagRate: Number(d.rate) || 0, rate: Number(ov[i]) > 0 ? Number(ov[i]) : Number(ov[i]) === -1 ? 0 : (Number(d.rate) || 0), idx: i })) // -1 = rate typed as 0 on the bill (owner 26/10 18:38: party diamond with no charge)
        .sort((x, y) => { const rk = s => { const v = { round: 0, choki: 1, fancy: 2 }[String(s || '').toLowerCase()]; return v === undefined ? 3 : v; }; return rk(x.shape) - rk(y.shape) || x.idx - y.idx; }); // owner 26/10: Round first, then Choki, then Fancy (C-20261026-DIAORDER)
      const ct = dl.reduce((a, d) => a + d.ct, 0), dia = dl.reduce((a, d) => a + d.ct * d.rate, 0), oth = Number(t.other && t.other.amt) || 0;
      // polki (C-20261017-POLKI): pcs x the tag's rate per pc; the rate can be changed on the bill (prates), the tag is not changed
      const pk = t.polki && typeof t.polki === 'object' ? t.polki : null, ppcs = pk ? Math.max(0, Math.round(Number(pk.pcs) || 0)) : 0, ptag = pk ? Math.round(Number(pk.rate) || 0) : 0;
      const px = Number(o.prates && o.prates[t.id]), prate = ppcs ? (px >= 1 && px <= 100000 ? Math.round(px) : ptag) : 0;
    // party diamond (C-20261026-PARTYDIA, owner 26/10 18:14): the customer's own diamonds - setting charge ct x rate per ct (Rs 3,000 default), rate changeable on the bill (pdrates)
    const pdo = t.pdia && typeof t.pdia === 'object' ? t.pdia : null, pdCt = pdo ? Math.max(0, Math.round((Number(pdo.ct) || 0) * 1000) / 1000) : 0, pdPcs = pdo ? Math.max(0, Math.round(Number(pdo.pcs) || 0)) : 0, pdTag = pdCt ? (Math.round(Number(pdo.rate)) || 3000) : 0;
    const pdx = Number(o.pdrates && o.pdrates[t.id]), pdRate = pdCt ? (pdx >= 1 && pdx <= 100000 ? Math.round(pdx) : pdTag) : 0;
      const r = { id: t.id, label: String(t.label || ''), design: String(t.designNo || ''), cat: String(t.catName || ''),
        gold: gl.map(g => g.k + ' ' + g.net.toFixed(3) + ' g' + (g.tn ? ', tunch ' + g.tn.toFixed(3) : '')).join(' + '), chain: gl.length > 0 && !g0, mkWt: Math.round(nc * 1000) / 1000, F: Fr, Fdef: Fo, orderRate: Fo !== F, rateEdited: Fr !== Fo, net: Math.round(net * 1000) / 1000, fine, goldAmt: Math.round(gold),
        mkRate: 0, making: 0, ct: Math.round(ct * 100) / 100, diaAmt: Math.round(dia), polkiPcs: ppcs, polkiRate: prate, polkiTagRate: ppcs ? ptag : 0, polki: ppcs * prate, pdCt, pdPcs, pdRate, pdTagRate: pdTag, pd: Math.round(pdCt * pdRate), cert: String(t.remark || '').slice(0, 10), certNo: String(t.certNo || '').slice(0, 30), other: Math.round(oth), dias: dl };
      if (g0 && mode !== 'item' && nc > 0) { let mkAmt = Math.max(mk * nc, Number(m.min) || 0); if (mode === 'nett') mkAmt += ng * m.pct / 100; r.making = Math.round(mkAmt); r.mkRate = Math.round(r.making / nc); }
      r.amount = r.goldAmt + r.making + r.diaAmt + r.polki + r.pd + r.other;
      const dv = String(o.disc && o.disc[t.id] != null ? o.disc[t.id] : '').trim(), pm = dv.match(/^(\d+(?:\.\d+)?)\s*%$/), dn = Number(dv.replace(/[,\s]/g, ''));
      r.discTxt = pm ? Math.min(100, Number(pm[1])) + '%' : '';
      r.disc = Math.round(Math.min(r.amount, pm ? r.amount * Math.min(100, Number(pm[1])) / 100 : (dn > 0 ? dn : 0)));
      r.wt = r.net; r.net = r.amount - r.disc;
      return r;
    });
    let sum = rows.reduce((a, r) => a + r.amount, 0); const disc = rows.reduce((a, r) => a + r.disc, 0), after = sum - disc;
    const sub = Math.ceil(after / 500) * 500, gst = Math.round(sub * gstPct / 100);
    // owner 17/10 15:29 ('i dont want 26093, straight 26500'): the round-up sits inside the biggest piece's making charge (its
    // rate per g is shown for the new making), or in Other for Gold Item / no gold, so every printed figure adds up to the total.
    // A piece that is only chain has no making (C-20261017-CHAINTUNCH): the biggest other piece takes it; a bill of chains only puts it in Other.
    const roundIn = sub - after;
    if (roundIn > 0 && rows.length) { const rc = rows.some(x => !x.chain) ? rows.filter(x => !x.chain) : rows, r = rc.reduce((a, x) => x.net > a.net ? x : a, rc[0]);
      if (mode !== 'item' && r.mkWt > 0) { r.making += roundIn; r.mkRate = Math.round(r.making / r.mkWt); } else r.other += roundIn;
      r.amount += roundIn; r.net += roundIn; sum += roundIn; }
    const fine = Math.round(rows.reduce((a, r) => a + r.fine, 0) * 1000) / 1000;
    return { mode, settle, rows, fine: settle === 'fine' ? fine : 0, fineIn: fine, sum, disc, after, roundOff: 0, roundIn, sub, gstPct, gst, total: sub + gst };
  }
  // VJ_BILL_CALC_END

  function find(q) {
    q = String(q || "").trim().toUpperCase().replace(/\s+/g, ""); if (!q) return [];
    const n = x => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), nq = n(q);
    if (/^[A-Z]{3}\d+[A-Z]{3}$/.test(q)) { const c = stockTags().filter(t => t.code && String(t.code).toUpperCase() === q); if (c.length) return c; } // price code on the tag (C-20261016-BILLCODE)
    return stockTags().filter(t => String(t.no) === q && /^\d+$/.test(q) || nq && (n(t.designNo) === nq || n(t.label) === nq)).slice(0, 12);
  }
  function build() {
    const nav = document.querySelector("nav"); if (!nav || $("t-bill")) return;
    const b = document.createElement("button"); b.setAttribute("role", "tab"); b.id = "t-bill"; b.dataset.tab = "bill"; b.textContent = "Bill"; b.setAttribute("aria-selected", "false"); b.textContent = "Saved bills"; // owner 26/10/2026: new bills start from Price check > Bill now; this tab shows the saved bills (17:43 'where did my bills go?')
    const nt = nav.querySelector('[data-tab="new"]'); nav.insertBefore(b, nt ? nt.nextSibling : nav.querySelector('[data-tab="rates"]')); // owner 16/10: New tag, Bill, then the rest
    // owner 26/10/2026 17:48: menu order New tag, Tag, Tagged pieces, Find lost tag, Saved bills, (Ledger), Quote, Gold rate & settings
    const order = () => { const n = document.querySelector("nav"); if (!n) return; ["new", "check", "orders", "list", "find", "bill", "ledger", "quote", "rates"].forEach(k => { const x = n.querySelector('[data-tab="' + k + '"]'); if (x) n.appendChild(x); }); };
    order(); setTimeout(order, 1500); setTimeout(order, 5000);
    const sec = document.createElement("section"); sec.id = "p-bill"; sec.className = "card"; sec.hidden = true;
    sec.innerHTML = `<div id="bform">
      <div class="actions" style="margin:0 0 8px"><button type="button" class="btn ghost" id="bback">&larr; Back to Tag</button></div>
      <h2>1 · Pieces</h2>
      <div class="row" style="align-items:end"><label style="flex:2 1 220px">Code on the tag, tag number or design number <input id="bq" autocomplete="off" placeholder="e.g. abc270xyz, 803 or 1436"></label>
      <div><button type="button" class="btn" id="badd">Add piece</button></div></div>
      <div id="bpick" class="row" style="gap:8px"></div>
      <div class="list"><table class="items" style="min-width:820px"><thead><tr><th>Piece</th><th>Gold</th><th>Gold value</th><th>Making</th><th>Diamonds</th><th id="bpolh" hidden>Polki / Party dia.</th><th>Other</th><th>Amount</th><th>Discount<br><span style="font-weight:400;text-transform:none">Rs or %</span></th><th>Net</th><th></th></tr></thead><tbody id="brows"></tbody></table></div>
      <h2>2 · Customer &amp; bill</h2>
      <p class="hint" id="bcusthint"></p>
      <div class="row"><label>Mobile No. <input id="bmob" inputmode="tel" autocomplete="off" maxlength="20" placeholder="98xxxxxxxx"></label>
        <label>Name <input id="bname" autocomplete="off" maxlength="60"></label>
        <label>City <input id="bcity" autocomplete="off" maxlength="40"></label></div>
      <div class="row"><label>Number <input id="bno" autocomplete="off" maxlength="20" placeholder="bill book number"></label>
        <label>Date <input id="bdate" type="date"></label>
        <label><span id="bFl">Gold Rate (F) per g, 24K</span> <input id="bF" inputmode="decimal" autocomplete="off"><input id="bFtag" readonly tabindex="-1" style="display:none"></label></div>
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
      <label style="flex-direction:row;align-items:center;gap:8px;color:var(--fg);margin-top:4px"><input type="checkbox" id="bnbb" style="width:auto"> Stamp <b>No Buy Back · No Exchange</b> on this bill</label>
      <table class="sum"><tr id="bfinerow" hidden><td><b>Fine gold to receive</b></td><td id="bfine"><b>—</b></td></tr><tr><td>Total</td><td id="bsum">—</td></tr><tr id="bdiscrow" hidden><td>Less discount</td><td id="bdisc">—</td></tr><tr hidden><td>Total after discount</td><td id="bsub">—</td></tr>
        <tr><td id="bgstl">GST 3%</td><td id="bgst">—</td></tr><tr class="total"><td>Bill total</td><td id="btotal">—</td></tr></table>
      <p class="hint" id="bnote"></p>
      <p class="hint" id="beditnote" hidden style="color:#8a5a00;font-weight:600"></p>
      <div class="actions"><button type="button" class="btn" id="bsave">Save bill &amp; make PDF</button><button type="button" class="btn ghost" id="bclear">Clear</button></div>
      <p class="hint" id="bmsg"></p><div class="actions" id="bout" hidden></div>
      </div>
      <h2>Saved bills &amp; estimates</h2>
      <div class="row" style="align-items:end"><label style="flex:0 1 200px">Month <input id="bmonth" type="month"></label><label style="flex:0 1 220px">Customer mobile (all bills) <input id="bfmob" inputmode="tel" autocomplete="off" maxlength="14" placeholder="type mobile no."></label>
        <div class="actions" style="margin:0"><button type="button" class="btn ghost" id="bxl">Download summary (Excel)</button><button type="button" class="btn ghost" id="bxlall">All months (Excel)</button><button type="button" class="btn ghost" id="bxwa" hidden>WhatsApp party bills</button></div></div>
      <div class="list"><table class="items" style="min-width:640px"><thead><tr><th>Date</th><th>Number</th><th>Type</th><th>Customer</th><th>Total</th><th>Fine gold</th><th>By</th><th></th></tr></thead><tbody id="bbook"></tbody></table></div>
      <p class="hint" id="bbookmsg"></p>`;
    $("p-rates").parentNode.insertBefore(sec, $("p-rates"));
    document.querySelectorAll("nav button").forEach(x => x.addEventListener("click", () => {
      const on = x.dataset.tab === "bill"; sec.hidden = !on; if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); prefill(); numField(); render(); loadBook(); $("bform").hidden = true; window.scrollTo({ top: 0 }); } // owner 26/10 17:49: the Saved bills tab shows only saved bills & estimates
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y === x ? "true" : "false"));
    }));
    $("badd").addEventListener("click", pick); $("bq").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); pick(); } });
    document.querySelectorAll("input[name=bmode]").forEach(r => r.addEventListener("change", () => { B.mode = r.value; render(); }));
    document.querySelectorAll("input[name=bset]").forEach(r => r.addEventListener("change", () => { B.settle = r.value; render(); }));
    document.querySelectorAll("input[name=btitle]").forEach(r => r.addEventListener("change", () => { B.title = r.value; numField(); }));
    $("bmonth").value = today().slice(0, 7); $("bmonth").addEventListener("change", loadBook); { let tm = 0; $("bfmob").addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(loadBook, 350); }); } // owner 26/10 17:58: type a mobile no. and see all that customer's bills
    $("bxl").addEventListener("click", () => xl($("bmonth").value || today().slice(0, 7))); $("bxlall").addEventListener("click", () => xl("all")); $("bxwa").addEventListener("click", e => partyWA(e.currentTarget));
    $("bF").addEventListener("input", render); $("bdate").addEventListener("change", numField); $("bphoto").addEventListener("change", () => { B.photos = $("bphoto").checked; render(); }); $("bnbb").addEventListener("change", () => { B.nbb = $("bnbb").checked; });
    $("bclear").addEventListener("click", () => { B.editNo = null; { const n = $("beditnote"); if (n) { n.hidden = true; n.textContent = ""; } } $("bsave").textContent = "Save bill & make PDF"; document.querySelectorAll("input[name=btitle]").forEach(x => { x.disabled = false; }); B.items = []; B.nbb = false; $("bnbb").checked = false; B.nbbAuto = false; B.disc = {}; B.rates = {}; B.frates = {}; B.prates = {}; B.pdrates = {}; $("bcusthint").textContent = ""; ["bname", "bcity", "bmob", "bno", "bq", "bF"].forEach(i => $(i).value = ""); $("bdate").value = ""; $("bmsg").textContent = ""; $("bout").hidden = true; prefill(); numField(); render(); });
    $("bsave").addEventListener("click", save);
    $("bback").addEventListener("click", () => { const c = document.querySelector('nav button[data-tab="check"]'); if (c) c.click(); });
  }
  // owner 26/10/2026 (C-20261026-BILLNOW): Price check > Bill now opens a fresh bill with that piece; weights come from the tag (not editable),
  // the gold rate and diamond / polki rates can be changed for this bill only; name, mobile and city are asked first.
  window.VJ_BILL_NOW = id => { if (!$("p-bill")) return; $("bclear").click(); $("bform").hidden = false; const t = tags().find(x => x.id === id);
    document.querySelectorAll('[id^="p-"]').forEach(p => { p.hidden = p.id !== "p-bill"; });
    document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", "false"));
    prefill(); numField(); if (t) add(t); loadBook(); window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => { const n = $("bmob"); if (n) n.focus(); }, 120); }; // owner 26/10 17:51: mobile first, the party's name and city fill in
  window.VJ_BILL_ADD = id => { const t = tags().find(x => x.id === id); if (t) add(t); }; // Orders pending > Bill all (C-20261026-ORDERSDUE)
  // C-20261016-BILLBOOK: estimate numbers are given by the server (E-YYMM-NN, from 01 each month); bill numbers are typed
  function numField() { const e = B.title === "Estimate", n = $("bno"); n.disabled = true; n.value = ""; const d = $("bdate").value || today(); // owner 16/10: bill numbers automatic too
    n.placeholder = "automatic (" + (e ? "E-" : "B-") + d.slice(2, 4) + d.slice(5, 7) + "-01, 02 …)"; }
  async function loadBook() {
    const body = $("bbook"), m = $("bbookmsg"); if (!body) return; const mo = $("bmonth").value || today().slice(0, 7); const fq = String(($("bfmob") || {}).value || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""); const byMob = fq.length >= 4;
    try { const r = await fetch("/api/vj/bills?month=" + encodeURIComponent(byMob ? "all" : mo), { credentials: "same-origin" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); if (byMob) j.bills = j.bills.filter(b => String(b.mobile || "").replace(/\D/g, "").includes(fq)); { const pb = byMob ? j.bills.find(b => !b.cancelled) : null; B.party = pb ? { name: pb.name, city: pb.city, mobile: pb.mobile } : null; $("bxwa").hidden = !pb; $("bxl").textContent = pb ? "Download party bills (Excel)" : "Download summary (Excel)"; $("bxlall").hidden = !!pb; }
      body.textContent = ""; let tot = 0;
      let nc = 0;
      // owner 16/10: a cancelled bill's line leaves the screen for everyone (still kept, still in the Excel) (C-20261016-HIDECANCELLED, C-20261016-NOSHOWCANCELLED)
      j.bills.slice().reverse().forEach(b => { if (b.cancelled) { nc++; return; } else tot += b.total || 0; const tr = document.createElement("tr"); const td = (x, cl) => { const e = document.createElement("td"); if (cl) e.className = cl; e.textContent = x; tr.appendChild(e); return e; };
        td(dmy(b.date)); td(b.no); const ty = td(b.title); if (b.cancelled) { const s = document.createElement("div"); s.style.cssText = "color:#a12b2b;font-weight:600"; s.textContent = "CANCELLED"; const r = document.createElement("div"); r.className = "hint"; r.textContent = b.cancelled; ty.append(s, r); tr.style.opacity = "0.75"; }
        td(b.name + (b.city ? ", " + b.city : "")); { const tt = td(fmt(b.total), "num"); if (b.received != null) tt.appendChild(Object.assign(document.createElement("div"), { className: "hint", textContent: b.settled ? "Settled" : "Paid " + fmt(b.received) + " · Bal " + fmt(b.balance) })); } /* C-20261017-LEDGER */ td(b.fine ? g3(b.fine) : "—", "num"); td(b.by || "");
        const x = document.createElement("td"); x.style.whiteSpace = "nowrap"; const o = document.createElement("button"); o.type = "button"; o.className = "btn ghost"; o.textContent = "PDF"; o.addEventListener("click", () => reprint(b.no, o)); x.appendChild(o);
        if (j.canCancel && !b.cancelled && !b.settled) { const ed = document.createElement("button"); ed.type = "button"; ed.className = "btn ghost"; ed.textContent = "Edit"; ed.title = "Change this bill (same number) - owners only"; ed.addEventListener("click", () => editBill(b.no, ed)); x.appendChild(ed); } // C-20261026-BILLEDIT
        { const w = document.createElement("button"); w.type = "button"; w.className = "btn ghost"; w.textContent = "WhatsApp"; w.title = "Send this bill from your own WhatsApp"; // C-20261026-MYWA
          w.addEventListener("click", async () => { try { if (!w._b) { w.textContent = "Preparing…"; const r = await fetch("/api/vj/bill?no=" + encodeURIComponent(b.no), { credentials: "same-origin" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); w._b = j.bill; w._blob = await makePdf(j.bill, B.photos); w.textContent = "Tap to send ✓"; $("bbookmsg").textContent = b.no + " is ready - tap 'Tap to send' to open WhatsApp."; return; }
            await myWA(w._b, w._blob, $("bbookmsg")); w.textContent = "WhatsApp"; } catch (e) { w.textContent = "WhatsApp"; $("bbookmsg").textContent = "Could not prepare " + b.no + " (" + (e.message || e) + ")."; } }); x.appendChild(w); }
        if (j.canCancel || (j.canCancelOnly && !b.cancelled)) { const c = document.createElement("button"); c.type = "button"; c.className = "btn ghost"; c.style.color = "#a12b2b"; c.textContent = j.canCancel ? "Cancel / Erase" : "Cancel"; c.addEventListener("click", () => actBox(b, x, !!j.canCancel)); x.appendChild(c); }
        tr.appendChild(x); body.appendChild(tr); });
      m.textContent = j.bills.length ? `${j.bills.length} in this month${nc ? " (" + nc + " cancelled)" : ""}, total ${fmt(tot)}${nc ? " without the cancelled ones" : ""}.` : "Nothing saved in this month.";
      const live = j.bills.length - nc; // C-20261016-HIDECANCELLED
      m.textContent = byMob ? (live ? live + " bill" + (live === 1 ? "" : "s") + " for mobile " + fq + " (all months), total " + fmt(tot) + "." : "No bills for mobile " + fq + ".") : (live ? live + " in this month, total " + fmt(tot) + "." : "Nothing saved in this month.") + (nc ? " " + nc + " cancelled " + (nc === 1 ? "bill" : "bills") + " hidden (kept in the Excel, marked CANCELLED)." : "");
    } catch (e) { m.textContent = "Could not load the saved bills (" + (e.message || e) + ")."; }
  }
  // owners only (C-20261016-BILL3WAY): 1 erase everything, 2 cancel the bill only (pieces stay - orders stay orders), 3 cancel and move order pieces to stock
  function actBox(b, cell, owner) { // owner: all 3 choices; anyone else: only 2 (cancel the bill, pieces unchanged)
    cell.textContent = ""; const w = document.createElement("div"); w.style.cssText = "display:flex;flex-direction:column;gap:6px;max-width:360px;white-space:normal";
    const nm = "bact" + Math.random().toString(36).slice(2), opts = [];
    const add = (v, l) => { const lb = document.createElement("label"); lb.style.cssText = "flex-direction:row;align-items:flex-start;gap:8px;color:var(--fg);font-size:14px"; const r = document.createElement("input"); r.type = "radio"; r.name = nm; r.value = v; r.style.cssText = "width:auto;margin-top:3px"; lb.append(r, l); w.appendChild(lb); opts.push(r); };
    if (owner) add("1", `1 · Erase everything: the bill and its ${b.pieces} piece${b.pieces === 1 ? "" : "s"} (tags, codes, photos) are removed for good`);
    if (!b.cancelled) add("2", "2 · Cancel the bill only: pieces stay as they are (an order stays an order, pending again)");
    if (owner) add("3", b.cancelled ? "3 · Move this bill's order pieces to stock" : "3 · Cancel the bill and move its order pieces to stock");
    const sel = document.createElement("select"); sel.setAttribute("aria-label", "Reason for cancelling");
    [["", "Reason…"], ["Customer cancelled", "Customer cancelled"], ["Wrong entry", "Wrong entry"], ["Made again", "Made again (new bill)"], ["Other", "Other"]].forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
    const note = document.createElement("input"); note.placeholder = "note (needed for Other)"; note.maxLength = 120;
    const rs = document.createElement("div"); rs.style.cssText = "display:flex;gap:6px;flex-wrap:wrap"; rs.append(sel, note); rs.hidden = true;
    const y = document.createElement("button"); y.type = "button"; y.className = "btn danger"; y.textContent = "Do it"; y.disabled = true;
    const n = document.createElement("button"); n.type = "button"; n.className = "btn ghost"; n.textContent = "Keep";
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:6px"; row.append(y, n);
    let sure = false; const pick = () => (opts.find(r => r.checked) || {}).value || "";
    const ok = () => { const v = pick(), needR = (v === "2" || v === "3") && !b.cancelled; rs.hidden = !needR; rs.style.display = needR ? "flex" : "none"; sure = false;
      y.textContent = v === "1" ? "Erase for good" : "Do it"; y.disabled = !v || (needR && (!sel.value || (sel.value === "Other" && !note.value.trim()))); };
    opts.forEach(r => r.addEventListener("change", ok)); sel.addEventListener("change", ok); note.addEventListener("input", ok); n.addEventListener("click", loadBook); if (opts.length === 1) opts[0].checked = true; ok();
    y.addEventListener("click", async () => {
      const v = pick(); if (v === "1" && !sure) { sure = true; y.textContent = "Yes, erase " + b.no + " for good"; return; }
      y.disabled = true;
      try { const r = await fetch(v === "1" ? "/api/vj/bill/erase" : "/api/vj/bill/cancel", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify(v === "1" ? { no: b.no, confirm: b.no } : { no: b.no, reason: sel.value, note: note.value.trim(), stock: v === "3" }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 403 ? "only Abhinav or Shilpiji can do this" : (j.error || r.status));
        const done = v === "1" ? `${b.title} ${b.no} and its ${j.pieces} piece${j.pieces === 1 ? "" : "s"} were erased.` : v === "2" ? `${b.title} ${b.no} cancelled; its pieces are unchanged.` : `${b.title} ${b.no} cancelled; ${j.moved} order piece${j.moved === 1 ? "" : "s"} moved to stock.`;
        await loadBook(); $("bbookmsg").textContent = done + " " + $("bbookmsg").textContent;
      } catch (e) { $("bbookmsg").textContent = "Could not do it: " + (e.message || e) + "."; y.disabled = false; sure = false; } });
    w.append(rs, row); cell.appendChild(w);
  }
  // owners only (the server refuses anyone else): cancel with a reason; the bill stays in the records, marked CANCELLED (C-20261016-BILLCANCEL)
  function cancelBox(b, cell) {
    cell.textContent = ""; const sel = document.createElement("select"); sel.setAttribute("aria-label", "Reason for cancelling");
    [["", "Reason…"], ["Customer cancelled", "Customer cancelled"], ["Wrong entry", "Wrong entry"], ["Made again", "Made again (new bill)"], ["Other", "Other"]].forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.appendChild(o); });
    const note = document.createElement("input"); note.placeholder = "note (needed for Other)"; note.maxLength = 120; note.style.width = "160px";
    const y = document.createElement("button"); y.type = "button"; y.className = "btn danger"; y.textContent = "Cancel " + b.no; y.disabled = true;
    const n = document.createElement("button"); n.type = "button"; n.className = "btn ghost"; n.textContent = "Keep";
    const ok = () => { y.disabled = !sel.value || (sel.value === "Other" && !note.value.trim()); }; sel.addEventListener("change", ok); note.addEventListener("input", ok);
    n.addEventListener("click", loadBook);
    y.addEventListener("click", async () => { y.disabled = true;
      try { const r = await fetch("/api/vj/bill/cancel", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ no: b.no, reason: sel.value, note: note.value.trim() }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 403 ? "only Abhinav or Shilpiji can cancel" : (j.error || r.status));
        const why = sel.value; await loadBook(); $("bbookmsg").textContent = `${b.title} ${b.no} cancelled (${why}). It stays in the records. ` + $("bbookmsg").textContent;
      } catch (e) { $("bbookmsg").textContent = "Could not cancel: " + (e.message || e) + "."; y.disabled = false; } });
    const wrap = document.createElement("div"); wrap.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;align-items:center"; wrap.append(sel, note, y, n); cell.appendChild(wrap);
  }
  // owners only: erase a completed bill for good - the bill, its pieces' tags, photos and history (C-20261016-BILLERASE)
  function eraseBox(b, cell) {
    cell.textContent = ""; const w = document.createElement("div"); w.style.cssText = "display:flex;flex-direction:column;gap:6px;max-width:320px;white-space:normal";
    const t = document.createElement("div"); t.style.cssText = "color:#a12b2b;font-weight:600"; t.textContent = `Erase ${b.title} ${b.no} for good? Its ${b.pieces} piece${b.pieces === 1 ? "" : "s"} (tags, codes, photos, history) are removed too. This cannot be undone.`;
    const inp = document.createElement("input"); inp.placeholder = "type " + b.no + " to confirm"; inp.autocomplete = "off";
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:6px";
    const y = document.createElement("button"); y.type = "button"; y.className = "btn danger"; y.textContent = "Erase for good"; y.disabled = true;
    const n = document.createElement("button"); n.type = "button"; n.className = "btn ghost"; n.textContent = "Keep";
    inp.addEventListener("input", () => { y.disabled = inp.value.trim().toUpperCase() !== String(b.no).toUpperCase(); }); n.addEventListener("click", loadBook);
    y.addEventListener("click", async () => { y.disabled = true;
      try { const r = await fetch("/api/vj/bill/erase", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ no: b.no, confirm: inp.value.trim() }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(r.status === 403 ? "only Abhinav or Shilpiji can erase" : (j.error || r.status));
        await loadBook(); $("bbookmsg").textContent = `${b.title} ${b.no} and its ${j.pieces} piece${j.pieces === 1 ? "" : "s"} were erased. ` + $("bbookmsg").textContent;
      } catch (e) { $("bbookmsg").textContent = "Could not erase: " + (e.message || e) + "."; y.disabled = false; } });
    row.append(y, n); w.append(t, inp, row); cell.appendChild(w); inp.focus();
  }
  // Send the bill PDF to the customer on WhatsApp from Aashvi (owner 17/10/2026, C-20261017-BILLWA). First tap asks to confirm the
  // number; the server sends to the mobile saved on the bill only, and the status is shown here when Aashvi reports back.
  async function sendWA(b, blob, btn, msg) {
    const mob = String(b.mobile || ""); if (!/^[6-9]\d{9}$/.test(mob)) { msg.textContent = "This bill has no 10-digit mobile number, so it cannot go on WhatsApp."; return; }
    if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.textContent = "Tap again to send to +91 " + mob; setTimeout(() => { if (btn.dataset.sure === "1") { btn.dataset.sure = ""; btn.textContent = "Send on WhatsApp (Aashvi)"; } }, 8000); return; }
    btn.dataset.sure = ""; btn.disabled = true; btn.textContent = "Sending…";
    try { const pdf = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(",")[1] || ""); f.onerror = rej; f.readAsDataURL(blob); });
      const r = await fetch("/api/vj/bill/send", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ no: b.no, pdf }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status));
      msg.textContent = `${b.title} ${b.no}: handed to Aashvi for ${j.to}…`;
      for (let i = 0; i < 30; i++) { await new Promise(z => setTimeout(z, 3000));
        const s = await (await fetch("/api/vj/bill/sendstatus?t=" + j.token, { credentials: "same-origin" })).json().catch(() => ({}));
        if (s.status === "sent") { msg.textContent = `${b.title} ${b.no} sent on WhatsApp to ${j.to} ✓`; btn.textContent = "Sent ✓"; return; }
        if (s.status === "failed" || s.status === "expired") throw new Error(s.error || "Aashvi could not send it"); }
      msg.textContent = `${b.title} ${b.no}: Aashvi has not confirmed yet. Check WhatsApp before sending again.`; btn.textContent = "Send on WhatsApp (Aashvi)";
    } catch (e) { msg.textContent = "Not sent on WhatsApp: " + (e.message || e) + "."; btn.textContent = "Send on WhatsApp (Aashvi)"; }
    btn.disabled = false;
  }
  // owner 26/10/2026 17:32 (C-20261026-BILLEDIT): open a saved bill in the form; saving updates it under the same number (owners only, the server keeps the old version)
  async function editBill(no, btn) { btn.disabled = true;
    try { const r = await fetch("/api/vj/bill?no=" + encodeURIComponent(no), { credentials: "same-origin" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      const b = j.bill, all = tags(); const miss = (b.rows || []).filter(x => !all.some(t => t.id === x.id)); if (miss.length) throw new Error("a piece on it is no longer in stock (" + miss.map(x => x.label).join(", ") + ")");
      $("bclear").click(); $("bform").hidden = false; B.items = b.rows.map(x => x.id); B.mode = b.mode || "ws"; B.settle = b.settle || "fine"; B.title = b.title || "Bill"; B.nbb = !!b.nbb; $("bnbb").checked = B.nbb; B.nbbAuto = true;
      document.querySelectorAll("input[name=bmode]").forEach(x => { x.checked = x.value === B.mode; }); document.querySelectorAll("input[name=bset]").forEach(x => { x.checked = x.value === B.settle; });
      document.querySelectorAll("input[name=btitle]").forEach(x => { x.checked = x.value === B.title; x.disabled = true; });
      $("bname").value = b.name || ""; $("bcity").value = b.city || ""; $("bmob").value = b.mobile || ""; $("bdate").value = b.date; $("bF").value = b.F;
      b.rows.forEach(x => { if (x.discTxt) B.disc[x.id] = x.discTxt; else if (x.disc > 0) B.disc[x.id] = String(x.disc);
        if (Math.round(x.F) !== Math.round(b.F)) B.frates[x.id] = x.F;
        const ds = x.dias || []; if (ds.some(d => d.rate !== d.tagRate)) { const a = ds.map(() => 0); ds.forEach((d, k) => { a[d.idx != null ? d.idx : k] = d.rate !== d.tagRate ? (d.rate || -1) : 0; }); B.rates[x.id] = a; }
        if (x.polkiPcs && x.polkiRate !== x.polkiTagRate) B.prates[x.id] = x.polkiRate;
        if (x.pdCt && x.pdRate !== x.pdTagRate) B.pdrates[x.id] = x.pdRate; });
      B.editNo = b.no; $("bno").value = b.no; const n = $("beditnote"); n.hidden = false;
      n.textContent = `Editing ${b.title} ${b.no} (${b.name}). Change what you need, then Update - it keeps the same number. Clear = stop editing.`;
      $("bsave").textContent = "Update bill & make PDF"; render(); $("p-bill").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { $("bbookmsg").textContent = "Cannot edit " + no + ": " + (e.message || e) + "."; }
    btn.disabled = false; }
  // owner 26/10/2026 17:33 (C-20261026-MYWA): bills go from the owner's OWN WhatsApp, not Aashvi. Phone (or a computer with the WhatsApp
  // app installed): the share box opens with the PDF - choose WhatsApp, then the customer. Computer without it: the customer's chat opens in
  // WhatsApp with the message typed, and the PDF is saved to Downloads to drag into the chat.
  function waText(b) { return `Dear ${b.name}, thank you for choosing Vaishnavi Jewels. Please find your ${b.title.toLowerCase()} ${b.no} for ${fmt(b.total)} attached.\n\nShilpi & Abhinav\nMihir Bhai`; }
  async function myWA(b, blob, msgEl) {
    const fname = `${b.title} ${b.no.replace(/[^A-Z0-9\-]/g, "-")} ${String(b.name || "").replace(/[^A-Za-z0-9 .\-]/g, "").trim().slice(0, 40)}.pdf`, file = new File([blob], fname, { type: "application/pdf" });
    let can = false; try { can = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
    if (can) { try { await navigator.share({ files: [file], text: waText(b) }); msgEl.textContent = `${b.title} ${b.no}: choose WhatsApp and the customer in the share box.`; return; } catch (e) { if (e && e.name === "AbortError") return; } }
    const mob = String(b.mobile || ""); const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    window.open((/^[6-9]\d{9}$/.test(mob) ? "https://wa.me/91" + mob : "https://wa.me/") + "?text=" + encodeURIComponent(waText(b)), "_blank", "noopener");
    msgEl.textContent = `${b.title} ${b.no}: WhatsApp opened` + (/^[6-9]\d{9}$/.test(mob) ? ` for +91 ${mob}` : "") + ` with the message. The PDF "${fname}" is in Downloads - drag it into the chat. (Install the WhatsApp app for Windows to send the PDF straight from the share box, with no download.)`;
  }
  async function reprint(no, btn) { btn.disabled = true;
    try { const r = await fetch("/api/vj/bill?no=" + encodeURIComponent(no), { credentials: "same-origin" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      const b = j.bill, blob = await makePdf(b, B.photos), a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${b.title} ${b.no.replace(/[^A-Z0-9\-]/g, "-")} ${String(b.name).replace(/[^A-Za-z0-9 .\-]/g, "").trim().slice(0, 40)}.pdf`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    } catch (e) { $("bbookmsg").textContent = "Could not open " + no + " (" + (e.message || e) + ")."; } btn.disabled = false; }
  // owner 26/10 18:03: with a customer mobile typed, Excel = that party's bills (all months), file named "Party name, City"; WhatsApp sends it from his own WhatsApp
  const partyQ = () => { const q = String(($("bfmob") || {}).value || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""); return q.length >= 4 && B.party ? q : ""; };
  const partyName = () => [B.party.name, B.party.city].map(x => String(x || "").replace(/[^A-Za-z0-9 .\-]/g, "").trim()).filter(Boolean).join(", ").slice(0, 60) || "Party bills";
  async function partyFile() { const q = partyQ(); const r = await fetch("/api/vj/bills.xlsx?month=all", { credentials: "same-origin", headers: { "x-vj-mob": q } }); if (!r.ok) throw new Error(r.status);
    return new File([await r.blob()], partyName() + ".xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); }
  async function partyWA(btn) { const m = $("bbookmsg"); btn.disabled = true; try { const f = await partyFile(), p = B.party, mob = String(p.mobile || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
      const txt = `Dear ${p.name},\nPlease find attached the summary of your bills with Vaishnavi Jewels.\n\nShilpi & Abhinav\nMihir Bhai`;
      let can = false; try { can = !!(navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) {}
      if (can) { try { await navigator.share({ files: [f], text: txt }); m.textContent = "Choose WhatsApp and " + p.name + " in the share box."; return; } catch (e) { if (e && e.name === "AbortError") return; } }
      const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      window.open((/^[6-9]\d{9}$/.test(mob) ? "https://wa.me/91" + mob : "https://wa.me/") + "?text=" + encodeURIComponent(txt), "_blank", "noopener");
      m.textContent = `WhatsApp opened for ${p.name} with the message. The Excel "${f.name}" is in Downloads - drag it into the chat.`;
    } catch (e) { m.textContent = "Could not make the Excel (" + (e.message || e) + ")."; } finally { btn.disabled = false; } }
  async function xl(mo) {
    try { if (partyQ()) { const f = partyFile(), a = document.createElement("a"); a.href = URL.createObjectURL(await f); a.download = (await f).name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); return; }
      const r = await fetch("/api/vj/bills.xlsx?month=" + encodeURIComponent(mo), { credentials: "same-origin" }); if (!r.ok) throw new Error(r.status);
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
    const nj = v => String(v || "").trim().replace(/\s*ji$/i, "").toLowerCase(), same = !$("bname").value.trim() || nj($("bname").value) === nj(o.name);
    if (!same) { h.textContent = `Note: ${t.label} is an order for ${o.name}${o.mobile ? " (" + o.mobile + ")" : ""}, not ${$("bname").value.trim()}.`; return; }
    if (!$("bname").value.trim()) $("bname").value = o.name; if (!$("bmob").value.trim() && o.mobile) $("bmob").value = o.mobile; if (!$("bcity").value.trim() && o.city) $("bcity").value = o.city;
    h.textContent = `Filled from order ${t.label}: ${o.name}${o.mobile ? ", " + o.mobile : ""}${o.city ? ", " + o.city : ""}.`;
    // owner 26/10 18:31 (C-20261026-ORDERTAG): no mobile on the order -> take it from the saved parties when exactly one party has this name; otherwise it is typed at billing
    if (!$("bmob").value.trim()) fetch("/api/vj/parties?q=" + encodeURIComponent(o.name), { credentials: "same-origin", cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
      const m = ((j && j.parties) || []).filter(p => String(p.name || "").trim().replace(/\s*ji$/i, "").toLowerCase() === String(o.name).trim().replace(/\s*ji$/i, "").toLowerCase() && p.mobile), mobs = [...new Set(m.map(p => p.mobile))];
      if (mobs.length === 1 && !$("bmob").value.trim()) { $("bmob").value = mobs[0]; if (!$("bcity").value.trim() && m[0].city) $("bcity").value = m[0].city; h.textContent += " Mobile " + mobs[0] + " taken from saved parties."; }
      else if (!$("bmob").value.trim()) h.textContent += " Type the mobile number."; }).catch(() => {}); }
  const F = () => Number(String($("bF").value).replace(/[^0-9.]/g, "")) || 0;
  function calcNow() { const s = settings(), all = tags(); const list = B.items.map(id => all.find(t => t.id === id)).filter(Boolean);
    return vjBillCalc(list, { F: F(), mode: B.mode, settle: B.settle, disc: B.disc, rates: B.rates, frates: B.frates, prates: B.prates, pdrates: B.pdrates, purity: s.purity, making: s.making, gst: s.gst }); }
  function goldCell(r, c) { return c.settle === "fine" ? g3(r.fine) + " fine" : fmt(r.goldAmt) + (c.settle ? " (" + g3(r.fine) + " fine)" : ""); }
  function mkCell(r, c) { return r.chain ? "— (chain)" /* C-20261017-CHAINTUNCH: no making on chain lines */ : c.mode === "item" ? "in gold" : fmt(r.making) + " (" + r.mkRate + "/g" + (r.mkWt > 0 && Math.abs(r.mkWt - r.wt) > 0.0005 ? " on " + r.mkWt.toFixed(3) + " g" : "") + ")"; }
  function noteText(mode, rows) { const ch = (rows || []).some(r => /tunch/.test(r.gold || "")); // C-20261017-CHAINTUNCH
    return (mode === "ws" || mode === "g2g" ? "Gold includes 10% wastage" + (ch ? " (chains: gold x tunch, no making)" : "") + ". " : ch ? "Chains: gold x tunch, no making. " : "") + (mode === "item" ? "Making is included in the gold. " : ""); }
  function render() {
    const body = $("brows"); if (!body) return; body.textContent = "";
    const c = calcNow(), ok = F() >= 2000, hasPol = c.rows.some(r => r.polkiPcs > 0 || r.pdCt > 0); $("bpolh").hidden = !hasPol;
    c.rows.forEach((r, i) => {
      const tr = document.createElement("tr"); const td = (x, cl) => { const e = document.createElement("td"); if (cl) e.className = cl; e.textContent = x; tr.appendChild(e); };
      td((r.design ? r.design + " · " : "") + r.label + (r.cat ? " · " + r.cat : "")); { // fine gold rate (24K per g) for this piece: an order's own rate, otherwise today's rate; editable (C-20261016-PIECERATE)
        const gt = document.createElement("td"); gt.append(r.gold || "—"); const ln = document.createElement("div"); ln.style.cssText = "white-space:nowrap;margin-top:4px;font-size:12px";
        const fi = document.createElement("input"); fi.className = "brate"; fi.inputMode = "decimal"; fi.autocomplete = "off"; fi.style.cssText = "width:78px;text-align:right;padding:4px 6px"; fi.value = B.frates[r.id] || Math.round(r.Fdef) || "";
        fi.addEventListener("input", () => { const v = Number(fi.value.replace(/[^0-9.]/g, "")) || 0; if (v && v !== Math.round(r.Fdef)) B.frates[r.id] = v; else delete B.frates[r.id]; totals(); });
        ln.append(r.orderRate ? "tag rate " : "rate ", fi); gt.appendChild(ln); tr.appendChild(gt); }
      const t0 = tags().find(t => t.id === r.id); if (B.photos && t0 && t0.photo) { const im = document.createElement("img"); im.alt = ""; im.src = "/_blob/" + t0.photo; im.style.cssText = "width:56px;height:56px;object-fit:cover;border-radius:4px;display:block;margin-bottom:4px"; tr.firstChild.prepend(im); }
      td(ok || c.settle === "fine" ? goldCell(r, c) : "—", "num"); td(ok ? mkCell(r, c) : "—", "num");
      // diamonds: the rate saved on the tag, editable here for this bill only (C-20261016-BILLALL)
      const dt = document.createElement("td"); dt.className = "num"; if (!r.dias.length) dt.textContent = "—";
      r.dias.forEach((d, k) => { const ln = document.createElement("div"); ln.style.cssText = "white-space:nowrap;margin:2px 0";
        const ri = document.createElement("input"); ri.className = "brate"; ri.inputMode = "numeric"; ri.autocomplete = "off"; ri.style.cssText = "width:78px;text-align:right;padding:4px 6px"; ri.value = d.rate === 0 && (d.tagRate > 0 || /party/i.test(d.q)) ? "0" : (d.rate || ""); ri.title = "Rate per ct (tag: " + (d.tagRate || "-") + ")";
        ri.addEventListener("input", () => { const a = B.rates[r.id] = (B.rates[r.id] || r.dias.map(() => 0)).slice(); a[d.idx != null ? d.idx : k] = ri.value.replace(/[^0-9.]/g, "") !== "" && Number(ri.value.replace(/[^0-9.]/g, "")) === 0 ? -1 : Number(ri.value.replace(/[^0-9.]/g, "")) || 0; totals(); });
        ln.append(`${d.shape ? d.shape + " " : ""}${d.q} ${d.ct.toFixed(2)} ct @ `, ri); /* owner 26/10: diamond shape shown (C-20261026-DIASHAPE) */ dt.appendChild(ln); });
      if (r.dias.length) { const dv = document.createElement("div"); dv.dataset.dia = r.id; dv.style.fontWeight = "600"; dv.textContent = "= " + fmt(r.diaAmt); dt.appendChild(dv); }
      tr.appendChild(dt);
      if (hasPol) { // polki pcs x rate per pc; the rate can be changed for this bill only (C-20261017-POLKI)
        const pt = document.createElement("td"); pt.className = "num"; if (!r.polkiPcs && !r.pdCt) pt.textContent = "—"; if (r.pdCt) { // party diamond setting ct x rate per ct, changeable for this bill (C-20261026-PARTYDIA)
          const ln = document.createElement("div"); ln.style.cssText = "white-space:nowrap;margin:2px 0"; const pi = document.createElement("input"); pi.className = "brate"; pi.inputMode = "numeric"; pi.autocomplete = "off"; pi.style.cssText = "width:64px;text-align:right;padding:4px 6px"; pi.value = r.pdRate || ""; pi.title = "Setting rate per ct (tag: " + (r.pdTagRate || "-") + ")";
          pi.addEventListener("input", () => { const v = Number(pi.value.replace(/[^0-9.]/g, "")) || 0; if (Number.isInteger(v) && v >= 1 && v <= 100000 && v !== r.pdTagRate) B.pdrates[r.id] = v; else delete B.pdrates[r.id]; totals(); });
          ln.append(`Party ${r.pdCt} ct${r.pdPcs ? " (" + r.pdPcs + ")" : ""} @ `, pi); const pv = document.createElement("div"); pv.dataset.pd = r.id; pv.style.fontWeight = "600"; pv.textContent = "= " + fmt(r.pd); pt.append(ln, pv); }
        if (r.polkiPcs) {
          const ln = document.createElement("div"); ln.style.cssText = "white-space:nowrap;margin:2px 0";
          const pi = document.createElement("input"); pi.className = "brate"; pi.inputMode = "numeric"; pi.autocomplete = "off"; pi.style.cssText = "width:64px;text-align:right;padding:4px 6px"; pi.value = r.polkiRate || ""; pi.title = "Rate per pc (tag: " + (r.polkiTagRate || "-") + ")";
          pi.addEventListener("input", () => { const v = Number(pi.value.replace(/[^0-9.]/g, "")) || 0; if (Number.isInteger(v) && v >= 1 && v <= 100000 && v !== r.polkiTagRate) B.prates[r.id] = v; else delete B.prates[r.id]; totals(); });
          ln.append(`${r.polkiPcs} pc @ `, pi); const pv = document.createElement("div"); pv.dataset.pol = r.id; pv.style.fontWeight = "600"; pv.textContent = "= " + fmt(r.polki); pt.append(ln, pv); }
        tr.appendChild(pt); }
      td(r.other ? fmt(r.other) : "—", "num"); const am = document.createElement("td"); am.className = "num"; am.dataset.amt = r.id; am.textContent = ok ? fmt(r.amount) : "—"; tr.appendChild(am);
      const dc = document.createElement("td"), di = document.createElement("input"); di.className = "bdisc"; di.dataset.id = r.id; di.value = B.disc[r.id] || ""; di.placeholder = "0"; di.maxLength = 12; di.autocomplete = "off"; di.style.cssText = "width:84px;text-align:right";
      di.addEventListener("input", () => { B.disc[r.id] = di.value.trim(); totals(); }); dc.appendChild(di); tr.appendChild(dc);
      const nt = document.createElement("td"); nt.className = "num"; nt.dataset.net = r.id; nt.textContent = ok ? fmt(r.net) : "—"; tr.appendChild(nt);
      const x = document.createElement("td"), rm = document.createElement("button"); rm.type = "button"; rm.className = "btn ghost"; rm.textContent = "Remove";
      rm.addEventListener("click", () => { delete B.disc[r.id]; delete B.rates[r.id]; delete B.frates[r.id]; delete B.prates[r.id]; delete B.pdrates[r.id]; B.items.splice(i, 1); render(); }); x.appendChild(rm); tr.appendChild(x); body.appendChild(tr);
    });
    totals(c);
  }
  function totals(c) {
    c = c || calcNow(); const ok = F() >= 2000, has = c.rows.length && ok;
    { // owner 26/10 18:52 (C-20261026-NBBLAB): a lab-grown (CVD) diamond under Rs 20,000/ct is sold no buy back / no exchange - the stamp is ticked by default (can be unticked)
      const need = c.rows.some(r => (r.dias || []).some(d => /CVD|LAB|LGD|^C-/i.test(String(d.q || "")) && d.ct > 0 && d.rate > 0 && d.rate < 20000));
      if (need && !B.nbbAuto) { B.nbb = true; $("bnbb").checked = true; B.nbbAuto = true; } else if (!need) B.nbbAuto = false; }
    c.rows.forEach(r => { const n = document.querySelector('[data-net="' + r.id + '"]'); if (n) n.textContent = ok ? fmt(r.net) + (r.discTxt ? " (" + r.discTxt + ")" : "") : "—";
      const dv = document.querySelector('[data-dia="' + r.id + '"]'); if (dv) dv.textContent = "= " + fmt(r.diaAmt); const pv = document.querySelector('[data-pol="' + r.id + '"]'); if (pv) pv.textContent = "= " + fmt(r.polki); const pdv = document.querySelector('[data-pd="' + r.id + '"]'); if (pdv) pdv.textContent = "= " + fmt(r.pd); const am = document.querySelector('[data-amt="' + r.id + '"]'); if (am) am.textContent = ok ? fmt(r.amount) : "—"; });
    $("bdiscrow").hidden = !c.disc; $("bdisc").textContent = "- " + fmt(c.sum - c.sub);
    $("bsettle").hidden = !fineMode(); $("bsettle").style.display = fineMode() ? "" : "none"; /* .seg sets display:flex, which beats [hidden] */ $("bfinerow").hidden = !(c.settle === "fine" && c.rows.length); $("bfine").firstChild.textContent = g3(c.fine);
    $("bmodehint").textContent = { ws: "Gold x karat rate + 10% wastage; making Rs 650/g (750/g up to 5 g), minimum Rs 1,000 a piece.", nett: "Gold x karat rate; making Rs 650/g (750 up to 5 g), minimum Rs 1,000, + 10% wastage on the gold.",
      g2g: "Fine gold = weight x 14K 0.66 / 18K 0.836 / 9K 0.4235 / 22K 1.06; making Rs 650/g (750 up to 5 g), minimum Rs 1,000, in rupees.", item: "Fine gold = weight x 14K 0.74 / 18K 0.90 / 9K 0.54 / 22K 1.06; making included in the gold." }[B.mode];
    $("bsum").textContent = has ? fmt(c.disc ? c.sum : c.sub) : "—"; $("bsub").textContent = has ? fmt(c.sub) : "—";
    // owner 17/10 15:33: when every piece carries its own gold rate (typed on the tag), that rate is what this box shows;
    // today's rate (F) is asked for only when a piece has no rate on its tag (C-20261017-TAGRATE)
    const allOwn = c.rows.length > 0 && c.rows.every(r => r.orderRate || r.rateEdited), rts = [...new Set(c.rows.map(r => Math.round(r.F)))];
    $("bF").style.display = allOwn ? "none" : ""; $("bFtag").style.display = allOwn ? "" : "none";
    $("bFtag").value = allOwn ? (rts.length === 1 ? String(rts[0]) : "as on each piece") : "";
    $("bFl").textContent = allOwn ? "Gold Rate per g, 24K (from the tag)" : c.rows.some(r => r.orderRate || r.rateEdited) ? "Today's gold rate (F) per g, 24K - for pieces without a rate on the tag" : "Gold Rate (F) per g, 24K";
    $("bgstl").textContent = "GST " + c.gstPct + "%"; $("bgst").textContent = has ? fmt(c.gst) : "—"; $("btotal").textContent = has ? fmt(c.total) : "—";
    $("bnote").textContent = !ok ? "Type the gold rate (F): fine 24K per gram." : noteText(B.mode, c.rows) + "Diamond rates come from the tag; change them here for this bill if needed." + (c.rows.some(r => r.orderRate) ? " Pieces with a gold rate on their tag are billed at that rate; F is used only for pieces without one." : "") + " Each piece's gold rate can be changed in its Gold cell.";
  }
  async function dataUrl(src) { const r = await fetch(src, { credentials: "same-origin" }); if (!r.ok) throw new Error("img"); const b = await r.blob(); return await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); }); }
  // photo for the PDF: drawn onto a small canvas and saved as JPEG, so PNG / WebP photos work too
  async function thumb(id) { try { const u = await dataUrl("/_blob/" + id), im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const s = 360 / Math.max(im.width, im.height), c = document.createElement("canvas"); c.width = Math.round(im.width * Math.min(1, s)); c.height = Math.round(im.height * Math.min(1, s));
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); return { d: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height }; } catch (e) { return null; } }
  async function makePdf(b, photos) {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 14; let y = 14;
    y += 6; // owner 16/10/2026 19:31: no company name, logo or address on bills / estimates
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(b.title, M, y);
    if (b.cancelled) { doc.setTextColor(161, 43, 43); doc.text("CANCELLED", M + 40, y); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`${b.cancelled.reason}${b.cancelled.note ? ": " + b.cancelled.note : ""} (${b.cancelled.byName}, ${dmy(String(b.cancelled.at).slice(0, 10))})`, M + 40, y + 5); doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(18); }
    doc.setFontSize(12); doc.text(`No. ${b.no}`, W - M, y - 3, { align: "right" }); doc.setFont("helvetica", "normal"); doc.text(`Date ${dmy(b.date)}`, W - M, y + 3, { align: "right" });
    y += 10; doc.setFontSize(12);
    doc.text(`Name: ${b.name}`, M, y); y += 6.5; doc.text(`City: ${b.city || "-"}`, M, y); doc.text(`Mobile: ${!b.mobile ? "-" : /^\d{10}$/.test(b.mobile) ? "+91 " + b.mobile : b.mobile}`, M + 90, y); y += 6.5;
    const rts = [...new Set((b.rows || []).map(r => Math.round(r.F || b.F)))], hF = rts.length === 1 ? rts[0] : b.F; // owner 17/10: the rate shown is the one the pieces were billed at (tag rate)
    doc.text(`Gold Rate (F): ${fmt(hF)} per g (24K)`, M, y); doc.text(`Gold Calculation: ${MODES[b.mode] || b.mode}${b.settle === "fine" ? " (fine gold)" : b.settle === "amount" ? " (in rupees)" : ""}`, M + 90, y);
    if (rts.length > 1) { y += 5.5; doc.setFontSize(10); doc.text("Other gold rates are shown under each piece.", M, y); doc.setFontSize(12); } y += 9;
    const pics = {}; if (photos) for (const r of b.rows) if (r.photo) pics[r.id] = await thumb(r.photo);
    const P = Object.values(pics).some(Boolean) ? 22 : 0; // photo column (mm) only when a piece has a photo
    const D = (b.disc || 0) > 0; // owner 16/10: own Discount and Net columns when a piece has a discount (amounts then without 'Rs', said once above)
    const cols = D ? (P ? [["Piece", 42, "l"], ["Gold", 19, "l"], ["Gold value", 17, "r"], ["Making", 16, "r"], ["Diamonds", 20, "r"], ["Other", 13, "r"], ["Amount", 17, "r"], ["Discount", 19, "r"], ["Net", 19, "r"]]
        : [["Piece", 30, "l"], ["Gold", 21, "l"], ["Gold value", 19, "r"], ["Making", 18, "r"], ["Diamonds", 21, "r"], ["Other", 12, "r"], ["Amount", 19, "r"], ["Discount", 21, "r"], ["Net", 21, "r"]])
      : P ? [["Piece", 60, "l"], ["Gold", 23, "l"], ["Gold value", 21, "r"], ["Making", 20, "r"], ["Diamonds", 21, "r"], ["Other", 15, "r"], ["Amount", 22, "r"]] // 182 mm = page width less margins
      : [["Piece", 42, "l"], ["Gold", 25, "l"], ["Gold value", 23, "r"], ["Making", 22, "r"], ["Diamonds", 24, "r"], ["Other", 20, "r"], ["Amount", 26, "r"]];
    const PK = (b.rows || []).some(r => Number(r.polkiPcs) > 0 || Number(r.pdCt) > 0); // owner 17/10: a Polki column only when a piece has polki (C-20261017-POLKI)
    if (PK) { const sc = (182 - 18) / 182; cols.forEach(c => { c[1] = Math.round(c[1] * sc * 10) / 10; }); cols.splice(cols.findIndex(c => c[0] === "Diamonds") + 1, 0, [(b.rows || []).some(r => Number(r.pdCt) > 0) ? ((b.rows || []).some(r => Number(r.polkiPcs) > 0) ? "Polki/Party" : "Party dia.") : "Polki", 18, "r"]); }
    const fm = D ? (n => Math.round(n).toLocaleString("en-IN")) : fmt;
    if (D) { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(90); doc.text("Amounts in Rs", W - M, y - 1.5, { align: "right" }); doc.setTextColor(20); y += 4; }
    const row = (vals, bold, size, pic) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size || 10.5); let x = M, h = 0;
      const lines = vals.map((v, i) => doc.splitTextToSize(String(v), cols[i][1] - 2 - (i === 0 && pic !== undefined ? P : 0))); lines.forEach(l => h = Math.max(h, l.length));
      if (pic) { const s = 20 / Math.max(pic.w, pic.h); doc.addImage(pic.d, "JPEG", M + (20 - pic.w * s) / 2, y - 3.5 + (20 - pic.h * s) / 2, pic.w * s, pic.h * s); }
      lines.forEach((l, i) => { const [, w, al] = cols[i]; doc.text(l, al === "r" ? x + w - 1 : x + (i === 0 && pic !== undefined ? P : 0), y, al === "r" ? { align: "right" } : undefined); x += w; });
      y += Math.max(h * 5, pic !== undefined && P ? 21 : 0) + 2.5; };
    doc.setFillColor(243, 230, 211); doc.rect(M, y - 5, W - 2 * M, 8, "F"); row(cols.map(c => c[0]), true, PK && D ? 9 : undefined); y += 1;
    b.rows.forEach(r => { if (y > 250) { doc.addPage(); y = 20; }
      const dd = r.ct ? (r.dias || []).filter(d => d.ct > 0).map(d => ((d.shape ? d.shape + " " : "") + d.q).trim() + "\n" + d.ct.toFixed(2) + " ct @ " + Math.round(d.rate).toLocaleString("en-IN")).join("\n") + "\n= " + fm(r.diaAmt) : "-"; // owner 26/10: every diamond line with its shape, quality, ct and rate (C-20261026-DIASHAPE)
      const base = [(r.design ? r.design + " - " : "") + r.label + (r.cat ? "\n" + r.cat : "") + (r.certNo ? "\n" + (r.cert && r.cert !== "TGL" ? r.cert : "Cert.") + " " + r.certNo : ""), /* owner 26/10 18:14: certificate no. on the bill (C-20261026-PARTYDIA) */ (/tunch/.test(r.gold || "") ? r.gold.replace(/ \+ /g, "\n").replace(/, tunch /g, "\ntunch ") : (r.gold || "-")) + (Math.round(r.F) !== hF ? "\n@ " + Math.round(r.F).toLocaleString("en-IN") : ""), b.settle === "fine" ? g3(r.fine) + "\nfine" : fm(r.goldAmt) + (b.settle ? "\n" + g3(r.fine) + " fine" : ""), r.chain ? "-" : b.mode === "item" ? "in gold" : fm(r.making) /* owner 17/10 15:38: no making rate per g on the printed bill */, dd, ...(PK ? [[r.polkiPcs ? "Polki " + r.polkiPcs + " pc\n@ " + Math.round(r.polkiRate).toLocaleString("en-IN") + "\n" + fm(r.polki) : "", r.pdCt ? "Party " + r.pdCt + " ct\n@ " + Math.round(r.pdRate).toLocaleString("en-IN") + "\n" + fm(r.pd) : ""].filter(Boolean).join("\n") || "-"] : []), r.other ? fm(r.other) : "-"];
      row(D ? base.concat([fm(r.amount), r.disc ? fm(r.disc) + (r.discTxt ? "\n(" + r.discTxt + ")" : "") : "-", fm(r.net)]) : base.concat([fm(r.amount)]), false, D || PK ? 10 : 10.5, P ? (pics[r.id] || null) : undefined);
      doc.setDrawColor(225); doc.line(M, y - 3, W - M, y - 3); });
    y += 3; if (y > 240) { doc.addPage(); y = 20; }
    const tot = (l, v, big) => { doc.setFont("helvetica", big ? "bold" : "normal"); doc.setFontSize(big ? 15 : 12); doc.text(l, W - M - 50, y, { align: "right" }); doc.text(v, W - M, y, { align: "right" }); y += big ? 9 : 7; };
    if (b.nbb) { // owner 17/10: 'No Buy Back No Exchange' stamp, red double border, left of the totals (C-20261017-NBB)
      const sx = M, sy = y - 4, sw = 72, sh = 24; doc.setDrawColor(176, 32, 32); doc.setLineWidth(0.9); doc.roundedRect(sx, sy, sw, sh, 2, 2); doc.setLineWidth(0.3); doc.roundedRect(sx + 1.6, sy + 1.6, sw - 3.2, sh - 3.2, 1.5, 1.5);
      doc.setTextColor(176, 32, 32); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("NO BUY BACK", sx + sw / 2, sy + 10.2, { align: "center" }); doc.text("NO EXCHANGE", sx + sw / 2, sy + 18.4, { align: "center" });
      doc.setTextColor(20); doc.setLineWidth(0.2); doc.setDrawColor(0); }
    if (b.settle === "fine") { tot("Fine gold to receive", g3(b.fine), true); y += 2; }
    tot("Total", fmt(b.disc ? b.sum : b.sub)); if (b.disc) { tot("Less discount", "- " + fmt(b.sum - b.sub)); tot("Total after discount", fmt(b.sub)); } tot(`GST ${b.gstPct}%`, fmt(b.gst)); doc.setDrawColor(180, 150, 80); doc.line(W - M - 95, y - 4, W - M, y - 4); y += 2; tot(b.title + " total", fmt(b.total), true);
    y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(80);
    const notes = [noteText(b.mode, b.rows).trim(), "All diamonds are third-party certified (IGI / EGL / TGL) and all gold is BIS HUID hallmarked.", b.title === "Estimate" ? "This is an estimate. Final figure may vary with the gold price." : "", b.nbb ? "Sold on a no buy back, no exchange basis." : "",
      b.settled ? `Settled: settlement discount ${fmt(b.settled.discount)} given on ${dmy(String(b.settled.at).slice(0, 10))}` + (b.original ? ` (bill total ${fmt(b.original.total)} reduced to ${fmt(b.total)}, the amount received)` : "") + "." + (b.settled.fineWaived ? ` Fine gold waived ${g3(b.settled.fineWaived)}.` : "") : ""].filter(Boolean); // C-20261017-LEDGER
    doc.text(doc.splitTextToSize(notes.join(" "), W - 2 * M), M, y);
    return doc.output("blob");
  }
  async function save() {
    const m = $("bmsg"), out = $("bout"); out.hidden = true;
    const body = { no: $("bno").value.trim(), name: (n => n && !/ji$/i.test(n) ? n + " ji" : n)($("bname").value.trim().slice(0, 57)) /* owner 26/10 18:45: 'ji' added on the bill automatically (Prachi -> Prachi ji) */, city: $("bcity").value.trim(), mobile: $("bmob").value.trim().slice(0, 20),
      date: $("bdate").value, F: F(), mode: B.mode, settle: B.settle, title: B.title, nbb: !!B.nbb, ids: B.items.slice(), disc: Object.assign({}, B.disc), rates: JSON.parse(JSON.stringify(B.rates)), frates: Object.assign({}, B.frates), prates: Object.assign({}, B.prates), pdrates: Object.assign({}, B.pdrates), edit: B.editNo || "" };
    if (!body.name) { m.textContent = "Enter the customer's name."; return; }
    let dg = body.mobile.replace(/\D/g, ""); if (dg.length === 12 && dg.startsWith("91")) dg = dg.slice(2); // phone copy like "+91 98xxx xxxxx" is fine
    const mobNote = body.mobile && !/^[6-9]\d{9}$/.test(dg) ? ` Note: the mobile has ${dg.replace(/^91/, "").length} digits after +91 (a mobile usually has 10) - saved as typed.` : "";
    if (!(body.F >= 2000)) { m.textContent = "Type the gold rate (F) per gram, 24K."; return; }
    if (!body.ids.length) { m.textContent = "Add at least one piece."; return; }
    $("bsave").disabled = true; m.textContent = "Saving the bill…";
    try {
      const r = await fetch("/api/vj/bill", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status));
      const b = j.bill; m.textContent = "Making the PDF…";
      const blob = await makePdf(b, B.photos), fname = `${b.title} ${b.no.replace(/[^A-Z0-9\-]/g, "-")} ${b.name.replace(/[^A-Za-z0-9 .\-]/g, "").trim().slice(0, 40)}.pdf`;
      const file = new File([blob], fname, { type: "application/pdf" }), url = URL.createObjectURL(file);
      loadBook(); m.textContent = `${b.title} ${b.no} saved: ${fmt(b.total)}${b.fine ? " + " + g3(b.fine) + " fine gold" : ""}.` + mobNote;
      out.textContent = ""; out.hidden = false;
      const op = document.createElement("a"); op.className = "btn"; op.href = url; op.target = "_blank"; op.rel = "noopener"; op.textContent = "Open PDF (print)";
      const dl = document.createElement("a"); dl.className = "btn ghost"; dl.href = url; dl.download = fname; dl.textContent = "Download";
      out.append(op, dl); // owner 26/10 17:30: no automatic download - the bill stays saved here (PDF button below)
      { const wa = document.createElement("button"); wa.type = "button"; wa.className = "btn"; wa.textContent = "Send on my WhatsApp"; wa.addEventListener("click", () => myWA(b, blob, m)); out.prepend(wa); } // C-20261026-MYWA: from the owner's own WhatsApp, not Aashvi
    } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; }
    $("bsave").disabled = false;
  }
  window.vjBillPdf = (b, photos) => makePdf(b, photos); // C-20261017-LEDGER: the Ledger tab prints a settled bill with the same printer
  function boot() { if (document.querySelector("nav") && $("p-rates")) { build(); setInterval(() => { const s = $("p-bill"); if (s && !s.hidden && !(document.activeElement && (document.activeElement.classList.contains("bdisc") || document.activeElement.classList.contains("brate")))) render(); }, 20000); } else setTimeout(boot, 300); }
  boot();
})();
