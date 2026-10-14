/* VJ Tags - "Search by photo" on Find lost tag, rebuilt 14/10/2026 (owner: results were wrong because only the first 36
   photographed pieces were compared when no weight was typed). Loaded by shim.js for owner/staff on vaishnavijewels.com/tags.
   Now: every photographed piece that fits the category / type / weight is checked. The phone draws contact sheets
   (9 numbered tiles per image, ids sent alongside), the server asks Claude with a fixed prompt (/api/vj/photosearch,
   sheets mode), then the best few are checked again one by one. Each result has Reprint tag (from the page's lostCard). */
(function () {
  "use strict";
  const g = id => document.getElementById(id);
  const MAX_POOL = 216;          // 3 calls x 72 pieces; more than that -> ask for a category or the weight first
  const PER_CALL = 8, PER_SHEET = 9, TILE = 300;
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const b64of = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const canvasB64 = (c, q) => c.toDataURL("image/jpeg", q).split(",")[1];

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
    return { b64: canvasB64(c, 0.8), ids: ok.map((t, i) => t ? t.id : "none-" + i) };
  }
  async function single(t) {
    const im = await loadImg("/_blob/" + t.photo); const sc = Math.min(1, 700 / Math.max(im.width, im.height));
    const c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return { b64: canvasB64(c, 0.85), ids: [t.id] };
  }
  async function ask(photo, sheets) {
    const r = await fetch("/api/vj/photosearch", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ photo, type: "image/jpeg", sheets }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || ("server " + r.status)), { status: r.status });
    return (j.matches || []).filter(m => !/^none-/.test(m.id));
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
    try {
      const photo = await b64of(S.lostPhoto);
      const groups = []; for (let i = 0; i < c.length; i += PER_SHEET) groups.push(c.slice(i, i + PER_SHEET));
      head.textContent = `Preparing ${c.length} photo${c.length === 1 ? "" : "s"}…`;
      const sheets = []; for (let i = 0; i < groups.length; i++) { const sh = await makeSheet(groups[i]); if (sh) sheets.push(sh); head.textContent = `Preparing photos… ${Math.min(c.length, (i + 1) * PER_SHEET)} of ${c.length}`; }
      head.textContent = `Comparing with all ${c.length} photographed piece${c.length === 1 ? "" : "s"}… this can take up to a minute.`;
      const calls = []; for (let i = 0; i < sheets.length; i += PER_CALL) calls.push(sheets.slice(i, i + PER_CALL));
      let found = (await Promise.all(calls.map(cs => ask(photo, cs)))).flat();
      // second look: the best few, one clear photo each
      const best = [...new Map(found.sort((a, b) => b.confidence - a.confidence).map(m => [m.id, m])).values()].slice(0, 6)
        .map(m => S.tags.find(t => t.id === m.id)).filter(Boolean);
      if (best.length > 1 || (best.length === 1 && c.length > PER_SHEET)) {
        head.textContent = `Checking the ${best.length} closest piece${best.length === 1 ? "" : "s"} again…`;
        const singles = []; for (const t of best) { try { singles.push(await single(t)); } catch (e) {} }
        if (singles.length) found = await ask(photo, singles);
      }
      found = [...new Map(found.sort((a, b) => b.confidence - a.confidence).map(m => [m.id, m])).values()];
      head.textContent = found.length ? `Best matches by photo, out of ${c.length} checked. Check the diamonds and weight, then tap Reprint tag:` :
        `None of the ${c.length} photographed pieces looks like the same design. Try another photo (piece flat, good light), a different category, or search by weight.`;
      found.slice(0, 3).forEach(m => { const t = S.tags.find(x => x.id === m.id); if (t) box.appendChild(lostCard(t, `${Math.round(m.confidence)}% match · ${m.why || ""}`)); });
    } catch (e) {
      head.textContent = e.status === 429 ? (e.message || "Too many searches just now - wait a minute and try again.") : e.status === 402 ? "The Claude API credit is used up - tell Abhinav." : "Photo search did not work this time (" + (e.message || "error") + "). Try again, or search by weight.";
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
