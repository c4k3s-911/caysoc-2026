// Offline analysis self-test: node src/ops/selftest.js
import { analyzeAgents, buildAlerts, opsSummary, normalizeRun } from './analysis.js';

const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok  ' + m); };
const ago = s => new Date(Date.now() - s * 1000).toISOString();
const agents = [
  { id: 'a1', name: 'Sipho Nkosi', status: 'idle', adapterConfig: { model: 'opencode/hy4-flash-free', timeoutSec: 240 }, runtimeConfig: { heartbeat: { enabled: true, intervalSec: 1800, maxConcurrentRuns: 1, maxDailyRuns: 48, maxDailyCostCents: 2000 } } },
  { id: 'a2', name: 'Thandi Mahlangu', status: 'error', adapterConfig: { model: 'opencode/hy4-flash-free' }, runtimeConfig: { heartbeat: { enabled: true, maxConcurrentRuns: 1, maxDailyRuns: 12 } } },
];
const runs = [
  { id: 'r1', agentId: 'a1', status: 'done', processStartedAt: ago(600), updatedAt: ago(560), issueId: 'CAY-1' },
  { id: 'r2', agentId: 'a1', status: 'timed_out', errorCode: 'timeout', processStartedAt: ago(1800), updatedAt: ago(1560) },
  { id: 'r3', agentId: 'a2', status: 'failed', errorCode: 'provider_error', processStartedAt: ago(300), updatedAt: ago(250) },
];
const liveRuns = [{ id: 'l1', agentId: 'a1' }];
const procInfo = { available: true, thresholdSec: 600, processes: [{ pid: 42, ageSec: 700, suspected_orphan: true }], orphans: [{ pid: 42 }] };

const n = normalizeRun(runs[0]);
assert(n.outcome === 'success' && n.durationSec === 40 && n.createdIssue, 'run normalized with outcome/duration/issue');

const analysis = analyzeAgents({ agents, runs, liveRuns, processes: procInfo.processes });
const a1 = analysis.agents.find(a => a.id === 'a1');
assert(a1.runs24h === 2 && a1.successRate === 50 && a1.live, 'agent metrics computed');
assert(a1.heartbeat.maxDailyRuns === 48 && a1.model === 'opencode/hy4-flash-free', 'agent config surfaced');
assert(analysis.models.length === 1 && analysis.models[0].runs === 3, 'model rollup computed');

const alerts = buildAlerts({ analysis, procInfo, liveRuns });
assert(alerts.some(x => x.code === 'agent_error'), 'agent error alert');
assert(alerts.some(x => x.code === 'run_failures'), 'failure alert');
assert(alerts.some(x => x.code === 'orphan_process'), 'orphan process alert');

const sum = opsSummary({ analysis, processes: procInfo, liveRuns, alerts, routines: [{ status: 'active' }] });
assert(sum.runs.last24h === 3 && sum.runs.success === 1 && sum.runs.failure === 2, 'summary run totals');
assert(sum.processes.orphans === 1 && sum.agents.error === 1 && sum.routines.active === 1, 'summary agent/process/routine totals');
console.log('ALL OPS SELFTESTS PASSED');
