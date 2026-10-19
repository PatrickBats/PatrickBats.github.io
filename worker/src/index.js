import { createRemoteJWKSet, jwtVerify } from 'jose';
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

export async function authorize(token, env, keySet = keys) {
  const { payload } = await jwtVerify(token, keySet, {
    algorithms: ['RS256'], issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT}`,
    audience: env.FIREBASE_PROJECT, requiredClaims: ['sub','iat','exp','auth_time']
  });
  const now = Math.floor(Date.now()/1000);
  if (!payload.sub || payload.sub.length > 128 || payload.iat > now || payload.auth_time > now ||
      payload.email_verified !== true || payload.email !== env.OWNER_EMAIL ||
      payload.firebase?.sign_in_provider !== 'google.com') throw new Error('Unauthorized');
}

function coordinate(value, max) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

export default {
  async fetch(req, env) {
    const headers = {'Cache-Control':'no-store', 'Vary':'Origin'};
    if (req.headers.get('Origin') === env.SITE_ORIGIN) headers['Access-Control-Allow-Origin'] = env.SITE_ORIGIN;
    const reply = (data, status = 200) => new Response(data === null ? null : JSON.stringify(data), {
      status, headers: {...headers, 'Content-Type':'application/json'}
    });
    const url = new URL(req.url);
    if (req.method === 'OPTIONS' && req.headers.get('Origin') === env.SITE_ORIGIN) {
      return new Response(null, {status:204, headers:{...headers,
        'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization'}});
    }
    if (url.pathname === '/visits' && req.method === 'GET') {
      try { await authorize((req.headers.get('Authorization') || '').replace(/^Bearer /,''), env); }
      catch { return reply({error:'Owner sign-in required'},401); }
      const before = url.searchParams.get('before');
      if (before !== null && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)))) return reply({error:'Invalid cursor'},400);
      try {
        const result = await env.DB.prepare(`SELECT v.*, (SELECT COUNT(*) FROM visits r WHERE r.ip=v.ip) AS repeatCount
          FROM visits v WHERE v.id < ? ORDER BY v.id DESC LIMIT 51`).bind(before === null ? Number.MAX_SAFE_INTEGER : Number(before)).all();
        const rows = result.results.slice(0,50);
        return reply({visits:rows,next:result.results.length > 50 ? String(rows.at(-1).id) : null});
      } catch { return reply({error:'Visitor records temporarily unavailable'},503); }
    }
    if (url.pathname !== '/visit' || req.method !== 'POST') return reply({error:'Not found'},404);
    if (req.headers.get('Origin') !== env.SITE_ORIGIN) return reply({error:'Forbidden'},403);
    // This header is supplied by Cloudflare at the edge. Never use forwarded-for or body IPs.
    const ip = req.headers.get('CF-Connecting-IP');
    if (!req.cf || !ip || ip.length > 45 || !/^[0-9a-fA-F:.]+$/.test(ip)) return reply({error:'Missing edge metadata'},400);
    // Cloudflare may expose a stream even for a zero-byte POST.
    if (req.body !== null) {
      const reader = req.body.getReader();
      const first = await reader.read();
      await reader.cancel();
      if (!first.done) return reply({error:'Body not accepted'},400);
    }
    try {
      if (!(await env.VISIT_LIMITER.limit({key:ip})).success) return reply({error:'Too many requests'},429);
      await env.DB.prepare('INSERT INTO visits(timestamp,ip,city,country,lat,lon) VALUES(?,?,?,?,?,?)')
        .bind(Date.now(), ip, String(req.cf.city || 'Unknown').slice(0,120), String(req.cf.country || 'Unknown').slice(0,80),
          coordinate(req.cf.latitude,90),coordinate(req.cf.longitude,180)).run();
      return reply(null,204);
    } catch { return reply({error:'Logging temporarily unavailable'},503); }
  }
};
