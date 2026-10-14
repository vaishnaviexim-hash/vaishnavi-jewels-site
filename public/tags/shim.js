/* VJ Tags (website) - gives the VJ Inventory page the same small runtime it has inside Claude
   (db, user, assets, downloads), backed by our own server at /api/vj/* (Cloudflare Access + D1 + R2).
   Brain C-20261013-VJTAGSWEB. The server checks the sign-in and the role on every call; nothing here is trusted. */
(function () {
  "use strict";
  // 14/10/2026: some sections use display:flex/grid, which overrides the hidden attribute - force it
  try { const st = document.createElement("style"); st.textContent = "[hidden]{display:none!important}"; document.head.appendChild(st); } catch (e) {}
  const cache = new Map();            // path -> {data, version}
  const docL = new Map();             // path -> Set(listener)
  const qL = new Set();               // {coll, filters, lim, next}
  let since = 0, me = null, ready = null, timer = null, failCount = 0;

  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const errOf = (code, message) => Object.assign(new Error(message || code), { code });

  async function api(path, opts) {
    const r = await fetch(path, Object.assign({ credentials: "same-origin", cache: "no-store" }, opts || {}));
    if (r.status === 401 || r.status === 403) { const j = await r.json().catch(() => ({})); throw errOf(j.error === "not allowed" ? "not_signed_in" : "not_granted", j.error || "not allowed"); }
    if (r.status === 409) { const j = await r.json().catch(() => ({})); throw errOf("conflict", j.error || "someone changed this first - reload"); }
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw errOf("http_" + r.status, j.error || ("server " + r.status)); }
    return r.json();
  }

  function snapDoc(path) {
    const e = cache.get(path);
    return { id: path.split("/").pop(), exists: !!e, data: () => e ? clone(e.data) : undefined };
  }
  function match(path, q) {
    if (!path.startsWith(q.coll + "/") || path.split("/").length !== q.coll.split("/").length + 1) return false;
    const d = cache.get(path).data;
    return q.filters.every(([f, op, v]) => {
      const x = d[f];
      switch (op) { case "==": return x === v; case "!=": return x !== v; case ">=": return x >= v; case ">": return x > v; case "<": return x < v; case "<=": return x <= v; case "in": return Array.isArray(v) && v.includes(x); default: return false; }
    });
  }
  function runQuery(q) {
    let ps = [...cache.keys()].filter(p => match(p, q)).sort();
    if (q.order) { const [f, dir] = q.order; ps.sort((a, b) => { const x = cache.get(a).data[f], y = cache.get(b).data[f]; return (x > y ? 1 : x < y ? -1 : 0) * (dir === "desc" ? -1 : 1); }); }
    ps = ps.slice(0, q.lim || 1000);
    return { docs: ps.map(snapDoc), size: ps.length, empty: !ps.length };
  }
  function notify(paths) {
    paths.forEach(p => (docL.get(p) || []).forEach(fn => { try { fn(snapDoc(p)); } catch (e) {} }));
    qL.forEach(q => { if (paths.some(p => p.startsWith(q.coll + "/"))) { try { q.next(runQuery(q)); } catch (e) {} } });
  }

  async function sync() {
    const j = await api("/api/vj/sync?since=" + since);
    me = j.me || me;
    const changed = [];
    (j.docs || []).forEach(d => { cache.set(d.path, { data: d.data, version: d.version }); changed.push(d.path); });
    (j.deleted || []).forEach(p => { if (cache.delete(p)) changed.push(p); });
    since = j.now || since;
    if (changed.length) notify(changed);
  }
  function loop() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (document.visibilityState === "visible") { try { await sync(); failCount = 0; } catch (e) { failCount++; } }
      loop();
    }, failCount ? Math.min(60000, 10000 * failCount) : 15000);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync().catch(() => {}); });
  function start() { if (!ready) ready = sync().then(() => { loop(); return true; }); return ready; }

  async function write(op, path, data, withVersion) {
    await start();
    const body = { op, path };
    if (data !== undefined) body.data = data;
    if (withVersion) { const e = cache.get(path); body.ifVersion = e ? e.version : 0; }
    try {
      const r = await api("/api/vj/write", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (op === "delete") cache.delete(path);
      else cache.set(path, { data: op === "update" ? Object.assign({}, (cache.get(path) || {}).data, data) : clone(data), version: r.version });
      notify([path]);
    } catch (e) { if (e.code === "conflict") sync().catch(() => {}); throw e; }
  }

  function doc(path) {
    return {
      path,
      get: async () => { await start(); return snapDoc(path); },
      set: d => write("set", path, d, true),
      update: d => write("update", path, d, false),
      delete: () => write("delete", path, undefined, true),
      onSnapshot(next) { if (!docL.has(path)) docL.set(path, new Set()); docL.get(path).add(next); start().then(() => next(snapDoc(path))).catch(() => {}); return () => docL.get(path).delete(next); },
      acquire: async () => ({ acquired: true, release: async () => {} }) // the server's version check stops two people taking the same number
    };
  }
  function query(coll, filters, lim, order) {
    const q = { coll, filters, lim, order };
    return {
      where: (f, op, v) => query(coll, filters.concat([[f, op, v]]), lim, order),
      orderBy: (f, dir) => query(coll, filters, lim, [f, dir || "asc"]),
      limit: n => query(coll, filters, n, order),
      get: async () => { await start(); return runQuery(q); },
      onSnapshot(next, err) { const h = Object.assign({}, q, { next }); qL.add(h); start().then(() => next(runQuery(h))).catch(e => err && err(e)); return () => qL.delete(h); },
      doc: id => doc(coll + "/" + id)
    };
  }
  const db = { doc, collection: c => query(c, [], 1000, null) };

  const user = {
    role: async () => { await start(); return me && me.role; },
    isOwner: async () => { await start(); return !!me && me.role === "admin"; },
    canEdit: async () => { await start(); return !!me && me.role === "admin"; },
    can: async () => { await start(); return !!me && me.role !== "sales"; },
    id: async () => { await start(); return me && me.email; },
    me: async () => { await start(); return { name: me ? (me.role === "admin" ? "Abhinav" : me.name + " · " + me.role) : "" }; },
    profiles: async ids => { const o = {}; (ids || []).forEach(i => { o[i] = { name: String(i).split("@")[0] }; }); return o; }
  };
  const assets = {
    upload: async (blob, opt) => {
      if (blob.size > 6e6) throw errOf("too_large");
      const r = await api("/api/vj/photo", { method: "POST", headers: { "content-type": (opt && opt.type) || blob.type || "image/jpeg" }, body: blob });
      return { id: r.id, url: r.url, sizeBytes: blob.size, contentType: (opt && opt.type) || blob.type };
    }
  };
  const downloads = {
    save: async ({ filename, data }) => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])); a.download = filename || "file";
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }
  };
  // Photo search: the page asks with a prompt + images; only the lost-piece photo and the candidate ids are sent -
  // the server loads the saved photos and writes the prompt itself.
  const blobB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); });
  const sample = {
    limits: async () => { const row = document.getElementById("fphotoRow"); if (row) row.hidden = false; return { images: { maxCount: 10 } }; },
    json: async (prompt, opt) => {
      const imgs = (opt && opt.images) || [], ids = [...String(prompt).matchAll(/image \d+ = ([A-Za-z0-9_\-.~]+)/g)].map(m => m[1]);
      if (!imgs[0] || !ids.length) return { matches: [] };
      try { return await api("/api/vj/photosearch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ photo: await blobB64(imgs[0]), type: imgs[0].type || "image/jpeg", ids }) }); }
      catch (e) { throw errOf(e.code === "http_429" ? "rate_limited" : (e.message || e.code)); }
    }
  };
  const caps = { db, user, assets, downloads, sample };
  window.VJ_WEBSITE = true;
  window.claude = Object.freeze({
    use: async name => {
      if (!(name in caps)) return null;
      try { await start(); } catch (e) { window.VJ_SIGNIN_ERROR = e; return null; }
      if ((name === "assets" || name === "sample") && me && me.role === "sales") return null;
      return caps[name];
    }
  });
})();
