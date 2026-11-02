/* VJ Tags - Karigar order (owner Abhinav 02/11/2026 15:44, C-20261102-KORDER). The paper karigar order slip as a tab, next to the OG register.
   Order no. runs by itself (Abhinav / Shilpiji can set the first no.), karigar from the same list as OG OUT, party from the party lookup (party.js),
   drawing = a photo (made smaller on the phone / PC first, kept in Cloudflare), diamonds issued / received back / used (pending worked out by the server),
   status Open -> With karigar -> Received -> Tagged (or Cancelled), TAG USE ONLY figures filled on receipt (N gold worked out by the server), optional link to
   an OG OUT issue for the gold. A5 print in the slip's layout. Staff / tagger add and move forward, Abhinav / Shilpiji edit and cancel (old version kept),
   the sales login only reads. The server checks and works out everything again. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const r3 = n => (Math.round((Number(n) || 0) * 1000) / 1000).toFixed(3);
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const num = v => { const x = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, "")); return isFinite(x) ? x : 0; };
  const ST = { open: "Open", karigar: "With karigar", received: "Received", tagged: "Tagged", cancelled: "Cancelled" }, NEXT = { open: "karigar", karigar: "received", received: "tagged" };
  const COLOURS = ["", "Y", "W", "R"], SHAPES = ["Round", "Baguette", "Oval", "Pear", "Marquise", "Princess", "Emerald", "Other"] /* 16:45 C-20261102-KORDER2 */, KTS = ["", "9K", "14K", "18K", "22K", "24K", "Silver", "Platinum"];
  let sec = null, J = null, cur = null, drawing = "";
  const post = async body => { const r = await fetch("/api/vj/korder", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status); return j; };
  const dsum = l => { const a = (l || []).reduce((s, x) => [s[0] + (Number(x.pcs) || 0), s[1] + (Number(x.ct) || 0)], [0, 0]); return a[0] || a[1] ? a[0] + " pcs / " + a[1].toFixed(3) + " ct" : "-"; };
  const tot = t => t && (t.pcs || t.ct) ? t.pcs + " pcs / " + Number(t.ct).toFixed(3) + " ct" : "-";
  const css = `#p-korder .kosum{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}#p-korder .kosum span{border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-weight:600}
#p-korder .kobox{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0}#p-korder .kobox h3{margin:0 0 6px}
#p-korder .kodraw{max-width:100%;max-height:340px;border:1px solid var(--line);border-radius:8px;display:block;margin-top:6px}
#p-korder tr.kox td{opacity:.5;text-decoration:line-through}#p-korder .kolate{color:var(--bad);font-weight:700}
#p-korder .kodia td input{width:90px}#p-korder.konoadm .koRate{display:none}#p-korder .kostart{border:2px dashed var(--gold);border-radius:10px;padding:8px 12px;margin:8px 0}#p-korder .kostat{font-weight:700}`;

  async function load() { const m = $("koMsg");
    try { const r = await fetch("/api/vj/korders", { credentials: "same-origin", cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); J = j;
      $("koAdd").hidden = !j.canAdd; $("koXl").hidden = !j.canAdd; $("koStartB").hidden = !j.admin; sec.classList.toggle("konoadm", !j.admin);
      $("koStartHint").hidden = !(j.admin && !j.startSet && !(j.orders || []).length); /* 16:45: first use - set the slip book's no. first */
      const kf = $("koFK"), kv = kf.value; kf.textContent = ""; kf.appendChild(el("option", { value: "", textContent: "All karigars" }));
      [...new Set((j.karigars || []).concat((j.orders || []).map(o => o.karigar).filter(Boolean)))].forEach(k => kf.appendChild(el("option", { value: k, textContent: k }))); kf.value = kv;
      summary(); render(); if (cur) { const o = (j.orders || []).find(x => x.no === cur.no); if (o) openOrder(o, true); }
    } catch (e) { if (m) m.textContent = "Could not load karigar orders (" + (e.message || e) + ")."; } }
  function summary() { const b = $("koSum"); b.textContent = ""; const L = (J.orders || []), c = s => L.filter(o => o.status === s).length;
    ["open", "karigar", "received", "tagged", "cancelled"].forEach(s => b.append(el("span", { textContent: ST[s] + ": " + c(s) })));
    const od = L.filter(o => o.overdue).length; if (od) b.append(el("span", { className: "kolate", textContent: "Overdue: " + od }));
    const p = Object.entries(J.pending || {}).filter(([, v]) => v.pcs || v.ct || v.ogPcs || v.ogCt);
    $("koPend").textContent = p.length ? "Diamonds pending with karigars - " + p.map(([k, v]) => k + ": " + (v.pcs || v.ct ? v.pcs + " pcs / " + Number(v.ct).toFixed(3) + " ct (orders)" : "") + (v.ogPcs || v.ogCt ? (v.pcs || v.ct ? " + " : "") + v.ogPcs + " pcs / " + Number(v.ogCt).toFixed(3) + " ct (OG register)" : "")).join(" · ") : "";
    $("koNext").textContent = "Next order no.: " + J.next; }
  function render() { const box = $("koList"); if (!box || !J) return; box.textContent = "";
    const k = $("koFK").value, s = $("koFS").value, od = $("koFO").checked, q = String($("koQ").value || "").trim().toLowerCase();
    const rows = (J.orders || []).filter(o => (!k || o.karigar === k) && (!s || o.status === s) && (!od || o.overdue) && (!q || [o.no, o.item, o.name, o.city, o.karigar, o.dq].join(" ").toLowerCase().includes(q))).slice().reverse();
    const t = el("table", { className: "items" }), hr = el("tr"), tb = el("tbody");
    ["Order no.", "Date", "Karigar", "Item", "Party", "Del date", "Status", "Diamonds pending", ""].forEach(h => hr.appendChild(el("th", { textContent: h })));
    rows.forEach(o => { const tr = el("tr", { className: o.status === "cancelled" ? "kox" : "" }), td = (x, cl) => tr.appendChild(el("td", { className: cl || "", textContent: x == null ? "" : x }));
      td(o.no); td(dmy(o.date)); td(o.karigar || "-"); td([o.item, o.size, o.kt, o.colour].filter(Boolean).join(" · ")); td([o.name, o.city].filter(Boolean).join(", ") + (o.mobile ? " · " + o.mobile : ""));
      const dd = el("td", { textContent: dmy(o.delDate) + (o.overdue ? " (overdue)" : "") }); if (o.overdue) dd.className = "kolate"; tr.appendChild(dd);
      const st = el("td", { className: "kostat", textContent: ST[o.status] || o.status }); tr.appendChild(st); td(tot(o.diaPend), "num");
      const x = el("td"); x.style.whiteSpace = "nowrap"; const ob = el("button", { type: "button", className: "btn ghost", textContent: "Open" }); ob.addEventListener("click", () => openOrder(o));
      const pb = el("button", { type: "button", className: "btn ghost", textContent: "\u{1F5A8} Print" }); pb.addEventListener("click", () => print(o, pb)); x.append(ob, pb); tr.appendChild(x); tb.appendChild(tr); });
    if (!rows.length) tb.appendChild(el("tr", {}, [el("td", { colSpan: 9, className: "hint", textContent: "No orders here." })]));
    t.append(el("thead", {}, [hr]), tb); t.style.minWidth = "900px"; box.appendChild(el("div", { className: "list" }, [t])); }

  // ---------- diamond rows ----------
  function diaRows(id, list, ro) { const tb = $(id); tb.textContent = ""; (list || []).forEach(d => tb.appendChild(diaRow(d, ro))); }
  function diaRow(d, ro) { const tr = el("tr"); d = d || {};
    [["pkt", "PL12/644", 30], ["shape"], ["pcs", "0", 6], ["ct", "0.000", 9], ["rate", "₹/ct", 9]].forEach(([k, ph, ml]) => { let i;
      if (k === "shape") { i = el("select", { disabled: !!ro }); i.appendChild(el("option", { value: "", textContent: "-" })); const l = SHAPES.slice(); if (d.shape && !l.includes(d.shape)) l.push(d.shape); l.forEach(x => i.appendChild(el("option", { value: x, textContent: x }))); i.value = d.shape || ""; }
      else { i = el("input", { value: d[k] != null && d[k] !== 0 ? String(d[k]) : "", placeholder: ph, maxLength: ml, disabled: !!ro }); if (k !== "pkt") i.inputMode = "decimal"; }
      i.dataset.k = k; const c = el("td", {}, [i]); if (k === "rate") c.className = "koRate"; tr.appendChild(c); }); return tr; }
  const diaCt = id => diaGet(id).reduce((a, x) => a + num(x.ct), 0);
  const diaGet = id => [...$(id).querySelectorAll("tr")].map(tr => { const o = {}; tr.querySelectorAll("[data-k]").forEach(i => { o[i.dataset.k] = i.value.trim(); }); return o; }).filter(o => num(o.pcs) > 0 || num(o.ct) > 0);
  const diaTable = (id, addId) => el("div", {}, [el("div", { className: "list" }, [el("table", { className: "items kodia" }, [el("thead", {}, [el("tr", {}, ["Packet no.", "Shape / type", "Pcs", "Ct", "Rate ₹/ct"].map((h, i) => el("th", { textContent: h, className: i === 4 ? "koRate" : "" })))]), el("tbody", { id })])]),
    el("button", { type: "button", className: "btn ghost", id: addId, textContent: "+ Add row" })]);

  // ---------- drawing photo: made smaller on the device, then kept in Cloudflare ----------
  async function shrink(file) { const url = URL.createObjectURL(file); try { const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      for (const [mx, q] of [[1600, 0.82], [1300, 0.75], [1000, 0.7], [800, 0.65]]) { const s = Math.min(1, mx / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        const b = await new Promise(ok => c.toBlob(ok, "image/jpeg", q)); if (b && b.size <= 300 * 1024) return b; if (mx === 800) return b; } } finally { URL.revokeObjectURL(url); } }
  async function upload(file) { const m = $("koDrawMsg"); m.textContent = "Making the photo smaller…";
    try { const b = await shrink(file); m.textContent = "Uploading (" + Math.round(b.size / 1024) + " KB)…";
      const r = await fetch("/api/vj/photo", { method: "POST", credentials: "same-origin", headers: { "content-type": "image/jpeg" }, body: b }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status);
      drawing = j.id; $("koDrawImg").src = "/_blob/" + j.id; $("koDrawImg").hidden = false; m.textContent = "Drawing added - press Save."; } catch (e) { m.textContent = "Photo not added (" + (e.message || e) + ")."; } }

  // ---------- the form ----------
  const F = ["koDate", "koItem", "koSize", "koColour", "koGwt", "koKt", "koDq", "koDct", "koDctNote", "koName", "koMob", "koCity", "koDel", "koRate", "koBudget", "koInstr", "koSetting", "koCs", "koKSel", "koKNew"];
  function kSel(v) { const s = $("koKSel"); s.textContent = ""; s.appendChild(el("option", { value: "", textContent: "- pick the karigar -" })); const l = (J.karigars || []).slice(); if (v && !l.includes(v)) l.push(v);
    l.forEach(k => s.appendChild(el("option", { value: k, textContent: k }))); if (J.admin) s.appendChild(el("option", { value: "__new", textContent: "+ new karigar" })); s.value = v || ""; $("koKNew").hidden = true; $("koKNew").value = ""; }
  function newOrder() { cur = null; drawing = ""; kSel(""); F.forEach(i => { if (i !== "koKSel") $(i).value = ""; }); $("koDct").dataset.man = ""; $("koDate").value = today(); $("koNo").textContent = "New karigar order";
    $("koNoBox").hidden = false; $("koNoIn").value = ""; $("koNoIn").placeholder = "blank = " + J.next;
    $("koDrawImg").hidden = true; $("koDrawMsg").textContent = ""; diaRows("koIss", [{}]); lock(false); $("koSave").hidden = false; $("koSave").textContent = "Save order"; $("koActs").hidden = true; $("koForm").hidden = false; $("koFMsg").textContent = "";
    window.scrollTo({ top: $("koForm").offsetTop - 10, behavior: "smooth" }); }
  function lock(ro) { F.forEach(i => { $(i).disabled = ro; }); $("koDrawF").disabled = ro; $("koDrawCam").disabled = ro; $("koIssAdd").disabled = ro; $("koIss").querySelectorAll("input").forEach(i => { i.disabled = ro; }); }
  function openOrder(o, keep) { cur = o; drawing = o.drawing || ""; kSel(o.karigar || ""); $("koNoBox").hidden = true; $("koDct").dataset.man = "1";
    const v = { koDate: o.date, koItem: o.item, koSize: o.size, koColour: o.colour, koGwt: o.gwt || "", koKt: o.kt, koDq: o.dq, koDct: o.dct || "", koDctNote: o.dctNote || "", koName: o.name, koMob: o.mobile, koCity: o.city, koDel: o.delDate, koRate: o.goldRate || "", koBudget: o.budget || "", koInstr: o.instr, koSetting: o.setting, koCs: o.cs };
    Object.entries(v).forEach(([k, x]) => { $(k).value = x == null ? "" : String(x); });
    $("koDrawImg").hidden = !drawing; if (drawing) $("koDrawImg").src = "/_blob/" + drawing; $("koDrawMsg").textContent = "";
    diaRows("koIss", (o.iss || []).length ? o.iss : [{}]); const canEdit = J.admin && o.status !== "cancelled"; lock(!canEdit); $("koSave").hidden = !canEdit; $("koSave").textContent = "Update order " + o.no;
    $("koNo").textContent = "Order no. " + o.no + " · " + (ST[o.status] || o.status) + (o.overdue ? " · OVERDUE" : "") + (o.cancelled ? " (" + dmy(o.cancelled.at) + (o.cancelled.why ? ", " + o.cancelled.why : "") + ")" : "") + (o.editedByName ? " · last change by " + o.editedByName : "");
    acts(o); $("koForm").hidden = false; if (!keep) { $("koFMsg").textContent = ""; window.scrollTo({ top: $("koForm").offsetTop - 10, behavior: "smooth" }); } }
  function acts(o) { const a = $("koActs"); a.hidden = false; const live = o.status !== "cancelled", can = J.canAdd;
    $("koDiaInfo").textContent = "Issued " + tot(o.diaIss) + " · received back " + tot(o.diaRec) + " · used " + tot(o.diaUsed) + " · PENDING " + tot(o.diaPend);
    const sb = $("koStatusBtns"); sb.textContent = ""; if (can && live && NEXT[o.status]) { const n = NEXT[o.status]; const b = el("button", { type: "button", className: "btn", textContent: n === "received" ? "Mark received (fill below)" : "Mark: " + ST[n] });
        b.addEventListener("click", async () => { if (n === "received") { $("koRecBox").open = true; $("koRecBox").scrollIntoView({ behavior: "smooth" }); return; } await act({ op: "status", no: o.no, to: n }, "Now: " + ST[n] + "."); }); sb.appendChild(b); }
    if (J.admin) { if (live) { const c = el("button", { type: "button", className: "btn ghost", textContent: "Cancel order" }); c.style.color = "var(--bad)"; c.addEventListener("click", async () => { if (c.dataset.s !== "1") { c.dataset.s = "1"; c.textContent = "Sure? Cancel order " + o.no; return; } const why = prompt("Why cancel order " + o.no + "? (optional)") || ""; await act({ op: "cancel", no: o.no, why }, "Order cancelled (kept, struck through)."); }); sb.appendChild(c); }
      else { const r = el("button", { type: "button", className: "btn ghost", textContent: "Bring back (Open)" }); r.addEventListener("click", () => act({ op: "status", no: o.no, to: "open" }, "Order is open again.")); sb.appendChild(r); }
      if (live && o.status !== "open") { const back = el("select"); back.appendChild(el("option", { value: "", textContent: "Move back to…" })); ["open", "karigar", "received"].filter(s => VJS(s) < VJS(o.status)).forEach(s => back.appendChild(el("option", { value: s, textContent: ST[s] })));
        back.addEventListener("change", () => { if (back.value) act({ op: "status", no: o.no, to: back.value }, "Moved back to " + ST[back.value] + "."); }); sb.appendChild(back); } }
    $("koDiaAddBox").hidden = !(can && live); diaRows("koIssMore", [{}]);
    const t = o.tag || {}; $("koRecBox").hidden = !(live || o.tag); const recRO = !live || !can || (!!o.tag && !J.admin);
    [["koTDate", t.date || today()], ["koTKt", t.kt || (o.kt ? o.kt.replace("K", "KT") : "")], ["koTG", t.gGold || ""], ["koTCs", t.csWt || ""], ["koTD", t.dWt != null && o.tag ? r3(t.dWt) : ""], ["koTLab", t.lab || ""], ["koTCsR", t.csRate || ""], ["koTOth", t.otherCh || ""], ["koTDet", t.details || ""]].forEach(([i, v]) => { $(i).value = String(v); $(i).disabled = recRO; });
    diaRows("koRec", (o.rec || []).length ? o.rec : [{}], recRO); diaRows("koUsed", (o.used || []).length ? o.used : (o.iss || []).length && !o.tag ? o.iss : [{}], recRO); $("koRecAdd").disabled = recRO; $("koUsedAdd").disabled = recRO; $("koRecSave").hidden = recRO; $("koCopyUsed").hidden = recRO; $("koTD").dataset.man = o.tag ? "1" : ""; if (!o.tag) dwAuto();
    $("koRecSave").textContent = o.tag ? "Update tag figures" : "Save - received"; nPrev();
    $("koTagB").hidden = !(o.tag && can && document.querySelector('nav button[data-tab="new"]') && !document.querySelector('nav button[data-tab="new"]').hidden);
    const gl = $("koGoldInfo"), g = o.goldOut ? (J.outs || []).find(x => x.id === o.goldOut) : null; gl.textContent = o.goldOut ? "Gold issued for this order: " + (g ? dmy(g.date) + " · " + r3(g.fine) + " g fine to " + g.karigar + (g.note ? " (" + g.note + ")" : "") : "linked OG OUT entry") : "No gold linked yet.";
    const gs = $("koGoldSel"); gs.textContent = ""; gs.appendChild(el("option", { value: "", textContent: "- link an existing OG OUT issue -" })); (J.outs || []).filter(x => x.karigar === o.karigar).forEach(x => gs.appendChild(el("option", { value: x.id, textContent: dmy(x.date) + " · " + r3(x.fine) + " g" + (x.note ? " · " + x.note : "") })));
    $("koGoldBox").hidden = !(can && live && o.karigar) || (!!o.goldOut && !J.admin); }
  const VJS = s => ["open", "karigar", "received", "tagged"].indexOf(s);
  function nPrev() { const g = num($("koTG").value), c = num($("koTCs").value), d = num($("koTD").value); $("koTN").textContent = g > 0 ? "N GOLD = " + r3(g - c - d) + " g (G.GOLD − CS WT − D.WT, all in grams)" : ""; }
  function dwAuto() { if ($("koTD").dataset.man === "1") return; const c = diaCt("koUsed"); $("koTD").value = c > 0 ? r3(c * 0.2) : ""; nPrev(); } /* D.WT (g) = diamonds used ct x 0.2 - can be changed */
  function dctAuto() { if ($("koDct").dataset.man === "1") return; const c = diaCt("koIss"); $("koDct").value = c > 0 ? r3(c) : ""; } /* D.CT = total issued ct - can be changed */
  async function act(body, ok) { const m = $("koFMsg"); m.textContent = "Saving…"; try { const j = await post(body); m.textContent = ok || "Saved."; cur = j.order; await load(); } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; } }
  async function save() { const m = $("koFMsg"), ks = $("koKSel").value, karigar = ks === "__new" ? $("koKNew").value.trim() : ks;
    const body = { op: cur ? "edit" : "new", karigar, date: $("koDate").value, item: $("koItem").value.trim(), size: $("koSize").value.trim(), colour: $("koColour").value, gwt: $("koGwt").value, kt: $("koKt").value, dq: $("koDq").value.trim(), dct: $("koDct").value, dctNote: $("koDctNote").value.trim(), no: cur ? cur.no : $("koNoIn").value.trim(),
      name: $("koName").value.trim(), mobile: $("koMob").value.trim(), city: $("koCity").value.trim(), delDate: $("koDel").value, goldRate: $("koRate").value, budget: $("koBudget").value, drawing, iss: diaGet("koIss"), instr: $("koInstr").value.trim(), setting: $("koSetting").value, cs: $("koCs").value.trim() };
    if (!body.item) { m.textContent = "Type the item."; return; } if (ks === "__new" && !karigar) { m.textContent = "Type the new karigar's name."; return; }
    $("koSave").disabled = true; m.textContent = "Saving…";
    try { const j = await post(body); m.textContent = (cur ? "Updated order " : "Saved order no. ") + j.order.no + "."; cur = j.order; await load(); openOrder(j.order, true); } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; } $("koSave").disabled = false; }

  // ---------- create a tag from the order (fills the New tag form; nothing is saved until Save there) ----------
  function makeTag() { const o = cur; if (!o || !o.tag) return; const t = o.tag, nb = document.querySelector('nav button[data-tab="new"]'); if (!nb) return; nb.click();
    setTimeout(() => { const msg = [];
      try { const gl = document.getElementById("goldLines"), r = gl && gl.children[0], id = r && r.dataset.id;
        if (id && document.getElementById("gn" + id)) { const k = document.getElementById("gk" + id), kt = t.kt || o.kt; if (kt && [...k.options].some(x => x.value === kt)) { k.value = kt; k.dispatchEvent(new Event("change", { bubbles: true })); } else if (kt) msg.push("karat " + kt + " (pick it)");
          const n = document.getElementById("gn" + id); n.value = o.nGold != null ? r3(o.nGold) : ""; n.dispatchEvent(new Event("input", { bubbles: true })); }
        const oa = document.getElementById("otherAmt"); if (oa && t.otherCh) { oa.value = String(t.otherCh); oa.dispatchEvent(new Event("input", { bubbles: true })); }
      } catch (e) { msg.push("could not fill the gold line"); }
      const box = document.getElementById("koTagCopy") || el("div", { id: "koTagCopy", className: "card", style: "border:2px dashed var(--gold);padding:10px 12px;margin:8px 0" }); box.textContent = "";
      box.append(el("b", { textContent: "From karigar order " + o.no + " - filled: karat + net gold " + (o.nGold != null ? r3(o.nGold) + " g" : "") + (t.otherCh ? ", other charges ₹" + t.otherCh : "") + ". Type these yourself:" }),
        el("div", { textContent: "Category / design no.: " + (o.item || "") + " · Diamonds used: " + (o.used || []).map(d => [d.pkt, d.shape || d.q, d.pcs + " pcs", Number(d.ct).toFixed(3) + " ct"].filter(Boolean).join(" ")).join("; ") + " · D.WT " + (t.dWt || 0) + " g · CS WT " + (t.csWt || 0) + " g @ " + (t.csRate || 0) + " · Lab " + (t.lab || "-") + (t.details ? " · " + t.details : "") + (msg.length ? " · also: " + msg.join(", ") : "") }));
      const p = document.getElementById("p-new"); if (p && !box.parentNode) p.prepend(box); window.scrollTo({ top: 0, behavior: "smooth" }); }, 300); }

  // ---------- A5 print, the slip's layout ----------
  async function imgData(id) { try { const r = await fetch("/_blob/" + id, { credentials: "same-origin" }); if (!r.ok) return null; const b = await r.blob(); const d = await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); });
      const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = d; }); return { d, w: im.naturalWidth, h: im.naturalHeight }; } catch (e) { return null; } }
  async function print(o, btn) { if (!window.jspdf) { $("koMsg").textContent = "PDF maker did not load - reload the page."; return; } if (btn) btn.disabled = true;
    try { const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a5", orientation: "landscape" }), W = 210, H = 148, M = 6, X2 = W - M; doc.setDrawColor(40); doc.setTextColor(15); doc.setLineWidth(0.3);
      const fit = (s, w, fs) => { s = String(s == null ? "" : s); doc.setFontSize(fs); while (fs > 6 && doc.getTextWidth(s) > w) doc.setFontSize(fs -= 0.5); return s; };
      doc.rect(M, M, W - 2 * M, H - 2 * M);
      doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text("Vaishnavi Jewels", M + 3, M + 8); doc.setFontSize(10); doc.text("KARIGAR ORDER", M + 3, M + 13);
      doc.setFontSize(11); doc.text("GOLD RATE : " + (o.goldRate ? "Rs " + Number(o.goldRate).toLocaleString("en-IN") : ""), X2 - 3, M + 7, { align: "right" }); doc.text("BUDGET : " + (o.budget ? "Rs " + Number(o.budget).toLocaleString("en-IN") : ""), X2 - 3, M + 13, { align: "right" });
      let y = M + 16; doc.line(M, y, X2, y); doc.setFontSize(13); doc.text("KARIGAR : " + (o.karigar || ""), M + 3, y + 6); if (o.status === "cancelled") { doc.setTextColor(170, 30, 30); doc.text("CANCELLED", X2 - 3, y + 6, { align: "right" }); doc.setTextColor(15); }
      y += 8; doc.line(M, y, X2, y);
      const cols = [["ORDER NO", 16, o.no], ["DATE", 18, dmy(o.date)], ["ITEM", 22, o.item], ["SIZE", 11, o.size], ["GOLD Y/W/R", 13, o.colour], ["G.WT", 13, o.gwt ? r3(o.gwt) : ""], ["KT", 11, o.kt], ["D.Q", 17, o.dq], ["D.CT", 19, (o.dct ? r3(o.dct) : "") + (o.dctNote ? " " + o.dctNote : "")], ["PARTY NAME", 21, o.name], ["CITY", 18, o.city], ["DEL DATE", 19, dmy(o.delDate)]];
      let x = M; cols.forEach(([h, w, v], i) => { doc.setFont("helvetica", "bold"); doc.text(fit(h, w - 2, 7), x + w / 2, y + 4.2, { align: "center" }); doc.setFont("helvetica", "normal"); doc.text(fit(v, w - 2, 10.5), x + w / 2, y + 11, { align: "center" }); x += w; if (i < cols.length - 1) doc.line(x, y, x, y + 13.5); });
      doc.line(M, y + 6, X2, y + 6); y += 13.5; doc.line(M, y, X2, y);
      const DW = 118, bodyH = 62, xr = M + DW; doc.line(xr, y, xr, y + bodyH); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("DRAWING", M + DW / 2, y + 4, { align: "center" }); doc.line(M, y + 5.5, xr, y + 5.5);
      if (o.drawing) { const im = await imgData(o.drawing); if (im) { const bw = DW - 4, bh = bodyH - 8, s = Math.min(bw / im.w, bh / im.h), w = im.w * s, h = im.h * s; doc.addImage(im.d, "JPEG", M + 2 + (bw - w) / 2, y + 6.5 + (bh - h) / 2, w, h); } }
      const RW = X2 - xr, part = bodyH / 3; [["DIAMOND ISSUED", o.iss], ["DIAMOND RECEIVED", o.rec], ["DIAMOND USED", o.used]].forEach(([h, l], i) => { const yy = y + i * part; if (i) doc.line(xr, yy, X2, yy); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(h, xr + RW / 2, yy + 4, { align: "center" }); doc.line(xr, yy + 5.5, X2, yy + 5.5);
        doc.setFont("helvetica", "normal"); const L = (l || []).slice(0, 4); L.forEach((d, j) => doc.text(fit([d.pkt, d.shape || d.q].filter(Boolean).join("  ") + "   " + (d.pcs || 0) + " pcs   " + Number(d.ct || 0).toFixed(3) + " ct", RW - 4, 9.5), xr + 2, yy + 9.5 + j * 3.6));
        if ((l || []).length > 4) doc.text("+ " + ((l || []).length - 4) + " more · total " + dsum(l), xr + 2, yy + part - 1); else if ((l || []).length > 1) { doc.setFont("helvetica", "bold"); doc.text(fit("Total " + dsum(l), RW - 4, 9), xr + 2, yy + part - 1); } });
      y += bodyH; doc.line(M, y, X2, y);
      const IH = 17; doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("SPECIAL INSTRUCTIONS", M + 2, y + 4); doc.text("SETTING : " + ["MICRO", "NIL", "MIXED"].map(s => s === o.setting ? "[" + s + "]" : s).join(" / "), M + 70, y + 4);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(doc.splitTextToSize(o.instr || "", W - 2 * M - 4).slice(0, 2), M + 2, y + 8.5); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("C/S TONES:", M + 2, y + 15.5); doc.setFont("helvetica", "normal"); doc.text(fit(o.cs || "", 160, 10), M + 22, y + 15.5);
      y += IH; doc.line(M, y, X2, y);
      const t = o.tag || {}, tc = [["", 22, "DETAILS"], ["DATE", 18, t.gGold ? dmy(t.date) : ""], ["KT", 12, t.kt || ""], ["G.GOLD", 19, t.gGold ? r3(t.gGold) : ""], ["CS WT", 17, t.gGold ? r3(t.csWt) : ""], ["D. WT", 17, t.gGold ? r3(t.dWt) : ""], ["N GOLD", 19, o.nGold != null ? r3(o.nGold) : ""], ["LAB", 16, t.lab || ""], ["CS RATE", 18, t.csRate || ""], ["OTHER CH.", 30, t.otherCh || ""]];
      x = M; tc.forEach(([h, w, v], i) => { doc.setFont("helvetica", "bold"); doc.setFontSize(8); if (h) doc.text(h, x + w / 2, y + 4, { align: "center" }); doc.setFont(i ? "helvetica" : "helvetica", i ? "normal" : "bold"); doc.text(fit(v, w - 2, i ? 10 : 9), x + w / 2, y + 10, { align: "center" }); x += w; if (i < tc.length - 1) doc.line(x, y, x, y + 12.5); });
      doc.line(M + 22, y + 5.5, X2, y + 5.5); y += 12.5; doc.line(M, y, X2, y); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("TAG USE ONLY", W / 2, y + 4, { align: "center" }); doc.line(M, y + 5.5, X2, y + 5.5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(fit(t.details || "", W - 2 * M - 4, 9), M + 2, y + 10);
      const blob = doc.output("blob"); if (window.vjPrintBlob) window.vjPrintBlob(blob, $("koMsg")); else window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch (e) { $("koMsg").textContent = "Print not made (" + (e.message || e) + ")."; } if (btn) btn.disabled = false; }
  async function xl() { const b = $("koXl"); b.disabled = true;
    try { const r = await fetch("/api/vj/korders?xlsx=1", { credentials: "same-origin", cache: "no-store" }); if (!r.ok) throw new Error(r.status); const a = el("a", { href: URL.createObjectURL(await r.blob()), download: "VJ_karigar_orders_" + dmy(today()) + ".xlsx" }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); }
    catch (e) { $("koMsg").textContent = "Excel not made (" + (e.message || e) + ")."; } b.disabled = false; }

  function show(on) { if (!sec) return; sec.hidden = !on;
    if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; }); document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "korder" ? "true" : "false")); load(); window.scrollTo({ top: 0 }); } }
  let tries = 0;
  function build() { const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-korder")) return;
    const og = $("t-ogreg"); if (!og && ++tries < 8) { setTimeout(build, 500); return; } // sit right after the OG register tab
    document.head.appendChild(el("style", { textContent: css }));
    const b = el("button", { id: "t-korder", textContent: "Karigar order" }); b.setAttribute("role", "tab"); b.dataset.tab = "korder"; b.setAttribute("aria-selected", "false");
    const after = og || nav.querySelector('[data-tab="bill"]'); nav.insertBefore(b, after ? after.nextSibling : null);
    sec = el("section", { className: "card", id: "p-korder", hidden: true });
    const inp = (id, ph, extra) => Object.assign(el("input", { id, placeholder: ph || "", autocomplete: "off" }), extra || {});
    const lab = (t, i, st) => el("label", st ? { style: st } : {}, [t + " ", i]);
    const sel = (id, opts) => { const s = el("select", { id }); opts.forEach(([v, t]) => s.appendChild(el("option", { value: v, textContent: t }))); return s; };
    const form = el("div", { id: "koForm", className: "kobox", hidden: true }, [el("h3", { id: "koNo", textContent: "New order" }),
      el("div", { className: "row", id: "koNoBox" }, [lab("Order no. (slip no.)", inp("koNoIn", "", { maxLength: 8, inputMode: "numeric" }))]),
      el("div", { className: "row" }, [lab("Karigar", el("span", {}, [el("select", { id: "koKSel" }), inp("koKNew", "new karigar's name", { maxLength: 40, hidden: true })])), lab("Gold rate ₹/g", inp("koRate", "", { maxLength: 10, inputMode: "decimal" })), lab("Budget ₹", inp("koBudget", "", { maxLength: 12, inputMode: "decimal" }))]),
      el("div", { className: "row" }, [lab("Date", inp("koDate", "", { type: "date" })), lab("Item", inp("koItem", "e.g. Ring", { maxLength: 80 })), lab("Size", inp("koSize", "", { maxLength: 20 })), lab("Gold Y/W/R", sel("koColour", COLOURS.map(c => [c, c || "-"]))),
        lab("G.WT g", inp("koGwt", "", { maxLength: 10, inputMode: "decimal" })), lab("KT", sel("koKt", KTS.map(c => [c, c || "-"]))), lab("D.Q", inp("koDq", "e.g. VVS-EF", { maxLength: 30 })), lab("D.CT", inp("koDct", "auto", { maxLength: 10, inputMode: "decimal" })), lab("D.CT note", inp("koDctNote", "e.g. R+O+B", { maxLength: 30 }))]),
      el("div", { className: "row" }, [lab("Party name", inp("koName", "type 2+ letters", { maxLength: 60 })), lab("Mobile", inp("koMob", "98xxxxxxxx", { maxLength: 20, inputMode: "tel" })), lab("City", inp("koCity", "", { maxLength: 40 })), lab("Del date", inp("koDel", "", { type: "date" }))]),
      el("div", { className: "kobox" }, [el("b", { textContent: "Drawing " }), el("input", { type: "file", id: "koDrawF", accept: "image/*" }), el("button", { type: "button", className: "btn ghost", id: "koDrawCam", textContent: "\u{1F4F7} Take photo" }), el("input", { type: "file", id: "koDrawCamIn", accept: "image/*", capture: "environment", hidden: true }),
        el("span", { className: "hint", id: "koDrawMsg" }), el("img", { id: "koDrawImg", className: "kodraw", alt: "Drawing", hidden: true })]),
      el("div", { className: "kobox" }, [el("b", { textContent: "Diamonds issued" }), diaTable("koIss", "koIssAdd")]),
      el("div", { className: "row" }, [lab("Special instructions", inp("koInstr", "", { maxLength: 300 }), "flex:3 1 300px"), lab("Setting", sel("koSetting", [["", "-"], ["MICRO", "MICRO"], ["NIL", "NIL"], ["MIXED", "MIXED"]])), lab("C/S tones", inp("koCs", "", { maxLength: 120 }), "flex:2 1 200px")]),
      el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "koSave", textContent: "Save order" }), el("button", { type: "button", className: "btn ghost", id: "koPrintB", textContent: "\u{1F5A8} Print slip (A5)" }), el("button", { type: "button", className: "btn ghost", id: "koClose", textContent: "Close" })]),
      el("p", { className: "hint", id: "koFMsg" }),
      el("div", { id: "koActs", hidden: true }, [
        el("div", { className: "kobox" }, [el("b", { textContent: "Status " }), el("span", { id: "koStatusBtns" }), el("p", { className: "hint", id: "koDiaInfo" })]),
        el("div", { className: "kobox", id: "koDiaAddBox" }, [el("b", { textContent: "Issue more diamonds to the karigar" }), diaTable("koIssMore", "koIssMoreAdd"), el("button", { type: "button", className: "btn", id: "koIssMoreSave", textContent: "Add to diamonds issued" })]),
        el("details", { className: "kobox", id: "koRecBox" }, [el("summary", { textContent: "Received from karigar - TAG USE ONLY" }),
          el("div", { className: "row" }, [lab("Date", inp("koTDate", "", { type: "date" })), lab("KT", inp("koTKt", "", { maxLength: 10 })), lab("G.GOLD g", inp("koTG", "", { maxLength: 10, inputMode: "decimal" })), lab("CS WT (g)", inp("koTCs", "", { maxLength: 10, inputMode: "decimal" })), lab("D.WT (g)", inp("koTD", "", { maxLength: 10, inputMode: "decimal" })),
            lab("LAB", inp("koTLab", "IGI / GIA…", { maxLength: 30 })), lab("CS RATE", inp("koTCsR", "", { maxLength: 10, inputMode: "decimal" })), lab("OTHER CH. ₹", inp("koTOth", "", { maxLength: 10, inputMode: "decimal" }))]),
          el("p", { className: "hint", id: "koTN" }), lab("Details", inp("koTDet", "", { maxLength: 200 }), "display:block"),
          el("div", { className: "row" }, [el("div", { style: "flex:1 1 300px" }, [el("b", { textContent: "Diamonds received back" }), diaTable("koRec", "koRecAdd")]), el("div", { style: "flex:1 1 300px" }, [el("b", { textContent: "Diamonds used" }), diaTable("koUsed", "koUsedAdd")])]),
          el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "koRecSave", textContent: "Save - received" }), el("button", { type: "button", className: "btn ghost", id: "koCopyUsed", textContent: "Copy issued → used" }), el("button", { type: "button", className: "btn ghost", id: "koTagB", textContent: "Create tag from this", hidden: true })])]),
        el("div", { className: "kobox", id: "koGoldBox" }, [el("b", { textContent: "Gold issued for this order (OG register) " }), el("p", { className: "hint", id: "koGoldInfo" }),
          el("div", { className: "row", style: "align-items:end" }, [lab("Link", el("select", { id: "koGoldSel" })), el("button", { type: "button", className: "btn ghost", id: "koGoldLink", textContent: "Link" }),
            lab("or issue new: fine g", inp("koGoldFine", "e.g. 4.000", { maxLength: 10, inputMode: "decimal" })), el("button", { type: "button", className: "btn ghost", id: "koGoldNew", textContent: "Issue from OG pool" })])])])]);
    sec.append(el("h2", { textContent: "Karigar order" }), el("p", { className: "hint", id: "koNext" }), el("div", { className: "kosum", id: "koSum" }), el("p", { className: "hint", id: "koPend" }),
      el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "koAdd", textContent: "+ New karigar order", hidden: true }), el("button", { type: "button", className: "btn ghost", id: "koXl", textContent: "Excel", hidden: true }), el("button", { type: "button", className: "btn ghost", id: "koStartB", textContent: "Set first order no.", hidden: true })]),
      el("div", { className: "kostart", id: "koStartHint", hidden: true }, [el("b", { textContent: "First time: your paper slip book is already at some order no. (e.g. 4890). " }), el("button", { type: "button", className: "btn", id: "koStartB2", textContent: "Set first order no." }),
        el("span", { className: "hint", textContent: " Old slips can also be typed with their own no. (Order no. box on a new order)." })]),
      form, el("p", { className: "hint", id: "koMsg" }),
      el("div", { className: "row", style: "align-items:center" }, [lab("Karigar", el("select", { id: "koFK" }), "flex:0 0 auto"), lab("Status", sel("koFS", [["", "All"]].concat(Object.entries(ST))), "flex:0 0 auto"),
        el("label", { style: "flex:0 0 auto;flex-direction:row;align-items:center;gap:6px" }, [el("input", { type: "checkbox", id: "koFO" }), "Only overdue"]), lab("Search", inp("koQ", "order no., item, party", { maxLength: 40 }))]),
      el("div", { id: "koList" }));
    rates.parentNode.insertBefore(sec, rates);
    $("koAdd").addEventListener("click", newOrder); $("koXl").addEventListener("click", xl); $("koSave").addEventListener("click", save); $("koClose").addEventListener("click", () => { $("koForm").hidden = true; cur = null; });
    $("koPrintB").addEventListener("click", () => { if (cur) print(cur, $("koPrintB")); else $("koFMsg").textContent = "Save the order first, then print."; });
    $("koStartB2").addEventListener("click", () => $("koStartB").click());
    $("koIss").addEventListener("input", dctAuto); $("koIss").addEventListener("change", dctAuto); $("koDct").addEventListener("input", () => { $("koDct").dataset.man = "1"; });
    $("koUsed").addEventListener("input", dwAuto); $("koUsed").addEventListener("change", dwAuto); $("koTD").addEventListener("input", () => { $("koTD").dataset.man = "1"; });
    $("koCopyUsed").addEventListener("click", () => { if (!cur) return; diaRows("koUsed", (cur.iss || []).length ? cur.iss : [{}]); dwAuto(); });
    $("koStartB").addEventListener("click", async () => { const n = prompt("Next karigar order no. - the no. on your next blank paper slip (new orders count up from here)", String(J ? J.next : 1)); if (!n) return; try { await post({ op: "start", start: Number(n) }); $("koMsg").textContent = "First order no. set to " + n + "."; load(); } catch (e) { $("koMsg").textContent = "Not set: " + (e.message || e) + "."; } });
    $("koKSel").addEventListener("change", () => { $("koKNew").hidden = $("koKSel").value !== "__new"; });
    $("koDrawF").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) upload(f); e.target.value = ""; }); $("koDrawCam").addEventListener("click", () => $("koDrawCamIn").click()); $("koDrawCamIn").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) upload(f); e.target.value = ""; });
    [["koIssAdd", "koIss"], ["koIssMoreAdd", "koIssMore"], ["koRecAdd", "koRec"], ["koUsedAdd", "koUsed"]].forEach(([b, t]) => $(b).addEventListener("click", () => $(t).appendChild(diaRow({}))));
    $("koIssMoreSave").addEventListener("click", () => { if (cur) act({ op: "diaadd", no: cur.no, iss: diaGet("koIssMore") }, "Diamonds added to issued."); });
    ["koTG", "koTCs", "koTD"].forEach(i => $(i).addEventListener("input", nPrev));
    $("koRecSave").addEventListener("click", () => { if (cur) act({ op: "receive", no: cur.no, tDate: $("koTDate").value, tKt: $("koTKt").value.trim(), gGold: $("koTG").value, csWt: $("koTCs").value, dWt: $("koTD").value, lab: $("koTLab").value.trim(), csRate: $("koTCsR").value, otherCh: $("koTOth").value, details: $("koTDet").value.trim(), rec: diaGet("koRec"), used: diaGet("koUsed") }, "Received - tag figures saved."); });
    $("koTagB").addEventListener("click", makeTag);
    $("koGoldLink").addEventListener("click", () => { if (cur && $("koGoldSel").value) act({ op: "gold", no: cur.no, link: $("koGoldSel").value }, "Gold issue linked to the order."); });
    $("koGoldNew").addEventListener("click", () => { if (!cur) return; if (!(num($("koGoldFine").value) > 0)) { $("koFMsg").textContent = "Type the fine g to issue."; return; } act({ op: "gold", no: cur.no, fine: $("koGoldFine").value }, "Gold issued to the karigar from the OG pool (also in OG register > Outward list) and linked."); });
    ["koFK", "koFS", "koFO"].forEach(i => $(i).addEventListener("change", render)); $("koQ").addEventListener("input", render);
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "korder"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 1200);
})();
