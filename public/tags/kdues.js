/* VJ Tags - Karigar dues (owner Abhinav 30/10/2026 15:17, C-20261030-TAGSDROPDOWN).
   Replaces his Excel "Pending Deliveries": one block per karigar ("<Karigar>  Total <g>  Due <g>") with Code | Customer | Item |
   Stage, plus an Estimate column (saved estimates, see orders.js window.VJ_EST), a TOTAL under each karigar and a grand total.
   Data: same server store as tags (docs kdues/<id> = one job, karigars/<id> = name + Total / Due grams), same login; the server
   cleans every field, keeps a change history on each job and refuses deletes - "Delivered" only moves a job to history.
   Not loaded for the sales login (and the server does not send it to sales). Built with DOM nodes only (no HTML from data). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const STAGES = ["Design", "CAD", "Ghaat", "Setting", "Polish", "Ready", "Hold"];
  const ITEMS = ["VP", "NS", "PS", "Br", "BR", "Ban", "LR", "ER", "Man"];
  const CAT_ITEM = { VLR: "LR", VER: "ER", VBR: "Br", VBN: "Ban", VP: "VP", VPS: "PS", VNS: "NS", VMN: "Man", CH: "Ch", VNP: "NP" };
  const fmt = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  const gr = n => { const t = (Math.round((Number(n) || 0) * 1000) / 1000).toFixed(3); return /0$/.test(t) ? t.slice(0, -1) : t; };
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const nN = s => window.VJ_EST ? window.VJ_EST.normName(s) : String(s || "").toLowerCase().replace(/[^a-z]/g, "").replace(/ji$/, "");
  const nC = s => window.VJ_EST ? window.VJ_EST.normCode(s) : String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let sec = null, db = null, jobs = [], kars = [], subs = false, seeded = false, timer = 0;

  /* Owner's sheet 30-10-2026 (his Montu list continues below row 19 - staff add the rest) */
  const SEED = [
    ["montu", "Montu", 19.22, -1.83, 1, "4850 Prachi VP Polish;4854 Prachi VP Setting;4855 Tini NS Setting;4856 Stock PS Ghaat;4877 Mehak Ban Setting;4880 Vandana NS Ghaat;4881 Vandana LR Setting;4882 Saroj NS Setting;4884 Stock VP Hold;4885 Stock VP Hold;4886 Stock VP Hold;4887 Kalpna Br Hold;4888 Kalpna Br Hold;4889 Kalpna BR Hold;4890 Neha Er Ready;4891 Amita Ban Hold"],
    ["hiru", "Hiru", 86.39, 7.52, 2, "61270 Ujwala nS Ghaat;61296 Sapna NS Ghaat;61312 Saroj nS Ghaat;61313 Shelly PS Ghaat;61317 niti Br CAD;61318 neha ER Setting;61319 geeta nS CAD;61320 anjali LR Setting;61321 Dabbu VP CAD;61322 Dabbu ER CAD;61323 Kalpna nS Hold"],
    ["badshah-2", "Badshah 2", 22.40, 4.98, 3, "40489 Kalpna VP Setting;40490 Kalpna VP Setting;40492 Vandana Man Ghaat;40493 Stock LR Setting;40496 Neeraj LR CAD;40497 Heena LR CAD;40498 Lata VP Design"]
  ];
  async function seed() { // once, only into an empty store; fixed ids so two people opening at once cannot make doubles
    if (seeded) return; seeded = true;
    const have = await db.collection("karigars").limit(100000).get(), hj = await db.collection("kdues").limit(100000).get();
    if (!have.empty || !hj.empty) return;
    for (const [id, name, total, due, sort, list] of SEED) {
      try { await db.doc("karigars/" + id).set({ name, total, due, sort }); } catch (e) {}
      for (const r of list.split(";")) { const [code, customer, item, stage] = r.split(" ");
        try { await db.doc("kdues/s1030-" + id + "-" + code).set({ karigar: id, kname: name, code, customer, item, stage, status: "open", seed: true }); } catch (e) {} }
    }
  }
  function orders() { return (window.VJ_TAGS ? window.VJ_TAGS() : []).filter(t => t.kind === "order" && t.status !== "sold" && t.order && t.order.name); }
  const linked = (j, t) => j.tagId ? j.tagId === t.id : !!j.code && (nC(j.code) === nC(t.designNo) || nC(j.code) === nC(t.label)) && nN(j.customer) === nN(t.order.name);
  window.VJ_KDUES_FOR = t => { const j = jobs.find(x => x.status !== "delivered" && linked(x, t)); return j ? { kname: j.kname, stage: j.stage } : null; };
  const kName = id => { const k = kars.find(x => x.id === id); return k ? k.name : id; };
  function say(t, bad) { const m = $("kdMsg"); if (!m) return; m.textContent = t || ""; m.style.color = bad ? "var(--bad)" : "var(--ok)"; }
  async function save(path, op, data) {
    try { if (op === "set") await db.doc(path).set(data); else await db.doc(path).update(data); return true; }
    catch (e) { say("Not saved: " + (e && e.message || e), true); render(); return false; }
  }

  function karOptions(selEl, cur) {
    selEl.textContent = ""; kars.forEach(k => selEl.appendChild(new Option(k.name, k.id)));
    selEl.appendChild(new Option("+ New karigar…", "__new")); if (cur) selEl.value = cur;
  }
  function render() {
    if (!sec || sec.hidden) return;
    const box = $("kdList"), q = String($("kdQ").value || "").trim().toLowerCase(), hist = $("kdHist").checked; box.textContent = "";
    const EST = window.VJ_EST, used = new Set(), pend = orders();
    karOptions($("kdK"), $("kdK").value || (kars[0] && kars[0].id));
    // pending orders not yet with any karigar -> quick fill of the add form
    const free = pend.filter(t => !jobs.some(j => j.status !== "delivered" && linked(j, t))), pk = $("kdFromOrd"), pv = pk.value;
    pk.textContent = ""; pk.appendChild(new Option(free.length ? "Pending order not with a karigar (" + free.length + ")…" : "No pending order without a karigar", ""));
    free.forEach(t => pk.appendChild(new Option([t.designNo || t.label, t.order.name, t.catName].filter(Boolean).join(" · "), t.id))); pk.value = pv;
    let gP = 0, gT = 0, gD = 0, gE = 0, noEst = 0;
    const ids = [...new Set(kars.map(k => k.id).concat(jobs.map(j => j.karigar)))];
    ids.forEach(kid => {
      const k = kars.find(x => x.id === kid) || { id: kid, name: kName(kid), total: 0, due: 0 };
      const all = jobs.filter(j => j.karigar === kid && (hist ? j.status === "delivered" : j.status !== "delivered"))
        .filter(j => !q || [k.name, j.code, j.customer, j.item, j.stage].some(x => String(x || "").toLowerCase().includes(q)))
        .sort((a, b) => (parseFloat(a.code) || 0) - (parseFloat(b.code) || 0) || String(a.code).localeCompare(String(b.code)));
      if (q && !all.length && !k.name.toLowerCase().includes(q)) return;
      if (hist && !all.length) return;
      const card = el("div", { className: "card" }); card.style.cssText = "margin:10px 0;padding:12px 14px";
      const head = el("div"); head.style.cssText = "display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap";
      const num = (field, val) => { const i = el("input", { type: "number", step: "0.01", inputMode: "decimal", value: gr(val) }); i.style.cssText = "width:110px"; i.setAttribute("aria-label", k.name + " " + field);
        i.addEventListener("change", async () => { const v = i.value.trim() === "" ? 0 : Number(i.value); if (!isFinite(v)) { i.value = gr(val); return; }
          if (!kars.some(x => x.id === kid)) await save("karigars/" + kid, "set", { name: k.name, total: field === "total" ? v : 0, due: field === "due" ? v : 0, sort: kars.length + 1 });
          else if (await save("karigars/" + kid, "update", { [field]: v })) say(k.name + " " + (field === "total" ? "Total" : "Due") + " saved: " + gr(v) + " g"); });
        return el("label", { textContent: field === "total" ? "Total g" : "Due g" }, [i]); };
      const lt = num("total", k.total), ld = num("due", k.due); [lt, ld].forEach(l => { l.style.cssText = "flex-direction:row;align-items:center;gap:6px;flex:0 0 auto"; });
      const nm = el("strong", { textContent: k.name }); nm.style.cssText = "font-family:var(--f-display);font-size:22px;color:var(--gold);margin-right:6px";
      head.append(nm, lt, ld, el("span", { className: "pill", textContent: all.length + (hist ? " delivered" : " pending") }));
      card.appendChild(head);
      const tb = el("table", { className: "items" }); tb.style.cssText = "min-width:640px;margin-top:8px";
      tb.appendChild(el("thead", {}, [el("tr", {}, ["Code", "Customer", "Item", "Stage", "Estimate", ""].map(h => el("th", { textContent: h })))]));
      const body = el("tbody"); let kE = 0;
      all.forEach(j => {
        const e = EST ? EST.find(j.customer, "", [j.code]) : null, ec = EST ? EST.cell(e, used) : { amt: 0, text: "…", title: "" };
        if (ec.text === "-") noEst++; kE += ec.amt;
        const isOrd = pend.find(t => linked(j, t));
        const code = el("td", { textContent: j.code || "-" }); if (isOrd) code.append(" ", el("span", { className: "pill s", textContent: "order", title: "Pending order tag " + (isOrd.label || "") }));
        let stc;
        if (hist) stc = el("td", { textContent: j.stage + " · delivered " + dmy(j.deliveredAt) });
        else { const s = el("select"); STAGES.forEach(x => s.appendChild(new Option(x, x))); s.value = j.stage; s.style.cssText = "width:auto;padding:6px 8px";
          s.setAttribute("aria-label", "Stage " + (j.code || ""));
          s.addEventListener("change", async () => { if (await save("kdues/" + j.id, "update", { stage: s.value })) say((j.code || j.customer) + " -> " + s.value); });
          stc = el("td", {}, [s]); }
        const act = el("button", { type: "button", className: "btn ghost", textContent: hist ? "Back to pending" : "Delivered" });
        act.addEventListener("click", async () => {
          const what = [j.code, j.customer, j.item].filter(Boolean).join(" ");
          if (!hist && !confirm("Mark " + what + " (" + k.name + ") as delivered? It moves to history (not deleted).")) return;
          if (await save("kdues/" + j.id, "update", { status: hist ? "open" : "delivered" })) say(what + (hist ? " back to pending" : " delivered - moved to history"));
        });
        const h = (j.hist || []).slice(-6).map(x => dmy(x.at) + " " + x.what + " (" + String(x.by || "").split("@")[0] + ")").join("\n");
        const tr = el("tr", { title: h }, [code, el("td", { textContent: j.customer || "-" }), el("td", { textContent: j.item || "-" }), stc, el("td", { className: "num", textContent: ec.text, title: ec.title }), el("td", {}, [act])]);
        body.appendChild(tr);
      });
      if (!all.length) body.appendChild(el("tr", {}, [el("td", { colSpan: 6, className: "hint", textContent: "Nothing pending with " + k.name + "." })]));
      tb.appendChild(body);
      const ft = el("tr", {}, [el("td", { textContent: "TOTAL" }), el("td", { textContent: all.length + " pc" }), el("td"), el("td", { textContent: "Total " + gr(k.total) + " g · Due " + gr(k.due) + " g" }), el("td", { className: "num", textContent: kE ? fmt(kE) : "-" }), el("td")]);
      ft.style.fontWeight = "600"; tb.appendChild(el("tfoot", {}, [ft]));
      card.appendChild(el("div", { className: "list" }, [tb])); box.appendChild(card);
      gP += all.length; gT += Number(k.total) || 0; gD += Number(k.due) || 0; gE += kE;
    });
    if (!ids.length) box.appendChild(el("p", { className: "empty", textContent: "No karigar jobs yet - add one above." }));
    const tot = el("div", { className: "card" }); tot.style.cssText = "margin:12px 0;padding:12px 14px;border:2px solid var(--fg)";
    const t2 = el("table", { className: "sum" }); const row = (a, b, c) => { const r = el("tr", {}, [el("td", { textContent: a }), el("td", { textContent: b })]); if (c) r.className = c; return r; };
    t2.append(row(hist ? "Delivered jobs" : "Pending jobs", String(gP)), row("Total (all karigars)", gr(gT) + " g"), row("Due (all karigars)", gr(gD) + " g"), row("Estimate value", gE ? fmt(gE) : "-", "total"));
    tot.append(el("h2", { textContent: "GRAND TOTAL - all karigars" + (q ? " (search)" : "") }), t2);
    if (noEst || !EST) tot.append(el("p", { className: "hint", textContent: (noEst ? noEst + " job" + (noEst === 1 ? " has" : "s have") + " no saved estimate (not in the value). " : "") + (EST ? "" : "Loading estimates…") }));
    box.appendChild(tot);
  }
  async function add() {
    let kid = $("kdK").value; const code = $("kdCode").value.trim(), customer = $("kdCust").value.trim(), item = $("kdItem").value.trim(), stage = $("kdStage").value, tagId = $("kdFromOrd").value;
    if (kid === "__new" || !kid) return say("Choose the karigar (or + New karigar).", true);
    if (!code && !customer) return say("Type the code or the customer.", true);
    const id = "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), d = { karigar: kid, kname: kName(kid), code, customer, item, stage, status: "open" };
    if (tagId) d.tagId = tagId;
    $("kdAdd").disabled = true;
    if (await save("kdues/" + id, "set", d)) { say("Added " + [code, customer, item].filter(Boolean).join(" ") + " to " + kName(kid) + " (" + stage + ")."); ["kdCode", "kdCust", "kdItem"].forEach(x => { $(x).value = ""; }); $("kdFromOrd").value = ""; $("kdCode").focus(); }
    $("kdAdd").disabled = false;
  }
  async function newKarigar() {
    const name = String(prompt("New karigar name (e.g. Montu, Hiru, Badshah 2):") || "").trim().slice(0, 40); if (!name) { render(); return; }
    let id = slug(name) || "k"; if (kars.some(k => k.id === id)) { if (kars.find(k => k.id === id).name.toLowerCase() === name.toLowerCase()) { $("kdK").value = id; return; } id += "-" + Date.now().toString(36); }
    if (await save("karigars/" + id, "set", { name, total: 0, due: 0, sort: kars.reduce((m, k) => Math.max(m, k.sort || 0), 0) + 1 })) { say("Karigar " + name + " added."); setTimeout(() => { $("kdK").value = id; }, 50); }
  }
  function subscribe() {
    if (subs || !db) return; subs = true;
    db.collection("karigars").limit(100000).onSnapshot(s => { kars = s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name))); render(); });
    db.collection("kdues").limit(100000).onSnapshot(s => { jobs = s.docs.map(d => Object.assign({ id: d.id }, d.data())); render(); });
  }
  function show(on) {
    if (!sec) return; sec.hidden = !on; clearInterval(timer);
    if (!on) return;
    document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; });
    document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "kdues" ? "true" : "false"));
    window.scrollTo({ top: 0 }); render();
    (async () => {
      try { db = db || await window.claude.use("db"); if (!db) return say("Not signed in.", true);
        subscribe();
        await seed();
      } catch (e) { say("Could not load: " + (e && e.message || e), true); }
      if (window.VJ_EST) window.VJ_EST.load().then(render);
    })();
    timer = setInterval(() => { if (window.VJ_EST) window.VJ_EST.load().then(render); else render(); }, 20000);
  }
  function build() {
    const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-kdues")) return;
    const b = el("button", { id: "t-kdues", textContent: "Karigar dues" }); b.setAttribute("role", "tab"); b.dataset.tab = "kdues"; b.setAttribute("aria-selected", "false");
    const ref = $("t-orders") || nav.querySelector('[data-tab="check"]'); if (ref && ref.parentNode) ref.after(b); else nav.appendChild(b);
    sec = el("section", { className: "card", id: "p-kdues", hidden: true });
    const inp = (id, ph, max, list) => { const i = el("input", { id, placeholder: ph, autocomplete: "off", maxLength: max }); if (list) i.setAttribute("list", list); return i; };
    const lab = (t, c) => el("label", { textContent: t }, [c]);
    const ks = el("select", { id: "kdK" }), st = el("select", { id: "kdStage" }); STAGES.forEach(x => st.appendChild(new Option(x, x))); st.value = "Design";
    const dl = el("datalist", { id: "kdItems" }); ITEMS.forEach(x => dl.appendChild(new Option(x, x)));
    const fo = el("select", { id: "kdFromOrd" }), go = el("button", { type: "button", className: "btn", id: "kdAdd", textContent: "Add job" });
    const q = el("input", { id: "kdQ", placeholder: "Karigar, code, customer, item or stage", autocomplete: "off", maxLength: 40 });
    const hs = el("input", { type: "checkbox", id: "kdHist" }); hs.style.width = "auto"; const hl = el("label", {}, [hs, " Show delivered (history)"]); hl.style.cssText = "flex-direction:row;align-items:center;gap:6px;flex:0 0 auto";
    const addRow = el("div", { className: "row" }, [lab("Karigar", ks), lab("Code", inp("kdCode", "e.g. 4850", 20)), lab("Customer", inp("kdCust", "e.g. Prachi / Stock", 60)), lab("Item", inp("kdItem", "VP, NS, LR…", 12, "kdItems")), lab("Stage", st)]);
    const addRow2 = el("div", { className: "row" }, [lab("Or fill from a pending order", fo), el("div", {}, [go])]); addRow2.style.alignItems = "end";
    sec.append(el("h2", { textContent: "Karigar dues (pending deliveries)" }),
      el("p", { className: "hint", textContent: "One block per karigar. Change the stage from the list; Delivered moves a job to history (never deleted). Estimate = saved estimate for that code + customer." }),
      el("div", { className: "card" }, [el("h2", { textContent: "Add a job" }), addRow, addRow2, dl, el("p", { className: "hint", id: "kdMsg", role: "status" })]),
      el("div", { className: "row" }, [lab("Search", q), hl]), el("div", { id: "kdList" }));
    sec.querySelector(".card").style.cssText = "padding:12px 14px;gap:10px";
    rates.parentNode.insertBefore(sec, rates);
    ks.addEventListener("change", () => { if (ks.value === "__new") newKarigar(); });
    fo.addEventListener("change", () => { const t = orders().find(x => x.id === fo.value); if (!t) return;
      $("kdCode").value = t.designNo || t.label || ""; $("kdCust").value = t.order.name || ""; $("kdItem").value = CAT_ITEM[t.cat] || t.catName || ""; });
    go.addEventListener("click", add);
    [ "kdCode", "kdCust", "kdItem" ].forEach(x => $(x).addEventListener("keydown", e => { if (e.key === "Enter") add(); }));
    q.addEventListener("input", render); hs.addEventListener("change", render);
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "kdues"); });
    // the Orders pending list shows "with <karigar> · <stage>" - load the jobs quietly once so it can
    setTimeout(async () => { try { db = db || await window.claude.use("db"); subscribe(); } catch (e) {} }, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 800); setTimeout(build, 2500);
})();
