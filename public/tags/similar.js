/* VJ Tags - "Similar designs from stock" (owner 29/10/2026 11:38, C-20261029-SIMILAR), inside the Find lost tag tab.
   Staff drop a party's design (photo / screenshot); the phone draws contact sheets of our photographed stock pieces
   (9 numbered tiles each) and the server asks Claude, with a fixed prompt, which of our pieces look most SIMILAR
   (same type first, then style, stones, metal colour, size). Results: up to 10 pieces with code, weight and today's price.
   Optional filters: category, stock / sample, gross weight range, price range. The party's photo is never saved. */
(function () {
  "use strict";
  const g = id => document.getElementById(id);
  const tagsNow = () => (window.VJ_TAGS ? window.VJ_TAGS() : []);
  const num = v => { const x = parseFloat(String(v || "").replace(/,/g, "")); return isFinite(x) ? x : 0; };
  const wtOf = t => { const s = (t.gold || []).reduce((a, x) => a + (x.net || 0), 0); return s > 0 ? s : ((t.metal && t.metal.net) || 0); };
  const priceOf = t => { try { const p = window.VJ_PRICE ? window.VJ_PRICE(t) : null; return p && isFinite(p) ? p : 0; } catch (e) { return 0; } };
  const inr = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  const MAX_POOL = 270, PER_CALL = 3, PER_SHEET = 9, TILE = 300, PARALLEL = 2;
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const canvasB64 = (c, q) => c.toDataURL("image/jpeg", q).split(",")[1];
  let partyPhoto = null; // base64 jpeg, max 900 px

  async function shrink(file) {
    const u = URL.createObjectURL(file);
    try { const im = await loadImg(u); const k = Math.min(1, 900 / Math.max(im.width, im.height)); const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return canvasB64(c, 0.82); }
    finally { URL.revokeObjectURL(u); }
  }
  async function makeSheet(list) {
    const cols = Math.min(3, list.length), rows = Math.ceil(list.length / 3);
    const c = document.createElement("canvas"); c.width = cols * TILE; c.height = rows * TILE;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    const ids = [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i], cx = (i % 3) * TILE, cy = Math.floor(i / 3) * TILE;
      try { const im = await loadImg("/_blob/" + t.photo); const s = Math.min((TILE - 6) / im.width, (TILE - 6) / im.height), w = im.width * s, h = im.height * s;
        x.save(); x.beginPath(); x.rect(cx + 3, cy + 3, TILE - 6, TILE - 6); x.clip(); x.drawImage(im, cx + 3 + (TILE - 6 - w) / 2, cy + 3 + (TILE - 6 - h) / 2, w, h); x.restore(); ids.push(t.id);
      } catch (e) { ids.push("none-" + i); }
      x.fillStyle = "#000"; x.fillRect(cx + 3, cy + 3, 46, 46); x.fillStyle = "#fff"; x.font = "bold 34px sans-serif"; x.textBaseline = "middle"; x.textAlign = "center"; x.fillText(String(i + 1), cx + 26, cy + 27);
    }
    if (ids.every(v => /^none-/.test(v))) return null;
    return { b64: canvasB64(c, 0.72), ids };
  }
  async function ask(photo, sheets) {
    const body = JSON.stringify({ photo, type: "image/jpeg", sheets, similar: true });
    let last;
    for (let a = 0; a < 4; a++) {
      if (a) await new Promise(z => setTimeout(z, 2000 * a));
      let r; try { r = await fetch("/api/vj/photosearch", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body }); }
      catch (e) { last = Object.assign(new Error("connection dropped"), { status: 0 }); continue; }
      const isJson = (r.headers.get("content-type") || "").indexOf("json") >= 0;
      if (r.status >= 500) { const j = isJson ? await r.json().catch(() => ({})) : {}; last = Object.assign(new Error(j.error || "server busy (" + r.status + ")"), { status: r.status }); continue; }
      if (r.redirected || !isJson) throw Object.assign(new Error("signed out - reload the page and sign in again"), { status: 401 });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return (j.matches || []).filter(m => !/^none-/.test(m.id));
      last = Object.assign(new Error(j.error || ("server " + r.status)), { status: r.status });
      if (!(r.status === 429 && /busy/.test(j.error || ""))) break;
    }
    throw last;
  }
  async function pool(jobs, onDone) { const out = []; let i = 0; const w = async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); onDone(); } }; await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, w)); return out; }

  // C-20261029-SIMPDF (owner 29/10 12:06): tick pieces -> one PDF for the owner, or a ready Estimate for the customer
  let picked = new Set(), lastRows = [];
  let fromEst = false; // C-20261029-SIMEST: search opened from an open Bill / Estimate -> ticked pieces go into that same one
  const pickedTags = () => { const all = tagsNow(); return lastRows.map(r => all.find(x => x.id === r.m.id)).filter(t => t && picked.has(t.id)); };
  async function thumb(photo, px) {
    try { const im = await loadImg("/_blob/" + photo); const k = Math.min(1, px / Math.max(im.width, im.height)); const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      return { d: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height }; } catch (e) { return null; }
  }
  async function makePdf(msg) {
    const list = pickedTags(); if (!list.length) { msg.textContent = "Tick at least one piece first."; return; }
    if (!window.jspdf) { msg.textContent = "PDF maker did not load - reload the page and try again."; return; }
    msg.textContent = "Making the PDF...";
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" }), M = 14, W = 210 - 2 * M; let y = 18;
    const d = new Date(), dd = String(d.getDate()).padStart(2, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + d.getFullYear();
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Similar designs from our stock", M, y); doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text(dd, 210 - M, y, { align: "right" }); y += 8;
    if (partyPhoto) { const im = await loadImg("data:image/jpeg;base64," + partyPhoto).catch(() => null); if (im) { const s = 45 / Math.max(im.width, im.height), w = im.width * s, h = im.height * s; doc.setFontSize(11); doc.text("Party's design:", M, y + 4); doc.addImage("data:image/jpeg;base64," + partyPhoto, "JPEG", M + 32, y, w, h); y += h + 8; } }
    for (const t of list) {
      if (y > 250) { doc.addPage(); y = 18; }
      const r = lastRows.find(z => z.m.id === t.id), p = priceOf(t), pic = t.photo ? await thumb(t.photo, 500) : null;
      if (pic) { const s = 40 / Math.max(pic.w, pic.h); doc.addImage(pic.d, "JPEG", M + (40 - pic.w * s) / 2, y + (40 - pic.h * s) / 2, pic.w * s, pic.h * s); }
      const x0 = M + 46; doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text((t.designNo ? t.designNo + "  " : "") + t.label + (window.VJ_BOX && window.VJ_BOX(t) ? "   " + window.VJ_BOX(t) : ""), x0, y + 6); /* C-20261029-BOXNO */
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      const lines = [(t.catName || "") + "   G.Wt. " + wtOf(t).toFixed(3) + " g" + (p ? "   Today about Rs " + Math.round(p).toLocaleString("en-IN") : ""),
        (t.dias || []).map(z => `${z.q} ${(z.ct || 0).toFixed(2)} ct (${z.pcs} pcs)`).join(", ") || "No diamonds",
        r ? Math.round(r.m.confidence) + "% similar" + (r.m.why ? " - " + r.m.why : "") : ""].filter(Boolean);
      let yy = y + 13; lines.forEach(L => { doc.splitTextToSize(L, W - 46).forEach(s => { doc.text(s, x0, yy); yy += 5.5; }); });
      y = Math.max(y + 44, yy + 2); doc.setDrawColor(220); doc.line(M, y - 2, 210 - M, y - 2); y += 3;
    }
    doc.setFontSize(9); doc.setTextColor(120); doc.text("Prices are approximate at today's gold rate.", M, 290);
    doc.save("Similar designs " + dd + ".pdf"); msg.textContent = "PDF downloaded (" + list.length + " piece" + (list.length === 1 ? "" : "s") + ").";
  }
  function makeEstimate(msg) {
    const list = pickedTags(); if (!list.length) { msg.textContent = "Tick at least one piece first."; return; }
    if (!window.VJ_EST_NEW || !window.VJ_BILL_ADD) { msg.textContent = "Estimate screen is not ready - reload the page and try again."; return; }
    const bf = g("bform");
    if (fromEst && bf && !bf.hidden) { // back to the estimate / bill that was open, keep everything already on it
      document.querySelectorAll('[id^="p-"]').forEach(p => { p.hidden = p.id !== "p-bill"; }); document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", "false"));
      list.forEach(t => window.VJ_BILL_ADD(t.id)); fromEst = false; const h = g("sesthint"); if (h) h.hidden = true;
      const q = g("bq"); if (q) q.scrollIntoView({ behavior: "smooth", block: "start" }); return;
    }
    window.VJ_EST_NEW(); list.forEach(t => window.VJ_BILL_ADD(t.id));
  }
  function toolbar(box) {
    const bar = document.createElement("div"); bar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:sticky;bottom:0;background:var(--bg,#fff);padding:8px 0";
    const all = document.createElement("button"); all.type = "button"; all.className = "btn ghost"; all.textContent = "Select all";
    const pdf = document.createElement("button"); pdf.type = "button"; pdf.className = "btn"; pdf.textContent = "Download PDF (ticked)";
    const est = document.createElement("button"); est.type = "button"; est.className = "btn"; est.textContent = fromEst && g("bform") && !g("bform").hidden ? "Add ticked to the open estimate / bill" : "Make estimate for customer (ticked)";
    const msg = document.createElement("span"); msg.className = "hint";
    all.addEventListener("click", () => { const on = picked.size < lastRows.length; picked = new Set(on ? lastRows.map(r => r.m.id) : []); box.querySelectorAll("input[data-sim]").forEach(c => { c.checked = on; }); all.textContent = on ? "Clear all" : "Select all"; });
    pdf.addEventListener("click", async () => { pdf.disabled = true; try { await makePdf(msg); } catch (e) { msg.textContent = "Could not make the PDF (" + (e.message || e) + ")."; } pdf.disabled = false; });
    est.addEventListener("click", () => makeEstimate(msg));
    bar.append(all, pdf, est, msg); box.appendChild(bar);
  }

  function card(t, m) {
    const c = document.createElement("div"); c.style.cssText = "display:flex;gap:12px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:var(--r);padding:10px";
    const ck = document.createElement("input"); ck.type = "checkbox"; ck.dataset.sim = "1"; ck.style.cssText = "width:24px;height:24px"; ck.checked = picked.has(t.id); ck.setAttribute("aria-label", "Select " + t.label);
    ck.addEventListener("change", () => { if (ck.checked) picked.add(t.id); else picked.delete(t.id); }); c.appendChild(ck);
    if (t.photo) { const im = document.createElement("img"); im.alt = ""; im.loading = "lazy"; im.src = "/_blob/" + t.photo; im.style.cssText = "width:110px;height:110px;object-fit:cover;border-radius:6px"; c.appendChild(im); }
    const info = document.createElement("div"); info.style.cssText = "flex:1 1 220px;min-width:0";
    const l = document.createElement("div"); l.className = "labelno"; l.textContent = (t.designNo ? t.designNo + " · " : "") + t.label; info.appendChild(l);
    const bx = window.VJ_BOX ? window.VJ_BOX(t) : ""; if (bx) { const b = document.createElement("div"); b.style.cssText = "font-weight:700;color:#8a5a00"; b.textContent = "📦 " + bx; info.appendChild(b); } /* C-20261029-BOXNO */
    const s = document.createElement("div"); s.style.fontWeight = "600"; s.textContent = Math.round(m.confidence) + "% similar" + (m.why ? " · " + m.why : ""); info.appendChild(s);
    const p = priceOf(t), w = document.createElement("div"); w.textContent = (t.catName || "") + " · G.Wt. " + wtOf(t).toFixed(3) + " g" + (p ? " · today about " + inr(p) : ""); info.appendChild(w);
    const di = document.createElement("div"); di.className = "hint"; di.textContent = (t.dias || []).map(z => `${z.q} ${(z.ct || 0).toFixed(2)} ct (${z.pcs} pcs)`).join(", ") || "no diamonds"; info.appendChild(di);
    c.appendChild(info);
    const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = "Open on Bill";
    b.addEventListener("click", () => { const tab = g("t-check"); if (tab) tab.click(); const q = g("cq"); if (q) { q.value = t.label; const go = g("cgo"); if (go) go.click(); q.scrollIntoView({ behavior: "smooth", block: "start" }); } });
    c.appendChild(b); return c;
  }

  async function run() {
    const box = g("sres"), btn = g("sgo"); box.textContent = "";
    const head = document.createElement("p"); head.className = "hint"; box.appendChild(head);
    if (!partyPhoto) { head.textContent = "Choose or take the party's design photo first."; return; }
    const cat = g("scat").value, kd = g("skd").value, w1 = num(g("sw1").value), w2 = num(g("sw2").value), p1 = num(g("sp1").value) * 1000, p2 = num(g("sp2").value) * 1000;
    let c = tagsNow().filter(t => t.photo && /^[0-9a-f]{32}$/.test(t.photo) && t.kind !== "order" && (!cat || t.cat === cat) && (!kd || t.kind === kd));
    if (w1 || w2) c = c.filter(t => { const w = wtOf(t); return (!w1 || w >= w1) && (!w2 || w <= w2); });
    if (p1 || p2) c = c.filter(t => { const p = priceOf(t); return p && (!p1 || p >= p1) && (!p2 || p <= p2); });
    if (!c.length) { head.textContent = "No photographed piece fits these filters. Widen the weight / price range or choose Any category."; return; }
    if (c.length > MAX_POOL) { head.textContent = `${c.length} photographed pieces fit. Please choose the category (or a weight / price range) so the search checks every one of them (up to ${MAX_POOL} at a time).`; return; }
    btn.disabled = true;
    const bar = document.createElement("div"); bar.style.cssText = "height:12px;border-radius:6px;background:var(--line,#e5e0d6);overflow:hidden;margin:8px 0"; const fill = document.createElement("div"); fill.style.cssText = "height:100%;width:2%;background:#b8963e;transition:width .4s"; bar.appendChild(fill); box.appendChild(bar);
    const set = (p, txt) => { fill.style.width = p + "%"; head.textContent = txt; };
    try {
      const groups = []; for (let i = 0; i < c.length; i += PER_SHEET) groups.push(c.slice(i, i + PER_SHEET));
      const sheets = []; for (let i = 0; i < groups.length; i++) { const sh = await makeSheet(groups[i]); if (sh) sheets.push(sh); set(2 + 38 * (i + 1) / groups.length, `Loading our photos ${Math.min(c.length, (i + 1) * PER_SHEET)} of ${c.length}...`); }
      const calls = []; for (let i = 0; i < sheets.length; i += PER_CALL) calls.push(sheets.slice(i, i + PER_CALL));
      let done = 0; set(40, `Comparing with ${c.length} pieces (0 of ${calls.length} batches)... please keep this page open.`);
      const found = (await pool(calls.map(cs => () => ask(partyPhoto, cs)), () => { done++; set(40 + 58 * done / calls.length, `Comparing with ${c.length} pieces (${done} of ${calls.length} batches)...`); })).flat();
      const best = [...new Map(found.sort((a, b) => b.confidence - a.confidence).map(m => [m.id, m])).values()].slice(0, 10);
      bar.remove();
      head.textContent = best.length ? `Most similar pieces in our stock, out of ${c.length} checked:` : `No piece among the ${c.length} checked looks similar enough. Try Any category, a wider range, or a clearer photo of the design.`;
      const all = tagsNow(); picked = new Set(); lastRows = [];
      best.forEach(m => { const t = all.find(x => x.id === m.id); if (t) { lastRows.push({ m }); box.appendChild(card(t, m)); } });
      if (lastRows.length) toolbar(box);
    } catch (e) {
      bar.remove();
      head.textContent = e.status === 429 ? (e.message || "Too many searches just now - wait a minute and try again.") : e.status === 402 ? "The Claude API credit is used up - tell Abhinav." : "Similar search did not work this time (" + (e.message || "error") + "). Check the internet and try again.";
    }
    btn.disabled = false;
  }

  function build() {
    const sec = g("p-find"), fcat = g("fcat");
    if (!sec || !fcat || !window.VJ_TAGS || !fcat.options.length) return setTimeout(build, 400);
    if (g("simCard")) return;
    const d = document.createElement("div"); d.id = "simCard"; d.style.cssText = "border:2px solid #b8963e;border-radius:var(--r,10px);padding:12px;margin:0 0 18px";
    d.innerHTML = `<h2 style="margin-top:0">Similar designs from our stock</h2>
      <p class="hint">Put the party's design (photo or screenshot). We show the most similar pieces we already have, with code, weight and today's price. Ranges are optional.</p>
      <div class="row" style="align-items:end">
        <label style="flex:2 1 220px">Party's design <input type="file" id="sphoto" accept="image/*"></label>
        <div><button type="button" class="btn ghost" id="scam">Take photo</button><input type="file" id="scamIn" accept="image/*" capture="environment" hidden></div></div>
      <div class="row" style="align-items:end">
        <label style="flex:1 1 150px">Category <select id="scat"></select></label>
        <label style="flex:1 1 110px">Type <select id="skd"><option value="">Any</option><option value="sale">Stock</option><option value="sample">Sample</option></select></label>
        <label style="flex:1 1 90px">Weight from (g) <input id="sw1" inputmode="decimal" placeholder="any"></label>
        <label style="flex:1 1 90px">to (g) <input id="sw2" inputmode="decimal" placeholder="any"></label>
        <label style="flex:1 1 110px">Price from (Rs thousand) <input id="sp1" inputmode="decimal" placeholder="e.g. 150"></label>
        <label style="flex:1 1 90px">to (Rs thousand) <input id="sp2" inputmode="decimal" placeholder="e.g. 250"></label>
        <div><button type="button" class="btn" id="sgo">Find similar</button></div></div>
      <p class="hint" id="sesthint" hidden style="color:#8a5a00;font-weight:600">Opened from your estimate / bill - ticked pieces will be added to that same one.</p>
      <div id="sres" style="display:flex;flex-direction:column;gap:10px;margin-top:12px"></div>`;
    const h = sec.querySelector("h2"); if (h) sec.insertBefore(d, h); else sec.prepend(d);
    const sc = g("scat"); [...fcat.options].forEach(o => sc.appendChild(o.cloneNode(true))); sc.value = "";
    if (!window.VJ_PRICE) { ["sp1", "sp2"].forEach(i => { const x = g(i); if (x) x.closest("label").hidden = true; }); }
    const take = async f => { const box = g("sres"); if (!f) return; box.textContent = "Reading the photo..."; try { partyPhoto = await shrink(f); box.textContent = "Photo ready - choose filters if you like, then tap Find similar."; } catch (e) { partyPhoto = null; box.textContent = "Could not read this photo."; } };
    g("sphoto").addEventListener("change", () => take(g("sphoto").files && g("sphoto").files[0]));
    g("scam").addEventListener("click", () => g("scamIn").click());
    g("scamIn").addEventListener("change", () => { take(g("scamIn").files && g("scamIn").files[0]); g("scamIn").value = ""; });
    d.addEventListener("paste", e => { const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(x => /^image\//.test(x.type)); if (it) { e.preventDefault(); take(it.getAsFile()); } });
    g("sgo").addEventListener("click", run);
    estButton(0);
  }
  // C-20261029-SIMEST (owner 29/10 12:30): the same search from the Bill / Estimate screen, next to '+ Add line'
  function estButton(n) {
    const nd = g("bnewdes"); if (g("bsimgo")) return;
    if (!nd) { if (n < 60) setTimeout(() => estButton(n + 1), 500); return; }
    const w = document.createElement("div"), b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.id = "bsimgo"; b.textContent = "🔍 Similar designs (party photo)";
    b.addEventListener("click", () => { fromEst = true; const t = g("t-find"); if (t) t.click(); const h = g("sesthint"); if (h) h.hidden = false;
      setTimeout(() => { const s = g("simCard"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150); });
    w.appendChild(b); nd.parentNode.insertAdjacentElement("afterend", w);
  }
  build();
})();
