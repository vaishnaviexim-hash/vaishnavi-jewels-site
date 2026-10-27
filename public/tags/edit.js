/* VJ Tags - "Edit tag" on Price check (owner 14/10/2026). Loaded by shim.js for owners only; the server also refuses
   detail changes from staff (VJ_STAFF_FIELDS), so this button is a convenience, not the security.
   Edits: design no., remark, gold lines (karat + net g), diamond lines (quality, shape, pcs, ct, own rate), polki pcs x rate, other charges,
   sample metal weight. If anything that changes the price is edited, the old price code is cleared so the next
   Reprint tag prints a fresh code and price. Every save is logged on the server (audit) with the owner's email. */
(function () {
  "use strict";
  const KARATS = ["22K", "18K", "14K", "9K"], KNUM = { "22K": "22", "18K": "18", "14K": "14", "9K": "9" };
  /* owner 27/10/2026 12:12 (C-20261027-EDITCAT): category can be changed in Edit tag - same list as the new-tag form */
  const CATS = [["VLR", "Ring (VLR)", "SVLR"], ["VER", "Earrings (VER)", "SVER"], ["VBR", "Bracelet (VBR)", "SVBR"], ["VBN", "Bangle (Vban)", "SVBN"], ["VP", "Pendant (VP)", "SVP"], ["VPS", "Pendant Set (VPS)", "SVPS"], ["VNS", "Necklace Set (VNS)", "SNS"], ["VMN", "Mangalsutra (VMan)", "SVMN"], ["CH", "Chain (Ch)", "SCH"], ["VNP", "Nose Pin (VNP)", "SVNP"]].map(([id, name, smp]) => ({ id, name, smp }));
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const num = v => { const n = parseFloat(String(v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
  const inp = (val, w, type) => el("input", { value: val == null ? "" : String(val), type: type || "text", style: `width:${w || 90}px;min-width:0`, inputMode: type === "number" ? "decimal" : "text" });
  const sel = (opts, val, w) => { const s = el("select", { style: `width:${w || 90}px` }); opts.forEach(o => s.append(el("option", { value: o, textContent: o, selected: o === val }))); if (val && !opts.includes(val)) s.append(el("option", { value: val, textContent: val, selected: true })); return s; };

  function editor(t, box, card) {
    const old = document.getElementById("vjEdit"); if (old) old.remove();
    const wrap = el("div", { id: "vjEdit", className: "card" }); wrap.style.cssText = "border:2px solid #b8963e;border-radius:var(--r,10px);padding:14px;margin-top:10px;display:flex;flex-direction:column;gap:10px";
    wrap.append(el("h2", { textContent: "Edit " + t.label }));
    const fCat = el("select", { style: "width:190px" }); CATS.forEach(c => fCat.append(el("option", { value: c.id, textContent: c.name, selected: c.id === t.cat })));
    if (!CATS.some(c => c.id === t.cat)) fCat.prepend(el("option", { value: t.cat || "", textContent: (t.catName || t.cat || "?") + " (old)", selected: true }));
    const catNote = el("div", { className: "hint", textContent: "" });
    fCat.onchange = () => { catNote.textContent = fCat.value !== t.cat ? "New category: the piece gets a new label number in that category when you save. The old QR on the printed tag keeps working; reprint the tag." : ""; };
    wrap.append(el("div", { className: "row", style: "display:flex;gap:10px;flex-wrap:wrap;align-items:end" }, [el("label", { style: "display:flex;flex-direction:column;gap:4px" }, ["Category", fCat]), catNote]));
    const fDesign = inp(t.designNo, 140), fRemark = inp(t.remark, 220), fOther = inp((t.other && t.other.amt) || 0, 110, "number"), fBox = inp(t.box, 200);
    const row = (label, f) => el("label", { style: "display:flex;flex-direction:column;gap:4px" }, [label, f]);
    wrap.append(el("div", { className: "row", style: "display:flex;gap:10px;flex-wrap:wrap" }, [row("Design no.", fDesign), row("Remark", fRemark), row("Other charges (Rs)", fOther), row("Packet / box", fBox)]));
    // polki pieces x rate per piece (C-20261017-POLKI); 0 pcs = no polki
    const pk0 = t.polki && t.polki.pcs > 0 ? t.polki : null, fPPcs = inp(pk0 ? pk0.pcs : "", 90, "number"), fPRate = inp(pk0 ? pk0.rate : 300, 110, "number");
    wrap.append(el("div", { className: "row", style: "display:flex;gap:10px;flex-wrap:wrap" }, [row("Polki pcs", fPPcs), row("Polki rate per pc (Rs)", fPRate)]));
    // party (customer's own) diamonds + certificate no. (C-20261026-PARTYDIA, owner 26/10 18:14)
    const pd0 = t.pdia && t.pdia.ct > 0 ? t.pdia : null, fPdCt = inp(pd0 ? pd0.ct : "", 90, "number"), fPdPcs = inp(pd0 ? pd0.pcs : "", 80, "number"), fPdRate = inp(pd0 ? pd0.rate : 3000, 110, "number"), fCert = inp(t.certNo || "", 180);
    wrap.append(el("div", { className: "row", style: "display:flex;gap:10px;flex-wrap:wrap" }, [row("Party diamond ct", fPdCt), row("Party diamond pcs", fPdPcs), row("Setting Rs/ct", fPdRate), row("Certificate no. (IGI etc.)", fCert)]));
    let fMetal = null;
    if (t.kind === "sample") { fMetal = inp((t.metal && t.metal.net) || 0, 110, "number"); wrap.append(row("Sample weight (g, priced as 14K)", fMetal)); }
    // gold lines
    const gBox = el("div", { style: "display:flex;flex-direction:column;gap:6px" });
    // C-20261017-CHAINTUNCH (owner 17/10/2026): a gold line with a tunch is a chain line (net x tunch x fine rate, no making); empty = not a chain
    const addGold = g => { const k = sel(KARATS, (g && g.k) || "14K", 80), n = inp(g ? g.net : "", 100, "number"), tn = inp(g && g.tunch > 0 ? g.tunch : "", 90, "number"), rm = el("button", { type: "button", className: "btn ghost", textContent: "Remove" });
      tn.placeholder = t.cat === "CH" ? "tunch 0.920" : "chain tunch";
      const r = el("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap" }, [k, n, "g", tn, rm]);
      r._get = () => { const o = { k: k.value, net: num(n.value) }; if (String(tn.value).trim() !== "") o.tunch = Math.round(num(tn.value) * 1000) / 1000; return o; }; rm.onclick = () => r.remove(); gBox.append(r); };
    (t.gold || []).forEach(addGold);
    if (t.kind !== "sample") { wrap.append(el("strong", { textContent: "Gold" }), gBox, el("button", { type: "button", className: "btn ghost", textContent: "+ Gold line", onclick: () => addGold(null) })); }
    // diamond / stone lines
    const dBox = el("div", { style: "display:flex;flex-direction:column;gap:6px" });
    const SH = ["Round", "Choki", "Fancy", "Solitaire", "Polki"];
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
      if (gold.some(g => g.tunch !== undefined && !(g.tunch >= 0.3 && g.tunch <= 1.1))) { note.textContent = "Chain tunch must be from 0.300 to 1.100 (e.g. 0.920), or empty if the line is not a chain."; return; }
      if (t.cat === "CH" && t.kind !== "sample" && gold.some(g => g.tunch === undefined)) { note.textContent = "Chain: type the tunch on each gold line (e.g. 0.920)."; return; }
      const ppcs = num(fPPcs.value), prate = String(fPRate.value).trim() === "" ? 300 : num(fPRate.value);
      if (!(Number.isInteger(ppcs) && ppcs >= 0 && ppcs <= 10000) || ppcs > 0 && !(Number.isInteger(prate) && prate >= 1 && prate <= 100000)) { note.textContent = "Polki: pieces 0-10,000 and rate per piece Rs 1-1,00,000, whole numbers."; return; }
      const pdct = Math.round(num(fPdCt.value) * 1000) / 1000, pdpcs = Math.round(num(fPdPcs.value) || 0), pdrate = String(fPdRate.value).trim() === "" ? 3000 : num(fPdRate.value);
      if (pdct > 0 && !(pdct <= 1000 && Number.isInteger(pdrate) && pdrate >= 1 && pdrate <= 100000)) { note.textContent = "Party diamond: carats up to 1,000 and setting rate per ct Rs 1-1,00,000, whole rupees."; return; }
      const data = { pdia: pdct > 0 ? { ct: pdct, pcs: pdpcs, rate: pdrate } : null, certNo: fCert.value.trim().toUpperCase().slice(0, 30), designNo: fDesign.value.trim().slice(0, 30), remark: fRemark.value.trim().slice(0, 120), box: fBox.value.trim().slice(0, 60), other: Object.assign({}, t.other || {}, { amt: Math.max(0, num(fOther.value)) }), dias, polki: ppcs > 0 ? { pcs: ppcs, rate: prate } : null };
      if (t.kind === "sample") data.metal = Object.assign({}, t.metal || {}, { net: Math.max(0, num(fMetal.value)) }); else data.gold = gold;
      const priceChanged = JSON.stringify([t.gold || [], t.dias || [], (t.other && t.other.amt) || 0, (t.metal && t.metal.net) || 0, pk0 ? [pk0.pcs, pk0.rate] : null])
        !== JSON.stringify([data.gold || t.gold || [], dias, data.other.amt, (data.metal && data.metal.net) || (t.metal && t.metal.net) || 0, data.polki ? [data.polki.pcs, data.polki.rate] : null]) || JSON.stringify(pd0 ? [pd0.ct, pd0.rate] : null) !== JSON.stringify(data.pdia ? [data.pdia.ct, data.pdia.rate] : null);
      // C-20261027-EDITCAT: category and main karat decide the printed code (VBN18) and the label series (VBN18/7)
      const cat = CATS.find(c => c.id === fCat.value), gl = (data.gold || t.gold || []), g1 = gl.find(g => g.net > 0 && g.k !== "Chain") || gl.find(g => g.k !== "Chain"), gc = gl.find(g => g.k === "Chain" && g.tunch > 0);
      const mainK = g1 ? g1.k : gc ? (gc.tunch >= 0.88 ? "22K" : gc.tunch >= 0.7 ? "18K" : gc.tunch >= 0.5 ? "14K" : "9K") : "14K";
      let catChanged = false;
      if (cat && cat.id !== t.cat) { catChanged = true; Object.assign(data, { cat: cat.id, catName: cat.name.replace(/\s*\(.*\)$/, "") }); }
      if (cat && (catChanged || t.pcode)) {
        const kn = t.kind === "sample" ? ((String(t.pcode || "").match(/^[A-Z]+(\d+)/) || [])[1] || "14") : KNUM[mainK];
        data.pcode = cat.id + kn + (t.kind === "sample" ? "/" + (t.karigar || "") : "");
        const prefix = t.kind === "sample" ? cat.smp : cat.id + kn;
        if (prefix !== t.prefix) data.prefix = prefix;
      }
      if ((priceChanged || catChanged || (data.pcode && data.pcode !== t.pcode)) && t.code) Object.assign(data, { code: null, priceAtTag: null, gold24gAtTag: null });
      data.editedAt = new Date().toISOString();
      save.disabled = true; note.textContent = "Saving…";
      try {
        const db = await window.claude.use("db");
        if (data.prefix) {
          const cref = db.doc("counters/main"), me = "edit" + Math.random();
          let lease = await cref.acquire({ holder: me, ttlMs: 8000 });
          for (let i = 0; i < 5 && !lease.acquired; i++) { await new Promise(r => setTimeout(r, 700 + Math.random() * 500)); lease = await cref.acquire({ holder: me, ttlMs: 8000 }); }
          if (!lease.acquired) throw { message: "Someone else is saving a tag right now. Try again in a few seconds" };
          const snap = await cref.get(), last = Object.assign({}, (snap.exists && snap.data().last) || {}), all = window.VJ_TAGS();
          let no = Math.max(last[data.prefix] || 0, ...all.filter(x => x.prefix === data.prefix).map(x => x.no || 0)) + 1;
          const used = n => all.some(x => x.label === data.prefix + "/" + n) || false;
          for (;;) { if (!used(no) && !(await db.doc("tags/" + (data.prefix + "-" + no).replace(/[^A-Za-z0-9_\-.~:@+]/g, "_")).get()).exists) break; no++; }
          Object.assign(data, { no, label: data.prefix + "/" + no, formerLabels: [...(t.formerLabels || []), t.label] });
          await db.doc("tags/" + t.id).update(data);
          last[data.prefix] = Math.max(last[data.prefix] || 0, no); await cref.set({ last });
        } else await db.doc("tags/" + t.id).update(data);
        Object.assign(t, data);
        wrap.remove();
        const go = document.getElementById("cgo"); if (go) go.click();   // the page shows the piece again with the new details
        showMsg((data.formerLabels ? `Now ${data.label} (was ${data.formerLabels[data.formerLabels.length - 1]}) - ${data.catName || t.catName}.` : `${t.label} saved.`) + (data.code === null ? " The price or printed code changed - tap Reprint tag to print the new tag (the old tag's code no longer works)." : ""), "ok");
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
