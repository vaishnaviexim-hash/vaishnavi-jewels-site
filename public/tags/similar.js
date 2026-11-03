/* VJ Tags - Find lost tag tab, rebuilt 03/11/2026 (owner 15:29 + 15:32, C-20261103-PHOTOFIND).
   One drop-down "Kya dhoondhna hai?" shows ONE tool at a time:
   - Design photo se (similar pieces): drop a customer's photo, get the 20 closest pieces in seconds. No category, no weight needed.
   - Lost tag (weight se): the page's weight search (category, type, weight, within), two compact rows.
   - Lost tag (photo se): the same photo engine, for finding a piece whose tag is lost.
   Engine: every saved stock photo gets a small "fingerprint" (DINOv2-small image model, run on the device with Transformers.js,
   free, no key). Fingerprints are kept on the server (/api/vj/embeds); a search fingerprints the customer's photo on the phone
   and compares it with all of ours in about a second. The customer's photo is never uploaded or stored. Optional "AI re-check"
   sends the top 27 as 3 contact sheets in ONE call to the existing /api/vj/photosearch (same daily limit). Missing fingerprints
   (new tags) are filled in the background by whoever opens the tool; the server list is the resumable cursor.
   Earlier: C-20261029-SIMILAR / SIMPDF / SIMEST (tick -> PDF / estimate), kept. */
(function () {
  "use strict";
  const g = id => document.getElementById(id);
  const tagsNow = () => (window.VJ_TAGS ? window.VJ_TAGS() : []);
  const num = v => { const x = parseFloat(String(v || "").replace(/,/g, "")); return isFinite(x) ? x : 0; };
  const netOf = t => { const s = (t.gold || []).reduce((a, x) => a + (x.net || 0), 0); return s > 0 ? s : ((t.metal && t.metal.net) || 0); };
  const grossOf = t => netOf(t) + (t.dias || []).reduce((a, d) => a + (d.ct || 0), 0) * 0.2;
  const priceOf = t => { try { const p = window.VJ_PRICE ? window.VJ_PRICE(t) : null; return p && isFinite(p) ? p : 0; } catch (e) { return 0; } };
  const inr = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  const okPid = p => typeof p === "string" && /^[0-9a-f]{32}$/.test(p);
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const canvasB64 = (c, q) => c.toDataURL("image/jpeg", q).split(",")[1];
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* ---------- the photo engine ---------- */
  const TJS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
  const MODEL = "onnx-community/dinov2-small", EMB_M = "dinov2s-cls-v1", DIM = 384;
  const isPhone = (() => { try { return matchMedia("(pointer:coarse)").matches && Math.min(screen.width, screen.height) < 820; } catch (e) { return false; } })();
  let engP = null, engReady = false, loadPct = 0;
  function engine(onPct) {
    if (!engP) engP = (async () => {
      const T = await import(TJS);
      T.env.allowLocalModels = false;
      const seen = {};
      const progress_callback = p => { if (p && p.status === "progress" && p.total) { seen[p.file] = [p.loaded, p.total]; const v = Object.values(seen); loadPct = Math.round(100 * v.reduce((a, x) => a + x[0], 0) / v.reduce((a, x) => a + x[1], 0)); if (engine.onPct) engine.onPct(loadPct); } };
      const proc = await T.AutoProcessor.from_pretrained(MODEL, { progress_callback });
      const model = await T.AutoModel.from_pretrained(MODEL, { dtype: "q8", device: "wasm", progress_callback });
      engReady = true; return { T, proc, model };
    })();
    engine.onPct = onPct || engine.onPct;
    engP.catch(() => { engP = null; });
    return engP;
  }
  // white square with a margin, so the model's centre crop never cuts a wide piece (kada, haar)
  function square(im) {
    const S = 320, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, S, S); const k = 0.86 * S / Math.max(im.width, im.height), w = im.width * k, h = im.height * k;
    x.drawImage(im, (S - w) / 2, (S - h) / 2, w, h); return c;
  }
  async function embed(im) {
    const { T, proc, model } = await engine();
    const out = await model(await proc(T.RawImage.fromCanvas(square(im))));
    let v; if (out.pooler_output) v = out.pooler_output.data; else { const h = out.last_hidden_state; v = h.data.slice(0, h.dims[h.dims.length - 1]); }
    v = Float32Array.from(v).slice(0, DIM); let n = 0; for (const a of v) n += a * a; n = Math.sqrt(n) || 1; for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
  }
  function pack(v) { let mx = 0; for (const a of v) mx = Math.max(mx, Math.abs(a)); mx = mx || 1; const b = new Uint8Array(DIM); for (let i = 0; i < DIM; i++) b[i] = (Math.round(v[i] / mx * 127) + 256) & 255; let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); }
  function unpack(s) { const r = atob(s), v = new Int8Array(DIM); let n = 0; for (let i = 0; i < DIM; i++) { const x = (r.charCodeAt(i) << 24) >> 24; v[i] = x; n += x * x; } return { v, n: Math.sqrt(n) || 1 }; }
  const vecs = new Map(); let vecsP = null;
  function loadVecs() {
    if (!vecsP) vecsP = (async () => {
      let after = "";
      do {
        const r = await fetch("/api/vj/embeds?after=" + after, { credentials: "same-origin" });
        const isJson = (r.headers.get("content-type") || "").indexOf("json") >= 0;
        if (r.redirected || !isJson) throw new Error("signed out - reload the page and sign in again");
        const j = await r.json(); if (!r.ok) throw new Error(j.error || "server " + r.status);
        (j.rows || []).forEach(s => vecs.set(s.slice(0, 32), unpack(s.slice(33))));
        after = j.next || "";
      } while (after);
      return vecs;
    })();
    vecsP.catch(() => { vecsP = null; });
    return vecsP;
  }
  const sim = (q, e) => { let d = 0; for (let i = 0; i < DIM; i++) d += q[i] * e.v[i]; return d / e.n; };

  // background fill of missing fingerprints (new tags, and the one-time backfill). Small batches; stops on any refusal.
  let fill = { on: false, cap: 0, done: 0, stop: false, why: "" };
  function photoSet() { const s = new Set(); tagsNow().forEach(t => { if (okPid(t.photo)) s.add(t.photo); }); return s; }
  function coverage() { const all = photoSet(); let have = 0; all.forEach(p => { if (vecs.has(p)) have++; }); return { have, total: all.size }; }
  async function runFill(all) {
    if (fill.on) { if (all) fill.cap = Infinity; return; }
    fill = { on: true, cap: all || !isPhone ? Infinity : 150, done: 0, stop: false, why: "" }; showFill();
    try {
      await engine(); await loadVecs();
      const todo = [...photoSet()].filter(p => !vecs.has(p));
      for (let i = 0; i < todo.length && fill.done < fill.cap && !fill.stop; i += 8) {
        const rows = [], got = [];
        for (const pid of todo.slice(i, i + 8)) { try { const v = await embed(await loadImg("/_blob/" + pid)); rows.push(pid + ":" + pack(v)); got.push([pid, v]); } catch (e) {} }
        if (rows.length) {
          const r = await fetch("/api/vj/embeds", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ m: EMB_M, rows }) });
          if (!r.ok) { fill.why = r.status === 403 ? "" : "paused (" + r.status + ")"; break; }
          rows.forEach(s => vecs.set(s.slice(0, 32), unpack(s.slice(33))));
        }
        fill.done += 8; showFill();
      }
    } catch (e) { fill.why = "paused (" + (e.message || "error") + ")"; }
    fill.on = false; showFill();
  }
  function showFill() {
    const el = g("pfFill"); if (!el) return; el.textContent = "";
    if (!vecsP) return;
    const c = coverage(); if (!c.total) return;
    const txt = document.createElement("span");
    if (c.have >= c.total) { txt.textContent = `✓ Searching all ${c.total.toLocaleString("en-IN")} photographed pieces.`; el.appendChild(txt); return; }
    txt.textContent = `Searching ${c.have.toLocaleString("en-IN")} of ${c.total.toLocaleString("en-IN")} photographed pieces` + (fill.on ? " · preparing the rest…" : fill.why ? " · " + fill.why : ".");
    el.appendChild(txt);
    if (!fill.on || fill.cap !== Infinity) { const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.style.cssText = "padding:4px 10px;margin-left:8px"; b.textContent = "Prepare all now";
      b.addEventListener("click", () => runFill(true)); el.appendChild(b); }
  }

  /* ---------- UI ---------- */
  let photo = null, photoB64 = "", mode = "design", picked = new Set(), lastRows = [], fromEst = false;
  const MODES = [["design", "Design photo se (similar pieces)"], ["lostw", "Lost tag (weight se)"], ["lostp", "Lost tag (photo se)"]];
  const css = `#p-find>h2,#p-find>p.hint,#fphotoRow,#fphint{display:none!important}
#pfWtRow{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:end}#pfWtRow>label{flex:none!important;min-width:0}#pfWtRow>div{grid-column:1/-1}#pfWtRow .btn{width:100%}
.pf-pickrow{display:grid;grid-template-columns:2fr 1fr;gap:8px}.pf-pickrow .btn{height:100%}
.pf-pick{border:2px dashed var(--line);border-radius:10px;min-height:96px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;cursor:pointer;background:var(--sunk);text-align:center;padding:10px;color:var(--muted)}
.pf-pick img{max-height:84px;max-width:100%;border-radius:6px}.pf-pick b{color:var(--fg);font-size:16px}
.pf-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pf-two label{min-width:0}
.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.pf-card{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface);cursor:pointer;display:flex;flex-direction:column;min-width:0}
.pf-card img{width:100%;aspect-ratio:1/1;object-fit:contain;background:#fff;display:block}
.pf-sim{position:absolute;top:6px;right:6px;background:#b8963e;color:#fff;font-weight:700;border-radius:999px;padding:2px 8px;font-size:13px}
.pf-ck{position:absolute;top:6px;left:6px;width:26px!important;height:26px}
.pf-info{padding:6px 8px 8px;font-size:13px;line-height:1.35;overflow-wrap:anywhere}.pf-info .labelno{font-size:15px}
#pfFill{font-size:13px;color:var(--muted)}#pfMore summary{cursor:pointer;color:var(--muted);font-size:14px}`;

  function statusOf(t) {
    const k = t.kind === "sample" || t.status === "sample" ? "Sample" : t.kind === "order" || t.status === "order" ? "Order" : "Stock";
    const bx = window.VJ_BOX ? window.VJ_BOX(t) : ""; return k + (bx ? " · 📦 " + bx : "");
  }
  function openPiece(t) { const tab = g("t-check"); if (tab) tab.click(); const q = g("cq"); if (q) { q.value = t.label; const go = g("cgo"); if (go) go.click(); q.scrollIntoView({ behavior: "smooth", block: "start" }); } }
  function card(t, r) {
    const c = document.createElement("div"); c.className = "pf-card"; c.setAttribute("role", "button"); c.tabIndex = 0;
    const im = document.createElement("img"); im.alt = t.label; im.loading = "lazy"; im.src = "/_blob/" + t.photo; c.appendChild(im);
    const s = document.createElement("span"); s.className = "pf-sim"; s.textContent = (r.ai != null ? "AI " + Math.round(r.ai) : Math.round(Math.max(0, r.s) * 100)) + "%"; s.title = r.ai != null ? "AI re-check score" : "Similar %"; c.appendChild(s);
    if (mode === "design") { const ck = document.createElement("input"); ck.type = "checkbox"; ck.className = "pf-ck"; ck.dataset.sim = "1"; ck.checked = picked.has(t.id); ck.setAttribute("aria-label", "Select " + t.label);
      ck.addEventListener("click", e => e.stopPropagation()); ck.addEventListener("change", () => { if (ck.checked) picked.add(t.id); else picked.delete(t.id); }); c.appendChild(ck); }
    const info = document.createElement("div"); info.className = "pf-info";
    const l = document.createElement("div"); l.className = "labelno"; l.textContent = (t.designNo ? t.designNo + " · " : "") + t.label; info.appendChild(l);
    const a = document.createElement("div"); a.textContent = (t.catName || t.cat || "") + " · G.Wt. " + grossOf(t).toFixed(3) + " g"; info.appendChild(a);
    const b = document.createElement("div"); b.className = "hint"; b.textContent = statusOf(t); info.appendChild(b);
    if (r.why) { const w = document.createElement("div"); w.className = "hint"; w.textContent = r.why; info.appendChild(w); }
    if (mode === "design") { const p = priceOf(t); if (p) { const d = document.createElement("div"); d.className = "hint"; d.textContent = "today about " + inr(p); info.appendChild(d); } }
    c.appendChild(info);
    const go = () => openPiece(t); c.addEventListener("click", go); c.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    return c;
  }

  async function shrink(file) {
    const u = URL.createObjectURL(file);
    try { const im = await loadImg(u); const k = Math.min(1, 900 / Math.max(im.width, im.height)); const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); return c; }
    finally { URL.revokeObjectURL(u); }
  }
  async function take(f) {
    if (!f) return; const res = g("sres"); res.textContent = "";
    try { const c = await shrink(f); photo = c; photoB64 = canvasB64(c, 0.82); const pv = g("pfPrev"); pv.src = c.toDataURL("image/jpeg", 0.8); pv.hidden = false; g("pfPickTxt").textContent = "Change photo"; run(); }
    catch (e) { photo = null; photoB64 = ""; res.textContent = "Could not read this photo - try a JPG or a screenshot."; }
  }

  function candidates() {
    const cat = g("scat").value, kd = g("skd").value, w1 = num(g("sw1").value), w2 = num(g("sw2").value), p1 = num(g("sp1").value) * 1000, p2 = num(g("sp2").value) * 1000;
    return tagsNow().filter(t => okPid(t.photo) && (!cat || t.cat === cat) && (!kd || t.kind === kd || (kd === "sale" && !t.kind))
      && (!(w1 || w2) || ((w => (!w1 || w >= w1) && (!w2 || w <= w2))(grossOf(t)) || (w => (!w1 || w >= w1) && (!w2 || w <= w2))(netOf(t))))
      && (!(p1 || p2) || ((p => p && (!p1 || p >= p1) && (!p2 || p <= p2))(priceOf(t)))));
  }
  function line(box, txt) { const p = document.createElement("p"); p.className = "hint"; p.style.margin = "0"; p.textContent = txt; box.appendChild(p); return p; }

  async function run() {
    const box = g("sres"), btn = g("sgo"); box.textContent = "";
    if (!photo) { line(box, "Pehle photo daaliye (choose, take or paste)."); return; }
    btn.disabled = true; const head = line(box, "Searching…"), t0 = Date.now();
    try {
      if (!engReady) { head.textContent = "Loading the photo matcher (first time on this device only)…"; engine(p => { head.textContent = `Loading the photo matcher (first time on this device only)… ${p}%`; }); }
      const [q] = await Promise.all([embed(photo), loadVecs()]);
      const pool = candidates();
      const scored = pool.filter(t => vecs.has(t.photo)).map(t => ({ t, s: sim(q, vecs.get(t.photo)) })).sort((a, b) => b.s - a.s);
      const seen = new Set(), best = []; for (const r of scored) { if (seen.has(r.t.photo)) continue; seen.add(r.t.photo); best.push(r); if (best.length >= 20) break; }
      box.textContent = ""; showFill();
      if (!pool.length) { line(box, "Is filter mein koi photo wala piece nahi - Type / Category ko All / Any karke dekhiye."); return; }
      if (!best.length) { line(box, "Photos are still being prepared for search - tap Prepare all now (one time)."); runFill(); return; }
      line(box, `${mode === "design" ? "Closest pieces" : "Closest pieces - check weight and diamonds, tap to open & reprint"} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      render(best);
      runFill(); // quietly prepare any new tags' photos
    } catch (e) { box.textContent = ""; line(box, "Photo search did not work (" + (e.message || "error") + "). Check the internet and try again."); }
    finally { btn.disabled = false; }
  }
  function render(rows) {
    const box = g("sres"); [...box.querySelectorAll(".pf-grid,.pf-bar")].forEach(x => x.remove());
    picked = new Set(); lastRows = rows;
    const grid = document.createElement("div"); grid.className = "pf-grid"; rows.forEach(r => grid.appendChild(card(r.t, r))); box.appendChild(grid);
    toolbar(box);
  }

  // optional AI re-check of the top 27 (3 contact sheets, one call to the existing photo search)
  const TILE = 300;
  async function makeSheet(list) {
    const cols = Math.min(3, list.length), rows = Math.ceil(list.length / 3), c = document.createElement("canvas"); c.width = cols * TILE; c.height = rows * TILE;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); const ids = [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i], cx = (i % 3) * TILE, cy = Math.floor(i / 3) * TILE;
      try { const im = await loadImg("/_blob/" + t.photo), s = Math.min((TILE - 6) / im.width, (TILE - 6) / im.height), w = im.width * s, h = im.height * s;
        x.drawImage(im, cx + 3 + (TILE - 6 - w) / 2, cy + 3 + (TILE - 6 - h) / 2, w, h); ids.push(t.id); } catch (e) { ids.push("none-" + i); }
      x.fillStyle = "#000"; x.fillRect(cx + 3, cy + 3, 46, 46); x.fillStyle = "#fff"; x.font = "bold 34px sans-serif"; x.textBaseline = "middle"; x.textAlign = "center"; x.fillText(String(i + 1), cx + 26, cy + 27);
    }
    return ids.every(v => /^none-/.test(v)) ? null : { b64: canvasB64(c, 0.72), ids };
  }
  async function aiCheck(msg, btn) {
    const top = lastRows.slice(0, 27); if (!top.length || !photoB64) return;
    btn.disabled = true; msg.textContent = "AI is checking the top " + top.length + "… (about 15 s)";
    try {
      const sheets = []; for (let i = 0; i < top.length; i += 9) { const s = await makeSheet(top.slice(i, i + 9).map(r => r.t)); if (s) sheets.push(s); }
      const r = await fetch("/api/vj/photosearch", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ photo: photoB64, type: "image/jpeg", sheets, similar: mode === "design" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 402 ? "Claude API credit is used up - tell Abhinav" : j.error || "server " + r.status);
      const m = new Map((j.matches || []).map(x => [x.id, x]));
      const rows = lastRows.map(x => m.has(x.t.id) ? Object.assign({}, x, { ai: m.get(x.t.id).confidence, why: m.get(x.t.id).why }) : x)
        .sort((a, b) => (b.ai != null) - (a.ai != null) || (b.ai || 0) - (a.ai || 0) || b.s - a.s);
      render(rows); const n = g("pfAiMsg"); if (n) n.textContent = m.size ? "AI re-checked: best first." : "AI found none of these close enough - showing the photo-match order.";
    } catch (e) { msg.textContent = "AI re-check did not work (" + (e.message || "error") + ")."; btn.disabled = false; }
  }

  // tick -> one PDF for the owner, or a ready Estimate (C-20261029-SIMPDF / SIMEST)
  const pickedTags = () => lastRows.map(r => r.t).filter(t => picked.has(t.id));
  async function thumb(pid, px) {
    try { const im = await loadImg("/_blob/" + pid); const k = Math.min(1, px / Math.max(im.width, im.height)); const c = document.createElement("canvas");
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
    if (photoB64) { const im = await loadImg("data:image/jpeg;base64," + photoB64).catch(() => null); if (im) { const s = 45 / Math.max(im.width, im.height), w = im.width * s, h = im.height * s; doc.setFontSize(11); doc.text("Party's design:", M, y + 4); doc.addImage("data:image/jpeg;base64," + photoB64, "JPEG", M + 32, y, w, h); y += h + 8; } }
    for (const t of list) {
      if (y > 250) { doc.addPage(); y = 18; }
      const r = lastRows.find(z => z.t.id === t.id), p = priceOf(t), pic = await thumb(t.photo, 500);
      if (pic) { const s = 40 / Math.max(pic.w, pic.h); doc.addImage(pic.d, "JPEG", M + (40 - pic.w * s) / 2, y + (40 - pic.h * s) / 2, pic.w * s, pic.h * s); }
      const x0 = M + 46; doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text((t.designNo ? t.designNo + "  " : "") + t.label + (window.VJ_BOX && window.VJ_BOX(t) ? "   " + window.VJ_BOX(t) : ""), x0, y + 6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      const lines = [(t.catName || "") + "   G.Wt. " + grossOf(t).toFixed(3) + " g" + (p ? "   Today about Rs " + Math.round(p).toLocaleString("en-IN") : ""),
        (t.dias || []).map(z => `${z.q} ${(z.ct || 0).toFixed(2)} ct (${z.pcs} pcs)`).join(", ") || "No diamonds",
        r ? (r.ai != null ? Math.round(r.ai) : Math.round(Math.max(0, r.s) * 100)) + "% similar" + (r.why ? " - " + r.why : "") : ""].filter(Boolean);
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
    if (fromEst && bf && !bf.hidden) {
      document.querySelectorAll('[id^="p-"]').forEach(p => { p.hidden = p.id !== "p-bill"; }); document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", "false"));
      list.forEach(t => window.VJ_BILL_ADD(t.id)); fromEst = false; const q = g("bq"); if (q) q.scrollIntoView({ behavior: "smooth", block: "start" }); return;
    }
    window.VJ_EST_NEW(); list.forEach(t => window.VJ_BILL_ADD(t.id));
  }
  function toolbar(box) {
    const bar = document.createElement("div"); bar.className = "pf-bar"; bar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:sticky;bottom:0;background:var(--surface);padding:8px 0";
    const msg = document.createElement("span"); msg.className = "hint"; msg.id = "pfAiMsg";
    const ai = document.createElement("button"); ai.type = "button"; ai.className = "btn ghost"; ai.textContent = "✨ AI re-check top " + Math.min(27, lastRows.length);
    ai.addEventListener("click", () => aiCheck(msg, ai)); bar.appendChild(ai);
    if (mode === "design") {
      const pdf = document.createElement("button"); pdf.type = "button"; pdf.className = "btn ghost"; pdf.textContent = "PDF (ticked)";
      const est = document.createElement("button"); est.type = "button"; est.className = "btn ghost"; est.textContent = fromEst && g("bform") && !g("bform").hidden ? "Add ticked to open estimate" : "Estimate (ticked)";
      pdf.addEventListener("click", async () => { pdf.disabled = true; try { await makePdf(msg); } catch (e) { msg.textContent = "Could not make the PDF (" + (e.message || e) + ")."; } pdf.disabled = false; });
      est.addEventListener("click", () => makeEstimate(msg)); bar.append(pdf, est);
    }
    bar.appendChild(msg); box.appendChild(bar);
  }

  function setMode(m) {
    if (!MODES.some(x => x[0] === m)) m = "design"; mode = m; ls.set("vjFindMode", m);
    const sel = g("pfMode"); if (sel && sel.value !== m) sel.value = m;
    const photoMode = m !== "lostw";
    g("simCard").hidden = !photoMode; const wr = g("pfWtRow"); if (wr) wr.hidden = photoMode; const fr = g("fres"); if (fr) fr.hidden = photoMode;
    g("sgo").textContent = m === "design" ? "Find similar" : "Find piece";
    if (photo && photoMode && lastRows.length) render(lastRows);
    if (photoMode && engReady) { loadVecs().then(showFill).catch(() => {}); }
  }
  window.VJ_FIND_PHOTO = () => { const t = g("t-find"); if (t) t.click(); setMode("design"); setTimeout(() => { const s = g("pfTop"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100); };

  function build() {
    const sec = g("p-find"), fcat = g("fcat");
    if (!sec || !fcat || !window.VJ_TAGS || !fcat.options.length) return setTimeout(build, 400);
    if (g("simCard")) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const wrow = g("fwt") && g("fwt").closest(".row"); if (wrow) wrow.id = "pfWtRow";
    const top = document.createElement("label"); top.id = "pfTop"; top.style.fontWeight = "600"; top.textContent = "Kya dhoondhna hai? ";
    const sel = document.createElement("select"); sel.id = "pfMode"; MODES.forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }); top.appendChild(sel);
    const d = document.createElement("div"); d.id = "simCard"; d.style.cssText = "display:flex;flex-direction:column;gap:10px";
    d.innerHTML = `<div class="pf-pickrow"><label class="pf-pick" id="pfPick"><img id="pfPrev" alt="Chosen photo" hidden><b id="pfPickTxt">🖼️ Choose / paste photo</b><span>gallery · screenshot · WhatsApp</span><input type="file" id="sphoto" accept="image/*" hidden></label>
      <button type="button" class="btn ghost" id="scam">📸 Take photo</button><input type="file" id="scamIn" accept="image/*" capture="environment" hidden></div>
      <div class="pf-two"><label>Type <select id="skd"><option value="">All</option><option value="sale">Stock</option><option value="sample">Sample</option><option value="order">Order</option></select></label>
        <label>Category <select id="scat"></select></label></div>
      <details id="pfMore"><summary>More filters ▾</summary><div class="pf-two" style="margin-top:8px">
        <label>Wt from (g) <input id="sw1" inputmode="decimal" placeholder="any"></label><label>Wt to (g) <input id="sw2" inputmode="decimal" placeholder="any"></label>
        <label>Price from (Rs 000) <input id="sp1" inputmode="decimal" placeholder="any"></label><label>Price to (Rs 000) <input id="sp2" inputmode="decimal" placeholder="any"></label></div></details>
      <button type="button" class="btn" id="sgo">Find similar</button>
      <div id="pfFill"></div>
      <div id="sres" style="display:flex;flex-direction:column;gap:10px"></div>`;
    sec.prepend(top, d);
    const sc = g("scat"); [...fcat.options].forEach(o => sc.appendChild(o.cloneNode(true))); sc.value = "";
    if (!window.VJ_PRICE) ["sp1", "sp2"].forEach(i => { const x = g(i); if (x) x.closest("label").hidden = true; });
    g("sphoto").addEventListener("change", () => { take(g("sphoto").files && g("sphoto").files[0]); g("sphoto").value = ""; });
    g("scam").addEventListener("click", () => g("scamIn").click());
    g("scamIn").addEventListener("change", () => { take(g("scamIn").files && g("scamIn").files[0]); g("scamIn").value = ""; });
    document.addEventListener("paste", e => { if (sec.hidden || mode === "lostw") return; const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(x => /^image\//.test(x.type)); if (it) { e.preventDefault(); take(it.getAsFile()); } });
    g("sgo").addEventListener("click", run);
    ["skd", "scat"].forEach(i => g(i).addEventListener("change", () => { if (photo) run(); }));
    sel.addEventListener("change", () => setMode(sel.value));
    setMode(ls.get("vjFindMode") || "design");
    estButton(0); listButton(0);
  }
  // C-20261029-SIMEST: the same search from the Bill / Estimate screen, next to '+ Add line'
  function estButton(n) {
    const nd = g("bnewdes"); if (g("bsimgo")) return;
    if (!nd) { if (n < 60) setTimeout(() => estButton(n + 1), 500); return; }
    const w = document.createElement("div"), b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.id = "bsimgo"; b.textContent = "🔍 Similar designs (party photo)";
    b.addEventListener("click", () => { fromEst = true; window.VJ_FIND_PHOTO(); });
    w.appendChild(b); nd.parentNode.insertAdjacentElement("afterend", w);
  }
  // C-20261103-PHOTOFIND: a button on the main Tagged pieces screen
  function listButton(n) {
    const pl = g("p-list"); if (g("plFindPhoto")) return;
    if (!pl) { if (n < 60) setTimeout(() => listButton(n + 1), 500); return; }
    const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.id = "plFindPhoto"; b.textContent = "🔍 Find by design photo"; b.style.alignSelf = "flex-start";
    b.addEventListener("click", () => window.VJ_FIND_PHOTO()); pl.prepend(b);
  }
  build();
})();

/* OLD, switched off 03/11/2026 (C-20261103-PHOTOFIND) - VJ Tags - "Similar designs from stock" (owner 29/10/2026 11:38, C-20261029-SIMILAR), inside the Find lost tag tab.
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
  void build; // 03/11 C-20261103-PHOTOFIND: this 29/10 version is switched off - the new tool is at the top of this file
})();
