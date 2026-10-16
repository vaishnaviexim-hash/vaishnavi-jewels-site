/* VJ Tags - Bill tab (owner 16/10/2026, C-20261016-BILLS). Loaded by shim.js for owners and staff (not sales).
   Pieces are picked by design / tag number; the customer, bill number, date, gold rate (F, fine 24K per g) and
   W/s or Nett are typed in. The figures on screen are a preview; on "Save bill & make PDF" the server works the bill out
   again from the tags it holds, saves it under its number, and the PDF is printed from the saved figures. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  const B = { items: [], mode: "ws", title: "Bill" };
  const tags = () => (window.VJ_TAGS ? window.VJ_TAGS() : []);
  const settings = () => (window.VJ_SETTINGS && window.VJ_SETTINGS()) || {};
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const dmy = d => d.split("-").reverse().join("-");
  // VJ_BILL_CALC_START (same function in tags/bill.js - keep both copies identical)
  // Bills (owner 16/10/2026, C-20261016-BILLS), formulas from the owner's bills_and_estimates_1.xlsm sheet 'BILLS DIAMONDS':
  // karat rate = F (fine 24K per g, typed on the bill) x purity. W/s: gold = net x karat rate x 1.10 (10% wastage, none on 24K),
  // making per g = Rs 650 if the first gold line is over 5 g, else 750. Nett: gold = net x karat rate, making per g =
  // (650 or 750) + 10% of the karat rate, rounded up to Rs 100. Making is charged on all gold lines. Diamonds = ct x the tag's
  // rate, plus other charges. Bill total before GST rounded UP to Rs 1,000; GST rounded to the nearest rupee.
  function vjBillCalc(tags, o) {
    const pur = Object.assign({ '24K': 1, '22K': 0.92, '18K': 0.76, '14K': 0.60, '9K': 0.40 }, o.purity || {});
    const m = Object.assign({ base: 650, small: 750, limit: 5, pct: 10 }, o.making || {}), F = Number(o.F) || 0, ws = o.mode === 'ws';
    const gstPct = o.gst == null ? 3 : Number(o.gst);
    const rows = tags.map(t => {
      const gl = (t.kind === 'sample' ? [{ k: '14K', net: Number(t.metal && t.metal.net) || 0 }] : (Array.isArray(t.gold) ? t.gold : []))
        .map(g => ({ k: String(g && g.k || ''), net: Number(g && g.net) || 0 })).filter(g => g.net > 0);
      const kr = k => F * (Number(pur[k]) || 0), g0 = gl[0];
      let mk = 0;
      if (g0) { const b = g0.net > m.limit ? m.base : m.small; mk = ws ? b : Math.ceil(Math.round((b + kr(g0.k) * m.pct / 100) * 100) / 100 / 100) * 100; }
      let gold = 0, net = 0; gl.forEach(g => { net += g.net; gold += g.net * kr(g.k) * (ws && g.k !== '24K' ? 1.1 : 1); });
      const dl = (Array.isArray(t.dias) ? t.dias : []).filter(Boolean).map(d => ({ q: String(d.q || ''), shape: String(d.shape || ''), ct: Number(d.ct) || 0, pcs: Number(d.pcs) || 0, rate: Number(d.rate) || 0 }));
      const ct = dl.reduce((a, d) => a + d.ct, 0), dia = dl.reduce((a, d) => a + d.ct * d.rate, 0), oth = Number(t.other && t.other.amt) || 0;
      const r = { id: t.id, label: String(t.label || ''), design: String(t.designNo || ''), cat: String(t.catName || ''),
        gold: gl.map(g => g.k + ' ' + g.net.toFixed(3) + ' g').join(' + '), net: Math.round(net * 1000) / 1000, goldAmt: Math.round(gold),
        mkRate: mk, making: Math.round(mk * net), ct: Math.round(ct * 100) / 100, diaAmt: Math.round(dia), other: Math.round(oth) };
      r.amount = r.goldAmt + r.making + r.diaAmt + r.other;
      return r;
    });
    const sum = rows.reduce((a, r) => a + r.amount, 0), sub = Math.ceil(sum / 1000) * 1000, gst = Math.round(sub * gstPct / 100);
    return { rows, sum, roundOff: sub - sum, sub, gstPct, gst, total: sub + gst };
  }
  // VJ_BILL_CALC_END

  function find(q) {
    q = String(q || "").trim().toUpperCase().replace(/\s+/g, ""); if (!q) return [];
    const n = x => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), nq = n(q);
    return tags().filter(t => String(t.no) === q && /^\d+$/.test(q) || nq && (n(t.designNo) === nq || n(t.label) === nq)).slice(0, 12);
  }
  function build() {
    const nav = document.querySelector("nav"); if (!nav || $("t-bill")) return;
    const b = document.createElement("button"); b.setAttribute("role", "tab"); b.id = "t-bill"; b.dataset.tab = "bill"; b.textContent = "Bill"; b.setAttribute("aria-selected", "false");
    nav.insertBefore(b, nav.querySelector('[data-tab="rates"]'));
    const sec = document.createElement("section"); sec.id = "p-bill"; sec.className = "card"; sec.hidden = true;
    sec.innerHTML = `
      <h2>1 · Customer</h2>
      <div class="row"><label>Name <input id="bname" autocomplete="off" maxlength="60"></label>
        <label>City <input id="bcity" autocomplete="off" maxlength="40"></label>
        <label>Mobile No. <input id="bmob" inputmode="tel" autocomplete="off" maxlength="14" placeholder="98xxxxxxxx"></label></div>
      <div class="row"><label>Number <input id="bno" autocomplete="off" maxlength="20" placeholder="bill book number"></label>
        <label>Date <input id="bdate" type="date"></label>
        <label>Gold Rate (F) per g, 24K <input id="bF" inputmode="decimal" autocomplete="off"></label></div>
      <div class="seg" role="radiogroup" aria-label="Gold calculation">
        <label><input type="radio" name="bmode" value="ws" checked> W/s (10% wastage, making Rs 650/g)</label>
        <label><input type="radio" name="bmode" value="nett"> Nett (making + 10% of rate)</label></div>
      <div class="seg" role="radiogroup" aria-label="Title" style="margin-top:8px">
        <label><input type="radio" name="btitle" value="Bill" checked> Bill</label>
        <label><input type="radio" name="btitle" value="Estimate"> Estimate</label></div>
      <h2>2 · Pieces</h2>
      <div class="row" style="align-items:end"><label style="flex:2 1 220px">Design number or tag number <input id="bq" autocomplete="off" placeholder="e.g. 1436 or VLR14/803"></label>
      <div><button type="button" class="btn" id="badd">Add piece</button></div></div>
      <div id="bpick" class="row" style="gap:8px"></div>
      <div class="list"><table class="items" style="min-width:640px"><thead><tr><th>Piece</th><th>Gold</th><th>Gold value</th><th>Making</th><th>Diamonds</th><th>Other</th><th>Amount</th><th></th></tr></thead><tbody id="brows"></tbody></table></div>
      <table class="sum"><tr><td>Total</td><td id="bsum">—</td></tr><tr><td>Rounded up to Rs 1,000</td><td id="bsub">—</td></tr>
        <tr><td id="bgstl">GST 3%</td><td id="bgst">—</td></tr><tr class="total"><td>Bill total</td><td id="btotal">—</td></tr></table>
      <p class="hint" id="bnote"></p>
      <div class="actions"><button type="button" class="btn" id="bsave">Save bill &amp; make PDF</button><button type="button" class="btn ghost" id="bclear">Clear</button></div>
      <p class="hint" id="bmsg"></p><div class="actions" id="bout" hidden></div>`;
    $("p-rates").parentNode.insertBefore(sec, $("p-rates"));
    document.querySelectorAll("nav button").forEach(x => x.addEventListener("click", () => {
      const on = x.dataset.tab === "bill"; sec.hidden = !on; if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); prefill(); render(); }
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y === x ? "true" : "false"));
    }));
    $("badd").addEventListener("click", pick); $("bq").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); pick(); } });
    document.querySelectorAll("input[name=bmode]").forEach(r => r.addEventListener("change", () => { B.mode = r.value; render(); }));
    document.querySelectorAll("input[name=btitle]").forEach(r => r.addEventListener("change", () => { B.title = r.value; }));
    $("bF").addEventListener("input", render);
    $("bclear").addEventListener("click", () => { B.items = []; ["bname", "bcity", "bmob", "bno", "bq", "bF"].forEach(i => $(i).value = ""); $("bdate").value = ""; $("bmsg").textContent = ""; $("bout").hidden = true; prefill(); render(); });
    $("bsave").addEventListener("click", save);
  }
  function prefill() { if (!$("bdate").value) $("bdate").value = today(); if (!$("bF").value) { const g = settings().gold24g; if (g) $("bF").value = Math.round(g); } }
  function pick() {
    const box = $("bpick"); box.textContent = ""; const r = find($("bq").value);
    if (!r.length) { box.textContent = "No piece with that design or tag number."; return; }
    if (r.length === 1) { add(r[0]); return; }
    r.forEach(t => { const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = (t.designNo ? t.designNo + " · " : "") + t.label; b.addEventListener("click", () => { add(t); box.textContent = ""; }); box.appendChild(b); });
  }
  function add(t) { if (!B.items.includes(t.id)) B.items.push(t.id); $("bq").value = ""; $("bpick").textContent = ""; render(); }
  const F = () => Number(String($("bF").value).replace(/[^0-9.]/g, "")) || 0;
  function calcNow() { const s = settings(), all = tags(); const list = B.items.map(id => all.find(t => t.id === id)).filter(Boolean);
    return vjBillCalc(list, { F: F(), mode: B.mode, purity: s.purity, making: s.making, gst: s.gst }); }
  function render() {
    const body = $("brows"); if (!body) return; body.textContent = "";
    const c = calcNow(), ok = F() >= 2000;
    c.rows.forEach((r, i) => {
      const tr = document.createElement("tr"); const td = (x, cl) => { const e = document.createElement("td"); if (cl) e.className = cl; e.textContent = x; tr.appendChild(e); };
      td((r.design ? r.design + " · " : "") + r.label + (r.cat ? " · " + r.cat : "")); td(r.gold || "—");
      td(ok ? fmt(r.goldAmt) : "—", "num"); td(ok ? fmt(r.making) + " (" + r.mkRate + "/g)" : "—", "num");
      td(r.ct ? r.ct.toFixed(2) + " ct · " + fmt(r.diaAmt) : "—", "num"); td(r.other ? fmt(r.other) : "—", "num"); td(ok ? fmt(r.amount) : "—", "num");
      const x = document.createElement("td"), rm = document.createElement("button"); rm.type = "button"; rm.className = "btn ghost"; rm.textContent = "Remove";
      rm.addEventListener("click", () => { B.items.splice(i, 1); render(); }); x.appendChild(rm); tr.appendChild(x); body.appendChild(tr);
    });
    const has = c.rows.length && ok;
    $("bsum").textContent = has ? fmt(c.sum) : "—"; $("bsub").textContent = has ? fmt(c.sub) : "—";
    $("bgstl").textContent = "GST " + c.gstPct + "%"; $("bgst").textContent = has ? fmt(c.gst) : "—"; $("btotal").textContent = has ? fmt(c.total) : "—";
    $("bnote").textContent = !ok ? "Type the gold rate (F): fine 24K per gram." : (B.mode === "ws" ? "Gold includes 10% wastage. " : "") + "Diamond values are the rates saved on each tag.";
  }
  async function dataUrl(src) { const r = await fetch(src, { credentials: "same-origin" }); if (!r.ok) throw new Error("img"); const b = await r.blob(); return await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); }); }
  async function makePdf(b) {
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
    doc.text(`Gold Rate (F): ${fmt(b.F)} per g (24K)`, M, y); doc.text(`Gold Calculation: ${b.mode === "ws" ? "W/s" : "Nett"}`, M + 90, y); y += 9;
    const cols = [["Piece", 42, "l"], ["Gold", 25, "l"], ["Gold value", 23, "r"], ["Making", 22, "r"], ["Diamonds", 24, "r"], ["Other", 20, "r"], ["Amount", 26, "r"]];
    const row = (vals, bold, size) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size || 10.5); let x = M, h = 0;
      const lines = vals.map((v, i) => doc.splitTextToSize(String(v), cols[i][1] - 2)); lines.forEach(l => h = Math.max(h, l.length));
      lines.forEach((l, i) => { const [, w, al] = cols[i]; doc.text(l, al === "r" ? x + w - 1 : x, y, al === "r" ? { align: "right" } : undefined); x += w; });
      y += h * 5 + 2.5; };
    doc.setFillColor(243, 230, 211); doc.rect(M, y - 5, W - 2 * M, 8, "F"); row(cols.map(c => c[0]), true); y += 1;
    b.rows.forEach(r => { if (y > 255) { doc.addPage(); y = 20; }
      row([(r.design ? r.design + " - " : "") + r.label + (r.cat ? "\n" + r.cat : ""), r.gold || "-", fmt(r.goldAmt), fmt(r.making) + "\n@ " + r.mkRate + "/g",
        r.ct ? r.ct.toFixed(2) + " ct\n" + fmt(r.diaAmt) : "-", r.other ? fmt(r.other) : "-", fmt(r.amount)]);
      doc.setDrawColor(225); doc.line(M, y - 3, W - M, y - 3); });
    y += 3; if (y > 240) { doc.addPage(); y = 20; }
    const tot = (l, v, big) => { doc.setFont("helvetica", big ? "bold" : "normal"); doc.setFontSize(big ? 15 : 12); doc.text(l, W - M - 50, y, { align: "right" }); doc.text(v, W - M, y, { align: "right" }); y += big ? 9 : 7; };
    tot("Total", fmt(b.sum)); tot("Rounded up to Rs 1,000", fmt(b.sub)); tot(`GST ${b.gstPct}%`, fmt(b.gst)); doc.setDrawColor(180, 150, 80); doc.line(W - M - 95, y - 4, W - M, y - 4); y += 2; tot(b.title + " total", fmt(b.total), true);
    y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(80);
    const notes = [b.mode === "ws" ? "Gold includes 10% wastage." : "", "All diamonds are third-party certified (IGI / EGL / TGL) and all gold is BIS HUID hallmarked.", b.title === "Estimate" ? "This is an estimate. Final figure may vary with the gold price." : ""].filter(Boolean);
    doc.text(doc.splitTextToSize(notes.join(" "), W - 2 * M), M, y);
    return doc.output("blob");
  }
  async function save() {
    const m = $("bmsg"), out = $("bout"); out.hidden = true;
    const body = { no: $("bno").value.trim(), name: $("bname").value.trim(), city: $("bcity").value.trim(), mobile: $("bmob").value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""),
      date: $("bdate").value, F: F(), mode: B.mode, title: B.title, ids: B.items.slice() };
    if (!body.name) { m.textContent = "Enter the customer's name."; return; }
    if (!body.no) { m.textContent = "Enter the bill number."; return; }
    if (body.mobile && !/^[6-9]\d{9}$/.test(body.mobile)) { m.textContent = "Mobile must be 10 digits (or leave it empty)."; return; }
    if (!(body.F >= 2000)) { m.textContent = "Type the gold rate (F) per gram, 24K."; return; }
    if (!body.ids.length) { m.textContent = "Add at least one piece."; return; }
    $("bsave").disabled = true; m.textContent = "Saving the bill…";
    try {
      const r = await fetch("/api/vj/bill", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status));
      const b = j.bill; m.textContent = "Making the PDF…";
      const blob = await makePdf(b), fname = `${b.title} ${b.no.replace(/[^A-Z0-9\-]/g, "-")} ${b.name.replace(/[^A-Za-z0-9 .\-]/g, "").trim().slice(0, 40)}.pdf`;
      const file = new File([blob], fname, { type: "application/pdf" }), url = URL.createObjectURL(file);
      m.textContent = `${b.title} ${b.no} saved: ${fmt(b.total)}.`;
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
  function boot() { if (document.querySelector("nav") && $("p-rates")) { build(); setInterval(() => { const s = $("p-bill"); if (s && !s.hidden) render(); }, 20000); } else setTimeout(boot, 300); }
  boot();
})();
