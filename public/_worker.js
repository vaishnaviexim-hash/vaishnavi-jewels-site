// Pages advanced-mode worker. Only /hooks/*, /tags*, /api/vj/* and /_blob/* reach it (see _routes.json); everything else is served as static files.
// Secrets added in Cloudflare 09/10/2026 18:07 IST.
// WhatsApp webhook filter (Brain C-20261009-WAFILTER).
// Checks Meta's signature, drops sent/delivered/read receipts (no Make credits),
// forwards real messages and failed-delivery receipts to the Make A1 webhook unchanged.
// Secrets are Cloudflare Pages encrypted variables only: META_APP_SECRET, META_VERIFY_TOKEN, MAKE_A1_HOOK.
const enc = new TextEncoder();

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const NO_STORE = { 'content-type': 'text/plain', 'cache-control': 'no-store' };
const reply = (text, status) => new Response(text, { status, headers: NO_STORE });

async function onGet(request, env) {
  const u = new URL(request.url);
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token') || '';
  const ch = u.searchParams.get('hub.challenge') || '';
  if (mode === 'subscribe' && env.META_VERIFY_TOKEN && env.META_VERIFY_TOKEN.length >= 16 &&
      safeEq(token, env.META_VERIFY_TOKEN) && /^[A-Za-z0-9_-]{1,200}$/.test(ch)) {
    return reply(ch, 200);
  }
  return reply('Forbidden', 403);
}

async function onPost(request, env) {
  if (!env.META_APP_SECRET || !env.MAKE_A1_HOOK) return reply('Not configured', 503);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 1000000) return reply('Too large', 413);
  const buf = await request.arrayBuffer();
  if (buf.byteLength > 1000000) return reply('Too large', 413);

  const sigHdr = request.headers.get('x-hub-signature-256') || '';
  const expected = 'sha256=' + await hmacHex(env.META_APP_SECRET, buf);
  if (!safeEq(sigHdr, expected)) return reply('Forbidden', 403);

  let body;
  try { body = JSON.parse(new TextDecoder().decode(buf)); } catch (e) { return reply('OK', 200); }

  const values = [];
  for (const e of (body && body.entry) || []) for (const c of (e && e.changes) || []) if (c && c.value) values.push(c.value);
  const hasMsg = values.some(v => Array.isArray(v.messages) && v.messages.length);
  const hasFail = values.some(v => Array.isArray(v.statuses) && v.statuses.some(s => s && s.status === 'failed'));
  if (!hasMsg && !hasFail) return reply('OK', 200); // plain receipt: stop here, costs nothing

  try {
    const r = await fetch(env.MAKE_A1_HOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': sigHdr },
      body: buf,
      signal: AbortSignal.timeout(9000),
    });
    return reply('OK', r.ok ? 200 : 502); // 502 makes Meta retry later
  } catch (e) {
    return reply('Upstream error', 502);
  }
}

// ---------------------------------------------------------------------------------------------
// VJ Tags - staff stock tagging on our own website (Brain C-20261013-VJTAGSWEB, rules R-093..R-096).
// Security (owner rule: build everything security-first):
//  1. Cloudflare Access sits in front of /tags*, /api/vj/* and /_blob/* (only owner-approved emails, one-time code).
//  2. This worker checks the Access token AGAIN on every request (signature, audience, issuer, expiry) and
//     looks up the person's role: admin (owner emails) / staff / sales. Anyone else gets 403.
//  3. Only vaishnavijewels.com is served (the *.pages.dev preview copies refuse).
//  4. Writes are checked on the server: path allow-list, size cap, version check (no silent overwrite),
//     staff may only change photo / price-code / print-queue fields of an existing piece, only the owner
//     changes settings or deletes. Every write is logged (audit table) with the person's email.
//  5. No cost price is ever stored (F-025). Stock data lives in D1 + R2 in the owner's Cloudflare account,
//     never in the public website files or on GitHub.
// Bindings / variables (set in Cloudflare Pages > Settings): DB (D1), PHOTOS (KV namespace or R2 bucket), ACCESS_TEAM, ACCESS_AUD,
// OWNER_EMAILS (comma list), GOLD_PUSH_SECRET (encrypted), VJ_GOLD_HOOK (encrypted, gold relay), ANTHROPIC_API_KEY (encrypted, photo search), VJ_QUOTE_HOOK (encrypted, quote follow-up). ACCESS_CERTS_URL / VJ_DEV only for local tests.
// ---------------------------------------------------------------------------------------------
const VJ_HOST = 'vaishnavijewels.com';
const VJ_JSON_H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
const vjJson = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: VJ_JSON_H });
const vjDeny = (s, m) => vjJson({ error: m || 'forbidden' }, s);

const b64uBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const b64uJson = s => JSON.parse(new TextDecoder().decode(b64uBytes(s)));
let vjCerts = { at: 0, keys: null };

async function vjAccessKeys(env) {
  if (vjCerts.keys && Date.now() - vjCerts.at < 3600e3) return vjCerts.keys;
  const url = (env.VJ_DEV === '1' && env.ACCESS_CERTS_URL) ? env.ACCESS_CERTS_URL : `https://${env.ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('certs');
  const j = await r.json();
  vjCerts = { at: Date.now(), keys: j.keys || [] };
  return vjCerts.keys;
}

// Returns the verified, lower-case email, or null.
async function vjVerifyAccess(request, env) {
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return null;
  let tok = request.headers.get('cf-access-jwt-assertion') || '';
  if (!tok) { const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)CF_Authorization=([^;]+)/); if (m) tok = m[1]; }
  const parts = tok.split('.');
  if (parts.length !== 3 || tok.length > 8000) return null;
  let head, pay;
  try { head = b64uJson(parts[0]); pay = b64uJson(parts[1]); } catch (e) { return null; }
  if (head.alg !== 'RS256' || !head.kid) return null;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(pay.aud) ? pay.aud : [pay.aud];
  const iss = (env.VJ_DEV === '1' && env.ACCESS_ISS) ? env.ACCESS_ISS : `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
  if (!aud.includes(env.ACCESS_AUD) || pay.iss !== iss || !(pay.exp > now) || (pay.nbf && pay.nbf > now + 60)) return null;
  let keys; try { keys = await vjAccessKeys(env); } catch (e) { return null; }
  const jwk = keys.find(k => k.kid === head.kid);
  if (!jwk) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
  } catch (e) { return null; }
  const email = String(pay.email || '').trim().toLowerCase();
  return /^[^@\s]{1,64}@[^@\s]{1,190}$/.test(email) ? email : null;
}

async function vjWho(request, env) {
  const email = await vjVerifyAccess(request, env);
  if (!email) return null;
  const owners = String(env.OWNER_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  if (owners.includes(email)) return { email, role: 'admin', name: 'Owner' };
  const row = await env.DB.prepare('SELECT role, name FROM users WHERE email = ?').bind(email).first();
  if (!row || !['staff', 'sales'].includes(row.role)) return null;
  return { email, role: row.role, name: row.name || email };
}

const VJ_PATH = /^(tags\/[A-Za-z0-9_\-.~]{1,60}|settings\/main|counters\/main)$/;
// What staff may change on a piece that already exists (photo, price code fixed at first print, print queue).
const VJ_STAFF_FIELDS = new Set(['photo', 'photoAt', 'photoBy', 'code', 'priceAtTag', 'gold24gAtTag', 'queue', 'queueAt', 'printedAt']);

async function vjAudit(env, who, action, path, detail) {
  try { await env.DB.prepare('INSERT INTO audit (ts, email, action, path, detail) VALUES (?, ?, ?, ?, ?)').bind(Date.now(), who.email, action, path || '', String(detail || '').slice(0, 500)).run(); } catch (e) {}
}

// Owner 16/10/2026 (C-20261016-TAGSDELETE): a tag is deleted only by an owner (Abhinav or Shilpiji = OWNER_EMAILS), only with
// one of these reasons (F-069), and a full copy of the deleted tag is kept in vj_deleted - for every reason - so nothing is lost.
// vj_changes keeps old -> new for every field edited on a tag (staff and owner), for the evening Excel.
const VJ_DEL_REASONS = ['Sold', 'Melted or broken', 'Approval', 'Wrong entry'];
let vjTablesOk = false;
async function vjTables(env) {
  if (vjTablesOk) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_deleted (ts INTEGER, email TEXT, path TEXT, reason TEXT, data TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_changes (ts INTEGER, email TEXT, path TEXT, field TEXT, old TEXT, new TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS vj_changes_ts ON vj_changes (ts)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS vj_deleted_ts ON vj_deleted (ts)')]);
  vjTablesOk = true;
}
const vjStr = v => v === undefined ? '' : JSON.stringify(v);

// Gold rate: 24K per g from NR Jewellers 'GOLD 999 IMP T+2' sell (per 10 g), same as the 3-a-day task.
async function vjGoldFromFeed() {
  const r = await fetch('https://bcast.nrjewellers.com:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/nrjewellers', { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('feed ' + r.status);
  const line = (await r.text()).split(/\r?\n/).find(l => /GOLD 999 IMP T\+2/i.test(l));
  const per10 = line ? parseFloat(String(line.split('\t')[3] || '').replace(/,/g, '')) : NaN;
  if (!(per10 >= 50000 && per10 <= 400000)) throw new Error('feed value out of range');
  return per10;
}
async function vjSaveGold(env, per10, source) {
  const row = await env.DB.prepare("SELECT data, version FROM docs WHERE path = 'settings/main'").first();
  const cur = row ? JSON.parse(row.data) : {};
  const old = cur.gold24g || 0, g = Math.round(per10) / 10;
  const next = Object.assign({}, cur, { gold24g: g, goldAt: new Date().toISOString(), goldSource: source });
  if (old && Math.abs(g - old) / old >= 0.03) next.goldAlert = `Moved ${(100 * (g - old) / old).toFixed(1)}% from ${old} at ${next.goldAt}`;
  const v = row ? row.version + 1 : 1;
  await env.DB.prepare('INSERT INTO docs (path, data, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at, updated_by = excluded.updated_by')
    .bind('settings/main', JSON.stringify(next), v, Date.now(), 'gold-feed').run();
}
// 14/10/2026 owner: "gold rates not auto updated". Cloudflare cannot reach the NR feed (port 7768), so the scheduled gold
// tasks (Mon-Fri 13:00, 15:30, 17:00 + Fri 20:00 IST) put the NR rate in the Make data store VJ_Gold, and the website collects it here
// through the Make relay VJ_GOLD_HOOK (encrypted variable; the relay only returns {per10g, at}). It asks a few minutes after
// each task time, only if nobody saved a rate since then, at most once every 10 minutes - a few Make operations a day.
// A rate typed by the owner after the task time is never overwritten.
let vjGoldAskedAt = 0;
async function vjMaybeRefreshGold(env) {
  if (!env.VJ_GOLD_HOOK || !/^https:\/\/hook\.[a-z0-9]+\.make\.com\//.test(env.VJ_GOLD_HOOK)) return;
  // 14/10/2026 owner: market days are Monday-Friday only; Friday has a last rate at 8 pm. So the tasks run Mon-Fri 13:00,
  // 15:30, 17:00 and Fri 20:00 IST. Find the latest task time (looking back up to 3 days, so Sat/Sun/Monday morning still
  // pick up Friday 8 pm).
  if (Date.now() - vjGoldAskedAt < 10 * 60e3) return;
  const ist = new Date(Date.now() + 5.5 * 3600e3), m = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  let slotAt = 0;
  for (let back = 0; back <= 3 && !slotAt; back++) {
    const d = (ist.getUTCDay() - back + 7) % 7;
    if (d === 0 || d === 6) continue;
    const slots = [13 * 60 + 4, 15 * 60 + 36, 17 * 60 + 4].concat(d === 5 ? [20 * 60 + 4] : []).filter(s => back > 0 || s <= m);
    if (slots.length) slotAt = Date.now() - (back * 1440 + m - slots[slots.length - 1]) * 60e3;
  }
  if (!slotAt) return;
  const row = await env.DB.prepare("SELECT data FROM docs WHERE path = 'settings/main'").first();
  const goldAt = row ? Date.parse(JSON.parse(row.data).goldAt || 0) || 0 : 0;
  if (goldAt >= slotAt) return;
  vjGoldAskedAt = Date.now();
  try {
    const r = await fetch(env.VJ_GOLD_HOOK, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const per10 = Number(j && j.per10g), at = Date.parse(j && j.at) || 0;
    if (per10 >= 50000 && per10 <= 400000 && at > goldAt && Date.now() - at < 80 * 3600e3)
      await vjSaveGold(env, per10, `NR Jewellers GOLD 999 IMP T+2 sell ${per10} per 10 g (scheduled task ${new Date(at + 5.5 * 3600e3).toISOString().slice(11, 16)} IST)`);
  } catch (e) {}
}

async function vjSync(request, env, who, ctx) {
  ctx.waitUntil(vjMaybeRefreshGold(env));
  const since = Math.max(0, Number(new URL(request.url).searchParams.get('since')) || 0);
  const now = Date.now();
  const docs = (await env.DB.prepare('SELECT path, data, version, updated_at FROM docs WHERE updated_at > ? ORDER BY updated_at').bind(since).all()).results || [];
  const del = since ? ((await env.DB.prepare('SELECT path FROM tomb WHERE deleted_at > ?').bind(since).all()).results || []).map(r => r.path) : [];
  const out = docs.map(r => {
    const data = JSON.parse(r.data);
    if (who.role === 'sales' && (r.path === 'counters/main' || r.path.startsWith('quotes/'))) return null;
    return { path: r.path, data, version: r.version };
  }).filter(Boolean);
  // 'now - 2000' so a write landing in the same millisecond is never missed on the next poll
  return vjJson({ now: now - 2000, docs: out, deleted: del, me: { email: who.email, role: who.role, name: who.name } });
}

async function vjWrite(request, env, who) {
  if (who.role === 'sales') return vjDeny(403, 'read only');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 70000) return vjDeny(413, 'too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  const { op, path, data } = b || {};
  const ifv = b && Number.isInteger(b.ifVersion) ? b.ifVersion : null;
  if (!['set', 'update', 'delete'].includes(op) || typeof path !== 'string' || !VJ_PATH.test(path)) return vjDeny(400, 'bad request');
  if (op !== 'delete' && (!data || typeof data !== 'object' || Array.isArray(data))) return vjDeny(400, 'bad data');
  if (path === 'settings/main' && who.role !== 'admin') return vjDeny(403, 'owner only');
  if (op === 'delete' && who.role !== 'admin') return vjDeny(403, 'owner only');
  const row = await env.DB.prepare('SELECT data, version FROM docs WHERE path = ?').bind(path).first();
  if (ifv === null && row && op !== 'update') return vjDeny(409, 'version required');
  if (ifv !== null && (row ? row.version : 0) !== ifv) return vjJson({ error: 'conflict', version: row ? row.version : 0 }, 409);
  if (op === 'delete') {
    if (!row) return vjJson({ ok: true });
    const isTag = path.startsWith('tags/');
    const reason = isTag && data && typeof data === 'object' ? String(data.reason || '') : '';
    if (isTag && !VJ_DEL_REASONS.includes(reason)) return vjDeny(400, 'reason required');
    const now = Date.now(), stmts = [env.DB.prepare('DELETE FROM docs WHERE path = ?').bind(path),
      env.DB.prepare('INSERT INTO tomb (path, deleted_at) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET deleted_at = excluded.deleted_at').bind(path, now)];
    if (isTag) { await vjTables(env); stmts.unshift(env.DB.prepare('INSERT INTO vj_deleted (ts, email, path, reason, data) VALUES (?, ?, ?, ?, ?)').bind(now, who.email, path, reason, row.data)); }
    await env.DB.batch(stmts); // the copy and the delete succeed or fail together
    await vjAudit(env, who, 'delete', path, (reason ? reason + ' | ' : '') + row.data.slice(0, 300));
    return vjJson({ ok: true });
  }
  const cur = row ? JSON.parse(row.data) : null;
  let next = op === 'update' ? Object.assign({}, cur || {}, data) : data;
  if (op === 'update' && !cur) return vjDeny(404, 'not found');
  if (who.role === 'staff' && cur && path.startsWith('tags/')) {
    for (const k of new Set([...Object.keys(cur), ...Object.keys(next)])) {
      if (!VJ_STAFF_FIELDS.has(k) && JSON.stringify(cur[k]) !== JSON.stringify(next[k])) return vjDeny(403, 'staff cannot change ' + k);
    }
  }
  if (path.startsWith('tags/')) {
    for (const k of ['costPrice', 'cost', 'mrp', 'purchase']) delete next[k]; // F-025: never store cost prices
    if (!cur) next.createdBy = who.email;
  }
  const s = JSON.stringify(next);
  if (s.length > 64000) return vjDeny(413, 'too large');
  const v = row ? row.version + 1 : 1;
  const res = await env.DB.prepare(row
    ? 'UPDATE docs SET data = ?, version = ?, updated_at = ?, updated_by = ? WHERE path = ? AND version = ?'
    : 'INSERT INTO docs (path, data, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(path) DO NOTHING')
    .bind(...(row ? [s, v, Date.now(), who.email, path, row.version] : [path, s, v, Date.now(), who.email])).run();
  if (!res.meta || res.meta.changes !== 1) return vjJson({ error: 'conflict' }, 409);
  await env.DB.prepare('DELETE FROM tomb WHERE path = ?').bind(path).run();
  await vjAudit(env, who, row ? op : 'create', path, op === 'update' ? Object.keys(data).join(',') : '');
  if (cur && path.startsWith('tags/')) {
    try {
      await vjTables(env);
      const ts = Date.now(), st = [];
      for (const k of new Set([...Object.keys(cur), ...Object.keys(next)])) {
        const a = vjStr(cur[k]), z = vjStr(next[k]);
        if (a !== z && st.length < 40) st.push(env.DB.prepare('INSERT INTO vj_changes (ts, email, path, field, old, new) VALUES (?, ?, ?, ?, ?, ?)').bind(ts, who.email, path, k.slice(0, 40), a.slice(0, 400), z.slice(0, 400)));
      }
      if (st.length) await env.DB.batch(st);
    } catch (e) {} // the change log never blocks a save
  }
  return vjJson({ ok: true, version: v });
}

// Photos live in PHOTOS: a Workers KV namespace (free, no card needed) or an R2 bucket - both work.
const vjIsR2 = env => typeof env.PHOTOS.head === 'function';
async function vjPhotoHas(env, id) { return vjIsR2(env) ? !!(await env.PHOTOS.head(id)) : (await env.PHOTOS.get(id, 'stream')) !== null; }
async function vjPhotoPut(env, id, bytes, type, meta) {
  if (vjIsR2(env)) return env.PHOTOS.put(id, bytes, { httpMetadata: { contentType: type }, customMetadata: meta });
  return env.PHOTOS.put(id, bytes, { metadata: Object.assign({ type }, meta) });
}
async function vjPhotoGet(env, id) {
  if (vjIsR2(env)) { const o = await env.PHOTOS.get(id); return o ? { body: o.body, type: o.httpMetadata && o.httpMetadata.contentType } : null; }
  const o = await env.PHOTOS.getWithMetadata(id, 'stream'); return o && o.value ? { body: o.value, type: o.metadata && o.metadata.type } : null;
}

async function vjPhotoUpload(request, env, who) {
  if (who.role === 'sales') return vjDeny(403, 'read only');
  const type = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return vjDeny(415, 'jpg, png or webp only');
  const buf = await request.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > 6e6) return vjDeny(413, 'photo too large');
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  await vjPhotoPut(env, id, buf, type, { by: who.email, at: new Date().toISOString() });
  await vjAudit(env, who, 'photo', id, String(buf.byteLength));
  return vjJson({ id, url: '/_blob/' + id });
}

async function vjBlob(id, env) {
  if (!/^[0-9a-f]{32}$/.test(id)) return vjDeny(404, 'not found');
  const o = await vjPhotoGet(env, id);
  if (!o) return vjDeny(404, 'not found');
  return new Response(o.body, { headers: { 'content-type': /^image\/(jpeg|png|webp)$/.test(o.type || '') ? o.type : 'image/jpeg', 'cache-control': 'private, max-age=86400', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff' } });
}

// Make pushes the gold rate here 3 times a day if the website cannot reach the NR feed itself.
async function vjGoldPush(request, env) {
  const sec = request.headers.get('x-vj-gold-secret') || '';
  if (!env.GOLD_PUSH_SECRET || env.GOLD_PUSH_SECRET.length < 24 || !safeEq(sec, env.GOLD_PUSH_SECRET)) return vjDeny(403);
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400); }
  const per10 = Number(b && b.per10g);
  if (!(per10 >= 50000 && per10 <= 400000)) return vjDeny(400, 'out of range');
  await vjSaveGold(env, per10, String(b.source || 'NR Jewellers (Make push)').slice(0, 120));
  return vjJson({ ok: true });
}

// One-time move from VJ Inventory (owner only): documents + photos keep their ids. New rows only, never overwrites,
// unless 'replace' is true (first load into an empty database).
async function vjImport(request, env, who) {
  if (who.role !== 'admin') return vjDeny(403, 'owner only');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 8e6) return vjDeny(413, 'too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  const docs = Array.isArray(b && b.docs) ? b.docs.slice(0, 300) : [], photos = Array.isArray(b && b.photos) ? b.photos.slice(0, 20) : [];
  const now = Date.now(), stmts = [];
  for (const d of docs) {
    if (!d || typeof d.path !== 'string' || !VJ_PATH.test(d.path) || !d.data || typeof d.data !== 'object') continue;
    const data = Object.assign({}, d.data); for (const k of ['costPrice', 'cost', 'mrp', 'purchase']) delete data[k];
    const s = JSON.stringify(data); if (s.length > 64000) continue;
    stmts.push(env.DB.prepare(b.replace === true
      ? 'INSERT INTO docs (path, data, version, updated_at, updated_by) VALUES (?, ?, 1, ?, ?) ON CONFLICT(path) DO UPDATE SET data = excluded.data, version = docs.version + 1, updated_at = excluded.updated_at, updated_by = excluded.updated_by'
      : 'INSERT INTO docs (path, data, version, updated_at, updated_by) VALUES (?, ?, 1, ?, ?) ON CONFLICT(path) DO NOTHING').bind(d.path, s, now, 'import:' + who.email));
  }
  if (stmts.length) await env.DB.batch(stmts);
  let ph = 0;
  for (const p of photos) {
    if (!p || !/^[0-9a-f]{32}$/.test(p.id) || typeof p.b64 !== 'string' || p.b64.length > 8e6) continue;
    if (await vjPhotoHas(env, p.id)) continue;
    const bytes = Uint8Array.from(atob(p.b64), c => c.charCodeAt(0));
    await vjPhotoPut(env, p.id, bytes, /^image\/(jpeg|png|webp)$/.test(p.type) ? p.type : 'image/jpeg', { by: 'import', at: new Date().toISOString() });
    ph++;
  }
  await vjAudit(env, who, 'import', '', `docs ${stmts.length}, photos ${ph}`);
  return vjJson({ ok: true, docs: stmts.length, photos: ph });
}

// Photo search (owner 14/10/2026, C-20261013-PHOTOSEARCH on the website): staff send ONE photo of a piece whose tag is lost
// and up to 9 candidate piece ids; the server loads the candidates' saved photos itself, builds a fixed prompt and asks Claude
// (key ANTHROPIC_API_KEY, encrypted Pages secret, never sent to the browser). Not a general AI proxy: the prompt is fixed here.
// Limit 30 searches a day for everyone together; each search is logged in audit.
const VJ_PS_MODEL = 'claude-sonnet-5-5', VJ_PS_DAY = 150; // 14/10: 150 Claude calls a day (one photo search of ~200 pieces = about 9 small calls)
function vjB64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); }
async function vjPhotoSearch(request, env, who) {
  if (who.role === 'sales') return vjDeny(403, 'read only');
  if (!env.ANTHROPIC_API_KEY) return vjDeny(503, 'photo search is not set up');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 6e6) return vjDeny(413, 'photo too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  if (b && Array.isArray(b.sheets)) return vjPhotoSheets(b, env, who);
  const photo = b && typeof b.photo === 'string' ? b.photo : '', type = /^image\/(jpeg|png|webp)$/.test(b && b.type) ? b.type : 'image/jpeg';
  const ids = Array.isArray(b && b.ids) ? b.ids.filter(x => typeof x === 'string' && /^[A-Za-z0-9_\-.~]{1,60}$/.test(x)).slice(0, 9) : [];
  if (!photo || photo.length > 2.8e6 || !/^[A-Za-z0-9+/=]+$/.test(photo) || !ids.length) return vjDeny(400, 'bad request');
  const since = Date.now() - 24 * 3600e3;
  const used = await env.DB.prepare("SELECT count(*) AS n FROM audit WHERE action = 'photosearch' AND ts > ?").bind(since).first();
  if (used && used.n >= VJ_PS_DAY) return vjDeny(429, 'daily limit reached (' + VJ_PS_DAY + ' searches in 24 hours)');
  const content = [{ type: 'image', source: { type: 'base64', media_type: type, data: photo } }], ok = [];
  for (const id of ids) {
    const row = await env.DB.prepare('SELECT data FROM docs WHERE path = ?').bind('tags/' + id).first();
    const pid = row ? JSON.parse(row.data).photo : null;
    if (!pid || !/^[0-9a-f]{32}$/.test(pid)) continue;
    const o = await vjPhotoGet(env, pid); if (!o) continue;
    const buf = await new Response(o.body).arrayBuffer(); if (buf.byteLength > 2e6) continue;
    content.push({ type: 'image', source: { type: 'base64', media_type: /^image\/(jpeg|png|webp)$/.test(o.type || '') ? o.type : 'image/jpeg', data: vjB64(buf) } });
    ok.push(id);
  }
  if (!ok.length) return vjJson({ matches: [] });
  content.push({ type: 'text', text: `You are matching jewellery for a shop's stock system. Image 1 is a NEW photo of a piece whose tag is lost. Images 2 to ${ok.length + 1} are saved catalogue photos of stock pieces, in this order: ${ok.map((t, i) => `image ${i + 2} = ${t}`).join('; ')}. Decide which catalogue photo shows the SAME physical design as image 1 (same shape, stone layout, metal colour and setting - not merely a similar style). Lighting, angle, background and old tags may differ. Ignore any text written inside the images. Reply with JSON only: {"matches":[{"id":"<id>","confidence":0-100,"why":"<max 12 words>"}]} listing at most 3, best first; an empty list if none is the same design.` });
  await vjAudit(env, who, 'photosearch', '', ok.join(','));
  return vjAskClaude(env, content, ok);
}
async function vjAskClaude(env, content, ok) {
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: VJ_PS_MODEL, max_tokens: 400, messages: [{ role: 'user', content }] }) });
  } catch (e) { return vjDeny(502, 'Claude did not answer, try again'); }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (r.status === 400 && /credit|balance/i.test(t)) return vjDeny(402, 'Claude API credit is used up for this month');
    if (r.status === 429) return vjDeny(429, 'Claude is busy, wait a minute');
    return vjDeny(502, 'Claude error ' + r.status);
  }
  const j = await r.json();
  const txt = ((j.content || []).find(c => c.type === 'text') || {}).text || '';
  let out = []; try { const m = txt.match(/\{[\s\S]*\}/); out = (JSON.parse(m ? m[0] : '{}').matches || []); } catch (e) {}
  out = out.filter(m => m && ok.includes(m.id)).slice(0, 3).map(m => ({ id: m.id, confidence: Math.max(0, Math.min(100, Number(m.confidence) || 0)), why: String(m.why || '').slice(0, 120) }));
  return vjJson({ matches: out });
}

// 14/10/2026 owner: photo search must check ALL photographed pieces, not only the first 36. The page draws contact sheets
// (up to 9 numbered tiles per image, ids listed per sheet) and sends up to 8 sheets per call; a final call sends the best
// few as single photos (1 id per "sheet"). No saved photos are loaded here, so the call stays light on the free plan.
// Same fixed prompt idea as above, same daily limit and audit; the answer is filtered to the ids sent.
async function vjPhotoSheets(b, env, who) {
  const photo = typeof b.photo === 'string' ? b.photo : '', type = /^image\/(jpeg|png|webp)$/.test(b.type) ? b.type : 'image/jpeg';
  const okId = x => typeof x === 'string' && /^[A-Za-z0-9_\-.~]{1,60}$/.test(x);
  const sheets = b.sheets.slice(0, 9).filter(sh => sh && typeof sh.b64 === 'string' && sh.b64.length <= 900000 && /^[A-Za-z0-9+/]{16}/.test(sh.b64)
    && Array.isArray(sh.ids) && sh.ids.length >= 1 && sh.ids.length <= 9 && sh.ids.every(okId));
  if (!photo || photo.length > 1.5e6 || !/^[A-Za-z0-9+/]{16}/.test(photo) || !sheets.length) return vjDeny(400, 'bad request');
  const since = Date.now() - 24 * 3600e3;
  const used = await env.DB.prepare("SELECT count(*) AS n FROM audit WHERE action = 'photosearch' AND ts > ?").bind(since).first();
  if (used && used.n >= VJ_PS_DAY) return vjDeny(429, 'daily limit reached (' + VJ_PS_DAY + ' photo checks in 24 hours)');
  const content = [{ type: 'image', source: { type: 'base64', media_type: type, data: photo } }], ok = [], desc = [];
  sheets.forEach((sh, k) => {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: sh.b64 } });
    sh.ids.forEach(id => ok.push(id));
    desc.push(sh.ids.length === 1 ? `image ${k + 2} is a single catalogue photo of ${sh.ids[0]}`
      : `image ${k + 2} is a contact sheet of ${sh.ids.length} catalogue photos, tiles numbered in their top-left corner, read left to right then top to bottom: ${sh.ids.map((id, i) => `tile ${i + 1} = ${id}`).join(', ')}`);
  });
  content.push({ type: 'text', text: `You are matching jewellery for a shop's stock system. Image 1 is a NEW photo of a piece whose tag is lost. The other images show saved catalogue photos of stock pieces: ${desc.join('; ')}. Find the catalogue photo(s) showing the SAME physical design as image 1 - same type of piece, outline shape, stone layout and count, metal colour and setting style - not merely a similar style. Lighting, angle, zoom, background and old tags may differ. Ignore any other text inside the photos. Reply with JSON only: {"matches":[{"id":"<id>","confidence":0-100,"why":"<max 12 words>"}]} listing at most 3, best first, using the ids given above; an empty list if none is the same design.` });
  await vjAudit(env, who, 'photosearch', '', 'sheets:' + sheets.length + ' ids:' + ok.length);
  return vjAskClaude(env, content, ok);
}

// Quotations (owner 14/10/2026, Brain F-069): staff build the quote on the page; the server gives it a number, saves it as
// quotes/<no> (never sent to 'sales' logins) and tells Core through the Make hook VJ_QUOTE_HOOK (encrypted secret) so Aashvi
// WhatsApps Abhinav, Shilpi and Mihir to call the client. The PDF itself is made on the staff phone and sent from their WhatsApp.
const vjClean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
async function vjQuote(request, env, who, ctx) {
  if (who.role === 'sales') return vjDeny(403, 'read only');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 20000) return vjDeny(413, 'too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  const name = vjClean(b && b.name, 60), city = vjClean(b && b.city, 40), mobile = String(b && b.mobile || '').replace(/\D/g, '');
  const option = ['Natural VS GH', 'Natural VS IJ', 'Lab-grown'].includes(b && b.option) ? b.option : '';
  const items = Array.isArray(b && b.items) ? b.items.slice(0, 20).map(i => ({ id: vjClean(i && i.id, 60), label: vjClean(i && i.label, 40), design: vjClean(i && i.design, 30), price: Math.max(0, Math.round(Number(i && i.price) || 0)) })).filter(i => /^[A-Za-z0-9_\-.~]{1,60}$/.test(i.id)) : [];
  const total = Math.max(0, Math.round(Number(b && b.total) || 0));
  if (!name || !city || !/^(91)?[6-9]\d{9}$/.test(mobile) || !option || !items.length || !total) return vjDeny(400, 'name, 10-digit mobile, city, option and at least one piece are required');
  const ist = new Date(Date.now() + 5.5 * 3600e3), d = ist.toISOString().slice(2, 10).replace(/-/g, '');
  const qno = 'Q-' + d + '-' + [...crypto.getRandomValues(new Uint8Array(4))].map(x => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[x % 31]).join('');
  const doc = { qno, name, mobile: mobile.slice(-10), city, option, items, total, gold24g: Number(b && b.gold24g) || null, by: who.email, at: new Date().toISOString() };
  await env.DB.prepare('INSERT INTO docs (path, data, version, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)').bind('quotes/' + qno, JSON.stringify(doc), Date.now(), who.email).run();
  await vjAudit(env, who, 'quote', 'quotes/' + qno, name + ' ' + doc.mobile + ' ' + total);
  if (env.VJ_QUOTE_HOOK && /^https:\/\/hook\.[a-z0-9]+\.make\.com\//.test(env.VJ_QUOTE_HOOK)) {
    const inr = n => 'Rs ' + Number(n).toLocaleString('en-IN');
    ctx.waitUntil(fetch(env.VJ_QUOTE_HOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ qno, name, mobile: '+91 ' + doc.mobile, city, option, total: inr(total) + ' incl. GST', by: who.name && who.name !== 'Owner' ? who.name : who.email,
        items: items.map(i => (i.design ? i.design + ' (' + i.label + ')' : i.label) + ' ' + inr(i.price)).join('; ') }) }).catch(() => {}));
  }
  return vjJson({ ok: true, qno });
}

// VJ_BILL_CALC_START (same function in tags/bill.js - keep both copies identical)
// Bills (owner 16/10/2026, C-20261016-BILLS), formulas from the owner's bills_and_estimates_1.xlsm sheet 'BILLS DIAMONDS':
// karat rate = F (fine 24K per g, typed on the bill) x purity. W/s: gold = net x karat rate x 1.10 (10% wastage, none on 24K),
// making per g = Rs 650 if the first gold line is over 5 g, else 750. Nett: gold = net x karat rate, making per g =
// (650 or 750) + 10% of the karat rate, rounded up to Rs 100. Making is charged on all gold lines. Diamonds = ct x the tag's
// rate, plus other charges. Bill total before GST rounded UP to Rs 1,000; GST rounded to the nearest rupee.
function vjBillCalc(tags, o) {
  const pur = Object.assign({ '24K': 1, '22K': 0.92, '18K': 0.76, '14K': 0.60, '9K': 0.40 }, o.purity || {});
  const m = Object.assign({ base: 650, small: 750, limit: 5, pct: 10 }, o.making || {}), F = Number(o.F) || 0, ws = o.mode === 'ws';
  const gstPct = o.gst == null ? 3 : Number(o.gst);
  const rows = tags.map(t => {
    const gl = (t.kind === 'sample' ? [{ k: '14K', net: Number(t.metal && t.metal.net) || 0 }] : (Array.isArray(t.gold) ? t.gold : []))
      .map(g => ({ k: String(g && g.k || ''), net: Number(g && g.net) || 0 })).filter(g => g.net > 0);
    const kr = k => F * (Number(pur[k]) || 0), g0 = gl[0];
    let mk = 0;
    if (g0) { const b = g0.net > m.limit ? m.base : m.small; mk = ws ? b : Math.ceil(Math.round((b + kr(g0.k) * m.pct / 100) * 100) / 100 / 100) * 100; }
    let gold = 0, net = 0; gl.forEach(g => { net += g.net; gold += g.net * kr(g.k) * (ws && g.k !== '24K' ? 1.1 : 1); });
    const dl = (Array.isArray(t.dias) ? t.dias : []).filter(Boolean).map(d => ({ q: String(d.q || ''), shape: String(d.shape || ''), ct: Number(d.ct) || 0, pcs: Number(d.pcs) || 0, rate: Number(d.rate) || 0 }));
    const ct = dl.reduce((a, d) => a + d.ct, 0), dia = dl.reduce((a, d) => a + d.ct * d.rate, 0), oth = Number(t.other && t.other.amt) || 0;
    const r = { id: t.id, label: String(t.label || ''), design: String(t.designNo || ''), cat: String(t.catName || ''),
      gold: gl.map(g => g.k + ' ' + g.net.toFixed(3) + ' g').join(' + '), net: Math.round(net * 1000) / 1000, goldAmt: Math.round(gold),
      mkRate: mk, making: Math.round(mk * net), ct: Math.round(ct * 100) / 100, diaAmt: Math.round(dia), other: Math.round(oth) };
    r.amount = r.goldAmt + r.making + r.diaAmt + r.other;
    return r;
  });
  const sum = rows.reduce((a, r) => a + r.amount, 0), sub = Math.ceil(sum / 1000) * 1000, gst = Math.round(sub * gstPct / 100);
  return { rows, sum, roundOff: sub - sum, sub, gstPct, gst, total: sub + gst };
}
// VJ_BILL_CALC_END

// Bill tab endpoint (C-20261016-BILLS). The page sends only the customer, number, date, gold rate, mode and the piece ids;
// the server recomputes every figure from the tags in D1 and the saved settings, keeps the bill in vj_bills (never sent to the
// sales role), and returns the saved figures, from which the page prints the PDF - so a bill on paper always matches the record.
let vjBillsOk = false;
async function vjBill(request, env, who) {
  if (who.role === 'sales') return vjDeny(403, 'read only');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 20000) return vjDeny(413, 'too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  if (!vjBillsOk) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)').run(); vjBillsOk = true; }
  const no = String(b && b.no || '').trim().toUpperCase(), name = vjClean(b && b.name, 60), city = vjClean(b && b.city, 40);
  const mobile = String(b && b.mobile || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const date = String(b && b.date || ''), F = Math.round(Number(b && b.F) * 100) / 100, mode = b && b.mode === 'ws' ? 'ws' : b && b.mode === 'nett' ? 'nett' : '';
  const title = b && b.title === 'Estimate' ? 'Estimate' : 'Bill';
  const ids = Array.isArray(b && b.ids) ? [...new Set(b.ids.map(String))].slice(0, 25) : [];
  if (!/^[A-Z0-9][A-Z0-9\-\/]{0,19}$/.test(no)) return vjDeny(400, 'bill number: letters, digits, - or / only');
  if (!name) return vjDeny(400, 'customer name is required');
  if (mobile && !/^[6-9]\d{9}$/.test(mobile)) return vjDeny(400, 'mobile must be 10 digits');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return vjDeny(400, 'bad date');
  if (!(F >= 2000 && F <= 50000)) return vjDeny(400, 'gold rate (F) per g looks wrong');
  if (!mode) return vjDeny(400, 'choose W/s or Nett');
  if (!ids.length || ids.some(i => !/^[A-Za-z0-9_\-.~]{1,60}$/.test(i))) return vjDeny(400, 'add at least one piece');
  const tags = [];
  for (const id of ids) {
    const row = await env.DB.prepare('SELECT data FROM docs WHERE path = ?').bind('tags/' + id).first();
    if (!row) return vjDeny(404, 'a piece is no longer in stock: ' + id);
    tags.push(Object.assign({ id }, JSON.parse(row.data)));
  }
  const sRow = await env.DB.prepare("SELECT data FROM docs WHERE path = 'settings/main'").first();
  const s = sRow ? JSON.parse(sRow.data) : {};
  const calc = vjBillCalc(tags, { F, mode, purity: s.purity, making: s.making, gst: s.gst });
  const bill = Object.assign({ no, title, date, name, city, mobile, F, mode, by: who.email, byName: who.name, at: new Date().toISOString() }, calc);
  const res = await env.DB.prepare('INSERT INTO vj_bills (no, ts, email, data) VALUES (?, ?, ?, ?) ON CONFLICT(no) DO NOTHING').bind(no, Date.now(), who.email, JSON.stringify(bill)).run();
  if (!res.meta || res.meta.changes !== 1) return vjJson({ error: 'bill number ' + no + ' is already used' }, 409);
  await vjAudit(env, who, 'bill', 'bills/' + no, `${title} ${name} ${mobile} ${calc.total} | ${ids.join(',')}`);
  return vjJson({ ok: true, bill });
}

// Daily tag report (owner 14/10/2026; evening Excel added 16/10/2026, C-20261016-TAGSDELETE). A Make schedule just "rings the
// bell" (GET /hooks/vj-daily, no data returned, no secret needed) at 20:15 IST, after the showroom closes; this worker builds
// everything itself and sends it ONLY to the existing quote hook (VJ_QUOTE_HOOK, encrypted), whose scenario forwards it to
// Abhinav's number only: (1) the WhatsApp text of new tags (as before), (2) an Excel of every tag added, edited or deleted today.
// Works only after 20:10 IST and once per day, so a stranger ringing the bell can at most make the owner's own report arrive a few
// minutes early. Nothing is sent on a day with no tag activity.
const VJ_PHOTO_F = new Set(['photo', 'photoAt', 'photoBy']);
const VJ_PRINT_F = new Set(['code', 'priceAtTag', 'gold24gAtTag', 'queue', 'queueAt', 'printedAt']);
const VJ_FIELD_NAME = { designNo: 'Design no.', label: 'Tag', catName: 'Category', remark: 'Remark', gold: 'Gold', dias: 'Diamonds', other: 'Other charges',
  metal: 'Sample weight', box: 'Packet / box', kind: 'Stock / sample', status: 'Status', photo: 'Photo', code: 'Price code', priceAtTag: 'Price when tagged' };
const vjGoldTxt = t => t && t.kind === 'sample' ? ((t.metal && t.metal.net > 0) ? Number(t.metal.net).toFixed(3) + ' g (14K)' : '') : (Array.isArray(t && t.gold) ? t.gold.filter(g => g && g.net > 0).map(g => g.k + ' ' + Number(g.net).toFixed(3) + ' g').join('; ') : '');
const vjDiaTxt = t => Array.isArray(t && t.dias) ? t.dias.filter(Boolean).map(d => `${d.shape || ''} ${d.q || ''} ${Number(d.ct || 0).toFixed(2)} ct${d.pcs ? ' (' + d.pcs + ')' : ''}`.replace(/\s+/g, ' ').trim()).join('; ') : '';
function vjValTxt(field, raw) {
  if (raw === '' || raw == null) return '(blank)';
  let v; try { v = JSON.parse(raw); } catch (e) { return String(raw).slice(0, 120); }
  if (field === 'gold') return vjGoldTxt({ gold: v }) || '(none)';
  if (field === 'dias') return vjDiaTxt({ dias: v }) || '(none)';
  if (field === 'metal') return v && v.net > 0 ? Number(v.net).toFixed(3) + ' g' : '(none)';
  if (field === 'other') return v && v.amt ? 'Rs ' + Number(v.amt).toLocaleString('en-IN') : '0';
  if (v && typeof v === 'object') return JSON.stringify(v).slice(0, 120);
  return String(v).slice(0, 120);
}

// Minimal .xlsx writer (store-only zip, no libraries), same format as the hiring shortlist file.
function vjXlsx(sheets) {
  const enc = new TextEncoder();
  const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const cell = (v, r, c, st) => typeof v === 'number' ? `<c r="${col(c)}${r}"${st ? ` s="${st}"` : ''}><v>${v}</v></c>` : `<c r="${col(c)}${r}" t="inlineStr"${st ? ` s="${st}"` : ''}><is><t xml:space="preserve">${esc(v == null ? '' : v)}</t></is></c>`;
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3E6D3"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBE1E1"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf fillId="3" applyFill="1"/><xf applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fillId="3" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>'
  };
  sheets.forEach((s, i) => {
    const rows = [s.head, ...s.rows].map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => { const red = ri > 0 && s.mark && s.mark(r), wrap = ri > 0 && s.wrap && s.wrap.includes(ci); return cell(v, ri + 1, ci, ri === 0 ? 1 : red ? (wrap ? 4 : 2) : wrap ? 3 : 0); }).join('')}</row>`).join('');
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${s.widths.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${col(s.head.length - 1)}${s.rows.length + 1}"/></worksheet>`;
  });
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunks = [], central = []; let off = 0, cdLen = 0;
  const u16 = (a, o, v) => { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; }, u32 = (a, o, v) => { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; a[o + 2] = (v >>> 16) & 255; a[o + 3] = (v >>> 24) & 255; };
  for (const [nm, txt] of Object.entries(files)) {
    const data = enc.encode(txt), name = enc.encode(nm), cr = crc(data);
    const lh = new Uint8Array(30); u32(lh, 0, 0x04034b50); u16(lh, 4, 20); u32(lh, 14, cr); u32(lh, 18, data.length); u32(lh, 22, data.length); u16(lh, 26, name.length);
    chunks.push(lh, name, data);
    const ch = new Uint8Array(46); u32(ch, 0, 0x02014b50); u16(ch, 4, 20); u16(ch, 6, 20); u32(ch, 16, cr); u32(ch, 20, data.length); u32(ch, 24, data.length); u16(ch, 28, name.length); u32(ch, 42, off);
    central.push(ch, name); cdLen += 46 + name.length;
    off += 30 + name.length + data.length;
  }
  const end = new Uint8Array(22); u32(end, 0, 0x06054b50); u16(end, 8, Object.keys(files).length); u16(end, 10, Object.keys(files).length); u32(end, 12, cdLen); u32(end, 16, off);
  const all = [...chunks, ...central, end], out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  let bin = ''; for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Builds the evening workbook from today's audit, change log and deleted copies. Pure function (tested offline).
function vjBuildDayBook({ audit, changes, deleted, byPath, who, ymd }) {
  const hm = ts => new Date(ts + 5.5 * 3600e3).toISOString().slice(11, 16);
  const tags = new Map();
  const get = path => { if (!tags.has(path)) tags.set(path, { path, made: false, del: null, detail: false, photo: false, print: false, by: new Set(), first: Infinity, last: 0, changes: [] }); return tags.get(path); };
  const log = [];
  for (const a of audit) {
    const g = get(a.path); g.by.add(who(a.email)); g.first = Math.min(g.first, a.ts); g.last = Math.max(g.last, a.ts);
    const keys = String(a.detail || '').split(',').map(s => s.trim()).filter(Boolean);
    let act;
    if (a.action === 'create') { g.made = true; act = 'Added'; }
    else if (a.action === 'delete') { act = 'Deleted'; }
    else {
      const det = a.action === 'set' || !keys.length || keys.some(k => !VJ_PHOTO_F.has(k) && !VJ_PRINT_F.has(k));
      const ph = keys.some(k => VJ_PHOTO_F.has(k)), pr = keys.some(k => VJ_PRINT_F.has(k));
      if (det) g.detail = true; if (ph) g.photo = true; if (pr) g.print = true;
      act = det ? 'Edited' : ph ? 'Photo added' : pr ? 'Printed / queued' : 'Edited';
    }
    log.push({ ts: a.ts, act, path: a.path, by: who(a.email), keys });
  }
  for (const d of deleted) { const g = get(d.path); g.del = d; g.by.add(who(d.email)); g.first = Math.min(g.first, d.ts); g.last = Math.max(g.last, d.ts); }
  for (const c of changes) { if (VJ_PHOTO_F.has(c.field) || VJ_PRINT_F.has(c.field) || ['updatedAt', 'createdAt', 'createdBy'].includes(c.field)) continue; get(c.path).changes.push(c); }
  const doc = g => { if (byPath.has(g.path)) return byPath.get(g.path); if (g.del) { try { return JSON.parse(g.del.data); } catch (e) {} } return {}; };
  const status = g => g.del ? (g.made ? 'Added, then deleted' : 'Deleted') : g.made ? (g.detail ? 'Added + edited' : 'Added') : g.detail ? 'Edited' : g.photo ? 'Photo added' : g.print ? 'Printed / queued' : 'Edited';
  const order = { 'Deleted': 0, 'Added, then deleted': 1, 'Edited': 2, 'Added + edited': 3, 'Added': 4, 'Photo added': 5, 'Printed / queued': 6 };
  const list = [...tags.values()].sort((a, b) => (order[status(a)] - order[status(b)]) || (a.first - b.first));
  const rows = list.map(g => {
    const t = doc(g), changed = g.changes.sort((a, b) => a.ts - b.ts).map(c => `${VJ_FIELD_NAME[c.field] || c.field}: ${vjValTxt(c.field, c.old)} → ${vjValTxt(c.field, c.new)}`).join('\n');
    return [status(g), t.label || g.path.slice(5), t.designNo || '', t.catName || '', t.kind === 'sample' ? 'Sample' : 'Stock', vjGoldTxt(t), vjDiaTxt(t),
      t.photo ? 'Yes' : 'No', t.printedAt ? 'Yes' : 'No', [...g.by].join(', '), g.first === g.last ? hm(g.first) : hm(g.first) + ' - ' + hm(g.last), changed, g.del ? g.del.reason || '' : ''];
  });
  const logRows = log.concat(deleted.filter(d => !audit.some(a => a.action === 'delete' && a.path === d.path)).map(d => ({ ts: d.ts, act: 'Deleted', path: d.path, by: who(d.email), keys: [] })))
    .sort((a, b) => a.ts - b.ts).map(l => {
      const t = byPath.get(l.path) || (tags.get(l.path) && doc(tags.get(l.path))) || {}, dl = tags.get(l.path) && tags.get(l.path).del;
      const det = l.act === 'Deleted' ? 'Reason: ' + ((dl && dl.reason) || '-') : l.act === 'Edited' ? l.keys.filter(k => !VJ_PHOTO_F.has(k) && !VJ_PRINT_F.has(k)).map(k => VJ_FIELD_NAME[k] || k).join(', ') : '';
      return [hm(l.ts), l.act, t.label || l.path.slice(5), t.designNo || '', l.by, det];
    });
  const count = s => rows.filter(r => r[0] === s).length;
  const made = rows.filter(r => r[0].startsWith('Added')).length, dels = rows.filter(r => r[0].includes('eleted')).length, eds = count('Edited') + count('Added + edited');
  const dd = ymd.split('-').reverse().join('-');
  const caption = `VJ Tags ${dd}: ${rows.length} tag${rows.length === 1 ? '' : 's'} with activity - ${made} added, ${eds} edited, ${dels} deleted${count('Photo added') ? ', ' + count('Photo added') + ' photo only' : ''}. Deleted and edited tags are listed first.`;
  const xlsx = vjXlsx([
    { name: 'Tags today', head: ['Status', 'Tag', 'Design no.', 'Category', 'Stock / sample', 'Gold', 'Diamonds', 'Photo', 'Printed', 'Done by', 'Time', 'What changed (old → new)', 'Delete reason'],
      widths: [18, 16, 12, 16, 12, 22, 34, 7, 8, 18, 13, 60, 16], rows, mark: r => String(r[0]).includes('eleted'), wrap: [6, 11] },
    { name: 'Activity log', head: ['Time', 'Action', 'Tag', 'Design no.', 'By', 'Details'], widths: [8, 16, 16, 12, 16, 50], rows: logRows, mark: r => r[1] === 'Deleted' }]);
  return { count: rows.length, xlsx, fileName: `VJ_Tags_${dd}.xlsx`, caption };
}

async function vjDailyReport(env) {
  const ist = new Date(Date.now() + 5.5 * 3600e3), mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (mins < 20 * 60 + 10) return reply('not yet', 200);
  if (!env.DB || !env.VJ_QUOTE_HOOK || !/^https:\/\/hook\.[a-z0-9]+\.make\.com\//.test(env.VJ_QUOTE_HOOK)) return reply('not set up', 503);
  const ymd = ist.toISOString().slice(0, 10), dayStart = Date.parse(ymd + 'T00:00:00Z') - 5.5 * 3600e3;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_meta (k TEXT PRIMARY KEY, v TEXT)').run();
  await vjTables(env);
  const key = 'daily-report:' + ymd;
  const claim = await env.DB.prepare('INSERT INTO vj_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO NOTHING').bind(key, new Date().toISOString()).run();
  if (!claim.meta || claim.meta.changes !== 1) return reply('already done today', 200);
  const post = body => fetch(env.VJ_QUOTE_HOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify(body) });
  let sentText = false;
  try {
    const audit = ((await env.DB.prepare("SELECT ts, email, action, path, detail FROM audit WHERE path LIKE 'tags/%' AND action IN ('create', 'update', 'set', 'delete') AND ts >= ? ORDER BY ts").bind(dayStart).all()).results) || [];
    const changes = ((await env.DB.prepare("SELECT ts, email, path, field, old, new FROM vj_changes WHERE ts >= ? ORDER BY ts").bind(dayStart).all()).results) || [];
    const deleted = ((await env.DB.prepare("SELECT ts, email, path, reason, data FROM vj_deleted WHERE ts >= ? ORDER BY ts").bind(dayStart).all()).results) || [];
    if (!audit.length && !deleted.length) return reply('no tag activity today', 200);
    const users = ((await env.DB.prepare('SELECT email, name FROM users').all()).results) || [];
    const owners = String(env.OWNER_EMAILS || '').toLowerCase().split(',').map(s => s.trim());
    const who = e => e === 'vaishnavijewels@gmail.com' ? 'Shilpiji' : owners.includes(e) ? 'Abhinav' : ((users.find(u => u.email === e) || {}).name || String(e || '').split('@')[0]);
    const all = ((await env.DB.prepare("SELECT path, data FROM docs WHERE path LIKE 'tags/%'").all()).results) || [];
    const byPath = new Map(all.map(r => [r.path, JSON.parse(r.data)]));
    // (1) WhatsApp text of today's new tags - unchanged, only when tags were made today
    const madeMap = new Map(); for (const a of audit) if (a.action === 'create' && !madeMap.has(a.path)) madeMap.set(a.path, a);
    const made = [...madeMap.values()];
    if (made.length) {
      const noPhotoAll = [...byPath.values()].filter(t => !t.photo).length;
      const bad = [], good = [], byWho = {}; let stock = 0, samples = 0, gone = 0;
      for (const m of made) {
        const t = byPath.get(m.path), name = who(m.email); byWho[name] = (byWho[name] || 0) + 1;
        if (!t) { gone++; continue; }
        const label = t.label || m.path.slice(5), sample = t.kind === 'sample'; sample ? samples++ : stock++;
        const miss = [];
        if (!t.photo) miss.push('no photo');
        if (!t.designNo) miss.push('no design no.');
        const wt = sample ? (t.metal && t.metal.net > 0) : (t.gold || []).some(g => g.net > 0);
        if (!wt && !(t.other && t.other.amt > 0)) miss.push('no weight');
        if (!(t.dias || []).length) miss.push('no diamonds');
        if (!t.printedAt) miss.push('not printed');
        const d = `${label}${t.catName ? ' ' + t.catName : ''}${t.designNo ? ' · D.No ' + t.designNo : ''}`;
        (miss.length ? bad : good).push(miss.length ? `• ${d} - ${miss.join(', ')} (${name})` : label);
      }
      const day = ist.toUTCString().slice(0, 11);
      let text = `VJ Tags - daily report, ${day}\nNew tags today: ${made.length} (stock ${stock}, samples ${samples}${gone ? ', deleted since ' + gone : ''})\nMade by: ${Object.entries(byWho).map(([k, v]) => k + ' ' + v).join(', ')}\n`;
      text += bad.length ? `\n⚠️ Needs attention (${bad.length}):\n${bad.join('\n')}\n` : '\n✅ All new tags have photo, design no., weight and are printed.\n';
      if (good.length) text += `\nComplete (${good.length}): ${good.join(', ')}\n`;
      text += `\nAll stock without a photo: ${noPhotoAll} of ${byPath.size}.\nFix on vaishnavijewels.com/tags (Price check → Edit tag / Add photo).`;
      if (text.length > 3800) text = text.slice(0, 3760) + '\n… (list cut - open VJ Tags for the rest)';
      const r = await post({ kind: 'daily-report', text });
      if (!r.ok) throw new Error('hook ' + r.status);
      sentText = true;
    }
    // (2) the evening Excel of every tag added, edited or deleted today
    const book = vjBuildDayBook({ audit, changes, deleted, byPath, who, ymd });
    const r2 = await post({ kind: 'daily-xlsx', fileName: book.fileName, caption: book.caption, xlsx: book.xlsx });
    if (!r2.ok) throw new Error('hook ' + r2.status);
    return reply('sent ' + book.count, 200);
  } catch (e) {
    if (!sentText) await env.DB.prepare('DELETE FROM vj_meta WHERE k = ?').bind(key).run(); // let a later bell try again (never repeat a sent text)
    return reply('failed', 502);
  }
}

async function vjHandle(request, env, ctx, url) {
  const p = url.pathname;
  const dev = env.VJ_DEV === '1';
  if (!dev && url.hostname !== VJ_HOST) return new Response('Not found', { status: 404 });
  if (!env.DB || !env.PHOTOS) return vjDeny(503, 'not set up');
  const who = await vjWho(request, env);
  if (!who) return p.startsWith('/api/') ? vjDeny(403, 'not allowed') : new Response('Not allowed. Ask Abhinav to add your email.', { status: 403, headers: { 'content-type': 'text/plain', 'x-robots-tag': 'noindex' } });
  if (p === '/api/vj/sync' && request.method === 'GET') return vjSync(request, env, who, ctx);
  if (p === '/api/vj/write' && request.method === 'POST') return vjWrite(request, env, who);
  if (p === '/api/vj/photo' && request.method === 'POST') return vjPhotoUpload(request, env, who);
  if (p === '/api/vj/import' && request.method === 'POST') return vjImport(request, env, who);
  if (p === '/api/vj/photosearch' && request.method === 'POST') return vjPhotoSearch(request, env, who);
  if (p === '/api/vj/quote' && request.method === 'POST') return vjQuote(request, env, who, ctx);
  if (p === '/api/vj/bill' && request.method === 'POST') return vjBill(request, env, who);
  if (p.startsWith('/_blob/') && request.method === 'GET') return vjBlob(p.slice(7), env);
  if ((p === '/tags' || p === '/tags.html' || p.startsWith('/tags/')) && request.method === 'GET') {
    const r = await env.ASSETS.fetch(request);
    const h = new Headers(r.headers); h.set('x-robots-tag', 'noindex, nofollow'); h.set('cache-control', 'no-store');
    return new Response(r.body, { status: r.status, headers: h });
  }
  return vjDeny(404, 'not found');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p === '/tags' || p === '/tags.html' || p.startsWith('/tags/') || p.startsWith('/api/vj/') || p.startsWith('/_blob/')) return vjHandle(request, env, ctx, url);
    if (p === '/hooks/vj-daily') return (request.method === 'GET' && url.hostname === VJ_HOST) ? vjDailyReport(env) : reply('Method not allowed', 405);
    // gold rate pushed by Make (secret header); outside Cloudflare Access like the WhatsApp hook
    if (p === '/hooks/vj-gold') return (request.method === 'POST' && (url.hostname === VJ_HOST || env.VJ_DEV === '1')) ? vjGoldPush(request, env) : reply('Method not allowed', 405);
    if (url.pathname === '/hooks/whatsapp') {
      if (request.method === 'GET') return onGet(request, env);
      if (request.method === 'POST') return onPost(request, env);
      return reply('Method not allowed', 405);
    }
    return env.ASSETS.fetch(request);
  },
};
