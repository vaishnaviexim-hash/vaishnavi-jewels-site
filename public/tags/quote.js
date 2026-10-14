/* VJ Tags - Quote tab (owner 14/10/2026, Brain F-069). Loaded by shim.js on vaishnavijewels.com/tags only.
   Staff pick pieces by design / tag number, ONE option (Natural VS GH, Natural VS IJ or Lab-grown at Rs 23,000/ct),
   enter the customer, and send a branded PDF from their own WhatsApp. The server numbers and saves the quote and
   tells Core (Aashvi WhatsApp). No rates, codes or costs are printed - only each piece's final price and the total. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const OPTS = { gh: "Natural VS GH", ij: "Natural VS IJ", lgd: "Lab-grown" };
  const LGD_RATE = 23000;
  const NON_DIAMOND = /POL|EMR|MOZ|RUBY|PEARL|MOTI|STONE|KUNDAN/i;
  const PUR = { "22K": 0.92, "18K": 0.76, "14K": 0.60, "9K": 0.40 };
  const fmt = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  const up = (n, s) => Math.ceil(Math.round(n * 100) / 100 / s) * s;
  const Q = { items: [], option: "gh" };

  function settings() { const s = (window.VJ_SETTINGS && window.VJ_SETTINGS()) || {}; return {
    g: s.gold24g || null, at: s.goldAt || null, pur: Object.assign({}, PUR, s.purity || {}),
    mk: Object.assign({ base: 650, small: 750, limit: 5, pct: 10 }, s.making || {}), gst: s.gst == null ? 3 : s.gst, rates: s.defaultRates || {} }; }
  function optRate(d, opt, st) {
    if (NON_DIAMOND.test(String(d.q || "") + " " + String(d.code || ""))) return Number(d.rate) || 0;
    if (opt === "lgd") return LGD_RATE;
    const q = opt === "gh" ? "VS GH" : "VS IJ", sh = ["Round", "Choki", "Fancy"].includes(d.shape) ? d.shape : "Round";
    return Number(st.rates[q + "|" + sh]) || Number(st.rates[q + "|Round"]) || 0;
  }
  function priceFor(t, opt) {
    const st = settings(); if (!st.g) return null;
    const gold = t.kind === "sample" ? [{ k: "14K", net: (t.metal && t.metal.net) || 0 }] : (t.gold || []);
    const g0 = gold.find(g => g.net > 0); if (!g0) return null;
    const mk = up((g0.net > st.mk.limit ? st.mk.base : st.mk.small) + st.g * (st.pur[g0.k] || 0) * st.mk.pct / 100, 100);
    let gv = 0, mv = 0; gold.forEach(g => { if (g.net > 0) { gv += g.net * st.g * (st.pur[g.k] || 0); mv += g.net * mk; } });
    let dv = 0, missing = false; (t.dias || []).forEach(d => { const r = optRate(d, opt, st); if (!(r > 0) && !NON_DIAMOND.test(d.q || "")) missing = true; dv += (d.ct || 0) * r; });
    const sub = up(gv + mv + dv + ((t.other && t.other.amt) || 0), 100);
    return { final: up(sub * (1 + st.gst / 100), 10000), missing };
  }
  const tags = () => (window.VJ_TAGS ? window.VJ_TAGS() : []);
  function find(q) {
    q = String(q || "").trim().toUpperCase().replace(/\s+/g, ""); if (!q) return [];
    const all = tags();
    const exact = all.filter(t => String(t.designNo || "").toUpperCase() === q || String(t.label || "").toUpperCase() === q || String(t.no) === q && /^\d+$/.test(q) || String(t.label || "").toUpperCase().replace("/", "") === q.replace("/", ""));
    return exact.slice(0, 12);
  }

  function build() {
    const nav = document.querySelector("nav"); if (!nav || $("t-quote")) return;
    const b = document.createElement("button"); b.setAttribute("role", "tab"); b.id = "t-quote"; b.dataset.tab = "quote"; b.textContent = "Quote"; b.setAttribute("aria-selected", "false");
    nav.insertBefore(b, nav.querySelector('[data-tab="rates"]'));
    const sec = document.createElement("section"); sec.id = "p-quote"; sec.className = "card"; sec.hidden = true;
    sec.innerHTML = `
      <h2>1 · Pieces</h2>
      <div class="row" style="align-items:end"><label style="flex:2 1 220px">Design number or tag number <input id="qq" autocomplete="off" placeholder="e.g. 1436 or VLR14/803"></label>
      <div><button type="button" class="btn" id="qadd">Add piece</button></div></div>
      <div id="qpick" class="row" style="gap:8px"></div>
      <div class="list"><table class="items" style="min-width:560px"><thead><tr><th></th><th>Design · label</th><th>Category</th><th>Gold</th><th>Diamonds</th><th>Price</th><th></th></tr></thead><tbody id="qrows"></tbody></table></div>
      <h2>2 · Option (one per quote)</h2>
      <div class="seg" role="radiogroup" aria-label="Option">
        <label><input type="radio" name="qopt" value="gh" checked> Natural VS GH</label>
        <label><input type="radio" name="qopt" value="ij"> Natural VS IJ</label>
        <label><input type="radio" name="qopt" value="lgd"> Lab-grown</label></div>
      <h2>3 · Customer</h2>
      <div class="actions" id="qcbox" hidden><button type="button" class="btn ghost" id="qcontact">Pick from phone contacts</button></div>
      <div class="row"><label>Name <input id="qname" autocomplete="off" maxlength="60"></label>
        <label>Mobile (10 digits) <input id="qmob" inputmode="tel" autocomplete="off" maxlength="14" placeholder="98xxxxxxxx"></label>
        <label>City <input id="qcity" autocomplete="off" maxlength="40"></label></div>
      <label style="flex-direction:row;align-items:center;gap:8px;color:var(--fg)"><input type="checkbox" id="qphoto" checked style="width:auto"> Show piece photos in the PDF</label>
      <table class="sum"><tr class="total"><td>Total (incl. GST)</td><td id="qtotal">—</td></tr></table>
      <p class="hint" id="qnote"></p>
      <div class="actions"><button type="button" class="btn" id="qsend">Make PDF &amp; send on WhatsApp</button><button type="button" class="btn ghost" id="qclear">Clear</button></div>
      <p class="hint" id="qmsg"></p>`;
    $("p-rates").parentNode.insertBefore(sec, $("p-rates"));
    document.querySelectorAll("nav button").forEach(x => x.addEventListener("click", () => {
      const on = x.dataset.tab === "quote"; sec.hidden = !on; if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); render(); }
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y === x ? "true" : "false"));
    }));
    $("qadd").addEventListener("click", pick); $("qq").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); pick(); } });
    document.querySelectorAll('input[name=qopt]').forEach(r => r.addEventListener("change", () => { Q.option = r.value; render(); }));
    $("qclear").addEventListener("click", () => { Q.items = []; ["qname", "qmob", "qcity", "qq"].forEach(i => $(i).value = ""); $("qmsg").textContent = ""; render(); });
    $("qsend").addEventListener("click", send);
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
  function render() {
    const body = $("qrows"); if (!body) return; body.textContent = ""; let total = 0, miss = false;
    Q.items.forEach((t, i) => {
      const p = priceFor(t, Q.option); if (p) { total += p.final; if (p.missing) miss = true; }
      const tr = document.createElement("tr"); const c = (x, cl) => { const td = document.createElement("td"); if (cl) td.className = cl; td.textContent = x; tr.appendChild(td); return td; };
      const ph = document.createElement("td"); if (t.photo) { const im = document.createElement("img"); im.alt = ""; im.src = "/_blob/" + t.photo; ph.appendChild(im); } tr.appendChild(ph);
      c((t.designNo ? t.designNo + " · " : "") + t.label); c(t.catName || "");
      c(t.kind === "sample" ? "14K " + ((t.metal && t.metal.net) || 0).toFixed(3) : (t.gold || []).map(g => g.k + " " + g.net.toFixed(3)).join(" + "), "num");
      c((t.dias || []).reduce((a, d) => a + (d.ct || 0), 0).toFixed(2) + " ct", "num"); c(p ? fmt(p.final) : "—", "num");
      const x = document.createElement("td"); const rm = document.createElement("button"); rm.type = "button"; rm.className = "btn ghost"; rm.textContent = "Remove"; rm.addEventListener("click", () => { Q.items.splice(i, 1); render(); }); x.appendChild(rm); tr.appendChild(x);
      body.appendChild(tr);
    });
    const st = settings();
    $("qtotal").textContent = Q.items.length && st.g ? fmt(total) : "—";
    $("qnote").textContent = !st.g ? "Today's gold rate is not set (Gold rate & settings) - prices cannot be worked out." :
      (miss ? "Some diamond lines have no rate in the default table for this option - fill the table under Gold rate & settings. " : "") +
      `At 24K ${fmt(st.g)}/g${st.at ? ", " + new Date(st.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}. ${OPTS[Q.option]}${Q.option === "lgd" ? " at Rs 23,000 per ct" : ""}. Approximate, valid today.`;
    Q.total = total;
  }
  async function dataUrl(src) { const r = await fetch(src, { credentials: "same-origin" }); if (!r.ok) throw new Error("img"); const b = await r.blob(); return await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); }); }
  async function makePdf(q) {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 16; let y = 16;
    try { const lg = await dataUrl("/logo_vaishnavi_jewels.png"); doc.addImage(lg, "PNG", M, y, 42, 16); } catch (e) { doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("Vaishnavi Jewels", M, y + 10); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(["120, Rajhans Ornate - High Street Retail Mall", "Parle Point, Surat, Gujarat 395007", "vaishnavijewels.com"], W - M, y + 3, { align: "right" });
    y += 26; doc.setDrawColor(180, 150, 80); doc.line(M, y, W - M, y); y += 9;
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Quotation", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`${q.qno}   ·   ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, W - M, y, { align: "right" });
    y += 8; doc.text(`For: ${q.name}, ${q.city}`, M, y); y += 6; doc.text(`Option: ${q.option} diamonds, gold as per piece`, M, y); y += 8;
    for (const t of q.items) {
      if (y > 250) { doc.addPage(); y = 20; }
      const h = q.photos && t.photo ? 34 : 14;
      if (q.photos && t.photo) { try { doc.addImage(await dataUrl("/_blob/" + t.photo), "JPEG", M, y, 32, 32); } catch (e) {} }
      const x = q.photos && t.photo ? M + 38 : M;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(`${t.catName || "Piece"} - design ${t.designNo || t.label}`, x, y + 6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(80);
      const goldTxt = t.kind === "sample" ? "14K gold, made to order (about 2-4 weeks)" : (t.gold || []).map(g => g.k + " gold " + g.net.toFixed(2) + " g").join(" + ");
      const ct = (t.dias || []).filter(d => !NON_DIAMOND.test(d.q || "")).reduce((a, d) => a + (d.ct || 0), 0);
      doc.text(`${goldTxt}${ct ? ", diamonds " + ct.toFixed(2) + " ct" : ""}`, x, y + 12); doc.setTextColor(20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(fmt(t.price), W - M, y + 8, { align: "right" });
      y += h + 4; doc.setDrawColor(225); doc.line(M, y - 2, W - M, y - 2);
    }
    y += 4; doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("Total (incl. 3% GST)", M, y); doc.text(fmt(q.total), W - M, y, { align: "right" });
    y += 10; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(doc.splitTextToSize("Approximate prices at today's gold rate, valid today. All diamonds are third-party certified (IGI / EGL / TGL) and all gold is BIS HUID hallmarked. Made in our own manufacturing unit in Surat. Our representative will confirm the exact price.", W - 2 * M), M, y);
    return doc.output("blob");
  }
  async function send() {
    const m = $("qmsg"), st = settings();
    const name = $("qname").value.trim(), city = $("qcity").value.trim(), mob = $("qmob").value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (!Q.items.length) { m.textContent = "Add at least one piece."; return; }
    if (!st.g) { m.textContent = "Set today's gold rate first (Gold rate & settings)."; return; }
    if (!name || !city || !/^[6-9]\d{9}$/.test(mob)) { m.textContent = "Enter the customer's name, 10-digit mobile and city."; return; }
    const items = Q.items.map(t => Object.assign({}, t, { price: (priceFor(t, Q.option) || {}).final || 0 }));
    if (items.some(i => !i.price)) { m.textContent = "A piece has no price - check the gold rate and the default diamond rates."; return; }
    $("qsend").disabled = true; m.textContent = "Saving the quote…";
    try {
      const r = await fetch("/api/vj/quote", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, mobile: mob, city, option: OPTS[Q.option], total: Q.total, gold24g: st.g, items: items.map(i => ({ id: i.id, label: i.label, design: i.designNo || "", price: i.price })) }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status));
      m.textContent = "Making the PDF…";
      const blob = await makePdf({ qno: j.qno, name, city, option: OPTS[Q.option], items, total: Q.total, photos: $("qphoto").checked });
      const fname = `Vaishnavi_Jewels_${j.qno}.pdf`, text = `Dear ${name}, thank you for your interest in Vaishnavi Jewels. Please find your quotation ${j.qno} attached. Our team will call you shortly.`;
      const file = new File([blob], fname, { type: "application/pdf" });
      // 14/10/2026: the share sheet only on phones; on a computer (Windows share box has no WhatsApp) download + open WhatsApp
      const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
      if (phone && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); m.textContent = `Quote ${j.qno} shared. Core has been told to call ${name}.`; }
        catch (e) { m.textContent = `Quote ${j.qno} saved - sharing was cancelled. Press the button again to share the PDF.`; }
      } else {
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
        window.open("https://web.whatsapp.com/send?phone=91" + mob + "&text=" + encodeURIComponent(text), "_blank", "noopener");
        m.textContent = `Quote ${j.qno} saved and the PDF downloaded. Attach ${fname} in the WhatsApp chat that opened. Core has been told to call ${name}.`;
      }
    } catch (e) { m.textContent = "Could not send: " + (e.message || e) + "."; }
    $("qsend").disabled = false;
  }
  function boot() { if (document.querySelector("nav") && $("p-rates")) { build(); setInterval(() => { const s = $("p-quote"); if (s && !s.hidden) render(); }, 20000); } else setTimeout(boot, 300); }
  boot();
})();
