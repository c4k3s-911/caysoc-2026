import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { requireRole, optionalAuth } from '../governance/auth.js';
import { recordAudit } from '../governance/store.js';
import * as client from './client.js';
import { listOpencodeProcesses } from './procs.js';
import { analyzeAgents, buildAlerts, opsSummary } from './analysis.js';

const router = Router();
// Read-only ops data is visible on the private dashboard without a token;
// mutations and raw run traces stay gated.
const READ = optionalAuth;
const WRITE = requireRole('board', 'operator');
const TRACE = requireRole('board', 'operator');

const CACHE_MS = Number(process.env.OPS_CACHE_MS || 10000);
let cache = { at: 0, data: null };

function readQuota() {
  try {
    const file = path.join(process.env.GOV_DATA_DIR || './data/governance', 'quota-recovery.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return { state: 'unknown', detail: 'No watcher status file' }; }
}

async function snapshot(force = false) {
  if (!force && cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  const data = await client.snapshot();
  const procs = listOpencodeProcesses();
  const analysis = analyzeAgents({ agents: data.agents || [], runs: data.runs || [], liveRuns: data.liveRuns || [], processes: procs.processes });
  const alerts = buildAlerts({ analysis, procInfo: procs, liveRuns: data.liveRuns || [] });
  cache = {
    at: Date.now(),
    data: {
      ok: data.ok,
      company: data.company,
      sources: data.sources,
      analysis,
      procInfo: procs,
      alerts,
      summary: {
        ...opsSummary({ analysis, processes: procs, liveRuns: data.liveRuns || [], alerts, routines: data.routines || [] }),
        quota_recovery: readQuota(),
      },
    },
  };
  return cache.data;
}

router.get('/health', (_req, res) => res.json({ ok: true, module: 'caysoc-agent-ops' }));

router.get('/summary', READ, async (_req, res) => {
  try { res.json((await snapshot()).summary); }
  catch (e) { res.status(502).json({ error: 'paperclip_unavailable', message: String(e && e.message || e) }); }
});

router.get('/agents', READ, async (req, res) => {
  try {
    const s = await snapshot(String(req.query.refresh) === '1');
    res.json({ company: s.company, agents: s.analysis.agents });
  } catch (e) { res.status(502).json({ error: String(e && e.message || e) }); }
});

router.get('/runs', READ, async (req, res) => {
  try {
    const s = await snapshot();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    res.json({ runs: s.analysis.runs.slice(0, limit) });
  } catch (e) { res.status(502).json({ error: String(e && e.message || e) }); }
});

router.get('/models', READ, async (_req, res) => {
  try { res.json({ models: (await snapshot()).analysis.models }); }
  catch (e) { res.status(502).json({ error: String(e && e.message || e) }); }
});

router.get('/alerts', READ, async (_req, res) => {
  try { res.json({ alerts: (await snapshot()).alerts }); }
  catch (e) { res.status(502).json({ error: String(e && e.message || e) }); }
});

router.get('/processes', READ, async (_req, res) => {
  res.json(listOpencodeProcesses());
});

router.get('/runs/:id/trace', TRACE, async (req, res) => {
  try { res.json(await client.runTrace(req.params.id)); }
  catch (e) { res.status(502).json({ error: String(e && e.message || e) }); }
});

router.post('/agents/:id/pause', WRITE, async (req, res) => {
  const r = await client.agentAction(req.params.id, 'pause');
  recordAudit(req.gov, 'ops.agent_paused', 'agent', req.params.id, { ok: r.ok });
  cache.at = 0;
  res.status(r.ok ? 200 : 502).json(r.body);
});

router.post('/agents/:id/resume', WRITE, async (req, res) => {
  const r = await client.agentAction(req.params.id, 'resume');
  recordAudit(req.gov, 'ops.agent_resumed', 'agent', req.params.id, { ok: r.ok });
  cache.at = 0;
  res.status(r.ok ? 200 : 502).json(r.body);
});

router.post('/agents/:id/clear-error', WRITE, async (req, res) => {
  const r = await client.agentAction(req.params.id, 'clear-error');
  recordAudit(req.gov, 'ops.agent_error_cleared', 'agent', req.params.id, { ok: r.ok });
  cache.at = 0;
  res.status(r.ok ? 200 : 502).json(r.body);
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v)));

router.patch('/agents/:id/policy', WRITE, async (req, res) => {
  const s = await snapshot(true);
  const agent = (s.analysis.agents || []).find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'agent_not_found' });
  const agents = (await client.snapshot()).agents || [];
  const full = agents.find(a => a.id === req.params.id) || {};
  const h = req.body?.heartbeat || {};
  const nextHeartbeat = {
    ...(full.runtimeConfig?.heartbeat || {}),
    enabled: h.enabled === undefined ? agent.heartbeat.enabled : !!h.enabled,
    intervalSec: h.intervalSec === undefined ? agent.heartbeat.intervalSec : clamp(h.intervalSec, 300, 86400),
    maxConcurrentRuns: h.maxConcurrentRuns === undefined ? agent.heartbeat.maxConcurrentRuns : clamp(h.maxConcurrentRuns, 1, 4),
    maxDailyRuns: h.maxDailyRuns === undefined ? agent.heartbeat.maxDailyRuns : clamp(h.maxDailyRuns, 1, 96),
    maxDailyCostCents: h.maxDailyCostCents === undefined ? agent.heartbeat.maxDailyCostCents : clamp(h.maxDailyCostCents, 100, 10000),
    skipTimerWhenNoActionableWork: h.skipTimerWhenNoActionableWork === undefined ? agent.heartbeat.skipTimerWhenNoActionableWork : !!h.skipTimerWhenNoActionableWork,
  };
  const r = await client.setAgentConfig(req.params.id, { runtimeConfig: { ...(full.runtimeConfig || {}), heartbeat: nextHeartbeat } });
  recordAudit(req.gov, 'ops.policy_updated', 'agent', req.params.id, { heartbeat: nextHeartbeat, ok: r.ok });
  cache.at = 0;
  res.status(r.ok ? 200 : 502).json({ ok: r.ok, heartbeat: nextHeartbeat, response: r.body });
});

router.post('/model/rotate', WRITE, async (req, res) => {
  const from = String(req.body?.from || '').trim();
  const to = String(req.body?.to || '').trim();
  if (!to || !/^[\w.\-]+\/[\w.\-]+$/.test(to)) return res.status(400).json({ error: 'invalid_target_model' });
  const snap = await snapshot(true);
  const agents = (await client.snapshot()).agents || [];
  const targets = agents.filter(a => {
    const m = String(a.adapterConfig?.model || '');
    return from ? m === from : m !== to;
  });
  const dryRun = !!req.body?.dryRun;
  const results = [];
  for (const a of targets) {
    if (!dryRun) {
      const r = await client.setAgentConfig(a.id, { adapterConfig: { ...(a.adapterConfig || {}), model: to } });
      results.push({ id: a.id, name: a.name, ok: r.ok });
    } else results.push({ id: a.id, name: a.name, ok: true, dryRun: true });
  }
  recordAudit(req.gov, 'ops.model_rotated', 'model', to, { from: from || '(all)', count: results.length, dryRun, ok: results.every(r => r.ok) });
  cache.at = 0;
  res.json({ from: from || '(all)', to, dryRun, changed: results.length, results });
});

export default router;
