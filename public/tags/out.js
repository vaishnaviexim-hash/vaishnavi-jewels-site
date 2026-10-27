/* VJ Tags - Karigar & Out (owner Abhinav 27/10/2026 11:15-11:18, C-20261027-KARIGAROUT).
   One tab for everything that is not sitting in the showroom:
   1. Send out  - our own pieces to a karigar (Montu, Hiru, Badshah, Ramesh: repair, polish...) or to an exhibition / other place.
                  Scan the tag QR, type the tag no. / design no., or pull the RFID trigger: every piece read is added to the list.
   2. Out now   - where every piece is (with photo), since when; receive back one by one, by scanning, or all at once.
                  For an exhibition, scanning what came back shows what is still missing (and what was sold there).
   3. Party repair - a customer's own piece: received (In Surat) -> karigar -> back (extra gold, karigar Rs) -> returned to party.
                  Customer charge = karigar total rounded UP to Rs 500, x 2 (owner rule), editable.
   4. Who has what - per karigar: our pieces + party repairs; and what is In Surat. Printable in large font.
   5. RFID link - read the tag QR, then the RFID chip: the chip number is saved on that tag.
   The server checks every action (owner, staff, Shyam's tagger login and the Vaishnavi office login only).
   Built with DOM nodes only (no HTML from data). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); if (props) for (const k in props) { if (k === "style") e.style.cssText = props[k]; else e[k] = props[k]; } (kids || []).forEach(k => k != null && e.append(k)); return e; };
  const dmy = d => { const s = String(d || "").slice(0, 10); return s ? s.split("-").reverse().join("-") : ""; };
  const fmt = n => "Rs " + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const N = x => String(x == null ? "" : x).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const days = iso => { const t = Date.parse(iso || ""); return t ? Math.max(0, Math.floor((Date.now() - t) / 864e5)) : 0; };
  const say = (t, k) => { try { if (typeof msg === "function") return msg(t, k); } catch (e) {} alert(t); };
  let KAR = ["Montu", "Hiru", "Badshah", "Ramesh"], WHY = ["Repair", "Polish", "Resize", "Stone setting", "Rhodium", "Other"];
  let OWNER = false, REP = [], sec = null, sub = "send", timer = 0;
  const over = new Map(); // id -> {out, until}: shows a send / return at once, before the next sync arrives

  async function api(path, body) {
    const r = await fetch(path, body ? { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { credentials: "same-origin", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || ("server " + r.status)), { status: r.status, body: j });
    return j;
  }
  async function upPhoto(file) {
    let blob = file; try { if (typeof shrinkPhoto === "function") blob = await shrinkPhoto(file); } catch (e) {}
    const r = await fetch("/api/vj/photo", { method: "POST", credentials: "same-origin", headers: { "content-type": blob.type || "image/jpeg" }, body: blob });
    if (!r.ok) throw new Error("photo not saved"); return (await r.json()).id;
  }
  function all() {
    const list = window.VJ_TAGS_ALL ? window.VJ_TAGS_ALL() : [];
    const now = Date.now();
    return list.map(t => { const o = over.get(t.id); if (o && o.until > now) { const c = Object.assign({}, t); if (o.out) c.out = o.out; else delete c.out; return c; } return t; });
  }
  const name = t => (t.designNo ? t.designNo + " · " : "") + (t.label || t.id) + (t.catName ? " · " + t.catName : "");
  const gwt = t => (t.gold || []).reduce((a, g) => a + (Number(g && g.net) || 0), 0);
  const where = o => !o ? "" : o.kind === "karigar" ? o.name + " (karigar" + (o.why ? ", " + o.why : "") + ")" : o.kind === "exhibition" ? "Exhibition: " + o.name : o.name;
  const thumb = (id, sz) => id ? el("img", { alt: "", src: "/_blob/" + id, loading: "lazy", style: `width:${sz}px;height:${sz}px;object-fit:cover;border-radius:6px;flex:none` })
    : el("div", { className: "hint", textContent: "no photo", style: `width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--line);border-radius:6px;font-size:11px;flex:none` });

  /* scan text -> tag. Accepts the tag QR ("…/tags#VLR14-809"), the 11-digit price code, tag no. (809), label, design no., RFID EPC */
  function find(raw) {
    let q = String(raw || "").trim().replace(/\s+/g, ""); if (!q) return { none: true };
    if (q.includes("#")) q = q.slice(q.lastIndexOf("#") + 1);
    const ts = all().filter(t => t.status !== "sold"), nq = N(q);
    let hit = ts.filter(t => t.epc && t.epc === nq);
    if (!hit.length && /^[a-z]{3}\d+[a-z]{3}$/i.test(q)) hit = ts.filter(t => t.code && t.code.toLowerCase() === q.toLowerCase());
    if (!hit.length) hit = ts.filter(t => N(t.id) === nq || N(t.label) === nq);
    if (!hit.length && /^\d{1,6}$/.test(q)) hit = ts.filter(t => String(t.no) === String(+q));
    if (!hit.length) hit = ts.filter(t => t.designNo && N(t.designNo) === nq);
    if (hit.length === 1) return { t: hit[0] };
    if (hit.length > 1) return { many: hit, q };
    return { q, rfid: /^[0-9A-F]{16,64}$/.test(nq) && /[A-F]/.test(nq) || nq.length >= 20 };
  }
  /* a scan box: Enter (keyboard, barcode or RFID reader in keyboard mode) or a pasted list of many lines */
  function scanBox(ph, onHit) {
    const inp = el("input", { placeholder: ph, autocomplete: "off", autocapitalize: "off", spellcheck: false, style: "flex:1;min-width:200px;font-size:18px;padding:10px" });
    const go = () => { const v = inp.value; inp.value = ""; v.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean).forEach(onHit); inp.focus(); };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    inp.addEventListener("paste", () => setTimeout(() => { if (/[\r\n]/.test(inp.value)) go(); }, 0));
    const b = el("button", { type: "button", className: "btn", textContent: "Add" }); b.addEventListener("click", go);
    return { box: el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center" }, [inp, b]), inp };
  }
  function chooser(list, pick) {
    const w = el("div", { className: "card", style: "padding:10px;margin:8px 0" }, [el("p", { textContent: list.length + " pieces match. Tap the right one:" })]);
    list.forEach(t => { const b = el("button", { type: "button", className: "btn ghost", textContent: name(t), style: "margin:3px" }); b.addEventListener("click", () => { w.remove(); pick(t); }); w.append(b); });
    return w;
  }
  const opts = (sel, vals, cur) => { sel.textContent = ""; vals.forEach(v => sel.append(el("option", { value: v, textContent: v }))); if (cur != null) sel.value = cur; return sel; };
  const lab = (t, f) => el("label", { style: "display:flex;flex-direction:column;gap:4px;font-weight:600" }, [t, f]);

  /* ---------------- 1. Send out ---------------- */
  const basket = new Map();
  function paneSend(host) {
    const kind = opts(el("select"), ["Karigar", "Exhibition", "Other place"], "Karigar");
    const kar = opts(el("select"), KAR), why = opts(el("select"), WHY, "Repair");
    const exh = el("input", { placeholder: "Exhibition name, e.g. Mathura Nov 2026", maxLength: 60, autocomplete: "off" });
    const dl = el("datalist", { id: "koExh" }); exh.setAttribute("list", "koExh");
    const oth = el("input", { placeholder: "Where / who (e.g. Customer approval - Shah)", maxLength: 60 });
    const note = el("input", { placeholder: "Note (optional)", maxLength: 200 });
    const ph = el("input", { type: "file", accept: "image/*" }); ph.setAttribute("capture", "environment");
    const wK = lab("Karigar", kar), wW = lab("Work", why), wE = lab("Exhibition", exh), wO = lab("Place", oth);
    const sync = () => { const k = kind.value; wK.hidden = wW.hidden = k !== "Karigar"; wE.hidden = k !== "Exhibition"; wO.hidden = k !== "Other place"; };
    kind.addEventListener("change", sync); sync();
    const list = el("div"), info = el("p", { className: "hint" }), warn = el("div");
    const send = el("button", { type: "button", className: "btn", textContent: "Send out", style: "font-size:17px;padding:10px 18px" });
    const clear = el("button", { type: "button", className: "btn ghost", textContent: "Clear list" });
    const draw = () => {
      list.textContent = ""; const ts = [...basket.values()];
      info.textContent = ts.length ? `${ts.length} piece${ts.length > 1 ? "s" : ""} on the list · ${ts.reduce((a, t) => a + gwt(t), 0).toFixed(3)} g gold` : "Scan or type the pieces going out. With the RFID reader, just pull the trigger near the tray.";
      send.disabled = !ts.length; send.textContent = ts.length ? `Send ${ts.length} out` : "Send out";
      ts.slice().reverse().forEach(t => { const x = el("button", { type: "button", className: "x", textContent: "✕", "aria-label": "Remove" }); x.addEventListener("click", () => { basket.delete(t.id); draw(); });
        list.append(el("div", { style: "display:flex;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)" }, [thumb(t.photo, 48), el("div", { style: "flex:1" }, [el("div", { textContent: name(t), style: "font-weight:600" }), el("div", { className: "hint", textContent: (gwt(t) ? gwt(t).toFixed(3) + " g" : "") + (t.box ? " · box " + t.box : "") })]), x])); });
    };
    const add = raw => { const f = find(raw);
      if (f.t) { if (f.t.out) { warn.prepend(el("p", { className: "banner warn", textContent: `${name(f.t)} is already out: ${where(f.t.out)}. Receive it back first.` })); return; } basket.set(f.t.id, f.t); draw(); return; }
      if (f.many) { warn.prepend(chooser(f.many, t => { basket.set(t.id, t); draw(); })); return; }
      if (!f.none) warn.prepend(el("p", { className: "banner warn", textContent: f.rfid ? `RFID chip ${f.q} is not linked to any tag yet - link it in "RFID link".` : `No piece found for "${f.q}".` }));
      while (warn.children.length > 4) warn.lastChild.remove(); };
    const sc = scanBox("Scan QR / RFID, or type tag no. / design no. + Enter", add);
    clear.addEventListener("click", () => { basket.clear(); warn.textContent = ""; draw(); });
    send.addEventListener("click", async () => {
      const k = kind.value, ids = [...basket.keys()]; if (!ids.length) return;
      const body = { act: "out", ids, note: note.value, kind: k === "Karigar" ? "karigar" : k === "Exhibition" ? "exhibition" : "other", name: k === "Karigar" ? kar.value : k === "Exhibition" ? exh.value.trim() : oth.value.trim(), why: k === "Karigar" ? why.value : "" };
      if (!body.name) { say(k === "Exhibition" ? "Type the exhibition name." : "Type where it is going.", "warn"); return; }
      send.disabled = true;
      try { if (ph.files && ph.files[0]) body.photo = await upPhoto(ph.files[0]);
        const r = await api("/api/vj/move", body), o = { kind: body.kind, name: body.name, why: body.why, note: body.note, at: new Date().toISOString() };
        r.done.forEach(id => over.set(id, { out: o, until: Date.now() + 90e3 }));
        say(`${r.done.length} piece${r.done.length === 1 ? "" : "s"} sent out to ${where(o)}.` + (r.skipped.length ? " Not sent: " + r.skipped.join(", ") : ""), r.skipped.length ? "warn" : "ok");
        basket.clear(); note.value = ""; ph.value = ""; warn.textContent = ""; draw();
      } catch (e) { say("Not sent: " + e.message, "bad"); }
      send.disabled = !basket.size;
    });
    const pastEx = [...new Set(all().filter(t => t.out && t.out.kind === "exhibition").map(t => t.out.name))]; pastEx.forEach(x => dl.append(el("option", { value: x })));
    host.append(el("div", { className: "row", style: "display:flex;gap:12px;flex-wrap:wrap" }, [lab("Going to", kind), wK, wW, wE, wO, dl]),
      el("div", { style: "display:flex;gap:12px;flex-wrap:wrap;margin-top:8px" }, [lab("Note", note), lab("Photo of the lot (optional)", ph)]),
      el("h3", { textContent: "Pieces", style: "margin:14px 0 6px" }), sc.box, warn, info, list, el("div", { style: "display:flex;gap:8px;margin-top:12px" }, [send, clear]));
    draw(); setTimeout(() => sc.inp.focus(), 50);
  }

  /* ---------------- 2. Out now ---------------- */
  function groupsOut() {
    const g = new Map();
    all().filter(t => t.out).forEach(t => { const k = t.out.kind + "|" + t.out.name; if (!g.has(k)) g.set(k, []); g.get(k).push(t); });
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  async function back(ids, note) {
    const r = await api("/api/vj/move", { act: "in", ids, note: note || "" });
    r.done.forEach(id => over.set(id, { out: null, until: Date.now() + 90e3 }));
    say(`${r.done.length} piece${r.done.length === 1 ? "" : "s"} received back in the showroom.` + (r.skipped.length ? " Skipped: " + r.skipped.join(", ") : ""), "ok");
  }
  function paneOut(host) {
    const gs = groupsOut(), total = gs.reduce((a, [, v]) => a + v.filter(t => t.status !== "sold").length, 0);
    host.append(el("p", { className: "hint", textContent: total ? `${total} of our pieces are out right now.` : "All our pieces are in the showroom." }));
    gs.forEach(([k, ts]) => {
      const o = ts[0].out, live = ts.filter(t => t.status !== "sold"), sold = ts.filter(t => t.status === "sold");
      const card = el("div", { className: "card", style: "margin:12px 0;padding:12px 14px" });
      const seen = new Set();
      const head = el("div", { style: "display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center" }, [
        el("div", {}, [el("strong", { textContent: where(o), style: "font-size:17px" }), el("div", { className: "hint", textContent: `${live.length} pcs · ${live.reduce((a, t) => a + gwt(t), 0).toFixed(3)} g` + (sold.length ? ` · ${sold.length} sold there` : "") })])]);
      const recv = el("button", { type: "button", className: "btn ghost", textContent: "Receive by scanning" });
      const allB = el("button", { type: "button", className: "btn ghost", textContent: "All " + live.length + " back" });
      const pr = el("button", { type: "button", className: "btn ghost", textContent: "Print list" });
      head.append(el("div", { style: "display:flex;gap:6px;flex-wrap:wrap" }, [recv, allB, pr]));
      card.append(head);
      const rows = el("div");
      const draw = () => { rows.textContent = "";
        ts.forEach(t => { const isS = t.status === "sold", got = seen.has(t.id);
          const b = el("button", { type: "button", className: "btn ghost", textContent: "Back in" });
          b.addEventListener("click", async () => { b.disabled = true; try { await back([t.id]); render(); } catch (e) { b.disabled = false; say("Not saved: " + e.message, "bad"); } });
          rows.append(el("div", { style: "display:flex;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)" + (got ? ";background:rgba(46,125,50,.10)" : "") }, [thumb(t.photo || t.out.photo, 56),
            el("div", { style: "flex:1" }, [el("div", { textContent: name(t), style: "font-weight:600" }), el("div", { className: "hint", textContent: [gwt(t) ? gwt(t).toFixed(3) + " g" : "", "since " + dmy(t.out.at) + " (" + days(t.out.at) + " d)", t.out.note || "", isS ? "SOLD" : got ? "✓ scanned back" : ""].filter(Boolean).join(" · ") })]),
            isS ? el("span", { className: "pill", textContent: "Sold" }) : b])); }); };
      draw(); card.append(rows);
      allB.addEventListener("click", async () => { if (!confirm(`Receive all ${live.length} pieces back from ${where(o)}?`)) return; allB.disabled = true; try { await back(live.map(t => t.id)); render(); } catch (e) { allB.disabled = false; say("Not saved: " + e.message, "bad"); } });
      recv.addEventListener("click", () => {
        if (card.querySelector(".koRecv")) return;
        const st = el("p", { className: "hint" }), ok = el("button", { type: "button", className: "btn", textContent: "Save received" });
        const upd = () => { const miss = live.filter(t => !seen.has(t.id)); st.textContent = `Scanned back ${seen.size} of ${live.length}.` + (miss.length && seen.size ? ` Still missing: ${miss.length} - ${miss.slice(0, 12).map(t => t.designNo || t.label).join(", ")}${miss.length > 12 ? "…" : ""}` : ""); ok.disabled = !seen.size; draw(); };
        const sc = scanBox("Scan the pieces that came back", raw => { const f = find(raw), t = f.t || (f.many || []).find(x => live.includes(x)) ;
          if (t && live.some(x => x.id === t.id)) { seen.add(t.id); upd(); } else say(t ? `${name(t)} is not in this lot.` : `Not found: ${raw}`, "warn"); });
        ok.addEventListener("click", async () => { ok.disabled = true; try { await back([...seen]); render(); } catch (e) { ok.disabled = false; say("Not saved: " + e.message, "bad"); } });
        card.insertBefore(el("div", { className: "koRecv", style: "margin:10px 0;display:flex;flex-direction:column;gap:8px" }, [sc.box, st, ok]), rows); upd(); sc.inp.focus();
      });
      pr.addEventListener("click", () => printList(where(o), [["Piece", "Gold g", "Out since", "Note"]].concat(ts.map(t => [name(t) + (t.status === "sold" ? " (SOLD)" : ""), gwt(t) ? gwt(t).toFixed(3) : "", dmy(t.out.at), t.out.note || ""]))));
      host.append(card);
    });
    // recent history
    const hb = el("button", { type: "button", className: "btn ghost", textContent: "Show last 30 days of movements" }), hist = el("div");
    hb.addEventListener("click", async () => { hb.disabled = true; try { const j = await api("/api/vj/moves?days=30"); hist.textContent = "";
      const tb = el("table", { className: "items", style: "min-width:520px" }, [el("thead", {}, [el("tr", {}, ["When", "Piece", "", "Where", "By"].map(h => el("th", { textContent: h })))])]), bd = el("tbody");
      const byId = new Map(all().map(t => [t.id, t]));
      j.moves.forEach(m => bd.append(el("tr", {}, [el("td", { textContent: new Date(m.ts).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) }), el("td", { textContent: byId.get(m.tag) ? name(byId.get(m.tag)) : m.tag }),
        el("td", { textContent: m.act === "out" ? "Out →" : m.act === "in" ? "← Back" : "RFID linked" }), el("td", { textContent: m.act === "rfid" ? m.note : where(m) }), el("td", { textContent: String(m.email || "").split("@")[0] })])));
      tb.append(bd); hist.append(el("div", { className: "list" }, [tb])); } catch (e) { say("Could not load: " + e.message, "bad"); } hb.disabled = false; });
    host.append(hb, hist);
  }

  /* ---------------- 3. Party repair ---------------- */
  const ST = { surat: "In Surat (with us)", karigar: "With karigar", ready: "Back - ready for party", delivered: "Returned to party", cancelled: "Cancelled" };
  async function loadRep() { const j = await api("/api/vj/repairs"); REP = j.repairs || []; KAR = j.karigars || KAR; WHY = j.whys || WHY; OWNER = !!j.owner; }
  function paneRepair(host) {
    // new job
    const f = { party: el("input", { maxLength: 60, placeholder: "Party name" }), mobile: el("input", { maxLength: 15, inputMode: "tel", placeholder: "Mobile" }), city: el("input", { maxLength: 40, placeholder: "City" }),
      item: el("input", { maxLength: 60, placeholder: "e.g. Diamond ring, Polki necklace" }), gross: el("input", { type: "number", step: "0.001", min: "0", placeholder: "0.000", inputMode: "decimal" }),
      karat: opts(el("select"), ["", "22K", "18K", "14K", "9K"], ""), work: el("input", { maxLength: 200, placeholder: "What to repair (e.g. 2 stones missing, resize to 14)" }),
      promised: el("input", { type: "date" }), photo: el("input", { type: "file", accept: "image/*" }) };
    f.photo.setAttribute("capture", "environment");
    const save = el("button", { type: "button", className: "btn", textContent: "Receive piece" });
    const form = el("div", { className: "card", style: "padding:12px 14px;margin-bottom:12px" }, [el("h3", { textContent: "New party repair (piece received)" }),
      el("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px" }, [lab("Party", f.party), lab("Mobile", f.mobile), lab("City", f.city), lab("Piece", f.item), lab("Gross wt received (g)", f.gross), lab("Karat", f.karat), lab("Promised date", f.promised), lab("Photo", f.photo)]),
      el("div", { style: "margin-top:10px" }, [lab("Repair needed", f.work)]), el("div", { style: "margin-top:10px" }, [save])]);
    save.addEventListener("click", async () => { save.disabled = true;
      try { const b = { op: "new", party: f.party.value, mobile: f.mobile.value, city: f.city.value, item: f.item.value, gross: f.gross.value, karat: f.karat.value, work: f.work.value, promised: f.promised.value };
        if (f.photo.files && f.photo.files[0]) b.photo = await upPhoto(f.photo.files[0]);
        const r = await api("/api/vj/repair", b); say(`Repair job R${r.no} saved for ${b.party}. Write R${r.no} on the packet.`, "ok"); await loadRep(); render();
      } catch (e) { say("Not saved: " + e.message, "bad"); save.disabled = false; } });
    host.append(form);
    // list
    const q = el("input", { placeholder: "Search party, mobile, job no., karigar", maxLength: 40, style: "flex:1" }), stSel = opts(el("select"), ["Open jobs", "In Surat", "With karigar", "Ready", "Returned", "All"], "Open jobs");
    const box = el("div");
    const draw = () => { box.textContent = ""; const s = q.value.trim().toLowerCase(), m = { "Open jobs": ["surat", "karigar", "ready"], "In Surat": ["surat"], "With karigar": ["karigar"], "Ready": ["ready"], "Returned": ["delivered"], "All": Object.keys(ST) }[stSel.value];
      const list = REP.filter(r => m.includes(r.status) && (!s || [r.party, r.mobile, "r" + r.no, r.karigar, r.item, r.city].some(x => String(x || "").toLowerCase().includes(s))));
      if (!list.length) box.append(el("p", { className: "hint", textContent: "No jobs here." }));
      list.forEach(r => box.append(jobCard(r))); };
    q.addEventListener("input", draw); stSel.addEventListener("change", draw);
    host.append(el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center" }, [q, stSel]), box); draw();
  }
  function jobCard(r) {
    const c = el("div", { className: "card", style: "margin:10px 0;padding:12px 14px" });
    const late = r.promised && !["delivered", "cancelled"].includes(r.status) && r.promised < new Date().toISOString().slice(0, 10);
    c.append(el("div", { style: "display:flex;gap:12px;align-items:flex-start" }, [thumb(r.photo, 72), el("div", { style: "flex:1" }, [
      el("div", {}, [el("strong", { textContent: "R" + r.no + " · " + r.party, style: "font-size:16px" }), el("span", { className: "hint", textContent: [r.city, r.mobile].filter(Boolean).map(x => " · " + x).join("") })]),
      el("div", { textContent: r.item + " · " + r.gross + " g" + (r.karat ? " " + r.karat : "") + (r.work ? " · " + r.work : "") }),
      el("div", { className: "hint", textContent: "Received " + dmy(r.inAt) + (r.promised ? " · promised " + dmy(r.promised) + (late ? " (LATE)" : "") : "") }),
      el("div", { style: "margin-top:4px" }, [el("span", { className: "pill", textContent: ST[r.status] + (r.status === "karigar" ? ": " + r.karigar + " since " + dmy(r.kOutAt) + " (" + days(r.kOutAt) + " d)" : "") })])])]));
    const t = el("table", { className: "sum", style: "margin-top:8px" }); const row = (a, b) => t.append(el("tr", {}, [el("td", { textContent: a }), el("td", { textContent: b })]));
    if (r.karigar) row("Karigar", r.karigar + (r.kWork ? " - " + r.kWork : ""));
    if (r.kBackAt) { if (r.extraGold) row("Gold added / less", (r.extraGold > 0 ? "+" : "") + r.extraGold + " g " + (r.extraKarat || "")); if (r.grossBack != null) row("Gross wt back", r.grossBack + " g");
      if (OWNER) { row("Paid to karigar", fmt(r.kAmt)); if (r.goldVal) row("Gold value", fmt(r.goldVal)); row("Karigar total", fmt(r.kTotal)); } }
    if (r.charge != null && r.kBackAt || r.status === "delivered") row("Charge to party", fmt(r.charge || 0) + (r.chargeSuggest && r.charge !== r.chargeSuggest ? " (rule: " + fmt(r.chargeSuggest) + ")" : ""));
    if (r.status === "delivered") row("Returned", dmy(r.outAt) + (r.outNote ? " · " + r.outNote : ""));
    if (t.children.length) c.append(t);
    const acts = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:8px" }), work = el("div");
    const act = async (b, btn) => { if (btn) btn.disabled = true; try { await api("/api/vj/repair", Object.assign({ id: r.id, version: r.version }, b)); await loadRep(); render(); } catch (e) { if (btn) btn.disabled = false; say(e.status === 409 ? "Someone changed this job just now - try again." : "Not saved: " + e.message, "bad"); } };
    if (r.status === "surat" || r.status === "ready" && !r.kBackAt) {
      const k = opts(el("select"), KAR), w = el("input", { placeholder: "Work for karigar", maxLength: 200, value: r.work || "" }), b = el("button", { type: "button", className: "btn", textContent: "Give to karigar" });
      b.addEventListener("click", () => act({ op: "karigar", karigar: k.value, work: w.value }, b)); acts.append(k, w, b);
    }
    if (r.status === "karigar") {
      const b = el("button", { type: "button", className: "btn", textContent: "Back from " + r.karigar });
      b.addEventListener("click", () => { work.textContent = "";
        const xg = el("input", { type: "number", step: "0.001", placeholder: "0 (minus if less)", inputMode: "decimal" }), xk = opts(el("select"), ["22K", "18K", "14K", "9K"], r.karat || "18K"),
          amt = el("input", { type: "number", step: "1", min: "0", placeholder: "Rs", inputMode: "numeric" }), gb = el("input", { type: "number", step: "0.001", min: "0", placeholder: "g", inputMode: "decimal" }),
          prev = el("p", { className: "hint" }), ok = el("button", { type: "button", className: "btn", textContent: "Save - piece is back" });
        const pv = () => { const s = typeof st === "function" ? st() : {}, rate = (s.gold24g || 0) * ((s.purity || {})[xk.value] || 0), tot = (Number(amt.value) || 0) + Math.round((Number(xg.value) || 0) * rate);
          prev.textContent = tot > 0 ? `Charge to party (round up to Rs 500, x 2): ${fmt(Math.ceil(tot / 500) * 500 * 2)}` : ""; };
        [xg, xk, amt].forEach(x => x.addEventListener("input", pv));
        ok.addEventListener("click", () => act({ op: "back", extraGold: xg.value || 0, extraKarat: xk.value, kAmt: amt.value || 0, grossBack: gb.value }, ok));
        work.append(el("div", { className: "card", style: "padding:10px;margin-top:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px" }, [lab("Gold added (g)", xg), lab("Karat", xk), lab("Paid to karigar (Rs)", amt), lab("Gross wt now (g)", gb)]), prev, ok); });
      acts.append(b);
    }
    if (r.status === "ready" && r.kBackAt) {
      const ch = el("input", { type: "number", step: "1", min: "0", value: r.charge != null ? r.charge : "", style: "width:120px" }), note = el("input", { placeholder: "Note (paid cash / UPI…)", maxLength: 160 });
      const b = el("button", { type: "button", className: "btn", textContent: "Returned to party" }); b.addEventListener("click", () => act({ op: "deliver", charge: ch.value, note: note.value }, b));
      acts.append(lab("Charge Rs", ch), note, b);
      const again = el("button", { type: "button", className: "btn ghost", textContent: "Send to karigar again" }); again.addEventListener("click", () => { const k = opts(el("select"), KAR), g = el("button", { type: "button", className: "btn", textContent: "Give" }); g.addEventListener("click", () => act({ op: "karigar", karigar: k.value }, g)); work.textContent = ""; work.append(el("div", { style: "display:flex;gap:8px;margin-top:8px" }, [k, g])); });
      acts.append(again);
    }
    if (r.status === "surat" && !r.kBackAt) { const b = el("button", { type: "button", className: "btn ghost", textContent: "Returned to party (no work)" }); b.addEventListener("click", () => act({ op: "deliver", charge: 0 }, b)); acts.append(b); }
    if (!r.photo && r.status !== "delivered") { const ph = el("input", { type: "file", accept: "image/*", hidden: true }); ph.setAttribute("capture", "environment"); const l = el("label", { className: "btn ghost", style: "cursor:pointer" }, ["Add photo", ph]);
      ph.addEventListener("change", async () => { try { const id = await upPhoto(ph.files[0]); await act({ op: "photo", photo: id }); } catch (e) { say("Photo not saved: " + e.message, "bad"); } }); acts.append(l); }
    const slip = el("button", { type: "button", className: "btn ghost", textContent: "Print slip" });
    slip.addEventListener("click", () => printList("Repair R" + r.no + " - " + r.party, [["", ""], ["Party", r.party + (r.mobile ? " · " + r.mobile : "")], ["Piece", r.item + " · " + r.gross + " g " + (r.karat || "")], ["Repair", r.work || ""], ["Received", dmy(r.inAt)], ["Promised", dmy(r.promised)], ["Status", ST[r.status]]].concat(r.status === "karigar" || r.karigar ? [["Karigar", r.karigar || ""]] : []).concat(r.charge ? [["Charge", fmt(r.charge)]] : [])));
    acts.append(slip);
    if (r.log && r.log.length) { const d = el("details", { style: "margin-top:6px" }, [el("summary", { className: "hint", textContent: "History" })]); r.log.forEach(l => d.append(el("div", { className: "hint", textContent: dmy(l.at) + " " + String(l.at).slice(11, 16) + " · " + l.text + " · " + String(l.by || "").split("@")[0] }))); c.append(d); }
    c.append(acts, work); return c;
  }

  /* ---------------- 4. Who has what ---------------- */
  function paneWho(host) {
    const ours = all().filter(t => t.out && t.status !== "sold");
    const pr = el("button", { type: "button", className: "btn ghost", textContent: "Print all (large font)" }), rowsP = [["Where", "What", "Since", "Status"]];
    host.append(el("p", { className: "hint", textContent: "Our pieces out + party repairs, karigar by karigar." }), pr);
    KAR.forEach(k => {
      const mine = ours.filter(t => t.out.kind === "karigar" && t.out.name === k), reps = REP.filter(r => r.status === "karigar" && r.karigar === k);
      const c = el("div", { className: "card", style: "margin:10px 0;padding:12px 14px" }, [el("strong", { textContent: k, style: "font-size:17px" }), el("span", { className: "hint", textContent: ` · ${mine.length} our piece${mine.length === 1 ? "" : "s"} · ${reps.length} party repair${reps.length === 1 ? "" : "s"}` })]);
      mine.forEach(t => { c.append(el("div", { style: "display:flex;gap:8px;align-items:center;padding:4px 0" }, [thumb(t.photo, 40), el("span", { textContent: name(t) + " · " + (t.out.why || "") + " · since " + dmy(t.out.at) + " (" + days(t.out.at) + " d)" })])); rowsP.push([k, name(t), dmy(t.out.at), "Our piece - " + (t.out.why || "")]); });
      reps.forEach(r => { c.append(el("div", { style: "display:flex;gap:8px;align-items:center;padding:4px 0" }, [thumb(r.photo, 40), el("span", { textContent: "R" + r.no + " " + r.party + " · " + r.item + " " + r.gross + " g · since " + dmy(r.kOutAt) + " (" + days(r.kOutAt) + " d)" })])); rowsP.push([k, "R" + r.no + " " + r.party + " - " + r.item, dmy(r.kOutAt), "Party repair"]); });
      if (!mine.length && !reps.length) c.append(el("div", { className: "hint", textContent: "Nothing with " + k + "." }));
      host.append(c);
    });
    const other = ours.filter(t => t.out.kind !== "karigar");
    if (other.length) { const c = el("div", { className: "card", style: "margin:10px 0;padding:12px 14px" }, [el("strong", { textContent: "Exhibitions / other places", style: "font-size:17px" })]);
      groupsOut().filter(([k]) => !k.startsWith("karigar|")).forEach(([, ts]) => { const live = ts.filter(t => t.status !== "sold"); if (!live.length) return; c.append(el("div", { textContent: where(ts[0].out) + " · " + live.length + " pcs since " + dmy(ts[0].out.at) })); rowsP.push([where(ts[0].out), live.length + " pcs", dmy(ts[0].out.at), "Our pieces"]); });
      host.append(c); }
    const sur = REP.filter(r => r.status === "surat" || r.status === "ready");
    const c = el("div", { className: "card", style: "margin:10px 0;padding:12px 14px" }, [el("strong", { textContent: "Party repairs in Surat (with us)", style: "font-size:17px" }), el("span", { className: "hint", textContent: " · " + sur.length })]);
    sur.forEach(r => { c.append(el("div", { style: "display:flex;gap:8px;align-items:center;padding:4px 0" }, [thumb(r.photo, 40), el("span", { textContent: "R" + r.no + " " + r.party + " · " + r.item + " · " + ST[r.status] })])); rowsP.push(["In Surat", "R" + r.no + " " + r.party + " - " + r.item, dmy(r.inAt), ST[r.status]]); });
    host.append(c);
    pr.addEventListener("click", () => printList("Who has what - " + dmy(new Date().toISOString()), rowsP));
  }

  /* ---------------- 5. RFID link ---------------- */
  function paneRfid(host) {
    let cur = null; const st = el("p", { style: "font-size:17px;font-weight:600" }), log = el("div");
    const set = t => { cur = t; st.textContent = t ? "Now read the RFID chip of: " + name(t) + (t.epc ? " (already linked - reading again replaces it)" : "") : "Step 1: scan the tag's QR (or type the tag no.)."; };
    const sc = scanBox("Scan QR first, then pull the RFID trigger", async raw => {
      const nq = N(raw), looksEpc = /^[0-9A-F]{16,64}$/.test(nq) && !raw.includes("#") && !/^\d{1,6}$/.test(raw.trim());
      if (cur && looksEpc) { const t = cur;
        try { await api("/api/vj/move", { act: "link", id: t.id, epc: nq }); log.prepend(el("div", { className: "hint", textContent: "✓ " + name(t) + " ↔ RFID " + nq })); set(null); }
        catch (e) { if (e.status === 409 && e.body && e.body.on && confirm(`This chip is linked to ${e.body.on}. Move it to ${t.label}?`)) { try { await api("/api/vj/move", { act: "link", id: t.id, epc: nq, force: true }); log.prepend(el("div", { className: "hint", textContent: "✓ moved: " + name(t) + " ↔ " + nq })); set(null); } catch (x) { say(x.message, "bad"); } } else if (e.status !== 409) say("Not linked: " + e.message, "bad"); }
        return; }
      const f = find(raw); if (f.t) set(f.t); else if (f.many) host.insertBefore(chooser(f.many, set), log); else say(f.rfid ? "Scan the tag's QR first, then the chip." : "No piece found for " + raw, "warn");
    });
    host.append(el("p", { className: "hint", textContent: "Do this once per piece, when the RFID tag is put on. After that, the RFID reader works in every scan box of this tab (Send out, Receive back)." }), st, sc.box, log); set(null); setTimeout(() => sc.inp.focus(), 50);
  }

  /* ---------------- print (large font, owner rule) ---------------- */
  function printList(title, rows) {
    let pa = $("printArea"); if (!pa) { pa = el("div", { id: "printArea" }); document.body.append(pa); }
    pa.textContent = ""; pa.hidden = false; pa.style.cssText = "font-size:16pt;color:#000;background:#fff";
    const tb = el("table", { style: "border-collapse:collapse;width:100%;font-size:15pt" });
    rows.forEach((r, i) => tb.append(el("tr", {}, r.map(c => el(i ? "td" : "th", { textContent: c, style: "border:1px solid #444;padding:6px 8px;text-align:left" })))));
    pa.append(el("h2", { textContent: "Vaishnavi Jewels - " + title, style: "font-size:20pt" }), tb);
    setTimeout(() => { window.print(); setTimeout(() => { pa.textContent = ""; }, 500); }, 100);
  }

  /* ---------------- tab ---------------- */
  const SUBS = [["send", "Send out"], ["out", "Out now"], ["repair", "Party repair"], ["who", "Who has what"], ["rfid", "RFID link"]];
  function render() {
    if (!sec || sec.hidden) return;
    const host = $("koBody"); if (!host) return;
    if (host.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && document.activeElement.value) return; // never wipe what someone is typing
    host.textContent = "";
    $("koSubs").querySelectorAll("button").forEach(b => b.className = b.dataset.s === sub ? "btn" : "btn ghost");
    ({ send: paneSend, out: paneOut, repair: paneRepair, who: paneWho, rfid: paneRfid })[sub](host);
  }
  function show(on) {
    if (!sec) return; sec.hidden = !on; clearInterval(timer);
    if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; });
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "karigar" ? "true" : "false"));
      loadRep().catch(() => {}).then(render); timer = setInterval(() => { if (sub === "out" || sub === "who") render(); }, 30000); window.scrollTo({ top: 0 }); }
  }
  async function build() {
    const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-karigar")) return;
    try { await loadRep(); } catch (e) { return; } // this login has no Karigar & Out access (the server says so)
    if ($("t-karigar")) return;
    const b = el("button", { id: "t-karigar", textContent: "Karigar & Out" }); b.setAttribute("role", "tab"); b.dataset.tab = "karigar"; b.setAttribute("aria-selected", "false"); b.hidden = false;
    const ck = nav.querySelector('[data-tab="check"]'); nav.insertBefore(b, ck ? ck.nextSibling : null);
    sec = el("section", { className: "card", id: "p-karigar", hidden: true });
    const subs = el("div", { id: "koSubs", style: "display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px" });
    SUBS.forEach(([k, t]) => { const x = el("button", { type: "button", textContent: t }); x.dataset.s = k; x.addEventListener("click", () => { sub = k; if (k !== "send") basket.size; render(); }); subs.append(x); });
    sec.append(el("h2", { textContent: "Karigar & Out" }), subs, el("div", { id: "koBody" }));
    rates.parentNode.insertBefore(sec, rates);
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "karigar"); });
  }
  /* Price check: show where a piece is when it is out */
  try { new MutationObserver(() => { const box = $("cres"); if (!box) return; const card = box.querySelector(".card"); if (!card || card.querySelector(".koOut")) return;
    const lab = card.querySelector(".labelno"); if (!lab) return; const label = lab.textContent.split(" · ").pop().trim(), t = all().find(x => x.label === label); if (!t || !t.out) return;
    lab.after(el("p", { className: "banner warn koOut", textContent: "OUT: " + where(t.out) + " since " + dmy(t.out.at) + (t.out.note ? " · " + t.out.note : "") })); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 1200);
})();
