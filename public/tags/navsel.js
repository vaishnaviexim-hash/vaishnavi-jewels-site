/* VJ Tags - one drop-down list to choose the section (owner Abhinav 30/10/2026 15:17, C-20261030-TAGSDROPDOWN).
   The row of tab buttons stays in the page (every section script still adds its own button and listens to its clicks) but is
   hidden; this list mirrors those buttons in the owner's order and "clicks" the chosen one, so every section, deep link (#TAG-ID)
   and role rule (hidden buttons) keeps working exactly as before. Opens on New tag (nothing remembered). */
(function () {
  "use strict";
  const ORDER = ["new", "check", "orders", "kdues", "list", "find", "bill", "vchain", "ledger", "quote", "karigar", "rates"];
  const rank = b => { const i = ORDER.indexOf(b.dataset.tab); return i >= 0 ? i : ORDER.indexOf("rates") - 0.5; };
  let nav = null, sel = null, ph = null, queued = false;

  function style() {
    const s = document.createElement("style");
    s.textContent = "nav[role=tablist].vjsel{display:none!important}" +
      ".vjnav{display:flex;align-items:center;gap:10px;margin-block:14px;flex-wrap:wrap}" +
      ".vjnav .vjlab{font-size:13px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;font-weight:600}" +
      ".vjnav .vjwrap{position:relative;flex:1 1 260px;max-width:420px;min-width:0}" +
      ".vjnav .vjwrap::after{content:'';position:absolute;right:18px;top:50%;width:8px;height:8px;border-right:2px solid var(--bg);border-bottom:2px solid var(--bg);transform:translateY(-70%) rotate(45deg);pointer-events:none}" +
      ".vjnav select{appearance:none;-webkit-appearance:none;width:100%;font:inherit;font-size:16px;font-weight:600;background:var(--fg);color:var(--bg);border:1px solid var(--fg);border-radius:999px;padding:10px 44px 10px 18px;cursor:pointer}" +
      ".vjnav select option{background:var(--surface);color:var(--fg);font-weight:500}";
    document.head.appendChild(s);
  }
  function buttons() { return [...nav.querySelectorAll("button[data-tab]")].filter(b => !b.hidden).sort((a, b) => rank(a) - rank(b)); }
  function sync() {
    queued = false; if (!nav || !sel) return;
    const bs = buttons(), sig = bs.map(b => b.dataset.tab + "|" + b.textContent.trim()).join(";");
    if (sel.dataset.sig !== sig) {
      sel.textContent = ""; ph = new Option("", ""); ph.disabled = true; ph.hidden = true; sel.appendChild(ph);
      bs.forEach(b => sel.appendChild(new Option(b.textContent.trim(), b.dataset.tab)));
      sel.dataset.sig = sig;
    }
    const on = bs.find(b => b.getAttribute("aria-selected") === "true");
    if (on) sel.value = on.dataset.tab;
    else { const pb = document.getElementById("p-bill"); ph.textContent = pb && !pb.hidden ? "Bill / estimate (open)" : "Choose…"; sel.selectedIndex = 0; }
  }
  const later = () => { if (!queued) { queued = true; setTimeout(sync, 0); } };
  function build() {
    if (sel) return;
    nav = document.querySelector("nav[role=tablist]"); if (!nav) return;
    style();
    sel = document.createElement("select"); sel.id = "navSel"; sel.setAttribute("aria-label", "Section");
    const wrap = document.createElement("div"); wrap.className = "vjwrap"; wrap.appendChild(sel);
    const lab = document.createElement("label"); lab.className = "vjlab"; lab.htmlFor = "navSel"; lab.textContent = "Section";
    const box = document.createElement("div"); box.className = "vjnav"; box.append(lab, wrap);
    nav.after(box); nav.classList.add("vjsel");
    sel.addEventListener("change", () => {
      const v = sel.value; if (!v) return;
      const b = [...nav.querySelectorAll("button[data-tab]")].find(x => x.dataset.tab === v);
      if (b) b.click(); later();
    });
    new MutationObserver(later).observe(nav, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-selected", "hidden"] });
    document.addEventListener("click", later, true);
    sync();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
