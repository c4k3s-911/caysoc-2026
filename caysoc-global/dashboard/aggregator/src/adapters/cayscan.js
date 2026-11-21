// Read-only CayScaN adapter for CaySoc dashboard aggregator.
// CayScaN/legacy host details vary (docs mention 192.168.7.3:8443). This module is intentionally
// tolerant: it probes configured endpoints and returns structured diagnostics without requiring
// exploit/control capabilities. GOVERNED: read-only metrics/alerts only.

const TIMEOUT_MS = Number(process.env.CAYSCAN_TIMEOUT_MS || 5000);

async function fetchJson(base, path, token) {
  const url = `${String(base).replace(/\/$/, '')}${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers = { 'accept': 'application/json' };
    if (token) headers['authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = { _text: text.slice(0, 500) }; }
    return { ok: res.ok, status: res.status, url, body };
  } catch (e) {
    return { ok: false, status: 0, url, error: String(e && e.message || e) };
  } finally { clearTimeout(t); }
}

export async function buildCayscanMetrics({ baseUrl, token }) {
  if (!baseUrl) return { enabled: false, reason: 'CAYSCAN_BASE_URL not set' };
  // Probe common read-only/health/metrics paths; accept first useful response.
  const probes = ['/health', '/api/health', '/metrics', '/api/metrics', '/api/status', '/status', '/api/v1/health'];
  const results = [];
  for (const p of probes) {
    const r = await fetchJson(baseUrl, p, token);
    results.push({ path: p, ok: r.ok, status: r.status, error: r.error });
    if (r.ok) {
      return {
        enabled: true, baseUrl, ok: true, source: r.url,
        summary: typeof r.body === 'object' ? r.body : { value: r.body },
        alerts: Array.isArray(r.body?.alerts) ? r.body.alerts.length : null,
        sensors: r.body?.sensors ?? null,
        governed: true,
        note: 'Read-only CayScaN probe succeeded; map fields to CSG contract once CayScaN API schema is confirmed.',
        probes: results,
      };
    }
  }
  return { enabled: true, baseUrl, ok: false, governed: true, reason: 'no read-only probe succeeded', probes: results };
}
