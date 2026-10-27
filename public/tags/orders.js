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
      tb.appendChild(el("thead", {}, [el("tr", {}, ["Piece", "Gold", "Gold rate", "Delivery", "Tagged", ""].map(h => el("th", { textContent: h })))]));
      const body = el("tbody");
      ts.forEach(t => {
        const g = (t.gold || []).reduce((a, x) => a + (Number(x && x.net) || 0), 0), late = t.order.due && t.order.due < new Date().toISOString().slice(0, 10);
        const bn = el("button", { type: "button", className: "btn ghost", textContent: "Bill now" }); bn.addEventListener("click", () => window.VJ_BILL_NOW && window.VJ_BILL_NOW(t.id));
        const ed = el("button", { type: "button", className: "btn ghost", textContent: "Edit" }); ed.style.marginLeft = "6px"; ed.addEventListener("click", () => editTag(t)); // owner 27/10/2026 15:28 (C-20261027-ORDEREDIT): Edit for every login
        const due = el("td", { textContent: t.order.due ? dmy(t.order.due) + (late ? " (late)" : "") : "-" }); if (late) due.style.color = "#b3261e";
        body.appendChild(el("tr", {}, [el("td", { textContent: (t.designNo ? t.designNo + " · " : "") + (t.pcode || t.label || "") + (t.catName ? " · " + t.catName : "") }),
          el("td", { className: "num", textContent: g ? g.toFixed(3) + " g" : "-" }), el("td", { className: "num", textContent: t.order.rate ? fmt(t.order.rate) : "-" }), due,
          el("td", { textContent: dmy(t.createdAt) }), el("td", {}, [bn, ed])]));
      });
      tb.appendChild(body); card.appendChild(el("div", { className: "list" }, [tb])); box.appendChild(card);
    });
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
      render(); timer = setInterval(render, 20000); window.scrollTo({ top: 0 }); }
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
