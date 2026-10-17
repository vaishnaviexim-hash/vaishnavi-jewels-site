/* VJ Tags - customer recall (owner Abhinav 17/10/2026, C-20261017-PARTY).
   On New tag (order), Bill, Ledger receipt and Quote: type a mobile number and the name and city fill in; type part of a name and pick
   the party from a short list. Data comes from /api/vj/parties (logged-in users only); fields already typed are not overwritten
   by the mobile lookup, a picked name fills all three. */
(function () {
  "use strict";
  const SETS = [["oName", "oMob", "oCity"], ["bname", "bmob", "bcity"], ["rname", "rmob", "rcity"], ["qname", "qmob", "qcity"]]; // + Quote tab, both choices (C-20261017-QUOTEMODES)
  const $ = id => document.getElementById(id);
  let box = null, timer = 0, seq = 0;
  const digits = v => String(v || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const fire = el => el.dispatchEvent(new Event("input", { bubbles: true }));
  const setOf = id => SETS.find(s => s.includes(id));
  async function look(q) { const n = ++seq; try { const r = await fetch("/api/vj/parties?q=" + encodeURIComponent(q), { credentials: "same-origin", cache: "no-store" }); const j = await r.json(); return n === seq && r.ok ? (j.parties || []) : null; } catch (e) { return null; } }
  function close() { if (box) { box.remove(); box = null; } }
  function fill(set, p, all) { const [n, m, c] = set.map($); if (!n) return;
    if (all || !n.value.trim()) { n.value = p.name; fire(n); }
    if (all || !m.value.trim()) { m.value = /^\d{10}$/.test(p.mobile || "") ? p.mobile : (p.mobile || ""); fire(m); }
    if (c && (all || !c.value.trim()) && p.city) { c.value = p.city; fire(c); } }
  function show(input, set, list) { close(); if (!list.length) return;
    const r = input.getBoundingClientRect(); box = document.createElement("div");
    box.style.cssText = `position:absolute;z-index:9999;left:${r.left + scrollX}px;top:${r.bottom + scrollY + 2}px;min-width:${Math.max(r.width, 260)}px;max-width:420px;background:#fff;border:1px solid #c9b98f;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.15);font-size:15px`;
    list.forEach(p => { const b = document.createElement("button"); b.type = "button";
      b.style.cssText = "display:block;width:100%;text-align:left;padding:9px 12px;border:0;background:none;cursor:pointer;color:#222";
      b.textContent = p.name + (p.city ? " · " + p.city : "") + (p.mobile ? " · " + (/^\d{10}$/.test(p.mobile) ? "+91 " + p.mobile : p.mobile) : "");
      b.addEventListener("mousedown", e => { e.preventDefault(); fill(set, p, true); close(); }); box.appendChild(b); });
    document.body.appendChild(box); }
  document.addEventListener("input", e => {
    const t = e.target; if (!e.isTrusted || !t || !t.id) return; const set = setOf(t.id); if (!set) return;
    clearTimeout(timer);
    if (t.id === set[1]) { close(); const d = digits(t.value); if (d.length !== 10) return;
      timer = setTimeout(async () => { const l = await look(d); const p = l && l.find(x => digits(x.mobile) === d); if (p) fill(set, p, false); }, 250); return; }
    if (t.id === set[0]) { const q = t.value.trim(); if (q.length < 2) { close(); return; }
      timer = setTimeout(async () => { const l = await look(q); if (l && document.activeElement === t) show(t, set, l); }, 250); }
  });
  document.addEventListener("focusout", e => { if (e.target && setOf(e.target.id || "")) setTimeout(close, 150); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();
