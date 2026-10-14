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
// OWNER_EMAILS (comma list), GOLD_PUSH_SECRET (encrypted), ANTHROPIC_API_KEY (encrypted, photo search), VJ_QUOTE_HOOK (encrypted, quote follow-up). ACCESS_CERTS_URL / VJ_DEV only for local tests.
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
async function vjMaybeRefreshGold(env) {
  const ist = new Date(Date.now() + 5.5 * 3600e3), h = ist.getUTCHours(), d = ist.getUTCDay();
  if (d === 0 || h < 10 || h > 19) return;
  const row = await env.DB.prepare("SELECT data FROM docs WHERE path = 'settings/main'").first();
  const at = row ? Date.parse(JSON.parse(row.data).goldAt || 0) : 0;
  if (Date.now() - at < 2.5 * 3600e3) return;
  try { const p = await vjGoldFromFeed(); await vjSaveGold(env, p, 'NR Jewellers GOLD 999 IMP T+2 sell (website, auto)'); } catch (e) {}
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
    await env.DB.batch([env.DB.prepare('DELETE FROM docs WHERE path = ?').bind(path),
      env.DB.prepare('INSERT INTO tomb (path, deleted_at) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET deleted_at = excluded.deleted_at').bind(path, Date.now())]);
    await vjAudit(env, who, 'delete', path, row.data.slice(0, 300));
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
const VJ_PS_MODEL = 'claude-sonnet-5-5', VJ_PS_DAY = 30;
function vjB64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); }
async function vjPhotoSearch(request, env, who) {
  if (who.role === 'sales') return vjDeny(403, 'read only');
  if (!env.ANTHROPIC_API_KEY) return vjDeny(503, 'photo search is not set up');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 3e6) return vjDeny(413, 'photo too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
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
