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
  document.addEventListener("keydown", e => {
    if (box) { const k = e.key.toLowerCase(); if (k === "escape") { close(); e.preventDefault(); } else if (box._keys[k]) { e.preventDefault(); const f = box._keys[k]; close(); f(); } return; }
    if (!(e.ctrlKey || e.metaKey) || e.altKey || !(e.key === "a" || e.key === "A" || e.key === "Enter")) return;
    if (vis("p-bill")) { e.preventDefault(); saveThenAsk("bsave", "bout", "bmsg", "Bill saved"); return; }
    if (vis("p-ledger")) { e.preventDefault(); saveThenAsk("rsave", "rout", "rmsg", "Receipt saved"); return; }
    if (vis("p-new") && $("save")) { e.preventDefault(); if (!$("save").disabled) $("save").click(); }
  }, true);
})();
