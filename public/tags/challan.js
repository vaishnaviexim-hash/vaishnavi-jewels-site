/* VJ Tags - Delivery challan (owner Abhinav 02/11/2026 12:49 / 12:53, C-20261102-CHALLAN). Loaded by shim.js for every login.
   A parcel sent to a party (OUTGOING: receiver = party, sender = us) or received from a party (INCOMING: sender = party, receiver = us),
   in the owner's own challan layout (his file 'demo'), with large readable print. Made from a Bill ('Against Bill <no.>', values from the
   bill) or on its own for repair / approval / job work parcels. The server saves every challan under its own running CH NO (never reused);
   only the owners edit or cancel one. Printed with the same hidden-frame printer as the bills (window.vjPrintBlob from bill.js). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const CO = { name: "VAISHNAVI GEMS AND JEWELS PVT LTD", line: "UG-120, Rajhans Ornate, Parle Point, Surat, Gujarat", addr1: "UG-120, Rajhans Ornate, Parle Point", addr2: "Surat - 395007, Gujarat", phone: "9099763201", pan: "AAECV2736M", gst: "24AAECV2736M1Z3" };
  const HSN = "711319";
  const PURPOSES = [["bill", "Against Bill(s)"], ["repair", "For repairing purpose only"], ["approval", "On approval"], ["job", "Job work"], ["return", "Return after repair"]];
  // C-20261102-CHMULTI (owner 02/11 13:53): one challan may carry several bills of one party (billNos); old challans have one billNo
  const billsOf = c => Array.isArray(c && c.billNos) && c.billNos.length ? c.billNos : c && c.billNo ? String(c.billNo).split(/\s*,\s*/).filter(Boolean) : [];
  const purTxt = c => c.purpose === "bill" ? (billsOf(c).length > 1 ? "Against Bills " : "Against Bill ") + billsOf(c).join(", ") : (PURPOSES.find(p => p[0] === c.purpose) || ["", ""])[1];
  const md = b => { const d = String(b && b.mobile || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""); return /^[6-9]\d{9}$/.test(d) ? d : ""; };
  const nk = v => String(v || "").toLowerCase().replace(/\s+ji$/, "").replace(/[^a-z0-9]/g, "");
  const near1 = (a, b) => { if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, e = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++e > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return e + (a.length - i) + (b.length - j) <= 1; }; // one digit off
  const sameParty = list => { const all = list.every(md); return new Set(list.map(b => all ? md(b) : nk(b.name) + "|" + nk(b.city))).size <= 1; }; // same 10-digit mobile, else same name + city
  const inr = n => Math.round(Number(n) || 0).toLocaleString("en-IN");
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const dmy = d => String(d || "").split("-").reverse().join("-");
  const mobTxt = m => !m ? "" : /^\d{10}$/.test(m) ? "+91 " + m.slice(0, 5) + " " + m.slice(5) : String(m);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const num = v => { const n = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
  // Rupees in words, Indian system (crore / lakh / thousand)
  const A = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const T = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  const two = x => x < 20 ? A[x] : T[Math.floor(x / 10)] + (x % 10 ? " " + A[x % 10] : "");
  const three = x => (x >= 100 ? A[Math.floor(x / 100)] + " HUNDRED" + (x % 100 ? " " : "") : "") + (x % 100 ? two(x % 100) : "");
  function words(n) { n = Math.round(Math.abs(Number(n) || 0)); if (!n) return "ZERO"; const out = [];
    const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
    if (cr) out.push((cr > 999 ? words(cr) : three(cr)) + " CRORE"); if (lk) out.push(two(lk) + " LAKH"); if (th) out.push(two(th) + " THOUSAND"); if (n) out.push(three(n));
    return out.join(" "); }
  const US = ["VAISHNAVI GEMS AND JEWELS PVT LTD", CO.addr1, CO.addr2, "Phone: " + CO.phone];
  const partyLines = p => [p.name, p.addr, p.area, [p.city, p.pin].filter(Boolean).join(" - "), p.state, p.mobile ? "Contact: " + mobTxt(p.mobile) : ""].map(x => String(x || "").trim()).filter(Boolean);
  const TERMS = "(1) We reserve the right of recovery before due date at any time. (2) The sale is understood to have been made after due consideration of the quality of goods and prevailing rates. (3) Report shall have to be presented within 24 hours of delivery, where after no complaints of any change in quality or shortage quantity shall be considered. (4) The goods are despatched at buyer's risk. (5) The payment of this bill shall be made by the due date failing which interest @ the rate of 2.5% p.m. shall be charged from the due date. (6) Subject to SURAT Jurisdiction.";

  function pdf(c) {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" }), W = 210, H = 297, M = 14;
    const recv = c.direction === "in" ? US : partyLines(c.party), send = c.direction === "in" ? partyLines(c.party) : US;
    let y = 15; doc.setTextColor(20);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(CO.name, W / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(11.5); y += 6.5; doc.text(CO.line, W / 2, y, { align: "center" }); y += 5.5; doc.text("Phone: " + CO.phone, W / 2, y, { align: "center" });
    y += 6.5; doc.setFontSize(11); doc.text("PAN No.: " + CO.pan, M, y); doc.text("GST No.: " + CO.gst, W - M, y, { align: "right" });
    y += 4; doc.setFont("helvetica", "bold"); { const tt = ("DELIVERY CHALLAN / " + purTxt(c)).toUpperCase(); let fs = 14; doc.setFontSize(fs); while (fs > 10 && doc.getTextWidth(tt) > W - 2 * M - 4) doc.setFontSize(--fs); // several bill numbers still fit the band
      const tl = doc.splitTextToSize(tt, W - 2 * M - 4), bh = 10 + (tl.length - 1) * fs * 0.41; doc.setFillColor(243, 230, 211); doc.rect(M, y, W - 2 * M, bh, "F"); doc.text(tl, W / 2, y + 7, { align: "center" }); y += bh + 6; }
    doc.setFontSize(12.5); doc.setFont("helvetica", "normal"); doc.text("DATE: " + dmy(c.date), M, y); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("CH NO-" + c.no, W - M, y, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(c.direction === "in" ? "Incoming parcel (from the party to us)" : "Outgoing parcel (from us to the party)", M, y + 5.5);
    if (c.cancelled) { doc.setTextColor(161, 43, 43); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("CANCELLED - " + String(c.cancelled.reason || "").slice(0, 60), W / 2, y + 5.5, { align: "center" }); doc.setTextColor(20); }
    y += 10;
    // receiver / sender boxes
    const bw = (W - 2 * M - 6) / 2, block = (x, title, lines) => { doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text(title, x + 3, y + 5.5); let yy = y + 12;
      lines.forEach((l, i) => { doc.setFont("helvetica", i === 0 ? "bold" : "normal"); doc.setFontSize(i === 0 ? 13.5 : 12.5); const s = doc.splitTextToSize(l, bw - 6); doc.text(s, x + 3, yy); yy += s.length * 5.3; }); return yy - y + 2; };
    const measure = lines => 12 + lines.reduce((a, l, i) => { doc.setFontSize(i === 0 ? 13.5 : 12.5); return a + doc.splitTextToSize(l, bw - 6).length * 5.3; }, 0) + 1;
    const bh = Math.max(measure(recv), measure(send), 30);
    doc.setDrawColor(90); doc.setLineWidth(0.4); doc.rect(M, y, bw, bh); doc.rect(M + bw + 6, y, bw, bh);
    block(M, "DETAILS OF RECEIVER", recv); block(M + bw + 6, "DETAILS OF SENDER", send); y += bh + 7;
    // items
    const cols = [["Sr.", 9, "l"], ["Description", 85, "l"], ["HSN", 17, "l"], ["Pcs", 14, "r"], ["Weight (g)", 25, "r"], ["Value (Rs)", 32, "r"]];
    const row = (vals, bold, size) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size || 12); let x = M, h = 1;
      const ls = vals.map((v, i) => doc.splitTextToSize(String(v), cols[i][1] - 2)); ls.forEach(l => { h = Math.max(h, l.length); });
      ls.forEach((l, i) => { const [, w, al] = cols[i]; doc.text(l, al === "r" ? x + w - 1.5 : x + 1.5, y, al === "r" ? { align: "right" } : undefined); x += w; }); y += h * 5 + 2.4; };
    doc.setFillColor(243, 230, 211); doc.rect(M, y - 5.2, W - 2 * M, 8, "F"); row(cols.map(x => x[0]), true, 11); y += 1;
    (c.items || []).forEach((it, i) => { if (y > 230) { doc.addPage(); y = 20; } row([String(i + 1), it.desc, HSN, String(it.pcs), Number(it.wt) ? Number(it.wt).toFixed(3) : "-", inr(it.value)], false, 11.5); doc.setDrawColor(215); doc.line(M, y - 3.4, W - M, y - 3.4); });
    const pcs = (c.items || []).reduce((a, x) => a + (Number(x.pcs) || 0), 0), wt = (c.items || []).reduce((a, x) => a + (Number(x.wt) || 0), 0);
    y += 2; doc.setDrawColor(90); doc.line(M, y - 4, W - M, y - 4); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Total", M + 1.5, y + 1); doc.text(String(pcs), M + 125 - 1.5, y + 1, { align: "right" }); doc.text(wt ? wt.toFixed(3) : "-", M + 150 - 1.5, y + 1, { align: "right" }); doc.text(inr(c.value), W - M - 1.5, y + 1, { align: "right" });
    y += 8; doc.setFontSize(14.5); doc.text("Total Rs " + inr(c.value) + "/-", W - M, y, { align: "right" }); y += 7;
    doc.setFontSize(12); const wl = doc.splitTextToSize("RUPEES " + words(c.value) + " ONLY", W - 2 * M); doc.text(wl, M, y); y += wl.length * 5.6 + 2;
    doc.setFontSize(14); doc.text("INS " + inr(c.ins) + "/-", M, y);
    if (c.purpose === "bill") { doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); const gl = doc.splitTextToSize((billsOf(c).length > 1 ? "Goods go with tax invoices (bills) " : "Goods go with tax invoice (bill) no. ") + billsOf(c).join(", ") + ".", 115); doc.text(gl, W - M, y, { align: "right" }); y += (gl.length - 1) * 4.6; } y += 6;
    if (y > 205) { doc.addPage(); y = 20; }
    y += 2; doc.setDrawColor(150); doc.line(M, y, W - M, y); y += 5; doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("TERMS :", M, y); y += 4.5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); doc.setTextColor(60); const tl = doc.splitTextToSize(TERMS, W - 2 * M); doc.text(tl, M, y); y += tl.length * 3.75 + 1.5; doc.setTextColor(20);
    doc.line(M, y, W - M, y); y += 6; doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text("E. & O. E.", M, y); doc.setFontSize(11); doc.text("For VAISHNAVI GEMS AND JEWELS PVT LTD", W - M, y, { align: "right" });
    y += 12; doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setDrawColor(120);
    [["Received", M], ["Prepared by", M + 64], ["Authorised signature", M + 128]].forEach(([l, x]) => { doc.line(x, y - 5, x + 52, y - 5); doc.text(l, x, y); });
    y += 3;
    // cut-off address label for the parcel
    const lab = (lines, w, f0, f1, l0, l1) => lines.reduce((a, l, i) => { doc.setFontSize(i === 0 ? f0 : f1); return a + doc.splitTextToSize(l, w).length * (i === 0 ? l0 : l1); }, 0);
    const lh = 19 + Math.max(lab(recv, 108, 14, 12.5, 6, 5.4), lab(send, 62, 10.5, 10, 4.8, 4.8)) + 2;
    if (y + 8 + lh > H - 4) { doc.addPage(); y = 20; }
    y = Math.max(y + 3, H - 4 - lh - 6); doc.setLineDashPattern([2, 2], 0); doc.setDrawColor(100); doc.line(M - 6, y, W - M + 6, y); doc.setLineDashPattern([], 0);
    doc.setFontSize(8.5); doc.setTextColor(110); doc.text("cut here and stick on the parcel", W / 2, y - 1.5, { align: "center" }); doc.setTextColor(20); y += 6;
    doc.setLineWidth(0.6); doc.setDrawColor(40); doc.rect(M, y, W - 2 * M, lh); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("INS " + inr(c.ins) + "/-", M + 4, y + 8);
    doc.setFontSize(10.5); doc.text("CH NO-" + c.no + "  ·  " + dmy(c.date), W - M - 4, y + 8, { align: "right" });
    let ly = y + 15; doc.setFontSize(10.5); doc.text("TO (RECEIVER):", M + 4, ly); doc.text("FROM (SENDER):", M + 118, ly); ly += 6.5; let ry = ly;
    recv.forEach((l, i) => { doc.setFont("helvetica", i === 0 ? "bold" : "normal"); doc.setFontSize(i === 0 ? 14 : 12.5); const s = doc.splitTextToSize(l, 108); doc.text(s, M + 4, ry); ry += s.length * (i === 0 ? 6 : 5.4); });
    send.forEach((l, i) => { doc.setFont("helvetica", i === 0 ? "bold" : "normal"); doc.setFontSize(i === 0 ? 10.5 : 10); const s = doc.splitTextToSize(l, 62); doc.text(s, M + 118, ly); ly += s.length * 4.8; });
    doc.setLineWidth(0.2);
    return doc.output("blob");
  }
  function print(c, msg) { const blob = pdf(c);
    if (window.vjPrintBlob) window.vjPrintBlob(blob, msg); else window.open(URL.createObjectURL(blob), "_blank", "noopener"); }

  // ---- dialog (make / edit) ----
  let dlg = null;
  function close() { if (dlg) { dlg.remove(); dlg = null; } }
  function open(init) {
    close(); const c = init || {}, p = c.party || {};
    dlg = el("div"); dlg.style.cssText = "position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px";
    const box = el("div", { className: "card" }); box.style.cssText = "background:var(--card,#fff);color:var(--fg,#222);max-width:760px;width:100%;margin:auto;border-radius:12px;padding:16px;font-size:16px";
    box.innerHTML = `<h2 id="chttl" style="margin-top:0"></h2>
      <div class="seg" role="radiogroup" aria-label="Direction"><label><input type="radio" name="chdir" value="out"> Outgoing - we send to the party</label><label><input type="radio" name="chdir" value="in"> Incoming - the party sends to us</label></div>
      <div class="row" style="margin-top:8px;align-items:end"><label style="flex:2 1 240px">Purpose <select id="chpur"></select></label><label>Date <input id="chdate" type="date"></label></div>
      <p class="hint" style="margin-top:2px">For a sale, the tax invoice (bill) must go with the goods; a challan alone is for repair/approval/job work.</p>
      <div id="chbillw" style="margin:4px 0 8px"><div id="chbills" class="row" style="gap:6px;flex-wrap:wrap;align-items:center"></div><div class="row" style="align-items:end;margin-top:4px"><label style="flex:2 1 260px">+ Add bill (recent bills of every party) <select id="chbpick"><option value="">- pick a bill -</option></select></label><label>search name / bill no. <input id="chbill" autocomplete="off" maxlength="20" placeholder="B-2611-03"></label><div><button type="button" class="btn ghost" id="chbadd">+ Add bill</button></div></div><p class="hint" id="chbmsg"></p></div>
      <h3 style="margin:10px 0 4px">Party</h3>
      <div class="row"><label>Mobile No. <input id="chmob" inputmode="tel" autocomplete="off" maxlength="20" placeholder="98xxxxxxxx"></label><label>Name <input id="chname" autocomplete="off" maxlength="60"></label><label>City <input id="chcity" autocomplete="off" maxlength="40"></label></div>
      <div class="row"><label style="flex:2 1 260px">Address (line) <input id="chaddr" autocomplete="off" maxlength="160" placeholder="house / flat / shop no., building, street"></label><label>Area / Society <input id="charea" autocomplete="off" maxlength="80"></label><label>State <input id="chstate" autocomplete="off" maxlength="40"></label><label>PIN code <input id="chpin" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="395007"></label></div>
      <p class="hint" id="chabmsg" style="font-weight:600;color:#8a5a00;margin:4px 0"></p><h3 style="margin:10px 0 4px">Items (HSN 711319)</h3><div id="chitems"></div><div class="actions" style="margin:4px 0"><button type="button" class="btn ghost" id="chadd">+ Line</button></div>
      <div class="row" style="align-items:end"><div style="flex:1 1 200px;font-size:18px"><b>Total Rs <span id="chtot">0</span>/-</b><div class="hint" id="chwords"></div></div><label>INS (insured value, Rs) <input id="chins" inputmode="numeric" autocomplete="off" maxlength="11"><a href="#" id="chinsreset" hidden style="font-size:14px;margin-top:2px"></a></label></div>
      <p class="hint" id="chmsg2" style="font-weight:600"></p>
      <div class="actions"><button type="button" class="btn" id="chsave"></button><button type="button" class="btn ghost" id="chclose">Close</button></div>`;
    dlg.append(box); document.body.append(dlg);
    $("chttl").textContent = c.no ? "Edit delivery challan CH NO-" + c.no : "Delivery challan";
    const ps = $("chpur"); PURPOSES.forEach(([v, t]) => ps.append(el("option", { value: v, textContent: t })));
    document.querySelectorAll("input[name=chdir]").forEach(r => { r.checked = r.value === (c.direction || "out"); });
    const bills = billsOf(c).slice(), binfo = {}; // bills on this challan; binfo: bill no. -> its party (for the picker)
    ps.value = c.purpose || (bills.length ? "bill" : "repair"); $("chdate").value = c.date || today();
    const bw = () => { $("chbillw").hidden = ps.value !== "bill"; if (ps.value === "bill") pickFill(); }; ps.addEventListener("change", bw);
    [["chmob", "mobile"], ["chname", "name"], ["chcity", "city"], ["chaddr", "addr"], ["charea", "area"], ["chstate", "state"], ["chpin", "pin"]].forEach(([id, k]) => { $(id).value = p[k] || ""; });
    const items = (c.items && c.items.length ? c.items : [{ desc: "DIAMOND JEWELLERY", pcs: 1, wt: "", value: "" }]).map(x => ({ desc: x.desc || "", pcs: String(x.pcs || ""), wt: x.wt ? String(x.wt) : "", value: x.value || x.value === 0 ? String(x.value) : "", bill: x.bill || "" }));
    let insEdited = c.ins != null && c.ins !== c.value; $("chins").value = c.ins != null ? String(c.ins) : "";
    const tot = () => items.reduce((a, x) => a + Math.round(num(x.value)), 0);
    // C-20261102-CHMULTI: INS follows the total until a different INS is typed by hand; then it stays, with 'reset to total'
    const insUi = () => { const r = $("chinsreset"); r.hidden = !insEdited; r.textContent = "reset to total (Rs " + inr(tot()) + ")"; };
    const sum = () => { const t = tot(); $("chtot").textContent = inr(t); $("chwords").textContent = "Rupees " + words(t).toLowerCase() + " only"; if (!insEdited) $("chins").value = String(t); insUi(); };
    const draw = () => { const w = $("chitems"); w.textContent = "";
      items.forEach((x, i) => { const d = el("input", { value: x.desc, maxLength: 80, autocomplete: "off", placeholder: "e.g. DIAMOND JEWELLERY - 2" }), pc = el("input", { value: x.pcs, inputMode: "numeric", autocomplete: "off", placeholder: "1" }), wt = el("input", { value: x.wt, inputMode: "decimal", autocomplete: "off", placeholder: "0.000" }), v = el("input", { value: x.value, inputMode: "numeric", autocomplete: "off", placeholder: "0" });
        d.addEventListener("input", () => { x.desc = d.value; }); pc.addEventListener("input", () => { x.pcs = pc.value; }); wt.addEventListener("input", () => { x.wt = wt.value; }); v.addEventListener("input", () => { x.value = v.value; sum(); });
        const rm = el("button", { type: "button", className: "btn ghost", textContent: "✕", ariaLabel: "Remove line" }); rm.addEventListener("click", () => { if (items.length > 1) { const bn = x.bill; items.splice(i, 1); if (bn && !items.some(y => y.bill === bn)) { bills.splice(bills.indexOf(bn), 1); delete binfo[bn]; pickFill(); } draw(); sum(); } });
        const f = (l, inp, fl) => { const lb = el("label", {}, [l, inp]); if (fl) lb.style.flex = fl; return lb; };
        w.append(el("div", { className: "row", style: "align-items:end" }, [f("Description", d, "3 1 240px"), f("Qty (Pcs)", pc, "0 1 90px"), f("Weight (g)", wt, "0 1 110px"), f("Value (Rs)", v, "0 1 130px"), el("div", {}, [rm])])); }); };
    draw(); sum();
    // + Add bill: this party's live Bills (same 10-digit mobile, else name + city) or a typed number; each bill is its own line
    const chips = () => { const w = $("chbills"); w.textContent = ""; bills.forEach(no => { const b = el("button", { type: "button", className: "btn ghost", textContent: no + " ✕", title: "Take this bill (and its line) off the challan" });
        b.addEventListener("click", () => { bills.splice(bills.indexOf(no), 1); delete binfo[no]; for (let i = items.length - 1; i >= 0; i--) if (items[i].bill === no) items.splice(i, 1); if (!items.length) items.push({ desc: "", pcs: "1", wt: "", value: "", bill: "" }); draw(); sum(); pickFill(); }); w.append(b); });
      if (!bills.length) w.append(el("span", { className: "hint", textContent: "No bill on this challan yet." }));
      { const ps = Object.values(binfo), all = ps.every(md), n = new Set(ps.map(p => all ? md(p) : nk(p.name) + "|" + nk(p.city))).size; if (n > 1) w.append(el("span", { textContent: "Bills of " + n + " parties – check the receiver name/address", style: "color:#8a5a00;font-weight:600;margin-left:6px" })); } };
    let book = null; const party = () => Object.values(binfo)[0] || { name: $("chname").value, mobile: $("chmob").value, city: $("chcity").value };
    async function pickFill() { chips(); const s = $("chbpick");
      try { if (!book) { const r = await fetch("/api/vj/bills?month=all", { credentials: "same-origin", cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); book = (j.bills || []).filter(b => b.title === "Bill" && !b.cancelled); }
        const f = $("chbill").value.trim().toLowerCase(), list = book.filter(b => !bills.includes(b.no) && (!f || String(b.no).toLowerCase().includes(f) || String(b.name || "").toLowerCase().includes(f))).slice(-60); /* recent live bills of every party */ s.textContent = "";
        s.append(el("option", { value: "", textContent: list.length ? "- pick a bill (" + list.length + ") -" : "- no matching bills -" }));
        list.slice().reverse().forEach(b => s.append(el("option", { value: b.no, textContent: b.no + " · " + dmy(b.date) + " · " + b.name + (b.city ? ", " + b.city : "") + " · Rs " + inr(b.total) + " · " + (b.pieces || 0) + " pc" })));
      } catch (e) { $("chbmsg").textContent = "Could not list the bills (" + (e.message || e) + ")."; } }
    function addBillObj(b) { if (bills.includes(b.no)) return; const first = !bills.length; bills.push(b.no); binfo[b.no] = { name: b.name, mobile: b.mobile, city: b.city };
      if (first) [["chmob", "mobile"], ["chname", "name"], ["chcity", "city"], ["chaddr", "addr"], ["charea", "area"], ["chstate", "state"], ["chpin", "pin"]].forEach(([id, k]) => { if (!$(id).value.trim() && b[k]) $(id).value = b[k]; });
      if (items.length === 1 && !items[0].bill && !num(items[0].value)) items.splice(0, 1); items.push(billLine(b)); draw(); sum(); pickFill(); }
    async function addBill(no) { const m = $("chbmsg"); no = String(no || "").trim().toUpperCase();
      if (!/^B-\d{4}-\d{2,4}$/.test(no)) { m.textContent = "Pick a bill or type a number like B-2611-03."; return; } if (bills.includes(no)) { m.textContent = no + " is already on this challan."; return; } if (bills.length >= 10) { m.textContent = "At most 10 bills on one challan."; return; }
      try { const r = await fetch("/api/vj/bill?no=" + encodeURIComponent(no), { credentials: "same-origin" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); const b = j.bill;
        if (b.title !== "Bill" || b.cancelled) throw new Error("not a live bill"); // C-20261102-ADDRBOOK: bills of other parties may share the parcel
        addBillObj(b); m.textContent = no + " added."; $("chbill").value = ""; } catch (e) { m.textContent = "Cannot add " + no + ": " + (e.message || e) + "."; } }
    $("chbadd").addEventListener("click", () => addBill($("chbpick").value || $("chbill").value)); $("chbpick").addEventListener("change", () => { if ($("chbpick").value) addBill($("chbpick").value); });
    $("chbill").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addBill($("chbill").value); } }); { let tq = 0; $("chbill").addEventListener("input", () => { clearTimeout(tq); tq = setTimeout(pickFill, 200); }); }
    // C-20261102-ADDRBOOK: no address yet -> look the party up in the address book (Client_Addresses sheet + saved bills / challans).
    // A match needs the same first name and a mobile that is equal, contained, or one digit off (bills sometimes carry a 9-digit typo).
    async function abFill() { const am = $("chabmsg"); if ($("chaddr").value.trim() || $("chpin").value.trim()) return; const nm = $("chname").value.trim(), dg = $("chmob").value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""), fn = nk(nm.split(/\s+/)[0] || "");
      const qs = [...new Set([dg.length >= 5 ? dg.slice(-5) : "", fn.length >= 2 ? fn : ""].filter(Boolean))]; if (!qs.length) return; const seen = {}, cand = [];
      for (const q of qs) { try { const r = await fetch("/api/vj/addrbook?q=" + encodeURIComponent(q), { credentials: "same-origin", cache: "no-store" }); const j = await r.json(); (j.entries || []).forEach(e => { const k = e.name + "|" + e.mobile + "|" + e.pin; if (!seen[k]) { seen[k] = 1; cand.push(e); } }); } catch (e) {} }
      if ($("chaddr").value.trim() || $("chpin").value.trim()) return;
      const ed = e => String(e.mobile || "").replace(/\D/g, ""), mob = e => dg.length >= 9 && ed(e).length >= 9 && (ed(e).includes(dg) || dg.includes(ed(e)) || near1(dg, ed(e)));
      let hit = cand.filter(e => mob(e) && (!fn || nk(String(e.name).split(/\s+/)[0]) === fn || ed(e) === dg)); if (!hit.length && !dg) hit = cand.filter(e => nk(e.name) === nk(nm));
      if (hit.length === 1) { const e = hit[0]; [["chaddr", "addr"], ["charea", "area"], ["chcity", "city"], ["chstate", "state"], ["chpin", "pin"]].forEach(([id, k]) => { if (e[k] && (k !== "city" || !$(id).value.trim())) $(id).value = e[k]; });
        am.textContent = "Address filled from the address book (" + e.name + ", " + [e.city, e.pin].filter(Boolean).join(" ") + ") - check it before printing.";
        if (ed(e) && ed(e) !== dg) { am.textContent += " Its mobile is " + ed(e) + ", the bill has " + (dg || "none") + "."; const u = el("button", { type: "button", className: "btn ghost", textContent: "Use " + ed(e), style: "margin-left:6px" }); u.addEventListener("click", () => { $("chmob").value = ed(e); u.remove(); }); am.append(u); } }
      else if (hit.length > 1) am.textContent = hit.length + " address-book entries match - type the name or mobile in the Name / Mobile box and pick one.";
      else if (cand.length) am.textContent = "No sure address-book match. Similar: " + cand.slice(0, 3).map(e => e.name + " (" + (e.city || "") + ")").join(", ") + " - type the name in the Name box to pick one if it is the same party."; }
    if (!c.no) abFill();
    (c._bills || []).forEach(addBillObj); bw();
    $("chadd").addEventListener("click", () => { if (items.length < 20) { items.push({ desc: "", pcs: "1", wt: "", value: "" }); draw(); } });
    $("chins").addEventListener("input", () => { const v = $("chins").value.trim(); insEdited = v !== "" && Math.round(num(v)) !== tot(); insUi(); });
    $("chins").addEventListener("blur", () => { if (!$("chins").value.trim()) { insEdited = false; sum(); } }); $("chinsreset").addEventListener("click", e => { e.preventDefault(); insEdited = false; sum(); });
    $("chclose").addEventListener("click", close); dlg.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    const sv = $("chsave"); sv.textContent = c.no ? "Update & print challan" : "Save & print challan";
    sv.addEventListener("click", async () => { const m = $("chmsg2");
      const body = { edit: c.no || 0, direction: (document.querySelector("input[name=chdir]:checked") || {}).value || "", purpose: ps.value, billNos: ps.value === "bill" ? bills.slice() : [], date: $("chdate").value,
        party: { name: $("chname").value.trim(), mobile: $("chmob").value.trim(), addr: $("chaddr").value.trim(), area: $("charea").value.trim(), city: $("chcity").value.trim(), state: $("chstate").value.trim(), pin: $("chpin").value.replace(/\s/g, "") },
        items: items.map(x => ({ desc: x.desc.trim(), pcs: Math.round(num(x.pcs)), wt: Math.round(num(x.wt) * 1000) / 1000, value: Math.round(num(x.value)), bill: x.bill || "" })), ins: $("chins").value.trim() === "" ? "" : Math.round(num($("chins").value)) };
      if (!body.party.name) { m.textContent = "Type the party's name."; return; }
      if (!body.party.addr || !body.party.city || !/^[1-9]\d{5}$/.test(body.party.pin)) { m.textContent = "Fill the party's address, city and 6-digit PIN code - the courier needs them."; return; }
      if (body.items.some(x => !x.desc || !(x.pcs >= 1))) { m.textContent = "Every line needs a description and the number of pieces."; return; }
      if (body.purpose === "bill" && !body.billNos.length) { m.textContent = "Add the bill(s) with '+ Add bill', or choose another purpose."; return; }
      sv.disabled = true; m.textContent = "Saving…";
      try { const r = await fetch("/api/vj/challan", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status));
        const ch = j.challan; m.textContent = `Challan CH NO-${ch.no} ${j.edited ? "updated" : "saved"}. Printing…`; print(ch, m); c.no = ch.no; load();
        sv.textContent = "Print again"; sv.disabled = false; const nsv = sv.cloneNode(true); sv.replaceWith(nsv); nsv.addEventListener("click", () => print(ch, m));
      } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; sv.disabled = false; } });
    setTimeout(() => { const f = $(p.name ? "chaddr" : "chmob"); if (f) f.focus(); }, 80);
  }
  // one line per bill: pieces, net gold weight and the bill total, all editable in the dialog
  function billLine(b) { const rows = b.rows || [], dia = rows.some(r => Number(r.ct) > 0 || (r.dias || []).some(d => Number(d.ct) > 0)), wt = rows.reduce((a, r) => a + (Number(r.wt) || 0), 0);
    return { desc: (dia ? "DIAMOND JEWELLERY" : "GOLD JEWELLERY") + " - " + rows.length + " (Bill " + b.no + ")", pcs: String(rows.length || 1), wt: wt ? String(Math.round(wt * 1000) / 1000) : "", value: String(Math.round(Number(b.total) || 0)), bill: b.no }; }
  // from one or several saved Bills of ONE party (C-20261102-CHMULTI): party from the first bill, address from the first bill that has one
  function fromBills(list) { list = (list || []).filter(Boolean); if (!list.length) return; /* C-20261102-ADDRBOOK (owner 02/11 14:16): bills of different parties may share one parcel; receiver = the first bill's party, editable */
    const b = list[0], a = list.find(x => (x.addr || x.pin) && sameParty([b, x])) || b;
    open({ direction: "out", purpose: "bill", date: today(), party: { name: b.name, mobile: b.mobile, city: b.city || a.city, addr: a.addr, area: a.area, state: a.state, pin: a.pin }, _bills: list });
  }
  function fromBill(b) { fromBills([b]); }

  // ---- saved challans (under Saved bills) ----
  let canEdit = false;
  async function load() {
    const body = $("chbook"), m = $("chmsg"); if (!body) return; const mo = $("chmonth").value || today().slice(0, 7);
    try { const r = await fetch("/api/vj/challans?month=" + encodeURIComponent(mo), { credentials: "same-origin", cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      canEdit = !!j.canEdit; body.textContent = "";
      j.challans.forEach(c => { const tr = el("tr"), td = (x, cl) => { const e = el("td", { textContent: x }); if (cl) e.className = cl; tr.append(e); return e; };
        td(dmy(c.date)); td("CH-" + c.no); td(c.direction === "in" ? "Incoming" : "Outgoing"); const pu = td(purTxt(c)); if (c.cancelled) { pu.append(el("div", { textContent: "CANCELLED: " + (c.cancelled.reason || ""), style: "color:#a12b2b;font-weight:600" })); tr.style.opacity = "0.7"; }
        td((c.party && c.party.name || "") + (c.party && c.party.city ? ", " + c.party.city : "")); td(String((c.items || []).reduce((a, x) => a + (Number(x.pcs) || 0), 0)), "num"); td("Rs " + inr(c.value), "num"); td("Rs " + inr(c.ins), "num"); td(c.byName || String(c.by || "").split("@")[0]);
        const x = el("td"); x.style.whiteSpace = "nowrap";
        const pb = el("button", { type: "button", className: "btn ghost", textContent: "\u{1F5A8} Print" }); pb.addEventListener("click", () => print(c, m)); x.append(pb);
        if (canEdit && !c.cancelled) { const eb = el("button", { type: "button", className: "btn ghost", textContent: "Edit" }); eb.addEventListener("click", () => open(JSON.parse(JSON.stringify(c)))); x.append(eb);
          const cb = el("button", { type: "button", className: "btn ghost", textContent: "Cancel", style: "color:#a12b2b" }); cb.addEventListener("click", async () => { const reason = (window.prompt("Cancel challan CH NO-" + c.no + "? Type the reason:") || "").trim(); if (!reason) return;
            try { const r2 = await fetch("/api/vj/challan/cancel", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ no: c.no, reason }) }); const j2 = await r2.json().catch(() => ({})); if (!r2.ok) throw new Error(j2.error || r2.status); m.textContent = "CH NO-" + c.no + " cancelled (the number is not used again)."; load(); }
            catch (e) { m.textContent = "Could not cancel CH NO-" + c.no + " (" + (e.message || e) + ")."; } }); x.append(cb); }
        tr.append(x); body.append(tr); });
      m.textContent = j.challans.length ? j.challans.length + " challan" + (j.challans.length === 1 ? "" : "s") + " in this month." : "No challans in this month.";
    } catch (e) { m.textContent = "Could not load the challans (" + (e.message || e) + ")."; }
  }
  function build() {
    const sec = $("p-bill"); if (!sec || $("chbook")) return !!sec;
    const w = el("div"); w.innerHTML = `<h2>Delivery challans</h2>
      <p class="hint">Parcels sent to or received from a party (Sequel). For a sold piece use "Delivery challan" on the bill; for repair, approval or job work start here.</p>
      <div class="actions" style="margin:0 0 8px"><button type="button" class="btn" id="chnew">New delivery challan</button></div>
      <div class="row" style="align-items:end"><label style="flex:0 1 200px">Month <input id="chmonth" type="month"></label></div>
      <div class="list"><table class="items" style="min-width:760px"><thead><tr><th>Date</th><th>CH NO</th><th>In / Out</th><th>Purpose</th><th>Party</th><th>Pcs</th><th>Value</th><th>INS</th><th>By</th><th></th></tr></thead><tbody id="chbook"></tbody></table></div>
      <p class="hint" id="chmsg"></p>`;
    sec.append(w); $("chmonth").value = today().slice(0, 7); $("chmonth").addEventListener("change", load);
    $("chnew").addEventListener("click", () => open({ direction: "out", purpose: "repair" }));
    document.querySelectorAll('nav button[data-tab="bill"]').forEach(b => b.addEventListener("click", () => setTimeout(load, 50)));
    if (!sec.hidden) load(); return true;
  }
  window.vjChallan = { fromBill, fromBills, open, print, sameParty };
  let tries = 0; const t = setInterval(() => { if (build() || ++tries > 120) clearInterval(t); }, 500);
})();
