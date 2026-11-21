// Pure analysis helpers for the Agent Ops Control Room. No I/O, easy to test.
const SAST_OFFSET = 2 * 3600 * 1000;
const SUCCESS = new Set(['done', 'succeeded', 'completed', 'success']);
const FAILURE = new Set(['timed_out', 'timeout', 'failed', 'error', 'cancelled', 'canceled']);
const DAY = 86400000;

const sastDay = ms => new Date(ms + SAST_OFFSET).toISOString().slice(0, 10);
const num = n => Number(n || 0);
const round = n => Math.round(Number(n || 0) * 10) / 10;

export function normalizeRun(r) {
  const start = Date.parse(r.processStartedAt || r.createdAt || 0);
  const end = Date.parse(r.updatedAt || 0);
  const status = String(r.status || 'unknown').toLowerCase();
  return {
    id: r.id,
    agentId: r.agentId,
    status,
    outcome: SUCCESS.has(status) ? 'success' : FAILURE.has(status) ? 'failure' : 'active',
    errorCode: r.errorCode || null,
    livenessState: r.livenessState || null,
    invocationSource: r.invocationSource || null,
    startedAt: start ? new Date(start).toISOString() : null,
    endedAt: end ? new Date(end).toISOString() : null,
    durationSec: start && end ? round(Math.max(0, end - start) / 1000) : null,
    issueId: r.issueId || null,
    createdIssue: !!r.issueId,
  };
}

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

export function analyzeAgents({ agents = [], runs = [], liveRuns = [], processes = [] }) {
  const norm = runs.map(normalizeRun);
  const byAgent = new Map();
  for (const r of norm) {
    if (!byAgent.has(r.agentId)) byAgent.set(r.agentId, []);
    byAgent.get(r.agentId).push(r);
  }
  const liveAgentIds = new Set(liveRuns.map(r => String(r.agentId || '')));
  const today = sastDay(Date.now());
  const cutoff = Date.now() - DAY;

  const out = agents.map(a => {
    const all = byAgent.get(a.id) || [];
    const recent = all.filter(r => Date.parse(r.startedAt || 0) >= cutoff);
    const todayRuns = all.filter(r => r.startedAt && sastDay(Date.parse(r.startedAt)) === today);
    const successes = recent.filter(r => r.outcome === 'success').length;
    const failures = recent.filter(r => r.outcome === 'failure').length;
    const durations = recent.map(r => r.durationSec).filter(n => n !== null && n > 0).sort((x, y) => x - y);
    const avg = durations.length ? round(durations.reduce((s, n) => s + n, 0) / durations.length) : null;
    const p95 = durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] : null;
    const last = recent.slice().sort((x, y) => Date.parse(y.startedAt || 0) - Date.parse(x.startedAt || 0))[0] || null;
    const ac = a.adapterConfig || {};
    const rc = a.runtimeConfig?.heartbeat || {};
    return {
      id: a.id,
      name: a.name,
      status: a.status,
      role: a.role || null,
      model: ac.model || null,
      timeoutSec: ac.timeoutSec || null,
      graceSec: ac.graceSec || null,
      heartbeat: {
        enabled: !!rc.enabled,
        intervalSec: rc.intervalSec || null,
        maxConcurrentRuns: rc.maxConcurrentRuns || null,
        maxDailyRuns: rc.maxDailyRuns || null,
        maxDailyCostCents: rc.maxDailyCostCents || null,
        skipTimerWhenNoActionableWork: !!rc.skipTimerWhenNoActionableWork,
      },
      runs24h: recent.length,
      runsToday: todayRuns.length,
      successRate: pct(successes, successes + failures),
      failures24h: failures,
      lastFailure: failures ? last?.errorCode || 'timeout' : null,
      avgDurationSec: avg,
      p95DurationSec: p95,
      lastRunAt: last?.startedAt || null,
      lastStatus: last?.status || null,
      live: liveAgentIds.has(String(a.id)),
    };
  });

  const activeAgents = out.filter(a => ['active', 'idle', 'running', 'busy'].includes(String(a.status).toLowerCase()));
  const modelMap = new Map();
  for (const r of norm) {
    const agent = agents.find(a => a.id === r.agentId);
    const model = agent?.adapterConfig?.model || 'unknown';
    if (!modelMap.has(model)) modelMap.set(model, { model, runs: 0, success: 0, failure: 0, durationTotal: 0, durationCount: 0 });
    const m = modelMap.get(model);
    m.runs++;
    if (r.outcome === 'success') m.success++;
    if (r.outcome === 'failure') m.failure++;
    if (r.durationSec) { m.durationTotal += r.durationSec; m.durationCount++; }
  }
  const models = [...modelMap.values()].map(m => ({
    ...m,
    successRate: pct(m.success, m.success + m.failure),
    avgDurationSec: m.durationCount ? round(m.durationTotal / m.durationCount) : null,
  })).sort((a, b) => b.runs - a.runs);

  return { agents: out, runs: norm, models, activeAgents: activeAgents.length };
}

export function buildAlerts({ analysis, procInfo = { available: false, processes: [], orphans: [], thresholdSec: 600 }, liveRuns = [] }) {
  const alerts = [];
  const processes = procInfo.processes || [];
  const push = (severity, code, message, agentId = null) => alerts.push({ severity, code, message, agentId });
  for (const a of analysis.agents) {
    if (String(a.status).toLowerCase() === 'error') push('critical', 'agent_error', `${a.name} is in error state`, a.id);
    if (a.failures24h > 0) push(a.failures24h >= 3 ? 'critical' : 'warning', 'run_failures', `${a.name}: ${a.failures24h} failed run(s) in 24h`, a.id);
    if (a.runs24h >= 3 && a.successRate < 60) push('warning', 'low_success_rate', `${a.name}: ${a.successRate}% success over ${a.runs24h} runs`, a.id);
    if (a.avgDurationSec && a.avgDurationSec > 180) push('warning', 'slow_runs', `${a.name}: avg run ${a.avgDurationSec}s`, a.id);
    const cap = a.heartbeat.maxDailyRuns;
    if (cap && a.runsToday >= cap * 0.8) push('warning', 'daily_cap', `${a.name}: ${a.runsToday}/${cap} daily runs used`, a.id);
  }
  for (const p of processes) {
    if (p.suspected_orphan) push('warning', 'orphan_process', `opencode pid ${p.pid} running ${p.ageSec}s (threshold ${procInfo.thresholdSec || '?'}s)`);
  }
  if (!procInfo.available) push('info', 'proc_unavailable', '/proc bind mount unavailable; orphan detection disabled');
  const capTotal = analysis.agents.reduce((n, a) => n + (a.heartbeat.maxConcurrentRuns || 0), 0);
  if (capTotal && liveRuns.length > capTotal) push('critical', 'concurrency_breach', `${liveRuns.length} live runs exceed combined cap ${capTotal}`);
  for (const m of analysis.models) {
    if (m.runs >= 3 && m.successRate < 50) push('warning', 'model_unhealthy', `${m.model}: ${m.successRate}% success over ${m.runs} runs`);
  }
  return alerts;
}

export function opsSummary({ analysis, processes, liveRuns, alerts, routines = [] }) {
  const recent = analysis.runs;
  const day = recent.filter(r => Date.parse(r.startedAt || 0) >= Date.now() - DAY);
  const success = day.filter(r => r.outcome === 'success').length;
  const failure = day.filter(r => r.outcome === 'failure').length;
  return {
    generated_at: new Date().toISOString(),
    agents: {
      total: analysis.agents.length,
      active: analysis.activeAgents,
      paused: analysis.agents.filter(a => String(a.status).toLowerCase() === 'paused').length,
      error: analysis.agents.filter(a => String(a.status).toLowerCase() === 'error').length,
    },
    runs: { last24h: day.length, success, failure, successRate: pct(success, success + failure), live: liveRuns.length },
    models: analysis.models,
    processes: { available: processes.available, count: processes.processes.length, orphans: processes.orphans.length, thresholdSec: processes.thresholdSec },
    routines: { total: routines.length, active: routines.filter(r => String(r.status).toLowerCase() === 'active').length },
    alerts,
  };
}
