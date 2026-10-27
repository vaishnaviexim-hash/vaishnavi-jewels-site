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

async function onPost(request, env, ctx) {
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
  // R-159: gold rate from Abhinav/Mihir saved on the website at once (no Make); the message still goes on to A1
  try { const g = env.DB ? waGoldFrom(values) : null; if (g) { const p = vjSaveGold(env, g.per10, g.source).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p; } } catch (e) {}
  // R-159: batched replies only when the owner has set WA_BATCH = 1; urgent team commands and opt-outs go at once
  if (env.WA_BATCH === '1' && env.DB && hasMsg && !hasFail && !waUrgent(values)) {
    try { await waQueue(env, body, values); return reply('OK', 200); } catch (e) { /* queue failed: forward now as before */ }
  }

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
// R-159 MAKE-CREDIT SAVING MODE (owner 27/10/2026 18:40-18:44 IST, Brain C-20261027-MAKECUT).
// (a) Gold rate by WhatsApp: when Abhinav or Mihir send 'Gold 152266' (Gold 999 IMP T+2 sell per 10 g) to Aashvi, the
//     website saves it straight away (VJ Tags settings, no Make credits). The message still goes on to Make A1, which
//     replies and fills the Make data store VJ_Gold. A WhatsApp rate wins for its whole day (the NR relay is skipped).
// (b) Batched customer replies: ONLY when the Cloudflare variable WA_BATCH = '1' (owner switches it on). Real messages are
//     stored in D1 table wa_inbox and sent to Make A1 in one go at 11:37 / 15:37 / 19:37 IST, when the scheduler calls
//     POST /hooks/wa-flush with header x-vj-flush-secret = WA_FLUSH_SECRET (encrypted variable). Consecutive texts from the
//     same customer become one message (one AI reply instead of several). Team commands that need speed (STOP, YES/NO,
//     GO/SKIP boost replies, button taps, Gold) and customer opt-outs are forwarded at once. Without WA_BATCH everything
//     works exactly as before. Re-sent messages are signed with META_APP_SECRET, so A1's signature check still passes.
// (c) We never mark customer messages as read (no blue ticks) and delivery/read receipts never reach Make.
const WA_GOLD_FROM = { '917567400099': 'Abhinav', '919099763201': 'Mihir' };
const WA_TEAM = new Set(['917567400099', '919374050969', '919099763201', '917096112443', '918758929959']); // Team_Access 27/10
const WA_URGENT = /^(stop|stop all|start all|pause posting|resume posting|yes|y|no|n|ok|okay|haan|haan ji|ha|han|ji haan|nahi|nahin|na|cancel|confirm|confirmed|skip|go|go all|go mathura|go braj|test on|test off|gold\b.*|gold rate\b.*)[.!\s]*$/i;
const WA_OPTOUT = /^(stop|unsubscribe|band karo|mat bhejo|don'?t send|remove me)[.!\s]*$/i;
const waMsgs = values => { const out = []; for (const v of values) for (const m of (Array.isArray(v.messages) ? v.messages : [])) if (m) out.push({ v, m }); return out; };
const waText = m => { const t = String(m.type || ''); if (t === 'text') return String((m.text || {}).body || ''); if (t === 'button') return String((m.button || {}).text || '');
  if (t === 'interactive') { const i = m.interactive || {}; return String(((i.button_reply || i.list_reply || {}).title) || ''); } return String((m[t] || {}).caption || ''); };
function waIst(ms) { const d = new Date(ms + 5.5 * 3600e3), p = x => String(x).padStart(2, '0');
  return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
const waIstDay = ms => new Date(ms + 5.5 * 3600e3).toISOString().slice(0, 10);
function waGoldFrom(values) {
  for (const { m } of waMsgs(values)) {
    const who = WA_GOLD_FROM[String(m.from || '')];
    if (!who || m.type !== 'text') continue;
    const k = waText(m).trim().replace(/(\d),(?=\d)/g, '$1').match(/^gold(?:\s*rate)?(?:\s*999)?(?:\s*imp)?(?:\s*t\s*\+\s*2)?\s*[:=-]?\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\s*(?:(?:\/|per)?\s*10\s*g\w*)?\s*$/i);
    if (!k) continue;
    let n = parseFloat(k[1]); if (n > 0 && n < 40000) n *= 10; // a per-gram figure still works
    if (!(n >= 50000 && n <= 400000)) continue; // owner's sanity range per 10 g
    const ts = (Number(m.timestamp) || 0) * 1000 || Date.now();
    return { per10: Math.round(n), source: `Sent by ${who} on WhatsApp ${waIst(ts)} IST` };
  }
  return null;
}
function waUrgent(values) {
  for (const { m } of waMsgs(values)) {
    const from = String(m.from || ''), t = waText(m).trim();
    if (WA_TEAM.has(from) && (m.type === 'interactive' || m.type === 'button' || WA_URGENT.test(t))) return true;
    if (WA_OPTOUT.test(t)) return true;
  }
  return false;
}
let waTablesOk = false;
async function waTables(env) {
  if (waTablesOk) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS wa_inbox (id TEXT PRIMARY KEY, sender TEXT, type TEXT, text TEXT, media_id TEXT, ts INTEGER, received INTEGER, meta TEXT, msg TEXT, contact TEXT, processed INTEGER DEFAULT 0, sent_at INTEGER)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS wa_inbox_p ON wa_inbox (processed, ts)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_meta (k TEXT PRIMARY KEY, v TEXT)')]);
  waTablesOk = true;
}
async function waQueue(env, body, values) {
  await waTables(env);
  const now = Date.now(), stmts = [];
  const waba = String((((body || {}).entry || [])[0] || {}).id || '');
  for (const { v, m } of waMsgs(values)) {
    const id = String(m.id || ''); if (!id) continue;
    const c = (Array.isArray(v.contacts) ? v.contacts : []).find(x => x && String(x.wa_id) === String(m.from)) || (v.contacts || [])[0] || {};
    const t = String(m.type || '');
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO wa_inbox (id, sender, type, text, media_id, ts, received, meta, msg, contact, processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)')
      .bind(id, String(m.from || ''), t, waText(m).slice(0, 4000), String((m[t] && m[t].id) || ''), (Number(m.timestamp) || 0) * 1000 || now, now,
        JSON.stringify({ waba, metadata: v.metadata || {} }), JSON.stringify(m), JSON.stringify(c)));
  }
  if (stmts.length) await env.DB.batch(stmts);
}
const waAscii = s => s.replace(/[^\x00-\x7e]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')); // same escaping as Meta
async function waFlush(request, env) {
  const sec = request.headers.get('x-vj-flush-secret') || '';
  if (!env.WA_FLUSH_SECRET || env.WA_FLUSH_SECRET.length < 24 || !safeEq(sec, env.WA_FLUSH_SECRET)) return reply('Forbidden', 403);
  if (!env.META_APP_SECRET || !env.MAKE_A1_HOOK || !env.DB) return reply('Not configured', 503);
  await waTables(env);
  const rows = (await env.DB.prepare('SELECT id, sender, type, ts, meta, msg, contact FROM wa_inbox WHERE processed = 0 ORDER BY ts, received LIMIT 300').all()).results || [];
  const items = [], lastOf = new Map();
  for (const r of rows) {
    let m, meta, c; try { m = JSON.parse(r.msg); meta = JSON.parse(r.meta); c = JSON.parse(r.contact); } catch (e) { items.push({ ids: [r.id], bad: true }); continue; }
    const prev = lastOf.get(r.sender);
    if (prev && !prev.bad && !WA_TEAM.has(r.sender) && m.type === 'text' && prev.msg.type === 'text' && !prev.sent && String((m.text || {}).body || '').length + String((prev.msg.text || {}).body || '').length < 3500) {
      prev.msg.text.body = String(prev.msg.text.body || '') + '\n' + String((m.text || {}).body || ''); // one customer, several texts -> one message
      prev.msg.timestamp = m.timestamp; prev.ids.push(r.id); continue;
    }
    const it = { ids: [r.id], msg: m, meta, contact: c }; items.push(it); lastOf.set(r.sender, it);
  }
  let sent = 0, failed = 0; const done = [], MAX = 35;
  for (const it of items) {
    if (sent + failed >= MAX) break;
    if (it.bad) { done.push(...it.ids); continue; }
    const payload = { object: 'whatsapp_business_account', entry: [{ id: it.meta.waba || '', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: it.meta.metadata || {}, contacts: it.contact && it.contact.wa_id ? [it.contact] : [], messages: [it.msg] } }] }] };
    const bytes = enc.encode(waAscii(JSON.stringify(payload)));
    try {
      const r = await fetch(env.MAKE_A1_HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=' + await hmacHex(env.META_APP_SECRET, bytes), 'x-vj-batch': '1' }, body: bytes, signal: AbortSignal.timeout(9000) });
      if (r.ok) { sent++; done.push(...it.ids); } else failed++;
    } catch (e) { failed++; }
  }
  const now = Date.now();
  for (let i = 0; i < done.length; i += 50) {
    const part = done.slice(i, i + 50);
    await env.DB.prepare(`UPDATE wa_inbox SET processed = 1, sent_at = ? WHERE id IN (${part.map(() => '?').join(',')})`).bind(now, ...part).run();
  }
  await env.DB.prepare('DELETE FROM wa_inbox WHERE processed = 1 AND sent_at < ?').bind(now - 14 * 86400e3).run();
  const left = await env.DB.prepare('SELECT count(*) AS n FROM wa_inbox WHERE processed = 0').first();
  return new Response(JSON.stringify({ ok: true, messages: rows.length, sent, failed, remaining: (left && left.n) || 0, at: waIst(now) }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
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
  if (!row || !['staff', 'sales', 'tagger'].includes(row.role)) return null; // tagger (owner 26/10 18:07, Shyam): New tag + photo, Tag/Bill now, Saved bills - nothing else
  return { email, role: row.role, name: row.name || email };
}

const VJ_PATH = /^(tags\/[A-Za-z0-9_\-.~]{1,60}|settings\/main|counters\/main)$/;
// What staff may change on a piece that already exists (photo, price code fixed at first print, print queue).
// owner 26/10/2026 (C-20261026-STAFFEDIT): staff may also use Edit tag (design no., remark, box, gold, diamonds, polki, other, sample metal);
// every change is still logged old -> new in vj_changes / audit with the person's email. Delete stays owner-only.
const VJ_STAFF_FIELDS = new Set(['pdia', 'certNo', 'photo', 'photoAt', 'photoBy', 'code', 'priceAtTag', 'gold24gAtTag', 'queue', 'queueAt', 'printedAt', 'designNo', 'remark', 'box', 'other', 'dias', 'polki', 'metal', 'gold', 'editedAt']);

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
  // R-159: a gold rate sent on WhatsApp by Abhinav/Mihir wins for its whole day (no Make call at all)
  const row0 = await env.DB.prepare("SELECT data FROM docs WHERE path = 'settings/main'").first();
  const s0 = row0 ? JSON.parse(row0.data) : {};
  if (/^Sent by /.test(String(s0.goldSource || '')) && waIstDay(Date.parse(s0.goldAt || 0) || 0) === waIstDay(Date.now())) return;
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
  // R-159: ask Make at most ONCE per task time across all website copies (was every 10 min per copy = ~22 Make runs a day)
  try { await waTables(env); const a = await env.DB.prepare("SELECT v FROM vj_meta WHERE k = 'gold_asked'").first(); if (a && Number(a.v) >= slotAt) return;
    await env.DB.prepare("INSERT INTO vj_meta (k, v) VALUES ('gold_asked', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(String(Date.now())).run(); } catch (e) { return; }
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
    if (who.role === 'tagger' && r.path.startsWith('quotes/')) return null;
    if (who.role === 'sales' && data && data.order) delete data.order; // C-20261016-ORDERS: customer details never go to the sales login
    if (who.role === 'sales' && data && data.orderCancelled) delete data.orderCancelled;
    return { path: r.path, data, version: r.version };
  }).filter(Boolean);
  // 'now - 2000' so a write landing in the same millisecond is never missed on the next poll
  return vjJson({ now: now - 2000, docs: out, deleted: del, me: { email: who.email, role: who.role, name: who.name } });
}

async function vjWrite(request, env, who, ctx) {
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
  if (who.role === 'tagger' && cur && path.startsWith('tags/') && cur.createdBy !== who.email && cur.kind !== 'order') return vjDeny(403, 'you can change only the tags you made'); // 27/10 C-20261027-ORDEREDIT: order pieces editable by every login
  if ((who.role === 'staff' || who.role === 'tagger') && cur && path.startsWith('tags/')) {
    for (const k of new Set([...Object.keys(cur), ...Object.keys(next)])) {
      if (!VJ_STAFF_FIELDS.has(k) && JSON.stringify(cur[k]) !== JSON.stringify(next[k])) return vjDeny(403, 'staff cannot change ' + k);
    }
  }
  if (path.startsWith('tags/')) {
    // owner 17/10/2026 17:48 (C-20261017-NOTDOUBLE): only Abhinav may mark / unmark a tag as 'not a double tag'
    if (next.notDouble !== undefined && next.notDouble !== true) delete next.notDouble;
    if (!vjCanSettle(who)) { if (next.notDouble && !(cur && cur.notDouble)) return vjDeny(403, 'only Abhinav can mark a tag as not a double'); if (cur && cur.notDouble) next.notDouble = true; else delete next.notDouble; }
    for (const k of ['costPrice', 'cost', 'mrp', 'purchase']) delete next[k]; // F-025: never store cost prices
    if (next.order !== undefined) { // C-20261016-ORDERS: order customer, cleaned
      const o = next.order && typeof next.order === 'object' ? next.order : null;
      if (!o || next.kind !== 'order') delete next.order;
      else { const mob = vjPhone(o.mobile), due = String(o.due || '');
        next.order = { name: vjClean(o.name, 60), mobile: mob, city: vjClean(o.city, 40), due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '' };
        if (!next.order.name) return vjDeny(400, 'order needs the customer name'); }
    }
    if (next.orderCancelled !== undefined) { // C-20261016-ORDERSTOCK: the cancelled order's customer, kept for the record (owners only)
      const oc = next.orderCancelled && typeof next.orderCancelled === 'object' ? next.orderCancelled : null;
      if (!oc || who.role !== 'admin' && JSON.stringify(oc) !== JSON.stringify(cur && cur.orderCancelled)) delete next.orderCancelled;
      else next.orderCancelled = { name: vjClean(oc.name, 60), mobile: vjPhone(oc.mobile), city: vjClean(oc.city, 40), due: /^\d{4}-\d{2}-\d{2}$/.test(String(oc.due || '')) ? oc.due : '', at: vjClean(oc.at, 30), by: vjClean(oc.by, 80) };
    }
    if (next.polki !== undefined) { // C-20261017-POLKI (owner 17/10): polki pieces x rate per piece, whole numbers; none when 0 pcs
      const pk = next.polki && typeof next.polki === 'object' && !Array.isArray(next.polki) ? next.polki : null;
      const pcs = pk ? Number(pk.pcs) : 0, rate = pk ? Number(pk.rate) : 0;
      if (next.polki === null || pk && pcs === 0) delete next.polki;
      else if (!pk) return vjDeny(400, 'bad polki');
      else if (!Number.isInteger(pcs) || pcs < 1 || pcs > 10000 || !Number.isInteger(rate) || rate < 1 || rate > 100000) return vjDeny(400, 'polki: pieces 0-10000 and rate per piece Rs 1-1,00,000, whole numbers');
      else next.polki = { pcs, rate };
    }
    if (next.pdia !== undefined) { // C-20261026-PARTYDIA: party (customer's own) diamonds - ct, pcs, setting rate per ct
      const pd = next.pdia && typeof next.pdia === 'object' && !Array.isArray(next.pdia) ? next.pdia : null;
      const ct = pd ? Math.round(Number(pd.ct) * 1000) / 1000 : 0, pcs = pd ? Number(pd.pcs || 0) : 0, rate = pd ? Number(pd.rate) : 0;
      if (next.pdia === null || pd && !(ct > 0)) delete next.pdia;
      else if (!pd) return vjDeny(400, 'bad party diamond');
      else if (!(ct <= 1000) || !Number.isInteger(pcs) || pcs < 0 || pcs > 100000 || !Number.isInteger(rate) || rate < 1 || rate > 100000) return vjDeny(400, 'party diamond: ct 0.001-1000, whole pcs, setting rate per ct Rs 1-1,00,000');
      else next.pdia = { ct, pcs, rate };
    }
    if (next.certNo !== undefined) { const c = vjClean(next.certNo, 30).toUpperCase(); if (c) next.certNo = c; else delete next.certNo; } // IGI / GIA certificate no.
    // C-20261017-CHAINTUNCH (owner 17/10/2026 18:16 / 18:19): any gold line can be a chain with its own tunch (fine gold factor, e.g.
    // 0.900 or 0.940; 0.30-1.10, 3 decimals): gold:[{k:'18K',net:8,tunch:0.94}]. A chain line is priced net x tunch x fine rate with
    // no making and no extra wastage; a tag of category Chain has every gold line as a chain line.
    delete next.tunch;
    if (Array.isArray(next.gold) && next.gold.some(g => g && typeof g === 'object' && 'tunch' in g)) {
      const gl = [];
      for (const g of next.gold) { if (!g || typeof g !== 'object' || Array.isArray(g)) { gl.push(g); continue; } const c = Object.assign({}, g);
        if (c.tunch === null || c.tunch === '' || c.tunch === undefined || c.tunch === false || c.tunch === 0) delete c.tunch;
        else if (typeof c.tunch !== 'number' || !isFinite(c.tunch) || c.tunch < 0.3 || c.tunch > 1.1) return vjDeny(400, 'chain tunch must be a number from 0.30 to 1.10 (e.g. 0.920)');
        else c.tunch = Math.round(c.tunch * 1000) / 1000;
        gl.push(c); }
      next.gold = gl;
    }
    if (next.cat === 'CH' && (next.kind === 'sale' || next.kind === 'order') && Array.isArray(next.gold) && (!cur || JSON.stringify(cur.gold) !== JSON.stringify(next.gold))
      && next.gold.some(g => g && Number(g.net) > 0 && !(g.tunch > 0))) return vjDeny(400, 'a chain needs its tunch on each gold line (e.g. 0.920)');
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
  if (!row && path.startsWith('tags/') && next.kind === 'order' && next.order) await vjContactPush(env, ctx, { name: next.order.name, mobile: next.order.mobile, city: next.order.city, type: 'Customer', src: 'VJ Tags order' }); // C-20261026-CONTACTS
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
  if (who.role === 'sales' && !VJ_KO_EXTRA.includes(who.email)) return vjDeny(403, 'read only'); // office login may add repair / out photos (27/10)
  const type = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return vjDeny(415, 'jpg, png or webp only');
  const buf = await request.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > 6e6) return vjDeny(413, 'photo too large');
  { // C-20261017-PHOTOIMPORT: the bytes must match the declared type (magic bytes), so no other file can be stored as a photo
    const h = new Uint8Array(buf, 0, Math.min(12, buf.byteLength)), a = (i, s) => String.fromCharCode(...h.slice(i, i + s.length)) === s;
    const real = h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff ? 'image/jpeg' : h[0] === 0x89 && a(1, 'PNG') ? 'image/png' : a(0, 'RIFF') && a(8, 'WEBP') ? 'image/webp' : '';
    if (real !== type) return vjDeny(415, 'not a real jpg, png or webp photo');
  }
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
// Phone as copied from a phone (owner 16/10/2026): '+91 98xxx xxxxx', spaces, dashes are fine. A normal 10-digit Indian mobile is kept
// as 10 digits; anything else with 6-13 digits is kept exactly as typed (cleaned), so nothing the owner pasted is lost.
const vjPhone = v => { const s = String(v == null ? '' : v).trim(); let d = s.replace(/\D/g, ''); if (d.length === 12 && d.startsWith('91')) d = d.slice(2); else if (d.length === 11 && d[0] === '0') d = d.slice(1);
  if (/^[6-9]\d{9}$/.test(d)) return d; return d.length >= 6 && d.length <= 13 ? s.replace(/[^0-9+ \-]/g, '').replace(/\s+/g, ' ').slice(0, 18) : ''; };
const vjPhoneTxt = m => /^\d{10}$/.test(String(m || '')) ? '+91 ' + m : String(m || '');
const vjClean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
// C-20261017-QUOTEMODES / POLKI (owner 17/10/2026): the server works out every quote price again from the tags it holds (or, for an
// estimate of a new design, from the weights typed) and today's saved settings; prices sent by the page are never used.
// Same rule as the Quote tab: gold x karat rate, making Rs 650/g (750 when the first gold line is up to 5 g), minimum Rs 1,000,
// + 10% wastage on gold (or flat Rs 1,600/g), diamonds, polki pcs x rate, other; rounded up to Rs 100, + GST, up to Rs 1,000.
const VJ_Q_OPT = { 'Natural VS GH': 'gh', 'Natural VS IJ': 'ij', 'Lab-grown': 'lgd' };
const VJ_Q_NONDIA = /POL|EMR|MOZ|RUBY|PEARL|MOTI|STONE|KUNDAN/i;
const VJ_Q_KARATS = ['14K', '18K', '22K', '9K', '24K'], VJ_Q_QUALS = ['CVD', 'VS IJ', 'VS HI', 'VS GH', 'VVS EF'], VJ_Q_SHAPES = ['Round', 'Choki', 'Fancy', 'Solitaire', 'Polki'];
const VJ_DEF_RATES = { 'CVD|Round': 23000, 'CVD|Choki': 23000, 'CVD|Fancy': 23000, 'CVD|Solitaire': 23000, 'VS GH|Round': 46000, 'VS GH|Choki': 46000, 'VS GH|Fancy': 85000, 'VS HI|Round': 40000, 'VS HI|Choki': 40000, 'VS IJ|Round': 35000, 'VS IJ|Choki': 35000 };
const vjQSt = s => ({ g: Number(s.gold24g) || 0, pur: Object.assign({ '24K': 1, '22K': 0.92, '18K': 0.76, '14K': 0.60, '9K': 0.385 }, s.purity || {}),
  mk: Object.assign({ base: 650, small: 750, limit: 5, pct: 10, min: 1000 }, s.making || {}), gst: s.gst == null ? 3 : Number(s.gst), rates: s.defaultRates && typeof s.defaultRates === 'object' ? s.defaultRates : VJ_DEF_RATES });
const vjQUp = (n, s) => Math.ceil(Math.round(n * 100) / 100 / s) * s;
// C-20261026-QG2G (owner 26/10 19:02): a quote can also be Gold to Gold - W/s (fine = weight x 14K 0.66 / 18K 0.836 / 22K 1.06 / 9K 0.4235, making in rupees)
// or Nett (fine = net x karat purity, making + 10% wastage in rupees); rupees (making, diamonds, polki, other) up to Rs 100, + GST, up to Rs 100.
const VJ_Q_G2G = { '9K': 0.4235, '14K': 0.66, '18K': 0.836, '22K': 1.06, '24K': 1 };
function vjQPay(gold, dv, extra, st, mk, pay) {
  if (pay !== 'g2g' && pay !== 'g2gn') return { price: vjQPrice(gold, dv, extra, st, mk), fine: 0 };
  if (!gold.some(g => g.net > 0) || !st.g) return { price: 0, fine: 0 };
  // C-20261027-CHAINMK (owner 27/10 17:30): a chain's tunch only replaces the karat purity; making, wastage, Nett and Gold to Gold rules apply to it like any line (W/s fine = net x tunch x 1.1)
  const nf = pay === 'g2gn', g0 = gold.find(g => g.net > 0); let gv = 0, nt = 0, fine = 0;
  gold.forEach(g => { if (g.net > 0) { const tn = vjLineT(g), pu = tn || (Number(st.pur[g.k]) || 0); gv += g.net * st.g * pu; nt += g.net; fine += g.net * (nf ? pu : (tn ? tn * 1.1 : (VJ_Q_G2G[g.k] || 0))); } });
  const mv = !g0 ? 0 : mk === 'flat' ? 1600 * nt : Math.max((g0.net > st.mk.limit ? st.mk.base : st.mk.small) * nt, Number(st.mk.min) || 0) + (nf ? gv * st.mk.pct / 100 : 0);
  return { price: vjQUp(vjQUp(mv + dv + extra, 100) * (1 + st.gst / 100), 100), fine: Math.round(fine * 1000) / 1000 };
}
function vjQPrice(gold, dv, extra, st, mk) { // final price incl. GST, or 0 when it cannot be worked out
  if (!gold.some(g => g.net > 0) || !st.g) return 0;
  // chain lines (C-20261017-CHAINTUNCH, changed 27/10 C-20261027-CHAINMK): gold = net x tunch x fine rate (tunch instead of the karat purity);
  // making and 10% wastage apply to every line, chains included (owner: wastage, Nett and Gold to Gold formulae stay)
  const g0 = gold.find(g => g.net > 0); let gv = 0, cv = 0, nt = 0;
  gold.forEach(g => { if (g.net > 0) { const pu = vjLineT(g) || (Number(st.pur[g.k]) || 0); gv += g.net * st.g * pu; nt += g.net; } });
  const mv = !g0 ? 0 : mk === 'flat' ? 1600 * nt : Math.max((g0.net > st.mk.limit ? st.mk.base : st.mk.small) * nt, Number(st.mk.min) || 0) + gv * st.mk.pct / 100;
  return vjQUp(vjQUp(gv + cv + mv + dv + extra, 100) * (1 + st.gst / 100), 1000);
}
const vjQOptRate = (d, opt, st) => { if (d.shape === 'Polki' || VJ_Q_NONDIA.test(String(d.q || '') + ' ' + String(d.code || ''))) return Number(d.rate) || 0; if (opt === 'lgd') return 23000;
  const q = opt === 'gh' ? 'VS GH' : 'VS IJ', sh = ['Round', 'Choki', 'Fancy'].includes(d.shape) ? d.shape : 'Round'; return Number(st.rates[q + '|' + sh]) || Number(st.rates[q + '|Round']) || 0; };
const vjQNum = (v, lo, hi, int) => { if (v === '' || v == null) return null; const n = Number(v); return isFinite(n) && n >= lo && n <= hi && (!int || Number.isInteger(n)) ? n : NaN; };
const vjSmpNet = t => Number(t && t.metal && t.metal.net) || (Array.isArray(t && t.gold) ? t.gold.reduce((a, g) => a + (Number(g && g.net) || 0), 0) : 0); // sample weight: old Onnet samples in metal.net, new-tag samples in gold lines (C-20261019-SAMPLEWT)
const vjLineT = g => { const n = Number(g && g.tunch); return n >= 0.3 && n <= 1.1 ? n : 0; }; // a chain gold line's tunch, else 0 (C-20261017-CHAINTUNCH)
const vjGTxt = n => { const s = String(Math.round(n * 1000) / 1000); return s.includes('.') ? s : s + '.0'; };
async function vjQuote(request, env, who, ctx) {
  if (who.role === 'sales') return vjDeny(403, 'read only');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 40000) return vjDeny(413, 'too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  const name = vjClean(b && b.name, 60), city = vjClean(b && b.city, 40), mobile = String(b && b.mobile || '').replace(/\D/g, '');
  const design = b && b.kind === 'design', mk = b && b.mk === 'flat' ? 'flat' : 'std'; // C-20261027-ESTMK: estimates take the making choice too
  const option = design ? 'Estimate - new design' : (VJ_Q_OPT[b && b.option] ? b.option : '');
  const pay = ['g2g', 'g2gn'].includes(b && b.pay) ? b.pay : 'amount'; // C-20261026-QG2G
  const raw = Array.isArray(b && b.items) ? b.items : [];
  if (!name || !city || !/^(91)?[6-9]\d{9}$/.test(mobile) || !option || !raw.length) return vjDeny(400, 'name, 10-digit mobile, city, option and at least one piece are required');
  if (raw.length > (design ? 10 : 20)) return vjDeny(400, design ? 'at most 10 designs in one estimate' : 'at most 20 pieces in one quote');
  const sRow = await env.DB.prepare("SELECT data FROM docs WHERE path = 'settings/main'").first(), st = vjQSt(sRow ? JSON.parse(sRow.data) : {});
  if (!(st.g > 0)) return vjDeny(400, "today's gold rate is not set (Gold rate & settings)");
  const items = [];
  for (let n = 0; n < raw.length; n++) {
    const i = raw[n] && typeof raw[n] === 'object' ? raw[n] : {}, no = (design ? 'design ' : 'piece ') + (n + 1);
    if (design) {
      const k = VJ_Q_KARATS.includes(i.k) ? i.k : '', net = vjQNum(i.net, 0.001, 1000), other = vjQNum(i.other, 0, 10000000, true) ?? 0;
      const ppcs = vjQNum(i.ppcs, 0, 10000, true) ?? 0, prate = vjQNum(i.prate, 1, 100000, true) ?? 300, tn = vjQNum(i.tunch, 0.3, 1.1) ?? 0; // tunch: a chain (C-20261017-CHAINTUNCH)
      if (!k || !(net > 0)) return vjDeny(400, no + ': karat and net gold weight (g) are needed');
      if (isNaN(tn)) return vjDeny(400, no + ': chain tunch must be a number from 0.30 to 1.10 (e.g. 0.920)');
      if (isNaN(other) || isNaN(ppcs) || isNaN(prate)) return vjDeny(400, no + ': polki pcs 0-10000, rate per pc Rs 1-1,00,000 and other charges must be whole rupees');
      const dl = Array.isArray(i.dias) ? i.dias : []; if (dl.length > 20) return vjDeny(400, no + ': at most 20 diamond lines');
      const dias = [];
      for (const d0 of dl) { const d = d0 && typeof d0 === 'object' ? d0 : {}, q = VJ_Q_QUALS.includes(d.q) ? d.q : '', shape = VJ_Q_SHAPES.includes(d.shape) ? d.shape : '';
        const ct = vjQNum(d.ct, 0.001, 200), pcs = vjQNum(d.pcs, 0, 100000, true) ?? 0, r0 = vjQNum(d.rate, 1, 5000000), rate = r0 === null ? Number(st.rates[q + '|' + shape]) || 0 : r0;
        if (!q || !shape || !(ct > 0) || !(rate > 0) || isNaN(pcs)) return vjDeny(400, no + ': each diamond line needs quality, shape, ct (up to 200), a rate per ct, and whole pcs');
        dias.push({ q, pcs, shape, ct: Math.round(ct * 1000) / 1000, rate: Math.round(rate) }); }
      const dv = dias.reduce((a, d) => a + d.ct * d.rate, 0);
      const tunch = Math.round(tn * 1000) / 1000, pq = vjQPay([{ k, net, tunch }], dv, (ppcs ? ppcs * prate : 0) + other, st, mk, pay), price = pq.price, fine = pq.fine;
      if (!price) return vjDeny(400, no + ': no price');
      items.push({ newDesign: true, desc: vjClean(i.desc, 60) || (tunch ? 'Chain' : 'New design'), k, net: Math.round(net * 1000) / 1000, ...(tunch ? { tunch } : {}), dias, ...(ppcs ? { polki: { pcs: ppcs, rate: prate } } : {}), other, price, fine });
    } else {
      const id = String(i.id || ''); if (!/^[A-Za-z0-9_\-.~]{1,60}$/.test(id) || items.some(x => x.id === id)) return vjDeny(400, no + ': bad piece');
      const row = await env.DB.prepare('SELECT data FROM docs WHERE path = ?').bind('tags/' + id).first(); if (!row) return vjDeny(404, 'a piece is no longer in stock: ' + id);
      const t = JSON.parse(row.data), pk = t.polki && Number(t.polki.pcs) > 0 ? t.polki : null;
      const px = vjQNum(i.prate, 1, 100000, true); if (isNaN(px)) return vjDeny(400, no + ': polki rate per pc Rs 1-1,00,000');
      const prate = px ?? (pk ? Number(pk.rate) || 300 : 0), ppcs = pk ? Number(pk.pcs) || 0 : 0;
      const gold = (t.kind === 'sample' ? [{ k: '14K', net: vjSmpNet(t) }] : (Array.isArray(t.gold) ? t.gold : [])).map(g => ({ k: String(g && g.k || ''), net: Number(g && g.net) || 0, tunch: vjLineT(g) }));
      const dv = (Array.isArray(t.dias) ? t.dias : []).filter(Boolean).reduce((a, d) => a + (Number(d.ct) || 0) * vjQOptRate(d, VJ_Q_OPT[option], st), 0);
      const pq = vjQPay(gold, dv, ppcs * prate + (Number(t.other && t.other.amt) || 0), st, mk, pay), price = pq.price, fine = pq.fine;
      if (!price) return vjDeny(400, 'a piece has no price - check its gold weight and the default diamond rates: ' + (t.label || id));
      items.push({ id, label: vjClean(t.label, 40), design: vjClean(t.designNo, 30), ...(ppcs ? { polki: { pcs: ppcs, rate: prate } } : {}), price, fine });
    }
  }
  const total = items.reduce((a, x) => a + x.price, 0), fineTotal = Math.round(items.reduce((a, x) => a + (x.fine || 0), 0) * 1000) / 1000;
  const ist = new Date(Date.now() + 5.5 * 3600e3), d = ist.toISOString().slice(2, 10).replace(/-/g, '');
  const qno = 'Q-' + d + '-' + [...crypto.getRandomValues(new Uint8Array(4))].map(x => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[x % 31]).join('');
  const doc = { qno, kind: design ? 'design' : 'tags', name, mobile: mobile.slice(-10), city, option, mk, pay, items, total, fineTotal, gold24g: st.g, by: who.email, at: new Date().toISOString() };
  await env.DB.prepare('INSERT INTO docs (path, data, version, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)').bind('quotes/' + qno, JSON.stringify(doc), Date.now(), who.email).run();
  await vjAudit(env, who, 'quote', 'quotes/' + qno, (design ? 'estimate ' : '') + name + ' ' + doc.mobile + ' ' + total);
  if (env.VJ_QUOTE_HOOK && /^https:\/\/hook\.[a-z0-9]+\.make\.com\//.test(env.VJ_QUOTE_HOOK)) {
    const inr = n => 'Rs ' + Number(n).toLocaleString('en-IN'), fg = n => n ? ' + fine gold ' + Number(n).toFixed(3) + ' g' : '';
    const txt = i => i.newDesign ? 'New design: ' + [i.desc + ' ' + i.k + ' ' + vjGTxt(i.net) + ' g' + (i.tunch ? ' tunch ' + i.tunch.toFixed(3) : ''), ...i.dias.map(x => x.ct.toFixed(2) + ' ct ' + x.q), ...(i.polki ? ['Polki ' + i.polki.pcs + ' pc'] : [])].join(', ')
      : (i.design ? i.design + ' (' + i.label + ')' : i.label) + (i.polki ? ', Polki ' + i.polki.pcs + ' pc' : '');
    ctx.waitUntil(fetch(env.VJ_QUOTE_HOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ qno, name, mobile: '+91 ' + doc.mobile, city, option, total: inr(total) + ' incl. GST' + fg(fineTotal) + (pay === 'amount' ? '' : pay === 'g2g' ? ' (Gold to Gold W/s)' : ' (Gold to Gold Nett)'), by: who.name && who.name !== 'Owner' ? who.name : who.email,
        items: items.map(i => txt(i) + ' ' + inr(i.price) + fg(i.fine)).join('; ') }) }).catch(() => {}));
  }
  return vjJson({ ok: true, qno, items: items.map(i => ({ id: i.id || null, price: i.price, fine: i.fine || 0, polki: i.polki || null })), total, fineTotal, pay, gold24g: st.g });
}

// VJ_BILL_CALC_START (same function in tags/bill.js - keep both copies identical)
// Bills (owner 16/10/2026, C-20261016-BILLS / BILLS2), formulas from the owner's bills_and_estimates_1.xlsm sheet 'BILLS DIAMONDS'.
// karat rate = F (fine 24K per g, typed on the bill) x purity. Making per g = Rs 650 if the first gold line is over 5 g, else 750.
// W/s: gold = net x karat rate x 1.10 (10% wastage, none on 24K), making 650/750 per g.
// Nett: gold = net x karat rate, making per g = (650 or 750) + 10% of the karat rate, rounded up to Rs 100.
// Gold to Gold: fine gold due = net x (9K 0.4235, 14K 0.66, 18K 0.836, 22K 1.06, 24K 1), making 650/750 per g in rupees.
// Gold Item: fine gold due = net x (9K 0.54, 14K 0.74, 18K 0.90, 22K 1.06, 24K 1), making already in the gold (none in rupees).
// For Gold to Gold / Gold Item, settle 'fine' = customer gives the fine gold; 'amount' = fine x F is charged in rupees.
// Diamonds = ct x the tag's rate, polki = pcs x rate per pc, plus other charges. Discount (C-20261016-BILLDISC) per piece, rupees or 'n%' of that piece's
// rupee amount, never more than it. Rupee total less discount, rounded UP to Rs 1,000; GST to the nearest rupee.
const VJ_FINE = { g2g: { '9K': 0.4235, '14K': 0.66, '18K': 0.836, '22K': 1.06, '24K': 1 }, item: { '9K': 0.54, '14K': 0.74, '18K': 0.90, '22K': 1.06, '24K': 1 } };
function vjBillCalc(tags, o) {
  const pur = Object.assign({ '24K': 1, '22K': 0.92, '18K': 0.76, '14K': 0.60, '9K': 0.385 }, o.purity || {}); // 9K = 38.5 tunch (owner 26/10 19:00)
  const m = Object.assign({ base: 650, small: 750, limit: 5, pct: 10, min: 1000 }, o.making || {}), F = Number(o.F) || 0;
  const mode = ['ws', 'nett', 'g2g', 'item'].includes(o.mode) ? o.mode : 'ws', fineMode = mode === 'g2g' || mode === 'item';
  const settle = fineMode ? (o.settle === 'amount' ? 'amount' : 'fine') : '';
  const g2gN = mode === 'g2g' && o.g2g === 'nett'; // owner 26/10 18:55 (C-20261026-G2GNETT): Gold to Gold on Nett = fine is net x purity (14K 0.60), making Rs 650/g (750 up to 5 g, min 1,000) + 10% wastage in rupees; on W/s = fine with 10% wastage (14K 0.66) + making
  const gstPct = o.gst == null ? 3 : Number(o.gst);
  const rows = tags.map(t => {
    const gl = (t.kind === 'sample' ? [{ k: '14K', net: vjSmpNet(t) }] : (Array.isArray(t.gold) ? t.gold : []))
      .map(g => ({ k: String(g && g.k || ''), net: Number(g && g.net) || 0, tn: (n => n >= 0.3 && n <= 1.1 ? n : 0)(Number(g && g.tunch)) })).filter(g => g.net > 0);
    const tr0 = Number(t.kind === 'order' && t.order && t.order.rate), trT = tr0 >= 2000 && tr0 <= 50000 ? tr0 : (t.kind === 'order' && Number(t.gold24gAtTag) >= 2000 && Number(t.gold24gAtTag) <= 50000 ? Number(t.gold24gAtTag) : 0), Fo = trT || F; // the gold rate typed on the tag is used; only tags without one use today's rate F (owner 17/10, C-20261017-TAGRATE; was C-20261016-ORDERRATE)
    const Fx = Number(o.frates && o.frates[t.id]), Fr = Fx >= 2000 && Fx <= 50000 ? Fx : Fo; // rate typed for this piece on the bill (C-20261016-PIECERATE)
    // owner 17/10/2026 18:16 / 18:19 (C-20261017-CHAINTUNCH): a gold line marked as a chain (its own tunch tn) is gold = net x tunch x the fine rate,
    // fine gold (Gold to Gold / Gold Item) = net x tunch, with no making and no extra wastage. Making, its 5 g limit (first non-chain line) and the
    // Rs 1,000 minimum apply to the non-chain lines only.
    const kr = k => Fr * (Number(pur[k]) || 0), g0 = gl.find(g => !g.tn);
    let mk = 0;
    // owner 17/10/2026 17:00 (C-20261017-MAKINGMIN): making Rs 650/g (750/g when the first gold line is up to 5 g), never below Rs 1,000 a piece,
    // plus 10% wastage on the gold - in every mode (W/s: wastage in the gold value; Nett: wastage added to the making; Gold to Gold: in the fine factor)
    const b = g0 ? (g0.net > m.limit ? m.base : m.small) : 0; if (g0 && mode !== 'item') mk = b;
    let gold = 0, net = 0, fine = 0, nc = 0, ng = 0;
    gl.forEach(g => { net += g.net;
      if (g.tn) { if (fineMode) fine += g.net * g.tn; else gold += g.net * g.tn * Fr; return; }
      nc += g.net;
      if (fineMode) { fine += g.net * (g2gN ? (Number(pur[g.k]) || 0) : (VJ_FINE[mode][g.k] || 0)); if (g2gN) ng += g.net * kr(g.k); }
      else { const v = g.net * kr(g.k) * (mode === 'ws' && g.k !== '24K' ? 1.1 : 1); gold += v; ng += v; } });
    fine = Math.round(fine * 1000) / 1000;
    if (settle === 'amount') gold = fine * Fr;
    const ov = o.rates && Array.isArray(o.rates[t.id]) ? o.rates[t.id] : []; // rates edited on the bill (C-20261016-BILLALL); the tag is not changed
    const dl = (Array.isArray(t.dias) ? t.dias : []).filter(Boolean).map((d, i) => ({ q: String(d.q || ''), shape: String(d.shape || '').slice(0, 20), ct: Number(d.ct) || 0, tagRate: Number(d.rate) || 0, rate: Number(ov[i]) > 0 ? Number(ov[i]) : Number(ov[i]) === -1 ? 0 : (Number(d.rate) || 0), idx: i })) // -1 = rate typed as 0 on the bill (owner 26/10 18:38: party diamond with no charge)
        .sort((x, y) => { const rk = s => { const v = { round: 0, choki: 1, fancy: 2 }[String(s || '').toLowerCase()]; return v === undefined ? 3 : v; }; return rk(x.shape) - rk(y.shape) || x.idx - y.idx; }); // owner 26/10: Round first, then Choki, then Fancy (C-20261026-DIAORDER)
    const ct = dl.reduce((a, d) => a + d.ct, 0), dia = dl.reduce((a, d) => a + d.ct * d.rate, 0), oth = Number(t.other && t.other.amt) || 0;
    // polki (C-20261017-POLKI): pcs x the tag's rate per pc; the rate can be changed on the bill (prates), the tag is not changed
    const pk = t.polki && typeof t.polki === 'object' ? t.polki : null, ppcs = pk ? Math.max(0, Math.round(Number(pk.pcs) || 0)) : 0, ptag = pk ? Math.round(Number(pk.rate) || 0) : 0;
    const px = Number(o.prates && o.prates[t.id]), prate = ppcs ? (px >= 1 && px <= 100000 ? Math.round(px) : ptag) : 0;
    // party diamond (C-20261026-PARTYDIA, owner 26/10 18:14): the customer's own diamonds - setting charge ct x rate per ct (Rs 3,000 default), rate changeable on the bill (pdrates)
    const pdo = t.pdia && typeof t.pdia === 'object' ? t.pdia : null, pdCt = pdo ? Math.max(0, Math.round((Number(pdo.ct) || 0) * 1000) / 1000) : 0, pdPcs = pdo ? Math.max(0, Math.round(Number(pdo.pcs) || 0)) : 0, pdTag = pdCt ? (Math.round(Number(pdo.rate)) || 3000) : 0;
    const pdx = Number(o.pdrates && o.pdrates[t.id]), pdRate = pdCt ? (pdx >= 1 && pdx <= 100000 ? Math.round(pdx) : pdTag) : 0;
    const r = { id: t.id, label: String(t.label || ''), design: String(t.designNo || ''), cat: String(t.catName || ''),
      gold: gl.map(g => g.k + ' ' + g.net.toFixed(3) + ' g' + (g.tn ? ', tunch ' + g.tn.toFixed(3) : '')).join(' + '), chain: gl.length > 0 && !g0, mkWt: Math.round(nc * 1000) / 1000, F: Fr, Fdef: Fo, orderRate: Fo !== F, rateEdited: Fr !== Fo, net: Math.round(net * 1000) / 1000, fine, goldAmt: Math.round(gold),
      mkRate: 0, making: 0, ct: Math.round(ct * 100) / 100, diaAmt: Math.round(dia), polkiPcs: ppcs, polkiRate: prate, polkiTagRate: ppcs ? ptag : 0, polki: ppcs * prate, pdCt, pdPcs, pdRate, pdTagRate: pdTag, pd: Math.round(pdCt * pdRate), cert: String(t.remark || '').slice(0, 10), certNo: String(t.certNo || '').slice(0, 30), other: Math.round(oth), dias: dl };
    if (g0 && mode !== 'item' && nc > 0) { let mkAmt = Math.max(mk * nc, Number(m.min) || 0); if (mode === 'nett' || g2gN) mkAmt += ng * m.pct / 100; r.making = Math.round(mkAmt); r.mkRate = Math.round(r.making / nc); }
    r.amount = r.goldAmt + r.making + r.diaAmt + r.polki + r.pd + r.other;
    const dv = String(o.disc && o.disc[t.id] != null ? o.disc[t.id] : '').trim(), pm = dv.match(/^(\d+(?:\.\d+)?)\s*%$/), dn = Number(dv.replace(/[,\s]/g, ''));
    r.discTxt = pm ? Math.min(100, Number(pm[1])) + '%' : '';
    r.disc = Math.round(Math.min(r.amount, pm ? r.amount * Math.min(100, Number(pm[1])) / 100 : (dn > 0 ? dn : 0)));
    r.wt = r.net; r.net = r.amount - r.disc;
    return r;
  });
  let sum = rows.reduce((a, r) => a + r.amount, 0); const disc = rows.reduce((a, r) => a + r.disc, 0);
  // owner 27/10/2026 12:39 (C-20261027-OGBAL): Gold to Gold where the customer gives fine gold - the old gold received (OG no. + fine g, typed as a plain
  // plus figure) is set against the fine due; the balance fine x the party's fine gold rate (24K/g, default F) is added in rupees (more gold received = taken off)
  const fineDue = Math.round(rows.reduce((a, r) => a + r.fine, 0) * 1000) / 1000; let og = null;
  if (mode === 'g2g' && settle === 'fine' && o.og && Number(o.og.fine) > 0) { const recv = Math.round(Number(o.og.fine) * 1000) / 1000, rt = Number(o.og.rate) >= 2000 && Number(o.og.rate) <= 50000 ? Number(o.og.rate) : F, bal = Math.round((fineDue - recv) * 1000) / 1000, amt = Math.round(bal * rt);
    og = { no: String(o.og.no || '').slice(0, 20), due: fineDue, recv, bal, rate: rt, amt }; sum += amt; }
  const after = Math.max(0, sum - disc);
  // owner 27/10/2026 13:35 (C-20261027-FINALAMT): a final amount typed for the bill - the discount is set so that total less discount + GST = that
  // amount exactly (no Rs 500 round-up); the bill prints only 'Final amount', the GST inside it stays in the record for the accountant
  const fin = Math.round(Number(o.final) || 0), finOk = fin > 0 && Math.abs((fin - after) - after * gstPct / 100) <= 2;
  const sub = finOk ? after : Math.ceil(after / 500) * 500, gst = finOk ? fin - after : Math.round(sub * gstPct / 100);
  // owner 17/10 15:29 ('i dont want 26093, straight 26500'): the round-up sits inside the biggest piece's making charge (its
  // rate per g is shown for the new making), or in Other for Gold Item / no gold, so every printed figure adds up to the total.
  // A piece that is only chain has no making (C-20261017-CHAINTUNCH): the biggest other piece takes it; a bill of chains only puts it in Other.
  rows.forEach(r => { r.amt0 = r.amount; }); /* C-20261027-FINALAMT: amount before the round-up, for the discount spread */ const roundIn = sub - after;
  if (roundIn > 0 && rows.length) { const rc = rows.some(x => !x.chain) ? rows.filter(x => !x.chain) : rows, r = rc.reduce((a, x) => x.net > a.net ? x : a, rc[0]);
    if (mode !== 'item' && r.mkWt > 0) { r.making += roundIn; r.mkRate = Math.round(r.making / r.mkWt); } else r.other += roundIn;
    r.amount += roundIn; r.net += roundIn; sum += roundIn; }
  const fine = Math.round(rows.reduce((a, r) => a + r.fine, 0) * 1000) / 1000;
  return { mode, settle, g2g: mode === 'g2g' ? (g2gN ? 'nett' : 'ws') : '', rows, fine: settle === 'fine' && !og ? fine : 0, fineIn: fine, og, sum, disc, after, roundOff: 0, roundIn, sub, gstPct, gst, total: sub + gst, final: finOk ? fin : 0 };
}
// VJ_BILL_CALC_END

// owner 26/10/2026 17:38 (C-20261026-SOLD 'why is the product still showing in the stock?'): a piece on a saved Bill (not an Estimate)
// is marked sold on its tag (status 'sold', sold {no, date, name, at}); the stock pages hide sold pieces. Editing the bill moves pieces
// in/out; cancelling the bill puts its pieces back to what they were (soldPrev). Nothing is deleted, so Erase still works as before.
async function vjMarkSold(env, who, ids, info, onlyNo) {
  let n = 0;
  for (const id of ids) {
    if (!/^[A-Za-z0-9_\-.~]{1,60}$/.test(String(id))) continue;
    const path = 'tags/' + id, t = await env.DB.prepare('SELECT data, version FROM docs WHERE path = ?').bind(path).first(); if (!t) continue;
    const d = JSON.parse(t.data);
    if (info) { if (d.status === 'sold' && d.sold && d.sold.no === info.no) continue; if (d.status !== 'sold') d.soldPrev = d.status || 'in_stock'; d.status = 'sold'; d.sold = info; }
    else { if (d.status !== 'sold' || (onlyNo && !(d.sold && d.sold.no === onlyNo))) continue; d.status = d.soldPrev || 'in_stock'; delete d.sold; delete d.soldPrev; }
    const r = await env.DB.prepare('UPDATE docs SET data = ?, version = ?, updated_at = ?, updated_by = ? WHERE path = ? AND version = ?').bind(JSON.stringify(d), t.version + 1, Date.now(), who.email, path, t.version).run();
    if (r.meta && r.meta.changes === 1) { n++; await vjAudit(env, who, 'update', path, info ? 'status sold (bill ' + info.no + ')' : 'status back to ' + d.status + ' (bill ' + (onlyNo || '') + ')'); }
  }
  return n;
}
let vjSoldDone = false;
async function vjSoldBackfill(env, who) { // once per worker start: pieces on bills saved before 26/10/2026 17:45 are marked sold too
  if (vjSoldDone) return; vjSoldDone = true;
  const all = ((await env.DB.prepare("SELECT data FROM vj_bills WHERE no LIKE 'B-%' ORDER BY ts").all()).results) || [];
  for (const x of all) { let b; try { b = JSON.parse(x.data); } catch (e) { continue; } if (!b || b.cancelled) continue;
    await vjMarkSold(env, who, [...new Set((b.rows || []).map(r => String(r.id || '')))], { no: b.no, date: b.date, name: b.name, at: b.at }); }
}

// Bill tab endpoint (C-20261016-BILLS). The page sends only the customer, number, date, gold rate, mode and the piece ids;
// the server recomputes every figure from the tags in D1 and the saved settings, keeps the bill in vj_bills (never sent to the
// sales role), and returns the saved figures, from which the page prints the PDF - so a bill on paper always matches the record.
let vjBillsOk = false;
async function vjBill(request, env, who, ctx) { // every login may make bills (owner 16/10 'Bill can be generated by all')
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 60000) return vjDeny(413, 'too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  if (!vjBillsOk) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)').run(); vjBillsOk = true; }
  const no = String(b && b.no || '').trim().toUpperCase(), name = vjClean(b && b.name, 60), city = vjClean(b && b.city, 40);
  const editNo = String(b && b.edit || '').trim().toUpperCase().slice(0, 20); // owner 26/10/2026 (C-20261026-BILLEDIT): update a saved bill, same number
  const mobile = vjPhone(b && b.mobile);
  const date = String(b && b.date || ''), F = Math.round(Number(b && b.F) * 100) / 100, mode = ['ws', 'nett', 'g2g', 'item'].includes(b && b.mode) ? b.mode : '';
  const settle = b && b.settle === 'amount' ? 'amount' : 'fine';
  const final = Math.round(Number(b && b.final) || 0); if (final && !(final >= 1 && final <= 1e8)) return vjDeny(400, 'final amount looks wrong'); // C-20261027-FINALAMT
  const og = b && b.og && typeof b.og === 'object' && Number(b.og.fine) > 0 ? { no: vjClean(b.og.no, 20), fine: Math.round(Number(b.og.fine) * 1000) / 1000, rate: Math.round(Number(b.og.rate) || 0) } : null; // C-20261027-OGBAL
  if (og && !(og.fine <= 2000)) return vjDeny(400, 'old gold received (fine g) looks wrong');
  if (og && og.rate && !(og.rate >= 2000 && og.rate <= 50000)) return vjDeny(400, 'party fine gold rate per g looks wrong');
  const title = b && b.title === 'Estimate' ? 'Estimate' : 'Bill';
  const ids = Array.isArray(b && b.ids) ? [...new Set(b.ids.map(String))].filter(i => !/^new-/.test(i)).slice(0, 25) : [];
  // owner 27/10/2026 17:39 (C-20261027-ESTBILL): an Estimate may also carry NEW DESIGNS typed without a tag (same shape as the quote's estimate:
  // karat, net, chain tunch, diamond lines with pcs / ct / rate, polki pcs x rate, other); each becomes a piece new-1, new-2 … priced by vjBillCalc
  // like a tag. A 'diamonds' choice (gh / ij / lgd) prices every diamond line from the default rates; 'usd' (Rs per US$) is kept for the PDF only.
  const dIn = Array.isArray(b && b.designs) ? b.designs.slice(0, 10) : [], vtags = [];
  if (dIn.length && title !== 'Estimate') return vjDeny(400, 'a new design (no tag) can only go on an Estimate');
  for (let n = 0; n < dIn.length; n++) { const i = dIn[n] && typeof dIn[n] === 'object' ? dIn[n] : {}, no = 'new design ' + (n + 1);
    const k = VJ_Q_KARATS.includes(i.k) ? i.k : '', net = vjQNum(i.net, 0.001, 1000), other = vjQNum(i.other, 0, 10000000, true) ?? 0;
    const ppcs = vjQNum(i.ppcs, 0, 10000, true) ?? 0, prate = vjQNum(i.prate, 1, 100000, true) ?? 300, tn = vjQNum(i.tunch, 0.3, 1.1) ?? 0;
    if (!k || !(net > 0)) return vjDeny(400, no + ': karat and net gold weight (g) are needed');
    if (isNaN(tn) && Number(i.tunch) !== 0) return vjDeny(400, no + ': chain tunch must be a number from 0.30 to 1.10 (e.g. 0.920)');
    if (isNaN(other) || isNaN(ppcs) || isNaN(prate)) return vjDeny(400, no + ': polki pcs 0-10000, rate per pc Rs 1-1,00,000 and other charges must be whole rupees');
    const dl = Array.isArray(i.dias) ? i.dias : []; if (dl.length > 20) return vjDeny(400, no + ': at most 20 diamond lines');
    const dias = [];
    for (const d0 of dl) { const d = d0 && typeof d0 === 'object' ? d0 : {}, q = VJ_Q_QUALS.includes(d.q) ? d.q : '', shape = VJ_Q_SHAPES.includes(d.shape) ? d.shape : '';
      const ct = vjQNum(d.ct, 0.001, 200), pcs = vjQNum(d.pcs, 0, 100000, true) ?? 0, r0 = vjQNum(d.rate, 0, 5000000), rate = r0 === null ? 0 : r0;
      if (!q || !shape || !(ct > 0) || isNaN(rate) || isNaN(pcs)) return vjDeny(400, no + ': each diamond line needs quality, shape, ct (up to 200), a rate per ct, and whole pcs');
      dias.push({ q, pcs, shape, ct: Math.round(ct * 1000) / 1000, rate: Math.round(rate) }); }
    const tunch = isNaN(tn) ? 0 : Math.round(tn * 1000) / 1000, src = { desc: vjClean(i.desc, 60), k, net: Math.round(net * 1000) / 1000, tunch, dias, ppcs, prate, other };
    vtags.push({ id: 'new-' + (n + 1), label: src.desc || (tunch ? 'Chain' : 'New design'), designNo: '', catName: 'New design', kind: 'design', newDesign: true, src,
      gold: [{ k, net: src.net, ...(tunch ? { tunch } : {}) }], dias, ...(ppcs ? { polki: { pcs: ppcs, rate: prate } } : {}), ...(other ? { other: { amt: other } } : {}) }); }
  const option = ['gh', 'ij', 'lgd'].includes(b && b.option) ? b.option : '', usd0 = Math.round(Number(b && b.usd) * 100) / 100, usd = usd0 >= 50 && usd0 <= 200 ? usd0 : 0;
  const cust = ['mihir', 'shilpi', 'abhinav'].includes(b && b.cust) ? b.cust : ''; // C-20261027-ESTOWNER: whose customer (for the follow-up reminder and the morning report)
  const allIds = ids.concat(vtags.map(t => t.id));
  const disc = {}; if (b && b.disc && typeof b.disc === 'object') for (const id of allIds) if (b.disc[id] != null) disc[id] = String(b.disc[id]).slice(0, 12);
  const frates = {}; if (b && b.frates && typeof b.frates === 'object') for (const id of allIds) { const n = Math.round(Number(b.frates[id]) * 100) / 100; if (n >= 2000 && n <= 50000) frates[id] = n; }
  const rates = {}; if (b && b.rates && typeof b.rates === 'object') for (const id of allIds) if (Array.isArray(b.rates[id])) rates[id] = b.rates[id].slice(0, 30).map(v => { const n = Number(v); return n === -1 ? -1 : n > 0 && n <= 5000000 ? Math.round(n) : 0; });
  const prates = {}; if (b && b.prates && typeof b.prates === 'object') for (const id of allIds) if (b.prates[id] != null && b.prates[id] !== '') { // polki rate per pc for this bill only (C-20261017-POLKI)
    const n = Number(b.prates[id]); if (!Number.isInteger(n) || n < 1 || n > 100000) return vjDeny(400, 'polki rate per pc must be a whole number Rs 1-1,00,000'); prates[id] = n; }
  const pdrates = {}; if (b && b.pdrates && typeof b.pdrates === 'object') for (const id of allIds) if (b.pdrates[id] != null && b.pdrates[id] !== '') { // party diamond setting rate per ct for this bill only (C-20261026-PARTYDIA)
    const n = Number(b.pdrates[id]); if (!Number.isInteger(n) || n < 1 || n > 100000) return vjDeny(400, 'party diamond setting rate per ct must be a whole number Rs 1-1,00,000'); pdrates[id] = n; }
  // owner 16/10/2026 20:03 'Bill no should be automatic. Every month starts with number 1': bills are numbered by the server too
  if (!name) return vjDeny(400, 'customer name is required');
  if (b && b.mobile && String(b.mobile).trim() && !mobile) return vjDeny(400, 'mobile number not readable');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return vjDeny(400, 'bad date');
  if (!(F >= 2000 && F <= 50000)) return vjDeny(400, 'gold rate (F) per g looks wrong');
  if (!mode) return vjDeny(400, 'choose W/s, Nett, Gold to Gold or Gold Item');
  if ((!ids.length && !vtags.length) || ids.some(i => !/^[A-Za-z0-9_\-.~]{1,60}$/.test(i))) return vjDeny(400, 'add at least one piece');
  const tags = [];
  for (const id of ids) {
    const row = await env.DB.prepare('SELECT data FROM docs WHERE path = ?').bind('tags/' + id).first();
    if (!row) return vjDeny(404, 'a piece is no longer in stock: ' + id);
    tags.push(Object.assign({ id }, JSON.parse(row.data)));
  }
  // C-20261017-NODUPBILL (owner 17/10/2026 'no duplicate bills for same tag'): a piece already on a Bill that is not cancelled
  // cannot go on another Bill until that bill is cancelled. Estimates are not limited and do not block a Bill.
  const onBill = async () => { const hit = new Map();
    (((await env.DB.prepare("SELECT no, data FROM vj_bills WHERE no LIKE 'B-%' ORDER BY ts").all()).results) || []).forEach(x => {
      let d; try { d = JSON.parse(x.data); } catch (e) { return; } if (!d || d.cancelled || (editNo && d.no === editNo)) return;
      (d.rows || []).forEach(r => { const id = String(r.id || ''); if (ids.includes(id) && !hit.has(id)) hit.set(id, d); }); });
    return hit; };
  const dupMsg = hit => { const [id, d] = [...hit.entries()][0], t = tags.find(x => x.id === id) || {};
    const dd = String(d.date || '').split('-').reverse().join('-');
    return `this piece is already billed: ${String(t.label || t.designNo || id)} is on ${d.no} (${dd}, ${d.name || ''}). Cancel that bill first if it must be billed again.` + (hit.size > 1 ? ` ${hit.size - 1} more piece${hit.size > 2 ? 's are' : ' is'} also already billed.` : ''); };
  if (title === 'Bill') { const hit = await onBill(); if (hit.size) return vjJson({ error: dupMsg(hit), duplicate: true }, 409); }
  const sRow = await env.DB.prepare("SELECT data FROM docs WHERE path = 'settings/main'").first();
  const s = sRow ? JSON.parse(sRow.data) : {};
  vtags.forEach(t => tags.push(t)); // C-20261027-ESTBILL: the typed designs are priced like tags
  if (option) { const stQ = vjQSt(s); tags.forEach(t => { t.dias = (Array.isArray(t.dias) ? t.dias : []).filter(Boolean).map(d => Object.assign({}, d, { rate: vjQOptRate(d, option, stQ) })); }); } // diamonds choice (C-20261027-ESTBILL)
  const calc = vjBillCalc(tags, { F, mode, settle, g2g: b && b.g2g === 'nett' ? 'nett' : 'ws', disc, rates, frates, prates, pdrates, og, final, purity: s.purity, making: s.making, gst: s.gst });
  calc.rows.forEach((r, i) => { const ph = tags[i].photo; if (typeof ph === 'string' && /^[0-9a-f]{32}$/.test(ph)) r.photo = ph; if (tags[i].src) r.src = tags[i].src; }); // owner 16/10: photo on the bill; src = the typed design (C-20261027-ESTBILL)
  const bill = Object.assign({ no, title, date, name, city, mobile, F, nbb: !!(b && b.nbb === true), by: who.email, byName: who.name, at: new Date().toISOString(), ...(option ? { option } : {}), ...(usd ? { usd } : {}), ...(cust ? { cust } : {}) }, calc); // nbb: 'No Buy Back No Exchange' stamp (owner 17/10, C-20261017-NBB)
  if (editNo) { // C-20261026-BILLEDIT (owner 26/10/2026 17:32 'i should be able to edit the bill'): owners only; the old version is kept in vj_bill_old
    if (who.role !== 'admin') return vjDeny(403, 'only Abhinav or Shilpiji can edit a saved bill');
    const old = await env.DB.prepare('SELECT ts, email, data FROM vj_bills WHERE no = ?').bind(editNo).first();
    if (!old) return vjDeny(404, 'bill ' + editNo + ' not found');
    let od; try { od = JSON.parse(old.data); } catch (e) { return vjDeny(500, 'saved bill unreadable'); }
    if (od.cancelled) return vjDeny(409, 'a cancelled bill cannot be edited');
    if (od.settled || od.original) return vjDeny(409, 'a settled bill cannot be edited');
    if ((od.title || 'Bill') !== title) return vjDeny(400, 'a bill stays a bill (and an estimate an estimate) when edited');
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bill_old (no TEXT, ts INTEGER, email TEXT, data TEXT)').run();
    bill.no = editNo; bill.firstAt = od.firstAt || od.at; bill.firstBy = od.firstBy || od.by;
    bill.edits = (Array.isArray(od.edits) ? od.edits : []).concat([{ at: bill.at, by: who.email, byName: who.name, oldTotal: od.total, newTotal: bill.total }]).slice(-20);
    await env.DB.batch([env.DB.prepare('INSERT INTO vj_bill_old (no, ts, email, data) VALUES (?, ?, ?, ?)').bind(editNo, Date.now(), who.email, old.data),
      env.DB.prepare('UPDATE vj_bills SET data = ? WHERE no = ?').bind(JSON.stringify(bill), editNo)]);
    await vjAudit(env, who, 'bill-edit', 'bills/' + editNo, `${od.total} -> ${bill.total} | ${name} ${mobile} | ${ids.join(',')}`);
    if (title === 'Bill') { const oldIds = [...new Set((od.rows || []).map(r => String(r.id || '')))];
      await vjMarkSold(env, who, oldIds.filter(i => !ids.includes(i)), null, editNo); await vjMarkSold(env, who, ids, { no: editNo, date, name, at: bill.at }); } // C-20261026-SOLD
    return vjJson({ ok: true, bill, edited: true });
  }
  // C-20261016-BILLBOOK / BILLAUTO: bills B-YYMM-NN and estimates E-YYMM-NN are numbered automatically, from 01 every month (by the date)
  for (let i = 0; ; i++) {
    {
      const px = (title === 'Estimate' ? 'E-' : 'B-') + date.slice(2, 4) + date.slice(5, 7) + '-';
      const used = ((await env.DB.prepare('SELECT no FROM vj_bills WHERE no LIKE ?').bind(px + '%').all()).results) || [];
      bill.no = px + String(used.reduce((a, r) => Math.max(a, parseInt(String(r.no).slice(px.length), 10) || 0), 0) + 1).padStart(2, '0');
    }
    const res = await env.DB.prepare('INSERT INTO vj_bills (no, ts, email, data) VALUES (?, ?, ?, ?) ON CONFLICT(no) DO NOTHING').bind(bill.no, Date.now(), who.email, JSON.stringify(bill)).run();
    if (res.meta && res.meta.changes === 1) break;
    if (i >= 5) return vjJson({ error: 'could not give a number, try again' }, 409);
  }
  if (title === 'Bill') { // two saves at the same moment: the earlier bill keeps the piece, this one is taken back (C-20261017-NODUPBILL)
    const hit = await onBill(); for (const d of hit.values()) if (d.no !== bill.no) {
      await env.DB.prepare('DELETE FROM vj_bills WHERE no = ? AND ts IS NOT NULL').bind(bill.no).run();
      return vjJson({ error: dupMsg(new Map([...hit].filter(([, x]) => x.no !== bill.no))), duplicate: true }, 409);
    }
  }
  if (title === 'Bill') await vjMarkSold(env, who, ids, { no: bill.no, date, name, at: bill.at }); // C-20261026-SOLD: billed pieces leave stock
  await vjAudit(env, who, 'bill', 'bills/' + bill.no, `${title} ${mode}${calc.settle ? '/' + calc.settle : ''} ${name} ${mobile} ${calc.total}${calc.fine ? ' + ' + calc.fine + ' g fine' : ''}${calc.disc ? ' disc ' + calc.disc : ''} | ${ids.join(',')}`);
  await vjContactPush(env, ctx, { name, mobile, city, type: title === 'Bill' ? 'Customer' : 'Visitor', src: 'VJ Tags ' + title + ' ' + bill.no }); // C-20261026-CONTACTS
  return vjJson({ ok: true, bill });
}

// Cancel a bill / estimate (C-20261016-BILLCANCEL): owners only, with a reason. Never deleted, number never reused; marked cancelled.
const VJ_CANCEL_REASONS = ['Customer cancelled', 'Wrong entry', 'Made again', 'Other'];
async function vjBillCancel(request, env, who) { // choice 2 (cancel only) for every login - owner 16/10 '2 can be done by all'; choice 3 owners only
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  if (b && b.stock && who.role !== 'admin') return vjDeny(403, 'owner only');
  const no = String(b && b.no || '').slice(0, 20), reason = VJ_CANCEL_REASONS.includes(b && b.reason) ? b.reason : '', note = vjClean(b && b.note, 120);
  const stock = !!(b && b.stock); // C-20261016-BILL3WAY choice 3: also move the bill's order pieces to stock
  if (!vjBillsOk) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)').run(); vjBillsOk = true; }
  const row = await env.DB.prepare('SELECT data FROM vj_bills WHERE no = ?').bind(no).first();
  if (!row) return vjDeny(404, 'not found');
  const bill = JSON.parse(row.data), byName = who.role === 'admin' ? (who.email === 'vaishnavijewels@gmail.com' ? 'Shilpiji' : 'Abhinav') : (who.name || String(who.email).split('@')[0]);
  if (who.role === 'sales' && bill.by !== who.email) return vjDeny(404, 'not found'); // a sales login only handles its own bills
  if (bill.cancelled && !stock) return vjJson({ error: 'already cancelled' }, 409);
  if (!bill.cancelled) { // C-20261017-LEDGER (owner 17/10): a bill with receipts or a settlement is not cancelled
    if (bill.settled) return vjJson({ error: 'this bill is settled; Abhinav must un-settle it first' }, 409);
    const rc = await vjBillRc(env, no); if (rc.length) return vjJson({ error: `this bill has ${rc.length} receipt${rc.length === 1 ? '' : 's'} (${rc.map(r => r.no).join(', ')}): move or reverse the receipts first` }, 409);
  }
  if (!bill.cancelled) {
    if (!reason) return vjDeny(400, 'reason required');
    if (reason === 'Other' && !note) return vjDeny(400, 'write the reason');
    bill.cancelled = { reason, note, by: who.email, byName, at: new Date().toISOString() };
    const res = await env.DB.prepare('UPDATE vj_bills SET data = ? WHERE no = ? AND data = ?').bind(JSON.stringify(bill), no, row.data).run();
    if (!res.meta || res.meta.changes !== 1) return vjJson({ error: 'changed meanwhile, try again' }, 409);
    await vjAudit(env, who, 'bill-cancel', 'bills/' + no, reason + (note ? ' - ' + note : '') + ' | ' + bill.total);
    await vjMarkSold(env, who, [...new Set((bill.rows || []).map(r => String(r.id || '')))], null, no); // C-20261026-SOLD: a cancelled bill's pieces go back to stock
  }
  let moved = 0;
  if (stock) for (const id of [...new Set((bill.rows || []).map(r => String(r.id || '')))]) {
    const path = 'tags/' + id, t = await env.DB.prepare('SELECT data, version FROM docs WHERE path = ?').bind(path).first();
    if (!t) continue; const d = JSON.parse(t.data); if (d.kind !== 'order') continue;
    const o = d.order || {};
    d.orderCancelled = { name: vjClean(o.name, 60), mobile: vjPhone(o.mobile), city: vjClean(o.city, 40), due: /^\d{4}-\d{2}-\d{2}$/.test(String(o.due || '')) ? o.due : '', at: new Date().toISOString(), by: who.email };
    delete d.order; d.kind = 'sale'; d.status = 'in_stock';
    const r = await env.DB.prepare('UPDATE docs SET data = ?, version = ?, updated_at = ?, updated_by = ? WHERE path = ? AND version = ?').bind(JSON.stringify(d), t.version + 1, Date.now(), who.email, path, t.version).run();
    if (r.meta && r.meta.changes === 1) { moved++; await vjAudit(env, who, 'update', path, 'kind,status,order,orderCancelled (bill ' + no + ' cancelled, moved to stock)'); }
  }
  return vjJson({ ok: true, bill, moved });
}

// Permanent erase (C-20261016-BILLERASE, owner 16/10/2026): owners only, the bill number typed again to confirm. Removes the bill,
// every tag on it, their photos, deleted-copies, change history and audit lines - no copy kept. One content-free trace line stays
// (who and when, how many pieces; no customer, amount or tag), so an erase by anyone else would still be noticed.
async function vjBillErase(request, env, who) {
  if (who.role !== 'admin') return vjDeny(403, 'owner only');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  const no = String(b && b.no || '').slice(0, 20);
  if (!no || String(b && b.confirm || '').trim().toUpperCase() !== no.toUpperCase()) return vjDeny(400, 'type the bill number to confirm');
  if (!vjBillsOk) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)').run(); vjBillsOk = true; }
  await vjTables(env);
  const row = await env.DB.prepare('SELECT data FROM vj_bills WHERE no = ?').bind(no).first();
  if (!row) return vjDeny(404, 'not found');
  const bill = JSON.parse(row.data), ids = [...new Set((bill.rows || []).map(r => String(r.id || '')).filter(i => /^[A-Za-z0-9_\-.~]{1,60}$/.test(i)))];
  { const rc = await vjBillRc(env, no); if (rc.length || bill.settled) return vjJson({ error: bill.settled ? 'this bill is settled; un-settle it first' : 'this bill has receipts (' + rc.map(r => r.no).join(', ') + '): move or reverse the receipts first' }, 409); } // C-20261017-LEDGER
  const photos = [], now = Date.now(), st = [env.DB.prepare('DELETE FROM vj_bills WHERE no = ?').bind(no), env.DB.prepare('DELETE FROM audit WHERE path = ?').bind('bills/' + no)];
  for (const id of ids) {
    const path = 'tags/' + id, t = await env.DB.prepare('SELECT data FROM docs WHERE path = ?').bind(path).first();
    if (t) { const ph = JSON.parse(t.data).photo; if (typeof ph === 'string' && /^[0-9a-f]{32}$/.test(ph)) photos.push(ph); }
    const dc = ((await env.DB.prepare('SELECT data FROM vj_deleted WHERE path = ?').bind(path).all()).results) || [];
    dc.forEach(d => { try { const ph = JSON.parse(d.data).photo; if (typeof ph === 'string' && /^[0-9a-f]{32}$/.test(ph)) photos.push(ph); } catch (e) {} });
    st.push(env.DB.prepare('DELETE FROM docs WHERE path = ?').bind(path),
      env.DB.prepare('INSERT INTO tomb (path, deleted_at) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET deleted_at = excluded.deleted_at').bind(path, now), // phones drop it on next sync
      env.DB.prepare('DELETE FROM vj_deleted WHERE path = ?').bind(path), env.DB.prepare('DELETE FROM vj_changes WHERE path = ?').bind(path),
      env.DB.prepare('DELETE FROM audit WHERE path = ?').bind(path));
  }
  await env.DB.batch(st);
  for (const ph of new Set(photos)) { try { await env.PHOTOS.delete(ph); } catch (e) {} }
  await vjAudit(env, who, 'erase', 'erased', (bill.title === 'Estimate' ? 'estimate' : 'bill') + ' erased, ' + ids.length + ' piece' + (ids.length === 1 ? '' : 's'));
  return vjJson({ ok: true, pieces: ids.length });
}

// Send a bill / estimate PDF to the customer on WhatsApp from Aashvi (owner 17/10/2026, C-20261017-BILLWA).
// The page sends the PDF it made; the server checks the saved bill, keeps the PDF under a random one-time token (30 min) and rings
// the existing Make hook (VJ_QUOTE_HOOK) with ONLY {kind, token}. Make then fetches /hooks/vj-billpdf?t=token, which hands out the
// customer's number (from the saved bill, never from the hook) and the PDF once; Make sends template vj_bill_pdf_v1 and reports to
// /hooks/vj-billpdf-done. Someone holding the hook URL cannot choose a number or a file: tokens are 128-bit, single-use, 30 min.
const VJ_BWA_TTL = 30 * 60e3;
// C-20261017-QUOTEWA (owner 17/10): quotes Q-yymmdd-XXXX are read from docs 'quotes/<no>'; same template vj_bill_pdf_v1 ("Your Quotation no. ...")
const vjSendRow = (env, no, isR) => /^Q-/.test(no) ? env.DB.prepare('SELECT data FROM docs WHERE path = ?').bind('quotes/' + no).first()
  : env.DB.prepare(isR ? 'SELECT data FROM vj_receipts WHERE no = ?' : 'SELECT data FROM vj_bills WHERE no = ?').bind(no).first();
function vjSendDoc(no, row) { const d = JSON.parse(row.data); if (!/^Q-/.test(no)) return d;
  return Object.assign({}, d, { no, title: d.kind === 'design' ? 'Estimate' : 'Quotation', date: '20' + no.slice(2, 4) + '-' + no.slice(4, 6) + '-' + no.slice(6, 8), mobile: String(d.mobile || '').replace(/\D/g, '').slice(-10) }); }
const vjMetaT = env => env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_meta (k TEXT PRIMARY KEY, v TEXT)').run();
async function vjBillSend(request, env, who) {
  const len = Number(request.headers.get('content-length') || 0);
  if (!len || len > 7e6) return vjDeny(413, 'the PDF is too large to send');
  if (!env.VJ_QUOTE_HOOK || !/^https:\/\/hook\.[a-z0-9]+\.make\.com\//.test(env.VJ_QUOTE_HOOK)) return vjJson({ error: 'WhatsApp sending is not set up' }, 503);
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  const no = String(b && b.no || '').trim().toUpperCase().slice(0, 20);
  const isQ = /^Q-\d{6}-[2-9A-Z]{4}$/.test(no); // C-20261017-QUOTEWA: a saved quote / estimate goes the same way (from docs quotes/)
  if (!isQ && !/^[BER]-\d{4}-\d{2,4}$/.test(no)) return vjDeny(400, 'bad bill number'); // R = receipt (C-20261017-LEDGER)
  if (!vjBillsOk) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)').run(); vjBillsOk = true; }
  const isR = no[0] === 'R'; if (isR) await vjRcT(env); // C-20261017-LEDGER: a receipt slip goes the same way (from vj_receipts)
  const row = await vjSendRow(env, no, isR);
  if (!row) return vjDeny(404, 'not found');
  const bill = vjSendDoc(no, row);
  if (!isR && who.role === 'sales' && bill.by !== who.email) return vjDeny(404, 'not found'); // a sales login only handles its own bills (receipts: every login)
  if (bill.cancelled) return vjJson({ error: 'this bill is cancelled' }, 409);
  if (isR && (bill.reversed || bill.mode === 'adjust')) return vjJson({ error: bill.reversed ? 'this receipt is reversed' : 'an adjustment has no slip to send' }, 409);
  if (!/^[6-9]\d{9}$/.test(String(bill.mobile || ''))) return vjJson({ error: 'the bill has no 10-digit Indian mobile number' }, 400);
  let bytes; try { const s = String(b.pdf || ''); if (s.length > 7e6) throw new Error('big'); bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0)); } catch (e) { return vjDeny(400, 'bad PDF'); }
  if (bytes.length < 500 || bytes.length > 5e6 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') return vjDeny(400, 'bad PDF');
  await vjMetaT(env);
  // tidy: PDFs never collected by Make are removed after 30 minutes (customer data is not kept)
  try { const old = ((await env.DB.prepare("SELECT k, v FROM vj_meta WHERE k LIKE 'billsend:%' AND v LIKE '%\"status\":\"queued\"%' LIMIT 30").all()).results) || [];
    for (const o of old) { const s = JSON.parse(o.v); if (Date.now() - s.at > VJ_BWA_TTL) { try { await env.PHOTOS.delete('billpdf-' + o.k.slice(9)); } catch (e) {} await env.DB.prepare('UPDATE vj_meta SET v = ? WHERE k = ?').bind(JSON.stringify(Object.assign(s, { status: 'expired' })), o.k).run(); } } } catch (e) {}
  const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), ck = 'billsend-count:' + no + ':' + day;
  const cnt = Number(((await env.DB.prepare('SELECT v FROM vj_meta WHERE k = ?').bind(ck).first()) || {}).v || 0);
  if (cnt >= 3) return vjJson({ error: 'this bill was already sent 3 times today' }, 429);
  const token = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
  await vjPhotoPut(env, 'billpdf-' + token, bytes, 'application/pdf', { no });
  await env.DB.batch([
    env.DB.prepare('INSERT INTO vj_meta (k, v) VALUES (?, ?)').bind('billsend:' + token, JSON.stringify({ no, status: 'queued', at: Date.now(), by: who.email })),
    env.DB.prepare('INSERT INTO vj_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT)').bind(ck, '1')]);
  let ok = false;
  try { const r = await fetch(env.VJ_QUOTE_HOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ kind: 'bill-pdf', token }) }); ok = r.ok; } catch (e) {}
  await vjAudit(env, who, 'bill-whatsapp', (isR ? 'receipts/' : isQ ? 'quotes/' : 'bills/') + no, (ok ? 'queued' : 'hook failed') + ' to +91 ' + bill.mobile);
  if (!ok) { try { await env.PHOTOS.delete('billpdf-' + token); } catch (e) {} return vjJson({ error: 'could not reach Aashvi, try again' }, 502); }
  return vjJson({ ok: true, token, to: '+91 ' + bill.mobile });
}
async function vjBillSendStatus(url, env) {
  const t = String(url.searchParams.get('t') || ''); if (!/^[a-f0-9]{32}$/.test(t)) return vjDeny(400, 'bad');
  await vjMetaT(env); const r = await env.DB.prepare('SELECT v FROM vj_meta WHERE k = ?').bind('billsend:' + t).first(); if (!r) return vjDeny(404, 'not found');
  const s = JSON.parse(r.v); return vjJson({ ok: true, status: s.status, error: s.err || '' });
}
// Make side (outside Cloudflare Access): one-time hand-out of the number + PDF, then the result
// C-20261026-CONTACTS (owner 26/10 19:02): every customer made in VJ Tags goes to the main contacts DB (VJ_Contacts_DB) - Bill / order =
// Customer, Estimate = Visitor; matched by phone only, the bill name is final. Make 8188589 collects it with a one-time token.
async function vjContactPush(env, ctx, c) {
  try {
    const d = String(c && c.mobile || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''), name = String(c && c.name || '').trim().replace(/\s*ji$/i, '').slice(0, 60);
    if (!/^[6-9]\d{9}$/.test(d) || !name) return;
    await vjMetaT(env);
    const token = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('INSERT INTO vj_meta (k, v) VALUES (?, ?)').bind('contact:' + token, JSON.stringify({ name, phone: '91' + d, city: vjClean(c.city, 40), type: c.type === 'Visitor' ? 'Visitor' : 'Customer', src: vjClean(c.src, 60), at: Date.now() })).run();
    // Make scenario 8188589 (hook 3980538). Only the random token is sent; the scenario fetches the contact once from /hooks/vj-contact, so a stranger
    // posting to this hook gets nothing and can add nothing.
    const p = fetch('https://hook.eu1.make.com/fm6vpfid6yh8ist1jrl7e2n39tsno1nl', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ token }) }).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  } catch (e) {}
}
async function vjSummaryHook(url, env) { // C-20261026-TAGSUMMARY: one-time hand-out of the daily tags summary (counts and totals only)
  const t = String(url.searchParams.get('t') || ''); if (!/^[a-f0-9]{32}$/.test(t)) return reply('not found', 404);
  await vjMetaT(env);
  const r = await env.DB.prepare('SELECT v FROM vj_meta WHERE k = ?').bind('summary:' + t).first(); if (!r) return reply('gone', 410);
  const del = await env.DB.prepare('DELETE FROM vj_meta WHERE k = ? AND v = ?').bind('summary:' + t, r.v).run(); if (!del.meta || del.meta.changes !== 1) return reply('gone', 410);
  const s = JSON.parse(r.v); if (Date.now() - s.at > 3600e3) return reply('gone', 410);
  return vjJson({ text: s.text, date: s.date });
}
async function vjContactHook(url, env) {
  const t = String(url.searchParams.get('t') || ''); if (!/^[a-f0-9]{32}$/.test(t)) return reply('not found', 404);
  await vjMetaT(env);
  const r = await env.DB.prepare('SELECT v FROM vj_meta WHERE k = ?').bind('contact:' + t).first(); if (!r) return reply('gone', 410);
  const del = await env.DB.prepare('DELETE FROM vj_meta WHERE k = ? AND v = ?').bind('contact:' + t, r.v).run(); if (!del.meta || del.meta.changes !== 1) return reply('gone', 410);
  const s = JSON.parse(r.v); if (Date.now() - s.at > 3600e3) return reply('gone', 410);
  return vjJson({ name: s.name, phone: s.phone, city: s.city, type: s.type, src: s.src });
}
async function vjBillPdfHook(url, env, done) {
  const t = String(url.searchParams.get('t') || ''); if (!/^[a-f0-9]{32}$/.test(t)) return reply('not found', 404);
  await vjMetaT(env);
  const r = await env.DB.prepare('SELECT v FROM vj_meta WHERE k = ?').bind('billsend:' + t).first(); if (!r) return reply('not found', 404);
  const s = JSON.parse(r.v);
  if (!done) {
    if (s.status !== 'queued' || Date.now() - s.at > VJ_BWA_TTL) return reply('gone', 410);
    const u = await env.DB.prepare('UPDATE vj_meta SET v = ? WHERE k = ? AND v = ?').bind(JSON.stringify(Object.assign({}, s, { status: 'fetched', fetchedAt: Date.now() })), 'billsend:' + t, r.v).run();
    if (!u.meta || u.meta.changes !== 1) return reply('gone', 410);
    const isR = /^R-/.test(s.no); if (isR) await vjRcT(env); // C-20261017-LEDGER: receipts
    const row = await vjSendRow(env, s.no, isR), bill = row ? vjSendDoc(s.no, row) : null;
    const f = await vjPhotoGet(env, 'billpdf-' + t);
    if (!bill || bill.cancelled || bill.reversed || !f || !/^[6-9]\d{9}$/.test(String(bill.mobile || ''))) return reply('gone', 410);
    const buf = await new Response(f.body).arrayBuffer();
    const clean = v => String(v || '').replace(/[\u0000-\u001f"\\<>{}]/g, ' ').replace(/\s+/g, ' ').trim();
    const name = clean(bill.name).slice(0, 60) || 'Customer', title = isR ? 'Receipt' : bill.title === 'Estimate' || bill.title === 'Quotation' ? bill.title : 'Bill';
    const date = String(bill.date || '').split('-').reverse().join('-'), total = isR && !(Number(bill.amount) > 0) ? Number(bill.fine || 0).toFixed(3) + ' g fine gold' : 'Rs ' + Number((isR ? bill.amount : bill.total) || 0).toLocaleString('en-IN');
    // template + params in body order (C-20261017-LEDGER): bills [name, title, no, date, total]; receipts [name, receipt no, amount, date, against]
    const params = (isR ? [name, bill.no, total, date, bill.bill || 'your account'] : [name, title, bill.no, date, total]).map(v => clean(v).slice(0, 200));
    return new Response(JSON.stringify({ to: '91' + bill.mobile, name, title, no: bill.no, date,
      total, fileName: (title + ' ' + bill.no + ' ' + name.replace(/[^A-Za-z0-9 .\-]/g, '')).trim().slice(0, 80) + '.pdf', template: isR ? 'vj_receipt_pdf_v1' : 'vj_bill_pdf_v1', params, pdf: vjB64(buf) }),
      { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
  if (s.status !== 'fetched') return reply('gone', 410);
  const ok = url.searchParams.get('s') === 'sent';
  const n = Object.assign({}, s, { status: ok ? 'sent' : 'failed', err: ok ? '' : String(url.searchParams.get('e') || 'not sent').replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 150), mid: ok ? String(url.searchParams.get('m') || '').slice(0, 80) : '', doneAt: Date.now() });
  await env.DB.prepare('UPDATE vj_meta SET v = ? WHERE k = ? AND v = ?').bind(JSON.stringify(n), 'billsend:' + t, r.v).run();
  try { await env.PHOTOS.delete('billpdf-' + t); } catch (e) {}
  await vjAudit(env, { email: 'aashvi (WhatsApp)' }, 'bill-whatsapp', 'bills/' + s.no, n.status + (n.err ? ': ' + n.err : ''));
  return reply('ok', 200);
}

// Saved bills & estimates (C-20261016-BILLBOOK): month list, one bill for re-printing, or a summary Excel. Owners + staff only.
async function vjBillBook(url, env, who, mobQ) { // a sales login sees only the bills it made; mobQ (header, not URL): one party's bills (owner 26/10 18:03)
  const mq = String(mobQ || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(0, 12), byMob = mq.length >= 4;
  const mine = b => who.role !== 'sales' || b.by === who.email;
  if (!vjBillsOk) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)').run(); vjBillsOk = true; }
  if (url.pathname === '/api/vj/bill') {
    const row = await env.DB.prepare('SELECT data FROM vj_bills WHERE no = ?').bind(String(url.searchParams.get('no') || '').slice(0, 20)).first();
    const one = row ? JSON.parse(row.data) : null;
    return one && mine(one) ? vjJson({ ok: true, bill: one }) : vjDeny(404, 'not found');
  }
  if (who.role === 'admin') await vjSoldBackfill(env, who); // C-20261026-SOLD
  const month = String(url.searchParams.get('month') || ''), all = month === 'all';
  if (!all && !/^\d{4}-\d{2}$/.test(month)) return vjDeny(400, 'month as YYYY-MM or all');
  const bills = (((await env.DB.prepare('SELECT data FROM vj_bills ORDER BY ts').all()).results) || []).map(r => JSON.parse(r.data))
    .filter(b => !b.cancelled && (all || String(b.date || '').startsWith(month)) && mine(b) && (!byMob || String(b.mobile || '').replace(/\D/g, '').includes(mq))).sort(/* owner 17/10 16:03: cancelled bills appear nowhere (list, summary, bills, pieces); the record stays only in the database (C-20261017-NOCANCELLED) */ (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.at).localeCompare(String(b.at)));
  const MODE = { ws: 'W/s', nett: 'Nett', g2g: 'Gold to Gold', item: 'Gold Item' };
  const dmy = d => String(d || '').split('-').reverse().join('-');
  const rcs = url.pathname === '/api/vj/bills' ? (await vjLedgerLoad(env)).rcs : []; // C-20261017-LEDGER: paid / balance per bill
  if (url.pathname === '/api/vj/bills') return vjJson({ ok: true, bills: bills.map(b => ({ no: b.no, title: b.title, date: b.date, name: b.name, city: b.city, mobile: b.mobile,
    mode: b.mode, settle: b.settle || '', total: b.total, ...(b.title === 'Bill' ? (q => ({ received: q.recv, balance: q.bal, fineDue: q.fineDue, settled: !!b.settled }))(vjBillPos(b, rcs)) : {}), fine: b.fine || 0, disc: b.disc || 0, pieces: (b.rows || []).length, rows: (b.rows || []).map(r => ({ design: String(r.design || ''), cat: String(r.cat || ''), label: String(r.label || '') })) /* owner 27/10 18:00: design no. + item on Saved bills (C-20261027-BILLDESIGN) */, by: b.byName && b.byName !== 'Owner' ? b.byName : String(b.by || '').split('@')[0],
    cancelled: b.cancelled ? b.cancelled.reason + (b.cancelled.note ? ' - ' + b.cancelled.note : '') + ' (' + b.cancelled.byName + ')' : '' })), canCancel: who.role === 'admin', canCancelOnly: true });
  const head = ['Date', 'Number', 'Type', 'Status', 'Customer', 'Mobile', 'City', 'Gold calculation', 'Gold rate F (Rs/g)', 'Pieces', 'Total (Rs)', 'Discount (Rs)', 'After discount (Rs)', 'Rounded (Rs)', 'GST (Rs)', 'Bill total (Rs)', 'Fine gold to receive (g)', 'Made by'];
  const cx = b => b.cancelled ? 'CANCELLED - ' + b.cancelled.reason + (b.cancelled.note ? ': ' + b.cancelled.note : '') + ' (' + b.cancelled.byName + ', ' + dmy(String(b.cancelled.at).slice(0, 10)) + ')' : 'Active';
  const rows = bills.map(b => [dmy(b.date), b.no, b.title, cx(b), b.name, vjPhoneTxt(b.mobile), b.city || '', (MODE[b.mode] || b.mode) + (b.settle === 'fine' ? ' (fine gold)' : b.settle === 'amount' ? ' (in rupees)' : ''),
    Number(b.F) || '', (b.rows || []).map(r => (r.design ? r.design + ' / ' : '') + r.label).join(', '), b.sum, b.disc || 0, b.after == null ? b.sum : b.after, b.sub, b.gst, b.total, b.fine || '', b.byName && b.byName !== 'Owner' ? b.byName : String(b.by || '').split('@')[0]]);
  const live = rows.filter(r => r[3] === 'Active'); // cancelled bills are left out of the totals
  const tot = live.reduce((a, r) => [a[0] + (r[10] || 0), a[1] + (r[11] || 0), a[2] + (r[14] || 0), a[3] + (r[15] || 0), a[4] + (Number(r[16]) || 0)], [0, 0, 0, 0, 0]);
  if (rows.length) rows.push(['', '', '', '', 'TOTAL (' + live.length + (live.length < rows.length ? ', ' + (rows.length - live.length) + ' cancelled left out' : '') + ')', '', '', '', '', '', tot[0], tot[1], '', '', tot[2], tot[3], Math.round(tot[4] * 1000) / 1000 || '', '']);
  const pieces = []; bills.forEach(b => (b.rows || []).forEach(r => pieces.push([dmy(b.date), b.no, b.title, b.cancelled ? 'CANCELLED' : 'Active', b.name, r.label, r.design || '', r.cat || '', r.gold || '', r.fine || '', r.goldAmt, r.making, r.ct || '', r.diaAmt, r.polkiPcs || '', r.polki || 0, r.other || 0, r.amount, r.disc || 0, r.net == null ? r.amount : r.net])));
  // A4 portrait summary for printing (owner 16/10): 7 columns that fit the page at normal size; full detail on the next sheets
  // owner 17/10 16:04: Amount before GST + GST = Total amount, and the customer's mobile number
  // owner 26/10 18:10: our DESIGN no. (e.g. 4626) + the item (Pendant) + karat (14K) - not the tag code (VP14/326)
  const ITEM = { VP: 'Pendant', VLR: 'Ring', VBR: 'Bracelet', ER: 'Earring', VNS: 'Necklace', NS: 'Necklace', BAN: 'Bangle', VBAN: 'Bangle', MS: 'Mangalsutra', PS: 'Pendant Set', VPS: 'Pendant Set', BRC: 'Bracelet', VCH: 'Chain', MN: 'Mangalsutra' };
  const pcs = b => (b.rows || []).map(r => { const m = String(r.label || '').toUpperCase().match(/^S?([A-Z]+)(\d{1,2})\//); const item = r.cat || (m && ITEM[m[1]]) || ''; return [r.design || '', item + (m ? ' ' + m[2] + 'K' : '')].map(x => String(x).trim()).filter(Boolean).join(' - '); }).join('\n');
  const short = bills.map(b => [dmy(b.date), b.no, b.title, b.name, pcs(b), vjPhoneTxt(b.mobile), b.city || '', b.sub, b.gst, b.total, b.fine || '']);
  const subT = bills.reduce((a, b) => a + (Number(b.sub) || 0), 0);
  if (short.length) short.push(['', '', '', 'TOTAL (' + short.length + ')', '', '', '', subT, tot[2], tot[3], Math.round(tot[4] * 1000) / 1000 || '']);
  const xlsx = vjXlsx([
    { name: 'Summary (print)', land: true, head: ['Date', 'Number', 'Type', 'Customer', 'Design no. - Item', 'Mobile', 'City', 'Amount before GST (Rs)', 'GST (Rs)', 'Total amount (Rs)', 'Fine gold to receive (g)'], rows: short, widths: [11, 12, 8, 20, 26, 16, 12, 14, 10, 14, 10], wrap: [3, 4], mark: r => String(r[3]).startsWith('TOTAL') },
    { name: 'Bills and estimates', head, rows, widths: [11, 12, 9, 26, 22, 15, 12, 20, 10, 34, 12, 11, 12, 12, 10, 13, 12, 12], wrap: [3, 9], mark: r => String(r[3]).startsWith('CANCELLED') || String(r[4]).startsWith('TOTAL') },
    { name: 'Pieces', mark: r => r[3] === 'CANCELLED', head: ['Date', 'Number', 'Type', 'Status', 'Customer', 'Tag', 'Design no.', 'Category', 'Gold', 'Fine gold (g)', 'Gold value', 'Making', 'Diamonds (ct)', 'Diamond value', 'Polki (pcs)', 'Polki amount', 'Other', 'Amount', 'Discount', 'Net'], rows: pieces,
      widths: [11, 12, 9, 11, 22, 14, 12, 14, 20, 10, 12, 10, 10, 12, 9, 12, 9, 12, 10, 12] }]);
  const bin = atob(xlsx), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  await vjAudit(env, who, 'bills-report', 'bills/', (all ? 'all' : month) + ' ' + bills.length);
  return new Response(out, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="VJ_Bills.xlsx"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

// ---------------------------------------------------------------------------------------------
// Customer receipts, ledgers and Settled (owner Abhinav 17/10/2026, C-20261017-LEDGER).
// - Every login (admin, staff, sales) may enter receipts and see every customer's ledger (owner: 'everyone can do both').
//   Settled / un-settle: ONLY Abhinav (owner 17/10 16:15) = an owner email that is not Shilpiji's. canSettle comes from here.
// - Receipts R-YYMM-NN (from 01 every month, by the receipt date) live in vj_receipts; never deleted, only reversed with a reason.
// - The page sends only what was typed; the server finds the bill, works out every balance itself and refuses overpayments.
// - Ledger key: the customer's 10-digit mobile, else name + city. Cancelled bills and estimates are not in any ledger.
// - Settled: the rupee balance is written off as a discount ON THE BILL (spread over the pieces' Discount column), GST worked
//   again on the lower taxable value, bill total = what was received; the original figures stay in bill.original.
// ---------------------------------------------------------------------------------------------
const VJ_RC_MODES = { cash: 'Cash', upi: 'UPI', card: 'Card', cheque: 'Cheque', bank: 'Bank transfer', gold: 'Old gold', adjust: 'Adjustment' };
const VJ_KARAT = { '24K': 1, '22K': 22 / 24, '18K': 18 / 24, '14K': 14 / 24, '9K': 9 / 24 }; // old gold purity by karat; a purity % typed on the receipt wins
const VJ_SHILPI = 'vaishnavijewels@gmail.com';
let vjRcOk = false;
async function vjRcT(env) {
  if (vjRcOk) return;
  await env.DB.batch([env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_receipts (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)')]);
  vjBillsOk = true; vjRcOk = true;
}
const vjByName = who => who.role === 'admin' ? (who.email === VJ_SHILPI ? 'Shilpiji' : 'Abhinav') : (who.name || String(who.email).split('@')[0]);
const vjCanSettle = who => !!who && who.role === 'admin' && who.email !== VJ_SHILPI; // owner 17/10 16:15: only Abhinav
const vjNk = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const vjLKey = (name, city, mobile) => /^\d{10}$/.test(String(mobile || '')) ? 'm:' + mobile : 'n:' + vjNk(name).slice(0, 60) + '|' + vjNk(city).slice(0, 40);
const vjR3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const vjDmy = d => String(d || '').slice(0, 10).split('-').reverse().join('-');
const vjInr = n => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const vjIstDay = (plus = 0) => new Date(Date.now() + 5.5 * 3600e3 + plus * 864e5).toISOString().slice(0, 10);
const vjParse = r => { try { return JSON.parse(r.data); } catch (e) { return null; } };

async function vjLedgerLoad(env) {
  await vjRcT(env);
  const bills = ((((await env.DB.prepare("SELECT data FROM vj_bills WHERE no LIKE 'B-%' ORDER BY ts").all()).results) || []).map(vjParse))
    .filter(b => b && !b.cancelled && b.title !== 'Estimate'); // owner 17/10: cancelled bills appear nowhere
  const all = ((((await env.DB.prepare('SELECT data FROM vj_receipts ORDER BY ts').all()).results) || []).map(vjParse)).filter(Boolean);
  return { bills, rcs: all.filter(r => !r.reversed), all };
}
// one bill's position: rupees received (incl. old gold taken in rupees and adjustments in, less adjustments out), fine gold received
function vjBillPos(b, rcs) {
  const mine = rcs.filter(r => r.bill === b.no);
  const recv = mine.reduce((a, r) => a + (r.dir === 'out' ? -1 : 1) * (Number(r.amount) || 0), 0);
  const fineRecv = vjR3(mine.reduce((a, r) => a + (r.mode === 'gold' && r.details && r.details.goldAs === 'fine' ? Number(r.fine) || 0 : 0), 0));
  const orig = b.original ? Number(b.original.total) || 0 : Number(b.total) || 0;
  const sd = b.settled ? orig - (Number(b.total) || 0) : 0;
  const fine = b.settle === 'fine' ? Number(b.fine) || 0 : 0;
  const fineDue = fine ? vjR3(fine - fineRecv - (b.settled ? Number(b.settled.fineWaived) || 0 : 0)) : 0;
  return { recv, fineRecv, orig, sd, bal: (Number(b.total) || 0) - recv, fine, fineDue, n: mine.length };
}
// every customer: bills, receipts, on-account credit, totals
function vjCustomers(L) {
  const C = new Map();
  const get = (key, src) => { if (!C.has(key)) C.set(key, { key, name: '', city: '', mobile: '', last: '', bills: [], rcs: [] });
    const c = C.get(key), at = String(src.at || src.date || ''); if (at >= c.last) { c.last = at; c.name = src.name || c.name; c.city = src.city || ''; c.mobile = src.mobile || ''; } return c; };
  L.bills.forEach(b => get(vjLKey(b.name, b.city, b.mobile), b).bills.push(b));
  L.rcs.forEach(r => get(r.key, r).rcs.push(r));
  for (const c of C.values()) {
    c.pos = c.bills.map(b => Object.assign({ no: b.no, date: b.date, total: b.total, settled: b.settled || null }, vjBillPos(b, L.rcs)));
    c.account = c.rcs.filter(r => !r.bill).reduce((a, r) => a + (r.dir === 'out' ? -1 : 1) * (Number(r.amount) || 0), 0);
    c.billed = c.pos.reduce((a, p) => a + p.orig, 0);
    c.received = c.rcs.filter(r => r.mode !== 'adjust').reduce((a, r) => a + (Number(r.amount) || 0), 0);
    c.sd = c.pos.reduce((a, p) => a + p.sd, 0);
    c.balance = c.billed - c.received - c.sd;
    c.fineDue = vjR3(c.pos.reduce((a, p) => a + Math.max(0, p.fineDue), 0));
  }
  return C;
}
const vjCustBrief = c => ({ key: c.key, name: c.name, city: c.city, mobile: c.mobile, bills: c.bills.length, billed: c.billed, received: c.received, settlement: c.sd, balance: c.balance, account: c.account, fineDue: c.fineDue });
const vjRcText = r => {
  const d = r.details || {};
  if (r.mode === 'cheque') return 'Cheque no. ' + (d.chequeNo || '') + (d.bank ? ', ' + d.bank : '');
  if (r.mode === 'bank') return 'Bank transfer, ref. ' + (d.ref || '');
  if ((r.mode === 'upi' || r.mode === 'card') && d.ref) return VJ_RC_MODES[r.mode] + ', ref. ' + d.ref;
  if (r.mode === 'gold') return 'Old gold ' + Number(d.gross || 0).toFixed(3) + ' g ' + (d.karat ? d.karat : (d.purity || 0) + '%') + ' = ' + Number(r.fine || 0).toFixed(3) + ' g fine' + (d.goldAs === 'rupees' ? ' @ ' + vjInr(d.rate) + ' per g fine' : ' (taken as fine gold)');
  if (r.mode === 'adjust') return 'Adjustment ' + (r.dir === 'out' ? 'to ' : 'from ') + (d.other || 'account');
  return VJ_RC_MODES[r.mode] || r.mode;
};
const vjAgainst = r => r.bill || 'on account';

// GET /api/vj/ledger?q=... | ?open=1 | ?key=... ; GET /api/vj/ledger/bill?no= ; GET /api/vj/receipt?no=
async function vjLedgerGet(url, env, who) {
  const L = await vjLedgerLoad(env), C = vjCustomers(L), p = url.pathname;
  if (p === '/api/vj/ledger/bill') {
    const no = String(url.searchParams.get('no') || '').trim().toUpperCase();
    const b = /^B-\d{4}-\d{2,4}$/.test(no) ? L.bills.find(x => x.no === no) : null;
    return b ? vjJson({ ok: true, bill: b }) : vjDeny(404, 'not found');
  }
  if (p === '/api/vj/receipt') {
    const no = String(url.searchParams.get('no') || '').trim().toUpperCase();
    const r = /^R-\d{4}-\d{2,4}$/.test(no) ? L.all.find(x => x.no === no) : null;
    return r ? vjJson({ ok: true, receipt: Object.assign({ modeName: VJ_RC_MODES[r.mode], text: vjRcText(r) }, r) }) : vjDeny(404, 'not found');
  }
  const key = String(url.searchParams.get('key') || '');
  if (key) {
    if (key.length > 120 || !/^(m:\d{10}|n:[^|]{0,60}\|[^|]{0,40})$/.test(key)) return vjDeny(400, 'bad customer');
    const c = C.get(key); if (!c) return vjDeny(404, 'not found');
    // running ledger: bill = debit (its original total), settlement = credit, receipts = credit; an adjustment pair is one line, no amount
    const ev = [];
    c.bills.forEach(b => { const ps = c.pos.find(x => x.no === b.no);
      ev.push({ date: b.date, at: b.at || '', part: 'Bill ' + b.no + (b.settle === 'fine' && b.fine ? ' (+ ' + Number(b.fine).toFixed(3) + ' g fine gold)' : ''), dr: ps.orig, cr: 0 });
      if (b.settled) ev.push({ date: String(b.settled.at).slice(0, 10), at: b.settled.at, part: 'Settlement discount on ' + b.no + (b.settled.fineWaived ? ', fine gold waived ' + Number(b.settled.fineWaived).toFixed(3) + ' g' : ''), dr: 0, cr: ps.sd }); });
    c.rcs.forEach(r => { if (r.mode === 'adjust') { if (r.dir === 'in') ev.push({ date: r.date, at: r.at, part: `Adjustment ${r.no}: ${vjInr(r.amount)} moved from ${(r.details && r.details.other) || 'account'} to ${vjAgainst(r)}`, dr: 0, cr: 0 }); return; }
      ev.push({ date: r.date, at: r.at, part: `Receipt ${r.no} - ${vjRcText(r)} - against ${vjAgainst(r)}`, dr: 0, cr: Number(r.amount) || 0 }); });
    ev.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.at).localeCompare(String(b.at)));
    let run = 0; ev.forEach(e => { run += e.dr - e.cr; e.bal = run; });
    await vjAudit(env, who, 'ledger-view', 'ledger/' + key.slice(0, 60), c.name);
    return vjJson({ ok: true, canSettle: vjCanSettle(who), customer: vjCustBrief(c),
      bills: c.bills.map(b => { const ps = c.pos.find(x => x.no === b.no); return { no: b.no, date: b.date, total: ps.orig, nowTotal: b.total, sub: b.sub, received: ps.recv, settlement: ps.sd, balance: ps.bal, fine: ps.fine, fineRecv: ps.fineRecv, fineDue: ps.fineDue, gstPct: b.gstPct,
        settled: b.settled ? { at: b.settled.at, byName: b.settled.byName, discount: b.settled.discount, gstReduction: b.settled.gstReduction, paid: b.settled.paid, fineWaived: b.settled.fineWaived || 0 } : null }; }),
      receipts: c.rcs.map(r => ({ no: r.no, date: r.date, mode: r.mode, modeName: VJ_RC_MODES[r.mode], text: vjRcText(r), amount: r.amount, fine: r.fine || 0, bill: r.bill || '', dir: r.dir || '', note: r.note || '', byName: r.byName || '' })),
      ledger: ev });
  }
  const open = url.searchParams.get('open') === '1', q = String(url.searchParams.get('q') || '').trim().slice(0, 40);
  if (!open && q.length < 2) return vjDeny(400, 'type at least 2 letters or digits');
  const qd = q.replace(/\D/g, ''), qn = vjNk(q);
  const hit = [...C.values()].filter(c => open ? (c.balance !== 0 || c.fineDue > 0 || c.account !== 0)
    : (qd.length >= 3 && String(c.mobile).replace(/\D/g, '').includes(qd)) || (qn && vjNk(c.name).includes(qn)) || c.bills.some(b => b.no === q.toUpperCase()));
  hit.sort((a, b) => String(b.last).localeCompare(String(a.last)));
  return vjJson({ ok: true, canSettle: vjCanSettle(who), customers: hit.slice(0, 40).map(vjCustBrief), more: Math.max(0, hit.length - 40) });
}

// R-YYMM-NN numbering (by the receipt date), same way as bills
async function vjRcInsert(env, who, r) {
  const px = 'R-' + r.date.slice(2, 4) + r.date.slice(5, 7) + '-';
  for (let i = 0; i < 6; i++) {
    const used = ((await env.DB.prepare('SELECT no FROM vj_receipts WHERE no LIKE ?').bind(px + '%').all()).results) || [];
    r.no = px + String(used.reduce((a, x) => Math.max(a, parseInt(String(x.no).slice(px.length), 10) || 0), 0) + 1).padStart(2, '0');
    const res = await env.DB.prepare('INSERT INTO vj_receipts (no, ts, email, data) VALUES (?, ?, ?, ?) ON CONFLICT(no) DO NOTHING').bind(r.no, Date.now(), who.email, JSON.stringify(r)).run();
    if (res.meta && res.meta.changes === 1) return r.no;
  }
  return null;
}
const vjMoney = v => { const s = String(v == null ? '' : v).replace(/[,\s]/g, ''); if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return NaN; return Math.round(Number(s)); };

// POST /api/vj/receipt
async function vjReceipt(request, env, who) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 5000) return vjDeny(413, 'too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return vjDeny(400, 'bad request');
  const mode = Object.prototype.hasOwnProperty.call(VJ_RC_MODES, b.mode) ? b.mode : '';
  if (!mode) return vjDeny(400, 'choose how the customer paid');
  const date = String(b.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || date < '2024-01-01' || date > vjIstDay(1)) return vjDeny(400, 'bad date');
  const note = vjClean(b.note, 120);
  const L = await vjLedgerLoad(env), C = vjCustomers(L);
  const billOf = no => L.bills.find(x => x.no === no);
  const now = new Date().toISOString(), base = { date, at: now, by: who.email, byName: vjByName(who), mode, note };
  const done = async (list, msg) => { // insert (adjustments: both entries), then check no bill got settled meanwhile
    const nos = [];
    for (const r of list) { const n = await vjRcInsert(env, who, r); if (!n) { for (const x of nos) await env.DB.prepare('DELETE FROM vj_receipts WHERE no = ?').bind(x).run(); return vjJson({ error: 'could not give a number, try again' }, 409); } nos.push(n); }
    if (list.length === 2) { list[0].link = nos[1]; list[1].link = nos[0];
      for (const r of list) await env.DB.prepare('UPDATE vj_receipts SET data = ? WHERE no = ?').bind(JSON.stringify(r), r.no).run(); }
    for (const r of list) if (r.bill) { const row = await env.DB.prepare('SELECT data FROM vj_bills WHERE no = ?').bind(r.bill).first(), bb = row ? vjParse(row) : null;
      if (!bb || bb.cancelled || bb.settled) { for (const x of nos) await env.DB.prepare('DELETE FROM vj_receipts WHERE no = ?').bind(x).run(); return vjJson({ error: 'bill ' + r.bill + ' was settled or cancelled just now' }, 409); } }
    for (const r of list) await vjAudit(env, who, 'receipt', 'receipts/' + r.no, `${VJ_RC_MODES[mode]} ${r.dir || ''} ${r.amount}${r.fine ? ' fine ' + r.fine : ''} against ${vjAgainst(r)} | ${r.name} ${r.mobile} | ${msg}`);
    const out = list.map(r => Object.assign({ modeName: VJ_RC_MODES[r.mode], text: vjRcText(r) }, r));
    return vjJson({ ok: true, receipt: out[out.length - 1], linked: out.length === 2 ? out[0] : null });
  };

  if (mode === 'adjust') { // move credit: from a bill (what was received on it) or the customer's account, to another bill or the account
    const pick = v => { const s = String(v == null ? '' : v).trim().toUpperCase(); return s === 'ACCOUNT' ? 'account' : /^B-\d{4}-\d{2,4}$/.test(s) ? s : ''; };
    const from = pick(b.from), to = pick(b.to), amount = vjMoney(b.amount);
    if (!from || !to || from === to) return vjDeny(400, 'choose where the money moves from and to');
    if (!(amount >= 1 && amount <= 1e8)) return vjDeny(400, 'amount looks wrong');
    const bf = from === 'account' ? null : billOf(from), bt = to === 'account' ? null : billOf(to);
    if ((from !== 'account' && !bf) || (to !== 'account' && !bt)) return vjDeny(404, 'bill not found');
    if ((bf && bf.settled) || (bt && bt.settled)) return vjJson({ error: 'a settled bill cannot take or give money' }, 409);
    const any = bf || bt, key = vjLKey(any.name, any.city, any.mobile);
    if (bf && bt && vjLKey(bt.name, bt.city, bt.mobile) !== key) return vjDeny(400, 'both bills must be the same customer');
    const c = C.get(key);
    const avail = bf ? vjBillPos(bf, L.rcs).recv : (c ? c.account : 0);
    if (amount > avail) return vjDeny(400, `only ${vjInr(Math.max(0, avail))} can be moved from ${from === 'account' ? 'the account' : from}`);
    if (bt) { const pb = vjBillPos(bt, L.rcs); if (amount > pb.bal) return vjDeny(400, `more than the balance of ${to} (${vjInr(Math.max(0, pb.bal))})`); }
    const cust = { key, name: c ? c.name : any.name, city: c ? c.city : any.city, mobile: c ? c.mobile : any.mobile };
    const bal = c ? c.balance : 0;
    const out = Object.assign({}, base, cust, { amount, fine: 0, bill: bf ? from : '', dir: 'out', details: { other: to === 'account' ? 'account' : to }, balAfter: { customer: bal } });
    const inn = Object.assign({}, base, cust, { amount, fine: 0, bill: bt ? to : '', dir: 'in', details: { other: from === 'account' ? 'account' : from }, balAfter: { customer: bal } });
    if (bt) inn.balAfter.bill = vjBillPos(bt, L.rcs).bal - amount;
    return done([out, inn], from + ' -> ' + to);
  }

  // which customer: the bill's customer (never the page's), or for an on-account receipt an existing customer / the typed details
  const billNo = String(b.bill || '').trim().toUpperCase();
  let bill = null, cust;
  if (billNo) {
    if (!/^B-\d{4}-\d{2,4}$/.test(billNo)) return vjDeny(400, 'bad bill number');
    bill = billOf(billNo); if (!bill) return vjDeny(404, 'bill not found');
    if (bill.settled) return vjJson({ error: billNo + ' is settled; no more receipts can be added' }, 409);
    const k = vjLKey(bill.name, bill.city, bill.mobile), c = C.get(k);
    cust = { key: k, name: c ? c.name : bill.name, city: c ? c.city : bill.city || '', mobile: c ? c.mobile : bill.mobile || '' };
  } else if (b.key) {
    const c = C.get(String(b.key).slice(0, 120)); if (!c) return vjDeny(404, 'customer not found');
    cust = { key: c.key, name: c.name, city: c.city, mobile: c.mobile };
  } else {
    const name = vjClean(b.name, 60), city = vjClean(b.city, 40), mobile = vjPhone(b.mobile);
    if (!name) return vjDeny(400, 'customer name is required');
    if (b.mobile && String(b.mobile).trim() && !mobile) return vjDeny(400, 'mobile number not readable');
    cust = { key: vjLKey(name, city, mobile), name, city, mobile };
  }
  const details = {}; let amount = 0, fine = 0;
  if (mode === 'gold') {
    const gross = Math.round(Number(b.gross) * 1000) / 1000, karat = Object.prototype.hasOwnProperty.call(VJ_KARAT, b.karat) ? b.karat : '';
    const pct = Math.round(Number(b.purity) * 100) / 100;
    if (!(gross >= 0.001 && gross <= 5000)) return vjDeny(400, 'old gold weight (g) looks wrong');
    if (b.purity != null && String(b.purity).trim() !== '' && !(pct > 0 && pct <= 100)) return vjDeny(400, 'purity % looks wrong');
    const pur = pct > 0 && pct <= 100 ? pct / 100 : karat ? VJ_KARAT[karat] : 0;
    if (!pur) return vjDeny(400, 'choose the karat or type the purity %');
    fine = vjR3(gross * pur);
    if (!(fine > 0)) return vjDeny(400, 'fine gold works out to 0');
    const goldAs = b.goldAs === 'fine' ? 'fine' : b.goldAs === 'rupees' ? 'rupees' : '';
    if (!goldAs) return vjDeny(400, 'take the old gold as fine gold or in rupees?');
    Object.assign(details, { gross, karat: pct > 0 ? '' : karat, purity: pct > 0 ? pct : Math.round(pur * 10000) / 100, goldAs });
    if (goldAs === 'fine') {
      if (!bill) return vjDeny(400, 'fine gold can only be taken against a bill with fine gold due');
      const ps = vjBillPos(bill, L.rcs);
      if (!(ps.fineDue > 0)) return vjDeny(400, billNo + ' has no fine gold due');
      if (fine > ps.fineDue + 0.0005) return vjDeny(400, `more than the fine gold due on ${billNo} (${ps.fineDue.toFixed(3)} g)`);
    } else {
      const rate = Math.round(Number(b.rate) * 100) / 100;
      if (!(rate >= 2000 && rate <= 50000)) return vjDeny(400, 'rate per g of fine gold looks wrong');
      details.rate = rate; amount = Math.round(fine * rate);
    }
  } else {
    amount = vjMoney(b.amount);
    if (!(amount >= 1 && amount <= 1e8)) return vjDeny(400, 'amount looks wrong');
    if (mode === 'cheque') { const cn = String(b.chequeNo || '').trim(), bank = vjClean(b.bank, 40);
      if (!/^[0-9A-Za-z\-\/]{3,20}$/.test(cn) || bank.length < 2) return vjDeny(400, 'cheque number and bank are required'); Object.assign(details, { chequeNo: cn, bank }); }
    if (mode === 'bank') { const ref = vjClean(b.ref, 40); if (ref.length < 3) return vjDeny(400, 'bank reference is required'); details.ref = ref; }
    if (mode === 'upi' || mode === 'card') { const ref = vjClean(b.ref, 40); if (ref) details.ref = ref; }
  }
  const c = C.get(cust.key), balAfter = { customer: (c ? c.balance : 0) - amount, account: (c ? c.account : 0) + (bill ? 0 : amount) };
  if (bill) { const ps = vjBillPos(bill, L.rcs);
    if (amount > ps.bal) return vjDeny(400, `more than the balance of ${billNo} (${vjInr(Math.max(0, ps.bal))}). Put the extra on the customer's account (no bill).`);
    balAfter.bill = ps.bal - amount; balAfter.fineDue = vjR3(ps.fineDue - (details.goldAs === 'fine' ? fine : 0)); }
  const r = Object.assign({}, base, cust, { amount, fine, bill: bill ? billNo : '', details, balAfter });
  return done([r], '');
}

// POST /api/vj/receipt/reverse {no, reason}: anyone, with a reason; kept in the database, left out of balances and lists
async function vjReceiptReverse(request, env, who) {
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  const no = String(b && b.no || '').trim().toUpperCase(), reason = vjClean(b && b.reason, 120);
  if (!/^R-\d{4}-\d{2,4}$/.test(no)) return vjDeny(400, 'bad receipt number');
  if (reason.length < 3) return vjDeny(400, 'write the reason');
  const L = await vjLedgerLoad(env), r = L.all.find(x => x.no === no);
  if (!r) return vjDeny(404, 'not found');
  if (r.reversed) return vjJson({ error: 'already reversed' }, 409);
  const pair = [r].concat(r.link ? L.all.filter(x => x.no === r.link && !x.reversed) : []);
  for (const x of pair) if (x.bill) { const bb = L.bills.find(y => y.no === x.bill); if (bb && bb.settled) return vjJson({ error: x.bill + ' is settled; Abhinav must un-settle it first' }, 409); }
  // without these entries no bill may have taken back more than it received, and the account may not go below zero
  const rest = { bills: L.bills, rcs: L.rcs.filter(x => !pair.some(p => p.no === x.no)) }, C2 = vjCustomers(rest);
  const c2 = C2.get(r.key);
  if (c2 && c2.account < 0) return vjJson({ error: 'the account credit from this receipt was already moved to a bill; reverse that adjustment first' }, 409);
  for (const bb of L.bills) if (vjBillPos(bb, rest.rcs).recv < 0) return vjJson({ error: 'money from this receipt was already moved on (' + bb.no + '); reverse that adjustment first' }, 409);
  const at = new Date().toISOString();
  for (const x of pair) {
    const row = await env.DB.prepare('SELECT data FROM vj_receipts WHERE no = ?').bind(x.no).first(); if (!row) continue;
    const d = vjParse(row); if (!d || d.reversed) continue;
    d.reversed = { at, by: who.email, byName: vjByName(who), reason };
    const u = await env.DB.prepare('UPDATE vj_receipts SET data = ? WHERE no = ? AND data = ?').bind(JSON.stringify(d), x.no, row.data).run();
    if (!u.meta || u.meta.changes !== 1) return vjJson({ error: 'changed meanwhile, try again' }, 409);
    await vjAudit(env, who, 'receipt-reverse', 'receipts/' + x.no, reason + ' | ' + x.amount + ' against ' + vjAgainst(x));
  }
  return vjJson({ ok: true, reversed: pair.map(x => x.no) });
}

// Settlement figures (pure, tested): total = what was received; taxable = round(paid / (1 + GST%)); GST = paid - taxable;
// the drop in taxable value is spread over the pieces' Discount column pro rata to their net, whole rupees, last piece takes the rest.
function vjSettleCalc(bill, paid) {
  const b = JSON.parse(JSON.stringify(bill)), g = Number(bill.gstPct) || 0, same = paid === Number(bill.total);
  const taxable = same ? Number(bill.sub) : Math.round(paid / (1 + g / 100)), gst = same ? Number(bill.gst) : paid - taxable;
  const D = Math.max(0, (Number(bill.sub) || 0) - taxable), rows = b.rows || [];
  const base = rows.reduce((a, r) => a + Math.max(0, Number(r.net) || 0), 0);
  let left = D;
  rows.forEach((r, i) => { const n = Math.max(0, Number(r.net) || 0); let s = i === rows.length - 1 ? left : (base ? Math.round(D * n / base) : 0); s = Math.max(0, Math.min(s, n, left)); r.settleDisc = s; left -= s; });
  for (const r of rows) { if (!left) break; const s = Math.min(Math.max(0, r.net - r.settleDisc), left); r.settleDisc += s; left -= s; }
  rows.forEach(r => { if (r.settleDisc) { r.disc = (Number(r.disc) || 0) + r.settleDisc; r.net = r.net - r.settleDisc; r.discTxt = ''; } else delete r.settleDisc; });
  b.original = { sub: bill.sub, gst: bill.gst, total: bill.total, disc: bill.disc || 0, after: bill.after, rows: bill.rows };
  b.sub = taxable; b.after = taxable; b.gst = gst; b.total = paid; b.disc = (Number(bill.disc) || 0) + D;
  return { bill: b, discount: D, gstReduction: (Number(bill.gst) || 0) - gst };
}

// POST /api/vj/ledger/settle {no, expect} - Abhinav only. expect = the received figure he saw (if it changed, he must look again)
async function vjSettle(request, env, who) {
  if (!vjCanSettle(who)) return vjDeny(403, 'only Abhinav can settle a bill');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  const no = String(b && b.no || '').trim().toUpperCase();
  if (!/^B-\d{4}-\d{2,4}$/.test(no)) return vjDeny(400, 'bad bill number');
  const L = await vjLedgerLoad(env), bill = L.bills.find(x => x.no === no);
  if (!bill) return vjDeny(404, 'bill not found');
  if (bill.settled) return vjJson({ error: 'already settled' }, 409);
  const ps = vjBillPos(bill, L.rcs);
  if (ps.bal < 0) return vjJson({ error: `more was received than the bill total; move ${vjInr(-ps.bal)} to the account first` }, 409);
  if (ps.bal === 0 && !(ps.fineDue > 0)) return vjJson({ error: 'nothing to settle: the bill is fully paid' }, 409);
  if (Number(b && b.expect) !== ps.recv) return vjJson({ error: 'the figures changed meanwhile; look again', received: ps.recv }, 409);
  const row = await env.DB.prepare('SELECT data FROM vj_bills WHERE no = ?').bind(no).first();
  const s = vjSettleCalc(bill, ps.recv), nb = s.bill;
  nb.settled = { at: new Date().toISOString(), by: who.email, byName: vjByName(who), discount: s.discount, gstReduction: s.gstReduction, paid: ps.recv, fineWaived: ps.fineDue > 0 ? ps.fineDue : 0 };
  const u = await env.DB.prepare('UPDATE vj_bills SET data = ? WHERE no = ? AND data = ?').bind(JSON.stringify(nb), no, row.data).run();
  if (!u.meta || u.meta.changes !== 1) return vjJson({ error: 'changed meanwhile, try again' }, 409);
  const L2 = await vjLedgerLoad(env); // a receipt saved at the same moment: put the bill back
  if (vjBillPos(bill, L2.rcs).recv !== ps.recv) { await env.DB.prepare('UPDATE vj_bills SET data = ? WHERE no = ? AND data = ?').bind(row.data, no, JSON.stringify(nb)).run(); return vjJson({ error: 'a receipt was just added; look again' }, 409); }
  await vjAudit(env, who, 'bill-settle', 'bills/' + no, `total ${bill.total} -> ${nb.total}, discount ${s.discount}, GST less ${s.gstReduction}${nb.settled.fineWaived ? ', fine waived ' + nb.settled.fineWaived + ' g' : ''}`);
  return vjJson({ ok: true, bill: nb });
}

// POST /api/vj/ledger/unsettle {no, reason} - Abhinav only; the original figures come back, the settlement is kept in history
async function vjUnsettle(request, env, who) {
  if (!vjCanSettle(who)) return vjDeny(403, 'only Abhinav can settle a bill');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  const no = String(b && b.no || '').trim().toUpperCase(), reason = vjClean(b && b.reason, 120);
  if (!/^B-\d{4}-\d{2,4}$/.test(no)) return vjDeny(400, 'bad bill number');
  if (reason.length < 3) return vjDeny(400, 'write the reason');
  await vjRcT(env);
  const row = await env.DB.prepare('SELECT data FROM vj_bills WHERE no = ?').bind(no).first(), bill = row ? vjParse(row) : null;
  if (!bill || bill.cancelled || bill.title === 'Estimate') return vjDeny(404, 'bill not found');
  if (!bill.settled || !bill.original) return vjJson({ error: 'this bill is not settled' }, 409);
  const o = bill.original;
  bill.unsettled = (Array.isArray(bill.unsettled) ? bill.unsettled : []).concat([Object.assign({}, bill.settled, { undoneAt: new Date().toISOString(), undoneBy: who.email, undoneByName: vjByName(who), reason })]);
  Object.assign(bill, { sub: o.sub, gst: o.gst, total: o.total, disc: o.disc, after: o.after, rows: o.rows });
  delete bill.settled; delete bill.original;
  const u = await env.DB.prepare('UPDATE vj_bills SET data = ? WHERE no = ? AND data = ?').bind(JSON.stringify(bill), no, row.data).run();
  if (!u.meta || u.meta.changes !== 1) return vjJson({ error: 'changed meanwhile, try again' }, 409);
  await vjAudit(env, who, 'bill-unsettle', 'bills/' + no, reason + ' | total back to ' + o.total);
  return vjJson({ ok: true, bill });
}

// GET /api/vj/ledger.xlsx?month=YYYY-MM: sheet 1 every customer's balance today, sheet 2 the month's receipts (A4 landscape)
async function vjLedgerXlsx(url, env, who) {
  const month = String(url.searchParams.get('month') || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return vjDeny(400, 'month as YYYY-MM');
  const L = await vjLedgerLoad(env), C = [...vjCustomers(L).values()].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  const r1 = C.map(c => [c.name, vjPhoneTxt(c.mobile), c.city, c.billed, c.received, c.sd, c.balance, c.fineDue || '']);
  const t = C.reduce((a, c) => [a[0] + c.billed, a[1] + c.received, a[2] + c.sd, a[3] + c.balance, a[4] + c.fineDue], [0, 0, 0, 0, 0]);
  if (r1.length) r1.push(['TOTAL (' + C.length + ' customers)', '', '', t[0], t[1], t[2], t[3], vjR3(t[4]) || '']);
  const rm = L.rcs.filter(r => String(r.date).startsWith(month) && !(r.mode === 'adjust' && r.dir === 'out')).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.no).localeCompare(String(b.no)));
  const r2 = rm.map(r => [vjDmy(r.date), r.no, r.name, vjPhoneTxt(r.mobile), r.city || '', VJ_RC_MODES[r.mode], r.mode === 'adjust' ? 'Moved from ' + ((r.details && r.details.other) || 'account') + ' (' + (r.link || '') + ')' : vjRcText(r), vjAgainst(r), r.mode === 'adjust' ? 0 : r.amount, r.fine || '', r.note || '', r.byName || '']);
  if (r2.length) r2.push(['', 'TOTAL (' + rm.filter(r => r.mode !== 'adjust').length + ')', '', '', '', '', '', '', rm.reduce((a, r) => a + (r.mode === 'adjust' ? 0 : Number(r.amount) || 0), 0), vjR3(rm.reduce((a, r) => a + (Number(r.fine) || 0), 0)) || '', '', '']);
  const xlsx = vjXlsx([
    { name: 'Customer balances', land: true, head: ['Name', 'Mobile', 'City', 'Billed (Rs)', 'Received (Rs)', 'Settlement discount (Rs)', 'Balance (Rs)', 'Fine gold due (g)'], rows: r1, widths: [28, 16, 14, 14, 14, 16, 14, 14], wrap: [0], mark: r => String(r[0]).startsWith('TOTAL') },
    { name: 'Receipts ' + month.split('-').reverse().join('-'), land: true, head: ['Date', 'Receipt no.', 'Customer', 'Mobile', 'City', 'Mode', 'Details', 'Against', 'Amount (Rs)', 'Fine gold (g)', 'Note', 'By'], rows: r2, widths: [11, 12, 22, 15, 12, 12, 34, 12, 13, 11, 20, 12], wrap: [2, 6, 10], mark: r => String(r[1]).startsWith('TOTAL') }]);
  const bin = atob(xlsx), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  await vjAudit(env, who, 'ledger-report', 'ledger/', month + ' ' + C.length + ' customers, ' + rm.length + ' receipts');
  return new Response(out, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="VJ_Ledger.xlsx"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

// Customer recall (owner 17/10/2026 17:04, C-20261017-PARTY): type a mobile number or part of a name on New tag (order), Bill or
// Ledger receipt and get the party's name, mobile and city from earlier bills, estimates, receipts, quotes and order tags.
// Read-only, logged-in users only, at most 8 matches, nothing else about the customer is returned.
async function vjParties(url, env) {
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 40), qd = q.replace(/\D/g, ''), qn = vjNk(q);
  if (qd.length < 3 && qn.replace(/\s/g, '').length < 2) return vjJson({ ok: true, parties: [] });
  await vjRcT(env); if (!vjBillsOk) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)').run(); vjBillsOk = true; }
  const seen = new Map(), add = (name, mobile, city, at) => {
    name = vjClean(name, 60); if (!name) return; const m = vjPhone(mobile), d = String(m).replace(/\D/g, '').slice(-10);
    const key = /^[6-9]\d{9}$/.test(d) ? 'm:' + d : 'n:' + vjNk(name) + '|' + vjNk(city);
    const old = seen.get(key); if (!old || String(at || '') >= old.at) seen.set(key, { name, mobile: m, city: vjClean(city, 40), at: String(at || '') }); };
  ((((await env.DB.prepare('SELECT data FROM vj_bills').all()).results) || []).map(vjParse)).forEach(b => { if (b && !b.cancelled) add(b.name, b.mobile, b.city, b.at || b.date); });
  ((((await env.DB.prepare('SELECT data FROM vj_receipts').all()).results) || []).map(vjParse)).forEach(r => { if (r && !r.reversed) add(r.name, r.mobile, r.city, r.at || r.date); });
  ((((await env.DB.prepare("SELECT data FROM docs WHERE path LIKE 'quotes/%' OR path LIKE 'tags/%'").all()).results) || []).map(vjParse)).forEach(x => {
    if (!x) return; if (x.qno) add(x.name, x.mobile, x.city, x.at); const o = x.order || x.orderCancelled; if (o && o.name) add(o.name, o.mobile, o.city, o.at || x.createdAt || ''); });
  const hit = [...seen.values()].filter(p => (qd.length >= 3 && String(p.mobile).replace(/\D/g, '').includes(qd)) || (qn && vjNk(p.name).includes(qn)));
  hit.sort((a, b) => (qd.length >= 3 ? (String(b.mobile).replace(/\D/g, '').endsWith(qd) ? 1 : 0) - (String(a.mobile).replace(/\D/g, '').endsWith(qd) ? 1 : 0) : 0) || b.at.localeCompare(a.at));
  return vjJson({ ok: true, parties: hit.slice(0, 8).map(p => ({ name: p.name, mobile: p.mobile, city: p.city })) });
}

// Sundry debtors (owner 17/10/2026 16:43, C-20261017-DEBTORS): every customer who still owes money or fine gold, customer-wise,
// with the open bills, the oldest one and how many days it has been due, and the grand total. Advances (credit) shown apart.
function vjDebtorList(L) {
  const today = Date.parse(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
  const C = [...vjCustomers(L).values()], list = [];
  for (const c of C) {
    if (!(c.balance > 0 || c.fineDue > 0)) continue;
    const open = c.pos.filter(p => !p.settled && (p.bal > 0 || p.fineDue > 0)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const old = open.length ? open[0].date : '';
    list.push({ key: c.key, name: c.name, mobile: c.mobile, city: c.city, open: open.map(p => p.no), oldest: old, days: old ? Math.max(0, Math.round((today - Date.parse(old)) / 864e5)) : 0, balance: Math.max(0, c.balance), fineDue: c.fineDue });
  }
  list.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  const adv = C.filter(c => c.balance < 0).reduce((a, c) => a - c.balance, 0);
  return { list, total: list.reduce((a, d) => a + d.balance, 0), fine: vjR3(list.reduce((a, d) => a + d.fineDue, 0)), advances: adv };
}
async function vjDebtors(url, env, who) {
  const D = vjDebtorList(await vjLedgerLoad(env));
  if (url.pathname === '/api/vj/debtors') return vjJson(Object.assign({ ok: true }, D));
  const rows = D.list.map(d => [d.name, vjPhoneTxt(d.mobile), d.city || '', d.open.join(', '), d.oldest ? vjDmy(d.oldest) : '', d.days || '', d.balance, d.fineDue || '']);
  if (rows.length) rows.push(['TOTAL SUNDRY DEBTORS (' + D.list.length + ' customers)', '', '', '', '', '', D.total, D.fine || '']);
  if (D.advances) rows.push(['Advances received (customers in credit, not included above)', '', '', '', '', '', D.advances, '']);
  const xlsx = vjXlsx([{ name: 'Sundry debtors', land: true, head: ['Customer', 'Mobile', 'City', 'Open bills', 'Oldest bill', 'Days due', 'Balance due (Rs)', 'Fine gold due (g)'], rows,
    widths: [28, 16, 13, 26, 12, 9, 16, 14], wrap: [0, 3], mark: r => String(r[0]).startsWith('TOTAL') || String(r[0]).startsWith('Advances') }]);
  const bin = atob(xlsx), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  await vjAudit(env, who, 'debtors-report', 'ledger/', D.list.length + ' debtors, ' + D.total);
  return new Response(out, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="VJ_Sundry_Debtors.xlsx"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

// GET /api/vj/wa-ready: which WhatsApp templates are approved (set by the owner in vj_meta 'wa-ready:bill' / 'wa-ready:receipt' = '1')
async function vjWaReady(env) {
  await vjMetaT(env);
  const rows = ((await env.DB.prepare("SELECT k, v FROM vj_meta WHERE k IN ('wa-ready:bill', 'wa-ready:receipt')").all()).results) || [];
  const on = k => rows.some(r => r.k === k && r.v === '1');
  void on; return vjJson({ bill: true, receipt: true }); // both templates approved 17/10 (C-20261017-LEDGER)
}

// receipts (not reversed) against one bill - a bill with receipts is not cancelled or erased (owner 17/10)
async function vjBillRc(env, no) {
  await vjRcT(env);
  return ((((await env.DB.prepare('SELECT data FROM vj_receipts ORDER BY ts').all()).results) || []).map(vjParse)).filter(r => r && !r.reversed && r.bill === no);
}
// POSTs of the ledger must be JSON from our own page (a form on another site cannot send application/json without being refused)
const vjSameSite = (request, env) => /^application\/json\b/i.test(request.headers.get('content-type') || '') &&
  (env.VJ_DEV === '1' || !request.headers.get('origin') || request.headers.get('origin') === 'https://' + VJ_HOST);

// Daily tag report (owner 14/10/2026; evening Excel added 16/10/2026, C-20261016-TAGSDELETE). A Make schedule just "rings the
// bell" (GET /hooks/vj-daily, no data returned, no secret needed) at 20:15 IST, after the showroom closes; this worker builds
// everything itself and sends it ONLY to the existing quote hook (VJ_QUOTE_HOOK, encrypted), whose scenario forwards it to
// Abhinav's number only: (1) the WhatsApp text of new tags (as before), (2) an Excel of every tag added, edited or deleted today.
// Works only after 20:10 IST and once per day, so a stranger ringing the bell can at most make the owner's own report arrive a few
// minutes early. Nothing is sent on a day with no tag activity.
const VJ_PHOTO_F = new Set(['photo', 'photoAt', 'photoBy']);
const VJ_PRINT_F = new Set(['code', 'priceAtTag', 'gold24gAtTag', 'queue', 'queueAt', 'printedAt']);
const VJ_FIELD_NAME = { designNo: 'Design no.', label: 'Tag', catName: 'Category', remark: 'Remark', gold: 'Gold', dias: 'Diamonds', polki: 'Polki', other: 'Other charges',
  metal: 'Sample weight', box: 'Packet / box', kind: 'Order / stock / sample', order: 'Order customer', status: 'Status', photo: 'Photo', code: 'Price code', priceAtTag: 'Price when tagged' };
const vjGoldTxt = t => t && t.kind === 'sample' ? (vjSmpNet(t) > 0 ? vjSmpNet(t).toFixed(3) + ' g (14K)' : '') : (Array.isArray(t && t.gold) ? t.gold.filter(g => g && g.net > 0).map(g => g.k + ' ' + Number(g.net).toFixed(3) + ' g' + (vjLineT(g) ? ' chain tunch ' + vjLineT(g).toFixed(3) : '')).join('; ') : '');
const vjDiaTxt = t => (Array.isArray(t && t.dias) ? t.dias.filter(Boolean).map(d => `${d.shape || ''} ${d.q || ''} ${Number(d.ct || 0).toFixed(2)} ct${d.pcs ? ' (' + d.pcs + ')' : ''}`.replace(/\s+/g, ' ').trim()) : [])
  .concat(t && t.polki && t.polki.pcs > 0 ? ['Polki ' + t.polki.pcs + ' pc'] : []).join('; '); // + polki (C-20261017-POLKI)
function vjValTxt(field, raw) {
  if (raw === '' || raw == null) return '(blank)';
  let v; try { v = JSON.parse(raw); } catch (e) { return String(raw).slice(0, 120); }
  if (field === 'gold') return vjGoldTxt({ gold: v }) || '(none)';
  if (field === 'dias') return vjDiaTxt({ dias: v }) || '(none)';
  if (field === 'metal') return v && v.net > 0 ? Number(v.net).toFixed(3) + ' g' : '(none)';
  if (field === 'polki') return v && v.pcs > 0 ? v.pcs + ' pc x Rs ' + Number(v.rate || 0).toLocaleString('en-IN') : '(none)';
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
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets><definedNames>' + sheets.map((s, i) => `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${esc(s.name)}'!$1:$1</definedName>`).join('') + '</definedNames></workbook>', // header row repeats on every printed page
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3E6D3"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBE1E1"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf fillId="3" applyFill="1"/><xf applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf fillId="3" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>'
  };
  sheets.forEach((s, i) => {
    const rows = [s.head, ...s.rows].map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => { const red = ri > 0 && s.mark && s.mark(r), wrap = ri > 0 && s.wrap && s.wrap.includes(ci); return cell(v, ri + 1, ci, ri === 0 ? 1 : red ? (wrap ? 4 : 2) : wrap ? 3 : 0); }).join('')}</row>`).join('');
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${s.widths.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${col(s.head.length - 1)}${s.rows.length + 1}"/><printOptions gridLines="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.5" header="0.2" footer="0.25"/><pageSetup paperSize="9" orientation="${s.land ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;L${esc(s.name)}&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter></worksheet>`; // owner 16/10: prints on A4 portrait, all columns fitted to the page width
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
    return [status(g), t.label || g.path.slice(5), t.designNo || '', t.catName || '', t.kind === 'sample' ? 'Sample' : t.kind === 'order' ? 'Order' + (t.order && t.order.name ? ' - ' + t.order.name : '') : 'Stock', vjGoldTxt(t), vjDiaTxt(t),
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

// Orders report (C-20261016-ORDERS / ORDERSTOCK): sheet 1 pending orders (still an order and on no bill or estimate that is not
// cancelled), sheet 2 every order with its status. Owners and staff only.
async function vjOrdersReport(env, who) {
  if (who.role === 'sales') return vjDeny(403, 'not allowed');
  if (!vjBillsOk) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)').run(); vjBillsOk = true; }
  const all = ((await env.DB.prepare("SELECT path, data FROM docs WHERE path LIKE 'tags/%'").all()).results) || [];
  const users = ((await env.DB.prepare('SELECT email, name FROM users').all()).results) || [];
  const owners = String(env.OWNER_EMAILS || '').toLowerCase().split(',').map(s => s.trim());
  const by = e => e === 'vaishnavijewels@gmail.com' ? 'Shilpiji' : owners.includes(e) ? 'Abhinav' : ((users.find(u => u.email === e) || {}).name || String(e || '').split('@')[0]);
  const dmy = d => d ? String(d).slice(0, 10).split('-').reverse().join('-') : '';
  const billed = new Map(); // tag id -> the bill / estimate it is on (not cancelled), latest last
  (((await env.DB.prepare('SELECT data FROM vj_bills ORDER BY ts').all()).results) || []).map(r => JSON.parse(r.data)).filter(b => !b.cancelled)
    .forEach(b => (b.rows || []).forEach(r => billed.set(r.id, b.title + ' ' + b.no + ' (' + dmy(b.date) + ')')));
  const today = Date.parse(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
  const list = all.map(r => Object.assign({ id: r.path.slice(5) }, JSON.parse(r.data))).filter(t => t.kind === 'order' || t.orderCancelled)
    .map(t => { const o = t.order || t.orderCancelled || {}; const st = t.kind !== 'order' ? 'Moved to stock (' + dmy(t.orderCancelled && t.orderCancelled.at) + ')' : billed.has(t.id) ? 'Billed - ' + billed.get(t.id) : 'Pending';
      return { t, o, st, pending: st === 'Pending' }; })
    .sort((a, b) => String(a.o.due || '9999').localeCompare(String(b.o.due || '9999')) || String(a.t.createdAt || '').localeCompare(String(b.t.createdAt || '')));
  const base = x => [x.o.name || '', vjPhoneTxt(x.o.mobile), x.o.city || '', dmy(x.o.due)];
  const piece = x => [x.t.label || '', x.t.designNo || '', x.t.catName || '', vjGoldTxt(x.t), vjDiaTxt(x.t), Number(x.t.priceAtTag) || '', x.t.photo ? 'Yes' : 'No', x.t.printedAt ? 'Yes' : 'No', by(x.t.createdBy), dmy(x.t.createdAt), x.t.remark || ''];
  const pend = list.filter(x => x.pending).map(x => { const d = x.o.due ? Math.round((Date.parse(x.o.due) - today) / 864e5) : '';
    return [...base(x), d === '' ? '' : d < 0 ? 'OVERDUE ' + (-d) + ' d' : d, ...piece(x)]; });
  const allRows = list.map(x => [x.st, ...base(x), ...piece(x)]);
  const ph = ['Tag', 'Design no.', 'Category', 'Gold', 'Diamonds', 'Price when tagged (Rs)', 'Photo', 'Printed', 'Made by', 'Tagged on', 'Remark'];
  // amount = the tag's price at the order's own gold rate (rate on the day it was tagged), same rule as Price check (owner 16/10: 'a column of Amount also')
  const sRow = await env.DB.prepare("SELECT data FROM docs WHERE path = 'settings/main'").first(), S0 = sRow ? JSON.parse(sRow.data) : {};
  const up = (n, s) => Math.ceil(Math.round(n * 100) / 100 / s) * s, pur = Object.assign({ '22K': 0.92, '18K': 0.76, '14K': 0.60, '9K': 0.385 }, S0.purity || {});
  const mkS = Object.assign({ base: 650, small: 750, limit: 5, pct: 10, min: 1000 }, S0.making || {}), gstP = S0.gst == null ? 3 : Number(S0.gst), r24 = Number(S0.gold24g) || 0;
  const priceToday = t => { const r24o = Number(t.gold24gAtTag) || r24; if (!r24o) return 0; /* the order's own rate (C-20261016-ORDERRATE) */ const gl = (Array.isArray(t.gold) ? t.gold : []).filter(g => g && g.net > 0), dias = Array.isArray(t.dias) ? t.dias.filter(Boolean) : [];
    const dia = dias.reduce((a, d) => a + (Number(d.ct) || 0) * (Number(d.rate) || 0), 0) + (t.polki && Number(t.polki.pcs) > 0 ? Number(t.polki.pcs) * (Number(t.polki.rate) || 0) : 0) /* polki, C-20261017-POLKI */, oth = Number(t.other && t.other.amt) || 0;
    if (!gl.length) { const s0 = up(dia + oth, 10); return s0 > 0 ? up(s0 + s0 * gstP / 100, 10) : 0; }
    const g0 = gl.find(g => !vjLineT(g)), b0 = g0 && g0.net > mkS.limit ? mkS.base : mkS.small; // C-20261017-MAKINGMIN: 650/g (750 up to 5 g), min Rs 1,000, + 10% wastage on gold
    // chain lines (C-20261017-CHAINTUNCH): net x tunch x rate, no making / wastage; making on the non-chain weight only
    let gold = 0, ch = 0, nt = 0; gl.forEach(g => { const tn = vjLineT(g); if (tn) ch += g.net * r24o * tn; else { gold += g.net * r24o * (pur[g.k] || 0); nt += g.net; } }); const making = g0 ? Math.max(b0 * nt, Number(mkS.min) || 0) + gold * mkS.pct / 100 : 0;
    const sub = up(gold + ch + making + dia + oth, 100); return up(sub + sub * gstP / 100, 1000); };
  const pshort = list.filter(x => x.pending).map((x, i) => [x.o.name || '', vjPhoneTxt(x.o.mobile), x.o.city || '', dmy(x.o.due), pend[i][4], x.t.label || '', x.t.designNo || '', priceToday(x.t) || Number(x.t.priceAtTag) || '']);
  if (pshort.length) pshort.push(['TOTAL (' + pshort.length + ' pending)', '', '', '', '', '', '', pshort.reduce((a, r) => a + (Number(r[7]) || 0), 0)]);
  const xlsx = vjXlsx([
    { name: 'Pending (print)', head: ['Customer', 'Mobile', 'City', 'Delivery', 'Days left', 'Tag', 'Design no.', 'Amount at order rate (Rs)'], rows: pshort, widths: [24, 15, 11, 11, 11, 11, 10, 15], wrap: [0], mark: r => String(r[4]).startsWith('OVERDUE') || String(r[0]).startsWith('TOTAL') },
    { name: 'Pending orders', head: ['Customer', 'Mobile', 'City', 'Delivery date', 'Days left', ...ph], rows: pend, widths: [24, 16, 14, 13, 12, 14, 12, 16, 22, 34, 14, 7, 8, 14, 12, 18], wrap: [9], mark: r => String(r[4]).startsWith('OVERDUE') },
    { name: 'All orders', head: ['Status', 'Customer', 'Mobile', 'City', 'Delivery date', ...ph], rows: allRows, widths: [30, 24, 16, 14, 13, 14, 12, 16, 22, 34, 14, 7, 8, 14, 12, 18], wrap: [0, 9], mark: r => String(r[0]).startsWith('Moved') }]);
  const bin = atob(xlsx), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  await vjAudit(env, who, 'orders-report', 'tags/', pend.length + ' pending of ' + list.length);
  return new Response(out, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="VJ_Orders.xlsx"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-pending': String(pend.length) } });
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
  // owner 26/10/2026 20:20 (C-20261026-TAGSUMMARY): only a SHORT summary, no details and no Excel - new tags made (order tags not
  // counted: they are billed straight away), old tags edited, tags deleted, bills and estimates made with their amounts. It no longer
  // goes to Abhinav's WhatsApp in the evening: Make 8190722 keeps it in the Daily_Reports tab and the 07:35 morning report/PDF shows it.
  try {
    const audit = ((await env.DB.prepare("SELECT ts, email, action, path FROM audit WHERE path LIKE 'tags/%' AND action IN ('create', 'update', 'set', 'delete') AND ts >= ? ORDER BY ts").bind(dayStart).all()).results) || [];
    const delRows = ((await env.DB.prepare("SELECT path, data FROM vj_deleted WHERE ts >= ?").bind(dayStart).all()).results) || [];
    const all = ((await env.DB.prepare("SELECT path, data FROM docs WHERE path LIKE 'tags/%'").all()).results) || [];
    const byPath = new Map(all.map(r => { let d = {}; try { d = JSON.parse(r.data); } catch (e) {} return [r.path, d]; }));
    const delMap = new Map(delRows.map(r => { let d = {}; try { d = JSON.parse(r.data); } catch (e) {} return [r.path, d]; }));
    const isOrder = p => { const t = byPath.get(p) || delMap.get(p) || {}; return t.kind === 'order'; };
    const created = new Set(), edited = new Set(), gone = new Set();
    for (const a of audit) { if (isOrder(a.path)) continue; if (a.action === 'create') created.add(a.path); else if (a.action === 'delete') gone.add(a.path); else edited.add(a.path); }
    for (const p of created) edited.delete(p);
    for (const p of gone) edited.delete(p);
    let samples = 0; for (const p of created) if ((byPath.get(p) || delMap.get(p) || {}).kind === 'sample') samples++;
    if (!vjBillsOk) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_bills (no TEXT PRIMARY KEY, ts INTEGER, email TEXT, data TEXT)').run(); vjBillsOk = true; }
    const bills = ((((await env.DB.prepare('SELECT data FROM vj_bills WHERE ts >= ?').bind(dayStart).all()).results) || []).map(r => { try { return JSON.parse(r.data); } catch (e) { return null; } })).filter(b => b && !b.cancelled);
    const sum = arr => arr.reduce((s, b) => s + (Number(b.total) || 0), 0), fineSum = arr => arr.reduce((s, b) => s + (Number(b.fine) || 0), 0);
    const inr = n => 'Rs ' + Math.round(n).toLocaleString('en-IN');
    const B = bills.filter(b => b.title !== 'Estimate'), E = bills.filter(b => b.title === 'Estimate');
    const fg = arr => fineSum(arr) > 0 ? ' + fine gold ' + fineSum(arr).toFixed(3) + ' g' : '';
    const day = ist.toUTCString().slice(0, 11);
    const custName = { mihir: 'Mihir', shilpi: 'Shilpi ji', abhinav: 'Abhinav' }; // C-20261027-ESTOWNER: every estimate listed with the customer and whose customer it is
    const eLines = E.map(b => `  ${b.no} - ${b.name || ''}${b.city ? ', ' + b.city : ''}${b.mobile ? ' (' + b.mobile + ')' : ''} - ${inr(Number(b.total) || 0)}${b.usd ? ' / US$ ' + Math.round((Number(b.total) || 0) / b.usd).toLocaleString('en-US') : ''} - ${custName[b.cust] ? custName[b.cust] + "'s customer" : 'customer not marked'}`).join('\n');
    const text = `VJ Tags - daily report, ${day} (summary)\nNew tags made: ${created.size}${samples ? ' (samples ' + samples + ')' : ''} (order tags not counted)\nOld tags edited: ${edited.size}\nTags deleted: ${gone.size}\nBills made: ${B.length}${B.length ? ', total ' + inr(sum(B)) + fg(B) : ''}\nEstimates made: ${E.length}${E.length ? ', total ' + inr(sum(E)) : ''}${eLines ? '\n' + eLines : ''}`;
    // only a random one-time token leaves the worker; Make 8190722 (hook 3981296) fetches the summary once from /hooks/vj-summary
    const token = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('INSERT INTO vj_meta (k, v) VALUES (?, ?)').bind('summary:' + token, JSON.stringify({ text, date: ymd, at: Date.now() })).run();
    const r = await fetch('https://hook.eu1.make.com/84wle1719458c6yrefvpv79x9oiqqu4b', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ token }) });
    if (!r.ok) throw new Error('hook ' + r.status);
    return reply('sent summary', 200);
  } catch (e) {
    await env.DB.prepare('DELETE FROM vj_meta WHERE k = ?').bind(key).run(); // let a later bell try again
    return reply('failed', 502);
  }
  // eslint-disable-next-line no-unreachable -- old detailed report (text + Excel), kept unused since 26/10/2026 (owner wants only the summary)
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
        const wt = sample ? (vjSmpNet(t) > 0) : (t.gold || []).some(g => g.net > 0);
        if (!wt && !(t.other && t.other.amt > 0)) miss.push('no weight');
        if (!(t.dias || []).length && !(t.polki && t.polki.pcs > 0)) miss.push('no diamonds');
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

// Nightly backup of VJ Tags data (owner 17/10/2026 18:27, C-20261017-TAGSBACKUP). A Make schedule rings GET /hooks/vj-backup at
// 00:05 IST (no data returned, no secret). Only from 23:55 to 00:45 IST and once per IST date, the worker exports every D1 table as
// JSON (manifest with row counts + schema; photos stay in R2/KV), gzips it, keeps it under a random 128-bit one-time token (60 min)
// and rings VJ_QUOTE_HOOK with ONLY {kind:'vj-backup', token}. Make fetches /hooks/vj-backupfile?t=token once (then it is deleted)
// and saves it in the owner's private Drive folder "VJ Tags backups" (kept 15 days). Live bill-send / backup tokens are left out.
const VJ_BK_WIN = [23 * 60 + 55, 45]; // IST minutes, from 23:55 to 00:45
const VJ_BK_TTL = 60 * 60e3;
async function vjBackupBuild(env, ymd, now) {
  const tabs = ((await env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name NOT LIKE 'd1\\_%' ESCAPE '\\' ORDER BY name").all()).results) || [];
  const cs = new CompressionStream('gzip'), w = cs.writable.getWriter(), out = new Response(cs.readable).arrayBuffer(), enc = new TextEncoder();
  const put = s => w.write(enc.encode(s)), counts = {}, schema = {}; let skipped = 0, firstT = true;
  await put('{"format":"vj-tags-backup-1","site":"' + VJ_HOST + '","date":"' + ymd + '","at":"' + new Date(now).toISOString() + '","photos":"not included (they stay in R2/KV)","tables":{');
  for (const tb of tabs) {
    const t = String(tb.name || ''); if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) continue;
    schema[t] = tb.sql || ''; counts[t] = 0;
    await put((firstT ? '' : ',') + '"' + t + '":['); firstT = false;
    const keep = r => !(t === 'vj_meta' && (/^backupfile:/.test(r.k) || (/^billsend:/.test(r.k) && /"status":"(queued|fetched)"/.test(r.v))));
    const emit = async rows => { for (const r of rows) { if (!keep(r)) { skipped++; continue; } await put((counts[t] ? ',' : '') + JSON.stringify(r)); counts[t]++; } };
    let last = -Infinity, paged = true;
    try {
      for (;;) {
        const rows = ((await env.DB.prepare('SELECT rowid AS "__rid", * FROM "' + t + '" WHERE rowid > ? ORDER BY rowid LIMIT 3000').bind(last === -Infinity ? -9e15 : last).all()).results) || [];
        if (!rows.length) break;
        last = rows[rows.length - 1].__rid; for (const r of rows) delete r.__rid;
        await emit(rows); if (rows.length < 3000) break;
      }
    } catch (e) { paged = false; }
    if (!paged) { if (counts[t]) throw new Error('paging failed in ' + t); await emit(((await env.DB.prepare('SELECT * FROM "' + t + '"').all()).results) || []); }
    await put(']');
  }
  await put('},"manifest":' + JSON.stringify({ tables: counts, rows: Object.values(counts).reduce((a, b) => a + b, 0), skippedLiveTokens: skipped, schema }) + '}');
  await w.close();
  return { gz: new Uint8Array(await out), counts };
}
async function vjBackup(env) {
  const now = Date.now(), ist = new Date(now + 5.5 * 3600e3), mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const inWin = VJ_BK_WIN[0] <= VJ_BK_WIN[1] ? (mins >= VJ_BK_WIN[0] && mins < VJ_BK_WIN[1]) : (mins >= VJ_BK_WIN[0] || mins < VJ_BK_WIN[1]);
  if (!inWin) return reply('not now', 200);
  if (!env.DB || !env.PHOTOS || !env.VJ_QUOTE_HOOK || !/^https:\/\/hook\.[a-z0-9]+\.make\.com\//.test(env.VJ_QUOTE_HOOK)) return reply('not set up', 503);
  const ymd = new Date(now + 5.5 * 3600e3 + 10 * 60e3).toISOString().slice(0, 10); // IST date of the run (23:55-23:59 counts as the next day)
  await vjMetaT(env);
  // tidy: an export Make has collected, or never collected within 60 minutes, is removed
  try { const old = ((await env.DB.prepare("SELECT k, v FROM vj_meta WHERE k LIKE 'backupfile:%' LIMIT 50").all()).results) || [];
    for (const o of old) { const s = JSON.parse(o.v); if (s.status !== 'queued' || now - s.at > VJ_BK_TTL) { try { await env.PHOTOS.delete('backup-' + o.k.slice(11)); } catch (e) {} await env.DB.prepare('DELETE FROM vj_meta WHERE k = ?').bind(o.k).run(); } } } catch (e) {}
  const key = 'backup:' + ymd;
  const claim = await env.DB.prepare('INSERT INTO vj_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO NOTHING').bind(key, new Date(now).toISOString()).run();
  if (!claim.meta || claim.meta.changes !== 1) return reply('already done today', 200);
  let token = '';
  try {
    const { gz, counts } = await vjBackupBuild(env, ymd, now);
    token = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
    if (vjIsR2(env)) await env.PHOTOS.put('backup-' + token, gz, { httpMetadata: { contentType: 'application/gzip' } });
    else await env.PHOTOS.put('backup-' + token, gz, { expirationTtl: 3600, metadata: { type: 'application/gzip' } });
    await env.DB.prepare('INSERT INTO vj_meta (k, v) VALUES (?, ?)').bind('backupfile:' + token, JSON.stringify({ status: 'queued', at: now, ymd, bytes: gz.length })).run();
    const r = await fetch(env.VJ_QUOTE_HOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ kind: 'vj-backup', token }) });
    if (!r.ok) throw new Error('hook ' + r.status);
    await vjAudit(env, { email: 'backup (Make)' }, 'backup', 'backup/' + ymd, 'queued ' + gz.length + ' bytes; ' + Object.entries(counts).map(([k, v]) => k + ' ' + v).join(', '));
    return reply('ok', 200);
  } catch (e) {
    if (token) { try { await env.PHOTOS.delete('backup-' + token); } catch (e2) {} try { await env.DB.prepare('DELETE FROM vj_meta WHERE k = ?').bind('backupfile:' + token).run(); } catch (e2) {} }
    try { await env.DB.prepare('DELETE FROM vj_meta WHERE k = ?').bind(key).run(); } catch (e2) {} // a later bell in the window may try again
    return reply('failed', 502);
  }
}
// Make side (outside Cloudflare Access): the gz once, then it is deleted; 410 afterwards or after 60 minutes
async function vjBackupFile(url, env) {
  const t = String(url.searchParams.get('t') || ''); if (!/^[a-f0-9]{32}$/.test(t)) return reply('not found', 404);
  if (!env.DB || !env.PHOTOS) return reply('not set up', 503);
  await vjMetaT(env);
  const drop = async () => { try { await env.PHOTOS.delete('backup-' + t); } catch (e) {} };
  const r = await env.DB.prepare('SELECT v FROM vj_meta WHERE k = ?').bind('backupfile:' + t).first(); if (!r) return reply('gone', 410);
  const s = JSON.parse(r.v);
  if (s.status !== 'queued' || Date.now() - s.at > VJ_BK_TTL) { await drop(); return reply('gone', 410); }
  const u = await env.DB.prepare('UPDATE vj_meta SET v = ? WHERE k = ? AND v = ?').bind(JSON.stringify(Object.assign({}, s, { status: 'fetched', fetchedAt: Date.now() })), 'backupfile:' + t, r.v).run();
  if (!u.meta || u.meta.changes !== 1) return reply('gone', 410);
  const f = await vjPhotoGet(env, 'backup-' + t); if (!f) return reply('gone', 410);
  const buf = await new Response(f.body).arrayBuffer(); await drop();
  return new Response(buf, { status: 200, headers: { 'content-type': 'application/gzip', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex',
    'content-disposition': 'attachment; filename="VJTags_backup_' + String(s.ymd || '').replace(/[^0-9-]/g, '') + '.json.gz"' } });
}

// ---------------------------------------------------------------------------------------------
// Karigar & Out (owner 27/10/2026 11:15 + 11:17, C-20261027-KARIGAROUT).
// 1. Our own pieces going out: to a karigar (repair, polish...) or to an exhibition. The tag gets  out = {kind, name, why, note, at, by}
//    while it is away; every send / return is logged in vj_moves (who, when, where). Many pieces at once (scan or RFID burst).
// 2. Party repairs: a customer's own piece received for repair -> In Surat (with us) -> given to a karigar -> back from karigar
//    (extra gold +/- g, rupees paid to the karigar) -> returned to the customer. Kept in vj_repairs, never on a stock tag.
//    Customer charge (owner rule 27/10): what we pay the karigar, rounded UP to the next Rs 500, x 2. Editable on the job.
// 3. RFID: a tag can carry the EPC of its RFID chip (act 'link'); the reader (Zebra TC22R, DataWedge keyboard output + Enter)
//    then works in every scan box like a barcode.
// Roles: owner, staff and tagger (Shyam) can use it; the sales login cannot. Karigar rupees and extra-gold value are shown to the
// owners only (cost); staff / tagger can type them when the piece comes back.
// ---------------------------------------------------------------------------------------------
const VJ_KARIGARS = ['Montu', 'Hiru', 'Badshah', 'Ramesh'];
const VJ_OUT_WHY = ['Repair', 'Polish', 'Resize', 'Stone setting', 'Rhodium', 'Other'];
let vjKoOk = false;
async function vjKoTables(env) {
  if (vjKoOk) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_moves (ts INTEGER, email TEXT, tag TEXT, act TEXT, kind TEXT, name TEXT, why TEXT, note TEXT, photo TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS vj_moves_ts ON vj_moves (ts)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS vj_moves_tag ON vj_moves (tag)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vj_repairs (id TEXT PRIMARY KEY, no INTEGER, data TEXT, status TEXT, version INTEGER, updated_at INTEGER)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS vj_repairs_upd ON vj_repairs (updated_at)')]);
  vjKoOk = true;
}
// owner 27/10/2026 11:18: also the Vaishnavi office login (vaishnavioffice@gmail.com, used by Mihir bhai), whatever its role
const VJ_KO_EXTRA = ['vaishnavioffice@gmail.com'];
const vjKoCan = who => !!who && (['admin', 'staff', 'tagger'].includes(who.role) || VJ_KO_EXTRA.includes(who.email));
const vjPhotoId = v => /^[0-9a-f]{32}$/.test(String(v || '')) ? String(v) : '';
const vjEpc = v => { const s = String(v || '').toUpperCase().replace(/[^0-9A-F]/g, ''); return s.length >= 8 && s.length <= 64 ? s : ''; };

async function vjMove(request, env, who) {
  if (!vjKoCan(who)) return vjDeny(403, 'not allowed');
  if (Number(request.headers.get('content-length') || 0) > 60000) return vjDeny(413, 'too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  await vjKoTables(env);
  const act = b && b.act, now = Date.now();
  if (act === 'link') { // RFID chip EPC -> tag (one at a time)
    const id = String(b.id || ''), epc = vjEpc(b.epc);
    if (!/^[A-Za-z0-9_\-.~]{1,60}$/.test(id) || !epc) return vjDeny(400, 'tag and RFID number needed');
    const row = await env.DB.prepare('SELECT data, version FROM docs WHERE path = ?').bind('tags/' + id).first();
    if (!row) return vjDeny(404, 'tag not found');
    const other = await env.DB.prepare("SELECT path FROM docs WHERE path LIKE 'tags/%' AND path <> ? AND json_extract(data, '$.epc') = ?").bind('tags/' + id, epc).first();
    if (other && !b.force) return vjJson({ error: 'epc in use', on: other.path.slice(5) }, 409);
    const stm = [];
    if (other) { const od = await env.DB.prepare('SELECT data, version FROM docs WHERE path = ?').bind(other.path).first(); const o = JSON.parse(od.data); delete o.epc;
      stm.push(env.DB.prepare('UPDATE docs SET data = ?, version = ?, updated_at = ?, updated_by = ? WHERE path = ? AND version = ?').bind(JSON.stringify(o), od.version + 1, now, who.email, other.path, od.version)); }
    const d = JSON.parse(row.data); d.epc = epc;
    stm.push(env.DB.prepare('UPDATE docs SET data = ?, version = ?, updated_at = ?, updated_by = ? WHERE path = ? AND version = ?').bind(JSON.stringify(d), row.version + 1, now, who.email, 'tags/' + id, row.version));
    stm.push(env.DB.prepare('INSERT INTO vj_moves (ts, email, tag, act, kind, name, why, note, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(now, who.email, id, 'rfid', '', '', '', epc, ''));
    await env.DB.batch(stm);
    await vjAudit(env, who, 'rfid-link', 'tags/' + id, epc);
    return vjJson({ ok: true });
  }
  if (act !== 'out' && act !== 'in') return vjDeny(400, 'bad request');
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids.map(String))].filter(x => /^[A-Za-z0-9_\-.~]{1,60}$/.test(x)) : [];
  if (!ids.length || ids.length > 400) return vjDeny(400, 'choose 1 to 400 pieces');
  let out = null;
  if (act === 'out') {
    const kind = ['karigar', 'exhibition', 'other'].includes(b.kind) ? b.kind : '';
    let name = vjClean(b.name, 60);
    if (kind === 'karigar' && !VJ_KARIGARS.includes(name)) return vjDeny(400, 'choose the karigar');
    if (!kind || !name) return vjDeny(400, kind === 'exhibition' ? 'type the exhibition name' : 'where is it going?');
    const why = kind === 'karigar' ? (VJ_OUT_WHY.includes(b.why) ? b.why : 'Repair') : '';
    out = { kind, name, why, note: vjClean(b.note, 200), at: new Date(now).toISOString(), by: who.email };
    const ph = vjPhotoId(b.photo); if (ph) out.photo = ph;
  }
  const rows = [];
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const r = (await env.DB.prepare(`SELECT path, data, version FROM docs WHERE path IN (${part.map(() => '?').join(',')})`).bind(...part.map(x => 'tags/' + x)).all()).results || [];
    rows.push(...r);
  }
  const stm = [], done = [], skipped = [];
  for (const r of rows) {
    const d = JSON.parse(r.data), id = r.path.slice(5);
    if (act === 'out' && d.out) { skipped.push(id + ' (already out with ' + d.out.name + ')'); continue; }
    if (act === 'in' && !d.out) { skipped.push(id + ' (not out)'); continue; }
    const was = d.out || {};
    if (act === 'out') d.out = out; else delete d.out;
    stm.push(env.DB.prepare('UPDATE docs SET data = ?, version = ?, updated_at = ?, updated_by = ? WHERE path = ? AND version = ?').bind(JSON.stringify(d), r.version + 1, now, who.email, r.path, r.version));
    const o = act === 'out' ? out : was;
    stm.push(env.DB.prepare('INSERT INTO vj_moves (ts, email, tag, act, kind, name, why, note, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(now, who.email, id, act, o.kind || '', o.name || '', o.why || '', act === 'in' ? vjClean(b.note, 200) : (o.note || ''), act === 'out' ? (o.photo || '') : ''));
    done.push(id);
  }
  ids.filter(x => !rows.some(r => r.path === 'tags/' + x)).forEach(x => skipped.push(x + ' (no such tag)'));
  for (let i = 0; i < stm.length; i += 90) await env.DB.batch(stm.slice(i, i + 90));
  await vjAudit(env, who, 'move-' + act, 'tags/', done.length + ' pcs' + (out ? ' -> ' + out.kind + ' ' + out.name : ''));
  return vjJson({ ok: true, done, skipped });
}

async function vjMovesGet(url, env, who) {
  if (!vjKoCan(who)) return vjDeny(403, 'not allowed');
  await vjKoTables(env);
  const tag = url.searchParams.get('tag'), days = Math.min(400, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const q = tag && /^[A-Za-z0-9_\-.~]{1,60}$/.test(tag)
    ? env.DB.prepare('SELECT ts, email, tag, act, kind, name, why, note, photo FROM vj_moves WHERE tag = ? ORDER BY ts DESC LIMIT 200').bind(tag)
    : env.DB.prepare('SELECT ts, email, tag, act, kind, name, why, note, photo FROM vj_moves WHERE ts > ? ORDER BY ts DESC LIMIT 2000').bind(Date.now() - days * 864e5);
  return vjJson({ ok: true, moves: (await q.all()).results || [], karigars: VJ_KARIGARS, whys: VJ_OUT_WHY });
}

// ----- party repairs -----
const VJ_REP_ST = ['surat', 'karigar', 'ready', 'delivered', 'cancelled'];
const vjNum = (v, lo, hi, dp) => { const n = Number(v); if (!isFinite(n) || n < lo || n > hi) return null; const f = Math.pow(10, dp); return Math.round(n * f) / f; };
const vjRepCharge = kTotal => kTotal > 0 ? Math.ceil(kTotal / 500) * 500 * 2 : 0; // owner 27/10: round up to Rs 500, then x 2
async function vjRepLoad(env, id) { return env.DB.prepare('SELECT id, no, data, status, version FROM vj_repairs WHERE id = ?').bind(id).first(); }
function vjRepView(r, who) {
  const d = JSON.parse(r.data); d.id = r.id; d.no = r.no; d.status = r.status; d.version = r.version;
  if (who.role !== 'admin') { delete d.kAmt; delete d.goldVal; delete d.kTotal; } // cost: owners only
  return d;
}
async function vjRepairsGet(url, env, who) {
  if (!vjKoCan(who)) return vjDeny(403, 'not allowed');
  await vjKoTables(env);
  const since = Date.now() - 120 * 864e5;
  const rows = (await env.DB.prepare("SELECT id, no, data, status, version FROM vj_repairs WHERE status IN ('surat','karigar','ready') OR updated_at > ? ORDER BY no DESC LIMIT 1500").bind(since).all()).results || [];
  return vjJson({ ok: true, repairs: rows.map(r => vjRepView(r, who)), karigars: VJ_KARIGARS, whys: VJ_OUT_WHY, role: who.role, owner: who.role === 'admin' });
}
async function vjRepair(request, env, who) {
  if (!vjKoCan(who)) return vjDeny(403, 'not allowed');
  if (Number(request.headers.get('content-length') || 0) > 20000) return vjDeny(413, 'too large');
  let b; try { b = await request.json(); } catch (e) { return vjDeny(400, 'bad json'); }
  await vjKoTables(env);
  const op = b && b.op, now = Date.now(), iso = new Date(now).toISOString(), by = who.email;
  const hist = (d, text) => { d.log = (d.log || []).concat([{ at: iso, by, text: vjClean(text, 160) }]).slice(-40); };
  if (op === 'new') {
    const name = vjClean(b.party, 60); if (!name) return vjDeny(400, 'party name needed');
    const item = vjClean(b.item, 60); if (!item) return vjDeny(400, 'what is the piece?');
    const gross = vjNum(b.gross, 0, 5000, 3); if (gross === null) return vjDeny(400, 'gross weight 0-5000 g');
    const d = { party: name, mobile: vjPhone(b.mobile), city: vjClean(b.city, 40), item, gross, karat: VJ_Q_KARATS.includes(b.karat) ? b.karat : '',
      work: vjClean(b.work, 200), photo: vjPhotoId(b.photo), promised: /^\d{4}-\d{2}-\d{2}$/.test(String(b.promised || '')) ? b.promised : '',
      inAt: iso, inBy: by };
    hist(d, 'Received from party, in Surat');
    const last = await env.DB.prepare('SELECT MAX(no) AS m FROM vj_repairs').first();
    const no = ((last && last.m) || 0) + 1, id = 'R' + no;
    const res = await env.DB.prepare('INSERT INTO vj_repairs (id, no, data, status, version, updated_at) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(id) DO NOTHING').bind(id, no, JSON.stringify(d), 'surat', now).run();
    if (!res.meta || res.meta.changes !== 1) return vjJson({ error: 'conflict' }, 409);
    await vjAudit(env, who, 'repair-new', id, name + ' | ' + item + ' | ' + gross + ' g');
    return vjJson({ ok: true, id, no });
  }
  const id = String(b && b.id || ''); if (!/^R\d{1,7}$/.test(id)) return vjDeny(400, 'bad job');
  const r = await vjRepLoad(env, id); if (!r) return vjDeny(404, 'job not found');
  if (Number.isInteger(b.version) && b.version !== r.version) return vjJson({ error: 'conflict' }, 409);
  const d = JSON.parse(r.data); let status = r.status;
  if (op === 'karigar') {
    if (!['surat', 'ready'].includes(status)) return vjDeny(400, 'only a piece in Surat can go to a karigar');
    const k = String(b.karigar || ''); if (!VJ_KARIGARS.includes(k)) return vjDeny(400, 'choose the karigar');
    d.karigar = k; d.kOutAt = iso; d.kWork = vjClean(b.work, 200) || d.work || ''; status = 'karigar'; hist(d, 'Given to ' + k + (d.kWork ? ': ' + d.kWork : ''));
  } else if (op === 'back') {
    if (status !== 'karigar') return vjDeny(400, 'this piece is not with a karigar');
    const xg = vjNum(b.extraGold || 0, -500, 500, 3), kAmt = vjNum(b.kAmt || 0, 0, 1000000, 0), grossBack = b.grossBack === '' || b.grossBack == null ? null : vjNum(b.grossBack, 0, 5000, 3);
    if (xg === null || kAmt === null) return vjDeny(400, 'extra gold -500..500 g, karigar amount Rs 0-10,00,000');
    const xk = VJ_Q_KARATS.includes(b.extraKarat) ? b.extraKarat : (d.karat || '18K');
    const set = await env.DB.prepare("SELECT data FROM docs WHERE path = 'settings/main'").first(), s = vjQSt(set ? JSON.parse(set.data) : {});
    const goldVal = Math.round(xg * s.g * (s.pur[xk] || 0));
    d.extraGold = xg; d.extraKarat = xk; d.kAmt = kAmt; d.goldVal = goldVal; d.kTotal = kAmt + goldVal; d.grossBack = grossBack;
    d.kBackAt = iso; d.chargeSuggest = vjRepCharge(d.kTotal); if (!d.chargeSet) d.charge = d.chargeSuggest;
    status = 'ready'; hist(d, 'Back from ' + d.karigar + (xg ? ', gold ' + (xg > 0 ? '+' : '') + xg + ' g ' + xk : '') + (grossBack != null ? ', gross now ' + grossBack + ' g' : ''));
  } else if (op === 'charge') {
    const c = vjNum(b.charge, 0, 1000000, 0); if (c === null) return vjDeny(400, 'charge Rs 0-10,00,000');
    d.charge = c; d.chargeSet = true; hist(d, 'Customer charge set to Rs ' + c);
  } else if (op === 'deliver') {
    if (!['ready', 'surat'].includes(status)) return vjDeny(400, 'piece is still with the karigar');
    const c = b.charge == null || b.charge === '' ? (d.charge || 0) : vjNum(b.charge, 0, 1000000, 0); if (c === null) return vjDeny(400, 'bad charge');
    d.charge = c; d.outAt = iso; d.outBy = by; d.outNote = vjClean(b.note, 160); status = 'delivered'; hist(d, 'Returned to party, charge Rs ' + c);
  } else if (op === 'cancel') {
    if (who.role !== 'admin') return vjDeny(403, 'owner only'); status = 'cancelled'; hist(d, 'Cancelled: ' + vjClean(b.note, 120));
  } else if (op === 'photo') {
    const ph = vjPhotoId(b.photo); if (!ph) return vjDeny(400, 'bad photo'); d.photo = ph; hist(d, 'Photo added');
  } else return vjDeny(400, 'bad request');
  const res = await env.DB.prepare('UPDATE vj_repairs SET data = ?, status = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?').bind(JSON.stringify(d), status, r.version + 1, now, id, r.version).run();
  if (!res.meta || res.meta.changes !== 1) return vjJson({ error: 'conflict' }, 409);
  await vjAudit(env, who, 'repair-' + op, id, status);
  return vjJson({ ok: true, repair: vjRepView({ id, no: r.no, data: JSON.stringify(d), status, version: r.version + 1 }, who) });
}

async function vjHandle(request, env, ctx, url) {
  const p = url.pathname;
  const dev = env.VJ_DEV === '1';
  if (!dev && url.hostname !== VJ_HOST) return new Response('Not found', { status: 404 });
  if (!env.DB || !env.PHOTOS) return vjDeny(503, 'not set up');
  const who = await vjWho(request, env);
  if (!who) return p.startsWith('/api/') ? vjDeny(403, 'not allowed') : new Response('Not allowed. Ask Abhinav to add your email.', { status: 403, headers: { 'content-type': 'text/plain', 'x-robots-tag': 'noindex' } });
  if (who.role === 'tagger' && p.startsWith('/api/') && !(['/api/vj/sync', '/api/vj/bills', '/api/vj/bills.xlsx', '/api/vj/bill', '/api/vj/parties', '/api/vj/moves', '/api/vj/repairs'].includes(p) && request.method === 'GET' || ['/api/vj/write', '/api/vj/photo', '/api/vj/bill', '/api/vj/move', '/api/vj/repair'].includes(p) && request.method === 'POST')) return vjDeny(403, 'not allowed'); // owner 26/10 18:07: tagger login gets only these (+ Karigar & Out, 27/10)
  // C-20261027-KARIGAROUT: stock out / back, RFID link, party repairs (JSON from our own page only)
  if ((p === '/api/vj/move' || p === '/api/vj/repair') && request.method === 'POST') { if (!vjSameSite(request, env)) return vjDeny(403, 'not allowed'); return p === '/api/vj/move' ? vjMove(request, env, who) : vjRepair(request, env, who); }
  if (p === '/api/vj/moves' && request.method === 'GET') return vjMovesGet(url, env, who);
  if (p === '/api/vj/repairs' && request.method === 'GET') return vjRepairsGet(url, env, who);
  if (p === '/api/vj/sync' && request.method === 'GET') return vjSync(request, env, who, ctx);
  if (p === '/api/vj/write' && request.method === 'POST') return vjWrite(request, env, who, ctx);
  if (p === '/api/vj/photo' && request.method === 'POST') return vjPhotoUpload(request, env, who);
  if (p === '/api/vj/import' && request.method === 'POST') return vjImport(request, env, who);
  if (p === '/api/vj/photosearch' && request.method === 'POST') return vjPhotoSearch(request, env, who);
  if (p === '/api/vj/quote' && request.method === 'POST') return vjSameSite(request, env) ? vjQuote(request, env, who, ctx) : vjDeny(403, 'not allowed'); // JSON from our own page only (C-20261017-QUOTEMODES)
  if (p === '/api/vj/bill' && request.method === 'POST') return vjBill(request, env, who, ctx);
  if ((p === '/api/vj/bills' || p === '/api/vj/bills.xlsx' || p === '/api/vj/bill') && request.method === 'GET') return vjBillBook(url, env, who, request.headers.get('x-vj-mob'));
  if (p === '/api/vj/bill/cancel' && request.method === 'POST') return vjBillCancel(request, env, who);
  if (p === '/api/vj/bill/send' && request.method === 'POST') return vjBillSend(request, env, who); // C-20261017-BILLWA
  if (p === '/api/vj/bill/sendstatus' && request.method === 'GET') return vjBillSendStatus(url, env);
  if (p === '/api/vj/bill/erase' && request.method === 'POST') return vjBillErase(request, env, who);
  // C-20261017-LEDGER: receipts, ledgers, Settled (Abhinav only, checked inside), WhatsApp template readiness
  if ((p === '/api/vj/ledger' || p === '/api/vj/ledger/bill' || p === '/api/vj/receipt') && request.method === 'GET') return vjLedgerGet(url, env, who);
  if (p === '/api/vj/ledger.xlsx' && request.method === 'GET') return vjLedgerXlsx(url, env, who);
  if ((p === '/api/vj/debtors' || p === '/api/vj/debtors.xlsx') && request.method === 'GET') return vjDebtors(url, env, who); // C-20261017-DEBTORS
  if (p === '/api/vj/wa-ready' && request.method === 'GET') return vjWaReady(env);
  if (p === '/api/vj/parties' && request.method === 'GET') return vjParties(url, env); // C-20261017-PARTY
  if (['/api/vj/receipt', '/api/vj/receipt/reverse', '/api/vj/ledger/settle', '/api/vj/ledger/unsettle'].includes(p) && request.method === 'POST') {
    if (!vjSameSite(request, env)) return vjDeny(403, 'not allowed');
    return p === '/api/vj/receipt' ? vjReceipt(request, env, who) : p === '/api/vj/receipt/reverse' ? vjReceiptReverse(request, env, who) : p === '/api/vj/ledger/settle' ? vjSettle(request, env, who) : vjUnsettle(request, env, who);
  }
  if (p === '/api/vj/orders' && request.method === 'GET') return vjOrdersReport(env, who);
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
    if (p === '/hooks/vj-summary') return (request.method === 'GET' && url.hostname === VJ_HOST) ? vjSummaryHook(url, env) : reply('Method not allowed', 405); // C-20261026-TAGSUMMARY
    if (p === '/hooks/vj-contact') return (request.method === 'GET' && url.hostname === VJ_HOST) ? vjContactHook(url, env) : reply('Method not allowed', 405); // C-20261026-CONTACTS
    if (p === '/hooks/vj-billpdf' || p === '/hooks/vj-billpdf-done') return (request.method === 'GET' && url.hostname === VJ_HOST) ? vjBillPdfHook(url, env, p.endsWith('-done')) : reply('Method not allowed', 405); // C-20261017-BILLWA
    if (p === '/hooks/vj-daily') return (request.method === 'GET' && url.hostname === VJ_HOST) ? vjDailyReport(env) : reply('Method not allowed', 405);
    if (p === '/hooks/vj-backup' || p === '/hooks/vj-backupfile') return (request.method === 'GET' && url.hostname === VJ_HOST) ? (p === '/hooks/vj-backup' ? vjBackup(env) : vjBackupFile(url, env)) : reply('Method not allowed', 405); // C-20261017-TAGSBACKUP
    // gold rate pushed by Make (secret header); outside Cloudflare Access like the WhatsApp hook
    if (p === '/hooks/vj-gold') return (request.method === 'POST' && (url.hostname === VJ_HOST || env.VJ_DEV === '1')) ? vjGoldPush(request, env) : reply('Method not allowed', 405);
    if (p === '/hooks/wa-flush') return (request.method === 'POST' && url.hostname === VJ_HOST) ? waFlush(request, env) : reply('Method not allowed', 405); // R-159 batch send
    if (url.pathname === '/hooks/whatsapp') {
      if (request.method === 'GET') return onGet(request, env);
      if (request.method === 'POST') return onPost(request, env, ctx);
      return reply('Method not allowed', 405);
    }
    return env.ASSETS.fetch(request);
  },
};
