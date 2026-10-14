/* VJ Tags - "Search by photo" on Find lost tag, rebuilt 14/10/2026 (owner: results were wrong because only the first 36
   photographed pieces were compared when no weight was typed). Loaded by shim.js for owner/staff on vaishnavijewels.com/tags.
   Now: every photographed piece that fits the category / type / weight is checked. The phone draws contact sheets
   (9 numbered tiles per image, ids sent alongside), the server asks Claude with a fixed prompt (/api/vj/photosearch,
   sheets mode), then the best few are checked again one by one. Each result has Reprint tag (from the page's lostCard). */
(function () {
  "use strict";
  const g = id => document.getElementById(id);
  const MAX_POOL = 216;          // 3 calls x 72 pieces; more than that -> ask for a category or the weight first
  const PER_CALL = 3, PER_SHEET = 9, TILE = 300, PARALLEL = 2;   // 14/10: 3 sheets (~0.5 MB) per request - 8 was too big ("Load failed")
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const b64of = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const canvasB64 = (c, q) => c.toDataURL("image/jpeg", q).split(",")[1];
  // 14/10/2026 owner: a progress bar + seconds counter so the search never looks stuck. While Claude is thinking the bar
  // creeps slowly towards the end of the current stage, and jumps when each answer arrives.
  function progress(box) {
    const wrap = document.createElement("div"); wrap.style.cssText = "margin:10px 0 4px";
    const bar = document.createElement("div"); bar.style.cssText = "height:12px;border-radius:6px;background:var(--line,#e5e0d6);overflow:hidden";
    const fill = document.createElement("div"); fill.style.cssText = "height:100%;width:0;background:#b8963e;border-radius:6px;transition:width .4s ease";
    const txt = document.createElement("div"); txt.className = "hint"; txt.style.marginTop = "6px";
    bar.appendChild(fill); wrap.append(bar, txt); box.appendChild(wrap);
    const t0 = Date.now(); let pct = 0, cap = 0, label = "";
    const draw = () => { fill.style.width = pct.toFixed(1) + "%"; txt.textContent = `${label} · ${Math.round(pct)}% · ${Math.round((Date.now() - t0) / 1000)} s`; };
    const tick = setInterval(() => { if (pct < cap) pct = Math.min(cap, pct + Math.max(0.15, (cap - pct) * 0.04)); draw(); }, 400);
    return {
      set(p, text, creepTo) { pct = Math.max(pct, p); cap = Math.max(pct, creepTo || p); if (text) label = text; draw(); },
      done() { clearInterval(tick); wrap.remove(); }
    };
  }

  async function makeSheet(list) {
    const cols = Math.min(3, list.length), rows = Math.ceil(list.length / 3);
    const c = document.createElement("canvas"); c.width = cols * TILE; c.height = rows * TILE;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    const ok = [];
    for (let i = 0; i < list.length; i++) {
      const t = list[i], cx = (i % 3) * TILE, cy = Math.floor(i / 3) * TILE;
      try {
        const im = await loadImg("/_blob/" + t.photo);
        const s = Math.min((TILE - 6) / im.width, (TILE - 6) / im.height), w = im.width * s, h = im.height * s;
        x.save(); x.beginPath(); x.rect(cx + 3, cy + 3, TILE - 6, TILE - 6); x.clip();
        x.drawImage(im, cx + 3 + (TILE - 6 - w) / 2, cy + 3 + (TILE - 6 - h) / 2, w, h); x.restore();
        ok.push(t);
      } catch (e) { ok.push(null); }
      x.fillStyle = "#000"; x.fillRect(cx + 3, cy + 3, 46, 46); x.fillStyle = "#fff"; x.font = "bold 34px sans-serif"; x.textBaseline = "middle"; x.textAlign = "center";
      x.fillText(String(i + 1), cx + 26, cy + 27);
    }
    if (!ok.some(Boolean)) return null;
    // a tile whose photo failed keeps its number but is sent with a placeholder id that cannot match
    return { b64: canvasB64(c, 0.72), ids: ok.map((t, i) => t ? t.id : "none-" + i) };
  }
  async function single(t) {
    const im = await loadImg("/_blob/" + t.photo); const sc = Math.min(1, 700 / Math.max(im.width, im.height));
    const c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return { b64: canvasB64(c, 0.85), ids: [t.id] };
  }
  async function ask(photo, sheets) {
    const body = JSON.stringify({ photo, type: "image/jpeg", sheets });
    let last;
    for (let a = 0; a < 3; a++) {          // retry a dropped connection or a busy server twice
      if (a) await new Promise(z => setTimeout(z, 2000 * a));
      let r;
      try { r = await fetch("/api/vj/photosearch", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body }); }
      catch (e) { last = Object.assign(new Error("connection dropped"), { status: 0 }); continue; }
      if (r.redirected || (r.headers.get("content-type") || "").indexOf("json") < 0) throw Object.assign(new Error("signed out - reload the page and sign in again"), { status: 401 });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return (j.matches || []).filter(m => !/^none-/.test(m.id));
      last = Object.assign(new Error(j.error || ("server " + r.status)), { status: r.status });
      if (!(r.status >= 500 || r.status === 429 && /busy/.test(j.error || ""))) break;
    }
    throw last;
  }
  // run the batches two at a time, reporting each one as it finishes
  async function pool(jobs, onDone) {
    const out = []; let i = 0;
    const worker = async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); onDone(); } };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, worker));
    return out;
  }

  async function run() {
    const box = g("fres"); box.textContent = "";
    if (!S.lostPhoto) { box.textContent = "Take or choose a photo first."; return; }
    const cat = g("fcat").value, kd = g("fkd").value, w = num(g("fwt").value);
    let c = S.tags.filter(t => t.photo && /^[0-9a-f]{32}$/.test(t.photo) && (!cat || t.cat === cat) && (!kd || t.kind === kd));
    if (w > 0) c = c.map(t => ({ t, d: Math.abs(wtOf(t).net - w) })).filter(r => r.d <= 1.5).sort((a, b) => a.d - b.d).map(r => r.t);
    const head = document.createElement("p"); head.className = "hint"; box.appendChild(head);
    if (!c.length) { head.textContent = "No piece with a saved photo matches this category" + (w > 0 ? " and weight" : "") + ". Try Any category, or search by weight above."; return; }
    if (c.length > MAX_POOL) { head.textContent = `${c.length} photographed pieces match. Choose the category, or type the weight, so the search checks every one of them (up to ${MAX_POOL} at a time).`; return; }
    const btn = g("fpgo"); btn.disabled = true;
    const pr = progress(box);
    try {
      const photo = await b64of(S.lostPhoto);
      const groups = []; for (let i = 0; i < c.length; i += PER_SHEET) groups.push(c.slice(i, i + PER_SHEET));
      head.textContent = `Searching ${c.length} photographed piece${c.length === 1 ? "" : "s"}… please keep this page open.`;
      pr.set(2, `Loading photos 0 of ${c.length}`);
      const sheets = []; for (let i = 0; i < groups.length; i++) { const sh = await makeSheet(groups[i]); if (sh) sheets.push(sh); const n = Math.min(c.length, (i + 1) * PER_SHEET); pr.set(2 + 33 * n / c.length, `Loading photos ${n} of ${c.length}`); }
      const calls = []; for (let i = 0; i < sheets.length; i += PER_CALL) calls.push(sheets.slice(i, i + PER_CALL));
      let doneCalls = 0;
      pr.set(35, `Claude is comparing ${c.length} pieces (0 of ${calls.length} batches done)`, 80);
      let found = (await pool(calls.map(cs => () => ask(photo, cs)), () => { doneCalls++; pr.set(35 + 45 * doneCalls / calls.length, `Claude is comparing ${c.length} pieces (${doneCalls} of ${calls.length} batches done)`, 80); })).flat();
      // second look: the best few, one clear photo each
      const best = [...new Map(found.sort((a, b) => b.confidence - a.confidence).map(m => [m.id, m])).values()].slice(0, 6)
        .map(m => S.tags.find(t => t.id === m.id)).filter(Boolean);
      if (best.length > 1 || (best.length === 1 && c.length > PER_SHEET)) {
        pr.set(82, `Second look at the ${best.length} closest piece${best.length === 1 ? "" : "s"}`, 97);
        const singles = []; for (const t of best) { try { singles.push(await single(t)); } catch (e) {} }
        if (singles.length) { try { found = await ask(photo, singles); } catch (e) { /* keep the first-round matches */ } }
      }
      found = [...new Map(found.sort((a, b) => b.confidence - a.confidence).map(m => [m.id, m])).values()];
      pr.set(100, "Done"); pr.done();
      head.textContent = found.length ? `Best matches by photo, out of ${c.length} checked. Check the diamonds and weight, then tap Reprint tag:` :
        `None of the ${c.length} photographed pieces looks like the same design. Try another photo (piece flat, good light), a different category, or search by weight.`;
      found.slice(0, 3).forEach(m => { const t = S.tags.find(x => x.id === m.id); if (t) box.appendChild(lostCard(t, `${Math.round(m.confidence)}% match · ${m.why || ""}`)); });
    } catch (e) {
      pr.done();
      head.textContent = e.status === 429 ? (e.message || "Too many searches just now - wait a minute and try again.") : e.status === 402 ? "The Claude API credit is used up - tell Abhinav." : "Photo search did not work this time (" + (e.message || "error") + (e.status ? ", " + e.status : "") + "). Check the internet, keep this page open, and try again - or search by weight.";
    }
    btn.disabled = !S.lostPhoto;
  }
  function boot() {
    const old = g("fpgo");
    if (!old || typeof S === "undefined" || typeof lostCard !== "function") return setTimeout(boot, 300);
    const nb = old.cloneNode(true); old.replaceWith(nb); nb.addEventListener("click", run);   // drop the page's old handler
    const row = g("fphotoRow"); if (row) row.hidden = false;
  }
  boot();
})();
