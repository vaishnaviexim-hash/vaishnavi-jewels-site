/* VJ Tags - "Add photos by design number" (owner 17/10/2026, Brain C-20261017-PHOTOIMPORT). Loaded by shim.js for owners only.
   Reads the night job's import files (.json.gz or .json):
     {"version":1,"made":"<ISO>","items":[{"designNo":"1265","fileName":"IMG_1234.jpg","driveId":"...","jpeg":"<base64 JPEG>"}]}
   (an item may carry "label" (e.g. VLR14/806) instead of "designNo"; at most 150 items per file).
   For each item: every live tag with that design no. (trimmed, any case; '1265' and '01265' are different) or that exact label
   which has NO photo yet gets the photo - uploaded once, then saved with the same update the phone 'Add photo' button uses.
   Tags that already have a photo are never changed, so pressing Start again on the same files simply continues.
   Safety: images only (JPEG/PNG/WebP magic bytes, at most 2 MB after decoding), redrawn through a canvas where the browser can
   (this drops hidden data such as GPS from iPhone photos), one item at a time with a short pause. The server still checks the
   sign-in, the role and the bytes on every call; this page is a convenience, not the security. Nothing is shown with innerHTML. */
(function () {
  "use strict";
  const MAX_IMG = 2 * 1024 * 1024, MAX_FILE = 60 * 1024 * 1024, MAX_JSON = 90 * 1024 * 1024, MAX_ITEMS = 300, PAUSE = 300;
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const key = v => String(v == null ? "" : v).trim().toUpperCase();
  const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, n);

  async function readText(f) {
    if (!f || f.size > MAX_FILE) throw new Error((f && f.name) + ": file is larger than 60 MB");
    const buf = f.arrayBuffer ? await f.arrayBuffer() : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(f); });
    const u = new Uint8Array(buf);
    let bytes = u;
    if (u[0] === 0x1f && u[1] === 0x8b) { // gzip (by its first bytes, not its name)
      if (typeof DecompressionStream !== "function") throw new Error("this browser cannot open .gz files - use Chrome");
      const rd = new Response(u).body.pipeThrough(new DecompressionStream("gzip")).getReader(), parts = []; let n = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (n > MAX_JSON) { try { rd.cancel(); } catch (e) {} throw new Error(f.name + ": too large after unzipping"); } parts.push(value); }
      bytes = new Uint8Array(n); let o = 0; parts.forEach(p => { bytes.set(p, o); o += p.length; });
    } else if (/\.gz$/i.test(f.name)) throw new Error(f.name + ": not a gzip file");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  // Parse and check one file. keepImg=false keeps only the names (for the preview, so many files do not fill the memory).
  async function parseFile(f, keepImg) {
    let j; try { j = JSON.parse(await readText(f)); } catch (e) { throw new Error(e && /file|gzip|large|browser/.test(e.message) ? e.message : f.name + ": not a valid import file"); }
    if (!j || typeof j !== "object" || j.version !== 1 || !Array.isArray(j.items)) throw new Error(f.name + ": not a version 1 import file");
    if (j.items.length > MAX_ITEMS) throw new Error(f.name + ": more than " + MAX_ITEMS + " items - split it");
    const out = [], bad = [];
    j.items.forEach((it, i) => {
      if (!it || typeof it !== "object") { bad.push({ designNo: "", fileName: "", driveId: "", why: "item " + (i + 1) + " unreadable" }); return; }
      const designNo = clean(it.designNo, 60), label = designNo ? "" : clean(it.label, 60), fileName = clean(it.fileName, 200), driveId = /^[A-Za-z0-9_\-]{1,200}$/.test(String(it.driveId || "")) ? String(it.driveId) : "";
      const jpeg = typeof it.jpeg === "string" ? it.jpeg.replace(/\s+/g, "") : "";
      const row = { designNo, label, fileName, driveId };
      if (!designNo && !label) { bad.push(Object.assign(row, { why: "no design no. or label" })); return; }
      if (!jpeg || jpeg.length > Math.ceil(MAX_IMG / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(jpeg)) { bad.push(Object.assign(row, { why: jpeg ? "photo larger than 2 MB or not base64" : "no photo" })); return; }
      if (keepImg) row.jpeg = jpeg;
      out.push(row);
    });
    return { items: out, bad };
  }
  // base64 -> checked image Blob (magic bytes, 2 MB), redrawn through a canvas when the browser can (drops EXIF / GPS).
  async function toImage(b64) {
    let bin; try { bin = atob(b64); } catch (e) { throw new Error("photo is not valid base64"); }
    if (!bin.length || bin.length > MAX_IMG) throw new Error("photo larger than 2 MB");
    const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const s = (a, b) => String.fromCharCode(...u.slice(a, b));
    const type = u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff ? "image/jpeg" : u[0] === 0x89 && s(1, 4) === "PNG" ? "image/png" : s(0, 4) === "RIFF" && s(8, 12) === "WEBP" ? "image/webp" : "";
    if (!type) throw new Error("not a JPEG, PNG or WebP photo");
    const blob = new Blob([u], { type });
    if (typeof createImageBitmap !== "function") return blob;
    let bm; try { bm = await createImageBitmap(blob); } catch (e) { throw new Error("photo cannot be opened (damaged)"); }
    try {
      const sc = Math.min(1, 1600 / Math.max(bm.width, bm.height)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bm.width * sc)); c.height = Math.max(1, Math.round(bm.height * sc));
      const g = c.getContext && c.getContext("2d"); if (!g || !c.toBlob) return blob;
      g.drawImage(bm, 0, 0, c.width, c.height);
      const out = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
      return out && out.size && out.size <= MAX_IMG ? out : blob;
    } finally { try { bm.close(); } catch (e) {} }
  }
  const csvCell = v => { let s = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }; // no spreadsheet formulas

  async function mount() {
    const C = window.claude; if (!C) return;
    const user = await C.use("user"); if (!user || !(await user.isOwner())) return; // owners only (server checks too)
    const db = await C.use("db"), assets = await C.use("assets"), dl = await C.use("downloads"), me = await user.id();
    const host = document.getElementById("p-rates"); if (!db || !assets || !host || document.getElementById("photoImpCard")) return;
    const file = el("input", { type: "file", id: "pimFile", multiple: true, accept: ".gz,.json,application/gzip,application/json" });
    const go = el("button", { type: "button", className: "btn", id: "pimGo", textContent: "Start", disabled: true });
    const stop = el("button", { type: "button", className: "btn ghost", id: "pimStop", textContent: "Stop", hidden: true });
    const csv = el("button", { type: "button", className: "btn ghost", id: "pimCsv", textContent: "Download not-matched list (CSV)", hidden: true });
    const info = el("p", { className: "hint", id: "pimMsg" }), sum = el("p", { className: "hint", id: "pimSum" });
    const card = el("div", { id: "photoImpCard", style: "margin-top:24px;border-top:1px solid var(--line);padding-top:16px" }, [
      el("h2", { textContent: "Add photos by design number" }),
      el("p", { className: "hint", textContent: "Choose the photo import files (.json.gz) that the night job saved in Google Drive. Each photo is added to every piece with the same design no. (or tag label) that has no photo yet. Pieces that already have a photo are not changed. You can press Start again later - it continues where it stopped." }),
      el("div", { className: "row", style: "align-items:end" }, [el("label", { style: "flex:2 1 240px" }, ["Import files ", file]), el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [go, stop])]),
      info, sum, csv]);
    const after = document.getElementById("importCard"); if (after && after.parentNode === host) after.after(card); else host.append(card);

    let notMatched = [], running = false, halt = false;
    const tagsNow = () => (window.VJ_TAGS ? window.VJ_TAGS() : []);
    const index = () => { const d = new Map(), l = new Map(); tagsNow().forEach(t => {
      const a = key(t.designNo), b = key(t.label);
      if (a) { if (!d.has(a)) d.set(a, []); d.get(a).push(t); }
      if (b) { if (!l.has(b)) l.set(b, []); l.get(b).push(t); } }); return { d, l }; };
    const find = (ix, it) => it.designNo ? (ix.d.get(key(it.designNo)) || []) : (ix.l.get(key(it.label)) || []);

    file.addEventListener("change", async () => {
      go.disabled = true; csv.hidden = true; sum.textContent = ""; const fs = [...(file.files || [])]; if (!fs.length) { info.textContent = ""; return; }
      info.textContent = "Reading " + fs.length + " file" + (fs.length > 1 ? "s" : "") + "…";
      let n = 0, bad = 0, need = 0, have = 0, none = 0; const errs = [], ix = index();
      for (const f of fs) { try { const p = await parseFile(f, false); n += p.items.length; bad += p.bad.length;
        p.items.forEach(it => { const m = find(ix, it); if (!m.length) none++; else if (m.some(t => !t.photo)) need++; else have++; }); } catch (e) { errs.push(e.message); } }
      info.textContent = `${fs.length} file${fs.length > 1 ? "s" : ""}, ${n} photos. ${need} can be added to pieces without a photo, ${have} only match pieces that already have one, ${none} match no piece.` + (bad ? ` ${bad} unreadable items will be skipped.` : "") + (errs.length ? " Problems: " + errs.join("; ") : "");
      go.disabled = !n;
    });
    stop.addEventListener("click", () => { halt = true; stop.disabled = true; info.textContent = "Stopping after this photo…"; });
    csv.addEventListener("click", () => {
      const lines = [["designNo", "label", "fileName", "driveId", "reason"].join(",")].concat(notMatched.map(r => [r.designNo, r.label, r.fileName, r.driveId, r.why].map(csvCell).join(",")));
      const data = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" }), name = "vjtags_photos_not_matched_" + new Date().toISOString().slice(0, 10) + ".csv";
      if (dl) dl.save({ filename: name, data }); });

    go.addEventListener("click", async () => {
      if (running) return; const fs = [...(file.files || [])]; if (!fs.length) return;
      running = true; halt = false; go.disabled = true; file.disabled = true; stop.hidden = false; stop.disabled = false; csv.hidden = true; notMatched = [];
      const R = { items: 0, matched: new Set(), attached: 0, noTag: new Set(), skipped: 0, failed: 0 }; let done = 0, total = 0;
      const show = () => { sum.textContent = `Pieces matched: ${R.matched.size}. Photos attached: ${R.attached}. Design nos. with no piece: ${R.noTag.size}. Photos skipped (pieces already had a photo): ${R.skipped}.` + (R.failed ? ` Failed: ${R.failed} (press Start again to retry).` : ""); };
      try {
        for (const f of fs) {
          if (halt) break;
          let p; try { p = await parseFile(f, true); } catch (e) { notMatched.push({ designNo: "", label: "", fileName: f.name, driveId: "", why: e.message }); R.failed++; continue; }
          p.bad.forEach(b => notMatched.push(b)); total += p.items.length + p.bad.length; done += p.bad.length;
          for (const it of p.items) {
            if (halt) break;
            done++; R.items++; info.textContent = `Working… ${done} of ${total} (${f.name})`;
            const ix = index(), m = find(ix, it);
            if (!m.length) { R.noTag.add(it.designNo ? "D:" + key(it.designNo) : "L:" + key(it.label)); notMatched.push(Object.assign({ why: "no piece with this " + (it.designNo ? "design no." : "label") }, it, { jpeg: undefined })); show(); continue; }
            m.forEach(t => R.matched.add(t.id));
            // check the photo again on the page's live copy (another phone may have added one meanwhile)
            const todo = [];
            for (const t of m) { const s = await db.doc("tags/" + t.id).get(); if (s.exists && !(s.data() || {}).photo) todo.push(t); }
            if (!todo.length) { R.skipped++; show(); continue; }
            let up = null, err = null;
            try { const img = await toImage(it.jpeg); it.jpeg = null;
              for (let a = 0; a < 3 && !up; a++) { try { up = await assets.upload(img, { type: img.type }); } catch (e) { err = e; if (/^http_4|not_granted|not_signed_in|too_large/.test(String(e && e.code))) break; await wait(1500 * (a + 1)); } }
            } catch (e) { err = e; }
            if (!up || !/^[0-9a-f]{32}$/.test(String(up.id))) { R.failed++; notMatched.push({ designNo: it.designNo, label: it.label, fileName: it.fileName, driveId: it.driveId, why: "photo not saved: " + ((err && (err.message || err.code)) || "error") });
              if (err && /not_granted|not_signed_in/.test(String(err.code))) { halt = true; info.textContent = "Stopped: this login cannot add photos."; } show(); continue; }
            for (const t of todo) {
              let ok = false;
              for (let a = 0; a < 3 && !ok; a++) { try { const s = await db.doc("tags/" + t.id).get(); if (!s.exists || (s.data() || {}).photo) { ok = "had"; break; }
                await db.doc("tags/" + t.id).update({ photo: up.id, photoAt: new Date().toISOString(), photoBy: me || null }); ok = true; } catch (e) { if (/not_granted|not_signed_in/.test(String(e && e.code))) { halt = true; break; } await wait(1500 * (a + 1)); } }
              if (ok === true) R.attached++; else if (!ok) R.failed++;
            }
            show(); await wait(PAUSE);
          }
        }
        info.textContent = halt ? `Stopped after ${done} of ${total}. Press Start to continue - photos already added are skipped.` : `Done: ${done} photos checked.`;
      } catch (e) { info.textContent = "Stopped: " + ((e && e.message) || "error") + ". Press Start again - nothing is added twice."; }
      show(); running = false; go.disabled = false; file.disabled = false; stop.hidden = true; csv.hidden = !notMatched.length;
    });
  }
  window.VJ_PHOTOIMP_TEST = { parseFile, toImage, csvCell };
  mount().catch(() => {});
})();
