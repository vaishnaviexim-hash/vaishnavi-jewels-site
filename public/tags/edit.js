/* VJ Tags - "Edit tag" on Price check (owner 14/10/2026). Loaded by shim.js for owners only; the server also refuses
   detail changes from staff (VJ_STAFF_FIELDS), so this button is a convenience, not the security.
   Edits: design no., remark, gold lines (karat + net g), diamond lines (quality, shape, pcs, ct, own rate), polki pcs x rate, other charges,
   sample metal weight. If anything that changes the price is edited, the old price code is cleared so the next
   Reprint tag prints a fresh code and price. Every save is logged on the server (audit) with the owner's email. */
(function () {
  "use strict";
  const KARATS = ["22K", "18K", "14K", "9K"];
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const num = v => { const n = parseFloat(String(v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
  const inp = (val, w, type) => el("input", { value: val == null ? "" : String(val), type: type || "text", style: `width:${w || 90}px;min-width:0`, inputMode: type === "number" ? "decimal" : "text" });
  const sel = (opts, val, w) => { const s = el("select", { style: `width:${w || 90}px` }); opts.forEach(o => s.append(el("option", { value: o, textContent: o, selected: o === val }))); if (val && !opts.includes(val)) s.append(el("option", { value: val, textContent: val, selected: true })); return s; };

  function editor(t, box, card) {
    const old = document.getElementById("vjEdit"); if (old) old.remove();
    const wrap = el("div", { id: "vjEdit", className: "card" }); wrap.style.cssText = "border:2px solid #b8963e;border-radius:var(--r,10px);padding:14px;margin-top:10px;display:flex;flex-direction:column;gap:10px";
    wrap.append(el("h2", { textContent: "Edit " + t.label }));
    const fDesign = inp(t.designNo, 140), fRemark = inp(t.remark, 220), fOther = inp((t.other && t.other.amt) || 0, 110, "number"), fBox = inp(t.box, 200);
    const row = (label, f) => el("label", { style: "display:flex;flex-direction:column;gap:4px" }, [label, f]);
    wrap.append(el("div", { className: "row", style: "display:flex;gap:10px;flex-wrap:wrap" }, [row("Design no.", fDesign), row("Remark", fRemark), row("Other charges (Rs)", fOther), row("Packet / box", fBox)]));
    // polki pieces x rate per piece (C-20261017-POLKI); 0 pcs = no polki
    const pk0 = t.polki && t.polki.pcs > 0 ? t.polki : null, fPPcs = inp(pk0 ? pk0.pcs : "", 90, "number"), fPRate = inp(pk0 ? pk0.rate : 300, 110, "number");
    wrap.append(el("div", { className: "row", style: "display:flex;gap:10px;flex-wrap:wrap" }, [row("Polki pcs", fPPcs), row("Polki rate per pc (Rs)", fPRate)]));
    let fMetal = null;
    if (t.kind === "sample") { fMetal = inp((t.metal && t.metal.net) || 0, 110, "number"); wrap.append(row("Sample weight (g, priced as 14K)", fMetal)); }
    // gold lines
    const gBox = el("div", { style: "display:flex;flex-direction:column;gap:6px" });
    const addGold = g => { const k = sel(KARATS, (g && g.k) || "14K", 80), n = inp(g ? g.net : "", 100, "number"), rm = el("button", { type: "button", className: "btn ghost", textContent: "Remove" });
      const r = el("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap" }, [k, n, "g", rm]); r._get = () => ({ k: k.value, net: num(n.value) }); rm.onclick = () => r.remove(); gBox.append(r); };
    (t.gold || []).forEach(addGold);
    if (t.kind !== "sample") { wrap.append(el("strong", { textContent: "Gold" }), gBox, el("button", { type: "button", className: "btn ghost", textContent: "+ Gold line", onclick: () => addGold(null) })); }
    // diamond / stone lines
    const dBox = el("div", { style: "display:flex;flex-direction:column;gap:6px" });
    const SH = ["Round", "Choki", "Fancy", "Solitaire"];
    const addDia = d => { const q = inp(d ? d.q : "VS GH", 110), sh = sel(SH, (d && d.shape) || "Round", 95), pcs = inp(d ? d.pcs : "", 60, "number"), ct = inp(d ? d.ct : "", 70, "number"), rate = inp(d ? d.rate : 0, 90, "number"), rm = el("button", { type: "button", className: "btn ghost", textContent: "Remove" });
      const r = el("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap" }, [q, sh, pcs, "pcs", ct, "ct", "Rs/ct", rate, rm]);
      r._get = () => { const nq = q.value.trim(), out = { code: d && d.q === nq ? d.code : nq, ct: num(ct.value), pcs: Math.round(num(pcs.value)), q: nq, rate: num(rate.value), shape: sh.value, special: num(rate.value) > 0 }; return out; };
      rm.onclick = () => r.remove(); dBox.append(r); };
    (t.dias || []).forEach(addDia);
    wrap.append(el("strong", { textContent: "Diamonds / stones" }), el("div", { className: "hint", textContent: "Quality (e.g. VS GH, CVD, POLKI), shape, pieces, carats, and own rate per ct (0 = use the default rate table)." }), dBox,
      el("button", { type: "button", className: "btn ghost", textContent: "+ Stone line", onclick: () => addDia(null) }));
    const note = el("p", { className: "hint" });
    const save = el("button", { type: "button", className: "btn", textContent: "Save changes" }), cancel = el("button", { type: "button", className: "btn ghost", textContent: "Cancel", onclick: () => wrap.remove() });
    wrap.append(el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [save, cancel]), note);
    save.onclick = async () => {
      const gold = [...gBox.children].map(r => r._get()).filter(g => g.net > 0);
      const dias = [...dBox.children].map(r => r._get()).filter(d => d.q && (d.ct > 0 || d.pcs > 0));
      if (gold.some(g => g.net > 500) || dias.some(d => d.ct > 200 || d.rate > 5e6)) { note.textContent = "A weight or rate looks wrong - check the numbers."; return; }
      const ppcs = num(fPPcs.value), prate = String(fPRate.value).trim() === "" ? 300 : num(fPRate.value);
      if (!(Number.isInteger(ppcs) && ppcs >= 0 && ppcs <= 10000) || ppcs > 0 && !(Number.isInteger(prate) && prate >= 1 && prate <= 100000)) { note.textContent = "Polki: pieces 0-10,000 and rate per piece Rs 1-1,00,000, whole numbers."; return; }
      const data = { designNo: fDesign.value.trim().slice(0, 30), remark: fRemark.value.trim().slice(0, 120), box: fBox.value.trim().slice(0, 60), other: Object.assign({}, t.other || {}, { amt: Math.max(0, num(fOther.value)) }), dias, polki: ppcs > 0 ? { pcs: ppcs, rate: prate } : null };
      if (t.kind === "sample") data.metal = Object.assign({}, t.metal || {}, { net: Math.max(0, num(fMetal.value)) }); else data.gold = gold;
      const priceChanged = JSON.stringify([t.gold || [], t.dias || [], (t.other && t.other.amt) || 0, (t.metal && t.metal.net) || 0, pk0 ? [pk0.pcs, pk0.rate] : null])
        !== JSON.stringify([data.gold || t.gold || [], dias, data.other.amt, (data.metal && data.metal.net) || (t.metal && t.metal.net) || 0, data.polki ? [data.polki.pcs, data.polki.rate] : null]);
      if (priceChanged && t.code) Object.assign(data, { code: null, priceAtTag: null, gold24gAtTag: null });
      data.editedAt = new Date().toISOString();
      save.disabled = true; note.textContent = "Saving…";
      try {
        const db = await window.claude.use("db"); await db.doc("tags/" + t.id).update(data);
        Object.assign(t, data);
        wrap.remove();
        const go = document.getElementById("cgo"); if (go) go.click();   // the page shows the piece again with the new details
        showMsg(`${t.label} saved.` + (priceChanged && data.code === null ? " The price changed - tap Reprint tag to print the new tag (the old tag's code no longer works)." : ""), "ok");
      } catch (e) { note.textContent = "Could not save: " + (e.message || e.code || "error") + "."; save.disabled = false; }
    };
    card.after(wrap); wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showMsg(text, kind) { const m = document.getElementById("msg"); if (!m) return; m.textContent = ""; const p = el("p", { className: "banner " + (kind || "ok"), textContent: text }); m.appendChild(p); p.scrollIntoView({ behavior: "smooth", block: "center" }); }
  function addButton() {
    const box = document.getElementById("cres"); if (!box || !window.VJ_TAGS) return;
    const card = box.querySelector(".card"); if (!card || card.querySelector(".vjEditBtn")) return;
    const lab = card.querySelector(".labelno"); if (!lab) return;
    const label = lab.textContent.split(" · ").pop().trim(), t = window.VJ_TAGS().find(x => x.label === label); if (!t) return;
    const acts = card.lastElementChild; if (!acts || acts.tagName !== "DIV") return;
    const b = el("button", { type: "button", className: "btn ghost vjEditBtn", textContent: "Edit tag" }); b.onclick = () => editor(t, box, card); acts.append(b);
  }
  function boot() { const box = document.getElementById("cres"); if (!box || !window.VJ_TAGS) return setTimeout(boot, 300); new MutationObserver(addButton).observe(box, { childList: true, subtree: false }); addButton(); }
  boot();
})();
