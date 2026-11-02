/* VJ Tags - OG register (owner Abhinav 01/11/2026 15:11, C-20261101-OGTAB).
   Old gold (OG) slips get their own tab, like New tag: OG no. (runs in order 151, 152, 153 ...) + party name (+ mobile, city, fine g, note).
   A Gold to Gold bill then offers only the FREE OGs - those in this register and not yet on a live bill. The server checks everything again:
   one OG no. once, only Abhinav / Shilpiji may change or delete, an OG on a bill cannot be deleted, the sales login only reads. */
/* VJ Tags - OG register = old gold INWARD / OUTWARD register (owner Abhinav 02/11/2026 14:13 + 14:17, C-20261102-OGREG2; the old code is kept below, switched off).
   INWARD: OG no. + date + source. PARTY = customer's old gold: gross g x actual tunch % = actual fine; party credit tunch = actual - margin (0/1/2, default 2)
   -> party credit fine (what the party gets, and what a Gold to Gold bill prefills); margin fine = actual - credit (our profit). OWN STOCK = one of our pieces
   melted: type its tag code, the piece leaves stock, its gold x karat purity = fine (tunch editable), its diamonds go to 'Diamonds to get back from karigar'.
   OUTWARD: fine issued to a karigar, or moved to our own stock. Summary on top: OG fine in hand (actual), month / all-time totals, per-karigar balance,
   diamonds pending. The page only shows what the server works out (it recalculates every figure); the preview while typing uses the same formula.
   Abhinav / Shilpiji edit / cancel (old version kept), staff / tagger add, the sales login reads. Margin and profit come to admin logins only. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const r3 = n => (Math.round((Number(n) || 0) * 1000) / 1000).toFixed(3);
  const g3 = n => r3(n) + " g";
  const big = n => { const v = Number(n) || 0; return Math.abs(v) >= 1000 ? (Math.round(v) / 1000).toFixed(3) + " kg" : r3(v) + " g"; };
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const num = v => { const x = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, "")); return isFinite(x) ? x : NaN; };
  const mg = v => Math.round((Number(v) || 0) * 1000);
  const N = x => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const tun = v => { const s = String(v == null ? "" : v).trim(); if (!s) return NaN; let n = parseFloat(s.replace(/[^0-9.]/g, "")); if (!isFinite(n) || n <= 0) return NaN; if (n <= 1.1) n *= 100; return Math.round(n * 100) / 100; }; // tunch always in PERCENT (owner 02/11 14:35): 0.751 or 75.1 -> 75.1
  let sec = null, J = null, view = "in", stockTag = null; /* 02/11 14:35: own stock = a. whole piece (stock), b. part of a piece (part: tag stays, its weight goes down), c. plain fine / own gold (own) */
  const post = async body => { const r = await fetch("/api/vj/og", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status); return j; };
  const css = `#p-ogreg .ogsum{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:8px 0 14px}
#p-ogreg .ogtile{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface)}
#p-ogreg .ogtile .k{font-size:13px;color:var(--muted)}#p-ogreg .ogtile .v{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.25}
#p-ogreg .ogtile .s{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
#p-ogreg .oghand{grid-column:1/-1;background:var(--gold-soft);border-color:var(--gold)}#p-ogreg .oghand .v{font-size:40px;color:var(--gold)}
#p-ogreg .ogadm{border-style:dashed}#p-ogreg .ogprev{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}
#p-ogreg .ogprev div{border:1px solid var(--line);border-radius:8px;padding:6px 10px;min-width:130px}#p-ogreg .ogprev b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
#p-ogreg .ogprev .main{background:var(--ok-soft);border-color:var(--ok)}#p-ogreg tr.ogx td{opacity:.5;text-decoration:line-through}
#p-ogreg .ogtabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}#p-ogreg .ogtabs .btn[aria-pressed="true"]{background:var(--gold);color:#fff;border-color:var(--gold)}
#p-ogreg .ogbox{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0}`;

  async function load() {
    const m = $("ogMsg");
    try { const r = await fetch("/api/vj/ogs", { credentials: "same-origin", cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); J = j;
      const n = $("ogNo"); if (n && !n.value && j.next) n.value = String(j.next);
      $("ogAddIn").hidden = !j.canAdd; $("ogAddOut").hidden = !j.canAdd; $("ogXl").hidden = !j.admin;
      document.querySelectorAll("#p-ogreg .ogA").forEach(x => { x.hidden = !j.admin; });
      kList(); summary(); render();
    } catch (e) { if (m) m.textContent = "Could not load the OG register (" + (e.message || e) + ")."; }
  }
  function tile(k, v, s, cls) { return el("div", { className: "ogtile" + (cls ? " " + cls : "") }, [el("div", { className: "k", textContent: k }), el("div", { className: "v", textContent: v }), s ? el("div", { className: "s", textContent: s }) : ""]); }
  function summary() {
    const box = $("ogSumBox"); if (!box || !J) return; box.textContent = ""; const S = J.sum || {}, ym = $("ogMon").value || today().slice(0, 7), M = (S.months || {})[ym] || { n: 0, gross: 0, cred: 0, act: J.admin ? 0 : null, margin: J.admin ? 0 : null }, A = S.all || {}, OM = (S.outMonths || {})[ym] || { issued: 0, stock: 0 };
    const ml = ym.split("-").reverse().join("-");
    if (S.inHand != null) box.append(tile("OG fine in hand (actual)", big(S.inHand), "Actual fine in − issued to karigars (" + g3(S.issued) + ") − moved to our stock (" + g3(S.toStock) + ")", "oghand"));
    box.append(tile("Gross in · " + ml, big(M.gross), "All time: " + big(A.gross) + " · " + (M.n || 0) + " / " + (A.n || 0) + " OGs"));
    if (J.admin) box.append(tile("Actual fine in · " + ml, big(M.act), "All time: " + big(A.act), "ogadm"));
    box.append(tile("Party credit fine · " + ml, big(M.cred), "All time: " + big(A.cred)));
    if (J.admin) box.append(tile("Margin profit fine · " + ml, big(M.margin), "All time: " + big(A.margin), "ogadm"));
    if (S.inHand != null) box.append(tile("Issued · " + ml, big(OM.issued), "Moved to stock: " + big(OM.stock)));
    if (S.perKarigar) { const k = el("div", { className: "ogtile" }, [el("div", { className: "k", textContent: "Fine with karigars (balance)" })]);
      if (!S.perKarigar.length) k.append(el("div", { className: "s", textContent: "Nothing issued yet." }));
      S.perKarigar.forEach(x => k.append(el("div", { style: "font-size:20px;font-weight:700;font-variant-numeric:tabular-nums", textContent: x.name + ": " + big(x.fine) })));
      if (S.inHand != null) box.append(k); }
    if (S.diaPending) { const d = S.diaPending; box.append(tile("Diamonds pending from karigars", d.pcs + " pcs · " + Number(d.ct || 0).toFixed(3) + " ct", Object.entries(d.byKarigar || {}).map(([n, v]) => n + ": " + v.pcs + " pcs / " + Number(v.ct).toFixed(3) + " ct").join(" · ") || "None pending")); }
    $("ogAsOf").textContent = "As of " + (S.asOf ? S.asOf.slice(8, 10) + "-" + S.asOf.slice(5, 7) + "-" + S.asOf.slice(0, 4) + " " + S.asOf.slice(11) : new Date().toLocaleString("en-IN")) + (J.next ? " · next OG no.: " + J.next : "");
  }
  function kList() { const dl = $("ogKdl"); if (!dl || !J) return; dl.textContent = ""; (J.karigars || []).forEach(k => dl.appendChild(el("option", { value: k }))); }
  // ---------- inward form ----------
  function src() { const s = (document.querySelector("input[name=ogSrc]:checked") || {}).value || "party"; return s === "party" ? "party" : ((document.querySelector("input[name=ogOwn]:checked") || {}).value || "stock"); }
  function srcSync() { const s = src(); $("ogParty").hidden = s !== "party"; $("ogOwnBox").hidden = s === "party"; $("ogStock").hidden = s !== "stock" && s !== "part"; $("ogWhole").hidden = s !== "stock"; $("ogPart").hidden = s !== "part"; $("ogPlain").hidden = s !== "own"; prev(); }
  function calc() { // same formula as the server (integer milligrams); the server works it out again on Save
    const s = src();
    if (s === "stock") { if (!stockTag) return null; const t = tun($("ogSTunch").value), tn = t > 0 ? t : stockTag.karT; return { gross: stockTag.gMg / 1000, act: Math.round(stockTag.gMg * tn / 100) / 1000, tunch: tn }; }
    if (s === "part" || s === "own") { const p = s === "part" ? "ogP" : "ogOwn", g = mg(num($(p + "Gross").value)), t = tun($(p + "Tunch").value), f = num($(p + "Fine").value);
      const c = t > 0 && g > 0 ? { gross: g / 1000, act: Math.round(g * t / 100) / 1000, tunch: t } : f > 0 ? { gross: g / 1000, act: Math.round(f * 1000) / 1000, tunch: null } : null;
      if (c && s === "part" && stockTag && !stockTag.edit) { const ln = (stockTag.lines || [])[Number($("ogPLine").value) || 0]; c.after = (stockTag.gMg - g) / 1000; c.bad = !ln || g >= mg(ln.net) || g >= stockTag.gMg; } return c; }
    const g = mg(num($("ogGross").value)), t = tun($("ogTunch").value), m = J && J.admin ? num($("ogMargin").value) : 2;
    if (!(t > 0)) { const f = num($("ogFine").value); return f > 0 ? { gross: g / 1000, cred: Math.round(f * 1000) / 1000, act: Math.round(f * 1000) / 1000, margin: 0, ct: null } : null; }
    if (!(g > 0)) return null; const ct = Math.max(0, Math.round((t - (m >= 0 ? m : 2)) * 100) / 100), a = Math.round(g * t / 100), c = Math.round(g * ct / 100);
    return { gross: g / 1000, act: a / 1000, ct, cred: c / 1000, margin: (a - c) / 1000, t };
  }
  function prev() { const box = $("ogPrev"); if (!box) return; box.textContent = ""; const c = calc(); if (!c) return; const b = (k, v, cls) => box.append(el("div", { className: cls || "" }, [k, el("b", { textContent: v })]));
    const s = src();
    if (s === "stock") { b("Gold (gross) g", r3(c.gross)); b("Tunch %", String(c.tunch)); b("Fine in", g3(c.act), "main"); if (stockTag && stockTag.ct) b("Diamonds to get back", stockTag.pcs + " pcs · " + stockTag.ct.toFixed(3) + " ct"); return; }
    if (s === "part" || s === "own") { b(s === "part" ? "Part gross g" : "Gross g", c.gross ? r3(c.gross) : "-"); if (c.tunch) b("Tunch %", String(c.tunch)); b("Fine in", g3(c.act), "main");
      if (s === "part" && c.after != null) b("Tag gold after", c.bad ? "too much - must be less than the gold line" : g3(c.after)); return; }
    if (J && J.admin && c.ct != null) { b("Actual fine", g3(c.act)); b("Party credit tunch", c.ct + " %"); }
    b("Party credit fine", g3(c.cred), "main"); if (J && J.admin && c.ct != null) b("Our margin fine", g3(c.margin)); }
  function findTag() { const q = String($("ogCode").value || "").trim(), m = $("ogStockInfo"); stockTag = null; m.textContent = ""; $("ogSTunch").value = ""; ["ogPLine", "ogPDLine"].forEach(i => { $(i).textContent = ""; }); if (!q) { prev(); return; }
    const all = (window.VJ_TAGS ? window.VJ_TAGS() : []), qu = q.toUpperCase().replace(/\s+/g, ""), nq = N(q);
    let hit = /^[A-Z]{3}\d+[A-Z]{3}$/.test(qu) ? all.filter(t => t.code && String(t.code).toUpperCase() === qu) : [];
    if (!hit.length) hit = all.filter(t => (/^\d+$/.test(qu) && String(t.no) === qu) || (nq && (N(t.designNo) === nq || N(t.label) === nq))).slice(0, 12);
    if (!hit.length) { const sold = (window.VJ_TAGS_ALL ? window.VJ_TAGS_ALL() : []).filter(t => t.status === "sold" && ((/^[A-Z]{3}\d+[A-Z]{3}$/.test(qu) && String(t.code || "").toUpperCase() === qu) || (/^\d+$/.test(qu) && String(t.no) === qu) || (nq && (N(t.designNo) === nq || N(t.label) === nq))));
      m.textContent = sold.length ? sold.slice(0, 5).map(t => t.label + (t.sold && t.sold.og ? " was already moved to OG " + t.sold.og : " is sold on bill " + ((t.sold && t.sold.no) || ""))).join("; ") + " - not in stock." : "No piece in stock with " + q + ". Type the price code, the tag no. or the design no. (same as Bill > Add piece)."; prev(); return; }
    if (hit.length > 1) { m.append("Several pieces match - tap the right one: "); hit.forEach(t => { const b = el("button", { type: "button", className: "btn ghost", textContent: (t.designNo ? t.designNo + " · " : "") + t.label }); b.addEventListener("click", () => { $("ogCode").value = t.label; findTag(); }); m.append(b, " "); }); prev(); return; }
    const t = hit[0], pur = Object.assign({ "24K": 1, "22K": 0.92, "18K": 0.76, "14K": 0.60, "9K": 0.385 }, ((window.VJ_SETTINGS && window.VJ_SETTINGS()) || {}).purity || {});
    let lines = (t.gold || []).map((g, i) => ({ g, i })).filter(x => x.g && Number(x.g.net) > 0).map(({ g, i }) => ({ i, k: g.k, net: Number(g.net), p: (x => x > 1.1 ? x / 100 : x)((Number(g.tunch) >= 0.3 && Number(g.tunch) <= 1.1 ? Number(g.tunch) : 0) || Number(pur[g.k]) || 0) }));
    if (!lines.length && t.kind === "sample") { const n = Number(t.metal && t.metal.net) || 0; if (n > 0) lines = [{ k: "14K", net: n, p: pur["14K"] || 0.6 }]; }
    const gMg = lines.reduce((a, g) => a + mg(g.net), 0), fMg = lines.reduce((a, g) => a + mg(g.net) * g.p, 0);
    if (!(gMg > 0)) { m.textContent = t.label + " has no gold weight on its tag."; prev(); return; }
    if (t.out) { m.textContent = t.label + " is out with " + (t.out.name || "someone") + " - bring it back first."; prev(); return; }
    const ds = (t.dias || []).filter(d => d && (Number(d.ct) > 0 || Number(d.pcs) > 0));
    stockTag = { id: t.id, label: t.label, gMg, karT: Math.round(fMg / gMg * 10000) / 100, pcs: ds.reduce((a, d) => a + (Number(d.pcs) || 0), 0), ct: ds.reduce((a, d) => a + (Number(d.ct) || 0), 0) };
    stockTag.lines = lines; stockTag.dias = (t.dias || []).map((d, i) => ({ d, i })).filter(x => x.d && (Number(x.d.ct) > 0 || Number(x.d.pcs) > 0));
    $("ogSTunch").value = String(stockTag.karT);
    const pl = $("ogPLine"); lines.forEach((g, j) => pl.appendChild(el("option", { value: String(j), textContent: g.k + " " + r3(g.net) + " g · tunch " + (Math.round(g.p * 10000) / 100) + " %" }))); $("ogPTunch").value = lines[0] ? String(Math.round(lines[0].p * 10000) / 100) : "";
    const dl = $("ogPDLine"); dl.appendChild(el("option", { value: "", textContent: "no diamonds taken out" })); stockTag.dias.forEach(x => dl.appendChild(el("option", { value: String(x.i), textContent: [x.d.shape, x.d.q].filter(Boolean).join(" ") + " · " + (x.d.pcs || 0) + " pcs · " + Number(x.d.ct || 0).toFixed(3) + " ct" })));
    m.append(el("div", { className: "labelno", textContent: t.label + (t.designNo ? " · design " + t.designNo : "") + (t.catName ? " · " + t.catName : "") }),
      el("div", { textContent: "Gold: " + lines.map(g => g.k + " " + r3(g.net) + " g").join(", ") + " · karat tunch " + stockTag.karT + " %" }),
      el("div", { className: "hint", textContent: ds.length ? "Diamonds: " + ds.map(d => [d.shape, d.q].filter(Boolean).join(" ") + " " + (d.pcs || 0) + " pcs " + Number(d.ct || 0).toFixed(3) + " ct").join("; ") + " - they go to 'Diamonds to get back from karigar'." : "No diamonds." }),
      el("div", { className: "hint", textContent: "a. Whole piece: on Save it leaves stock (moved to OG / melted). b. Part of a piece: the tag stays in stock, its gold weight (and diamonds taken out) go down." }));
    prev(); }
  function fill(r) { clear(); $("ogNo").value = r.no; $("ogNo").dataset.edit = "1"; $("ogNo").readOnly = true; $("ogDate").value = r.date || today(); $("ogNote").value = r.note || "";
    document.querySelectorAll("input[name=ogSrc]").forEach(x => { x.checked = x.value === (r.src === "party" ? "party" : "own"); x.disabled = true; }); document.querySelectorAll("input[name=ogOwn]").forEach(x => { x.checked = x.value === r.src; x.disabled = true; });
    if (r.src === "stock" || r.src === "part") { $("ogCode").value = r.tag ? r.tag.label : ""; $("ogCode").disabled = true; $("ogFindB").disabled = true; stockTag = { id: r.tag && r.tag.id, label: r.tag && r.tag.label, gMg: mg(r.gross), karT: Number(r.tunch) || 0, pcs: (r.tag && r.tag.pcs) || 0, ct: (r.tag && r.tag.ct) || 0, lines: [], dias: [], edit: true };
      if (r.src === "stock") $("ogSTunch").value = r.tunch != null ? String(r.tunch) : ""; else { $("ogPGross").value = String(r.gross || ""); $("ogPGross").disabled = true; $("ogPTunch").value = r.tunch != null ? String(r.tunch) : ""; $("ogPFine").value = r.tunch == null && r.actFine ? String(r.actFine) : ""; }
      $("ogStockInfo").textContent = (r.src === "part" ? "Part (" + r3(r.gross) + " g) of " : "Own piece ") + (r.tag ? r.tag.label : "") + " - only date, tunch and note can be changed. To undo, Cancel the OG (" + (r.src === "part" ? "the weight is added back to the tag" : "the piece goes back to stock") + ")."; }
    else if (r.src === "own") { $("ogOwnDesc").value = r.name || ""; $("ogOwnGross").value = r.gross ? String(r.gross) : ""; $("ogOwnTunch").value = r.tunch != null ? String(r.tunch) : ""; $("ogOwnFine").value = r.tunch == null && r.actFine ? String(r.actFine) : ""; }
    else { $("ogName").value = r.name || ""; $("ogMob").value = r.mobile || ""; $("ogCity").value = r.city || ""; $("ogItem").value = r.item || ""; $("ogGross").value = r.gross ? String(r.gross) : ""; $("ogTunch").value = r.tunch != null ? String(r.tunch) : ""; $("ogMargin").value = r.margin != null ? String(r.margin) : "2"; $("ogFine").value = r.tunch == null && r.credFine ? String(r.credFine) : ""; }
    srcSync(); $("ogSave").textContent = (r.cancelled ? "Bring back OG " : "Update OG ") + r.no; $("ogInForm").hidden = false; $("ogMsg").textContent = "Editing OG " + r.no + " - change and Update, or Clear."; window.scrollTo({ top: $("ogInForm").offsetTop - 10, behavior: "smooth" }); }
  function clear() { ["ogNo", "ogName", "ogMob", "ogCity", "ogItem", "ogGross", "ogTunch", "ogFine", "ogNote", "ogCode", "ogSTunch", "ogPGross", "ogPTunch", "ogPFine", "ogPDPcs", "ogPDCt", "ogOwnDesc", "ogOwnGross", "ogOwnTunch", "ogOwnFine"].forEach(i => { $(i).value = ""; }); $("ogPGross").disabled = false; ["ogPLine", "ogPDLine"].forEach(i => { $(i).textContent = ""; }); $("ogMargin").value = "2"; $("ogStockInfo").textContent = ""; stockTag = null;
    delete $("ogNo").dataset.edit; $("ogNo").readOnly = false; $("ogCode").disabled = false; $("ogFindB").disabled = false; document.querySelectorAll("input[name=ogSrc], input[name=ogOwn]").forEach(x => { x.disabled = false; });
    $("ogDate").value = today(); $("ogSave").textContent = "Save OG"; if (J && J.next) $("ogNo").value = String(J.next); srcSync(); }
  async function save() {
    const m = $("ogMsg"), b = $("ogSave"), edit = $("ogNo").dataset.edit === "1", s = src();
    const body = { op: "in", src: s, no: $("ogNo").value.trim(), date: $("ogDate").value, note: $("ogNote").value.trim(), edit };
    if (!body.no) { m.textContent = "Type the OG no."; return; }
    if (s === "stock") { if (!stockTag) { m.textContent = "Type the tag code of the piece and tap Find."; return; } body.tagId = stockTag.id; body.tunch = $("ogSTunch").value.trim(); }
    else if (s === "part") { if (!stockTag) { m.textContent = "Type the tag code of the piece and tap Find."; return; } const ln = (stockTag.lines || [])[Number($("ogPLine").value) || 0];
      Object.assign(body, { tagId: stockTag.id, line: ln ? ln.i : null, gross: $("ogPGross").value.trim(), tunch: $("ogPTunch").value.trim(), fine: $("ogPFine").value.trim() });
      if ($("ogPDLine").value !== "") body.dia = { line: Number($("ogPDLine").value), pcs: $("ogPDPcs").value.trim(), ct: $("ogPDCt").value.trim() };
      if (!edit && !(num(body.gross) > 0)) { m.textContent = "Type the gross weight of the part."; return; } if (!body.tunch && !body.fine) { m.textContent = "Type the tunch % or the fine g of the part."; return; } }
    else if (s === "own") { Object.assign(body, { name: $("ogOwnDesc").value.trim(), gross: $("ogOwnGross").value.trim(), tunch: $("ogOwnTunch").value.trim(), fine: $("ogOwnFine").value.trim() });
      if (!body.tunch && !body.fine) { m.textContent = "Type the fine g, or gross + tunch %."; return; } }
    else { Object.assign(body, { name: $("ogName").value.trim(), mobile: $("ogMob").value.trim(), city: $("ogCity").value.trim(), item: $("ogItem").value.trim(), gross: $("ogGross").value.trim().replace(/[^0-9.]/g, ""), tunch: $("ogTunch").value.trim().replace(/[^0-9.]/g, ""), fine: $("ogFine").value.trim().replace(/[^0-9.]/g, "") });
      if (J && J.admin) body.margin = $("ogMargin").value; if (!body.name) { m.textContent = "Type the party name."; return; }
      if (!body.tunch && !body.fine) { m.textContent = "Type the gross weight and the tested tunch %."; return; } }
    b.disabled = true; m.textContent = "Saving…";
    try { const j = await post(body), o = j.og;
      m.textContent = (edit ? "Updated" : "Saved") + ": OG " + o.no + " - " + o.name + (o.src !== "party" ? ", fine in " + g3(o.actFine) + (o.src === "stock" ? " (piece moved out of stock)" : o.src === "part" ? " (tag kept, its gold weight reduced)" : "") : ", party credit " + g3(o.credFine) + (o.credTunch != null ? " @ " + o.credTunch + " %" : "") + (o.marginFine != null && o.tunch ? " · actual " + g3(o.actFine) + ", margin " + g3(o.marginFine) : "") + ". Free for a Gold to Gold bill.");
      clear(); $("ogNo").value = ""; $("ogInForm").hidden = true; await load();
    } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; }
    b.disabled = false;
  }
  // ---------- outward form ----------
  function toSync() { const k = (document.querySelector("input[name=ogTo]:checked") || {}).value === "karigar"; $("ogKbox").hidden = !k; }
  function oClear() { ["ogOOgs", "ogOFine", "ogOGross", "ogOK", "ogONote"].forEach(i => { $(i).value = ""; }); $("ogODate").value = today(); delete $("ogOSave").dataset.id; $("ogOSave").textContent = "Save issue"; }
  function oFill(o) { oClear(); $("ogODate").value = o.date; $("ogOOgs").value = (o.ogs || []).join(", "); $("ogOFine").value = String(o.fine); $("ogOGross").value = o.gross ? String(o.gross) : ""; $("ogOK").value = o.karigar || ""; $("ogONote").value = o.note || "";
    document.querySelectorAll("input[name=ogTo]").forEach(x => { x.checked = x.value === o.to; }); toSync(); $("ogOSave").dataset.id = o.id; $("ogOSave").textContent = "Update issue"; $("ogOutForm").hidden = false; window.scrollTo({ top: $("ogOutForm").offsetTop - 10, behavior: "smooth" }); }
  async function oSave() { const m = $("ogOMsg"), b = $("ogOSave"), to = (document.querySelector("input[name=ogTo]:checked") || {}).value;
    const body = { op: "out", id: b.dataset.id || "", date: $("ogODate").value, ogs: $("ogOOgs").value.trim(), fine: $("ogOFine").value.trim().replace(/[^0-9.]/g, ""), gross: $("ogOGross").value.trim().replace(/[^0-9.]/g, ""), to, karigar: $("ogOK").value.trim(), note: $("ogONote").value.trim() };
    if (!(num(body.fine) > 0)) { m.textContent = "Type the fine grams."; return; } if (!to) { m.textContent = "Issued to a karigar or moved to our stock?"; return; } if (to === "karigar" && !body.karigar) { m.textContent = "Pick or type the karigar."; return; }
    b.disabled = true; m.textContent = "Saving…";
    try { await post(body); m.textContent = "Saved: " + g3(body.fine) + " fine " + (to === "karigar" ? "issued to " + body.karigar : "moved to our stock") + "."; oClear(); $("ogOutForm").hidden = true; view = "out"; await load(); }
    catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; } b.disabled = false; }
  // ---------- lists ----------
  function sure(btn, label, fn) { btn.addEventListener("click", async () => { if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.textContent = label; return; } btn.disabled = true; try { await fn(); } catch (e) { btn.disabled = false; $("ogMsg").textContent = "Not done: " + (e.message || e) + "."; } }); }
  function render() {
    const box = $("ogList"); if (!box || !J) return; box.textContent = ""; document.querySelectorAll("#ogTabs .btn").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === view ? "true" : "false"));
    const q = String($("ogQ").value || "").trim().toLowerCase(), ym = $("ogLMon").value, only = $("ogFree").checked; $("ogFreeL").hidden = view !== "in";
    const t = el("table", { className: "items" }), hr = el("tr"), tb = el("tbody"), A = J.admin; let rows = [], head = [];
    const td = (tr, x, cl) => tr.appendChild(el("td", { className: cl || "", textContent: x == null ? "" : x }));
    if (view === "in") {
      head = ["OG no.", "Date", "From", "Item", "Gross g"].concat(A ? ["Tunch %", "Margin", "Actual fine"] : []).concat(["Credit tunch", "Party credit fine"]).concat(A ? ["Margin fine"] : []).concat(["Status", ""]);
      rows = (J.reg || []).filter(r => (!ym || String(r.date).slice(0, 7) === ym) && (!only || (!r.bill && !r.cancelled && r.src === "party")) && (!q || [r.no, r.name, r.city, r.mobile, r.bill, r.item, r.tag && r.tag.label].join(" ").toLowerCase().includes(q))).slice().reverse();
      rows.forEach(r => { const tr = el("tr", { className: r.cancelled ? "ogx" : "" }); td(tr, r.no); td(tr, dmy(r.date));
        td(tr, r.src === "stock" ? "Own piece (whole) " + (r.tag ? r.tag.label : "") : r.src === "part" ? "Part of " + (r.tag ? r.tag.label : "") : r.src === "own" ? "Own gold: " + r.name : [r.name, r.city].filter(Boolean).join(", ") + (r.mobile ? " · " + r.mobile : "")); td(tr, r.item || (r.legacy ? "(old entry)" : "-"));
        td(tr, r.gross ? r3(r.gross) : "-", "num");
        if (A) { td(tr, r.tunch != null ? r.tunch : "-", "num"); td(tr, r.margin != null ? r.margin : "-", "num"); td(tr, r3(r.actFine), "num"); }
        td(tr, r.src !== "party" ? "-" : r.credTunch != null ? r.credTunch + " %" : "-", "num");
        const cf = el("td", { className: "num", textContent: r.src !== "party" ? (r.actFine != null ? "fine " + r3(r.actFine) : "-") : r3(r.credFine) }); cf.style.fontWeight = "700"; cf.style.fontSize = "17px"; tr.appendChild(cf);
        if (A) td(tr, r.src !== "party" ? "-" : r3(r.marginFine), "num");
        const st = el("td"); st.style.fontWeight = "600";
        st.textContent = r.cancelled ? "Cancelled " + dmy(r.cancelled.at) + (r.cancelled.why ? " (" + r.cancelled.why + ")" : "") : r.src === "part" ? "Part taken (" + r3(r.gross) + " g; tag kept)" + (r.dia ? " · " + r.dia.pcs + " pcs / " + Number(r.dia.ct).toFixed(3) + " ct dia" : "") : r.src === "own" ? "Own gold" : r.src === "stock" ? "Melted (out of stock)" + (r.tag && r.tag.ct ? " · " + r.tag.pcs + " pcs / " + Number(r.tag.ct).toFixed(3) + " ct dia" : "") : r.bill ? "On bill " + r.bill : "Free" + (r.cancelledOn ? " (bill " + r.cancelledOn + " cancelled)" : "");
        if (!r.cancelled && !r.bill && r.src === "party") st.style.color = "var(--ok)"; if (r.edited) st.title = "Edited " + dmy(r.edited.at) + " by " + r.edited.byName; tr.appendChild(st);
        const x = el("td"); x.style.whiteSpace = "nowrap";
        if (J.canDelete && !(r.cancelled && (r.src === "stock" || r.src === "part"))) { const e = el("button", { type: "button", className: "btn ghost", textContent: r.cancelled ? "Bring back" : "Edit" }); e.addEventListener("click", () => fill(r)); x.appendChild(e); }
        if (J.canDelete && !r.bill && !r.cancelled) { const d = el("button", { type: "button", className: "btn ghost", textContent: "Cancel" }); d.style.color = "var(--bad)";
          sure(d, "Sure? Cancel OG " + r.no, async () => { const why = prompt("Why cancel OG " + r.no + "? (optional)") || ""; await post({ op: "cancel", no: r.no, why }); $("ogMsg").textContent = "OG " + r.no + " cancelled (kept in the register, struck through)" + (r.src === "stock" ? "; the piece is back in stock" : r.src === "part" ? "; the part's weight is added back to the tag" : "") + "."; load(); }); x.appendChild(d); }
        tr.appendChild(x); tb.appendChild(tr); });
    } else if (view === "out") {
      head = ["Date", "OG no(s)", "To", "Fine g", "Gross g", "By", "Note", ""];
      rows = (J.out || []).filter(o => (!ym || String(o.date).slice(0, 7) === ym) && (!q || [o.karigar, o.note, (o.ogs || []).join(" "), o.to === "stock" ? "stock" : ""].join(" ").toLowerCase().includes(q)));
      rows.forEach(o => { const tr = el("tr", { className: o.cancelled ? "ogx" : "" }); td(tr, dmy(o.date)); td(tr, (o.ogs || []).length ? o.ogs.join(", ") : "OG pool");
        const to = el("td", { textContent: o.to === "karigar" ? "Karigar " + o.karigar : "Our stock (fine)" }); to.style.fontWeight = "600"; tr.appendChild(to);
        const f = el("td", { className: "num", textContent: r3(o.fine) }); f.style.fontWeight = "700"; f.style.fontSize = "17px"; tr.appendChild(f);
        td(tr, o.gross ? r3(o.gross) : "-", "num"); td(tr, o.byName); td(tr, (o.note || "") + (o.cancelled ? " · cancelled " + dmy(o.cancelled.at) + (o.cancelled.why ? " (" + o.cancelled.why + ")" : "") : ""));
        const x = el("td"); x.style.whiteSpace = "nowrap";
        if (J.canDelete && !o.cancelled) { const e = el("button", { type: "button", className: "btn ghost", textContent: "Edit" }); e.addEventListener("click", () => oFill(o)); x.appendChild(e);
          const d = el("button", { type: "button", className: "btn ghost", textContent: "Cancel" }); d.style.color = "var(--bad)";
          sure(d, "Sure? Cancel this issue", async () => { const why = prompt("Why cancel? (optional)") || ""; await post({ op: "outcancel", id: o.id, why }); $("ogMsg").textContent = "Issue cancelled (kept, struck through)."; load(); }); x.appendChild(d); }
        tr.appendChild(x); tb.appendChild(tr); });
    } else {
      head = ["OG no.", "Tag", "Shape / quality", "Pcs", "Ct", "Karigar", "Status", ""];
      rows = (J.dias || []).filter(d => d.status !== "cancelled" && (!q || [d.og, d.label, d.karigar, d.shape, d.q].join(" ").toLowerCase().includes(q))).slice().sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1));
      rows.forEach(d => { const tr = el("tr"); td(tr, d.og); td(tr, d.label || d.tag); td(tr, [d.shape, d.q].filter(Boolean).join(" ")); td(tr, d.pcs, "num"); td(tr, Number(d.ct || 0).toFixed(3), "num");
        const kc = el("td"); if (J.canAdd && d.status === "pending") { const i = el("input", { value: d.karigar || "", placeholder: "karigar", maxLength: 40 }); i.setAttribute("list", "ogKdl"); i.style.width = "120px";
            i.addEventListener("change", async () => { try { await post({ op: "dia", id: d.id, karigar: i.value.trim() }); load(); } catch (e) { $("ogMsg").textContent = "Not saved: " + (e.message || e) + "."; } }); kc.appendChild(i); } else kc.textContent = d.karigar || "-"; tr.appendChild(kc);
        const st = el("td", { textContent: d.status === "returned" ? "Returned " + dmy(d.retAt) + (d.retByName ? " (" + d.retByName + ")" : "") : "Pending" }); st.style.fontWeight = "600"; st.style.color = d.status === "returned" ? "var(--ok)" : "var(--warn)"; tr.appendChild(st);
        const x = el("td"); x.style.whiteSpace = "nowrap";
        if (J.canAdd && d.status === "pending") { const r = el("button", { type: "button", className: "btn ghost", textContent: "Mark returned" }); sure(r, "Sure? " + d.pcs + " pcs back", async () => { await post({ op: "dia", id: d.id, returned: true }); load(); }); x.appendChild(r); }
        if (J.canDelete && d.status === "returned") { const u = el("button", { type: "button", className: "btn ghost", textContent: "Undo" }); sure(u, "Sure? back to pending", async () => { await post({ op: "dia", id: d.id, returned: false }); load(); }); x.appendChild(u); }
        tr.appendChild(x); tb.appendChild(tr); });
    }
    head.forEach(h => hr.appendChild(el("th", { textContent: h }))); t.appendChild(el("thead", {}, [hr])); t.style.minWidth = (head.length * 92) + "px";
    if (!rows.length) tb.appendChild(el("tr", {}, [el("td", { colSpan: head.length, className: "hint", textContent: view === "dia" ? "No diamonds to get back." : "Nothing here" + (ym ? " for " + ym.split("-").reverse().join("-") : "") + "." })]));
    t.appendChild(tb); box.appendChild(el("div", { className: "list" }, [t]));
  }
  async function xl() { const b = $("ogXl"); b.disabled = true;
    try { const r = await fetch("/api/vj/ogs?xlsx=1", { credentials: "same-origin", cache: "no-store" }); if (!r.ok) throw new Error(r.status); const a = el("a", { href: URL.createObjectURL(await r.blob()), download: "VJ_OG_register_" + dmy(today()) + ".xlsx" }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); }
    catch (e) { $("ogMsg").textContent = "Excel not made (" + (e.message || e) + ")."; } b.disabled = false; }
  function show(on) {
    if (!sec) return; sec.hidden = !on;
    if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; });
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "ogreg" ? "true" : "false"));
      load(); window.scrollTo({ top: 0 }); }
  }
  function build() {
    const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-ogreg")) return;
    document.head.appendChild(el("style", { textContent: css }));
    const b = el("button", { id: "t-ogreg", textContent: "OG register" }); b.setAttribute("role", "tab"); b.dataset.tab = "ogreg"; b.setAttribute("aria-selected", "false");
    const bl = nav.querySelector('[data-tab="bill"]'); nav.insertBefore(b, bl ? bl.nextSibling : null);
    sec = el("section", { className: "card", id: "p-ogreg", hidden: true });
    const inp = (id, ph, extra) => Object.assign(el("input", { id, placeholder: ph || "", autocomplete: "off" }), extra || {});
    const lab = (t, i, st) => el("label", st ? { style: st } : {}, [t + " ", i]);
    const radio = (name, v, t, on) => el("label", { style: "flex:0 0 auto;flex-direction:row;align-items:center;gap:6px" }, [el("input", { type: "radio", name, value: v, checked: !!on }), t]);
    const mSel = el("select", { id: "ogMargin" }); ["0", "1", "2"].forEach(v => mSel.appendChild(el("option", { value: v, textContent: v + " %" }))); mSel.value = "2";
    const inForm = el("div", { id: "ogInForm", className: "ogbox", hidden: true }, [el("h3", { textContent: "Old gold IN" }),
      el("div", { className: "row" }, [lab("OG no.", inp("ogNo", "e.g. 189", { maxLength: 20, inputMode: "numeric" })), lab("Date", inp("ogDate", "", { type: "date", value: today() })),
        el("div", { className: "row", style: "align-items:center;flex:2 1 300px" }, [el("b", { textContent: "From:" }), radio("ogSrc", "party", "Party (customer's old gold)", true), radio("ogSrc", "own", "Our own stock / gold")])]),
      el("div", { id: "ogOwnBox", className: "row", style: "align-items:center", hidden: true }, [el("b", { textContent: "Which:" }), radio("ogOwn", "stock", "a. Whole piece (melt - tag leaves stock)", true), radio("ogOwn", "part", "b. Part of a piece (tag stays, weight goes down)"), radio("ogOwn", "own", "c. Plain fine / own gold (no tag)")]),
      el("div", { id: "ogParty" }, [
        el("div", { className: "row" }, [lab("Party name", inp("ogName", "e.g. Rohit ji", { maxLength: 60 })), lab("Mobile", inp("ogMob", "98xxxxxxxx", { maxLength: 20, inputMode: "tel" })), lab("City (optional)", inp("ogCity", "", { maxLength: 40 }))]),
        el("div", { className: "row" }, [lab("Item", inp("ogItem", "e.g. old chain + 2 rings", { maxLength: 120 }), "flex:2 1 260px"), lab("GROSS weight, g", inp("ogGross", "e.g. 10.620", { maxLength: 10, inputMode: "decimal" })), lab("ACTUAL tunch % (tested)", inp("ogTunch", "e.g. 74", { maxLength: 6, inputMode: "decimal" })),
          el("label", { className: "ogA", hidden: true }, ["Tunch margin ", mSel])]),
        el("div", { className: "row" }, [lab("Not tested? Fine g instead (optional)", inp("ogFine", "only if no tunch", { maxLength: 10, inputMode: "decimal" }))])]),
      el("div", { id: "ogStock", hidden: true }, [
        el("div", { className: "row", style: "align-items:flex-end" }, [lab("Tag code of the piece", inp("ogCode", "price code, tag no. or design no.", { maxLength: 30 })), el("div", {}, [el("button", { type: "button", className: "btn ghost", id: "ogFindB", textContent: "Find" })]), el("label", { id: "ogWhole" }, ["Tunch % (default = karat purity, e.g. 75) ", inp("ogSTunch", "e.g. 75", { maxLength: 6, inputMode: "decimal" })])]),
        el("div", { id: "ogStockInfo", className: "ogbox" }),
        el("div", { id: "ogPart", hidden: true }, [
          el("div", { className: "row" }, [lab("Gold line it comes from", el("select", { id: "ogPLine" })), lab("Part GROSS g", inp("ogPGross", "e.g. 2.150", { maxLength: 10, inputMode: "decimal" })), lab("Tunch % (e.g. 75)", inp("ogPTunch", "", { maxLength: 6, inputMode: "decimal" })), lab("or fine g", inp("ogPFine", "only if no tunch", { maxLength: 10, inputMode: "decimal" }))]),
          el("div", { className: "row" }, [lab("Diamonds taken out (optional)", el("select", { id: "ogPDLine" })), lab("Pcs", inp("ogPDPcs", "", { maxLength: 5, inputMode: "numeric" })), lab("Ct", inp("ogPDCt", "", { maxLength: 8, inputMode: "decimal" }))])])]),
      el("div", { id: "ogPlain", hidden: true }, [el("div", { className: "row" }, [lab("Description", inp("ogOwnDesc", "e.g. own fine gold / bullion", { maxLength: 60 }), "flex:2 1 260px"), lab("Fine g", inp("ogOwnFine", "e.g. 100.000", { maxLength: 10, inputMode: "decimal" })), lab("or gross g", inp("ogOwnGross", "", { maxLength: 10, inputMode: "decimal" })), lab("+ tunch %", inp("ogOwnTunch", "e.g. 99.5", { maxLength: 6, inputMode: "decimal" }))])]),
      el("div", { className: "row" }, [lab("Note (optional)", inp("ogNote", "", { maxLength: 120 }), "flex:2 1 300px")]),
      el("div", { id: "ogPrev", className: "ogprev" }),
      el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "ogSave", textContent: "Save OG" }), el("button", { type: "button", className: "btn ghost", id: "ogClear", textContent: "Clear" })])]);
    const outForm = el("div", { id: "ogOutForm", className: "ogbox", hidden: true }, [el("h3", { textContent: "Old gold OUT (issue)" }),
      el("div", { className: "row" }, [lab("Date", inp("ogODate", "", { type: "date", value: today() })), lab("OG no(s) - blank = from OG pool", inp("ogOOgs", "e.g. 151, 152", { maxLength: 200 })), lab("Fine g", inp("ogOFine", "e.g. 25.000", { maxLength: 10, inputMode: "decimal" })), lab("Gross g (if known)", inp("ogOGross", "", { maxLength: 10, inputMode: "decimal" }))]),
      el("div", { className: "row", style: "align-items:center" }, [radio("ogTo", "karigar", "Issued to KARIGAR", true), radio("ogTo", "stock", "Moved to our stock (refined / kept as fine)"),
        el("label", { id: "ogKbox" }, ["Karigar (pick or type a new name) ", Object.assign(inp("ogOK", "e.g. Montu", { maxLength: 40 }), {})]), el("datalist", { id: "ogKdl" })]),
      el("div", { className: "row" }, [lab("Note (optional)", inp("ogONote", "", { maxLength: 120 }), "flex:2 1 300px")]),
      el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "ogOSave", textContent: "Save issue" }), el("button", { type: "button", className: "btn ghost", id: "ogOClear", textContent: "Clear" })]), el("p", { className: "hint", id: "ogOMsg" })]);
    const tabs = el("div", { className: "ogtabs", id: "ogTabs" }, [["in", "Inward list"], ["out", "Outward list"], ["dia", "Diamonds to get back"]].map(([v, t]) => { const x = el("button", { type: "button", className: "btn ghost", textContent: t }); x.dataset.v = v; x.addEventListener("click", () => { view = v; render(); }); return x; }));
    sec.append(el("h2", { textContent: "OG register (old gold)" }), el("p", { className: "hint", id: "ogAsOf" }),
      el("div", { className: "row", style: "align-items:center" }, [lab("Month totals for", inp("ogMon", "", { type: "month", value: today().slice(0, 7) }), "flex:0 0 auto")]),
      el("div", { className: "ogsum", id: "ogSumBox" }),
      el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "ogAddIn", textContent: "+ Old gold IN", hidden: true }), el("button", { type: "button", className: "btn", id: "ogAddOut", textContent: "+ Old gold OUT (issue)", hidden: true }), el("button", { type: "button", className: "btn ghost", id: "ogXl", textContent: "Excel (inward + outward)", hidden: true })]),
      inForm, outForm, el("p", { className: "hint", id: "ogMsg" }), tabs,
      el("div", { className: "row", style: "align-items:center" }, [lab("Search", inp("ogQ", "OG no., party, mobile, karigar, tag", { maxLength: 40 })), lab("Month", inp("ogLMon", "", { type: "month" }), "flex:0 0 auto"),
        el("label", { id: "ogFreeL", style: "flex:0 0 auto;flex-direction:row;align-items:center;gap:6px" }, [el("input", { type: "checkbox", id: "ogFree" }), "Only free OGs (party, not on a bill)"])]),
      el("div", { id: "ogList" }));
    rates.parentNode.insertBefore(sec, rates); $("ogOK").setAttribute("list", "ogKdl");
    $("ogSave").addEventListener("click", save); $("ogClear").addEventListener("click", () => { clear(); $("ogMsg").textContent = ""; });
    $("ogOSave").addEventListener("click", oSave); $("ogOClear").addEventListener("click", () => { oClear(); $("ogOMsg").textContent = ""; });
    $("ogAddIn").addEventListener("click", () => { const f = $("ogInForm"); f.hidden = !f.hidden; if (!f.hidden && !$("ogNo").dataset.edit) clear(); });
    $("ogAddOut").addEventListener("click", () => { const f = $("ogOutForm"); f.hidden = !f.hidden; });
    $("ogXl").addEventListener("click", xl); $("ogFindB").addEventListener("click", findTag); $("ogCode").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); findTag(); } });
    document.querySelectorAll("input[name=ogSrc]").forEach(x => x.addEventListener("change", srcSync)); document.querySelectorAll("input[name=ogTo]").forEach(x => x.addEventListener("change", toSync));
    ["ogGross", "ogTunch", "ogFine", "ogSTunch", "ogPGross", "ogPTunch", "ogPFine", "ogOwnGross", "ogOwnTunch", "ogOwnFine"].forEach(i => $(i).addEventListener("input", prev)); $("ogMargin").addEventListener("change", prev);
    document.querySelectorAll("input[name=ogOwn]").forEach(x => x.addEventListener("change", srcSync));
    $("ogPLine").addEventListener("change", () => { const ln = stockTag && (stockTag.lines || [])[Number($("ogPLine").value) || 0]; if (ln) $("ogPTunch").value = String(Math.round(ln.p * 10000) / 100); prev(); });
    $("ogMon").addEventListener("change", summary); $("ogQ").addEventListener("input", render); $("ogLMon").addEventListener("change", render); $("ogFree").addEventListener("change", render);
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "ogreg"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 800);
})();
(function () { if (true) return; /* C-20261102-OGREG2: the old OG register code below is no longer used (kept for reference) */
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const g3 = n => (Math.round((Number(n) || 0) * 1000) / 1000).toFixed(3) + " g";
  const today = () => { const d = new Date(Date.now() + 5.5 * 3600e3); return d.toISOString().slice(0, 10); };
  let sec = null, J = null;

  async function load() {
    const m = $("ogMsg");
    try { const r = await fetch("/api/vj/ogs", { credentials: "same-origin", cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); J = j;
      const n = $("ogNo"); if (n && !n.value && j.next) n.value = String(j.next);
      $("ogForm").hidden = !j.canAdd; render();
    } catch (e) { if (m) m.textContent = "Could not load the OG register (" + (e.message || e) + ")."; }
  }
  function render() {
    const box = $("ogList"); if (!box || !J) return; box.textContent = "";
    const q = String($("ogQ").value || "").trim().toLowerCase(), only = $("ogFree").checked;
    const rows = (J.reg || []).filter(r => (!only || !r.bill) && (!q || [r.no, r.name, r.city, r.mobile, r.bill].join(" ").toLowerCase().includes(q)));
    const free = (J.reg || []).filter(r => !r.bill).length;
    $("ogSum").textContent = `${(J.reg || []).length} OG${(J.reg || []).length === 1 ? "" : "s"} in the register · ${free} free (not on a bill yet)` + (J.next ? ` · next OG no.: ${J.next}` : "");
    const t = el("table", { className: "items" }); t.style.minWidth = "760px";
    const hr = el("tr"); ["OG no.", "Date", "Party", "Mobile", "Fine gold", "Note", "Status", ""].forEach(h => hr.appendChild(el("th", { textContent: h }))); t.appendChild(el("thead", {}, [hr]));
    const tb = el("tbody");
    rows.forEach(r => { const tr = el("tr"); const td = (x, cl) => tr.appendChild(el("td", { className: cl || "", textContent: x }));
      td(r.no); td(dmy(r.date)); td([r.name, r.city].filter(Boolean).join(", ")); td(r.mobile || "-"); td(r.fine ? g3(r.fine) : "-", "num"); td(r.note || "-");
      const st = el("td"); if (r.bill) { st.textContent = "On bill " + r.bill; st.style.fontWeight = "600"; } else { st.textContent = "Free" + (r.cancelledOn ? " (bill " + r.cancelledOn + " cancelled)" : ""); st.style.color = "#1e7a3c"; st.style.fontWeight = "600"; } tr.appendChild(st);
      const x = el("td"); x.style.whiteSpace = "nowrap";
      if (J.canDelete) { const e = el("button", { type: "button", className: "btn ghost", textContent: "Edit" }); e.addEventListener("click", () => fill(r)); x.appendChild(e); }
      if (J.canDelete && !r.bill) { const d = el("button", { type: "button", className: "btn ghost", textContent: "Delete" }); d.style.color = "#a12b2b";
        d.addEventListener("click", async () => { if (d.dataset.sure !== "1") { d.dataset.sure = "1"; d.textContent = "Sure? Delete OG " + r.no; return; } d.disabled = true;
          try { const rs = await fetch("/api/vj/og", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ no: r.no, del: true }) }); const j = await rs.json(); if (!rs.ok) throw new Error(j.error || rs.status); $("ogMsg").textContent = "OG " + r.no + " deleted."; load(); }
          catch (e) { d.disabled = false; $("ogMsg").textContent = "Not deleted: " + (e.message || e) + "."; } }); x.appendChild(d); }
      tr.appendChild(x); tb.appendChild(tr); });
    if (!rows.length) tb.appendChild(el("tr", {}, [el("td", { colSpan: 8, className: "hint", textContent: (J.reg || []).length ? "Nothing matches." : "No OG entered yet - add the first one above." })]));
    t.appendChild(tb); box.appendChild(el("div", { className: "list" }, [t]));
  }
  function fill(r) { $("ogNo").value = r.no; $("ogNo").dataset.edit = "1"; $("ogNo").readOnly = true; $("ogDate").value = r.date || today(); $("ogName").value = r.name || ""; $("ogMob").value = r.mobile || ""; $("ogCity").value = r.city || ""; $("ogFine").value = r.fine ? String(r.fine) : ""; $("ogNote").value = r.note || "";
    $("ogSave").textContent = "Update OG " + r.no; $("ogMsg").textContent = "Editing OG " + r.no + " - change and Update, or Clear."; window.scrollTo({ top: sec.offsetTop - 10, behavior: "smooth" }); }
  function clear() { ["ogNo", "ogName", "ogMob", "ogCity", "ogFine", "ogNote"].forEach(i => { $(i).value = ""; }); delete $("ogNo").dataset.edit; $("ogNo").readOnly = false; $("ogDate").value = today(); $("ogSave").textContent = "Save OG"; if (J && J.next) $("ogNo").value = String(J.next); }
  async function save() {
    const m = $("ogMsg"), b = $("ogSave"), edit = $("ogNo").dataset.edit === "1";
    const body = { no: $("ogNo").value.trim(), date: $("ogDate").value, name: $("ogName").value.trim(), mobile: $("ogMob").value.trim(), city: $("ogCity").value.trim(), fine: $("ogFine").value.trim().replace(/[^0-9.]/g, ""), note: $("ogNote").value.trim(), edit };
    if (!body.no) { m.textContent = "Type the OG no."; return; } if (!body.name) { m.textContent = "Type the party name."; return; }
    b.disabled = true; m.textContent = "Saving…";
    try { const r = await fetch("/api/vj/og", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      m.textContent = (edit ? "Updated" : "Saved") + ": OG " + j.og.no + " - " + j.og.name + (j.og.fine ? ", " + g3(j.og.fine) : "") + ". It is now free for a Gold to Gold bill."; clear(); $("ogNo").value = ""; await load();
    } catch (e) { m.textContent = "Not saved: " + (e.message || e) + "."; }
    b.disabled = false;
  }
  function show(on) {
    if (!sec) return; sec.hidden = !on;
    if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; });
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "ogreg" ? "true" : "false"));
      load(); window.scrollTo({ top: 0 }); }
  }
  function build() {
    const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-ogreg")) return;
    const b = el("button", { id: "t-ogreg", textContent: "OG register" }); b.setAttribute("role", "tab"); b.dataset.tab = "ogreg"; b.setAttribute("aria-selected", "false");
    const bl = nav.querySelector('[data-tab="bill"]'); nav.insertBefore(b, bl ? bl.nextSibling : null);
    sec = el("section", { className: "card", id: "p-ogreg", hidden: true });
    const inp = (id, ph, extra) => Object.assign(el("input", { id, placeholder: ph || "", autocomplete: "off" }), extra || {});
    const form = el("div", { id: "ogForm" }, [
      el("div", { className: "row" }, [el("label", {}, ["OG no. ", inp("ogNo", "e.g. 189", { maxLength: 20, inputMode: "numeric" })]), el("label", {}, ["Date ", inp("ogDate", "", { type: "date", value: today() })]), el("label", {}, ["Party name ", inp("ogName", "e.g. Rohit ji", { maxLength: 60 })])]),
      el("div", { className: "row" }, [el("label", {}, ["Mobile (optional) ", inp("ogMob", "98xxxxxxxx", { maxLength: 20, inputMode: "tel" })]), el("label", {}, ["City (optional) ", inp("ogCity", "", { maxLength: 40 })]), el("label", {}, ["Old gold, fine g (optional) ", inp("ogFine", "e.g. 4.750", { maxLength: 10, inputMode: "decimal" })])]),
      el("div", { className: "row" }, [el("label", { style: "flex:2 1 300px" }, ["Note (optional) ", inp("ogNote", "e.g. old chain + 2 rings", { maxLength: 120 })])]),
      el("div", { className: "actions" }, [el("button", { type: "button", className: "btn", id: "ogSave", textContent: "Save OG" }), el("button", { type: "button", className: "btn ghost", id: "ogClear", textContent: "Clear" })])]);
    sec.append(el("h2", { textContent: "OG register (old gold)" }), el("p", { className: "hint", textContent: "Enter every old gold slip here with its OG no. and party. A Gold to Gold bill then offers only the free OGs (not yet on a bill)." }),
      form, el("p", { className: "hint", id: "ogMsg" }), el("h2", { textContent: "All OGs" }), el("p", { className: "hint", id: "ogSum" }),
      el("div", { className: "row", style: "align-items:center" }, [el("label", {}, ["Search ", inp("ogQ", "OG no., party, mobile or bill", { maxLength: 40 })]), el("label", { style: "flex:0 0 auto;flex-direction:row;align-items:center;gap:6px" }, [el("input", { type: "checkbox", id: "ogFree" }), "Only free OGs"])]),
      el("div", { id: "ogList" }));
    rates.parentNode.insertBefore(sec, rates);
    $("ogSave").addEventListener("click", save); $("ogClear").addEventListener("click", () => { clear(); $("ogMsg").textContent = ""; });
    $("ogQ").addEventListener("input", render); $("ogFree").addEventListener("change", render);
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "ogreg"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 800);
})();
