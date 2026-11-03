/* VJ Tags - Chats (owner Abhinav 03/11/2026 07:19-07:32, C-20261103-HANDOVER). Bot -> human handover on the SAME business number.
   Loaded by shim.js for admin, staff and sales (sales: read-only, numbers hidden - the server decides). Mobile first.
   List: chats with a person first, then recent chats (last message, time, 24h window, who has it). Thread: Aashvi_Inbox +
   Aashvi's replies + our replies; reply box sends from the business number (server checks the window, login, limits, 1000 chars,
   adds "- <name>, Vaishnavi Jewels"). Window closed -> call or "Send reminder" (approved WhatsApp templates only, a person taps
   send every time). Assign / Hand back to Aashvi / Close. Built with DOM nodes only (no HTML from data). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => k != null && e.append(k)); return e; };
  const pad = n => String(n).padStart(2, "0");
  const when = ms => { if (!ms) return ""; const d = new Date(ms + 5.5 * 3600e3), t = new Date(Date.now() + 5.5 * 3600e3);
    const hm = pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()); return d.toISOString().slice(0, 10) === t.toISOString().slice(0, 10) ? hm : pad(d.getUTCDate()) + "/" + pad(d.getUTCMonth() + 1) + " " + hm; };
  const left = ms => ms > 0 ? Math.floor(ms / 3600e3) + "h " + pad(Math.floor(ms % 3600e3 / 60e3)) + "m left" : "Window closed";
  let sec = null, data = null, cur = null, curId = "", busy = false, timer = 0, tTimer = 0, filter = "all", draft = {};
  async function api(path, body) {
    const r = await fetch(path, body ? { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { credentials: "same-origin", cache: "no-store" });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ("server " + r.status)); return j;
  }
  function pill(text, style) { const p = el("span", { className: "pill", textContent: text }); if (style) p.style.cssText = style; return p; }
  const btn = (text, ghost, fn) => { const b = el("button", { type: "button", className: ghost ? "btn ghost" : "btn", textContent: text }); b.style.cssText = "padding:8px 12px;min-height:40px"; if (fn) b.addEventListener("click", fn); return b; };
  const winPill = ms => pill(left(ms), ms > 3 * 3600e3 ? "background:var(--gold-soft);color:var(--gold)" : ms > 0 ? "background:var(--bad);color:#fff" : "background:var(--sunk);color:var(--fg)");

  async function loadList(fresh) {
    if (busy) return; busy = true;
    try { data = await api("/api/vj/chats" + (fresh ? "?fresh=1" : "")); $("chMsg").textContent = data.sheetOk === false ? "Could not read the Aashvi sheet just now - showing what the website has." : ""; }
    catch (e) { $("chMsg").textContent = "Could not load: " + e.message; }
    busy = false; if (!curId) renderList();
  }
  function renderList() {
    const box = $("chList"); box.textContent = ""; $("chThread").hidden = true; $("chListWrap").hidden = false;
    if (!data) { box.append(el("p", { className: "hint", textContent: "Loading…" })); return; }
    const q = String($("chQ").value || "").trim().toLowerCase(), qd = q.replace(/\D/g, "");
    const L = data.chats.filter(c => (filter === "all" || (filter === "human" ? c.mode === "human" : c.mode === "human" && c.to === data.me.replace(/^Shilpi$/, "Shilpiji")))
      && (!q || String(c.name).toLowerCase().includes(q) || (qd.length >= 3 && String(c.number || "").replace(/\D/g, "").includes(qd)) || String(c.last).toLowerCase().includes(q)));
    $("chCount").textContent = L.length + " chat" + (L.length === 1 ? "" : "s") + " · " + data.chats.filter(c => c.mode === "human").length + " with a person";
    if (!L.length) box.append(el("p", { className: "hint", textContent: "No chats here." }));
    L.slice(0, 300).forEach(c => {
      const card = el("button", { type: "button", className: "card" }); card.style.cssText = "display:block;width:100%;text-align:left;margin:8px 0;padding:12px 14px;cursor:pointer;font:inherit;color:inherit" + (c.mode === "human" ? ";border-left:4px solid var(--gold)" : "");
      const top = el("div"); top.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center";
      top.append(el("strong", { textContent: c.name || "(no name)" }), c.number ? el("span", { className: "hint", textContent: c.number }) : null);
      const tags = el("div"); tags.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:4px";
      tags.append(c.mode === "human" ? pill("With " + c.to, "background:var(--gold-soft);color:var(--gold)") : pill("Aashvi"), winPill(c.winLeft));
      if (c.enq) tags.append(pill("Enquiry: " + c.enq.status));
      const last = el("div", { textContent: (c.lastDir === "in" ? "" : c.lastDir === "bot" ? "Aashvi: " : "") + c.last }); last.style.cssText = "margin-top:6px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      const tm = el("span", { className: "hint", textContent: when(c.lastAt) }); tm.style.cssText = "margin-left:auto";
      top.append(tm); card.append(top, tags, last);
      card.addEventListener("click", () => openThread(c.id));
      box.append(card);
    });
  }
  async function openThread(id, wa) {
    curId = id || ("wa:" + wa); cur = null; draft = {}; renderThread();
    try { cur = await api("/api/vj/chat?" + (id ? "id=" + encodeURIComponent(id) : "wa=" + encodeURIComponent(wa))); curId = cur.id; }
    catch (e) { cur = { error: e.message }; }
    renderThread(); clearInterval(tTimer);
    tTimer = setInterval(async () => { if (!curId || document.visibilityState !== "visible" || (document.activeElement && sec.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
      try { const j = await api("/api/vj/chat?id=" + encodeURIComponent(curId)); const n = j.thread.length + ":" + (j.thread.slice(-1)[0] || {}).status; if (n !== cur.thread.length + ":" + (cur.thread.slice(-1)[0] || {}).status || j.mode !== cur.mode) { cur = j; renderThread(true); } } catch (e) {} }, 15000);
    window.scrollTo({ top: 0 });
  }
  function back() { curId = ""; cur = null; clearInterval(tTimer); renderList(); loadList(); }
  function renderThread(keepBox) {
    $("chListWrap").hidden = true; const t = $("chThread"); t.hidden = false;
    const keep = keepBox && $("chText") ? $("chText").value : null; t.textContent = "";
    const head = el("div"); head.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;position:sticky;top:0;background:var(--bg);padding:6px 0;z-index:2;border-bottom:1px solid var(--line)";
    head.append(btn("← Chats", true, back));
    if (!cur) { t.append(head, el("p", { className: "hint", textContent: "Loading…" })); return; }
    if (cur.error) { t.append(head, el("p", { className: "hint", textContent: cur.error, style: "color:var(--bad)" })); return; }
    const who = el("div"); who.style.cssText = "display:flex;flex-direction:column;min-width:0;flex:1 1 140px";
    who.append(el("strong", { textContent: cur.name || "(no name)" }), cur.number ? el("span", { className: "hint", textContent: cur.number }) : null);
    head.append(who);
    if (cur.number && cur.canEdit) { const call = el("a", { href: "tel:" + cur.number, className: "btn ghost", textContent: "Call" }); call.style.cssText = "text-decoration:none;padding:8px 12px;border:1px solid var(--line);border-radius:var(--r);color:var(--fg);font-weight:600"; head.append(call); }
    t.append(head);
    const st = el("div"); st.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0";
    st.append(cur.mode === "human" ? pill("With " + cur.to + " · Aashvi silent", "background:var(--gold-soft);color:var(--gold)") : pill("Aashvi is answering"), winPill(cur.winLeft));
    if (cur.need) st.append(el("span", { className: "hint", textContent: "Hot lead: " + cur.need }));
    t.append(st);
    if (cur.enq) {
      const e = el("div", { className: "card" }); e.style.cssText = "margin:6px 0;padding:8px 12px;font-size:14px";
      e.append(el("div", {}, [el("span", { className: "hint", textContent: "Enquiry (" + cur.enq.status + "): " }), document.createTextNode(cur.enq.what || "-")]));
      const row = el("div"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:6px";
      row.append(btn("Open in Enquiries", true, () => { const b = document.querySelector('nav button[data-tab="enq"]'); if (b) { b.click(); setTimeout(() => { const q = $("enqQ"); if (q) { q.value = String(cur && cur.number || "").replace(/\D/g, "").slice(-10); q.dispatchEvent(new Event("input")); } }, 300); } }));
      if (cur.opener) row.append(btn("Personalised opener", true, () => { const o = $("chOpener"); o.hidden = !o.hidden; }));
      e.append(row);
      if (cur.opener) { const o = el("textarea", { id: "chOpener", value: cur.opener, rows: 4, readOnly: true, hidden: true }); o.style.cssText = "width:100%;box-sizing:border-box;margin-top:6px;font:inherit;font-size:14px;padding:8px;border:1px solid var(--line);border-radius:var(--r);background:var(--sunk);color:var(--fg)"; e.append(o); }
      t.append(e);
    }
    // messages
    const box = el("div", { id: "chMsgs" }); box.style.cssText = "display:flex;flex-direction:column;gap:6px;margin:10px 0;max-height:55vh;overflow-y:auto;padding:4px;border:1px solid var(--line);border-radius:var(--r);background:var(--sunk)";
    if (!cur.thread.length) box.append(el("p", { className: "hint", textContent: "No messages yet." }));
    cur.thread.forEach(m => {
      const mine = m.who !== "customer", b = el("div"); b.style.cssText = "max-width:85%;padding:8px 10px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word;font-size:15px;line-height:1.35;" + (mine ? "align-self:flex-end;background:" + (m.who === "us" ? "var(--gold-soft)" : "var(--bg)") + ";border:1px solid var(--line)" : "align-self:flex-start;background:var(--bg);border:1px solid var(--line)");
      const meta = (m.who === "customer" ? "" : m.who === "aashvi" ? "Aashvi · " : (m.by || "Team") + " · ") + when(m.t) + (m.status && m.status !== "sent" ? " · " + (m.status === "failed" ? "NOT SENT " + (m.err || "") : "sending…") : m.status === "sent" ? " · sent" : "");
      b.append(document.createTextNode(m.text), el("div", { className: "hint", textContent: meta, style: "font-size:11px;margin-top:3px" + (m.status === "failed" ? ";color:var(--bad)" : "") }));
      box.append(b);
    });
    t.append(box); setTimeout(() => { box.scrollTop = box.scrollHeight; }, 0);
    const msg = el("p", { className: "hint", id: "chSendMsg", style: "color:var(--bad);margin:4px 0" });
    if (cur.canEdit) {
      if (cur.winLeft > 60e3) {
        const ta = el("textarea", { id: "chText", rows: 3, maxLength: 1000, placeholder: "Reply from the business number…" }); ta.style.cssText = "width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);color:var(--fg)";
        if (keep != null) ta.value = keep;
        const cnt = el("span", { className: "hint" }), upd = () => { cnt.textContent = ta.value.length + "/1000 · signed “— " + cur.me + ", Vaishnavi Jewels”"; }; ta.addEventListener("input", upd); upd();
        const send = btn("Send", false, async () => { const txt = ta.value.trim(); if (!txt) return; send.disabled = true; msg.textContent = "Sending…";
          try { await api("/api/vj/chat", { op: "reply", id: cur.id, text: txt }); ta.value = ""; msg.textContent = ""; await reload(); } catch (e) { msg.textContent = e.message; send.disabled = false; } });
        const ask = btn("Ask for a call time", true, async () => { if (!confirm("Send the customer: “Namaste … aapse baat karne ke liye kaunsa samay theek rahega?”")) return; ask.disabled = true;
          try { await api("/api/vj/chat", { op: "callask", id: cur.id }); await reload(); } catch (e) { msg.textContent = e.message; ask.disabled = false; } });
        const row = el("div"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px"; row.append(send, ask, cnt);
        t.append(ta, row);
      } else {
        const w = el("div", { className: "card" }); w.style.cssText = "padding:10px 12px;border-color:var(--bad)";
        w.append(el("strong", { textContent: "Window closed — please call" }), el("p", { className: "hint", textContent: "WhatsApp allows free-form replies only within 24 hours of the customer's last message. Call, or send an approved reminder; when the customer replies, the chat opens again." }));
        const row = el("div"); row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px";
        if (cur.number) { const c = el("a", { href: "tel:" + cur.number, className: "btn", textContent: "Call " + cur.number }); c.style.cssText = "text-decoration:none;padding:8px 12px;border:1px solid var(--line);border-radius:var(--r);font-weight:600"; row.append(c); }
        if (cur.canTpl) row.append(btn("Send reminder", true, () => remindBox(t)));
        else row.append(el("span", { className: "hint", textContent: "Reminders: Abhinav, Shilpiji or staff the owner allows." }));
        w.append(row); t.append(w);
      }
      t.append(msg);
      // actions
      const act = el("div"); act.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)";
      const sel = el("select", { "aria-label": "Assign to" }); sel.style.cssText = "min-height:40px"; sel.append(el("option", { value: "", textContent: "Assign to…" })); cur.people.forEach(p => sel.append(el("option", { value: p, textContent: p, selected: cur.mode === "human" && cur.to === p })));
      sel.addEventListener("change", async () => { if (!sel.value) return; try { await api("/api/vj/chat", { op: "assign", id: cur.id, to: sel.value }); await reload(); } catch (e) { msg.textContent = e.message; } });
      act.append(sel);
      if (cur.mode === "human") act.append(btn("Hand back to Aashvi", true, async () => { if (!confirm("Aashvi will answer this customer again. OK?")) return; try { await api("/api/vj/chat", { op: "bot", id: cur.id }); await reload(); } catch (e) { msg.textContent = e.message; } }));
      act.append(btn("Close", true, async () => { const note = prompt("Close this chat (Aashvi answers again" + (cur.enq && cur.enq.open ? " and the enquiry is closed" : "") + "). Why? (optional)", ""); if (note === null) return;
        try { const r = await api("/api/vj/chat", { op: "close", id: cur.id, note }); msg.textContent = r.enq || ""; await reload(); } catch (e) { msg.textContent = e.message; } }));
      t.append(act);
    }
    if (cur.mode === "human" && cur.by) t.append(el("p", { className: "hint", textContent: "With " + cur.to + " since " + when(cur.since) + " (" + (/@/.test(cur.by) ? "set in VJ Tags" : cur.by) + ")." }));
  }
  async function reload() { try { cur = await api("/api/vj/chat?id=" + encodeURIComponent(cur.id)); } catch (e) {} renderThread(); }
  function remindBox(t) {
    if ($("chRem")) { $("chRem").remove(); return; }
    const v = cur.vars || {}, box = el("div", { id: "chRem", className: "card" }); box.style.cssText = "margin-top:10px;padding:12px";
    let lang = v.lang || "hi", pick = "";
    const visitOk = !!(cur.enq && cur.enq.visitBooked);
    const inp = (ph, val, max) => { const i = el("input", { value: val || "", maxLength: max || 60, placeholder: ph }); i.style.cssText = "width:100%;box-sizing:border-box;font-size:16px;min-height:40px"; return i; };
    const f1 = inp("Name", v.v1, 40), f2 = inp("Your name", v.v2, 40), f3 = inp("Topic (3-8 words)", lang === "hi" ? v.v3hi : v.v3en, 60);
    const kind = el("select"); ["showroom visit", "video call"].forEach(x => kind.append(el("option", { value: x, textContent: x })));
    const dt = el("input", { type: "date", value: v.visit || "" }), tm = el("input", { type: "time", value: "18:00" });
    const prev = el("div"); prev.style.cssText = "white-space:pre-wrap;padding:10px;border:1px solid var(--line);border-radius:var(--r);background:var(--sunk);font-size:15px;margin:8px 0";
    const info = el("p", { className: "hint" }), msg = el("p", { className: "hint", style: "color:var(--bad)" });
    const choices = el("div"); choices.style.cssText = "display:flex;flex-direction:column;gap:6px";
    const tplOf = () => { const x = cur.tpls.find(y => y.key === pick); if (!x) return null; const y = x.lang === lang ? Object.assign({}, x) : Object.assign({}, x, x.alt, { lang: x.lang === "hi" ? "en" : "hi" }); y.rate = y.category === "UTILITY" ? 0.115 : 0.8631; return y; };
    const fmtWhen = () => { if (!dt.value) return ""; const d = new Date(dt.value + "T00:00:00Z"), mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
      let h = Number((tm.value || "18:00").slice(0, 2)), m = (tm.value || "18:00").slice(3, 5), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return d.getUTCDate() + " " + mo + ", " + h + ":" + m + " " + ap; };
    const vals = () => pick === "visit" ? [f1.value.trim(), f2.value.trim(), kind.value, fmtWhen()] : [f1.value.trim(), f2.value.trim(), f3.value.trim()];
    const upd = () => {
      const x = tplOf(); f3.parentNode.hidden = pick === "visit"; vRow.hidden = pick !== "visit";
      if (!x) { prev.textContent = "Pick a reminder above."; info.textContent = ""; send.disabled = true; return; }
      const vs = vals(); prev.textContent = x.text.replace(/\{\{(\d)\}\}/g, (m0, i) => vs[Number(i) - 1] || "[" + i + "]");
      const ok = x.status === "APPROVED";
      info.textContent = "WhatsApp category: " + x.category + " · approx ₹" + x.rate.toFixed(2) + " + GST per message (Meta India rate) · " + (ok ? "approved" : "not usable yet: " + x.status);
      send.disabled = !ok || !!cur.stop || vs.some(s => !s);
    };
    Object.entries({ visit: "Visit / video-call reminder", update: "Enquiry update (utility)", followup: "Follow-up (marketing)" }).forEach(([k, lab]) => {
      const x = cur.tpls.find(y => y.key === k); const r = el("input", { type: "radio", name: "chTpl", value: k, disabled: k === "visit" && !visitOk }); r.style.width = "auto";
      r.addEventListener("change", () => { pick = k; upd(); });
      const l = el("label", {}, [r, " " + lab + " — " + (x ? x.category.toLowerCase() + ", approx ₹" + x.rate.toFixed(2) + (x.status === "APPROVED" ? "" : " (" + x.status.toLowerCase() + ")") : "") + (k === "visit" && !visitOk ? " (set a visit date on the enquiry first)" : "")]);
      l.style.cssText = "display:flex;flex-direction:row;gap:8px;align-items:center;text-align:left;cursor:pointer;font-size:15px"; choices.append(l);
    });
    const lg = el("select"); [["hi", "Hinglish"], ["en", "English"]].forEach(([c, n]) => lg.append(el("option", { value: c, textContent: n, selected: c === lang })));
    lg.addEventListener("change", () => { lang = lg.value; f3.value = lang === "hi" ? v.v3hi : v.v3en; upd(); });
    const lab = (txt, i) => { const l = el("label", {}, [txt, i]); l.style.cssText = "display:flex;flex-direction:column;gap:2px;font-size:13px;flex:1 1 160px"; return l; };
    const vRow = el("div"); vRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px"; vRow.append(lab("Booking", kind), lab("Date", dt), lab("Time", tm));
    const fields = el("div"); fields.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"; fields.append(lab("Language", lg), lab("{{1}} Customer", f1), lab("{{2}} From", f2), lab("{{3}} What you spoke about", f3));
    [f1, f2, f3, dt, tm, kind].forEach(i => i.addEventListener("input", upd));
    const send = btn("Send reminder", false, async () => { const x = tplOf(); if (!x) return;
      if (!confirm("Send this WhatsApp reminder to " + (cur.name || "the customer") + "?\n\n" + prev.textContent + "\n\n" + info.textContent)) return;
      send.disabled = true; msg.textContent = "Sending…";
      const vs = vals();
      try { await api("/api/vj/chat", { op: "remind", id: cur.id, tpl: pick, lang: x.lang, v1: vs[0], v2: vs[1], v3: vs[2], v4: vs[3] || "" }); msg.textContent = ""; box.remove(); await reload(); }
      catch (e) { msg.textContent = e.message; send.disabled = false; } });
    const sync = btn("Check approval", true, async () => { sync.disabled = true; try { await api("/api/vj/chat", { op: "tplsync" }); setTimeout(async () => { await reload(); }, 8000); msg.textContent = "Asked WhatsApp - this updates in a few seconds."; } catch (e) { msg.textContent = e.message; } });
    box.append(el("strong", { textContent: "Send reminder (window closed)" }), el("p", { className: "hint", textContent: "Max 1 per customer in 48 h, 3 per enquiry, daily limit set by the owner. STOP / “Not now” customers are never sent one." + (cur.stop ? " This customer: " + cur.stop + "." : "") }),
      choices, fields, vRow, prev, info, el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [send, sync]), msg);
    if (cur.stop) send.title = cur.stop;
    t.append(box); upd(); box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function settings() {
    const box = $("chSet"); if (!box.hidden) { box.hidden = true; return; } box.hidden = false; box.textContent = "Loading…";
    let staff = []; try { staff = (await api("/api/vj/chat", { op: "staffList" })).staff; } catch (e) {}
    box.textContent = "";
    const def = el("select"); data.people.forEach(p => def.append(el("option", { value: p, textContent: p, selected: p === data.def })));
    const cap = el("input", { type: "number", min: "0", max: "200", value: String(data.cap == null ? 20 : data.cap), inputMode: "numeric" }); cap.style.width = "90px";
    const ticks = staff.map(s => { const c = el("input", { type: "checkbox", checked: (data.staff || []).includes(s.email), value: s.email }); c.style.width = "auto"; return el("label", { style: "display:flex;gap:6px;align-items:center" }, [c, " " + (s.name || s.email)]); });
    const m = el("span", { className: "hint" });
    const save = btn("Save", false, async () => { try { const r = await api("/api/vj/chat", { op: "settings", def: def.value, cap: Number(cap.value), staff: ticks.map(l => l.firstChild).filter(c => c.checked).map(c => c.value) }); Object.assign(data, { def: r.def, cap: r.cap, staff: r.staff }); m.textContent = "Saved."; } catch (e) { m.textContent = e.message; } });
    box.append(el("strong", { textContent: "Chat settings (owners)" }),
      el("div", { style: "display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-top:6px" }, [el("label", {}, ["Hot leads go to ", def]), el("label", {}, ["Reminders per day (all) ", cap])]),
      el("p", { className: "hint", textContent: "Staff who may send reminders (templates):" }), el("div", { style: "display:flex;flex-direction:column;gap:4px" }, ticks.length ? ticks : [el("span", { className: "hint", textContent: "No staff logins." })]),
      el("div", { style: "margin-top:8px;display:flex;gap:8px;align-items:center" }, [save, m]));
  }
  function show(on) {
    if (!sec) return; sec.hidden = !on; clearInterval(timer); if (!on) { clearInterval(tTimer); return; }
    document.querySelectorAll('[id^="p-"]').forEach(p => { if (p !== sec) p.hidden = true; });
    document.querySelectorAll("nav button").forEach(y => y.setAttribute("aria-selected", y.dataset.tab === "chats" ? "true" : "false"));
    if (curId) renderThread(); else renderList(); loadList();
    timer = setInterval(() => { if (document.visibilityState === "visible" && !curId) loadList(); }, 60000); window.scrollTo({ top: 0 });
  }
  function build() {
    const nav = document.querySelector("nav"), rates = $("p-rates"); if (!nav || !rates || $("t-chats")) return;
    const b = el("button", { id: "t-chats", textContent: "Chats" }); b.setAttribute("role", "tab"); b.dataset.tab = "chats"; b.setAttribute("aria-selected", "false");
    const after = nav.querySelector('[data-tab="enq"]') || nav.querySelector('[data-tab="check"]'); nav.insertBefore(b, after ? after.nextSibling : null);
    sec = el("section", { className: "card", id: "p-chats", hidden: true });
    const q = el("input", { id: "chQ", placeholder: "Search name, number or text", autocomplete: "off", maxLength: 40 }); q.style.cssText = "flex:1 1 180px;font-size:16px;min-height:40px";
    const fs = el("div"); fs.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
    [["all", "All"], ["human", "With a person"], ["mine", "Mine"]].forEach(([k, n]) => { const x = btn(n, k !== "all", () => { filter = k; [...fs.children].forEach(c => c.className = c === x ? "btn" : "btn ghost"); renderList(); }); fs.append(x); });
    const head = el("div", { style: "display:flex;flex-wrap:wrap;gap:8px;align-items:center" }, [q, btn("Refresh", true, () => loadList(true))]);
    const setB = btn("Settings", true, settings); setB.id = "chSetB";
    sec.append(el("h2", { textContent: "Chats" }),
      el("div", { id: "chListWrap" }, [el("p", { className: "hint", textContent: "Customer chats on the business number. Chats with a person come first — Aashvi stays silent in those until you hand back." }),
        head, el("div", { style: "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px" }, [fs, setB]), el("div", { id: "chSet", className: "card", hidden: true, style: "margin-top:8px;padding:10px" }),
        el("p", { className: "hint", id: "chCount" }), el("p", { className: "hint", id: "chMsg", style: "color:var(--bad)" }), el("div", { id: "chList" })]),
      el("div", { id: "chThread", hidden: true }));
    rates.parentNode.insertBefore(sec, rates);
    q.addEventListener("input", renderList);
    nav.addEventListener("click", e => { const x = e.target.closest("nav button"); if (!x) return; show(x.dataset.tab === "chats"); });
    setTimeout(() => { if (data && !data.isAdmin) setB.hidden = true; }, 3000);
    const hideSet = () => { if (data) setB.hidden = !data.isAdmin; else setTimeout(hideSet, 1000); }; hideSet();
  }
  // from an Enquiries card: open this customer's chat (staff/owners only - sales never get numbers)
  window.VJChats = { open: wa => { const b = $("t-chats"); if (!b) return; b.click(); openThread("", String(wa || "").replace(/\D/g, "")); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 800);
})();
