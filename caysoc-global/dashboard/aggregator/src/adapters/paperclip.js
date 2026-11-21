// Read-only Paperclip adapter for CaySoc dashboard aggregator.
// Verifies API shape at runtime; safe fallbacks when Paperclip is down/auth differs.
// Verified live cx-serv1 CAY company: 5ef64648-3fbd-4492-a973-0b6e35b34a17 (historical logs also referenced 41c10498)

const TIMEOUT_MS = Number(process.env.PAPERCLIP_TIMEOUT_MS || 5000);

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

async function tryPaths(base, paths, token) {
  for (const p of paths) {
    const r = await fetchJson(base, p, token);
    if (r.ok) return r;
  }
  // return last attempt for diagnostics
  let last = { ok:false, status:0 };
  for (const p of paths) last = await fetchJson(base, p, token);
  return last;
}

function asArray(v) { return Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : Array.isArray(v?.items) ? v.items : Array.isArray(v?.companies) ? v.companies : Array.isArray(v?.agents) ? v.agents : Array.isArray(v?.issues) ? v.issues : Array.isArray(v?.routines) ? v.routines : []; }

export async function discoverCompany({ baseUrl, token, companyId, issuePrefix }) {
  const c = await tryPaths(baseUrl, ['/api/companies', '/companies'], token);
  const companies = asArray(c.body);
  let match = null;
  if (companyId) match = companies.find(x => x.id === companyId);
  if (!match && issuePrefix) match = companies.find(x => String(x.issuePrefix || '').toUpperCase() === String(issuePrefix).toUpperCase());
  if (!match) match = companies.find(x => x.id === '41c10498-4d31-4f66-8f0c-b61058088b76' || String(x.name||'').toLower().includes('caysoc'));
  return { ok: c.ok, status: c.status, match, companies_count: companies.length, diagnostics: c.ok ? undefined : c };
}

export async function buildPaperclipMetrics({ baseUrl, token, companyId }) {
  if (!baseUrl) return { enabled: false, reason: 'PAPERCLIP_BASE_URL not set' };
  const disc = await discoverCompany({ baseUrl, token, companyId, issuePrefix: 'CAY' });
  const cid = companyId || disc.match?.id || null;
  const out = { enabled: true, baseUrl, company: disc.match ? { id: disc.match.id, name: disc.match.name, issuePrefix: disc.match.issuePrefix, status: disc.match.status, brandColor: disc.match.brandColor } : null, discovery: { ok: disc.ok, companies_count: disc.companies_count, diagnostics: disc.diagnostics }, agents: null, issues: null, routines: null, live_runs: null };
  if (!cid) return out;
  const [agentsR, issuesR, routinesR, liveR] = await Promise.all([
    tryPaths(baseUrl, [`/api/companies/${cid}/agents`, `/companies/${cid}/agents`], token),
    tryPaths(baseUrl, [`/api/companies/${cid}/issues`, `/companies/${cid}/issues`], token),
    tryPaths(baseUrl, [`/api/companies/${cid}/routines`, `/companies/${cid}/routines`], token),
    tryPaths(baseUrl, [`/api/companies/${cid}/live-runs`, `/companies/${cid}/live-runs`], token),
  ]);
  const agents = asArray(agentsR.body);
  const issues = asArray(issuesR.body);
  const routines = asArray(routinesR.body);
  const live = asArray(liveR.body);
  out.agents = { ok: agentsR.ok, total: agents.length, active: agents.filter(a => ['active','running','idle','busy'].includes(String(a.status||'').toLowerCase())).length, paused: agents.filter(a => String(a.status||'').toLowerCase()==='paused').length, error: agents.filter(a => String(a.status||'').toLowerCase()==='error').length };
  const byStatus = {}; for (const i of issues) { const s=String(i.status||'unknown').toLowerCase(); byStatus[s]=(byStatus[s]||0)+1; }
  out.issues = { ok: issuesR.ok, total: issues.length, by_status: byStatus, in_progress: (byStatus.in_progress||0)+(byStatus.in_review||0), blocked: byStatus.blocked||0, done_24h: issues.filter(i=>{ if(String(i.status||'').toLowerCase()!=='done') return false; const d=new Date(i.updatedAt||i.closedAt||i.doneAt||0).getTime(); return d && Date.now()-d < 86400000; }).length };
  out.routines = { ok: routinesR.ok, total: routines.length, active: routines.filter(r=>String(r.status||'').toLowerCase()==='active').length };
  out.live_runs = { ok: liveR.ok, count: live.length };
  return out;
}
