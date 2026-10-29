/* VJ Tags - box numbers (owner 29/10/2026, C-20261029-BOXNO). The owner's box sheets in Drive are flattened into
   Box_Map (VJ_Marketing_Engine); /api/vj/boxes hands them out. window.VJ_BOX(tag) -> "Box 31" (or "Box 31 / 33"), or "". */
(() => {
  "use strict";
  const ALT = { VNS: ["CH"], CH: ["VNS"], VBN: ["VBR"], VBR: ["VBN"], VP: ["VPS"], VPS: ["VP", "VER"] };
  let M = null; // { CAT: { DESIGN: [box, ...] } }
  const key = v => String(v == null ? "" : v).toUpperCase().replace(/[\s\-_.]/g, "");
  function parse(s) {
    const m = {};
    String(s || "").split("|").forEach(part => {
      const i = part.indexOf(":"); if (i < 1) return;
      const cat = part.slice(0, i), d = m[cat] || (m[cat] = {});
      part.slice(i + 1).split(";").forEach(g => {
        const j = g.indexOf("="); if (j < 1) return;
        const box = +g.slice(0, j); if (!box) return;
        g.slice(j + 1).split(",").forEach(c => { const k = key(c); if (!k) return; const a = d[k] || (d[k] = []); if (!a.includes(box)) a.push(box); });
      });
    });
    return m;
  }
  function find(t) {
    if (!M || !t || !t.designNo) return null;
    const k = key(t.designNo); if (!k) return null;
    const own = M[t.cat] && M[t.cat][k]; if (own) return own;
    for (const c of ALT[t.cat] || []) if (M[c] && M[c][k]) return M[c][k];
    const hits = Object.keys(M).filter(c => M[c][k]);
    return hits.length === 1 ? M[hits[0]][k] : null;
  }
  window.VJ_BOX = t => { const b = find(t); return b ? "Box " + b.slice().sort((x, y) => x - y).join(" / ") : ""; };
  window.VJ_BOX_COUNT = () => M ? Object.values(M).reduce((n, d) => n + Object.keys(d).length, 0) : 0;
  async function load(fresh) {
    try {
      const r = await fetch("/api/vj/boxes" + (fresh ? "?fresh=1" : ""), { credentials: "same-origin" });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.map) { M = parse(j.map); document.dispatchEvent(new CustomEvent("vj-boxes")); }
    } catch (e) {}
  }
  window.VJ_BOX_RELOAD = () => load(true);
  load(false);
})();
