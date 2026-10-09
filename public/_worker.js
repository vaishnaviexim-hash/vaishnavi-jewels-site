// Pages advanced-mode worker. Only /hooks/* reaches it (see _routes.json); everything else is served as static files.
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/hooks/whatsapp') {
      if (request.method === 'GET') return onGet(request, env);
      if (request.method === 'POST') return onPost(request, env);
      return reply('Method not allowed', 405);
    }
    return env.ASSETS.fetch(request);
  },
};
