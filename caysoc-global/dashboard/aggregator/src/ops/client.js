// Thin Paperclip client for the Agent Ops Control Room. All calls stay on the
// loopback Paperclip instance; local-trusted mode supplies the board actor.
const BASE = () => String(process.env.PAPERCLIP_BASE_URL || 'http://127.0.0.1:3100').replace(/\/$/, '');
const TIMEOUT = Number(process.env.PAPERCLIP_TIMEOUT_MS || 6000);

async function call(path, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(BASE() + path, {
      method: opts.method || 'GET',
      headers: { accept: 'application/json', ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(opts.token ? { authorization: 'Bearer ' + opts.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
    const text = await r.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = { _text: text.slice(0, 400) }; }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: { error: String(e && e.message || e) }, error: true };
  } finally { clearTimeout(t); }
}

const arr = v => Array.isArray(v) ? v : Array.isArray(v?.agents) ? v.agents : Array.isArray(v?.runs) ? v.runs : Array.isArray(v?.companies) ? v.companies : [];

export async function discoverCompany() {
  const r = await call('/api/companies');
  const companies = arr(r.body);
  const wanted = process.env.PAPERCLIP_COMPANY_ID;
  const c = companies.find(x => x.id === wanted)
    || companies.find(x => String(x.name || '').toLowerCase().includes('caysoc'))
    || companies.find(x => String(x.issuePrefix || '').toUpperCase() === 'CAY');
  return { ok: r.ok, company: c || null, count: companies.length };
}

export async function snapshot() {
  const disc = await discoverCompany();
  if (!disc.company) return { ok: false, reason: 'company_not_found', discovery: disc };
  const cid = disc.company.id;
  const [agentsR, runsR, liveR, routinesR] = await Promise.all([
    call(`/api/companies/${cid}/agents`),
    call(`/api/companies/${cid}/heartbeat-runs?limit=200&summary=true`),
    call(`/api/companies/${cid}/live-runs`),
    call(`/api/companies/${cid}/routines`),
  ]);
  return {
    ok: agentsR.ok && runsR.ok && liveR.ok,
    company: { id: cid, name: disc.company.name, issuePrefix: disc.company.issuePrefix },
    agents: arr(agentsR.body),
    runs: arr(runsR.body),
    liveRuns: arr(liveR.body),
    routines: arr(routinesR.body),
    sources: { agents: agentsR.ok, runs: runsR.ok, live: liveR.ok, routines: routinesR.ok },
  };
}

export async function agentAction(id, action, body = {}) {
  const map = { pause: 'pause', resume: 'resume', 'clear-error': 'clear-error' };
  if (!map[action]) return { ok: false, error: 'unknown_action' };
  return call(`/api/agents/${id}/${map[action]}`, { method: 'POST', body });
}

export async function setAgentConfig(id, patch) {
  return call(`/api/agents/${id}`, { method: 'PATCH', body: patch });
}

export async function runTrace(runId) {
  const [events, log] = await Promise.all([
    call(`/api/heartbeat-runs/${runId}/events`),
    call(`/api/heartbeat-runs/${runId}/log`),
  ]);
  return { ok: events.ok || log.ok, events: arr(events.body), log: log.body };
}
