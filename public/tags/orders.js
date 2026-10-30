/* VJ Tags - Orders pending (owner Abhinav 26/10/2026 18:33, C-20261026-ORDERSDUE).
   A tab after "Tag": every order tag not yet billed, party-wise - e.g. all of Prachi's pending pieces, how many, delivery still due.
   Tagged pieces keeps the whole inventory. Read-only view of the page's own copy (window.VJ_TAGS); Bill now / Bill all open the
   bill with the party filled from the order. Built with DOM nodes only (no HTML from data). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; };
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const fmt = n => "Rs " + Math.round(n).toLocaleString("en-IN");
  let sec = null, timer = 0;
  /* C-20261030-TAGSDROPDOWN (owner 30/10/2026 15:17): saved estimates (Saved bills > Estimates sent) give an Estimate per pending
     piece and a total "itne ke orders, itni billing baaki". An estimate matches a piece when the customer (name without 'ji', or
     mobile) is the same and the estimate lists that design no. / tag code. Only the estimate total is kept on the server (no per-piece
     prices), so an estimate with several pieces is counted ONCE, on the first matching piece; the others show "in E-...".
     Shared with Karigar dues (window.VJ_EST). */
  const EST = { list: null, at: 0, busy: null };
  const normName = s => String(s || "").toLowerCase().replace(/[^a-z]/g, "").replace(/ji$/, "");
  const normCode = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const mob10 = s => String(s || "").replace(/\D/g, "").slice(-10);
  function loadEst(force) {
    if (EST.busy) return EST.busy;
    if (!force && EST.list && Date.now() - EST.at < 60000) return Promise.resolve(EST.list);
    EST.busy = fetch("/api/vj/estimates?status=all", { credentials: "same-origin", cache: "no-store" }).then(r => r.ok ? r.json() : { estimates: [] }).then(j => {
      EST.list = (j.estimates || []).map(e => { const its = String(e.items || "").split(/,\s*/).filter(Boolean);
        return { no: e.no, date: e.date, total: Number(e.total) || 0, status: e.status, n: normName(e.name), m: mob10(e.mobile), cnt: its.length, codes: its.map(x => normCode(x.split(" ")[0])).filter(Boolean) }; });
      EST.at = Date.now(); return EST.list;
    }).catch(() => EST.list || []).finally(() => { EST.busy = null; });
    return EST.busy;
  }
  /* newest estimate for this customer that lists one of these codes (null if none / not loaded yet) */
  function estFor(name, mobile, codes) {
    if (!EST.list) return null; const n = normName(name), m = mob10(mobile), cs = (codes || []).map(normCode).filter(Boolean);
    if (!cs.length || !n && m.length !== 10) return null;
    return EST.list.find(e => (n && e.n === n || m.length === 10 && e.m === m) && e.codes.some(c => cs.includes(c))) || null;
  }
  /* used = Set of estimate numbers already counted in this list; returns {amt (counted value), text, title} */
  function estCell(e, used) {
    if (!e) return { amt: 0, text: EST.list ? "-" : "…", title: EST.list ? "No saved estimate for this customer + design no." : "loading estimates" };
    if (used.has(e.no)) return { amt: 0, text: "in " + e.no, title: "Counted once with the other piece(s) of estimate " + e.no };
    used.add(e.no);
    return { amt: e.total, text: fmt(e.total) + (e.cnt > 1 ? " *" : ""), title: e.no + " dated " + dmy(e.date) + (e.cnt > 1 ? " - " + e.cnt + " pieces on this estimate (whole estimate amount)" : "") };
  }
  window.VJ_EST = { load: loadEst, find: estFor, cell: estCell, normName, normCode, fmt };

  function orders() {
    const all = window.VJ_TAGS ? window.VJ_TAGS() : [];
    return all.filter(t => t.kind === "order" && t.status !== "sold" && t.order && t.order.name);
  }
  function render() {
    if (!sec || sec.hidden) return;
    const box = $("ordList"), sum = $("ordSum"), q = String($("ordQ").value || "").trim().toLowerCase(); box.textContent = "";
    const list = orders(), groups = new Map();
    list.forEach(t => { const k = String(t.order.name).trim().toLowerCase(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
    const keys = [...groups.keys()].filter(k => !q || k.includes(q) || groups.get(k).some(t => String(t.order.mobile || "").includes(q) || String(t.designNo || "").toLowerCase().includes(q))).sort();
    const used = new Set(); let tP = 0, tG = 0, tE = 0, tNo = 0, multi = false;
    sum.textContent = list.length ? `${list.length} piece${list.length === 1 ? "" : "s"} pending for ${groups.size} part${groups.size === 1 ? "y" : "ies"}.` : "No orders pending. Order tags are made in New tag > Order.";
    keys.forEach(k => {
      const ts = groups.get(k).sort((a, b) => String(a.order.due || "9999").localeCompare(String(b.order.due || "9999")) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
      const o = ts[0].order, card = el("div", { className: "card" }); card.style.cssText = "margin:10px 0;padding:12px 14px";
      const head = el("div"); head.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap";
      const who = el("div", {}, [el("strong", { textContent: o.name }), el("span", { className: "hint", textContent: [o.city, o.mobile].filter(Boolean).map(x => " · " + x).join("") })]);
      const cnt = el("span", { className: "pill", textContent: ts.length + " pending" });
      const all = el("button", { type: "button", className: "btn ghost", textContent: "Bill all " + ts.length });
      all.addEventListener("click", () => { if (!window.VJ_BILL_NOW) return; window.VJ_BILL_NOW(ts[0].id); ts.slice(1).forEach(t => window.VJ_BILL_ADD && window.VJ_BILL_ADD(t.id)); });
      head.append(who, el("div", {}, [cnt, " ", all])); card.appendChild(head);
      const tb = el("table", { className: "items" }); tb.style.cssText = "min-width:560px;margin-top:8px";
      tb.appendChild(el("thead", {}, [el("tr", {}, ["Piece", "Gold", "Gold rate", "Estimate", "Delivery", "Tagged", ""].map(h => el("th", { textContent: h })))]));
      let pG = 0, pE = 0;
      const body = el("tbody");
      ts.forEach(t => {
        const g = (t.gold || []).reduce((a, x) => a + (Number(x && x.net) || 0), 0), late = t.order.due && t.order.due < new Date().toISOString().slice(0, 10);
        const bn = el("button", { type: "button", className: "btn ghost", textContent: "Bill now" }); bn.addEventListener("click", () => window.VJ_BILL_NOW && window.VJ_BILL_NOW(t.id));
        const ed = el("button", { type: "button", className: "btn ghost", textContent: "Edit" }); ed.style.marginLeft = "6px"; ed.addEventListener("click", () => editTag(t)); // owner 27/10/2026 15:28 (C-20261027-ORDEREDIT): Edit for every login
        const due = el("td", { textContent: t.order.due ? dmy(t.order.due) + (late ? " (late)" : "") : "-" }); if (late) due.style.color = "#b3261e";
        const ec = estCell(estFor(t.order.name, t.order.mobile, [t.designNo, t.label]), used); if (ec.text === "-") tNo++; if (/\*$/.test(ec.text)) multi = true;
        pG += g; pE += ec.amt; const kd = window.VJ_KDUES_FOR ? window.VJ_KDUES_FOR(t) : null;
        const pc = el("td", { textContent: (t.designNo ? t.designNo + " · " : "") + (t.pcode || t.label || "") + (t.catName ? " · " + t.catName : "") });
        if (kd) pc.append(el("div", { className: "hint", textContent: "with " + kd.kname + " · " + kd.stage }));
        body.appendChild(el("tr", {}, [pc,
          el("td", { className: "num", textContent: g ? g.toFixed(3) + " g" : "-" }), el("td", { className: "num", textContent: t.order.rate ? fmt(t.order.rate) : "-" }), el("td", { className: "num", textContent: ec.text, title: ec.title }), due,
          el("td", { textContent: dmy(t.createdAt) }), el("td", {}, [bn, ed])]));
      });
      tb.appendChild(body);
      const ft = el("tr", {}, [el("td", { textContent: "Total " + ts.length + " pc" }), el("td", { className: "num", textContent: pG.toFixed(3) + " g" }), el("td"), el("td", { className: "num", textContent: pE ? fmt(pE) : "-" }), el("td"), el("td"), el("td")]);
      ft.style.fontWeight = "600"; tb.appendChild(el("tfoot", {}, [ft]));
      tP += ts.length; tG += pG; tE += pE;
      card.appendChild(el("div", { className: "list" }, [tb])); box.appendChild(card);
    });
    if (keys.length) { // owner 30/10: TOTAL at the bottom - pieces, gold, estimated value still to be billed
      const tot = el("div", { className: "card" }); tot.style.cssText = "margin:12px 0;padding:12px 14px;border:2px solid var(--fg)";
      const t2 = el("table", { className: "sum" }); const row = (a, b, c) => { const r = el("tr", {}, [el("td", { textContent: a }), el("td", { textContent: b })]); if (c) r.className = c; return r; };
      t2.append(row("Pending pieces" + (q ? " (search)" : ""), String(tP)), row("Gold", tG.toFixed(3) + " g"), row("Estimated value still to bill", tE ? fmt(tE) : "-", "total"));
      tot.append(el("h2", { textContent: "TOTAL - all pending orders" + (q ? " shown" : "") }), t2);
      const notes = [tNo ? tNo + " piece" + (tNo === 1 ? " has" : "s have") + " no saved estimate (not in the value)." : "", multi ? "* = estimate with several pieces, counted once (whole estimate amount)." : "", EST.list ? "" : "Loading estimates…"].filter(Boolean).join(" ");
      if (notes) tot.append(el("p", { className: "hint", textContent: notes }));
      box.appendChild(tot);
    }
  }
  /* C-20261027-ORDEREDIT: opens the piece on the Bill tab and its Edit tag form (the server still checks who may change what) */
  function editTag(t) {
    const tab = $("t-check"); if (tab) tab.click(); const q = $("cq"), go = $("cgo"); if (!q || !go) return;
    q.value = t.label; go.click(); let n = 0;
    const tryOpen = () => { const b = document.querySelector("#cres .vjEditBtn"); if (b) { b.click(); return; } if (++n < 20) setTimeout(tryOpen, 250); };
    setTimeout(tryOpen, 300);
  }
  function show(on) {
    if (!sec) return; sec.hidden = !on; clearInterval(timer);
    if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; });
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "orders" ? "true" : "false"));
      render(); loadEst().then(render); timer = setInterval(() => { loadEst().then(render); }, 20000); window.scrollTo({ top: 0 }); }
  }
  function build() {
    const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-orders")) return;
    const b = el("button", { id: "t-orders", textContent: "Orders pending" }); b.setAttribute("role", "tab"); b.dataset.tab = "orders"; b.setAttribute("aria-selected", "false");
    const ck = nav.querySelector('[data-tab="check"]'); nav.insertBefore(b, ck ? ck.nextSibling : null);
    sec = el("section", { className: "card", id: "p-orders", hidden: true });
    const q = el("input", { id: "ordQ", placeholder: "Party name, mobile or design no.", autocomplete: "off", maxLength: 40 });
    sec.append(el("h2", { textContent: "Orders pending (party-wise)" }), el("p", { className: "hint", id: "ordSum" }),
      el("div", { className: "row" }, [el("label", {}, ["Search ", q])]), el("div", { id: "ordList" }));
    rates.parentNode.insertBefore(sec, rates);
    q.addEventListener("input", render);
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "orders"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 800);
})();
