/* VJ Tags - Quote tab (owner 14/10/2026, Brain F-069). Loaded by shim.js on vaishnavijewels.com/tags only.
   Staff pick pieces by design / tag number, ONE option (Natural VS GH, Natural VS IJ or Lab-grown at Rs 23,000/ct),
   enter the customer, and send a branded PDF from their own WhatsApp. The server numbers and saves the quote and
   tells Core (Aashvi WhatsApp). No rates, codes or costs are printed - only each piece's final price and the total.
   Owner 17/10/2026 (C-20261017-QUOTEMODES / POLKI): two choices at the top - "From our code" (pieces by tag / design number, as
   before, + polki pcs x rate per pc, rate editable per line) or "Estimate for a new design" (no tag: karat, net gold, diamond
   lines, polki, other charges per design line). The server works every price out again from the tags / weights and today's
   settings; the PDF is printed from the server's figures.
   Owner 27/10/2026 (C-20261027-QCENTS / QUSD): in an estimate a diamond line takes Pcs x Cents/pc and fills the carats itself
   (10 pcs x 50 cents = 5.00 ct, e.g. bangle goods); a USD rate box (market USD-INR + Rs 1.50, editable, remembered on this device)
   shows every price and the total in US$ too and prints them on the PDF. The server is unchanged: it still gets ct and rupees. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const OPTS = { gh: "Natural VS GH", ij: "Natural VS IJ", lgd: "Lab-grown" };
  const LGD_RATE = 23000;
  const NON_DIAMOND = /POL|EMR|MOZ|RUBY|PEARL|MOTI|STONE|KUNDAN/i;
  const PUR = { "24K": 1, "22K": 0.92, "18K": 0.76, "14K": 0.60, "9K": 0.385 }; // 9K = 38.5 tunch (owner 26/10 19:00)
  const fmt = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  const up = (n, s) => Math.ceil(Math.round(n * 100) / 100 / s) * s;
  const Q = { kind: "code", items: [], option: "gh", mk: "std", pay: "amount", prates: {}, designs: [] }; // mk: "std" = settings making + 10% wastage, "flat" = Rs 1,600/g (owner 14/10)
  const FLAT_MK = 1600, PRATE = 300;
  // new-design estimate (C-20261017-QUOTEMODES): same karats, qualities (with the shop codes) and shapes as the New tag form
  const DKARATS = ["14K", "18K", "22K", "9K", "24K"], DQUALS = ["CVD", "VS IJ", "VS HI", "VS GH", "VVS EF"], DSHAPES = ["Round", "Choki", "Fancy", "Solitaire", "Polki"];
  const QC = { "CVD": "42", "VS IJ": "2", "VS HI": "3", "VS GH": "4", "VVS EF": "5" };
  const DEF_RATES = { "CVD|Round": 23000, "CVD|Choki": 23000, "CVD|Fancy": 23000, "CVD|Solitaire": 23000, "VS GH|Round": 46000, "VS GH|Choki": 46000, "VS GH|Fancy": 85000, "VS HI|Round": 40000, "VS HI|Choki": 40000, "VS IJ|Round": 35000, "VS IJ|Choki": 35000 };
  const num = v => { const n = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
  // C-20261027-QUSD: USD rate = market USD-INR + Rs 1.50 (owner's quote rule), fetched once a day; a rate typed by staff wins for the day
  const USD_KEY = "vj_quote_usd", USD_ADD = 1.5, today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  Q.usd = 0;
  const usdLoad = () => { try { return JSON.parse(localStorage.getItem(USD_KEY) || "null") || null; } catch (e) { return null; } };
  const usdSave = (rate, manual) => { try { localStorage.setItem(USD_KEY, JSON.stringify({ rate, day: today(), manual: !!manual })); } catch (e) {} };
  const usdTxt = n => Q.usd > 0 && n > 0 ? "US$ " + Math.round(n / Q.usd).toLocaleString("en-US") : "";
  async function usdInit() {
    const u = usdLoad(); const box = $("qusd"), info = $("qusdinfo"); if (!box) return;
    if (u && u.rate > 0 && u.manual && u.day === today()) { Q.usd = u.rate; box.value = u.rate; info.textContent = "Rate typed today."; usdShow(); return; }
    if (u && u.rate > 0) { Q.usd = u.rate; box.value = u.rate; usdShow(); }
    try { const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR", { cache: "no-store" }); const j = await r.json();
      const m = Number(j && j.rates && j.rates.INR); if (!(m > 50 && m < 200)) throw new Error("rate");
      Q.usd = Math.round((m + USD_ADD) * 100) / 100; box.value = Q.usd; usdSave(Q.usd, false);
      info.textContent = `Market ${m.toFixed(2)} + Rs ${USD_ADD.toFixed(2)} (${j.date || today()}). Change it if needed.`; render();
    } catch (e) { info.textContent = Q.usd ? "Could not fetch today's market rate - last rate kept. Change it if needed." : "Could not fetch the market rate - type it."; }
  }
  function usdShow() { const t = $("qusdtot"); if (t) t.textContent = Q.usd > 0 && Q.total > 0 ? usdTxt(Q.total) + ` (at Rs ${Q.usd.toFixed(2)}/$)` : "—"; }

  function settings() { const s = (window.VJ_SETTINGS && window.VJ_SETTINGS()) || {}; return {
    g: s.gold24g || null, at: s.goldAt || null, pur: Object.assign({}, PUR, s.purity || {}),
    mk: Object.assign({ base: 650, small: 750, limit: 5, pct: 10, min: 1000 }, s.making || {}), gst: s.gst == null ? 3 : s.gst, rates: s.defaultRates || DEF_RATES }; }
  const defRate = (q, sh, st) => { const v = Number(st.rates[q + "|" + sh]); return v > 0 ? v : 0; };
  // price incl. GST (same rule as the server's vjQPrice): gold + making (std / flat) + diamonds + extra (polki + other), up to Rs 100, + GST, up to Rs 1,000
  // chain gold lines (C-20261017-CHAINTUNCH): net x tunch x 24K rate, no making, no wastage; making on the other lines only
  const lineT = g => { const n = Number(g && g.tunch); return n >= 0.3 && n <= 1.1 ? n : 0; };
  const G2G = { "9K": 0.4235, "14K": 0.66, "18K": 0.836, "22K": 1.06, "24K": 1 }; // C-20261026-QG2G
  function calc(gold, dv, extra, st, mk) {
    calc.fine = 0;
    if (!gold.some(g => g.net > 0) || !st.g) return 0;
    const g0 = gold.find(g => g.net > 0 && !lineT(g)); let gv = 0, cv = 0, nt = 0;
    gold.forEach(g => { if (g.net > 0) { const tn = lineT(g); if (tn) cv += g.net * st.g * tn; else { gv += g.net * st.g * (Number(st.pur[g.k]) || 0); nt += g.net; } } });
    if (Q.pay === "g2g" || Q.pay === "g2gn") { // owner 26/10 19:02 (C-20261026-QG2G): Gold to Gold - fine gold apart, rupees = making (+ 10% wastage on Nett) + diamonds + other + GST (same rule as the server)
      const nf = Q.pay === "g2gn"; let fine = 0; gold.forEach(g => { if (g.net > 0) { const tn = lineT(g); fine += g.net * (tn || (nf ? (Number(st.pur[g.k]) || 0) : (G2G[g.k] || 0))); } });
      calc.fine = Math.round(fine * 1000) / 1000;
      const mv2 = !g0 ? 0 : mk === "flat" ? FLAT_MK * nt : Math.max((g0.net > st.mk.limit ? st.mk.base : st.mk.small) * nt, Number(st.mk.min) || 0) + (nf ? gv * st.mk.pct / 100 : 0);
      return up(up(mv2 + dv + extra, 100) * (1 + st.gst / 100), 100); }
    const mv = !g0 ? 0 : mk === "flat" ? FLAT_MK * nt : Math.max((g0.net > st.mk.limit ? st.mk.base : st.mk.small) * nt, Number(st.mk.min) || 0) + gv * st.mk.pct / 100;
    return up(up(gv + cv + mv + dv + extra, 100) * (1 + st.gst / 100), 1000); // owner 16/10/2026: nearest Rs 1,000 (was 10,000)
  }
  const polkiOf = t => (t.polki && Number(t.polki.pcs) > 0 ? { pcs: Number(t.polki.pcs), rate: Number(Q.prates[t.id]) || Number(t.polki.rate) || PRATE } : null);
  function optRate(d, opt, st) {
    if (d.shape === "Polki" || NON_DIAMOND.test(String(d.q || "") + " " + String(d.code || ""))) return Number(d.rate) || 0;
    if (opt === "lgd") return LGD_RATE;
    const q = opt === "gh" ? "VS GH" : "VS IJ", sh = ["Round", "Choki", "Fancy"].includes(d.shape) ? d.shape : "Round";
    return Number(st.rates[q + "|" + sh]) || Number(st.rates[q + "|Round"]) || 0;
  }
  function priceFor(t, opt) {
    const st = settings(); if (!st.g) return null;
    const gold = (t.kind === "sample" ? [{ k: "14K", net: (t.metal && t.metal.net) || 0 }] : (t.gold || [])).map(g => ({ k: String(g.k || ""), net: Number(g.net) || 0, tunch: lineT(g) }));
    // C-20261017-MAKINGMIN (owner 17/10): std = 650/g (750 up to 5 g), minimum Rs 1,000 a piece, + 10% wastage on gold; flat = Rs 1,600/g
    let dv = 0, missing = false; (t.dias || []).filter(Boolean).forEach(d => { const r = optRate(d, opt, st); if (!(r > 0) && !NON_DIAMOND.test(d.q || "")) missing = true; dv += (Number(d.ct) || 0) * r; });
    const pk = polkiOf(t), final = calc(gold, dv, (pk ? pk.pcs * pk.rate : 0) + (Number(t.other && t.other.amt) || 0), st, Q.mk), fine = calc.fine;
    return final ? { final, missing, fine } : null;
  }
  // one new-design line: {desc, k, net, dias:[{q, shape, ct, rate, edited}], ppcs, prate, other}
  const newDesign = () => ({ desc: "", k: "14K", net: "", tunch: "", dias: [], ppcs: "", prate: String(PRATE), other: "" });
  function designIn(d, st) { // the numbers the server gets, and what is still missing
    const net = num(d.net), ppcs = num(d.ppcs), prate = String(d.prate).trim() === "" ? PRATE : num(d.prate), other = num(d.other), bad = [];
    const dias = d.dias.filter(x => num(x.ct) > 0).map(x => ({ q: x.q, pcs: Math.max(0, Math.round(num(x.pcs))), shape: x.shape, ct: num(x.ct), rate: String(x.rate).trim() === "" ? defRate(x.q, x.shape, st) : num(x.rate) }));
    const tv = String(d.tunch == null ? "" : d.tunch).trim(), tunch = tv === "" ? 0 : Math.round(num(tv) * 1000) / 1000; // a chain: its own tunch (C-20261017-CHAINTUNCH)
    if (tv !== "" && !(tunch >= 0.3 && tunch <= 1.1)) bad.push("chain tunch (0.300-1.100, e.g. 0.920, or empty)");
    if (!(net > 0)) bad.push("net gold weight"); if (dias.some(x => !(x.rate > 0))) bad.push("a diamond rate per ct");
    if (!(Number.isInteger(ppcs) && ppcs >= 0 && ppcs <= 10000) || ppcs > 0 && !(Number.isInteger(prate) && prate >= 1 && prate <= 100000)) bad.push("polki pcs (whole, up to 10,000) and rate per pc (Rs 1-1,00,000)");
    if (!(Number.isInteger(other) && other >= 0)) bad.push("other charges in whole rupees");
    return { desc: String(d.desc || "").trim().slice(0, 60), k: d.k, net, tunch, dias, ppcs, prate, other, bad };
  }
  function designPrice(d) { const st = settings(), x = designIn(d, st); if (x.bad.length || !st.g) return 0;
    return calc([{ k: x.k, net: x.net, tunch: x.tunch }], x.dias.reduce((a, y) => a + y.ct * y.rate, 0), (x.ppcs ? x.ppcs * x.prate : 0) + x.other, st, "std"); }
  const tags = () => (window.VJ_TAGS ? window.VJ_TAGS() : []);
  function find(q) {
    q = String(q || "").trim().toUpperCase().replace(/\s+/g, ""); if (!q) return [];
    const all = tags(), n = x => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), nq = n(q);   // 14/10: DZGR139 = DZ-GR-139
    const exact = all.filter(t => String(t.no) === q && /^\d+$/.test(q) || nq && (n(t.designNo) === nq || n(t.label) === nq));
    return exact.slice(0, 12);
  }

  function build() {
    const nav = document.querySelector("nav"); if (!nav || $("t-quote")) return;
    const b = document.createElement("button"); b.setAttribute("role", "tab"); b.id = "t-quote"; b.dataset.tab = "quote"; b.textContent = "Quote"; b.setAttribute("aria-selected", "false");
    nav.insertBefore(b, nav.querySelector('[data-tab="rates"]'));
    const sec = document.createElement("section"); sec.id = "p-quote"; sec.className = "card"; sec.hidden = true;
    sec.innerHTML = `
      <div class="seg" role="radiogroup" aria-label="Quote type" style="margin-bottom:6px">
        <label><input type="radio" name="qkind" value="code" checked> From our code</label>
        <label><input type="radio" name="qkind" value="design"> Estimate for a new design</label></div>
      <div id="qdesbox" hidden>
      <h2>1 · Designs</h2>
      <p class="hint">No tag needed: type each design's karat, net gold, diamonds and polki. Diamonds: type Pcs and Cents per piece and the carats fill in (10 pcs × 50 cents = 5.00 ct). Priced at today's gold rate with the same making rule. For a chain, type its tunch: gold = net × tunch × rate, no making.</p>
      <div id="qdlines" style="display:flex;flex-direction:column;gap:12px"></div>
      <div class="actions"><button type="button" class="btn ghost" id="qdadd">+ Add design</button></div>
      </div>
      <div id="qcodebox">
      <h2>1 · Pieces</h2>
      <div class="row" style="align-items:end"><label style="flex:2 1 220px">Design number or tag number <input id="qq" autocomplete="off" placeholder="e.g. 1436 or VLR14/803"></label>
      <div><button type="button" class="btn" id="qadd">Add piece</button></div></div>
      <div id="qpick" class="row" style="gap:8px"></div>
      <div class="list"><table class="items" style="min-width:560px"><thead><tr><th></th><th>Design · label</th><th>Category</th><th>Gold</th><th>Diamonds</th><th>Polki</th><th>Price</th><th></th></tr></thead><tbody id="qrows"></tbody></table></div>
      <h2>2 · Option (one per quote)</h2>
      <div class="seg" role="radiogroup" aria-label="Option">
        <label><input type="radio" name="qopt" value="gh" checked> Natural VS GH</label>
        <label><input type="radio" name="qopt" value="ij"> Natural VS IJ</label>
        <label><input type="radio" name="qopt" value="lgd"> Lab-grown</label></div>
      <div class="seg" role="radiogroup" aria-label="Making" style="margin-top:8px">
        <label><input type="radio" name="qmk" value="std" checked> <span id="qmkstd">Making Rs 650/g + 10% wastage on gold</span></label>
        <label><input type="radio" name="qmk" value="flat"> Making Rs 1,600/g</label></div>
      <div class="seg" role="radiogroup" aria-label="Payment" style="margin-top:8px">
        <label><input type="radio" name="qpay" value="amount" checked> In rupees</label>
        <label><input type="radio" name="qpay" value="g2g"> Gold to Gold W/s</label>
        <label><input type="radio" name="qpay" value="g2gn"> Gold to Gold Nett</label></div>
      </div>
      <h2 id="qcusth">3 · Customer</h2>
      <div class="actions" id="qcbox" hidden><button type="button" class="btn ghost" id="qcontact">Pick from phone contacts</button></div>
      <div class="row"><label>Name <input id="qname" autocomplete="off" maxlength="60"></label>
        <label>Mobile (10 digits) <input id="qmob" inputmode="tel" autocomplete="off" maxlength="20" placeholder="98xxxxxxxx"></label>
        <label>City <input id="qcity" autocomplete="off" maxlength="40"></label></div>
      <label id="qphotol" style="flex-direction:row;align-items:center;gap:8px;color:var(--fg)"><input type="checkbox" id="qphoto" checked style="width:auto"> Show piece photos in the PDF</label>
      <label style="flex-direction:row;align-items:center;gap:8px;color:var(--fg)"><input type="checkbox" id="qwt" checked style="width:auto"> Show gold weight &amp; diamond carats in the PDF</label>
      <table class="sum"><tr class="total"><td>Total (incl. GST)</td><td id="qtotal">—</td></tr><tr><td>In US dollars (approx.)</td><td id="qusdtot">—</td></tr></table>
      <div class="row" style="align-items:end"><label style="max-width:220px">USD rate (Rs per US$) <input id="qusd" inputmode="decimal" autocomplete="off" placeholder="e.g. 89.50"></label><span class="hint" id="qusdinfo" style="flex:1 1 200px"></span></div>
      <p class="hint" id="qnote"></p>
      <div class="actions"><button type="button" class="btn" id="qsend">Make PDF &amp; send on WhatsApp</button><button type="button" class="btn" id="qaashvi" style="background:#1f8f4e;border-color:#1f8f4e;color:#fff">Send via Aashvi</button><button type="button" class="btn ghost" id="qclear">Clear</button></div>
      <p class="hint" id="qmsg"></p>`;
    $("p-rates").parentNode.insertBefore(sec, $("p-rates"));
    document.querySelectorAll("nav button").forEach(x => x.addEventListener("click", () => {
      const on = x.dataset.tab === "quote"; sec.hidden = !on; if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); render(); }
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y === x ? "true" : "false"));
    }));
    $("qadd").addEventListener("click", pick); $("qq").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); pick(); } });
    document.querySelectorAll('input[name=qopt]').forEach(r => r.addEventListener("change", () => { Q.option = r.value; render(); }));
    document.querySelectorAll('input[name=qmk]').forEach(r => r.addEventListener("change", () => { Q.mk = r.value; render(); }));
    document.querySelectorAll('input[name=qpay]').forEach(r => r.addEventListener("change", () => { Q.pay = r.value; render(); })); // C-20261026-QG2G
    document.querySelectorAll('input[name=qkind]').forEach(r => r.addEventListener("change", () => { Q.kind = r.value; kindView(); }));
    $("qdadd").addEventListener("click", () => { Q.designs.push(newDesign()); drawDesigns(); });
    $("qclear").addEventListener("click", () => { Q.items = []; Q.prates = {}; Q.designs = [newDesign()]; Q.mk = "std"; document.querySelector('input[name=qmk][value=std]').checked = true; Q.pay = "amount"; document.querySelector('input[name=qpay][value=amount]').checked = true; ["qname", "qmob", "qcity", "qq"].forEach(i => $(i).value = ""); $("qmsg").textContent = ""; if ($("qsharebox")) $("qsharebox").hidden = true; drawDesigns(); render(); });
    Q.designs = [newDesign()]; drawDesigns(); kindView();
    $("qusd").addEventListener("input", () => { const v = Math.round(num($("qusd").value) * 100) / 100; Q.usd = v > 50 && v < 200 ? v : 0; if (Q.usd) { usdSave(Q.usd, true); $("qusdinfo").textContent = "Rate typed today."; } render(); });
    usdInit();
    $("qsend").addEventListener("click", send);
    // C-20261017-QUOTEWA (owner 17/10): Aashvi sends the quote PDF from the business WhatsApp; second tap confirms the number
    $("qaashvi").addEventListener("click", () => { const b = $("qaashvi"), mob = $("qmob").value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
      if (b.dataset.sure !== "1" && /^[6-9]\d{9}$/.test(mob)) { b.dataset.sure = "1"; b.textContent = "Tap again to send to +91 " + mob; setTimeout(() => { if (b.dataset.sure === "1") { b.dataset.sure = ""; b.textContent = "Send via Aashvi"; } }, 8000); return; }
      b.dataset.sure = ""; b.textContent = "Send via Aashvi"; send("aashvi"); });
    // 14/10/2026 owner: pick the customer from the phone's contact book (Chrome on Android only; iPhone/computers type it).
    // The browser shows its own picker; only the ONE contact tapped is read, on the phone, nothing is uploaded.
    if (navigator.contacts && navigator.contacts.select) { $("qcbox").hidden = false; $("qcontact").addEventListener("click", async () => {
      try { const [c] = await navigator.contacts.select(["name", "tel"], { multiple: false }); if (!c) return;
        if (c.name && c.name[0]) $("qname").value = String(c.name[0]).slice(0, 60);
        const nums = (c.tel || []).map(t => String(t).replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "")).filter(t => /^[6-9]\d{9}$/.test(t));
        $("qmob").value = nums[0] || ""; $("qmsg").textContent = nums.length ? (nums.length > 1 ? "This contact has more than one mobile - check the number." : "") : "That contact has no Indian mobile number - type it.";
        if (!$("qcity").value) $("qcity").focus();
      } catch (e) { $("qmsg").textContent = "Could not open contacts - type the details."; } }); }
  }
  function pick() {
    const box = $("qpick"); box.textContent = ""; const r = find($("qq").value);
    if (!r.length) { box.textContent = "No piece with that design or tag number."; return; }
    if (r.length === 1) { addItem(r[0]); return; }
    r.forEach(t => { const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = (t.designNo ? t.designNo + " · " : "") + t.label; b.addEventListener("click", () => { addItem(t); box.textContent = ""; }); box.appendChild(b); });
  }
  function addItem(t) { if (!Q.items.some(x => x.id === t.id)) Q.items.push(t); $("qq").value = ""; $("qpick").textContent = ""; render(); }
  function kindView() {
    const d = Q.kind === "design"; $("qdesbox").hidden = !d; $("qcodebox").hidden = d; $("qphotol").style.display = d ? "none" : "";
    $("qcusth").textContent = (d ? "2" : "3") + " · Customer"; $("qmsg").textContent = ""; if ($("qsharebox")) $("qsharebox").hidden = true; render();
  }
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const fld = (label, input, flex) => { const l = el("label", {}, [label, input]); if (flex) l.style.flex = flex; return l; };
  const sel = (opts, val, txt) => { const s = el("select"); opts.forEach(o => s.append(el("option", { value: o, textContent: txt ? txt(o) : o, selected: o === val }))); return s; };
  // the quality box takes the shop codes typed on the keyboard, like the New tag form: 42 CVD, 2 VS IJ, 3 VS HI, 4 VS GH, 5 VVS EF (C-20261017-QCODES)
  function codeKeys(q) { const BY = {}; Object.keys(QC).forEach(k => { BY[QC[k]] = k; }); let buf = "", tm = 0;
    q.addEventListener("keydown", e => { if (!/^[0-9]$/.test(e.key)) return; e.preventDefault(); const t = Date.now(); buf = (t - tm < 900 ? buf : "") + e.key; tm = t;
      const v = BY[buf] || (buf.length > 1 ? BY[e.key] : null); if (v && q.value !== v) { q.value = v; q.dispatchEvent(new Event("change", { bubbles: true })); } if (!BY[buf] && BY[e.key]) buf = e.key; }); }
  function drawDesigns() {
    const box = $("qdlines"); if (!box) return; box.textContent = ""; const st = settings();
    Q.designs.forEach((d, i) => {
      const card = el("div"); card.style.cssText = "border:1px solid var(--line);border-radius:var(--r,10px);padding:12px;display:flex;flex-direction:column;gap:8px";
      const desc = el("input", { value: d.desc, maxLength: 60, autocomplete: "off", placeholder: "e.g. Bracelet, new design" }), k = sel(DKARATS, d.k);
      const net = el("input", { value: d.net, inputMode: "decimal", autocomplete: "off", placeholder: "0.000" }), price = el("div", { className: "labelno" }); price.dataset.qd = i;
      const tu = el("input", { value: d.tunch || "", inputMode: "decimal", autocomplete: "off", placeholder: "chain only, e.g. 0.920" }); tu.addEventListener("input", () => { d.tunch = tu.value; prices(); });
      desc.addEventListener("input", () => { d.desc = desc.value; }); k.addEventListener("change", () => { d.k = k.value; prices(); }); net.addEventListener("input", () => { d.net = net.value; prices(); });
      const rm = el("button", { type: "button", className: "btn ghost", textContent: "Remove design" }); rm.addEventListener("click", () => { Q.designs.splice(i, 1); if (!Q.designs.length) Q.designs.push(newDesign()); drawDesigns(); });
      card.append(el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:8px" }, [el("strong", { textContent: "Design " + (i + 1) }), price]),
        el("div", { className: "row" }, [fld("Description", desc, "2 1 220px"), fld("Karat", k), fld("Net gold (g)", net), fld("Chain tunch", tu)]));
      const dbox = el("div", { style: "display:flex;flex-direction:column;gap:6px" });
      d.dias.forEach((x, j) => {
        const q = sel(DQUALS, x.q, o => QC[o] + " · " + o), sh = sel(DSHAPES, x.shape), pc = el("input", { value: x.pcs || "", inputMode: "numeric", autocomplete: "off", placeholder: "0" }), ce = el("input", { value: x.cents || "", inputMode: "decimal", autocomplete: "off", placeholder: "e.g. 50" }), ct = el("input", { value: x.ct, inputMode: "decimal", autocomplete: "off", placeholder: "0.00" });
        // C-20261027-QCENTS: Pcs x Cents/pc fills the carats (10 x 50 = 5.00 ct); carats typed by hand still work when cents is empty
        const auto = () => { const p = num(x.pcs), c = num(x.cents); if (p > 0 && c > 0) { x.ct = (Math.round(p * c) / 100).toFixed(2); ct.value = x.ct; } prices(); };
        ce.addEventListener("input", () => { x.cents = ce.value; auto(); });
        const rt = el("input", { value: x.rate, inputMode: "numeric", autocomplete: "off" }), xx = el("button", { type: "button", className: "btn ghost", textContent: "✕", ariaLabel: "Remove diamond line" });
        codeKeys(q);
        const fill = () => { const def = defRate(x.q, x.shape, st); rt.placeholder = def ? "default " + def.toLocaleString("en-IN") : "enter rate"; if (!x.edited) { x.rate = def ? String(def) : ""; rt.value = x.rate; } };
        q.addEventListener("change", () => { x.q = q.value; fill(); prices(); }); sh.addEventListener("change", () => { x.shape = sh.value; fill(); prices(); });
        ct.addEventListener("input", () => { x.ct = ct.value; x.cents = ""; ce.value = ""; prices(); }); pc.addEventListener("input", () => { x.pcs = pc.value; auto(); }); rt.addEventListener("input", () => { x.rate = rt.value; x.edited = rt.value.trim() !== ""; prices(); });
        xx.addEventListener("click", () => { d.dias.splice(j, 1); drawDesigns(); }); fill();
        dbox.append(el("div", { className: "row", style: "align-items:end" }, [fld("Shape", sh), fld("Quality", q), fld("Pcs", pc), fld("Cents/pc", ce), fld("D Wt (ct)", ct), fld("Rate ₹/ct", rt), el("div", {}, [xx])] /* same order and labels as the New tag form (owner 17/10): Shape, Quality, Pcs, D Wt, Rate */));
      });
      const addD = el("button", { type: "button", className: "btn ghost", textContent: "+ Diamond line" }); addD.addEventListener("click", () => { d.dias.push({ q: "CVD", pcs: "", cents: "", shape: "Round", ct: "", rate: "", edited: false }); drawDesigns(); });
      const pp = el("input", { value: d.ppcs, inputMode: "numeric", autocomplete: "off", placeholder: "0" }), pr = el("input", { value: d.prate, inputMode: "numeric", autocomplete: "off" }), ot = el("input", { value: d.other, inputMode: "numeric", autocomplete: "off", placeholder: "0" });
      const pv = el("span", { className: "hint" }); pv.dataset.qp = i;
      pp.addEventListener("input", () => { d.ppcs = pp.value; prices(); }); pr.addEventListener("input", () => { d.prate = pr.value; prices(); }); ot.addEventListener("input", () => { d.other = ot.value; prices(); });
      card.append(el("strong", { textContent: "Diamonds" }), dbox, el("div", {}, [addD]),
        el("div", { className: "row", style: "align-items:end" }, [fld("Polki pcs", pp), fld("Rate per pc (Rs)", pr), fld("Other charges (Rs)", ot)]), pv, el("div", { className: "actions", style: "margin:0" }, [rm]));
      box.append(card);
    });
    prices();
  }
  function prices() { // live prices of the design lines and the estimate total (no redraw, so typing is not interrupted)
    if (Q.kind !== "design") return; const st = settings(); let total = 0, miss = [];
    let ftot = 0; Q.designs.forEach((d, i) => { const p = designPrice(d), f = p ? calc.fine : 0, x = designIn(d, st); total += p; ftot += f;
      const c = document.querySelector('[data-qd="' + i + '"]'); if (c) c.textContent = p ? fmt(p) + fineTxt(f) + (usdTxt(p) ? " ≈ " + usdTxt(p) : "") : "—";
      const pv = document.querySelector('[data-qp="' + i + '"]'); if (pv) pv.textContent = x.ppcs > 0 && Number.isInteger(x.prate) ? `Polki ${x.ppcs} pc × ${fmt(x.prate)} = ${fmt(x.ppcs * x.prate)}` : "";
      if (x.bad.length && (num(d.net) > 0 || d.dias.length || num(d.ppcs) > 0)) miss.push("Design " + (i + 1) + ": check " + x.bad.join(", ")); });
    $("qtotal").textContent = total && st.g ? fmt(total) + fineTxt(ftot) : "—"; Q.total = total; usdShow();
    $("qnote").textContent = !st.g ? "Today's gold rate is not set (Gold rate & settings) - prices cannot be worked out." :
      (miss.length ? miss.join(". ") + ". " : "") + `At 24K ${fmt(st.g)}/g. ${mkText(st, null, "std", true)}. Estimate only: final price depends on actual weights and the gold rate on the day of billing.`;
  }
  function render() {
    if (Q.kind === "design") { prices(); return; }
    const body = $("qrows"); if (!body) return; body.textContent = ""; let total = 0, miss = false, ftot = 0;
    Q.items.forEach((t, i) => {
      const p = priceFor(t, Q.option); if (p) { total += p.final; ftot += p.fine || 0; if (p.missing) miss = true; }
      const tr = document.createElement("tr"); const c = (x, cl) => { const td = document.createElement("td"); if (cl) td.className = cl; td.textContent = x; tr.appendChild(td); return td; };
      const ph = document.createElement("td"); if (t.photo) { const im = document.createElement("img"); im.alt = ""; im.src = "/_blob/" + t.photo; ph.appendChild(im); } tr.appendChild(ph);
      c((t.designNo ? t.designNo + " · " : "") + t.label); c(t.catName || "");
      c(t.kind === "sample" ? "14K " + ((t.metal && t.metal.net) || 0).toFixed(3) : (t.gold || []).map(g => g.k + " " + g.net.toFixed(3)).join(" + "), "num");
      c((t.dias || []).reduce((a, d) => a + (d.ct || 0), 0).toFixed(2) + " ct", "num");
      { const pk = polkiOf(t), td = document.createElement("td"); td.className = "num"; if (!pk) td.textContent = "—"; else { // polki: rate per pc editable for this quote (C-20261017-POLKI)
        const ri = document.createElement("input"); ri.className = "qprate"; ri.inputMode = "numeric"; ri.autocomplete = "off"; ri.style.cssText = "width:64px;text-align:right;padding:4px 6px"; ri.value = pk.rate;
        ri.addEventListener("change", () => { const v = num(ri.value); if (Number.isInteger(v) && v >= 1 && v <= 100000 && v !== Number(t.polki.rate)) Q.prates[t.id] = v; else delete Q.prates[t.id]; render(); });
        td.append(pk.pcs + " pc @ ", ri); } tr.appendChild(td); }
      c(p ? fmt(p.final) + fineTxt(p.fine) + (usdTxt(p.final) ? " ≈ " + usdTxt(p.final) : "") : "—", "num");
      const x = document.createElement("td"); const rm = document.createElement("button"); rm.type = "button"; rm.className = "btn ghost"; rm.textContent = "Remove"; rm.addEventListener("click", () => { Q.items.splice(i, 1); render(); }); x.appendChild(rm); tr.appendChild(x);
      body.appendChild(tr);
    });
    const st = settings(); $("qmkstd").textContent = mkText(st, null, "std");
    $("qtotal").textContent = Q.items.length && st.g ? fmt(total) + fineTxt(ftot) : "—";
    $("qnote").textContent = !st.g ? "Today's gold rate is not set (Gold rate & settings) - prices cannot be worked out." :
      (miss ? "Some diamond lines have no rate in the default table for this option - fill the table under Gold rate & settings. " : "") +
      `At 24K ${fmt(st.g)}/g${st.at ? ", " + new Date(st.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}. ${OPTS[Q.option]}${Q.option === "lgd" ? " at Rs 23,000 per ct" : ""}. Approximate, valid today.`;
    Q.total = total; usdShow();
  }
  const fineTxt = f => f ? " + " + Number(f).toFixed(3) + " g fine gold" : ""; // C-20261026-QG2G
  const payText = () => Q.pay === "g2g" ? "Gold to Gold (W/s): fine gold = weight x 14K 0.66 / 18K 0.836 / 22K 1.06 / 9K 0.4235; amount = making, diamonds and other charges + GST." : Q.pay === "g2gn" ? "Gold to Gold (Nett): fine gold = net weight x karat purity; amount = making + 10% wastage, diamonds and other charges + GST." : "";
  // the making line shown on screen and printed in the PDF (std uses the rates in Gold rate & settings)
  function mkText(st, items, kind, des) {
    if ((kind || Q.mk) === "flat") return "Making Rs " + FLAT_MK.toLocaleString("en-IN") + "/g";
    const small = des ? (items || Q.designs).some(d => num(d.net) > 0 && !(num(d.net) > st.mk.limit))
      : (items || Q.items).some(t => { const g = t.kind === "sample" ? [{ net: (t.metal && t.metal.net) || 0 }] : (t.gold || []); const g0 = g.find(x => x.net > 0); return g0 && !(g0.net > st.mk.limit); });
    return `Making Rs ${st.mk.base}/g${small ? ` (Rs ${st.mk.small}/g for pieces up to ${st.mk.limit} g)` : ""}, minimum Rs ${Number(st.mk.min || 1000).toLocaleString("en-IN")} a piece, + ${st.mk.pct}% wastage on gold`;
  }
  async function dataUrl(src) { const r = await fetch(src, { credentials: "same-origin" }); if (!r.ok) throw new Error("img"); const b = await r.blob(); return await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); }); }
  async function makePdf(q) {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 16; let y = 16;
    try { const lg = await dataUrl("/logo_vaishnavi_jewels.png"); doc.addImage(lg, "PNG", M, y, 42, 16); } catch (e) { doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("Vaishnavi Jewels", M, y + 10); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(["120, Rajhans Ornate - High Street Retail Mall", "Parle Point, Surat, Gujarat 395007", "vaishnavijewels.com"], W - M, y + 3, { align: "right" });
    y += 26; doc.setDrawColor(180, 150, 80); doc.line(M, y, W - M, y); y += 9;
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(q.design ? "Estimate – new design" : "Quotation", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`${q.qno}   ·   ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, W - M, y, { align: "right" });
    y += 8; doc.text(`For: ${q.name}, ${q.city}`, M, y); y += 6; if (!q.design) { doc.text(`Option: ${q.option} diamonds, gold as per piece`, M, y); y += 6; } doc.text(q.making, M, y); y += 8;
    if (q.design) for (const d of q.items) { // C-20261017-QUOTEMODES: a new design has no tag and no photo
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(doc.splitTextToSize(d.desc || "New design", W - 2 * M - 45)[0], M, y + 6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(80);
      const dq = [...new Set(d.dias.map(x => x.q))];
      const parts = [q.weights ? `${d.k} gold ${d.net.toFixed(3)} g` : `${d.k} gold`].concat(d.dias.length ? [q.weights ? "diamonds " + dq.map(z => d.dias.filter(x => x.q === z).reduce((a, x) => a + x.ct, 0).toFixed(2) + " ct " + z).join(" + ") : "diamonds " + dq.join(" + ")] : [])
        .concat(d.ppcs ? [q.weights ? "polki " + d.ppcs + " pcs" : "polki"] : []);
      doc.text(doc.splitTextToSize(parts.join(", "), W - 2 * M - 45), M, y + 12); doc.setTextColor(20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(fmt(d.price), W - M, y + 8, { align: "right" }); if (d.fine) { doc.setFontSize(10); doc.text("+ " + d.fine.toFixed(3) + " g fine gold", W - M, y + 13, { align: "right" }); }
      if (q.usd) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80); doc.text("approx. " + usdTxt(d.price), W - M, y + (d.fine ? 17 : 13), { align: "right" }); doc.setTextColor(20); }
      y += 18; doc.setDrawColor(225); doc.line(M, y - 2, W - M, y - 2);
    }
    else for (const t of q.items) {
      if (y > 250) { doc.addPage(); y = 20; }
      const h = q.photos && t.photo ? 34 : 14;
      if (q.photos && t.photo) { try { doc.addImage(await dataUrl("/_blob/" + t.photo), "JPEG", M, y, 32, 32); } catch (e) {} }
      const x = q.photos && t.photo ? M + 38 : M;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(`${t.catName || "Piece"} - design ${t.designNo || t.label}`, x, y + 6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(80);
      // owner 14/10: weights printed unless the "Show gold weight & diamond carats" box is unticked
      const ct = (t.dias || []).filter(d => !NON_DIAMOND.test(d.q || "")).reduce((a, d) => a + (d.ct || 0), 0);
      const goldTxt = t.kind === "sample" ? (q.weights ? "14K gold " + ((t.metal && t.metal.net) || 0).toFixed(3) + " g" : "14K gold") // owner 14/10: no "made to order" line
        : [...new Set((t.gold || []).map(g => g.k))].length && !q.weights ? [...new Set((t.gold || []).map(g => g.k))].join(" + ") + " gold" : (t.gold || []).map(g => g.k + " gold " + g.net.toFixed(3) + " g").join(" + ");
      const pk = t.polkiQ; // polki as the server priced it (C-20261017-POLKI)
      doc.text(`${goldTxt}${ct ? (q.weights ? ", diamonds " + ct.toFixed(2) + " ct" : ", diamonds") : ""}${pk ? (q.weights ? ", polki " + pk.pcs + " pcs" : ", polki") : ""}`, x, y + 12); doc.setTextColor(20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(fmt(t.price), W - M, y + 8, { align: "right" }); if (t.fine) { doc.setFontSize(10); doc.text("+ " + t.fine.toFixed(3) + " g fine gold", W - M, y + 13, { align: "right" }); }
      if (q.usd) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80); doc.text("approx. " + usdTxt(t.price), W - M, y + (t.fine ? 17 : 13), { align: "right" }); doc.setTextColor(20); }
      y += h + 4; doc.setDrawColor(225); doc.line(M, y - 2, W - M, y - 2);
    }
    y += 4; doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("Total (incl. 3% GST)", M, y); doc.text(fmt(q.total), W - M, y, { align: "right" }); if (q.fineTotal) { y += 7; doc.text("Fine gold to give", M, y); doc.text(q.fineTotal.toFixed(3) + " g", W - M, y, { align: "right" }); }
    if (q.usd) { y += 7; doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text(`In US dollars (approx., at Rs ${q.usd.toFixed(2)} per US$)`, M, y); doc.text(usdTxt(q.total), W - M, y, { align: "right" }); }
    y += 10; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(doc.splitTextToSize((q.payNote ? q.payNote + " " : "") + (q.design ? "Final price depends on actual weights and the gold rate on the day of billing. Estimate at today's gold rate. " : "Approximate prices at today's gold rate, valid today. ") + (q.usd ? "US dollar figures are indicative only; billing is in Indian rupees. " : "") + "All diamonds are third-party certified (IGI / EGL / TGL) and all gold is BIS HUID hallmarked. Made in our own manufacturing unit in Surat. Our representative will confirm the exact price.", W - 2 * M), M, y);
    return doc.output("blob");
  }
  async function aashvi(no, blob, name, m, label) {
    const pdf = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(",")[1] || ""); f.onerror = rej; f.readAsDataURL(blob); });
    const r = await fetch("/api/vj/bill/send", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ no, pdf }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status));
    m.textContent = `${label} ${no} saved and handed to Aashvi for ${j.to}…`;
    for (let i = 0; i < 30; i++) { await new Promise(z => setTimeout(z, 3000));
      const s = await (await fetch("/api/vj/bill/sendstatus?t=" + j.token, { credentials: "same-origin" })).json().catch(() => ({}));
      if (s.status === "sent") { m.textContent = `${label} ${no} sent on WhatsApp to ${name} (${j.to}) by Aashvi ✓. Core has been told to call.`; return; }
      if (s.status === "failed" || s.status === "expired") throw new Error("Aashvi could not send it (" + (s.error || s.status) + "). The quote " + no + " is saved"); }
    m.textContent = `${label} ${no}: Aashvi has not confirmed yet. Check WhatsApp before sending again.`;
  }
  async function send(via) {
    const m = $("qmsg"), st = settings();
    const name = $("qname").value.trim(), city = $("qcity").value.trim(), mob = $("qmob").value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    const design = Q.kind === "design", dIn = design ? Q.designs.map(d => designIn(d, st)).filter(x => x.net > 0 || x.dias.length || x.ppcs > 0) : [];
    if (design ? !dIn.length : !Q.items.length) { m.textContent = design ? "Fill in at least one design (karat and net gold)." : "Add at least one piece."; return; }
    if (!st.g) { m.textContent = "Set today's gold rate first (Gold rate & settings)."; return; }
    if (!name || !city || !/^[6-9]\d{9}$/.test(mob)) { m.textContent = !name || !city ? "Enter the customer's name, 10-digit mobile and city." : "The mobile number has " + mob.length + " digits (after +91) - it needs 10. Please check it."; return; }
    const bad = dIn.findIndex(x => x.bad.length); if (bad >= 0) { m.textContent = "Design " + (bad + 1) + ": check " + dIn[bad].bad.join(", ") + "."; return; }
    const items = design ? [] : Q.items.map(t => Object.assign({}, t, { price: (priceFor(t, Q.option) || {}).final || 0 }));
    if (items.some(i => !i.price)) { m.textContent = "A piece has no price - check the gold rate and the default diamond rates."; return; }
    if ($("qsharebox")) $("qsharebox").hidden = true;
    $("qsend").disabled = true; $("qaashvi").disabled = true; m.textContent = "Saving the quote…";
    try {
      // the server prices every line again (from the tags or the weights typed) and returns the figures the PDF prints
      const r = await fetch("/api/vj/quote", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify(design ? { kind: "design", pay: Q.pay, name, mobile: mob, city, items: dIn.map(x => ({ desc: x.desc, k: x.k, net: x.net, ...(x.tunch ? { tunch: x.tunch } : {}), dias: x.dias, ppcs: x.ppcs, prate: x.prate, other: x.other })) }
          : { kind: "tags", pay: Q.pay, name, mobile: mob, city, option: OPTS[Q.option], mk: Q.mk, items: items.map(i => ({ id: i.id, ...(Q.prates[i.id] ? { prate: Q.prates[i.id] } : {}) })) }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status));
      if (!Array.isArray(j.items) || j.items.length !== (design ? dIn.length : items.length)) throw new Error("unexpected reply from the server");
      const pagePrice = design ? Q.total : items.reduce((a, t) => a + t.price, 0);
      const pItems = design ? dIn.map((x, i) => Object.assign({}, x, { price: j.items[i].price, fine: j.items[i].fine || 0 })) : items.map((t, i) => Object.assign(t, { price: j.items[i].price, fine: j.items[i].fine || 0, polkiQ: j.items[i].polki }));
      const changed = pagePrice !== j.total;
      m.textContent = "Making the PDF…";
      const blob = await makePdf({ qno: j.qno, design, name, city, option: OPTS[Q.option], items: pItems, total: j.total, fineTotal: j.fineTotal || 0, payNote: payText(), photos: !design && $("qphoto").checked, weights: $("qwt").checked, making: design ? mkText(st, Q.designs, "std", true) : mkText(st, items), usd: Q.usd });
      const fname = `${name.replace(/[^A-Za-z0-9 .\-]/g, "").trim().slice(0, 40) || "Quote"} ${design ? "Estimate" : { gh: "VSGH", ij: "VSIJ", lgd: "LGD" }[Q.option]}.pdf`, // owner 14/10: file named e.g. "Krishna VSGH.pdf"
        text = `Dear ${name}, thank you for your interest in Vaishnavi Jewels. Please find your ${design ? "estimate" : "quotation"} ${j.qno} attached. Our team will call you shortly.`;
      if (changed) $("qtotal").textContent = fmt(j.total);
      const file = new File([blob], fname, { type: "application/pdf" });
      // 14/10/2026: the share sheet only on phones; on a computer (Windows share box has no WhatsApp) download + open WhatsApp
      const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
      const canFile = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { return false; } })();
      if (via === "aashvi") await aashvi(j.qno, blob, name, m, design ? "Estimate" : "Quotation");
      else if (phone) {
        // Phones (14/10/2026, iPhone fix): the PDF is made first, then a green button. Its tap is a fresh tap, which iPhone needs
        // to open the share box. If this browser cannot share files (e.g. Chrome or an in-app browser on iPhone) the tap opens
        // the PDF itself, which has the iPhone share icon; a second link opens the customer's WhatsApp chat.
        m.textContent = `Quote ${j.qno} saved (${fmt(j.total)}${changed ? ", worked out again on the server" : ""}). Core has been told to call ${name}. Now tap the green button to send the PDF.`;
        let box = $("qsharebox");
        if (!box) { box = document.createElement("div"); box.id = "qsharebox"; box.className = "actions"; m.after(box); }
        box.textContent = ""; box.hidden = false;
        const sb = document.createElement("button"); sb.type = "button"; sb.className = "btn"; sb.style.cssText = "background:#1f8f4e;border-color:#1f8f4e;color:#fff";
        sb.textContent = canFile ? "Send PDF on WhatsApp" : "Open PDF to send";
        const url = URL.createObjectURL(file);
        const wa = document.createElement("a"); wa.className = "btn ghost"; wa.href = "https://wa.me/91" + mob + "?text=" + encodeURIComponent(text); wa.target = "_blank"; wa.rel = "noopener"; wa.textContent = "Open " + name + "'s WhatsApp chat";
        sb.onclick = async () => {
          if (canFile) {
            try { await navigator.share(/iPhone|iPad|iPod/i.test(navigator.userAgent || "") ? { files: [file] } : { files: [file], text }); m.textContent = `Quote ${j.qno} sent to ${name}. Core has been told to call.`; return; }
            catch (e) { if (e && e.name === "AbortError") { m.textContent = "Sharing was cancelled - tap the green button again."; return; } }
          }
          window.open(url, "_blank");
          m.textContent = "The PDF is open in a new tab: tap the share icon (square with arrow) > WhatsApp > choose " + name + ".";
        };
        box.append(sb, wa);
      } else {
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
        window.open("https://web.whatsapp.com/send?phone=91" + mob + "&text=" + encodeURIComponent(text), "_blank", "noopener");
        m.textContent = `Quote ${j.qno} saved (${fmt(j.total)}${changed ? ", worked out again on the server" : ""}) and the PDF downloaded. Attach ${fname} in the WhatsApp chat that opened. Core has been told to call ${name}.`;
      }
    } catch (e) { m.textContent = "Could not send: " + (e.message || e) + "."; }
    $("qsend").disabled = false; $("qaashvi").disabled = false;
  }
  function boot() { if (document.querySelector("nav") && $("p-rates")) { build(); setInterval(() => { const s = $("p-quote"); if (s && !s.hidden && !(document.activeElement && document.activeElement.classList.contains("qprate"))) render(); }, 20000); } else setTimeout(boot, 300); }
  boot();
})();
