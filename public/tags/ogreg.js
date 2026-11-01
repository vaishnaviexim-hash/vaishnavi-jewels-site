/* VJ Tags - OG register (owner Abhinav 01/11/2026 15:11, C-20261101-OGTAB).
   Old gold (OG) slips get their own tab, like New tag: OG no. (runs in order 151, 152, 153 ...) + party name (+ mobile, city, fine g, note).
   A Gold to Gold bill then offers only the FREE OGs - those in this register and not yet on a live bill. The server checks everything again:
   one OG no. once, only Abhinav / Shilpiji may change or delete, an OG on a bill cannot be deleted, the sales login only reads. */
(function () {
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
