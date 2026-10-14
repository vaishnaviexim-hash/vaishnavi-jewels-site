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
  const ITEM_CAT = [[/^(SV)?ER|EAR/, "VER"], [/^(SV|SA)?[LG]R|RING/, "VLR"], [/^(SV)?BR|BRAC|BRCL/, "VBR"], [/^(SV)?BA?N|BANG/, "VBN"],
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
      <div class="actions"><label class="btn ghost" style="cursor:pointer">3 · Check karigar register (CSV)<input type="file" id="lkReg" accept=".csv,text/csv" hidden></label></div>
      <p class="hint" id="lkRegMsg"></p>
      <div class="actions"><button type="button" class="btn ghost" id="lkNoPh">4 · Report: pieces without a photo</button></div>
      <p class="hint" id="lkNoPhMsg"></p>
      <div id="lkBarW" hidden style="height:10px;background:#eee;border-radius:5px;overflow:hidden"><div id="lkBar" style="height:100%;width:0;background:#b8963e;transition:width .3s"></div></div>
      <p class="hint" id="lkPhMsg"></p>
      <div id="lkOut"></div>`;
    host.appendChild(c);
    $("lkPk").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) applyPackets(f); e.target.value = ""; });
    $("lkNoPh").addEventListener("click", noPhotoReport);
    $("lkReg").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) checkRegister(f); e.target.value = ""; });
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

  // Photo names (owner 14/10/2026): "1105 SVBAN.jpeg", "SVER 1251.jpg", "SVLR-3253.jpg", "1535SVBN.jpg", "SVNS75195.jpeg",
  // "1338-1339 SVPS.jpeg" (pendant + earring of a set), "1342(N) 1341(ER).JPG", "68 AZ-TM" (= AZ-TM-68), "DZ-BAN-19 svbn (2).jpg".
  // -> { codes: [...design nos], cat: category from the item word, extra: true for "(2)" / "Copy of" extra views }
  const IT = "S?L?V?A?(?:ER|LR|GR|BR|BAN|BN|PS|NS|MN|MS|CH|P)";
  const ITEM_WORD = new RegExp("^(COPY|OF|S?V?A?(ER|LR|GR|BR|BAN|BN|PS|P|NS|MN|MS|CH|NP)\\d?|BAN|BANG|R|L|T|F|B|S|N|H|C|ER|RING|SET|TENNIS|\\d)$", "i");
  function parseName(fn) {
    let b = fn.replace(/\.(jpe?g|png|webp|heic|gif)$/i, "");
    const extra = /\(\d+\)|copy/i.test(b);
    b = b.replace(/\(\d+\)/g, " ").replace(/\((N|ER|E|P|PS|R)\)/gi, " $1 ").replace(/^IMG[_ -]?\d+/i, "").replace(/_/g, " ");
    const raw = b.trim().split(/\s+/).filter(Boolean), toks = [];
    for (const t of raw) { let m;
      if ((m = t.match(/^-?(AZ|DZ)-(TM|MS)$/i)) && toks.length && /^-?\d+-?$/.test(toks[toks.length - 1])) { toks[toks.length - 1] = m[1] + "-" + m[2] + "-" + toks[toks.length - 1].replace(/-/g, ""); continue; }
      if ((m = t.match(/^(\d+)-(AZ|DZ)-(TM|MS)$/i))) { toks.push(m[2] + "-" + m[3] + "-" + m[1]); continue; }
      if ((m = t.match(new RegExp("^(\\d{3,6})[-.]?(" + IT + ")(-?[A-Z])?$", "i")))) { toks.push(m[1], m[2]); continue; }
      if ((m = t.match(new RegExp("^(" + IT + ")(\\d{3,6})$", "i")))) { toks.push(m[1], m[2]); continue; }
      if (/^IMG/i.test(t)) continue;
      if ((m = t.match(/^(\d{3,6})\.\d$/))) { toks.push(m[1]); continue; }
      toks.push(t); }
    const codes = [], items = [];
    for (const t of toks) { let m;
      if ((m = t.match(new RegExp("^(" + IT + ")-(\\d+)$", "i")))) { items.push(m[1]); codes.push(m[2]); continue; }
      if (ITEM_WORD.test(t) && !/^\d{2,}$/.test(t)) { items.push(t); continue; }
      if (/^\d+-\d+$/.test(t)) { codes.push(t, ...t.split("-")); continue; }
      if (/\d/.test(t) || /^[A-Z]{2,}-/i.test(t)) { codes.push(t); continue; }
      items.push(t); }
    let cat = null; for (const w of items) { cat = /^N$/i.test(w) ? "VNS" : catOfItem(w); if (cat) break; }
    return { codes, cat, extra, code: codes[0] || "", item: items.join(" ") };
  }
  // category from the Drive folder the photo sits in ("EAR RING SAMPLES/ER HANG/...") - used when the name has no item word
  function catOfPath(p) {
    const segs = String(p || "").toUpperCase().split("/").slice(0, -1);
    for (const s of segs) {
      if (/EAR/.test(s)) return "VER"; if (/PENDANT\s*SET/.test(s)) return "VPS"; if (/PENDANT/.test(s)) return "VP";
      if (/NECKLACE/.test(s)) return "VNS"; if (/BANGLE/.test(s)) return "VBN"; if (/BRACELET/.test(s)) return "VBR";
      if (/RING/.test(s)) return "VLR"; if (/^M\s?S\b|MANGAL/.test(s)) return "VMN"; if (/CHAIN/.test(s)) return "CH"; }
    return null;
  }
  // a set photo may also stand for the pieces of the set; bangle and bracelet (kada) photos may be filed either way
  const REL = { VPS: ["VP", "VER"], VNS: ["VER", "VP"], VBN: ["VBR"], VBR: ["VBN"], VP: ["VPS"], VER: ["VPS"] };
  const zkeys = c => { const k = n(c); return k ? [...new Set([k, k.replace(/^0+/, "")])].filter(Boolean) : []; };
  function matchPhoto(f, idx) {
    const { codes, cat } = parseName(f.name), fcat = catOfPath(f.webkitRelativePath), use = cat || fcat;
    const hits = []; let related = false;
    for (const c of codes) for (const k of zkeys(c)) { const list = idx.get(k); if (!list) continue;
      let h = use ? list.filter(t => t.cat === use) : list;
      if (!h.length && fcat && fcat !== use) h = list.filter(t => t.cat === fcat);
      if (!h.length && REL[use]) { h = list.filter(t => REL[use].includes(t.cat)); if (h.length) related = true; }
      if (h.length) { h.forEach(t => { if (!hits.includes(t)) hits.push(t); }); break; } }
    return { codes, hits, related };
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
    // first photo per tag wins: photos with "(2)" / "Copy of" are extra views and come later; set photos only fill pieces left without one
    files.sort((a, b) => (parseName(a.name).extra - parseName(b.name).extra) || a.name.localeCompare(b.name));
    const later = [];
    const take = (f, hits) => { for (const t of hits) { if (used.has(t.id)) continue; used.add(t.id); if (t.photo && !rep) { kept.push(t.label); continue; } jobs.push([f, t]); } };
    for (const f of files) {
      const r = matchPhoto(f, idx);
      if (!r.codes.length) { noTag.push([f.name, "", "name has no design no."]); continue; }
      if (!r.hits.length) { noTag.push([f.name, r.codes.join(" "), "no tag with this design no."]); continue; }
      if (r.related) later.push([f, r.hits]); else take(f, r.hits);
    }
    for (const [f, hits] of later) take(f, hits);
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

  /* ---------- 5. Check the karigar register (owner 14/10/2026) ----------
     CSV typed from the handwritten register: Code,Product,Karigar,Date,Page,Note. A code counts as tagged when a tag has it as
     design no., or it appears in the tag's remark / certificate. Struck-out lines are only reported, never counted as missing. */
  function parseCsv(txt) {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < txt.length; i++) { const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += ch; }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim()));
  }
  async function checkRegister(file) {
    const m = $("lkRegMsg"), out = $("lkOut"); out.textContent = "";
    try {
      if (file.size > 2e6) throw new Error("file too large");
      const rows = parseCsv((await file.text()).replace(/^﻿/, "")); const head = rows.shift().map(h => h.trim().toLowerCase());
      const ix = k => head.indexOf(k); if (ix("code") < 0) throw new Error("no Code column");
      const all = tags(), byDn = new Map();
      all.forEach(t => { const k = n(t.designNo); if (k) { if (!byDn.has(k)) byDn.set(k, []); byDn.get(k).push(t); } });
      const inText = code => all.filter(t => new RegExp("(^|[^0-9])" + code + "([^0-9]|$)").test(String(t.remark || "") + " " + String(t.cert || "")));
      const res = [], seen = new Set(); let tagged = 0, missing = 0, struck = 0;
      for (const r of rows) {
        const code = String(r[ix("code")] || "").trim(); if (!code) continue; const note = ix("note") >= 0 ? (r[ix("note")] || "") : "";
        const isStruck = /struck|crossed/i.test(note); const k = n(code); seen.add(k);
        const hits = (byDn.get(k) || []).concat(byDn.has(k) ? [] : inText(k));
        const status = isStruck ? "struck out in register" : hits.length ? "TAGGED" : "NOT TAGGED";
        if (isStruck) struck++; else if (hits.length) tagged++; else missing++;
        res.push([code, r[ix("product")] || "", r[ix("karigar")] || "", r[ix("date")] || "", r[ix("page")] || "", note, status, hits.map(t => t.label).join(" "), hits.map(t => t.catName || "").join(" ")]);
      }
      const extra = all.filter(t => /^7[0-9]{4}$/.test(n(t.designNo)) && !seen.has(n(t.designNo)));
      m.textContent = `Register: ${tagged} codes tagged, ${missing} NOT tagged, ${struck} struck-out lines. ${extra.length} tags have a 7xxxx design no. that is not in this register.`;
      const p = document.createElement("div"); p.className = "actions";
      p.append("Register check: ", csvLink("register-check.csv", [["Code", "Product", "Karigar", "Date", "Page", "Register note", "Status", "Tag label", "Tag category"]].concat(
        res.sort((a, b) => (a[6] === "NOT TAGGED" ? 0 : a[6] === "TAGGED" ? 1 : 2) - (b[6] === "NOT TAGGED" ? 0 : b[6] === "TAGGED" ? 1 : 2) || a[0].localeCompare(b[0], "en", { numeric: true })))));
      if (extra.length) p.append(" ", csvLink("tagged-not-in-register.csv", [["Label", "Design no.", "Category"]].concat(extra.map(t => [t.label, t.designNo, t.catName]))));
      out.append(p);
      const miss = res.filter(x => x[6] === "NOT TAGGED").slice(0, 40).map(x => x[0] + " " + x[1]).join(", ");
      if (miss) { const q = document.createElement("p"); q.className = "hint"; q.textContent = "Not tagged: " + miss + (missing > 40 ? " …" : ""); out.append(q); }
    } catch (e) { m.textContent = "Could not read the register: " + (e.message || e) + "."; }
  }

  /* ---------- 6. Pieces without a photo (owner 14/10/2026: "full report of missing images") ---------- */
  function noPhotoReport() {
    const all = tags(), none = all.filter(t => !t.photo).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "sample" ? 1 : -1) || String(a.box || "").localeCompare(String(b.box || ""), "en", { numeric: true }) || a.label.localeCompare(b.label, "en", { numeric: true }));
    const m = $("lkNoPhMsg"), out = $("lkOut"); out.textContent = "";
    const st = none.filter(t => t.kind !== "sample").length;
    m.textContent = `${none.length} of ${all.length} pieces have no photo (${st} stock, ${none.length - st} samples).`;
    if (!none.length) return;
    const p = document.createElement("div"); p.className = "actions";
    p.append("Pieces without a photo: ", csvLink("pieces-without-photo.csv", [["Label", "Design no.", "Category", "Stock / sample", "Packet / box", "Remark", "Printed"]].concat(
      none.map(t => [t.label, t.designNo || "", t.catName || "", t.kind === "sample" ? "sample" : "stock", t.box || "", t.remark || "", t.printedAt ? "yes" : "no"]))));
    out.append(p);
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
