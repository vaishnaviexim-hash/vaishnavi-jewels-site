/* VJ Tags - Bill tab (owner 16/10/2026, C-20261016-BILLS). Loaded by shim.js for owners and staff (not sales).
   Pieces are picked by design / tag number; the customer, bill number, date, gold rate (F, fine 24K per g) and
   W/s or Nett are typed in. The figures on screen are a preview; on "Save bill & make PDF" the server works the bill out
   again from the tags it holds, saves it under its number, and the PDF is printed from the saved figures. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  const B = { items: [], mode: "ws", settle: "fine", title: "Bill", g2g: "ws", photos: true, nbb: false, disc: {}, rates: {}, frates: {}, prates: {}, pdrates: {}, designs: [], option: "", usd: 0 }; // designs / option / usd: C-20261027-ESTBILL // prates: polki rate per pc for this bill (C-20261017-POLKI)
  const MODES = { ws: "W/s", nett: "Nett", g2g: "Gold to Gold", item: "Gold Item" };
  const fineMode = () => B.mode === "g2g" || B.mode === "item";
  const g3 = n => Number(n || 0).toFixed(3) + " g";
  const tags0 = () => (window.VJ_TAGS_ALL ? window.VJ_TAGS_ALL() : window.VJ_TAGS ? window.VJ_TAGS() : []); // includes sold pieces so saved bills can be edited (C-20261026-SOLD)
  const tags = () => tags0().concat(vtags()); // + the new designs typed on an estimate (C-20261027-ESTBILL)
  // owner 27/10/2026 17:39 (C-20261027-ESTBILL): an Estimate is made exactly like a Bill (same formulas, modes, PDF) for stock pieces AND for new
  // designs typed without a tag (karat, net gold, chain tunch, diamond lines as Pcs x Ct/pc = total ct, polki, other). A "Diamonds" choice (as on the
  // tag / Natural VS GH / Natural VS IJ / Lab-grown Rs 23,000) prices every diamond line from the default rates. A USD rate (market USD-INR + Rs 1.50,
  // editable, remembered on this device) shows the amounts in US$ and prints them. The server prices everything again from the typed figures.
  const DKARATS = ["14K", "18K", "22K", "9K", "24K"], DQUALS = ["CVD", "VS IJ", "VS HI", "VS GH", "VVS EF"], DSHAPES = ["Round", "Choki", "Fancy", "Solitaire", "Polki"], QC = { "CVD": "42", "VS IJ": "2", "VS HI": "3", "VS GH": "4", "VVS EF": "5" };
  const DEF_RATES = { "CVD|Round": 23000, "CVD|Choki": 23000, "CVD|Fancy": 23000, "CVD|Solitaire": 23000, "VS GH|Round": 46000, "VS GH|Choki": 46000, "VS GH|Fancy": 85000, "VS HI|Round": 40000, "VS HI|Choki": 40000, "VS IJ|Round": 35000, "VS IJ|Choki": 35000 };
  const NON_DIAMOND = /POL|EMR|MOZ|RUBY|PEARL|MOTI|STONE|KUNDAN/i, OPT_NAMES = { gh: "Natural VS GH", ij: "Natural VS IJ", lgd: "Lab-grown" };
  const num = v => { const n = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
  const defRate = (q, sh) => { const r = settings().defaultRates || DEF_RATES, v = Number(r[q + "|" + sh]) || Number(r[q + "|Round"]); return v > 0 ? v : 0; };
  // the rate a diamond line gets under the Diamonds choice (same rule as the server's vjQOptRate): polki / coloured stones keep their own rate
  function optRate(d, opt) { if (!opt || d.shape === "Polki" || NON_DIAMOND.test(String(d.q || "") + " " + String(d.code || ""))) return Number(d.rate) || 0; if (opt === "lgd") return 23000;
    const q = opt === "gh" ? "VS GH" : "VS IJ", sh = ["Round", "Choki", "Fancy"].includes(d.shape) ? d.shape : "Round"; return defRate(q, sh); }
  const newDesign = () => ({ desc: "", k: "14K", net: "", tunch: "", dias: [], ppcs: "", prate: "300", other: "" });
  // a typed design as a piece for vjBillCalc (id new-1, new-2 …); the same shape the server builds, so the preview matches the saved estimate
  function vtags() { return B.designs.map((d, i) => { const tv = String(d.tunch || "").trim(), tn = tv === "" ? 0 : Math.round(num(tv) * 1000) / 1000;
    const dias = d.dias.filter(x => num(x.ct) > 0).map(x => ({ q: x.q, shape: x.shape, pcs: Math.max(0, Math.round(num(x.pcs))), ct: Math.round(num(x.ct) * 1000) / 1000, rate: String(x.rate).trim() === "" ? defRate(x.q, x.shape) : Math.round(num(x.rate)) }));
    const ppcs = Math.max(0, Math.round(num(d.ppcs))), prate = String(d.prate).trim() === "" ? 300 : Math.round(num(d.prate)), other = Math.round(num(d.other));
    return { id: "new-" + (i + 1), label: String(d.desc || "").trim().slice(0, 60) || "New design", designNo: "", catName: "New design", kind: "design", newDesign: true,
      gold: [{ k: d.k, net: Math.round(num(d.net) * 1000) / 1000, ...(tn ? { tunch: tn } : {}) }], dias, ...(ppcs ? { polki: { pcs: ppcs, rate: prate } } : {}), ...(other ? { other: { amt: other } } : {}) }; }); }
  function designBad(d) { const bad = [], net = num(d.net), tv = String(d.tunch || "").trim(), tn = tv === "" ? 0 : num(tv), ppcs = num(d.ppcs), prate = String(d.prate).trim() === "" ? 300 : num(d.prate), other = num(d.other);
    if (!(net > 0)) bad.push("net gold weight"); if (tv !== "" && !(tn >= 0.3 && tn <= 1.1)) bad.push("chain tunch (0.300-1.100 or empty)");
    if (d.dias.some(x => num(x.ct) > 0 && !(String(x.rate).trim() === "" ? defRate(x.q, x.shape) : num(x.rate)) && x.shape !== "Polki")) bad.push("a diamond rate per ct");
    if (!(Number.isInteger(ppcs) && ppcs >= 0 && ppcs <= 10000) || ppcs > 0 && !(Number.isInteger(prate) && prate >= 1 && prate <= 100000)) bad.push("polki pcs and rate per pc"); if (!(Number.isInteger(other) && other >= 0)) bad.push("other charges in whole rupees"); return bad; }
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const fld = (label, input, flex) => { const l = el("label", {}, [label, input]); if (flex) l.style.flex = flex; return l; };
  const sel = (opts, val, txt) => { const s = el("select"); opts.forEach(o => s.append(el("option", { value: o, textContent: txt ? txt(o) : o, selected: o === val }))); return s; };
  function codeKeys(q) { const BY = {}; Object.keys(QC).forEach(k => { BY[QC[k]] = k; }); let buf = "", tm = 0; // shop codes on the keyboard: 42 CVD, 2 VS IJ, 3 VS HI, 4 VS GH, 5 VVS EF
    q.addEventListener("keydown", e => { if (!/^[0-9]$/.test(e.key)) return; e.preventDefault(); const t = Date.now(); buf = (t - tm < 900 ? buf : "") + e.key; tm = t;
      const v = BY[buf] || (buf.length > 1 ? BY[e.key] : null); if (v && q.value !== v) { q.value = v; q.dispatchEvent(new Event("change", { bubbles: true })); } if (!BY[buf] && BY[e.key]) buf = e.key; }); }
  function drawDesigns() {
    const box = $("bdes"); if (!box) return; box.textContent = "";
    if (B.designs.length) { B.title = "Estimate"; document.querySelectorAll("input[name=btitle]").forEach(x => { x.checked = x.value === "Estimate"; }); numField(); }
    B.designs.forEach((d, i) => {
      const card = el("div"); card.style.cssText = "border:1px dashed #b8963e;border-radius:8px;padding:10px;margin:8px 0;display:flex;flex-direction:column;gap:8px";
      const desc = el("input", { value: d.desc, maxLength: 60, autocomplete: "off", placeholder: "e.g. Bangles, new design" }), k = sel(DKARATS, d.k);
      const net = el("input", { value: d.net, inputMode: "decimal", autocomplete: "off", placeholder: "0.000" }), tu = el("input", { value: d.tunch || "", inputMode: "decimal", autocomplete: "off", placeholder: "chain only, e.g. 0.920" });
      desc.addEventListener("input", () => { d.desc = desc.value; render(); }); k.addEventListener("change", () => { d.k = k.value; render(); }); net.addEventListener("input", () => { d.net = net.value; render(); }); tu.addEventListener("input", () => { d.tunch = tu.value; render(); });
      const rm = el("button", { type: "button", className: "btn ghost", textContent: "Remove design" }); rm.addEventListener("click", () => { B.designs.splice(i, 1); drawDesigns(); render(); });
      card.append(el("strong", { textContent: "New design " + (i + 1) + " (no tag)" }), el("div", { className: "row" }, [fld("Description", desc, "2 1 220px"), fld("Karat", k), fld("Net gold (g)", net), fld("Chain tunch", tu)]));
      const dbox = el("div", { style: "display:flex;flex-direction:column;gap:6px" });
      d.dias.forEach((x, j) => {
        const q = sel(DQUALS, x.q, o => QC[o] + " · " + o), sh = sel(DSHAPES, x.shape), pc = el("input", { value: x.pcs || "", inputMode: "numeric", autocomplete: "off", placeholder: "0" });
        const ce = el("input", { value: x.cents || "", inputMode: "decimal", autocomplete: "off", placeholder: "e.g. 0.22" }), ct = el("input", { value: x.ct, inputMode: "decimal", autocomplete: "off", placeholder: "0.00" });
        const rt = el("input", { value: x.rate, inputMode: "numeric", autocomplete: "off" }), xx = el("button", { type: "button", className: "btn ghost", textContent: "✕", ariaLabel: "Remove diamond line" });
        codeKeys(q);
        // Pcs x Ct/pc (typed in carats, 0.22 = 22 cents) fills the total carats: 121 x 0.22 = 26.62 ct (owner 27/10 17:27); carats typed by hand still work
        const auto = () => { const p = num(x.pcs), c = num(x.cents); if (p > 0 && c > 0) { x.ct = (Math.round(p * c * 100) / 100).toFixed(2); ct.value = x.ct; } render(); };
        const fill = () => { const def = defRate(x.q, x.shape); rt.placeholder = def ? "default " + def.toLocaleString("en-IN") : "enter rate"; if (!x.edited) { x.rate = def ? String(def) : ""; rt.value = x.rate; } };
        q.addEventListener("change", () => { x.q = q.value; fill(); render(); }); sh.addEventListener("change", () => { x.shape = sh.value; fill(); render(); });
        pc.addEventListener("input", () => { x.pcs = pc.value; auto(); }); ce.addEventListener("input", () => { x.cents = ce.value; auto(); });
        ct.addEventListener("input", () => { x.ct = ct.value; x.cents = ""; ce.value = ""; render(); }); rt.addEventListener("input", () => { x.rate = rt.value; x.edited = rt.value.trim() !== ""; render(); });
        xx.addEventListener("click", () => { d.dias.splice(j, 1); drawDesigns(); render(); }); fill();
        dbox.append(el("div", { className: "row", style: "align-items:end" }, [fld("Shape", sh), fld("Quality", q), fld("Pcs", pc), fld("Ct/pc", ce), fld("D Wt (ct)", ct), fld("Rate ₹/ct", rt), el("div", {}, [xx])]));
      });
      const addD = el("button", { type: "button", className: "btn ghost", textContent: "+ Diamond line" }); addD.addEventListener("click", () => { d.dias.push({ q: "CVD", pcs: "", cents: "", shape: "Round", ct: "", rate: "", edited: false }); drawDesigns(); render(); });
      const pp = el("input", { value: d.ppcs, inputMode: "numeric", autocomplete: "off", placeholder: "0" }), pr = el("input", { value: d.prate, inputMode: "numeric", autocomplete: "off" }), ot = el("input", { value: d.other, inputMode: "numeric", autocomplete: "off", placeholder: "0" });
      pp.addEventListener("input", () => { d.ppcs = pp.value; render(); }); pr.addEventListener("input", () => { d.prate = pr.value; render(); }); ot.addEventListener("input", () => { d.other = ot.value; render(); });
      card.append(el("strong", { textContent: "Diamonds" }), dbox, el("div", {}, [addD]), el("div", { className: "row", style: "align-items:end" }, [fld("Polki pcs", pp), fld("Polki rate per pc (Rs)", pr), fld("Other charges (Rs)", ot)]), el("div", { className: "actions", style: "margin:0" }, [rm]));
      box.append(card);
    });
  }
  // USD (C-20261027-ESTBILL): rate = market USD-INR + Rs 1.50 once a day; a rate typed by staff wins for the day (kept on this device)
  const USD_KEY = "vj_bill_usd", USD_ADD = 1.5;
  const usdLoad = () => { try { return JSON.parse(localStorage.getItem(USD_KEY) || "null") || null; } catch (e) { return null; } };
  const usdSave = (rate, manual) => { try { localStorage.setItem(USD_KEY, JSON.stringify({ rate, day: today(), manual: !!manual })); } catch (e) {} };
  const usdTxt = n => B.usd > 0 && n > 0 ? "US$ " + Math.round(n / B.usd).toLocaleString("en-US") : "";
  async function usdInit() {
    const u = usdLoad(), box = $("busd"), info = $("busdinfo"); if (!box) return;
    if (u && u.rate > 0 && u.manual && u.day === today()) { B.usd = u.rate; box.value = u.rate; info.textContent = "Rate typed today."; return; }
    if (u && u.rate > 0) { B.usd = u.rate; box.value = u.rate; }
    try { const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR", { cache: "no-store" }); const j = await r.json(); const m = Number(j && j.rates && j.rates.INR); if (!(m > 50 && m < 200)) throw new Error("rate");
      B.usd = Math.round((m + USD_ADD) * 100) / 100; box.value = B.usd; usdSave(B.usd, false); info.textContent = `Market ${m.toFixed(2)} + Rs ${USD_ADD.toFixed(2)} (${j.date || today()}). Change it if needed.`; render();
    } catch (e) { info.textContent = B.usd ? "Could not fetch today's market rate - last rate kept." : "Could not fetch the market rate - type it."; }
  }
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
    const pur = Object.assign({ '24K': 1, '22K': 0.92, '18K': 0.76, '14K': 0.60, '9K': 0.385 }, o.purity || {}); // 9K = 38.5 tunch (owner 26/10 19:00)
    const m = Object.assign({ base: 650, small: 750, limit: 5, pct: 10, min: 1000 }, o.making || {}), F = Number(o.F) || 0;
    const mode = ['ws', 'nett', 'g2g', 'item'].includes(o.mode) ? o.mode : 'ws', fineMode = mode === 'g2g' || mode === 'item';
    const settle = fineMode ? (o.settle === 'amount' ? 'amount' : 'fine') : '';
  const g2gN = mode === 'g2g' && o.g2g === 'nett'; // owner 26/10 18:55 (C-20261026-G2GNETT): Gold to Gold on Nett = fine is net x purity (14K 0.60), making Rs 650/g (750 up to 5 g, min 1,000) + 10% wastage in rupees; on W/s = fine with 10% wastage (14K 0.66) + making
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
        if (fineMode) { fine += g.net * (g2gN ? (Number(pur[g.k]) || 0) : (VJ_FINE[mode][g.k] || 0)); if (g2gN) ng += g.net * kr(g.k); }
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
      if (g0 && mode !== 'item' && nc > 0) { let mkAmt = Math.max(mk * nc, Number(m.min) || 0); if (mode === 'nett' || g2gN) mkAmt += ng * m.pct / 100; r.making = Math.round(mkAmt); r.mkRate = Math.round(r.making / nc); }
      r.amount = r.goldAmt + r.making + r.diaAmt + r.polki + r.pd + r.other;
      const dv = String(o.disc && o.disc[t.id] != null ? o.disc[t.id] : '').trim(), pm = dv.match(/^(\d+(?:\.\d+)?)\s*%$/), dn = Number(dv.replace(/[,\s]/g, ''));
      r.discTxt = pm ? Math.min(100, Number(pm[1])) + '%' : '';
      r.disc = Math.round(Math.min(r.amount, pm ? r.amount * Math.min(100, Number(pm[1])) / 100 : (dn > 0 ? dn : 0)));
      r.wt = r.net; r.net = r.amount - r.disc;
      return r;
    });
    let sum = rows.reduce((a, r) => a + r.amount, 0); const disc = rows.reduce((a, r) => a + r.disc, 0);
    // owner 27/10/2026 12:39 (C-20261027-OGBAL): Gold to Gold where the customer gives fine gold - the old gold received (OG no. + fine g, typed as a plain
    // plus figure) is set against the fine due; the balance fine x the party's fine gold rate (24K/g, default F) is added in rupees (more gold received = taken off)
    const fineDue = Math.round(rows.reduce((a, r) => a + r.fine, 0) * 1000) / 1000; let og = null;
    if (mode === 'g2g' && settle === 'fine' && o.og && Number(o.og.fine) > 0) { const recv = Math.round(Number(o.og.fine) * 1000) / 1000, rt = Number(o.og.rate) >= 2000 && Number(o.og.rate) <= 50000 ? Number(o.og.rate) : F, bal = Math.round((fineDue - recv) * 1000) / 1000, amt = Math.round(bal * rt);
      og = { no: String(o.og.no || '').slice(0, 20), due: fineDue, recv, bal, rate: rt, amt }; sum += amt; }
    const after = Math.max(0, sum - disc);
    // owner 27/10/2026 13:35 (C-20261027-FINALAMT): a final amount typed for the bill - the discount is set so that total less discount + GST = that
    // amount exactly (no Rs 500 round-up); the bill prints only 'Final amount', the GST inside it stays in the record for the accountant
    const fin = Math.round(Number(o.final) || 0), finOk = fin > 0 && Math.abs((fin - after) - after * gstPct / 100) <= 2;
    const sub = finOk ? after : Math.ceil(after / 500) * 500, gst = finOk ? fin - after : Math.round(sub * gstPct / 100);
    // owner 17/10 15:29 ('i dont want 26093, straight 26500'): the round-up sits inside the biggest piece's making charge (its
    // rate per g is shown for the new making), or in Other for Gold Item / no gold, so every printed figure adds up to the total.
    // A piece that is only chain has no making (C-20261017-CHAINTUNCH): the biggest other piece takes it; a bill of chains only puts it in Other.
    rows.forEach(r => { r.amt0 = r.amount; }); /* C-20261027-FINALAMT: amount before the round-up, for the discount spread */ const roundIn = sub - after;
    if (roundIn > 0 && rows.length) { const rc = rows.some(x => !x.chain) ? rows.filter(x => !x.chain) : rows, r = rc.reduce((a, x) => x.net > a.net ? x : a, rc[0]);
      if (mode !== 'item' && r.mkWt > 0) { r.making += roundIn; r.mkRate = Math.round(r.making / r.mkWt); } else r.other += roundIn;
      r.amount += roundIn; r.net += roundIn; sum += roundIn; }
    const fine = Math.round(rows.reduce((a, r) => a + r.fine, 0) * 1000) / 1000;
    return { mode, settle, g2g: mode === 'g2g' ? (g2gN ? 'nett' : 'ws') : '', rows, fine: settle === 'fine' && !og ? fine : 0, fineIn: fine, og, sum, disc, after, roundOff: 0, roundIn, sub, gstPct, gst, total: sub + gst, final: finOk ? fin : 0 };
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
      <div class="actions" style="margin:0 0 8px"><button type="button" class="btn ghost" id="bback">&larr; Back to Bill</button></div>
      <h2>1 · Pieces</h2>
      <div class="row" style="align-items:end"><label style="flex:2 1 220px">Code on the tag, tag number or design number <input id="bq" autocomplete="off" placeholder="e.g. abc270xyz, 803 or 1436"></label>
      <div><button type="button" class="btn" id="badd">Add piece</button></div><div><button type="button" class="btn ghost" id="bnewdes">+ New design (no tag, estimate)</button></div></div>
      <div id="bpick" class="row" style="gap:8px"></div>
      <div id="bdes"></div>
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
      <div class="seg" role="radiogroup" aria-label="Gold to Gold on" id="bg2g" hidden style="margin-top:8px">
        <label><input type="radio" name="bg2g" value="ws" checked> Gold to Gold on W/s (10% wastage in the fine)</label>
        <label><input type="radio" name="bg2g" value="nett"> Gold to Gold on Nett (wastage in the making)</label></div>
      <div class="row" id="bog" hidden style="margin-top:8px"><label>OG no. (old gold) <input id="bogno" autocomplete="off" maxlength="20" placeholder="e.g. 245"></label><label>Old gold received, fine g <input id="bogfine" inputmode="decimal" autocomplete="off" maxlength="10" placeholder="e.g. 8.000"></label><label>Party fine gold rate, 24K/g <input id="bograte" inputmode="decimal" autocomplete="off" maxlength="8" placeholder="rate at order time"></label></div>
      <div class="seg" role="radiogroup" aria-label="Title" style="margin-top:8px">
        <label><input type="radio" name="btitle" value="Bill" checked> Bill</label>
        <label><input type="radio" name="btitle" value="Estimate"> Estimate</label></div>
      <div class="seg" role="radiogroup" aria-label="Whose customer" style="margin-top:8px">
        <label><input type="radio" name="bcust" value="" checked> Whose customer: not set</label>
        <label><input type="radio" name="bcust" value="mihir"> Mihir</label>
        <label><input type="radio" name="bcust" value="shilpi"> Shilpi ji</label>
        <label><input type="radio" name="bcust" value="abhinav"> Abhinav</label></div>
      <div class="seg" role="radiogroup" aria-label="Diamonds priced as" style="margin-top:8px">
        <label><input type="radio" name="bopt" value="" checked> Diamonds as on the tag</label>
        <label><input type="radio" name="bopt" value="gh"> Natural VS GH</label>
        <label><input type="radio" name="bopt" value="ij"> Natural VS IJ</label>
        <label><input type="radio" name="bopt" value="lgd"> Lab-grown (Rs 23,000/ct)</label></div>
      <label style="flex-direction:row;align-items:center;gap:8px;color:var(--fg);margin-top:8px"><input type="checkbox" id="bphoto" checked style="width:auto"> Show piece photos on the bill</label>
      <label style="flex-direction:row;align-items:center;gap:8px;color:var(--fg);margin-top:4px"><input type="checkbox" id="bnbb" style="width:auto"> Stamp <b>No Buy Back · No Exchange</b> on this bill</label>
      <div class="row" style="margin-top:8px;align-items:end"><label>Final amount - what the customer pays (optional) <input id="bfinal" inputmode="numeric" autocomplete="off" maxlength="9" placeholder="e.g. 152000" style="max-width:180px"></label><button type="button" class="btn ghost" id="bfinalgo">Set final amount</button></div><p class="hint" id="bfinalhint">Type the final figure (e.g. 152000): the discount is worked out so the bill closes at exactly that amount. The bill prints only the final amount.</p>
      <div class="row" style="margin-top:8px;align-items:end"><label>Amount before GST (optional) <input id="btarget" inputmode="numeric" autocomplete="off" maxlength="9" placeholder="e.g. 80000" style="max-width:180px"></label><button type="button" class="btn ghost" id="btargetgo">Set discount</button></div><p class="hint" id="btargethint">Type the amount the customer pays before GST (e.g. 80000) - the discount is worked out and spread over the pieces.</p>
      <table class="sum"><tr id="bfinerow" hidden><td><b>Fine gold to receive</b></td><td id="bfine"><b>—</b></td></tr><tr id="bogrow" hidden><td id="bogl">Balance fine gold</td><td id="bogamt">—</td></tr><tr><td>Total</td><td id="bsum">—</td></tr><tr id="bdiscrow" hidden><td>Less discount</td><td id="bdisc">—</td></tr><tr hidden><td>Total after discount</td><td id="bsub">—</td></tr>
        <tr><td id="bgstl">GST 3%</td><td id="bgst">—</td></tr><tr class="total"><td>Bill total</td><td id="btotal">—</td></tr><tr><td>In US dollars (approx.)</td><td id="busdtot">—</td></tr></table>
      <div class="row" style="align-items:end"><label style="max-width:220px">USD rate (Rs per US$) <input id="busd" inputmode="decimal" autocomplete="off" placeholder="e.g. 89.50"></label><span class="hint" id="busdinfo" style="flex:1 1 200px"></span></div>
      <p class="hint" id="bnote"></p>
      <p class="hint" id="beditnote" hidden style="color:#8a5a00;font-weight:600"></p>
      <div class="actions"><button type="button" class="btn" id="bsave">Save bill &amp; make PDF</button><button type="button" class="btn ghost" id="bclear">Clear</button></div>
      <p class="hint" id="bmsg"></p><div class="actions" id="bout" hidden></div>
      </div>
      <h2>Saved bills &amp; estimates</h2>
      <p class="hint">A new bill starts from Tag &gt; Bill now. A vendor chain is tagged on New tag (Chain + vendor name) and billed like any piece.</p>
      <div class="actions" style="margin:0 0 8px"><button type="button" class="btn" id="bnewest">New estimate (stock pieces or a new design)</button></div>
      <div class="row" style="align-items:end"><label style="flex:0 1 200px">Month <input id="bmonth" type="month"></label><label style="flex:0 1 220px">Customer name or mobile (all bills) <input id="bfmob" autocomplete="off" maxlength="40" placeholder="type name or mobile no."></label>
        <div class="actions" style="margin:0"><button type="button" class="btn ghost" id="bxl">Download summary (Excel)</button><button type="button" class="btn ghost" id="bxlall">All months (Excel)</button><button type="button" class="btn ghost" id="bxwa" hidden>WhatsApp party bills</button></div></div>
      <div class="list"><table class="items" style="min-width:640px"><thead><tr><th>Date</th><th>Number</th><th>Type</th><th>Customer</th><th>Design · item</th><th>Total</th><th>Fine gold</th><th>By</th><th></th></tr></thead><tbody id="bbook"></tbody></table></div>
      <p class="hint" id="bbookmsg"></p>`;
    $("p-rates").parentNode.insertBefore(sec, $("p-rates"));
    document.querySelectorAll("nav button").forEach(x => x.addEventListener("click", () => {
      const on = x.dataset.tab === "bill"; sec.hidden = !on; if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); prefill(); numField(); render(); loadBook(); $("bform").hidden = true; window.scrollTo({ top: 0 }); } // owner 26/10 17:49: the Saved bills tab shows only saved bills & estimates
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y === x ? "true" : "false"));
    }));
    $("badd").addEventListener("click", pick); $("bq").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); pick(); } });
    document.querySelectorAll("input[name=bmode]").forEach(r => r.addEventListener("change", () => { B.mode = r.value; render(); }));
    document.querySelectorAll("input[name=bset]").forEach(r => r.addEventListener("change", () => { B.settle = r.value; render(); }));
    document.querySelectorAll("input[name=bg2g]").forEach(r => r.addEventListener("change", () => { B.g2g = r.value; render(); })); // C-20261026-G2GNETT
    document.querySelectorAll("input[name=btitle]").forEach(r => r.addEventListener("change", () => { if (r.value === "Bill" && B.designs.length) { r.checked = false; document.querySelector('input[name=btitle][value=Estimate]').checked = true; $("bmsg").textContent = "A new design (no tag) can only go on an Estimate. Remove the design to make a Bill."; return; } B.title = r.value; numField(); }));
    document.querySelectorAll("input[name=bopt]").forEach(r => r.addEventListener("change", () => { B.option = r.value; B.rates = {}; render(); })); // C-20261027-ESTBILL: diamonds choice resets the per-line rate edits
    document.querySelectorAll("input[name=bcust]").forEach(r => r.addEventListener("change", () => { B.cust = r.value; })); // C-20261027-ESTOWNER: whose customer (Mihir / Shilpi ji / Abhinav) - for the follow-up reminder and the morning report, not printed
    $("bnewdes").addEventListener("click", () => { B.designs.push(newDesign()); drawDesigns(); render(); $("bmsg").textContent = ""; });
    $("bnewest").addEventListener("click", () => { $("bclear").click(); $("bform").hidden = false; B.title = "Estimate"; document.querySelectorAll("input[name=btitle]").forEach(x => { x.checked = x.value === "Estimate"; }); numField(); window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => { const n = $("bq"); if (n) n.focus(); }, 120); });
    $("busd").addEventListener("input", () => { const v = Math.round(num($("busd").value) * 100) / 100; B.usd = v > 50 && v < 200 ? v : 0; if (B.usd) { usdSave(B.usd, true); $("busdinfo").textContent = "Rate typed today."; } render(); }); usdInit();
    $("bmonth").value = today().slice(0, 7); $("bmonth").addEventListener("change", loadBook); { let tm = 0; $("bfmob").addEventListener("input", () => { B.fcity = null; clearTimeout(tm); tm = setTimeout(loadBook, 350); }); } // owner 26/10 17:58: type a mobile no. and see all that customer's bills
    $("bxl").addEventListener("click", () => xl($("bmonth").value || today().slice(0, 7))); $("bxlall").addEventListener("click", () => xl("all")); $("bxwa").addEventListener("click", e => partyWA(e.currentTarget));
    $("bF").addEventListener("input", render); $("btargetgo").addEventListener("click", applyTarget); $("bfinalgo").addEventListener("click", applyFinal); $("bfinal").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); applyFinal(); } }); /* C-20261027-FINALAMT */  ["bogno", "bogfine", "bograte"].forEach(i => $(i).addEventListener("input", () => totals())); /* C-20261027-OGBAL */ $("btarget").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); applyTarget(); } }); /* owner 27/10 12:21 (C-20261027-BILLTARGET) */ $("bdate").addEventListener("change", numField); $("bphoto").addEventListener("change", () => { B.photos = $("bphoto").checked; render(); }); $("bnbb").addEventListener("change", () => { B.nbb = $("bnbb").checked; });
    $("bclear").addEventListener("click", () => { B.editNo = null; B.final = 0; { const bf = $("bfinal"); if (bf) bf.value = ""; } { const bt = $("btarget"); if (bt) bt.value = ""; ["bogno", "bogfine", "bograte"].forEach(i => { const x = $(i); if (x) x.value = ""; }); } { const n = $("beditnote"); if (n) { n.hidden = true; n.textContent = ""; } } $("bsave").textContent = "Save bill & make PDF"; document.querySelectorAll("input[name=btitle]").forEach(x => { x.disabled = false; }); B.items = []; B.designs = []; drawDesigns(); B.option = ""; document.querySelectorAll("input[name=bopt]").forEach(x => { x.checked = x.value === ""; }); B.cust = ""; document.querySelectorAll("input[name=bcust]").forEach(x => { x.checked = x.value === ""; }); B.nbb = false; $("bnbb").checked = false; B.nbbAuto = false; B.disc = {}; B.rates = {}; B.frates = {}; B.prates = {}; B.pdrates = {}; $("bcusthint").textContent = ""; ["bname", "bcity", "bmob", "bno", "bq", "bF"].forEach(i => $(i).value = ""); $("bdate").value = ""; $("bmsg").textContent = ""; $("bout").hidden = true; prefill(); numField(); render(); });
    $("bsave").addEventListener("click", save);
    $("bback").addEventListener("click", () => { const c = document.querySelector('nav button[data-tab="check"]'); if (c) c.click(); });
  }
  // owner 26/10/2026 (C-20261026-BILLNOW): Price check > Bill now opens a fresh bill with that piece; weights come from the tag (not editable),
  // the gold rate and diamond / polki rates can be changed for this bill only; name, mobile and city are asked first.
  window.VJ_BILL_NOW = id => { if (!$("p-bill")) return; $("bclear").click(); $("bform").hidden = false; const t = tags().find(x => x.id === id);
    document.querySelectorAll('[id^="p-"]').forEach(p => { p.hidden = p.id !== "p-bill"; });
    document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", "false"));
    prefill(); numField(); if (t) add(t); loadBook();  window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => { const n = $("bmob"); if (n) n.focus(); }, 120); }; // owner 26/10 17:51: mobile first, the party's name and city fill in
  window.VJ_BILL_ADD = id => { const t = tags().find(x => x.id === id); if (t) add(t); }; // Orders pending > Bill all (C-20261026-ORDERSDUE)
  // C-20261016-BILLBOOK: estimate numbers are given by the server (E-YYMM-NN, from 01 each month); bill numbers are typed
  function numField() { const e = B.title === "Estimate", n = $("bno"); n.disabled = true; n.value = ""; const d = $("bdate").value || today(); // owner 16/10: bill numbers automatic too
    n.placeholder = "automatic (" + (e ? "E-" : "B-") + d.slice(2, 4) + d.slice(5, 7) + "-01, 02 …)"; }
  // owner 27/10/2026 12:48 (C-20261027-BILLNAME): Saved bills - type a name (e.g. Prachi) and every Prachi's bills show, with one button per party
  // (name · city · mobile, bill count) to narrow to that party; a party with a mobile then works exactly like typing the mobile (Excel, WhatsApp).
  function partyPick(list) { let w = $("bfpick"); if (!w) { w = document.createElement("div"); w.id = "bfpick"; w.className = "row"; w.style.cssText = "gap:8px;flex-wrap:wrap;margin:6px 0"; $("bfmob").closest(".row").after(w); } w.textContent = "";
    const ps = new Map(); list.filter(b => !b.cancelled).forEach(b => { const d = String(b.mobile || "").replace(/\D/g, "").slice(-10), k = d.length === 10 ? "m" + d : "n" + String(b.name || "").toLowerCase() + "|" + String(b.city || "").toLowerCase(); const p = ps.get(k) || { name: b.name || "", city: b.city || "", mob: d.length === 10 ? d : "", n: 0 }; p.n++; ps.set(k, p); });
    if (!ps.size || (ps.size < 2 && B.fcity == null)) return;
    w.appendChild(Object.assign(document.createElement("span"), { className: "hint", textContent: ps.size > 1 ? ps.size + " parties - tap one:" : "Party:" }));
    ps.forEach(p => { const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = p.name + (p.city ? " · " + p.city : "") + (p.mob ? " · " + p.mob : "") + " (" + p.n + (p.n === 1 ? " bill)" : " bills)");
      b.addEventListener("click", () => { if (p.mob) { $("bfmob").value = p.mob; B.fcity = null; } else { $("bfmob").value = p.name; B.fcity = String(p.city).toLowerCase(); } loadBook(); }); w.appendChild(b); }); }
  async function loadBook() {
    const body = $("bbook"), m = $("bbookmsg"); if (!body) return; const mo = $("bmonth").value || today().slice(0, 7); const fraw = String(($("bfmob") || {}).value || "").trim(), fq = /[a-z]/i.test(fraw) ? "" : fraw.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""), byMob = fq.length >= 4, fnm = !byMob && /[a-z]/i.test(fraw) && fraw.replace(/\s/g, "").length >= 2 ? fraw.toLowerCase().replace(/\s*ji$/, "").replace(/\s+/g, " ") : ""; /* owner 27/10 12:48 (C-20261027-BILLNAME): name or mobile */
    try { const r = await fetch("/api/vj/bills?month=" + encodeURIComponent(byMob || fnm ? "all" : mo), { credentials: "same-origin" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); if (byMob) j.bills = j.bills.filter(b => String(b.mobile || "").replace(/\D/g, "").includes(fq)); if (fnm) { j.bills = j.bills.filter(b => String(b.name || "").toLowerCase().replace(/\s+/g, " ").includes(fnm)); if (B.fcity != null) j.bills = j.bills.filter(b => String(b.city || "").toLowerCase() === B.fcity); } partyPick(fnm ? j.bills : []); { const pb = byMob ? j.bills.find(b => !b.cancelled) : null; B.party = pb ? { name: pb.name, city: pb.city, mobile: pb.mobile } : null; $("bxwa").hidden = !pb; $("bxl").textContent = pb ? "Download party bills (Excel)" : "Download summary (Excel)"; $("bxlall").hidden = !!pb; }
      body.textContent = ""; let tot = 0, ft = 0; // ft: fine gold to receive (Gold to Gold / Gold Item bills) - kept apart from the rupees (owner 26/10 18:54)
      let nc = 0;
      // owner 16/10: a cancelled bill's line leaves the screen for everyone (still kept, still in the Excel) (C-20261016-HIDECANCELLED, C-20261016-NOSHOWCANCELLED)
      j.bills.slice().reverse().forEach(b => { if (b.cancelled) { nc++; return; } else { tot += b.total || 0; ft += Number(b.fine) || 0; } const tr = document.createElement("tr"); const td = (x, cl) => { const e = document.createElement("td"); if (cl) e.className = cl; e.textContent = x; tr.appendChild(e); return e; };
        td(dmy(b.date)); td(b.no); const ty = td(b.title); if (b.cancelled) { const s = document.createElement("div"); s.style.cssText = "color:#a12b2b;font-weight:600"; s.textContent = "CANCELLED"; const r = document.createElement("div"); r.className = "hint"; r.textContent = b.cancelled; ty.append(s, r); tr.style.opacity = "0.75"; }
        td(b.name + (b.city ? ", " + b.city : "")); { const pc = td((b.rows || []).map(r => (r.design ? r.design + " · " : "") + (r.cat || "") + (r.label ? " (" + r.label + ")" : "")).join("\n")); pc.style.whiteSpace = "pre-line"; } /* owner 27/10 12:49 (C-20261027-BILLDESIGN): design no. + category on Saved bills */ { const tt = td(fmt(b.total), "num"); if (b.received != null) tt.appendChild(Object.assign(document.createElement("div"), { className: "hint", textContent: b.settled ? "Settled" : "Paid " + fmt(b.received) + " · Bal " + fmt(b.balance) })); } /* C-20261017-LEDGER */ td(b.fine ? g3(b.fine) : "—", "num"); td(b.by || "");
        const x = document.createElement("td"); x.style.whiteSpace = "nowrap"; const o = document.createElement("button"); o.type = "button"; o.className = "btn ghost"; o.textContent = "PDF"; o.addEventListener("click", () => reprint(b.no, o)); x.appendChild(o);
        if (j.canCancel && !b.cancelled && !b.settled) { const ed = document.createElement("button"); ed.type = "button"; ed.className = "btn ghost"; ed.textContent = "Edit"; ed.title = "Change this bill (same number) - owners only"; ed.addEventListener("click", () => editBill(b.no, ed)); x.appendChild(ed); } // C-20261026-BILLEDIT
        { const w = document.createElement("button"); w.type = "button"; w.className = "btn ghost"; w.textContent = "WhatsApp"; w.title = "Send this bill from your own WhatsApp"; // C-20261026-MYWA
          w.addEventListener("click", async () => { try { if (!w._b) { w.textContent = "Preparing…"; const r = await fetch("/api/vj/bill?no=" + encodeURIComponent(b.no), { credentials: "same-origin" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); w._b = j.bill; w._blob = await makePdf(j.bill, B.photos); w.textContent = "Tap to send ✓"; $("bbookmsg").textContent = b.no + " is ready - tap 'Tap to send' to open WhatsApp."; return; }
            await myWA(w._b, w._blob, $("bbookmsg")); w.textContent = "WhatsApp"; } catch (e) { w.textContent = "WhatsApp"; $("bbookmsg").textContent = "Could not prepare " + b.no + " (" + (e.message || e) + ")."; } }); x.appendChild(w); }
        if (j.canCancel || (j.canCancelOnly && !b.cancelled)) { const c = document.createElement("button"); c.type = "button"; c.className = "btn ghost"; c.style.color = "#a12b2b"; c.textContent = j.canCancel ? "Cancel / Erase" : "Cancel"; c.addEventListener("click", () => actBox(b, x, !!j.canCancel)); x.appendChild(c); }
        tr.appendChild(x); body.appendChild(tr); });
      m.textContent = j.bills.length ? `${j.bills.length} in this month${nc ? " (" + nc + " cancelled)" : ""}, total ${fmt(tot)}${nc ? " without the cancelled ones" : ""}.` : "Nothing saved in this month.";
      const live = j.bills.length - nc; // C-20261016-HIDECANCELLED
      m.textContent = byMob ? (live ? live + " bill" + (live === 1 ? "" : "s") + " for mobile " + fq + " (all months): amount " + fmt(tot) + (ft ? " + fine gold " + g3(ft) : "") + "." : "No bills for mobile " + fq + ".") : (live ? live + " in this month: amount " + fmt(tot) + (ft ? " + fine gold " + g3(ft) : "") + "." : "Nothing saved in this month.") + (nc ? " " + nc + " cancelled " + (nc === 1 ? "bill" : "bills") + " hidden (kept in the Excel, marked CANCELLED)." : "");
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
      const b = j.bill, all = tags0(); const miss = (b.rows || []).filter(x => !x.src && !all.some(t => t.id === x.id)); if (miss.length) throw new Error("a piece on it is no longer in stock (" + miss.map(x => x.label).join(", ") + ")");
      $("bclear").click(); $("bform").hidden = false; B.items = b.rows.filter(x => !x.src).map(x => x.id); B.mode = b.mode || "ws";
      B.designs = b.rows.filter(x => x.src).map(x => ({ desc: x.src.desc || "", k: x.src.k || "14K", net: String(x.src.net || ""), tunch: x.src.tunch ? String(x.src.tunch) : "", dias: (x.src.dias || []).map(d => ({ q: d.q, shape: d.shape, pcs: d.pcs ? String(d.pcs) : "", cents: "", ct: String(d.ct), rate: String(d.rate), edited: true })), ppcs: x.src.ppcs ? String(x.src.ppcs) : "", prate: String(x.src.prate || 300), other: x.src.other ? String(x.src.other) : "" })); drawDesigns();
      B.option = ["gh", "ij", "lgd"].includes(b.option) ? b.option : ""; document.querySelectorAll("input[name=bopt]").forEach(x => { x.checked = x.value === B.option; }); /* C-20261027-ESTBILL */ B.cust = ["mihir", "shilpi", "abhinav"].includes(b.cust) ? b.cust : ""; document.querySelectorAll("input[name=bcust]").forEach(x => { x.checked = x.value === B.cust; }); B.settle = b.settle || "fine"; B.g2g = b.g2g === "nett" ? "nett" : "ws"; document.querySelectorAll("input[name=bg2g]").forEach(x => { x.checked = x.value === B.g2g; }); B.title = b.title || "Bill"; B.nbb = !!b.nbb; $("bnbb").checked = B.nbb; B.nbbAuto = true;
      document.querySelectorAll("input[name=bmode]").forEach(x => { x.checked = x.value === B.mode; }); document.querySelectorAll("input[name=bset]").forEach(x => { x.checked = x.value === B.settle; });
      document.querySelectorAll("input[name=btitle]").forEach(x => { x.checked = x.value === B.title; x.disabled = true; });
      $("bname").value = b.name || ""; $("bcity").value = b.city || ""; $("bmob").value = b.mobile || ""; $("bdate").value = b.date; $("bF").value = b.F; B.final = Number(b.final) || 0; $("bfinal").value = B.final ? String(B.final) : ""; { const g = b.og || null; $("bogno").value = g ? g.no || "" : ""; $("bogfine").value = g ? String(g.recv) : ""; $("bograte").value = g ? String(g.rate) : ""; }
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
  function calcNow() { const s = settings(), all = tags(); const list = B.items.map(id => all.find(t => t.id === id)).filter(Boolean).concat(vtags())
      .map(t => B.option ? Object.assign({}, t, { dias: (Array.isArray(t.dias) ? t.dias : []).filter(Boolean).map(d => Object.assign({}, d, { rate: optRate(d, B.option) })) }) : t); // C-20261027-ESTBILL
    return vjBillCalc(list, { F: F(), mode: B.mode, settle: B.settle, g2g: B.g2g, disc: B.disc, rates: B.rates, frates: B.frates, prates: B.prates, pdrates: B.pdrates, og: ogNow(), final: B.final || 0, purity: s.purity, making: s.making, gst: s.gst }); }
  function goldCell(r, c) { return c.settle === "fine" ? g3(r.fine) + " fine" : fmt(r.goldAmt) + (c.settle ? " (" + g3(r.fine) + " fine)" : ""); }
  function mkCell(r, c) { return r.chain ? "— (chain)" /* C-20261017-CHAINTUNCH: no making on chain lines */ : c.mode === "item" ? "in gold" : fmt(r.making) + " (" + r.mkRate + "/g" + (r.mkWt > 0 && Math.abs(r.mkWt - r.wt) > 0.0005 ? " on " + r.mkWt.toFixed(3) + " g" : "") + ")"; }
  function noteText(mode, rows, g2g) { if (mode === "g2g" && g2g === "nett") mode = "g2gn"; // C-20261026-G2GNETT
    const ch = (rows || []).some(r => /tunch/.test(r.gold || "")); // C-20261017-CHAINTUNCH
    return (mode === "g2gn" ? "Fine gold on net weight; 10% wastage charged in the making. " : "") + (mode === "ws" || mode === "g2g" ? "Gold includes 10% wastage" + (ch ? " (chains: gold x tunch, no making)" : "") + ". " : ch ? "Chains: gold x tunch, no making. " : "") + (mode === "item" ? "Making is included in the gold. " : ""); }
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
      rm.addEventListener("click", () => { delete B.disc[r.id]; delete B.rates[r.id]; delete B.frates[r.id]; delete B.prates[r.id]; delete B.pdrates[r.id]; if (/^new-\d+$/.test(r.id)) { B.designs.splice(Number(r.id.slice(4)) - 1, 1); drawDesigns(); } else { const k = B.items.indexOf(r.id); if (k >= 0) B.items.splice(k, 1); } render(); }); x.appendChild(rm); tr.appendChild(x); body.appendChild(tr);
    });
    totals(c);
  }
  // owner 27/10/2026 12:21 (C-20261027-BILLTARGET): 'discount before amount like 80000 + gst' - type the amount before GST and the
  // discount (total less that amount) is spread over the pieces by their amount, the rest on the biggest piece. Only the per-piece
  // discounts are saved, so the server works the bill out exactly as before.
  function ogNow() { const f = Number(String($("bogfine").value).replace(/[^0-9.]/g, "")) || 0; return f > 0 ? { no: $("bogno").value.trim().slice(0, 20), fine: Math.round(f * 1000) / 1000, rate: Math.round(Number(String($("bograte").value).replace(/[^0-9.]/g, "")) || 0) } : null; } // C-20261027-OGBAL
  // owner 27/10/2026 13:35 (C-20261027-FINALAMT): final amount -> taxable = final less GST inside it; the discount is spread over the pieces to reach it
  function applyFinal() {
    const h = $("bfinalhint"), T = Number(String($("bfinal").value).replace(/[^0-9]/g, "")) || 0, s = settings(), pct = s.gst == null ? 3 : Number(s.gst);
    if (!T) { h.textContent = "Type the final amount, e.g. 152000."; return; }
    if (!B.items.length || F() < 2000) { h.textContent = "Add the pieces and the gold rate first."; return; }
    const keep = B.disc; B.disc = {}; B.final = 0; const c0 = calcNow(); B.disc = keep;
    const A = r => r.amt0 || r.amount, rows = c0.rows.filter(r => A(r) > 0), S = rows.reduce((a, r) => a + A(r), 0), sub = T - Math.round(T * pct / (100 + pct));
    if (!rows.length) { h.textContent = "Add the pieces first."; return; }
    if (sub > S) { h.textContent = "The pieces come to " + fmt(S) + " before GST - a final amount of " + fmt(T) + " is more than that, so no discount applies."; B.disc = {}; B.final = 0; $("bfinal").value = ""; render(); return; }
    const X = S - sub, nd = {}; let given = 0;
    rows.forEach(r => { const d = Math.floor(X * A(r) / S); nd[r.id] = d; given += d; });
    const big = rows.reduce((a, r) => A(r) > A(a) ? r : a, rows[0]); nd[big.id] += X - given;
    B.disc = {}; Object.keys(nd).forEach(id => { if (nd[id] > 0) B.disc[id] = String(nd[id]); }); B.final = T; $("btarget").value = "";
    render(); const c1 = calcNow();
    h.textContent = c1.final ? "Discount " + fmt(c1.sum - c1.sub) + " - final amount " + fmt(c1.total) + " (GST " + fmt(c1.gst) + " inside it, kept in the record, not printed)." : "Could not set the final amount - check the discounts.";
  }
  function applyTarget() {
    const h = $("btargethint"), T = Number(String($("btarget").value).replace(/[^0-9]/g, "")) || 0;
    if (!T) { h.textContent = "Type the amount before GST, e.g. 80000."; return; }
    if (!B.items.length || F() < 2000) { h.textContent = "Add the pieces and the gold rate first."; return; }
    const keep = B.disc; B.disc = {}; const c0 = calcNow(); B.disc = keep;
    const A = r => r.amt0 || r.amount, rows = c0.rows.filter(r => A(r) > 0), S = rows.reduce((a, r) => a + A(r), 0);
    if (!rows.length) { h.textContent = "Add the pieces first."; return; }
    if (T >= S) { B.disc = {}; render(); h.textContent = "The total is " + fmt(S) + " - that is not more than " + fmt(T) + ", so no discount."; return; }
    const X = S - T, nd = {}; let given = 0;
    rows.forEach(r => { const d = Math.floor(X * A(r) / S); nd[r.id] = d; given += d; });
    const big = rows.reduce((a, r) => A(r) > A(a) ? r : a, rows[0]); nd[big.id] += X - given;
    B.disc = {}; Object.keys(nd).forEach(id => { if (nd[id] > 0) B.disc[id] = String(nd[id]); }); B.final = 0; $("bfinal").value = "";
    render(); const c1 = calcNow();
    h.textContent = "Discount " + fmt(c1.sum - c1.sub) + " - amount before GST " + fmt(c1.sub) + " + GST " + fmt(c1.gst) + " = " + fmt(c1.total) + "." + (c1.sub !== T ? " (Totals round up to Rs 500, so use a figure in 500s.)" : "");
  }
  function totals(c) {
    c = c || calcNow(); const ok = F() >= 2000, has = c.rows.length && ok;
    { // owner 26/10 18:52 (C-20261026-NBBLAB): a lab-grown (CVD) diamond under Rs 20,000/ct is sold no buy back / no exchange - the stamp is ticked by default (can be unticked)
      const need = c.rows.some(r => (r.dias || []).some(d => /CVD|LAB|LGD|^C-/i.test(String(d.q || "")) && d.ct > 0 && d.rate > 0 && d.rate < 20000));
      if (need && !B.nbbAuto) { B.nbb = true; $("bnbb").checked = true; B.nbbAuto = true; } else if (!need) B.nbbAuto = false; }
    c.rows.forEach(r => { const n = document.querySelector('[data-net="' + r.id + '"]'); if (n) n.textContent = ok ? fmt(r.net) + (r.discTxt ? " (" + r.discTxt + ")" : "") : "—";
      const dv = document.querySelector('[data-dia="' + r.id + '"]'); if (dv) dv.textContent = "= " + fmt(r.diaAmt); const pv = document.querySelector('[data-pol="' + r.id + '"]'); if (pv) pv.textContent = "= " + fmt(r.polki); const pdv = document.querySelector('[data-pd="' + r.id + '"]'); if (pdv) pdv.textContent = "= " + fmt(r.pd); const am = document.querySelector('[data-amt="' + r.id + '"]'); if (am) am.textContent = ok ? fmt(r.amount) + (usdTxt(r.amount) ? " ≈ " + usdTxt(r.amount) : "") : "—"; });
    { const u = $("busdtot"); if (u) u.textContent = has && B.usd > 0 ? usdTxt(c.total) + ` (at Rs ${B.usd.toFixed(2)}/$)` : "—"; }
    $("bdiscrow").hidden = !c.disc; $("bdisc").textContent = "- " + fmt(c.sum - c.sub);
    $("bsettle").hidden = !fineMode(); $("bsettle").style.display = fineMode() ? "" : "none"; $("bg2g").style.display = B.mode === "g2g" ? "" : "none"; $("bg2g").hidden = B.mode !== "g2g"; /* .seg sets display:flex, which beats [hidden] */ $("bfinerow").hidden = !(c.settle === "fine" && c.rows.length) || !!c.og; { const on = B.mode === "g2g" && B.settle === "fine"; $("bog").hidden = !on; $("bog").style.display = on ? "" : "none"; $("bogrow").hidden = !c.og; if (c.og) { $("bogl").textContent = `Fine gold ${g3(c.og.due)} - old gold${c.og.no ? " (OG " + c.og.no + ")" : ""} ${g3(c.og.recv)} = balance ${g3(c.og.bal)} @ ${fmt(c.og.rate)}/g`; $("bogamt").textContent = fmt(c.og.amt); } } $("bfine").firstChild.textContent = g3(c.fine);
    $("bmodehint").textContent = { ws: "Gold x karat rate + 10% wastage; making Rs 650/g (750/g up to 5 g), minimum Rs 1,000 a piece.", nett: "Gold x karat rate; making Rs 650/g (750 up to 5 g), minimum Rs 1,000, + 10% wastage on the gold.",
      g2g: B.g2g === "nett" ? "Fine gold = net weight x karat (14K 0.60 / 18K 0.76 / 22K 0.92 / 9K 0.385); making Rs 650/g (750 up to 5 g), minimum Rs 1,000, + 10% wastage on the gold, in rupees." : "Fine gold = weight x 14K 0.66 / 18K 0.836 / 9K 0.4235 / 22K 1.06 (10% wastage in the fine); making Rs 650/g (750 up to 5 g), minimum Rs 1,000, in rupees.", item: "Fine gold = weight x 14K 0.74 / 18K 0.90 / 9K 0.54 / 22K 1.06; making included in the gold." }[B.mode];
    $("bsum").textContent = has ? fmt(c.disc ? c.sum : c.sub) : "—"; $("bsub").textContent = has ? fmt(c.sub) : "—";
    // owner 17/10 15:33: when every piece carries its own gold rate (typed on the tag), that rate is what this box shows;
    // today's rate (F) is asked for only when a piece has no rate on its tag (C-20261017-TAGRATE)
    const allOwn = c.rows.length > 0 && c.rows.every(r => r.orderRate || r.rateEdited), rts = [...new Set(c.rows.map(r => Math.round(r.F)))];
    $("bF").style.display = allOwn ? "none" : ""; $("bFtag").style.display = allOwn ? "" : "none";
    $("bFtag").value = allOwn ? (rts.length === 1 ? String(rts[0]) : "as on each piece") : "";
    $("bFl").textContent = allOwn ? "Gold Rate per g, 24K (from the tag)" : c.rows.some(r => r.orderRate || r.rateEdited) ? "Today's gold rate (F) per g, 24K - for pieces without a rate on the tag" : "Gold Rate (F) per g, 24K";
    $("bgstl").textContent = "GST " + c.gstPct + "%"; $("bgst").textContent = has ? fmt(c.gst) : "—"; $("btotal").textContent = has ? fmt(c.total) : "—";
    { const miss = B.designs.map((d, i) => ({ i, bad: designBad(d) })).filter(x => x.bad.length && (num(B.designs[x.i].net) > 0 || B.designs[x.i].dias.length)); const bm = $("bmsg"); if (bm && (miss.length || /^New design/.test(bm.textContent))) bm.textContent = miss.map(x => "New design " + (x.i + 1) + ": check " + x.bad.join(", ")).join(". "); }
    $("bnote").textContent = !ok ? "Type the gold rate (F): fine 24K per gram." : (B.option ? "Diamonds priced as " + OPT_NAMES[B.option] + " (default rates). " : "") + noteText(B.mode, c.rows, B.g2g) + "Diamond rates come from the tag; change them here for this bill if needed." + (c.rows.some(r => r.orderRate) ? " Pieces with a gold rate on their tag are billed at that rate; F is used only for pieces without one." : "") + " Each piece's gold rate can be changed in its Gold cell.";
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
      const amU = fm(r.amount) + (b.usd ? "\nUS$ " + Math.round(r.amount / b.usd).toLocaleString("en-US") : ""); // C-20261027-ESTBILL
      row(D ? base.concat([amU, r.disc ? fm(r.disc) + (r.discTxt ? "\n(" + r.discTxt + ")" : "") : "-", fm(r.net)]) : base.concat([amU]), false, D || PK ? 10 : 10.5, P ? (pics[r.id] || null) : undefined);
      doc.setDrawColor(225); doc.line(M, y - 3, W - M, y - 3); });
    y += 3; if (y > 240) { doc.addPage(); y = 20; }
    const tot = (l, v, big) => { doc.setFont("helvetica", big ? "bold" : "normal"); doc.setFontSize(big ? 15 : 12); doc.text(l, W - M - 50, y, { align: "right" }); doc.text(v, W - M, y, { align: "right" }); y += big ? 9 : 7; };
    if (b.nbb) { // owner 17/10: 'No Buy Back No Exchange' stamp, red double border, left of the totals (C-20261017-NBB)
      const sx = M, sy = y - 4, sw = 72, sh = 24; doc.setDrawColor(176, 32, 32); doc.setLineWidth(0.9); doc.roundedRect(sx, sy, sw, sh, 2, 2); doc.setLineWidth(0.3); doc.roundedRect(sx + 1.6, sy + 1.6, sw - 3.2, sh - 3.2, 1.5, 1.5);
      doc.setTextColor(176, 32, 32); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("NO BUY BACK", sx + sw / 2, sy + 10.2, { align: "center" }); doc.text("NO EXCHANGE", sx + sw / 2, sy + 18.4, { align: "center" });
      doc.setTextColor(20); doc.setLineWidth(0.2); doc.setDrawColor(0); }
    if (b.og) { tot("Fine gold due", g3(b.og.due)); tot("Old gold received" + (b.og.no ? " (OG " + b.og.no + ")" : ""), "- " + g3(b.og.recv)); tot(`Balance ${g3(b.og.bal)} @ ${fmt(b.og.rate)}/g`, fmt(b.og.amt), true); y += 2; } else if (b.settle === "fine") { tot("Fine gold to receive", g3(b.fine), true); y += 2; }
    if (b.final) { tot("Total", fmt(b.sum)); if (b.disc) tot("Less discount", "- " + fmt(b.sum - b.total)); } else { tot("Total", fmt(b.disc ? b.sum : b.sub)); if (b.disc) { tot("Less discount", "- " + fmt(b.sum - b.sub)); tot("Total after discount", fmt(b.sub)); } tot(`GST ${b.gstPct}%`, fmt(b.gst)); } /* C-20261027-FINALAMT: a final-amount bill prints Total, Less discount, Final amount only */ doc.setDrawColor(180, 150, 80); doc.line(W - M - 95, y - 4, W - M, y - 4); y += 2; tot(b.final ? "Final amount" : b.title + " total", fmt(b.total), true);
    if (b.usd) tot(`In US$ (approx., at Rs ${Number(b.usd).toFixed(2)} per US$)`, "US$ " + Math.round(b.total / b.usd).toLocaleString("en-US")); // C-20261027-ESTBILL
    if (b.title === "Estimate") { y += 2; doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(20); doc.text("Above are approximate estimates. Actual may vary when the final product is ready.", M, y); y += 4; } // owner 27/10 17:29
    y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(80);
    const notes = [noteText(b.mode, b.rows, b.g2g).trim(), "All diamonds are third-party certified (IGI / EGL / TGL) and all gold is BIS HUID hallmarked.", b.title === "Estimate" && b.usd ? "US dollar figures are indicative only; billing is in Indian rupees." : b.usd ? "US dollar figures are indicative only." : "", b.option ? "Diamonds priced as " + (OPT_NAMES[b.option] || b.option) + "." : "", b.nbb ? "Sold on a no buy back, no exchange basis." : "",
      b.settled ? `Settled: settlement discount ${fmt(b.settled.discount)} given on ${dmy(String(b.settled.at).slice(0, 10))}` + (b.original ? ` (bill total ${fmt(b.original.total)} reduced to ${fmt(b.total)}, the amount received)` : "") + "." + (b.settled.fineWaived ? ` Fine gold waived ${g3(b.settled.fineWaived)}.` : "") : ""].filter(Boolean); // C-20261017-LEDGER
    doc.text(doc.splitTextToSize(notes.join(" "), W - 2 * M), M, y);
    return doc.output("blob");
  }
  async function save() {
    const m = $("bmsg"), out = $("bout"); out.hidden = true;
    const body = { no: $("bno").value.trim(), name: (n => n && !/ji$/i.test(n) ? n + " ji" : n)($("bname").value.trim().slice(0, 57)) /* owner 26/10 18:45: 'ji' added on the bill automatically (Prachi -> Prachi ji) */, city: $("bcity").value.trim(), mobile: $("bmob").value.trim().slice(0, 20),
      date: $("bdate").value, F: F(), mode: B.mode, settle: B.settle, g2g: B.g2g, title: B.title, nbb: !!B.nbb, ids: B.items.slice(), disc: Object.assign({}, B.disc), rates: JSON.parse(JSON.stringify(B.rates)), frates: Object.assign({}, B.frates), prates: Object.assign({}, B.prates), pdrates: Object.assign({}, B.pdrates), og: ogNow(), final: B.final || 0, edit: B.editNo || "", option: B.option || "", usd: B.usd || 0, cust: B.cust || "",
      designs: B.designs.map(d => { const v = vtags()[B.designs.indexOf(d)]; return { desc: v.label, k: d.k, net: v.gold[0].net, tunch: v.gold[0].tunch || 0, dias: v.dias, ppcs: v.polki ? v.polki.pcs : 0, prate: v.polki ? v.polki.rate : 300, other: v.other ? v.other.amt : 0 }; }) }; // C-20261027-ESTBILL
    if (!body.name) { m.textContent = "Enter the customer's name."; return; }
    let dg = body.mobile.replace(/\D/g, ""); if (dg.length === 12 && dg.startsWith("91")) dg = dg.slice(2); // phone copy like "+91 98xxx xxxxx" is fine
    const mobNote = body.mobile && !/^[6-9]\d{9}$/.test(dg) ? ` Note: the mobile has ${dg.replace(/^91/, "").length} digits after +91 (a mobile usually has 10) - saved as typed.` : "";
    if (!(body.F >= 2000)) { m.textContent = "Type the gold rate (F) per gram, 24K."; return; }
    if (!body.ids.length && !body.designs.length) { m.textContent = "Add at least one piece or a new design."; return; }
    { const bad = B.designs.findIndex(d => designBad(d).length); if (bad >= 0) { m.textContent = "New design " + (bad + 1) + ": check " + designBad(B.designs[bad]).join(", ") + "."; return; } }
    if (body.designs.length && body.title !== "Estimate") { m.textContent = "A new design (no tag) can only go on an Estimate."; return; }
    if (body.title === "Estimate" && !body.cust) { m.textContent = "Choose whose customer this is (Mihir / Shilpi ji / Abhinav) - the follow-up reminder goes to them."; return; } // C-20261027-ESTOWNER
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
  /* APPCHAIN v1 - replaced by C-20261027-VCHAIN below (owner 27/10 13:14)
  // owner 27/10/2026 13:06 (C-20261027-APPCHAIN): chains taken ON APPROVAL from vendors (Siddharth and others) are entered at the sale:
  // "+ Approval chain" on the bill - vendor, karat, weight, tunch - makes a chain piece (APCH18/n) and puts it on the bill, billed as
  // weight x tunch x gold rate (the chain rule, no making). Sold approval chains stay listed per vendor ("to pay vendor", grams and fine) so the
  // vendor's bill can be tallied; once the vendor is paid, tick them and "Mark paid (checkout)" - they leave the list.
  const AP = { on: false, arm: false };
  const apNum = v => { const n = parseFloat(String(v || "").replace(/,/g, "")); return isFinite(n) ? n : 0; };
  const apEsc = s => String(s == null ? "" : s);
  function apInit() {
    if (AP.on || !$("badd") || !$("bpick") || !$("bbook")) return; AP.on = true;
    const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = "+ Approval chain"; b.style.marginLeft = "8px"; $("badd").after(b);
    const f = document.createElement("div"); f.id = "apform"; f.hidden = true; f.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:end;border:1px dashed #b8963e;border-radius:8px;padding:10px;margin:8px 0";
    const lab = (t, el) => { const l = document.createElement("label"); l.append(t + " ", el); return l; };
    const inp = (id, ph, w, mode) => { const i = document.createElement("input"); i.id = id; i.placeholder = ph || ""; i.autocomplete = "off"; i.maxLength = 40; if (mode) i.inputMode = mode; if (w) i.style.maxWidth = w + "px"; return i; };
    const v = inp("apv", "e.g. Siddharth", 180); v.setAttribute("list", "apvl"); const dl = document.createElement("datalist"); dl.id = "apvl";
    const k = document.createElement("select"); k.id = "apk"; ["22K", "18K", "14K", "9K"].forEach(x => k.append(Object.assign(document.createElement("option"), { value: x, textContent: x, selected: x === "18K" })));
    const go = Object.assign(document.createElement("button"), { type: "button", className: "btn", id: "apgo", textContent: "Add chain to bill" }), msg = Object.assign(document.createElement("span"), { className: "hint", id: "apmsg" });
    f.append(lab("Vendor", v), dl, lab("Karat", k), lab("Weight (g)", inp("apw", "3.000", 110, "decimal")), lab("Tunch", inp("apt", "0.760", 100, "decimal")), lab("Vendor tag / note", inp("apn", "", 160)), go, msg);
    $("bpick").before(f);
    b.addEventListener("click", () => { f.hidden = !f.hidden; f.style.display = f.hidden ? "none" : "flex"; apVendors(); if (!f.hidden) v.focus(); }); f.style.display = "none";
    go.addEventListener("click", apAdd);
    // vendor list on Saved bills
    const host = $("bbook").closest("table").parentElement, pn = document.createElement("div"); pn.id = "appanel"; pn.style.marginTop = "18px";
    const h = Object.assign(document.createElement("h2"), { textContent: "On-approval chains (vendors)" });
    const fv = document.createElement("select"); fv.id = "apfv"; fv.append(Object.assign(document.createElement("option"), { value: "", textContent: "All vendors" }));
    const fs = Object.assign(document.createElement("input"), { type: "checkbox", id: "apfs" }); fs.style.width = "auto";
    const fsl = document.createElement("label"); fsl.style.cssText = "flex-direction:row;align-items:center;gap:6px"; fsl.append(fs, " Show paid");
    const rf = Object.assign(document.createElement("button"), { type: "button", className: "btn ghost", textContent: "Refresh" });
    const row = document.createElement("div"); row.className = "row"; row.style.cssText = "align-items:end;gap:8px"; row.append(lab("Vendor", fv), fsl, rf);
    const tw = document.createElement("div"); tw.className = "list"; const tb = document.createElement("table"); tb.className = "items";
    tb.innerHTML = "<thead><tr><th></th><th>Chain</th><th>Vendor</th><th>Gold</th><th>Fine</th><th>Sold on</th><th>Status</th></tr></thead>"; const body = document.createElement("tbody"); body.id = "aprows"; tb.append(body); tw.append(tb);
    const sum = Object.assign(document.createElement("p"), { className: "hint", id: "apsum" }), pay = Object.assign(document.createElement("button"), { type: "button", className: "btn", id: "appaid", textContent: "Mark ticked as paid (checkout)" }), pm = Object.assign(document.createElement("span"), { className: "hint", id: "appmsg" });
    pm.style.marginLeft = "8px"; pn.append(h, row, tw, sum, pay, pm); host.after(pn);
    [fv, fs].forEach(x => x.addEventListener("change", apList)); rf.addEventListener("click", apList); pay.addEventListener("click", apPaid);
    apList(); setInterval(() => { if (!document.hidden && pn.offsetParent) apList(true); }, 20000);
  }
  function apTags() { return tags().filter(t => t && t.approval && t.approval.vendor); }
  function apVendors() { const vs = [...new Set(apTags().map(t => t.approval.vendor))].sort(); const dl = $("apvl"); if (dl) { dl.textContent = ""; vs.forEach(x => dl.append(Object.assign(document.createElement("option"), { value: x }))); } return vs; }
  async function apAdd() {
    const m = $("apmsg"), v = $("apv").value.trim().replace(/\s+/g, " ").slice(0, 40), k = $("apk").value, w = Math.round(apNum($("apw").value) * 1000) / 1000, tn = Math.round(apNum($("apt").value) * 1000) / 1000, note = $("apn").value.trim().slice(0, 30);
    if (!v) { m.textContent = "Type the vendor name."; return; } if (!(w > 0 && w <= 500)) { m.textContent = "Type the weight in grams (e.g. 3.000)."; return; }
    if (!(tn >= 0.3 && tn <= 1.1)) { m.textContent = "Tunch must be from 0.300 to 1.100 (e.g. 0.760)."; return; }
    $("apgo").disabled = true; m.textContent = "Saving…";
    try {
      const db = await window.claude.use("db"), prefix = "APCH" + ({ "22K": "22", "18K": "18", "14K": "14", "9K": "9" })[k], cref = db.doc("counters/main"), me = "ap" + Math.random();
      let lease = await cref.acquire({ holder: me, ttlMs: 8000 });
      for (let i = 0; i < 5 && !lease.acquired; i++) { await new Promise(r => setTimeout(r, 700 + Math.random() * 500)); lease = await cref.acquire({ holder: me, ttlMs: 8000 }); }
      if (!lease.acquired) throw { message: "someone else is saving a tag - try again in a few seconds" };
      const snap = await cref.get(), last = Object.assign({}, (snap.exists && snap.data().last) || {});
      let no = Math.max(last[prefix] || 0, ...tags().filter(x => x.prefix === prefix).map(x => x.no || 0)) + 1;
      for (;;) { if (!(await db.doc("tags/" + prefix + "-" + no).get()).exists) break; no++; }
      const id = prefix + "-" + no, now = new Date().toISOString();
      await db.doc("tags/" + id).set({ label: prefix + "/" + no, prefix, no, kind: "sale", cat: "CH", catName: "Chain", pcode: "CH" + prefix.slice(4), gold: [{ k, net: w, tunch: tn }], dias: [], other: { amt: 0 },
        remark: ("On approval - " + v).slice(0, 120), designNo: note, status: "in_stock", createdBy: null, createdAt: now, source: "On approval (vendor chain)", approval: { vendor: v, at: now, settled: false } });
      last[prefix] = Math.max(last[prefix] || 0, no); await cref.set({ last });
      m.textContent = "Saved - adding to the bill…"; let t = null; for (let i = 0; i < 40 && !(t = tags().find(x => x.id === id)); i++) await new Promise(r => setTimeout(r, 300));
      if (t) { if (!B.items.includes(id)) B.items.push(id); render(); m.textContent = `${prefix}/${no} on the bill: ${k} ${w.toFixed(3)} g, tunch ${tn.toFixed(3)} (${v}).`; ["apw", "apt", "apn"].forEach(i => { $(i).value = ""; }); }
      else m.textContent = `Saved as ${prefix}/${no}. Type ${prefix}/${no} in the box above and tap Add piece.`;
      apVendors(); apList(true);
    } catch (e) { m.textContent = "Could not save: " + ((e && (e.message || e.code)) || "error") + "."; }
    $("apgo").disabled = false;
  }
  function apList(quiet) {
    const body = $("aprows"); if (!body) return; const fv = $("apfv"), cur = fv.value, vs = apVendors();
    fv.textContent = ""; fv.append(Object.assign(document.createElement("option"), { value: "", textContent: "All vendors" })); vs.forEach(x => fv.append(Object.assign(document.createElement("option"), { value: x, textContent: x, selected: x === cur })));
    const showPaid = $("apfs").checked, L = apTags().filter(t => (!cur || t.approval.vendor === cur) && (showPaid || !t.approval.settled))
      .sort((a, b) => String(a.approval.vendor).localeCompare(String(b.approval.vendor)) || String(a.approval.at).localeCompare(String(b.approval.at)));
    body.textContent = ""; const due = {};
    L.forEach(t => { const g = (t.gold || [])[0] || {}, net = Number(g.net) || 0, tn = Number(g.tunch) || 0, fine = Math.round(net * tn * 1000) / 1000, sold = t.status === "sold" && t.sold, paid = !!t.approval.settled;
      const tr = document.createElement("tr"), td = x => { const e = document.createElement("td"); e.textContent = x; tr.append(e); return e; };
      const c = document.createElement("td"); if (sold && !paid) { const cb = Object.assign(document.createElement("input"), { type: "checkbox" }); cb.style.width = "auto"; cb.dataset.id = t.id; c.append(cb); } tr.append(c);
      td(t.label + (t.designNo ? " · " + t.designNo : "")); td(apEsc(t.approval.vendor)); td(`${g.k || ""} ${net.toFixed(3)} g @ ${tn.toFixed(3)}`); td(fine.toFixed(3) + " g");
      td(sold ? `${t.sold.no || ""} · ${t.sold.date ? dmy(t.sold.date) : ""}${t.sold.name ? " · " + t.sold.name : ""}` : "not billed yet");
      const st = td(paid ? "Paid " + (t.approval.settledAt ? dmy(String(t.approval.settledAt).slice(0, 10)) : "") : sold ? "Sold - pay vendor" : "With us (on approval)"); if (sold && !paid) st.style.cssText = "color:#a12b2b;font-weight:600";
      if (sold && !paid) { const d = due[t.approval.vendor] = due[t.approval.vendor] || { n: 0, g: 0, f: 0 }; d.n++; d.g += net; d.f += fine; }
      body.append(tr); });
    const ks = Object.keys(due); $("apsum").textContent = !L.length ? "No on-approval chains." : ks.length ? "To pay vendor: " + ks.map(v => `${v} - ${due[v].n} chain${due[v].n > 1 ? "s" : ""}, ${due[v].g.toFixed(3)} g, fine ${due[v].f.toFixed(3)} g`).join(" | ") : "Nothing sold that is unpaid.";
    if (!quiet) { $("appmsg").textContent = ""; AP.arm = false; $("appaid").textContent = "Mark ticked as paid (checkout)"; }
  }
  async function apPaid() {
    const ids = [...document.querySelectorAll("#aprows input[type=checkbox]:checked")].map(x => x.dataset.id), m = $("appmsg");
    if (!ids.length) { m.textContent = "Tick the chains you have paid the vendor for."; return; }
    if (!AP.arm) { AP.arm = true; $("appaid").textContent = `Confirm: ${ids.length} chain${ids.length > 1 ? "s" : ""} paid`; m.textContent = "Tap again to confirm."; return; }
    AP.arm = false; $("appaid").disabled = true; m.textContent = "Saving…";
    try { const db = await window.claude.use("db"), now = new Date().toISOString(); let n = 0;
      for (const id of ids) { const t = tags().find(x => x.id === id); if (!t) continue; await db.doc("tags/" + id).update({ approval: Object.assign({}, t.approval, { settled: true, settledAt: now }) }); t.approval = Object.assign({}, t.approval, { settled: true, settledAt: now }); n++; }
      m.textContent = `${n} chain${n > 1 ? "s" : ""} marked paid.`; apList(true); $("appaid").textContent = "Mark ticked as paid (checkout)";
    } catch (e) { m.textContent = "Could not save: " + ((e && (e.message || e.code)) || "error") + "."; }
    $("appaid").disabled = false;
  }
  setInterval(apInit, 1000);
  */
  // owner 27/10/2026 13:14 (C-20261027-VCHAIN, replaces APPCHAIN v1): chains taken ON APPROVAL from vendors. On the bill, "+ Approval chain":
  // vendor (required), karat, weight, sale tunch -> a chain piece VCH18/n on the bill, billed as weight x tunch x gold rate (no making).
  // The purchase side (purchase tunch and 24K rate, default = the sale tunch and the bill's gold rate, both changeable) is kept only on the
  // piece - never printed on the bill. Owner tab "Chains (vendors)": every vendor chain - vendor, date received, grams, sale / purchase tunch,
  // purchase rate and amount, which bill it went on - with per-vendor totals; "Entered in Tally - remove" takes the ticked chains off the list.
  const VC = { on: false, arm: false };
  const vcNum = v => { const n = parseFloat(String(v || "").replace(/,/g, "")); return isFinite(n) ? n : 0; };
  const vcR3 = n => Math.round(n * 1000) / 1000;
  const vcEl = (tag, props, kids) => { const e = Object.assign(document.createElement(tag), props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const vcLab = (t, el) => vcEl("label", {}, [t + " ", el]);
  const vcInp = (id, ph, w, mode) => { const i = vcEl("input", { id, placeholder: ph || "", autocomplete: "off", maxLength: 40 }); if (mode) i.inputMode = mode; if (w) i.style.maxWidth = w + "px"; return i; };
  const vcOwner = () => /owner/i.test(String(($("who") || {}).textContent || ""));
  function vcTags() { return tags().filter(t => t && t.approval && t.approval.vendor); }
  function vcVendors() { const vs = [...new Set(vcTags().map(t => t.approval.vendor))].sort(); const dl = $("vcvl"); if (dl) { dl.textContent = ""; vs.forEach(x => dl.append(vcEl("option", { value: x }))); } return vs; }
  function vcInit() {
    if (VC.on || !$("badd") || !$("bpick") || !$("p-rates") || !document.querySelector("nav")) return; VC.on = true;
    // 1. on the bill
    const b = vcEl("button", { type: "button", className: "btn ghost", textContent: "+ Approval chain" }); b.style.marginLeft = "8px"; b.hidden = true; /* owner 27/10 13:22 (C-20261027-CHAINVENDOR): vendor chains are tagged on New tag (Chain + vendor), then billed like any piece; this form is kept for a chain with no tag */ $("badd").after(b);
    const f = vcEl("div", { id: "vcform" }); f.style.cssText = "display:none;gap:8px;flex-wrap:wrap;align-items:end;border:1px dashed #b8963e;border-radius:8px;padding:10px;margin:8px 0";
    const v = vcInp("vcv", "e.g. Siddharth", 180); v.setAttribute("list", "vcvl");
    const k = vcEl("select", { id: "vck" }); ["22K", "18K", "14K", "9K"].forEach(x => k.append(vcEl("option", { value: x, textContent: x, selected: x === "18K" })));
    f.append(vcLab("Vendor (required)", v), vcEl("datalist", { id: "vcvl" }), vcLab("Karat", k), vcLab("Weight (g)", vcInp("vcw", "3.000", 110, "decimal")), vcLab("Sale tunch", vcInp("vct", "0.760", 100, "decimal")),
      vcLab("Purchase tunch", vcInp("vcpt", "same", 100, "decimal")), vcLab("Purchase rate 24K/g", vcInp("vcpr", "bill rate", 120, "decimal")), vcLab("Vendor tag / note", vcInp("vcn", "", 150)),
      vcEl("button", { type: "button", className: "btn", id: "vcgo", textContent: "Add chain to bill", onclick: vcAdd }), vcEl("span", { className: "hint", id: "vcmsg" }),
      vcEl("div", { className: "hint", textContent: "Purchase tunch and rate stay in VJ Tags only - they are not printed on the bill." }));
    $("bpick").before(f);
    b.addEventListener("click", () => { const on = f.style.display === "none"; f.style.display = on ? "flex" : "none"; vcVendors(); if (on) v.focus(); });
    // 2. owner tab
    if (!vcOwner()) return;
    const nav = document.querySelector("nav"), tb = vcEl("button", { id: "t-vchain", textContent: "Chains (vendors)" }); tb.setAttribute("role", "tab"); tb.dataset.tab = "vchain"; tb.setAttribute("aria-selected", "false");
    const place = () => { const after = nav.querySelector('[data-tab="bill"]'); if (after && after.nextSibling !== tb) after.after(tb); else if (!after && !tb.parentNode) nav.append(tb); };
    place(); setTimeout(place, 1600); setTimeout(place, 5200);
    const sec = vcEl("section", { id: "p-vchain", className: "card", hidden: true });
    const fv = vcEl("select", { id: "vcfv" }), fs = vcEl("input", { type: "checkbox", id: "vcfs" }); fs.style.width = "auto";
    const fsl = vcEl("label", {}, [fs, " Show removed"]); fsl.style.cssText = "flex-direction:row;align-items:center;gap:6px";
    const row = vcEl("div", { className: "row" }, [vcLab("Vendor", fv), fsl, vcEl("button", { type: "button", className: "btn ghost", textContent: "Refresh", onclick: () => vcList() })]); row.style.cssText = "align-items:end;gap:8px";
    const t = vcEl("table", { className: "items" }); t.style.minWidth = "900px";
    t.innerHTML = "<thead><tr><th></th><th>Chain</th><th>Vendor</th><th>Received</th><th>Gold</th><th>Sale tunch</th><th>Purchase tunch</th><th>Purchase rate 24K/g</th><th>Purchase amount</th><th>Sold on</th><th>Status</th></tr></thead>";
    t.append(vcEl("tbody", { id: "vcrows" }));
    sec.append(vcEl("h2", { textContent: "Chains on approval - vendor account" }), vcEl("p", { className: "hint", textContent: "Every chain tagged with a vendor name (New tag > Chain > Vendor). Chains with no vendor are the karigar's / own and are not listed. Tally the vendor's bill with the totals below; after the entry in Tally, tick the chains and remove them." }),
      row, vcEl("div", { className: "list" }, [t]), vcEl("p", { className: "hint", id: "vcsum" }),
      vcEl("button", { type: "button", className: "btn", id: "vcdone", textContent: "Entered in Tally - remove ticked", onclick: vcDone }), vcEl("span", { className: "hint", id: "vcdmsg" }));
    $("p-rates").parentNode.insertBefore(sec, $("p-rates"));
    nav.addEventListener("click", e => { const x = e.target.closest("button"); if (!x || !nav.contains(x)) return; const on = x === tb; sec.hidden = !on;
      if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); nav.querySelectorAll("button").forEach(y => y.setAttribute("aria-selected", y === tb ? "true" : "false")); vcList(); window.scrollTo({ top: 0 }); } });
    [fv, fs].forEach(x => x.addEventListener("change", () => vcList()));
    setInterval(() => { if (!document.hidden && !sec.hidden && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#vcrows"))) vcList(true); }, 20000);
  }
  async function vcAdd() {
    const m = $("vcmsg"), v = $("vcv").value.trim().replace(/\s+/g, " ").slice(0, 40), k = $("vck").value, w = vcR3(vcNum($("vcw").value)), tn = vcR3(vcNum($("vct").value)), note = $("vcn").value.trim().slice(0, 30);
    const pt = String($("vcpt").value).trim() === "" ? tn : vcR3(vcNum($("vcpt").value)), pr = String($("vcpr").value).trim() === "" ? Math.round(F() * 100) / 100 : Math.round(vcNum($("vcpr").value) * 100) / 100;
    if (!v) { m.textContent = "Type the vendor name - it is needed to know where the chain came from."; return; }
    if (!(w > 0 && w <= 500)) { m.textContent = "Type the weight in grams (e.g. 3.000)."; return; }
    if (!(tn >= 0.3 && tn <= 1.1)) { m.textContent = "Sale tunch must be from 0.300 to 1.100 (e.g. 0.760)."; return; }
    if (!(pt >= 0.3 && pt <= 1.1)) { m.textContent = "Purchase tunch must be from 0.300 to 1.100, or empty (= sale tunch)."; return; }
    if (!(pr >= 2000 && pr <= 50000)) { m.textContent = "Type the gold rate on the bill first, or a purchase rate 24K/g."; return; }
    $("vcgo").disabled = true; m.textContent = "Saving…";
    try {
      const db = await window.claude.use("db"), kn = ({ "22K": "22", "18K": "18", "14K": "14", "9K": "9" })[k], prefix = "VCH" + kn, cref = db.doc("counters/main"), me = "vc" + Math.random();
      let lease = await cref.acquire({ holder: me, ttlMs: 8000 });
      for (let i = 0; i < 5 && !lease.acquired; i++) { await new Promise(r => setTimeout(r, 700 + Math.random() * 500)); lease = await cref.acquire({ holder: me, ttlMs: 8000 }); }
      if (!lease.acquired) throw { message: "someone else is saving a tag - try again in a few seconds" };
      const snap = await cref.get(), last = Object.assign({}, (snap.exists && snap.data().last) || {});
      let no = Math.max(last[prefix] || 0, ...tags().filter(x => x.prefix === prefix).map(x => x.no || 0)) + 1;
      for (;;) { if (!(await db.doc("tags/" + prefix + "-" + no).get()).exists) break; no++; }
      const id = prefix + "-" + no, now = new Date().toISOString();
      await db.doc("tags/" + id).set({ label: prefix + "/" + no, prefix, no, kind: "sale", cat: "CH", catName: "Chain", pcode: "CH" + kn, gold: [{ k, net: w, tunch: tn }], dias: [], other: { amt: 0 },
        remark: "", designNo: "", status: "in_stock", createdBy: null, createdAt: now, source: "Vendor chain on approval",
        approval: { vendor: v, at: now, note, pTunch: pt, pRate: pr, settled: false } });
      last[prefix] = Math.max(last[prefix] || 0, no); await cref.set({ last });
      m.textContent = "Saved - adding to the bill…"; let t = null; for (let i = 0; i < 40 && !(t = tags().find(x => x.id === id)); i++) await new Promise(r => setTimeout(r, 300));
      if (t) { if (!B.items.includes(id)) B.items.push(id); render(); m.textContent = `${prefix}/${no} on the bill: ${k} ${w.toFixed(3)} g, tunch ${tn.toFixed(3)} (from ${v}).`; ["vcw", "vct", "vcpt", "vcpr", "vcn"].forEach(i => { $(i).value = ""; }); }
      else m.textContent = `Saved as ${prefix}/${no}. Type ${prefix}/${no} in the box above and tap Add piece.`;
      vcVendors(); vcList(true);
    } catch (e) { m.textContent = "Could not save: " + ((e && (e.message || e.code)) || "error") + "."; }
    $("vcgo").disabled = false;
  }
  async function vcSet(t, ch) { const db = await window.claude.use("db"), a = Object.assign({}, t.approval, ch); await db.doc("tags/" + t.id).update({ approval: a }); t.approval = a; }
  function vcList(quiet) {
    const body = $("vcrows"); if (!body) return; const fv = $("vcfv"), cur = fv.value, vs = vcVendors();
    fv.textContent = ""; fv.append(vcEl("option", { value: "", textContent: "All vendors" })); vs.forEach(x => fv.append(vcEl("option", { value: x, textContent: x, selected: x === cur })));
    const showOld = $("vcfs").checked, L = vcTags().filter(t => (!cur || t.approval.vendor === cur) && (showOld || !t.approval.settled))
      .sort((a, b) => String(a.approval.vendor).localeCompare(String(b.approval.vendor)) || String(a.approval.at).localeCompare(String(b.approval.at)));
    body.textContent = ""; const tot = {};
    L.forEach(t => { const a = t.approval, g = (t.gold || [])[0] || {}, net = Number(g.net) || 0, tn = Number(g.tunch) || 0, pt = Number(a.pTunch) || tn, pr = Number(a.pRate) || 0, fine = vcR3(net * pt), amt = Math.round(net * pt * pr);
      const sold = t.status === "sold" && t.sold, done = !!a.settled, tr = document.createElement("tr"), td = x => { const e = document.createElement("td"); if (x instanceof Node) e.append(x); else e.textContent = x; tr.append(e); return e; };
      const cb = vcEl("input", { type: "checkbox" }); cb.style.width = "auto"; cb.dataset.id = t.id; td(done ? "" : cb);
      td(t.label + (a.note ? " · " + a.note : "")); td(a.vendor); td(a.at ? dmy(String(a.at).slice(0, 10)) : ""); td(`${g.k || ""} ${net.toFixed(3)} g`); td(tn.toFixed(3));
      const ip = (val, w, ok, key) => { const i = vcEl("input", { value: String(val), inputMode: "decimal" }); i.style.cssText = `width:${w}px;text-align:right;padding:4px 6px`; i.disabled = done;
        i.addEventListener("change", async () => { const n = vcNum(i.value); if (!ok(n)) { i.style.borderColor = "#a12b2b"; return; } i.style.borderColor = ""; try { await vcSet(t, { [key]: key === "pTunch" ? vcR3(n) : Math.round(n * 100) / 100 }); vcList(true); } catch (e) { i.style.borderColor = "#a12b2b"; $("vcdmsg").textContent = "Could not save: " + ((e && (e.message || e.code)) || "error"); } }); return i; };
      td(ip(pt.toFixed(3), 80, n => n >= 0.3 && n <= 1.1, "pTunch")); td(ip(pr || "", 100, n => n >= 2000 && n <= 50000, "pRate"));
      td(`${fmt(amt)} (fine ${fine.toFixed(3)} g)`);
      td(sold ? `${t.sold.no || ""} · ${t.sold.date ? dmy(t.sold.date) : ""}${t.sold.name ? " · " + t.sold.name : ""}` : "not billed yet");
      const st = td(done ? "Removed " + (a.settledAt ? dmy(String(a.settledAt).slice(0, 10)) : "") : sold ? "Sold" : "With us"); if (!done && sold) st.style.fontWeight = "600";
      if (!done) { const s = tot[a.vendor] = tot[a.vendor] || { n: 0, g: 0, f: 0, a: 0 }; s.n++; s.g += net; s.f += fine; s.a += amt; }
      body.append(tr); });
    const ks = Object.keys(tot); $("vcsum").textContent = !L.length ? "No vendor chains." : ks.length ? ks.map(v => `${v}: ${tot[v].n} chain${tot[v].n > 1 ? "s" : ""}, ${tot[v].g.toFixed(3)} g, fine ${tot[v].f.toFixed(3)} g, ${fmt(tot[v].a)}`).join("  |  ") : "All removed.";
    if (!quiet) { $("vcdmsg").textContent = ""; VC.arm = false; $("vcdone").textContent = "Entered in Tally - remove ticked"; }
  }
  async function vcDone() {
    const ids = [...document.querySelectorAll("#vcrows input[type=checkbox]:checked")].map(x => x.dataset.id), m = $("vcdmsg");
    if (!ids.length) { m.textContent = "Tick the chains you have entered in Tally."; return; }
    if (!VC.arm) { VC.arm = true; $("vcdone").textContent = `Confirm: remove ${ids.length} chain${ids.length > 1 ? "s" : ""}`; m.textContent = "Tap again to confirm."; return; }
    VC.arm = false; $("vcdone").disabled = true; m.textContent = "Saving…";
    try { const now = new Date().toISOString(); let n = 0; for (const id of ids) { const t = tags().find(x => x.id === id); if (!t) continue; await vcSet(t, { settled: true, settledAt: now }); n++; }
      vcList(true); m.textContent = `${n} chain${n > 1 ? "s" : ""} removed (tick "Show removed" to see them again).`; $("vcdone").textContent = "Entered in Tally - remove ticked";
    } catch (e) { m.textContent = "Could not save: " + ((e && (e.message || e.code)) || "error") + "."; }
    $("vcdone").disabled = false;
  }
  setInterval(vcInit, 1000);
  function boot() { if (document.querySelector("nav") && $("p-rates")) { build(); setInterval(() => { const s = $("p-bill"); if (s && !s.hidden && !(document.activeElement && (document.activeElement.classList.contains("bdisc") || document.activeElement.classList.contains("brate")))) render(); }, 20000); } else setTimeout(boot, 300); }
  boot();
})();
