/* VJ Tags - Enquiries (owner Abhinav 02/11/2026 22:57 + 22:58 + 23:00 + 23:03, C-20261102-ENQTAB). Loaded by shim.js for admin, staff
   and sales (sales: read-only, no numbers - the server decides). Every WhatsApp enquiry Aashvi logs, one per customer: follow it up,
   note what was done, close it. Closed ones (Bought / Not interested / Not relevant / Closed) leave the list; "Closed / history" shows
   them (owners can reopen). The WhatsApp button opens WhatsApp on this phone with a ready message to edit - nothing is sent from here.
   Built with DOM nodes only (no HTML from data). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => k != null && e.append(k)); return e; };
  const dmy = d => String(d || "").slice(0, 10).split("-").reverse().join("-");
  const dt = s => { const d = String(s || ""); return dmy(d.slice(0, 10)) + (d.length > 10 ? " " + d.slice(11, 16) : ""); };
  const inr = n => "Rs " + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const plus = (ymd, n) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const CLOSED = ["Bought", "Not interested", "Not relevant", "Closed"];
  const CHANNELS = ["Meta ad", "Google ad", "Website", "Broadcast", "Direct"];
  let sec = null, data = null, busy = false, timer = 0, openComposer = "";

  async function api(path, body) {
    const r = await fetch(path, body ? { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { credentials: "same-origin", cache: "no-store" });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status)); return j;
  }
  async function load(fresh) {
    if (busy) return; busy = true; const m = $("enqMsg");
    try { data = await api("/api/vj/enquiries?" + ($("enqClosed").checked ? "closed=1&" : "") + (fresh ? "fresh=1" : "")); if (m) m.textContent = data.sheetOk ? "" : "Could not read the Enquiries sheet just now - showing the last copy."; }
    catch (e) { if (m) m.textContent = "Could not load: " + e.message; }
    busy = false; render();
  }
  function stats() {
    const box = $("enqStats"); box.textContent = ""; if (!data) return; const s = data.stats;
    const tile = (label, val, warn) => { const t = el("div", { className: "card" }, [el("div", { className: "hint", textContent: label }), el("strong", { textContent: String(val) })]);
      t.style.cssText = "padding:8px 12px;margin:0;flex:1 1 110px" + (warn ? ";border-color:var(--bad)" : ""); return t; };
    box.append(tile("New today", s.newToday), tile("Running", s.open), tile("Not contacted yet", s.notStarted), tile("Due today", s.dueToday, s.dueToday > 0), tile("Overdue", s.overdue, s.overdue > 0),
      tile("Bought this month", s.boughtMonth + (s.boughtMonthRs ? " · " + inr(s.boughtMonthRs) : "")));
    const ch = Object.entries(s.byChannel || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(" · ");
    $("enqCh").textContent = ch ? "Running by channel: " + ch : "";
  }
  function filtered() {
    if (!data) return [];
    const q = String($("enqQ").value || "").trim().toLowerCase(), qd = q.replace(/\D/g, ""), ch = $("enqChan").value, st = $("enqSt").value, rel = $("enqRel").checked, from = $("enqFrom").value, to = $("enqTo").value;
    const t = today();
    let L = data.enquiries.filter(e => (!ch || e.channel === ch) && (!st || e.status === st) && (!rel || /^yes/i.test(e.relevant)) && (!from || e.date.slice(0, 10) >= from) && (!to || e.date.slice(0, 10) <= to)
      && (!q || String(e.name).toLowerCase().includes(q) || (qd.length >= 3 && String(e.number || "").replace(/\D/g, "").includes(qd)) || String(e.what).toLowerCase().includes(q)));
    if (!$("enqClosed").checked) { const rank = e => e.next && e.next < t ? 0 : e.next === t ? 1 : 2; L = L.slice().sort((a, b) => rank(a) - rank(b) || (rank(a) < 2 ? a.next.localeCompare(b.next) : 0) || b.date.localeCompare(a.date)); }
    return L;
  }
  function render() {
    if (!sec || sec.hidden) return; stats();
    const box = $("enqList"); box.textContent = ""; if (!data) { box.append(el("p", { className: "hint", textContent: "Loading…" })); return; }
    const L = filtered(), closedView = $("enqClosed").checked;
    $("enqCount").textContent = L.length + " of " + data.enquiries.length + (closedView ? " closed" : " running") + " shown" + (data.sheetAt ? " · sheet read " + new Date(data.sheetAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "");
    if (!L.length) box.append(el("p", { className: "hint", textContent: closedView ? "No closed enquiries match." : "Nothing running matches. All followed up!" }));
    L.slice(0, 300).forEach(e => box.append(card(e)));
    if (L.length > 300) box.append(el("p", { className: "hint", textContent: "Showing the first 300 - narrow with the filters or search." }));
  }
  const add = (p, ...k) => k.forEach(x => x != null && p.append(x));
  function pill(text, style) { const p = el("span", { className: "pill", textContent: text }); if (style) p.style.cssText = style; return p; }
  function card(e) {
    const t = today(), c = el("div", { className: "card" }); c.style.cssText = "margin:10px 0;padding:12px 14px" + (e.due === "overdue" ? ";border-left:4px solid var(--bad)" : e.due === "today" ? ";border-left:4px solid var(--gold)" : "");
    const top = el("div"); top.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center";
    top.append(el("span", { className: "hint", textContent: dt(e.date) + (e.msgs > 1 ? " · " + e.msgs + " chats, last " + dt(e.last) : "") }), pill(e.channel), pill(e.status, e.open ? "" : "background:var(--sunk);color:var(--fg)"));
    if (/^yes/i.test(e.relevant)) top.append(pill("Real lead", "background:var(--gold-soft);color:var(--gold)")); else if (e.relevant) top.append(pill(e.relevant));
    if (e.urgent && /yes/i.test(e.urgent)) top.append(pill("Urgent", "background:var(--bad);color:#fff"));
    if (e.due) top.append(pill(e.due === "overdue" ? "Overdue since " + dmy(e.next) : "Due today", e.due === "overdue" ? "background:var(--bad);color:#fff" : "background:var(--gold-soft);color:var(--gold)"));
    else if (e.next && e.open) top.append(pill("Next " + dmy(e.next)));
    c.append(top);
    const who = el("div"); who.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px";
    who.append(el("strong", { textContent: e.name || "(no name)" }));
    if (e.number) who.append(e.tel ? el("a", { href: "tel:" + e.tel, textContent: e.number }) : el("span", { className: "hint", textContent: e.number }));
    if (e.tel && data.canEdit) {
      const call = el("a", { href: "tel:" + e.tel, className: "btn ghost", textContent: "Call" }); call.style.cssText = "text-decoration:none;padding:6px 12px;border:1px solid var(--line);border-radius:var(--r);color:var(--fg);font-weight:600";
      who.append(call);
    }
    if (e.wa && data.canEdit && e.open) { const w = el("button", { type: "button", className: "btn ghost", textContent: "WhatsApp" }); w.style.padding = "6px 12px"; w.addEventListener("click", () => { openComposer = openComposer === e.id ? "" : e.id; render(); }); who.append(w); }
    c.append(who);
    const line = (k, v) => v ? el("p", { style: "margin:4px 0" }, [el("span", { className: "hint", textContent: k + ": " }), document.createTextNode(v)]) : null;
    add(c, line("Wants", [e.cat && e.cat !== "Other" ? e.cat : "", e.what].filter(Boolean).join(" - ")), line("Aashvi's last reply", e.reply.length > 220 ? e.reply.slice(0, 220) + "…" : e.reply), line("Ad / source", e.src));
    if (!e.open) add(c, line("Result", e.status + (e.bought ? " " + inr(e.bought) : "") + (e.billNo ? " · bill " + e.billNo : "") + (e.lost && e.status !== "Bought" ? " · " + e.lost : "") + (e.closedAt ? " · " + dmy(e.closedAt) : "") + (e.closedBy ? " by " + e.closedBy : "")));
    if (e.quote && e.open) add(c, line("Quote", inr(e.quote)));
    if (e.earlier && e.earlier.length) add(c, line("Earlier", e.earlier.map(p => "from " + dmy(p.from) + ": " + p.status + (p.closedAt ? " (" + dmy(p.closedAt) + ")" : "")).join("; ")));
    if (e.notes.length) {
      const ul = el("ul"); ul.style.cssText = "margin:6px 0 0 18px;padding:0;font-size:14px";
      const N = e.notes.slice().reverse(), shown = N.slice(0, 3);
      shown.forEach(n => ul.append(el("li", { textContent: dt(n.at) + " " + n.by + ": " + [n.status, n.next ? "next " + dmy(n.next) : "", n.amount ? inr(n.amount) : "", n.bill ? "bill " + n.bill : "", n.note && n.note !== n.status ? n.note : ""].filter(Boolean).join(" · ") })));
      c.append(ul);
      if (N.length > 3) { const more = el("button", { type: "button", className: "btn ghost", textContent: "All " + N.length + " notes" }); more.style.cssText = "padding:4px 10px;font-size:13px;margin-top:4px";
        more.addEventListener("click", () => { ul.textContent = ""; N.forEach(n => ul.append(el("li", { textContent: dt(n.at) + " " + n.by + ": " + [n.status, n.next ? "next " + dmy(n.next) : "", n.amount ? inr(n.amount) : "", n.bill ? "bill " + n.bill : "", n.note && n.note !== n.status ? n.note : ""].filter(Boolean).join(" · ") }))); more.remove(); }); c.append(more); }
    }
    if (openComposer === e.id && e.wa) c.append(composer(e));
    if (data.canEdit && e.open) c.append(form(e));
    if (!e.open && data.canReopen) {
      const r = el("button", { type: "button", className: "btn ghost", textContent: "Reopen" }); r.style.marginTop = "8px";
      r.addEventListener("click", async () => { r.disabled = true; try { await api("/api/vj/enquiry", { id: e.id, op: "reopen", status: "Called", next: t }); await load(); } catch (x) { alert(x.message); r.disabled = false; } });
      c.append(r);
    }
    return c;
  }
  function composer(e) {
    const w = el("div"); w.style.cssText = "margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:var(--r);background:var(--sunk)";
    const ta = el("textarea", { value: e.msg || "", rows: 5, maxLength: 900 }); ta.style.cssText = "width:100%;font:inherit;font-size:15px;padding:8px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--fg);box-sizing:border-box";
    const cnt = el("span", { className: "hint" }), upd = () => { cnt.textContent = ta.value.length + " characters"; }; ta.addEventListener("input", upd); upd();
    const send = el("button", { type: "button", className: "btn", textContent: "Send on WhatsApp" });
    const done = el("button", { type: "button", className: "btn ghost", textContent: "Messaged ✓" });
    send.addEventListener("click", () => { const txt = ta.value.trim(); if (!txt) return; window.open("https://wa.me/" + e.wa + "?text=" + encodeURIComponent(txt), "_blank", "noopener"); done.focus(); });
    done.addEventListener("click", async () => { done.disabled = true; try { await api("/api/vj/enquiry", { id: e.id, op: "messaged" }); openComposer = ""; await load(); } catch (x) { alert(x.message); done.disabled = false; } });
    w.append(el("div", { className: "hint", textContent: "Message from your own WhatsApp - change it if you like, then tap Send on WhatsApp and press send there. After sending, tap Messaged ✓ (next follow-up in 2 days)." }), ta,
      el("div", { className: "actions", style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px" }, [send, done, cnt]));
    return w;
  }
  function form(e) {
    const t = today(), f = el("div"); f.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)";
    const st = el("select"); data.statuses.filter(s => s !== "New" || e.status === "New").forEach(s => st.append(el("option", { value: s, textContent: s === "New" ? "New (not contacted)" : s, selected: s === e.status })));
    const nx = el("input", { type: "date", value: e.next || "", min: "2026-01-01" });
    const amt = el("input", { type: "number", min: "0", step: "1", inputMode: "numeric", placeholder: "Rs" }), bill = el("input", { placeholder: "Bill no. (optional)", maxLength: 20 });
    const note = el("input", { placeholder: "What was done / said", maxLength: 300 });
    const lab = (txt, inp, flex) => { const l = el("label", {}, [txt, inp]); l.style.cssText = "display:flex;flex-direction:column;gap:2px;font-size:13px;flex:" + (flex || "1 1 130px"); return l; };
    const lAmt = lab("Amount", amt, "0 1 110px"), lBill = lab("Bill no.", bill, "0 1 120px"), lNx = lab("Next follow-up", nx, "0 1 150px");
    const sync = () => { const s = st.value; lAmt.hidden = !(s === "Bought" || s === "Quote"); lBill.hidden = s !== "Bought"; lNx.hidden = CLOSED.includes(s); lNx.firstChild.textContent = s === "Visit booked" ? "Visit date" : "Next follow-up";
      if (s !== e.status && !CLOSED.includes(s) && !nx.value) nx.value = s === "Visit booked" ? plus(t, 1) : plus(t, 2); };
    st.addEventListener("change", sync); sync();
    const save = el("button", { type: "button", className: "btn", textContent: "Save" }), msg = el("span", { className: "hint" });
    save.addEventListener("click", async () => {
      const s = st.value, body = { id: e.id };
      if (s !== e.status) { Object.assign(body, { op: "status", status: s, note: note.value.trim() }); if (!CLOSED.includes(s)) body.next = nx.value || ""; if (s === "Bought" || s === "Quote") body.amount = amt.value; if (s === "Bought") body.billNo = bill.value.trim();
        if (s === "Bought" && !(Number(amt.value) > 0)) { msg.textContent = "Give the amount in Rs."; return; } }
      else if (note.value.trim() || nx.value !== (e.next || "")) Object.assign(body, { op: "note", note: note.value.trim() || ("Next follow-up " + (nx.value ? dmy(nx.value) : "cleared")), next: nx.value || "" });
      else { msg.textContent = "Change the status, the date or write a note."; return; }
      save.disabled = true; msg.textContent = "Saving…";
      try { await api("/api/vj/enquiry", body); await load(); } catch (x) { msg.textContent = x.message; save.disabled = false; }
    });
    const closeB = el("button", { type: "button", className: "btn ghost", textContent: "Close…" });
    closeB.addEventListener("click", () => { st.value = "Closed"; sync(); note.focus(); msg.textContent = "Pick the result (Bought / Not interested / Not relevant / Closed), add why, then Save."; });
    f.append(lab("Status", st, "0 1 160px"), lNx, lAmt, lBill, lab("Note", note, "2 1 220px"), save, closeB, msg);
    return f;
  }
  function show(on) {
    if (!sec) return; sec.hidden = !on; clearInterval(timer);
    if (on) { document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; });
      document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "enq" ? "true" : "false"));
      render(); load(); timer = setInterval(() => { if (document.visibilityState === "visible" && !openComposer && !(document.activeElement && sec.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))) load(); }, 120000); window.scrollTo({ top: 0 }); }
  }
  function build() {
    const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-enq")) return;
    const b = el("button", { id: "t-enq", textContent: "Enquiries" }); b.setAttribute("role", "tab"); b.dataset.tab = "enq"; b.setAttribute("aria-selected", "false");
    const ck = nav.querySelector('[data-tab="check"]'); nav.insertBefore(b, ck ? ck.nextSibling : null);
    sec = el("section", { className: "card", id: "p-enq", hidden: true });
    const sel = (id, first, opts) => { const s = el("select", { id }); s.append(el("option", { value: "", textContent: first })); opts.forEach(o => s.append(el("option", { value: o, textContent: o }))); return s; };
    const lab = (txt, inp, flex) => { const l = el("label", {}, [txt + " ", inp]); if (flex) l.style.flex = flex; return l; };
    const q = el("input", { id: "enqQ", placeholder: "Name, number or what they want", autocomplete: "off", maxLength: 40 });
    const rel = el("input", { type: "checkbox", id: "enqRel" }), cl = el("input", { type: "checkbox", id: "enqClosed" });
    const refresh = el("button", { type: "button", className: "btn ghost", textContent: "Refresh" }), xl = el("button", { type: "button", className: "btn ghost", textContent: "Excel" });
    const chk = (inp, txt) => { const l = el("label", {}, [inp, " " + txt]); l.style.cssText = "display:flex;flex-direction:row;align-items:center;gap:6px;flex:0 0 auto;white-space:nowrap;cursor:pointer"; inp.style.width = "auto"; return l; };
    sec.append(el("h2", { textContent: "Enquiries - follow up and close" }),
      el("p", { className: "hint", textContent: "Every WhatsApp enquiry, one card per customer. Overdue and due-today follow-ups are on top. Closed ones leave this list (tick Closed / history to see them)." }),
      el("div", { id: "enqStats", style: "display:flex;flex-wrap:wrap;gap:8px;margin:8px 0" }), el("p", { className: "hint", id: "enqCh" }),
      el("div", { className: "row", style: "align-items:end" }, [lab("Search", q, "2 1 200px"), lab("Channel", sel("enqChan", "All", CHANNELS)), lab("Status", sel("enqSt", "All", ["New", "Messaged", "Called", "Visit booked", "Visited", "Quote", "Bought", "Not interested", "Not relevant", "Closed"])),
        lab("From", el("input", { type: "date", id: "enqFrom" })), lab("To", el("input", { type: "date", id: "enqTo" }))]),
      el("div", { className: "row", style: "align-items:center;margin-top:8px" }, [chk(rel, "Real leads only"), chk(cl, "Closed / history"), refresh, xl]),
      el("p", { className: "hint", id: "enqCount" }), el("p", { className: "hint", id: "enqMsg", style: "color:var(--bad)" }), el("div", { id: "enqList" }));
    rates.parentNode.insertBefore(sec, rates);
    ["enqQ", "enqFrom", "enqTo"].forEach(id => $(id).addEventListener("input", render)); ["enqChan", "enqSt", "enqRel"].forEach(id => $(id).addEventListener("change", render));
    cl.addEventListener("change", () => { data = null; render(); load(); });
    refresh.addEventListener("click", () => load(true));
    xl.addEventListener("click", () => { const a = el("a", { href: "/api/vj/enquiries.xlsx" + (cl.checked ? "?closed=1" : "") }); document.body.append(a); a.click(); a.remove(); });
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "enq"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 800);
})();
