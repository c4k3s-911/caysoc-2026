// Passive discovery only: DNS resolution, TLS certificate metadata and the
// response headers of a plain GET /. No port scanning, no exploitation, no
// authentication attempts. Nothing here touches a host outside the seed list.
import dns from 'dns/promises';
import tls from 'tls';
import https from 'https';

const TIMEOUT = Number(process.env.ASSETS_PROBE_TIMEOUT_MS || 6000);
const UA = 'CaySoc-Asset-Monitor/1.0 (passive inventory; authorized)';

async function resolveHost(host) {
  const out = { ipv4: [], ipv6: [], cname: null, error: null };
  try { out.ipv4 = await dns.resolve4(host); } catch (e) { if (!['ENODATA', 'ENOTFOUND'].includes(e.code)) out.error = e.code; }
  try { out.ipv6 = await dns.resolve6(host); } catch {}
  try { out.cname = (await dns.resolveCname(host))[0] || null; } catch {}
  return out;
}

function tlsInfo(host) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: TIMEOUT }, () => {
      const c = socket.getPeerCertificate();
      const info = {
        ok: true,
        protocol: socket.getProtocol(),
        subject: c.subject?.CN || null,
        issuer: c.issuer?.O || c.issuer?.CN || null,
        notBefore: c.valid_from || null,
        notAfter: c.valid_to || null,
        selfSigned: !!(c.subject?.CN && c.issuer?.CN === c.subject?.CN),
      };
      socket.end();
      finish(info);
    });
    socket.on('error', e => finish({ ok: false, error: e.code || e.message }));
    socket.on('timeout', () => { socket.destroy(); finish({ ok: false, error: 'ETIMEDOUT' }); });
  });
}

function httpInfo(host) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const req = https.get({ host, port: 443, path: '/', headers: { 'user-agent': UA }, rejectUnauthorized: false, timeout: TIMEOUT }, res => {
      const h = res.headers;
      finish({
        ok: true,
        status: res.statusCode,
        server: h.server || null,
        poweredBy: h['x-powered-by'] || null,
        securityHeaders: {
          hsts: !!h['strict-transport-security'],
          csp: !!h['content-security-policy'],
          nosniff: !!h['x-content-type-options'],
          frame: !!h['x-frame-options'],
          referrer: !!h['referrer-policy'],
        },
      });
      res.resume();
    });
    req.on('error', e => finish({ ok: false, error: e.code || e.message }));
    req.on('timeout', () => { req.destroy(); finish({ ok: false, error: 'ETIMEDOUT' }); });
  });
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const i = index++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function discover(seeds) {
  const active = seeds.filter(s => s.enabled !== false);
  return mapLimit(active, Number(process.env.ASSETS_CONCURRENCY || 4), async seed => {
    const host = seed.host;
    if (host.includes('*')) {
      return { host, owner: seed.owner, status: 'wildcard', note: 'Wildcard seeds need concrete hostnames; supply exact hosts for inventory.' };
    }
    const [net, tlsData, http] = await Promise.all([resolveHost(host), tlsInfo(host), httpInfo(host)]);
    const ips = [...new Set([...net.ipv4, ...net.ipv6])];
    return {
      host,
      owner: seed.owner || 'unassigned',
      status: ips.length ? 'resolved' : 'unresolved',
      ips,
      cname: net.cname,
      dnsError: net.error,
      tls: tlsData,
      http,
    };
  });
}
