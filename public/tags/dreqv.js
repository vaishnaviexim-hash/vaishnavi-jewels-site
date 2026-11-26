/* VJ Tags - Diamond requirements: answers (owner Abhinav 26/11/2026 14:37-14:38, C-20261126-DREQVIEW).
   Only Abhinav and Fenil see this (the server sends dreq/ docs only to them). Requirements come from the website page
   /diamond-requirement (customers + team). Here: pick a requirement from the drop-down -> who asked, status, and every matching
   stone from supplier replies / stock Excels / VDB / Kira, CHEAPEST FIRST, with quick filters (table %, depth %, lab, source) and
   Yes / No + why for each stone - those picks train the rules that pre-filter the next lists. DOM nodes only (no HTML from data). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => k != null && k !== "" && e.append(k)); return e; };
  let sec = null, db = null, reqs = [], subs = false, cur = "";
  const fmt = n => n == null ? "" : "Rs " + Math.round(n).toLocaleString("en-IN");
  const dmy = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-IN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }); };
  function say(t, bad) { const m = $("dqMsg"); if (!m) return; m.textContent = t || ""; m.style.color = bad ? "var(--bad)" : "var(--ok)"; }
  function what(r) {
    const ct = r.ctMin != null && r.ctMax != null ? (r.ctMin === r.ctMax ? r.ctMin + " ct" : r.ctMin + "-" + r.ctMax + " ct") : r.ctMin != null ? r.ctMin + "+ ct" : "up to " + r.ctMax + " ct";
    return [r.type, (r.shape || []).join("/"), ct, (r.color || []).join(",") + (r.fancy ? " " + r.fancy : ""), (r.clarity || []).join(","), (r.cut || []).length ? "Cut " + r.cut.join(",") : "", (r.lab || []).join(","), r.qty ? r.qty + " pcs" : "", r.pair ? "pair" : ""].filter(Boolean).join(" · ");
  }
  function options() {
    const s = $("dqSel"), showClosed = $("dqClosed").checked, keep = cur;
    const list = reqs.filter(r => showClosed || r.status !== "Closed").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    s.textContent = "";
    if (!list.length) { s.appendChild(new Option("No requirements yet", "")); cur = ""; return; }
    list.forEach(r => s.appendChild(new Option((r.no || "REQ") + " · " + (r.name || "") + " · " + what(r).slice(0, 60) + " · " + (r.stones || []).length + " stones" + (r.status === "Closed" ? " (closed)" : ""), r.id)));
    cur = list.some(r => r.id === keep) ? keep : list[0].id; s.value = cur;
  }
  async function patch(r, data) { try { await db.doc("dreq/" + r.id).update(data); } catch (e) { say("Not saved: " + (e && e.message || e), true); } }
  function render() {
    if (!sec || sec.hidden) return;
    options();
    const box = $("dqOne"); box.textContent = "";
    const r = reqs.find(x => x.id === cur); if (!r) { box.appendChild(el("p", { className: "hint", textContent: "Requirements from the website page vaishnavijewels.com/diamond-requirement appear here." })); return; }
    const who = [r.name, r.mobile ? "+91 " + r.mobile : "", r.city, r.from ? "(" + r.from + ")" : ""].filter(Boolean).join(" · ");
    const close = el("button", { type: "button", className: "btn ghost", textContent: r.status === "Closed" ? "Reopen" : "Close" });
    close.addEventListener("click", () => patch(r, { status: r.status === "Closed" ? (r.sent ? "Sent" : "New") : "Closed" }));
    box.append(el("div", { className: "dqhead" }, [
      el("div", {}, [el("strong", { textContent: (r.no || "") + "  " }), el("span", { className: "dqst", textContent: r.status }), el("span", { className: "hint", textContent: "  " + dmy(r.createdAt) })]),
      el("div", { textContent: what(r) }), r.remarks ? el("div", { className: "hint", textContent: "Note: " + r.remarks }) : "",
      el("div", { className: "hint", textContent: "Asked by: " + who }),
      el("div", { className: "hint", textContent: r.status === "New" ? "Waiting to send (daytime)" : "Sent to " + (r.sent || 0) + " suppliers · " + (r.replies || 0) + " replied · " + (r.stones || []).length + " matching stones" }),
      r.rules ? el("div", { className: "hint", textContent: "Your rules used: " + r.rules }) : "", close]));
    // quick filters
    const f = { tmin: Number($("dqTmin").value) || 0, tmax: Number($("dqTmax").value) || 0, dmin: Number($("dqDmin").value) || 0, dmax: Number($("dqDmax").value) || 0, lab: $("dqLab").value, src: $("dqSrc").value, hideNo: $("dqHideNo").checked };
    const all = (r.stones || []).map((s, i) => Object.assign({ i }, s));
    const rows = all.filter(s => (!f.tmin || (s.tbl != null && s.tbl >= f.tmin)) && (!f.tmax || (s.tbl != null && s.tbl <= f.tmax)) && (!f.dmin || (s.dep != null && s.dep >= f.dmin)) && (!f.dmax || (s.dep != null && s.dep <= f.dmax))
      && (!f.lab || s.lab === f.lab) && (!f.src || s.src === f.src) && !(f.hideNo && s.pick === "N"));
    if (!all.length) { box.appendChild(el("p", { className: "hint", textContent: "No supplier answers yet." })); return; }
    const head = ["#", "Pick", "Rs/ct", "Total", "Carat", "Shape", "Col", "Cla", "Cut/Pol/Sym", "Lab", "Cert", "Table", "Depth", "mm", "Fl", "Supplier", "Phone", "From", "Why"];
    const tb = el("table", { className: "dqtab" }), tr0 = el("tr"); head.forEach(h => tr0.appendChild(el("th", { textContent: h }))); tb.appendChild(el("thead", {}, [tr0]));
    const body = el("tbody");
    rows.forEach((s, k) => {
      const y = el("button", { type: "button", className: "dqyn" + (s.pick === "Y" ? " on" : ""), textContent: "Yes" }), n = el("button", { type: "button", className: "dqyn no" + (s.pick === "N" ? " on" : ""), textContent: "No" });
      const why = el("input", { value: s.why || "", placeholder: "why", maxLength: 80 }); why.style.width = "120px";
      const setPick = (p) => { const st = (r.stones || []).map((x, j) => j === s.i ? Object.assign({}, x, { pick: x.pick === p ? "" : p, why: why.value }) : x); patch(r, { stones: st }); };
      y.addEventListener("click", () => setPick("Y")); n.addEventListener("click", () => setPick("N"));
      why.addEventListener("change", () => { const st = (r.stones || []).map((x, j) => j === s.i ? Object.assign({}, x, { why: why.value }) : x); patch(r, { stones: st }); });
      const tr = el("tr", { className: s.pick === "N" ? "dqno" : s.pick === "Y" ? "dqyes" : "" });
      [String(k + 1), el("span", {}, [y, n]), fmt(s.rpc), fmt(s.tot), s.ct != null ? String(s.ct) : "", s.shape, s.col, s.cla, [s.cut, s.pol, s.sym].filter(Boolean).join("/"), s.lab, s.cert, s.tbl != null ? s.tbl + "%" : "", s.dep != null ? s.dep + "%" : "", s.meas, s.fl, s.sup, s.ph, s.src, why]
        .forEach(v => { const td = el("td"); if (typeof v === "string") td.textContent = v; else td.append(v); tr.appendChild(td); });
      body.appendChild(tr);
    });
    tb.appendChild(body);
    box.append(el("p", { className: "hint", textContent: rows.length + " of " + all.length + " stones shown - cheapest first." }), el("div", { className: "dqwrap" }, [tb]));
  }
  function subscribe() { if (subs || !db) return; subs = true; db.collection("dreq").limit(100000).onSnapshot(s => { reqs = s.docs.map(d => Object.assign({ id: d.id }, d.data())); render(); }); }
  function show(on) {
    sec.hidden = !on; if (!on) return;
    document.querySelectorAll("section.card").forEach(x => { if (x !== sec && x.parentNode === sec.parentNode) x.hidden = true; });
    document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "dreq" ? "true" : "false"));
    (async () => { try { db = db || await window.claude.use("db"); if (!db) return say("Not signed in.", true); subscribe(); render(); } catch (e) { say("Could not load: " + (e && e.message || e), true); } })();
  }
  function build() {
    const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-dreq")) return;
    const b = el("button", { id: "t-dreq", textContent: "Diamond requirements" }); b.setAttribute("role", "tab"); b.dataset.tab = "dreq"; b.setAttribute("aria-selected", "false"); nav.appendChild(b);
    const st = el("style"); st.textContent = ".dqhead{display:flex;flex-direction:column;gap:4px;border:1px solid var(--line,#ddd);border-radius:10px;padding:10px 12px;margin:8px 0}.dqhead .btn{align-self:flex-start}" +
      ".dqst{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--fg);color:var(--bg)}.dqwrap{overflow-x:auto;max-height:60vh;overflow-y:auto;border:1px solid var(--line,#ddd);border-radius:8px}" +
      ".dqtab{border-collapse:collapse;font-size:13px;white-space:nowrap;width:100%}.dqtab th{position:sticky;top:0;background:var(--surface,#f4f1ea);text-align:left;padding:6px 8px;font-size:12px}.dqtab td{padding:5px 8px;border-top:1px solid var(--line,#eee)}" +
      ".dqyn{font:inherit;font-size:12px;padding:3px 8px;margin-right:4px;border:1px solid var(--line,#ccc);border-radius:6px;background:transparent;cursor:pointer;color:var(--fg)}.dqyn.on{background:#1f7a3d;color:#fff;border-color:#1f7a3d}.dqyn.no.on{background:#9b1c1c;border-color:#9b1c1c}" +
      ".dqno td{opacity:.45}.dqyes td{background:rgba(31,122,61,.06)}.dqf{display:flex;flex-wrap:wrap;gap:8px;align-items:end}.dqf label{min-width:0}.dqf input{width:80px}";
    document.head.appendChild(st);
    sec = el("section", { className: "card", id: "p-dreq", hidden: true });
    const sel = el("select", { id: "dqSel" }); sel.style.minWidth = "0"; sel.style.width = "100%";
    const cl = el("input", { type: "checkbox", id: "dqClosed" }); cl.style.width = "auto"; const cll = el("label", {}, [cl, " Closed too"]); cll.style.cssText = "flex-direction:row;align-items:center;gap:6px";
    const num = (id, ph) => el("input", { id, placeholder: ph, inputMode: "decimal", maxLength: 6 });
    const lab = el("select", { id: "dqLab" }); ["", "IGI", "GIA", "GCAL", "SGL", "Other"].forEach(v => lab.appendChild(new Option(v || "Any lab", v)));
    const src = el("select", { id: "dqSrc" }); ["", "WhatsApp", "Excel", "VDB", "Kira"].forEach(v => src.appendChild(new Option(v || "Any source", v)));
    const hn = el("input", { type: "checkbox", id: "dqHideNo" }); hn.style.width = "auto"; const hnl = el("label", {}, [hn, " Hide my No"]); hnl.style.cssText = "flex-direction:row;align-items:center;gap:6px";
    const L = (t, c) => { const l = el("label", { textContent: t }); l.append(c); return l; };
    sec.append(el("h2", { textContent: "Diamond requirements" }),
      el("div", { className: "row" }, [L("Requirement", sel), cll]),
      el("div", { className: "dqf" }, [L("Table % min", num("dqTmin", "54")), L("max", num("dqTmax", "60")), L("Depth % min", num("dqDmin", "60")), L("max", num("dqDmax", "63")), L("Lab", lab), L("Source", src), hnl]),
      el("p", { className: "hint", id: "dqMsg", role: "status" }), el("div", { id: "dqOne" }));
    rates.parentNode.insertBefore(sec, rates);
    sel.addEventListener("change", () => { cur = sel.value; render(); });
    [cl, lab, src, hn].forEach(x => x.addEventListener("change", render)); ["dqTmin", "dqTmax", "dqDmin", "dqDmax"].forEach(i => $(i).addEventListener("input", render));
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "dreq"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 800); setTimeout(build, 2500);
})();
