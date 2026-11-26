/* VJ Tags - Diamond requirement (owner Abhinav 26/11/2026 12:46-14:12, C-20261126-DIAMONDREQ).
   A VDB-style form: what stone is wanted + who is asking (name, mobile, city). Saved as dreq/<id> (owner + staff logins only; the
   server cleans every field and never deletes - Closed instead). In the daytime the requirement goes from the owner's WhatsApp to the
   VDB lab-grown suppliers with ONLY our number (never the buyer's); night requirements go next morning. The person asking gets:
   "Your requirement has been noted. Our representative will contact you with the best pricing." Supplier replies are filtered to
   this exact requirement and one who-has-what list goes to the owner. Built with DOM nodes only (no HTML from data). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const L = {
    type: ["Lab-grown", "Natural"],
    shape: ["Round", "Oval", "Pear", "Cushion", "Emerald", "Radiant", "Princess", "Asscher", "Marquise", "Heart", "Baguette", "Trilliant", "Old Miner", "Rose Cut", "Other"],
    color: ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "Fancy"],
    clarity: ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "SI3", "I1", "I2"],
    cut: ["8X", "Ideal", "Excellent", "Very Good", "Good"], lab: ["IGI", "GIA", "GCAL", "SGL", "Other", "None"], fluor: ["None", "Faint", "Medium", "Strong", "V Strong"],
    from: ["Abhinav", "Shilpiji", "Fenil", "Staff", "Customer"]
  };
  const RANGES = [["0.30", "0.39"], ["0.40", "0.49"], ["0.50", "0.69"], ["0.70", "0.89"], ["0.90", "0.99"], ["1.00", "1.49"], ["1.50", "1.99"], ["2.00", "2.99"], ["3.00", "3.99"], ["4.00", "4.99"], ["5.00", "5.99"]];
  let sec = null, db = null, reqs = [], subs = false, pick = {};
  const reset = () => { pick = { type: ["Lab-grown"], shape: [], color: [], clarity: [], cut: [], polish: [], sym: [], lab: [], fluor: [] }; };
  reset();
  function say(t, bad) { const m = $("dqMsg"); if (!m) return; m.textContent = t || ""; m.style.color = bad ? "var(--bad)" : "var(--ok)"; }
  const dmy = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-IN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }); };

  function chips(key, list, single) {
    const box = el("div", { className: "dqchips" });
    list.forEach(v => {
      const b = el("button", { type: "button", className: "dqchip", textContent: v }); b.dataset.k = key; b.dataset.v = v;
      b.addEventListener("click", () => {
        const a = pick[key]; const i = a.indexOf(v);
        if (single) pick[key] = [v]; else if (i >= 0) a.splice(i, 1); else a.push(v);
        paint();
      });
      box.appendChild(b);
    });
    return box;
  }
  function paint() { sec.querySelectorAll(".dqchip").forEach(b => b.setAttribute("aria-pressed", (pick[b.dataset.k] || []).includes(b.dataset.v) ? "true" : "false")); }
  const lab = (t, c) => { const l = el("label", { textContent: t }); l.append(c); return l; };
  const grp = (t, c) => el("div", { className: "dqgrp" }, [el("div", { className: "dqh", textContent: t }), c]);

  function summary(r) {
    const ct = r.ctMin != null && r.ctMax != null ? (r.ctMin === r.ctMax ? r.ctMin + " ct" : r.ctMin + "-" + r.ctMax + " ct") : r.ctMin != null ? r.ctMin + "+ ct" : "up to " + r.ctMax + " ct";
    return [r.type, (r.shape || []).join("/"), ct, (r.color || []).join(",") + (r.fancy ? " " + r.fancy : ""), (r.clarity || []).join(","),
      (r.cut || []).length ? "Cut " + r.cut.join(",") : "", (r.lab || []).length ? r.lab.join(",") : "", r.qty ? r.qty + " pcs" : "", r.pair ? "pair" : ""].filter(Boolean).join(" · ");
  }
  async function save() {
    const g = id => String($(id).value || "").trim();
    const data = Object.assign({}, pick, { type: pick.type[0] || "Lab-grown", ctMin: g("dqMin"), ctMax: g("dqMax"), qty: g("dqQty"), pair: $("dqPair").checked, fancy: g("dqFancy"), remarks: g("dqRem"),
      name: g("dqName"), mobile: g("dqMob"), city: g("dqCity"), from: $("dqFrom").value, status: "New" });
    if (!data.shape.length) return say("Choose at least one shape.", true);
    if (!data.ctMin && !data.ctMax) return say("Give the carat (min and/or max).", true);
    if (!data.name) return say("Who is asking? Write the name.", true);
    const n = reqs.reduce((m, r) => Math.max(m, Number(String(r.no || "").replace(/\D/g, "")) || 0), 0) + 1;
    data.no = "REQ-" + String(n).padStart(4, "0");
    const id = "r" + Date.now();
    $("dqSave").disabled = true;
    try { await db.doc("dreq/" + id).set(data); say(data.no + " saved. It goes to suppliers in the daytime (night requirements next morning)."); clearForm(); }
    catch (e) { say("Not saved: " + (e && e.message || e), true); }
    finally { $("dqSave").disabled = false; }
  }
  function clearForm() { reset(); ["dqMin", "dqMax", "dqQty", "dqFancy", "dqRem", "dqName", "dqMob", "dqCity"].forEach(i => { $(i).value = ""; }); $("dqPair").checked = false; paint(); }
  async function setStatus(r, status) { try { await db.doc("dreq/" + r.id).update({ status }); } catch (e) { say("Not changed: " + (e && e.message || e), true); } }

  function render() {
    if (!sec || sec.hidden) return;
    const box = $("dqList"), showClosed = $("dqClosed").checked; box.textContent = "";
    const list = reqs.filter(r => showClosed ? r.status === "Closed" : r.status !== "Closed").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!list.length) { box.appendChild(el("p", { className: "hint", textContent: showClosed ? "No closed requirements." : "No open requirements yet." })); return; }
    list.forEach(r => {
      const who = [r.name, r.mobile ? "+91 " + r.mobile : "", r.city, r.from ? "(" + r.from + ")" : ""].filter(Boolean).join(" · ");
      const prog = r.status === "New" ? "Waiting to send (daytime)" : "Sent to " + (r.sent || 0) + " suppliers · " + (r.replies || 0) + " replied · " + (r.matches || 0) + " matching pieces";
      const card = el("div", { className: "dqcard" }, [
        el("div", { className: "dqtop" }, [el("strong", { textContent: (r.no || "REQ") + "  " }), el("span", { className: "dqst", textContent: r.status }), el("span", { className: "hint", textContent: "  " + dmy(r.createdAt) })]),
        el("div", { textContent: summary(r) }),
        r.remarks ? el("div", { className: "hint", textContent: "Note: " + r.remarks }) : "",
        el("div", { className: "hint", textContent: "Asked by: " + who }),
        el("div", { className: "hint", textContent: prog }),
        r.result ? el("div", { className: "dqres", textContent: r.result }) : ""
      ]);
      if (r.status !== "Closed") { const c = el("button", { type: "button", className: "btn ghost", textContent: "Close" }); c.addEventListener("click", () => setStatus(r, "Closed")); card.appendChild(c); }
      else { const o = el("button", { type: "button", className: "btn ghost", textContent: "Reopen" }); o.addEventListener("click", () => setStatus(r, r.sent ? "Sent" : "New")); card.appendChild(o); }
      box.appendChild(card);
    });
  }
  function subscribe() {
    if (subs || !db) return; subs = true;
    db.collection("dreq").limit(100000).onSnapshot(s => { reqs = s.docs.map(d => Object.assign({ id: d.id }, d.data())); render(); });
  }
  function show(on) {
    sec.hidden = !on; if (!on) return;
    document.querySelectorAll("section.card").forEach(x => { if (x !== sec && x.parentNode === sec.parentNode) x.hidden = true; });
    document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "dreq" ? "true" : "false"));
    (async () => { try { db = db || await window.claude.use("db"); if (!db) return say("Not signed in.", true); subscribe(); render(); } catch (e) { say("Could not load: " + (e && e.message || e), true); } })();
  }
  function build() {
    const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-dreq")) return;
    const b = el("button", { id: "t-dreq", textContent: "Diamond requirement" }); b.setAttribute("role", "tab"); b.dataset.tab = "dreq"; b.setAttribute("aria-selected", "false");
    nav.appendChild(b);
    const st = el("style"); st.textContent = ".dqchips{display:flex;flex-wrap:wrap;gap:6px}.dqchip{font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;border:1px solid var(--line,#ccc);background:var(--surface,#fff);color:var(--fg);cursor:pointer;min-width:44px}" +
      ".dqchip[aria-pressed=true]{background:var(--fg);color:var(--bg);border-color:var(--fg)}.dqgrp{display:flex;flex-direction:column;gap:6px;min-width:0}.dqh{font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}" +
      ".dqgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.dqcard{border:1px solid var(--line,#ddd);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;margin-bottom:8px}" +
      ".dqst{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--fg);color:var(--bg)}.dqres{white-space:pre-wrap;font-size:13px;background:var(--surface,#f6f6f6);padding:6px 8px;border-radius:6px}";
    document.head.appendChild(st);
    sec = el("section", { className: "card", id: "p-dreq", hidden: true });
    const inp = (id, ph, max, type) => el("input", { id, placeholder: ph, autocomplete: "off", maxLength: max || 60, type: type || "text", inputMode: type === "tel" ? "tel" : (/dqMin|dqMax|dqQty/.test(id) ? "decimal" : "text") });
    const rng = el("div", { className: "dqchips" });
    RANGES.forEach(([a, z]) => { const x = el("button", { type: "button", className: "dqchip", textContent: a + "-" + z }); x.addEventListener("click", () => { $("dqMin").value = a; $("dqMax").value = z; }); rng.appendChild(x); });
    const from = el("select", { id: "dqFrom" }); L.from.forEach(v => from.appendChild(new Option(v, v))); from.value = "Customer";
    const pair = el("input", { type: "checkbox", id: "dqPair" }); pair.style.width = "auto";
    const pl = el("label", {}, [pair, " Pair"]); pl.style.cssText = "flex-direction:row;align-items:center;gap:6px";
    const go = el("button", { type: "button", className: "btn", id: "dqSave", textContent: "Save requirement" });
    const cl = el("input", { type: "checkbox", id: "dqClosed" }); cl.style.width = "auto"; const cll = el("label", {}, [cl, " Show closed"]); cll.style.cssText = "flex-direction:row;align-items:center;gap:6px";
    sec.append(
      el("h2", { textContent: "Diamond requirement" }),
      el("p", { className: "hint", textContent: "Goes to all VDB lab-grown suppliers from our WhatsApp in the daytime (night ones next morning) with only our number - never the buyer's. The person asking gets: \"Your requirement has been noted. Our representative will contact you with the best pricing.\"" }),
      el("div", { className: "dqgrid" }, [
        grp("Type", chips("type", L.type, true)), grp("Shape", chips("shape", L.shape)),
        grp("Carat", el("div", { className: "dqgrp" }, [el("div", { className: "row" }, [lab("Min ct", inp("dqMin", "e.g. 0.90", 8)), lab("Max ct", inp("dqMax", "e.g. 1.20", 8)), lab("Pieces", inp("dqQty", "e.g. 2", 6)), pl]), rng])),
        grp("Colour", el("div", { className: "dqgrp" }, [chips("color", L.color), inp("dqFancy", "Fancy colour (e.g. Pink, Yellow)", 40)])),
        grp("Clarity", chips("clarity", L.clarity)), grp("Cut", chips("cut", L.cut)), grp("Polish", chips("polish", L.cut)), grp("Symmetry", chips("sym", L.cut)),
        grp("Lab", chips("lab", L.lab)), grp("Fluorescence", chips("fluor", L.fluor))
      ]),
      lab("Remarks (only stone details - it goes to suppliers)", inp("dqRem", "e.g. eye clean, no BGM, ratio 1.9-2.1", 300)),
      el("div", { className: "row" }, [lab("Asked by (name)", inp("dqName", "Customer / party name", 60)), lab("Mobile", inp("dqMob", "10-digit mobile", 15, "tel")), lab("City", inp("dqCity", "City", 40)), lab("From", from)]),
      el("div", { className: "row" }, [go, el("button", { type: "button", className: "btn ghost", textContent: "Clear", onclick: clearForm })]),
      el("p", { className: "hint", id: "dqMsg", role: "status" }),
      el("div", { className: "row" }, [el("h2", { textContent: "Requirements" }), cll]),
      el("div", { id: "dqList" })
    );
    rates.parentNode.insertBefore(sec, rates);
    paint();
    go.addEventListener("click", save); cl.addEventListener("change", render);
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "dreq"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 800); setTimeout(build, 2500);
})();
