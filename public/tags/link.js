/* VJ Tags - link the SAMPLE STOCK PACKETS sheet and the Drive sample photos to the tags (owner 14/10/2026).
   1. Packet / box: the owner loads "VJ packet list.json" (made by Claude from the Drive sheet "SAMPLE STOCK PACKETS"; it is NOT
      put on the website, whose GitHub copy is public). It gives each design no. its packet or box; matching SAMPLE tags of the
      same category get it as  box  ("Rings · P-3 10-50 k").
   2. Photos: the owner picks the Drive photo folder (downloaded to the laptop) or some photos. Each file name starts with the
      design no. ("1105 SVBAN.jpeg"); the photo is shrunk on this computer and saved on the tag with that design no. that has
      no photo yet (existing photos are kept unless the owner ticks "replace"). Nothing leaves this computer except to our own
      server (same upload as "Take photo").
   3. Price check shows the packet / box of the piece for everyone (staff need it to find the piece).
   Matching ignores dashes, slashes and spaces (DZ-BAN-19 = dzban19); if a design no. is in two packets, the category decides. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const n = x => String(x == null ? "" : x).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const tags = () => (window.VJ_TAGS ? window.VJ_TAGS() : []);
  // item word in the sheet / photo name  ->  VJ Tags category id
  const ITEM_CAT = [[/^(SV)?ER|EAR/, "VER"], [/^(SV)?LR|RING/, "VLR"], [/^(SV)?BR|BRAC|BRCL/, "VBR"], [/^(SV)?BA?N|BANG/, "VBN"],
    [/^S?VPS|^PSET|PENDANTSET/, "VPS"], [/^MS|^SMS|^S?VMN|MANG/, "VMN"], [/^S?V?NS|NECK/, "VNS"], [/^S?CH|CHAIN/, "CH"], [/^S?VP|PEND/, "VP"]];
  const SHEET_CAT = { Rings: "VLR", Earrings: "VER", Bracelet: "VBR", Bangles: "VBN", Pendant: "VP", "Pendant set": "VPS", Necklace: "VNS", Mangalsutra: "VMN" };
  const catOfItem = it => { const s = n(it); for (const [re, c] of ITEM_CAT) if (re.test(s)) return c; return null; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function byDesign(samplesOnly) { const m = new Map(); tags().filter(t => !samplesOnly || t.kind === "sample").forEach(t => { const k = n(t.designNo); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(t); } }); return m; }
  // choose among several tags with the same design no.: same category first, then samples, then the first
  function pick(list, cat, strict) { if (!list || !list.length) return []; if (!cat) return list; const same = list.filter(t => t.cat === cat); return same.length || strict ? same : list; }

  /* ---------- 3. packet on Price check (everyone) ---------- */
  function showBox() {
    const box = $("cres"); if (!box) return; const card = box.querySelector(".card"); if (!card || card.querySelector(".vjBox")) return;
    const lab = card.querySelector(".labelno"); if (!lab) return;
    const label = lab.textContent.split(" · ").pop().trim(), t = tags().find(x => x.label === label); if (!t || !t.box) return;
    const p = document.createElement("p"); p.className = "hint vjBox"; p.style.cssText = "margin:4px 0;font-weight:600;color:var(--fg)"; p.textContent = "📦 Packet / box: " + t.box;
    lab.after(p);
  }

  /* ---------- owner tool ---------- */
  function card() {
    const host = $("p-rates"); if (!host || $("vjLink")) return;
    const c = document.createElement("div"); c.id = "vjLink"; c.className = "card"; c.style.cssText = "margin-top:14px;display:flex;flex-direction:column;gap:10px";
    c.innerHTML = `<h2>Link packets &amp; Drive photos</h2>
      <p class="hint">From the Drive folder "Sample stock": the packet sheet and the photos named by design number (e.g. "1105 SVBAN.jpeg").</p>
      <div class="actions"><label class="btn" style="cursor:pointer">1 · Load packet list file<input type="file" id="lkPk" accept=".json,application/json" hidden></label></div>
      <p class="hint" id="lkPkMsg"></p>
      <div class="actions" style="align-items:center;flex-wrap:wrap;gap:8px">
        <label class="btn" style="cursor:pointer">2 · Choose photo folder<input type="file" id="lkDir" webkitdirectory multiple hidden></label>
        <label class="btn ghost" style="cursor:pointer">or choose photos<input type="file" id="lkFiles" accept="image/jpeg,image/png,image/webp" multiple hidden></label>
        <label style="flex-direction:row;align-items:center;gap:6px;color:var(--fg)"><input type="checkbox" id="lkRep" style="width:auto"> replace photos that pieces already have</label>
        <label style="flex-direction:row;align-items:center;gap:6px;color:var(--fg)"><input type="checkbox" id="lkStock" style="width:auto"> also stock pieces (not only samples) with the same design no.</label></div>
      <div id="lkBarW" hidden style="height:10px;background:#eee;border-radius:5px;overflow:hidden"><div id="lkBar" style="height:100%;width:0;background:#b8963e;transition:width .3s"></div></div>
      <p class="hint" id="lkPhMsg"></p>
      <div id="lkOut"></div>`;
    host.appendChild(c);
    $("lkPk").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) applyPackets(f); e.target.value = ""; });
    $("lkDir").addEventListener("change", e => linkPhotos([...e.target.files]));
    $("lkFiles").addEventListener("change", e => linkPhotos([...e.target.files]));
  }
  const bar = (i, total) => { $("lkBarW").hidden = false; $("lkBar").style.width = Math.round(100 * i / Math.max(1, total)) + "%"; };
  function csvLink(name, rows) {
    const csv = "﻿" + rows.map(r => r.map(x => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = name; a.className = "btn ghost"; a.textContent = "Download list (Excel)"; return a;
  }

  async function applyPackets(file) {
    const m = $("lkPkMsg"); m.textContent = "Reading the packet list…";
    try {
      if (file.size > 2e6) throw new Error("file too large");
      const list = JSON.parse(await file.text()); if (!Array.isArray(list) || !list.every(r => Array.isArray(r) && r.length === 4)) throw new Error("not a VJ packet list");
      const db = await window.claude.use("db"), idx = byDesign(true);
      const todo = [], notTagged = [], seen = new Set();
      for (const [code, item, cat, packet] of list) {
        const k = n(code); if (!k) continue;
        const cid = catOfItem(item) || SHEET_CAT[cat] || null;
        const hits = pick(idx.get(k), cid, true);   // packets are for SAMPLES of the same category only
        if (!hits.length) { notTagged.push([code, item, cat, packet]); continue; }
        const box = `${cat === "Outside" ? "Outside" : cat} · ${packet === cat ? "" : packet}`.replace(/ · $/, "");
        for (const t of hits) { if (seen.has(t.id)) continue; seen.add(t.id); if (t.box !== box) todo.push([t, box]); }
      }
      let done = 0, fail = 0;
      for (const [t, box] of todo) {
        try { await db.doc("tags/" + t.id).update({ box }); done++; } catch (e) { fail++; }
        bar(done + fail, todo.length); m.textContent = `Saving packets: ${done + fail} of ${todo.length}…`;
      }
      const samplesNoBox = tags().filter(t => t.kind === "sample" && !seen.has(t.id));
      m.textContent = `Done. ${seen.size} tagged pieces matched a packet (${done} updated${fail ? ", " + fail + " failed - press again" : ""}). ` +
        `${notTagged.length} design numbers in the sheet have no tag yet; ${samplesNoBox.length} tagged samples are not in the sheet.`;
      const out = $("lkOut"); out.textContent = "";
      if (notTagged.length) { const p = document.createElement("div"); p.className = "actions"; p.append("Not tagged yet: ", csvLink("in-packets-not-tagged.csv", [["Design no.", "Item", "Category", "Packet / box"]].concat(notTagged))); out.append(p); }
      if (samplesNoBox.length) { const p = document.createElement("div"); p.className = "actions"; p.append("Samples not in the sheet: ", csvLink("samples-not-in-packets.csv", [["Label", "Design no.", "Category"]].concat(samplesNoBox.map(t => [t.label, t.designNo, t.catName])))); out.append(p); }
    } catch (e) { m.textContent = "Stopped: " + (e.message || e) + ". Load the file again - nothing is done twice."; }
  }

  // "1105 SVBAN.jpeg" -> {code:"1105", item:"SVBAN"};  "DZ-BAN-19 svbn (2).jpg" -> {code:"DZ-BAN-19", item:"svbn"}
  function parseName(fn) {
    const base = fn.replace(/\.[a-z0-9]+$/i, "").replace(/\(\d+\)/g, " ").replace(/[_]+/g, " ").trim();
    const parts = base.split(/\s+/); const code = parts[0] || ""; const item = parts.slice(1).join(" ");
    return { code, item, extra: /\(\d+\)|\s-\s?\d+$/.test(fn) };
  }
  async function shrink(file) {
    const bmp = await createImageBitmap(file); const max = 1400, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close && bmp.close();
    return await new Promise(res => cv.toBlob(res, "image/jpeg", 0.82));
  }
  async function linkPhotos(files) {
    files = files.filter(f => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
    const m = $("lkPhMsg"), out = $("lkOut"); out.textContent = "";
    if (!files.length) { m.textContent = "No JPG / PNG photos in what was chosen (HEIC iPhone photos must be saved as JPG first)."; return; }
    const db = await window.claude.use("db"), assets = await window.claude.use("assets"), rep = $("lkRep").checked, idx = byDesign(!$("lkStock").checked);
    const jobs = [], noTag = [], kept = [], used = new Set();
    // first photo per tag wins (photos with "(2)" etc. are extra views and come later in the sort)
    files.sort((a, b) => (parseName(a.name).extra - parseName(b.name).extra) || a.name.localeCompare(b.name));
    for (const f of files) {
      const { code, item } = parseName(f.name); const k = n(code); if (!k) { noTag.push([f.name, "", "name has no design no."]); continue; }
      const hits = pick(idx.get(k), catOfItem(item) || catOfItem((f.webkitRelativePath || "").toUpperCase()));
      if (!hits.length) { noTag.push([f.name, code, "no tag with this design no."]); continue; }
      for (const t of hits) { if (used.has(t.id)) continue; if (t.photo && !rep) { kept.push(t.label); used.add(t.id); continue; } used.add(t.id); jobs.push([f, t]); }
    }
    let done = 0, fail = 0, i = 0; const fails = [];
    m.textContent = `${files.length} photos read: ${jobs.length} to save, ${kept.length} pieces already have a photo, ${noTag.length} with no matching tag.`;
    const worker = async () => { while (i < jobs.length) { const [f, t] = jobs[i++];
      try { const blob = await shrink(f); const up = await assets.upload(blob, { type: "image/jpeg" });
        await db.doc("tags/" + t.id).update({ photo: up.id, photoAt: new Date().toISOString(), photoBy: "Drive: " + f.name.slice(0, 60) }); done++; }
      catch (e) { fail++; fails.push([f.name, t.label, e.message || e.code || "error"]); }
      bar(done + fail, jobs.length); m.textContent = `Saving photos: ${done + fail} of ${jobs.length}${fail ? " (" + fail + " failed)" : ""}…`; } };
    await Promise.all([worker(), worker(), worker()]);
    m.textContent = `Done: ${done} photos saved on their tags${fail ? ", " + fail + " failed (choose them again)" : ""}. ${kept.length} pieces kept their photo. ${noTag.length} photos have no tag yet.`;
    if (noTag.length) { const p = document.createElement("div"); p.className = "actions"; p.append("Photos without a tag: ", csvLink("photos-without-tag.csv", [["File", "Design no.", "Why"]].concat(noTag))); out.append(p); }
    if (fails.length) { const p = document.createElement("div"); p.className = "actions"; p.append("Failed: ", csvLink("photos-failed.csv", [["File", "Tag", "Error"]].concat(fails))); out.append(p); }
  }

  /* ---------- 4. Print by box (owner 14/10/2026: "print tags by box numbers") ----------
     Tagged pieces gets a box list; "Print" ticks exactly that box's pieces using the page's own tick boxes (one search per
     label, so the page's own price-code and printing rules apply), then presses the page's "Print selected". */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function boxList() {
    const sel = $("pbBox"); if (!sel) return; const cur = sel.value, cnt = {};
    tags().forEach(t => { if (t.box) cnt[t.box] = (cnt[t.box] || 0) + 1; });
    const keys = Object.keys(cnt).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    sel.textContent = ""; sel.append(new Option(keys.length ? "Choose a box / packet…" : "No boxes yet (owner: load the packet list)", ""));
    keys.forEach(k => sel.append(new Option(`${k} (${cnt[k]})`, k))); sel.value = keys.includes(cur) ? cur : "";
    $("pbGo").disabled = !sel.value;
  }
  function printBar() {
    const host = $("p-list"); if (!host || $("pbBox")) return;
    const row = document.createElement("div"); row.className = "row"; row.style.cssText = "align-items:end;gap:8px;margin:8px 0";
    row.innerHTML = `<label style="flex:2 1 220px">Print by box / packet <select id="pbBox"></select></label>
      <div><button type="button" class="btn" id="pbGo" disabled>Print this box</button></div><span class="hint" id="pbMsg"></span>`;
    const anchor = $("printSel") && $("printSel").parentNode; host.insertBefore(row, anchor || host.firstChild);
    $("pbBox").addEventListener("focus", boxList);
    $("pbBox").addEventListener("change", () => { $("pbGo").disabled = !$("pbBox").value; });
    $("pbGo").addEventListener("click", printBox);
    boxList();
  }
  async function printBox() {
    const box = $("pbBox").value, m = $("pbMsg"), q = $("q"); if (!box || !q) return;
    const list = tags().filter(t => t.box === box).sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
    if (!list.length) return;
    $("pbGo").disabled = true; const fk = $("fkind"); if (fk && fk.value) { fk.value = ""; fk.dispatchEvent(new Event("change")); }
    $("selClear") && $("selClear").click(); await wait(200);
    let ok = 0; const miss = [];
    for (const t of list) {
      q.value = t.label; q.dispatchEvent(new Event("input"));
      let ck = null;
      for (let i = 0; i < 25 && !ck; i++) { await wait(60);
        $("rows").querySelectorAll("tr").forEach(tr => { const c = tr.querySelector("input[type=checkbox]"), td = tr.children[2];
          if (c && td && td.textContent.split(" · ").pop().trim() === t.label) ck = c; }); }
      if (ck) { if (!ck.checked) { ck.checked = true; ck.dispatchEvent(new Event("change")); } ok++; } else miss.push(t.label);
      m.textContent = `Selecting ${ok + miss.length} of ${list.length}…`;
    }
    q.value = ""; q.dispatchEvent(new Event("input"));
    m.textContent = `${ok} tags of ${box} selected${miss.length ? " (not found: " + miss.join(", ") + ")" : ""} - printing…`;
    await wait(300); if (ok && $("printSel")) $("printSel").click();
    $("pbGo").disabled = false;
  }

  async function boot() {
    const box = $("cres"); if (!box || !window.VJ_TAGS || !window.claude) return setTimeout(boot, 300);
    new MutationObserver(showBox).observe(box, { childList: true, subtree: true }); showBox();
    printBar(); document.addEventListener("click", e => { if (e.target && e.target.dataset && e.target.dataset.tab === "list") setTimeout(boxList, 100); });
    try { const u = await window.claude.use("user"); if (u && await u.isOwner()) card(); } catch (e) {}
  }
  boot();
})();
