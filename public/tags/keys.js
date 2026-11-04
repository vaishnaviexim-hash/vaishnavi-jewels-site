/* VJ Tags - "all done" shortcut (owner Abhinav 17/10/2026, C-20261017-CTRLA).
   Ctrl + A (or Ctrl + Enter) on New tag = Save & print tag. On Bill = Save bill & make PDF, on Ledger = Save receipt & make PDF,
   then a small box asks: P Print, W Send on WhatsApp (Aashvi), Esc Close. Uses the page's own buttons, so every check still runs. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const vis = id => { const e = $(id); return !!(e && !e.hidden && e.offsetParent !== null); };
  let box = null;
  function close() { if (box) { box.remove(); box = null; } }
  function printPdf(a) {
    if (!a || !a.href) return; const f = document.createElement("iframe"); f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
    f.src = a.href; document.body.appendChild(f);
    f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { window.open(a.href, "_blank", "noopener"); } setTimeout(() => f.remove(), 60000); };
  }
  function ask(out, title) {
    close(); const links = [...out.querySelectorAll("a")], pdf = links.find(a => /print|open/i.test(a.textContent)) || links[0];
    const wa = [...out.querySelectorAll("button")].find(b => /whatsapp/i.test(b.textContent));
    box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center";
    const c = document.createElement("div"); c.style.cssText = "background:#fff;border-radius:12px;padding:22px 24px;min-width:300px;max-width:92vw;font-size:17px;box-shadow:0 10px 30px rgba(0,0,0,.25)";
    const h = document.createElement("div"); h.style.cssText = "font-weight:700;margin-bottom:14px"; h.textContent = title; c.appendChild(h);
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:10px;flex-wrap:wrap";
    const mk = (t, fn, main) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (main ? "" : " ghost"); b.textContent = t; b.addEventListener("click", () => { close(); fn(); }); row.appendChild(b); return b; };
    if (pdf) mk("Print  (P)", () => printPdf(pdf), true);
    if (wa) mk("Send on WhatsApp  (W)", () => { wa.click(); if (/tap again/i.test(wa.textContent)) wa.click(); wa.scrollIntoView({ block: "center" }); });
    mk("Close  (Esc)", () => {});
    c.appendChild(row); if (!wa) { const n = document.createElement("div"); n.className = "hint"; n.style.marginTop = "10px"; n.textContent = "WhatsApp needs a 10-digit mobile number on it."; c.appendChild(n); }
    box.appendChild(c); box.addEventListener("click", e => { if (e.target === box) close(); }); document.body.appendChild(box);
    box._keys = { p: () => pdf && printPdf(pdf), w: () => wa && (wa.click(), /tap again/i.test(wa.textContent) && wa.click()) };
  }
  function saveThenAsk(btnId, outId, msgId, label) {
    const btn = $(btnId), out = $(outId); if (!btn || btn.disabled) return; out.hidden = true; btn.click();
    let n = 0; const t = setInterval(() => { n++;
      if (!out.hidden && out.querySelector("a")) { clearInterval(t); const m = $(msgId); ask(out, (m && m.textContent.split(".")[0]) || label); }
      else if (n > 120) clearInterval(t); }, 250);
  }
  window.VJ_SAVE_ASK = id => id === "rsave" ? saveThenAsk("rsave", "rout", "rmsg", "Receipt saved") : saveThenAsk("bsave", "bout", "bmsg", "Bill saved"); /* C-20261104-HOTKEYS: Alt + A uses the same flow */
  window.VJ_KEYS_BUSY = () => !!box;
  document.addEventListener("keydown", e => {
    if (box) { const k = e.key.toLowerCase(); if (k === "escape") { close(); e.preventDefault(); } else if (box._keys[k]) { e.preventDefault(); const f = box._keys[k]; close(); f(); } return; }
    if (!(e.ctrlKey || e.metaKey) || e.altKey || !(e.key === "a" || e.key === "A" || e.key === "Enter")) return;
    if (vis("p-bill")) { e.preventDefault(); saveThenAsk("bsave", "bout", "bmsg", "Bill saved"); return; }
    if (vis("p-ledger")) { e.preventDefault(); saveThenAsk("rsave", "rout", "rmsg", "Receipt saved"); return; }
    if (vis("p-new") && $("save")) { e.preventDefault(); if (!$("save").disabled) $("save").click(); }
  }, true);
})();
/* VJ Tags - Tally-style keys (owner Abhinav 04/11/2026 11:41, C-20261104-HOTKEYS).
   Alt + C = small calculator from any screen (+ − × ÷ % brackets; Enter = result, Ctrl + Enter or "Use ↵" = put it in the box that was
   in use and recalculate, Esc = close; last 5 sums kept until the page is closed). No eval - a small parser of its own.
   Ctrl + A (or Alt + A) = Save, like Tally's accept: presses the open form's own Save / Save to karigar account / Save & print tag button - only when it
   is on; when it is off, the form's own warning is shown. Never Delete / Cancel / Clear. Phones: the 🧮 button at the bottom of the page. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  // ---------- safe parser ----------
  function calc(src) {
    const s = String(src || "").replace(/[×xX]/g, "*").replace(/[÷]/g, "/").replace(/[−–]/g, "-").replace(/,/g, "").replace(/\s+/g, "");
    if (!s) return null; if (s.length > 200 || /[^0-9.+\-*/%()]/.test(s)) throw new Error("bad");
    let i = 0; const peek = () => s[i];
    function num() { const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!m) throw new Error("bad"); i += m[0].length; return Number(m[0]); }
    function factor(d) { if (d > 40) throw new Error("bad"); let v, pct = false; const c = peek();
      if (c === "-" || c === "+") { i++; const f = factor(d + 1); return { v: c === "-" ? -f.v : f.v, pct: f.pct }; }
      if (c === "(") { i++; v = expr(d + 1); if (peek() !== ")") throw new Error("bad"); i++; } else v = num();
      while (peek() === "%") { i++; v = v / 100; pct = true; } return { v, pct }; }
    function term(d) { let f = factor(d), v = f.v, pct = f.pct;
      while (peek() === "*" || peek() === "/") { const op = s[i++], g = factor(d).v; v = op === "*" ? v * g : v / g; pct = false; } return { v, pct }; }
    function expr(d) { let v = term(d).v;
      while (peek() === "+" || peek() === "-") { const op = s[i++], t = term(d), r = t.pct ? v * t.v : t.v; /* 50000 + 3% = 51,500 */ v = op === "+" ? v + r : v - r; } return v; }
    const v = expr(0); if (i !== s.length || !isFinite(v)) throw new Error("bad"); return Math.round(v * 1e6) / 1e6;
  }
  window.VJ_CALC = calc;
  const plain = v => String(v), show = v => v.toLocaleString("en-IN", { maximumFractionDigits: 6 });
  // ---------- the box that was in use ----------
  const editable = e => !!(e && e.isConnected && ((e.tagName === "INPUT" && /^(text|number|search|tel|)$/i.test(e.type || "")) || e.tagName === "TEXTAREA") && !e.readOnly && !e.disabled && !(cbox && cbox.contains(e)));
  let lastField = null, cbox = null, target = null; const hist = [];
  document.addEventListener("focusin", e => { if (editable(e.target)) lastField = e.target; }, true);
  function closeCalc(back) { if (!cbox) return; cbox.remove(); cbox = null; if (back && target && target.isConnected) try { target.focus({ preventScroll: true }); } catch (e) {} }
  function openCalc() {
    if (cbox) { closeCalc(true); return; }
    const a = document.activeElement; target = editable(a) ? a : (editable(lastField) && lastField.offsetParent !== null ? lastField : null);
    cbox = document.createElement("div"); cbox.id = "vjCalc";
    cbox.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.25);display:flex;align-items:flex-start;justify-content:center;padding:10vh 12px 12px";
    const c = document.createElement("div"); c.style.cssText = "background:var(--surface,#fff);color:var(--fg,#1f2328);border:1px solid var(--line,#d9d4ca);border-radius:12px;padding:14px;width:320px;max-width:100%;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:16px";
    const h = document.createElement("div"); h.style.cssText = "display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:8px"; h.textContent = "Calculator";
    const x = document.createElement("button"); x.type = "button"; x.className = "btn ghost"; x.textContent = "✕"; x.title = "Close (Esc)"; x.style.padding = "2px 10px"; x.addEventListener("click", () => closeCalc(true)); h.appendChild(x);
    const inp = document.createElement("input"); inp.type = "text"; inp.autocomplete = "off"; inp.spellcheck = false; inp.maxLength = 200; inp.placeholder = "e.g. 24.896 - 0.172"; inp.setAttribute("aria-label", "Sum");
    inp.style.cssText = "width:100%;box-sizing:border-box;font-size:20px;padding:8px;font-variant-numeric:tabular-nums";
    const out = document.createElement("div"); out.style.cssText = "font-size:22px;font-weight:700;text-align:right;min-height:30px;margin:6px 0;font-variant-numeric:tabular-nums";
    const pad = document.createElement("div"); pad.style.cssText = "display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:8px";
    ["7", "8", "9", "÷", "(", "4", "5", "6", "×", ")", "1", "2", "3", "−", "%", "0", ".", "C", "+", "⌫"].forEach(k => { const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = k; b.style.cssText = "padding:6px 0;font-size:16px;min-width:0";
      b.addEventListener("mousedown", e => e.preventDefault());
      b.addEventListener("click", () => { if (k === "C") inp.value = ""; else if (k === "⌫") inp.value = inp.value.slice(0, -1); else inp.value += /[÷×−+]/.test(k) ? " " + k + " " : k; live(); inp.focus(); }); pad.appendChild(b); });
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap";
    const eq = document.createElement("button"); eq.type = "button"; eq.className = "btn ghost"; eq.textContent = "= (Enter)";
    const use = document.createElement("button"); use.type = "button"; use.className = "btn"; use.textContent = "Use ↵"; use.title = "Ctrl + Enter: put the result in the box";
    const tn = document.createElement("div"); tn.className = "hint"; tn.style.cssText = "flex:1 1 100%;font-size:13px";
    const tName = target ? ((target.labels && target.labels[0] && target.labels[0].textContent.trim()) || target.placeholder || target.id || "the box") : "";
    tn.textContent = target ? "Use ↵ puts the result in: " + tName.slice(0, 50) : "Click a box first, then Alt + C, to put the result in it.";
    use.disabled = !target; row.append(eq, use, tn);
    const hl = document.createElement("div"); hl.style.cssText = "margin-top:8px;font-size:14px;display:flex;flex-direction:column;gap:2px";
    const drawHist = () => { hl.textContent = ""; hist.forEach(r => { const b = document.createElement("button"); b.type = "button"; b.style.cssText = "all:unset;cursor:pointer;color:var(--muted,#5f6670);text-align:right;font-variant-numeric:tabular-nums"; b.textContent = r.e + " = " + show(r.v); b.title = "Use this sum again";
      b.addEventListener("click", () => { inp.value = r.e; live(); inp.focus(); }); hl.appendChild(b); }); };
    let cur = null;
    function live() { try { cur = calc(inp.value); out.textContent = cur == null ? "" : "= " + show(cur); out.style.color = ""; } catch (e) { cur = null; out.textContent = inp.value.trim() ? "…" : ""; out.style.color = "var(--muted,#5f6670)"; } use.disabled = !target || cur == null; }
    function enter() { live(); if (cur == null) { if (inp.value.trim()) { out.textContent = "Check the sum"; out.style.color = "var(--bad,#b0302a)"; } return; } const e = inp.value.trim();
      if (!hist.length || hist[0].e !== e) { hist.unshift({ e, v: cur }); hist.length = Math.min(hist.length, 5); } drawHist(); }
    function useIt() { enter(); if (cur == null || !target || !target.isConnected) return; const t = target, v = plain(cur); closeCalc(false);
      try { t.focus({ preventScroll: true }); } catch (e) {} t.value = v; t.dispatchEvent(new Event("input", { bubbles: true })); t.dispatchEvent(new Event("change", { bubbles: true })); }
    inp.addEventListener("input", live); eq.addEventListener("click", () => { enter(); inp.focus(); }); use.addEventListener("click", useIt);
    cbox._enter = enter; cbox._use = useIt;
    c.append(h, inp, out, pad, row, hl); cbox.appendChild(c); cbox.addEventListener("mousedown", e => { if (e.target === cbox) { e.preventDefault(); closeCalc(true); } });
    document.body.appendChild(cbox); drawHist(); live(); inp.focus();
  }
  window.VJ_OPEN_CALC = openCalc;
  // ---------- Alt + A = Save ----------
  const vis = e => { if (!e || !e.isConnected || e.hidden) return false; const r = e.getClientRects(); if (!r.length) return false; const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none"; };
  const GOOD = /\b(save|update|accept)\b/i, BAD = /delet|cancel|erase|remov|clear|discard|close|reset|undo|void|✕|saved\b/i;
  const saves = root => [...root.querySelectorAll("button, input[type=submit]")].filter(b => { const t = (b.textContent || b.value || "").trim(); return t && t.length < 60 && GOOD.test(t) && !BAD.test(t) && vis(b); });
  function topLayer() { /* the top-most dialog over the page (fixed, covers most of the screen) */
    let best = null, bz = -1; [...document.body.children].concat([...document.querySelectorAll("dialog[open]")]).forEach(e => { if (e === cbox || e.id === "vjKeyToast" || !vis(e)) return; const cs = getComputedStyle(e);
      if (e.tagName !== "DIALOG" && cs.position !== "fixed") return; const r = e.getBoundingClientRect(); if (e.tagName !== "DIALOG" && (r.width < innerWidth * .6 || r.height < innerHeight * .6)) return;
      const z = parseInt(cs.zIndex, 10) || 0; if (z >= bz) { bz = z; best = e; } }); return best; }
  function pick(scope) { const a = document.activeElement;
    if (a && scope.contains(a)) for (let p = a.parentElement; p && p !== scope.parentElement; p = p.parentElement) { const l = saves(p); if (l.length) return best(l, a); }
    const l = saves(scope); return l.length ? best(l, a) : null; }
  function best(l, a) { const main = l.filter(b => !b.classList.contains("ghost")), m = main.length ? main : l; if (a && m.length > 1) { const after = m.find(b => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); if (after) return after; } return m[0]; }
  const red = e => { const m = /rgba?\((\d+), *(\d+), *(\d+)/.exec(getComputedStyle(e).color); if (!m) return false; const [r, g, b] = [+m[1], +m[2], +m[3]]; return r >= 120 && r > g * 1.8 && r > b * 1.8; };
  function why(btn, scope) { /* the form's own warning, nearest the Save button */
    if (btn.title && !/ctrl|alt/i.test(btn.title)) return { t: btn.title };
    const own = [...scope.querySelectorAll("p, div, span, b, small")].filter(e => vis(e) && !e.querySelector("p, div, input, select, button") && (e.textContent || "").trim().length > 3 && (red(e) || /\b(bad|warn|err)/.test(e.className || "")));
    const br = btn.getBoundingClientRect(), d = e => { const r = e.getBoundingClientRect(); return Math.abs(r.top - br.top); };
    if (own.length) { own.sort((p, q) => d(p) - d(q)); return { t: own[0].textContent.trim(), e: own[0] }; }
    const hs = [...scope.querySelectorAll("[id]")].filter(e => /hint|msg/i.test(e.id) && e.id !== "vjKeyHint" && vis(e) && (e.textContent || "").trim().length > 3); /* e.g. New tag: saveHint */
    if (hs.length) { hs.sort((p, q) => d(p) - d(q)); return { t: hs[0].textContent.trim(), e: hs[0] }; }
    return { t: "Save is off - fill in the boxes marked in red first." }; }
  let toastT = 0;
  function toast(t, bad) { let d = $("vjKeyToast"); if (!d) { d = document.createElement("div"); d.id = "vjKeyToast"; d.setAttribute("role", "status"); document.body.appendChild(d); }
    d.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10001;max-width:90vw;padding:10px 16px;border-radius:10px;font-size:16px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.2);background:" + (bad ? "var(--bad-soft,#f8e2e0);color:var(--bad,#b0302a)" : "var(--ok-soft,#e3f2ea);color:var(--ok,#1d7a4a)");
    d.textContent = t; d.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { d.hidden = true; }, 3500); }
  function altSave() {
    const top = topLayer(), panel = [...document.querySelectorAll("[id^='p-']")].find(e => vis(e) && e.closest(".wrap")), scope = top || panel || document.body;
    const fixed = !top && panel && ({ "p-bill": "bsave", "p-ledger": "rsave" })[panel.id], btn = (fixed && vis($(fixed)) && $(fixed)) || pick(scope); /* Bill's button reads "Send on my WhatsApp" for an estimate - same as Ctrl + A */ if (!btn) { toast("No Save button on this screen.", true); return; }
    if (btn.disabled) { const w = why(btn, scope); if (w.e) { w.e.scrollIntoView({ block: "center", behavior: "smooth" }); w.e.style.outline = "2px solid var(--bad,#b0302a)"; setTimeout(() => { w.e.style.outline = ""; }, 2500); } toast(w.t, true); return; }
    if (!top && (btn.id === "bsave" || btn.id === "rsave") && window.VJ_SAVE_ASK) { window.VJ_SAVE_ASK(btn.id); return; } /* Bill / Ledger: same as Ctrl + A (then P print / W WhatsApp) */
    btn.scrollIntoView({ block: "nearest" }); btn.click();
  }
  // ---------- keys ----------
  window.addEventListener("keydown", e => {
    if (cbox) { if (!cbox.contains(e.target) && !(e.altKey && e.code === "KeyC")) return; e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); closeCalc(true); }
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); cbox._use(); }
      else if (e.key === "Enter") { e.preventDefault(); cbox._enter(); }
      else if (e.altKey && e.code === "KeyC") { e.preventDefault(); closeCalc(true); }
      return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === "KeyA") { /* owner 04/11 12:05: Ctrl + A = Save on every screen, like Tally (select-all stays only in the calculator and in multi-line notes) */
      if (window.VJ_KEYS_BUSY && window.VJ_KEYS_BUSY()) return; e.stopPropagation(); if (e.target && e.target.tagName === "TEXTAREA") return; e.preventDefault(); if (!e.repeat) altSave(); return; }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    if (e.code === "KeyC") { e.preventDefault(); e.stopPropagation(); openCalc(); }
    else if (e.code === "KeyA") { e.preventDefault(); e.stopPropagation(); if (!(window.VJ_KEYS_BUSY && window.VJ_KEYS_BUSY())) altSave(); }
  }, true);
  // ---------- hint at the foot of the page (+ 🧮 for phones) ----------
  function hint() { if ($("vjKeyHint")) return; const w = document.querySelector(".wrap") || document.body, p = document.createElement("p"); p.id = "vjKeyHint"; p.className = "hint";
    p.style.cssText = "margin:18px 0 8px;font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"; const t = document.createElement("span"); t.textContent = "Alt+C calculator · Ctrl+A save";
    const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = "🧮"; b.title = "Calculator (Alt + C)"; b.setAttribute("aria-label", "Calculator"); b.style.cssText = "padding:2px 10px;font-size:16px";
    b.addEventListener("mousedown", e => e.preventDefault()); b.addEventListener("click", openCalc); p.append(t, b); w.appendChild(p); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hint); else hint();
})();
